import React, { useState } from 'react';
import { pct } from '../api.js';
import WhyPanel from './WhyPanel.jsx';

const S = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 };
const ICONS = {
  moving_home: <svg {...S}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></svg>,
  buying_car: <svg {...S}><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3z" /><circle cx="7.5" cy="13.5" r="1" /><circle cx="16.5" cy="13.5" r="1" /></svg>,
  major_trip: <svg {...S}><path d="M2 14l20-8-7 15-3-6z" /><path d="M12 15l-2 5" /></svg>,
};
const DEFAULT_ICON = <svg {...S}><circle cx="12" cy="12" r="10" /><path d="M7 9h10M7 12h7M7 15h10" /></svg>;

export default function EventCard({ event, disabled, onToggle, busy }) {
  const [open, setOpen] = useState(false);
  const [called, setCalled] = useState(false);
  const prominent = event.action === 'guidance' || event.action === 'advisor';
  return (
    <section className={`msg ev ${prominent ? 'highlight prominent' : 'subtle'} act-${event.action}`} data-testid={`event-card-${event.type}`}>
      <div className="ico">{ICONS[event.type] || DEFAULT_ICON}</div>
      <div className="txt">
        <strong className="ev-label">
          {event.label}
          <span className={`badge lvl-${event.level}`} data-testid="level-badge">{event.level}</span>
        </strong>
        <span className="ev-msg" data-testid="event-message">{event.message}</span>
        {prominent && (
          <div className="conf" data-testid="confidence-bar">
            <div className="conf-track"><div className={`conf-fill lvl-${event.level}`} style={{ width: pct(event.confidence) }} /></div>
            <span className="conf-num" data-testid="confidence-value">{pct(event.confidence)}</span>
          </div>
        )}
        {event.action === 'advisor' && called && (
          <div className="confirm" data-testid="advisor-confirmation">Sofie from KBC will call you</div>
        )}
        <div className="row">
          <button className="why-btn" type="button" data-testid="why-button" onClick={() => setOpen(!open)}>
            {open ? 'Hide details' : 'Why am I seeing this?'}
          </button>
          {event.action === 'advisor' && !called && (
            <button className="pill" type="button" data-testid="cta-advisor" onClick={() => setCalled(true)}>Talk to an advisor</button>
          )}
          {event.action === 'guidance' && <button className="pill" type="button" data-testid="cta-guidance">See guidance</button>}
        </div>
        {open && <WhyPanel event={event} disabled={disabled} onToggle={onToggle} busy={busy} />}
      </div>
    </section>
  );
}
