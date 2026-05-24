// ─────────────────────────────────────────────────────────────────────────────
// SHARED FARE ESTIMATE PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for fare estimation across the app.
//
// EXTRACTED VERBATIM from src/pages/FareEstimatorPage.tsx (the canonical
// pre-auth estimator) so that RiderDashboard and any future estimator can
// share IDENTICAL pricing/bonus behavior without duplicating logic.
//
// Pipeline (mirrors FareEstimatorPage useEffect lines 350-423):
//   1. Try the `estimate-fare` Supabase Edge Function (server-side canonical).
//   2. On any failure → fall back to client-side computeFareLocally(), which
//      uses the SAME @/lib/pricing constants + Mapbox Directions API.
//
// IMPORTANT: NO logic changes vs. FareEstimatorPage — pure extraction.
// FareEstimatorPage itself is NOT modified by this plan (it keeps its inline
// copy and continues working unchanged). This file is purely additive.

import {
  BASE_FEE,
  PER_MILE_RATE,
  PER_MINUTE_RATE,
  MINIMUM_FARE,
  EARNINGS_SPLIT,
  SHARED_RIDE_MULTIPLIERS,
} from '@/lib/pricing';
import { database as supabase } from '@/lib/database';
import { ensureFreshSession } from '@/lib/sessionGuard';
import { getMapboxToken } from '@/lib/mapboxToken';



// ─── Types (verbatim from FareEstimatorPage) ──────────────────────
export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface DriverEarningsBlock {
  riderCount?: number;
  driverBaseEarnings: number;
  bonus: number;
  bonusType: 'none' | 'weekend' | 'late_night';
  bonusLabel: string;
  totalDriverEarnings: number;
  tripDay?: string;
  tripHour?: number;
}

export interface FareEstimate {
  estimate: { low: number; mid: number; high: number };
  breakdown: {
    baseFee: number;
    perMileRate: number;
    perMinuteRate: number;
    distanceCharge: number;
    timeCharge: number;
    subtotal: number;
    bookingFee: number;
    safetyFee: number;
    totalCost: number;
  };
  route: {
    distanceMiles: number;
    durationMinutes: number;
    source: string;
    polyline: string | null;
  };
  sharedRideOptions: {
    riderCount: number;
    totalCost: number;
    costPerPerson: number;
    sharedRideMultiplier: number;
    savingsVsSolo: number;
    savingsPercentage: number;
  }[];
  driverEarnings?: DriverEarningsBlock;
  driverEarningsByRiders?: DriverEarningsBlock[];
  coordinates: {
    pickup: { lat: number; lng: number } | null;
    dropoff: { lat: number; lng: number } | null;
  };
}

// ─── Client-side fare computation fallback ────────────────────
const BOOKING_FEE = 1.50;
const SAFETY_FEE = 0.75;

// Bonus applies to DRIVER EARNINGS ONLY — rider totalCost unchanged.
// Weekend overrides late-night (no stacking).
export const DAYS_OF_WEEK_LIST = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

function computeDriverEarningsLocal(
  totalFare: number,
  tripDay: string,
  tripHour: number,
  riderCount?: number,
): DriverEarningsBlock {
  const driverBaseEarnings =
    Math.round(totalFare * EARNINGS_SPLIT.DRIVER_PERCENTAGE * 100) / 100;

  const isWeekend = tripDay === 'Saturday' || tripDay === 'Sunday';
  const isLateNight = tripHour >= 0 && tripHour < 5;

  let bonus = 0;
  let bonusType: 'none' | 'weekend' | 'late_night' = 'none';
  let bonusLabel = 'No Bonus';

  if (isWeekend) {
    bonus = Math.round(driverBaseEarnings * 0.05 * 100) / 100;
    bonusType = 'weekend';
    bonusLabel = 'Weekend Bonus (+5%)';
  } else if (isLateNight) {
    bonus = 0.50;
    bonusType = 'late_night';
    bonusLabel = 'Late Night Bonus (+$0.50)';
  }

  return {
    riderCount,
    driverBaseEarnings,
    bonus,
    bonusType,
    bonusLabel,
    totalDriverEarnings: Math.round((driverBaseEarnings + bonus) * 100) / 100,
    tripDay,
    tripHour,
  };
}

