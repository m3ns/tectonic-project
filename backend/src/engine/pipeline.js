// Analysis pipeline: ingest -> normalise -> filter -> features -> score -> decide -> persist.
// Data minimisation: sensitive categories are stripped at the filter stage and only COUNTED,
// never stored; consent=false customers are skipped before any feature is extracted.
const { computeContext } = require("./score");
const { SENSITIVE_CATEGORIES, EVENTS } = require("./rules");

const RULES_VERSION = "2026-09-rules-v2";
const CURRENCIES = new Set(["EUR", "USD", "GBP"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SENSITIVE = new Set(SENSITIVE_CATEGORIES);
const DAY = 86_400_000;

// Parsed ISO dates are cached (a real dataset has few distinct days); invalid dates map to NaN.
const dateCache = new Map();
function dateMs(str) {
  let ms = dateCache.get(str);
  if (ms === undefined) {
    ms = Date.parse(str + "T00:00:00Z");
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== str) ms = NaN;
    if (dateCache.size < 50_000) dateCache.set(str, ms);
  }
  return ms;
}

// ---- stage 2: normalise ----
function validTx(t, customerId) {
  if (!t || typeof t !== "object") return false;
  if (typeof t.id !== "string" || !t.id) return false;
  if (t.customer_id !== customerId) return false;
  if (typeof t.date !== "string" || !ISO_DATE.test(t.date)) return false;
  if (!Number.isFinite(dateMs(t.date))) return false;
  if (typeof t.amount !== "number" || !Number.isFinite(t.amount)) return false;
  if (!CURRENCIES.has(t.currency)) return false;
  if (typeof t.category !== "string") return false;
  return true;
}

// ---- stage 4: feature extraction ----
function extractFeatures(customer, txs) {
  const categories = {};
  const cityCount = {};
  let latestMs = 0;
  for (const t of txs) {
    categories[t.category] = (categories[t.category] || 0) + 1;
    if (t.city && t.city !== customer.home_city && t.city !== "Online") cityCount[t.city] = (cityCount[t.city] || 0) + 1;
    const ms = dateMs(t.date);
    if (ms > latestMs) latestMs = ms;
  }
  let spend30 = 0, spend60 = 0;
  for (const t of txs) {
    const age = (latestMs - dateMs(t.date)) / DAY;
    if (age < 60) { spend60 += t.amount; if (age < 30) spend30 += t.amount; }
  }
  const newCityClusters = Object.entries(cityCount).filter(([, n]) => n >= 2).map(([city, count]) => ({ city, count }));
  return { categories, newCityClusters, spend30: Math.round(spend30 * 100) / 100, spend60: Math.round(spend60 * 100) / 100 };
}

/**
 * Stages normalise -> filter -> features -> score for ONE customer. Pure (no persistence).
 * Returns counters plus the scored context (null when skipped for consent).
 */
function processCustomer(customer, rawTxs, disabled) {
  const r = { invalid: 0, sensitive: 0, credits: 0, analysed: 0, consentSkipped: false, context: null, features: null };
  const seen = new Set();
  const clean = [];
  for (const t of rawTxs) {
    if (!validTx(t, customer.id) || seen.has(t.id)) { r.invalid++; continue; }
    seen.add(t.id);
    clean.push(t);
  }
  if (customer.personalization_consent !== true) { r.consentSkipped = true; return r; }
  const kept = [];
  for (const t of clean) {
    if (SENSITIVE.has(t.category)) { r.sensitive++; continue; }
    if (t.direction === "credit") { r.credits++; continue; }
    kept.push(t);
  }
  r.analysed = kept.length;
  r.features = extractFeatures(customer, kept);
  r.context = computeContext(customer, kept, disabled);
  return r;
}

// ---- stage 7: event store ----
const MAX_FEED = 5000;
const state = new Map(); // `${customerId}|${type}` -> { level, action, confidence }
const feed = []; // detection records, oldest first
let eventSeq = 0;

function persist(customer, context, now) {
  let emitted = 0;
  const byType = new Map(context.events.map((e) => [e.type, e]));
  for (const [type, def] of Object.entries(EVENTS)) {
    const key = `${customer.id}|${type}`;
    const prev = state.get(key) || { level: "none", action: "none", confidence: 0 };
    const e = byType.get(type);
    const cur = e
      ? { level: e.level, action: e.action, confidence: e.confidence, signalsCount: e.signals.length }
      : { level: "none", action: "none", confidence: 0, signalsCount: 0 };
    if (cur.level !== prev.level || cur.action !== prev.action) {
      feed.push({
        id: `EV${String(++eventSeq).padStart(6, "0")}`, customerId: customer.id, type, label: def.label,
        level: cur.level, previousLevel: prev.level, action: cur.action, confidence: cur.confidence,
        detectedAt: now, signalsCount: cur.signalsCount,
      });
      emitted++;
    }
    if (cur.level === "none") state.delete(key);
    else state.set(key, cur);
  }
  if (feed.length > MAX_FEED) feed.splice(0, feed.length - MAX_FEED);
  return emitted;
}

// ---- runs ----
let store = null;
let runSeq = 0;
let latest = null;
const history = [];
let running = false;

function runAnalysis() {
  if (!store || running) return latest;
  running = true;
  try {
    const t0 = process.hrtime.bigint();
    const startedAt = new Date().toISOString();
    // stage 1: ingest
    const byCustomer = new Map();
    for (const t of store.allVisible()) {
      const k = t && t.customer_id;
      if (!byCustomer.has(k)) byCustomer.set(k, []);
      byCustomer.get(k).push(t);
    }
    const stats = {
      runId: `R${String(++runSeq).padStart(4, "0")}`, startedAt, durationMs: 0, customersAnalysed: 0, transactionsAnalysed: 0,
      invalidTransactions: 0, sensitiveExcluded: 0, consentSkipped: 0, eventsDetected: 0,
      byLevel: { low: 0, medium: 0, high: 0 }, rulesVersion: RULES_VERSION, creditsIgnored: 0,
    };
    for (const [k, list] of byCustomer) if (!store.getCustomer(k)) stats.invalidTransactions += list.length; // unknown customer
    const now = new Date().toISOString();
    for (const c of store.customers) {
      const r = processCustomer(c, byCustomer.get(c.id) || [], store.getDisabled(c.id));
      stats.invalidTransactions += r.invalid;
      if (r.consentSkipped) { stats.consentSkipped++; continue; }
      stats.customersAnalysed++;
      stats.transactionsAnalysed += r.analysed;
      stats.sensitiveExcluded += r.sensitive;
      stats.creditsIgnored += r.credits;
      stats.eventsDetected += persist(c, r.context, now);
    }
    for (const s of state.values()) if (stats.byLevel[s.level] !== undefined) stats.byLevel[s.level]++;
    stats.durationMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e4) / 100;
    latest = stats;
    history.push(stats);
    if (history.length > 20) history.shift();
    return stats;
  } catch (e) {
    console.error("analysis run failed:", e && e.message);
    return latest;
  } finally {
    running = false;
  }
}

