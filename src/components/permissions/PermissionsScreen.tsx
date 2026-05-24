import React, { useState } from 'react';
import { MapPinIcon, ShieldIcon, CheckCircleIcon, AlertCircleIcon } from '@/components/ui/Icons';

// Bell icon inline since it's not in the Icons file
const BellIcon: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 24 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

interface PermissionsScreenProps {
  userRole: 'rider' | 'driver' | 'admin';
  onComplete: () => void;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ userRole, onComplete }) => {
  const [step, setStep] = useState<'gps' | 'notifications' | 'done'>('gps');
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [gpsRequesting, setGpsRequesting] = useState(false);
  const [notifRequesting, setNotifRequesting] = useState(false);

  const requestGPS = async () => {
    setGpsRequesting(true);
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      if (result.state === 'granted') {
        setGpsGranted(true);
        setStep('notifications');
      } else if (result.state === 'prompt') {
        // Trigger the actual permission prompt
        navigator.geolocation.getCurrentPosition(
          () => {
            setGpsGranted(true);
            setStep('notifications');
          },
          () => {
            setGpsGranted(false);
            setStep('notifications');
          },
          { timeout: 10000 }
        );
      } else {
        setGpsGranted(false);
        setStep('notifications');
      }
    } catch {
      // Fallback: try to get position directly
      navigator.geolocation.getCurrentPosition(
        () => {
          setGpsGranted(true);
          setStep('notifications');
        },
        () => {
          setGpsGranted(false);
          setStep('notifications');
        },
        { timeout: 10000 }
      );
    }
    setGpsRequesting(false);
  };

  const requestNotifications = async () => {
    setNotifRequesting(true);
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setNotifGranted(permission === 'granted');
      } else {
        setNotifGranted(false);
      }
    } catch {
      setNotifGranted(false);
    }
    setNotifRequesting(false);
    setStep('done');
  };

  const skipNotifications = () => {
    setNotifGranted(false);
    setStep('done');
  };

  const skipGPS = () => {
    setGpsGranted(false);
    setStep('notifications');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-gray-900">
            sit<span className="text-orange-600">N</span>ride
          </span>
          <p className="mt-2 text-gray-600">Let's set up your experience</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-3 h-3 rounded-full transition-colors ${
            step === 'gps' ? 'bg-orange-600' : gpsGranted !== null ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <div className={`w-12 h-0.5 ${step !== 'gps' ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full transition-colors ${
            step === 'notifications' ? 'bg-orange-600' : notifGranted !== null ? 'bg-green-500' : 'bg-gray-300'
          }`} />
          <div className={`w-12 h-0.5 ${step === 'done' ? 'bg-green-500' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full transition-colors ${
            step === 'done' ? 'bg-green-500' : 'bg-gray-300'
          }`} />
        </div>

        {/* GPS Permission Step */}
        {step === 'gps' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-center text-white">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPinIcon className="text-white" size={40} />
              </div>
              <h2 className="text-2xl font-bold">Location Access</h2>
              <p className="mt-2 text-blue-100">
                sitNride needs your location to connect you with rides
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldIcon className="text-blue-600" size={18} />
                  How your location is used
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-gray-700 text-sm">
                      <strong>Match rides</strong> — Connect riders with nearby available drivers
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-gray-700 text-sm">
                      <strong>Track trips</strong> — Show real-time trip progress for safety
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-gray-700 text-sm">
                      <strong>Calculate distance and time</strong> — Determine trip routes and estimated arrival
                    </span>
                  </li>
                </ul>
              </div>

              {userRole === 'driver' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <ShieldIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-semibold text-green-800 text-sm">Driver GPS Privacy</p>
                      <p className="text-green-700 text-sm mt-1">
                        GPS tracking is <strong>only active when you are online</strong> and available for ride requests. 
                        When you go offline, GPS tracking stops completely. Your location is never tracked when you are offline.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {userRole === 'rider' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <ShieldIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-semibold text-orange-800 text-sm">Rider GPS Privacy</p>
                      <p className="text-orange-700 text-sm mt-1">
                        Your location is used only when you request a ride to find nearby drivers and track your trip. 
                        sitNride does not track your location in the background.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={requestGPS}
                disabled={gpsRequesting}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {gpsRequesting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Requesting Access...
                  </>
                ) : (
                  <>
                    <MapPinIcon size={20} />
                    Allow Location Access
                  </>
                )}
              </button>

              <button
                onClick={skipGPS}
                className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Skip for now
              </button>

              <p className="text-xs text-gray-400 text-center">
                You can change this later in your browser settings.
              </p>
            </div>
          </div>
        )}

        {/* Notifications Permission Step */}
        {step === 'notifications' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-8 text-center text-white">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BellIcon className="text-white" size={40} />
              </div>
              <h2 className="text-2xl font-bold">Push Notifications</h2>
              <p className="mt-2 text-orange-100">
                Stay updated on your rides in real time
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* GPS result feedback */}
              {gpsGranted !== null && (
                <div className={`rounded-xl p-3 flex items-center gap-3 ${
                  gpsGranted ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
                }`}>
                  {gpsGranted ? (
                    <>
                      <CheckCircleIcon className="text-green-600" size={18} />
                      <span className="text-green-800 text-sm font-medium">Location access granted</span>
                    </>
                  ) : (
                    <>
                      <AlertCircleIcon className="text-amber-600" size={18} />
                      <span className="text-amber-800 text-sm font-medium">Location access skipped — you can enable it later</span>
                    </>
                  )}
                </div>
              )}

              <div className="bg-orange-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Notifications keep you informed about:</h3>
                <ul className="space-y-3">
                  {userRole === 'driver' ? (
                    <>
                      <li className="flex items-start gap-3">
                        <CheckCircleIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-700 text-sm">New ride requests when you are online</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircleIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-700 text-sm">Ride status updates and rider messages</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircleIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-700 text-sm">Earnings and bonus notifications</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-3">
                        <CheckCircleIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-700 text-sm">Driver assignment and arrival updates</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircleIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-700 text-sm">Ride status changes and trip completion</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <CheckCircleIcon className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-700 text-sm">Important account and safety alerts</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <button
                onClick={requestNotifications}
                disabled={notifRequesting}
                className="w-full py-4 bg-orange-600 text-white rounded-xl font-semibold text-lg hover:bg-orange-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {notifRequesting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Requesting...
                  </>
                ) : (
                  <>
                    <BellIcon size={20} />
                    Enable Notifications
                  </>
                )}
              </button>

              <button
                onClick={skipNotifications}
                className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Skip for now
              </button>

              <p className="text-xs text-gray-400 text-center">
                You can change this later in your browser settings.
              </p>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 p-8 text-center text-white">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="text-white" size={40} />
              </div>
              <h2 className="text-2xl font-bold">You're All Set!</h2>
              <p className="mt-2 text-green-100">
                Your account is ready to use
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Permission Summary */}
              <div className="space-y-3">
                <div className={`rounded-xl p-3 flex items-center gap-3 ${
                  gpsGranted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <MapPinIcon className={gpsGranted ? 'text-green-600' : 'text-gray-400'} size={20} />
                  <span className={`text-sm font-medium ${gpsGranted ? 'text-green-800' : 'text-gray-500'}`}>
                    Location: {gpsGranted ? 'Enabled' : 'Not enabled'}
                  </span>
                </div>

                <div className={`rounded-xl p-3 flex items-center gap-3 ${
                  notifGranted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <BellIcon className={notifGranted ? 'text-green-600' : 'text-gray-400'} size={20} />
                  <span className={`text-sm font-medium ${notifGranted ? 'text-green-800' : 'text-gray-500'}`}>
                    Notifications: {notifGranted ? 'Enabled' : 'Not enabled'}
                  </span>
                </div>
              </div>

              {(!gpsGranted || !notifGranted) && (
                <p className="text-xs text-gray-500 text-center">
                  You can enable these permissions anytime from your browser settings for the best experience.
                </p>
              )}

              <button
                onClick={onComplete}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
              >
                {userRole === 'driver' ? 'Go to Driver Dashboard' : 'Start Using sitNride'}
              </button>
            </div>
          </div>
        )}

        {/* Platform Notice */}
        <p className="text-xs text-gray-400 text-center mt-6">
          sitNride is a technology platform connecting riders with independent drivers.
        </p>
      </div>
    </div>
  );
};

export default PermissionsScreen;