export async function computeFareLocally(
  pickup: Location,
  dropoff: Location,
  tripDay: string,
  tripHour: number,
): Promise<FareEstimate> {
  // 1. Route lookup via Mapbox Directions API (same token as autocomplete)
  const token = getMapboxToken();
  let distanceMiles = 0;
  let durationMinutes = 0;
  let polyline: string | null = null;
  let routeSource = 'haversine';

  if (token) {
    try {
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}` +
        `?access_token=${token}&overview=full&geometries=polyline`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.routes?.[0]) {
        distanceMiles = Math.round((data.routes[0].distance / 1609.344) * 10) / 10;
        durationMinutes = Math.round(data.routes[0].duration / 60);
        polyline = data.routes[0].geometry ?? null;
        routeSource = 'mapbox';
      }
    } catch {
      /* fall through to haversine */
    }
  }

  // 2. Haversine fallback if Directions API unavailable
  if (distanceMiles === 0) {
    const R = 3958.8; // miles
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(dropoff.lat - pickup.lat);
    const dLng = toRad(dropoff.lng - pickup.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(pickup.lat)) * Math.cos(toRad(dropoff.lat)) * Math.sin(dLng / 2) ** 2;
    const straight = 2 * R * Math.asin(Math.sqrt(a));
    distanceMiles = Math.round(straight * 1.3 * 10) / 10; // road-factor estimate
    durationMinutes = Math.max(5, Math.round(distanceMiles * 2.5)); // ~24mph avg
  }

  // 3. Fare calculation (mirrors estimate-fare Edge Function)
  const baseFee = BASE_FEE;
  const distanceCharge = Math.round(distanceMiles * PER_MILE_RATE * 100) / 100;
  const timeCharge = Math.round(durationMinutes * PER_MINUTE_RATE * 100) / 100;
  const subtotal = Math.round((baseFee + distanceCharge + timeCharge) * 100) / 100;
  const bookingFee = BOOKING_FEE;
  const safetyFee = SAFETY_FEE;
  const soloTotal = Math.max(
    MINIMUM_FARE,
    Math.round((subtotal + bookingFee + safetyFee) * 100) / 100
  );

  const sharedRideOptions = [1, 2, 3, 4].map((n) => {
    const mult = (SHARED_RIDE_MULTIPLIERS as Record<number, number>)[n] ?? 1.0;
    const totalCost = Math.max(MINIMUM_FARE, Math.round(soloTotal * mult * 100) / 100);
    const costPerPerson = Math.round((totalCost / n) * 100) / 100;
    const savingsVsSolo = n > 1 ? Math.round((soloTotal - costPerPerson) * 100) / 100 : 0;
    const savingsPercentage =
      n > 1 ? Math.round(((soloTotal - costPerPerson) / soloTotal) * 100) : 0;
    return {
      riderCount: n,
      totalCost,
      costPerPerson,
      sharedRideMultiplier: mult,
      savingsVsSolo,
      savingsPercentage,
    };
  });

  // 4. Driver earnings + bonus per rider count (DRIVER-SIDE ONLY)
  const driverEarningsByRiders = sharedRideOptions.map((opt) =>
    computeDriverEarningsLocal(opt.totalCost, tripDay, tripHour, opt.riderCount)
  );
  const driverEarnings =
    driverEarningsByRiders.find((d) => d.riderCount === 1) ||
    computeDriverEarningsLocal(soloTotal, tripDay, tripHour, 1);

  return {
    estimate: {
      low: Math.round(soloTotal * 0.9 * 100) / 100,
      mid: soloTotal,
      high: Math.round(soloTotal * 1.15 * 100) / 100,
    },
    breakdown: {
      baseFee,
      perMileRate: PER_MILE_RATE,
      perMinuteRate: PER_MINUTE_RATE,
      distanceCharge,
      timeCharge,
      subtotal,
      bookingFee,
      safetyFee,
      totalCost: soloTotal,
    },
    route: {
      distanceMiles,
      durationMinutes,
      source: routeSource,
      polyline,
    },
    sharedRideOptions,
    driverEarnings,
    driverEarningsByRiders,
    coordinates: {
      pickup: { lat: pickup.lat, lng: pickup.lng },
      dropoff: { lat: dropoff.lat, lng: dropoff.lng },
    },
  };
}

// ─── fetchFareEstimate ────────────────────────────────────────────────
// Wraps the same invoke+fallback pattern used inside FareEstimatorPage's
// useEffect (lines 360-414). Returns a single Promise<FareEstimate> instead
// of inline state-sets so callers (RiderDashboard, etc.) can consume the
// pipeline however they need.
//
// Always resolves (never rejects) — on any failure path the local fallback
// runs. If even the local fallback throws, this re-throws so the caller can
// decide how to surface the error.
export async function fetchFareEstimate(
  pickup: Location,
  dropoff: Location,
  tripDay: string,
  tripHour: number,
): Promise<FareEstimate> {
  // 0. Best-effort session refresh BEFORE invoking the Edge Function.
  // The browser was previously blocking the POST when a stale/expired
  // JWT caused the Functions-gateway to short-circuit the OPTIONS
  // preflight. Refreshing the token client-side (when one exists)
  // prevents that path. This is intentionally NON-BLOCKING — the
  // estimate-fare function itself does not require auth, so we
  // proceed with the invoke regardless of refresh outcome (the
  // client-side fallback below still covers any failure mode).
  try {
    await ensureFreshSession();
  } catch {
    /* non-blocking — fall through to invoke */
  }

  // 1. Try the estimate-fare Edge Function first (server-side canonical).
  try {
    const { data, error: invErr } = await supabase.functions.invoke('estimate-fare', {
      body: {
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        pickup_address: pickup.address,
        dropoff_address: dropoff.address,
        trip_day: tripDay,
        trip_hour: tripHour,
      },
    });

    if (!invErr && !(data as any)?.error && data) {
      return data as FareEstimate;
    }
    console.warn(
      'estimate-fare Edge Function unavailable — using client-side fallback.',
      invErr || (data as any)?.error
    );
  } catch (err) {
    console.warn('estimate-fare Edge Function threw — using client-side fallback.', err);
  }


  // 2. Client-side fallback: route via Mapbox + fare via shared pricing constants.
  return computeFareLocally(pickup, dropoff, tripDay, tripHour);
}
