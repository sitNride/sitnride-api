import { database as supabase } from '@/lib/database';

/**
 * ensureFreshSession()
 * --------------------------------------------------------------------
 * Minimal session-refresh guard used immediately BEFORE invoking any
 * Edge Function that the browser will preflight (OPTIONS) and that
 * requires a valid `Authorization: Bearer <jwt>` header.
 *
 * Why this exists:
 *   The diagnostics confirmed the browser was blocking the POST with
 *   "preflight does not have HTTP ok status" because, when the rider's
 *   JWT is stale/expired, the Functions gateway can short-circuit even
 *   the OPTIONS preflight with a non-2xx response. Refreshing the
 *   session client-side (or proving there is no valid session) before
 *   the invoke call eliminates that path.
 *
 * Behaviour:
 *   - If there is no current session: returns { ok: false, reason: 'no_session' }.
 *   - If the session exists and is not near expiry: returns { ok: true, session }.
 *   - If the session is near expiry (<60s) OR refresh is forced: calls
 *     supabase.auth.refreshSession(); on success returns { ok: true,
 *     session: refreshed }, on failure returns { ok: false,
 *     reason: 'refresh_failed', error }.
 *
 * This helper does NOT throw. It also does NOT touch pricing, booking,
 * SetupIntent, Mapbox, Twilio, onboarding, schema, or any unrelated
 * payment logic. It is intentionally narrow: read session → refresh
 * if near-expiry → report status.
 */
export type EnsureFreshSessionResult =
  | { ok: true; session: any; refreshed: boolean }
  | { ok: false; reason: 'no_session' | 'refresh_failed'; error?: any };

const NEAR_EXPIRY_SECONDS = 60; // refresh if token expires within 60s

export async function ensureFreshSession(
  options: { force?: boolean } = {}
): Promise<EnsureFreshSessionResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { ok: false, reason: 'no_session' };
    }

    const expiresAt = (session as any)?.expires_at as number | undefined;
    const nowSec = Math.floor(Date.now() / 1000);
    const nearExpiry =
      typeof expiresAt === 'number' && expiresAt - nowSec < NEAR_EXPIRY_SECONDS;

    if (!options.force && !nearExpiry) {
      return { ok: true, session, refreshed: false };
    }

    // Refresh the session
    const { data: refreshData, error: refreshErr } =
      await supabase.auth.refreshSession();

    if (refreshErr || !refreshData?.session?.access_token) {
      return { ok: false, reason: 'refresh_failed', error: refreshErr };
    }

    return { ok: true, session: refreshData.session, refreshed: true };
  } catch (err) {
    return { ok: false, reason: 'refresh_failed', error: err };
  }
}
