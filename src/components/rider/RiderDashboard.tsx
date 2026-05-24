// DO NOT AUTO-GENERATE OR MODIFY THIS FILE
import React, { useState, useEffect, useMemo, useRef } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { Ride } from '@/types';
import MapboxMap from '@/components/map/MapboxMap';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import PaymentMethodsPage from '@/components/rider/PaymentMethodsPage';
import RideRatingModal from '@/components/rider/RideRatingModal';
import RideHistoryPage from '@/components/rider/RideHistoryPage';
import { getMapboxToken } from '@/lib/mapboxToken';

import {
  MapPinIcon, NavigationIcon, DollarIcon, CarIcon,
  ClockIcon, CheckCircleIcon, PhoneIcon,
  ShieldIcon, StarIcon, RefreshIcon, CreditCardIcon, ChevronRightIcon,
  HistoryIcon, AlertTriangleIcon
} from '@/components/ui/Icons';
import {
  getSupportSmsHref,
  getSupportTelHref,
  buildLiveLocationLink,
  logEmergencyEvent,
} from '@/lib/support';
// ─── UNIFIED PRICING (canonical) ─────────────────────────────────────────
// Single source of truth for pricing constants + the shared estimate-fare
// pipeline. This replaces the old local BASE_FEE / PER_MILE_RATE constants
// that previously diverged from FareEstimatorPage.
import {
  BASE_FEE,
  PER_MILE_RATE,
  EARNINGS_SPLIT,
  formatCurrency,
} from '@/lib/pricing';
import { fetchFareEstimate, type FareEstimate } from '@/lib/fareEstimate';


const DRIVER_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917236846_e9595ad9.png',
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917239150_864a59f1.jpg',
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917256905_eb50f437.png',
];

// NOTE: local BASE_FEE / PER_MILE_RATE constants intentionally removed —
// now sourced from '@/lib/pricing' (imported above) so RiderDashboard uses
// the SAME canonical values as FareEstimatorPage.

// ─────────────────────────────────────────────────────────────────────────────
// PRICING PERSISTENCE STABILIZATION (DO NOT REMOVE)
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight localStorage backup for estimator pricing state. This protects
// against:
//   • React state being reset between Route Calculation → Confirm Ride
//   • Page refresh / navigation losing in-memory estimator values
//   • estimated_total reaching the rides insert as null/0/undefined
//     (which previously caused "null value in column estimated_total
//     violates not-null constraint" errors)
//
// This DOES NOT change pricing formulas, Mapbox, Stripe, or any backend logic.
// It only mirrors the already-calculated values so they survive remounts.
const PRICING_PERSIST_KEY = 'sitnride.pricing.snapshot.v1';

interface PricingSnapshot {
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedTotal: number;
  showPricing: boolean;
  savedAt: number;
}

function loadPricingSnapshot(): PricingSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    var raw = window.localStorage.getItem(PRICING_PERSIST_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Expire snapshots older than 1 hour to avoid stale pricing.
    if (!parsed.savedAt || (Date.now() - parsed.savedAt) > 60 * 60 * 1000) {
      window.localStorage.removeItem(PRICING_PERSIST_KEY);
      return null;
    }
    return parsed as PricingSnapshot;
  } catch {
    return null;
  }
}

function savePricingSnapshot(snap: Omit<PricingSnapshot, 'savedAt'>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    var payload: PricingSnapshot = {
      estimatedDistance: snap.estimatedDistance,
      estimatedDuration: snap.estimatedDuration,
      estimatedTotal: snap.estimatedTotal,
      showPricing: snap.showPricing,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(PRICING_PERSIST_KEY, JSON.stringify(payload));
  } catch {
    // Quota / privacy-mode failures are non-fatal.
  }
}

function clearPricingSnapshot(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(PRICING_PERSIST_KEY);
  } catch {
    // ignore
  }
}



interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface SafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  rideStatus?: string;
  // Rider's relevant location for support — typically the ride's pickup point.
  riderLocation?: { lat: number; lng: number } | null;
  // ── Emergency-event logging context ──
  // user.id + currentRide.id are written into the emergency_events row.
  user?: { id?: string | null } | null;
  currentRide?: { id?: string | null } | null;
  onReportSubmit: (type: string, description: string) => void;
}

