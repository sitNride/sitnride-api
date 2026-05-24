import React, { useEffect, useMemo, useState } from 'react';
import { database as supabase } from '@/lib/database';
import {
  RefreshIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, UserIcon,
} from '@/components/ui/Icons';
import AdminOncallTemplates from './AdminOncallTemplates';
import { useAdminTab } from '@/contexts/AdminTabContext';

type SubTab = 'calendar' | 'recurring';


interface AdminContact {
  id: string;
  name: string;
  is_active: boolean;
}

interface OncallShift {
  id: string;
  contact_id: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  role: string;
  notes: string | null;
}

interface ShiftFormState {
  id: string; // empty when creating
  contact_id: string;
  starts_at: string; // datetime-local value (no timezone)
  ends_at: string;   // datetime-local value
  role: string;
  notes: string;
}

const ROLE_OPTIONS = ['primary', 'secondary', 'backup'] as const;

const roleStyle = (role: string) => {
  switch (role) {
    case 'primary':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'secondary':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'backup':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// Week helpers (week starts Monday).
const startOfWeek = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  out.setDate(out.getDate() + diff);
  return out;
};
const addDays = (d: Date, n: number): Date => {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
};
const fmtDayHeader = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// Convert ISO string -> the value format <input type="datetime-local"> wants
// (YYYY-MM-DDTHH:MM in local time, with no timezone).
const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// Convert datetime-local input back to ISO (treats input as local time).
const fromLocalInput = (v: string): string => new Date(v).toISOString();

const emptyForm = (defaultStart?: Date): ShiftFormState => {
  const start = defaultStart ?? new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 8);
  return {
    id: '',
    contact_id: '',
    starts_at: toLocalInput(start.toISOString()),
    ends_at: toLocalInput(end.toISOString()),
    role: 'primary',
    notes: '',
  };
};

