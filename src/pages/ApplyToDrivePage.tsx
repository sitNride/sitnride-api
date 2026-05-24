import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CarIcon,
  DollarIcon,
  ShieldIcon,
  CheckCircleIcon,
  CameraIcon,
  ArrowRightIcon,
  UserIcon,
  ClockIcon,
  AlertCircleIcon,
} from '@/components/ui/Icons';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

import AuthModal from '@/components/auth/AuthModal';

/**
 * ApplyToDrivePage
 * ----------------
 * Dedicated "Apply to Drive" landing/application page.
 *
 * Purpose: separate the INTENT step ("I want to become a sitNride driver")
 * from the EXECUTION step (document/vehicle upload onboarding at
 * /upload-documents).
 *
 * Flow:
 *   Homepage → Driver Earnings Estimator → "Get Started"
 *     → /apply-to-drive  (this page)
 *     → "Create Driver Account / Sign In"  (AuthModal, driver role)
 *     → After successful auth: REMAIN on /apply-to-drive
 *     → "Continue to Driver Onboarding" → /upload-documents
 *
 * IMPORTANT — scope boundaries (do not change without explicit request):
 *   - No onboarding/upload form changes
 *   - No auth refactor (this page just hosts an AuthModal instance)
 *   - No verification / vehicle / dashboard / pricing / Mapbox changes
 *   - No verification / vehicle / dashboard / pricing / Mapbox changes
 *
 * AUTHPROVIDER SCOPE FIX:
 * This route is registered directly in App.tsx and is NOT wrapped by
 * Index → AppProvider → AppLayout → AuthProvider. So we self-host a local
 * <AuthProvider> here (same pattern AdminDiagnosticsPage uses) so that
 * useAuth() and AuthModal (which also calls useAuth) have a provider in
 * their React tree. No global auth refactor required.
 */
