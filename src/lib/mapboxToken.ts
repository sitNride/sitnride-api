// Centralized Mapbox token resolution.
//
// ═════════════════════════════════════════════════════════════════════════════
//  ⚠️  RECOVERY-STATE CONFIGURATION — DO NOT REMOVE THE FALLBACK_TOKEN  ⚠️
// ═════════════════════════════════════════════════════════════════════════════
//
// The hosting platform's VITE_MAPBOX_ACCESS_TOKEN env var has been observed to
// disappear silently during checkpoints / publishes / rebuilds / backend work.
// Until we engineer a permanent injection fix, we keep a HARDCODED public
// Mapbox pk.* token in FALLBACK_TOKEN below as the recovery safety net.
//
// DO NOT blank, replace, or remove FALLBACK_TOKEN during:
//   • publishes
//   • checkpoints
//   • diagnostics passes
//   • backend / Supabase / schema changes
//   • auth / onboarding / verification fixes
//   • routing / dashboard / pricing / FamousPay changes
//   • general code cleanups
//
// If you see this file with FALLBACK_TOKEN = '' again, it means a checkpoint or
// publish wiped it — restore it from the project's last-known-working pk.*
// token (a public, URL-restricted Mapbox token, NOT a secret sk.* token).
// ═════════════════════════════════════════════════════════════════════════════
//
// Resolution order (first VALID, non-placeholder, non-empty value wins):
//   1. window.__MAPBOX_TOKEN__                     — runtime override (dev console / index.html)
//   2. localStorage['mapbox_token'] / ['VITE_MAPBOX_ACCESS_TOKEN']
//                                                  — RUNTIME RECOVERY: persisted self-service token
//                                                    set via the in-UI "paste token" recovery prompt
//                                                    in MapboxMap.tsx OR via DevTools:
//                                                      localStorage.setItem('mapbox_token','pk.xxx')
//                                                    Survives env-var wipes WITHOUT a rebuild.
//   3. import.meta.env.VITE_MAPBOX_ACCESS_TOKEN    — PREFERRED, set in hosting Secrets
//   4. FALLBACK_TOKEN                              — RECOVERY-STATE hardcoded pk.*
//
// PLACEHOLDER GUARD:
//   Any candidate value that contains "PLACEHOLDER", "REPLACE", "your_actual_token",
//   "xxxxx", or doesn't start with "pk." is rejected and treated as unset. This
//   prevents accidental shipping of a stub string.
//
// HOW TO ROTATE THE TOKEN (preferred, zero code changes):
//   1. Generate a new public Mapbox token (pk.*) with the correct URL
//      restrictions in your Mapbox account.
//   2. Update VITE_MAPBOX_ACCESS_TOKEN in the hosting Secrets dashboard.
//   3. Trigger a rebuild/publish. Done.
//
// HOW TO RECOVER WITHOUT A REBUILD (when env var is wiped mid-session):
//   Option A — in-app: when the map shows the "Map Loading Issue" panel, click
//              "Enter token manually", paste the pk.* token, click Save. The
//              token is stored in localStorage and survives reloads.
//   Option B — DevTools console:
//              localStorage.setItem('mapbox_token','pk.YOUR_PUBLIC_TOKEN');
//              location.reload();
//
// HOW TO ROTATE THE RECOVERY FALLBACK (only if the env-var path is unreliable):
//   1. Update the single FALLBACK_TOKEN literal below.
//   2. Re-publish.
//
// ─────────────────────────────────────────────────────────────────────────────
//  ⬇⬇⬇  RECOVERY FALLBACK TOKEN — single source line, DO NOT REMOVE  ⬇⬇⬇
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Must be a PUBLIC Mapbox token (starts with "pk."). Never paste an
// "sk." secret token here — this file is shipped to the browser.
const FALLBACK_TOKEN = ''; // ⚠️ RECOVERY-STATE: paste the project's last-known-working pk.* token here. DO NOT REMOVE.
// ─────────────────────────────────────────────────────────────────────────────
//  ⬆⬆⬆  RECOVERY FALLBACK TOKEN — single source line, DO NOT REMOVE  ⬆⬆⬆
// ─────────────────────────────────────────────────────────────────────────────

/**
 * localStorage keys checked for a self-service recovery token. The first one
 * with a valid pk.* value wins. Both keys are accepted so ops scripts and
 * older DevTools snippets keep working.
 */
