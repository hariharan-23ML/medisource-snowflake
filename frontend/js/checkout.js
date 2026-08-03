if (!Session.isLoggedIn()) {
  window.location.href = "login.html?next=checkout.html";
}

async function loadSummary() {
  const cart = await api("/cart", { auth: true });
  const summary = document.getElementById("checkout-summary");
  if (cart.items.length === 0) {
    document.getElementById("checkout-content").innerHTML = `<div class="empty-state"><div class="icon">🛒</div><p>Your cart is empty — nothing to check out.</p><a href="index.html" class="btn btn-dark" style="margin-top:10px">Browse Catalog</a></div>`;
    return;
  }
  summary.innerHTML = `
    ${cart.items.map(i => `<div class="summary-row"><span>${escapeHtml(i.product.name)} × ${i.qty}</span><span>${formatPrice(i.lineTotal)}</span></div>`).join("")}
    <div class="summary-row total"><span>Total</span><span>${formatPrice(cart.total)}</span></div>
  `;
}

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("checkout-error");
  errorEl.innerHTML = "";
  const btn = document.getElementById("place-order-btn");
  btn.disabled = true;
  btn.textContent = "Placing order…";

  const address = {
    name: document.getElementById("f-name").value,
    line1: document.getElementById("f-line1").value,
    city: document.getElementById("f-city").value,
    pin: document.getElementById("f-pin").value,
    phone: document.getElementById("f-phone").value,
  };
  const paymentMethod = document.getElementById("f-payment").value;

  try {
    const order = await api("/orders/checkout", { method: "POST", auth: true, body: { address, paymentMethod } });
    window.location.href = `order-confirmation.html?id=${order.id}`;
  } catch (err) {
    errorEl.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
});

loadSummary();
