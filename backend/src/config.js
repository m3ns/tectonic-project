const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function fatal(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

const PLACEHOLDER_SECRET = "change-me-to-a-long-random-string";
const PLACEHOLDER_PASSWORD = "change-me";

const missing = ["JWT_SECRET", "DEMO_PASSWORD"].filter((k) => !process.env[k]);
if (missing.length) {
  fatal(`missing required environment variable(s): ${missing.join(", ")}. Copy backend/.env.example to backend/.env and set them.`);
}
if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === PLACEHOLDER_SECRET) {
  fatal("JWT_SECRET must be at least 32 characters and not the placeholder. Generate one: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
}
if (process.env.DEMO_PASSWORD.length < 8 || process.env.DEMO_PASSWORD === PLACEHOLDER_PASSWORD) {
  fatal("DEMO_PASSWORD must be at least 8 characters and not the placeholder.");
}

const DEMO_MODE = String(process.env.DEMO_MODE).toLowerCase() === "true";
if (process.env.NODE_ENV === "production" && DEMO_MODE) {
  fatal("DEMO_MODE=true is not allowed when NODE_ENV=production.");
}

const JWT_TTL = process.env.JWT_TTL || "15m";
if (!/^\d+(s|m|h|d)$/.test(JWT_TTL)) fatal("JWT_TTL must look like 900s, 15m, 1h.");

const silent = parseInt(process.env.SILENT_CUSTOMERS ?? "45", 10);

let trust = process.env.TRUST_PROXY;
if (trust === undefined || trust === "") trust = "loopback";
else if (trust === "false") trust = false;
else if (trust === "true") trust = true;
else if (/^\d+$/.test(trust)) trust = parseInt(trust, 10);
else if (trust === "loopback") trust = "loopback";
else fatal("TRUST_PROXY must be loopback, false, true or a hop count.");

const intEnv = (name, def, min, max) => {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
};

module.exports = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_TTL,
  JWT_ISSUER: "kbc-life-context",
  JWT_AUDIENCE: "kbc-channels",
  DEMO_PASSWORD: process.env.DEMO_PASSWORD,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  DEMO_MODE,
  TRUST_PROXY: trust,
  API_RATE_LIMIT: intEnv("API_RATE_LIMIT", 1000, 10, 100000),
  LOCKOUT_MS: intEnv("LOCKOUT_MS", 60000, 1000, 86400000),
  SILENT_CUSTOMERS: Number.isFinite(silent) && silent >= 0 ? Math.min(silent, 500) : 45,
};
