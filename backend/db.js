// db.js
// Simple in-memory "database". Restarting the server resets all data
// except nothing is persisted to disk. Swap this module out for a real
// database (Postgres/MongoDB/SQLite) when you're ready to go to production —
// every other file only talks to the functions exported here, so that's
// the only file you'd need to rewrite.

const bcrypt = require("bcryptjs");

let nextProductId = 1;
let nextOrderId = 1;
let nextUserId = 1;

const categories = [
  { id: "diagnostic", name: "Diagnostic Equipment", icon: "activity" },
  { id: "icu", name: "ICU & Emergency", icon: "heart-pulse" },
  { id: "surgical", name: "Surgical Instruments", icon: "scissors" },
  { id: "dental", name: "Dental Equipment", icon: "tooth" },
  { id: "orthopedic", name: "Orthopedic & Rehab", icon: "bone" },
  { id: "disposables", name: "Disposables & PPE", icon: "shield" },
  { id: "lab", name: "Laboratory Equipment", icon: "flask" },
  { id: "furniture", name: "Hospital Furniture", icon: "bed" },
];

const productSeed = [
  { name: "Digital X-Ray Machine DX-200", category: "diagnostic", price: 845000, mrp: 920000, stock: 6, brand: "Radiotech", sku: "DX-200", rating: 4.6, desc: "High-frequency digital radiography system with flat-panel detector and DICOM output.", image: "xray" },
  { name: "Portable Ultrasound Scanner US-7", category: "diagnostic", price: 312000, mrp: 349000, stock: 14, brand: "Sonoline", sku: "US-7", rating: 4.4, desc: "Compact color doppler ultrasound with 12-inch touchscreen and 3 probe ports.", image: "ultrasound" },
  { name: "12-Lead ECG Machine EC-12", category: "diagnostic", price: 48500, mrp: 55000, stock: 32, brand: "Cardiomax", sku: "EC-12", rating: 4.7, desc: "Interpretive 12-channel ECG with thermal printer and battery backup.", image: "ecg" },
  { name: "Multi-Para Patient Monitor PM-500", category: "icu", price: 76500, mrp: 84000, stock: 21, brand: "Vitalcare", sku: "PM-500", rating: 4.5, desc: "SpO2, NIBP, ECG, respiration and temperature monitoring on a 15-inch display.", image: "monitor" },
  { name: "ICU Ventilator V-Air 3", category: "icu", price: 415000, mrp: 460000, stock: 5, brand: "Pulmotech", sku: "VAIR-3", rating: 4.8, desc: "Invasive/non-invasive ventilation with SIMV, PSV and CPAP modes.", image: "ventilator" },
  { name: "Defibrillator DF-100 Biphasic", category: "icu", price: 168000, mrp: 185000, stock: 9, brand: "Cardiomax", sku: "DF-100", rating: 4.6, desc: "Biphasic defibrillator with manual and AED modes, built-in ECG.", image: "defib" },
  { name: "Electrosurgical Unit ES-300", category: "surgical", price: 92000, mrp: 101000, stock: 11, brand: "Suretech", sku: "ES-300", rating: 4.3, desc: "300W cut/coagulation unit with monopolar and bipolar output.", image: "surgical" },
  { name: "OT Surgical Light SL-Twin", category: "surgical", price: 138000, mrp: 152000, stock: 7, brand: "Luxmed", sku: "SLTWIN", rating: 4.5, desc: "Dual-dome LED operating light, 160,000 lux, shadow-free illumination.", image: "light" },
  { name: "Surgical Instrument Kit (Basic, 42pc)", category: "surgical", price: 14200, mrp: 16500, stock: 60, brand: "Suretech", sku: "SIK-42", rating: 4.2, desc: "Stainless steel general surgery kit, autoclavable, 42 pieces.", image: "kit" },
  { name: "Dental Chair Unit DC-Pro", category: "dental", price: 225000, mrp: 250000, stock: 8, brand: "Smileline", sku: "DCPRO", rating: 4.6, desc: "Fully electric dental chair with LED light and 3-way syringe.", image: "dental-chair" },
  { name: "Dental Autoclave Sterilizer 18L", category: "dental", price: 38500, mrp: 43000, stock: 18, brand: "Smileline", sku: "AC-18", rating: 4.4, desc: "Class B autoclave, 18-litre chamber, drying cycle included.", image: "autoclave" },
  { name: "Electric Wheelchair EW-Comfort", category: "orthopedic", price: 62000, mrp: 69000, stock: 15, brand: "Mobilease", sku: "EWC-1", rating: 4.3, desc: "Foldable electric wheelchair, 25km range, joystick control.", image: "wheelchair" },
  { name: "CPM Knee Rehab Machine", category: "orthopedic", price: 89000, mrp: 98000, stock: 6, brand: "Rehabflex", sku: "CPM-K1", rating: 4.5, desc: "Continuous passive motion device for post-surgical knee rehabilitation.", image: "cpm" },
  { name: "Nitrile Examination Gloves (Box of 100)", category: "disposables", price: 320, mrp: 380, stock: 800, brand: "Safehand", sku: "NEG-100", rating: 4.1, desc: "Powder-free nitrile gloves, textured fingertips, box of 100.", image: "gloves" },
  { name: "3-Ply Surgical Face Mask (Box of 50)", category: "disposables", price: 180, mrp: 220, stock: 1200, brand: "Safehand", sku: "SFM-50", rating: 4.0, desc: "BFE 98% surgical masks with adjustable nose clip, box of 50.", image: "mask" },
  { name: "Digital Analytical Balance AB-220", category: "lab", price: 41500, mrp: 46000, stock: 10, brand: "Precilab", sku: "AB-220", rating: 4.6, desc: "0.1mg readability analytical balance with internal calibration.", image: "balance" },
  { name: "Biochemistry Analyzer BC-240", category: "lab", price: 385000, mrp: 425000, stock: 4, brand: "Precilab", sku: "BC-240", rating: 4.7, desc: "Fully automatic biochemistry analyzer, 240 tests/hour.", image: "analyzer" },
  { name: "Hospital Bed HB-Electric 3F", category: "furniture", price: 58000, mrp: 65000, stock: 13, brand: "Comfortcare", sku: "HB3F", rating: 4.4, desc: "3-function electric hospital bed with side rails and castors.", image: "bed" },
  { name: "Bedside Locker with Overbed Table", category: "furniture", price: 9800, mrp: 11500, stock: 40, brand: "Comfortcare", sku: "BL-OT", rating: 4.2, desc: "Powder-coated steel bedside locker with adjustable overbed table.", image: "locker" },
  { name: "IV Stand Trolley (Stainless, 5-hook)", category: "furniture", price: 2100, mrp: 2600, stock: 150, brand: "Comfortcare", sku: "IVS-5", rating: 4.0, desc: "Height-adjustable stainless steel IV stand with 5 hooks and castors.", image: "iv-stand" },
];

const products = productSeed.map((p) => ({ id: nextProductId++, ...p }));

const users = [
  {
    id: nextUserId++,
    name: "Admin",
    email: "admin@medisource.test",
    passwordHash: bcrypt.hashSync("admin123", 8),
    role: "admin",
  },
];

const carts = {}; // userId -> [{ productId, qty }]
const orders = []; // { id, userId, items, total, status, createdAt, address }

module.exports = {
  categories,
  products,
  users,
  carts,
  orders,
  nextId: {
    product: () => nextProductId++,
    order: () => nextOrderId++,
    user: () => nextUserId++,
  },
};
