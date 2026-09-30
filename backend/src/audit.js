const crypto = require("crypto");

// Structured security audit log: one JSON object per line on stdout.
// Never pass passwords, tokens or raw usernames here.
const hashUser = (u) => crypto.createHash("sha256").update(String(u).toLowerCase()).digest("hex").slice(0, 12);

function log(event, req, fields = {}) {
  const line = {
    ts: new Date().toISOString(),
    event,
    requestId: req && req.id,
    ip: req && req.ip,
    method: req && req.method,
    path: req && req.path,
    ...fields,
  };
  process.stdout.write(JSON.stringify(line) + "\n");
}

function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

module.exports = { log, hashUser, requestId };
