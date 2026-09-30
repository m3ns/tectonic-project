const { SENSITIVE_CATEGORIES, EVENTS, RULES, MESSAGES, ACTION_LABELS } = require("./rules");

const LOW_CAP = 0.39;

function levelOf(c) {
  return c < 0.4 ? "low" : c < 0.7 ? "medium" : "high";
}
function actionOf(level, important) {
  if (level === "low") return "none";
  if (level === "medium") return "personalise";
  return important ? "advisor" : "guidance";
}

// rules per (event, disabled set), indexed by category; computed once.
const ruleCache = new Map();
function rulesFor(type, dis) {
  const key = type + "|" + [...dis].sort().join(",");
  let e = ruleCache.get(key);
  if (!e) {
    const rules = RULES.filter((r) => r.event === type && !dis.has(r.signalCategory));
    const byCat = new Map();
    for (const r of rules) {
      if (r.special) continue;
      for (const c of r.categories) { if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(r); }
    }
    e = { rules, byCat };
    ruleCache.set(key, e);
  }
  return e;
}

function signalFor(tx, rule) {
  return {
    transactionId: tx.id, date: tx.date, merchant: tx.merchant, category: tx.category,
    city: tx.city, amount: tx.amount, points: rule.weight, weight: rule.weight, reason: rule.reason, signalCategory: rule.signalCategory,
  };
}

/**
 * customer: customer record; transactions: visible transactions of that customer;
 * disabled: array of disabled signal categories.
 */
function computeContext(customer, transactions, disabled = []) {
  const dis = new Set(disabled);
  const out = {
    customer: {
      id: customer.id, first_name: customer.first_name, last_name: customer.last_name || null,
      home_city: customer.home_city, products: customer.products,
    },
    consent: customer.personalization_consent === true,
    disabledCategories: [...dis],
    events: [],
    generatedAt: new Date().toISOString(),
  };
  if (!out.consent) return out;

  const txs = transactions
    .filter((t) => t.direction !== "credit" && !SENSITIVE_CATEGORIES.includes(t.category))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

  for (const [type, def] of Object.entries(EVENTS)) {
    const { rules, byCat } = rulesFor(type, dis);
    const signals = [];
    for (const tx of txs) {
      let best = null;
      for (const r of byCat.get(tx.category) || []) {
        if (r.minAmount != null && tx.amount < r.minAmount) continue;
        if (!best || r.weight > best.weight) best = r;
      }
      if (best) signals.push(signalFor(tx, best));
    }
    // location: >=3 transactions in the same new city (not home city, not online) -> one signal
    const locRule = rules.find((r) => r.special === "new_city");
    let newCity = null;
    if (locRule) {
      const byCity = {};
      for (const tx of txs) {
        if (!tx.city || tx.city === customer.home_city || tx.city === "Online") continue;
        (byCity[tx.city] = byCity[tx.city] || []).push(tx);
      }
      const hit = Object.entries(byCity).filter(([, l]) => l.length >= 3).sort((a, b) => b[1].length - a[1].length)[0];
      if (hit) {
        newCity = hit[0];
        signals.push(signalFor(hit[1][2], { ...locRule, reason: `${hit[1].length} transactions in ${newCity}, away from home city ${customer.home_city}` }));
      }
    }
    if (!signals.length) continue;

    const score = signals.reduce((s, x) => s + x.weight, 0);
    let confidence = Math.min(1, score / def.threshold);
    const distinct = new Set(signals.map((s) => s.signalCategory)).size;
    if (!(distinct >= 2 || signals.length >= 3)) confidence = Math.min(confidence, LOW_CAP);
    confidence = Math.round(confidence * 100) / 100;
    const level = levelOf(confidence);
    if (!newCity) {
      const counts = {};
      signals.forEach((s) => { if (s.city && s.city !== customer.home_city && s.city !== "Online") counts[s.city] = (counts[s.city] || 0) + 1; });
      newCity = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "a new city";
    }
    const m = MESSAGES[type][level];
    out.events.push({
      type, label: def.label, important: def.important, score, confidence, level,
      action: actionOf(level, def.important),
      actionLabel: ACTION_LABELS[actionOf(level, def.important)],
      message: typeof m === "function" ? m(newCity) : m,
      signals,
    });
  }
  out.events.sort((a, b) => b.confidence - a.confidence);
  return out;
}

module.exports = { computeContext };
