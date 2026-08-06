const express = require("express");
const crypto = require("crypto");
const connection = require("../snowflake");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

function executeQuery(sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, stmt, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      },
    });
  });
}

function toNumber(value) {
  return Number(value || 0);
}

function parseAddress(value) {
  if (!value) return {};

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value;
}

async function getOrder(orderId, userId) {
  const orderRows = await executeQuery(
    `
      SELECT
        ORDER_ID,
        USER_ID,
        TOTAL_AMOUNT,
        ORDER_STATUS,
        ORDER_DATE,
        SHIPPING_ADDRESS,
        PAYMENT_METHOD
      FROM ORDERS
      WHERE ORDER_ID = ? AND USER_ID = ?
    `,
    [orderId, userId]
  );

  if (orderRows.length === 0) {
    return null;
  }

  const order = orderRows[0];

  const itemRows = await executeQuery(
    `
      SELECT
        OI.PRODUCT_ID,
        OI.QUANTITY,
        OI.PRICE,
        P.PRODUCT_NAME
      FROM ORDER_ITEMS OI
      LEFT JOIN PRODUCTS P
        ON P.PRODUCT_ID = OI.PRODUCT_ID
      WHERE OI.ORDER_ID = ?
      ORDER BY OI.ITEM_ID
    `,
    [orderId]
  );

  const items = itemRows.map((item) => ({
    productId: toNumber(item.PRODUCT_ID),
    name: item.PRODUCT_NAME || `Product ${item.PRODUCT_ID}`,
    sku: `MED-${item.PRODUCT_ID}`,
    price: toNumber(item.PRICE),
    qty: toNumber(item.QUANTITY),
    lineTotal: toNumber(item.PRICE) * toNumber(item.QUANTITY),
  }));

  return {
    id: toNumber(order.ORDER_ID),
    userId: toNumber(order.USER_ID),
    items,
    total: toNumber(order.TOTAL_AMOUNT),
    address: parseAddress(order.SHIPPING_ADDRESS),
    paymentMethod: order.PAYMENT_METHOD || "cod",
    status: String(order.ORDER_STATUS || "pending").toLowerCase(),
    createdAt: toIsoString(order.ORDER_DATE),
  };
}

// POST /api/orders/checkout
router.post("/checkout", async (req, res) => {
  let transactionStarted = false;

  try {
    const { address, paymentMethod } = req.body || {};

    if (!address || !address.line1 || !address.city || !address.phone) {
      return res.status(400).json({
        error: "A complete shipping address is required",
      });
    }

    const cartRows = await executeQuery(
      `
        SELECT
          C.PRODUCT_ID,
          C.QUANTITY,
          P.PRICE
        FROM CART C
        INNER JOIN PRODUCTS P
          ON P.PRODUCT_ID = C.PRODUCT_ID
        WHERE C.USER_ID = ?
        ORDER BY C.CART_ID
      `,
      [req.user.id]
    );

    if (cartRows.length === 0) {
      return res.status(400).json({ error: "Your cart is empty" });
    }

    const items = cartRows.map((row) => ({
      productId: toNumber(row.PRODUCT_ID),
      qty: toNumber(row.QUANTITY),
      price: toNumber(row.PRICE),
    }));

    const total = items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    const checkoutToken = crypto.randomUUID();

    await executeQuery("BEGIN");
    transactionStarted = true;

    await executeQuery(
      `
        INSERT INTO ORDERS (
          USER_ID,
          TOTAL_AMOUNT,
          ORDER_STATUS,
          SHIPPING_ADDRESS,
          PAYMENT_METHOD,
          CHECKOUT_TOKEN
        )
        SELECT ?, ?, ?, PARSE_JSON(?), ?, ?
      `,
      [
        req.user.id,
        total,
        "CONFIRMED",
        JSON.stringify(address),
        paymentMethod || "cod",
        checkoutToken,
      ]
    );

    const createdOrderRows = await executeQuery(
      `
        SELECT ORDER_ID
        FROM ORDERS
        WHERE USER_ID = ? AND CHECKOUT_TOKEN = ?
        LIMIT 1
      `,
      [req.user.id, checkoutToken]
    );

    if (createdOrderRows.length === 0) {
      throw new Error("Could not retrieve the newly created order");
    }

    const orderId = createdOrderRows[0].ORDER_ID;

    for (const item of items) {
      await executeQuery(
        `
          INSERT INTO ORDER_ITEMS (
            ORDER_ID,
            PRODUCT_ID,
            QUANTITY,
            PRICE
          )
          VALUES (?, ?, ?, ?)
        `,
        [orderId, item.productId, item.qty, item.price]
      );
    }

    await executeQuery(
      `DELETE FROM CART WHERE USER_ID = ?`,
      [req.user.id]
    );

    await executeQuery("COMMIT");
    transactionStarted = false;

    const order = await getOrder(orderId, req.user.id);
    res.status(201).json(order);
  } catch (error) {
    if (transactionStarted) {
      try {
        await executeQuery("ROLLBACK");
      } catch (rollbackError) {
        console.error("ORDER ROLLBACK ERROR:", rollbackError);
      }
    }

    console.error("CHECKOUT ERROR:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// GET /api/orders
router.get("/", async (req, res) => {
  try {
    const rows = await executeQuery(
      `
        SELECT ORDER_ID
        FROM ORDERS
        WHERE USER_ID = ?
        ORDER BY ORDER_DATE DESC, ORDER_ID DESC
      `,
      [req.user.id]
    );

    const orders = await Promise.all(
      rows.map((row) => getOrder(row.ORDER_ID, req.user.id))
    );

    res.json(orders.filter(Boolean));
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

// GET /api/orders/:id
router.get("/:id", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await getOrder(orderId, req.user.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    res.status(500).json({ error: "Failed to load order" });
  }
});

module.exports = router;
