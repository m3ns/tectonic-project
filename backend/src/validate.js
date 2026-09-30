// Tiny request-hygiene and strict-schema helpers (no dependencies).
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "OPTIONS"]);

const bad = (res, status, error) => res.status(status).json({ error });

function hasForbiddenKey(v, depth = 0) {
  if (depth > 10) return true; // absurd nesting is rejected too
  if (Array.isArray(v)) return v.some((x) => hasForbiddenKey(x, depth + 1));
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) {
      if (FORBIDDEN_KEYS.has(k) || hasForbiddenKey(v[k], depth + 1)) return true;
    }
  }
  return false;
}

function methodGuard(req, res, next) {
  if (ALLOWED_METHODS.has(req.method)) return next();
  res.set("Allow", [...ALLOWED_METHODS].join(", "));
  return bad(res, 405, "Method not allowed");
}

// Runs BEFORE the body parser: a body, if present, must be declared JSON.
function contentTypeGuard(req, res, next) {
  if (BODY_METHODS.has(req.method)) {
    const hasBody = Number(req.headers["content-length"] || 0) > 0 || req.headers["transfer-encoding"] !== undefined;
    if (hasBody && !/^application\/json\s*(;|$)/i.test(req.headers["content-type"] || "")) {
      return bad(res, 415, "Content-Type must be application/json");
    }
  }
  next();
}

// Runs AFTER the body parser.
function sanitize(req, res, next) {
  for (const v of Object.values(req.query || {})) {
    if (typeof v !== "string") return bad(res, 400, "Invalid query parameters");
  }
  if (req.body !== undefined && hasForbiddenKey(req.body)) return bad(res, 400, "Invalid request body");
  next();
}

// schema: { field: { required?: bool, check: (v) => bool } }. Unknown fields are rejected.
// An empty schema means "no body allowed".
function body(schema = {}, message = "Invalid request body") {
  return (req, res, next) => {
    const b = req.body === undefined ? {} : req.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) return bad(res, 400, message);
    const keys = Object.keys(b);
    if (keys.some((k) => !Object.prototype.hasOwnProperty.call(schema, k))) return bad(res, 400, message);
    for (const [k, rule] of Object.entries(schema)) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) {
        if (rule.required) return bad(res, 400, message);
        continue;
      }
      if (!rule.check(b[k])) return bad(res, 400, rule.message || message);
    }
    next();
  };
}

module.exports = { methodGuard, contentTypeGuard, sanitize, body };
