import React, { useState } from 'react';
import ConfidenceBar from './ConfidenceBar.jsx';
import WhyPanel from './WhyPanel.jsx';

const ICON = { moving_home: '🏠', buying_car: '🚗', major_trip: '✈️' };

export default function EventCard({ event, disabled, onToggle, busy }) {
  const [open, setOpen] = useState(false);
  const [called, setCalled] = useState(false);
  const prominent = event.action === 'guidance' || event.action === 'advisor';
  return (
    <section className={`ev ${prominent ? 'prominent' : 'subtle'} act-${event.action}`} data-testid={`event-card-${event.type}`}>
      <div className="ev-top">
        <span className="ev-icon">{ICON[event.type] || '✨'}</span>
        <div>
          <div className="ev-label">{event.label}</div>
          <span className={`badge lvl-${event.level}`} data-testid="level-badge">{event.level}</span>
        </div>
      </div>
      <p className="ev-msg" data-testid="event-message">{event.message}</p>
      {prominent && <ConfidenceBar value={event.confidence} level={event.level} />}
      {event.action === 'advisor' && (called
        ? <div className="confirm" data-testid="advisor-confirmation">Sofie from KBC will call you</div>
        : <button className="btn primary block" data-testid="cta-advisor" onClick={() => setCalled(true)}>Talk to an advisor</button>)}
      {event.action === 'guidance' && <button className="btn primary block" data-testid="cta-guidance">See guidance</button>}
      <button className="link" data-testid="why-button" onClick={() => setOpen(!open)}>
        {open ? 'Hide details' : 'Why am I seeing this?'}
      </button>
      {open && <WhyPanel event={event} disabled={disabled} onToggle={onToggle} busy={busy} />}
    </section>
  );
}
