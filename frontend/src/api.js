const KEY = 'kbc_session';

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
}
export function setSession(s) { sessionStorage.setItem(KEY, JSON.stringify(s)); }
export function clearSession() { sessionStorage.removeItem(KEY); }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const s = getSession();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  const res = await fetch(`/api${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && path !== '/auth/login') {
    clearSession();
    window.location.assign('/login');
    throw new ApiError(401, 'Session expired');
  }
  if (res.status === 403) throw new ApiError(403, data?.error || "You don't have access to this view");
  if (!res.ok) throw new ApiError(res.status, data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

export const fmtEur = (n) =>
  new Intl.NumberFormat('en-BE', { style: 'currency', currency: 'EUR' }).format(n);
export const pct = (c) => `${Math.round((c || 0) * 100)}%`;
