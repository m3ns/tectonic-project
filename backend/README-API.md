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
| GET | /api/advisor/stats | advisor |
| GET | /api/demo/replay | advisor (DEMO_MODE=true) |
| POST | /api/demo/replay/reset, /start `{intervalMs?}`, /step | advisor (DEMO_MODE=true) |

Advisor context/call require customer consent (otherwise 404); a call also needs an advisor/guidance-level event (else 403). Every view/call is recorded in the customer access log. Only `application/json` bodies, unknown fields rejected, methods GET/POST/PUT only.

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