const AdminOncallShifts: React.FC = () => {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [shifts, setShifts] = useState<OncallShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ShiftFormState>(() => emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('calendar');
  const [, setTick] = useState(0); // re-render to keep "now active" fresh

  // When another admin component (e.g. the Notification Log's
  // "auto-resolved by template …" badge) deep-links here with a
  // template_id focus param, force the Recurring sub-tab to be visible
  // so AdminOncallTemplates can scroll/highlight the matching row.
  const { tabParams } = useAdminTab();
  useEffect(() => {
    if (tabParams.template_id) setSubTab('recurring');
  }, [tabParams.template_id]);

  // Re-render every minute so "Now Active" stays accurate.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);


  const load = async () => {
    setIsLoading(true);
    setError(null);

    const [contactsRes, shiftsRes] = await Promise.all([
      supabase
        .from('admin_emergency_contacts')
        .select('id,name,is_active')
        .order('name', { ascending: true }),
      supabase
        .from('admin_oncall_shifts')
        .select('id,contact_id,starts_at,ends_at,role,notes')
        .order('starts_at', { ascending: true }),
    ]);

    if (contactsRes.error) setError(contactsRes.error.message);
    else setContacts((contactsRes.data || []) as AdminContact[]);

    if (shiftsRes.error) setError(shiftsRes.error.message);
    else setShifts((shiftsRes.data || []) as OncallShift[]);

    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const contactName = (id: string) =>
    contacts.find((c) => c.id === id)?.name ?? '(deleted contact)';

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Bucket shifts by day index; a shift that spans multiple days appears in each.
  const shiftsByDay = useMemo(() => {
    const buckets: OncallShift[][] = Array.from({ length: 7 }, () => []);
    for (const s of shifts) {
      const sStart = new Date(s.starts_at).getTime();
      const sEnd = new Date(s.ends_at).getTime();
      for (let i = 0; i < 7; i++) {
        const dayStart = weekDays[i].getTime();
        const dayEnd = addDays(weekDays[i], 1).getTime();
        if (sStart < dayEnd && sEnd > dayStart) {
          buckets[i].push(s);
        }
      }
    }
    return buckets;
  }, [shifts, weekDays]);

  const now = Date.now();
  const activeNow = useMemo(
    () =>
      shifts.filter((s) => {
        const a = new Date(s.starts_at).getTime();
        const b = new Date(s.ends_at).getTime();
        return a <= now && now <= b;
      }),
    [shifts, now],
  );

  const goPrev = () => setWeekStart((w) => addDays(w, -7));
  const goNext = () => setWeekStart((w) => addDays(w, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const startNew = (defaultStart?: Date) => {
    setForm(emptyForm(defaultStart));
    setShowForm(true);
  };

  const startEdit = (s: OncallShift) => {
    setForm({
      id: s.id,
      contact_id: s.contact_id,
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
      role: s.role,
      notes: s.notes || '',
    });
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setForm(emptyForm());
  };

  const save = async () => {
    setError(null);
    if (!form.contact_id) {
      setError('Choose a contact for this shift.');
      return;
    }
    if (!form.starts_at || !form.ends_at) {
      setError('Both start and end times are required.');
      return;
    }
    const startsIso = fromLocalInput(form.starts_at);
    const endsIso = fromLocalInput(form.ends_at);
    if (new Date(endsIso).getTime() <= new Date(startsIso).getTime()) {
      setError('End time must be after start time.');
      return;
    }

    setIsSaving(true);
    const payload = {
      contact_id: form.contact_id,
      starts_at: startsIso,
      ends_at: endsIso,
      role: form.role,
      notes: form.notes.trim() || null,
    };

    if (form.id) {
      const { error: upErr } = await supabase
        .from('admin_oncall_shifts')
        .update(payload)
        .eq('id', form.id);
      if (upErr) {
        setError(upErr.message);
        setIsSaving(false);
        return;
      }
    } else {
      const { error: insErr } = await supabase
        .from('admin_oncall_shifts')
        .insert(payload);
      if (insErr) {
        setError(insErr.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    setShowForm(false);
    setForm(emptyForm());
    load();
  };

  const remove = async (s: OncallShift) => {
    if (
      !window.confirm(
        `Delete this ${s.role} shift for "${contactName(s.contact_id)}"?`,
      )
    )
      return;
    const { error: delErr } = await supabase
      .from('admin_oncall_shifts')
      .delete()
      .eq('id', s.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setShifts((prev) => prev.filter((row) => row.id !== s.id));
  };

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekDays[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">On-Call Shift Schedule</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Assign which on-call contact is <strong>primary</strong> at any given time. When a 911
            alert fires, the notifier targets only contacts whose shift overlaps the current moment
            (with optional fallback to all active contacts when no shift is in progress).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshIcon size={16} /> Refresh
          </button>
          {subTab === 'calendar' && (
            <button
              onClick={() => startNew()}
              className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
            >
              + Add Shift
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setSubTab('calendar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            subTab === 'calendar'
              ? 'border-orange-600 text-orange-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setSubTab('recurring')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            subTab === 'recurring'
              ? 'border-orange-600 text-orange-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Recurring
        </button>
      </div>

      {subTab === 'recurring' ? (
        <AdminOncallTemplates onMaterialized={load} />
      ) : (
      <>


      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangleIcon size={18} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* "Now Active" banner */}
      <div
        className={`rounded-2xl border p-4 ${
          activeNow.length > 0
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}
      >
        <div className="flex items-start gap-3">
          {activeNow.length > 0 ? (
            <CheckCircleIcon className="text-green-600 mt-0.5" size={20} />
          ) : (
            <AlertTriangleIcon className="text-amber-600 mt-0.5" size={20} />
          )}
          <div className="flex-1">
            <p
              className={`font-semibold ${
                activeNow.length > 0 ? 'text-green-800' : 'text-amber-800'
              }`}
            >
              {activeNow.length > 0
                ? `${activeNow.length} contact${activeNow.length === 1 ? '' : 's'} currently on shift`
                : 'No on-call shift is currently in progress'}
            </p>
            {activeNow.length > 0 ? (
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {activeNow.map((s) => (
                  <li
                    key={s.id}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 ${roleStyle(
                      s.role,
                    )}`}
                  >
                    <UserIcon size={12} />
                    <span>{contactName(s.contact_id)}</span>
                    <span className="opacity-70">· {s.role}</span>
                    <span className="opacity-70">
                      · until {fmtTime(s.ends_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-amber-800 mt-1">
                Alerts will fall back to <strong>all active contacts</strong> unless the caller
                disables fallback. Add a shift below to put a specific admin on call.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
          >
            ← Prev
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
        <p className="text-sm font-semibold text-gray-700">{weekLabel}</p>
      </div>

      {/* Weekly calendar grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshIcon className="animate-spin text-gray-400" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const isToday = (() => {
              const t = new Date();
              return (
                t.getFullYear() === d.getFullYear() &&
                t.getMonth() === d.getMonth() &&
                t.getDate() === d.getDate()
              );
            })();
            const dayShifts = shiftsByDay[i];
            return (
              <div
                key={i}
                className={`bg-white rounded-xl border ${
                  isToday ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'
                } overflow-hidden flex flex-col`}
              >
                <div
                  className={`px-3 py-2 text-xs font-semibold flex items-center justify-between ${
                    isToday ? 'bg-orange-50 text-orange-800' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{fmtDayHeader(d)}</span>
                  <button
                    onClick={() => startNew(new Date(d))}
                    className="text-orange-600 hover:text-orange-700"
                    title="Add shift on this day"
                  >
                    +
                  </button>
                </div>
                <div className="p-2 space-y-1.5 min-h-[120px]">
                  {dayShifts.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic px-1 py-2">No shifts</p>
                  ) : (
                    dayShifts.map((s) => {
                      const isActive =
                        new Date(s.starts_at).getTime() <= now &&
                        now <= new Date(s.ends_at).getTime();
                      return (
                        <div
                          key={s.id}
                          className={`rounded-lg border p-2 text-xs ${roleStyle(s.role)} ${
                            isActive ? 'ring-2 ring-green-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold truncate">
                              {contactName(s.contact_id)}
                            </span>
                            {isActive && (
                              <span className="text-[10px] bg-green-600 text-white rounded-full px-1.5 py-0.5 font-bold">
                                LIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5">
                            {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide opacity-70 mt-0.5">
                            {s.role}
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            <button
                              onClick={() => startEdit(s)}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-white/70 hover:bg-white border border-current/30"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => remove(s)}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-white/70 hover:bg-white border border-current/30 text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {form.id ? 'Edit Shift' : 'Add On-Call Shift'}
              </h3>
              <button
                onClick={cancel}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <XCircleIcon size={22} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact
                </label>
                <select
                  value={form.contact_id}
                  onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">— Select an admin contact —</option>
                  {contacts
                    .filter((c) => c.is_active || c.id === form.contact_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {!c.is_active ? ' (inactive)' : ''}
                      </option>
                    ))}
                </select>
                {contacts.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    No on-call contacts configured yet. Add one in the “On-Call Contacts” tab first.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Starts at
                  </label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ends at
                  </label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. weekend coverage, holiday primary…"
                />
              </div>
            </div>
            <div className="p-5 border-t bg-gray-50 flex gap-2 justify-end">
              <button
                onClick={cancel}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={isSaving}
                className="px-5 py-2 text-sm bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default AdminOncallShifts;

