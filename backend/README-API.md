# API

Base `/api`. JSON. Bearer JWT (`JWT_TTL`, default 15m; iss/aud/jti checked) on everything except `health` and `auth/login`. Demo users: alex, noor, thomas, julie (customers), sofie (advisor); password = `DEMO_PASSWORD`.

| Method | Path | Role |
|---|---|---|
| GET | /api/health | public |
| POST | /api/auth/login `{username,password}` | public |
| GET | /api/me | any |
| POST | /api/auth/logout | any (revokes the token) |
| GET | /api/me/context | customer |
| GET | /api/me/access-log | customer (who viewed/called, own data only) |
| PUT | /api/me/preferences `{disabledCategories:[]}` | customer |
| GET | /api/advisor/customers | advisor |
| GET | /api/advisor/customers/:id/context | advisor |
| POST | /api/advisor/customers/:id/call `{note?}` | advisor |
| GET | /api/advisor/calls | advisor |
| GET | /api/advisor/stats | advisor (adds `lastAnalysis`) |
| GET | /api/customers/:id/context | customer (own id only, else 403) / advisor (consent gate + access log) |
| GET | /api/advisor/overview | advisor |
| GET | /api/advisor/analysis | advisor |
| POST | /api/advisor/analysis/run | advisor (max 1/s) |
| GET | /api/advisor/events?limit=50 | advisor |
| GET | /api/advisor/benchmark?n=10000 | advisor |
| GET | /api/demo/replay | advisor (DEMO_MODE=true) |
| POST | /api/demo/replay/reset, /start `{intervalMs?}`, /step | advisor (DEMO_MODE=true) |

Advisor context/call require customer consent (otherwise 404); a call also needs an advisor/guidance-level event (else 403). Every view/call is recorded in the customer access log. Only `application/json` bodies, unknown fields rejected, methods GET/POST/PUT only.

## Analysis pipeline

`ingest -> normalise -> filter -> features -> score -> decide -> persist` (`backend/src/engine/pipeline.js`). Runs at startup, every 5 s, and after each replay step/reset and preference change. A detection record is emitted only when an event's level/action changes (`none` is recorded too, e.g. after replay reset). Signals carry `points` (alias `weight`); event `score` is their sum; events carry `actionLabel`.

- `GET /api/advisor/analysis` -> latest run `{ runId, startedAt, durationMs, customersAnalysed, transactionsAnalysed, invalidTransactions, sensitiveExcluded, consentSkipped, eventsDetected, byLevel:{low,medium,high}, rulesVersion, creditsIgnored, history:[{runId,startedAt,durationMs,transactionsAnalysed,eventsDetected}] }` (history: last 20, newest first). `eventsDetected` = detections emitted by that run; `byLevel` = current event states.
- `POST /api/advisor/analysis/run` -> same stats object without `history` (429 if called more than once per second).
- `GET /api/advisor/events?limit=50` (1..200, else 400) -> `[{ id, customerId, first_name, last_name, type, label, level, previousLevel, action, confidence, detectedAt, signalsCount }]`, newest first, `level`/`previousLevel` in `none|low|medium|high`. Customers without consent never appear.
- `GET /api/advisor/benchmark?n=10000` (1000..200000, else 400) -> `{ customers, transactions, durationMs, customersPerSecond, projected2_3M_seconds, eventsDetected }`; synthetic seeded customers (~40 tx), pipeline only, cached 60 s.
- `GET /api/advisor/overview` -> `{ total, consentExcluded, customers:[{ id, first_name, last_name, home_city, status:"no_context|low|medium|high", topEvent?:{type,label,confidence,level,action,actionLabel} }] }` for consenting customers, strongest first.
- `GET /api/advisor/stats` also returns `lastAnalysis: { runId, durationMs, transactionsAnalysed, at }`.

Mock transactions may carry `direction: "credit"` (salary); credits are ignored for scoring.

Customer context access control:
```
curl -i http://localhost:3000/api/customers/C1001/context                                   # 401 no token
curl -i http://localhost:3000/api/customers/C1002/context -H "Authorization: Bearer $TOKEN"  # 403 (alex token, other customer)
curl -i http://localhost:3000/api/customers/C1001/context -H "Authorization: Bearer $TOKEN"  # 200 (alex, own context)
```

Signal categories: housing, home_setup, location, vehicle, travel.

## Demo calls

401, no token:
```
curl -i http://localhost:3000/api/me/context
```

403, customer token on an advisor route:
```
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"alex","password":"<DEMO_PASSWORD>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -i http://localhost:3000/api/advisor/customers -H "Authorization: Bearer $TOKEN"
```

401, tampered token:
```
curl -i http://localhost:3000/api/me -H "Authorization: Bearer ${TOKEN}x"
```

415, wrong content type:
```
curl -i -X POST http://localhost:3000/api/auth/login -d "username=alex&password=x"
```

400, prototype pollution attempt:
```
curl -i -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json"   -d "{\"username\":\"alex\",\"password\":\"x\",\"__proto__\":{\"admin\":true}}"
```

Logout (token is denylisted until expiry):
```
curl -i -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer $TOKEN"
```
