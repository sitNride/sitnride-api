import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CarIcon,
  CheckCircleIcon,
  ShieldIcon,
  ArrowRightIcon,
  ClockIcon,
  UserIcon,
} from '@/components/ui/Icons';

/**
 * DriverOnboardingWelcomePage
 * ---------------------------
 * Guided intermediate step between driver account creation and the
 * Upload Documents form.
 *
 * Flow:
 *   /apply-to-drive
 *     → Create Driver Account / Sign In
 *     → /onboarding-welcome  (this page)
 *     → "Continue to Document Upload"
 *     → /upload-documents (existing flow, unchanged)
 *
 * SCOPE BOUNDARIES (do not change without explicit request):
 *   - No auth refactor (this page does not call useAuth())
 *   - No onboarding form changes
 *   - No verification / vehicle / dashboard / pricing / Mapbox / Twilio changes
 *   - No database state mutation — this page is purely informational
 *
 * AuthProvider is intentionally NOT required here. This page renders
 * static guidance content and a navigation CTA. It is registered as a
 * top-level route in App.tsx (same level as /apply-to-drive and
 * /upload-documents).
 */
const DriverOnboardingWelcomePage: React.FC = () => {
  const navigate = useNavigate();

  const continueToUpload = () => navigate('/upload-documents');

  const steps: Array<{
    n: number;
    title: string;
    desc: string;
    current?: boolean;
  }> = [
    {
      n: 1,
      title: 'Upload required documents',
      desc: 'Driver\'s license, insurance, vehicle registration, and vehicle photos.',
      current: true,
    },
    {
      n: 2,
      title: 'Application & background check review',
      desc: 'The sitNride team reviews your application and runs a background check on your driving record and history.',
    },
    {
      n: 3,
      title: 'Vehicle verification & inspection review',
      desc: 'We verify your vehicle details and inspection documents to make sure your car is ride-ready.',
    },
    {
      n: 4,
      title: 'Approval notification',
      desc: 'Once everything checks out, you\'ll receive an approval notification by email and in your driver account.',
    },
    {
      n: 5,
      title: 'Access Driver Dashboard & start accepting rides',
      desc: 'Go online from the Driver Dashboard, accept ride requests, and start earning on your schedule.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Top nav (simple, consistent with /apply-to-drive) */}
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
                to="/apply-to-drive"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:inline-block"
              >
                Apply to Drive
              </Link>
              <Link
                to="/faq"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:inline-block"
              >
                Help
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

      {/* Hero / welcome */}
      <section className="pt-28 pb-10 lg:pt-32 lg:pb-12 bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full mb-5">
            <CheckCircleIcon className="text-green-700" size={16} />
            <span className="text-sm font-medium text-green-800">
              Account created — welcome to sitNride
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
            Welcome to sit<span className="text-orange-600">N</span>ride{' '}
            <span className="text-green-700">Driver Onboarding</span>
          </h1>
          <p className="mt-5 text-lg text-gray-600">
            Your driver account is ready. Onboarding happens step-by-step so
            you always know what's next. Take a moment to review the process
            below, then continue when you're ready.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Why documents are required */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <ShieldIcon className="text-blue-700" size={20} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                Why we ask for documents
              </h2>
            </div>
            <p className="text-gray-600">
              sitNride is a community-trust platform. Document verification
              keeps riders safe, keeps drivers protected, and makes sure
              everyone on the road meets the same standard. We only ask for
              what's necessary to confirm your identity, your vehicle, and
              your insurance coverage.
            </p>
            <ul className="mt-5 grid sm:grid-cols-2 gap-3">
              <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">Confirms you're a licensed driver</span>
              </li>
              <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">Confirms valid auto insurance</span>
              </li>
              <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">Confirms vehicle registration & condition</span>
              </li>
              <li className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">Supports background-check compliance</span>
              </li>
            </ul>
          </div>

          {/* Next steps in order */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <ClockIcon className="text-green-700" size={20} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                What happens next
              </h2>
            </div>
            <p className="text-gray-600">
              Here's the exact order of the remaining onboarding steps. You
              are on <strong>Step 1</strong> below.
            </p>
            <ol className="mt-6 space-y-4">
              {steps.map((s) => (
                <li
                  key={s.n}
                  className={`flex items-start gap-4 p-4 rounded-xl border ${
                    s.current
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      s.current
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {s.n}
                  </span>
                  <div>
                    <p
                      className={`font-semibold ${
                        s.current ? 'text-green-900' : 'text-gray-900'
                      }`}
                    >
                      {s.title}
                      {s.current && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">
                          You are here
                        </span>
                      )}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        s.current ? 'text-green-800' : 'text-gray-600'
                      }`}
                    >
                      {s.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Reassurance */}
          <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-100 rounded-2xl p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <UserIcon className="text-blue-700 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-gray-900">
                  This is part of normal driver setup
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Every sitNride driver goes through these same steps. You
                  can pause at any point and return to your account to pick up
                  where you left off — your progress is saved as you go.
                  If you run into trouble, the FAQ Help Center and Support
                  team are one click away.
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <Link
                    to="/faq"
                    className="text-blue-700 hover:text-blue-800 font-medium"
                  >
                    FAQ Help Center →
                  </Link>
                  <Link
                    to="/contact"
                    className="text-blue-700 hover:text-blue-800 font-medium"
                  >
                    Contact Support →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 sm:p-8 text-white text-center">
            <h3 className="text-xl sm:text-2xl font-bold">
              Ready for Step 1?
            </h3>
            <p className="mt-2 text-green-100">
              Have your driver's license, insurance, and vehicle registration
              handy. Most drivers finish this step in under 10 minutes.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={continueToUpload}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-green-700 rounded-2xl font-semibold text-lg hover:bg-green-50 transition-all shadow-lg"
              >
                <CarIcon size={20} />
                Continue to Document Upload
                <ArrowRightIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (consistent with /apply-to-drive) */}
      <footer className="bg-gray-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-white">
                sit<span className="text-orange-400">N</span>ride
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm flex-wrap justify-center">
              <Link to="/apply-to-drive" className="text-gray-400 hover:text-white transition-colors">
                Apply to Drive
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
    </div>
  );
};

export default DriverOnboardingWelcomePage;
