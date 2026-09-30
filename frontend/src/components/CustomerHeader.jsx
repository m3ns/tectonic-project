import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearSession, getSession } from '../api.js';

export default function CustomerHeader() {
  const nav = useNavigate();
  const s = getSession();
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearSession(); nav('/login');
  };
  return (
    <header className="top" data-testid="header">
      <button className="icon-btn" aria-label="Settings" type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
      <div className="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="search-txt">How can I help you?</span>
        <span className="kate">+ Kate</span>
      </div>
      <button className="logout" data-testid="logout" type="button" onClick={logout} title={s?.user?.displayName || ''}>Log out</button>
    </header>
  );
}

export function CustomerFooter() {
  return (
    <footer className="foot" data-testid="channel-footer">
      Served by the KBC Life Context API — same context for app, web, call center and advisor portal.
    </footer>
  );
}
