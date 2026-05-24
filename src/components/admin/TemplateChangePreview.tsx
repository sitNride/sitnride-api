import React, { useEffect, useMemo, useState } from 'react';
import { database as supabase } from '@/lib/database';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshIcon,
  ClockIcon,
} from '@/components/ui/Icons';
import { useAdminTab } from '@/contexts/AdminTabContext';

/**
 * Live preview of how editing a recurring on-call template would affect the
 * already-materialized `admin_oncall_shifts` over the next 4 weeks, surfaced
 * inline inside the edit modal when the admin landed on the template via the
 * Notification Log "auto-resolved by template …" deep-link.
 *
 * We compute three classes of warnings:
 *   (1) OVERLAP        — a proposed new shift overlaps an existing shift from
 *                        a *different* template (potential double-booking).
 *   (2) UNCOVERED      — a shift currently materialized from this template
 *                        would no longer be produced under the new form
 *                        values (e.g. weekday swap leaves Mon uncovered).
 *   (3) INVALIDATED    — past escalations that were auto-resolved by this
 *                        template; their resolution claim is questionable
 *                        because the template definition has shifted under
 *                        them.
 *
 * Each affected date links back into the Shift Schedule view so admins can
 * inspect the conflict before saving.
 */

const PREVIEW_DAYS = 28;

interface Template {
  id: string;
  contact_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  role: string;
  timezone: string;
  active: boolean;
  notes: string | null;
}

interface FormValues {
  contact_id: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  role: string;
  timezone: string;
  active: boolean;
}

interface ExistingShift {
  id: string;
  contact_id: string;
  starts_at: string;
  ends_at: string;
  role: string;
  source_template_id: string | null;
}

interface EscalationRow {
  id: string;
  status: string;
  triggered_at: string;
  unresolved_gap_count: number | null;
  contact_name: string | null;
  tier: string;
}

interface OverlapWarning {
  proposedStart: string;
  proposedEnd: string;
  conflictWith: ExistingShift;
}

interface UncoveredWarning {
  shift: ExistingShift;
  reason: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const trimSeconds = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

/** Convert a wall-clock (y, m, d, hh, mm) in the given IANA tz to a UTC ms
 *  instant, correctly handling DST. */
const utcMsFromLocal = (
  year: number,
  month: number, // 1-12
  day: number,
  hh: number,
  mm: number,
  tz: string,
): number => {
  // First guess: treat the local wall-clock as if it were UTC.
  const utcGuess = Date.UTC(year, month - 1, day, hh, mm);
  // Ask the engine: when that UTC instant is rendered in `tz`, what local
  // wall-clock does it display? The delta between that wall-clock and our
  // intended wall-clock is the tz offset at this instant.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcGuess));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  const tzY = get('year');
  const tzMo = get('month');
  const tzD = get('day');
  let tzH = get('hour');
  if (tzH === 24) tzH = 0;
  const tzMi = get('minute');
  const observedAsUtc = Date.UTC(tzY, tzMo - 1, tzD, tzH, tzMi);
  const offsetMs = observedAsUtc - utcGuess;
  return utcGuess - offsetMs;
};

/** Compute (year, month, day, weekday) for a UTC instant, evaluated in `tz`. */
const localPartsAt = (utcMs: number, tz: string) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    weekday: wdMap[get('weekday')] ?? 0,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
};

/** Generate every (starts_at, ends_at) occurrence the form would materialize
 *  over the next `days` days. */