const LOCALSTORAGE_KEYS: ReadonlyArray<string> = [
  'mapbox_token',
  'VITE_MAPBOX_ACCESS_TOKEN',
  '__MAPBOX_TOKEN__',
];

declare global {
  interface Window {
    __MAPBOX_TOKEN__?: string;
    /** Set to `true` after we've emitted the missing-token warning once. */
    __MAPBOX_TOKEN_WARNED__?: boolean;
    /** Set to `true` after we've emitted the recovery-fallback notice once. */
    __MAPBOX_FALLBACK_NOTICE__?: boolean;
    /** Set to `true` after we've emitted the localStorage-recovery notice once. */
    __MAPBOX_LOCALSTORAGE_NOTICE__?: boolean;
  }
}

/**
 * Patterns that indicate a string is a placeholder, not a real Mapbox token.
 * Any match → treat the value as unset and continue down the resolution chain.
 */
const PLACEHOLDER_PATTERNS: ReadonlyArray<RegExp> = [
  /PLACEHOLDER/i,
  /REPLACE[_-]?WITH/i,
  /YOUR[_-]?(ACTUAL[_-]?)?TOKEN/i,
  /YOUR[_-]?MAPBOX/i,
  /XXXXX/i,
  /EXAMPLE/i,
  /CHANGEME/i,
];

/** True when the string is structurally invalid or obviously a placeholder. */
function isPlaceholder(value: string): boolean {
  if (!value) return true;
  // Real Mapbox public tokens always start with "pk." — anything else is wrong.
  if (!value.startsWith('pk.')) return true;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(value)) return true;
  }
  return false;
}

/** Normalize an env/runtime value into either a trimmed string or "". */
function clean(value: unknown): string {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  if (!s || s === 'undefined' || s === 'null') return '';
  return s;
}

/** Resolve a candidate, returning "" when it's empty OR a placeholder. */
function accept(value: unknown): string {
  const cleaned = clean(value);
  if (!cleaned) return '';
  if (isPlaceholder(cleaned)) return '';
  return cleaned;
}

/** Read the first valid pk.* token from any of the known localStorage keys. */
function readFromLocalStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    const storage = window.localStorage;
    if (!storage) return '';
    for (const key of LOCALSTORAGE_KEYS) {
      const raw = accept(storage.getItem(key));
      if (raw) return raw;
    }
  } catch {
    /* SSR / privacy mode / storage disabled — ignore */
  }
  return '';
}

/**
 * Public helper used by the in-UI "paste token" recovery prompt. Validates the
 * value, writes it to localStorage under the canonical key, and returns true
 * on success. Does NOT trigger a reload — the caller decides.
 */
export function setMapboxTokenOverride(token: string): boolean {
  const cleaned = accept(token);
  if (!cleaned) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem('mapbox_token', cleaned);
    // Also expose immediately on window so the current page can pick it up
    // without waiting for a reload (e.g. retry button path).
    window.__MAPBOX_TOKEN__ = cleaned;
    // Reset the one-shot warning flags so the next resolution can re-announce.
    window.__MAPBOX_TOKEN_WARNED__ = false;
    return true;
  } catch {
    return false;
  }
}

/** Public helper to clear the persisted recovery token (ops/debug use). */
export function clearMapboxTokenOverride(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LOCALSTORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
    delete window.__MAPBOX_TOKEN__;
  } catch {
    /* ignore */
  }
}

/**
 * Emit a single, loud console warning (once per page load) when no valid
 * Mapbox token can be resolved. We deliberately do NOT throw — the rest of
 * the app handles an empty token by hiding the map and disabling autocomplete
 * gracefully (see MapboxMap.tsx + AddressAutocomplete.tsx).
 */
function warnMissingTokenOnce(reason: string): void {
  if (typeof window === 'undefined') return;
  if (window.__MAPBOX_TOKEN_WARNED__) return;
  window.__MAPBOX_TOKEN_WARNED__ = true;

  let isProd = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isProd = Boolean((import.meta as any)?.env?.PROD);
  } catch {
    /* ignore */
  }

  const banner = isProd
    ? '[Mapbox] PRODUCTION: no valid Mapbox token resolved.'
    : '[Mapbox] DEV: no valid Mapbox token resolved.';

  // eslint-disable-next-line no-console
  console.warn(
    `${banner} Reason: ${reason}. ` +
      'Recovery options: ' +
      '(a) set VITE_MAPBOX_ACCESS_TOKEN in the hosting Secrets dashboard and republish, ' +
      '(b) paste a pk.* token into the in-UI recovery prompt on the map, OR ' +
      '(c) run in DevTools console: ' +
      `localStorage.setItem('mapbox_token','pk.YOUR_TOKEN'); location.reload();`,
  );
}

