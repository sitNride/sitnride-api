import React, { useState, useEffect } from 'react';
import { database as supabase } from '@/lib/database';
import {
  RefreshIcon, MailIcon, PhoneIcon, UserIcon, CheckCircleIcon,
  XCircleIcon, AlertTriangleIcon
} from '@/components/ui/Icons';

interface AdminContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  notify_sms: boolean;
  notify_email: boolean;
  created_at: string;
}

interface SmsResult {
  name: string;
  to: string;
  ok: boolean;
  status: number;
  error?: string;
}

interface EmailResult {
  ok: boolean;
  status: number;
  error?: string;
  recipients: Array<{ name: string; to: string }>;
}

interface TestAlertResults {
  ok: boolean;
  role: string;
  ride_id: string;
  user_id: string;
  maps_link: string;
  created_at: string;
  is_test: boolean;
  results: {
    sms: SmsResult[];
    email: EmailResult | null;
    skipped: string[];
    contacts_loaded: number;
    contacts_error?: string;
    is_test: boolean;
  };
}

const emptyForm = {
  id: '' as string | '',
  name: '',
  phone: '',
  email: '',
  is_active: true,
  notify_sms: true,
  notify_email: true,
};

const AdminEmergencyContacts: React.FC = () => {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Test-alert state (broadcast to all)
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestAlertResults | null>(null);

  // Per-row single-contact test state, keyed by contact id.
  // sms/email are 'pending' while sending, then 'pass' | 'fail' | 'skipped'.
  type RowChannelStatus = 'pending' | 'pass' | 'fail' | 'skipped';
  interface RowTestStatus {
    sending: boolean;
    sms: RowChannelStatus;
    email: RowChannelStatus;
    error?: string;
    at?: string; // ISO timestamp of most recent test
  }
  const [rowTests, setRowTests] = useState<Record<string, RowTestStatus>>({});


  const load = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: dbErr } = await supabase
      .from('admin_emergency_contacts')
      .select('*')
      .order('created_at', { ascending: false });
    if (dbErr) {
      setError(dbErr.message);
    } else {
      setContacts((data || []) as AdminContact[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (c: AdminContact) => {
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      is_active: c.is_active,
      notify_sms: c.notify_sms,
      notify_email: c.notify_email,
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const save = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError('Provide at least a phone or email.');
      return;
    }
    if (form.notify_sms && !form.phone.trim()) {
      setError('SMS notifications require a phone number.');
      return;
    }
    if (form.notify_email && !form.email.trim()) {
      setError('Email notifications require an email address.');
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      is_active: form.is_active,
      notify_sms: form.notify_sms,
      notify_email: form.notify_email,
    };

    if (form.id) {
      const { error: upErr } = await supabase
        .from('admin_emergency_contacts')
        .update(payload)
        .eq('id', form.id);
      if (upErr) {
        setError(upErr.message);
        setIsSaving(false);
        return;
      }
    } else {
      const { error: insErr } = await supabase
        .from('admin_emergency_contacts')
        .insert(payload);
      if (insErr) {
        setError(insErr.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    setShowForm(false);
    setForm(emptyForm);
    load();
  };

  const toggleActive = async (c: AdminContact) => {
    const { error: upErr } = await supabase
      .from('admin_emergency_contacts')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setContacts((prev) =>
      prev.map((row) => (row.id === c.id ? { ...row, is_active: !row.is_active } : row))
    );
  };

  const remove = async (c: AdminContact) => {
    if (!window.confirm(`Delete on-call contact "${c.name}"? This cannot be undone.`)) return;
    const { error: delErr } = await supabase
      .from('admin_emergency_contacts')
      .delete()
      .eq('id', c.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setContacts((prev) => prev.filter((row) => row.id !== c.id));
  };

  const sendTestAlert = async () => {
    setIsSendingTest(true);
    setTestError(null);
    setTestResults(null);

    // Random 4-char ride suffix for traceability
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const testPayload = {
      role: 'test',
      ride_id: `TEST-${suffix}`,
      user_id: 'admin-test-user',
      // Sample location: Charleston, SC city hall (recognizable + safe sample coords)
      location_lat: 32.7765,
      location_lng: -79.9311,
      message:
        'This is a test alert sent from the AdminPanel "Send Test Alert" button. No real emergency occurred.',
      created_at: new Date().toISOString(),
      is_test: true,
    };

    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        'notify-admin-emergency',
        { body: testPayload },
      );
      if (invErr) {
        setTestError(invErr.message || 'Failed to invoke notify-admin-emergency.');
        setIsSendingTest(false);
        return;
      }
      setTestResults(data as TestAlertResults);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSendingTest(false);
    }
  };

  // Single-contact test send (used by the per-row "Test" button).
  const sendRowTest = async (c: AdminContact) => {
    // Mark this row as sending; clear any prior result.
    setRowTests((prev) => ({
      ...prev,
      [c.id]: { sending: true, sms: 'pending', email: 'pending' },
    }));

    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const testPayload = {
      role: 'test',
      ride_id: `TEST-${suffix}`,
      user_id: 'admin-test-user',
      location_lat: 32.7765,
      location_lng: -79.9311,
      message: `Single-contact test for "${c.name}" from the AdminPanel. No real emergency occurred.`,
      created_at: new Date().toISOString(),
      is_test: true,
      only_contact_id: c.id,
    };

    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        'notify-admin-emergency',
        { body: testPayload },
      );
      if (invErr) {
        setRowTests((prev) => ({
          ...prev,
          [c.id]: {
            sending: false,
            sms: 'fail',
            email: 'fail',
            error: invErr.message || 'Invocation failed',
            at: new Date().toISOString(),
          },
        }));
        return;
      }

      const res = (data as TestAlertResults | null)?.results;
      const skipped = res?.skipped ?? [];

      // SMS status: pass if our SMS row succeeded, fail if any was returned and failed,
      // skipped if the channel was skipped (e.g. notify_sms off or twilio not configured).
      let smsStatus: RowChannelStatus = 'skipped';
      if (res && res.sms.length > 0) {
        smsStatus = res.sms.every((r) => r.ok) ? 'pass' : 'fail';
      } else if (skipped.some((s) => s.startsWith('twilio'))) {
        smsStatus = 'skipped';
      }

      // Email status: similar logic.
      let emailStatus: RowChannelStatus = 'skipped';
      if (res && res.email) {
        emailStatus = res.email.ok ? 'pass' : 'fail';
      } else if (skipped.some((s) => s.startsWith('resend'))) {
        emailStatus = 'skipped';
      }

      // Surface a short error if anything failed.
      const errPieces: string[] = [];
      if (res?.contacts_error) errPieces.push(res.contacts_error);
      if (smsStatus === 'fail' && res?.sms?.[0]?.error) {
        errPieces.push(`SMS: ${res.sms[0].error.slice(0, 120)}`);
      }
      if (emailStatus === 'fail' && res?.email?.error) {
        errPieces.push(`Email: ${res.email.error.slice(0, 120)}`);
      }

      setRowTests((prev) => ({
        ...prev,
        [c.id]: {
          sending: false,
          sms: smsStatus,
          email: emailStatus,
          error: errPieces.length > 0 ? errPieces.join(' • ') : undefined,
          at: new Date().toISOString(),
        },
      }));
    } catch (err) {
      setRowTests((prev) => ({
        ...prev,
        [c.id]: {
          sending: false,
          sms: 'fail',
          email: 'fail',
          error: err instanceof Error ? err.message : String(err),
          at: new Date().toISOString(),
        },
      }));
    }
  };

  // Render a tiny channel pill (SMS / Email) for the inline row result badge.
  const renderRowStatusPill = (label: string, status: RowChannelStatus) => {
    const cls =
      status === 'pass'
        ? 'bg-green-100 text-green-700'
        : status === 'fail'
        ? 'bg-red-100 text-red-700'
        : status === 'pending'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-500';
    const icon =
      status === 'pass' ? (
        <CheckCircleIcon size={10} />
      ) : status === 'fail' ? (
        <XCircleIcon size={10} />
      ) : status === 'pending' ? (
        <RefreshIcon size={10} className="animate-spin" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      );
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${cls}`}
        title={`${label}: ${status}`}
      >
        {icon}
        {label}
      </span>
    );
  };


  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">On-Call Admin Contacts</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            These contacts receive real-time SMS and email alerts when a 911 emergency event is
            triggered. Disable a contact to remove them from the on-call rotation without deleting them.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            title="Refresh"
          >
            <RefreshIcon size={16} /> Refresh
          </button>
          <button
            onClick={startNew}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangleIcon size={18} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ---- Test Alert section ---------------------------------------- */}
      <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangleIcon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Send Test Alert</h3>
              <p className="text-sm text-gray-600 max-w-xl mt-0.5">
                Sends a clearly-marked <strong>[TEST]</strong> alert (role=test, sample ride ID +
                location) to every active on-call contact so you can verify SMS &amp; email delivery
                without triggering a real 911 event.
              </p>
            </div>
          </div>
          <button
            onClick={sendTestAlert}
            disabled={isSendingTest || contacts.filter((c) => c.is_active).length === 0}
            className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
            title={
              contacts.filter((c) => c.is_active).length === 0
                ? 'Add at least one active contact first'
                : 'Send a test alert to all active on-call contacts'
            }
          >
            {isSendingTest ? (
              <>
                <RefreshIcon size={16} className="animate-spin" /> Sending…
              </>
            ) : (
              <>Send Test Alert</>
            )}
          </button>
        </div>

        {testError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex items-start gap-2">
            <AlertTriangleIcon size={16} />
            <p className="text-sm">{testError}</p>
          </div>
        )}

        {testResults && (
          <div className="mt-5 border-t pt-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                ride_id: <span className="font-mono">{testResults.ride_id}</span>
              </span>
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                contacts loaded: <strong>{testResults.results.contacts_loaded}</strong>
              </span>
              <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                sent at:{' '}
                <span className="font-mono">
                  {new Date(testResults.created_at).toLocaleString()}
                </span>
              </span>
            </div>

            {testResults.results.contacts_error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                contacts_error: {testResults.results.contacts_error}
              </div>
            )}

            {testResults.results.skipped.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 mb-1">Skipped channels:</p>
                <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5">
                  {testResults.results.skipped.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* SMS results */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <PhoneIcon size={14} /> SMS Delivery
                <span className="text-xs font-normal text-gray-500">
                  ({testResults.results.sms.length} recipient
                  {testResults.results.sms.length === 1 ? '' : 's'})
                </span>
              </h4>
              {testResults.results.sms.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No SMS recipients.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Phone</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {testResults.results.sms.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                          <td className="px-3 py-2 font-mono text-gray-700">{r.to}</td>
                          <td className="px-3 py-2">
                            {r.ok ? (
                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1 font-medium">
                                <CheckCircleIcon size={12} /> Delivered
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1 font-medium">
                                <XCircleIcon size={12} /> Failed
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            HTTP {r.status}
                            {r.error && (
                              <span className="block text-red-600 mt-0.5 break-all">
                                {r.error.slice(0, 200)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Email results */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <MailIcon size={14} /> Email Delivery
              </h4>
              {!testResults.results.email ? (
                <p className="text-xs text-gray-500 italic">No email recipients or channel skipped.</p>
              ) : (
                <div className="rounded-lg border p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    {testResults.results.email.ok ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1 text-xs font-medium">
                        <CheckCircleIcon size={12} /> Sent
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1 text-xs font-medium">
                        <XCircleIcon size={12} /> Failed
                      </span>
                    )}
                    <span className="text-xs text-gray-600">
                      HTTP {testResults.results.email.status}
                    </span>
                  </div>
                  {testResults.results.email.error && (
                    <p className="text-xs text-red-600 mb-2 break-all">
                      {testResults.results.email.error.slice(0, 300)}
                    </p>
                  )}
                  <p className="text-xs text-gray-700 font-medium mb-1">
                    Recipients ({testResults.results.email.recipients.length}):
                  </p>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    {testResults.results.email.recipients.map((r, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="font-mono text-gray-500">&lt;{r.to}&gt;</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {form.id ? 'Edit Contact' : 'Add New Contact'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone (E.164, e.g. +18435551234)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="oncall@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Active (on-call)</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.notify_sms}
                onChange={(e) => setForm({ ...form, notify_sms: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Send SMS alerts</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={form.notify_email}
                onChange={(e) => setForm({ ...form, notify_email: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Send email alerts</span>
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={isSaving}
              className="px-5 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Contact'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={isSaving}
              className="px-5 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contacts list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshIcon className="animate-spin text-gray-400" size={28} />
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangleIcon className="mx-auto text-amber-500 mb-3" size={36} />
            <p className="text-gray-700 font-medium">No on-call contacts yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add at least one contact so 911 alerts can be delivered.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Channels</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserIcon size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {c.phone ? (
                        <span className="flex items-center gap-1.5">
                          <PhoneIcon size={14} className="text-gray-400" /> {c.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {c.email ? (
                        <span className="flex items-center gap-1.5">
                          <MailIcon size={14} className="text-gray-400" /> {c.email}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                            c.notify_sms && c.phone
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <PhoneIcon size={12} /> SMS
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                            c.notify_email && c.email
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <MailIcon size={12} /> Email
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.is_active ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                          <CheckCircleIcon size={12} /> Active
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1 w-fit">
                          <XCircleIcon size={12} /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => sendRowTest(c)}
                            disabled={!c.is_active || rowTests[c.id]?.sending}
                            className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            title={
                              !c.is_active
                                ? 'Enable this contact first to run a test'
                                : 'Send a test alert to only this contact'
                            }
                          >
                            {rowTests[c.id]?.sending ? (
                              <>
                                <RefreshIcon size={11} className="animate-spin" /> Testing…
                              </>
                            ) : (
                              <>Test</>
                            )}
                          </button>
                          <button
                            onClick={() => toggleActive(c)}
                            className={`px-3 py-1.5 text-xs rounded-lg border ${
                              c.is_active
                                ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                                : 'text-green-700 border-green-200 hover:bg-green-50'
                            }`}
                          >
                            {c.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => startEdit(c)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(c)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                        {rowTests[c.id] && !rowTests[c.id].sending && (
                          <div
                            className="flex items-center gap-1 flex-wrap justify-end"
                            title={
                              rowTests[c.id].error ||
                              `Last test: ${
                                rowTests[c.id].at
                                  ? new Date(rowTests[c.id].at as string).toLocaleString()
                                  : ''
                              }`
                            }
                          >
                            {renderRowStatusPill('SMS', rowTests[c.id].sms)}
                            {renderRowStatusPill('Email', rowTests[c.id].email)}
                          </div>
                        )}
                        {rowTests[c.id]?.sending && (
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {renderRowStatusPill('SMS', 'pending')}
                            {renderRowStatusPill('Email', 'pending')}
                          </div>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEmergencyContacts;
