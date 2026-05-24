/**
 * Shared support contact configuration.
 *
 * Both the driver-side and rider-side Safety modals read the support phone
 * number from this single module so it only needs to be changed in one place.
 *
 * Configuration priority:
 *   1. `VITE_SUPPORT_PHONE` environment variable (set in `.env` /
 *      `.env.local` / hosting provider env config). Recommended for prod.
 *   2. `DEFAULT_SUPPORT_PHONE` fallback below — used when the env var is
 *      missing or empty so dev/preview builds still work.
 *
 * Format: full E.164 phone number including country code, e.g. "+18438041918".
 * The `tel:` and `sms:` URL schemes accept this format on both iOS and Android.
 */

// Sensible fallback used when VITE_SUPPORT_PHONE is not provided.
// Real 24/7 business support number.
const DEFAULT_SUPPORT_PHONE = '+18438041918';

/**
 * Read VITE_SUPPORT_PHONE safely. Vite exposes env vars on `import.meta.env`
 * — wrapped in a try/catch so this module is also safe under non-Vite tooling
 * (e.g. unit tests run with Node) where `import.meta.env` may be undefined.
 */
function readEnvSupportPhone(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    const raw = env?.VITE_SUPPORT_PHONE;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  } catch {
    // ignore — fall through to default
  }
  return undefined;
}

/** The single source of truth for the support phone number. */
export const SUPPORT_PHONE: string = readEnvSupportPhone() ?? DEFAULT_SUPPORT_PHONE;

/** Convenience: `tel:` URL for one-tap calling on mobile. */
export function getSupportTelHref(): string {
  return `tel:${SUPPORT_PHONE}`;
}

/**
 * Convenience: `sms:` URL with a URL-encoded prefilled message body.
 * Caller is responsible for building the message string (e.g. with live
 * location) — this helper just handles encoding + the phone number.
 */
export function getSupportSmsHref(message: string): string {
  return `sms:${SUPPORT_PHONE}?body=${encodeURIComponent(message)}`;
}

/**
 * Build the standard Google Maps link used inside support SMS messages,
 * or `'Location unavailable'` when GPS coords are missing. Kept here so
 * driver and rider modals format the link identically.
 */
export function buildLiveLocationLink(
  lat?: number | null,
  lng?: number | null,
): string {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  return 'Location unavailable';
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency event logging
// ─────────────────────────────────────────────────────────────────────────────
//
// Whenever a driver or rider taps a button in the Safety Center
// (Text Support, Call Support, or Call 911), we insert a row into the
// `emergency_events` table for audit + support follow-up.
//
// Hard rules:
//   - Logging MUST run BEFORE we open the sms:/tel: link so we don't lose the
//     event if the OS context-switches away from the browser.
//   - Logging MUST NEVER block or throw — any failure is swallowed and logged
//     to the console so the user-facing emergency action always proceeds.
//   - The table is permissive on insert (RLS allows public inserts) so even
//     unauthenticated edge cases still produce a row.
//
// The helper accepts a database client by reference (rather than importing
// `@/lib/database` here) to keep this module free of side-effects and easy
// to unit-test. Both dashboards already import the database client and pass
// it in.

export type EmergencyRole = 'driver' | 'rider';
export type EmergencyEventType = 'sms_support' | 'call_support' | 'call_911';

export interface LogEmergencyEventInput {
  /** Database client (pass `database` from `@/lib/database`, typically aliased as `supabase`). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  role: EmergencyRole;
  eventType: EmergencyEventType;
  /** Active ride object — only `id` is read. May be null if no active ride. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentRide?: { id?: string | null } | null;
  /** Authenticated user — only `id` is read. May be null. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: { id?: string | null } | null;
  /** Driver's GPS location, when role === 'driver'. */
  driverLocation?: { lat?: number | null; lng?: number | null } | null;
  /** Rider's relevant location, when role === 'rider' (typically pickup point). */
  riderLocation?: { lat?: number | null; lng?: number | null } | null;
  /** Optional SMS/message body — only present for sms_support events. */
  message?: string | null;
}
/**
 * Insert a row into `emergency_events`. Always returns — never throws.
 * Returns `true` on success, `false` if the insert failed (caller can ignore).
 *
 * Side effect: when `eventType === 'call_911'`, this also fires a
 * fire-and-forget invocation of the `notify-admin-emergency` edge function
 * which sends Twilio SMS + Resend email alerts to the on-call admin contact
 * list. The notify call NEVER blocks or throws — failures are swallowed.
 */
export async function logEmergencyEvent(input: LogEmergencyEventInput): Promise<boolean> {
  try {
    const {
      supabase,
      role,
      eventType,
      currentRide,
      user,
      driverLocation,
      riderLocation,
      message,
    } = input;

    if (!supabase || typeof supabase.from !== 'function') {
      // No client available — silently skip.
      return false;
    }

    // Pick the role-appropriate location source. Fall back to null if missing.
    const loc = role === 'driver' ? driverLocation : riderLocation;
    const lat =
      loc && typeof loc.lat === 'number' && !Number.isNaN(loc.lat) ? loc.lat : null;
    const lng =
      loc && typeof loc.lng === 'number' && !Number.isNaN(loc.lng) ? loc.lng : null;

    const row = {
      ride_id: currentRide?.id ?? null,
      user_id: user?.id ?? null,
      role,
      event_type: eventType,
      message: message ?? null,
      location_lat: lat,
      location_lng: lng,
    };

    const { error } = await supabase.from('emergency_events').insert(row);
    if (error) {
      console.error('logEmergencyEvent: insert failed', error);
      return false;
    }

    // ---------------------------------------------------------------------
    // 911 → notify on-call admins via SMS + email (fire-and-forget).
    // We intentionally do NOT await this — the user's tel: navigation must
    // proceed instantly. Errors are swallowed.
    // ---------------------------------------------------------------------
    if (eventType === 'call_911') {
      try {
        const notifyPromise = supabase.functions?.invoke?.('notify-admin-emergency', {
          body: {
            role,
            ride_id: row.ride_id,
            user_id: row.user_id,
            location_lat: row.location_lat,
            location_lng: row.location_lng,
            message: row.message,
            created_at: new Date().toISOString(),
          },
        });
        if (notifyPromise && typeof notifyPromise.then === 'function') {
          notifyPromise.catch((e: unknown) => {
            console.error('notify-admin-emergency: invoke failed', e);
          });
        }
      } catch (e) {
        console.error('notify-admin-emergency: unexpected invoke error', e);
      }
    }

    return true;
  } catch (err) {
    // Logging must NEVER break the UI.
    console.error('logEmergencyEvent: unexpected error', err);
    return false;
  }
}
