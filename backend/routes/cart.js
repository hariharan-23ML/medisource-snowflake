const express = require("express");
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

async function getHydratedCart(userId) {
  const rows = await executeQuery(
    `
      SELECT
        C.CART_ID,
        C.PRODUCT_ID,
        C.QUANTITY,
        P.PRODUCT_NAME,
        P.BRAND,
        P.IMAGE_URL,
        P.PRICE,
        (P.PRICE * C.QUANTITY) AS LINE_TOTAL
      FROM CART C
      INNER JOIN PRODUCTS P
        ON P.PRODUCT_ID = C.PRODUCT_ID
      WHERE C.USER_ID = ?
      ORDER BY C.CART_ID
    `,
    [userId]
  );

  const items = rows.map((row) => ({
    product: {
      id: toNumber(row.PRODUCT_ID),
      name: row.PRODUCT_NAME,
      brand: row.BRAND,
      image: row.IMAGE_URL,
      // Uses a generated SKU because the current CART schema does not include one.
      sku: `MED-${row.PRODUCT_ID}`,
      price: toNumber(row.PRICE),
    },
    qty: toNumber(row.QUANTITY),
    lineTotal: toNumber(row.LINE_TOTAL),
  }));

  return {
    items,
    total: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

// GET /api/cart
router.get("/", async (req, res) => {
  try {
    res.json(await getHydratedCart(req.user.id));
  } catch (error) {
    console.error("GET CART ERROR:", error);
    res.status(500).json({ error: "Failed to load cart" });
  }
});

// POST /api/cart/items
router.post("/items", async (req, res) => {
  try {
    const productId = Number(req.body?.productId);
    const qty = Number(req.body?.qty ?? 1);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "A valid productId is required" });
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive whole number" });
    }

    const productRows = await executeQuery(
      `SELECT PRODUCT_ID FROM PRODUCTS WHERE PRODUCT_ID = ?`,
      [productId]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existingRows = await executeQuery(
      `
        SELECT CART_ID, QUANTITY
        FROM CART
        WHERE USER_ID = ? AND PRODUCT_ID = ?
        ORDER BY CART_ID
        LIMIT 1
      `,
      [req.user.id, productId]
    );

    if (existingRows.length > 0) {
      await executeQuery(
        `
          UPDATE CART
          SET QUANTITY = QUANTITY + ?
          WHERE CART_ID = ?
        `,
        [qty, existingRows[0].CART_ID]
      );
    } else {
      await executeQuery(
        `
          INSERT INTO CART (USER_ID, PRODUCT_ID, QUANTITY)
          VALUES (?, ?, ?)
        `,
        [req.user.id, productId, qty]
      );
    }

    res.status(201).json(await getHydratedCart(req.user.id));
  } catch (error) {
    console.error("ADD CART ITEM ERROR:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

// PUT /api/cart/items/:productId
router.put("/items/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const qty = Number(req.body?.qty);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    if (!Number.isInteger(qty)) {
      return res.status(400).json({ error: "Quantity must be a whole number" });
    }

    const itemRows = await executeQuery(
      `
        SELECT CART_ID
        FROM CART
        WHERE USER_ID = ? AND PRODUCT_ID = ?
        ORDER BY CART_ID
        LIMIT 1
      `,
      [req.user.id, productId]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ error: "Item not in cart" });
    }

    if (qty <= 0) {
      await executeQuery(
        `DELETE FROM CART WHERE CART_ID = ?`,
        [itemRows[0].CART_ID]
      );
    } else {
      await executeQuery(
        `UPDATE CART SET QUANTITY = ? WHERE CART_ID = ?`,
        [qty, itemRows[0].CART_ID]
      );
    }

    res.json(await getHydratedCart(req.user.id));
  } catch (error) {
    console.error("UPDATE CART ITEM ERROR:", error);
    res.status(500).json({ error: "Failed to update cart item" });
  }
});

// DELETE /api/cart/items/:productId
router.delete("/items/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    await executeQuery(
      `DELETE FROM CART WHERE USER_ID = ? AND PRODUCT_ID = ?`,
      [req.user.id, productId]
    );

    res.json(await getHydratedCart(req.user.id));
  } catch (error) {
    console.error("DELETE CART ITEM ERROR:", error);
    res.status(500).json({ error: "Failed to remove cart item" });
  }
});

module.exports = router;