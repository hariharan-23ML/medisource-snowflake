const express = require("express");
const connection = require("../snowflake");

const router = express.Router();

// =====================================
// Execute Snowflake Query
// =====================================
function executeQuery(sql) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    });
  });
}

// =====================================
// GET ALL PRODUCTS
// =====================================
router.get("/products", async (req, res) => {
  try {
    const rows = await executeQuery(`
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
    `);

    const products = rows.map((p) => ({
      id: p.PRODUCT_ID,
      name: p.PRODUCT_NAME,
      category: p.CATEGORY_ID,
      desc: p.DESCRIPTION,
      brand: p.BRAND,
      price: p.PRICE,
      stock: p.STOCK,
      image: p.IMAGE_URL,
      status: p.STATUS,
    }));

    res.json({
      count: products.length,
      products,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Database Error",
    });
  }
});

// =====================================
// GET PRODUCT BY ID
// =====================================
router.get("/products/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const rows = await executeQuery(`
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
      WHERE PRODUCT_ID = ${productId}
    `);

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    const p = rows[0];

    res.json({
      id: p.PRODUCT_ID,
      name: p.PRODUCT_NAME,
      category: p.CATEGORY_ID,
      desc: p.DESCRIPTION,
      brand: p.BRAND,
      price: p.PRICE,
      stock: p.STOCK,
      image: p.IMAGE_URL,
      status: p.STATUS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Database Error",
    });
  }
});

// =====================================
// GET ALL CATEGORIES
// =====================================
router.get("/categories", async (req, res) => {
  try {
    const rows = await executeQuery(`
      SELECT
        CATEGORY_ID,
        CATEGORY_NAME,
        DESCRIPTION
      FROM CATEGORIES
      ORDER BY CATEGORY_ID
    `);

    const categories = rows.map((c) => ({
      id: c.CATEGORY_ID,
      name: c.CATEGORY_NAME,
      description: c.DESCRIPTION,
    }));

    res.json({
      count: categories.length,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Database Error",
    });
  }
});

module.exports = router;