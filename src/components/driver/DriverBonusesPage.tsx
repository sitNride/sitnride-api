import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import {
  TrophyIcon, StarIcon, ClockIcon, FlameIcon, SunriseIcon, MoonIcon,
  CrownIcon, TargetIcon, CalendarIcon, GiftIcon, CheckCircleIcon,
  ChevronLeftIcon, DollarIcon, RefreshIcon, AwardIcon, ZapIcon
} from '@/components/ui/Icons';

interface BonusDefinition {
  id: string;
  name: string;
  description: string;
  bonus_type: string;
  target_value: number;
  bonus_amount: number;
  time_window: string;
  icon_name: string;
  color: string;
  priority: number;
  is_active: boolean;
}

interface BonusProgress {
  id: string;
  driver_id: string;
  bonus_id: string;
  current_progress: number;
  period_start: string;
  period_end: string;
  is_completed: boolean;
  completed_at: string | null;
  bonus?: BonusDefinition;
}

interface BonusHistory {
  id: string;
  driver_id: string;
  bonus_id: string;
  ride_id: string | null;
  bonus_amount: number;
  bonus_name: string;
  bonus_description: string;
  earned_at: string;
  payout_status: string;
}

interface DriverBonusesPageProps {
  onBack: () => void;
}

const getIconComponent = (iconName: string, className: string = '', size: number = 24) => {
  const icons: Record<string, React.ReactNode> = {
    trophy: <TrophyIcon className={className} size={size} />,
    star: <StarIcon className={className} size={size} />,
    clock: <ClockIcon className={className} size={size} />,
    fire: <FlameIcon className={className} size={size} />,
    sunrise: <SunriseIcon className={className} size={size} />,
    moon: <MoonIcon className={className} size={size} />,
    crown: <CrownIcon className={className} size={size} />,
    target: <TargetIcon className={className} size={size} />,
    calendar: <CalendarIcon className={className} size={size} />,
    gift: <GiftIcon className={className} size={size} />,
    zap: <ZapIcon className={className} size={size} />,
    award: <AwardIcon className={className} size={size} />,
  };
  return icons[iconName] || <GiftIcon className={className} size={size} />;
};

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; text: string; border: string; progress: string; lightBg: string }> = {
    amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', progress: 'bg-amber-500', lightBg: 'bg-amber-50' },
    purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-200', progress: 'bg-purple-500', lightBg: 'bg-purple-50' },
    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-200', progress: 'bg-yellow-500', lightBg: 'bg-yellow-50' },
    orange: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-200', progress: 'bg-orange-500', lightBg: 'bg-orange-50' },
    red: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-200', progress: 'bg-red-500', lightBg: 'bg-red-50' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200', progress: 'bg-blue-500', lightBg: 'bg-blue-50' },
    indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-200', progress: 'bg-indigo-500', lightBg: 'bg-indigo-50' },
    green: { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-200', progress: 'bg-green-500', lightBg: 'bg-green-50' },
    gold: { bg: 'bg-yellow-600', text: 'text-yellow-700', border: 'border-yellow-300', progress: 'bg-yellow-600', lightBg: 'bg-yellow-50' },
    teal: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-200', progress: 'bg-teal-500', lightBg: 'bg-teal-50' },
  };
  return colors[color] || colors.green;
};

const formatTimeWindow = (timeWindow: string) => {
  switch (timeWindow) {
    case 'daily': return 'Today';
    case 'weekly': return 'This Week';
    case 'monthly': return 'This Month';
    case 'one_time': return 'One Time';
    default: return timeWindow;
  }
};

