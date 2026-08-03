const express = require("express");
const { products, carts } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function getCart(userId) {
  if (!carts[userId]) carts[userId] = [];
  return carts[userId];
}

function hydrate(cart) {
  const items = cart
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return null;
      return { product, qty: line.qty, lineTotal: product.price * line.qty };
    })
    .filter(Boolean);
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items, total };
}

router.get("/", (req, res) => {
  res.json(hydrate(getCart(req.user.id)));
});

router.post("/items", (req, res) => {
  const { productId, qty = 1 } = req.body || {};
  const product = products.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: "Product not found" });
  const cart = getCart(req.user.id);
  const existing = cart.find((l) => l.productId === product.id);
  if (existing) existing.qty += Number(qty);
  else cart.push({ productId: product.id, qty: Number(qty) });
  res.status(201).json(hydrate(cart));
});

router.put("/items/:productId", (req, res) => {
  const { qty } = req.body || {};
  const cart = getCart(req.user.id);
  const line = cart.find((l) => l.productId === Number(req.params.productId));
  if (!line) return res.status(404).json({ error: "Item not in cart" });
  if (Number(qty) <= 0) {
    const idx = cart.indexOf(line);
    cart.splice(idx, 1);
  } else {
    line.qty = Number(qty);
  }
  res.json(hydrate(cart));
});

router.delete("/items/:productId", (req, res) => {
  const cart = getCart(req.user.id);
  const idx = cart.findIndex((l) => l.productId === Number(req.params.productId));
  if (idx !== -1) cart.splice(idx, 1);
  res.json(hydrate(cart));
});

module.exports = router;
