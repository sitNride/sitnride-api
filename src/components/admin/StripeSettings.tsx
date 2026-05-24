import React, { useState, useEffect } from 'react';
import { database as supabase } from '@/lib/database';
import {
  CreditCardIcon, CheckCircleIcon, XCircleIcon, RefreshIcon,
  ExternalLinkIcon, ShieldIcon, AlertTriangleIcon, BuildingIcon
} from '@/components/ui/Icons';

interface StripeAccountStatus {
  accountId: string | null;
  businessType: string | null;
  businessName: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requiresAction: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  pendingVerification: string[];
}

const StripeSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccountStatus();
  }, []);

  const loadAccountStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-get-account-status', {
        body: {}
      });

      if (error) throw error;
      
      setAccountStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Stripe account status');
      // Set default status for display
      setAccountStatus({
        accountId: null,
        businessType: null,
        businessName: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requiresAction: true,
        currentlyDue: [],
        eventuallyDue: [],
        pendingVerification: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateAccount = async () => {
    setActionLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-platform-account-link', {
        body: {
          business_type: 'company',
          business_name: 'Digital Media Connect Pro LLC',
          refresh_url: window.location.href,
          return_url: window.location.href
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account link');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetOnboarding = async () => {
    if (!confirm('This will reset the Stripe onboarding process. You will need to re-enter all business information. Continue?')) {
      return;
    }

    setActionLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-reset-platform-onboarding', {
        body: {
          business_type: 'company',
          business_name: 'Digital Media Connect Pro LLC',
          refresh_url: window.location.href,
          return_url: window.location.href
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset onboarding');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshIcon className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
            <CreditCardIcon className="text-purple-600" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Stripe Platform Configuration</h2>
            <p className="text-gray-500">Manage your Stripe Connect platform account</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangleIcon className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Business Info Card */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-3 mb-4">
            <BuildingIcon size={24} />
            <div>
              <p className="text-purple-200 text-sm">Platform Operator</p>
              <p className="text-xl font-bold">Digital Media Connect Pro LLC</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-purple-200">Business Type</p>
              <p className="font-semibold">{accountStatus?.businessType === 'company' ? 'Company (LLC)' : accountStatus?.businessType || 'Not configured'}</p>
            </div>
            <div>
              <p className="text-purple-200">Account ID</p>
              <p className="font-mono text-xs">{accountStatus?.accountId || 'Not created'}</p>
            </div>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {accountStatus?.chargesEnabled ? (
                <CheckCircleIcon className="text-green-600" size={20} />
              ) : (
                <XCircleIcon className="text-red-500" size={20} />
              )}
              <span className="text-sm font-medium text-gray-700">Charges</span>
            </div>
            <p className={`text-lg font-bold ${accountStatus?.chargesEnabled ? 'text-green-600' : 'text-red-500'}`}>
              {accountStatus?.chargesEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {accountStatus?.payoutsEnabled ? (
                <CheckCircleIcon className="text-green-600" size={20} />
              ) : (
                <XCircleIcon className="text-red-500" size={20} />
              )}
              <span className="text-sm font-medium text-gray-700">Payouts</span>
            </div>
            <p className={`text-lg font-bold ${accountStatus?.payoutsEnabled ? 'text-green-600' : 'text-red-500'}`}>
              {accountStatus?.payoutsEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {accountStatus?.detailsSubmitted ? (
                <CheckCircleIcon className="text-green-600" size={20} />
              ) : (
                <XCircleIcon className="text-amber-500" size={20} />
              )}
              <span className="text-sm font-medium text-gray-700">Details</span>
            </div>
            <p className={`text-lg font-bold ${accountStatus?.detailsSubmitted ? 'text-green-600' : 'text-amber-500'}`}>
              {accountStatus?.detailsSubmitted ? 'Submitted' : 'Incomplete'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              {!accountStatus?.requiresAction ? (
                <CheckCircleIcon className="text-green-600" size={20} />
              ) : (
                <AlertTriangleIcon className="text-amber-500" size={20} />
              )}
              <span className="text-sm font-medium text-gray-700">Status</span>
            </div>
            <p className={`text-lg font-bold ${!accountStatus?.requiresAction ? 'text-green-600' : 'text-amber-500'}`}>
              {!accountStatus?.requiresAction ? 'Complete' : 'Action Needed'}
            </p>
          </div>
        </div>

        {/* Requirements */}
        {accountStatus?.requiresAction && (accountStatus.currentlyDue.length > 0 || accountStatus.eventuallyDue.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Action Required</p>
                <p className="text-sm text-amber-800 mt-1">
                  The following information is needed to complete your Stripe account setup:
                </p>
                {accountStatus.currentlyDue.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-amber-700 uppercase">Currently Due:</p>
                    <ul className="mt-1 text-sm text-amber-800 list-disc list-inside">
                      {accountStatus.currentlyDue.map((item, i) => (
                        <li key={i}>{item.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {accountStatus.eventuallyDue.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-amber-700 uppercase">Eventually Due:</p>
                    <ul className="mt-1 text-sm text-amber-800 list-disc list-inside">
                      {accountStatus.eventuallyDue.map((item, i) => (
                        <li key={i}>{item.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pending Verification */}
        {accountStatus?.pendingVerification && accountStatus.pendingVerification.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <RefreshIcon className="text-blue-600 flex-shrink-0 mt-0.5 animate-spin" size={20} />
              <div>
                <p className="font-semibold text-blue-900">Verification in Progress</p>
                <p className="text-sm text-blue-800 mt-1">
                  The following items are being verified by Stripe:
                </p>
                <ul className="mt-2 text-sm text-blue-800 list-disc list-inside">
                  {accountStatus.pendingVerification.map((item, i) => (
                    <li key={i}>{item.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreateOrUpdateAccount}
            disabled={actionLoading}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400"
          >
            {actionLoading ? (
              <RefreshIcon className="animate-spin" size={20} />
            ) : (
              <ExternalLinkIcon size={20} />
            )}
            {accountStatus?.accountId ? 'Update Business Details' : 'Start Stripe Onboarding'}
          </button>

          {accountStatus?.accountId && (
            <button
              onClick={handleResetOnboarding}
              disabled={actionLoading}
              className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors disabled:bg-gray-400"
            >
              <RefreshIcon size={20} />
              Reset Onboarding
            </button>
          )}

          <button
            onClick={loadAccountStatus}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            <RefreshIcon size={20} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Configuration Guide */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Stripe Connect Configuration Guide</h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-bold text-sm">1</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Business Type: Company (LLC)</p>
              <p className="text-sm text-gray-600 mt-1">
                sitNride is operated by Digital Media Connect Pro LLC. The Stripe account must be configured as a "Company" not "Individual".
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-bold text-sm">2</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Legal Business Name</p>
              <p className="text-sm text-gray-600 mt-1">
                Enter "Digital Media Connect Pro LLC" as the legal business name during onboarding.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-bold text-sm">3</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">EIN (Employer Identification Number)</p>
              <p className="text-sm text-gray-600 mt-1">
                Use the company's EIN for tax identification. Do NOT use a personal SSN.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-bold text-sm">4</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Business Address & Ownership</p>
              <p className="text-sm text-gray-600 mt-1">
                Provide the registered business address and ownership details for the LLC.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-bold text-sm">5</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Marketplace/Platform Model</p>
              <p className="text-sm text-gray-600 mt-1">
                The account is configured for a marketplace model where the platform collects payments from riders and pays out to drivers via Stripe Connect.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldIcon className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="font-semibold text-green-900">Secure Payment Processing</p>
          <p className="text-sm text-green-800 mt-1">
            All payment information is securely processed by Stripe. sitNride never stores full card numbers or sensitive payment data on our servers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StripeSettings;
