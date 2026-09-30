# KBC Life Context Engine - Frontend

Vite + React. Needs the backend running on http://localhost:3000 (`/api` is proxied).

    npm install && npm run dev

Open http://localhost:5173. Demo users: alex, noor, thomas, julie (customers), sofie (advisor). Password is set in the backend env.

## Open on your phone

1. Run `npm run dev` (the dev server listens on all interfaces).
2. Vite prints a **Network** URL, e.g. `http://192.168.1.20:5173/`. Open it on a phone on the same Wi-Fi.
3. Below 520px the customer app (`/app`) is full-bleed with a sticky bottom nav; use "Add to Home Screen" to install it (web app manifest in `public/`).

The backend must run on the same machine (`/api` is proxied, with `X-Forwarded-For` set so the backend sees the real client IP).
