import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CarIcon, UserIcon, ShieldIcon, DollarIcon, CheckCircleIcon, MapPinIcon, ClockIcon, CameraIcon, HeartIcon, ArrowRightIcon } from '@/components/ui/Icons';

import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import { UserRole } from '@/types';


// Diverse, inclusive hero image - mixed community
const HERO_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769925647542_bc10f140.png';

// Diverse community images showing mixed groups together
const COMMUNITY_IMAGES = {
  neighbors: 'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769925667050_8ccffbec.png',
  students: 'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769925682178_bc5c10a7.jpg',
  neighborhood: 'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769925699615_9939ab1f.png',
  rideshare: 'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769925718469_9c7ae655.jpg',
  workers: 'https://d64gsuwffb70l.cloudfront.net/697ec969ddde6c95ca092c0d_1769925737286_a2540d80.png',
};


interface LandingPageProps {
  onAuthSuccess: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();


  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [selectedRole, setSelectedRole] = useState<UserRole>('rider');
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Check for ?action=driver-signup or ?action=rider-signup query param (used by other pages' CTA buttons)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'driver-signup' || action === 'rider-signup') {
      // Remove ONLY the `action` param while preserving every other query param
      // (riders, total, per_person, shared_multiplier, pickup/dropoff, distance,
      // duration, etc.) so RiderDashboard can hydrate the shared-ride context
      // from the URL after login/signup completes.
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });

      // Open the auth modal with signup mode and the appropriate role
      setAuthMode('signup');
      setSelectedRole(action === 'driver-signup' ? 'driver' : 'rider');
      setPendingRedirect(null);
      setShowAuth(true);
    }
  }, [searchParams, setSearchParams]);



  const openAuth = (mode: 'login' | 'signup', role: UserRole = 'rider') => {
    setAuthMode(mode);
    setSelectedRole(role);
    setPendingRedirect(null);
    setShowAuth(true);
  };

  const openAuthWithRedirect = (mode: 'login' | 'signup', role: UserRole, redirectTo: string) => {
    setAuthMode(mode);
    setSelectedRole(role);
    setPendingRedirect(redirectTo);
    setShowAuth(true);
  };


  const features = [
    {
      icon: <HeartIcon className="text-rose-600" size={32} />,
      title: 'Community First',
      description: 'Designed for real neighborhoods. Affordable rides connecting people to work, school, healthcare, and family.'
    },
    {
      icon: <DollarIcon className="text-green-600" size={32} />,
      title: 'Fair & Transparent',
      description: 'No surge pricing surprises. Riders see fares upfront with a clear base fee plus per-mile rate.'
    },
    {
      icon: <ClockIcon className="text-purple-600" size={32} />,
      title: 'Reliable Service',
      description: 'Drivers from local communities who know the area. Available when riders need transportation most.'
    },
    {
      icon: <CheckCircleIcon className="text-amber-600" size={32} />,
      title: 'Verified Drivers',
      description: 'Comprehensive background checks and verification. Drivers go through a 9-step approval process.'
    }
  ];

  const driverBenefits = [
    'Keep 75% of every fare — more money stays with drivers.',
    'Weekend incentive bonus of 5% for drivers working on the weekends.',
    'Instant cash-out available anytime',
    'Flexible scheduling - work around other commitments',
    'Use your own vehicle',
    'Serve your own community and neighbors',
    'Drivers earn a higher base rate for late-night trips between 12:00 AM and 5:00 AM.',
  ];


  const whoItsFor = [

    {
      title: 'Working Families',
      description: 'Parents getting to jobs, picking up kids, running errands — sitNride is built for the everyday transportation needs of working households.',
      image: COMMUNITY_IMAGES.neighborhood
    },
    {
      title: 'Students',
      description: 'College and university students traveling to campus, jobs, and internships. Affordable rides that fit student budgets.',
      image: COMMUNITY_IMAGES.students
    },
    {
      title: 'Essential Workers',
      description: 'Healthcare workers, retail employees, and service industry staff who need reliable rides during early mornings, late nights, and weekends.',
      image: COMMUNITY_IMAGES.workers
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-3xl font-bold text-gray-900">sit<span className="text-orange-600">N</span>ride</span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#who-its-for" className="text-gray-600 hover:text-gray-900 transition-colors">Who It's For</a>
              <a href="#drivers" className="text-gray-600 hover:text-gray-900 transition-colors">Drive</a>
              <a href="#safety" className="text-gray-600 hover:text-gray-900 transition-colors">Safety</a>
            </div>


            <div className="flex items-center gap-3">
              {user && user.role === 'admin' ? (
                // Admin user only - show "Go to Dashboard" button
                <button 
                  onClick={onAuthSuccess}
                  className="flex items-center gap-2 px-5 py-2 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
                >
                  Go to Dashboard
                  <ArrowRightIcon size={18} />
                </button>
              ) : (
                // Public visitors and regular logged-in users - show Sign In and Get Started buttons
                <>
                  <button 
                    onClick={() => openAuth('login')}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => openAuth('signup', 'rider')}
                    className="px-5 py-2 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>


          </div>
        </div>
      </nav>



      {/* Hero Section */}
      <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-6">
                <HeartIcon className="text-orange-600" size={16} />
                <span className="text-sm font-medium text-orange-800">Designed for Real Communities</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-5xl font-bold text-gray-900 leading-snug lg:whitespace-nowrap">
                Rides That{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-800">
                  Connect Us
                </span>
              </h1>


              <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                Affordable, reliable rides from drivers in local communities. 
                sitNride connects riders with independent drivers for trips to work, school, appointments, and family.
              </p>

              {/* CTA Buttons - Rider (orange) and Driver (green) grouped vertically */}
              <div className="mt-10 flex flex-col gap-3 sm:max-w-md">
                {/* Rider Buttons (Orange) */}
                <button
                  onClick={() => navigate('/estimate-fare')}
                  className="flex flex-col items-center justify-center px-8 py-4 bg-orange-600 text-white rounded-2xl font-semibold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/30 hover:shadow-xl hover:shadow-orange-600/40"
                >
                  <span className="text-lg font-bold leading-tight">Fare Estimator</span>
                  <span className="text-sm font-normal opacity-90 mt-0.5">What the rider pays for this trip</span>
                </button>

                <button
                  onClick={() => openAuth('signup', 'rider')}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-2xl font-semibold text-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40"
                >
                  <UserIcon size={24} />
                  Request a Ride
                </button>

                {/* Driver Buttons (Green) */}
                <button
                  onClick={() => navigate('/driver-trip-estimator')}
                  className="flex flex-col items-center justify-center px-8 py-4 bg-green-600 text-white rounded-2xl font-semibold hover:bg-green-700 transition-all shadow-lg shadow-green-600/30 hover:shadow-xl hover:shadow-green-600/40"
                >
                   <span className="text-lg font-bold leading-tight">Driver Earnings</span>


                  <span className="text-sm font-normal opacity-90 mt-0.5">What the driver makes on this trip</span>
                </button>

                <button
                  onClick={() => openAuth('signup', 'driver')}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-green-500 text-white rounded-2xl font-semibold text-lg hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40"
                >
                  <CarIcon size={24} />
                  Drive & Earn
                </button>
              </div>




              {/* Trust Badges */}
              <div className="mt-10 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldIcon className="text-green-600" size={20} />
                  <span className="text-sm text-gray-600">Background Checked</span>
                </div>
                <div className="flex items-center gap-2">
                  <CameraIcon className="text-orange-600" size={20} />
                  <span className="text-sm text-gray-600">Video Recorded</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarIcon className="text-green-600" size={20} />
                  <span className="text-sm text-gray-600">No Surge Pricing</span>
                </div>
              </div>
            </div>

            {/* Right Image */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src={HERO_IMAGE} 
                  alt="Diverse community members in urban environment" 
                  className="w-full h-auto"
                />
              </div>
              {/* Floating Card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 hidden lg:block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">All Drivers</p>
                    <p className="font-semibold text-gray-900">Verified & Approved</p>
                  </div>
                </div>
              </div>
              {/* Second Floating Card */}
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-3 hidden lg:block">
                <div className="flex items-center gap-2">
                  <DollarIcon className="text-green-600" size={20} />
                  <span className="font-semibold text-gray-900">Fair Pricing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>







      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Transportation That Works for Everyone
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              sitNride is built to serve diverse communities with practical, affordable transportation.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="p-6 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl transition-all duration-300 group"
              >
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who sitNride is Built For Section */}
      <section id="who-its-for" className="py-20 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Who sitNride is Built For
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Designed for everyday riders and drivers in urban and suburban communities.
            </p>
          </div>
          
          {/* Who It's For Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {whoItsFor.map((group, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="h-48 overflow-hidden">
                  <img 
                    src={group.image} 
                    alt={group.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{group.title}</h3>
                  <p className="text-gray-600">{group.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Serving Real Communities Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src={COMMUNITY_IMAGES.rideshare} 
                alt="Driver and rider in vehicle"
                className="w-full h-auto"
              />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Serving Real Communities
              </h2>
              <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                sitNride is designed for low- and moderate-income communities in diverse urban and suburban areas. 
                The platform focuses on neighborhoods where reliable, affordable transportation makes a real difference 
                in daily life.
              </p>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0" size={24} />
                  <span className="text-gray-700">Affordable fares designed for working family budgets</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0" size={24} />
                  <span className="text-gray-700">Drivers from local neighborhoods who know the area</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0" size={24} />
                  <span className="text-gray-700">24/7 availability for shift workers and varied schedules</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircleIcon className="text-green-600 flex-shrink-0" size={24} />
                  <span className="text-gray-700">Safe, verified rides for students, seniors, and families</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Diverse Community Showcase */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Designed for Everyday Riders and Drivers
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              sitNride welcomes everyone. The platform is built to be inclusive, accessible, and representative of the diverse communities it serves.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-xl overflow-hidden shadow-md aspect-video">
              <img 
                src={COMMUNITY_IMAGES.neighbors} 
                alt="Diverse neighbors in community"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="rounded-xl overflow-hidden shadow-md aspect-video">
              <img 
                src={COMMUNITY_IMAGES.students} 
                alt="Diverse students on campus"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="rounded-xl overflow-hidden shadow-md aspect-video">
              <img 
                src={COMMUNITY_IMAGES.workers} 
                alt="Diverse essential workers"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Driver Section */}
      <section id="drivers" className="py-20 bg-gradient-to-br from-green-900 to-green-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Drive in Your Community
              </h2>
              <p className="mt-4 text-xl text-green-100">
                Independent drivers earn money on their own schedule while providing rides to neighbors who need reliable transportation.
              </p>
              <ul className="mt-8 space-y-4">
                {driverBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3 text-white">
                    <CheckCircleIcon className="text-green-300 flex-shrink-0" size={20} />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 p-4 bg-green-800/50 rounded-xl">
                <p className="text-green-100 text-sm">
                  <strong>Note:</strong> Drivers on sitNride are independent contractors, not employees. 
                  Drivers control when, where, and how long they work.
                </p>
              </div>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => openAuth('signup', 'driver')}
                  className="px-8 py-4 bg-white text-green-700 rounded-2xl font-semibold text-lg hover:bg-green-50 transition-all shadow-lg"
                >
                  Drive & Earn

                </button>
                <button
                  onClick={() => navigate('/estimate-pay')}
                  className="px-8 py-4 bg-green-500 text-white rounded-2xl font-semibold text-lg hover:bg-green-400 transition-all shadow-lg border-2 border-green-400 flex items-center justify-center gap-2"
                >
                  <DollarIcon size={20} />
                  Calculate Your Earnings

                </button>
                <button
                  onClick={() => navigate('/driver-requirements')}
                  className="px-8 py-4 bg-white text-green-700 rounded-2xl font-semibold text-lg hover:bg-green-50 transition-all shadow-lg"
                >
                  View Driver Requirements
                </button>
              </div>


            </div>
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img 
                src={COMMUNITY_IMAGES.rideshare} 
                alt="Driver providing ride"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section id="safety" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Safety & Trust
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Every ride includes multiple safety features designed to protect both riders and drivers.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-orange-50 rounded-2xl text-center">
              <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto">
                <CameraIcon className="text-white" size={32} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Video-Only Recording</h3>
              <p className="mt-3 text-gray-600">
                All rides are video recorded for safety. Audio recording is not permitted, protecting privacy during conversations.
              </p>
            </div>
            <div className="p-8 bg-green-50 rounded-2xl text-center">
              <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircleIcon className="text-white" size={32} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Verified Drivers</h3>
              <p className="mt-3 text-gray-600">
                9-step verification process including background check, license verification, and insurance confirmation.
              </p>
              <a href="/driver-requirements" className="mt-4 inline-block text-green-600 hover:text-green-700 font-medium text-sm hover:underline">
                View all requirements →
              </a>
            </div>

            <div className="p-8 bg-purple-50 rounded-2xl text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <MapPinIcon className="text-white" size={32} />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">Real-Time Tracking</h3>
              <p className="mt-3 text-gray-600">
                Riders can share their trip with trusted contacts. Journey tracking is available until arrival.
              </p>
            </div>
          </div>
          
          {/* Video Footage Policy */}
          <div className="mt-12 p-6 bg-gray-50 rounded-2xl">
            <h4 className="font-semibold text-gray-900 mb-3">Video Footage Policy</h4>
            <p className="text-gray-600 text-sm">
              sitNride requires drivers to use in-vehicle cameras for safety. Video footage is owned, stored, and maintained by the driver. sitNride does not continuously collect or store video footage and may request footage from a driver only in the event of a serious incident, dispute, or legal matter.
            </p>
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-600 to-orange-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Get Started with sitNride
          </h2>
          <p className="mt-4 text-xl text-orange-200">
            Affordable rides. Local drivers. Community connections.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => openAuth('signup', 'rider')}
              className="px-8 py-4 bg-white text-orange-700 rounded-2xl font-semibold text-lg hover:bg-orange-50 transition-all"
            >
              Sign Up as Rider
            </button>
            <button
              onClick={() => openAuth('signup', 'driver')}
              className="px-8 py-4 bg-green-500 text-white rounded-2xl font-semibold text-lg hover:bg-green-600 transition-all"
            >
              Drive & Earn
            </button>
          </div>
        </div>
      </section>



      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center">
                <span className="text-xl font-bold text-white">sit<span className="text-orange-400">N</span>ride</span>
              </div>

              <p className="mt-4 text-gray-400 text-sm">
                sitNride connects riders with independent drivers for the arranging of affordable local transportation services throughout America.
              </p>

              <p className="mt-2 text-gray-500 text-xs">
                Operated by Digital Media Connect Pro LLC
              </p>
              <p className="mt-1 text-gray-500 text-xs">
                sitnride.net
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="/about" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
              </ul>

            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="/safety" className="text-gray-400 hover:text-white transition-colors">Safety</a></li>

                <li><a href="/contact" className="text-gray-400 hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="/faq" className="text-gray-400 hover:text-white transition-colors">FAQ Help Center</a></li>

                <li><a href="/driver-requirements" className="text-gray-400 hover:text-white transition-colors">Driver Requirements</a></li>
                <li><a href="/estimate-fare" className="text-gray-400 hover:text-white transition-colors">Fare Estimator</a></li>
                <li><a href="/estimate-pay" className="text-gray-400 hover:text-white transition-colors">Driver Pay Estimator</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Accessibility</a></li>
              </ul>
            </div>




            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Use</a></li>
                <li><a href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>

            </div>


          </div>
          <div className="mt-12 pt-8 border-t border-gray-800">
            <p className="text-center text-gray-400 text-sm">
              &copy; 2026 sitNride. All rights reserved. sitNride is a technology platform, not a transportation company.
            </p>
            <p className="text-center text-gray-500 text-xs mt-2">
              Operated by Digital Media Connect Pro LLC | sitnride.net
            </p>
            <p className="text-center text-gray-600 text-xs mt-4">
              sitNride is committed to serving diverse communities. The platform does not discriminate based on race, color, national origin, 
              religion, sex, gender identity, sexual orientation, disability, or age.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuth}
        onClose={() => {
          setShowAuth(false);
          setPendingRedirect(null);
        }}
        onSuccess={() => {
          setShowAuth(false);
          if (pendingRedirect) {
            navigate(pendingRedirect);
            setPendingRedirect(null);
          } else if (authMode === 'signup' && selectedRole === 'driver') {
            // After driver signup, redirect to Upload Documents page
            navigate('/upload-documents');
          } else {
            onAuthSuccess();
          }
        }}

        initialMode={authMode}
        initialRole={selectedRole}
      />

    </div>
  );
};

export default LandingPage;
