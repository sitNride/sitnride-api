import React, { useState, useEffect, useCallback, useRef } from 'react';

import { useDrivingTimer } from '@/hooks/useDrivingTimer';

import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { Ride, RideOffer } from '@/types';
import MapboxMap from '@/components/map/MapboxMap';
import StripeConnectSetup from '@/components/driver/StripeConnectSetup';
import DriverEarningsDashboard from '@/components/driver/DriverEarningsDashboard';
import DriverBonusesPage from '@/components/driver/DriverBonusesPage';
import EarningsSplitBreakdown from '@/components/driver/EarningsSplitBreakdown';
import {
  calculateEarningsSplit,
  calculateRidePrice,
  calculateDriverBonus,
  formatCurrency,
  SHARED_RIDE_MULTIPLIERS,
} from '@/lib/pricing';

import {
  PowerIcon, CarIcon, WalletIcon, MapPinIcon,
  ClockIcon, CheckCircleIcon, XCircleIcon, NavigationIcon,
  TrendingUpIcon, RefreshIcon, ShieldIcon, BankIcon, AlertCircleIcon,
  GiftIcon, UsersIcon, ZapIcon, AlertTriangleIcon, PhoneIcon
} from '@/components/ui/Icons';
import {
  getSupportSmsHref,
  getSupportTelHref,
  buildLiveLocationLink,
  logEmergencyEvent,
} from '@/lib/support';


// ── Driver Safety Modal (mirrors rider safety modal pattern) ──
interface DriverSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  rideStatus?: string;
  driverLocation?: { lat: number; lng: number } | null;
  // ── Emergency-event logging context ──
  // user.id + currentRide.id are written into the emergency_events row.
  // Both are optional — logging gracefully degrades to nulls when missing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: { id?: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentRide?: { id?: string | null } | null;
  onReportSubmit: (type: string, description: string) => void;
}


