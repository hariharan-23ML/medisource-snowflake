async function loadCart() {
  const linesEl = document.getElementById("cart-lines");
  if (!Session.isLoggedIn()) {
    linesEl.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><p>Sign in to view your cart.</p><a href="login.html?next=cart.html" class="btn btn-dark" style="margin-top:10px">Sign In</a></div>`;
    document.getElementById("checkout-btn").style.pointerEvents = "none";
    document.getElementById("checkout-btn").style.opacity = 0.5;
    return;
  }

  let cart;
  try {
    cart = await api("/cart", { auth: true });
  } catch (err) {
    linesEl.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message)}</p></div>`;
    return;
  }

  if (cart.items.length === 0) {
    linesEl.innerHTML = `<div class="empty-state"><div class="icon">🛒</div><p>Your cart is empty.</p><a href="index.html" class="btn btn-dark" style="margin-top:10px">Browse Catalog</a></div>`;
  } else {
    linesEl.innerHTML = cart.items.map(i => `
      <div class="cart-line" data-id="${i.product.id}">
        <div class="thumb-mini">${iconFor(i.product.image)}</div>
        <div>
          <div style="font-weight:600; font-size:14px">${escapeHtml(i.product.name)}</div>
          <div class="product-sku">SKU ${escapeHtml(i.product.sku)} · ${formatPrice(i.product.price)} each</div>
        </div>
        <div class="qty-stepper">
          <button class="qty-dec">−</button>
          <span>${i.qty}</span>
          <button class="qty-inc">+</button>
        </div>
        <div class="price">${formatPrice(i.lineTotal)}</div>
        <button class="remove-link">Remove</button>
      </div>
    `).join("");

    linesEl.querySelectorAll(".cart-line").forEach(line => {
      const id = line.dataset.id;
      line.querySelector(".qty-inc").addEventListener("click", () => updateQty(id, 1));
      line.querySelector(".qty-dec").addEventListener("click", () => updateQty(id, -1));
      line.querySelector(".remove-link").addEventListener("click", () => removeItem(id));
    });
  }

  document.getElementById("sum-count").textContent = cart.items.reduce((s, i) => s + i.qty, 0);
  document.getElementById("sum-subtotal").textContent = formatPrice(cart.total);
  document.getElementById("sum-total").textContent = formatPrice(cart.total);
  refreshCartBadge();
}

async function updateQty(productId, delta) {
  const cart = await api("/cart", { auth: true });
  const line = cart.items.find(i => i.product.id === Number(productId));
  const newQty = (line ? line.qty : 0) + delta;
  await api(`/cart/items/${productId}`, { method: "PUT", auth: true, body: { qty: newQty } });
  loadCart();
}

async function removeItem(productId) {
  await api(`/cart/items/${productId}`, { method: "DELETE", auth: true });
  toast("Removed from cart");
  loadCart();
}

loadCart();
