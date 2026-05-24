// sitNride Pricing Engine
// Section 2A: Ride Price Calculator

// ─── Base Rates ───────────────────────────────────────────────
export const BASE_FEE = 2.50;
export const PER_MILE_RATE = 1.50;
export const PER_MINUTE_RATE = 0.25;
export const MINIMUM_FARE = 5.00;

// ─── Shared Ride Multipliers ──────────────────────────────────
export const SHARED_RIDE_MULTIPLIERS: Record<number, number> = {
  1: 1.00,
  2: 1.10,
  3: 1.15,
  4: 1.20,
};

// ─── Surge Pricing Constants ──────────────────────────────────
export const MIN_SURGE = 1.0;
export const MAX_SURGE = 2.5;

export type SurgeLevel = 'none' | 'low' | 'medium' | 'high' | 'extreme';

export interface SurgeData {
  surge_multiplier: number;
  surge_level: SurgeLevel;
  surge_zone_id: string | null;
  surge_zone_name: string | null;
  active_requests: number;
  available_drivers: number;
  message: string;
}

export const SURGE_LEVEL_CONFIG: Record<SurgeLevel, { label: string; color: string; bgColor: string; borderColor: string; description: string }> = {
  none:    { label: 'Normal',   color: 'text-green-700',  bgColor: 'bg-green-50',   borderColor: 'border-green-200', description: 'Standard pricing' },
  low:     { label: 'Busy',     color: 'text-yellow-700', bgColor: 'bg-yellow-50',  borderColor: 'border-yellow-200', description: 'Slightly higher demand' },
  medium:  { label: 'Very Busy', color: 'text-orange-700', bgColor: 'bg-orange-50',  borderColor: 'border-orange-200', description: 'High demand in your area' },
  high:    { label: 'Peak',     color: 'text-red-700',    bgColor: 'bg-red-50',     borderColor: 'border-red-200', description: 'Very high demand' },
  extreme: { label: 'Extreme',  color: 'text-red-900',    bgColor: 'bg-red-100',    borderColor: 'border-red-300', description: 'Maximum demand pricing' },
};

// ─── Earnings Split (Internal) ────────────────────────────────
export const EARNINGS_SPLIT = {
  DRIVER_PERCENTAGE: 0.75,
  PLATFORM_PERCENTAGE: 0.25,
};

// ─── Pricing Result Interface ─────────────────────────────────
export interface PricingResult {
  baseFee: number;
  distanceCharge: number;
  timeCharge: number;
  subtotal: number;
  sharedRideMultiplier: number;
  surgeMultiplier: number;
  surgeAmount: number;
  totalCost: number;
  costPerPerson: number;
  riderCount: number;
  distanceMiles: number;
  durationMinutes: number;
  savingsPerPerson?: number;
  savingsPercentage?: number;
}

export interface EarningsSplit {
  totalFare: number;
  driverEarnings: number;
  platformFee: number;
}

