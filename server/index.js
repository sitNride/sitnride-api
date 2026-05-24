/**
 * SitNRide Railway Express backend - entry point.
 *
 * PHASE 1 SCOPE (intentionally minimal):
 *   - Express app + JSON body parser
 *   - CORS allowlist middleware
 *   - Health-check routes only (/, /health, /api/health)
 *   - Port listener bound to 0.0.0.0 using Railway's injected PORT
 *
 * PHASE 2 ADDITION (isolated, read-only):
 *   - /api/db-health route validates backend <-> Railway PostgreSQL using
 *     `SELECT 1`. No schema, no writes, no Stripe, no Supabase admin client.
 *
 * NOT IN SCOPE YET:
 *   - No Stripe routes
 *   - No Supabase admin client
 *   - No payment migration
 *   - No frontend route rewrites
 */

require('dotenv').config();

const express = require('express');
const { corsMiddleware } = require('./middleware/cors');
const healthRoutes = require('./routes/health');
const dbHealthRoutes = require('./routes/db-health');

const app = express();

// --- Core middleware ---------------------------------------------------------
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- Lightweight request log (Phase 1 only) ----------------------------------
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  // Keep log minimal - method, path, origin. No bodies, no headers, no secrets.
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${req.method} ${req.path} origin=${req.headers.origin || '-'}`);
  next();
});

// --- Routes ------------------------------------------------------------------
app.use('/', healthRoutes);
// Phase 2: isolated read-only DB connectivity probe. Mounted under /api so it
// does NOT collide with any existing route. Adds a single new path:
//   GET /api/db-health
app.use('/api', dbHealthRoutes);

// --- 404 fallback ------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'not_found',
    path: req.path,
    method: req.method,
    hint: 'Available: /, /health, /api/health, /api/db-health',
  });
});


// --- Error handler -----------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[error]', err && err.message ? err.message : err);
  res.status(500).json({ ok: false, error: 'internal_error' });
});

// --- Listener ----------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0'; // Railway requires binding to 0.0.0.0, not localhost

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[boot] sitnride-api Phase 1 listening on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[boot] node=${process.version} env=${process.env.NODE_ENV || 'development'}`);
});

// --- Graceful shutdown -------------------------------------------------------
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[shutdown] received ${signal}, closing server...`);
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('[shutdown] server closed cleanly');
    process.exit(0);
  });
  // Hard-exit after 10s if close hangs
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
