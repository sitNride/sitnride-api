/**
 * Env-var diagnostics helpers.
 *
 * Exposes a single `getEnvVarStatuses()` function that reports — for each
 * VITE_* variable the app expects — whether the var is set in the current
 * runtime environment, WITHOUT revealing the value itself. This is consumed
 * by the admin-only diagnostics page at /admin/diagnostics so deployment
 * misconfiguration is immediately visible.
 *
 * Design notes:
 *   - We never return the actual value of any env var. Even leaking a length
 *     or prefix could partially reveal a secret, so we expose only:
 *         - present:   boolean — is the env var set to a non-empty string?
 *         - usingFallback: boolean — when not present, is the app falling back
 *                                    to a hardcoded dev default? (true means
 *                                    the app still works but ops should fix
 *                                    the env)
 *   - This module must NEVER throw. `import.meta.env` may be undefined under
 *     non-Vite tooling (unit tests, SSR), so all reads are wrapped in
 *     try/catch — same pattern as src/lib/database.ts and src/lib/support.ts.
 *   - Adding a new VITE_* variable to the app? Add it to EXPECTED_ENV_VARS
 *     below and it will automatically appear in the diagnostics page.
 */

/** Read a Vite env var safely. Returns undefined when missing/empty/non-string. */
function readEnvVar(name: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    const raw = env?.[name];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  } catch {
    // ignore — caller treats this as "not set"
  }
  return undefined;
}

/** True when the current build is a Vite production build. */
export function isProductionBuild(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    return Boolean(env?.PROD);
  } catch {
    return false;
  }
}

/** True when the current build is a Vite dev build. */
export function isDevBuild(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    return Boolean(env?.DEV);
  } catch {
    return false;
  }
}

/** Per-variable diagnostic record returned to the UI. */
export interface EnvVarStatus {
  /** The exact env-var name, e.g. "VITE_DATABASE_URL". */
  name: string;
  /** Short human-readable explanation of what this var configures. */
  description: string;
  /** Is the var set to a non-empty string in the current build? */
  present: boolean;
  /**
   * When `present === false`, is the app falling back to a hardcoded default?
   * `true` means the app still works (dev/preview mode) but ops should set
   * the env in production so credentials can be rotated without a code commit.
   * `false` means the feature is fully disabled.
   */
  usingFallback: boolean;
  /**
   * Severity of a missing var. Used to tint the row red vs amber:
   *   - 'critical' : app-wide breakage (database)
   *   - 'high'     : major feature breakage (payments, maps)
   *   - 'medium'   : non-blocking but ops should fix (support phone)
   */
  severity: 'critical' | 'high' | 'medium';
}

/**
 * The canonical list of env vars the app reads. Add new VITE_* vars here.
 *
 * `hasFallback` corresponds to whether the consuming module (src/lib/*) ships
 * a hardcoded dev-time default. If `true`, missing-in-prod is a warning.
 * If `false`, missing-in-prod is an outright failure.
 */
const EXPECTED_ENV_VARS: ReadonlyArray<{
  name: string;
  description: string;
  hasFallback: boolean;
  severity: EnvVarStatus['severity'];
}> = [
  {
    name: 'VITE_DATABASE_URL',
    description: 'Supabase project URL used by src/lib/database.ts',
    hasFallback: true,
    severity: 'critical',
  },
  {
    name: 'VITE_DATABASE_ANON_KEY',
    description: 'Supabase publishable anon key used by src/lib/database.ts',
    hasFallback: true,
    severity: 'critical',
  },
  {
    name: 'VITE_SUPPORT_PHONE',
    description: '24/7 support phone (E.164) used by src/lib/support.ts for tel:/sms: links',
    hasFallback: true,
    severity: 'medium',
  },
  {
    name: 'VITE_MAPBOX_ACCESS_TOKEN',
    description: 'Mapbox public token (pk.*) used by src/lib/mapboxToken.ts',
    hasFallback: true,
    severity: 'high',
  },
  {
    name: 'VITE_STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key used by src/lib/stripe.ts (currently hardcoded — env-driven rotation TBD)',
    hasFallback: true,
    severity: 'high',
  },
];

/** Build the per-var status list shown in the diagnostics UI. */
export function getEnvVarStatuses(): EnvVarStatus[] {
  return EXPECTED_ENV_VARS.map(({ name, description, hasFallback, severity }) => {
    const value = readEnvVar(name);
    const present = value !== undefined;
    return {
      name,
      description,
      present,
      usingFallback: !present && hasFallback,
      severity,
    };
  });
}

/** Top-level summary numbers for the diagnostics page header. */
export function getEnvSummary(): {
  total: number;
  configured: number;
  missing: number;
  usingFallback: number;
  mode: 'production' | 'development';
} {
  const statuses = getEnvVarStatuses();
  return {
    total: statuses.length,
    configured: statuses.filter((s) => s.present).length,
    missing: statuses.filter((s) => !s.present).length,
    usingFallback: statuses.filter((s) => s.usingFallback).length,
    mode: isProductionBuild() ? 'production' : 'development',
  };
}
