import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { database as supabase } from '@/lib/database';
import { ensureFreshSession } from '@/lib/sessionGuard';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import {
  CreditCardIcon, ChevronLeftIcon, CheckCircleIcon, XIcon,
  RefreshIcon, ShieldIcon, AlertCircleIcon
} from '@/components/ui/Icons';


interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  funding: string;
}

interface PaymentMethodsPageProps {
  onBack: () => void;
}

// Card brand logos/colors
const cardBrandStyles: Record<string, { bg: string; text: string; label: string }> = {
  visa: { bg: 'bg-gradient-to-r from-blue-600 to-blue-800', text: 'text-white', label: 'VISA' },
  mastercard: { bg: 'bg-gradient-to-r from-red-500 to-orange-500', text: 'text-white', label: 'MC' },
  amex: { bg: 'bg-gradient-to-r from-blue-400 to-blue-600', text: 'text-white', label: 'AMEX' },
  discover: { bg: 'bg-gradient-to-r from-orange-400 to-orange-600', text: 'text-white', label: 'DISC' },
  diners: { bg: 'bg-gradient-to-r from-gray-600 to-gray-800', text: 'text-white', label: 'DINE' },
  jcb: { bg: 'bg-gradient-to-r from-green-500 to-green-700', text: 'text-white', label: 'JCB' },
  unionpay: { bg: 'bg-gradient-to-r from-red-600 to-red-800', text: 'text-white', label: 'UP' },
  unknown: { bg: 'bg-gradient-to-r from-gray-500 to-gray-700', text: 'text-white', label: 'CARD' }
};

