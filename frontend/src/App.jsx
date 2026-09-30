import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getSession } from './api.js';
import Login from './pages/Login.jsx';
import CustomerApp from './pages/CustomerApp.jsx';
import AdvisorPortal from './pages/AdvisorPortal.jsx';

function Guard({ role, children }) {
  const s = getSession();
  if (!s) return <Navigate to="/login" replace />;
  if (s.user.role !== role) return <Navigate to={s.user.role === 'advisor' ? '/advisor' : '/app'} replace />;
  return children;
}

function Home() {
  const s = getSession();
  if (!s) return <Navigate to="/login" replace />;
  return <Navigate to={s.user.role === 'advisor' ? '/advisor' : '/app'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<Guard role="customer"><CustomerApp /></Guard>} />
      <Route path="/advisor" element={<Guard role="advisor"><AdvisorPortal /></Guard>} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
