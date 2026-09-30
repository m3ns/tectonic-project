const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const config = require("./config");

const USERS = {
  alex: { role: "customer", customerId: "C1001", displayName: "Alex" },
  noor: { role: "customer", customerId: "C1002", displayName: "Noor" },
  thomas: { role: "customer", customerId: "C1003", displayName: "Thomas" },
  julie: { role: "customer", customerId: "C1008", displayName: "Julie" },
  sofie: { role: "advisor", displayName: "Sofie, KBC advisor" },
};

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const passwordOk = (given) => crypto.timingSafeEqual(sha(given), sha(config.DEMO_PASSWORD));

const loginLimiter = rateLimit({
  windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many login attempts" },
});

const router = express.Router();
router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "username and password required" });
  }
  const key = username.toLowerCase();
  const u = Object.prototype.hasOwnProperty.call(USERS, key) ? USERS[key] : null;
  const pwOk = passwordOk(password); // always evaluated
  if (!u || !pwOk) return res.status(401).json({ error: "Invalid credentials" });
  const user = { username: key, role: u.role, displayName: u.displayName, ...(u.customerId ? { customerId: u.customerId } : {}) };
  const token = jwt.sign(user, config.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
  res.json({ token, user });
});

function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return res.status(401).json({ error: "Authentication required" });
  try {
    const p = jwt.verify(m[1], config.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { username: p.username, role: p.role, displayName: p.displayName, ...(p.customerId ? { customerId: p.customerId } : {}) };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

const requireRole = (role) => (req, res, next) =>
  req.user && req.user.role === role ? next() : res.status(403).json({ error: "Forbidden" });

module.exports = { router, requireAuth, requireRole };