function start(dataStore, intervalMs = 5000) {
  store = dataStore;
  store.onChange(runAnalysis);
  runAnalysis();
  setInterval(runAnalysis, intervalMs).unref();
}

const getLatest = () => latest;
const getHistory = () => history.slice().reverse().map((h) => ({
  runId: h.runId, startedAt: h.startedAt, durationMs: h.durationMs, transactionsAnalysed: h.transactionsAnalysed, eventsDetected: h.eventsDetected,
}));

function getFeed(limit = 50) {
  const out = [];
  for (let i = feed.length - 1; i >= 0 && out.length < limit; i--) {
    const d = feed[i];
    const c = store.getCustomer(d.customerId);
    if (!c || c.personalization_consent !== true) continue;
    out.push({
      id: d.id, customerId: d.customerId, first_name: c.first_name, last_name: c.last_name || null, type: d.type, label: d.label,
      level: d.level, previousLevel: d.previousLevel, action: d.action, confidence: d.confidence, detectedAt: d.detectedAt,
      signalsCount: d.signalsCount,
    });
  }
  return out;
}

// ---- scale benchmark (synthetic, seeded, no persistence) ----
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const B_CITIES = ["Antwerp", "Brussels", "Ghent", "Leuven", "Bruges", "Mechelen", "Hasselt", "Namur", "Liege", "Kortrijk"];
const B_COMMON = ["groceries", "groceries", "groceries", "utilities", "public_transport", "fuel", "entertainment", "telecom", "rent"];
const B_MOVE = ["real_estate", "furniture", "home_improvement", "moving_services", "furniture"];
const B_CAR = ["car_dealer", "automotive_marketplace", "car_accessories", "vehicle_registration"];
const B_TRIP = ["airline", "accommodation", "travel_agency", "travel_insurance", "international_transport"];
const B_SENS = ["pharmacy", "dating", "fertility", "gambling"];

