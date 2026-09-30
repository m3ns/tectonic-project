import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, getSession, fmtEur } from '../api.js';
import CustomerHeader, { CustomerFooter } from '../components/CustomerHeader.jsx';
import EventCard from '../components/EventCard.jsx';
import WhyPanel, { CAT_LABEL } from '../components/WhyPanel.jsx';
import '../customer.css';

const CARD = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 1.4 };
const NAV = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  return (
    <div className="statusbar" aria-hidden="true">
      <span className="sb-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="sb-notch" />
      <span className="sb-icons">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".6" /><rect x="5" y="5.5" width="3" height="6.5" rx=".6" /><rect x="10" y="3" width="3" height="9" rx=".6" /><rect x="15" y="0" width="3" height="12" rx=".6" /></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0M3.8 6.9a6.2 6.2 0 0 1 8.4 0M6.2 9.4a2.8 2.8 0 0 1 3.6 0" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="16" height="8" rx="1.8" fill="currentColor" /><rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

export default function CustomerApp() {
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState([]);
  const [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState(null); // { type: 'event', event } | { type: 'all' }
  const user = getSession().user;
  const ver = useRef(0); // bumped when a preference PUT starts/finishes; older in-flight loads are ignored

  const load = useCallback(async () => {
    const v = ver.current;
    try {
      const c = await api('/me/context');
      if (v === ver.current) { setCtx(c); setErr(''); }
    } catch (e) { if (v === ver.current) setErr(e.message); }
  }, []);
  const loadAccess = useCallback(async () => {
    try { setAccess(await api('/me/access-log')); } catch { /* non-critical */ }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    loadAccess();
    const t = setInterval(loadAccess, 10000);
    return () => clearInterval(t);
  }, [loadAccess]);

  // keep the sheet's event snapshot fresh while it still has signals; it survives the card unmounting
  useEffect(() => {
    if (sheet?.type !== 'event' || !ctx) return;
    const e = (ctx.events || []).find((x) => x.type === sheet.event.type);
    if (!e) return;
    // merge so signals/categories of switched-off groups stay visible in the open sheet
    const old = sheet.event.signals || [];
    const have = new Set(old.map((x) => x.transactionId));
    const signals = [...old, ...(e.signals || []).filter((x) => !have.has(x.transactionId))];
    const cats = [...new Set([...sheet.cats, ...signals.map((x) => x.signalCategory)])];
    if (signals.length !== old.length || cats.length !== sheet.cats.length || e.action !== sheet.event.action) {
      setSheet({ type: 'event', event: { ...e, signals }, cats });
    }
  }, [ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  const openWhy = (event) => {
    if (sheet?.type === 'event' && sheet.event.type === event.type) { setSheet(null); return; }
    setNotice(''); setSheet({ type: 'event', event, cats: [...new Set((event.signals || []).map((x) => x.signalCategory))] });
  };
  const openAll = () => { setNotice(''); setSheet({ type: 'all' }); };
  const closeSheet = () => setSheet(null);

  const toggle = async (cat, enabled) => {
    const cur = ctx.disabledCategories || [];
    const next = enabled ? cur.filter((c) => c !== cat) : [...cur, cat];
    setBusy(true);
    ver.current += 1;
    try {
      const c = await api('/me/preferences', { method: 'PUT', body: { disabledCategories: next } });
      ver.current += 1;
      setCtx(c);
      setNotice(enabled ? '' : 'off');
    } catch (e) { ver.current += 1; setErr(e.message); } finally { setBusy(false); }
  };

  const shown = (ctx?.events || []).filter((e) => ['personalise', 'guidance', 'advisor'].includes(e.action));
  const disabledCats = ctx?.disabledCategories || [];
  const sheetOpen = !!sheet;
  const liveEv = sheet?.type === 'event' ? (ctx?.events || []).find((x) => x.type === sheet.event.type) : null;
  const gone = sheet?.type === 'event' && (!liveEv || liveEv.action === 'none');
  const noticeText = notice ? `Got it — we won't use these signals.${sheet?.type === 'event' && gone ? ' This suggestion is hidden.' : ''}` : '';
  const name = ctx?.customer?.first_name || user.displayName;
  const fullName = (user.displayName || name || '').toUpperCase();

  return (
    <div className="cust-app">
      <div className="phone" data-testid="customer-app">
        <StatusBar />
        <div className="scroll">
          <CustomerHeader onSettings={openAll} />

          <h2 className="greet" data-testid="greeting">{greeting()}, {name}</h2>

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
          {ctx && disabledCats.length > 0 && (
            <div className="hint-row" data-testid="disabled-hint">
              <span>{disabledCats.length} signal {disabledCats.length === 1 ? 'category' : 'categories'} switched off</span>
              <button type="button" onClick={openAll}>Manage</button>
            </div>
          )}
          {ctx && ctx.consent === false && (
            <div className="msg off" data-testid="personalisation-off">Personalisation is off</div>
          )}
          {ctx && ctx.consent !== false && (
            <div className="cards" data-testid="life-context">
              {shown.map((e) => (
                <EventCard key={e.type} event={e} open={sheet?.type === 'event' && sheet.event.type === e.type} onWhy={openWhy} />
              ))}
              {notice && !sheetOpen && <div className="notice" data-testid="pref-notice">Got it — we won't use these signals.</div>}
            </div>
          )}

          <p className="privacy" data-testid="privacy-note">We never use health, pregnancy or dating-related spending.</p>

          <button type="button" className="privacy-btn" data-testid="signal-settings" onClick={openAll}>Privacy &amp; signals</button>

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

        {sheet && ctx && (
          <>
            <div className="sheet-backdrop" onClick={closeSheet} />
            {sheet.type === 'event' ? (
              <WhyPanel event={sheet.event} disabled={disabledCats} onToggle={toggle} busy={busy} onClose={closeSheet}
                categories={sheet.cats} notice={noticeText} />
            ) : (
              <WhyPanel event={{ signals: (ctx.events || []).flatMap((e) => e.signals || []) }} disabled={disabledCats}
                onToggle={toggle} busy={busy} onClose={closeSheet} categories={Object.keys(CAT_LABEL)}
                title="Privacy & signals" notice={noticeText} />
            )}
          </>
        )}

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
