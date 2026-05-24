import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import {
  DollarIcon, CarIcon, TrendingUpIcon, GiftIcon, MinusCircleIcon,
  CalendarIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon,
  BarChartIcon, FileSpreadsheetIcon, CoinsIcon, RefreshIcon
} from '@/components/ui/Icons';

type TimePeriod = 'daily' | 'weekly' | 'monthly';

interface EarningsData {
  id: string;
  ride_id: string;
  completed_at: string;
  pickup_address: string;
  dropoff_address: string;
  distance_miles: number;
  duration_minutes: number;
  base_fare: number;
  tip_amount: number;
  bonus_amount: number;
  platform_fee: number;
  net_earnings: number;
}

interface ChartDataPoint {
  label: string;
  earnings: number;
  tips: number;
  bonuses: number;
  fees: number;
  rides: number;
}

const DriverEarningsDashboard: React.FC = () => {
  const { driverProfile } = useAuth();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('weekly');
  const [earningsData, setEarningsData] = useState<EarningsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedRide, setExpandedRide] = useState<string | null>(null);

  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    const start = new Date(selectedDate);
    
    if (timePeriod === 'daily') {
      start.setHours(0, 0, 0, 0);
    } else if (timePeriod === 'weekly') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }
    
    return { start, end };
  }, [selectedDate, timePeriod]);

  // Navigate time periods
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (timePeriod === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (timePeriod === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Format date range for display
  const formatDateRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const yearOptions: Intl.DateTimeFormatOptions = { ...options, year: 'numeric' };
    
    if (timePeriod === 'daily') {
      return dateRange.start.toLocaleDateString('en-US', { weekday: 'long', ...yearOptions });
    } else if (timePeriod === 'weekly') {
      return `${dateRange.start.toLocaleDateString('en-US', options)} - ${dateRange.end.toLocaleDateString('en-US', yearOptions)}`;
    } else {
      return dateRange.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Load earnings data
  useEffect(() => {
    if (!driverProfile) return;

    const loadEarnings = async () => {
      setLoading(true);
      
      const { data: rides } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .eq('status', 'completed')
        .gte('completed_at', dateRange.start.toISOString())
        .lte('completed_at', dateRange.end.toISOString())
        .order('completed_at', { ascending: false });

      if (rides) {
        const earnings: EarningsData[] = rides.map(ride => ({
          id: ride.id,
          ride_id: ride.id,
          completed_at: ride.completed_at,
          pickup_address: ride.pickup_address,
          dropoff_address: ride.dropoff_address,
          distance_miles: ride.actual_distance_miles || ride.estimated_distance_miles,
          duration_minutes: ride.actual_duration_minutes || ride.estimated_duration_minutes,
          base_fare: ride.driver_earnings || (ride.final_total || ride.estimated_total) * 0.8,
          tip_amount: ride.tip_amount || 0,
          bonus_amount: ride.bonus_amount || 0,
          platform_fee: ride.platform_fee || (ride.final_total || ride.estimated_total) * 0.2,
          net_earnings: (ride.driver_earnings || (ride.final_total || ride.estimated_total) * 0.8) + 
                       (ride.tip_amount || 0) + (ride.bonus_amount || 0)
        }));
        setEarningsData(earnings);
      }
      
      setLoading(false);
    };

    loadEarnings();
  }, [driverProfile, dateRange]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalEarnings = earningsData.reduce((sum, e) => sum + e.net_earnings, 0);
    const totalTips = earningsData.reduce((sum, e) => sum + e.tip_amount, 0);
    const totalBonuses = earningsData.reduce((sum, e) => sum + e.bonus_amount, 0);
    const totalFees = earningsData.reduce((sum, e) => sum + e.platform_fee, 0);
    const totalRides = earningsData.length;
    const totalMiles = earningsData.reduce((sum, e) => sum + e.distance_miles, 0);
    const totalHours = earningsData.reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
    const avgPerRide = totalRides > 0 ? totalEarnings / totalRides : 0;
    const avgPerHour = totalHours > 0 ? totalEarnings / totalHours : 0;

    return {
      totalEarnings,
      totalTips,
      totalBonuses,
      totalFees,
      totalRides,
      totalMiles,
      totalHours,
      avgPerRide,
      avgPerHour
    };
  }, [earningsData]);

  // Generate chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    const data: { [key: string]: ChartDataPoint } = {};
    
    earningsData.forEach(earning => {
      const date = new Date(earning.completed_at);
      let key: string;
      let label: string;
      
      if (timePeriod === 'daily') {
        const hour = date.getHours();
        key = hour.toString();
        label = `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`;
      } else if (timePeriod === 'weekly') {
        key = date.getDay().toString();
        label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      } else {
        key = date.getDate().toString();
        label = date.getDate().toString();
      }
      
      if (!data[key]) {
        data[key] = { label, earnings: 0, tips: 0, bonuses: 0, fees: 0, rides: 0 };
      }
      
      data[key].earnings += earning.base_fare;
      data[key].tips += earning.tip_amount;
      data[key].bonuses += earning.bonus_amount;
      data[key].fees += earning.platform_fee;
      data[key].rides += 1;
    });

    // Fill in missing data points
    const result: ChartDataPoint[] = [];
    if (timePeriod === 'daily') {
      for (let i = 0; i < 24; i++) {
        const label = `${i % 12 || 12}${i < 12 ? 'am' : 'pm'}`;
        result.push(data[i.toString()] || { label, earnings: 0, tips: 0, bonuses: 0, fees: 0, rides: 0 });
      }
    } else if (timePeriod === 'weekly') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        result.push(data[i.toString()] || { label: days[i], earnings: 0, tips: 0, bonuses: 0, fees: 0, rides: 0 });
      }
    } else {
      const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        result.push(data[i.toString()] || { label: i.toString(), earnings: 0, tips: 0, bonuses: 0, fees: 0, rides: 0 });
      }
    }
    
    return result;
  }, [earningsData, timePeriod, selectedDate]);

  // Get max value for chart scaling
  const maxChartValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.earnings + d.tips + d.bonuses), 1);
  }, [chartData]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Date',
      'Time',
      'Pickup',
      'Dropoff',
      'Distance (mi)',
      'Duration (min)',
      'Base Fare',
      'Tips',
      'Bonuses',
      'Platform Fee',
      'Net Earnings'
    ];

    const rows = earningsData.map(e => {
      const date = new Date(e.completed_at);
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        `"${e.pickup_address}"`,
        `"${e.dropoff_address}"`,
        e.distance_miles.toFixed(1),
        e.duration_minutes.toString(),
        e.base_fare.toFixed(2),
        e.tip_amount.toFixed(2),
        e.bonus_amount.toFixed(2),
        e.platform_fee.toFixed(2),
        e.net_earnings.toFixed(2)
      ];
    });

    // Add summary row
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Rides', summary.totalRides.toString()]);
    rows.push(['Total Earnings', '', '', '', '', '', '', '', '', '', `$${summary.totalEarnings.toFixed(2)}`]);
    rows.push(['Total Tips', '', '', '', '', '', '', `$${summary.totalTips.toFixed(2)}`]);
    rows.push(['Total Bonuses', '', '', '', '', '', '', '', `$${summary.totalBonuses.toFixed(2)}`]);
    rows.push(['Total Platform Fees', '', '', '', '', '', '', '', '', `$${summary.totalFees.toFixed(2)}`]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `earnings_${formatDateRange().replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            {(['daily', 'weekly', 'monthly'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timePeriod === period
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeftIcon size={20} />
            </button>
            <div className="flex items-center gap-2 min-w-[200px] justify-center">
              <CalendarIcon size={18} className="text-gray-500" />
              <span className="font-medium text-gray-900">{formatDateRange()}</span>
            </div>
            <button
              onClick={() => navigatePeriod('next')}
              disabled={dateRange.end > new Date()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon size={20} />
            </button>
          </div>

          <button
            onClick={exportToCSV}
            disabled={earningsData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FileSpreadsheetIcon size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarIcon className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Net Earnings</p>
              <p className="text-2xl font-bold text-gray-900">${summary.totalEarnings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CoinsIcon className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tips Received</p>
              <p className="text-2xl font-bold text-gray-900">${summary.totalTips.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <GiftIcon className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bonuses</p>
              <p className="text-2xl font-bold text-gray-900">${summary.totalBonuses.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <MinusCircleIcon className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Platform Fees</p>
              <p className="text-2xl font-bold text-gray-900">${summary.totalFees.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <CarIcon size={24} />
            <div>
              <p className="text-orange-100 text-sm">Total Rides</p>
              <p className="text-2xl font-bold">{summary.totalRides}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <TrendingUpIcon size={24} />
            <div>
              <p className="text-blue-100 text-sm">Avg per Ride</p>
              <p className="text-2xl font-bold">${summary.avgPerRide.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <DollarIcon size={24} />
            <div>
              <p className="text-emerald-100 text-sm">Avg per Hour</p>
              <p className="text-2xl font-bold">${summary.avgPerHour.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <BarChartIcon size={24} />
            <div>
              <p className="text-violet-100 text-sm">Total Miles</p>
              <p className="text-2xl font-bold">{summary.totalMiles.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Earnings Overview</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-600">Earnings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-gray-600">Tips</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-gray-600">Bonuses</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshIcon className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <div className="h-64 flex items-end gap-1 overflow-x-auto pb-2">
            {chartData.map((data, index) => {
              const totalHeight = ((data.earnings + data.tips + data.bonuses) / maxChartValue) * 100;
              const earningsHeight = (data.earnings / maxChartValue) * 100;
              const tipsHeight = (data.tips / maxChartValue) * 100;
              const bonusesHeight = (data.bonuses / maxChartValue) * 100;
              
              return (
                <div key={index} className="flex-1 min-w-[30px] flex flex-col items-center group">
                  <div className="relative w-full flex flex-col items-center" style={{ height: '200px' }}>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                        <p className="font-semibold">{data.label}</p>
                        <p>Earnings: ${data.earnings.toFixed(2)}</p>
                        <p>Tips: ${data.tips.toFixed(2)}</p>
                        <p>Bonuses: ${data.bonuses.toFixed(2)}</p>
                        <p>Rides: {data.rides}</p>
                      </div>
                    </div>
                    
                    {/* Stacked Bar */}
                    <div className="absolute bottom-0 w-full max-w-[40px] flex flex-col-reverse rounded-t-lg overflow-hidden">
                      {bonusesHeight > 0 && (
                        <div 
                          className="w-full bg-amber-500 transition-all duration-300"
                          style={{ height: `${bonusesHeight * 2}px` }}
                        />
                      )}
                      {tipsHeight > 0 && (
                        <div 
                          className="w-full bg-purple-500 transition-all duration-300"
                          style={{ height: `${tipsHeight * 2}px` }}
                        />
                      )}
                      {earningsHeight > 0 && (
                        <div 
                          className="w-full bg-green-500 transition-all duration-300"
                          style={{ height: `${earningsHeight * 2}px` }}
                        />
                      )}
                      {totalHeight === 0 && (
                        <div className="w-full bg-gray-200 h-1 rounded-full" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                    {data.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ride Breakdown Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Ride Breakdown</h3>
          <p className="text-sm text-gray-500 mt-1">Detailed earnings for each completed ride</p>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <RefreshIcon className="animate-spin text-gray-400" size={32} />
          </div>
        ) : earningsData.length === 0 ? (
          <div className="p-8 text-center">
            <CarIcon className="mx-auto text-gray-300" size={48} />
            <p className="mt-4 text-gray-500">No completed rides in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trip Details
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Fare
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tips
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bonuses
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fees
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {earningsData.map((earning) => {
                  const date = new Date(earning.completed_at);
                  const isExpanded = expandedRide === earning.id;
                  
                  return (
                    <React.Fragment key={earning.id}>
                      <tr 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedRide(isExpanded ? null : earning.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-sm text-gray-500">
                            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {earning.pickup_address.split(',')[0]}
                          </div>
                          <div className="text-sm text-gray-500">
                            {earning.distance_miles.toFixed(1)} mi • {earning.duration_minutes} min
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          ${earning.base_fare.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {earning.tip_amount > 0 ? (
                            <span className="text-purple-600 font-medium">+${earning.tip_amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {earning.bonus_amount > 0 ? (
                            <span className="text-amber-600 font-medium">+${earning.bonus_amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                          -${earning.platform_fee.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-600">
                          ${earning.net_earnings.toFixed(2)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Pickup</p>
                                <p className="text-gray-900">{earning.pickup_address}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Dropoff</p>
                                <p className="text-gray-900">{earning.dropoff_address}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900" colSpan={2}>
                    Total ({summary.totalRides} rides)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                    ${(summary.totalEarnings - summary.totalTips - summary.totalBonuses).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600">
                    +${summary.totalTips.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-amber-600">
                    +${summary.totalBonuses.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-red-600">
                    -${summary.totalFees.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                    ${summary.totalEarnings.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Tax Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileSpreadsheetIcon className="text-blue-600" size={24} />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900">Tax Information</h4>
            <p className="text-sm text-blue-700 mt-1">
              Export your earnings data as CSV for easy tax reporting. The export includes all ride details, 
              earnings breakdown, tips, bonuses, and platform fees. We recommend keeping records of your 
              monthly earnings for tax purposes.
            </p>
            <button
              onClick={exportToCSV}
              disabled={earningsData.length === 0}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <DownloadIcon size={16} />
              Download Earnings Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverEarningsDashboard;