function synthCustomer(i, rnd) {
  const home = B_CITIES[Math.floor(rnd() * B_CITIES.length)];
  const id = `C${100000 + i}`;
  const customer = { id, first_name: "Syn", home_city: home, products: [], personalization_consent: rnd() > 0.02 };
  const profile = rnd(); // ~6% movers, 4% car, 5% trip
  const special = profile < 0.06 ? B_MOVE : profile < 0.10 ? B_CAR : profile < 0.15 ? B_TRIP : null;
  const newCity = B_CITIES[Math.floor(rnd() * B_CITIES.length)];
  const txs = [];
  for (let k = 0; k < 40; k++) {
    const r = rnd();
    let category, city = home, direction;
    if (special && r < 0.2) { category = special[Math.floor(rnd() * special.length)]; if (special === B_MOVE) city = newCity; }
    else if (r < 0.22) category = B_SENS[Math.floor(rnd() * B_SENS.length)];
    else if (r < 0.26) { category = "salary"; direction = "credit"; city = "Online"; }
    else category = B_COMMON[Math.floor(rnd() * B_COMMON.length)];
    const day = 1 + Math.floor(rnd() * 28);
    const t = {
      id: `B${i}-${k}`, customer_id: id, date: `2026-0${7 + Math.floor(rnd() * 3)}-${day < 10 ? "0" : ""}${day}`, merchant: "Synthetic",
      category, city, country: "BE", amount: Math.round((5 + rnd() * 400) * 100) / 100, currency: "EUR", channel: "card",
    };
    if (direction) t.direction = direction;
    if (rnd() < 0.003) t.date = "2026-13-45"; // invalid sample
    txs.push(t);
  }
  return { customer, txs };
}

let bench = null; // { n, at, result } | { n, promise }
function benchmark(n) {
  if (bench && bench.n === n) {
    if (bench.promise) return bench.promise;
    if (Date.now() - bench.at < 60_000) return Promise.resolve(bench.result);
  }
  const promise = (async () => {
    const rnd = prng(42);
    let transactions = 0, nsPipeline = 0n, events = 0;
    for (let i = 0; i < n; i++) {
      const { customer, txs } = synthCustomer(i, rnd);
      const t0 = process.hrtime.bigint();
      const r = processCustomer(customer, txs, []);
      if (r.context) events += r.context.events.length;
      nsPipeline += process.hrtime.bigint() - t0;
      transactions += txs.length;
      if (i % 500 === 499) await new Promise((res) => setImmediate(res)); // keep the server responsive
    }
    const durationMs = Math.max(0.01, Number(nsPipeline) / 1e6);
    const customersPerSecond = Math.round((n / durationMs) * 1000);
    const result = {
      customers: n, transactions, durationMs: Math.round(durationMs * 100) / 100, customersPerSecond,
      projected2_3M_seconds: Math.round((2_300_000 / customersPerSecond) * 10) / 10, eventsDetected: events,
    };
    bench = { n, at: Date.now(), result };
    return result;
  })();
  bench = { n, promise };
  promise.catch(() => { bench = null; });
  return promise;
}

module.exports = { start, runAnalysis, getLatest, getHistory, getFeed, benchmark, processCustomer, RULES_VERSION };
