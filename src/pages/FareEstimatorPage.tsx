import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  DollarIcon,
  MapPinIcon,
  NavigationIcon,
  ClockIcon,
  UsersIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  CalendarIcon,
  MoonIcon,
} from '@/components/ui/Icons';
import {
  formatCurrency,
  BASE_FEE,
  PER_MILE_RATE,
  PER_MINUTE_RATE,
  MINIMUM_FARE,
  EARNINGS_SPLIT,
  SHARED_RIDE_MULTIPLIERS,
} from '@/lib/pricing';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import { database as supabase } from '@/lib/database';
import { getMapboxToken } from '@/lib/mapboxToken';

// ─── Types (declared first so helpers can reference them) ────
interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface DriverEarningsBlock {
  riderCount?: number;
  driverBaseEarnings: number;
  bonus: number;
  bonusType: 'none' | 'weekend' | 'late_night';
  bonusLabel: string;
  totalDriverEarnings: number;
  tripDay?: string;
  tripHour?: number;
}

interface FareEstimate {
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
// Used when the estimate-fare Edge Function is unreachable (e.g. not yet
// deployed to the active Supabase project). Mirrors the server-side
// pricing logic using the constants from '@/lib/pricing' so the rider
// sees an identical breakdown either way.
const BOOKING_FEE = 1.50;
const SAFETY_FEE = 0.75;

// ─── Local Driver Bonus (mirrors server-side estimate-fare logic) ──
// Bonus applies to DRIVER EARNINGS ONLY — rider totalCost unchanged.
// Weekend overrides late-night (no stacking).
const DAYS_OF_WEEK_LIST = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

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

async function computeFareLocally(
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
    const mult = SHARED_RIDE_MULTIPLIERS[n] ?? 1.0;
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

// Note: DAYS_OF_WEEK_LIST above duplicates this for use outside the component.


const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;


const FareEstimatorPage: React.FC = () => {
  const navigate = useNavigate();
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [riders, setRiders] = useState<number>(1);
  const [fareData, setFareData] = useState<FareEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trip schedule state for driver bonus calculation
  const now = new Date();
  const [tripDay, setTripDay] = useState<string>(DAYS_OF_WEEK[now.getDay()]);
  const [tripHour, setTripHour] = useState<number>(now.getHours());

  // Derived data for the selected rider count
  const selectedShared = fareData?.sharedRideOptions.find((o) => o.riderCount === riders);

  // Safe fallback: prevents the result card from disappearing when
  // sharedRideOptions does not contain an entry matching the current
  // selected rider count (e.g. when the server returns a legacy shape).
  // Rider total still equals selectedShared.totalCost when available.
  const effectiveShared =
    selectedShared ??
    fareData?.sharedRideOptions?.[0] ?? {
      riderCount: riders,
      totalCost: fareData?.breakdown?.totalCost ?? 0,
      costPerPerson: fareData?.breakdown?.totalCost ?? 0,
      sharedRideMultiplier: 1,
      savingsVsSolo: 0,
      savingsPercentage: 0,
    };

  // Driver bonus computation
  const isWeekend = tripDay === 'Saturday' || tripDay === 'Sunday';
  const isLateNight = tripHour >= 0 && tripHour < 5; // 12:00 AM to 4:59 AM

  // Compute driver bonus for current selected rider count.
  // Prefer the server-returned driverEarningsByRiders block when present
  // (single source of truth). Falls back to local computation otherwise.
  const computeDriverBonus = (totalFare: number) => {
    // 1. Prefer server-side driverEarnings (matches selected rider count)
    const serverBlock =
      fareData?.driverEarningsByRiders?.find((d) => d.riderCount === riders) ||
      fareData?.driverEarnings;

    if (
      serverBlock &&
      serverBlock.tripDay === tripDay &&
      serverBlock.tripHour === tripHour
    ) {
      let mappedType: 'none' | 'weekend' | 'latenight' = 'none';
      if (serverBlock.bonusType === 'weekend') mappedType = 'weekend';
      else if (serverBlock.bonusType === 'late_night') mappedType = 'latenight';
      return {
        driverBaseEarnings: serverBlock.driverBaseEarnings,
        bonus: serverBlock.bonus,
        bonusType: mappedType,
        bonusLabel: serverBlock.bonusLabel,
        totalDriverEarnings: serverBlock.totalDriverEarnings,
      };
    }

    // 2. Local fallback (when server data is stale or missing) — uses
    //    the CURRENT tripDay/tripHour state so display is always live.
    const driverBaseEarnings =
      Math.round(totalFare * EARNINGS_SPLIT.DRIVER_PERCENTAGE * 100) / 100;

    let bonus = 0;
    let bonusType: 'none' | 'weekend' | 'latenight' = 'none';
    let bonusLabel = 'No Bonus';

    if (isWeekend) {
      bonus = Math.round(driverBaseEarnings * 0.05 * 100) / 100;
      bonusType = 'weekend';
      bonusLabel = 'Weekend Bonus (+5%)';
    } else if (isLateNight) {
      bonus = 0.50;
      bonusType = 'latenight';
      bonusLabel = 'Late Night Bonus (+$0.50)';
    }

    return {
      driverBaseEarnings,
      bonus,
      bonusType,
      bonusLabel,
      totalDriverEarnings: Math.round((driverBaseEarnings + bonus) * 100) / 100,
    };
  };

  // ─── AUTO-FETCH ESTIMATE WHEN BOTH ADDRESSES ARE SELECTED ───
  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) {
      return;
    }

    let cancelled = false;
    const fetchEstimate = async () => {
      setIsLoading(true);
      setError(null);

      // 1. Try the estimate-fare Edge Function first (preferred — keeps
      //    server-side as the single source of truth when available).
      try {
        const { data, error: invErr } = await supabase.functions.invoke('estimate-fare', {
          body: {
            pickup_lat: pickupLocation.lat,
            pickup_lng: pickupLocation.lng,
            dropoff_lat: dropoffLocation.lat,
            dropoff_lng: dropoffLocation.lng,
            pickup_address: pickupLocation.address,
            dropoff_address: dropoffLocation.address,
            // Send trip context so server computes driver bonus
            // against the rider's selected day/hour (NOT current UTC).
            trip_day: tripDay,
            trip_hour: tripHour,
          },
        });

        if (cancelled) return;

        if (!invErr && !data?.error && data) {
          setFareData(data as FareEstimate);
          setIsLoading(false);
          return;
        }
        // Fall through to local fallback on any Edge-Function error.
        console.warn(
          'estimate-fare Edge Function unavailable — using client-side fallback.',
          invErr || data?.error
        );
      } catch (err) {
        if (cancelled) return;
        console.warn('estimate-fare Edge Function threw — using client-side fallback.', err);
      }

      // 2. Client-side fallback: route via Mapbox Directions API +
      //    fare via shared pricing constants. Identical UI/data shape,
      //    including driverEarnings + driverEarningsByRiders.
      try {
        const localFare = await computeFareLocally(
          pickupLocation,
          dropoffLocation,
          tripDay,
          tripHour,
        );
        if (cancelled) return;
        setFareData(localFare);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Fare estimate (local fallback) error:', err);
        setError(err?.message || 'Unable to estimate fare. Please try again.');
        setFareData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };


    fetchEstimate();

    return () => {
      cancelled = true;
    };
  }, [pickupLocation, dropoffLocation, tripDay, tripHour]);


