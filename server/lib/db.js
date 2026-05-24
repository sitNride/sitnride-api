/**
 * SitNRide Railway backend - PostgreSQL connection pool (Phase 2).
 *
 * SCOPE (intentionally minimal):
 *   - Exports a lazily-initialized pg.Pool singleton bound to DATABASE_URL.
 *   - Used ONLY by the /api/db-health route at this point.
 *   - No query helpers, no transactions, no ORM, no migrations.
 *
 * SAFETY:
 *   - Read-only by convention (this file does not write).
 *   - SSL is enabled with rejectUnauthorized=false because Railway's managed
 *     PostgreSQL terminates TLS with a self-signed cert chain. This is the
 *     documented Railway pattern and matches every other Railway+pg deployment.
 *   - Pool size kept tiny (max=2) so this probe cannot exhaust connections
 *     or interfere with future feature work.
 *   - Idle/connection timeouts are short so a misconfigured DATABASE_URL
 *     fails fast in logs instead of hanging the request.
 *
 * ROLLBACK:
 *   - Deleting this file + removing the /api/db-health route is sufficient
 *     to fully revert Phase 2. No schema, no migrations, no state created.
 */

const { Pool } = require('pg');

let _pool = null;

/**
 * Returns the shared pg.Pool. Created on first call.
 * Throws a clear error if DATABASE_URL is missing so failures surface
 * immediately in Railway logs rather than as opaque timeouts.
 */
function getPool() {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Railway PostgreSQL plugin must be attached ' +
        'and DATABASE_URL must be referenced in this service\'s variables.'
    );
  }

  _pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2, // tiny pool - this is a probe, not production traffic
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  // Surface pool-level errors in Railway logs instead of crashing the process.
  _pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] idle client error:', err.message);
  });

  return _pool;
}

module.exports = { getPool };
