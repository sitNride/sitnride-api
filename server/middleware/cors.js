/**
 * CORS middleware for SitNRide Railway backend.
 *
 * Allowlist approach: reflects Origin header back ONLY when the request origin
 * matches one of the patterns below. Any unknown origin gets no
 * Access-Control-Allow-Origin header at all (browser will block the response).
 *
 * Phase 1 scope: allow famous.ai preview URLs, deploypad.app preview URLs,
 * and local dev origins. Add production domains here later when known.
 */

const cors = require('cors');

const STATIC_ALLOWED = new Set([
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
]);

const DYNAMIC_ALLOWED_PATTERNS = [
  /\.famous\.ai$/i,
  /\.deploypad\.app$/i,
  /\.up\.railway\.app$/i,
];

function isOriginAllowed(origin) {
  if (!origin) return true; // server-to-server / curl / health probes
  if (STATIC_ALLOWED.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return DYNAMIC_ALLOWED_PATTERNS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

const corsMiddleware = cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // Do NOT throw - just deny silently so we don't 500 on bad origins.
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
});

module.exports = { corsMiddleware, isOriginAllowed };
