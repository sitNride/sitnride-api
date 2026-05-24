import React, { useRef } from 'react';
import { Ride } from '@/types';
import {
  formatCurrency, calculateRidePrice,
  BASE_FEE, PER_MILE_RATE, PER_MINUTE_RATE,
} from '@/lib/pricing';
import {
  XIcon, MapPinIcon, NavigationIcon, ClockIcon,
  CarIcon, DollarIcon, PrinterIcon, DownloadIcon,
  CheckCircleIcon, XCircleIcon, UsersIcon, ZapIcon, InfoIcon,
} from '@/components/ui/Icons';

interface RideReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  ride: Ride;
  driverName?: string;
}

const RideReceiptModal: React.FC<RideReceiptModalProps> = ({
  isOpen,
  onClose,
  ride,
  driverName,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  /* ─── Helpers ─────────────────────────────────────────────── */
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

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

  // Compute savings via the canonical pricing engine
  const pricing = calculateRidePrice(distance, duration, riderCount, surgeMultiplier);
  const savingsPerPerson = pricing.savingsPerPerson;
  const savingsPercentage = pricing.savingsPercentage;

  // Solo price for comparison
  const soloPrice = calculateRidePrice(distance, duration, 1, surgeMultiplier).totalCost;

  /* ─── Print handler ───────────────────────────────────────── */
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ride Receipt - ${ride.id.slice(0, 8)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; }
            .logo span { color: #ea580c; }
            .receipt-title { font-size: 14px; color: #666; margin-top: 5px; }
            .section { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
            .section-title { font-weight: 600; margin-bottom: 10px; color: #333; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .label { color: #666; }
            .value { font-weight: 500; }
            .total-row { font-size: 18px; font-weight: bold; margin-top: 15px; padding-top: 15px; border-top: 2px solid #333; }
            .subtotal-row { background: #f9fafb; padding: 8px 12px; border-radius: 6px; margin: 8px 0; }
            .subtotal-row .label { font-weight: 500; color: #374151; }
            .subtotal-row .value { font-weight: 600; color: #111827; }
            .address { font-size: 13px; color: #444; margin-top: 5px; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .status-completed { background: #dcfce7; color: #166534; }
            .status-cancelled { background: #fee2e2; color: #991b1b; }
            .savings-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-top: 12px; }
            .savings-box .label { color: #166534; font-weight: 600; }
            .savings-box .value { color: #166534; font-weight: 700; }
            .savings-comparison { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
            .savings-comparison .solo { text-decoration: line-through; color: #9ca3af; font-size: 13px; }
            .savings-comparison .shared { color: #16a34a; font-weight: 700; font-size: 14px; }
            .surge-row .label { color: #dc2626; }
            .surge-row .value { color: #dc2626; font-weight: 600; }
            .shared-badge { display: inline-block; background: #fff7ed; color: #ea580c; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
            .surge-badge { display: inline-block; background: #fef2f2; color: #dc2626; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; margin-bottom: 8px; margin-left: 6px; }
            .formula { font-family: monospace; font-size: 12px; color: #6b7280; margin-top: 4px; text-align: right; }
            .per-person-box { background: #fff7ed; border-radius: 8px; padding: 10px 14px; margin-top: 10px; }
            .per-person-box .label { color: #ea580c; font-weight: 600; }
            .per-person-box .value { color: #ea580c; font-weight: 700; }
            .per-person-box .sub { font-size: 11px; color: #fb923c; margin-top: 2px; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">sit<span>N</span>ride</div>
            <div class="receipt-title">Ride Receipt</div>
          </div>
          
          <div class="section">
            <div class="row">
              <span class="label">Receipt ID</span>
              <span class="value">${ride.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div class="row">
              <span class="label">Date</span>
              <span class="value">${formatDate(ride.requested_at)}</span>
            </div>
            <div class="row">
              <span class="label">Status</span>
              <span class="status ${ride.status === 'completed' ? 'status-completed' : 'status-cancelled'}">${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Trip Details</div>
            <div style="margin-bottom: 15px;">
              <div class="label">Pickup</div>
              <div class="address">${ride.pickup_address}</div>
              <div style="font-size: 12px; color: #999; margin-top: 3px;">${ride.started_at ? formatTime(ride.started_at) : formatTime(ride.requested_at)}</div>
            </div>
            <div>
              <div class="label">Dropoff</div>
              <div class="address">${ride.dropoff_address}</div>
              <div style="font-size: 12px; color: #999; margin-top: 3px;">${ride.completed_at ? formatTime(ride.completed_at) : 'N/A'}</div>
            </div>
          </div>

          ${driverName ? `
          <div class="section">
            <div class="section-title">Driver</div>
            <div class="value">${driverName}</div>
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Trip Summary</div>
            <div class="row">
              <span class="label">Distance</span>
              <span class="value">${distance.toFixed(1)} miles</span>
            </div>
            <div class="row">
              <span class="label">Duration</span>
              <span class="value">${Math.round(duration)} min</span>
            </div>
            ${riderCount > 1 ? `
            <div class="row">
              <span class="label">Riders</span>
              <span class="value">${riderCount} (Shared Ride)</span>
            </div>
            ` : ''}
          </div>

          ${(riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0) ? `
          <div class="savings-box" style="margin-bottom: 20px;">
            <div class="row" style="margin-bottom: 4px;">
              <span class="label">You saved by sharing!</span>
              <span class="value">$${savingsPerPerson.toFixed(2)} (${savingsPercentage}%)</span>
            </div>
            <div class="savings-comparison">
              <span class="solo">Solo: $${soloPrice.toFixed(2)}</span>
              <span style="color: #9ca3af;">&rarr;</span>
              <span class="shared">Your price: $${costPerPerson.toFixed(2)}</span>
            </div>
          </div>
          ` : ''}

          <div class="section" style="border-bottom: none;">
            <div class="section-title">Fare Breakdown</div>
            ${riderCount > 1 ? `<span class="shared-badge">${riderCount} Riders &middot; ${sharedMultiplier}x</span>` : ''}
            ${surgeMultiplier > 1 ? `<span class="surge-badge">Surge ${surgeMultiplier.toFixed(1)}x</span>` : ''}
            <div class="row" style="margin-top: 8px;">
              <span class="label">Base Fee</span>
              <span class="value">$${baseFee.toFixed(2)}</span>
            </div>
            <div class="row">
              <span class="label">Distance (${distance.toFixed(1)} mi &times; $${perMileRate.toFixed(2)}/mi)</span>
              <span class="value">$${distanceCharge.toFixed(2)}</span>
            </div>
            <div class="row">
              <span class="label">Time (${Math.round(duration)} min &times; $${perMinuteRate.toFixed(2)}/min)</span>
              <span class="value">$${timeCharge.toFixed(2)}</span>
            </div>
            <div class="row subtotal-row">
              <span class="label">Subtotal</span>
              <span class="value">$${subtotal.toFixed(2)}</span>
            </div>
            ${sharedMultiplier > 1 ? `
            <div class="row">
              <span class="label">Shared Ride Multiplier (${riderCount} riders)</span>
              <span class="value" style="color: #ea580c;">&times;${sharedMultiplier}</span>
            </div>
            ` : ''}
            ${surgeMultiplier > 1 ? `
            <div class="row surge-row">
              <span class="label">Surge Pricing (${surgeMultiplier.toFixed(1)}x)</span>
              <span class="value">+$${surgeAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="row total-row">
              <span>Total</span>
              <span>$${total.toFixed(2)}</span>
            </div>
            ${(sharedMultiplier > 1 || surgeMultiplier > 1) ? `
            <div class="formula">
              $${subtotal.toFixed(2)}${sharedMultiplier > 1 ? ` &times; ${sharedMultiplier}` : ''}${surgeMultiplier > 1 ? ` &times; ${surgeMultiplier.toFixed(1)}` : ''} = $${total.toFixed(2)}
            </div>
            ` : ''}
            ${riderCount > 1 ? `
            <div class="per-person-box">
              <div class="row" style="margin-bottom: 0;">
                <span class="label">Cost Per Person</span>
                <span class="value">$${costPerPerson.toFixed(2)}</span>
              </div>
              <div class="sub">$${total.toFixed(2)} &divide; ${riderCount} riders</div>
            </div>
            ` : ''}
            ${riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0 ? `
            <div class="savings-box">
              <div class="row" style="margin-bottom: 0;">
                <span class="label">Your Savings</span>
                <span class="value">$${savingsPerPerson.toFixed(2)} (${savingsPercentage}% off solo)</span>
              </div>
            </div>
            ` : ''}
            ${ride.tip_amount != null && ride.tip_amount > 0 ? `
            <div class="row" style="color: #16a34a; margin-top: 10px;">
              <span>Tip</span>
              <span>$${ride.tip_amount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${ride.status === 'cancelled' && ride.payment_status === 'refunded' ? `
            <div class="row" style="color: #16a34a; margin-top: 10px;">
              <span>Refunded</span>
              <span>$${ride.estimated_total.toFixed(2)}</span>
            </div>
            ` : ''}
          </div>

          <div class="footer">
            <p>Thank you for riding with sitNride!</p>
            <p>Questions? Email us at support@sitNride.net</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  /* ─── Download handler ────────────────────────────────────── */
  const handleDownload = () => {
    const lines: string[] = [
      'SITNRIDE RECEIPT',
      '================',
      '',
      `Receipt ID: ${ride.id.slice(0, 8).toUpperCase()}`,
      `Date: ${formatDate(ride.requested_at)}`,
      `Status: ${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}`,
      '',
      'TRIP DETAILS',
      '------------',
      `Pickup: ${ride.pickup_address}`,
      `Time:   ${ride.started_at ? formatTime(ride.started_at) : formatTime(ride.requested_at)}`,
      '',
      `Dropoff: ${ride.dropoff_address}`,
      `Time:    ${ride.completed_at ? formatTime(ride.completed_at) : 'N/A'}`,
      '',
    ];

    if (driverName) lines.push(`Driver: ${driverName}`, '');

    lines.push(
      'TRIP SUMMARY',
      '------------',
      `Distance:  ${distance.toFixed(1)} miles`,
      `Duration:  ${Math.round(duration)} minutes`,
    );
    if (riderCount > 1) lines.push(`Riders:    ${riderCount} (Shared Ride)`);
    lines.push('');

    lines.push(
      'FARE BREAKDOWN',
      '--------------',
      `Base Fee:              $${baseFee.toFixed(2)}`,
      `Distance Charge:       $${distanceCharge.toFixed(2)}`,
      `  (${distance.toFixed(1)} mi x $${perMileRate.toFixed(2)}/mi)`,
      `Time Charge:           $${timeCharge.toFixed(2)}`,
      `  (${Math.round(duration)} min x $${perMinuteRate.toFixed(2)}/min)`,
      `                       ------`,
      `Subtotal:              $${subtotal.toFixed(2)}`,
    );
    if (sharedMultiplier > 1) {
      lines.push(`Shared Multiplier:     x${sharedMultiplier} (${riderCount} riders)`);
    }
    if (surgeMultiplier > 1) {
      lines.push(`Surge (${surgeMultiplier.toFixed(1)}x):          +$${surgeAmount.toFixed(2)}`);
    }
    lines.push(
      '--------------',
      `TOTAL:                 $${total.toFixed(2)}`,
    );
    if (sharedMultiplier > 1 || surgeMultiplier > 1) {
      let formula = `  ($${subtotal.toFixed(2)}`;
      if (sharedMultiplier > 1) formula += ` x ${sharedMultiplier}`;
      if (surgeMultiplier > 1) formula += ` x ${surgeMultiplier.toFixed(1)}`;
      formula += ` = $${total.toFixed(2)})`;
      lines.push(formula);
    }
    if (riderCount > 1) {
      lines.push('', `Cost Per Person:       $${costPerPerson.toFixed(2)}  ($${total.toFixed(2)} / ${riderCount} riders)`);
    }
    if (riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0) {
      lines.push('');
      lines.push(`*** You saved $${savingsPerPerson.toFixed(2)} by sharing! (${savingsPercentage}% off solo) ***`);
      lines.push(`    Solo price: $${soloPrice.toFixed(2)} -> Your price: $${costPerPerson.toFixed(2)}`);
    }
    if (ride.tip_amount != null && ride.tip_amount > 0) lines.push(`Tip:                   $${ride.tip_amount.toFixed(2)}`);
    if (ride.status === 'cancelled' && ride.payment_status === 'refunded') {
      lines.push('', `Refunded:              $${ride.estimated_total.toFixed(2)}`);
    }
    lines.push('', 'Thank you for riding with sitNride!', 'Questions? Email us at support@sitNride.net');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitnride-receipt-${ride.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Ride Receipt</h2>
              <p className="text-orange-100 text-sm mt-1">#{ride.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <XIcon size={24} />
            </button>
          </div>
          {/* Total in header */}
          <div className="mt-4 flex items-end justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {riderCount > 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20">
                  <UsersIcon size={12} />
                  {riderCount} Riders
                </span>
              )}
              {sharedMultiplier > 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15">
                  {sharedMultiplier}x Shared
                </span>
              )}
              {surgeMultiplier > 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/30">
                  <ZapIcon size={12} />
                  {surgeMultiplier.toFixed(1)}x Surge
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold">{formatCurrency(total)}</p>
              {riderCount > 1 && (
                <p className="text-orange-200 text-xs mt-0.5">{formatCurrency(costPerPerson)}/person</p>
              )}
            </div>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6 overflow-y-auto max-h-[calc(90vh-260px)]">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm text-gray-500">{formatDate(ride.requested_at)}</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
              ride.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {ride.status === 'completed' ? <CheckCircleIcon size={14} /> : <XCircleIcon size={14} />}
              {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
            </span>
          </div>

          {/* ── "You saved" callout ── */}
          {riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarIcon className="text-green-600" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-green-800">
                    You saved {formatCurrency(savingsPerPerson)} by sharing!
                  </p>
                  <p className="text-green-600 text-xs mt-0.5">
                    {savingsPercentage}% less than riding solo
                  </p>
                  {/* Solo vs Shared mini comparison */}
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-gray-400 line-through">{formatCurrency(soloPrice)} solo</span>
                    <span className="text-green-500 font-medium">
                      <svg className="inline -mt-0.5 mr-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      {formatCurrency(costPerPerson)}/person
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trip Route */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="w-0.5 h-12 bg-gray-300 my-1" />
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pickup</p>
                  <p className="font-medium text-gray-900 text-sm">{ride.pickup_address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ride.started_at ? formatTime(ride.started_at) : formatTime(ride.requested_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Dropoff</p>
                  <p className="font-medium text-gray-900 text-sm">{ride.dropoff_address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ride.completed_at ? formatTime(ride.completed_at) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Driver Info */}
          {driverName && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-5">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <CarIcon className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Driver</p>
                <p className="font-medium text-gray-900">{driverName}</p>
              </div>
            </div>
          )}

          {/* Trip Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <NavigationIcon className="mx-auto text-gray-400 mb-1.5" size={18} />
              <p className="text-base font-semibold text-gray-900">{distance.toFixed(1)} mi</p>
              <p className="text-xs text-gray-500">Distance</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <ClockIcon className="mx-auto text-gray-400 mb-1.5" size={18} />
              <p className="text-base font-semibold text-gray-900">{Math.round(duration)} min</p>
              <p className="text-xs text-gray-500">Duration</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <UsersIcon className="mx-auto text-gray-400 mb-1.5" size={18} />
              <p className="text-base font-semibold text-gray-900">{riderCount}</p>
              <p className="text-xs text-gray-500">{riderCount === 1 ? 'Rider' : 'Riders'}</p>
            </div>
          </div>

          {/* ── Fare Breakdown ── */}
          <div className="border-t pt-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarIcon size={18} />
              Fare Breakdown
            </h3>

            {/* Context badges */}
            {(riderCount > 1 || surgeMultiplier > 1) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {riderCount > 1 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                    <UsersIcon size={12} />
                    {riderCount} Riders — {sharedMultiplier}x multiplier
                  </span>
                )}
                {surgeMultiplier > 1 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                    <ZapIcon size={12} />
                    {surgeMultiplier.toFixed(1)}x Surge — +{formatCurrency(surgeAmount)}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-0">
              {/* Base Fee */}
              <div className="flex justify-between text-sm py-2.5">
                <span className="text-gray-600">Base Fee</span>
                <span className="font-medium">{formatCurrency(baseFee)}</span>
              </div>

              {/* Distance */}
              <div className="flex justify-between text-sm py-2.5 border-t border-gray-100">
                <span className="text-gray-600">
                  Distance ({distance.toFixed(1)} mi × {formatCurrency(perMileRate)}/mi)
                </span>
                <span className="font-medium">{formatCurrency(distanceCharge)}</span>
              </div>

              {/* Time */}
              <div className="flex justify-between text-sm py-2.5 border-t border-gray-100">
                <span className="text-gray-600">
                  Time ({Math.round(duration)} min × {formatCurrency(perMinuteRate)}/min)
                </span>
                <span className="font-medium">{formatCurrency(timeCharge)}</span>
              </div>

              {/* Subtotal */}
              <div className="flex justify-between text-sm py-2.5 border-t border-dashed border-gray-300 bg-gray-50 -mx-1 px-1 rounded">
                <span className="text-gray-700 font-medium">Subtotal</span>
                <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
              </div>

              {/* Shared Multiplier */}
              {sharedMultiplier > 1 && (
                <div className="flex justify-between text-sm py-2.5 border-t border-gray-100">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <UsersIcon size={13} className="text-orange-500" />
                    Shared Ride ({riderCount} riders)
                  </span>
                  <span className="font-medium text-orange-600">×{sharedMultiplier}</span>
                </div>
              )}

              {/* Surge */}
              {surgeMultiplier > 1 && (
                <div className="flex justify-between text-sm py-2.5 border-t border-gray-100">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <ZapIcon size={13} className="text-red-500" />
                    Surge Pricing ({surgeMultiplier.toFixed(1)}x)
                  </span>
                  <span className="font-medium text-red-600">+{formatCurrency(surgeAmount)}</span>
                </div>
              )}

              {/* Total */}
              <div className="border-t-2 border-gray-900 pt-3 mt-1 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-extrabold text-xl text-gray-900">{formatCurrency(total)}</span>
              </div>

              {/* Calculation formula */}
              {(sharedMultiplier > 1 || surgeMultiplier > 1) && (
                <p className="text-xs text-gray-400 text-right mt-1">
                  {formatCurrency(subtotal)}
                  {sharedMultiplier > 1 ? ` × ${sharedMultiplier}` : ''}
                  {surgeMultiplier > 1 ? ` × ${surgeMultiplier.toFixed(1)}` : ''}
                  {' = '}{formatCurrency(total)}
                </p>
              )}

              {/* Cost Per Person */}
              {riderCount > 1 && (
                <div className="bg-orange-50 rounded-lg p-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-orange-700 text-sm">Cost Per Person</span>
                    <span className="font-bold text-orange-700">{formatCurrency(costPerPerson)}</span>
                  </div>
                  <p className="text-xs text-orange-500 mt-0.5">
                    {formatCurrency(total)} ÷ {riderCount} riders
                  </p>
                </div>
              )}

              {/* Savings */}
              {riderCount > 1 && savingsPerPerson != null && savingsPerPerson > 0 && (
                <div className="bg-green-50 rounded-lg p-3 mt-2 flex items-center justify-between">
                  <span className="font-semibold text-green-700 text-sm">Your Savings</span>
                  <div className="text-right">
                    <span className="font-bold text-green-700">{formatCurrency(savingsPerPerson)}</span>
                    <span className="text-xs text-green-500 ml-1.5">({savingsPercentage}% off)</span>
                  </div>
                </div>
              )}

              {/* Tip */}
              {ride.tip_amount != null && ride.tip_amount > 0 && (
                <div className="flex justify-between text-sm py-2.5 border-t border-gray-100 mt-2">
                  <span className="text-gray-600">Tip</span>
                  <span className="font-medium text-green-600">{formatCurrency(ride.tip_amount)}</span>
                </div>
              )}

              {/* Refund */}
              {ride.status === 'cancelled' && ride.payment_status === 'refunded' && (
                <div className="flex justify-between text-green-600 bg-green-50 rounded-lg p-3 mt-2">
                  <span className="font-medium">Refunded</span>
                  <span className="font-semibold">{formatCurrency(ride.estimated_total)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Status */}
          <div className="mt-5 pt-5 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Status</span>
              <span className={`font-medium ${
                ride.payment_status === 'charged' ? 'text-green-600' :
                ride.payment_status === 'refunded' ? 'text-blue-600' :
                'text-gray-600'
              }`}>
                {ride.payment_status.charAt(0).toUpperCase() + ride.payment_status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 py-3 px-4 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <DownloadIcon size={18} />
            Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
          >
            <PrinterIcon size={18} />
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default RideReceiptModal;
