const express = require("express");
const { requireRole } = require("../auth");
const store = require("../data/store");
const { computeContext } = require("../engine/score");
const { SIGNAL_CATEGORIES } = require("../engine/rules");

const router = express.Router();

function contextFor(id) {
  return computeContext(store.getCustomer(id), store.visibleTransactions(id), store.getDisabled(id));
}

router.get("/me", (req, res) => res.json(req.user));

// Customer identity always comes from the token, never from params/body.
router.get("/me/context", requireRole("customer"), (req, res) => {
  if (!store.getCustomer(req.user.customerId)) return res.status(404).json({ error: "Customer not found" });
  res.json(contextFor(req.user.customerId));
});

router.put("/me/preferences", requireRole("customer"), (req, res) => {
  const d = req.body && req.body.disabledCategories;
  if (!Array.isArray(d) || d.length > 20 || !d.every((x) => typeof x === "string" && SIGNAL_CATEGORIES.includes(x))) {
    return res.status(400).json({ error: `disabledCategories must be an array of: ${SIGNAL_CATEGORIES.join(", ")}` });
  }
  store.setDisabled(req.user.customerId, [...new Set(d)]);
  res.json(contextFor(req.user.customerId));
});

module.exports = { router, contextFor };
