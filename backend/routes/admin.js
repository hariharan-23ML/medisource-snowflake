const express = require("express");
const connection = require("../snowflake");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

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
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapProduct(row) {
  return {
    id: toNumber(row.PRODUCT_ID),
    name: row.PRODUCT_NAME,
    category: toNumber(row.CATEGORY_ID),
    desc: row.DESCRIPTION || "",
    brand: row.BRAND || "Generic",
    price: toNumber(row.PRICE),
    // These legacy frontend fields have no matching PRODUCTS columns.
    mrp: toNumber(row.PRICE),
    sku: `MED-${row.PRODUCT_ID}`,
    rating: 0,
    stock: toNumber(row.STOCK),
    image: row.IMAGE_URL || "placeholder",
    status: row.STATUS || "ACTIVE",
  };
}

async function getProduct(productId) {
  const rows = await executeQuery(
    `
      SELECT
        PRODUCT_ID,
        PRODUCT_NAME,
        CATEGORY_ID,
        DESCRIPTION,
        BRAND,
        PRICE,
        STOCK,
        IMAGE_URL,
        STATUS
      FROM PRODUCTS
      WHERE PRODUCT_ID = ?
    `,
    [productId]
  );

  return rows.length ? mapProduct(rows[0]) : null;
}

async function resolveCategoryId(category) {
  const numericCategoryId = Number(category);

  const rows = Number.isInteger(numericCategoryId) && numericCategoryId > 0
    ? await executeQuery(
      `SELECT CATEGORY_ID FROM CATEGORIES WHERE CATEGORY_ID = ?`,
      [numericCategoryId]
    )
    : await executeQuery(
      `
        SELECT CATEGORY_ID
        FROM CATEGORIES
        WHERE UPPER(CATEGORY_NAME) = UPPER(?)
           OR LOWER(SPLIT_PART(CATEGORY_NAME, ' ', 1)) = LOWER(?)
        LIMIT 1
      `,
      [String(category || "").trim(), String(category || "").trim()]
    );

  if (rows.length === 0) {
    throw new Error("Category not found");
  }

  return toNumber(rows[0].CATEGORY_ID);
}

