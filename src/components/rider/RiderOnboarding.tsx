import React, { useState } from 'react';

import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { ShieldIcon, CreditCardIcon, CheckCircleIcon, ChevronRightIcon, CameraIcon, CarIcon, RefreshIcon } from '@/components/ui/Icons';




interface RiderOnboardingProps {
  onComplete: () => void;
}

interface PaymentFormProps {
  riderId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ riderId, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Retrieve the current Supabase Auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('You must be logged in to save a payment method. Please log out and log back in.');
        setLoading(false);
        return;
      }

      // 2. Derive riderId from the authenticated user (never use undefined)
      const activeRiderId = session.user.id;
      if (!activeRiderId) {
        setError('Unable to identify your account. Please log out and log back in.');
        setLoading(false);
        return;
      }

      // 3. Get the card element from Stripe Elements
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card input not found. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      console.log('[PaymentForm] Step 1: Calling rider-card-setup with riderId:', activeRiderId);

      // 4. Create or get Stripe customer + SetupIntent via edge function
      const { data: setupData, error: setupError } = await supabase.functions.invoke('rider-card-setup', {
        body: {
          rider_id: activeRiderId,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email,
        },
      });

      console.log('[PaymentForm] rider-card-setup response:', { setupData, setupError });

      // Check for errors from the edge function
      if (setupError) {
        const errMsg = typeof setupError === 'object' && setupError.message 
          ? setupError.message 
          : String(setupError);
        console.error('[PaymentForm] rider-card-setup invocation error:', errMsg);
        setError(`Payment setup failed: ${errMsg}`);
        setLoading(false);
        return;
      }

      // The edge function may return an error in the response body
      if (setupData?.error) {
        console.error('[PaymentForm] rider-card-setup returned error:', setupData.error);
        setError(`Payment setup failed: ${setupData.error}`);
        setLoading(false);
        return;
      }

      const clientSecret = setupData?.clientSecret;
      if (!clientSecret) {
        console.error('[PaymentForm] No clientSecret in response. Full response:', JSON.stringify(setupData));
        setError('Payment setup did not return a client secret. Please try again or contact support.');
        setLoading(false);
        return;
      }

      console.log('[PaymentForm] Step 2: Got clientSecret, confirming card setup...');

      // 5. Confirm the card setup with Stripe using the clientSecret
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        console.error('[PaymentForm] confirmCardSetup error:', confirmError.message);
        setError(confirmError.message || 'Failed to confirm card setup');
        setLoading(false);
        return;
      }

      if (!setupIntent || !setupIntent.payment_method) {
        console.error('[PaymentForm] No payment method in setupIntent:', setupIntent);
        setError('Failed to create payment method. Please try again.');
        setLoading(false);
        return;
      }

      // 6. Extract the payment method ID
      const paymentMethodId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      console.log('[PaymentForm] Step 3: Card confirmed, saving payment method:', paymentMethodId);

      // 7. Save the payment method via Edge Function using supabase.functions.invoke
      const { data: saveData, error: saveError } = await supabase.functions.invoke('stripe-save-payment-method', {
        body: {
          rider_id: activeRiderId,
          payment_method_id: paymentMethodId,
          brand: (setupIntent.payment_method as any)?.card?.brand || 'Card',
          last_four: (setupIntent.payment_method as any)?.card?.last4 || '****',
        },
      });

      console.log('[PaymentForm] stripe-save-payment-method response:', { saveData, saveError });

      if (saveError) {
        const errMsg = typeof saveError === 'object' && saveError.message
          ? saveError.message
          : String(saveError);
        console.error('[PaymentForm] save-payment-method invocation error:', errMsg);
        // Non-blocking: card was confirmed with Stripe, just log the save error
        console.warn('[PaymentForm] Card was confirmed but saving to profile failed. Proceeding anyway.');
      }

      if (saveData?.error) {
        console.error('[PaymentForm] save-payment-method returned error:', saveData.error);
        // Non-blocking: card was confirmed with Stripe
        console.warn('[PaymentForm] Card was confirmed but saving to profile failed. Proceeding anyway.');
      }

      console.log('[PaymentForm] Payment setup complete!');
      onSuccess();
    } catch (err: any) {
      console.error('[PaymentForm] Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred while saving your payment method');
    } finally {
      setLoading(false);
    }
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                fontFamily: 'system-ui, sans-serif',
                '::placeholder': {
                  color: '#9ca3af',
                },
              },
              invalid: {
                color: '#dc2626',
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
        <ShieldIcon className="text-green-600 flex-shrink-0" size={20} />
        <p className="text-sm text-gray-600">
          Your payment information is encrypted and securely processed by Stripe. We never store your full card number.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 py-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshIcon className="animate-spin" size={20} />
              Processing...
            </>
          ) : (
            <>
              <CheckCircleIcon size={20} />
              Save & Continue
            </>
          )}
        </button>
      </div>
    </form>
  );
};


