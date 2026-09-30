# KBC Life Context Engine

Tectonic Hackathon 2026, case partner KBC.

A shared context layer that turns customer transactions into explainable life-event signals (moving home, buying a car, a major trip) and serves them through one authenticated API to every channel: app, web, call center and advisor portal.

> We didn't build another personalization feature. We built the shared context layer every KBC channel can plug into.

## How it works

- **Rules, not an LLM.** Scoring is plain, deterministic rules, so it scales to millions of customers.
- **Multi-signal.** A single transaction never gives more than low confidence. An event needs several signals across categories.
- **Confidence drives the action:**
  - low: nothing happens
  - medium: the app personalises quietly
  - high: the app shows guidance
  - high and important: the case goes to a human advisor
- **Explainable.** Every result lists its signals. The customer sees a "Why am I seeing this?" panel and can switch signal categories off.
- **Sensitive inferences are excluded.** Health, pregnancy, dating and gambling spending are never used as signals.
- **Secure by default:**
  - JWT auth on every endpoint
  - customers can only read their own context, and their identity comes from the token, never from the request
  - the advisor role is required for the advisor portal
  - helmet, CORS limited to the frontend origin, a login rate limit and a body size limit
  - secrets only in environment variables

## Run it

Needs Node 22.

```bash
# backend (port 3000)
cd backend
cp .env.example .env      # set JWT_SECRET and DEMO_PASSWORD
npm install
npm start

# frontend (port 5173, proxies /api to :3000)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The demo users all share `DEMO_PASSWORD`:

| User | Role | Story |
|------|------|-------|
| alex | customer | Moving from Leuven to Ghent (the hero customer) |
| noor | customer | Buying a car |
| thomas | customer | Planning a major trip |
| julie | customer | Personalisation consent off |
| sofie | advisor | KBC advisor portal |

To run the live demo, log in as `sofie`, open the replay panel, press **Reset**, then **Start**. Alex's moving transactions arrive one by one, and Alex's confidence climbs from low to advisor priority. Follow it in a second window logged in as `alex`.

The API reference and the 401/403 curl examples are in [backend/README-API.md](backend/README-API.md).

## Project layout

- `backend/`: Express API, the scoring engine (`src/engine`), auth, and the demo replay
- `frontend/`: Vite + React, with the customer app (`/app`) and the advisor portal (`/advisor`)
- `mock-data/`: fictional customers and transactions (no real data). About 45 extra "silent" customers are generated at startup.

## Unfinished

- There is no automated test suite.
- Everything is stored in memory: preferences, the call log and replay state reset on every restart.
- Message texts are templates, with no LLM wording.
- The customer's "Talk to an advisor" button only shows a confirmation; it doesn't create a request.
- The demo users are hardcoded, with no real identity provider.
