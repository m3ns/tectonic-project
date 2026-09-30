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
| Lockout keyed on IP + username (10 fails, `LOCKOUT_MS` default 60 s), IP login limiter, global rate limit (`API_RATE_LIMIT`, default 1000/min/IP) | `backend/src/auth.js`, `backend/src/server.js` |
| Content-Type enforcement, prototype-pollution key rejection, strict per-route body schemas, query hygiene, method allowlist | `backend/src/validate.js`, route files |
| Helmet (CSP `default-src none`, HSTS, CORP, no-referrer), no-store caching, Permissions-Policy, strict CORS | `backend/src/server.js` |
| Request/header timeouts, bounded body (10kb), generic errors with request id | `backend/src/server.js` |
| Structured audit log (hashed usernames, no secrets) | `backend/src/audit.js` |
| Consent gate, purpose binding, access transparency log | `backend/src/routes/advisor.js`, `backend/src/data/store.js`, `GET /api/me/access-log` |
| Frontend CSP (production build) | `frontend/vite.config.js` |
| Dependency audit | `npm run audit` in `backend/` |

## Excluded by design

Health, pregnancy and dating-related spending are never used as signals (see `backend/src/engine/rules.js`). Customers can disable any signal category at any time, and can turn personalisation off (consent).

## Pipeline data minimisation

The analysis pipeline (`backend/src/engine/pipeline.js`) skips customers without consent, strips sensitive categories (pharmacy, health, dating, fertility, gambling, ...) at the filter stage, before any feature extraction or scoring, and only counts them (`sensitiveExcluded`); excluded transactions are never stored in the event store or returned by any endpoint. The event store keeps only per-event state and level transitions (no transaction data). Customers can only read their own context (`GET /api/customers/:id/context` returns 403 otherwise).

## Known limitations

- Users, password, lockouts, revocation list, access log and call log are in memory and reset on restart; multiple instances would not share them.
- Demo users share one password (`DEMO_PASSWORD`); a real deployment needs an identity provider (OIDC) and a persistent, append-only audit store.
- Lockout is keyed on IP + username, so a stranger cannot lock a demo user out for everyone else; an attacker rotating IPs is only slowed by the login limiter. `TRUST_PROXY` defaults to `loopback` so `req.ip` is the real client behind the dev proxy.
- Tokens live in `sessionStorage` (XSS would expose them; mitigated by CSP and no third-party scripts).
- TLS termination and HSTS effectiveness depend on the deployment proxy (`TRUST_PROXY`).

## Dependency findings

- **raw-body 3.0.2, AIKIDO-2026-274460 (low): not affected.** The CVE only triggers when an invalid `limit` (for example `NaN` or an unparseable string) reaches raw-body, which then reads without a cap. Our only body parser is `express.json({ limit: "10kb" })` in `backend/src/server.js`, a fixed valid constant. body-parser 2.3.0 also validates the limit before calling raw-body and throws `TypeError` on an invalid value (`node_modules/body-parser/lib/utils.js`). The suggested upgrade to raw-body 4.0.0 is not possible yet: 4.0.0 changed its export to an object, while body-parser (latest, 2.3.0) still calls it as a function, so forcing it with an npm override makes every JSON request fail. We will take the fix when Express/body-parser move to raw-body 4.