const DriverSafetyModal: React.FC<DriverSafetyModalProps> = ({
  isOpen,
  onClose,
  rideId,
  rideStatus,
  driverLocation,
  user,
  currentRide,
  onReportSubmit,
}) => {
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  // ── 911 emergency call ──
  // Logs the event BEFORE switching to the dialer so we don't lose the
  // record if the OS hands off to the phone app. Logging is fire-and-forget
  // — never await, never block, never throw.
  const handleEmergency = () => {
    void logEmergencyEvent({
      supabase,
      role: 'driver',
      eventType: 'call_911',
      currentRide,
      user,
      driverLocation,
    });
    window.location.href = 'tel:911';
  };

  // ── Support SMS with live location (uses existing driverLocation state) ──
  const handleSupportSms = () => {
    const mapsLink = buildLiveLocationLink(driverLocation?.lat, driverLocation?.lng);

    const message = `EMERGENCY: Driver needs support
Ride ID: ${rideId || 'N/A'}
Status: ${rideStatus || 'N/A'}

Live Location:
${mapsLink}`;

    void logEmergencyEvent({
      supabase,
      role: 'driver',
      eventType: 'sms_support',
      currentRide,
      user,
      driverLocation,
      message,
    });

    window.location.href = getSupportSmsHref(message);
  };

  // ── Optional: direct call to support ──
  const handleSupportCall = () => {
    void logEmergencyEvent({
      supabase,
      role: 'driver',
      eventType: 'call_support',
      currentRide,
      user,
      driverLocation,
    });
    window.location.href = getSupportTelHref();
  };



  const handleSubmitReport = () => {
    if (reportType && description) {
      onReportSubmit(reportType, description);
      setReportType('');
      setDescription('');
      onClose();
    }
  };

  const hasLocation = !!(driverLocation?.lat && driverLocation?.lng);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="bg-red-600 p-6 text-white text-center">
          <ShieldIcon className="mx-auto" size={40} />
          <h2 className="mt-2 text-2xl font-bold">Driver Safety Center</h2>
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

          {/* Live location preview shown to driver before sending */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <MapPinIcon className="text-gray-500" size={14} />
              <span className="font-semibold text-gray-700">Live Location for Support</span>
            </div>
            {hasLocation ? (
              <>
                <p className="tabular-nums">
                  {driverLocation!.lat.toFixed(5)}, {driverLocation!.lng.toFixed(5)}
                </p>
                <a
                  href={`https://maps.google.com/?q=${driverLocation!.lat},${driverLocation!.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 underline break-all"
                >
                  https://maps.google.com/?q={driverLocation!.lat},{driverLocation!.lng}
                </a>
                <p className="text-gray-500 mt-1">
                  This link will be included automatically in your support text.
                </p>
              </>
            ) : (
              <p className="text-amber-700">
                Location unavailable — go online to share GPS location with support.
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Report an Issue</h3>

            <div className="space-y-2 mb-4">
              {['safety', 'behavior', 'vehicle', 'other'].map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={
                    'w-full p-3 rounded-xl border-2 text-left transition-all ' +
                    (reportType === type
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300')
                  }
                >
                  <span className="capitalize font-medium">{type} Issue</span>
                </button>
              ))}
            </div>

            {reportType && (
              <div className="space-y-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
};







const VEHICLE_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917289390_8c5d9988.png',
  'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769917279020_239fc433.jpg',
];



interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface RideOfferModalProps {
  offer: RideOffer & { ride: Ride };
  onAccept: () => void;
  onDecline: () => void;
  timeLeft: number;
}

const RideOfferModal: React.FC<RideOfferModalProps> = ({ offer, onAccept, onDecline, timeLeft }) => {
  const ride = offer.ride;
  const totalFare = ride.estimated_total;
  const riderCount = ride.rider_count || 1;
  const sharedMultiplier = ride.shared_ride_multiplier || SHARED_RIDE_MULTIPLIERS[riderCount] || 1.0;
  const surgeMultiplier = ride.surge_multiplier || 1.0;
  const distanceMiles = ride.estimated_distance_miles;
  const durationMinutes = ride.estimated_duration_minutes;

  // Derive fare line items from ride data or recalculate
  const ridePricing = calculateRidePrice(distanceMiles, durationMinutes, riderCount, surgeMultiplier);
  const baseFeeVal = ride.base_fee ?? ridePricing.baseFee;
  const distChargeVal = ride.distance_charge ?? ridePricing.distanceCharge;
  const timeChargeVal = ride.time_charge ?? ridePricing.timeCharge;
  const surgeAmountVal = ride.surge_amount ?? ridePricing.surgeAmount;

  // Urgency color based on time left
  const urgencyColor = timeLeft <= 5 ? 'from-red-600 to-red-500' : timeLeft <= 10 ? 'from-amber-600 to-amber-500' : 'from-green-600 to-green-500';
  const urgencyBarColor = timeLeft <= 5 ? 'bg-red-300' : timeLeft <= 10 ? 'bg-amber-300' : 'bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto">
        {/* Header with countdown */}
        <div className={`bg-gradient-to-r ${urgencyColor} p-6 text-white text-center relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full border-4 border-white/30" />
            <div className="absolute -bottom-6 -left-6 w-40 h-40 rounded-full border-4 border-white/20" />
          </div>
          <h2 className="text-2xl font-bold relative">New Ride Request!</h2>
          <div className="mt-2 relative">
            <div className="text-5xl font-bold tabular-nums">{timeLeft}s</div>
            {/* Countdown progress bar */}
            <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full ${urgencyBarColor} rounded-full transition-all duration-1000 ease-linear`}
                style={{ width: `${(timeLeft / 15) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Fare Context Badges — rider count, shared multiplier, surge */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700">
              <UsersIcon size={14} />
              <span>{riderCount} {riderCount === 1 ? 'Rider' : 'Riders'}</span>
            </div>
            {riderCount > 1 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full text-sm font-medium text-purple-700">
                <TrendingUpIcon size={14} />
                <span>Shared {sharedMultiplier.toFixed(2)}x</span>
              </div>
            )}
            {surgeMultiplier > 1.0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm font-medium text-amber-700">
                <ZapIcon size={14} />
                <span>Surge {surgeMultiplier.toFixed(1)}x</span>
              </div>
            )}
          </div>

          {/* Pickup */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPinIcon className="text-green-600" size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pickup</p>
              <p className="font-medium text-gray-900 truncate">{ride.pickup_address}</p>
            </div>
          </div>

          {/* Dropoff */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <NavigationIcon className="text-red-600" size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Dropoff</p>
              <p className="font-medium text-gray-900 truncate">{ride.dropoff_address}</p>
            </div>
          </div>

          {/* Ride stats row */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Distance</p>
              <p className="text-lg font-semibold text-gray-900">{distanceMiles} mi</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Est. Time</p>
              <p className="text-lg font-semibold text-gray-900">{durationMinutes} min</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Fare</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalFare)}</p>
            </div>
          </div>

          {/* ── Driver Earnings Card with Reusable Breakdown ── */}
          <EarningsSplitBreakdown
            totalFare={totalFare}
            riderCount={riderCount}
            sharedRideMultiplier={sharedMultiplier}
            surgeMultiplier={surgeMultiplier}
            distanceMiles={distanceMiles}
            durationMinutes={durationMinutes}
            baseFee={baseFeeVal}
            distanceCharge={distChargeVal}
            timeCharge={timeChargeVal}
            surgeAmount={surgeAmountVal}
            variant="card"
            showTooltip={true}
          />
        </div>

        {/* Action buttons */}
        <div className="p-4 bg-gray-50 flex gap-4">
          <button
            onClick={onDecline}
            className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
          >
            <XCircleIcon size={20} /> Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all shadow-lg shadow-green-600/25 flex items-center justify-center gap-2"
          >
            <CheckCircleIcon size={20} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
};




interface CashOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  payoutsEnabled: boolean;
  onCashOut: (amount: number, type: 'instant' | 'weekly') => Promise<void>;
}

const CashOutModal: React.FC<CashOutModalProps> = ({ isOpen, onClose, availableBalance, payoutsEnabled, onCashOut }) => {
  const [amount, setAmount] = useState('');
  const [payoutType, setPayoutType] = useState<'instant' | 'weekly'>('instant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || numAmount > availableBalance) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onCashOut(numAmount, payoutType);
      const bonusAmount = payoutType === 'weekly' ? numAmount * 0.05 : 0;
      const totalPayout = numAmount + bonusAmount;
      setSuccess(`Payout of $${totalPayout.toFixed(2)} processed successfully!`);
      setTimeout(() => {
        onClose();
        setSuccess(null);
        setAmount('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to process payout');
    } finally {
      setLoading(false);
    }
  };

  const bonusAmount = payoutType === 'weekly' && amount ? parseFloat(amount) * 0.05 : 0;
  const totalPayout = amount ? parseFloat(amount) + bonusAmount : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-500 p-6 text-white">
          <h2 className="text-2xl font-bold">Cash Out</h2>
          <p className="text-green-100 mt-1">Available: ${availableBalance.toFixed(2)}</p>
        </div>

        <div className="p-6 space-y-6">
          {!payoutsEnabled ? (
            <div className="text-center py-4">
              <AlertCircleIcon className="text-amber-500 mx-auto" size={48} />
              <p className="mt-4 text-lg font-semibold text-gray-900">Payout Setup Required</p>
              <p className="mt-2 text-gray-600">
                Please complete your payout account setup before cashing out.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
              >
                Set Up Payouts
              </button>
            </div>
          ) : success ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="text-green-600 mx-auto" size={48} />
              <p className="mt-4 text-lg font-semibold text-gray-900">{success}</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Cash Out</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    max={availableBalance}
                    step="0.01"
                    className="w-full pl-8 pr-4 py-4 text-2xl font-semibold border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setAmount(availableBalance.toString())}
                  className="mt-2 text-sm text-green-600 hover:text-green-700"
                >
                  Cash out full balance
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Payout Speed</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPayoutType('instant')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      payoutType === 'instant'
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshIcon className="text-green-600" size={18} />
                      <span className="font-semibold text-gray-900">Instant</span>
                    </div>
                    <p className="text-sm text-gray-500">Receive earnings immediately</p>

                    <p className="text-xs text-gray-400 mt-1">Standard payout</p>
                  </button>
                  <button
                    onClick={() => setPayoutType('weekly')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      payoutType === 'weekly'
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUpIcon className="text-green-600" size={18} />
                      <span className="font-semibold text-gray-900">Weekly</span>
                    </div>
                    <p className="text-sm text-gray-500">Paid every Monday</p>
                    <p className="text-xs text-green-600 font-semibold mt-1">+5% Bonus!</p>
                  </button>
                </div>
              </div>

              {payoutType === 'weekly' && amount && parseFloat(amount) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <TrendingUpIcon size={20} />
                    <span className="font-semibold">5% Weekly Bonus</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Base amount</span>
                      <span>${parseFloat(amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>5% Bonus</span>
                      <span>+${bonusAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-green-800 pt-1 border-t border-green-200">
                      <span>Total Payout</span>
                      <span>${totalPayout.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                <ShieldIcon className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-gray-600">
                  Payouts are processed securely through Stripe. Funds will be deposited to your linked bank account.
                </p>
              </div>
            </>
          )}
        </div>

        {payoutsEnabled && !success && (
          <div className="p-4 bg-gray-50 flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="flex-1 py-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshIcon className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <WalletIcon size={20} />
                  Cash Out
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const DriverDashboard: React.FC = () => {
  const { user, driverProfile, vehicle, updateDriverProfile, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(driverProfile?.is_online || false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [pendingOffer, setPendingOffer] = useState<(RideOffer & { ride: Ride }) | null>(null);
  const [offerTimeLeft, setOfferTimeLeft] = useState(15);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayRides, setTodayRides] = useState(0);
  const [showCashOut, setShowCashOut] = useState(false);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [processingRide, setProcessingRide] = useState(false);
  const [activeTab, setActiveTab] = useState<'drive' | 'earnings' | 'bonuses' | 'payouts'>('drive');
  const [payoutsEnabled, setPayoutsEnabled] = useState(driverProfile?.stripe_payouts_enabled || false);
  const [showBonusesPage, setShowBonusesPage] = useState(false);
  const [showSafety, setShowSafety] = useState(false);


  // ── Trip Tracking State (for fare calculation from real GPS data) ──
  // These accumulate distance + time DURING an active ride (status === 'in_progress').
  // They are completely separate from the existing driver-availability GPS logic.
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [tripDistance, setTripDistance] = useState(0); // miles
  const [tripElapsedSeconds, setTripElapsedSeconds] = useState(0);

  // Refs mirror state so the watchPosition callback (created once) can read
  // current values without forcing the watcher to be re-created.
  const currentRideRef = useRef<Ride | null>(null);
  const lastTripLocationRef = useRef<Location | null>(null);
  const tripDistanceRef = useRef(0);
  const tripStartTimeRef = useRef<number | null>(null);

  // Keep currentRide ref in sync
  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  // Haversine distance between two GPS coordinates (in miles)
  const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3958.8; // Earth radius in miles
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Live trip timer — ticks once per second while a ride is in_progress
  useEffect(() => {
    if (currentRide?.status !== 'in_progress' || !tripStartTime) {
      return;
    }
    const interval = setInterval(() => {
      setTripElapsedSeconds(Math.floor((Date.now() - tripStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRide?.status, tripStartTime]);


  // ── 12-Hour Driving Safety Limit ──
  const drivingTimer = useDrivingTimer(isOnline);

  // Auto-force offline when 12-hour limit is reached
  useEffect(() => {
    if (drivingTimer.isLimitReached && isOnline && !currentRide) {
      setIsOnline(false);
      updateDriverProfile({ is_online: false });
    }
  }, [drivingTimer.isLimitReached, isOnline, currentRide]);


  // Get and track driver's current location
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ lat: latitude, lng: longitude });

        // ── EXISTING: Update driver availability location in database ──
        if (driverProfile && isOnline) {
          await supabase
            .from('driver_profiles')
            .update({
              current_location_lat: latitude,
              current_location_lng: longitude,
              last_location_update: new Date().toISOString()
            })
            .eq('id', driverProfile.id);
        }

        // ── NEW: Trip distance accumulation (only during in_progress rides) ──
        // Reads refs so this callback never needs to be re-created.
        const activeRide = currentRideRef.current;
        if (activeRide && activeRide.status === 'in_progress') {
          const last = lastTripLocationRef.current;
          if (last) {
            const segment = haversineMiles(last.lat, last.lng, latitude, longitude);
            // Filter out tiny GPS jitter (<10ft ≈ 0.002 mi) and absurd jumps (>2 mi between pings)
            if (segment >= 0.002 && segment <= 2) {
              tripDistanceRef.current += segment;
              setTripDistance(tripDistanceRef.current);
            }
          }
          lastTripLocationRef.current = { lat: latitude, lng: longitude };
        }
      },
      (error) => {

        console.error('Location error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    setWatchId(id);
  }, [driverProfile, isOnline]);

  const stopLocationTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Start/stop location tracking based on online status
  useEffect(() => {
    if (isOnline) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => stopLocationTracking();
  }, [isOnline, startLocationTracking, stopLocationTracking]);

  // Poll for ride offers when online
  useEffect(() => {
    if (!isOnline || !driverProfile) return;

    const pollInterval = setInterval(async () => {
      const { data: offers } = await supabase
        .from('ride_offers')
        .select('*, ride:rides(*)')
        .eq('driver_id', driverProfile.id)
        .eq('status', 'pending')
        .order('offered_at', { ascending: false })
        .limit(1);

      if (offers && offers.length > 0) {
        const offer = offers[0];
        if (new Date(offer.expires_at) > new Date()) {
          setPendingOffer(offer);
          setOfferTimeLeft(Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 1000)));
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isOnline, driverProfile]);

  // Countdown timer for offers
  useEffect(() => {
    if (!pendingOffer) return;

    const timer = setInterval(() => {
      setOfferTimeLeft(prev => {
        if (prev <= 1) {
          handleDeclineOffer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingOffer]);

  // Load current ride
  useEffect(() => {
    if (!driverProfile) return;

    const loadCurrentRide = async () => {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .in('status', ['accepted', 'driver_arrived', 'in_progress'])
        .maybeSingle();


      if (data) {
        setCurrentRide(data);
      }
    };

    loadCurrentRide();
  }, [driverProfile]);

  // Load today's stats
  useEffect(() => {
    if (!driverProfile) return;

    const loadStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('rides')
        .select('driver_earnings')
        .eq('driver_id', driverProfile.id)
        .eq('status', 'completed')
        .gte('completed_at', today.toISOString());

      if (data) {
        setTodayRides(data.length);
        setTodayEarnings(data.reduce((sum, r) => sum + (r.driver_earnings || 0), 0));
      }
    };

    loadStats();
  }, [driverProfile, currentRide]);

  const toggleOnline = async () => {
    // Check if vehicle is approved before allowing driver to go online
    if (!isOnline && (!vehicle || vehicle.inspection_status !== 'approved' || !vehicle.is_approved)) {
      return;
    }

    // Check if payouts are enabled before allowing driver to go online
    if (!isOnline && !payoutsEnabled) {
      setActiveTab('payouts');
      return;
    }

    // Check 12-hour driving limit — block going online if limit reached or still resting
    if (!isOnline && (drivingTimer.isLimitReached || drivingTimer.isResting)) {
      return;
    }

    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await updateDriverProfile({ is_online: newStatus });
  };



  const handleAcceptOffer = async () => {
    if (!pendingOffer || !driverProfile) return;

    await supabase
      .from('ride_offers')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', pendingOffer.id);

    await supabase
      .from('rides')
      .update({ 
        status: 'accepted', 
        driver_id: driverProfile.id,
        vehicle_id: vehicle?.id,
        accepted_at: new Date().toISOString()
      })
      .eq('id', pendingOffer.ride_id);

    setCurrentRide({ ...pendingOffer.ride, status: 'accepted' });
    setPendingOffer(null);
  };

  const handleDeclineOffer = async () => {
    if (!pendingOffer) return;

    await supabase
      .from('ride_offers')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', pendingOffer.id);

    setPendingOffer(null);
  };

  const handleArrivedAtPickup = async () => {
    if (!currentRide) return;

    await supabase
      .from('rides')
      .update({ status: 'driver_arrived', driver_arrived_at: new Date().toISOString() })
      .eq('id', currentRide.id);

    setCurrentRide({ ...currentRide, status: 'driver_arrived' });
  };

  const handleStartRide = async () => {
    if (!currentRide) return;

    // ── Initialize trip tracking ──
    const startMs = Date.now();
    tripStartTimeRef.current = startMs;
    tripDistanceRef.current = 0;
    // Seed last location from current driver GPS so the very first segment
    // measures from "Start Ride" press, not from a stale earlier point.
    lastTripLocationRef.current = driverLocation
      ? { lat: driverLocation.lat, lng: driverLocation.lng }
      : null;
    setTripStartTime(startMs);
    setTripDistance(0);
    setTripElapsedSeconds(0);

    await supabase
      .from('rides')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', currentRide.id);

    setCurrentRide({ ...currentRide, status: 'in_progress' });
  };


  const handleEndRide = async () => {
    if (!currentRide || !driverProfile) return;

    setProcessingRide(true);

    try {
      // ── Compute ACTUAL trip metrics from GPS tracking ──
      const startMs = tripStartTimeRef.current;
      const actualDurationMinutes = startMs
        ? Math.max(1, Math.round((Date.now() - startMs) / 60000))
        : currentRide.estimated_duration_minutes;
      const accumulatedMiles = tripDistanceRef.current;

      // If GPS produced reasonable data (>= 0.1 mi), use it. Otherwise fall
      // back to the estimate so a driver isn't penalized by missing GPS perms.
      const useActualGps = accumulatedMiles >= 0.1;
      const actualDistanceMiles = useActualGps
        ? Math.round(accumulatedMiles * 100) / 100
        : currentRide.estimated_distance_miles;

      // ── Recalculate fare from ACTUAL trip data ──
      const riderCount = currentRide.rider_count || 1;
      const surgeMultiplier = currentRide.surge_multiplier || 1.0;
      const actualPricing = calculateRidePrice(
        actualDistanceMiles,
        actualDurationMinutes,
        riderCount,
        surgeMultiplier
      );
      const finalTotal = actualPricing.totalCost;

      // Earnings split based on the ACTUAL final total
      const split = calculateEarningsSplit(finalTotal);
      const driverEarnings = split.driverEarnings;
      const platformFee = split.platformFee;

      // Capture the payment through Stripe (use the actual final amount)
      if (currentRide.stripe_payment_intent_id) {
        await supabase.functions.invoke('stripe-capture-payment', {
          body: {
            ride_id: currentRide.id,
            payment_intent_id: currentRide.stripe_payment_intent_id,
            final_amount: finalTotal
          }
        });
      }

      // Update ride with actual trip metrics + recalculated fare
      await supabase
        .from('rides')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_distance_miles: actualDistanceMiles,
          actual_duration_minutes: actualDurationMinutes,
          final_total: finalTotal,
          base_fee: actualPricing.baseFee,
          distance_charge: actualPricing.distanceCharge,
          time_charge: actualPricing.timeCharge,
          surge_amount: actualPricing.surgeAmount,
          driver_earnings: driverEarnings,
          platform_fee: platformFee,
          payment_status: 'charged'
        })
        .eq('id', currentRide.id);

      // Update driver earnings
      await supabase
        .from('driver_profiles')
        .update({
          total_earnings: (driverProfile.total_earnings || 0) + driverEarnings,
          available_balance: (driverProfile.available_balance || 0) + driverEarnings
        })
        .eq('id', driverProfile.id);

      // ── Reset trip tracking state ──
      tripStartTimeRef.current = null;
      tripDistanceRef.current = 0;
      lastTripLocationRef.current = null;
      setTripStartTime(null);
      setTripDistance(0);
      setTripElapsedSeconds(0);

      setCurrentRide(null);
      setTodayEarnings(prev => prev + driverEarnings);
      setTodayRides(prev => prev + 1);
    } catch (error) {
      console.error('Error ending ride:', error);
    } finally {
      setProcessingRide(false);
    }
  };



  const handleCashOut = async (amount: number, payoutType: 'instant' | 'weekly') => {
    if (!driverProfile) throw new Error('Driver profile not found');

    const { data, error } = await supabase.functions.invoke('stripe-driver-payout', {
      body: {
        driver_id: driverProfile.id,
        amount: amount,
        payout_type: payoutType
      }
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || 'Failed to process payout');
    }

    // Refresh driver profile to get updated balance
    await updateDriverProfile({
      available_balance: driverProfile.available_balance - amount
    });
  };

  const handleNavigate = () => {
    if (!currentRide) return;
    
    // Open navigation in Google Maps or Apple Maps
    const destination = currentRide.status === 'accepted' || currentRide.status === 'driver_arrived'
      ? `${currentRide.pickup_lat},${currentRide.pickup_lng}`
      : `${currentRide.dropoff_lat},${currentRide.dropoff_lng}`;
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // ── Submit incident report from driver safety modal ──
  // Mirrors rider's handleReportSubmit but tags reporter_role='driver' so admins
  // can distinguish driver-initiated reports from rider-initiated reports.
  const handleReportSubmit = async (type: string, description: string) => {
    if (!currentRide || !user) return;

    // Look up the rider's auth user_id (for reported_against_user_id) so admins
    // can see who the driver is reporting. We swallow errors — the report
    // should still be saved even if this lookup fails.
    let reportedAgainstUserId: string | null = null;
    try {
      const { data: riderProfile } = await supabase
        .from('rider_profiles')
        .select('user_id')
        .eq('id', currentRide.rider_id)
        .maybeSingle();
      if (riderProfile?.user_id) {
        reportedAgainstUserId = riderProfile.user_id;
      }
    } catch (e) {
      console.error('Failed to look up rider user_id for incident report:', e);
    }

    const { error } = await supabase.from('incidents').insert({
      ride_id: currentRide.id,
      reported_by_user_id: user.id,
      reported_against_user_id: reportedAgainstUserId,
      incident_type: type,
      description: description,
      reporter_role: 'driver',
    });

    if (error) {
      console.error('Failed to save driver incident report:', error);
    }
  };


  // Get pickup and dropoff locations for map
  const pickupLocation = currentRide ? {
    lat: currentRide.pickup_lat,
    lng: currentRide.pickup_lng,
    address: currentRide.pickup_address
  } : null;

  const dropoffLocation = currentRide ? {
    lat: currentRide.dropoff_lat,
    lng: currentRide.dropoff_lng,
    address: currentRide.dropoff_address
  } : null;

  if (driverProfile?.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <ClockIcon className="text-amber-600" size={32} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Account Pending Approval</h2>
          <p className="mt-2 text-gray-600">
            Your driver account is currently being reviewed. You'll receive an email once approved.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Status: <span className="font-medium capitalize">{driverProfile?.status?.replace('_', ' ')}</span>
          </p>
          <button
            onClick={logout}
            className="mt-6 px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Show bonuses page if active
  if (showBonusesPage) {
    return <DriverBonusesPage onBack={() => setShowBonusesPage(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
            <div>
              <p className="text-sm text-gray-500">Driver Dashboard</p>
              <p className="text-xs text-gray-400">Welcome, {user?.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicator Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
              isOnline 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                isOnline 
                  ? 'bg-green-500 animate-pulse' 
                  : 'bg-gray-400'
              }`} />
              {isOnline ? 'Available' : 'Offline'}
            </div>

            {/* Driver Rating Display */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
              <svg className="w-5 h-5 text-amber-400 fill-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span className="font-semibold text-amber-700">
                {driverProfile?.average_rating ? Number(driverProfile.average_rating).toFixed(1) : 'New'}
              </span>
              {(driverProfile?.total_ratings ?? 0) > 0 && (
                <span className="text-sm text-amber-600">
                  ({driverProfile?.total_ratings} {driverProfile?.total_ratings === 1 ? 'rating' : 'ratings'})
                </span>
              )}
            </div>

            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('drive')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'drive'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Drive
              </button>
              <button
                onClick={() => setActiveTab('earnings')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'earnings'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Earnings
              </button>
              <button
                onClick={() => setActiveTab('bonuses')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'bonuses'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <GiftIcon size={16} />
                Bonuses
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'payouts'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <BankIcon size={16} />
                Payouts
                {!payoutsEnabled && (
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>


      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Payout Setup Alert */}
        {!payoutsEnabled && activeTab === 'drive' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-medium text-amber-800">Set Up Payouts to Start Driving</p>
                <p className="text-sm text-amber-700 mt-1">
                  You need to connect your bank account before you can go online and accept rides.
                </p>
                <button
                  onClick={() => setActiveTab('payouts')}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Set Up Payouts
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Drive Tab */}
        {activeTab === 'drive' && (
          <>
            {/* ── 12-Hour Driving Limit: LIMIT REACHED Banner ── */}
            {drivingTimer.isLimitReached && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangleIcon className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800">You have reached the 12-hour driving limit. Please rest before continuing.</p>
                    <p className="text-sm text-red-700 mt-1">
                      Active driving time: {drivingTimer.formattedActiveTime}. You must be offline for at least 6 hours before you can go online again.
                    </p>
                    {drivingTimer.isResting && drivingTimer.restMinutesRemaining !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm text-red-700 mb-1">
                          <span>Rest period remaining</span>
                          <span className="font-semibold">
                            {Math.floor(drivingTimer.restMinutesRemaining / 60)}h {drivingTimer.restMinutesRemaining % 60}m
                          </span>
                        </div>
                        <div className="h-2 bg-red-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.max(0, 100 - (drivingTimer.restMinutesRemaining / 360) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── 12-Hour Driving Limit: 10-HOUR WARNING Banner ── */}
            {drivingTimer.isWarning && !drivingTimer.isLimitReached && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-800">You have 2 hours remaining before required rest.</p>
                    <p className="text-sm text-amber-700 mt-1">
                      You've been driving for {drivingTimer.formattedActiveTime}. Time remaining: {drivingTimer.formattedRemainingTime}.
                      For your safety, you will be taken offline after 12 hours of active driving.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Driving Time Progress (shown when online or has accumulated time) ── */}
            {(isOnline || drivingTimer.activeMinutes > 0) && !drivingTimer.isLimitReached && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ClockIcon className={drivingTimer.isWarning ? 'text-amber-600' : 'text-gray-500'} size={16} />
                    <span className="text-sm font-medium text-gray-700">Active Driving Time</span>
                  </div>
                  <span className={`text-sm font-semibold ${drivingTimer.isWarning ? 'text-amber-700' : 'text-gray-900'}`}>
                    {drivingTimer.formattedActiveTime} / 12h
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      drivingTimer.isWarning ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (drivingTimer.activeHours / 12) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {drivingTimer.formattedRemainingTime} remaining &middot; 12-hour max per 24-hour period
                </p>
              </div>
            )}

            {/* Go Online / Go Offline Toggle */}
            <div className={`rounded-2xl p-6 ${
              drivingTimer.isLimitReached || drivingTimer.isResting
                ? 'bg-red-800'
                : isOnline ? 'bg-green-600' : 'bg-gray-800'
            } transition-colors`}>
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <h2 className="text-2xl font-bold">
                    {drivingTimer.isLimitReached || drivingTimer.isResting
                      ? 'Rest Required'
                      : isOnline ? "You're Online" : "You're Offline"}
                  </h2>
                  <p className="text-white/80 mt-1">
                    {drivingTimer.isLimitReached || drivingTimer.isResting
                      ? 'You must rest for 6 hours before driving again'
                      : isOnline 
                        ? 'Waiting for ride requests...' 
                        : payoutsEnabled 
                          ? 'Go online to start receiving rides' 
                          : 'Set up payouts to go online'}
                  </p>
                  {/* GPS Tracking Notice */}
                  {isOnline && (
                    <div className="flex items-center gap-2 mt-3 text-white/70 text-sm">
                      <ShieldIcon size={14} />
                      <span>GPS tracking active — tracking stops when you go offline</span>
                    </div>
                  )}
                  {!isOnline && !(drivingTimer.isLimitReached || drivingTimer.isResting) && (
                    <div className="flex items-center gap-2 mt-3 text-white/50 text-sm">
                      <ShieldIcon size={14} />
                      <span>GPS tracking inactive — your location is not being tracked</span>
                    </div>
                  )}
                  {isOnline && driverLocation && (
                    <p className="text-white/50 text-xs mt-1">
                      Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={toggleOnline}
                    disabled={!!currentRide || drivingTimer.isLimitReached || drivingTimer.isResting}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      drivingTimer.isLimitReached || drivingTimer.isResting
                        ? 'bg-red-900 text-red-400 cursor-not-allowed opacity-60'
                        : isOnline 
                          ? 'bg-white text-green-600 hover:bg-green-50' 
                          : payoutsEnabled 
                            ? 'bg-green-500 text-white hover:bg-green-400'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    } ${currentRide ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <PowerIcon size={36} />
                  </button>
                  <span className="text-white/60 text-xs font-medium">
                    {drivingTimer.isLimitReached || drivingTimer.isResting
                      ? 'Resting'
                      : isOnline ? 'Go Offline' : 'Go Online'}
                  </span>
                </div>
              </div>
            </div>


            {/* Map Section - Show when online or has current ride */}
            {(isOnline || currentRide) && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <MapboxMap
                  pickup={pickupLocation}
                  dropoff={currentRide?.status === 'in_progress' ? dropoffLocation : null}
                  driverLocation={driverLocation}
                  showRoute={!!currentRide}
                  interactive={false}
                  height="300px"
                  isDriver={true}
                  onNavigate={currentRide ? handleNavigate : undefined}
                />
              </div>
            )}

            {currentRide && (() => {
              const rideRiderCount = currentRide.rider_count || 1;
              const rideSharedMult = currentRide.shared_ride_multiplier || SHARED_RIDE_MULTIPLIERS[rideRiderCount] || 1.0;
              const rideSurgeMult = currentRide.surge_multiplier || 1.0;

              // Derive fare line items from ride data or recalculate
              const currentPricing = calculateRidePrice(
                currentRide.estimated_distance_miles,
                currentRide.estimated_duration_minutes,
                rideRiderCount,
                rideSurgeMult
              );
              const crBaseFee = currentRide.base_fee ?? currentPricing.baseFee;
              const crDistCharge = currentRide.distance_charge ?? currentPricing.distanceCharge;
              const crTimeCharge = currentRide.time_charge ?? currentPricing.timeCharge;
              const crSurgeAmount = currentRide.surge_amount ?? currentPricing.surgeAmount;

              return (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-orange-600 p-4 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg">Current Ride</h3>
                      <p className="text-orange-200 capitalize">{currentRide.status.replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* ── EMERGENCY / SAFETY BUTTON — only while ride is in_progress ── */}
                      {currentRide.status === 'in_progress' && (
                        <button
                          onClick={() => setShowSafety(true)}
                          aria-label="Open safety center"
                          title="Safety / Emergency"
                          className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors ring-2 ring-white/40 shadow-lg"
                        >
                          <ShieldIcon size={20} />
                        </button>
                      )}
                      <button
                        onClick={handleNavigate}
                        className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                      >
                        <NavigationIcon size={18} />
                        Navigate
                      </button>
                    </div>
                  </div>

                  {/* Fare context badges in header */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-xs font-medium">
                      <UsersIcon size={12} /> {rideRiderCount} {rideRiderCount === 1 ? 'Rider' : 'Riders'}
                    </span>
                    {rideRiderCount > 1 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-xs font-medium">
                        <TrendingUpIcon size={12} /> Shared {rideSharedMult.toFixed(2)}x
                      </span>
                    )}
                    {rideSurgeMult > 1.0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-xs font-medium">
                        <ZapIcon size={12} /> Surge {rideSurgeMult.toFixed(1)}x
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPinIcon className="text-green-600" size={20} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pickup</p>
                      <p className="font-medium text-gray-900">{currentRide.pickup_address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <NavigationIcon className="text-red-600" size={20} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Dropoff</p>
                      <p className="font-medium text-gray-900">{currentRide.dropoff_address}</p>
                    </div>
                  </div>

                  {/* Ride stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Distance</p>
                      <p className="font-semibold text-gray-900">{currentRide.estimated_distance_miles} mi</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Est. Time</p>
                      <p className="font-semibold text-gray-900">{currentRide.estimated_duration_minutes} min</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Total Fare</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(currentRide.estimated_total)}</p>
                    </div>
                  </div>

                  {/* ── LIVE TRIP TRACKING (only during in_progress) ── */}
                  {currentRide.status === 'in_progress' && tripStartTime && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-semibold text-green-800">Live Trip Tracking</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Distance Traveled</p>
                          <p className="text-2xl font-bold text-green-900 tabular-nums">
                            {tripDistance.toFixed(2)} <span className="text-sm font-medium">mi</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Trip Duration</p>
                          <p className="text-2xl font-bold text-green-900 tabular-nums">
                            {Math.floor(tripElapsedSeconds / 60)}:{String(tripElapsedSeconds % 60).padStart(2, '0')}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-green-700 mt-2">
                        Final fare will be calculated from actual distance and time at end of ride.
                      </p>
                    </div>
                  )}


                  {/* Earnings Breakdown with Tooltip */}
                  <EarningsSplitBreakdown
                    totalFare={currentRide.estimated_total}
                    riderCount={rideRiderCount}
                    sharedRideMultiplier={rideSharedMult}
                    surgeMultiplier={rideSurgeMult}
                    distanceMiles={currentRide.estimated_distance_miles}
                    durationMinutes={currentRide.estimated_duration_minutes}
                    baseFee={crBaseFee}
                    distanceCharge={crDistCharge}
                    timeCharge={crTimeCharge}
                    surgeAmount={crSurgeAmount}
                    variant="inline"
                    showTooltip={true}
                  />

                  {/* Action Buttons */}
                  <div className="pt-4">
                    {currentRide.status === 'accepted' && (
                      <button
                        onClick={handleArrivedAtPickup}
                        className="w-full py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                      >
                        <MapPinIcon size={20} /> I've Arrived at Pickup
                      </button>
                    )}
                    {currentRide.status === 'driver_arrived' && (
                      <button
                        onClick={handleStartRide}
                        className="w-full py-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                      >
                        <CarIcon size={20} /> Start Ride
                      </button>
                    )}
                    {currentRide.status === 'in_progress' && (
                      <button
                        onClick={handleEndRide}
                        disabled={processingRide}
                        className="w-full py-4 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
                      >
                        {processingRide ? (
                          <>
                            <RefreshIcon className="animate-spin" size={20} />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon size={20} /> Complete Ride
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}



            {/* Vehicle Info */}
            {vehicle && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Vehicle</h3>
                <div className="flex items-center gap-4">
                  <img 
                    src={VEHICLE_IMAGES[0]} 
                    alt="Vehicle" 
                    className="w-24 h-24 rounded-xl object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-gray-500">{vehicle.color}</p>
                    <p className="text-sm text-gray-400 mt-1">Plate: {vehicle.license_plate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Independent Contractor Notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 text-center">
                Drivers on sitNride are independent contractors, not employees. You control your own schedule and driving activity. 
                sitNride is a technology platform that connects riders with independent drivers.
              </p>
            </div>
          </>
        )}

        {/* Earnings Tab - Comprehensive Dashboard */}
        {activeTab === 'earnings' && (
          <DriverEarningsDashboard />
        )}

        {/* Bonuses Tab */}
        {activeTab === 'bonuses' && (
          <DriverBonusesPage onBack={() => setActiveTab('drive')} />
        )}

        {/* Payouts Tab */}
        {activeTab === 'payouts' && (
          <StripeConnectSetup
            onStatusChange={(status) => {
              setPayoutsEnabled(status.payoutsEnabled);
            }}
          />
        )}

      </main>

      {/* Ride Offer Modal */}
      {pendingOffer && (
        <RideOfferModal
          offer={pendingOffer}
          onAccept={handleAcceptOffer}
          onDecline={handleDeclineOffer}
          timeLeft={offerTimeLeft}
        />
      )}

      {/* Cash Out Modal */}
      <CashOutModal
        isOpen={showCashOut}
        onClose={() => setShowCashOut(false)}
        availableBalance={driverProfile?.available_balance || 0}
        payoutsEnabled={payoutsEnabled}
        onCashOut={handleCashOut}
      />

      {/* ── Driver Safety / Emergency Modal ── */}
      <DriverSafetyModal
        isOpen={showSafety}
        onClose={() => setShowSafety(false)}
        rideId={currentRide?.id || ''}
        rideStatus={currentRide?.status}
        driverLocation={driverLocation}
        user={user}
        currentRide={currentRide}
        onReportSubmit={handleReportSubmit}
      />

    </div>

  );
};

export default DriverDashboard;
