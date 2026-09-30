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

export default function WhyPanel({ event, disabled, onToggle, busy, readOnly, onClose, categories, title, notice }) {
  const groups = groupSignals(event.signals);
  (categories || []).forEach((c) => { groups[c] ||= []; });
  if (readOnly) {
    // Advisor portal: original markup/styling (styles.css)
    return (
      <div className="why" data-testid="why-panel">
        {Object.entries(groups).map(([cat, sigs]) => (
          <div className="why-group" key={cat} data-testid={`why-group-${cat}`}>
            <div className="why-group-head"><strong>{CAT_LABEL[cat] || cat}</strong></div>
            <ul>
              {sigs.map((s) => (
                <li key={s.transactionId} data-testid="signal-row">
                  <div><b>{s.merchant}</b>{s.city ? ` · ${s.city}` : ''}<span className="amt">{fmtEur(s.amount)}</span></div>
                  <small>{s.date} · {s.reason}</small>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="why-panel" data-testid="why-panel">
      <div className="sheet-handle" aria-hidden="true" />
      {onClose && <button type="button" className="sheet-close" data-testid="why-close" aria-label="Close" onClick={onClose}>&times;</button>}
      <h3>{title || 'Why am I seeing this?'}</h3>
      <p className="sub">We combine several everyday signals. No single payment triggers a message. You decide which signal types we may use.</p>
      {notice && <div className="sheet-notice" data-testid="pref-notice">{notice}</div>}
      {Object.entries(groups).map(([cat, sigs]) => {
        const off = disabled.includes(cat);
        return (
          <div className={`why-group${off ? ' is-off' : ''}`} key={cat} data-testid={`why-group-${cat}`}>
            <div className="why-group-head">
              <h4>Signals we noticed · {CAT_LABEL[cat] || cat}</h4>
            </div>
            {sigs.length === 0 && <div className="cat-empty">No recent signals of this type.</div>}
            <ul className="signals">
              {sigs.map((s) => (
                <li key={s.transactionId} data-testid="signal-row" className={off ? 'off' : ''}>
                  <span className="check">{off ? '–' : '✓'}</span>
                  <div className="sig-body">
                    <div><b>{s.merchant}</b>{s.city ? ` · ${s.city}` : ''}<span className="amt">{fmtEur(s.amount)}</span></div>
                    <small>{s.date} · {s.reason}</small>
                  </div>
                </li>
              ))}
            </ul>
            {!readOnly && (
              <label className="toggle">
                <span>Use my {CAT_LABEL[cat] || cat} purchases<small>Signal type you allow</small></span>
                <span className="switch">
                  <input type="checkbox" data-testid={`toggle-${cat}`} checked={!off} disabled={busy}
                    onChange={() => onToggle(cat, off)} />
                  <span />
                </span>
              </label>
            )}
          </div>
        );
      })}
      <div className="never">We never use sensitive signals such as health, pregnancy or dating to personalise your app.</div>
    </div>
  );
}
