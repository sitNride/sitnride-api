import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import {
  BankIcon, CheckCircleIcon, AlertCircleIcon, ExternalLinkIcon,
  RefreshIcon, ShieldIcon, WalletIcon, ChevronRightIcon
} from '@/components/ui/Icons';

interface ConnectStatus {
  hasAccount: boolean;
  accountId?: string;
  onboardingComplete: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
  };
  disabledReason?: string;
  message: string;
}

interface StripeConnectSetupProps {
  onStatusChange?: (status: ConnectStatus) => void;
}

const StripeConnectSetup: React.FC<StripeConnectSetupProps> = ({ onStatusChange }) => {
  const { user, driverProfile, updateDriverProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);

  // Check Stripe Connect status on mount and when returning from Stripe
  useEffect(() => {
    checkConnectStatus();
    
    // Check if returning from Stripe onboarding
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('stripe_connect') === 'return') {
      // Remove the query param
      window.history.replaceState({}, '', window.location.pathname);
      checkConnectStatus();
    }
  }, [driverProfile?.id]);

  const checkConnectStatus = async () => {
    if (!driverProfile?.id) return;

    setCheckingStatus(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-check-connect-status', {
        body: { driver_id: driverProfile.id }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const status: ConnectStatus = {
        hasAccount: data.hasAccount,
        accountId: data.accountId,
        onboardingComplete: data.onboardingComplete,
        detailsSubmitted: data.detailsSubmitted,
        payoutsEnabled: data.payoutsEnabled,
        chargesEnabled: data.chargesEnabled,
        requirements: data.requirements,
        disabledReason: data.disabledReason,
        message: data.message
      };

      setConnectStatus(status);
      onStatusChange?.(status);

      // Update local driver profile state if needed
      if (data.payoutsEnabled !== driverProfile.stripe_payouts_enabled) {
        await updateDriverProfile({
          stripe_payouts_enabled: data.payoutsEnabled,
          stripe_onboarding_complete: data.onboardingComplete,
          stripe_charges_enabled: data.chargesEnabled
        });
      }
    } catch (err: any) {
      console.error('Error checking connect status:', err);
      setError(err.message || 'Failed to check payout status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSetupPayouts = async () => {
    if (!driverProfile?.id || !user?.email) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create Stripe Connect account if not exists
      if (!connectStatus?.hasAccount) {
        const nameParts = user.full_name?.split(' ') || [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data: createData, error: createError } = await supabase.functions.invoke('stripe-create-connect-account', {
          body: {
            driver_id: driverProfile.id,
            email: user.email,
            first_name: firstName,
            last_name: lastName
          }
        });

        if (createError) throw createError;
        if (createData?.error) throw new Error(createData.error);

        // Update local state
        await updateDriverProfile({
          stripe_account_id: createData.accountId
        });
      }

      // Step 2: Generate onboarding link
      const returnUrl = `${window.location.origin}${window.location.pathname}?stripe_connect=return`;
      
      const { data: linkData, error: linkError } = await supabase.functions.invoke('stripe-connect-onboarding-link', {
        body: {
          driver_id: driverProfile.id,
          return_url: returnUrl,
          refresh_url: returnUrl
        }
      });

      if (linkError) throw linkError;
      if (linkData?.error) throw new Error(linkData.error);

      // Redirect to Stripe onboarding
      if (linkData?.url) {
        window.location.href = linkData.url;
      }
    } catch (err: any) {
      console.error('Error setting up payouts:', err);
      setError(err.message || 'Failed to set up payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayoutInfo = async () => {
    if (!driverProfile?.id) return;

    setLoading(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?stripe_connect=return`;
      
      const { data: linkData, error: linkError } = await supabase.functions.invoke('stripe-connect-onboarding-link', {
        body: {
          driver_id: driverProfile.id,
          return_url: returnUrl,
          refresh_url: returnUrl
        }
      });

      if (linkError) throw linkError;
      if (linkData?.error) throw new Error(linkData.error);

      if (linkData?.url) {
        window.location.href = linkData.url;
      }
    } catch (err: any) {
      console.error('Error updating payout info:', err);
      setError(err.message || 'Failed to update payout information');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <RefreshIcon className="animate-spin text-orange-600" size={24} />
          <span className="text-gray-600">Checking payout status...</span>
        </div>
      </div>
    );
  }

  // Not set up yet
  if (!connectStatus?.hasAccount) {
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <BankIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Set Up Payouts</h3>
              <p className="text-purple-200">Connect your bank account to receive earnings</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-amber-800">Payout Setup Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  You need to set up your payout account before you can receive earnings from completed rides.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">What you'll need:</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                <span className="text-gray-700">Your bank account information (routing & account number)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                <span className="text-gray-700">Social Security Number for tax reporting</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                <span className="text-gray-700">Your current address</span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
            <ShieldIcon className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-gray-900">Secure & Protected</p>
              <p className="text-sm text-gray-600">
                Your information is securely processed by Stripe, a trusted payment provider used by millions of businesses worldwide.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSetupPayouts}
            disabled={loading}
            className="w-full py-4 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshIcon className="animate-spin" size={20} />
                Setting up...
              </>
            ) : (
              <>
                <BankIcon size={20} />
                Set Up Payout Account
                <ChevronRightIcon size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Account exists but onboarding incomplete
  if (!connectStatus.payoutsEnabled) {
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <AlertCircleIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Complete Payout Setup</h3>
              <p className="text-amber-100">Additional information needed</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-amber-800">Action Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  {connectStatus.message || 'Please complete your payout setup to receive payments.'}
                </p>
              </div>
            </div>
          </div>

          {connectStatus.requirements && connectStatus.requirements.currentlyDue.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Information needed:</h4>
              <ul className="space-y-2">
                {connectStatus.requirements.currentlyDue.map((req, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    {formatRequirement(req)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {connectStatus.requirements && connectStatus.requirements.pendingVerification.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <RefreshIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-blue-800">Verification in Progress</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Some information is being verified. This usually takes 1-2 business days.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={checkConnectStatus}
              disabled={loading}
              className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            >
              <RefreshIcon size={20} />
              Refresh Status
            </button>
            <button
              onClick={handleUpdatePayoutInfo}
              disabled={loading}
              className="flex-1 py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshIcon className="animate-spin" size={20} />
                  Loading...
                </>
              ) : (
                <>
                  Complete Setup
                  <ExternalLinkIcon size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fully set up - payouts enabled
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <CheckCircleIcon size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Payouts Enabled</h3>
            <p className="text-green-100">Your payout account is ready to receive funds</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-green-800">Ready to Receive Payments</p>
              <p className="text-sm text-green-700 mt-1">
                Your bank account is connected and verified. You can now receive payouts from completed rides.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <CheckCircleIcon size={18} />
              <span className="text-sm font-medium">Payouts</span>
            </div>
            <p className="text-lg font-bold text-gray-900">Enabled</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <ShieldIcon size={18} />
              <span className="text-sm font-medium">Verified</span>
            </div>
            <p className="text-lg font-bold text-gray-900">Complete</p>
          </div>
        </div>

        {connectStatus.requirements && connectStatus.requirements.eventuallyDue.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-blue-800">Optional Information</p>
                <p className="text-sm text-blue-700 mt-1">
                  Some additional information may be requested in the future to keep your account in good standing.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={checkConnectStatus}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            <RefreshIcon size={18} />
            Refresh Status
          </button>
          <button
            onClick={handleUpdatePayoutInfo}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 transition-all flex items-center justify-center gap-2"
          >
            <SettingsIcon size={18} />
            Update Info
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to format Stripe requirement strings
function formatRequirement(requirement: string): string {
  const mappings: Record<string, string> = {
    'individual.first_name': 'First name',
    'individual.last_name': 'Last name',
    'individual.dob.day': 'Date of birth',
    'individual.dob.month': 'Date of birth',
    'individual.dob.year': 'Date of birth',
    'individual.address.line1': 'Street address',
    'individual.address.city': 'City',
    'individual.address.state': 'State',
    'individual.address.postal_code': 'ZIP code',
    'individual.ssn_last_4': 'Last 4 digits of SSN',
    'individual.id_number': 'Full SSN',
    'individual.phone': 'Phone number',
    'individual.email': 'Email address',
    'external_account': 'Bank account information',
    'tos_acceptance.date': 'Terms of service acceptance',
    'tos_acceptance.ip': 'Terms of service acceptance',
    'business_profile.url': 'Business website',
    'business_profile.mcc': 'Business category',
  };

  return mappings[requirement] || requirement.replace(/_/g, ' ').replace(/\./g, ' - ');
}

// Import SettingsIcon if not already imported
const SettingsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export default StripeConnectSetup;
