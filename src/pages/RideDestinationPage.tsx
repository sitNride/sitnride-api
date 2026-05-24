import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { database as supabase } from '@/lib/database';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircleIcon, MapPinIcon, NavigationIcon, ClockIcon, CalendarIcon } from '@/components/ui/Icons';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
}

interface RideDetails {
  pickupLocation: string;
  destinationLocation: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

interface RideErrors {
  pickupLocation?: string;
  destinationLocation?: string;
  preferredDate?: string;
  preferredTime?: string;
}

const RideDestinationPage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<RideErrors>({});

  const [rideDetails, setRideDetails] = useState<RideDetails>({
    pickupLocation: '',
    destinationLocation: '',
    preferredDate: '',
    preferredTime: '',
    notes: '',
  });

  // Check for authenticated user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('rideshare_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
    }
    setIsLoading(false);
  }, []);

  // If not logged in, redirect to home
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/');
    }
  }, [isLoading, user, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('rideshare_user');
    setUser(null);
    navigate('/');
  };

  const today = new Date().toISOString().split('T')[0];

  const validateDetails = (): boolean => {
    const newErrors: RideErrors = {};

    if (!rideDetails.pickupLocation.trim()) {
      newErrors.pickupLocation = 'Pickup location is required';
    }

    if (!rideDetails.destinationLocation.trim()) {
      newErrors.destinationLocation = 'Destination location is required';
    }

    if (!rideDetails.preferredDate) {
      newErrors.preferredDate = 'Preferred date is required';
    }

    if (!rideDetails.preferredTime) {
      newErrors.preferredTime = 'Preferred time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setRideDetails((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof RideErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDetails()) return;
    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('ride_submissions').insert({
        user_id: user.id,
        pickup_location: rideDetails.pickupLocation,
        destination_location: rideDetails.destinationLocation,
        preferred_date: rideDetails.preferredDate,
        preferred_time: rideDetails.preferredTime,
        notes: rideDetails.notes || null,
        status: 'submitted',
      });

      if (error) {
        console.error('Error saving ride details:', error);
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Error submitting ride details:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading sitNride...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

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
              <span className="text-sm text-gray-500 hidden sm:inline">
                Welcome, {user.full_name}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="pt-24 pb-10 lg:pt-28 lg:pb-12 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-5">
            <NavigationIcon className="text-orange-600" size={16} />
            <span className="text-sm font-medium text-orange-800">Ride Destination</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Where Are You <span className="text-orange-600">Going?</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
            Enter your pickup and destination details below. A sitNride driver will be matched to your trip.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-10 sm:py-14">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {isSubmitted ? (
              /* Confirmation */
              <div className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircleIcon className="text-green-600" size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Your ride details have been submitted.
                </h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  A sitNride representative will review your trip and match you with a verified local driver.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setRideDetails({
                        pickupLocation: '',
                        destinationLocation: '',
                        preferredDate: '',
                        preferredTime: '',
                        notes: '',
                      });
                    }}
                    className="px-6 py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors"
                  >
                    Submit Another Trip
                  </button>
                  <Link
                    to="/"
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-center"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            ) : (
              /* Ride Details Entry */
              <>
                <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-1">
                    <MapPinIcon className="text-white" size={24} />
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      Ride Destination
                    </h2>
                  </div>
                  <p className="text-orange-100 text-sm sm:text-base">
                    Tell us where you're being picked up and where you're going.
                  </p>
                </div>

                <div className="p-6 sm:p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Pickup Location */}
                    <div>
                      <Label htmlFor="pickupLocation" className="text-gray-700 flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <MapPinIcon className="text-green-600" size={14} />
                        </div>
                        Pickup Location <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="pickupLocation"
                        name="pickupLocation"
                        type="text"
                        placeholder="Enter your pickup address or location"
                        value={rideDetails.pickupLocation}
                        onChange={handleInputChange}
                        className={`${errors.pickupLocation ? 'border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.pickupLocation && (
                        <p className="mt-1 text-sm text-red-500">{errors.pickupLocation}</p>
                      )}
                    </div>

                    {/* Destination Location */}
                    <div>
                      <Label htmlFor="destinationLocation" className="text-gray-700 flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <NavigationIcon className="text-red-600" size={14} />
                        </div>
                        Destination Location <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="destinationLocation"
                        name="destinationLocation"
                        type="text"
                        placeholder="Enter your destination address or location"
                        value={rideDetails.destinationLocation}
                        onChange={handleInputChange}
                        className={`${errors.destinationLocation ? 'border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.destinationLocation && (
                        <p className="mt-1 text-sm text-red-500">{errors.destinationLocation}</p>
                      )}
                    </div>

                    {/* Date and Time Row */}
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="preferredDate" className="text-gray-700 flex items-center gap-2 mb-1.5">
                          <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                            <CalendarIcon className="text-purple-600" size={14} />
                          </div>
                          Preferred Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="preferredDate"
                          name="preferredDate"
                          type="date"
                          min={today}
                          value={rideDetails.preferredDate}
                          onChange={handleInputChange}
                          className={`${errors.preferredDate ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.preferredDate && (
                          <p className="mt-1 text-sm text-red-500">{errors.preferredDate}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="preferredTime" className="text-gray-700 flex items-center gap-2 mb-1.5">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <ClockIcon className="text-blue-600" size={14} />
                          </div>
                          Preferred Time <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="preferredTime"
                          name="preferredTime"
                          type="time"
                          value={rideDetails.preferredTime}
                          onChange={handleInputChange}
                          className={`${errors.preferredTime ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.preferredTime && (
                          <p className="mt-1 text-sm text-red-500">{errors.preferredTime}</p>
                        )}
                      </div>
                    </div>

                    {/* Optional Notes */}
                    <div>
                      <Label htmlFor="notes" className="text-gray-700 mb-1.5">
                        Optional Notes
                      </Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        placeholder="Any special requests, accessibility needs, number of passengers, etc."
                        value={rideDetails.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-orange-600 text-white rounded-xl font-semibold text-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon size={20} />
                            Submit Ride Details
                          </>
                        )}
                      </button>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 text-center">
                        By submitting, you agree to our{' '}
                        <Link to="/terms" className="text-orange-600 hover:underline">
                          Terms of Use
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="text-orange-600 hover:underline">
                          Privacy Policy
                        </Link>
                        . Your ride details will be saved to your account and reviewed by a sitNride representative.
                      </p>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-10">
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

export default RideDestinationPage;