const DriverBonusesPage: React.FC<DriverBonusesPageProps> = ({ onBack }) => {
  const { driverProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [bonusDefinitions, setBonusDefinitions] = useState<BonusDefinition[]>([]);
  const [bonusProgress, setBonusProgress] = useState<BonusProgress[]>([]);
  const [bonusHistory, setBonusHistory] = useState<BonusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarnedThisMonth, setTotalEarnedThisMonth] = useState(0);

  useEffect(() => {
    if (driverProfile) {
      loadBonusData();
    }
  }, [driverProfile]);

  const loadBonusData = async () => {
    if (!driverProfile) return;
    setLoading(true);

    try {
      // Load bonus definitions
      const { data: definitions } = await supabase
        .from('bonus_definitions')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (definitions) {
        setBonusDefinitions(definitions);
      }

      // Load bonus progress
      const now = new Date();
      const { data: progress } = await supabase
        .from('driver_bonus_progress')
        .select('*, bonus:bonus_definitions(*)')
        .eq('driver_id', driverProfile.id)
        .gte('period_end', now.toISOString());

      if (progress) {
        setBonusProgress(progress);
      }

      // Load bonus history
      const { data: history } = await supabase
        .from('driver_bonus_history')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('earned_at', { ascending: false })
        .limit(50);

      if (history) {
        setBonusHistory(history);

        // Calculate total earned this month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyTotal = history
          .filter(h => new Date(h.earned_at) >= startOfMonth)
          .reduce((sum, h) => sum + h.bonus_amount, 0);
        setTotalEarnedThisMonth(monthlyTotal);
      }
    } catch (error) {
      console.error('Error loading bonus data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressForBonus = (bonusId: string) => {
    return bonusProgress.find(p => p.bonus_id === bonusId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshIcon className="animate-spin text-orange-600 mx-auto" size={40} />
          <p className="mt-4 text-gray-600">Loading bonuses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeftIcon size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Driver Bonuses</h1>
              <p className="text-sm text-gray-500">Earn extra by completing milestones</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <DollarIcon size={24} />
              </div>
              <div>
                <p className="text-green-100 text-sm">Earned This Month</p>
                <p className="text-2xl font-bold">${totalEarnedThisMonth.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <TrophyIcon size={24} />
              </div>
              <div>
                <p className="text-purple-100 text-sm">Total Bonuses Earned</p>
                <p className="text-2xl font-bold">{bonusHistory.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 py-4 text-center font-medium transition-colors ${
                activeTab === 'available'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Available Bonuses
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-4 text-center font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bonus History
            </button>
          </div>

          {/* Available Bonuses Tab */}
          {activeTab === 'available' && (
            <div className="p-4 space-y-4">
              {bonusDefinitions.length === 0 ? (
                <div className="text-center py-12">
                  <GiftIcon className="text-gray-300 mx-auto" size={48} />
                  <p className="mt-4 text-gray-500">No bonuses available at this time</p>
                </div>
              ) : (
                bonusDefinitions.map((bonus) => {
                  const progress = getProgressForBonus(bonus.id);
                  const currentProgress = progress?.current_progress || 0;
                  const progressPercent = Math.min((currentProgress / bonus.target_value) * 100, 100);
                  const isCompleted = progress?.is_completed || false;
                  const colors = getColorClasses(bonus.color);

                  return (
                    <div
                      key={bonus.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        isCompleted ? 'border-green-300 bg-green-50' : colors.border
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-green-500' : colors.bg
                          }`}>
                            {isCompleted ? (
                              <CheckCircleIcon className="text-white" size={28} />
                            ) : (
                              getIconComponent(bonus.icon_name, 'text-white', 28)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-gray-900">{bonus.name}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{bonus.description}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-lg font-bold ${isCompleted ? 'text-green-600' : colors.text}`}>
                                  ${bonus.bonus_amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-400">{formatTimeWindow(bonus.time_window)}</p>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-sm mb-1.5">
                                <span className="text-gray-600">
                                  {bonus.bonus_type === 'rating' 
                                    ? `${currentProgress.toFixed(1)} / ${bonus.target_value} rating`
                                    : `${Math.floor(currentProgress)} / ${bonus.target_value} ${bonus.bonus_type === 'ride_count' ? 'rides' : 'completed'}`
                                  }
                                </span>
                                <span className={`font-medium ${isCompleted ? 'text-green-600' : colors.text}`}>
                                  {isCompleted ? 'Completed!' : `${Math.round(progressPercent)}%`}
                                </span>
                              </div>
                              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isCompleted ? 'bg-green-500' : colors.progress
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bonus Tips */}
                      {!isCompleted && (
                        <div className={`px-4 py-3 border-t ${colors.lightBg} ${colors.border}`}>
                          <p className="text-sm text-gray-600">
                            {bonus.bonus_type === 'ride_count' && (
                              <>Complete <span className="font-semibold">{bonus.target_value - Math.floor(currentProgress)} more rides</span> to earn this bonus</>
                            )}
                            {bonus.bonus_type === 'peak_hours' && (
                              <>Drive during peak hours (7-9 AM or 5-8 PM) to progress</>
                            )}
                            {bonus.bonus_type === 'rating' && (
                              <>Maintain excellent service to keep your rating high</>
                            )}
                            {bonus.bonus_type === 'streak' && (
                              <>Accept consecutive rides without declining to build your streak</>
                            )}
                            {bonus.bonus_type === 'first_ride' && (
                              <>Complete a ride before 7 AM to earn this bonus</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Bonus History Tab */}
          {activeTab === 'history' && (
            <div className="divide-y">
              {bonusHistory.length === 0 ? (
                <div className="text-center py-12">
                  <AwardIcon className="text-gray-300 mx-auto" size={48} />
                  <p className="mt-4 text-gray-500">No bonuses earned yet</p>
                  <p className="text-sm text-gray-400 mt-1">Complete milestones to start earning bonuses</p>
                </div>
              ) : (
                bonusHistory.map((history) => (
                  <div key={history.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CheckCircleIcon className="text-green-600" size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-gray-900">{history.bonus_name}</h4>
                            <p className="text-sm text-gray-500 truncate">{history.bonus_description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-green-600">
                              +${history.bonus_amount.toFixed(2)}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              history.payout_status === 'paid' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {history.payout_status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(history.earned_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* How Bonuses Work */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ZapIcon className="text-orange-600" size={20} />
            How Bonuses Work
          </h3>
          <div className="space-y-4 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-600 font-semibold text-xs">1</span>
              </div>
              <p>Complete rides and milestones to progress toward bonus goals. Your progress is tracked automatically.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-600 font-semibold text-xs">2</span>
              </div>
              <p>When you complete a bonus goal, the bonus amount is automatically added to your available balance.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-600 font-semibold text-xs">3</span>
              </div>
              <p>Daily bonuses reset at midnight. Weekly bonuses reset on Sunday. Monthly bonuses reset on the 1st.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-600 font-semibold text-xs">4</span>
              </div>
              <p>Cash out your bonuses anytime through the Payouts tab in your dashboard.</p>
            </div>
          </div>
        </div>

        {/* Peak Hours Info */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClockIcon size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Peak Hours Bonus</h3>
              <p className="text-orange-100 mt-1">
                Earn extra by driving during high-demand periods:
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="font-medium">Morning Rush</p>
                  <p className="text-orange-100 text-sm">7:00 AM - 9:00 AM</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="font-medium">Evening Rush</p>
                  <p className="text-orange-100 text-sm">5:00 PM - 8:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DriverBonusesPage;
