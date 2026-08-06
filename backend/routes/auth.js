const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const connection = require("../snowflake");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// Execute Snowflake Query
function executeQuery(sql, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      binds,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    });
  });
}

// JWT Token
function sign(user) {
  return jwt.sign(
    {
      id: user.USER_ID,
      name: user.FULL_NAME,
      email: user.EMAIL,
      role: user.ROLE,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Remove password before sending
function publicUser(user) {
  return {
    id: user.USER_ID,
    name: user.FULL_NAME,
    email: user.EMAIL,
    role: user.ROLE,
  };
}

// ===========================
// REGISTER
// ===========================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const existing = await executeQuery(
      "SELECT * FROM USERS WHERE EMAIL = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: "An account with that email already exists",
      });
    }

    const passwordHash = bcrypt.hashSync(password, 8);

    await executeQuery(
      `INSERT INTO USERS
      (FULL_NAME, EMAIL, PASSWORD_HASH, ROLE)
      VALUES (?, ?, ?, ?)`,
      [name, email, passwordHash, "CUSTOMER"]
    );

    const rows = await executeQuery(
      "SELECT * FROM USERS WHERE EMAIL = ?",
      [email]
    );

    const user = rows[0];

    const token = sign(user);

    res.status(201).json({
      token,
      user: publicUser(user),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Registration failed",
    });
  }
});
// ===========================
// LOGIN
// ===========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const rows = await executeQuery(
      "SELECT * FROM USERS WHERE EMAIL = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const user = rows[0];

    const validPassword = bcrypt.compareSync(
      password,
      user.PASSWORD_HASH
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = sign(user);

    res.json({
      token,
      user: publicUser(user),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Login failed",
    });
  }
});

module.exports = router;