import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearSession, getSession, pct, fmtEur } from '../api.js';
import '../advisor.css';

const TALK = {
  moving_home: ['Ask about the new address and move date', 'Review mortgage or home-loan options', 'Offer home insurance and contents cover', 'Update address and domiciliation details'],
  buying_car: ['Ask which car and budget they have in mind', 'Discuss car loan or leasing options', 'Offer a car insurance quote', 'Check mobility and charging-card options'],
  major_trip: ['Ask about destination and dates', 'Offer travel insurance', 'Review card limits and foreign-payment fees', 'Suggest travel cash or currency options'],
};

const hhmm = (at) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="#666"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
);
const CheckIcon = () => (
  <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
);
const ServiceIcon = () => (
  <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

function Conf({ value, level, testid }) {
  return (
    <div className="conf" data-testid={testid}>
      <div className="conf-track"><div className={`conf-fill lvl-${level}`} style={{ width: pct(value) }} /></div>
      <span className="conf-num" data-testid="confidence-value">{pct(value)}</span>
    </div>
  );
}

function Signals({ event }) {
  const seenSig = useRef(null);
  const ids = (event.signals || []).map((x) => x.transactionId);
  const freshSig = seenSig.current ? new Set(ids.filter((id) => !seenSig.current.has(id))) : new Set();
  useEffect(() => { seenSig.current = new Set(ids); });
  const groups = {};
  (event.signals || []).forEach((s) => { (groups[s.signalCategory] ||= []).push(s); });
  return (
    <div data-testid="why-panel">
      {Object.entries(groups).map(([cat, sigs]) => (
        <div key={cat} data-testid={`why-group-${cat}`}>
          <div className="sig-group">{cat.replace('_', '-')}</div>
          <ul className="signals-list">
            {sigs.map((s) => (
              <li key={s.transactionId} data-testid="signal-row" className={freshSig.has(s.transactionId) ? 'sig-fresh' : undefined}>
                <CheckIcon />
                <div className="sig-text">
                  <span><b>{s.merchant}</b>{s.city ? ` · ${s.city}` : ''}<span className="amt">{fmtEur(s.amount)}</span></span>
                  <small>{s.date} · {s.reason}</small>
                </div>
              {(s.points ?? s.weight) != null && <span className="pts" data-testid="signal-points">+{s.points ?? s.weight}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const ACTION_LABEL = { advisor: 'Human review', guidance: 'Show guidance', personalise: 'Quiet personalisation', none: 'No action' };
const STATUS_NAME = { no_context: 'No context', low: 'Low', medium: 'Medium', high: 'High' };
const evScore = (e) => e.score ?? (e.signals || []).reduce((a, x) => a + (Number(x.points ?? x.weight) || 0), 0);

const LVL_ARROW = (d) => (
  <>
    {d.previousLevel ? <span className={`badge lvl-${d.previousLevel}`}>{d.previousLevel}</span> : <span className="muted">new</span>}
    <span className="det-arrow">→</span>
    <span className={`badge lvl-${d.level}`}>{d.level}</span>
  </>
);

export default function AdvisorPortal() {
  const nav = useNavigate();
  const session = getSession();
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [sel, setSel] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');
  const [logged, setLogged] = useState('');
  const [replay, setReplay] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [view, setView] = useState('priority');
  const [overview, setOverview] = useState(null);
  const [dets, setDets] = useState(null);
  const [fresh, setFresh] = useState(() => new Set());
  const seen = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [engBusy, setEngBusy] = useState(false);
  const [bench, setBench] = useState(null);
  const [benchBusy, setBenchBusy] = useState(false);
  const [engErr, setEngErr] = useState('');

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

  const loadDets = useCallback(async () => {
    try {
      const d = await api('/advisor/events?limit=30');
      if (!Array.isArray(d)) { setDets(null); return; }
      if (seen.current) setFresh(new Set(d.filter((x) => !seen.current.has(x.id)).map((x) => x.id)));
      seen.current = new Set(d.map((x) => x.id));
      setDets(d);
    } catch { setDets(null); }
  }, []);
  const loadAnalysis = useCallback(async () => {
    try { setAnalysis(await api('/advisor/analysis')); } catch { setAnalysis(null); }
  }, []);
  const loadOverview = useCallback(async () => {
    try {
      const o = await api('/advisor/overview');
      const list = Array.isArray(o) ? o : o?.customers;
      if (!Array.isArray(list)) { setOverview(null); return; }
      setOverview({ list, total: Array.isArray(o) ? list.length : (o.total ?? list.length), consentExcluded: Array.isArray(o) ? 0 : (o.consentExcluded || 0) });
    } catch { setOverview(null); }
  }, []);
  useEffect(() => { loadDets(); const t = setInterval(loadDets, 2000); return () => clearInterval(t); }, [loadDets]);
  useEffect(() => { loadAnalysis(); const t = setInterval(loadAnalysis, 4000); return () => clearInterval(t); }, [loadAnalysis]);
  useEffect(() => { loadOverview(); const t = setInterval(loadOverview, 3000); return () => clearInterval(t); }, [loadOverview]);

  const runAnalysis = async () => {
    setEngBusy(true); setEngErr('');
    try { await api('/advisor/analysis/run', { method: 'POST' }); await loadAnalysis(); load(); loadDets(); loadOverview(); }
    catch (e) { setEngErr(e.message); } finally { setEngBusy(false); }
  };
  const runBench = async () => {
    setBenchBusy(true); setEngErr(''); setBench(null);
    try { setBench(await api('/advisor/benchmark?n=100000')); }
    catch (e) { setEngErr(e.message); } finally { setBenchBusy(false); }
  };
  const pick = (id) => { setSel(id); setView('priority'); };

  const call = async () => {
    try {
      const r = await api(`/advisor/customers/${sel}/call`, { method: 'POST', body: { note: 'Life-event outreach' } });
      setLogged(`Call logged at ${hhmm(r.at)}`);
      setErr('');
      load();
    } catch (e) { setLogged(''); setErr(e.message); }
  };

  const rp = async (path, body) => {
    try { await api(`/demo/replay${path}`, { method: 'POST', body }); load(); loadCtx(); } catch (e) { setErr(e.message); }
  };

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearSession(); nav('/login');
  };

  const nameOf = (id) => { const c = customers.find((x) => x.id === id); return c ? `${c.first_name} ${c.last_name}` : id; };
  const events = ctx?.events || [];
  const top = [...events].sort((a, b) => b.confidence - a.confidence)[0];
  const activeTop = top && top.action !== 'none' ? top : null;
  const products = ctx?.customer?.products || [];
  const firstName = ctx?.customer?.first_name;
  const canCall = events.some((e) => e.action === 'advisor' || e.action === 'guidance');
  const advisorName = session?.user?.displayName || 'Advisor';

  return (
    <div className="adv-ws adv">
      <header className="app-header" data-testid="header">
        <div className="header-logo"><span className="header-logo-icon">▲</span> KBC</div>
        <div className="header-title">KBC Advisor Workspace</div>
        <div className="header-right">
          <div className="advisor-info">
            <span>{advisorName}</span>
            <div className="advisor-avatar"><PersonIcon /></div>
          </div>
          <button className="logout-btn" data-testid="logout" onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="workspace-area">
        <div className="col col-left">
          <div className="kpis" data-testid="kpis">
            <div className="kpi"><small>Customers monitored</small><b data-testid="kpi-total">{stats?.totalCustomers ?? '–'}</b></div>
            <div className="kpi"><small>With life events</small><b data-testid="kpi-events">{stats?.customersWithEvents ?? '–'}</b></div>
            <div className="kpi"><small>Advisor priority</small><b data-testid="kpi-priority">{stats?.byAction?.advisor ?? '–'}</b></div>
            <div className="kpi"><small>Max confidence</small><b data-testid="kpi-max">{stats ? pct(stats.maxConfidence) : '–'}</b></div>
          </div>
          <aside className="card list" data-testid="customer-list">
            <h3>Customers</h3>
            {customers.map((c) => (
              <button key={c.id} className={`row ${sel === c.id ? 'active' : ''}`} data-testid={`customer-${c.id}`} onClick={() => pick(c.id)}>
                <div className="row-top">
                  <b>{c.first_name} {c.last_name}</b>
                  {c.topEvent?.action === 'advisor' && <span className="badge prio" data-testid="priority-flag">Priority</span>}
                </div>
                {c.topEvent && c.topEvent.action !== 'none' ? (
                  <>
                    <div className="row-ev"><span>{c.topEvent.label}</span><span className={`badge lvl-${c.topEvent.level}`}>{c.topEvent.level}</span></div>
                    <Conf value={c.topEvent.confidence} level={c.topEvent.level} testid="list-confidence" />
                  </>
                ) : <small className="muted">No life event detected</small>}
              </button>
            ))}
          </aside>
        </div>

        <div className="col col-center">
          {overview && (
            <div className="tabs" role="tablist">
              <button role="tab" className={`tab${view === 'priority' ? ' on' : ''}`} data-testid="tab-priority" onClick={() => setView('priority')}>Priority</button>
              <button role="tab" className={`tab${view === 'all' ? ' on' : ''}`} data-testid="tab-all" onClick={() => setView('all')}>All customers</button>
            </div>
          )}
          {err && <div className="error" data-testid="error">{err}</div>}
          {view === 'all' && overview && (
            <section className="overview" data-testid="overview">
              <div className="overview-head">
                {overview.total} customers analysed · {overview.list.filter((c) => c.status !== 'no_context').length} life moments detected
                {overview.consentExcluded > 0 && <span className="muted"> · {overview.consentExcluded} excluded (no consent)</span>}
              </div>
              <div className="ov-grid">
                {overview.list.map((c) => {
                  const active = c.status && c.status !== 'no_context';
                  return (
                    <button key={c.id} className={`ov-tile st-${c.status}${sel === c.id ? ' sel' : ''}`} data-testid={`overview-${c.id}`}
                      disabled={!active} onClick={() => active && pick(c.id)}>
                      <b>{c.first_name} {c.last_name}</b>
                      {active && c.topEvent ? (
                        <><span className="ov-ev">{c.topEvent.label}</span><span className="ov-conf">{pct(c.topEvent.confidence)}</span></>
                      ) : <span className="ov-none">No context</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          <section className="insight-panel" data-testid="customer-detail" hidden={view === 'all' && !!overview}>
            {!sel && <div className="muted empty">Select a customer to see their life context.</div>}
            {sel && !ctx && <div className="muted empty">Loading…</div>}
            {ctx && (
              <>
                <div className="panel-header">
                  <div className="panel-title">Client Profile: {ctx.customer.first_name} {ctx.customer.last_name} (Client Number: {ctx.customer.id})</div>
                  <div className="copy-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  </div>
                </div>
                <small className="muted">{ctx.customer.home_city}</small>

                <div>
                  <div className="section-title">Core Context</div>
                  {events.length === 0 && <div className="muted">No life events detected.</div>}
                  {top && (
                    <>
                      <div className="context-pill">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                        {top.label} detected
                      </div>
                      <div className="confidence-row">
                        Confidence: {pct(top.confidence)}
                        <svg className="ring-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 12A10 10 0 1 1 12 2" /></svg>
                      </div>
                    </>
                  )}
                </div>

                {events.map((e) => (
                  <div className="ev-detail" key={e.type} data-testid={`detail-event-${e.type}`}>
                    <div className="row-ev"><h3>{e.label}</h3><span><span className={`badge lvl-${e.level}`}>{e.level}</span><span className={`act-pill act-${e.action}`} data-testid="action-label">{e.actionLabel || ACTION_LABEL[e.action] || e.action}</span></span></div>
                    <div className="ev-big">
                      <div><small>Score</small><b data-testid="event-score">{evScore(e)}</b></div>
                      <div><small>Confidence</small><b data-testid="event-confidence-big">{pct(e.confidence)}</b></div>
                    </div>
                    <Conf value={e.confidence} level={e.level} testid="detail-confidence" />
                    <p className="ev-msg">{e.message}</p>
                    <details open={e === top}>
                      <summary>Detected signals: {e.signals.length} signals</summary>
                      <Signals event={e} />
                    </details>
                  </div>
                ))}

                {products.length > 0 && (
                  <div>
                    <div className="section-title">Current KBC Products:</div>
                    <div className="services-grid">
                      {products.map((p) => <div className="service-item" key={p}><ServiceIcon />{p}</div>)}
                    </div>
                  </div>
                )}

                {activeTop && (
                  <div data-testid="talking-points">
                    <div className="section-title">Suggested talking points:</div>
                    <ul className="signals-list">{(TALK[activeTop.type] || []).map((t) => <li key={t}><CheckIcon />{t}</li>)}</ul>
                  </div>
                )}

                <div className="section-title" style={{ marginBottom: 0 }}>Next Action:</div>
                <div className="next-action-row">
                  <div className="action-label">Next Steps &amp; Actions</div>
                  <div className="action-buttons">
                    <div>
                      <button className="btn" data-testid="call-button" onClick={call} disabled={!canCall} title={canCall ? undefined : 'No advisor-level event yet'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                        {firstName ? `Call ${firstName}` : 'Call customer'}
                      </button>
                      {!canCall && <div className="muted" data-testid="call-hint" style={{ marginTop: 4 }}>No advisor-level event yet</div>}
                      {logged && <div className="confirm" data-testid="call-logged">{logged}</div>}
                    </div>
                  </div>
                </div>
                <div className="expand-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="col col-right">
          <div className="floating-right-panel">
            <div className="card">
              <div className="floating-header">
                <div><div className="advisor-avatar" style={{ width: 16, height: 16 }}><PersonIcon /></div>Advisor: {advisorName}</div>
                <div className="status-dot" />
              </div>
              <div className="context-doc-btn"><div className="info-icon-circle">i</div>Life Context<br />Documentation</div>
            </div>

            {analysis && (
              <div className="card" data-testid="engine-panel">
                <div className="card-title">Engine</div>
                <div className="engine-stat">
                  Analysed <b>{Number(analysis.transactionsAnalysed).toLocaleString('en-GB')}</b> transactions from <b>{Number(analysis.customersAnalysed).toLocaleString('en-GB')}</b> customers in <b>{analysis.durationMs} ms</b>
                </div>
                <div className="engine-meta">
                  <span>Sensitive excluded: {analysis.sensitiveExcluded}</span>
                  <span>Consent skipped: {analysis.consentSkipped}</span>
                  <span>Rules version: {analysis.rulesVersion}</span>
                </div>
                <div className="engine-btns">
                  <button className="btn ghost" data-testid="run-analysis" disabled={engBusy} onClick={runAnalysis}>{engBusy ? 'Running…' : 'Run analysis now'}</button>
                  <button className="btn" data-testid="benchmark-button" disabled={benchBusy} onClick={runBench}>{benchBusy ? 'Running…' : 'Scale test'}</button>
                </div>
                {engErr && <div className="error" style={{ marginTop: 8 }}>{engErr}</div>}
                {bench && (
                  <div className="bench-result" data-testid="benchmark-result">
                    {Number(bench.customers).toLocaleString('en-GB')} customers in {(bench.durationMs / 1000).toFixed(2)} s → 2.3M customers in ~{Number(bench.projected2_3M_seconds).toFixed(1)} s
                  </div>
                )}
              </div>
            )}

            {dets && (
              <div className="card" data-testid="detections-feed">
                <div className="card-title">Live detections</div>
                {dets.length === 0 && <small className="muted">Nothing detected yet</small>}
                <ul className="det-feed">
                  {dets.map((d) => (
                    <li key={d.id}>
                      <button className={`det-row${fresh.has(d.id) ? ' fresh' : ''}`} data-testid="detection-row" onClick={() => pick(d.customerId)}>
                        <span className="det-time">{hhmm(d.detectedAt)}</span>
                        <span className="det-name">{d.first_name} {d.last_name}</span>
                        <span className="det-conf">{pct(d.confidence)}</span>
                        <span className="det-ev"><span>{d.label}</span>{LVL_ARROW(d)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card recent" data-testid="recent-calls">
              <div className="card-title">Recent calls</div>
              {calls.length === 0 && <small className="muted">No calls yet</small>}
              <ul>
                {[...calls].reverse().slice(0, 6).map((c) => (
                  <li key={c.id} data-testid="call-row">{hhmm(c.at)} · {nameOf(c.customerId)}{c.note ? ` · ${c.note}` : ''}</li>
                ))}
              </ul>
            </div>

            {replay && (
              <div className="card replay" data-testid="replay-panel">
                <button className="link" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? '▾' : '▸'} Demo replay</button>
                {panelOpen && (
                  <div className="replay-body">
                    <div className="replay-btns">
                      <button className="btn ghost" data-testid="replay-reset" onClick={() => rp('/reset')}>Reset</button>
                      <button className="btn" data-testid="replay-start" onClick={() => rp('/start', { intervalMs: 1500 })}>Start</button>
                      <button className="btn ghost" data-testid="replay-step" onClick={() => rp('/step')}>Step</button>
                    </div>
                    <span data-testid="replay-progress">{replay.revealed}/{replay.total} revealed{replay.running ? ' · running' : ''}</span>
                    {replay.nextTransaction && <small className="muted">Next: {replay.nextTransaction.merchant}</small>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="foot" data-testid="channel-footer">
        Served by the KBC Life Context API: same context for app, web, call center and advisor portal.
      </footer>
    </div>
  );
}
