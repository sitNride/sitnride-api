import React, { useState, useRef, useEffect } from 'react';
import {
  calculateEarningsSplit,
  formatCurrency,
  EARNINGS_SPLIT,
  SHARED_RIDE_MULTIPLIERS,
  BASE_FEE,
  PER_MILE_RATE,
  PER_MINUTE_RATE,
} from '@/lib/pricing';
import type { DriverBonusResult } from '@/lib/pricing';
import {
  DollarIcon,
  InfoIcon,
  UsersIcon,
  ZapIcon,
  TrendingUpIcon,
  MapPinIcon,
  ClockIcon,
  MoonIcon,
  CalendarIcon,
} from '@/components/ui/Icons';

export interface EarningsSplitBreakdownProps {
  /** Total ride fare */
  totalFare: number;
  /** Number of riders (1-4) */
  riderCount?: number;
  /** Shared ride multiplier applied */
  sharedRideMultiplier?: number;
  /** Surge multiplier applied */
  surgeMultiplier?: number;
  /** Estimated distance in miles (for $/mile calc) */
  distanceMiles?: number;
  /** Estimated duration in minutes (for $/hr calc) */
  durationMinutes?: number;
  /** Base fee from the ride */
  baseFee?: number;
  /** Distance charge from the ride */
  distanceCharge?: number;
  /** Time charge from the ride */
  timeCharge?: number;
  /** Surge amount from the ride */
  surgeAmount?: number;
  /** Driver bonus result (from calculateDriverBonus) */
  driverBonus?: DriverBonusResult;
  /** Visual variant */
  variant?: 'card' | 'inline' | 'compact';
  /** Whether to show the detailed tooltip */
  showTooltip?: boolean;
  /** Custom class name */
  className?: string;
}