/**
 * One-time, non-intrusive console.info when the resolved token came from the
 * hardcoded recovery FALLBACK_TOKEN rather than the env var. This makes silent
 * env-var drops immediately visible in DevTools without altering business
 * logic, without showing a UI banner, and without throwing.
 */
function noticeFallbackInUseOnce(): void {
  if (typeof window === 'undefined') return;
  if (window.__MAPBOX_FALLBACK_NOTICE__) return;
  window.__MAPBOX_FALLBACK_NOTICE__ = true;

  // eslint-disable-next-line no-console
  console.info(
    '[Mapbox] Using hardcoded recovery FALLBACK_TOKEN ' +
      '(VITE_MAPBOX_ACCESS_TOKEN env var was unset or invalid). ' +
      'This is the intended recovery state — do NOT remove FALLBACK_TOKEN ' +
      'during cleanups, checkpoints, publishes, backend changes, or auth/onboarding fixes.',
  );
}

/** One-time info when the token came from localStorage recovery. */
function noticeLocalStorageInUseOnce(): void {
  if (typeof window === 'undefined') return;
  if (window.__MAPBOX_LOCALSTORAGE_NOTICE__) return;
  window.__MAPBOX_LOCALSTORAGE_NOTICE__ = true;

  // eslint-disable-next-line no-console
  console.info(
    '[Mapbox] Using localStorage recovery token ' +
      '(VITE_MAPBOX_ACCESS_TOKEN env var was unset or invalid). ' +
      'Clear with: localStorage.removeItem("mapbox_token"); location.reload();',
  );
}

export function getMapboxToken(): string {
  // 1. Runtime window override (useful for ops to test a rotated token without a rebuild).
  if (typeof window !== 'undefined') {
    const runtime = accept(window.__MAPBOX_TOKEN__);
    if (runtime) return runtime;
  }

  // 2. localStorage runtime recovery — survives env-var wipes WITHOUT a rebuild.
  //    This is the path the in-UI "paste token" recovery prompt writes to,
  //    and it's what made the previous recovery state work end-to-end.
  const stored = readFromLocalStorage();
  if (stored) {
    noticeLocalStorageInUseOnce();
    return stored;
  }

  // 3. Build-time env var — the canonical production source.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envToken = accept((import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN);
    if (envToken) return envToken;
  } catch {
    /* ignore — import.meta may be unavailable under some tooling */
  }

  // 4. RECOVERY-STATE hardcoded fallback. See file header — DO NOT REMOVE.
  const fallback = accept(FALLBACK_TOKEN);
  if (fallback) {
    noticeFallbackInUseOnce();
    return fallback;
  }

  // Nothing valid resolved — emit a single console.warn so ops sees it in DevTools.
  warnMissingTokenOnce(
    'env var unset/invalid, no localStorage recovery token, AND FALLBACK_TOKEN missing — was it blanked by a checkpoint?',
  );
  return '';
}

/**
 * Lightweight diagnostic helper used by /admin/diagnostics.
 * Returns a structured status without leaking the token value itself.
 */
export function getMapboxTokenStatus(): {
  resolved: boolean;
  source: 'runtime' | 'localStorage' | 'env' | 'fallback' | 'none';
  placeholderDetected: boolean;
} {
  let placeholderDetected = false;

  if (typeof window !== 'undefined') {
    const raw = clean(window.__MAPBOX_TOKEN__);
    if (raw) {
      if (isPlaceholder(raw)) placeholderDetected = true;
      else return { resolved: true, source: 'runtime', placeholderDetected };
    }
  }

  const stored = readFromLocalStorage();
  if (stored) {
    return { resolved: true, source: 'localStorage', placeholderDetected };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = clean((import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN);
    if (raw) {
      if (isPlaceholder(raw)) placeholderDetected = true;
      else return { resolved: true, source: 'env', placeholderDetected };
    }
  } catch {
    /* ignore */
  }

  const raw = clean(FALLBACK_TOKEN);
  if (raw && !isPlaceholder(raw)) {
    return { resolved: true, source: 'fallback', placeholderDetected };
  }

  return { resolved: false, source: 'none', placeholderDetected };
}

export default getMapboxToken;
