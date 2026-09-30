const express = require("express");
const store = require("../data/store");

const router = express.Router();
router.get("/replay", (req, res) => res.json(store.replayState()));
router.post("/replay/reset", (req, res) => res.json(store.replayReset()));
router.post("/replay/step", (req, res) => res.json(store.replayStep()));
router.post("/replay/start", (req, res) => {
  const ms = req.body && req.body.intervalMs !== undefined ? req.body.intervalMs : 3000;
  if (!Number.isInteger(ms) || ms < 1000 || ms > 10000) {
    return res.status(400).json({ error: "intervalMs must be an integer between 1000 and 10000" });
  }
  res.json(store.replayStart(ms));
});

module.exports = { router };
