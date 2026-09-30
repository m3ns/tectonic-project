import React, { useCallback, useEffect, useState } from 'react';
import { api, getSession, fmtEur } from '../api.js';
import Header, { Footer } from '../components/Header.jsx';
import EventCard from '../components/EventCard.jsx';

export default function CustomerApp() {
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const user = getSession().user;

  const load = useCallback(async () => {
    try { setCtx(await api('/me/context')); setErr(''); } catch (e) { setErr(e.message); }
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

  return (
    <div className="app-bg">
      <div className="phone" data-testid="customer-app">
        <Header title="Mobile" />
        <div className="phone-body">
          <h2 className="greet" data-testid="greeting">Hi {name}</h2>
          <div className="balance">
            <small>Current account</small>
            <div className="bal-num">{fmtEur(3482.15)}</div>
            <small>BE68 5390 0754 7034</small>
          </div>
          {err && <div className="error" data-testid="error">{err}</div>}
          {ctx && ctx.consent === false && (
            <div className="off" data-testid="personalisation-off">Personalisation is off</div>
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
        </div>
        <Footer />
      </div>
    </div>
  );
}
