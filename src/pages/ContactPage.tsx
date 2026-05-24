import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PreviousPageButton } from '@/components/ui/PreviousPageButton';

import { database as supabase } from '@/lib/database';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  ClockIcon, 
  CheckCircleIcon 
} from '@/components/ui/Icons';

interface FormData {
  name: string;
  email: string;
  userType: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  userType?: string;
  subject?: string;
  message?: string;
}

const ContactPage: React.FC = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    userType: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const userTypes = [
    { value: 'rider', label: 'Rider' },
    { value: 'driver', label: 'Driver' },
    { value: 'general', label: 'General Inquiry' },
  ];

  const subjectCategories = [
    { value: 'account', label: 'Account Issues' },
    { value: 'payment', label: 'Payment & Billing' },
    { value: 'ride', label: 'Ride Issues' },
    { value: 'safety', label: 'Safety Concern' },
    { value: 'feedback', label: 'Feedback & Suggestions' },
    { value: 'driver-application', label: 'Driver Application' },
    { value: 'partnership', label: 'Business & Partnership' },
    { value: 'press', label: 'Press & Media' },
    { value: 'other', label: 'Other' },
  ];

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.userType) {
      newErrors.userType = 'Please select a user type';
    }

    if (!formData.subject) {
      newErrors.subject = 'Please select a subject category';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
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

  const handleSelectChange = (name: string, value: string) => {
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
      const { data, error } = await supabase.functions.invoke('contact-form', {
        body: formData,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: 'Message Sent!',
        description: 'Thank you for contacting us. We will respond via email within 24-48 hours.',
      });

      setFormData({
        name: '',
        email: '',
        userType: '',
        subject: '',
        message: '',
      });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      toast({
        title: 'Submission Failed',
        description: 'There was an error sending your message. Please try again or email us directly at support@sitNride.net.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <PreviousPageButton className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors" />
              <Link
                to="/"
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Home
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
              Contact <span className="text-orange-600">Us</span>
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              The only method of contact is email. Please contact us at{' '}
              <a href="mailto:support@sitNride.net" className="text-orange-600 hover:text-orange-700 underline font-medium">
                support@sitNride.net
              </a>.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Get in Touch
              </h2>

              {/* Email - Primary Contact */}
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-orange-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Email Support</h3>
                    <a
                      href="mailto:support@sitNride.net"
                      className="text-orange-600 hover:text-orange-700 transition-colors font-medium"
                    >
                      support@sitNride.net
                    </a>
                    <p className="text-sm text-gray-500 mt-1">
                      For all inquiries and support
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Company</h3>
                    <p className="text-gray-600 mt-1">Digital Media Connect Pro LLC</p>
                  </div>
                </div>
              </div>

              {/* Email Response Hours */}
              <div className="mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ClockIcon className="text-green-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Email Response Hours</h3>
                    <div className="text-gray-600 mt-1 space-y-1">
                      <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
                      <p>Saturday: 10:00 AM - 4:00 PM EST</p>
                      <p>Sunday: Closed</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Emergency safety issues are monitored 24/7 via email
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Only Notice */}
              <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Email Only Contact
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  The only method of contact is email. Please contact us at{' '}
                  <a href="mailto:support@sitNride.net" className="text-orange-600 hover:text-orange-700 underline font-medium">
                    support@sitNride.net
                  </a>.
                </p>
                <p className="text-xs text-gray-500">
                  We do not accept phone calls, mailed letters, or physical visits. All communication is handled exclusively via email.
                </p>
              </div>

              {/* Response Time */}
              <div className="p-6 bg-gray-50 rounded-2xl">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Response Times
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600" size={16} />
                    <span>General inquiries: 24-48 hours</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600" size={16} />
                    <span>Safety concerns: Within 4 hours</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600" size={16} />
                    <span>Payment issues: 1-2 business days</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="text-green-600" size={16} />
                    <span>Driver applications: 3-5 business days</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircleIcon className="text-green-600" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Message Sent Successfully!
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Thank you for reaching out. Our team will review your message 
                      and respond via email within 24-48 hours.
                    </p>
                    <Button
                      onClick={() => setIsSubmitted(false)}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      Send Us a Message
                    </h2>
                    <p className="text-gray-600 mb-8">
                      Fill out the form below and we'll respond via email as soon as possible. 
                      All responses will be sent to the email address you provide.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Name and Email Row */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="name" className="text-gray-700">
                            Full Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="name"
                            name="name"
                            type="text"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.name ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.name && (
                            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
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
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={`mt-1 ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {errors.email && (
                            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                          )}
                        </div>
                      </div>

                      {/* User Type */}
                      <div>
                        <Label htmlFor="userType" className="text-gray-700">
                          I am a <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={formData.userType}
                          onValueChange={(value) => handleSelectChange('userType', value)}
                        >
                          <SelectTrigger
                            className={`mt-1 ${errors.userType ? 'border-red-500 focus:ring-red-500' : ''}`}
                          >
                            <SelectValue placeholder="Select user type" />
                          </SelectTrigger>
                          <SelectContent>
                            {userTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.userType && (
                          <p className="mt-1 text-sm text-red-500">{errors.userType}</p>
                        )}
                      </div>

                      {/* Subject Category */}
                      <div>
                        <Label htmlFor="subject" className="text-gray-700">
                          Subject Category <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={formData.subject}
                          onValueChange={(value) => handleSelectChange('subject', value)}
                        >
                          <SelectTrigger
                            className={`mt-1 ${errors.subject ? 'border-red-500 focus:ring-red-500' : ''}`}
                          >
                            <SelectValue placeholder="Select a subject category" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjectCategories.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.subject && (
                          <p className="mt-1 text-sm text-red-500">{errors.subject}</p>
                        )}
                      </div>

                      {/* Message */}
                      <div>
                        <Label htmlFor="message" className="text-gray-700">
                          Message <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="Please describe your question, issue, or feedback in detail..."
                          value={formData.message}
                          onChange={handleInputChange}
                          rows={6}
                          className={`mt-1 resize-none ${errors.message ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.message && (
                          <p className="mt-1 text-sm text-red-500">{errors.message}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          {formData.message.length}/1000 characters
                        </p>
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
                              Sending...
                            </span>
                          ) : (
                            'Send Message'
                          )}
                        </Button>
                      </div>

                      {/* Privacy Notice */}
                      <p className="text-sm text-gray-500 text-center">
                        By submitting this form, you agree to our{' '}
                        <Link to="/terms" className="text-orange-600 hover:underline">
                          Terms of Use
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="text-orange-600 hover:underline">
                          Privacy Policy
                        </Link>
                        . We will respond to your inquiry via email only.
                      </p>
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
                  <Link
                    to="/contact"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
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
                  <Link
                    to="/terms"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <p className="text-center text-gray-400 text-sm">
              &copy; 2026 sitNride. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ContactPage;