  const handleReset = () => {
    setPickupText('');
    setDropoffText('');
    setPickupLocation(null);
    setDropoffLocation(null);
    setRiders(1);
    setFareData(null);
    setError(null);
    const resetNow = new Date();
    setTripDay(DAYS_OF_WEEK[resetNow.getDay()]);
    setTripHour(resetNow.getHours());
  };

  // Format hour for display (e.g., 0 → "12:00 AM", 13 → "1:00 PM")
  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:00 ${period}`;
  };

  // Compute bonus for the current result.
  // Uses effectiveShared.totalCost so driverBonusData is never null
  // when fareData exists — keeps the result card render-gate satisfied
  // even if sharedRideOptions lacks an entry for the selected rider count.
  const driverBonusData = fareData ? computeDriverBonus(effectiveShared.totalCost) : null;
  const showResult = !!fareData;


  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <span className="text-3xl font-bold text-gray-900">
                sit<span className="text-orange-600">N</span>ride
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="pt-24 pb-10 lg:pt-28 lg:pb-12 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-5">
            <DollarIcon className="text-orange-600" size={16} />
            <span className="text-sm font-medium text-orange-800">Fare Estimator</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Estimate Your <span className="text-orange-600">Ride Fare</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
            Enter your pickup and dropoff addresses for an upfront fare estimate. No surprises, no
            surge pricing — just transparent, community-friendly rates.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Estimator Form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-1">
                    <MapPinIcon className="text-white" size={24} />
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Trip Details</h2>
                  </div>
                  <div className="text-orange-100 text-sm sm:text-base space-y-2">
                    <p className="font-semibold text-white">Enter your information in this order:</p>
                    <ol className="list-decimal list-inside space-y-1 pl-1">
                      <li>Select the number of passengers</li>
                      <li>Select the trip day and time</li>
                      <li>Select the pickup location from the dropdown list</li>
                      <li>Select the destination from the dropdown list</li>
                    </ol>
                    <p className="pt-1">
                      Your fare estimate, distance, travel time, and shared ride pricing will then calculate automatically.

                    </p>
                  </div>

                </div>

                <div className="p-6 sm:p-8">
                  <div className="space-y-6">
                    <p className="text-sm text-gray-500 italic">
                      Enter pickup and drop-off locations to estimate your trip.
                    </p>

                    <div>
                      <label className="text-gray-700 font-medium flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <MapPinIcon className="text-green-600" size={14} />
                        </div>
                        Pickup Address
                      </label>
                      <AddressAutocomplete
                        value={pickupText}
                        onChange={(val) => {
                          setPickupText(val);
                          if (pickupLocation && val !== pickupLocation.address) {
                            setPickupLocation(null);
                            setFareData(null);
                          }
                        }}
                        onLocationSelect={(loc) => {
                          setPickupLocation(loc);
                          setPickupText(loc.address);
                        }}
                        placeholder="Enter pickup address"
                        icon="pickup"
                      />
                      {pickupLocation && (
                        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                          <CheckCircleIcon size={12} />
                          Address confirmed
                        </p>
                      )}
                    </div>

                    {/* Dropoff Address */}
                    <div>
                      <label className="text-gray-700 font-medium flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <NavigationIcon className="text-red-600" size={14} />
                        </div>
                        Dropoff Address
                      </label>
                      <AddressAutocomplete
                        value={dropoffText}
                        onChange={(val) => {
                          setDropoffText(val);
                          if (dropoffLocation && val !== dropoffLocation.address) {
                            setDropoffLocation(null);
                            setFareData(null);
                          }
                        }}
                        onLocationSelect={(loc) => {
                          setDropoffLocation(loc);
                          setDropoffText(loc.address);
                        }}
                        placeholder="Enter dropoff address"
                        icon="dropoff"
                      />
                      {dropoffLocation && (
                        <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                          <CheckCircleIcon size={12} />
                          Address confirmed
                        </p>
                      )}
                    </div>

                    {/* Auto-calculated route info */}
                    {fareData && (
                      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <NavigationIcon className="text-blue-600 flex-shrink-0" size={18} />
                        <div className="text-sm text-blue-900">
                          <p className="font-semibold">Route auto-calculated</p>
                          <p className="text-blue-700 mt-0.5">
                            {fareData.route.distanceMiles} miles &middot; ~{fareData.route.durationMinutes} min drive time
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Riders */}
                    <div>
                      <label className="text-gray-700 font-medium flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                          <UsersIcon className="text-purple-600" size={14} />
                        </div>
                        Number of Riders
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRiders(n)}
                            className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                              riders === n
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {n} {n === 1 ? 'Rider' : 'Riders'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Trip Schedule — for driver bonus calculation */}
                    <div>
                      <label className="text-gray-700 font-medium flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                          <CalendarIcon className="text-indigo-600" size={14} />
                        </div>
                        Trip Day &amp; Time
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Select the day and time of your trip to see if driver bonuses apply.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Day selector */}
                        <div>
                          <label className="text-xs text-gray-500 font-medium mb-1 block">Day of Week</label>
                          <select
                            value={tripDay}
                            onChange={(e) => setTripDay(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                          >
                            {DAYS_OF_WEEK.map((day) => (
                              <option key={day} value={day}>
                                {day}{day === 'Saturday' || day === 'Sunday' ? ' (Weekend)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Hour selector */}
                        <div>
                          <label className="text-xs text-gray-500 font-medium mb-1 block">Trip Time</label>
                          <select
                            value={tripHour}
                            onChange={(e) => setTripHour(parseInt(e.target.value, 10))}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {formatHour(i)}{i >= 0 && i < 5 ? ' (Late Night)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Live bonus indicator */}
                      {(isWeekend || isLateNight) && (
                        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                          isWeekend
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          <MoonIcon size={14} />
                          {isWeekend
                            ? 'Weekend Bonus (+5%) will apply to driver earnings'
                            : 'Late Night Bonus (+$0.50) will apply to driver earnings'}
                        </div>
                      )}
                    </div>

                    {/* Loading */}
                    {isLoading && (
                      <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                        <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-orange-800 font-medium">
                          Calculating route and fare...
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {error && (
                      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircleIcon className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    )}

                    {/* Helper hints */}
                    {(!pickupLocation || !dropoffLocation) && !isLoading && (
                      <p className="text-xs text-gray-400 text-center">
                        Select both pickup and dropoff addresses to automatically estimate your fare.
                      </p>
                    )}

                    {showResult && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleReset}
                          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Result Card */}
              {showResult && fareData && effectiveShared && driverBonusData && (

                <div className="mt-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 sm:p-8">
                    <h3 className="text-xl font-bold text-white">Your Estimated Fare</h3>
                    <p className="text-green-100 text-sm mt-1">
                      {fareData.route.distanceMiles} miles &middot; ~
                      {fareData.route.durationMinutes} min &middot; {riders}{' '}
                      {riders === 1 ? 'rider' : 'riders'}
                      {' '}&middot; {tripDay} at {formatHour(tripHour)}
                    </p>
                  </div>

                  <div className="p-6 sm:p-8 space-y-6">
                    {/* Total */}
                    <div className="text-center">
                      <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">
                        Estimated Total
                      </p>
                      <p className="text-5xl font-bold text-gray-900 mt-1">
                        {formatCurrency(effectiveShared.totalCost)}
                      </p>
                      {riders > 1 && (
                        <p className="text-lg text-orange-600 font-semibold mt-2">
                          {formatCurrency(effectiveShared.costPerPerson)} per person
                        </p>
                      )}
                    </div>

                    {/* Fare Range */}
                    {riders === 1 && (
                      <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                        <span>Low: {formatCurrency(fareData.estimate.low)}</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-semibold text-gray-700">
                          Est: {formatCurrency(fareData.estimate.mid)}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>High: {formatCurrency(fareData.estimate.high)}</span>
                      </div>
                    )}

                    {/* Fare Breakdown */}
                    <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                      <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">
                        Fare Breakdown
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Base Fee</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(fareData.breakdown.baseFee)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          Distance ({fareData.route.distanceMiles} mi x $
                          {fareData.breakdown.perMileRate.toFixed(2)})
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(fareData.breakdown.distanceCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          Time ({fareData.route.durationMinutes} min x $
                          {fareData.breakdown.perMinuteRate.toFixed(2)})
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(fareData.breakdown.timeCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Booking Fee</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(fareData.breakdown.bookingFee)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Safety Fee</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(fareData.breakdown.safetyFee)}
                        </span>
                      </div>
                      {riders > 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            Shared Ride ({riders} riders, {effectiveShared.sharedRideMultiplier}x)
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(
                              effectiveShared.totalCost - fareData.breakdown.totalCost
                            )}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-3 flex justify-between font-semibold">
                        <span className="text-gray-900">Total</span>
                        <span className="text-gray-900">
                          {formatCurrency(effectiveShared.totalCost)}
                        </span>
                      </div>
                    </div>


                    {/* Driver Earnings Breakdown */}
                    <div className="bg-amber-50 rounded-xl p-5 space-y-3 border border-amber-200">
                      <p className="text-xs uppercase tracking-wider text-amber-600 font-medium mb-3 flex items-center gap-2">
                        <DollarIcon size={14} className="text-amber-600" />
                        Driver Earnings Breakdown
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          Driver Base Earnings ({Math.round(EARNINGS_SPLIT.DRIVER_PERCENTAGE * 100)}%)
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(driverBonusData.driverBaseEarnings)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={`${driverBonusData.bonus > 0 ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                          Driver Bonus
                          {driverBonusData.bonus > 0 && (
                            <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              {driverBonusData.bonusLabel}
                            </span>
                          )}
                        </span>
                        <span className={`font-medium ${driverBonusData.bonus > 0 ? 'text-green-700' : 'text-gray-900'}`}>
                          {driverBonusData.bonus > 0 ? '+' : ''}{formatCurrency(driverBonusData.bonus)}
                        </span>
                      </div>
                      <div className="border-t border-amber-300 pt-3 flex justify-between font-semibold">
                        <span className="text-gray-900">Total Driver Earnings</span>
                        <span className="text-gray-900">
                          {formatCurrency(driverBonusData.totalDriverEarnings)}
                        </span>
                      </div>
                    </div>

                    {/* Bonus explanation text */}
                    <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <MoonIcon className="text-indigo-600 flex-shrink-0 mt-0.5" size={18} />
                      <div className="text-sm text-indigo-800">
                        <p className="font-semibold mb-1">Driver Bonus Policy</p>
                        <p>
                          Weekend bonuses apply during both day and nighttime hours. If drivers choose
                          to drive both day and night hours, bonuses will apply to daytime hours only.
                        </p>
                      </div>
                    </div>

                    {/* Route info badge */}
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <ClockIcon className="text-blue-600 flex-shrink-0" size={18} />
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">
                          {fareData.route.distanceMiles} miles
                        </span>{' '}
                        &middot; Estimated drive time{' '}
                        <span className="font-semibold">
                          {fareData.route.durationMinutes} min
                        </span>
                      </p>
                    </div>

                    {/* Savings badge */}
                    {riders > 1 && selectedShared && selectedShared.savingsVsSolo > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <CheckCircleIcon className="text-green-600 flex-shrink-0" size={20} />
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">
                            You save {formatCurrency(selectedShared.savingsVsSolo)} per person
                          </span>{' '}
                          ({selectedShared.savingsPercentage}% less than riding solo) by sharing
                          this ride.
                        </p>
                      </div>
                    )}


