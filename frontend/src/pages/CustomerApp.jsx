import React, { useCallback, useEffect, useState } from 'react';
import { api, getSession, fmtEur } from '../api.js';
import CustomerHeader, { CustomerFooter } from '../components/CustomerHeader.jsx';
import EventCard from '../components/EventCard.jsx';
import '../customer.css';

const CARD = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 1.4 };
const NAV = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

export default function CustomerApp() {
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState([]);
  const [notice, setNotice] = useState('');
  const user = getSession().user;

  const load = useCallback(async () => {
    try { setCtx(await api('/me/context')); setErr(''); } catch (e) { setErr(e.message); }
    try { setAccess(await api('/me/access-log')); } catch { /* non-critical */ }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = async (cat, enabled) => {
    const cur = ctx.disabledCategories || [];
    const next = enabled ? cur.filter((c) => c !== cat) : [...cur, cat];
    setBusy(true);
    try {
      setCtx(await api('/me/preferences', { method: 'PUT', body: { disabledCategories: next } }));
      setNotice(enabled ? '' : "Got it — we won't use these signals");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const shown = (ctx?.events || []).filter((e) => ['personalise', 'guidance', 'advisor'].includes(e.action));
  const name = ctx?.customer?.first_name || user.displayName;
  const fullName = (user.displayName || name || '').toUpperCase();

  return (
    <div className="cust-app">
      <div className="phone" data-testid="customer-app">
        <div className="scroll">
          <CustomerHeader />

          <h2 className="greet" data-testid="greeting">Hi {name}</h2>

          <div className="accounts">
            <div className="acc active">
              <div className="art personal"><svg {...CARD}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4zM5 6l10-3 1 3" /></svg></div>
              <div className="body">Current account
                <div className="bal-num">{fmtEur(3482.15)}</div>
                <small className="iban">BE68 5390 0754 7034</small>
              </div>
            </div>
            <div className="acc">
              <div className="art company"><svg {...CARD}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4zM5 6l10-3 1 3" /></svg></div>
              <div className="body">Savings account<div className="mask" /></div>
            </div>
            <div className="acc">
              <div className="art card"><div className="mc"><span /><span /></div></div>
              <div className="body">{fullName}<div className="mask" /></div>
            </div>
          </div>

          <div className="show-payments">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
            Show payments
          </div>

          <div className="section-head">
            <h2>For you</h2>
            <span className="link">All communications</span>
          </div>

          {err && <div className="error" data-testid="error">{err}</div>}
          {ctx && ctx.consent === false && (
            <div className="msg off" data-testid="personalisation-off">Personalisation is off</div>
          )}
          {ctx && ctx.consent !== false && (
            <div className="cards" data-testid="life-context">
              {shown.map((e) => (
                <EventCard key={e.type} event={e} disabled={ctx.disabledCategories || []} onToggle={toggle} busy={busy} />
              ))}
              {notice && <div className="notice" data-testid="pref-notice">{notice}</div>}
            </div>
          )}

          <p className="privacy" data-testid="privacy-note">We never use health, pregnancy or dating-related spending.</p>

          <div className="access" data-testid="access-log">
            <h3>Who looked at my context</h3>
            {access.length === 0 && <small className="muted">No one yet</small>}
            <ul>
              {access.slice(0, 5).map((a, i) => (
                <li key={i}>
                  <small>{a.advisor} — {a.action === 'call' ? 'called you' : 'viewed your context'} · {new Date(a.at).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          </div>

          <div className="wallet-head"><h2>Kate Wallet</h2><span className="link">Open Kate Wallet</span></div>
          <div className="wallet" />

          <CustomerFooter />
        </div>

        <button className="fab" type="button" aria-label="Transfer">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 8h14l-4-4M20 16H6l4 4" /></svg>
        </button>

        <nav className="nav" aria-hidden="true">
          <div className="on"><svg {...NAV} fill="currentColor"><rect x="3" y="6" width="18" height="14" rx="2" /></svg>Start</div>
          <div><svg {...NAV}><path d="M4 6h16M4 12h16M4 18h16" /></svg>My KBC</div>
          <div><svg {...NAV}><ellipse cx="12" cy="13" rx="8" ry="6" /><path d="M12 7V4" /></svg>Investments</div>
          <div><svg {...NAV}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3" /></svg>Business</div>
          <div><svg {...NAV}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>Offer</div>
        </nav>
      </div>
    </div>
  );
}