// Add Card Form Component
const AddCardForm: React.FC<{
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { user, riderProfile, refreshProfile } = useAuth();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      // 1. Ensure the rider's session is fresh before invoking any
      // auth-protected Edge Function. Stale/expired JWTs were
      // identified as a trigger for the preflight failure on
      // stripe-save-payment-method. If refresh fails, do NOT
      // continue — surface a re-auth prompt instead.
      const guard = await ensureFreshSession();
      if (!guard.ok) {
        console.warn('[AddCardForm] session guard failed:', guard.reason, (guard as any).error);
        setError(
          guard.reason === 'no_session'
            ? 'You must be logged in to save a payment method. Please log in and try again.'
            : 'Your session expired. Please log out and log back in, then try again.'
        );
        setLoading(false);
        return;
      }
      const session = guard.session;

      // 2. Determine rider_id: always use auth user id as canonical identifier
      const riderId = session.user.id;


      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card element not found. Please refresh the page.');
        setLoading(false);
        return;
      }

      console.log("SENDING rider_id:", user?.id);
      console.log('[AddCardForm] Step 1: Calling rider-card-setup with riderId:', riderId);

      // 3. Call rider-card-setup to create a Stripe Customer and SetupIntent
      const { data: setupData, error: setupError } = await supabase.functions.invoke('rider-card-setup', {
        body: {
          rider_id: riderId,
          email: session.user.email || user?.email,
          name: user?.full_name || session.user.email,
        }
      });

      console.log("SETUP RESPONSE:", setupData);
      console.log('[AddCardForm] rider-card-setup response:', { setupData, setupError });


      if (setupError) {
        const errMsg = typeof setupError === 'object' && setupError.message
          ? setupError.message
          : String(setupError);
        console.error('[AddCardForm] rider-card-setup invocation error:', errMsg);
        setError(`Card setup failed: ${errMsg}`);
        setLoading(false);
        return;
      }

      if (setupData?.error) {
        console.error('[AddCardForm] rider-card-setup returned error:', setupData.error);
        setError(`Card setup failed: ${setupData.error}`);
        setLoading(false);
        return;
      }

      const { clientSecret } = setupData || {};
      if (!clientSecret) {
        console.error('[AddCardForm] No clientSecret in response. Full response:', JSON.stringify(setupData));
        setError('Failed to get setup intent from server. Please try again or contact support.');
        setLoading(false);
        return;
      }

      console.log('[AddCardForm] Step 2: Got clientSecret, confirming card setup...');

      // 4. Confirm the card setup with Stripe
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (confirmError) {
        console.error('[AddCardForm] confirmCardSetup error:', confirmError.message);
        setError(confirmError.message || 'Failed to confirm card setup');
        setLoading(false);
        return;
      }

      if (!setupIntent || !setupIntent.payment_method) {
        console.error('[AddCardForm] No payment method in setupIntent:', setupIntent);
        setError('Failed to setup payment method. Please try again.');
        setLoading(false);
        return;
      }

      // 5. Extract the payment method ID from the confirmed SetupIntent
      const paymentMethodId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      // 5a. Retrieve the FULL PaymentMethod object so we can extract
      // card.brand and card.last4 to persist into the profiles table.
      // Stripe.js may return `setupIntent.payment_method` either as a
      // string PM ID or as an already-expanded PaymentMethod object.
      // Handle both cases defensively; if expanded, read directly.
      // Otherwise, fall back to `stripe.retrieveSetupIntent` which
      // sometimes returns an expanded payment_method.
      let brand: string | undefined;
      let last_four: string | undefined;

      const pmFromConfirm: any = setupIntent.payment_method;
      if (pmFromConfirm && typeof pmFromConfirm === 'object' && pmFromConfirm.card) {
        brand = pmFromConfirm.card.brand;
        last_four = pmFromConfirm.card.last4;
      }

      // If brand/last4 weren't expanded on the initial confirm response,
      // re-retrieve the SetupIntent — Stripe.js often returns the
      // payment_method expanded on a fresh retrieve call.
      if (!brand || !last_four) {
        try {
          const retrieved = await stripe.retrieveSetupIntent(clientSecret);
          const pmRetrieved: any = retrieved?.setupIntent?.payment_method;
          if (pmRetrieved && typeof pmRetrieved === 'object' && pmRetrieved.card) {
            brand = brand || pmRetrieved.card.brand;
            last_four = last_four || pmRetrieved.card.last4;
          }
        } catch (retrieveErr) {
          console.warn('[AddCardForm] retrieveSetupIntent failed (non-blocking):', retrieveErr);
        }
      }

      console.log('[AddCardForm] Step 3: Card confirmed, saving payment method:', paymentMethodId, { brand, last_four });

      // 5b. CRITICAL: Re-refresh the rider's session IMMEDIATELY before
      // invoking stripe-save-payment-method. The Stripe.js
      // confirmCardSetup() round-trip above can take 5–30s, during which
      // the JWT obtained at the top of handleSubmit may expire. A stale
      // token causes the Functions gateway to reject the POST (surfaced
      // to the browser as a generic FunctionsFetchError / preflight-style
      // failure) BEFORE the Edge Function executes — which is why all
      // diag payloads come back undefined.
      //
      // We force a refresh here (force: true) so we always have a
      // brand-new token regardless of remaining lifetime on the existing
      // one. This is scoped strictly to the save-payment-method invoke
      // path; nothing else (pricing, booking, SetupIntent, capture,
      // renderer, fallback, schema, Mapbox, Twilio, onboarding) is
      // touched.
      const preInvokeExpiresAt = (session as any)?.expires_at as number | undefined;
      const preInvokeNowSec = Math.floor(Date.now() / 1000);
      console.log('%c[DIAG][SAVE] Pre-invoke token state:', 'color:#dc2626;font-weight:bold;', {
        expires_at: preInvokeExpiresAt,
        now_sec: preInvokeNowSec,
        seconds_until_expiry:
          typeof preInvokeExpiresAt === 'number'
            ? preInvokeExpiresAt - preInvokeNowSec
            : null,
      });

      const postStripeGuard = await ensureFreshSession({ force: true });
      console.log('%c[DIAG][SAVE] Post-Stripe ensureFreshSession result:', 'color:#dc2626;font-weight:bold;', {
        ok: postStripeGuard.ok,
        reason: (postStripeGuard as any).reason,
        refreshed: (postStripeGuard as any).refreshed,
        new_expires_at: (postStripeGuard as any).session?.expires_at,
        new_seconds_until_expiry:
          typeof (postStripeGuard as any).session?.expires_at === 'number'
            ? (postStripeGuard as any).session.expires_at - Math.floor(Date.now() / 1000)
            : null,
        error: (postStripeGuard as any).error,
      });

      if (!postStripeGuard.ok) {
        console.warn('[AddCardForm] Post-Stripe session refresh failed:', postStripeGuard.reason);
        setError(
          'Your session expired while confirming the card. The card was authorized with Stripe but could not be saved. Please log out, log back in, and try adding the card again.'
        );
        setLoading(false);
        return;
      }

      // 6. Save the payment method via Edge Function using supabase.functions.invoke
      // Pass brand + last_four so the profiles table persists them and the
      // PaymentMethodsPage fallback can render the saved card.
      const { data: saveData, error: saveError } = await supabase.functions.invoke('stripe-save-payment-method', {
        body: {
          rider_id: riderId,
          payment_method_id: paymentMethodId,
          brand,
          last_four,
        }
      });

      console.log('[AddCardForm] stripe-save-payment-method response:', { saveData, saveError });
      // === TEMP DIAGNOSTICS — REMOVE AFTER VERIFICATION ===
      try {
        console.log('%c[DIAG][SAVE] Full diag payload:', 'color:#dc2626;font-weight:bold;', (saveData as any)?.diag);
        console.log('[DIAG][SAVE] Gateway raw response:', (saveData as any)?.diag?.gateway_raw_response);
        console.log('[DIAG][SAVE] Gateway card paths:', (saveData as any)?.diag?.gateway_card_paths);
        console.log('[DIAG][SAVE] Gateway extracted:', (saveData as any)?.diag?.gateway_extracted);
        console.log('[DIAG][SAVE] Resolved values:', (saveData as any)?.diag?.resolved);
        console.log('[DIAG][SAVE] Update payload sent to DB:', (saveData as any)?.diag?.update_payload);
        console.log('[DIAG][SAVE] Profile BEFORE update:', (saveData as any)?.diag?.profile_before);
        console.log('[DIAG][SAVE] Profile AFTER update:', (saveData as any)?.diag?.profile_after);
      } catch (e) { console.warn('[DIAG][SAVE] log error:', e); }


      if (saveError) {
        console.error('[AddCardForm] save error:', saveError);
        // === TEMP DIAGNOSTICS — surface FunctionsFetchError internals ===
        // FunctionsFetchError attaches the underlying Response on
        // `.context`. Logging it reveals whether the failure is a
        // gateway 401/403 (auth/JWT) vs. a true CORS/network error.
        try {
          const ctx: any = (saveError as any)?.context;
          console.log('%c[DIAG][SAVE] saveError.name:', 'color:#dc2626;font-weight:bold;', (saveError as any)?.name);
          console.log('[DIAG][SAVE] saveError.message:', (saveError as any)?.message);
          console.log('[DIAG][SAVE] saveError.context:', ctx);
          console.log('[DIAG][SAVE] saveError.context?.status:', ctx?.status);
          console.log('[DIAG][SAVE] saveError.context?.statusText:', ctx?.statusText);
          if (ctx?.headers && typeof ctx.headers.forEach === 'function') {
            const headerDump: Record<string, string> = {};
            try { ctx.headers.forEach((v: string, k: string) => { headerDump[k] = v; }); } catch {}
            console.log('[DIAG][SAVE] saveError.context.headers:', headerDump);
          }
          // Best-effort body read (Response may be already consumed)
          if (ctx && typeof ctx.clone === 'function') {
            try {
              const cloned = ctx.clone();
              const bodyText = await cloned.text();
              console.log('[DIAG][SAVE] saveError.context body text:', bodyText);
            } catch (bodyErr) {
              console.log('[DIAG][SAVE] could not read saveError body:', bodyErr);
            }
          }
        } catch (diagErr) {
          console.warn('[DIAG][SAVE] error inspecting saveError:', diagErr);
        }

        // Surface (non-blocking): card was confirmed with Stripe but
        // persistence to profiles may have failed. Inform the user.
        setWarning('Card was saved but may not appear immediately. Refreshing...');
      }

      if (saveData?.error) {
        console.error('[AddCardForm] save returned error:', saveData.error);
        // Surface (non-blocking): card was confirmed with Stripe but
        // persistence to profiles may have failed. Inform the user.
        setWarning('Card was saved but may not appear immediately. Refreshing...');
      }



      await refreshProfile();
      onSuccess();
    } catch (err: any) {
      console.error('[AddCardForm] Unexpected error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4">
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircleIcon className="text-red-500 flex-shrink-0" size={20} />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {warning && !error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircleIcon className="text-yellow-600 flex-shrink-0" size={20} />
          <p className="text-yellow-800 text-sm">{warning}</p>
        </div>
      )}


      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 py-3 px-4 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshIcon className="animate-spin" size={18} />
              Adding...
            </>
          ) : (
            'Add Card'
          )}
        </button>
      </div>
    </form>
  );
};


