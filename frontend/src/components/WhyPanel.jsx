import React from 'react';
import { fmtEur } from '../api.js';

export const CAT_LABEL = {
  housing: 'housing',
  home_setup: 'home-setup',
  location: 'location',
  vehicle: 'vehicle',
  travel: 'travel',
};

export function groupSignals(signals) {
  const g = {};
  (signals || []).forEach((s) => { (g[s.signalCategory] ||= []).push(s); });
  return g;
}

export default function WhyPanel({ event, disabled, onToggle, busy, readOnly }) {
  const groups = groupSignals(event.signals);
  return (
    <div className="why" data-testid="why-panel">
      {Object.entries(groups).map(([cat, sigs]) => {
        const off = disabled.includes(cat);
        return (
          <div className="why-group" key={cat} data-testid={`why-group-${cat}`}>
            <div className="why-group-head">
              <strong>{CAT_LABEL[cat] || cat}</strong>
              {!readOnly && (
                <label className="toggle">
                  <span>Use my {CAT_LABEL[cat] || cat} purchases</span>
                  <input type="checkbox" data-testid={`toggle-${cat}`} checked={!off} disabled={busy}
                    onChange={() => onToggle(cat, off)} />
                  <i />
                </label>
              )}
            </div>
            <ul>
              {sigs.map((s) => (
                <li key={s.transactionId} data-testid="signal-row">
                  <div><b>{s.merchant}</b>{s.city ? ` · ${s.city}` : ''}<span className="amt">{fmtEur(s.amount)}</span></div>
                  <small>{s.date} — {s.reason}</small>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
