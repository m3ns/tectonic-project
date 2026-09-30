const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const missing = ["JWT_SECRET", "DEMO_PASSWORD"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: missing required environment variable(s): ${missing.join(", ")}. Copy backend/.env.example to backend/.env and set them.`);
  process.exit(1);
}

const silent = parseInt(process.env.SILENT_CUSTOMERS ?? "45", 10);

module.exports = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  JWT_SECRET: process.env.JWT_SECRET,
  DEMO_PASSWORD: process.env.DEMO_PASSWORD,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  DEMO_MODE: String(process.env.DEMO_MODE).toLowerCase() === "true",
  SILENT_CUSTOMERS: Number.isFinite(silent) && silent >= 0 ? Math.min(silent, 500) : 45,
};