const EarningsSplitBreakdown: React.FC<EarningsSplitBreakdownProps> = ({
  totalFare,
  riderCount = 1,
  sharedRideMultiplier,
  surgeMultiplier = 1.0,
  distanceMiles,
  durationMinutes,
  baseFee,
  distanceCharge,
  timeCharge,
  surgeAmount,
  driverBonus,
  variant = 'card',
  showTooltip = true,
  className = '',
}) => {

  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'below' | 'above'>('below');
  const tooltipTriggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const resolvedMultiplier = sharedRideMultiplier ?? SHARED_RIDE_MULTIPLIERS[riderCount] ?? 1.0;
  const split = calculateEarningsSplit(totalFare);
  const driverPct = Math.round(EARNINGS_SPLIT.DRIVER_PERCENTAGE * 100);
  const platformPct = Math.round(EARNINGS_SPLIT.PLATFORM_PERCENTAGE * 100);

  // Driver bonus
  const bonusAmount = driverBonus?.bonusAmount ?? 0;
  const totalDriverEarnings = split.driverEarnings + bonusAmount;

  // Earnings projections

  const earningsPerMile = distanceMiles && distanceMiles > 0
    ? split.driverEarnings / distanceMiles
    : null;
  const earningsPerHour = durationMinutes && durationMinutes > 0
    ? (split.driverEarnings / durationMinutes) * 60
    : null;

  // Shared ride bonus: how much more the driver earns vs a solo ride
  const soloFare = resolvedMultiplier > 1.0 && riderCount > 1
    ? totalFare / resolvedMultiplier
    : null;
  const sharedRideBonus = soloFare !== null
    ? calculateEarningsSplit(totalFare).driverEarnings - calculateEarningsSplit(soloFare).driverEarnings
    : null;

  // Position tooltip to avoid overflow
  useEffect(() => {
    if (isTooltipOpen && tooltipTriggerRef.current) {
      const rect = tooltipTriggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setTooltipPosition(spaceBelow < 380 ? 'above' : 'below');
    }
  }, [isTooltipOpen]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!isTooltipOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        tooltipTriggerRef.current &&
        !tooltipTriggerRef.current.contains(e.target as Node)
      ) {
        setIsTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isTooltipOpen]);

  // ── Compact variant (single line) ──
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm text-gray-500">Your earnings:</span>
        <span className="font-bold text-green-700">{formatCurrency(split.driverEarnings)}</span>
        {showTooltip && (
          <div className="relative">
            <button
              ref={tooltipTriggerRef}
              type="button"
              className="text-gray-400 hover:text-green-600 transition-colors"
              onClick={() => setIsTooltipOpen(!isTooltipOpen)}
              aria-label="View earnings breakdown"
            >
              <InfoIcon size={14} />
            </button>
            {isTooltipOpen && renderTooltip()}
          </div>
        )}
      </div>
    );
  }

  // ── Inline variant (medium) ──
  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <DollarIcon className="text-green-600" size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Your Earnings</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(split.driverEarnings)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {earningsPerMile !== null && (
            <div className="text-right">
              <p className="text-[10px] text-green-600 uppercase tracking-wide">$/mile</p>
              <p className="text-sm font-semibold text-green-700">{formatCurrency(earningsPerMile)}</p>
            </div>
          )}
          {showTooltip && (
            <div className="relative">
              <button
                ref={tooltipTriggerRef}
                type="button"
                className="w-8 h-8 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center text-green-600 transition-colors"
                onClick={() => setIsTooltipOpen(!isTooltipOpen)}
                aria-label="View earnings breakdown"
              >
                <InfoIcon size={16} />
              </button>
              {isTooltipOpen && renderTooltip()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Card variant (full, default) ──
  return (
    <div className={`relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 rounded-xl overflow-hidden ${className}`}>
      {/* Shared ride bonus banner */}
      {sharedRideBonus !== null && sharedRideBonus > 0 && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 flex items-center gap-2 text-white text-sm">
          <TrendingUpIcon size={14} />
          <span className="font-medium">
            Shared ride bonus: +{formatCurrency(sharedRideBonus)} extra vs solo fare
          </span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-green-800">Your Estimated Earnings</p>
              {showTooltip && (
                <button
                  ref={tooltipTriggerRef}
                  type="button"
                  className="relative text-green-600 hover:text-green-800 transition-colors"
                  onMouseEnter={() => setIsTooltipOpen(true)}
                  onMouseLeave={() => setIsTooltipOpen(false)}
                  onClick={() => setIsTooltipOpen(!isTooltipOpen)}
                  aria-label="View earnings split breakdown"
                >
                  <InfoIcon size={16} />
                </button>
              )}
            </div>
            <p className="text-3xl font-bold text-green-700 mt-1 tabular-nums">
              {formatCurrency(totalDriverEarnings)}
            </p>
            {bonusAmount > 0 && driverBonus && (
              <div className="flex items-center gap-1.5 mt-1">
                {driverBonus.bonusType === 'late_night' ? (
                  <MoonIcon className="text-amber-500" size={14} />
                ) : (
                  <CalendarIcon className="text-amber-500" size={14} />
                )}
                <span className="text-xs font-medium text-amber-600">
                  Includes {driverBonus.bonusLabel}: +{formatCurrency(bonusAmount)}
                </span>
              </div>
            )}
          </div>
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            <DollarIcon className="text-green-600" size={28} />
          </div>
        </div>


        {/* Earnings projections row */}
        {(earningsPerMile !== null || earningsPerHour !== null) && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-green-200/60">
            {earningsPerMile !== null && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-md flex items-center justify-center">
                  <MapPinIcon className="text-green-600" size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-green-600 uppercase tracking-wider font-medium">Per Mile</p>
                  <p className="text-sm font-bold text-green-800 tabular-nums">{formatCurrency(earningsPerMile)}</p>
                </div>
              </div>
            )}
            {earningsPerHour !== null && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-md flex items-center justify-center">
                  <ClockIcon className="text-green-600" size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-green-600 uppercase tracking-wider font-medium">Per Hour</p>
                  <p className="text-sm font-bold text-green-800 tabular-nums">{formatCurrency(earningsPerHour)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {isTooltipOpen && renderTooltip()}
    </div>
  );

  function renderTooltip() {
    const positionClass = tooltipPosition === 'above'
      ? 'bottom-full mb-2'
      : 'top-full mt-2';

    return (
      <div
        ref={tooltipRef}
        className={`absolute ${variant === 'card' ? 'left-0 right-0 mx-2' : 'right-0 w-80'} ${positionClass} z-50`}
        onMouseEnter={() => { if (variant === 'card') setIsTooltipOpen(true); }}
        onMouseLeave={() => { if (variant === 'card') setIsTooltipOpen(false); }}
      >
        <div className="bg-gray-900 text-white rounded-xl p-5 shadow-2xl text-sm animate-in fade-in zoom-in-95 duration-200">
          {/* Arrow */}
          {tooltipPosition === 'below' && (
            <div className="absolute -top-2 left-8 w-4 h-4 bg-gray-900 rotate-45" />
          )}
          {tooltipPosition === 'above' && (
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-gray-900 rotate-45" />
          )}

          <p className="font-semibold text-white text-base mb-4">Earnings Breakdown</p>

          {/* ── Fare Line Items ── */}
          {(baseFee !== undefined || distanceCharge !== undefined || timeCharge !== undefined) && (
            <div className="space-y-1.5 mb-4 pb-3 border-b border-gray-700">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">Fare Composition</p>
              {baseFee !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Base fee</span>
                  <span className="text-gray-200 tabular-nums">{formatCurrency(baseFee)}</span>
                </div>
              )}
              {distanceCharge !== undefined && distanceMiles !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">
                    Distance ({distanceMiles.toFixed(1)} mi × {formatCurrency(PER_MILE_RATE)})
                  </span>
                  <span className="text-gray-200 tabular-nums">{formatCurrency(distanceCharge)}</span>
                </div>
              )}
              {timeCharge !== undefined && durationMinutes !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">
                    Time ({durationMinutes} min × {formatCurrency(PER_MINUTE_RATE)})
                  </span>
                  <span className="text-gray-200 tabular-nums">{formatCurrency(timeCharge)}</span>
                </div>
              )}
              {riderCount > 1 && (
                <div className="flex justify-between items-center text-purple-300">
                  <span className="flex items-center gap-1">
                    <UsersIcon size={12} />
                    Shared ride ({riderCount} riders × {resolvedMultiplier.toFixed(2)}x)
                  </span>
                  <span className="tabular-nums">+{((resolvedMultiplier - 1) * 100).toFixed(0)}%</span>
                </div>
              )}
              {surgeMultiplier > 1.0 && surgeAmount !== undefined && (
                <div className="flex justify-between items-center text-amber-300">
                  <span className="flex items-center gap-1">
                    <ZapIcon size={12} />
                    Surge ({surgeMultiplier.toFixed(1)}x)
                  </span>
                  <span className="tabular-nums">+{formatCurrency(surgeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-700 font-medium">
                <span className="text-gray-300">Total Fare</span>
                <span className="text-white tabular-nums">{formatCurrency(totalFare)}</span>
              </div>
            </div>
          )}

          {/* ── If no line items, just show total ── */}
          {baseFee === undefined && distanceCharge === undefined && timeCharge === undefined && (
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-300">Ride Fare</span>
              <span className="font-medium tabular-nums">{formatCurrency(split.totalFare)}</span>
            </div>
          )}

          {/* ── Visual Split Bar ── */}
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
            {driverPct}/{platformPct} Split
          </p>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-700 mb-3">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${driverPct}%` }}
            >
              <span className="text-[9px] font-bold text-white drop-shadow-sm">{driverPct}%</span>
            </div>
            <div
              className="bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${platformPct}%` }}
            >
              <span className="text-[9px] font-bold text-white drop-shadow-sm">{platformPct}%</span>
            </div>
          </div>

          {/* ── Split Line Items ── */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-green-400">
                <span className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full inline-block" />
                You keep ({driverPct}%)
              </span>
              <span className="font-bold text-green-400 tabular-nums">{formatCurrency(split.driverEarnings)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-orange-300">
                <span className="w-3 h-3 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full inline-block" />
                Platform fee ({platformPct}%)
              </span>
              <span className="font-medium text-orange-300 tabular-nums">{formatCurrency(split.platformFee)}</span>
            </div>

            {/* ── Driver Bonus Line ── */}
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-amber-300">
                <span className="w-3 h-3 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full inline-block" />
                Driver Bonus
                {driverBonus && driverBonus.bonusType !== 'none' && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
                    {driverBonus.bonusType === 'weekend' ? 'Weekend' : 'Late Night'}
                  </span>
                )}
              </span>
              <span className={`font-medium tabular-nums ${bonusAmount > 0 ? 'text-amber-300' : 'text-gray-500'}`}>
                {bonusAmount > 0 ? `+${formatCurrency(bonusAmount)}` : formatCurrency(0)}
              </span>
            </div>

            {/* ── Total with Bonus ── */}
            {bonusAmount > 0 && (
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-700 font-semibold">
                <span className="text-green-300">Total Earnings</span>
                <span className="text-green-300 tabular-nums">{formatCurrency(totalDriverEarnings)}</span>
              </div>
            )}
          </div>

          {/* ── Driver Bonus Note ── */}
          <p className="mt-3 pt-2 border-t border-gray-700 text-[11px] text-gray-500 italic">
            Driver earnings may include bonus incentives depending on time and day.
          </p>

          {/* ── Earnings Projections ── */}
          {(earningsPerMile !== null || earningsPerHour !== null) && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">Earnings Projections</p>
              <div className="grid grid-cols-2 gap-3">
                {earningsPerMile !== null && (
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-gray-400 uppercase">Per Mile</p>
                    <p className="text-lg font-bold text-green-400 tabular-nums">{formatCurrency(earningsPerMile)}</p>
                  </div>
                )}
                {earningsPerHour !== null && (
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-gray-400 uppercase">Per Hour</p>
                    <p className="text-lg font-bold text-green-400 tabular-nums">{formatCurrency(earningsPerHour)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Contextual Notes ── */}
          {(riderCount > 1 || surgeMultiplier > 1.0) && (
            <div className="mt-3 pt-3 border-t border-gray-700 space-y-1.5">
              {riderCount > 1 && (
                <p className="text-xs text-gray-400 flex items-start gap-1.5">
                  <UsersIcon size={12} className="flex-shrink-0 mt-0.5 text-purple-400" />
                  <span>
                    Shared ride with {riderCount} riders increases the total fare by {resolvedMultiplier.toFixed(2)}x.
                    {sharedRideBonus !== null && sharedRideBonus > 0 && (
                      <span className="text-purple-300 font-medium"> You earn {formatCurrency(sharedRideBonus)} more than a solo ride!</span>
                    )}
                  </span>
                </p>
              )}
              {surgeMultiplier > 1.0 && (
                <p className="text-xs text-gray-400 flex items-start gap-1.5">
                  <ZapIcon size={12} className="flex-shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Surge pricing ({surgeMultiplier.toFixed(1)}x) is active — higher demand means higher earnings for you.
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default EarningsSplitBreakdown;