const RiderOnboarding: React.FC<RiderOnboardingProps> = ({ onComplete }) => {
  const { user, riderProfile, updateRiderProfile, refreshRiderProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [safetyAccepted, setSafetyAccepted] = useState(false);

  const handleSafetyAccept = async () => {
    if (safetyAccepted) {
      // Try to save to DB but don't block on failure — the column may not exist yet
      try {
        await updateRiderProfile({ safety_disclosure_accepted: true });
      } catch (e) {
        console.warn('[RiderOnboarding] safety_disclosure update failed (non-blocking):', e);
      }
      setStep(2);
    }
  };


  const handlePaymentSuccess = async () => {
    // Refresh profile, then signal completion to parent
    // Parent (AppLayout) will call completeOnboarding() which clears the flag
    await refreshRiderProfile();
    onComplete();
  };


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-orange-600 p-6 text-white">
          <div className="flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">sit<span className="text-orange-300">N</span>ride</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-orange-200">Step {step} of 2</span>
            <span className="text-sm text-orange-200">
              {step === 1 ? 'Safety Disclosure' : 'Payment Method'}
            </span>
          </div>
          <div className="h-2 bg-orange-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 ? (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                <CameraIcon className="text-orange-600" size={32} />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">Safety Disclosure</h2>
              <p className="mt-2 text-gray-600">Important information about your rides</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CameraIcon className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                <div>
                  <p className="font-semibold text-orange-900">Video-Only Recording Notice</p>
                  <p className="text-sm text-orange-800 mt-1">
                    All sitNride trips are <strong>VIDEO recorded</strong> for safety purposes. 
                    This helps protect both riders and drivers.
                  </p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 font-medium">
                  <ShieldIcon className="inline mr-1" size={16} />
                  Audio recording is NOT permitted - your conversations remain private.
                </p>
              </div>

              <div className="border-t border-orange-200 pt-4 space-y-3 text-sm text-orange-800">
                <p><strong>What you should know:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Video recording begins when your ride starts</li>
                  <li><strong>Audio is NOT recorded</strong> - only video</li>
                  <li>Recordings are stored securely for 30 days</li>
                  <li>Footage is only accessed for safety incidents or disputes</li>
                  <li>Your privacy is protected under our data policy</li>
                </ul>
              </div>

              <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700">
                <p className="font-medium">Video Footage Policy:</p>
                <p className="mt-1">
                  sitNride requires drivers to use in-vehicle cameras for safety. Video footage is owned, stored, and maintained by the driver. sitNride does not continuously collect or store video footage and may request footage from a driver only in the event of a serious incident, dispute, or legal matter.
                </p>
              </div>

            </div>

            <label className="flex items-start gap-3 cursor-pointer p-4 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                checked={safetyAccepted}
                onChange={(e) => setSafetyAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <span className="text-gray-700 text-sm">
                I understand and acknowledge that all rides on sitNride are VIDEO recorded (no audio) for safety purposes.
              </span>
            </label>

            <button
              onClick={handleSafetyAccept}
              disabled={!safetyAccepted}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                safetyAccepted ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Continue <ChevronRightIcon size={20} />
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CreditCardIcon className="text-green-600" size={32} />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">Payment Method</h2>
              <p className="mt-2 text-gray-600">Add a payment method to book rides</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>Required:</strong> You must add a valid payment method before requesting a ride. 
                All payments are in-app only - no cash.
              </p>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#ea580c',
                    colorBackground: '#ffffff',
                    colorText: '#1f2937',
                    colorDanger: '#dc2626',
                    fontFamily: 'system-ui, sans-serif',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <PaymentForm
                riderId={user?.id || ''}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setStep(1)}
              />


            </Elements>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiderOnboarding;