async function getOrder(orderId) {
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
      WHERE ORDER_ID = ?
    `,
    [orderId]
  );

  if (orderRows.length === 0) return null;

  const order = orderRows[0];
  const itemRows = await executeQuery(
    `
      SELECT
        OI.PRODUCT_ID,
        OI.QUANTITY,
        OI.PRICE,
        P.PRODUCT_NAME
      FROM ORDER_ITEMS OI
      LEFT JOIN PRODUCTS P ON P.PRODUCT_ID = OI.PRODUCT_ID
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

// GET /api/admin/products
router.get("/products", async (req, res) => {
  try {
    const rows = await executeQuery(
      `
        SELECT
          PRODUCT_ID,
          PRODUCT_NAME,
          CATEGORY_ID,
          DESCRIPTION,
          BRAND,
          PRICE,
          STOCK,
          IMAGE_URL,
          STATUS
        FROM PRODUCTS
        ORDER BY PRODUCT_ID
      `
    );

    res.json(rows.map(mapProduct));
  } catch (error) {
    console.error("ADMIN GET PRODUCTS ERROR:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// POST /api/admin/products
router.post("/products", async (req, res) => {
  try {
    const { name, category, price } = req.body || {};

    if (!name || category == null || price == null) {
      return res.status(400).json({
        error: "name, category and price are required",
      });
    }

    const numericPrice = Number(price);
    const numericStock = Number(req.body.stock ?? 0);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "price must be a valid number" });
    }

    if (!Number.isInteger(numericStock) || numericStock < 0) {
      return res.status(400).json({ error: "stock must be a non-negative whole number" });
    }

    const categoryId = await resolveCategoryId(category);
    const productName = String(name).trim();

    await executeQuery(
      `
        INSERT INTO PRODUCTS (
          PRODUCT_NAME,
          CATEGORY_ID,
          DESCRIPTION,
          BRAND,
          PRICE,
          STOCK,
          IMAGE_URL,
          STATUS
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productName,
        categoryId,
        req.body.desc || "",
        req.body.brand || "Generic",
        numericPrice,
        numericStock,
        req.body.image || "placeholder",
        req.body.status || "ACTIVE",
      ]
    );

    const createdRows = await executeQuery(
      `
        SELECT PRODUCT_ID
        FROM PRODUCTS
        WHERE PRODUCT_NAME = ? AND CATEGORY_ID = ?
        ORDER BY PRODUCT_ID DESC
        LIMIT 1
      `,
      [productName, categoryId]
    );

    const product = await getProduct(createdRows[0].PRODUCT_ID);
    res.status(201).json(product);
  } catch (error) {
    if (error.message === "Category not found") {
      return res.status(400).json({ error: error.message });
    }

    console.error("ADMIN CREATE PRODUCT ERROR:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/admin/products/:id
router.put("/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const existing = await getProduct(productId);
    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    const has = (field) => Object.prototype.hasOwnProperty.call(req.body || {}, field);
    const nextName = has("name") ? String(req.body.name || "").trim() : existing.name;
    const nextPrice = has("price") ? Number(req.body.price) : existing.price;
    const nextStock = has("stock") ? Number(req.body.stock) : existing.stock;
    const nextCategoryId = has("category")
      ? await resolveCategoryId(req.body.category)
      : existing.category;

    if (!nextName) {
      return res.status(400).json({ error: "name cannot be empty" });
    }

    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      return res.status(400).json({ error: "price must be a valid number" });
    }

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      return res.status(400).json({ error: "stock must be a non-negative whole number" });
    }

    await executeQuery(
      `
        UPDATE PRODUCTS
        SET
          PRODUCT_NAME = ?,
          CATEGORY_ID = ?,
          DESCRIPTION = ?,
          BRAND = ?,
          PRICE = ?,
          STOCK = ?,
          IMAGE_URL = ?,
          STATUS = ?
        WHERE PRODUCT_ID = ?
      `,
      [
        nextName,
        nextCategoryId,
        has("desc") ? req.body.desc || "" : existing.desc,
        has("brand") ? req.body.brand || "Generic" : existing.brand,
        nextPrice,
        nextStock,
        has("image") ? req.body.image || "placeholder" : existing.image,
        has("status") ? req.body.status || "ACTIVE" : existing.status,
        productId,
      ]
    );

    res.json(await getProduct(productId));
  } catch (error) {
    if (error.message === "Category not found") {
      return res.status(400).json({ error: error.message });
    }

    console.error("ADMIN UPDATE PRODUCT ERROR:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/admin/products/:id
router.delete("/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await getProduct(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await executeQuery(`DELETE FROM PRODUCTS WHERE PRODUCT_ID = ?`, [productId]);
    res.status(204).end();
  } catch (error) {
    console.error("ADMIN DELETE PRODUCT ERROR:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// GET /api/admin/orders
router.get("/orders", async (req, res) => {
  try {
    const rows = await executeQuery(
      `SELECT ORDER_ID FROM ORDERS ORDER BY ORDER_DATE DESC, ORDER_ID DESC`
    );

    const orders = [];
    for (const row of rows) {
      const order = await getOrder(row.ORDER_ID);
      if (order) orders.push(order);
    }

    res.json(orders);
  } catch (error) {
    console.error("ADMIN GET ORDERS ERROR:", error);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const productRows = await executeQuery(
      `
        SELECT
          COUNT(*) AS PRODUCT_COUNT,
          COALESCE(SUM(IFF(STOCK < 10, 1, 0)), 0) AS LOW_STOCK
        FROM PRODUCTS
      `
    );

    const orderRows = await executeQuery(
      `
        SELECT
          COUNT(*) AS ORDER_COUNT,
          COALESCE(SUM(TOTAL_AMOUNT), 0) AS REVENUE
        FROM ORDERS
      `
    );

    res.json({
      productCount: toNumber(productRows[0].PRODUCT_COUNT),
      orderCount: toNumber(orderRows[0].ORDER_COUNT),
      revenue: toNumber(orderRows[0].REVENUE),
      lowStock: toNumber(productRows[0].LOW_STOCK),
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    res.status(500).json({ error: "Failed to load dashboard statistics" });
  }
});

module.exports = router;