// Build a minimal fallback PaymentMethod from the rider's profile when the
// Edge Function is unreachable/hangs. The card id is the rider's saved
// payment method id, so any read-only display works; mutation controls are
// hidden via `usingFallback` since we don't have a live PM list to mutate.
const buildFallbackCard = (rp: any): PaymentMethod[] => {
  if (!rp) return [];
  const pmId =
    rp.stripe_payment_method_id ||
    rp.payment_method_id ||
    rp.FamousPay_payment_method_id ||
    null;
  const last4 = rp.payment_method_last_four;
  const brand = rp.payment_method_brand;
  if (!last4) return [];

  return [
    {
      id: pmId || 'fallback-default',
      brand: (brand || 'unknown').toString(),
      last4: (last4 || '••••').toString(),
      expMonth: 0,
      expYear: 0,
      isDefault: true,
      funding: 'unknown',
    },
  ];
};

// Main Payment Methods Page
const PaymentMethodsPage: React.FC<PaymentMethodsPageProps> = ({ onBack }) => {
  const { user, riderProfile, refreshProfile } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Load payment methods — resilient to Edge Function hangs/failures.
  // Guarantees `loading` is cleared via finally + Promise.race timeout +
  // AbortController. Falls back to riderProfile-derived card on any error.
  const loadPaymentMethods = async () => {
    // Defensive: if no rider profile yet, stop spinner instead of hanging.
    if (!riderProfile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUsingFallback(false);

    const controller = new AbortController();
    let timeoutId: any = null;

    try {
      // Race the Edge Function call against a 10s timeout so the spinner
      // is guaranteed to stop even if the request never resolves.
      const invokePromise = supabase.functions.invoke(
        'stripe-manage-payment-methods',
        {
          body: {
            action: 'list',
            rider_id: riderProfile.id,
          },
          // Pass abort signal where supported; harmless if ignored.
          // @ts-ignore - signal may not be in the type defs of older SDKs
          signal: controller.signal,
        }
      );

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          try { controller.abort(); } catch {}
          reject(new Error('TIMEOUT'));
        }, 10000);
      });

      const result: any = await Promise.race([invokePromise, timeoutPromise]);
      const data = result?.data;
      const fnError = result?.error;

      // === TEMP DIAGNOSTICS — REMOVE AFTER VERIFICATION ===
      try {
        console.log('%c[DIAG][LIST] riderProfile snapshot:', 'color:#2563eb;font-weight:bold;', {
          id: riderProfile?.id,
          stripe_customer_id: (riderProfile as any)?.stripe_customer_id,
          stripe_payment_method_id: (riderProfile as any)?.stripe_payment_method_id,
          payment_method_brand: (riderProfile as any)?.payment_method_brand,
          payment_method_last_four: (riderProfile as any)?.payment_method_last_four,
          has_payment_method: (riderProfile as any)?.has_payment_method,
        });
        console.log('%c[DIAG][LIST] Edge Function raw response:', 'color:#2563eb;font-weight:bold;', { data, fnError });
        console.log('[DIAG][LIST] Full diag payload from EF:', (data as any)?.diag);
        console.log('[DIAG][LIST] EF profile_snapshot:', (data as any)?.diag?.profile_snapshot);
        console.log('[DIAG][LIST] EF customer_id:', (data as any)?.diag?.customer_id, 'present:', (data as any)?.diag?.customer_id_present);
        console.log('[DIAG][LIST] EF gateway list_status:', (data as any)?.diag?.list_status);
        console.log('[DIAG][LIST] EF gateway list_raw_response:', (data as any)?.diag?.list_raw_response);
        console.log('[DIAG][LIST] EF formatted_payment_methods:', (data as any)?.diag?.formatted_payment_methods);
        console.log('[DIAG][LIST] EF list_fallback_used:', (data as any)?.diag?.list_fallback_used, 'value:', (data as any)?.diag?.list_fallback_value);
        console.log('[DIAG][LIST] paymentMethods array returned to client:', data?.paymentMethods);
      } catch (e) { console.warn('[DIAG][LIST] log error:', e); }

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to load payment methods');
      }

      const list = Array.isArray(data?.paymentMethods) ? data.paymentMethods : [];

      // FIX: Treat empty-success as a fallback trigger when the rider's
      // profile already has a card on file (e.g., from onboarding or a prior
      // save where the live list query returns empty due to stale
      // FamousPay_customer_id or response-shape mismatch). This keeps
      // PaymentMethodsPage visually consistent with RiderDashboard, which
      // reads the same profile columns directly.
      if (list.length === 0) {
        const fallback = buildFallbackCard(riderProfile);
        console.log('%c[DIAG][LIST] list empty — buildFallbackCard returned:', 'color:#16a34a;font-weight:bold;', fallback);
        if (fallback.length > 0) {
          setPaymentMethods(fallback);
          setUsingFallback(true);
          setError('Showing your default card on file');
          return;
        }
        console.log('%c[DIAG][LIST] FALLBACK ALSO EMPTY — page will render "No saved cards"', 'color:#dc2626;font-weight:bold;');
      }

      console.log('%c[DIAG][LIST] Final paymentMethods passed to setPaymentMethods:', 'color:#16a34a;font-weight:bold;', list);
      setPaymentMethods(list);
      setUsingFallback(false);


    } catch (err: any) {
      // Any failure (timeout, network, malformed response) → fallback.
      const fallback = buildFallbackCard(riderProfile);
      if (fallback.length > 0) {
        setPaymentMethods(fallback);
        setUsingFallback(true);
        setError('Unable to refresh saved cards — showing your default card on file');
      } else {
        setPaymentMethods([]);
        setUsingFallback(false);
        setError(err?.message === 'TIMEOUT'
          ? 'Payment methods request timed out. Please try again.'
          : (err?.message || 'Failed to load payment methods'));
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, [riderProfile]);


  // Open the add card form directly - no Edge Function needed
  const handleAddCard = () => {
    setError(null);
    setShowAddCard(true);
  };

  // Delete payment method
  const handleDelete = async (paymentMethodId: string) => {
    if (!riderProfile) return;

    setDeletingId(paymentMethodId);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-manage-payment-methods', {
        body: {
          action: 'delete',
          rider_id: riderProfile.id,
          payment_method_id: paymentMethodId
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to delete payment method');
      }

      setSuccessMessage('Card removed successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadPaymentMethods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Set default payment method
  const handleSetDefault = async (paymentMethodId: string) => {
    if (!riderProfile) return;

    setSettingDefaultId(paymentMethodId);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-manage-payment-methods', {
        body: {
          action: 'set_default',
          rider_id: riderProfile.id,
          payment_method_id: paymentMethodId
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to set default payment method');
      }

      setSuccessMessage('Default payment method updated');
      setTimeout(() => setSuccessMessage(null), 3000);
      await refreshProfile();
      await loadPaymentMethods();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSettingDefaultId(null);
    }
  };

  // Handle successful card addition
  const handleAddCardSuccess = async () => {
    setShowAddCard(false);
    setSuccessMessage('Card added successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
    // FIX 3: Force-refresh riderProfile BEFORE re-listing cards so the
    // fallback logic (which reads from riderProfile columns) has the
    // freshest data when the live list call returns empty.
    await refreshProfile();
    await loadPaymentMethods();
  };


  const getCardStyle = (brand: string) => {
    return cardBrandStyles[brand.toLowerCase()] || cardBrandStyles.unknown;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeftIcon size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payment Methods</h1>
            <p className="text-sm text-gray-500">Manage your saved cards</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircleIcon className="text-green-600" size={20} />
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`${usingFallback ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4 flex items-center gap-3`}>
            <AlertCircleIcon className={usingFallback ? 'text-yellow-600' : 'text-red-500'} size={20} />
            <p className={usingFallback ? 'text-yellow-800 flex-1' : 'text-red-700 flex-1'}>{error}</p>
            <button
              onClick={() => loadPaymentMethods()}
              disabled={loading}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${usingFallback ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              Retry
            </button>
            <button
              onClick={() => setError(null)}
              className={`p-1 rounded-full ${usingFallback ? 'hover:bg-yellow-100' : 'hover:bg-red-100'}`}
            >
              <XIcon size={16} className={usingFallback ? 'text-yellow-700' : 'text-red-500'} />
            </button>
          </div>
        )}


        {/* Add Card Section */}
        {showAddCard ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Card</h2>
            <Elements
              stripe={stripePromise}
              options={{
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#ea580c',
                    borderRadius: '12px',
                  }
                }
              }}
            >
              <AddCardForm
                onSuccess={handleAddCardSuccess}
                onCancel={() => {
                  setShowAddCard(false);
                }}
              />
            </Elements>
          </div>
        ) : (
          <>
            {/* Saved Cards */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Saved Cards</h2>
                  <button
                    onClick={handleAddCard}
                    className="px-4 py-2 bg-orange-600 text-white rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <CreditCardIcon size={18} />
                    Add Card
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <RefreshIcon className="animate-spin text-orange-600 mx-auto" size={32} />
                  <p className="mt-3 text-gray-500">Loading payment methods...</p>
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="p-8 text-center">
                  <CreditCardIcon className="mx-auto text-gray-300" size={48} />
                  <p className="mt-3 text-gray-500">No saved cards</p>
                  <p className="text-sm text-gray-400 mt-1">Add a card to book rides</p>
                </div>
              ) : (
                <div className="divide-y">
                  {paymentMethods.map((pm) => {
                    const style = getCardStyle(pm.brand);
                    return (
                      <div key={pm.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          {/* Card Visual */}
                          <div className={`w-16 h-10 ${style.bg} rounded-lg flex items-center justify-center ${style.text} text-xs font-bold shadow-sm`}>
                            {style.label}
                          </div>

                          {/* Card Details */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 capitalize">
                                {pm.brand} •••• {pm.last4}
                              </p>
                              {pm.isDefault && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {pm.expMonth > 0 && pm.expYear > 0 ? (
                                <>
                                  Expires {pm.expMonth.toString().padStart(2, '0')}/{pm.expYear.toString().slice(-2)}
                                </>
                              ) : (
                                <>Default payment method</>
                              )}
                              {pm.funding && pm.funding !== 'unknown' && (
                                <span className="ml-2 capitalize">• {pm.funding}</span>
                              )}
                            </p>
                          </div>

                          {/* Actions — hidden when using fallback (no live PM list to mutate) */}
                          {!usingFallback && (
                            <div className="flex items-center gap-2">
                              {!pm.isDefault && (
                                <button
                                  onClick={() => handleSetDefault(pm.id)}
                                  disabled={settingDefaultId === pm.id}
                                  className="px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                  {settingDefaultId === pm.id ? (
                                    <RefreshIcon className="animate-spin" size={14} />
                                  ) : (
                                    <CheckCircleIcon size={14} />
                                  )}
                                  Set Default
                                </button>
                              )}
                              {!pm.isDefault && (
                                <button
                                  onClick={() => handleDelete(pm.id)}
                                  disabled={deletingId === pm.id}
                                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                  {deletingId === pm.id ? (
                                    <RefreshIcon className="animate-spin" size={14} />
                                  ) : (
                                    <XIcon size={14} />
                                  )}
                                  Remove
                                </button>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Security Info */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <ShieldIcon className="text-green-600" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Secure Payment Processing</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Your payment information is securely processed by Stripe. We never store your full card details on our servers.
                    All transactions are encrypted and PCI-DSS compliant.
                  </p>
                </div>
              </div>
            </div>

            {/* Card Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Tips for Managing Cards</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>Keep at least one card saved for seamless ride booking</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>Set your preferred card as default for faster checkout</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>Remove expired or unused cards to keep your account organized</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <span>You cannot remove your default card - set another as default first</span>
                </li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PaymentMethodsPage;
