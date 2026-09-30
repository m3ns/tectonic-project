const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const audit = require("./audit");
const v = require("./validate");

const USERS = {
  alex: { role: "customer", customerId: "C1001", displayName: "Alex" },
  noor: { role: "customer", customerId: "C1002", displayName: "Noor" },
  thomas: { role: "customer", customerId: "C1003", displayName: "Thomas" },
  julie: { role: "customer", customerId: "C1008", displayName: "Julie" },
  sofie: { role: "advisor", displayName: "Sofie, KBC advisor" },
};
const lookup = (name) => (Object.prototype.hasOwnProperty.call(USERS, name) ? USERS[name] : null);

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const passwordOk = (given) => crypto.timingSafeEqual(sha(given), sha(config.DEMO_PASSWORD));

const loginLimiter = rateLimit({
  windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many login attempts" },
});

// --- per-username lockout (known and unknown names are treated identically) ---
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
const MAX_TRACKED = 10_000;
const attempts = new Map(); // username -> { fails, lockedUntil }
const isLocked = (k) => {
  const a = attempts.get(k);
  return !!a && a.lockedUntil > Date.now();
};
function recordFailure(k, req) {
  const now = Date.now();
  let a = attempts.get(k);
  if (!a || (a.lockedUntil && a.lockedUntil <= now)) a = { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) {
    a.lockedUntil = now + LOCK_MS;
    a.fails = 0;
    audit.log("lockout", req, { user: audit.hashUser(k) });
  }
  attempts.delete(k); // refresh insertion order
  attempts.set(k, a);
  if (attempts.size > MAX_TRACKED) attempts.delete(attempts.keys().next().value);
}

// --- token revocation (in-memory denylist, jti -> exp seconds) ---
const revoked = new Map();
function pruneRevoked() {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revoked) if (exp + 10 < now) revoked.delete(jti);
}
setInterval(pruneRevoked, 60_000).unref();

const router = express.Router();
router.post("/login", loginLimiter, v.body({
  username: { required: true, check: (x) => typeof x === "string" && x.length > 0 && x.length <= 64 },
  password: { required: true, check: (x) => typeof x === "string" && x.length > 0 && x.length <= 128 },
}, "username and password required"), (req, res) => {
  const { username, password } = req.body;
  const key = username.toLowerCase();
  const u = lookup(key);
  const pwOk = passwordOk(password); // always evaluated
  if (isLocked(key)) {
    audit.log("login_failure", req, { user: audit.hashUser(key), reason: "locked" });
    return res.status(429).json({ error: "Too many login attempts" });
  }
  if (!u || !pwOk) {
    recordFailure(key, req);
    audit.log("login_failure", req, { user: audit.hashUser(key) });
    return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "Invalid credentials" });
  }
  attempts.delete(key);
  const user = { username: key, role: u.role, displayName: u.displayName, ...(u.customerId ? { customerId: u.customerId } : {}) };
  const token = jwt.sign({ role: u.role }, config.JWT_SECRET, {
    algorithm: "HS256", expiresIn: config.JWT_TTL, issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
    subject: key, jwtid: crypto.randomUUID(),
  });
  audit.log("login_success", req, { user: audit.hashUser(key), role: u.role });
  res.json({ token, user });
});

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

function reject(req, res, reason) {
  audit.log("token_rejected", req, { reason });
  res.set("WWW-Authenticate", "Bearer");
  return res.status(401).json({ error: "Authentication required" });
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (typeof h !== "string" || h.length > 2048) return reject(req, res, "missing_or_oversized");
  const m = BEARER.exec(h);
  if (!m) return reject(req, res, "malformed");
  let p;
  try {
    p = jwt.verify(m[1], config.JWT_SECRET, {
      algorithms: ["HS256"], issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
      clockTolerance: 5, maxAge: config.JWT_TTL,
    });
  } catch (e) {
    return reject(req, res, e && e.name === "TokenExpiredError" ? "expired" : "invalid");
  }
  if (typeof p.jti !== "string" || typeof p.sub !== "string") return reject(req, res, "invalid_claims");
  if (revoked.has(p.jti)) {
    audit.log("revoked", req, { user: audit.hashUser(p.sub) });
    res.set("WWW-Authenticate", "Bearer");
    return res.status(401).json({ error: "Authentication required" });
  }
  // Authoritative identity comes from the server-side table, not from token claims.
  const u = lookup(p.sub);
  if (!u || u.role !== p.role) return reject(req, res, "unknown_user_or_role");
  req.user = { username: p.sub, role: u.role, displayName: u.displayName, ...(u.customerId ? { customerId: u.customerId } : {}) };
  req.token = { jti: p.jti, exp: p.exp };
  next();
}

router.post("/logout", requireAuth, v.body({}), (req, res) => {
  if (revoked.size < 100_000) revoked.set(req.token.jti, req.token.exp);
  res.json({ ok: true });
});

const requireRole = (role) => (req, res, next) => {
  if (req.user && req.user.role === role) return next();
  audit.log("forbidden", req, { user: req.user && audit.hashUser(req.user.username), role: req.user && req.user.role });
  res.status(403).json({ error: "Forbidden" });
};

module.exports = { router, requireAuth, requireRole };
