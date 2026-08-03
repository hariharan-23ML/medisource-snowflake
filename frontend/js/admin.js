let currentTab = "dashboard";

function guardAdmin() {
  const guard = document.getElementById("admin-guard");
  if (!Session.isLoggedIn()) {
    guard.innerHTML = `<div class="empty-state"><div class="icon">🔒</div><p>Sign in with an admin account to view this page.</p><a href="login.html?next=admin.html" class="btn btn-dark" style="margin-top:10px">Sign In</a></div>`;
    return false;
  }
  if (!Session.isAdmin()) {
    guard.innerHTML = `<div class="empty-state"><div class="icon">⛔</div><p>Your account doesn't have admin access.</p></div>`;
    return false;
  }
  return true;
}

document.querySelectorAll(".admin-sidebar a").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".admin-sidebar a").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
    currentTab = a.dataset.tab;
    renderTab();
  });
});

async function renderTab() {
  if (!guardAdmin()) { document.getElementById("admin-content").innerHTML = ""; return; }
  if (currentTab === "dashboard") return renderDashboard();
  if (currentTab === "products") return renderProducts();
  if (currentTab === "orders") return renderOrders();
}

async function renderDashboard() {
  const stats = await api("/admin/stats", { auth: true });
  document.getElementById("admin-content").innerHTML = `
    <div class="section-head"><h2>Dashboard</h2></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="v">${stats.productCount}</div><div class="l">Products</div></div>
      <div class="stat-card"><div class="v">${stats.orderCount}</div><div class="l">Orders</div></div>
      <div class="stat-card"><div class="v">${formatPrice(stats.revenue)}</div><div class="l">Revenue</div></div>
      <div class="stat-card"><div class="v">${stats.lowStock}</div><div class="l">Low Stock Items</div></div>
    </div>
  `;
}

async function renderProducts() {
  const products = await api("/admin/products", { auth: true });
  document.getElementById("admin-content").innerHTML = `
    <div class="section-head"><h2>Products</h2><button class="btn btn-primary" id="new-product-btn">+ Add Product</button></div>
    <table class="data-table">
      <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td class="product-sku">${escapeHtml(p.sku)}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category)}</td>
            <td>${formatPrice(p.price)}</td>
            <td class="${p.stock < 10 ? "stock-note low" : ""}">${p.stock}</td>
            <td>
              <button class="icon-btn edit-btn" data-id="${p.id}">Edit</button>
              <button class="icon-btn delete-btn" data-id="${p.id}">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.getElementById("new-product-btn").addEventListener("click", () => openProductModal());
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const product = products.find(p => p.id === Number(btn.dataset.id));
      openProductModal(product);
    });
  });
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this product? This can't be undone.")) return;
      await api(`/admin/products/${btn.dataset.id}`, { method: "DELETE", auth: true });
      toast("Product deleted");
      renderProducts();
    });
  });
}

function openProductModal(product) {
  const isEdit = !!product;
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <h2>${isEdit ? "Edit Product" : "Add Product"}</h2>
        <div id="modal-error"></div>
        <form id="product-form">
          <div class="form-field"><label>Name</label><input id="m-name" value="${isEdit ? escapeHtml(product.name) : ""}" required></div>
          <div class="form-field"><label>SKU</label><input id="m-sku" value="${isEdit ? escapeHtml(product.sku) : ""}"></div>
          <div class="form-field"><label>Brand</label><input id="m-brand" value="${isEdit ? escapeHtml(product.brand) : ""}"></div>
          <div class="form-field">
            <label>Category</label>
            <select id="m-category">
              ${["diagnostic","icu","surgical","dental","orthopedic","disposables","lab","furniture"].map(c => `<option value="${c}" ${isEdit && product.category === c ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>
          <div class="form-field"><label>Price (₹)</label><input type="number" id="m-price" value="${isEdit ? product.price : ""}" required></div>
          <div class="form-field"><label>MRP (₹)</label><input type="number" id="m-mrp" value="${isEdit ? product.mrp : ""}"></div>
          <div class="form-field"><label>Stock</label><input type="number" id="m-stock" value="${isEdit ? product.stock : ""}"></div>
          <div class="form-field"><label>Description</label><textarea id="m-desc" rows="3">${isEdit ? escapeHtml(product.desc) : ""}</textarea></div>
          <div style="display:flex; gap:10px; margin-top:10px">
            <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Product"}</button>
            <button type="button" class="btn btn-outline" style="color:var(--ink)" id="modal-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });

  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById("m-name").value,
      sku: document.getElementById("m-sku").value,
      brand: document.getElementById("m-brand").value,
      category: document.getElementById("m-category").value,
      price: document.getElementById("m-price").value,
      mrp: document.getElementById("m-mrp").value,
      stock: document.getElementById("m-stock").value,
      desc: document.getElementById("m-desc").value,
    };
    try {
      if (isEdit) {
        await api(`/admin/products/${product.id}`, { method: "PUT", auth: true, body });
      } else {
        await api("/admin/products", { method: "POST", auth: true, body });
      }
      toast(isEdit ? "Product updated" : "Product created");
      closeModal();
      renderProducts();
    } catch (err) {
      document.getElementById("modal-error").innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    }
  });
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

async function renderOrders() {
  const orders = await api("/admin/orders", { auth: true });
  document.getElementById("admin-content").innerHTML = `
    <div class="section-head"><h2>Orders</h2></div>
    <table class="data-table">
      <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${orders.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--sage)">No orders yet</td></tr>` : orders.map(o => `
          <tr>
            <td class="product-sku">#${o.id}</td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td>${o.items.length} item${o.items.length === 1 ? "" : "s"}</td>
            <td>${formatPrice(o.total)}</td>
            <td>${escapeHtml(o.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

renderTab();
