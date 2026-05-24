import React, { useMemo, useState, useEffect } from 'react';
import {
  RefreshIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
} from '@/components/ui/Icons';

export interface ContactOption {
  id: string;
  name: string;
  role: string | null;
}

export interface ProposedTemplate {
  contact_id: string;
  weekday: number;
  start_time: string; // 'HH:MM:SS'
  end_time: string; // 'HH:MM:SS'
  role: string;
  timezone: string;
  active: true;
  notes: string | null;
}

export interface GapForCover {
  id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number | null;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Derive {weekday, start_time, end_time} for a given gap window in the
 * supplied IANA timezone. Falls back to UTC fields if the tz is invalid.
 *
 * The resulting weekday/start/end define the template's recurring slot
 * IN THAT TIMEZONE — i.e. what an admin reading the schedule would
 * intuitively expect ("Tuesday 02:00–06:00 America/New_York").
 */
export function deriveTemplateFromGap(
  gap: { starts_at: string; ends_at: string },
  timezone: string,
): { weekday: number; start_time: string; end_time: string } {
  const startDate = new Date(gap.starts_at);
  const endDate = new Date(gap.ends_at);

  let tz = timezone;
  // Validate tz; if Intl rejects it, fall back to UTC.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partsFor = (d: Date) => {
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const wkShort = get('weekday'); // e.g. 'Tue'
    const wkIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wkShort);
    let hour = get('hour');
    // Some locales render midnight as '24' under hour12:false; normalize.
    if (hour === '24') hour = '00';
    const minute = get('minute');
    const second = get('second') || '00';
    return {
      weekday: wkIdx >= 0 ? wkIdx : d.getUTCDay(),
      time: `${pad2(Number(hour))}:${pad2(Number(minute))}:${pad2(Number(second))}`,
    };
  };

  const sp = partsFor(startDate);
  const ep = partsFor(endDate);
  return {
    weekday: sp.weekday,
    start_time: sp.time,
    end_time: ep.time,
  };
}

const AutoCoverGapModal: React.FC<{
  gap: GapForCover;
  digestId: string;
  contacts: ContactOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (proposed: ProposedTemplate) => void;
}> = ({ gap, digestId, contacts, isSubmitting, onClose, onConfirm }) => {
  const browserTz =
    (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

  const [contactId, setContactId] = useState<string>(contacts[0]?.id || '');
  const [role, setRole] = useState<string>(contacts[0]?.role || 'on_call');
  const [timezone, setTimezone] = useState<string>(browserTz);
  const [notes, setNotes] = useState<string>(
    `Auto-created from coverage-gap digest ${digestId.slice(0, 8)}…`,
  );

  // When the contact changes, default the role to that contact's role (if any).
  useEffect(() => {
    const c = contacts.find((x) => x.id === contactId);
    if (c?.role && c.role.trim().length > 0) {
      setRole(c.role);
    }
  }, [contactId, contacts]);

  const derived = useMemo(
    () => deriveTemplateFromGap(gap, timezone),
    [gap, timezone],
  );

  const [weekday, setWeekday] = useState<number>(derived.weekday);
  const [startTime, setStartTime] = useState<string>(derived.start_time.slice(0, 5));
  const [endTime, setEndTime] = useState<string>(derived.end_time.slice(0, 5));

  // Keep the editable fields synced when the user changes timezone (the
  // derived values shift). They can still override after.
  useEffect(() => {
    setWeekday(derived.weekday);
    setStartTime(derived.start_time.slice(0, 5));
    setEndTime(derived.end_time.slice(0, 5));
  }, [derived]);

  const canSubmit =
    !!contactId &&
    role.trim().length > 0 &&
    timezone.trim().length > 0 &&
    /^\d{2}:\d{2}$/.test(startTime) &&
    /^\d{2}:\d{2}$/.test(endTime) &&
    !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({
      contact_id: contactId,
      weekday,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      role: role.trim(),
      timezone: timezone.trim(),
      active: true,
      notes: notes.trim() || null,
    });
  };

  const fmtGapWindow = () => {
    try {
      const opt: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone,
        timeZoneName: 'short',
      };
      return `${new Date(gap.starts_at).toLocaleString(undefined, opt)} → ${new Date(
        gap.ends_at,
      ).toLocaleString(undefined, opt)}`;
    } catch {
      return `${gap.starts_at} → ${gap.ends_at}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Auto-cover this gap</h3>
            <p className="text-xs text-gray-500">
              Insert a recurring on-call shift template that covers the uncovered window.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
            aria-label="Close"
          >
            <XCircleIcon size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {contacts.length === 0 ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangleIcon size={16} className="mt-0.5" />
              <div>
                <p className="font-medium">No active emergency contacts found.</p>
                <p className="mt-1 text-xs">
                  Add at least one active contact under the Contacts tab before auto-creating
                  templates.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <p className="font-medium flex items-center gap-1">
                <ClockIcon size={14} /> Original gap window
              </p>
              <p className="mt-1 text-xs font-mono">{fmtGapWindow()}</p>
              <p className="mt-1 text-xs text-amber-700">
                Duration: {gap.duration_minutes ?? '—'} minutes
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned contact
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                disabled={contacts.length === 0}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              >
                {contacts.length === 0 && <option value="">— no contacts —</option>}
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? ` · ${c.role}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="on_call"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Weekday + start/end derive from the gap window in this tz.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weekday</label>
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">What happens next</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                A new <span className="font-mono">admin_oncall_shift_templates</span> row is
                inserted with <span className="font-mono">active=true</span>.
              </li>
              <li>
                Any gaps in this digest that the new template now covers are marked{' '}
                <span className="font-mono">resolved=true</span>.
              </li>
              <li>
                <span className="font-mono">detect-oncall-coverage-gaps</span> is re-run to
                refresh the unresolved-gap inventory.
              </li>
              <li>
                An audit row is written to{' '}
                <span className="font-mono">admin_oncall_escalation_log</span> with{' '}
                <span className="font-mono">resolved_by_template_id</span> set.
              </li>
            </ol>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <RefreshIcon size={14} className="animate-spin" />
            ) : (
              <CheckCircleIcon size={14} />
            )}
            Create template &amp; resolve
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoCoverGapModal;
