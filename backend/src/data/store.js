const fs = require("fs");
const path = require("path");
const config = require("../config");

const dir = path.join(__dirname, "..", "..", "..", "mock-data");
const customers = JSON.parse(fs.readFileSync(path.join(dir, "customers.json"), "utf8"));
const transactions = JSON.parse(fs.readFileSync(path.join(dir, "transactions.json"), "utf8"));

// deterministic PRNG (mulberry32)
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSilent(n) {
  const rnd = prng(20260930);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const first = ["Jan", "Eva", "Tim", "Lena", "Bram", "Nina", "Ruben", "Fien", "Wout", "Marie", "Sam", "Elise", "Pieter", "Lore", "Jonas", "Anke"];
  const last = ["Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet", "Dubois", "Lambert", "Martin"];
  const cities = ["Antwerp", "Brussels", "Ghent", "Leuven", "Bruges", "Mechelen", "Hasselt", "Namur", "Liege", "Kortrijk", "Aalst", "Ostend"];
  const cats = [
    ["groceries", ["Delhaize", "Colruyt", "Aldi", "Lidl", "Carrefour"], 25, 110, true],
    ["public_transport", ["NMBS", "De Lijn", "STIB"], 5, 50, true],
    ["utilities", ["Luminus", "Engie", "Proximus"], 40, 150, false],
    ["entertainment", ["Netflix", "Spotify", "Cinema Palace"], 8, 25, false],
  ];
  const cs = [], ts = [];
  let tn = 10000;
  for (let i = 0; i < n; i++) {
    const id = `C${2001 + i}`;
    const city = pick(cities);
    cs.push({
      id, first_name: pick(first), last_name: pick(last), age: 20 + Math.floor(rnd() * 50), home_city: city,
      preferred_language: rnd() < 0.5 ? "nl" : "fr",
      customer_since: `20${String(14 + Math.floor(rnd() * 10)).padStart(2, "0")}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`,
      products: ["current_account"], personalization_consent: true,
    });
    const count = 5 + Math.floor(rnd() * 4);
    for (let k = 0; k < count; k++) {
      const [category, merchants, lo, hi, local] = pick(cats);
      ts.push({
        id: `T${++tn}`, customer_id: id,
        date: `2026-${rnd() < 0.4 ? "08" : "09"}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
        merchant: pick(merchants), category, city: local ? city : "Online", country: "BE",
        amount: Math.round((lo + rnd() * (hi - lo)) * 100) / 100, currency: "EUR", channel: "card",
      });
    }
  }
  return [cs, ts];
}

const [sc, st] = generateSilent(config.SILENT_CUSTOMERS);
const allCustomers = customers.concat(sc);
const allTx = transactions.concat(st);

const byId = new Map(allCustomers.map((c) => [c.id, c]));
const txByCustomer = new Map();
for (const t of allTx) {
  if (!txByCustomer.has(t.customer_id)) txByCustomer.set(t.customer_id, []);
  txByCustomer.get(t.customer_id).push(t);
}

// --- replay visibility ---
const HERO = "C1001";
const REPLAY_FROM = "2026-08-25";
let hidden = new Set(); // hidden transaction ids
let replayQueue = []; // ordered ids hidden at reset
let timer = null;

function visibleTransactions(customerId) {
  return (txByCustomer.get(customerId) || []).filter((t) => !hidden.has(t.id));
}
function replayState() {
  const next = replayQueue.find((id) => hidden.has(id));
  const nextTx = next ? allTx.find((t) => t.id === next) : null;
  const s = { running: timer !== null, revealed: replayQueue.filter((id) => !hidden.has(id)).length, total: replayQueue.length };
  if (nextTx) {
    s.nextTransaction = { id: nextTx.id, date: nextTx.date, merchant: nextTx.merchant, category: nextTx.category, city: nextTx.city, amount: nextTx.amount };
  }
  return s;
}
function stopReplay() {
  if (timer) { clearInterval(timer); timer = null; }
}
function replayReset() {
  stopReplay();
  replayQueue = (txByCustomer.get(HERO) || [])
    .filter((t) => t.date >= REPLAY_FROM)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
    .map((t) => t.id);
  hidden = new Set(replayQueue);
  return replayState();
}
function replayStep() {
  const next = replayQueue.find((id) => hidden.has(id));
  if (next) hidden.delete(next);
  if (!replayQueue.some((id) => hidden.has(id))) stopReplay();
  return replayState();
}
function replayStart(intervalMs) {
  stopReplay();
  if (!replayQueue.some((id) => hidden.has(id))) return replayState();
  timer = setInterval(replayStep, intervalMs);
  timer.unref();
  return replayState();
}

// --- preferences & call log (in-memory) ---
const preferences = new Map(); // customerId -> string[]
const calls = [];
let callSeq = 0;
function addCall(customerId, advisor, note) {
  const c = { id: `CALL${String(++callSeq).padStart(4, "0")}`, customerId, advisor, at: new Date().toISOString(), note: note || "" };
  calls.push(c);
  if (calls.length > 500) calls.splice(0, calls.length - 500);
  return c;
}

// --- access transparency log (in-memory, last 1000) ---
const accessLog = [];
function addAccess(advisor, customerId, action) {
  const now = Date.now();
  // collapse repeated context reads by the same advisor within 30s (UI polling)
  if (action === "view_context") {
    for (let i = accessLog.length - 1; i >= 0 && now - Date.parse(accessLog[i].at) < 30_000; i--) {
      const e = accessLog[i];
      if (e.advisor === advisor && e.customerId === customerId && e.action === action) return;
    }
  }
  accessLog.push({ at: new Date(now).toISOString(), advisor, customerId, action });
  if (accessLog.length > 1000) accessLog.splice(0, accessLog.length - 1000);
}
const accessFor = (customerId) =>
  accessLog.filter((e) => e.customerId === customerId).slice(-50).reverse()
    .map((e) => ({ advisor: e.advisor, action: e.action, at: e.at }));

module.exports = {
  customers: allCustomers,
  getCustomer: (id) => byId.get(id),
  visibleTransactions,
  getDisabled: (id) => preferences.get(id) || [],
  setDisabled: (id, arr) => preferences.set(id, arr),
  addAccess, accessFor,
  replayState, replayReset, replayStep, replayStart, calls, addCall,
};
