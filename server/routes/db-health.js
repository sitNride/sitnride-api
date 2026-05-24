/**
 * SitNRide Railway backend - /api/db-health route (Phase 2).
 *
 * PURPOSE:
 *   Validate end-to-end backend <-> Railway PostgreSQL connectivity using
 *   the safest possible query: `SELECT 1`.
 *
 * GUARANTEES:
 *   - Read-only. No INSERT/UPDATE/DELETE/DDL anywhere in this file.
 *   - No schema dependency (does not reference any table).
 *   - No permission dependency (every Postgres role can SELECT 1).
 *   - No side effects on existing routes - mounted under a fresh path.
 *
 * RESPONSE SHAPE (success, HTTP 200):
 *   {
 *     ok: true,
 *     service: 'sitnride-api',
 *     phase: 2,
 *     route: '/api/db-health',
 *     db: {
 *       connected: true,
 *       query: 'SELECT 1',
 *       result: 1,
 *       latencyMs: <number>
 *     },
 *     ts: '<ISO timestamp>'
 *   }
 *
 * RESPONSE SHAPE (failure, HTTP 500):
 *   {
 *     ok: false,
 *     service: 'sitnride-api',
 *     phase: 2,
 *     route: '/api/db-health',
 *     db: { connected: false, error: '<message>' },
 *     ts: '<ISO timestamp>'
 *   }
 */

const express = require('express');
const { getPool } = require('../lib/db');

const router = express.Router();

router.get('/db-health', async (_req, res) => {
  const startedAt = Date.now();
  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1 AS ok');
    const latencyMs = Date.now() - startedAt;
    const value = result && result.rows && result.rows[0] ? result.rows[0].ok : null;

    // eslint-disable-next-line no-console
    console.log(`[db-health] OK select=1 result=${value} latencyMs=${latencyMs}`);

    return res.status(200).json({
      ok: true,
      service: 'sitnride-api',
      phase: 2,
      route: '/api/db-health',
      db: {
        connected: true,
        query: 'SELECT 1',
        result: value,
        latencyMs,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message = err && err.message ? err.message : String(err);

    // eslint-disable-next-line no-console
    console.error(`[db-health] FAIL latencyMs=${latencyMs} error=${message}`);

    return res.status(500).json({
      ok: false,
      service: 'sitnride-api',
      phase: 2,
      route: '/api/db-health',
      db: {
        connected: false,
        error: message,
      },
      ts: new Date().toISOString(),
    });
  }
});

module.exports = router;
