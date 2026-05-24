import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircleIcon, MapPinIcon, ClockIcon, UserIcon } from '@/components/ui/Icons';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  preferredDate: string;
  preferredTime: string;
  additionalNotes: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  preferredDate?: string;
  preferredTime?: string;
}

const RiderRequestPage: React.FC = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    pickupLocation: '',
    dropoffLocation: '',
    preferredDate: '',
    preferredTime: '',
    additionalNotes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-\+\(\)]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.pickupLocation.trim()) {
      newErrors.pickupLocation = 'Pickup location is required';
    }

    if (!formData.dropoffLocation.trim()) {
      newErrors.dropoffLocation = 'Drop-off location is required';
    }

    if (!formData.preferredDate) {
      newErrors.preferredDate = 'Preferred date is required';
    }

    if (!formData.preferredTime) {
      newErrors.preferredTime = 'Preferred time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build the mailto body with all form data
      const subject = encodeURIComponent(`Ride Request from ${formData.fullName}`);
      const body = encodeURIComponent(
        `Rider Request Form Submission\n` +
        `----------------------------\n\n` +
        `Full Name: ${formData.fullName}\n` +
        `Email: ${formData.email}\n` +
        `Phone: ${formData.phone}\n` +
        `Pickup Location: ${formData.pickupLocation}\n` +
        `Drop-off Location: ${formData.dropoffLocation}\n` +
        `Preferred Date: ${formData.preferredDate}\n` +
        `Preferred Time: ${formData.preferredTime}\n` +
        `Additional Notes: ${formData.additionalNotes || 'None'}\n`
      );

      // Open mailto link to send to SitNride support
      window.location.href = `mailto:support@sitNride.net?subject=${subject}&body=${body}`;

      // Brief delay to allow mailto to open, then show confirmation
      await new Promise((resolve) => setTimeout(resolve, 500));

      setIsSubmitted(true);
      toast({
        title: 'Request Submitted!',
        description: 'Thank you for your request. A SitNride representative will contact you shortly.',
      });

      setFormData({
        fullName: '',
        email: '',
        phone: '',
        pickupLocation: '',
        dropoffLocation: '',
        preferredDate: '',
        preferredTime: '',
        additionalNotes: '',
      });
    } catch (error) {
      console.error('Error submitting rider request:', error);
      toast({
        title: 'Submission Failed',
        description:
          'There was an error submitting your request. Please try again or email us directly at support@sitNride.net.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for the date input min attribute
  const today = new Date().toISOString().split('T')[0];

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
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Home
              </Link>
              <Link
                to="/contact"
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 lg:pt-32 lg:pb-16 bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
              Request a <span className="text-orange-600">Ride</span>
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Fill out the form below to request a ride. A SitNride representative will contact you to confirm your trip details.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Sidebar Info */}
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                How It Works
              </h2>

              {/* Step 1 */}
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-bold text-lg">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Submit Your Request</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Enter your name, contact info, pickup and drop-off locations, and your preferred date and time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-bold text-lg">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">We Review & Confirm</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      A SitNride representative will review your request and contact you to confirm the details.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-lg">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Enjoy Your Ride</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Once confirmed, a verified local driver will pick you up at your requested location and time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Questions?
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  SitNride can be contacted exclusively by email at{' '}
                  <a
                    href="mailto:support@sitNride.net"
                    className="text-orange-600 hover:text-orange-700 underline font-medium"
                  >
                    support@sitNride.net
                  </a>.
                </p>
              </div>

              {/* Trust badges */}
              <div className="p-6 bg-gray-50 rounded-2xl">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Why Ride with SitNride
                </h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600 flex-shrink-0" size={16} />
                    <span>All drivers are verified and background checked</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600 flex-shrink-0" size={16} />
                    <span>No surge pricing — fair, transparent fares</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600 flex-shrink-0" size={16} />
                    <span>Local drivers who know your community</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600 flex-shrink-0" size={16} />
                    <span>Video-recorded rides for safety</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Rider Request Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircleIcon className="text-green-600" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Request Submitted!
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      Thank you for your request. A SitNride representative will contact you shortly.
                    </p>
                    <p className="text-sm text-gray-500 mb-8">
                      If you have any questions, please email{' '}
                      <a
                        href="mailto:support@sitNride.net"
                        className="text-orange-600 hover:text-orange-700 underline font-medium"
                      >
                        support@sitNride.net
                      </a>.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button
                        onClick={() => setIsSubmitted(false)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        Submit Another Request
                      </Button>
                      <Link to="/">
                        <Button variant="outline">
                          Back to Home
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <MapPinIcon className="text-orange-600" size={20} />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Rider Request Form
                      </h2>
                    </div>
                    <p className="text-gray-600 mb-8">
                      Please provide your ride details below. All fields marked with{' '}
                      <span className="text-red-500">*</span> are required.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Full Name and Email Row */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="fullName" className="text-gray-700">
                            Full Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="fullName"
                            name="fullName"
                            type="text"
                            placeholder="Enter your full name"
                            value={formData.fullName}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.fullName ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.fullName && (
                            <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="email" className="text-gray-700">
                            Email Address <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.email && (
                            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div>
                        <Label htmlFor="phone" className="text-gray-700">
                          Phone Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className={`mt-1 ${errors.phone ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.phone && (
                          <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
                        )}
                      </div>

                      {/* Pickup and Drop-off Locations */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="pickupLocation" className="text-gray-700">
                            Pickup Location <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="pickupLocation"
                            name="pickupLocation"
                            type="text"
                            placeholder="Enter pickup address or location"
                            value={formData.pickupLocation}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.pickupLocation ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.pickupLocation && (
                            <p className="mt-1 text-sm text-red-500">{errors.pickupLocation}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="dropoffLocation" className="text-gray-700">
                            Drop-off Location <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="dropoffLocation"
                            name="dropoffLocation"
                            type="text"
                            placeholder="Enter drop-off address or location"
                            value={formData.dropoffLocation}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.dropoffLocation ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.dropoffLocation && (
                            <p className="mt-1 text-sm text-red-500">{errors.dropoffLocation}</p>
                          )}
                        </div>
                      </div>

                      {/* Preferred Date and Time */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="preferredDate" className="text-gray-700">
                            Preferred Date <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="preferredDate"
                            name="preferredDate"
                            type="date"
                            min={today}
                            value={formData.preferredDate}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.preferredDate ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.preferredDate && (
                            <p className="mt-1 text-sm text-red-500">{errors.preferredDate}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="preferredTime" className="text-gray-700">
                            Preferred Time <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="preferredTime"
                            name="preferredTime"
                            type="time"
                            value={formData.preferredTime}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.preferredTime ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.preferredTime && (
                            <p className="mt-1 text-sm text-red-500">{errors.preferredTime}</p>
                          )}
                        </div>
                      </div>

                      {/* Additional Notes */}
                      <div>
                        <Label htmlFor="additionalNotes" className="text-gray-700">
                          Additional Notes{' '}
                          <span className="text-gray-400 font-normal">(optional)</span>
                        </Label>
                        <Textarea
                          id="additionalNotes"
                          name="additionalNotes"
                          placeholder="Any special requests, accessibility needs, number of passengers, luggage, etc."
                          value={formData.additionalNotes}
                          onChange={handleInputChange}
                          rows={4}
                          className="mt-1 resize-none"
                        />
                      </div>

                      {/* Submit Button */}
                      <div className="pt-4">
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 text-lg font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg
                                className="animate-spin h-5 w-5"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              Submitting...
                            </span>
                          ) : (
                            'Submit Ride Request'
                          )}
                        </Button>
                      </div>

                      {/* Disclaimer */}
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-500 text-center">
                          By submitting this form, you agree to our{' '}
                          <Link to="/terms" className="text-orange-600 hover:underline">
                            Terms of Use
                          </Link>{' '}
                          and{' '}
                          <Link to="/privacy" className="text-orange-600 hover:underline">
                            Privacy Policy
                          </Link>
                          . This form is a ride request only — no fare estimates or pricing calculations are provided.
                          A SitNride representative will contact you to confirm your ride.
                        </p>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-white">
                  sit<span className="text-orange-400">N</span>ride
                </span>
              </Link>
              <p className="mt-4 text-gray-400 text-sm">
                A technology platform connecting riders with independent drivers in
                communities across America.
              </p>
              <p className="mt-2 text-gray-500 text-xs">
                Operated by Digital Media Connect Pro LLC
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
                    About Us
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:support@sitNride.net"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    support@sitNride.net
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/terms" className="text-gray-400 hover:text-white transition-colors">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <p className="text-center text-gray-400 text-sm">
              &copy; 2026 SitNride. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RiderRequestPage;
