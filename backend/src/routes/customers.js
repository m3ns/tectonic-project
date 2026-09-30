const express = require("express");
const store = require("../data/store");
const audit = require("../audit");
const { contextFor } = require("./me");
const { validId } = require("./advisor");

const router = express.Router();

// Customers may only read their own context; advisors go through the consent gate and access log.
router.get("/:id/context", (req, res, next) => {
  if (!/^C\d{4}$/.test(req.params.id)) return res.status(400).json({ error: "Invalid customer id" });
  if (req.user.role === "customer") {
    if (req.params.id !== req.user.customerId) {
      audit.log("forbidden", req, { user: audit.hashUser(req.user.username), reason: "other_customer_context" });
      return res.status(403).json({ error: "Customers can only read their own context" });
    }
    if (!store.getCustomer(req.params.id)) return res.status(404).json({ error: "Customer not found" });
    return res.json(contextFor(req.params.id));
  }
  if (req.user.role !== "advisor") return res.status(403).json({ error: "Forbidden" });
  validId(req, res, () => {
    store.addAccess(req.user.displayName, req.params.id, "view_context");
    res.json(res.locals.ctx);
  });
});

module.exports = { router };
