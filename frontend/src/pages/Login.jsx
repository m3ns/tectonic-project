import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api.js';
import { Footer } from '../components/Header.jsx';

export default function Login() {
  const nav = useNavigate();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { username, password } });
      setSession(r);
      nav(r.user.role === 'advisor' ? '/advisor' : '/app');
    } catch (ex) {
      setErr(ex.status === 401 ? 'Incorrect username or password' : ex.status === 429 ? 'Too many attempts, try again shortly' : ex.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit} data-testid="login-form">
        <div><span className="logo big">KBC</span></div>
        <h1>Life Context Engine</h1>
        <label>Username<input data-testid="username" value={username} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="next" /></label>
        <label>Password<input data-testid="password" type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" autoCapitalize="off" enterKeyHint="go" /></label>
        {err && <div className="error" data-testid="login-error">{err}</div>}
        <button className="btn primary block" data-testid="login-submit" disabled={busy || !username || !password}>Log in</button>
      </form>
      <Footer />
    </div>
  );
}
