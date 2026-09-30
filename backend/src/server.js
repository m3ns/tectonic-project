const config = require("./config");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const auth = require("./auth");
const me = require("./routes/me");
const advisor = require("./routes/advisor");

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: false }));
app.use(express.json({ limit: "10kb" }));

const api = express.Router();
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
  console.error("Unhandled error:", err && err.message);
  res.status(500).json({ error: "Internal error" });
});

app.listen(config.PORT, () => console.log(`Server running on http://localhost:${config.PORT}`));