const generateProposedOccurrences = (
  form: FormValues,
  days: number,
): Array<{ starts_at: string; ends_at: string; dateKey: string; weekday: number }> => {
  if (!form.active) return [];
  const [sH, sM] = form.start_time.split(':').map((n) => parseInt(n, 10));
  const [eH, eM] = form.end_time.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(sH) || Number.isNaN(eH)) return [];
  const out: Array<{ starts_at: string; ends_at: string; dateKey: string; weekday: number }> = [];
  const now = Date.now();
  const wdSet = new Set(form.weekdays);
  for (let i = 0; i < days; i++) {
    const probe = now + i * 24 * 3600 * 1000;
    const lp = localPartsAt(probe, form.timezone);
    if (!wdSet.has(lp.weekday)) continue;
    const startMs = utcMsFromLocal(lp.year, lp.month, lp.day, sH, sM, form.timezone);
    const endMs = utcMsFromLocal(lp.year, lp.month, lp.day, eH, eM, form.timezone);
    // Skip occurrences fully in the past.
    if (endMs < now) continue;
    out.push({
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(endMs).toISOString(),
      dateKey: lp.dateKey,
      weekday: lp.weekday,
    });
  }
  return out;
};

const fmtLocal = (iso: string, tz: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
};

interface Props {
  /** The original template being edited. Required — preview only runs on edit. */
  template: Template;
  /** Live form values (re-runs whenever they change). */
  form: FormValues;
}

