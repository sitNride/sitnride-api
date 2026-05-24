// PDF Receipt Generator for sitNride
// Uses browser APIs to generate a professional PDF receipt

import { Ride } from '@/types';
import {
  formatCurrency, calculateRidePrice,
  EARNINGS_SPLIT, BASE_FEE, PER_MILE_RATE, PER_MINUTE_RATE,
} from '@/lib/pricing';

interface ReceiptData {
  ride: Ride;
  driverName?: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Derive all pricing values from a Ride, falling back to the pricing engine */
function derivePricing(ride: Ride) {
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

  return {
    total, distance, duration, riderCount, costPerPerson,
    sharedMultiplier, surgeMultiplier, surgeAmount,
    baseFee, perMileRate, perMinuteRate, distanceCharge, timeCharge,
    subtotal, savingsPerPerson, savingsPercentage, soloPrice,
  };
}

export function generateReceiptHTML(data: ReceiptData): string {
  const { ride, driverName } = data;
  const p = derivePricing(ride);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>sitNride Receipt - ${ride.id.slice(0, 8).toUpperCase()}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f3f4f6;
      color: #111827;
      padding: 40px 20px;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .header {
      background: linear-gradient(135deg, #ea580c, #f97316);
      padding: 32px;
      color: white;
    }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
    .header h1 span { color: #ffffff; }
    .header .subtitle { color: #fed7aa; font-size: 14px; margin-top: 6px; }
    .header .total-amount { font-size: 36px; font-weight: 800; text-align: right; }
    .header .per-person { color: #fed7aa; font-size: 13px; text-align: right; margin-top: 4px; }
    .header-badges { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .header-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
    }
    .badge-shared { background: rgba(255,255,255,0.2); }
    .badge-surge { background: rgba(220,38,38,0.3); }
    .content { padding: 32px; }
    .meta-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;
    }
    .receipt-id { font-size: 13px; color: #6b7280; }
    .status {
      display: inline-block; padding: 4px 14px; border-radius: 20px;
      font-size: 12px; font-weight: 600;
    }
    .status-completed { background: #dcfce7; color: #166534; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }

    /* Savings callout */
    .savings-callout {
      background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .savings-callout-header {
      display: flex; align-items: center; gap: 14px;
    }
    .savings-icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: #dcfce7; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 20px; color: #16a34a; font-weight: 700;
    }
    .savings-callout strong { color: #166534; font-size: 15px; }
    .savings-callout p { color: #16a34a; font-size: 12px; margin-top: 2px; }
    .savings-comparison {
      display: flex; gap: 12px; align-items: center; margin-top: 10px; padding-top: 10px;
      border-top: 1px dashed #bbf7d0;
    }
    .savings-comparison .solo-price {
      background: #f9fafb; border-radius: 6px; padding: 6px 12px; text-align: center;
    }
    .savings-comparison .solo-price .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; }
    .savings-comparison .solo-price .amount { font-size: 14px; color: #9ca3af; text-decoration: line-through; font-weight: 600; }
    .savings-comparison .arrow { color: #16a34a; font-size: 16px; }
    .savings-comparison .your-price {
      background: #dcfce7; border-radius: 6px; padding: 6px 12px; text-align: center;
    }
    .savings-comparison .your-price .label { font-size: 10px; color: #16a34a; text-transform: uppercase; }
    .savings-comparison .your-price .amount { font-size: 14px; color: #166534; font-weight: 700; }

    .route-card {
      background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;
    }
    .route-point { margin-bottom: 16px; }
    .route-point:last-child { margin-bottom: 0; }
    .route-point + .route-point { padding-top: 16px; border-top: 1px dashed #d1d5db; }
    .route-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
    .route-address { font-size: 14px; font-weight: 500; margin-top: 4px; color: #111827; }
    .route-time { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .stats-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;
    }
    .stat-card {
      background: #f9fafb; border-radius: 10px; padding: 14px; text-align: center;
    }
    .stat-label { font-size: 12px; color: #6b7280; }
    .stat-value { font-size: 16px; font-weight: 700; color: #111827; margin-top: 4px; }
    .fare-section { margin-top: 8px; }
    .fare-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #111827; }

    /* Context badges */
    .context-badges { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .context-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    }
    .badge-orange { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
    .badge-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

    .fare-row {
      display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px;
    }
    .fare-row + .fare-row { border-top: 1px solid #f3f4f6; }
    .fare-label { color: #6b7280; }
    .fare-value { font-weight: 500; color: #111827; }
    .fare-value-orange { font-weight: 600; color: #ea580c; }
    .fare-value-red { font-weight: 600; color: #dc2626; }
    .fare-divider { border-top: 2px solid #111827; margin: 8px 0; }
    .fare-total .fare-label { font-size: 18px; font-weight: 700; color: #111827; }
    .fare-total .fare-value { font-size: 18px; font-weight: 700; color: #111827; }

    .subtotal-row {
      background: #f9fafb; border-radius: 6px; padding: 10px 12px; margin: 4px 0;
      border-top: 1px dashed #d1d5db;
    }
    .subtotal-row .fare-label { font-weight: 500; color: #374151; }
    .subtotal-row .fare-value { font-weight: 600; color: #111827; }

    .formula {
      font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
      color: #6b7280; text-align: right; margin-top: 4px;
    }

    .per-person-box {
      background: #fff7ed; border-radius: 10px; padding: 14px 16px; margin-top: 12px;
    }
    .per-person-box .fare-label { color: #ea580c; font-weight: 600; }
    .per-person-box .fare-value { color: #ea580c; font-weight: 700; font-size: 16px; }
    .per-person-box .sub-text { font-size: 11px; color: #fb923c; margin-top: 2px; }

    .savings-box {
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
      padding: 14px 16px; margin-top: 10px;
    }
    .savings-box .fare-label { color: #166534; font-weight: 600; }
    .savings-box .fare-value { color: #166534; font-weight: 700; }

    .tip-row { color: #16a34a; }
    .refund-badge {
      background: #f0fdf4; color: #16a34a; padding: 10px 16px; border-radius: 8px;
      display: flex; justify-content: space-between; margin-top: 12px; font-weight: 600; font-size: 14px;
    }
    .footer {
      background: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;
    }
    .footer p { font-size: 13px; color: #6b7280; }
    .footer .support { font-size: 12px; color: #9ca3af; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="header-top">
        <div>
          <div class="subtitle">RIDE RECEIPT</div>
          <h1>sit<span>N</span>ride</h1>
        </div>
        <div>
          <div class="total-amount">$${p.total.toFixed(2)}</div>
          ${p.riderCount > 1 ? `<div class="per-person">$${p.costPerPerson.toFixed(2)} per person</div>` : ''}
        </div>
      </div>
      ${(p.riderCount > 1 || p.surgeMultiplier > 1) ? `
      <div class="header-badges">
        ${p.riderCount > 1 ? `<span class="header-badge badge-shared">${p.riderCount} Riders &middot; ${p.sharedMultiplier}x</span>` : ''}
        ${p.surgeMultiplier > 1 ? `<span class="header-badge badge-surge">${p.surgeMultiplier.toFixed(1)}x Surge</span>` : ''}
      </div>
      ` : ''}
    </div>
    <div class="content">
      <div class="meta-row">
        <span class="receipt-id">Receipt #${ride.id.slice(0, 8).toUpperCase()} &middot; ${formatDate(ride.requested_at)}</span>
        <span class="status ${ride.status === 'completed' ? 'status-completed' : 'status-cancelled'}">
          ${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
        </span>
      </div>

      ${(p.riderCount > 1 && p.savingsPerPerson != null && p.savingsPerPerson > 0) ? `
      <div class="savings-callout">
        <div class="savings-callout-header">
          <div class="savings-icon">$</div>
          <div>
            <strong>You saved $${p.savingsPerPerson.toFixed(2)} by sharing!</strong>
            <p>${p.savingsPercentage}% less than riding solo &mdash; $${p.costPerPerson.toFixed(2)} per person</p>
          </div>
        </div>
        <div class="savings-comparison">
          <div class="solo-price">
            <div class="label">Solo price</div>
            <div class="amount">$${p.soloPrice.toFixed(2)}</div>
          </div>
          <span class="arrow">&rarr;</span>
          <div class="your-price">
            <div class="label">Your price</div>
            <div class="amount">$${p.costPerPerson.toFixed(2)}</div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="route-card">
        <div class="route-point">
          <div class="route-label">Pickup</div>
          <div class="route-address">${ride.pickup_address}</div>
          <div class="route-time">${ride.started_at ? formatTime(ride.started_at) : formatTime(ride.requested_at)}</div>
        </div>
        <div class="route-point">
          <div class="route-label">Dropoff</div>
          <div class="route-address">${ride.dropoff_address}</div>
          <div class="route-time">${ride.completed_at ? formatTime(ride.completed_at) : 'N/A'}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Driver</div>
          <div class="stat-value">${driverName || 'N/A'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Distance</div>
          <div class="stat-value">${p.distance.toFixed(1)} mi</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Duration</div>
          <div class="stat-value">${Math.round(p.duration)} min</div>
        </div>
      </div>

      <div class="fare-section">
        <div class="fare-title">Fare Breakdown</div>

        ${(p.riderCount > 1 || p.surgeMultiplier > 1) ? `
        <div class="context-badges">
          ${p.riderCount > 1 ? `<span class="context-badge badge-orange">${p.riderCount} Riders &mdash; ${p.sharedMultiplier}x multiplier</span>` : ''}
          ${p.surgeMultiplier > 1 ? `<span class="context-badge badge-red">${p.surgeMultiplier.toFixed(1)}x Surge &mdash; +$${p.surgeAmount.toFixed(2)}</span>` : ''}
        </div>
        ` : ''}
        
        <div class="fare-row">
          <span class="fare-label">Base Fee</span>
          <span class="fare-value">$${p.baseFee.toFixed(2)}</span>
        </div>
        <div class="fare-row">
          <span class="fare-label">Distance (${p.distance.toFixed(1)} mi &times; $${p.perMileRate.toFixed(2)}/mi)</span>
          <span class="fare-value">$${p.distanceCharge.toFixed(2)}</span>
        </div>
        <div class="fare-row">
          <span class="fare-label">Time (${Math.round(p.duration)} min &times; $${p.perMinuteRate.toFixed(2)}/min)</span>
          <span class="fare-value">$${p.timeCharge.toFixed(2)}</span>
        </div>

        <div class="fare-row subtotal-row">
          <span class="fare-label">Subtotal</span>
          <span class="fare-value">$${p.subtotal.toFixed(2)}</span>
        </div>

        ${p.sharedMultiplier > 1 ? `
        <div class="fare-row">
          <span class="fare-label">Shared Ride Multiplier (${p.riderCount} riders)</span>
          <span class="fare-value fare-value-orange">&times;${p.sharedMultiplier}</span>
        </div>
        ` : ''}
        ${p.surgeMultiplier > 1 ? `
        <div class="fare-row">
          <span class="fare-label">Surge Pricing (${p.surgeMultiplier.toFixed(1)}x)</span>
          <span class="fare-value fare-value-red">+$${p.surgeAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="fare-divider"></div>
        
        <div class="fare-row fare-total">
          <span class="fare-label">Total</span>
          <span class="fare-value">$${p.total.toFixed(2)}</span>
        </div>
        ${(p.sharedMultiplier > 1 || p.surgeMultiplier > 1) ? `
        <div class="formula">
          $${p.subtotal.toFixed(2)}${p.sharedMultiplier > 1 ? ` &times; ${p.sharedMultiplier}` : ''}${p.surgeMultiplier > 1 ? ` &times; ${p.surgeMultiplier.toFixed(1)}` : ''} = $${p.total.toFixed(2)}
        </div>
        ` : ''}
        ${p.riderCount > 1 ? `
        <div class="per-person-box">
          <div class="fare-row" style="border-top: none; padding: 0;">
            <span class="fare-label">Cost Per Person</span>
            <span class="fare-value">$${p.costPerPerson.toFixed(2)}</span>
          </div>
          <div class="sub-text">$${p.total.toFixed(2)} &divide; ${p.riderCount} riders</div>
        </div>
        ` : ''}
        ${(p.riderCount > 1 && p.savingsPerPerson != null && p.savingsPerPerson > 0) ? `
        <div class="savings-box">
          <div class="fare-row" style="border-top: none; padding: 0;">
            <span class="fare-label">Your Savings</span>
            <span class="fare-value">$${p.savingsPerPerson.toFixed(2)} (${p.savingsPercentage}% off solo)</span>
          </div>
        </div>
        ` : ''}
        ${(ride.tip_amount != null && ride.tip_amount > 0) ? `
        <div class="fare-row tip-row">
          <span class="fare-label">Tip</span>
          <span class="fare-value">$${ride.tip_amount.toFixed(2)}</span>
        </div>
        ` : ''}
        ${ride.status === 'cancelled' && ride.payment_status === 'refunded' ? `
        <div class="refund-badge">
          <span>Refunded</span>
          <span>$${ride.estimated_total.toFixed(2)}</span>
        </div>
        ` : ''}
      </div>
    </div>
    <div class="footer">
      <p>Thank you for riding with sitNride!</p>
      <p class="support">Questions? Email us at support@sitNride.net</p>
    </div>
  </div>
</body>
</html>`;
}

export function downloadReceiptPDF(data: ReceiptData): void {
  const html = generateReceiptHTML(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: download as HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitnride-receipt-${data.ride.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Auto-trigger print dialog which allows saving as PDF
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

export function downloadReceiptText(data: ReceiptData): void {
  const { ride, driverName } = data;
  const p = derivePricing(ride);

  const lines: string[] = [
    'SITNRIDE RIDE RECEIPT',
    '=====================',
    '',
    `Receipt ID: ${ride.id.slice(0, 8).toUpperCase()}`,
    `Date: ${formatDate(ride.requested_at)}`,
    `Status: ${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}`,
    '',
    'TRIP DETAILS',
    '------------',
    `Pickup:  ${ride.pickup_address}`,
    `Time:    ${ride.started_at ? formatTime(ride.started_at) : formatTime(ride.requested_at)}`,
    '',
    `Dropoff: ${ride.dropoff_address}`,
    `Time:    ${ride.completed_at ? formatTime(ride.completed_at) : 'N/A'}`,
    '',
  ];

  if (driverName) lines.push(`Driver:  ${driverName}`, '');

  lines.push(
    'TRIP SUMMARY',
    '------------',
    `Distance:  ${p.distance.toFixed(1)} miles`,
    `Duration:  ${Math.round(p.duration)} minutes`,
  );
  if (p.riderCount > 1) lines.push(`Riders:    ${p.riderCount} (Shared Ride)`);
  lines.push('');

  lines.push(
    'FARE BREAKDOWN',
    '--------------',
    `Base Fee:              $${p.baseFee.toFixed(2)}`,
    `Distance Charge:       $${p.distanceCharge.toFixed(2)}`,
    `  (${p.distance.toFixed(1)} mi x $${p.perMileRate.toFixed(2)}/mi)`,
    `Time Charge:           $${p.timeCharge.toFixed(2)}`,
    `  (${Math.round(p.duration)} min x $${p.perMinuteRate.toFixed(2)}/min)`,
    `                       ------`,
    `Subtotal:              $${p.subtotal.toFixed(2)}`,
  );
  if (p.sharedMultiplier > 1) {
    lines.push(`Shared Multiplier:     x${p.sharedMultiplier} (${p.riderCount} riders)`);
  }
  if (p.surgeMultiplier > 1) {
    lines.push(`Surge (${p.surgeMultiplier.toFixed(1)}x):          +$${p.surgeAmount.toFixed(2)}`);
  }
  lines.push(
    '--------------',
    `TOTAL:                 $${p.total.toFixed(2)}`,
  );
  // Show calculation formula when multipliers are applied
  if (p.sharedMultiplier > 1 || p.surgeMultiplier > 1) {
    let formula = `  ($${p.subtotal.toFixed(2)}`;
    if (p.sharedMultiplier > 1) formula += ` x ${p.sharedMultiplier}`;
    if (p.surgeMultiplier > 1) formula += ` x ${p.surgeMultiplier.toFixed(1)}`;
    formula += ` = $${p.total.toFixed(2)})`;
    lines.push(formula);
  }
  if (p.riderCount > 1) {
    lines.push('', `Cost Per Person:       $${p.costPerPerson.toFixed(2)}  ($${p.total.toFixed(2)} / ${p.riderCount} riders)`);
  }
  if (p.riderCount > 1 && p.savingsPerPerson != null && p.savingsPerPerson > 0) {
    lines.push('');
    lines.push(`*** You saved $${p.savingsPerPerson.toFixed(2)} by sharing! (${p.savingsPercentage}% off solo) ***`);
    lines.push(`    Solo price: $${p.soloPrice.toFixed(2)}  ->  Your price: $${p.costPerPerson.toFixed(2)}`);
  }
  if (ride.tip_amount != null && ride.tip_amount > 0) {
    lines.push('', `Tip:                   $${ride.tip_amount.toFixed(2)}`);
  }
  if (ride.status === 'cancelled' && ride.payment_status === 'refunded') {
    lines.push('', `Refunded:              $${ride.estimated_total.toFixed(2)}`);
  }
  lines.push(
    '',
    'Thank you for riding with sitNride!',
    'Questions? Email us at support@sitNride.net',
  );

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sitnride-receipt-${ride.id.slice(0, 8)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
