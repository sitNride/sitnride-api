import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { database as supabase } from '@/lib/database';
import { Ride } from '@/types';
import {
  formatCurrency, calculateRidePrice,
  BASE_FEE, PER_MILE_RATE, PER_MINUTE_RATE,
  SHARED_RIDE_MULTIPLIERS,
} from '@/lib/pricing';
import { downloadReceiptPDF, downloadReceiptText } from '@/lib/receiptPdf';
import {
  ChevronLeftIcon, MapPinIcon, NavigationIcon, ClockIcon,
  CarIcon, DollarIcon, DownloadIcon, MailIcon, PrinterIcon,
  CheckCircleIcon, XCircleIcon, UsersIcon, ShareIcon, CopyIcon,
  InfoIcon, ZapIcon, ChevronDownIcon, ChevronUpIcon,
} from '@/components/ui/Icons';

interface RideWithDriver extends Ride {
  driver?: {
    user?: {
      full_name: string;
      email?: string;
    };
    average_rating?: number;
  };
  rider?: {
    user?: {
      full_name: string;
      email?: string;
    };
  };
}

const RideReceiptPage: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const [ride, setRide] = useState<RideWithDriver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showPricingInfo, setShowPricingInfo] = useState(false);

  useEffect(() => {
    if (rideId) {
      loadRide(rideId);
    }
  }, [rideId]);

  const loadRide = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('rides')
        .select(`
          *,
          driver:driver_profiles(
            user:users(full_name, email),
            average_rating
          ),
          rider:rider_profiles(
            user:users(full_name, email)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Ride not found');

      setRide(data as RideWithDriver);
      if (data.rider?.user?.email) {
        setEmailInput(data.rider.user.email);
      }
    } catch (err: any) {
      console.error('Error loading ride:', err);
      setError(err.message || 'Failed to load ride details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!ride) return;
    downloadReceiptPDF({ ride, driverName: ride.driver?.user?.full_name });
  };

  const handleDownloadText = () => {
    if (!ride) return;
    downloadReceiptText({ ride, driverName: ride.driver?.user?.full_name });
  };

  const handleEmailReceipt = async () => {
    if (!ride || !emailInput) return;
    setEmailSending(true);
    try {
      const { error } = await supabase.functions.invoke('email-receipt', {
        body: { rideId: ride.id, recipientEmail: emailInput },
      });
      if (error) throw error;
      setEmailSent(true);
      setShowEmailForm(false);
      setTimeout(() => setEmailSent(false), 5000);
    } catch (err) {
      console.error('Error sending receipt email:', err);
    } finally {
      setEmailSending(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handlePrint = () => window.print();

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  /* ─── Loading / Error ─────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-500 font-medium">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <XCircleIcon className="mx-auto text-red-400" size={48} />
          <h2 className="mt-4 text-xl font-bold text-gray-900">Receipt Not Found</h2>
          <p className="mt-2 text-gray-500">{error || 'The ride receipt you are looking for does not exist.'}</p>
          <button onClick={() => navigate('/')} className="mt-6 px-6 py-3 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  /* ─── Derived pricing values ──────────────────────────────── */
  const total = ride.final_total || ride.estimated_total;
  const distance = ride.actual_distance_miles || ride.estimated_distance_miles;
  const duration = ride.actual_duration_minutes || ride.estimated_duration_minutes;
  const riderCount = ride.rider_count || 1;
  const costPerPerson = ride.cost_per_person || total;
  const sharedMultiplier = ride.shared_ride_multiplier || 1.0;
  const surgeMultiplier = ride.surge_multiplier || 1.0;
  const surgeAmount = ride.surge_amount || 0;
  const baseFee = ride.base_fee || BASE_FEE;
  const perMileRate = ride.per_mile_rate || PER_MILE_RATE;
  const perMinuteRate = ride.per_minute_rate || PER_MINUTE_RATE;
  const distanceCharge = ride.distance_charge ?? +(distance * perMileRate).toFixed(2);
  const timeCharge = ride.time_charge ?? +(duration * perMinuteRate).toFixed(2);
  const subtotal = +(baseFee + distanceCharge + timeCharge).toFixed(2);
  const driverName = ride.driver?.user?.full_name;

  // Compute savings using the canonical pricing engine
  const pricing = calculateRidePrice(distance, duration, riderCount, surgeMultiplier);
  const savingsPerPerson = pricing.savingsPerPerson;
  const savingsPercentage = pricing.savingsPercentage;

  // Solo price for comparison
  const soloPrice = calculateRidePrice(distance, duration, 1, surgeMultiplier).totalCost;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeftIcon size={24} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Ride Receipt</h1>
                <p className="text-sm text-gray-500">#{ride.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <Link to="/" className="text-2xl font-extrabold tracking-tight">
              sit<span className="text-orange-600">N</span>ride
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── Main Receipt Card ──────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" id="receipt-content">
              {/* Orange Header */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-8 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-200 text-sm font-medium">RIDE RECEIPT</p>
                    <h2 className="text-3xl font-extrabold mt-1">sit<span className="text-white">N</span>ride</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-extrabold">{formatCurrency(total)}</p>
                    {riderCount > 1 && (
                      <p className="text-orange-200 text-sm mt-1">{formatCurrency(costPerPerson)} per person</p>
                    )}
                  </div>
                </div>
                {/* Context badges in header */}
                {(riderCount > 1 || surgeMultiplier > 1) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {riderCount > 1 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">
                        <UsersIcon size={12} />
                        {riderCount} Riders
                      </span>
                    )}
                    {sharedMultiplier > 1 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm">
                        {sharedMultiplier}x Shared Multiplier
                      </span>
                    )}
                    {surgeMultiplier > 1 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/30 backdrop-blur-sm">
                        <ZapIcon size={12} />
                        {surgeMultiplier.toFixed(1)}x Surge
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="px-8 py-5 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-gray-500">{formatDate(ride.requested_at)}</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                  ride.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {ride.status === 'completed' ? <CheckCircleIcon size={14} /> : <XCircleIcon size={14} />}
                  {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                </span>
              </div>

              <div className="p-8 space-y-8">
                {/* ── "You saved" callout ── */}
                {riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarIcon className="text-green-600" size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-green-800 text-lg">
                        You saved {formatCurrency(savingsPerPerson)} by sharing!
                      </p>
                      <p className="text-green-600 text-sm mt-1">
                        That's {savingsPercentage}% less than riding solo. Splitting with {riderCount} riders
                        brought your cost down to just {formatCurrency(costPerPerson)} per person.
                      </p>
                      {/* Solo vs Shared comparison */}
                      <div className="mt-3 flex items-center gap-4">
                        <div className="bg-white/70 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Solo price</p>
                          <p className="text-sm font-bold text-gray-500 line-through">{formatCurrency(soloPrice)}</p>
                        </div>
                        <div className="text-green-500">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </div>
                        <div className="bg-green-100 rounded-lg px-3 py-2 text-center">
                          <p className="text-xs text-green-600 uppercase tracking-wider">Your price</p>
                          <p className="text-sm font-bold text-green-700">{formatCurrency(costPerPerson)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trip Route */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Trip Route</h3>
                  <div className="bg-gray-50 rounded-xl p-5">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-green-500 ring-4 ring-green-100" />
                        <div className="w-0.5 flex-1 bg-gradient-to-b from-green-300 to-red-300 my-2 min-h-[40px]" />
                        <div className="w-3.5 h-3.5 rounded-full bg-red-500 ring-4 ring-red-100" />
                      </div>
                      <div className="flex-1 space-y-5">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Pickup</p>
                          <p className="font-semibold text-gray-900 mt-1">{ride.pickup_address}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {ride.started_at ? formatTime(ride.started_at) : formatTime(ride.requested_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Dropoff</p>
                          <p className="font-semibold text-gray-900 mt-1">{ride.dropoff_address}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {ride.completed_at ? formatTime(ride.completed_at) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trip Stats */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Trip Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {driverName && (
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <CarIcon className="mx-auto text-gray-400 mb-2" size={22} />
                        <p className="text-sm font-bold text-gray-900">{driverName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Driver</p>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <NavigationIcon className="mx-auto text-gray-400 mb-2" size={22} />
                      <p className="text-lg font-bold text-gray-900">{distance.toFixed(1)} mi</p>
                      <p className="text-xs text-gray-500 mt-0.5">Distance</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <ClockIcon className="mx-auto text-gray-400 mb-2" size={22} />
                      <p className="text-lg font-bold text-gray-900">{Math.round(duration)} min</p>
                      <p className="text-xs text-gray-500 mt-0.5">Duration</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <UsersIcon className="mx-auto text-gray-400 mb-2" size={22} />
                      <p className="text-lg font-bold text-gray-900">{riderCount}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{riderCount === 1 ? 'Rider' : 'Riders'}</p>
                    </div>
                  </div>
                </div>

                {/* ── Fare Breakdown ── */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <DollarIcon size={16} />
                    Fare Breakdown
                  </h3>

                  {/* Context badges */}
                  {(riderCount > 1 || surgeMultiplier > 1) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {riderCount > 1 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3 w-full">
                          <UsersIcon className="text-orange-600 flex-shrink-0" size={20} />
                          <div>
                            <p className="font-semibold text-orange-800 text-sm">Shared Ride — {riderCount} Riders</p>
                            <p className="text-orange-600 text-xs mt-0.5">
                              Shared ride multiplier: {sharedMultiplier}x applied to base fare
                            </p>
                          </div>
                        </div>
                      )}
                      {surgeMultiplier > 1 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 w-full">
                          <ZapIcon className="text-red-600 flex-shrink-0" size={20} />
                          <div>
                            <p className="font-semibold text-red-800 text-sm">Surge Pricing — {surgeMultiplier.toFixed(1)}x</p>
                            <p className="text-red-600 text-xs mt-0.5">
                              High demand added {formatCurrency(surgeAmount)} to this ride
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {/* Base Fee */}
                    <div className="flex justify-between py-3 text-sm">
                      <span className="text-gray-600">Base Fee</span>
                      <span className="font-medium text-gray-900">{formatCurrency(baseFee)}</span>
                    </div>

                    {/* Distance Charge */}
                    <div className="flex justify-between py-3 text-sm border-t border-gray-100">
                      <span className="text-gray-600">
                        Distance ({distance.toFixed(1)} mi × {formatCurrency(perMileRate)}/mi)
                      </span>
                      <span className="font-medium text-gray-900">{formatCurrency(distanceCharge)}</span>
                    </div>

                    {/* Time Charge */}
                    <div className="flex justify-between py-3 text-sm border-t border-gray-100">
                      <span className="text-gray-600">
                        Time ({Math.round(duration)} min × {formatCurrency(perMinuteRate)}/min)
                      </span>
                      <span className="font-medium text-gray-900">{formatCurrency(timeCharge)}</span>
                    </div>

                    {/* Subtotal */}
                    <div className="flex justify-between py-3 text-sm border-t border-dashed border-gray-300 bg-gray-50 -mx-2 px-2 rounded-lg">
                      <span className="text-gray-700 font-medium">Subtotal</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
                    </div>

                    {/* Shared Ride Multiplier */}
                    {sharedMultiplier > 1 && (
                      <div className="flex justify-between py-3 text-sm border-t border-gray-100">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          <UsersIcon size={14} className="text-orange-500" />
                          Shared Ride Multiplier ({riderCount} riders)
                        </span>
                        <span className="font-medium text-orange-600">×{sharedMultiplier}</span>
                      </div>
                    )}

                    {/* Surge Multiplier */}
                    {surgeMultiplier > 1 && (
                      <div className="flex justify-between py-3 text-sm border-t border-gray-100">
                        <span className="text-gray-600 flex items-center gap-1.5">
                          <ZapIcon size={14} className="text-red-500" />
                          Surge Pricing ({surgeMultiplier.toFixed(1)}x)
                        </span>
                        <span className="font-medium text-red-600">+{formatCurrency(surgeAmount)}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="border-t-2 border-gray-900 pt-4 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">Total Fare</span>
                        <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(total)}</span>
                      </div>
                      {/* Calculation formula */}
                      {(sharedMultiplier > 1 || surgeMultiplier > 1) && (
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          {formatCurrency(subtotal)}
                          {sharedMultiplier > 1 ? ` × ${sharedMultiplier}` : ''}
                          {surgeMultiplier > 1 ? ` × ${surgeMultiplier.toFixed(1)}` : ''}
                          {' = '}{formatCurrency(total)}
                        </p>
                      )}
                    </div>

                    {/* Cost Per Person */}
                    {riderCount > 1 && (
                      <div className="bg-orange-50 rounded-xl p-4 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-orange-700">Cost Per Person</span>
                          <span className="text-xl font-bold text-orange-700">{formatCurrency(costPerPerson)}</span>
                        </div>
                        <p className="text-xs text-orange-500 mt-1">
                          {formatCurrency(total)} ÷ {riderCount} riders = {formatCurrency(costPerPerson)} each
                        </p>
                      </div>
                    )}

                    {/* Savings callout (inline) */}
                    {riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0 && (
                      <div className="bg-green-50 rounded-xl p-4 mt-3 flex items-center justify-between">
                        <span className="font-semibold text-green-700 text-sm">Your Savings</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-700">{formatCurrency(savingsPerPerson)}</span>
                          <span className="text-xs text-green-500 ml-2">({savingsPercentage}% off solo)</span>
                        </div>
                      </div>
                    )}

                    {/* Tip */}
                    {ride.tip_amount != null && ride.tip_amount > 0 && (
                      <div className="flex justify-between py-3 text-sm border-t border-gray-100 mt-2">
                        <span className="text-gray-600">Tip</span>
                        <span className="font-medium text-green-600">{formatCurrency(ride.tip_amount)}</span>
                      </div>
                    )}

                    {/* Refund */}
                    {ride.status === 'cancelled' && ride.payment_status === 'refunded' && (
                      <div className="flex justify-between bg-green-50 rounded-xl p-4 mt-3 text-green-700">
                        <span className="font-semibold">Refunded</span>
                        <span className="font-bold">{formatCurrency(ride.estimated_total)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── How Pricing Works (expandable) ── */}
                <div className="border-t pt-6">
                  <button
                    onClick={() => setShowPricingInfo(!showPricingInfo)}
                    className="w-full flex items-center justify-between text-sm text-gray-500 hover:text-gray-700 transition-colors group"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <InfoIcon size={16} className="text-gray-400 group-hover:text-orange-500 transition-colors" />
                      How pricing works
                    </span>
                    {showPricingInfo ? <ChevronUpIcon size={18} /> : <ChevronDownIcon size={18} />}
                  </button>

                  {showPricingInfo && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-5 space-y-4 text-sm animate-in fade-in duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Base Fare Calculation</h4>
                        <p className="text-gray-600">
                          Every ride starts with a <strong>{formatCurrency(BASE_FEE)}</strong> base fee, plus{' '}
                          <strong>{formatCurrency(PER_MILE_RATE)}/mile</strong> and{' '}
                          <strong>{formatCurrency(PER_MINUTE_RATE)}/minute</strong>.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Shared Ride Multipliers</h4>
                        <p className="text-gray-600 mb-2">
                          When you share a ride, a small multiplier is applied to the base fare, then the total is split evenly among all riders — saving everyone money.
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(SHARED_RIDE_MULTIPLIERS).map(([count, mult]) => (
                            <div
                              key={count}
                              className={`text-center p-2 rounded-lg border ${
                                Number(count) === riderCount
                                  ? 'bg-orange-100 border-orange-300 ring-2 ring-orange-200'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <p className="text-xs text-gray-500">{count} {Number(count) === 1 ? 'rider' : 'riders'}</p>
                              <p className={`font-bold text-sm ${Number(count) === riderCount ? 'text-orange-700' : 'text-gray-700'}`}>
                                {mult}x
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Surge Pricing</h4>
                        <p className="text-gray-600">
                          During periods of high demand, a surge multiplier (1.0x–2.5x) may be applied. This helps ensure drivers are available when you need them most.
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Your ride formula</p>
                        <p className="font-mono text-xs text-gray-700">
                          ({formatCurrency(baseFee)} + {formatCurrency(distanceCharge)} + {formatCurrency(timeCharge)})
                          {sharedMultiplier > 1 ? ` × ${sharedMultiplier}` : ''}
                          {surgeMultiplier > 1 ? ` × ${surgeMultiplier.toFixed(1)}` : ''}
                          {riderCount > 1 ? ` ÷ ${riderCount}` : ''}
                          {' = '}
                          <strong className="text-orange-600">{formatCurrency(riderCount > 1 ? costPerPerson : total)}</strong>
                          {riderCount > 1 ? ' per person' : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Status */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Payment Status</span>
                    <span className={`font-semibold px-3 py-1 rounded-full text-xs ${
                      ride.payment_status === 'charged' ? 'bg-green-100 text-green-700' :
                      ride.payment_status === 'refunded' ? 'bg-blue-100 text-blue-700' :
                      ride.payment_status === 'authorized' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {ride.payment_status.charAt(0).toUpperCase() + ride.payment_status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="bg-gray-50 border-t px-8 py-5 text-center">
                <p className="text-sm text-gray-500">Thank you for riding with sitNride!</p>
                <p className="text-xs text-gray-400 mt-1">Questions? Email us at support@sitNride.net</p>
              </div>
            </div>
          </div>

          {/* ─── Sidebar Actions ────────────────────────────── */}
          <div className="space-y-6 print:hidden">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Receipt Actions</h3>
              <div className="space-y-3">
                <button onClick={handleDownloadPDF} className="w-full py-3 px-4 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2">
                  <DownloadIcon size={18} />
                  Download PDF
                </button>
                <button onClick={() => setShowEmailForm(!showEmailForm)} className="w-full py-3 px-4 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all flex items-center justify-center gap-2">
                  <MailIcon size={18} />
                  {emailSent ? 'Receipt Sent!' : 'Email Receipt'}
                </button>
                <button onClick={handlePrint} className="w-full py-3 px-4 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center gap-2">
                  <PrinterIcon size={18} />
                  Print Receipt
                </button>
                <button onClick={handleDownloadText} className="w-full py-3 px-4 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-gray-300 transition-colors flex items-center justify-center gap-2">
                  <DownloadIcon size={18} />
                  Download Text
                </button>
              </div>

              {/* Email Form */}
              {showEmailForm && (
                <div className="mt-4 pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Send receipt to:</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
                  />
                  <button
                    onClick={handleEmailReceipt}
                    disabled={emailSending || !emailInput}
                    className="w-full mt-3 py-3 px-4 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {emailSending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MailIcon size={16} />
                        Send Receipt
                      </>
                    )}
                  </button>
                </div>
              )}

              {emailSent && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600" size={16} />
                    <p className="text-sm text-green-700 font-medium">Receipt sent to {emailInput}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Share Receipt */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Share Receipt</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={window.location.href}
                  readOnly
                  className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`p-2.5 rounded-lg transition-all ${copySuccess ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title="Copy link"
                >
                  {copySuccess ? <CheckCircleIcon size={18} /> : <CopyIcon size={18} />}
                </button>
              </div>
              {copySuccess && <p className="text-xs text-green-600 mt-2 font-medium">Link copied to clipboard!</p>}
            </div>

            {/* Fare Summary Card */}
            <div className="bg-gradient-to-br from-orange-600 to-orange-500 rounded-2xl shadow-sm p-6 text-white">
              <h3 className="font-bold text-white/90 text-sm uppercase tracking-wider mb-4">Fare Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-200">Base Fee</span>
                  <span className="font-medium">{formatCurrency(baseFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-200">Distance</span>
                  <span className="font-medium">{formatCurrency(distanceCharge)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-orange-200">Time</span>
                  <span className="font-medium">{formatCurrency(timeCharge)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/20 pt-2">
                  <span className="text-orange-200">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {sharedMultiplier > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-200">Shared ({riderCount} riders)</span>
                    <span className="font-medium">×{sharedMultiplier}</span>
                  </div>
                )}
                {surgeMultiplier > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-200">Surge ({surgeMultiplier.toFixed(1)}x)</span>
                    <span className="font-medium">+{formatCurrency(surgeAmount)}</span>
                  </div>
                )}
                <div className="border-t border-white/30 pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold">Total</span>
                    <span className="text-2xl font-extrabold">{formatCurrency(total)}</span>
                  </div>
                  {riderCount > 1 && (
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-orange-200">Per Person</span>
                      <span className="font-bold text-lg">{formatCurrency(costPerPerson)}</span>
                    </div>
                  )}
                  {riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0 && (
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-green-200">You Saved</span>
                      <span className="font-bold text-green-200">{formatCurrency(savingsPerPerson)} ({savingsPercentage}%)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex gap-3">
                <InfoIcon className="text-blue-500 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-blue-800">Need help?</p>
                  <p className="text-xs text-blue-600 mt-1">
                    If you have questions about this receipt or need to dispute a charge,
                    please contact us at{' '}
                    <a href="mailto:support@sitNride.net" className="underline font-medium">support@sitNride.net</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Print-only footer */}
      <div className="hidden print:block text-center py-8">
        <p className="text-sm text-gray-500">Thank you for riding with sitNride!</p>
        <p className="text-xs text-gray-400">support@sitNride.net</p>
      </div>
    </div>
  );
};

export default RideReceiptPage;