const TemplateChangePreview: React.FC<Props> = ({ template, form }) => {
  const { goToTab } = useAdminTab();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thisTemplateShifts, setThisTemplateShifts] = useState<ExistingShift[]>([]);
  const [otherShifts, setOtherShifts] = useState<ExistingShift[]>([]);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);

  // Fetch the next-28-day window of shifts + acknowledged escalations resolved
  // by this template. We refetch only when the template id changes — form
  // edits never trigger a network call.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      const nowIso = new Date().toISOString();
      const horizonIso = new Date(Date.now() + PREVIEW_DAYS * 24 * 3600 * 1000).toISOString();

      const [shiftsRes, escRes] = await Promise.all([
        supabase
          .from('admin_oncall_shifts')
          .select('id,contact_id,starts_at,ends_at,role,source_template_id')
          .gte('ends_at', nowIso)
          .lte('starts_at', horizonIso)
          .order('starts_at', { ascending: true }),
        supabase
          .from('admin_oncall_escalation_log')
          .select('id,status,triggered_at,unresolved_gap_count,contact_name,tier')
          .eq('resolved_by_template_id', template.id)
          .order('triggered_at', { ascending: false })
          .limit(25),
      ]);

      if (cancelled) return;

      if (shiftsRes.error) {
        setError(shiftsRes.error.message);
      } else {
        const all = (shiftsRes.data || []) as ExistingShift[];
        setThisTemplateShifts(all.filter((s) => s.source_template_id === template.id));
        setOtherShifts(all.filter((s) => s.source_template_id !== template.id));
      }
      if (escRes.error) {
        // Non-fatal — just skip the escalations panel.
        console.warn('[TemplateChangePreview] escalation fetch failed:', escRes.error.message);
        setEscalations([]);
      } else {
        setEscalations((escRes.data || []) as EscalationRow[]);
      }
      setIsLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [template.id]);

  // Compute proposed shifts the new form would produce over the same window.
  const proposed = useMemo(
    () => generateProposedOccurrences(form, PREVIEW_DAYS),
    [form.weekdays, form.start_time, form.end_time, form.timezone, form.active],
  );

  // (1) Overlap with shifts from OTHER templates.
  const overlaps = useMemo<OverlapWarning[]>(() => {
    const warns: OverlapWarning[] = [];
    for (const p of proposed) {
      const pStart = new Date(p.starts_at).getTime();
      const pEnd = new Date(p.ends_at).getTime();
      for (const s of otherShifts) {
        const sStart = new Date(s.starts_at).getTime();
        const sEnd = new Date(s.ends_at).getTime();
        if (pStart < sEnd && pEnd > sStart) {
          warns.push({ proposedStart: p.starts_at, proposedEnd: p.ends_at, conflictWith: s });
        }
      }
    }
    return warns;
  }, [proposed, otherShifts]);

  // (2) Existing shifts from THIS template that the new form no longer
  //     produces — i.e. previously-covered windows that would go uncovered if
  //     the new params were applied (modulo whatever the next materialization
  //     run does).
  const uncovered = useMemo<UncoveredWarning[]>(() => {
    const warns: UncoveredWarning[] = [];
    // Build a quick set of "would-produce" keys: weekday|HH:MM|HH:MM|tz|contact|role.
    // We instead check structurally: weekday, contact, role, time bounds.
    const wdSet = new Set(form.weekdays);
    for (const s of thisTemplateShifts) {
      const lp = localPartsAt(new Date(s.starts_at).getTime(), template.timezone);
      const reasons: string[] = [];
      if (!form.active) reasons.push('template paused');
      if (form.contact_id !== s.contact_id) reasons.push('contact changed');
      if (form.role !== s.role) reasons.push(`role ${s.role} → ${form.role}`);
      if (!wdSet.has(lp.weekday)) reasons.push(`${WEEKDAYS[lp.weekday]} no longer in weekdays`);
      // Time-window mismatch: same calendar day, but new HH:MM differ from
      // shift's local HH:MM.
      const shiftStartHHMM = new Date(s.starts_at).toLocaleTimeString('en-GB', {
        timeZone: form.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
      });
      const shiftEndHHMM = new Date(s.ends_at).toLocaleTimeString('en-GB', {
        timeZone: form.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
      });
      if (form.start_time !== shiftStartHHMM || form.end_time !== shiftEndHHMM) {
        if (reasons.length === 0) {
          reasons.push(`hours ${shiftStartHHMM}–${shiftEndHHMM} → ${form.start_time}–${form.end_time}`);
        }
      }
      if (reasons.length > 0) {
        warns.push({ shift: s, reason: reasons.join(', ') });
      }
    }
    return warns;
  }, [thisTemplateShifts, form, template.timezone]);

  // (3) Acknowledged escalations whose resolution claim becomes questionable.
  //     We surface escalations resolved-by this template if the form changes
  //     contact_id, role, or weekday (those are the dimensions that matter
  //     for whether the originally-resolved gap would still have been covered).
  const definitionDrift = useMemo(() => {
    const drift: string[] = [];
    if (form.contact_id !== template.contact_id) drift.push('contact');
    if (form.role !== template.role) drift.push('role');
    if (!form.weekdays.includes(template.weekday)) drift.push('weekday');
    if (form.start_time !== trimSeconds(template.start_time)) drift.push('start time');
    if (form.end_time !== trimSeconds(template.end_time)) drift.push('end time');
    if (form.timezone !== template.timezone) drift.push('timezone');
    if (form.active !== template.active) drift.push('active flag');
    return drift;
  }, [form, template]);

  const invalidatedEscalations = definitionDrift.length > 0 ? escalations : [];

  const totalWarnings = overlaps.length + uncovered.length + invalidatedEscalations.length;

  const goToShiftSchedule = (templateId?: string) => {
    goToTab('schedule', templateId ? { template_id: templateId } : {});
  };

  if (isLoading) {
    return (
      <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
        <RefreshIcon className="animate-spin" size={14} />
        Checking next {PREVIEW_DAYS} days for conflicts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
        Couldn&rsquo;t run live preview: {error}
      </div>
    );
  }

  if (totalWarnings === 0) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 flex items-start gap-2 text-sm">
        <CheckCircleIcon className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
        <div className="text-emerald-900">
          <p className="font-semibold">No conflicts in the next {PREVIEW_DAYS} days</p>
          <p className="text-xs text-emerald-800/80 mt-0.5">
            Compared {proposed.length} proposed occurrence{proposed.length === 1 ? '' : 's'} against{' '}
            {thisTemplateShifts.length + otherShifts.length} materialized shift
            {thisTemplateShifts.length + otherShifts.length === 1 ? '' : 's'}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-amber-300 bg-amber-50 rounded-lg overflow-hidden text-sm">
      <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-start gap-2">
        <AlertTriangleIcon className="text-amber-700 flex-shrink-0 mt-0.5" size={16} />
        <div className="flex-1">
          <p className="font-semibold text-amber-900">
            {totalWarnings} potential issue{totalWarnings === 1 ? '' : 's'} in the next {PREVIEW_DAYS} days
          </p>
          <p className="text-xs text-amber-800/90 mt-0.5">
            Review before saving — affected dates link to the Shift Schedule.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {/* OVERLAPS */}
        {overlaps.length > 0 && (
          <div className="p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900 mb-1.5">
              Overlapping shifts ({overlaps.length})
            </p>
            <p className="text-xs text-amber-800/90 mb-2">
              The proposed schedule would create shifts that overlap shifts from other templates,
              causing double-booking.
            </p>
            <ul className="space-y-1">
              {overlaps.slice(0, 5).map((o, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2 py-1">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      <ClockIcon className="inline -mt-0.5" size={11} />{' '}
                      {fmtLocal(o.proposedStart, form.timezone)} – {fmtLocal(o.proposedEnd, form.timezone)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      conflicts with existing {o.conflictWith.role} shift
                      {o.conflictWith.source_template_id ? ' (other template)' : ' (one-off)'}
                    </div>
                  </div>
                  <button
                    onClick={() => goToShiftSchedule(o.conflictWith.source_template_id || undefined)}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-medium underline whitespace-nowrap"
                  >
                    View →
                  </button>
                </li>
              ))}
              {overlaps.length > 5 && (
                <li className="text-[11px] text-amber-700/80 italic px-2">
                  + {overlaps.length - 5} more overlap{overlaps.length - 5 === 1 ? '' : 's'}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* UNCOVERED */}
        {uncovered.length > 0 && (
          <div className="p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900 mb-1.5">
              Previously covered, now uncovered ({uncovered.length})
            </p>
            <p className="text-xs text-amber-800/90 mb-2">
              These shifts were materialized from this template but the new form values would no
              longer produce them.
            </p>
            <ul className="space-y-1">
              {uncovered.slice(0, 5).map((u) => (
                <li key={u.shift.id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2 py-1">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      <ClockIcon className="inline -mt-0.5" size={11} />{' '}
                      {fmtLocal(u.shift.starts_at, template.timezone)} – {fmtLocal(u.shift.ends_at, template.timezone)}
                    </div>
                    <div className="text-[10px] text-gray-500">{u.reason}</div>
                  </div>
                  <button
                    onClick={() => goToShiftSchedule(template.id)}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-medium underline whitespace-nowrap"
                  >
                    View →
                  </button>
                </li>
              ))}
              {uncovered.length > 5 && (
                <li className="text-[11px] text-amber-700/80 italic px-2">
                  + {uncovered.length - 5} more uncovered shift{uncovered.length - 5 === 1 ? '' : 's'}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* INVALIDATED ESCALATIONS */}
        {invalidatedEscalations.length > 0 && (
          <div className="p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900 mb-1.5">
              Past escalations resolved by this template ({invalidatedEscalations.length})
            </p>
            <p className="text-xs text-amber-800/90 mb-2">
              You&rsquo;re changing the {definitionDrift.join(', ')} — these acknowledged
              escalations were auto-resolved citing this template, and their audit trail will
              now diverge from the live definition.
            </p>
            <ul className="space-y-1">
              {invalidatedEscalations.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded px-2 py-1">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      Tier {e.tier} · {e.contact_name || 'unknown'}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {new Date(e.triggered_at).toLocaleString()}{' '}
                      {e.unresolved_gap_count != null && (
                        <>· {e.unresolved_gap_count} gap{e.unresolved_gap_count === 1 ? '' : 's'}</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => goToTab('notifications', { escalation_id: e.id })}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-medium underline whitespace-nowrap"
                  >
                    View →
                  </button>
                </li>
              ))}
              {invalidatedEscalations.length > 4 && (
                <li className="text-[11px] text-amber-700/80 italic px-2">
                  + {invalidatedEscalations.length - 4} more escalation
                  {invalidatedEscalations.length - 4 === 1 ? '' : 's'}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateChangePreview;