// ─── Calculate Ride Price (with surge support) ────────────────
export function calculateRidePrice(
  distanceMiles: number,
  durationMinutes: number,
  riderCount: number = 1,
  surgeMultiplier: number = 1.0
): PricingResult {
  const clampedRiders = Math.max(1, Math.min(4, Math.round(riderCount)));
  const clampedSurge = Math.max(MIN_SURGE, Math.min(MAX_SURGE, surgeMultiplier));

  const baseFee = BASE_FEE;
  const distanceCharge = distanceMiles * PER_MILE_RATE;
  const timeCharge = durationMinutes * PER_MINUTE_RATE;
  const subtotal = baseFee + distanceCharge + timeCharge;

  const sharedRideMultiplier = SHARED_RIDE_MULTIPLIERS[clampedRiders] || 1.0;

  // Apply shared ride multiplier first, then surge
  const afterShared = subtotal * sharedRideMultiplier;
  const afterSurge = afterShared * clampedSurge;
  const surgeAmount = afterSurge - afterShared;

  const totalCost = Math.max(MINIMUM_FARE, Math.round(afterSurge * 100) / 100);
  const costPerPerson = Math.round((totalCost / clampedRiders) * 100) / 100;

  // Calculate savings compared to riding solo (without surge for fair comparison)
  const soloTotal = Math.max(MINIMUM_FARE, Math.round((subtotal * clampedSurge) * 100) / 100);
  const savingsPerPerson = clampedRiders > 1
    ? Math.round((soloTotal - costPerPerson) * 100) / 100
    : undefined;
  const savingsPercentage = clampedRiders > 1
    ? Math.round(((soloTotal - costPerPerson) / soloTotal) * 100)
    : undefined;

  return {
    baseFee,
    distanceCharge: Math.round(distanceCharge * 100) / 100,
    timeCharge: Math.round(timeCharge * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    sharedRideMultiplier,
    surgeMultiplier: clampedSurge,
    surgeAmount: Math.round(surgeAmount * 100) / 100,
    totalCost,
    costPerPerson,
    riderCount: clampedRiders,
    distanceMiles,
    durationMinutes,
    savingsPerPerson,
    savingsPercentage,
  };
}

// ─── Calculate Earnings Split ─────────────────────────────────
export function calculateEarningsSplit(totalFare: number): EarningsSplit {
  const driverEarnings = Math.round(totalFare * EARNINGS_SPLIT.DRIVER_PERCENTAGE * 100) / 100;
  const platformFee = Math.round(totalFare * EARNINGS_SPLIT.PLATFORM_PERCENTAGE * 100) / 100;
  return { totalFare, driverEarnings, platformFee };
}


// ─── Driver Bonus Constants ───────────────────────────────────
export const DRIVER_BONUS_RATES = {
  LATE_NIGHT_FLAT: 0.50,          // +$0.50 flat bonus
  WEEKEND_PERCENTAGE: 0.05,       // +5% of driver base earnings
  LATE_NIGHT_START_HOUR: 0,       // 12:00 AM
  LATE_NIGHT_END_HOUR: 5,         // 5:00 AM (exclusive — covers 0,1,2,3,4)
};

export type DriverBonusType = 'none' | 'late_night' | 'weekend';

export interface DriverBonusResult {
  bonusAmount: number;
  bonusType: DriverBonusType;
  bonusLabel: string;
}

// ─── Calculate Driver Bonus ───────────────────────────────────
// Computes bonus based on the time and day of ride completion.
// Priority rule: if both late-night AND weekend apply, only the
// weekend bonus is used (they do NOT stack).
export function calculateDriverBonus(
  driverBaseEarnings: number,
  completedAt: Date
): DriverBonusResult {
  const hour = completedAt.getHours();
  const dayOfWeek = completedAt.getDay(); // 0 = Sunday, 6 = Saturday

  const isLateNight =
    hour >= DRIVER_BONUS_RATES.LATE_NIGHT_START_HOUR &&
    hour < DRIVER_BONUS_RATES.LATE_NIGHT_END_HOUR;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Priority rule: weekend bonus takes precedence over late-night
  if (isWeekend) {
    const bonusAmount =
      Math.round(driverBaseEarnings * DRIVER_BONUS_RATES.WEEKEND_PERCENTAGE * 100) / 100;
    return {
      bonusAmount,
      bonusType: 'weekend',
      bonusLabel: 'Weekend Bonus (+5%)',
    };
  }

  if (isLateNight) {
    return {
      bonusAmount: DRIVER_BONUS_RATES.LATE_NIGHT_FLAT,
      bonusType: 'late_night',
      bonusLabel: 'Late Night Bonus (+$0.50)',
    };
  }

  return {
    bonusAmount: 0,
    bonusType: 'none',
    bonusLabel: 'No Bonus',
  };
}

// ─── Format Currency ──────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ─── Rider Count Label ────────────────────────────────────────
export function getRiderLabel(count: number): string {
  if (count === 1) return 'Solo Ride';
  return `${count} Riders`;
}

// ─── Generate Pricing Comparison ──────────────────────────────
export function generatePricingComparison(
  distanceMiles: number,
  durationMinutes: number,
  surgeMultiplier: number = 1.0
): PricingResult[] {
  return [1, 2, 3, 4].map((count) =>
    calculateRidePrice(distanceMiles, durationMinutes, count, surgeMultiplier)
  );
}
