import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../api.js';

export default function Header({ title }) {
  const nav = useNavigate();
  const s = getSession();
  const logout = () => { clearSession(); nav('/login'); };
  return (
    <header className="hdr" data-testid="header">
      <div className="brand"><span className="logo">KBC</span><span>{title}</span></div>
      <div className="hdr-right">
        <span>{s?.user?.displayName}</span>
        <button className="btn ghost" data-testid="logout" onClick={logout}>Log out</button>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot" data-testid="channel-footer">
      Served by the KBC Life Context API — same context for app, web, call center and advisor portal.
    </footer>
  );
}
