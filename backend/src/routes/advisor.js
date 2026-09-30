const express = require("express");
const store = require("../data/store");
const { contextFor } = require("./me");

const router = express.Router();

router.get("/customers", (req, res) => {
  const list = [];
  for (const c of store.customers) {
    const ctx = contextFor(c.id);
    const top = ctx.events.find((e) => e.level !== "low");
    if (!ctx.consent || !top) continue;
    list.push({
      id: c.id, first_name: c.first_name, last_name: c.last_name || null, home_city: c.home_city,
      topEvent: { type: top.type, label: top.label, confidence: top.confidence, level: top.level, action: top.action },
    });
  }
  const rank = (x) => (x.topEvent.action === "advisor" ? 0 : 1);
  list.sort((a, b) => rank(a) - rank(b) || b.topEvent.confidence - a.topEvent.confidence);
  res.json(list);
});

router.get("/stats", (req, res) => {
  const byAction = { none: 0, personalise: 0, guidance: 0, advisor: 0 };
  const byEvent = { moving_home: 0, buying_car: 0, major_trip: 0 };
  let withEvents = 0;
  let maxConfidence = 0;
  for (const c of store.customers) {
    const top = contextFor(c.id).events[0];
    if (!top) { byAction.none++; continue; }
    byAction[top.action]++;
    if (top.level !== "low") { withEvents++; byEvent[top.type]++; }
    maxConfidence = Math.max(maxConfidence, top.confidence);
  }
  res.json({ totalCustomers: store.customers.length, customersWithEvents: withEvents, byAction, byEvent, maxConfidence });
});

function validId(req, res, next) {
  if (!/^C\d{4}$/.test(req.params.id)) return res.status(400).json({ error: "Invalid customer id" });
  if (!store.getCustomer(req.params.id)) return res.status(404).json({ error: "Customer not found" });
  next();
}

router.get("/customers/:id/context", validId, (req, res) => res.json(contextFor(req.params.id)));

router.post("/customers/:id/call", validId, (req, res) => {
  const note = req.body && req.body.note;
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) {
    return res.status(400).json({ error: "note must be a string of at most 500 characters" });
  }
  res.status(201).json(store.addCall(req.params.id, req.user.username, note));
});

router.get("/calls", (req, res) => res.json(store.calls));

module.exports = { router };