const ApplyToDrivePageInner: React.FC = () => {

  const navigate = useNavigate();
  const { user } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  // Post-auth routing:
  //   - BRAND-NEW driver signup  → guided onboarding welcome page
  //                                (/onboarding-welcome), which then leads
  //                                into /upload-documents on user click.
  //   - Returning driver sign-in → stay on /apply-to-drive (existing behavior)
  // We detect "brand-new" purely from the modal mode the user just submitted
  // (authMode === 'signup'). No changes to AuthModal, AuthContext, or DB.
  const handleAuthSuccess = () => {
    setShowAuth(false);
    if (authMode === 'signup') {
      // First-time driver → show the guided onboarding welcome/introduction
      // page before the document upload form. The welcome page itself
      // navigates to /upload-documents when the user clicks "Continue".
      navigate('/onboarding-welcome');
    }
    // else: returning driver logged in — stay on /apply-to-drive so they
    // can choose to continue to onboarding manually.
  };

  const goToOnboarding = () => navigate('/upload-documents');


  const isAuthenticatedDriver = !!user && user.role === 'driver';

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
              <Link
                to="/driver-trip-estimator"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:inline-block"
              >
                Driver Earnings
              </Link>
              <Link
                to="/driver-requirements"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:inline-block"
              >
                Requirements
              </Link>
              <Link
                to="/"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-12 lg:pt-32 lg:pb-16 bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full mb-5">
            <CarIcon className="text-green-700" size={16} />
            <span className="text-sm font-medium text-green-800">
              Apply to Drive with sitNride
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
            Drive in Your Community.{' '}
            <span className="text-green-700">Earn on Your Schedule.</span>
          </h1>
          <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
            sitNride connects independent drivers with riders in local communities.
            Review what's required, then create your driver account to begin the
            onboarding process.
          </p>

          {/* Primary CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthenticatedDriver ? (
              <button
                onClick={goToOnboarding}
                className="flex items-center justify-center gap-2 px-7 py-4 bg-green-600 text-white rounded-2xl font-semibold text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-600/30"
              >
                Continue to Driver Onboarding
                <ArrowRightIcon size={18} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => openAuth('signup')}
                  className="flex items-center justify-center gap-2 px-7 py-4 bg-green-600 text-white rounded-2xl font-semibold text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-600/30"
                >
                  <CarIcon size={20} />
                  Create Driver Account
                </button>
                <button
                  onClick={() => openAuth('login')}
                  className="flex items-center justify-center gap-2 px-7 py-4 bg-white text-green-700 border-2 border-green-600 rounded-2xl font-semibold text-lg hover:bg-green-50 transition-all"
                >
                  <UserIcon size={20} />
                  Sign In
                </button>
              </>
            )}
          </div>

          {isAuthenticatedDriver && (
            <p className="mt-4 text-sm text-green-700 font-medium">
              Signed in as {user?.email}. You can proceed to onboarding when ready.
            </p>
          )}
        </div>
      </section>

      {/* Main content */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 gap-8">
          {/* Left column: overview + requirements */}
          <div className="lg:col-span-2 space-y-8">
            {/* Earnings overview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarIcon className="text-green-700" size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Earnings Opportunity
                </h2>
              </div>
              <p className="text-gray-600">
                sitNride drivers keep the majority of every fare. Earnings depend
                on hours driven, location, and ride demand.
              </p>
              <ul className="mt-5 space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                  <span className="text-gray-700">
                    <strong>Driver keeps 75%</strong> of every fare.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                  <span className="text-gray-700">
                    <strong>Weekend bonus (+5%)</strong> on Saturday and Sunday trips.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                  <span className="text-gray-700">
                    <strong>Late-night bonus (+$0.50)</strong> for trips between
                    12:00 AM and 5:00 AM.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                  <span className="text-gray-700">
                    Instant cash-out available, flexible scheduling, and no surge surprises.
                  </span>
                </li>
              </ul>
              <div className="mt-5">
                <Link
                  to="/driver-trip-estimator"
                  className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium text-sm"
                >
                  Estimate your earnings for a real trip
                  <ArrowRightIcon size={14} />
                </Link>
              </div>
            </div>

            {/* Requirements summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <CheckCircleIcon className="text-blue-700" size={20} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Driver Requirements
                </h2>
              </div>
              <p className="text-gray-600">
                To drive on sitNride you'll need to meet basic eligibility and
                upload supporting documents during onboarding.
              </p>
              <ul className="mt-5 grid sm:grid-cols-2 gap-3">
                <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-sm text-gray-700">21+ years old</span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-sm text-gray-700">Valid driver's license</span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-sm text-gray-700">
                    4-door vehicle in good condition
                  </span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-sm text-gray-700">
                    Vehicle registration & inspection
                  </span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-sm text-gray-700">
                    Smartphone with data plan
                  </span>
                </li>
                <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                  <span className="text-sm text-gray-700">
                    Bank account for direct deposit
                  </span>
                </li>
              </ul>
              <div className="mt-4">
                <Link
                  to="/driver-requirements"
                  className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 font-medium text-sm"
                >
                  View the full driver requirements page
                  <ArrowRightIcon size={14} />
                </Link>
              </div>
            </div>

            {/* Background check + insurance + camera notices */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-5">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Safety & Compliance Notices
              </h2>

              {/* Background check */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <ShieldIcon className="text-amber-700 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-amber-900">Background Check Required</p>
                  <p className="text-sm text-amber-800 mt-1">
                    All driver applicants must pass a comprehensive background check,
                    including driving record and criminal history review. This is part
                    of our 9-step verification process.
                  </p>
                </div>
              </div>

              {/* Insurance */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <CheckCircleIcon className="text-blue-700 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-blue-900">Insurance Requirement</p>
                  <p className="text-sm text-blue-800 mt-1">
                    Drivers must maintain valid personal auto insurance that meets
                    state minimums. Proof of insurance is uploaded during onboarding
                    and must remain current while you are active on the platform.
                  </p>
                </div>
              </div>

              {/* Camera / safety */}
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <CameraIcon className="text-orange-700 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-orange-900">In-Vehicle Camera (Video Only)</p>
                  <p className="text-sm text-orange-800 mt-1">
                    sitNride requires drivers to use an in-vehicle camera that records
                    <strong> video only</strong> (no audio) for safety. Footage is owned
                    and stored by the driver and is only requested in the event of a
                    serious incident, dispute, or legal matter.
                  </p>
                </div>
              </div>

              {/* Independent contractor */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <AlertCircleIcon className="text-gray-700 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-semibold text-gray-900">Independent Contractor</p>
                  <p className="text-sm text-gray-700 mt-1">
                    Drivers on sitNride are independent contractors, not employees.
                    You control when, where, and how long you work, and you are
                    responsible for your own vehicle expenses, insurance, and taxes.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom CTA — Continue to Onboarding */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 sm:p-8 text-white">
              <h3 className="text-xl sm:text-2xl font-bold">Ready to start onboarding?</h3>
              <p className="mt-2 text-green-100">
                {isAuthenticatedDriver
                  ? 'You\'re signed in as a driver. Continue to upload your documents and vehicle information.'
                  : 'Create your driver account first. After signing up you\'ll return here, then continue to onboarding when you\'re ready.'}
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                {isAuthenticatedDriver ? (
                  <button
                    onClick={goToOnboarding}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-colors"
                  >
                    Continue to Driver Onboarding
                    <ArrowRightIcon size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openAuth('signup')}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-colors"
                    >
                      <CarIcon size={18} />
                      Create Driver Account
                    </button>
                    <button
                      onClick={() => openAuth('login')}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-800/40 text-white border border-white/40 rounded-xl font-semibold hover:bg-green-800/60 transition-colors"
                    >
                      <UserIcon size={18} />
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right column: process / sidebar */}
          <aside className="space-y-6">
            <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClockIcon className="text-green-700" size={18} />
                How the Process Works
              </h3>
              <ol className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Apply</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Review requirements on this page.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Create Account</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Sign up as a driver (or sign in if you already have an account).
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Onboarding</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Upload driver's license, insurance, vehicle photos, and complete inspection.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Approval</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Background check and document review by the sitNride team.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                    5
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Start Driving</p>
                    <p className="text-gray-600 text-xs mt-0.5">
                      Go online from the Driver Dashboard and start accepting rides.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Have Questions?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Visit the FAQ Help Center or contact our support team for help with
                your application.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  to="/faq"
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  FAQ Help Center →
                </Link>
                <Link
                  to="/contact"
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  Contact Support →
                </Link>
              </div>
            </div>
          </aside>
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
            <div className="flex items-center gap-6 text-sm flex-wrap justify-center">
              <Link to="/driver-trip-estimator" className="text-gray-400 hover:text-white transition-colors">
                Driver Earnings
              </Link>
              <Link to="/driver-requirements" className="text-gray-400 hover:text-white transition-colors">
                Driver Requirements
              </Link>
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

      {/* Auth Modal — driver role pre-selected.
          IMPORTANT: onSuccess does NOT navigate to /upload-documents.
          The user stays on /apply-to-drive and clicks "Continue to Driver
          Onboarding" when they're ready. This is the intentional separation
          between application intent and onboarding execution. */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
        initialRole="driver"
      />
    </div>
  );
};

// Public export: wraps the inner component with a LOCAL <AuthProvider> so that
// useAuth() / AuthModal work on this directly-registered route. This mirrors
// the same pattern used by AdminDiagnosticsPage. No global auth refactor.
const ApplyToDrivePage: React.FC = () => (
  <AuthProvider>
    <ApplyToDrivePageInner />
  </AuthProvider>
);

export default ApplyToDrivePage;
