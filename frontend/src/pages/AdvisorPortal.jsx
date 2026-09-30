import React, { useCallback, useEffect, useState } from 'react';
import { api, pct } from '../api.js';
import Header, { Footer } from '../components/Header.jsx';
import ConfidenceBar from '../components/ConfidenceBar.jsx';
import WhyPanel from '../components/WhyPanel.jsx';

const TALK = {
  moving_home: ['Ask about the new address and move date', 'Review mortgage or home-loan options', 'Offer home insurance and contents cover', 'Update address and domiciliation details'],
  buying_car: ['Ask which car and budget they have in mind', 'Discuss car loan or leasing options', 'Offer a car insurance quote', 'Check mobility and charging-card options'],
  major_trip: ['Ask about destination and dates', 'Offer travel insurance', 'Review card limits and foreign-payment fees', 'Suggest travel cash or currency options'],
};

const hhmm = (at) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function AdvisorPortal() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [sel, setSel] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');
  const [logged, setLogged] = useState('');
  const [replay, setReplay] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const [c, s, k] = await Promise.all([api('/advisor/customers'), api('/advisor/stats'), api('/advisor/calls')]);
      setCustomers(c); setStats(s); setCalls(k); setErr('');
    } catch (e) { setErr(e.message); }
    try { setReplay(await api('/demo/replay')); } catch { setReplay(null); }
  }, []);

  const loadCtx = useCallback(async () => {
    if (!sel) return;
    try { setCtx(await api(`/advisor/customers/${sel}/context`)); } catch (e) { setErr(e.message); }
  }, [sel]);

  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);
  useEffect(() => { setCtx(null); setLogged(''); loadCtx(); const t = setInterval(loadCtx, 2000); return () => clearInterval(t); }, [loadCtx]);

  const call = async () => {
    try {
      const r = await api(`/advisor/customers/${sel}/call`, { method: 'POST', body: { note: 'Life-event outreach' } });
      setLogged(`Call logged at ${hhmm(r.at)}`);
      load();
    } catch (e) { setErr(e.message); }
  };

  const rp = async (path, body) => {
    try { await api(`/demo/replay${path}`, { method: 'POST', body }); load(); loadCtx(); } catch (e) { setErr(e.message); }
  };

  const nameOf = (id) => { const c = customers.find((x) => x.id === id); return c ? `${c.first_name} ${c.last_name}` : id; };
  const events = ctx?.events || [];
  const top = [...events].sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <div className="adv">
      <Header title="Advisor Portal" />
      <main className="adv-main">
        {err && <div className="error" data-testid="error">{err}</div>}
        <div className="kpis" data-testid="kpis">
          <div className="kpi"><small>Total customers monitored</small><b data-testid="kpi-total">{stats?.totalCustomers ?? '–'}</b></div>
          <div className="kpi"><small>With life events</small><b data-testid="kpi-events">{stats?.customersWithEvents ?? '–'}</b></div>
          <div className="kpi"><small>Advisor priority</small><b data-testid="kpi-priority">{stats?.byAction?.advisor ?? '–'}</b></div>
          <div className="kpi"><small>Max confidence</small><b data-testid="kpi-max">{stats ? pct(stats.maxConfidence) : '–'}</b></div>
        </div>
        <div className="adv-cols">
          <aside className="panel list" data-testid="customer-list">
            <h3>Customers</h3>
            {customers.map((c) => (
              <button key={c.id} className={`row ${sel === c.id ? 'active' : ''}`} data-testid={`customer-${c.id}`} onClick={() => setSel(c.id)}>
                <div className="row-top">
                  <b>{c.first_name} {c.last_name}</b>
                  {c.topEvent?.action === 'advisor' && <span className="badge prio" data-testid="priority-flag">Priority</span>}
                </div>
                {c.topEvent && c.topEvent.action !== 'none' ? (
                  <>
                    <div className="row-ev"><span>{c.topEvent.label}</span><span className={`badge lvl-${c.topEvent.level}`}>{c.topEvent.level}</span></div>
                    <ConfidenceBar value={c.topEvent.confidence} level={c.topEvent.level} testid="list-confidence" />
                  </>
                ) : <small className="muted">No life event detected</small>}
              </button>
            ))}
          </aside>
          <section className="panel detail" data-testid="customer-detail">
            {!sel && <div className="muted empty">Select a customer to see their life context.</div>}
            {sel && !ctx && <div className="muted empty">Loading…</div>}
            {ctx && (
              <>
                <div className="detail-head">
                  <div>
                    <h2>{ctx.customer.first_name} {ctx.customer.last_name}</h2>
                    <small className="muted">{ctx.customer.home_city} · {(ctx.customer.products || []).join(', ')}</small>
                  </div>
                  <div className="call-box">
                    <button className="btn primary big" data-testid="call-button" onClick={call}>Call customer</button>
                    {logged && <div className="confirm" data-testid="call-logged">{logged}</div>}
                  </div>
                </div>
                {events.length === 0 && <div className="muted empty">No life events detected.</div>}
                {events.map((e) => (
                  <div className="ev-detail" key={e.type} data-testid={`detail-event-${e.type}`}>
                    <div className="row-ev"><h3>{e.label}</h3><span><span className={`badge lvl-${e.level}`}>{e.level}</span><span className="badge act">{e.action}</span></span></div>
                    <ConfidenceBar value={e.confidence} level={e.level} testid="detail-confidence" />
                    <p className="ev-msg">{e.message}</p>
                    <details open={e === top}>
                      <summary>Why — {e.signals.length} signals</summary>
                      <WhyPanel event={e} disabled={ctx.disabledCategories || []} readOnly />
                    </details>
                  </div>
                ))}
                {top && top.action !== 'none' && (
                  <div className="talk" data-testid="talking-points">
                    <h3>Suggested talking points</h3>
                    <ul>{(TALK[top.type] || []).map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                )}
              </>
            )}
            <div className="recent" data-testid="recent-calls">
              <h3>Recent calls</h3>
              {calls.length === 0 && <small className="muted">No calls yet</small>}
              <ul>
                {[...calls].reverse().slice(0, 6).map((c) => (
                  <li key={c.id} data-testid="call-row">{hhmm(c.at)} — {nameOf(c.customerId)}{c.note ? ` · ${c.note}` : ''}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
        {replay && (
          <div className="replay" data-testid="replay-panel">
            <button className="link" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? '▾' : '▸'} Demo replay</button>
            {panelOpen && (
              <div className="replay-body">
                <button className="btn ghost" data-testid="replay-reset" onClick={() => rp('/reset')}>Reset</button>
                <button className="btn primary" data-testid="replay-start" onClick={() => rp('/start', { intervalMs: 1500 })}>Start</button>
                <button className="btn ghost" data-testid="replay-step" onClick={() => rp('/step')}>Step</button>
                <span data-testid="replay-progress">{replay.revealed}/{replay.total} revealed{replay.running ? ' · running' : ''}</span>
                {replay.nextTransaction && <small className="muted">Next: {replay.nextTransaction.merchant}</small>}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
