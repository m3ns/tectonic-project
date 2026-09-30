# Security

## Threat model

| Actor | Goal | Mitigation |
|---|---|---|
| Customer | See or change another customer's data | Identity comes only from the server-side user table keyed by the token `sub`; `/api/me/*` never accepts a customer id. Role checks on every route. |
| Advisor | Browse customers who did not consent, or contact without reason | Consent gate (404, indistinguishable from unknown id); purpose binding (call only for advisor/guidance-level events); every view/call logged and visible to the customer. |
| Attacker (anonymous) | Forge/steal tokens, brute-force logins, inject payloads, DoS | See controls below. |

## Controls

| Control | Where |
|---|---|
| Refuse weak/placeholder secrets and demo mode in production | `backend/src/config.js` |
| JWT HS256 pinned, `iss`/`aud`/`jti`/`sub`, 15m TTL, strict Bearer format, user re-resolved per request | `backend/src/auth.js` |
| Logout and revocation denylist | `backend/src/auth.js` |
| Per-username lockout (5 fails, 15 min), IP login limiter, global rate limit | `backend/src/auth.js`, `backend/src/server.js` |
| Content-Type enforcement, prototype-pollution key rejection, strict per-route body schemas, query hygiene, method allowlist | `backend/src/validate.js`, route files |
| Helmet (CSP `default-src none`, HSTS, CORP, no-referrer), no-store caching, Permissions-Policy, strict CORS | `backend/src/server.js` |
| Request/header timeouts, bounded body (10kb), generic errors with request id | `backend/src/server.js` |
| Structured audit log (hashed usernames, no secrets) | `backend/src/audit.js` |
| Consent gate, purpose binding, access transparency log | `backend/src/routes/advisor.js`, `backend/src/data/store.js`, `GET /api/me/access-log` |
| Frontend CSP (production build) | `frontend/vite.config.js` |
| Dependency audit | `npm run audit` in `backend/` |

## Excluded by design

Health, pregnancy and dating-related spending are never used as signals (see `backend/src/engine/rules.js`). Customers can disable any signal category at any time, and can turn personalisation off (consent).

## Known limitations

- Users, password, lockouts, revocation list, access log and call log are in memory and reset on restart; multiple instances would not share them.
- Demo users share one password (`DEMO_PASSWORD`); a real deployment needs an identity provider (OIDC) and a persistent, append-only audit store.
- Per-username lockout can be abused to lock out a known user for 15 minutes (accepted trade-off against brute force).
- Tokens live in `sessionStorage` (XSS would expose them; mitigated by CSP and no third-party scripts).
- TLS termination and HSTS effectiveness depend on the deployment proxy (`TRUST_PROXY`).
