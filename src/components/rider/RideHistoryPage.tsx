import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { Ride, RideRating } from '@/types';
import { formatCurrency } from '@/lib/pricing';
import RideReceiptModal from './RideReceiptModal';
import {
  ChevronLeftIcon, CalendarIcon, FilterIcon, MapPinIcon,
  NavigationIcon, StarIcon, ClockIcon, DollarIcon,
  CheckCircleIcon, XCircleIcon, CarIcon, ReceiptIcon,
  SearchIcon, ChevronDownIcon, HistoryIcon, UsersIcon,
  ExternalLinkIcon
} from '@/components/ui/Icons';


interface RideHistoryPageProps {
  onBack: () => void;
}

interface RideWithDetails extends Ride {
  driver?: {
    user?: {
      full_name: string;
    };
    average_rating?: number;
  };
  rating?: RideRating;
}

const RideHistoryPage: React.FC<RideHistoryPageProps> = ({ onBack }) => {
  const { riderProfile } = useAuth();
  const [rides, setRides] = useState<RideWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<RideWithDetails | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Filter state
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (riderProfile) {
      loadRideHistory();
    } else {
      setIsLoading(false);
    }
  }, [riderProfile]);


  const loadRideHistory = async () => {
    if (!riderProfile) return;

    setIsLoading(true);
    try {
      // Fetch rides with driver info
      const { data: ridesData, error: ridesError } = await supabase
  .from('rides')
  .select(`
    *,
    driver:driver_profiles(
      user:users(full_name),
      average_rating
    )
  `)
  .eq('rider_id', riderProfile.id)
  .in('status', ['completed', 'cancelled'])
  .order('requested_at', { ascending: false });
      if (ridesError) {
  console.error('Ride error:', ridesError);
}

      // Fetch ratings for these rides
      const rideIds = ridesData?.map(r => r.id) || [];
      const { data: ratingsData } = await supabase
        .from('ride_ratings')
        .select('*')
        .in('ride_id', rideIds);

      // Combine rides with their ratings
      const ridesWithRatings = ridesData?.map(ride => ({
        ...ride,
        rating: ratingsData?.find(r => r.ride_id === ride.id)
      })) || [];

      setRides(ridesWithRatings);
    } catch (error) {
      console.error('Error loading ride history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter rides based on criteria
  const filteredRides = useMemo(() => {
    return rides.filter(ride => {
      // Status filter
      if (statusFilter !== 'all' && ride.status !== statusFilter) {
        return false;
      }

      // Date filter
      const rideDate = new Date(ride.requested_at);
      const now = new Date();
      
      if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (rideDate < sevenDaysAgo) return false;
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (rideDate < thirtyDaysAgo) return false;
      } else if (dateFilter === '90days') {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (rideDate < ninetyDaysAgo) return false;
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (rideDate < start || rideDate > end) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPickup = ride.pickup_address.toLowerCase().includes(query);
        const matchesDropoff = ride.dropoff_address.toLowerCase().includes(query);
        const matchesDriver = ride.driver?.user?.full_name?.toLowerCase().includes(query);
        if (!matchesPickup && !matchesDropoff && !matchesDriver) return false;
      }

      return true;
    });
  }, [rides, statusFilter, dateFilter, startDate, endDate, searchQuery]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = filteredRides.filter(r => r.status === 'completed');
    const totalSpent = completed.reduce((sum, r) => sum + (r.final_total || r.estimated_total), 0);
    const totalDistance = completed.reduce((sum, r) => sum + (r.actual_distance_miles || r.estimated_distance_miles), 0);
    const avgRating = completed.filter(r => r.rating).reduce((sum, r, _, arr) => 
      sum + (r.rating?.rating || 0) / arr.length, 0);

    return {
      totalRides: filteredRides.length,
      completedRides: completed.length,
      cancelledRides: filteredRides.filter(r => r.status === 'cancelled').length,
      totalSpent,
      totalDistance,
      avgRating: avgRating || 0
    };
  }, [filteredRides]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleViewReceipt = (ride: RideWithDetails) => {
    setSelectedRide(ride);
    setShowReceiptModal(true);
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            size={14}
            className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeftIcon size={24} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">Ride History</h1>
              <p className="text-sm text-gray-500">View all your past rides</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by location or driver name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FilterIcon size={18} />
            <span className="font-medium">Filters</span>
            <ChevronDownIcon 
              size={18} 
              className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} 
            />
          </button>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="pt-4 border-t space-y-4">
              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All Time' },
                    { value: '7days', label: 'Last 7 Days' },
                    { value: '30days', label: 'Last 30 Days' },
                    { value: '90days', label: 'Last 90 Days' },
                    { value: 'custom', label: 'Custom' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDateFilter(option.value as any)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        dateFilter === option.value
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                
                {dateFilter === 'custom' && (
                  <div className="flex gap-4 mt-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value as any)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        statusFilter === option.value
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <CarIcon className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRides}</p>
                <p className="text-xs text-gray-500">Total Rides</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarIcon className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">${stats.totalSpent.toFixed(0)}</p>
                <p className="text-xs text-gray-500">Total Spent</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <NavigationIcon className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDistance.toFixed(0)}</p>
                <p className="text-xs text-gray-500">Miles Traveled</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <StarIcon className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
                </p>
                <p className="text-xs text-gray-500">Avg Rating Given</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rides List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <HistoryIcon size={20} />
            Your Rides
          </h2>


          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500">Loading ride history...</p>
            </div>
          ) : filteredRides.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <CarIcon className="mx-auto text-gray-300" size={48} />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No rides found</h3>
              <p className="mt-2 text-gray-500">
                {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Your ride history will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((ride) => (
                <div
                  key={ride.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Ride Header */}
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          ride.status === 'completed' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {ride.status === 'completed' ? (
                            <CheckCircleIcon className="text-green-600" size={20} />
                          ) : (
                            <XCircleIcon className="text-red-600" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {formatDate(ride.requested_at)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatTime(ride.requested_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">
                          ${(ride.final_total || ride.estimated_total).toFixed(2)}
                        </p>
                        {ride.rider_count && ride.rider_count > 1 && ride.cost_per_person && (
                          <p className="text-xs text-orange-600 font-medium">
                            {formatCurrency(ride.cost_per_person)}/person
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 justify-end mt-1">
                          {ride.rider_count && ride.rider_count > 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <UsersIcon size={10} />
                              {ride.rider_count}
                            </span>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ride.status === 'completed' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ride Details */}
                  <div className="p-4">
                    {/* Route */}
                    <div className="flex gap-3 mb-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <div className="w-0.5 h-8 bg-gray-200 my-1" />
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Pickup</p>
                          <p className="text-sm text-gray-900 line-clamp-1">{ride.pickup_address}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Dropoff</p>
                          <p className="text-sm text-gray-900 line-clamp-1">{ride.dropoff_address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Driver & Trip Info */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-3">
                        {ride.driver?.user?.full_name ? (
                          <>
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <CarIcon className="text-gray-500" size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {ride.driver.user.full_name}
                              </p>
                              {ride.rating && (
                                <div className="flex items-center gap-1">
                                  {renderStars(ride.rating.rating)}
                                  <span className="text-xs text-gray-500 ml-1">
                                    Your rating
                                  </span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-gray-500">No driver assigned</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <NavigationIcon size={14} />
                          <span>{ride.actual_distance_miles || ride.estimated_distance_miles} mi</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon size={14} />
                          <span>{ride.actual_duration_minutes || ride.estimated_duration_minutes} min</span>
                        </div>
                      </div>
                    </div>

                    {/* Rating Feedback */}
                    {ride.rating?.feedback && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Your feedback</p>
                        <p className="text-sm text-gray-700 italic">"{ride.rating.feedback}"</p>
                      </div>
                    )}

                    {/* Receipt Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleViewReceipt(ride)}
                        className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <ReceiptIcon size={16} />
                        Quick View
                      </button>
                      <a
                        href={`/receipt/${ride.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLinkIcon size={16} />
                        Full Receipt
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>


      {/* Receipt Modal */}
      {selectedRide && (
        <RideReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedRide(null);
          }}
          ride={selectedRide}
          driverName={selectedRide.driver?.user?.full_name}
        />
      )}
    </div>
  );
};

export default RideHistoryPage;