                    {/* Shared Ride Comparison Table */}
                    {fareData.sharedRideOptions.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">
                          Compare Shared Ride Options
                        </p>
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-3 text-left font-medium text-gray-600">
                                  Riders
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">
                                  Total
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">
                                  Per Person
                                </th>
                                <th className="px-4 py-3 text-right font-medium text-gray-600">
                                  Savings
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {fareData.sharedRideOptions.map((row) => (
                                <tr
                                  key={row.riderCount}
                                  className={`border-t ${
                                    row.riderCount === riders ? 'bg-orange-50' : ''
                                  }`}
                                >
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    {row.riderCount}{' '}
                                    {row.riderCount === 1 ? 'Rider' : 'Riders'}
                                    {row.riderCount === riders && (
                                      <span className="ml-2 text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">
                                        Selected
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    {formatCurrency(row.totalCost)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                                    {formatCurrency(row.costPerPerson)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {row.savingsPercentage > 0 ? (
                                      <span className="text-green-600 font-medium">
                                        {row.savingsPercentage}% off
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">&mdash;</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Driver earnings note below total */}
                    <p className="text-xs text-gray-500 text-center italic pt-2 border-t border-gray-100">
                      Driver earnings may include bonus incentives depending on time and day.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar — Rate Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarIcon className="text-orange-600" size={18} />
                  sitNride Rates
                </h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between">
                    <span className="text-gray-600">Base Fee</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(BASE_FEE)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-600">Per Mile</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(PER_MILE_RATE)}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-gray-600">Per Minute</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(PER_MINUTE_RATE)}
                    </span>
                  </li>
                  <li className="flex justify-between border-t pt-3">
                    <span className="text-gray-600">Minimum Fare</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(MINIMUM_FARE)}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
                <h3 className="font-semibold text-gray-900 mb-3">No Surge Pricing</h3>
                <p className="text-sm text-gray-600">
                  sitNride does not use surge pricing. The fare you see here is the fare you pay —
                  no surprises during peak hours or bad weather.
                </p>
              </div>

              <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <UsersIcon className="text-green-600" size={18} />
                  Save with Shared Rides
                </h3>
                <p className="text-sm text-gray-600">
                  Riding with others? Shared rides split the cost so everyone pays less. Select 2–4
                  riders above to see per-person pricing.
                </p>
              </div>

              {/* Driver Bonus Info Card */}
              <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MoonIcon className="text-indigo-600" size={18} />
                  Driver Bonuses
                </h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-indigo-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ClockIcon className="text-indigo-700" size={10} />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Late Night Bonus</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        +$0.50 added to driver earnings for trips between 12:00 AM – 5:00 AM (weekdays only)
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-purple-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CalendarIcon className="text-purple-700" size={10} />
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Weekend Bonus</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        +5% added to driver earnings for trips on Saturday or Sunday (all hours)
                      </p>
                    </div>
                  </li>
                </ul>
                <div className="mt-4 pt-3 border-t border-indigo-200">
                  <p className="text-xs text-indigo-700 font-medium">
                    Priority Rule: If both conditions apply, only the Weekend Bonus is applied.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">Ready to Ride?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create a free account to request your first ride with a verified local driver.
                </p>

                <button
                  onClick={() => {
                    // PHASE 1: Pass estimator selections via URL params so the
                    // rider booking flow can later inherit them. If no estimate
                    // has been calculated yet, fall back to the original
                    // signup-only navigation (preserves existing behavior).
                    const params = new URLSearchParams();
                    params.set('action', 'rider-signup');

                    if (
                      fareData &&
                      selectedShared &&
                      pickupLocation &&
                      dropoffLocation
                    ) {
                      params.set('riders', String(riders));
                      params.set('pickup', pickupLocation.address);
                      params.set('pickup_lat', String(pickupLocation.lat));
                      params.set('pickup_lng', String(pickupLocation.lng));
                      params.set('dropoff', dropoffLocation.address);
                      params.set('dropoff_lat', String(dropoffLocation.lat));
                      params.set('dropoff_lng', String(dropoffLocation.lng));
                      params.set('distance', String(fareData.route.distanceMiles));
                      params.set('duration', String(fareData.route.durationMinutes));
                      params.set('total', String(selectedShared.totalCost));
                      params.set('per_person', String(selectedShared.costPerPerson));
                      params.set(
                        'shared_multiplier',
                        String(selectedShared.sharedRideMultiplier)
                      );
                      params.set('trip_day', tripDay);
                      params.set('trip_hour', String(tripHour));
                    }

                    navigate(`/?${params.toString()}`);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
                >
                  Get Started
                  <ArrowRightIcon size={16} />
                </button>
              </div>


            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-white">
                sit<span className="text-orange-400">N</span>ride
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms of Use
              </Link>
              <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-center text-gray-500 text-xs">
              &copy; 2026 sitNride. All rights reserved. Operated by Digital Media Connect Pro LLC.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default FareEstimatorPage;
