import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SINGLE SOURCE OF TRUTH for the database client.
// ----------------------------------------------------------------------------
// The database URL and anon (publishable) key are defined in EXACTLY ONE place
// in the codebase: this file. Every other file in the app must import the
// `database` client from '@/lib/database' rather than calling createClient()
// themselves or hardcoding these values elsewhere.
//
// Configuration priority (12-factor):
//   1. `VITE_DATABASE_URL` / `VITE_DATABASE_ANON_KEY` environment variables
//      (set in `.env` / `.env.local` / hosting provider env config).
//      Recommended for prod — rotating credentials is a config-only change,
//      no code commit required.
//   2. The hardcoded `DEFAULT_*` fallbacks below — used when the env vars are
//      missing or empty so dev/preview builds still work out of the box.
//
// In production (import.meta.env.PROD === true), a warning is logged when the
// fallback values are used so misconfiguration is visible in browser consoles
// and log aggregators.
// ============================================================================

// Sensible fallbacks used when VITE_DATABASE_URL / VITE_DATABASE_ANON_KEY are
// not provided. Keep these in sync with the actual project so dev/preview
// builds continue to work without an .env file.
const DEFAULT_DATABASE_URL = 'https://vobvetybkdpyncsbxzqj.supabase.co';
const DEFAULT_DATABASE_ANON_KEY = 'sb_publishable_hmB7wIt54yPBudRLq9q6XQ_X3tyqcT5';

/**
 * Read a Vite env var safely. Vite exposes env vars on `import.meta.env` —
 * wrapped in a try/catch so this module is also safe under non-Vite tooling
 * (e.g. unit tests run with Node) where `import.meta.env` may be undefined.
 *
 * Mirrors the pattern used in `src/lib/support.ts`.
 */
function readEnvVar(name: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    const raw = env?.[name];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  } catch {
    // ignore — fall through to default
  }
  return undefined;
}

/** Returns `true` when running under a Vite production build. Safe under non-Vite tooling. */
function isProductionBuild(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    return Boolean(env?.PROD);
  } catch {
    return false;
  }
}

const envUrl = readEnvVar('VITE_DATABASE_URL');
const envAnonKey = readEnvVar('VITE_DATABASE_ANON_KEY');

const DATABASE_URL = envUrl ?? DEFAULT_DATABASE_URL;
const DATABASE_ANON_KEY = envAnonKey ?? DEFAULT_DATABASE_ANON_KEY;

// Warn loudly in production when env vars are missing — this almost always
// indicates a deployment misconfiguration. We still fall back to the
// hardcoded defaults so the app keeps working, but ops should fix the env.
if (isProductionBuild()) {
  if (!envUrl || !envAnonKey) {
    const missing: string[] = [];
    if (!envUrl) missing.push('VITE_DATABASE_URL');
    if (!envAnonKey) missing.push('VITE_DATABASE_ANON_KEY');
    // eslint-disable-next-line no-console
    console.warn(
      `[database] Missing env var(s) in production: ${missing.join(', ')}. ` +
      `Falling back to hardcoded default credentials. ` +
      `Set these in your hosting provider's environment configuration ` +
      `to enable credential rotation without a code commit.`
    );
  }
}

let database: ReturnType<typeof createClient>;

if (!DATABASE_URL || !DATABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[database] Missing DATABASE_URL and/or DATABASE_ANON_KEY. ' +
    'Database features will be disabled until these are configured.'
  );
  // Safe stub so createClient() doesn't throw at import time.
  // Network calls will fail gracefully via existing try/catch logic.
  database = createClient('https://placeholder.invalid', 'placeholder-anon-key');
} else {
  database = createClient(DATABASE_URL, DATABASE_ANON_KEY);
}

export { database };
