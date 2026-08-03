const express = require("express");
const { products, carts, orders, nextId } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.post("/checkout", (req, res) => {
  const { address, paymentMethod } = req.body || {};
  if (!address || !address.line1 || !address.city || !address.phone) {
    return res.status(400).json({ error: "A complete shipping address is required" });
  }
  const cart = carts[req.user.id] || [];
  if (cart.length === 0) {
    return res.status(400).json({ error: "Your cart is empty" });
  }

  const items = cart.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      qty: line.qty,
      lineTotal: product.price * line.qty,
    };
  });
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0);

  const order = {
    id: nextId.order(),
    userId: req.user.id,
    items,
    total,
    address,
    paymentMethod: paymentMethod || "cod",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  carts[req.user.id] = []; // clear cart

  res.status(201).json(order);
});

router.get("/", (req, res) => {
  const mine = orders.filter((o) => o.userId === req.user.id);
  res.json(mine.sort((a, b) => b.id - a.id));
});

router.get("/:id", (req, res) => {
  const order = orders.find((o) => o.id === Number(req.params.id) && o.userId === req.user.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

module.exports = router;
