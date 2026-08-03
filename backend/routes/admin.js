const express = require("express");
const { products, orders, nextId } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/products", (req, res) => {
  res.json(products);
});

router.post("/products", (req, res) => {
  const { name, category, price, mrp, stock, brand, sku, desc, image } = req.body || {};
  if (!name || !category || price == null) {
    return res.status(400).json({ error: "name, category and price are required" });
  }
  const product = {
    id: nextId.product(),
    name,
    category,
    price: Number(price),
    mrp: Number(mrp || price),
    stock: Number(stock || 0),
    brand: brand || "Generic",
    sku: sku || `SKU-${Date.now()}`,
    rating: 0,
    desc: desc || "",
    image: image || "placeholder",
  };
  products.push(product);
  res.status(201).json(product);
});

router.put("/products/:id", (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found" });
  Object.assign(product, req.body, { id: product.id });
  res.json(product);
});

router.delete("/products/:id", (req, res) => {
  const idx = products.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Product not found" });
  products.splice(idx, 1);
  res.status(204).end();
});

router.get("/orders", (req, res) => {
  res.json(orders.sort((a, b) => b.id - a.id));
});

router.get("/stats", (req, res) => {
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  res.json({
    productCount: products.length,
    orderCount: orders.length,
    revenue,
    lowStock: products.filter((p) => p.stock < 10).length,
  });
});

module.exports = router;
