const config = require("./config");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const audit = require("./audit");
const v = require("./validate");
const auth = require("./auth");
const me = require("./routes/me");
const advisor = require("./routes/advisor");

process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r && r.message));
process.on("uncaughtException", (e) => {
  console.error("uncaughtException:", e && e.message, e && e.stack);
  process.exit(1);
});

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY);
app.use(audit.requestId);
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: "same-origin" },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: "no-referrer" },
  xContentTypeOptions: true,
  xFrameOptions: { action: "deny" },
}));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  next();
});
app.use(cors({
  origin: config.FRONTEND_ORIGIN, credentials: false,
  methods: ["GET", "POST", "PUT", "OPTIONS"], allowedHeaders: ["Authorization", "Content-Type"], maxAge: 600,
}));

const api = express.Router();
api.use(v.methodGuard);
api.use(rateLimit({ windowMs: 60_000, limit: config.API_RATE_LIMIT, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests" } }));
api.use(v.contentTypeGuard);
api.use(express.json({ limit: "10kb", strict: true }));
api.use(v.sanitize);
api.get("/health", (req, res) => res.json({ status: "ok" }));
api.use("/auth", auth.router);
api.use(auth.requireAuth);
api.use(me.router);
api.use("/advisor", auth.requireRole("advisor"), advisor.router);
if (config.DEMO_MODE) {
  api.use("/demo", auth.requireRole("advisor"), require("./routes/demo").router);
}
api.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use("/api", api);
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Payload too large" });
  if (err && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: "Bad request" });
  console.error(`Unhandled error [${req.id}]:`, err && err.message);
  res.status(500).json({ error: "Internal error", requestId: req.id });
});

const server = app.listen(config.PORT, () => console.log(`Server running on http://localhost:${config.PORT}`));
server.requestTimeout = 10_000;
server.headersTimeout = 12_000;
server.keepAliveTimeout = 5_000;
