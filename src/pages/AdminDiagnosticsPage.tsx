import React from 'react';
import { Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import {
  getEnvVarStatuses,
  getEnvSummary,
  type EnvVarStatus,
} from '@/lib/envDiagnostics';
import {
  ShieldIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  RefreshIcon,
} from '@/components/ui/Icons';

/**
 * Admin-only diagnostics page at /admin/diagnostics.
 *
 * Lists every VITE_* env var the app expects and shows — for each one — a
 * green check or red X plus whether the hardcoded fallback is being used.
 * VALUES ARE NEVER REVEALED, even partially, so this page is safe to leave
 * accessible to anyone with the admin role.
 *
 * Access control:
 *   - Unauthenticated → redirect message back to home.
 *   - Authenticated but not admin → "Access denied" view.
 *   - Admin → full diagnostics table.
 */

const severityStyles: Record<
  EnvVarStatus['severity'],
  { label: string; pillClass: string }
> = {
  critical: {
    label: 'Critical',
    pillClass: 'bg-red-100 text-red-700',
  },
  high: {
    label: 'High',
    pillClass: 'bg-amber-100 text-amber-700',
  },
  medium: {
    label: 'Medium',
    pillClass: 'bg-blue-100 text-blue-700',
  },
};

const StatusRow: React.FC<{ status: EnvVarStatus }> = ({ status }) => {
  // Visual state:
  //   present === true                       → green check (configured)
  //   !present && usingFallback === true     → amber warning (fallback)
  //   !present && usingFallback === false    → red X (broken)
  let icon: React.ReactNode;
  let stateLabel: string;
  let stateClass: string;

  if (status.present) {
    icon = <CheckCircleIcon size={20} className="text-green-600" />;
    stateLabel = 'Configured';
    stateClass = 'text-green-700 bg-green-50 border-green-200';
  } else if (status.usingFallback) {
    icon = <AlertTriangleIcon size={20} className="text-amber-600" />;
    stateLabel = 'Using fallback';
    stateClass = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    icon = <XCircleIcon size={20} className="text-red-600" />;
    stateLabel = 'Missing';
    stateClass = 'text-red-700 bg-red-50 border-red-200';
  }

  const sev = severityStyles[status.severity];

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {icon}
          <span
            className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${stateClass}`}
          >
            {stateLabel}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <code className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-900 font-mono">
          {status.name}
        </code>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">{status.description}</td>
      <td className="px-6 py-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${sev.pillClass}`}
        >
          {sev.label}
        </span>
      </td>
    </tr>
  );
};

const DiagnosticsContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [statuses, setStatuses] = React.useState<EnvVarStatus[]>(() =>
    getEnvVarStatuses(),
  );
  const [summary, setSummary] = React.useState(() => getEnvSummary());

  // "Refresh" just re-reads import.meta.env. In a Vite build env vars are
  // baked at build time so this is mostly cosmetic, but it's reassuring for
  // ops to see a refresh control work.
  const handleRefresh = () => {
    setStatuses(getEnvVarStatuses());
    setSummary(getEnvSummary());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <RefreshIcon className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <ShieldIcon size={48} className="text-gray-400 mx-auto" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Sign-in required
          </h1>
          <p className="mt-2 text-gray-600">
            The diagnostics page is only available to signed-in admin users.
          </p>
          <Link
            to="/"
            className="inline-block mt-6 px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <XCircleIcon size={48} className="text-red-500 mx-auto" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Access denied
          </h1>
          <p className="mt-2 text-gray-600">
            Your account does not have permission to view this page. If you
            believe this is a mistake, contact a platform admin.
          </p>
          <Link
            to="/"
            className="inline-block mt-6 px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  // Admin view — full diagnostics.
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
              <ShieldIcon className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Environment Diagnostics</h1>
              <p className="text-sm text-gray-500">
                Deployment configuration audit — admin only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Refresh"
            >
              <RefreshIcon size={20} />
            </button>
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Privacy notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldIcon className="text-blue-600 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Values are never displayed.</p>
            <p className="mt-1 text-blue-800">
              For security, this page only reports whether each env var is set
              and whether the hardcoded fallback is in use. Actual URLs, keys,
              and tokens are <strong>never</strong> exposed in the UI, network
              responses, or browser DOM.
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Build mode</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 capitalize">
              {summary.mode}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Configured</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {summary.configured}
              <span className="text-base font-medium text-gray-400">
                {' '}
                / {summary.total}
              </span>
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Using fallback</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {summary.usingFallback}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500">Missing (no fallback)</p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {Math.max(0, summary.missing - summary.usingFallback)}
            </p>
          </div>
        </div>

        {/* Production warning */}
        {summary.mode === 'production' && summary.usingFallback > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangleIcon
              className="text-amber-600 shrink-0 mt-0.5"
              size={20}
            />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">
                Production build is relying on hardcoded fallbacks.
              </p>
              <p className="mt-1 text-amber-800">
                {summary.usingFallback} env var
                {summary.usingFallback === 1 ? '' : 's'} listed below are not
                set in this deployment. The app still works because hardcoded
                defaults are baked in, but credential rotation will require a
                code commit until you set these values in your hosting
                provider's environment configuration.
              </p>
            </div>
          </div>
        )}

        {/* Diagnostics table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Variable
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Description
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {statuses.map((s) => (
                  <StatusRow key={s.name} status={s} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Legend</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircleIcon size={20} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Configured</p>
                <p className="text-gray-600">
                  Env var is set in this build. Credentials can be rotated
                  via your hosting provider — no code commit required.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangleIcon size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Using fallback</p>
                <p className="text-gray-600">
                  Env var is not set; app is using a hardcoded default.
                  Feature works, but rotating requires a code commit.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircleIcon size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Missing</p>
                <p className="text-gray-600">
                  Env var is not set and there is no fallback. The dependent
                  feature is disabled until configured.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const AdminDiagnosticsPage: React.FC = () => (
  // The /admin/diagnostics route is registered directly in App.tsx without
  // wrapping it in <AppProvider>, so we provide our own <AuthProvider> here
  // (mirroring how AdminPanel's own route works after AppLayout). This makes
  // the page self-contained and reachable directly via URL.
  <AuthProvider>
    <DiagnosticsContent />
  </AuthProvider>
);

export default AdminDiagnosticsPage;
