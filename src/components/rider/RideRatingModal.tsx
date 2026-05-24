import React, { useState } from 'react';
import { database as supabase } from '@/lib/database';
import { Ride } from '@/types';
import {
  StarIcon, XIcon, CheckCircleIcon, RefreshIcon
} from '@/components/ui/Icons';

interface RideRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ride: Ride;
  driverName: string;
  driverImage?: string;
  onRatingSubmitted: () => void;
}

const RideRatingModal: React.FC<RideRatingModalProps> = ({
  isOpen,
  onClose,
  ride,
  driverName,
  driverImage,
  onRatingSubmitted
}) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Insert the rating
      const { error: ratingError } = await supabase
        .from('ride_ratings')
        .insert({
          ride_id: ride.id,
          rider_id: ride.rider_id,
          driver_id: ride.driver_id,
          rating: rating,
          feedback: feedback.trim() || null
        });

      if (ratingError) {
        throw ratingError;
      }

      // Mark the ride as rated
      await supabase
        .from('rides')
        .update({ is_rated: true })
        .eq('id', ride.id);

      setSubmitted(true);
      
      // Close after a short delay
      setTimeout(() => {
        onRatingSubmitted();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting rating:', err);
      setError(err.message || 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    // Mark ride as rated even if skipped
    await supabase
      .from('rides')
      .update({ is_rated: true })
      .eq('id', ride.id);
    
    onClose();
  };

  const getRatingText = (r: number) => {
    switch (r) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Great';
      case 5: return 'Excellent';
      default: return 'Tap to rate';
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {submitted ? (
          // Success State
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="text-green-600" size={40} />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Thank You!</h2>
            <p className="mt-2 text-gray-600">
              Your feedback helps us improve the experience for everyone.
            </p>
            <div className="mt-6 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon
                  key={star}
                  size={32}
                  className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white text-center">
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <XIcon size={20} />
              </button>
              <h2 className="text-2xl font-bold">Rate Your Ride</h2>
              <p className="text-orange-100 mt-1">How was your trip?</p>
            </div>

            {/* Driver Info */}
            <div className="p-6 border-b flex items-center gap-4">
              {driverImage ? (
                <img
                  src={driverImage}
                  alt={driverName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-500">
                    {driverName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-lg">{driverName}</p>
                <p className="text-sm text-gray-500">Your driver</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Trip fare</p>
                <p className="font-bold text-green-600 text-lg">
                  ${(ride.final_total || ride.estimated_total).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Rating Stars */}
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <StarIcon
                      size={40}
                      className={`transition-colors ${
                        star <= displayRating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-300 hover:text-amber-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className={`mt-3 text-lg font-medium ${displayRating > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {getRatingText(displayRating)}
              </p>
            </div>

            {/* Feedback */}
            <div className="px-6 pb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us more about your experience..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                maxLength={500}
              />
              <p className="mt-1 text-xs text-gray-400 text-right">
                {feedback.length}/500
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-6 pb-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-4 bg-gray-50 flex gap-4">
              <button
                onClick={handleSkip}
                className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || rating === 0}
                className="flex-1 py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshIcon className="animate-spin" size={20} />
                    Submitting...
                  </>
                ) : (
                  'Submit Rating'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RideRatingModal;
