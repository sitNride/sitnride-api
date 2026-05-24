import React from 'react';
import { Link } from 'react-router-dom';
import {
  DollarIcon,
  CarIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  TrendingUpIcon,
  NavigationIcon,
  ShieldIcon,
  ArrowRightIcon,
  MapPinIcon,
} from '@/components/ui/Icons';

const earningsExamples = [
  {
    label: 'Short Local Ride',
    description: 'Quick trip across town — grocery store, school, or nearby appointment.',
    distance: '3 miles',
    duration: '~10 min',
    estimatedPay: '$6 – $9',
    icon: <MapPinIcon className="text-green-600" size={22} />,
  },
  {
    label: 'Medium Commute Ride',
    description: 'Standard commute ride — suburb to downtown, campus to workplace.',
    distance: '10 miles',
    duration: '~20 min',
    estimatedPay: '$14 – $19',
    icon: <NavigationIcon className="text-green-600" size={22} />,
  },
  {
    label: 'Longer Distance Ride',
    description: 'Cross-city trip or airport run — higher mileage, higher earnings.',
    distance: '25 miles',
    duration: '~35 min',
    estimatedPay: '$30 – $40',
    icon: <CarIcon className="text-green-600" size={22} />,
  },
  {
    label: 'Shared Ride (Multiple Riders)',
    description: 'Shared ride with 2–3 riders heading in the same direction. The total fare is higher, increasing your earnings per trip.',
    distance: '8 miles',
    duration: '~18 min',
    estimatedPay: '$12 – $18',
    icon: <UsersIcon className="text-green-600" size={22} />,
  },
];

const howItWorks = [
  {
    title: 'Earn Per Ride',
    description:
      'Every completed ride earns you money. You are paid for each trip based on a transparent formula — no guessing, no hidden math.',
    icon: <DollarIcon className="text-green-600" size={28} />,
  },
  {
    title: 'Pay Based on Distance & Time',
    description:
      'Your earnings are calculated using a base fee plus per-mile and per-minute rates. Longer rides and longer trips mean higher pay.',
    icon: <NavigationIcon className="text-green-600" size={28} />,
  },
  {
    title: 'Shared Rides Increase Efficiency',
    description:
      'When multiple riders share a trip, the total fare is higher. You earn more per trip while helping riders save money — everyone benefits.',
    icon: <UsersIcon className="text-green-600" size={28} />,
  },
  {
    title: 'Keep a Competitive Portion',
    description:
      'sitNride drivers keep 75% of every fare. That means more of the money riders pay goes directly into your pocket.',

    icon: <TrendingUpIcon className="text-green-600" size={28} />,
  },
];

