# API

Base `/api`. JSON. Bearer JWT (1h) on everything except `health` and `auth/login`. Demo users: alex, noor, thomas, julie (customers), sofie (advisor); password = `DEMO_PASSWORD`.

| Method | Path | Role |
|---|---|---|
| GET | /api/health | public |
| POST | /api/auth/login `{username,password}` | public |
| GET | /api/me | any |
| GET | /api/me/context | customer |
| PUT | /api/me/preferences `{disabledCategories:[]}` | customer |
| GET | /api/advisor/customers | advisor |
| GET | /api/advisor/customers/:id/context | advisor |
| POST | /api/advisor/customers/:id/call `{note?}` | advisor |
| GET | /api/advisor/calls | advisor |
| GET | /api/advisor/stats | advisor |
| GET | /api/demo/replay | advisor (DEMO_MODE=true) |
| POST | /api/demo/replay/reset, /start `{intervalMs?}`, /step | advisor (DEMO_MODE=true) |

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
