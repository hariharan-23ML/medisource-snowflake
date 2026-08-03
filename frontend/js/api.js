// api.js - shared helpers for talking to the backend and managing session state.
const API_BASE = "/api";

const Session = {
  getToken() { return localStorage.getItem("ms_token"); },
  getUser() {
    const raw = localStorage.getItem("ms_user");
    return raw ? JSON.parse(raw) : null;
  },
  save(token, user) {
    localStorage.setItem("ms_token", token);
    localStorage.setItem("ms_user", JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem("ms_token");
    localStorage.removeItem("ms_user");
  },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin() { const u = this.getUser(); return u && u.role === "admin"; },
};

async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = Session.getToken();
    if (!token) {
      window.location.href = "login.html?next=" + encodeURIComponent(window.location.pathname);
      throw new Error("Not authenticated");
    }
    headers.Authorization = "Bearer " + token;
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function formatPrice(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function iconFor(image) {
  const map = {
    xray: "☢", ultrasound: "📡", ecg: "📈", monitor: "🖥",
    ventilator: "🫁", defib: "⚡", surgical: "🔪", light: "💡",
    kit: "🧰", "dental-chair": "🦷", autoclave: "🧫", wheelchair: "♿",
    cpm: "🦵", gloves: "🧤", mask: "😷", balance: "⚖", analyzer: "🧪",
    bed: "🛏", locker: "🗄", "iv-stand": "💧", placeholder: "📦",
  };
  return map[image] || "📦";
}

function toast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function refreshCartBadge() {
  const el = document.getElementById("cart-count");
  if (!el) return;
  if (!Session.isLoggedIn()) { el.textContent = "0"; return; }
  try {
    const cart = await api("/cart", { auth: true });
    const count = cart.items.reduce((sum, i) => sum + i.qty, 0);
    el.textContent = String(count);
  } catch (e) { /* ignore */ }
}

function renderHeaderAuthState() {
  const el = document.getElementById("auth-slot");
  if (!el) return;
  const user = Session.getUser();
  if (user) {
    el.innerHTML = `
      <a href="orders.html">📦<span>Orders</span></a>
      ${user.role === "admin" ? '<a href="admin.html">🛠<span>Admin</span></a>' : ""}
      <a href="#" id="logout-link">👤<span>${escapeHtml(user.name.split(" ")[0])}</span></a>
    `;
    document.getElementById("logout-link").addEventListener("click", (e) => {
      e.preventDefault();
      Session.clear();
      toast("Signed out");
      setTimeout(() => window.location.href = "index.html", 400);
    });
  } else {
    el.innerHTML = `<a href="login.html">👤<span>Sign in</span></a>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeaderAuthState();
  refreshCartBadge();
});
