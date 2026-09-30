# KBC Life Context Engine

Tectonic Hackathon 2026, case partner KBC.

> We didn't build another personalization feature. We built the shared context layer every KBC channel can plug into.

## The problem

A bank sees the big moments in a customer's life long before the customer asks for help. A rent deposit in a new city, a furniture store and a DIY shop in the same week usually mean a move. Today every KBC channel (app, web, call center, advisor) would have to work this out on its own, or not at all.

## What we built

A shared **context layer**. It turns transactions into explainable **life-event signals** and serves them through **one authenticated API** to every channel.

It detects three events:
- **moving home**
- **buying a car**
- **a major trip**

For each customer and event, the engine returns:
- a **confidence** between 0 and 1 (low, medium or high)
- the **signals** behind it (which transactions, which category, how many points)
- the **action** that follows from it
- a short **message** and advisor talking points

### How the scoring works

- **Rules, not an LLM.** Every rule is plain and deterministic, so it is explainable and cheap. On a single thread it analyses about 25,000 customers per second, which puts all 2.3M KBC customers at about 90 seconds. Message texts are templates.
- **Multi-signal.** Each matching transaction adds a few points, for example a real-estate payment +7, a furniture purchase +3, or repeated spending in a new city +4. Confidence is the points divided by the event's threshold (30 for moving home), so a single transaction never gets past low confidence and several signals have to agree.
- **Confidence drives the action:**

  | Confidence | Action |
  |---|---|
  | low (< 0.4) | No action |
  | medium (0.4 to 0.7) | Quiet personalisation in the app |
  | high (0.7 or more) | Show guidance in the app |
  | high, on an important event (moving, car) | Human review: the case goes to an advisor |

- **Explainable to the customer.** The app shows a "Why am I seeing this?" panel with the real signals. The customer can switch off any signal category (housing, home setup, location, vehicle, travel), and the result updates immediately.
- **Sensitive inferences are excluded.** Health, pharmacy, pregnancy, fertility, dating and gambling transactions are dropped before scoring and never become signals.

### The analysis pipeline

`backend/src/engine/pipeline.js` runs these stages in order:
1. **ingest** the transactions
2. **normalise** them
3. **filter** out customers without consent, sensitive categories and incoming credits
4. **extract features**
5. **score**
6. **decide** the action
7. **store** the result in the event store, which holds only event state and level changes, never transaction data

It runs at startup and again whenever new transactions arrive.

The mock dataset:
- **57 customers** and **815 transactions**, all fictional
- **Only three strong life events**:
  - Alex is moving to Ghent: 0.90
  - Noor is buying a car: 0.92
  - Thomas is planning a major trip: 0.96
- A few weak cases that correctly stay quiet
- Everyone else gets no action

## The two frontends

- **Customer app** (`/app`): a mobile-first KBC style app that installs on a phone as a PWA. It shows:
  - the life-event card
  - the "Why am I seeing this?" sheet with the signal toggles
  - privacy settings
  - "Who looked at my context", an access log showing every advisor view and call
- **Advisor portal** (`/advisor`), for KBC staff:
  - the priority queue of cases
  - a live detections feed
  - the signals behind each case
  - the customer's current products and talking points
  - a "Call customer" button, only enabled for advisor-level cases
  - an overview of all customers
  - an engine panel with a live scale test

## Security

Security is built in from the first commit:
- **JWT auth on every endpoint.** The algorithm, issuer and audience are pinned, tokens expire after 15 minutes, and logout revokes the token.
- **Customers can only read their own context.** Their identity comes from the token, never from an ID in the request, so asking for another customer returns 403.
- **The advisor portal needs the advisor role.** Advisors can't open customers who haven't given consent, and every call needs a stated reason.
- **Every advisor access is logged,** and the customer can see it in the app.
- **Requests are limited and validated:**
  - login lockout, plus a global rate limit
  - strict JSON only, with a 10 kB body limit
  - requests that try prototype pollution are rejected
- **Hardened headers and origin:** helmet with a strict CSP, and CORS allows only the frontend origin.
- **Secrets only in environment variables.** The server refuses to start with placeholder secrets.
- **Audit log** with request IDs; it never records passwords or tokens.

The threat model and the dependency findings are in [SECURITY.md](SECURITY.md).

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

Open http://localhost:5173. To use the app on a phone on the same Wi-Fi, open the network URL that Vite prints.

All demo users share `DEMO_PASSWORD`:

| User | Role | Story |
|------|------|-------|
| alex | customer | Moving from Leuven to Ghent (the hero customer) |
| noor | customer | Buying a car |
| thomas | customer | Planning a major trip |
| julie | customer | Personalisation consent off |
| sofie | advisor | KBC advisor portal |

### Demo walkthrough

1. Log in as `sofie` in one window. In the replay panel, press **Reset**, select Alex, then press **Start**.
2. Alex's moving transactions arrive one by one. The advisor portal shows each new signal and Alex's confidence climbing (0.23, 0.53 medium, 0.70 high, 0.90), until the case reaches **Human review**.
3. Log in as `alex` in a second window, or on a phone. Alex's card appears. Tap **Why am I seeing this?** and switch off a signal category to see the result change.
4. Back in the advisor portal, click **Call Alex**. The call then appears in Alex's "Who looked at my context" log.

## API at a glance

Every route is under `/api`, and every route except login needs a bearer token.

| Route | Who | What |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout` | anyone | get or revoke a token |
| `GET /me`, `GET /me/context`, `PUT /me/preferences`, `GET /me/access-log` | customer | own context, signal toggles, access transparency |
| `GET /customers/:id/context` | customer | own context by ID (403 for any other ID) |
| `GET /advisor/customers`, `/advisor/customers/:id/context`, `POST /advisor/customers/:id/call` | advisor | priority queue, case detail, log a call |
| `GET /advisor/overview`, `/advisor/stats`, `/advisor/events`, `/advisor/analysis`, `/advisor/benchmark` | advisor | all customers, pipeline stats, event store, scale test |
| `/demo/replay/*` | advisor, demo mode only | reset, step and start the live replay |

The full reference, with 401/403 curl examples, is in [backend/README-API.md](backend/README-API.md).

## Project layout

- `backend/`: Express 5 API
  - `src/engine`: rules, scoring and the pipeline
  - `src/routes`: the API routes
  - `src/auth.js`: authentication
  - `src/data`: the in-memory store and the demo replay
- `frontend/`: Vite and React, with the customer app and the advisor portal
- `mock-data/`: fictional customers and transactions, with no real data. About 45 extra "silent" customers are generated at startup.
- `mockups/`: the original HTML design mockups

## Unfinished

- There is no automated test suite.
- Everything is stored in memory: preferences, the call log, the access log and the replay state reset on every restart.
- Message texts are templates, with no LLM wording.
- The customer's "Talk to an advisor" button only shows a confirmation; it doesn't create a request.
- The demo users are hardcoded, with no real identity provider.
- The PWA icon is SVG only, so iOS may show a generic icon.