const DriverPayEstimatorPage: React.FC = () => {
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
                to="/estimate-fare"
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors hidden sm:inline-block"
              >
                Fare Estimator
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

      {/* ─── Section 1: Hero Headline ─── */}
      <section className="pt-24 pb-12 lg:pt-28 lg:pb-16 bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full mb-5">
            <DollarIcon className="text-green-700" size={16} />
            <span className="text-sm font-medium text-green-800">Driver Earnings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
            Estimate What You Can Earn{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
              Driving with sitNride
            </span>
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            See how much you could make as an independent driver. Transparent pay, no hidden fees,
            and the flexibility to work on your own schedule.
          </p>
        </div>
      </section>

      {/* ─── Section 2: How Driver Pay Works ─── */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">How Driver Pay Works</h2>
            <p className="mt-3 text-gray-600 max-w-xl mx-auto">
              sitNride uses a simple, transparent pay structure so you always know how your earnings
              are calculated.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, idx) => (
              <div
                key={idx}
                className="p-6 bg-green-50 rounded-2xl border border-green-100 hover:shadow-lg hover:border-green-200 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Driver Earnings Structure ─── */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Driver Earnings Structure</h2>
            <p className="mt-3 text-gray-600 max-w-xl mx-auto">
              A clear breakdown of how driver pay is structured on sitNride.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">Driver Keeps</p>
              <p className="text-3xl font-bold text-green-700">75%</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">Platform Fee</p>
              <p className="text-3xl font-bold text-gray-900">25%</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">Base Fee</p>
              <p className="text-3xl font-bold text-gray-900">$2.50</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">Per Mile</p>
              <p className="text-3xl font-bold text-gray-900">$1.50</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">Per Minute</p>
              <p className="text-3xl font-bold text-gray-900">$0.25</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500 mb-1">Minimum Fare</p>
              <p className="text-3xl font-bold text-gray-900">$5.00</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Earnings Examples ─── */}
      <section className="py-14 sm:py-20 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Earning Examples
            </h2>


            <p className="mt-3 text-sm text-gray-600 max-w-2xl mx-auto">
              The above numbers represent base pay only before the ride starts. As miles and time are added (shown below), drivers can earn a lot more. These amounts are estimates only, not guarantees.
            </p>

          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {earningsExamples.map((example, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {example.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{example.label}</h3>
                      <p className="text-sm text-gray-500 mt-1">{example.description}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <NavigationIcon className="text-gray-400" size={14} />
                      <span>{example.distance}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <ClockIcon className="text-gray-400" size={14} />
                      <span>{example.duration}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Estimated Driver Pay</span>
                    <span className="text-xl font-bold text-green-700">{example.estimatedPay}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Hourly Earnings Highlight */}
          <div className="mt-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 sm:p-8 text-center shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-3">
              <TrendingUpIcon className="text-green-200" size={24} />
              <h3 className="text-xl sm:text-2xl font-bold text-white">Hourly Earning Potential</h3>
            </div>
            <p className="text-green-100 text-lg sm:text-xl max-w-2xl mx-auto">
              Drivers can earn up to{' '}
              <span className="text-white font-bold">$20 per hour or more</span> depending on
              location, demand, and ride type.
            </p>
            <p className="mt-3 text-green-200 text-sm">
              Earnings vary based on number of rides completed, distance, time of day, and local
              demand.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Added Pay Incentives ─── */}
      <section className="py-14 sm:py-20 bg-gray-50">

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Added Pay Incentives</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUpIcon className="text-green-600" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Weekend Incentive</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Drivers earn an additional 5% on trips completed on weekends.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="text-green-600" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Late-Night Incentive</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Drivers earn a higher base pay for trips completed between 12:00 AM and 5:00 AM.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
            <p className="text-sm text-gray-700 leading-relaxed">
              When multiple incentives apply, the system automatically applies the option that results in higher estimated earnings for the driver. Late-night trips often result in higher earnings than the weekend incentive alone.
            </p>
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              Added pay incentives are estimates only, not guarantees. Actual earnings may vary based on trip details and timing.
            </p>
          </div>
        </div>
      </section>



      {/* ─── Section 4: Transparency Note ─── */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Transparency & Honesty
            </h2>
            <p className="mt-3 text-gray-600 max-w-xl mx-auto">
              sitNride believes in being upfront with drivers about how pay works.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <DollarIcon className="text-green-600" size={26} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Earnings Are Estimates</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                All earnings shown on this page are examples and estimates. They are not guarantees
                of specific income. Actual earnings depend on many factors including location, hours
                driven, and ride demand.
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUpIcon className="text-green-600" size={26} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Actual Earnings Vary</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                How much you earn depends on when and where you drive, how many rides you complete,
                and local demand. Peak hours and high-demand areas may yield higher earnings.
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <ShieldIcon className="text-green-600" size={26} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No Hidden Fees</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                sitNride does not charge drivers hidden fees or surprise deductions. The platform fee
                is clearly stated, and drivers always see a full breakdown of every ride's earnings.
              </p>
            </div>
          </div>

          {/* Additional Transparency Details */}
          <div className="mt-10 bg-green-50 rounded-2xl p-6 sm:p-8 border border-green-100">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircleIcon className="text-green-600" size={20} />
              What Drivers Should Know
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">
                  Drivers on sitNride are independent contractors, not employees. You control your
                  own schedule.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">
                  Drivers are responsible for their own vehicle expenses, insurance, and taxes.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">
                  Earnings are deposited directly to your bank account via Stripe Connect. Instant
                  cash-out is available.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                <span className="text-sm text-gray-700">
                  sitNride does not use surge pricing. Fares are consistent and predictable for both
                  riders and drivers.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Section 5: Call to Action (Informational Only) ─── */}
      <section className="py-14 sm:py-20 bg-gradient-to-br from-green-900 to-green-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CarIcon className="text-white" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Ready to Start Earning?</h2>
          <p className="mt-4 text-lg text-green-100 max-w-xl mx-auto leading-relaxed">
            When you're ready, you can create a driver account and start earning with sitNride.
            Drive on your own schedule, serve your community, and keep more of what you earn.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/driver-requirements"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-green-700 rounded-xl font-semibold hover:bg-green-50 transition-colors shadow-lg"
            >
              View Driver Requirements
              <ArrowRightIcon size={16} />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-green-300 text-green-100 rounded-xl font-semibold hover:bg-green-800 transition-colors"
            >
              Back to Home
            </Link>
          </div>
          <p className="mt-6 text-green-300 text-sm">
            No signup is required to view this page. When you're ready to drive, you can apply from
            the homepage.
          </p>
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
              <Link to="/estimate-fare" className="text-gray-400 hover:text-white transition-colors">
                Fare Estimator
              </Link>
              <Link
                to="/driver-requirements"
                className="text-gray-400 hover:text-white transition-colors"
              >
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

export default DriverPayEstimatorPage;
