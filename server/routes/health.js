/**
 * Health-check routes for SitNRide Railway backend.
 *
 * Phase 1 ONLY. Zero side effects. No DB, no Stripe, no Supabase.
 * Purpose: prove the Express server is alive, reachable, and CORS-correct
 * BEFORE any payment migration work begins.
 */

const express = require('express');
const router = express.Router();

const BOOT_TIME = Date.now();

function buildHealthPayload(extra = {}) {
  return {
    ok: true,
    service: 'sitnride-api',
    phase: 1,
    ts: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - BOOT_TIME) / 1000),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    ...extra,
  };
}

// GET / - root liveness ping
router.get('/', (_req, res) => {
  res.status(200).json(buildHealthPayload({ route: '/' }));
});

// GET /health - Railway's healthcheck path
router.get('/health', (_req, res) => {
  res.status(200).json(buildHealthPayload({ route: '/health' }));
});

// GET /api/health - frontend-facing health probe (used by browser fetch)
router.get('/api/health', (_req, res) => {
  res.status(200).json(
    buildHealthPayload({
      route: '/api/health',
      // Surface presence (NOT values) of secrets so we can confirm Railway env wiring later.
      secretsPresent: {
        STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
        SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    })
  );
});

module.exports = router;
