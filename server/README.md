# SitNRide API (Railway backend) — Phase 1

Minimal standalone Express server. **Health checks only.** No Stripe logic,
no Supabase admin calls, no payment routes. This phase exists purely to
prove that:

1. Railway can build and run the server.
2. The server binds correctly to the Railway-injected `PORT`.
3. The public Railway URL is reachable from a browser.
4. CORS allows `*.famous.ai`, `*.deploypad.app`, and `localhost` origins.

## Structure

```
server/
├── index.js               # Express entry, middleware, listener
├── middleware/
│   └── cors.js            # Origin allowlist
├── routes/
│   └── health.js          # GET /, /health, /api/health
├── package.json           # express, cors, dotenv ONLY
├── .env.example           # Documents expected env vars
└── .gitignore
```

The frontend (Vite + React under `/src`) is **not** affected by this server.
Root `package.json` is untouched. Railway runs `server/index.js` directly via
the root `railway.json` config.

## Running locally

```bash
cd server
npm install
npm start
# → http://localhost:3000/health
```

## Verification checklist (run AFTER Railway deploys)

Replace `<RAILWAY_URL>` with the public URL Railway assigns (e.g.
`https://sitnride-api-production.up.railway.app`).

```bash
# 1. Root liveness
curl -i <RAILWAY_URL>/

# 2. Railway-style health
curl -i <RAILWAY_URL>/health

# 3. Frontend-style health
curl -i <RAILWAY_URL>/api/health

# 4. CORS preflight from a famous.ai preview origin
curl -i -X OPTIONS <RAILWAY_URL>/api/health \
  -H "Origin: https://example.famous.ai" \
  -H "Access-Control-Request-Method: GET"

# 5. CORS preflight from an UNALLOWED origin (should NOT return ACAO header)
curl -i -X OPTIONS <RAILWAY_URL>/api/health \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: GET"
```

Expected:
- 1–3 return `200` with JSON `{ ok: true, service: "sitnride-api", phase: 1, ... }`.
- 4 returns `204` with `Access-Control-Allow-Origin: https://example.famous.ai`.
- 5 returns `204` but **without** any `Access-Control-Allow-Origin` header.

## What this server does NOT do (yet)

- ❌ No `/api/rider-card-setup`
- ❌ No `/api/stripe-save-payment-method`
- ❌ No `/api/stripe-manage-payment-methods`
- ❌ No Supabase client
- ❌ No Stripe SDK
- ❌ No DB writes

Those land in **Phase 2** after Phase 1 verification passes.