function SafetyModal(props: SafetyModalProps) {
  var isOpen = props.isOpen;
  var onClose = props.onClose;
  var onReportSubmit = props.onReportSubmit;
  var rideId = props.rideId;
  var rideStatus = props.rideStatus;
  var riderLocation = props.riderLocation;
  var user = props.user;
  var currentRide = props.currentRide;

  var [reportType, setReportType] = useState('');
  var [description, setDescription] = useState('');

  if (!isOpen) return null;

  // ── 911 emergency call ──
  // Logs the event BEFORE switching to the dialer so we don't lose the
  // record if the OS hands off to the phone app. Logging is fire-and-forget
  // — never await, never block, never throw.
  function handleEmergency() {
    void logEmergencyEvent({
      supabase: supabase,
      role: 'rider',
      eventType: 'call_911',
      currentRide: currentRide,
      user: user,
      riderLocation: riderLocation,
    });
    window.location.href = 'tel:911';
  }

  // ── Support SMS with live location (uses shared support config) ──
  function handleSupportSms() {
    var lat = riderLocation && riderLocation.lat;
    var lng = riderLocation && riderLocation.lng;
    var mapsLink = buildLiveLocationLink(lat, lng);

    var message =
      'EMERGENCY: Rider needs support\n' +
      'Ride ID: ' + (rideId || 'N/A') + '\n' +
      'Status: ' + (rideStatus || 'N/A') + '\n' +
      '\n' +
      'Live Location:\n' +
      mapsLink;

    void logEmergencyEvent({
      supabase: supabase,
      role: 'rider',
      eventType: 'sms_support',
      currentRide: currentRide,
      user: user,
      riderLocation: riderLocation,
      message: message,
    });

    window.location.href = getSupportSmsHref(message);
  }

  // ── Direct call to support (uses shared support config) ──
  function handleSupportCall() {
    void logEmergencyEvent({
      supabase: supabase,
      role: 'rider',
      eventType: 'call_support',
      currentRide: currentRide,
      user: user,
      riderLocation: riderLocation,
    });
    window.location.href = getSupportTelHref();
  }

  function handleSubmitReport() {
    if (reportType && description) {
      onReportSubmit(reportType, description);
      onClose();
    }
  }


  var hasLocation = !!(riderLocation && riderLocation.lat && riderLocation.lng);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="bg-red-600 p-6 text-white text-center">
          <ShieldIcon className="mx-auto" size={40} />
          <h2 className="mt-2 text-2xl font-bold">Safety Center</h2>
          <p className="text-red-100 text-sm mt-1">Get help or report an issue</p>
        </div>

        <div className="p-6 space-y-4">
          <button
            onClick={handleEmergency}
            className="w-full py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
          >
            <PhoneIcon size={20} /> Call 911 Emergency
          </button>

          {/* ── Contact Support: SMS with live location + Call ── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSupportSms}
              className="py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
              title="Send SMS to support with your live location"
            >
              <AlertTriangleIcon size={18} /> Text Support
            </button>
            <button
              onClick={handleSupportCall}
              className="py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-900 transition-all flex items-center justify-center gap-2"
              title="Call support"
            >
              <PhoneIcon size={18} /> Call Support
            </button>
          </div>

          {/* Live location preview shown to rider before sending */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <MapPinIcon className="text-gray-500" size={14} />
              <span className="font-semibold text-gray-700">Live Location for Support</span>
            </div>
            {hasLocation ? (
              <>
                <p className="tabular-nums">
                  {riderLocation!.lat.toFixed(5)}, {riderLocation!.lng.toFixed(5)}
                </p>
                <a
                  href={'https://maps.google.com/?q=' + riderLocation!.lat + ',' + riderLocation!.lng}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 underline break-all"
                >
                  https://maps.google.com/?q={riderLocation!.lat},{riderLocation!.lng}
                </a>
                <p className="text-gray-500 mt-1">
                  This link will be included automatically in your support text.
                </p>
              </>
            ) : (
              <p className="text-amber-700">
                Location unavailable — set a pickup location to share it with support.
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Report an Issue</h3>

            <div className="space-y-2 mb-4">
              {['safety', 'behavior', 'vehicle', 'other'].map(function(type) {
                return (
                  <button
                    key={type}
                    onClick={function() { setReportType(type); }}
                    className={'w-full p-3 rounded-xl border-2 text-left transition-all ' + (
                      reportType === type
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <span className="capitalize font-medium">{type} Issue</span>
                  </button>
                );
              })}
            </div>

            {reportType && (
              <div className="space-y-3">
                <textarea
                  value={description}
                  onChange={function(e) { setDescription(e.target.value); }}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <button
                  onClick={handleSubmitReport}
                  disabled={!description}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-all disabled:bg-gray-300"
                >
                  Submit Report
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


function RiderDashboard() {
  var auth = useAuth();
  var user = auth.user;
  var riderProfile = auth.riderProfile;
  var logout = auth.logout;

  var [pickupText, setPickupText] = useState('');
  var [dropoffText, setDropoffText] = useState('');
  var [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  var [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  var [estimatedDistance, setEstimatedDistance] = useState(0);
  var [estimatedDuration, setEstimatedDuration] = useState(0);
  var [estimatedTotal, setEstimatedTotal] = useState(0);
  var [showPricing, setShowPricing] = useState(false);
  var [currentRide, setCurrentRide] = useState<Ride | null>(null);
  var [isBooking, setIsBooking] = useState(false);
  var [showSafety, setShowSafety] = useState(false);
  var [driverInfo, setDriverInfo] = useState<any>(null);
  var [driverLocation, setDriverLocation] = useState<Location | null>(null);
  var [paymentError, setPaymentError] = useState<string | null>(null);
  var [showPaymentMethods, setShowPaymentMethods] = useState(false);
  var [showRideHistory, setShowRideHistory] = useState(false);
  var [showRatingModal, setShowRatingModal] = useState(false);
  var [completedRideForRating, setCompletedRideForRating] = useState<Ride | null>(null);
  var [completedDriverInfo, setCompletedDriverInfo] = useState<any>(null);

  // ─── UNIFIED FARE DATA ────────────────────────────────────────────────
  // Full FareEstimate object (route + breakdown + sharedRideOptions +
  // driverEarnings). Sourced from the SAME `estimate-fare` Edge Function
  // pipeline FareEstimatorPage uses (see fetchFareEstimate). Null until
  // the first successful estimate after a route is calculated.
  var [fareData, setFareData] = useState<FareEstimate | null>(null);
  var [isEstimating, setIsEstimating] = useState<boolean>(false);


  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Shared-ride / estimator-transfer state
  // ─────────────────────────────────────────────────────────────────────────
  // These values are *received* from FareEstimatorPage via URL parameters and
  // *preserved* here for display + (future) Phase 3 booking-flow use.
  //
  // IMPORTANT: Phase 2 only READS and STORES these values. It does NOT:
  //   • modify handleBookRide()
  //   • modify the rides insert payload
  //   • modify pricing formulas (BASE_FEE / PER_MILE_RATE / handleRouteCalculated)
  //   • modify Stripe pre-authorization
  //   • touch Mapbox, AddressAutocomplete, or getMapboxToken()
  //
  // If no URL params exist, every value below stays at its default and the
  // dashboard behaves exactly as before (full backward compatibility).
  var [riderCount, setRiderCount] = useState<number>(1);
  var [sharedMultiplier, setSharedMultiplier] = useState<number>(1);
  var [costPerPerson, setCostPerPerson] = useState<number>(0);
  var [estimatorHydrated, setEstimatorHydrated] = useState<boolean>(false);
  // One-shot guard so a re-render / state change never re-applies URL params
  // (prevents fighting with loadCurrentRide() or user edits).
  var hydratedFromUrlRef = useRef<boolean>(false);

  var driverImage = useMemo(function() {
    return DRIVER_IMAGES[Math.floor(Math.random() * DRIVER_IMAGES.length)];
  }, [driverInfo?.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: One-shot URL-param hydration
  // ─────────────────────────────────────────────────────────────────────────
  // Reads params written by FareEstimatorPage's "Get Started" button:
  //   riders, pickup, pickup_lat, pickup_lng,
  //   dropoff, dropoff_lat, dropoff_lng,
  //   distance, duration, total, per_person, shared_multiplier
  //
  // Behavior:
  //   • Runs once, guarded by hydratedFromUrlRef.
  //   • Silently no-ops if any required geo field is missing/invalid.
  //   • Does NOT touch the URL (no history.replaceState) — Phase 2 keeps the
  //     surface area minimal. URL cleanup can be added in a later phase.
  //   • Does NOT call handleBookRide or any Stripe/Supabase function.
  useEffect(function() {
    if (hydratedFromUrlRef.current) return;
    if (typeof window === 'undefined') return;

    try {
      var params = new URLSearchParams(window.location.search);
      if (!params || params.toString() === '') {
        hydratedFromUrlRef.current = true;
        return;
      }

      var pickupAddr = params.get('pickup');
      var pickupLatStr = params.get('pickup_lat');
      var pickupLngStr = params.get('pickup_lng');
      var dropoffAddr = params.get('dropoff');
      var dropoffLatStr = params.get('dropoff_lat');
      var dropoffLngStr = params.get('dropoff_lng');

      var distanceStr = params.get('distance');
      var durationStr = params.get('duration');
      var totalStr = params.get('total');
      var perPersonStr = params.get('per_person');
      var multiplierStr = params.get('shared_multiplier');
      var ridersStr = params.get('riders');

      // Parse with safe fallbacks — invalid values are simply ignored.
      var pLat = pickupLatStr ? parseFloat(pickupLatStr) : NaN;
      var pLng = pickupLngStr ? parseFloat(pickupLngStr) : NaN;
      var dLat = dropoffLatStr ? parseFloat(dropoffLatStr) : NaN;
      var dLng = dropoffLngStr ? parseFloat(dropoffLngStr) : NaN;

      var hasPickup = !!pickupAddr && isFinite(pLat) && isFinite(pLng);
      var hasDropoff = !!dropoffAddr && isFinite(dLat) && isFinite(dLng);

      // Only hydrate locations if BOTH endpoints are present + valid.
      if (hasPickup && hasDropoff) {
        setPickupText(pickupAddr as string);
        setDropoffText(dropoffAddr as string);
        setPickupLocation({ lat: pLat, lng: pLng, address: pickupAddr as string });
        setDropoffLocation({ lat: dLat, lng: dLng, address: dropoffAddr as string });
      }

      // Estimator numeric values — each guarded independently.
      var distNum = distanceStr ? parseFloat(distanceStr) : NaN;
      var durNum = durationStr ? parseFloat(durationStr) : NaN;
      var totalNum = totalStr ? parseFloat(totalStr) : NaN;
      var perPersonNum = perPersonStr ? parseFloat(perPersonStr) : NaN;
      var multNum = multiplierStr ? parseFloat(multiplierStr) : NaN;
      var ridersNum = ridersStr ? parseInt(ridersStr, 10) : NaN;

      if (isFinite(distNum) && distNum > 0) setEstimatedDistance(distNum);
      if (isFinite(durNum) && durNum > 0) setEstimatedDuration(Math.round(durNum));
      if (isFinite(totalNum) && totalNum > 0) setEstimatedTotal(totalNum);
      if (isFinite(perPersonNum) && perPersonNum > 0) setCostPerPerson(perPersonNum);
      if (isFinite(multNum) && multNum > 0) setSharedMultiplier(multNum);
      if (isFinite(ridersNum) && ridersNum >= 1 && ridersNum <= 8) setRiderCount(ridersNum);

      // Surface pricing UI only if we have a complete route + total.
      if (hasPickup && hasDropoff && isFinite(totalNum) && totalNum > 0) {
        setShowPricing(true);
      }

      var anyHydrated =
        hasPickup || hasDropoff ||
        isFinite(distNum) || isFinite(durNum) || isFinite(totalNum) ||
        isFinite(perPersonNum) || isFinite(multNum) || isFinite(ridersNum);

      if (anyHydrated) setEstimatorHydrated(true);
    } catch (e) {
      // Defensive: never let URL parsing break the dashboard mount.
      console.warn('[RiderDashboard] estimator URL hydration skipped:', e);
    } finally {
      hydratedFromUrlRef.current = true;
    }
  }, []);


  // Check for unrated completed rides on mount
  useEffect(function() {
    if (!riderProfile) return;

    var checkUnratedRides = async function() {
      var result = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', riderProfile.id)
        .eq('status', 'completed')
        .eq('is_rated', false)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      var data = result.data;

      if (data && data.driver_id) {
        var driverResult = await supabase
          .from('driver_profiles')
          .select('*, user:users(*)')
          .eq('id', data.driver_id)
          .single();

        var driver = driverResult.data;

        if (driver) {
          setCompletedRideForRating(data);
          setCompletedDriverInfo(driver);
          setShowRatingModal(true);
        }
      }
    };

    checkUnratedRides();
  }, [riderProfile]);

  // Poll for ride updates and driver location
  useEffect(function() {
    if (!riderProfile || !currentRide) return;

    var pollInterval = setInterval(async function() {
      var result = await supabase
        .from('rides')
        .select('*')
        .eq('id', currentRide.id)
        .single();

      var data = result.data;

      if (data) {
        if (data.status === 'completed' && currentRide.status !== 'completed' && !data.is_rated) {
          setCompletedRideForRating(data);
          setCompletedDriverInfo(driverInfo);
          setShowRatingModal(true);
          setCurrentRide(null);
          setDriverInfo(null);
          setDriverLocation(null);
          setShowPricing(false);
          setPickupText('');
          setDropoffText('');
          setPickupLocation(null);
          setDropoffLocation(null);
          return;
        }

        setCurrentRide(data);
        
        if (data.driver_id && !driverInfo) {
          var driverResult = await supabase
            .from('driver_profiles')
            .select('*, user:users(*), vehicle:vehicles(*)')
            .eq('id', data.driver_id)
            .single();
          
          var driver = driverResult.data;
          if (driver) {
            setDriverInfo(driver);
            if (driver.current_location_lat && driver.current_location_lng) {
              setDriverLocation({
                lat: driver.current_location_lat,
                lng: driver.current_location_lng,
                address: ''
              });
            }
          }
        }

        if (driverInfo) {
          var updatedResult = await supabase
            .from('driver_profiles')
            .select('current_location_lat, current_location_lng, average_rating, total_ratings')
            .eq('id', driverInfo.id)
            .single();
          
          var updatedDriver = updatedResult.data;
          if (updatedDriver?.current_location_lat && updatedDriver?.current_location_lng) {
            setDriverLocation({
              lat: updatedDriver.current_location_lat,
              lng: updatedDriver.current_location_lng,
              address: ''
            });
            setDriverInfo(function(prev: any) {
              return {
                ...prev,
                average_rating: updatedDriver.average_rating,
                total_ratings: updatedDriver.total_ratings
              };
            });
          }
        }
      }
    }, 3000);

    return function() { clearInterval(pollInterval); };
  }, [riderProfile, currentRide, driverInfo]);

  // Load existing ride on mount
  useEffect(function() {
    if (!riderProfile) return;

    var loadCurrentRide = async function() {
      var result = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', riderProfile.id)
        .in('status', ['requested', 'searching', 'accepted', 'driver_arrived', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      var data = result.data;

      if (data) {
        setCurrentRide(data);
        setPickupLocation({
          lat: data.pickup_lat,
          lng: data.pickup_lng,
          address: data.pickup_address
        });
        setDropoffLocation({
          lat: data.dropoff_lat,
          lng: data.dropoff_lng,
          address: data.dropoff_address
        });
      }
    };

    loadCurrentRide();
  }, [riderProfile]);

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED ESTIMATOR — handleRouteCalculated
  // ─────────────────────────────────────────────────────────────────────────
  // The Mapbox `onRouteCalculated(distance, duration)` callback signature is
  // PRESERVED — MapboxMap is untouched. But instead of computing the fare
  // with the old simplified `BASE_FEE + dist * PER_MILE_RATE` math, this now
  // delegates to the SAME `fetchFareEstimate` pipeline used by
  // FareEstimatorPage:
  //
  //   1. Call the `estimate-fare` Supabase Edge Function (canonical server)
  //   2. On any failure → fall back to client-side `computeFareLocally`
  //      (same Mapbox Directions API + shared @/lib/pricing constants).
  //
  // The full FareEstimate (route + breakdown + sharedRideOptions +
  // driverEarnings + driverEarningsByRiders) is stored in `fareData`, while
  // the legacy primitive state (estimatedDistance / estimatedDuration /
  // estimatedTotal) is updated from the canonical result so existing
  // booking-flow code, persistence, and disabled-guard logic continue to
  // work UNCHANGED.
  //
  // The Mapbox-provided (distance, duration) values are accepted as the
  // initial display while the estimate-fare round-trip is in flight, then
  // overwritten by the canonical pipeline result. This keeps the spinner /
  // breakdown UI responsive identical to before.
  function handleRouteCalculated(distanceMiles: number, durationMinutes: number) {
    var dist = parseFloat(distanceMiles.toFixed(1));
    var dur = Math.round(durationMinutes);

    // Show the route distance/duration immediately so the map-side UI feels
    // responsive while the canonical pipeline runs. estimatedTotal is left
    // alone here — it will be set from fareData below.
    setEstimatedDistance(dist);
    setEstimatedDuration(dur);

    // Guard: only call the unified pipeline once both endpoints are real
    // coordinates. (Mapbox can fire onRouteCalculated transiently during a
    // marker drag; without this guard we'd hit the Edge Function repeatedly
    // with stale endpoints.)
    var pu = pickupLocation;
    var dp = dropoffLocation;
    if (!pu || !dp) return;

    var now = new Date();
    var DAYS = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday',
    ];
    var tripDay = DAYS[now.getDay()];
    var tripHour = now.getHours();

    setIsEstimating(true);
    fetchFareEstimate(pu, dp, tripDay, tripHour).then(function(fare) {
      // TEMPORARY DIAGNOSTIC LOG — remove after verification.
      console.debug('[RiderDashboard estimate-fare response]', {
        source: fare && fare.route ? fare.route.source : 'unknown',
        riderCount: riderCount,
        distanceMiles: fare && fare.route ? fare.route.distanceMiles : null,
        durationMinutes: fare && fare.route ? fare.route.durationMinutes : null,
        soloTotal: fare && fare.breakdown ? fare.breakdown.totalCost : null,
        sharedOptionsCount: fare && fare.sharedRideOptions ? fare.sharedRideOptions.length : 0,
        driverBonus: fare && fare.driverEarnings ? fare.driverEarnings.bonusLabel : null,
      });

      setFareData(fare);

      // Select the shared-ride option matching the current riderCount.
      // Falls back to riderCount=1 (solo) if no match, then to the raw
      // breakdown total, then to 0 as a last resort.
      var selected =
        (fare.sharedRideOptions || []).find(function(o) { return o.riderCount === riderCount; }) ||
        (fare.sharedRideOptions || []).find(function(o) { return o.riderCount === 1; }) ||
        null;

      var canonicalTotal = selected
        ? selected.totalCost
        : (fare.breakdown ? fare.breakdown.totalCost : 0);
      var canonicalDistance = fare.route ? fare.route.distanceMiles : dist;
      var canonicalDuration = fare.route ? fare.route.durationMinutes : dur;

      // Round to 2dp for currency safety (matches pre-auth value sent to Stripe).
      var safeTotal = parseFloat(Number(canonicalTotal || 0).toFixed(2));

      setEstimatedDistance(canonicalDistance);
      setEstimatedDuration(canonicalDuration);
      setEstimatedTotal(safeTotal);
      if (selected) {
        setSharedMultiplier(selected.sharedRideMultiplier);
        setCostPerPerson(selected.costPerPerson);
      }
      setShowPricing(true);

      // PRICING PERSISTENCE STABILIZATION — mirror to localStorage so the
      // value survives remount between route-calc and Confirm Ride.
      if (isFinite(safeTotal) && safeTotal > 0) {
        savePricingSnapshot({
          estimatedDistance: canonicalDistance,
          estimatedDuration: canonicalDuration,
          estimatedTotal: safeTotal,
          showPricing: true,
        });
      }
    }).catch(function(err) {
      // fetchFareEstimate already falls back to computeFareLocally internally,
      // so reaching this catch means BOTH the Edge Function AND the local
      // fallback failed (e.g. no Mapbox token AND no network). Use the
      // simplified last-resort math so the user can still book.
      console.debug('[RiderDashboard fallback pricing]', {
        reason: 'fetchFareEstimate fully failed — using BASE_FEE+distance fallback',
        error: err && err.message ? err.message : String(err),
        distanceMiles: dist,
      });
      var fallbackTotal = parseFloat((BASE_FEE + (dist * PER_MILE_RATE)).toFixed(2));
      setEstimatedTotal(fallbackTotal);
      setShowPricing(true);
      if (isFinite(fallbackTotal) && fallbackTotal > 0) {
        savePricingSnapshot({
          estimatedDistance: dist,
          estimatedDuration: dur,
          estimatedTotal: fallbackTotal,
          showPricing: true,
        });
      }
    }).finally(function() {
      setIsEstimating(false);
    });
  }


  // ── PRICING PERSISTENCE STABILIZATION ──
  // One-shot restore from localStorage if React state is empty on mount.
  // This runs AFTER URL hydration (which has priority) and AFTER ride load.
  // It only fills in missing values — it never overwrites an already-valid
  // estimatedTotal or an active ride.
  var restoredFromStorageRef = useRef<boolean>(false);
  useEffect(function() {
    if (restoredFromStorageRef.current) return;
    if (currentRide) { restoredFromStorageRef.current = true; return; }
    if (estimatedTotal > 0) { restoredFromStorageRef.current = true; return; }

    var snap = loadPricingSnapshot();
    if (snap && snap.estimatedTotal > 0) {
      setEstimatedDistance(snap.estimatedDistance);
      setEstimatedDuration(snap.estimatedDuration);
      setEstimatedTotal(snap.estimatedTotal);
      // Only re-show pricing UI if both locations are also present.
      if (snap.showPricing && pickupLocation && dropoffLocation) {
        setShowPricing(true);
      }
    }
    restoredFromStorageRef.current = true;
  }, [currentRide, estimatedTotal, pickupLocation, dropoffLocation]);

  // Reset pricing when locations are cleared
  useEffect(function() {
    if (!pickupLocation || !dropoffLocation) {
      setShowPricing(false);
    }
  }, [pickupLocation, dropoffLocation]);


  function handlePickupSelect(location: Location) {
    setPickupLocation(location);
    setPickupText(location.address);
  }

  function handleDropoffSelect(location: Location) {
    setDropoffLocation(location);
    setDropoffText(location.address);
  }

  async function handleBookRide() {
    if (!riderProfile || !pickupLocation || !dropoffLocation) return;

    setIsBooking(true);
    setPaymentError(null);

    // ─────────────────────────────────────────────────────────────────────────
    // PRICING PERSISTENCE STABILIZATION — Pre-booking validation
    // ─────────────────────────────────────────────────────────────────────────
    // HARD GUARD: never let Stripe pre-authorization or the rides insert run
    // if the estimator hasn't produced a real, positive total. This is the
    // direct fix for "null value in column estimated_total violates
    // not-null constraint" — the insert can no longer be reached with a
    // 0 / NaN / undefined total.
    //
    // Last-resort fallback: if React state was wiped between route-calc and
    // this click, attempt to restore from the localStorage snapshot before
    // failing. Pricing formulas above (BASE_FEE/PER_MILE_RATE) are NOT
    // re-run here.
    var effectiveTotal = estimatedTotal;
    var effectiveDistance = estimatedDistance;
    var effectiveDuration = estimatedDuration;

    if (!effectiveTotal || !isFinite(effectiveTotal) || effectiveTotal <= 0) {
      var snap = loadPricingSnapshot();
      if (snap && isFinite(snap.estimatedTotal) && snap.estimatedTotal > 0) {
        effectiveTotal = snap.estimatedTotal;
        effectiveDistance = snap.estimatedDistance;
        effectiveDuration = snap.estimatedDuration;
        // Re-sync React state so the UI matches what we're about to book.
        setEstimatedTotal(snap.estimatedTotal);
        setEstimatedDistance(snap.estimatedDistance);
        setEstimatedDuration(snap.estimatedDuration);
      }
    }

    if (
      !effectiveTotal || !isFinite(effectiveTotal) || effectiveTotal <= 0 ||
      !isFinite(effectiveDistance) || effectiveDistance <= 0 ||
      !isFinite(effectiveDuration) || effectiveDuration <= 0
    ) {
      setPaymentError(
        'We couldn\'t confirm your fare. Please re-enter your pickup and dropoff so we can recalculate the route before booking.'
      );
      setIsBooking(false);
      return;
    }

    try {
      var paymentResult = await supabase.functions.invoke('stripe-preauthorize-ride', {
        body: {
          rider_id: riderProfile.id,
          amount: effectiveTotal
        }
      });

      var paymentData = paymentResult.data;
      var paymentErr = paymentResult.error;

      if (paymentErr || paymentData?.error) {
        throw new Error(paymentData?.error || paymentErr?.message || 'Failed to authorize payment');
      }


      // ─────────────────────────────────────────────────────────────────────
      // PHASE 3: Shared-ride persistence (source-of-truth resolution)
      // ─────────────────────────────────────────────────────────────────────
      // Priority order (per approved Phase 3 plan):
      //   1) If estimatorHydrated === true  → use Phase 2 state values
      //      (riderCount, sharedMultiplier, costPerPerson) sourced from the
      //      FareEstimatorPage URL params.
      //   2) Else → fallback to standard 1-rider defaults so existing
      //      direct-from-dashboard bookings behave EXACTLY as before.
      //
      // Defensive clamps:
      //   • rider_count clamped to integer in [1, 8]
      //   • shared_ride_multiplier coerced finite & > 0, else 1.0
      //   • cost_per_person coerced finite & >= 0, else 0
      //
      // NOTE: estimatedTotal is NOT recalculated here — it remains the
      // pre-authorized amount sent to Stripe above, preserving sync between
      // the Stripe pre-auth and the persisted ride total.
      var safeRiderCount = 1;
      var safeSharedMultiplier = 1.0;
      var safeCostPerPerson = 0;

      if (estimatorHydrated) {
        var rc = Math.floor(Number(riderCount));
        if (isFinite(rc) && rc >= 1 && rc <= 8) {
          safeRiderCount = rc;
        }
        var sm = Number(sharedMultiplier);
        if (isFinite(sm) && sm > 0) {
          safeSharedMultiplier = sm;
        }
        var cpp = Number(costPerPerson);
        if (isFinite(cpp) && cpp >= 0) {
          safeCostPerPerson = parseFloat(cpp.toFixed(2));
        }
      }

      var rideResult = await supabase
        .from('rides')
        .insert({
          rider_id: riderProfile.id,
          pickup_address: pickupLocation.address,
          pickup_lat: pickupLocation.lat,
          pickup_lng: pickupLocation.lng,
          dropoff_address: dropoffLocation.address,
          dropoff_lat: dropoffLocation.lat,
          dropoff_lng: dropoffLocation.lng,
          // ── PRICING PERSISTENCE STABILIZATION ──
          // Use the validated `effective*` values from the pre-booking guard
          // above instead of raw React state. This guarantees the insert can
          // NEVER reach the database with null/0/NaN pricing (which would
          // violate the estimated_total NOT NULL constraint).
          estimated_distance_miles: effectiveDistance,
          estimated_duration_minutes: effectiveDuration,
          base_fee: BASE_FEE,
          per_mile_rate: PER_MILE_RATE,
          estimated_total: effectiveTotal,
          status: 'searching',
          payment_status: 'authorized',
          stripe_payment_intent_id: paymentData.paymentIntentId,
          is_rated: false,
          // ── PHASE 3: shared-ride persistence ──
          rider_count: safeRiderCount,
          shared_ride_multiplier: safeSharedMultiplier,
          cost_per_person: safeCostPerPerson
        })
        .select()
        .single();


      var ride = rideResult.data;
      var rideError = rideResult.error;

      if (rideError || !ride) {
        if (paymentData.paymentIntentId) {
          await supabase.functions.invoke('stripe-refund', {
            body: { payment_intent_id: paymentData.paymentIntentId }
          });
        }
        throw new Error('Failed to create ride');
      }

      setCurrentRide(ride);

      // ── PRICING PERSISTENCE STABILIZATION ──
      // Ride successfully persisted with valid pricing — the localStorage
      // backup is no longer needed and is cleared so it can't bleed into a
      // future, unrelated booking session.
      clearPricingSnapshot();

      try {
        await supabase.functions.invoke('dispatch-ride', {
          body: { ride_id: ride.id }
        });
      } catch (dispatchError: any) {
        console.log('Dispatch error:', String(dispatchError?.message || dispatchError));

        var driversResult = await supabase
          .from('driver_profiles')
          .select('id')
          .eq('status', 'approved')
          .eq('is_online', true)
          .limit(5);

        var drivers = driversResult.data;
        if (drivers && drivers.length > 0) {
          await supabase.from('ride_offers').insert({
            ride_id: ride.id,
            driver_id: drivers[0].id,
            expires_at: new Date(Date.now() + 15000).toISOString()
          });
        }
      }
    } catch (error: any) {
      setPaymentError(error.message || 'Failed to book ride');
    } finally {
      setIsBooking(false);
    }
  }


  async function handleCancelRide() {
    if (!currentRide) return;

    try {
      await supabase.functions.invoke('stripe-refund', {
        body: { 
          ride_id: currentRide.id,
          payment_intent_id: currentRide.stripe_payment_intent_id
        }
      });
    } catch (error) {
      console.error('Refund error:', error);
    }

    await supabase
      .from('rides')
      .update({ 
        status: 'cancelled', 
        cancelled_at: new Date().toISOString(),
        payment_status: 'refunded'
      })
      .eq('id', currentRide.id);

    setCurrentRide(null);
    setDriverInfo(null);
    setDriverLocation(null);
    setShowPricing(false);
    setPickupText('');
    setDropoffText('');
    setPickupLocation(null);
    setDropoffLocation(null);

    // ── PRICING PERSISTENCE STABILIZATION ──
    // Ride was cancelled and refunded — drop any cached estimator snapshot so
    // the user starts cleanly the next time they enter pickup/dropoff.
    clearPricingSnapshot();
  }


  async function handleReportSubmit(type: string, description: string) {
    if (!currentRide || !user) return;

    await supabase.from('incidents').insert({
      ride_id: currentRide.id,
      reported_by_user_id: user.id,
      reported_against_user_id: driverInfo?.user_id,
      incident_type: type,
      description: description,
    });
  }

  function handleRatingSubmitted() {
    setShowRatingModal(false);
    setCompletedRideForRating(null);
    setCompletedDriverInfo(null);
  }

  function getStatusMessage() {
    if (!currentRide) return '';
    
    switch (currentRide.status) {
      case 'requested':
      case 'searching':
        return 'Finding you a driver...';
      case 'accepted':
        return 'Driver is on the way!';
      case 'driver_arrived':
        return 'Driver has arrived!';
      case 'in_progress':
        return 'Ride in progress';
      case 'completed':
        return 'Ride completed!';
      case 'driver_no_show':
        return 'Driver did not show up. Full refund issued.';
      default:
        return '';
    }
  }

  var hasActiveRide = currentRide && 
    currentRide.status !== 'completed' && 
    currentRide.status !== 'cancelled';

  if (showPaymentMethods) {
    return <PaymentMethodsPage onBack={function() { setShowPaymentMethods(false); }} />;
  }

  if (showRideHistory) {
    return <RideHistoryPage onBack={function() { setShowRideHistory(false); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
            <div>
              <p className="text-sm text-gray-500">Rider Dashboard</p>
              <p className="text-xs text-gray-400">Welcome, {user?.full_name}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <MapboxMap
            pickup={pickupLocation}
            dropoff={dropoffLocation}
            driverLocation={driverLocation}
            showRoute={true}
            interactive={!hasActiveRide}
            height="350px"
            onPickupChange={handlePickupSelect}
            onDropoffChange={handleDropoffSelect}
            onRouteCalculated={handleRouteCalculated}
          />
        </div>

        {hasActiveRide && currentRide && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className={'p-4 text-white ' + (
              currentRide.status === 'in_progress' ? 'bg-green-600' :
              currentRide.status === 'driver_arrived' ? 'bg-orange-600' :
              currentRide.status === 'driver_no_show' ? 'bg-red-600' :
              'bg-amber-500'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{getStatusMessage()}</h3>
                  {(currentRide.status === 'searching' || currentRide.status === 'requested') && (
                    <div className="flex items-center gap-2 mt-1">
                      <RefreshIcon className="animate-spin" size={16} />
                      <span className="text-sm">This usually takes 1-2 minutes</span>
                    </div>
                  )}
                </div>
                {currentRide.status === 'in_progress' && (
                  <button
                    onClick={function() { setShowSafety(true); }}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <ShieldIcon size={24} />
                  </button>
                )}
              </div>
            </div>

            {driverInfo && (
              <div className="p-4 border-b flex items-center gap-4">
                <img
                  src={driverImage}
                  alt="Driver"
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{driverInfo.user?.full_name}</p>
                  <div className="flex items-center gap-1 text-amber-500">
                    <StarIcon size={16} className="fill-amber-400 text-amber-400" />
                    <span className="text-sm">
                      {driverInfo.average_rating ? Number(driverInfo.average_rating).toFixed(1) : 'New'}
                      {driverInfo.total_ratings > 0 && (
                        <span className="text-gray-400 ml-1">({driverInfo.total_ratings})</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {driverInfo.vehicle?.year} {driverInfo.vehicle?.make}
                  </p>
                  <p className="text-sm text-gray-500">{driverInfo.vehicle?.color}</p>
                  <p className="text-sm font-mono text-gray-600">{driverInfo.vehicle?.license_plate}</p>
                </div>
              </div>
            )}

            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="text-green-600" size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="font-medium text-gray-900">{currentRide.pickup_address}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <NavigationIcon className="text-red-600" size={16} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Dropoff</p>
                  <p className="font-medium text-gray-900">{currentRide.dropoff_address}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Distance</p>
                  <p className="font-semibold">{currentRide.estimated_distance_miles} mi</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Est. Time</p>
                  <p className="font-semibold">{currentRide.estimated_duration_minutes} min</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="font-semibold text-green-600">${currentRide.estimated_total.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t">
                <ShieldIcon className="text-green-600" size={16} />
                <span className="text-sm text-gray-600">
                  Payment {currentRide.payment_status === 'authorized' ? 'pre-authorized' : currentRide.payment_status}
                </span>
              </div>
            </div>

            {(currentRide.status === 'searching' || currentRide.status === 'requested' || currentRide.status === 'accepted') && (
              <div className="p-4 bg-gray-50">
                <button
                  onClick={handleCancelRide}
                  className="w-full py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors"
                >
                  Cancel Ride
                </button>
              </div>
            )}

            {currentRide.status === 'driver_no_show' && (
              <div className="p-4 bg-green-50 border-t border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="text-green-600" size={24} />
                  <div>
                    <p className="font-semibold text-green-800">Full Refund Issued</p>
                    <p className="text-sm text-green-700">
                      ${currentRide.estimated_total.toFixed(2)} has been refunded to your payment method.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasActiveRide && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Where to?</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                <AddressAutocomplete
                  value={pickupText}
                  onChange={setPickupText}
                  onLocationSelect={handlePickupSelect}
                  placeholder="Enter pickup address"
                  icon="pickup"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dropoff Location</label>
                <AddressAutocomplete
                  value={dropoffText}
                  onChange={setDropoffText}
                  onLocationSelect={handleDropoffSelect}
                  placeholder="Enter destination"
                  icon="dropoff"
                />
              </div>
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-700 text-sm">{paymentError}</p>
              </div>
            )}

            {showPricing && (
              <div className="space-y-4">
                {/* ── UNIFIED PRICE BREAKDOWN ──
                    Identical to FareEstimatorPage when fareData is available
                    (server `estimate-fare` or computeFareLocally). Falls back
                    to the simple Base + Distance summary if fareData hasn't
                    arrived yet (preserves previous behavior). */}
                {fareData ? (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Price Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Fee</span>
                        <span className="font-medium">{formatCurrency(fareData.breakdown.baseFee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Distance ({fareData.route.distanceMiles} mi x ${fareData.breakdown.perMileRate.toFixed(2)})
                        </span>
                        <span className="font-medium">{formatCurrency(fareData.breakdown.distanceCharge)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Time ({fareData.route.durationMinutes} min x ${fareData.breakdown.perMinuteRate.toFixed(2)})
                        </span>
                        <span className="font-medium">{formatCurrency(fareData.breakdown.timeCharge)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Booking Fee</span>
                        <span className="font-medium">{formatCurrency(fareData.breakdown.bookingFee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Safety Fee</span>
                        <span className="font-medium">{formatCurrency(fareData.breakdown.safetyFee)}</span>
                      </div>
                      {riderCount > 1 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Shared Ride ({riderCount} riders, {sharedMultiplier}x)
                          </span>
                          <span className="font-medium">
                            {formatCurrency(estimatedTotal - fareData.breakdown.totalCost)}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between text-base">
                        <span className="font-semibold text-gray-900">Estimated Total</span>
                        <span className="font-bold text-green-600">{formatCurrency(estimatedTotal)}</span>
                      </div>
                      {riderCount > 1 && costPerPerson > 0 && (
                        <div className="flex justify-between text-orange-600 font-semibold">
                          <span>Per Person ({riderCount} riders)</span>
                          <span>{formatCurrency(costPerPerson)}</span>
                        </div>
                      )}
                    </div>
                    {/* Driver bonus breakdown (matches FareEstimatorPage) */}
                    {fareData.driverEarnings && (
                      <div className="mt-3 pt-3 border-t border-amber-200 bg-amber-50 rounded-lg p-3 space-y-1">
                        <p className="text-xs uppercase tracking-wider text-amber-700 font-medium flex items-center gap-2">
                          <DollarIcon size={12} className="text-amber-600" />
                          Driver Earnings
                        </p>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">
                            Driver Base ({Math.round(EARNINGS_SPLIT.DRIVER_PERCENTAGE * 100)}%)
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(fareData.driverEarnings.driverBaseEarnings)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={fareData.driverEarnings.bonus > 0 ? 'text-green-700 font-medium' : 'text-gray-600'}>
                            Bonus
                            {fareData.driverEarnings.bonus > 0 && (
                              <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                {fareData.driverEarnings.bonusLabel}
                              </span>
                            )}
                          </span>
                          <span className={fareData.driverEarnings.bonus > 0 ? 'font-medium text-green-700' : 'font-medium text-gray-900'}>
                            {fareData.driverEarnings.bonus > 0 ? '+' : ''}{formatCurrency(fareData.driverEarnings.bonus)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-amber-200 font-semibold">
                          <span className="text-gray-900">Total Driver Earnings</span>
                          <span className="text-gray-900">
                            {formatCurrency(fareData.driverEarnings.totalDriverEarnings)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Price Breakdown</h3>
                    {isEstimating ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <RefreshIcon className="animate-spin" size={14} />
                        Calculating fare...
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Base Fee</span>
                          <span className="font-medium">${BASE_FEE.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            Distance ({estimatedDistance} mi x ${PER_MILE_RATE.toFixed(2)}/mi)
                          </span>
                          <span className="font-medium">${(estimatedDistance * PER_MILE_RATE).toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between text-base">
                          <span className="font-semibold text-gray-900">Estimated Total</span>
                          <span className="font-bold text-green-600">${estimatedTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <ClockIcon size={16} />
                  <span>Estimated arrival: {estimatedDuration} minutes</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <DollarIcon className="text-gray-400" size={20} />
                    <span className="text-gray-700">
                      {riderProfile?.payment_method_brand} **** {riderProfile?.payment_method_last_four}
                    </span>
                  </div>
                  <CheckCircleIcon className="text-green-600" size={20} />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-sm text-blue-800">
                    <ShieldIcon className="inline mr-1" size={14} />
                    Your payment will be pre-authorized when you book. You will only be charged when the ride is completed.
                  </p>
                </div>

                <button
                  onClick={handleBookRide}
                  /* ── PRICING PERSISTENCE STABILIZATION ──
                     Disable the Confirm Ride button unless a valid route AND a
                     positive estimated total have been calculated. The user
                     cannot trigger Stripe pre-authorization with bad pricing. */
                  disabled={
                    isBooking ||
                    !pickupLocation ||
                    !dropoffLocation ||
                    !showPricing ||
                    !estimatedTotal ||
                    !isFinite(estimatedTotal) ||
                    estimatedTotal <= 0 ||
                    !isFinite(estimatedDistance) ||
                    estimatedDistance <= 0
                  }
                  className="w-full py-4 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
                >

                  {isBooking ? (
                    <>
                      <RefreshIcon className="animate-spin" size={20} />
                      Authorizing Payment...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon size={20} />
                      Confirm Ride - ${estimatedTotal.toFixed(2)}
                    </>
                  )}
                </button>
              </div>
            )}

            {!showPricing && pickupLocation && dropoffLocation && (
              <div className="text-center py-4">
                <RefreshIcon className="animate-spin text-orange-600 mx-auto" size={24} />
                <p className="mt-2 text-sm text-gray-500">Calculating route on map...</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={function() { setShowPaymentMethods(true); }}
          className="w-full bg-white rounded-2xl shadow-sm p-6 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Payment Methods</h3>
            <ChevronRightIcon className="text-gray-400" size={20} />
          </div>
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
              {riderProfile?.payment_method_brand?.toUpperCase() || 'CARD'}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {riderProfile?.payment_method_brand} **** {riderProfile?.payment_method_last_four}
              </p>
              <p className="text-sm text-gray-500">Default payment method</p>
            </div>
            <div className="flex items-center gap-2">
              <ShieldIcon className="text-green-600" size={20} />
              <CreditCardIcon className="text-gray-400" size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Tap to manage your saved cards and payment methods
          </p>
        </button>

        <button
          onClick={function() { setShowRideHistory(true); }}
          className="w-full bg-white rounded-2xl shadow-sm p-6 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <HistoryIcon className="text-orange-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Ride History</h3>
                <p className="text-sm text-gray-500">View all your past rides and receipts</p>
              </div>
            </div>
            <ChevronRightIcon className="text-gray-400" size={20} />
          </div>
        </button>
      </main>
      

      <SafetyModal
        isOpen={showSafety}
        onClose={function() { setShowSafety(false); }}
        rideId={currentRide?.id || ''}
        rideStatus={currentRide?.status}
        riderLocation={pickupLocation ? { lat: pickupLocation.lat, lng: pickupLocation.lng } : null}
        user={user}
        currentRide={currentRide}
        onReportSubmit={handleReportSubmit}
      />


      {completedRideForRating && completedDriverInfo && (
        <RideRatingModal
          isOpen={showRatingModal}
          onClose={function() {
            setShowRatingModal(false);
            setCompletedRideForRating(null);
            setCompletedDriverInfo(null);
          }}
          ride={completedRideForRating}
          driverName={completedDriverInfo.user?.full_name || 'Your Driver'}
          driverImage={driverImage}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
}

export default RiderDashboard;
