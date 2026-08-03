# MediSource — Medical Equipment Marketplace (Demo)

A full-stack clone-style project inspired by medical-equipment marketplaces
like Medikabazaar: a product catalog, cart & checkout, customer accounts, and
an admin console for managing products and orders.

## Stack

- **Backend:** Node.js + Express, JWT auth, in-memory data store (`backend/db.js`)
- **Frontend:** Plain HTML/CSS/JS (no build step), served statically by Express

> The data store is in-memory for simplicity — restarting the server resets
> products/users/orders back to the seed data. Every route only talks to the
> functions in `backend/db.js`, so swapping in a real database (Postgres,
> MongoDB, SQLite) later means rewriting that one file.

## Getting started

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:4000** in your browser. The Express server
serves both the API (`/api/...`) and the frontend from the same port, so
there's nothing else to run.

### Demo admin login
- Email: `admin@medisource.test`
- Password: `admin123`

Or register a new account from the Sign In page — new accounts are regular
customers by default.

## Project structure

```
medisource/
├── backend/
│   ├── server.js          # Express app entry point
│   ├── db.js               # In-memory data + seed products/categories
│   ├── middleware/auth.js  # JWT verification, admin guard
│   └── routes/
│       ├── auth.js         # POST /api/auth/register, /login
│       ├── products.js     # GET /api/products, /api/categories
│       ├── cart.js         # GET/POST/PUT/DELETE /api/cart (auth required)
│       ├── orders.js       # POST /api/orders/checkout, GET /api/orders (auth)
│       └── admin.js        # Product CRUD + stats (admin only)
└── frontend/
    ├── index.html           # Catalog with search/filter/sort
    ├── product.html         # Product detail page
    ├── cart.html            # Cart
    ├── checkout.html        # Shipping + payment method + place order
    ├── order-confirmation.html
    ├── orders.html          # Order history
    ├── login.html / register.html
    ├── admin.html           # Admin console (dashboard, products, orders)
    ├── css/style.css
    └── js/                  # One JS file per page + shared api.js
```

## Features included

- **Catalog:** search, category filters, price range, sorting, stock badges
- **Product detail page:** spec table, quantity stepper, add to cart / buy now
- **Cart & checkout:** persistent per-user cart, shipping address form, order placement
- **Accounts:** register/login with JWT, order history
- **Admin console:** dashboard stats, full product CRUD (create/edit/delete), order list — protected by an `admin` role check both in the UI and on every backend route

## Extending this

- **Persistence:** replace `backend/db.js` with a real database client
- **Payments:** the checkout form has a payment-method selector but doesn't
  call a real payment gateway — wire in Stripe/Razorpay in `routes/orders.js`
- **Images:** products currently render as emoji icons (`iconFor()` in
  `frontend/js/api.js`) — swap in real product photos by adding an `imageUrl`
  field
- **Roles:** only `customer` and `admin` roles exist; a `vendor` role with
  scoped product ownership would be a natural next step

## Notes

This is an original demo build inspired by the *category* of product
(a B2B medical-equipment marketplace) — it does not reuse any code, design,
or copy from any existing website.
