// app.js - homepage/catalog logic

const params = new URLSearchParams(window.location.search);
let state = {
  search: params.get("search") || "",
  category: params.get("category") || "",
  sort: "",
  minPrice: "",
  maxPrice: "",
};

document.getElementById("search-input").value = state.search;

async function loadCategories() {
  const cats = await api("/categories");
  const nav = document.getElementById("category-nav-list");
  const filterList = document.getElementById("filter-categories");

  nav.innerHTML = `<a href="index.html" class="${!state.category ? "active" : ""}" data-cat=""><span class="led"></span>All Equipment</a>` +
    cats.map(c => `<a href="?category=${c.id}" class="${state.category === c.id ? "active" : ""}" data-cat="${c.id}"><span class="led"></span>${escapeHtml(c.name)}</a>`).join("");

  filterList.innerHTML = cats.map(c => `
    <div class="filter-option" data-cat="${c.id}">
      <span>${escapeHtml(c.name)}</span>
      <span class="n">${c.count}</span>
    </div>
  `).join("");

  filterList.querySelectorAll(".filter-option").forEach(el => {
    el.addEventListener("click", () => {
      state.category = state.category === el.dataset.cat ? "" : el.dataset.cat;
      loadProducts();
      highlightActiveCategory();
    });
  });

  nav.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      state.category = a.dataset.cat;
      loadProducts();
      highlightActiveCategory();
    });
  });
}

function highlightActiveCategory() {
  document.querySelectorAll("#category-nav-list a").forEach(a => {
    a.classList.toggle("active", a.dataset.cat === state.category);
  });
}

function productCard(p) {
  const lowStock = p.stock < 10;
  return `
    <div class="product-card">
      <a href="product.html?id=${p.id}">
        <div class="product-thumb">
          <span class="icon">${iconFor(p.image)}</span>
          <span class="stamp">CERT<br>SUPPLIER</span>
        </div>
      </a>
      <div class="product-body">
        <div class="product-sku">SKU ${escapeHtml(p.sku)}</div>
        <a href="product.html?id=${p.id}"><div class="product-name">${escapeHtml(p.name)}</div></a>
        <div class="product-brand">${escapeHtml(p.brand)}</div>
        <div class="product-price-row">
          <span class="price">${formatPrice(p.price)}</span>
          ${p.mrp > p.price ? `<span class="mrp">${formatPrice(p.mrp)}</span>` : ""}
        </div>
        <div class="stock-note ${lowStock ? "low" : "ok"}">${lowStock ? `Only ${p.stock} left` : `${p.stock} in stock`}</div>
        <button class="btn btn-dark btn-block add-to-cart" data-id="${p.id}">Add to Cart</button>
      </div>
    </div>
  `;
}

async function loadProducts() {
  const query = new URLSearchParams();
  if (state.search) query.set("search", state.search);
  if (state.category) query.set("category", state.category);
  if (state.sort) query.set("sort", state.sort);
  if (state.minPrice) query.set("minPrice", state.minPrice);
  if (state.maxPrice) query.set("maxPrice", state.maxPrice);

  const data = await api("/products?" + query.toString());
  const grid = document.getElementById("product-grid");
  const empty = document.getElementById("empty-state");
  document.getElementById("result-count").textContent = `— ${data.count} item${data.count === 1 ? "" : "s"}`;

  if (data.products.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
    grid.innerHTML = data.products.map(productCard).join("");
  }

  grid.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await api("/cart/items", { method: "POST", auth: true, body: { productId: btn.dataset.id, qty: 1 } });
        toast("Added to cart");
        refreshCartBadge();
      } catch (err) {
        if (err.message !== "Not authenticated") toast(err.message);
      }
    });
  });
}

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.search = document.getElementById("search-input").value.trim();
  loadProducts();
});

document.getElementById("sort-select").addEventListener("change", (e) => {
  state.sort = e.target.value;
  loadProducts();
});

document.getElementById("apply-price").addEventListener("click", () => {
  state.minPrice = document.getElementById("min-price").value;
  state.maxPrice = document.getElementById("max-price").value;
  loadProducts();
});

loadCategories();
loadProducts();
