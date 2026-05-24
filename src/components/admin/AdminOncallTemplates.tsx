import React, { useEffect, useMemo, useRef, useState } from 'react';
import { database as supabase } from '@/lib/database';
import {
  RefreshIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, ClockIcon, UserIcon,
} from '@/components/ui/Icons';
import { useAdminTab } from '@/contexts/AdminTabContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import TemplateChangePreview from './TemplateChangePreview';
import TemplateVersionHistoryDrawer from './TemplateVersionHistoryDrawer';



interface AdminContact {
  id: string;
  name: string;
  is_active: boolean;
}

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

interface TemplateForm {
  id: string;
  contact_id: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  role: string;
  timezone: string;
  active: boolean;
  notes: string;
}

interface PerTemplateEntry {
  template_id: string;
  contact_id: string;
  weekday: number;
  occurrences_planned: number;
  created: number;
  skipped_existing: number;
  errors: string[];
  preview: Array<{ starts_at: string; ends_at: string }>;
}

interface MaterializationRun {

  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error';
  triggered_by: 'manual' | 'cron' | 'auto' | 'api';
  weeks: number | null;
  template_count: number | null;
  total_created: number | null;
  total_skipped_existing: number | null;
  errors: string[] | null;
  per_template: PerTemplateEntry[] | null;
  dry_run: boolean;
  duration_ms: number | null;
}

interface CoverageGap {
  id?: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  weekday: number;
  scan_id?: string;
  resolved?: boolean;
}

interface GapScanMeta {
  scanned_at: string;
  days: number;
  shifts_considered: number;
  total_uncovered_minutes: number;
}

interface Suggestion {
  id?: string;
  pattern_key: string;
  weekday: number;
  start_time: string;     // HH:MM (browser tz)
  end_time: string;       // HH:MM (browser tz)
  timezone: string;
  gap_count: number;
  total_minutes: number;
  first_seen_at?: string;
  last_seen_at?: string;
  status: 'pending' | 'accepted' | 'dismissed';
}



const ROLE_OPTIONS = ['primary', 'secondary', 'backup'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'America/Phoenix',
  'Pacific/Honolulu',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

const AUTO_INTERVAL_HOURS = 168; // 7 days
const DEFAULT_WEEKS_AHEAD = 8;

const roleStyle = (role: string) => {
  switch (role) {
    case 'primary':   return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'secondary': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'backup':    return 'bg-purple-100 text-purple-700 border-purple-200';
    default:          return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const browserTz = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
};

const emptyForm = (): TemplateForm => ({
  id: '', contact_id: '', weekdays: [1],
  start_time: '09:00', end_time: '17:00',
  role: 'primary', timezone: browserTz(),
  active: true, notes: '',
});

const trimSeconds = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

const fmtPreview = (iso: string, tz: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: tz, weekday: 'short', month: 'short',
      day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return new Date(iso).toLocaleString(); }
};

const fmtRelative = (iso: string): string => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
};

const triggerLabel = (t: string) => {
  switch (t) {
    case 'manual': return 'Manual';
    case 'cron': return 'Scheduled';
    case 'auto': return 'Auto';
    case 'api': return 'API';
    default: return t;
  }
};

const triggerStyle = (t: string) => {
  switch (t) {
    case 'manual': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'cron':   return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'auto':   return 'bg-purple-100 text-purple-700 border-purple-200';
    default:       return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

// Toast action region for the post-save "Schedule refreshed" toast. Bundles
// two affordances inside a single ToastAction-shaped wrapper:
//   - "Undo (Ns)" — primary, time-boxed to the 60-second window. Disables
//     itself the moment the deadline passes so a stale click can't trigger
//     a no-op revert. Counts down visibly so admins know how long they have.
//   - "View Schedule" — secondary deep link into the Shift Schedule view.
// We render plain styled <button>s here (rather than two <ToastAction>s)
// because ToastAction is a Radix close-action that dismisses the toast on
// click; we want Undo to keep the toast around (replaced by a confirmation)
// and View to navigate without dismissing the toast prematurely.
const UndoAndViewActions: React.FC<{
  deadlineMs: number;
  onUndo: () => void;
  onView: () => void;
}> = ({ deadlineMs, onUndo, onView }) => {
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)),
  );
  const [isUndoing, setIsUndoing] = React.useState(false);

  React.useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  const expired = secondsLeft <= 0;

  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => {
          if (expired || isUndoing) return;
          setIsUndoing(true);
          onUndo();
        }}
        disabled={expired || isUndoing}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-3 text-xs font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={expired
          ? 'Undo window has expired'
          : 'Roll back the template + delete shifts created by this run'}
      >
        {isUndoing ? (
          <>
            <RefreshIcon className="animate-spin" size={12} />
            Undoing…
          </>
        ) : expired ? (
          'Undo expired'
        ) : (
          <>Undo this change <span className="tabular-nums opacity-70">({secondsLeft}s)</span></>
        )}
      </button>
      <button
        type="button"
        onClick={onView}
        className="inline-flex h-7 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-[11px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        View Schedule
      </button>
    </div>
  );
};

const AdminOncallTemplates: React.FC<{ onMaterialized?: () => void }> = ({ onMaterialized }) => {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  // When the edit modal was opened from the deep-link affordance, we want to
  // run a live preview against the next-4-week shift schedule and surface
  // overlap / uncovered-window / invalidated-escalation warnings inline. We
  // gate this on a separate state (rather than just `form.id`) so that
  // routine "Edit" clicks from the table still get the lean modal.
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  // After a deep-link save we kick off a non-dry-run materialization + gap
  // re-scan in the background. While that's running we keep the modal open
  // (well, we close it but track the ongoing work) and disable the Save
  // button so the admin gets visual feedback that "the schedule is being
  // refreshed for you" before the toast arrives.
  const [isRefreshingSchedule, setIsRefreshingSchedule] = useState(false);

  const [weeksAhead, setWeeksAhead] = useState(DEFAULT_WEEKS_AHEAD);
  const [isMaterializing, setIsMaterializing] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<MaterializationRun | null>(null);
  const [runs, setRuns] = useState<MaterializationRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [, forceTick] = useState(0);

  // Coverage-gap detection state
  const [gaps, setGaps] = useState<CoverageGap[]>([]);
  const [gapMeta, setGapMeta] = useState<GapScanMeta | null>(null);
  const [isScanningGaps, setIsScanningGaps] = useState(false);
  const [showAllGaps, setShowAllGaps] = useState(false);

  // Template-suggestion state (recurring patterns surfaced from gaps)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionContacts, setSuggestionContacts] = useState<Record<string, string>>({});
  const [isAcceptingSuggestion, setIsAcceptingSuggestion] = useState<string | null>(null);
  const [isCreatingAllSuggestions, setIsCreatingAllSuggestions] = useState(false);

  // Version-history drawer state. Set to a Template when the row's "History"
  // button is clicked; null while the drawer is closed. Drives <TemplateVersionHistoryDrawer>.
  const [historyTemplate, setHistoryTemplate] = useState<Template | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const heartbeatFiredRef = useRef(false);

  // Map of template_id -> table row element, populated via the ref callback on
  // each <tr> below. Used by the deep-link effect to scroll the right row into
  // view + flash a highlight ring when an admin clicks the
  // "auto-resolved by template …" badge in the Notification Log.
  const templateRowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const [highlightedTemplateId, setHighlightedTemplateId] = useState<string | null>(null);
  // Persistent "you landed here from a deep link" focus state. Unlike the
  // 3s ring flash above, this stays set until the admin clicks "Edit this
  // template" or explicitly dismisses the affordance — that way they have
  // unbounded time to react after the page settles.
  const [focusedTemplateId, setFocusedTemplateId] = useState<string | null>(null);

  // Subscribe to AdminTabContext so we can react to deep-link focus params
  // AND navigate back into the Shift Schedule view from the post-save toast.
  const { tabParams, clearTabParam, goToTab } = useAdminTab();
  const { toast } = useToast();

  // When tabParams.template_id is set (and the templates list has loaded),
  // scroll the matching row into view, flash an orange highlight ring for ~3s,
  // surface a sticky "Edit this template" affordance, and then clear the
  // tab param so re-renders don't re-trigger the scroll.
  useEffect(() => {
    const focusId = tabParams.template_id;
    if (!focusId || isLoading) return;
    if (!templates.some((t) => t.id === focusId)) return; // not in this list
    // Defer to the next paint so refs are populated for the just-rendered rows.
    const raf = window.requestAnimationFrame(() => {
      const node = templateRowRefs.current.get(focusId);
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setHighlightedTemplateId(focusId);
      setFocusedTemplateId(focusId);
    });
    const clearTimer = window.setTimeout(() => {
      // Fade the ring after 3s, but leave focusedTemplateId set so the
      // contextual "Edit this template" callout stays visible until the
      // admin acts on it.
      setHighlightedTemplateId(null);
      clearTabParam('template_id');
    }, 3000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(clearTimer);
    };
  }, [tabParams.template_id, templates, isLoading, clearTabParam]);



  const load = async () => {
    setIsLoading(true);
    setError(null);
    const [contactsRes, tmplRes, runsRes] = await Promise.all([
      supabase
        .from('admin_emergency_contacts')
        .select('id,name,is_active')
        .order('name', { ascending: true }),
      supabase
        .from('admin_oncall_shift_templates')
        .select('id,contact_id,weekday,start_time,end_time,role,timezone,active,notes')
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase
        .from('admin_oncall_materialization_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20),
    ]);
    if (contactsRes.error) setError(contactsRes.error.message);
    else setContacts((contactsRes.data || []) as AdminContact[]);
    if (tmplRes.error) setError(tmplRes.error.message);
    else setTemplates((tmplRes.data || []) as Template[]);
    if (!runsRes.error) setRuns((runsRes.data || []) as MaterializationRun[]);
    setIsLoading(false);
  };

  // Re-render every 30s so "X minutes ago" stays fresh.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => { load(); }, []);

  // Auto heartbeat: on first mount, fire-and-forget an "auto" call. The edge
  // function rate-limits itself (only runs if last success > 7d ago), so this
  // is safe to call every page load and gives us a poor-man's weekly cron.
  useEffect(() => {
    if (heartbeatFiredRef.current) return;
    heartbeatFiredRef.current = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('materialize-oncall-shifts', {
          body: {
            triggered_by: 'auto',
            weeks: DEFAULT_WEEKS_AHEAD,
            auto_min_interval_hours: AUTO_INTERVAL_HOURS,
          },
        });
        // If it actually ran (not skipped), refresh runs list + parent.
        if (data && !data.skipped) {
          load();
          if (onMaterialized) onMaterialized();
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the active run while one is in progress.
  useEffect(() => {
    if (!activeRunId) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    const tick = async () => {
      const { data, error: e } = await supabase
        .from('admin_oncall_materialization_runs')
        .select('*')
        .eq('id', activeRunId)
        .maybeSingle();
      if (e) return;
      if (data) {
        setActiveRun(data as MaterializationRun);
        if (data.status !== 'running') {
          // Final tick reached — stop polling and refresh history.
          setActiveRunId(null);
          setIsMaterializing(false);
          load();
          if (onMaterialized && !data.dry_run) onMaterialized();
        }
      }
    };
    tick();
    pollTimerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [activeRunId, onMaterialized]);

  const contactName = (id: string) =>
    contacts.find((c) => c.id === id)?.name ?? '(deleted contact)';

  const startNew = () => { setForm(emptyForm()); setShowForm(true); };

  const startEdit = (t: Template) => {
    setForm({
      id: t.id, contact_id: t.contact_id,
      weekdays: [t.weekday],
      start_time: trimSeconds(t.start_time),
      end_time: trimSeconds(t.end_time),
      role: t.role, timezone: t.timezone,
      active: t.active, notes: t.notes || '',
    });
    setShowForm(true);
  };

  const cancel = () => { setShowForm(false); setForm(emptyForm()); setPreviewTemplateId(null); };


  const toggleWeekday = (wd: number) => {
    setForm((prev) => {
      const has = prev.weekdays.includes(wd);
      return {
        ...prev,
        weekdays: has
          ? prev.weekdays.filter((x) => x !== wd)
          : [...prev.weekdays, wd].sort(),
      };
    });
  };

  // Helper: count currently-unresolved coverage gaps that fall inside the
  // post-save 4-week window. Used as a baseline so we can compute "Y new gaps
  // detected" after the materialize + re-scan completes.
  const countGapsIn4WeekWindow = async (): Promise<number> => {
    const horizonIso = new Date(Date.now() + 28 * 24 * 3600 * 1000).toISOString();
    const { count, error: e } = await supabase
      .from('admin_oncall_coverage_gaps')
      .select('id', { count: 'exact', head: true })
      .eq('resolved', false)
      .lt('starts_at', horizonIso);
    if (e) return 0;
    return count ?? 0;
  };

  // -- Undo affordance --
  // After a deep-linked save we surface a 60-second "Undo this change" button
  // on the post-save toast. Clicking it within the window:
  //   1. Reverts the template's contact_id/role/weekday/start_time/end_time/
  //      timezone (and active flag) back to the pre-edit snapshot.
  //   2. Deletes any rows from admin_oncall_shifts whose source_template_id
  //      matches AND whose starts_at is >= the run-start timestamp captured
  //      right before the post-save materialize fired — i.e. exactly the
  //      shifts the post-save run created (or would have created on top of
  //      the new config).
  //   3. Re-runs detect-oncall-coverage-gaps so the gap UI reflects the
  //      restored schedule.
  //   4. Re-materializes the now-restored original template so the next 4
  //      weeks aren't left sparse after step 2.
  // After 60s the button no-ops (and the local component disables it).
  const runUndoDeepLinkChange = async (
    original: Template,
    runStartIso: string,
    deadlineMs: number,
    dismissOriginalToast: () => void,
  ) => {
    if (Date.now() > deadlineMs) {
      toast({
        variant: 'destructive',
        title: 'Undo window expired',
        description: 'The 60-second undo window has passed. Edit the template manually to revert.',
      });
      return;
    }

    // 1. Revert template fields back to the snapshot.
    const { error: revErr } = await supabase
      .from('admin_oncall_shift_templates')
      .update({
        contact_id: original.contact_id,
        weekday: original.weekday,
        start_time: original.start_time,
        end_time: original.end_time,
        role: original.role,
        timezone: original.timezone,
        active: original.active,
      })
      .eq('id', original.id);
    if (revErr) {
      toast({
        variant: 'destructive',
        title: 'Undo failed',
        description: `Could not revert template: ${revErr.message}`,
      });
      return;
    }

    // 2. Delete shifts created (or persisted forward) by the post-save run.
    //    Scoped by source_template_id + starts_at >= runStartIso so we don't
    //    touch any historical shifts.
    const { error: delErr } = await supabase
      .from('admin_oncall_shifts')
      .delete()
      .eq('source_template_id', original.id)
      .gte('starts_at', runStartIso);
    if (delErr) {
      toast({
        variant: 'destructive',
        title: 'Undo partially failed',
        description: `Template reverted but shift cleanup errored: ${delErr.message}`,
      });
      // continue — don't bail, still re-scan + refresh below.
    }

    // 3. Re-materialize the restored template so the 4-week horizon refills
    //    with the original contact/role/time. Idempotent thanks to the unique
    //    index on (source_template_id, starts_at).
    let undoCreated = 0;
    try {
      const { data: matResult } = await supabase.functions.invoke(
        'materialize-oncall-shifts',
        {
          body: {
            template_id: original.id,
            weeks: 4,
            dry_run: false,
            triggered_by: 'manual',
          },
        },
      );
      if (matResult && typeof matResult.total_created === 'number') {
        undoCreated = matResult.total_created;
      }
    } catch { /* swallow — toast still confirms revert below */ }

    // 4. Re-scan coverage gaps and refresh local state.
    try {
      await supabase.functions.invoke(
        'detect-oncall-coverage-gaps',
        { body: { days: 28, min_gap_minutes: 60 } },
      );
      await loadGapsFromTable();
    } catch { /* ignore */ }

    // Refresh the templates list so the table shows the reverted values.
    await load();
    if (onMaterialized) onMaterialized();

    // Replace the original toast with a confirmation.
    dismissOriginalToast();
    toast({
      title: 'Change reverted',
      description: `Template restored to its pre-edit values · ${undoCreated} original shift${undoCreated === 1 ? '' : 's'} re-created.`,
      action: (
        <ToastAction
          altText="View shift schedule"
          onClick={() => goToTab('schedule', { template_id: original.id })}
        >
          View Shift Schedule
        </ToastAction>
      ),
    });
  };

  // After a deep-linked edit successfully saves, run a non-dry-run
  // materialize (scoped to this template — which is implicitly its single
  // weekday) for the next 4 weeks, then re-scan coverage gaps over the same
  // 28-day window, then surface a follow-up toast that links back into the
  // Shift Schedule view AND — for 60 seconds — offers an "Undo this change"
  // affordance that rolls the template back to its pre-edit snapshot.
  const runDeepLinkSchedulePostSave = async (
    templateId: string,
    preGapCount: number,
    originalSnapshot: Template,
  ) => {
    setIsRefreshingSchedule(true);
    // Capture run-start BEFORE the materialize call. The undo handler uses
    // this as the lower bound when deleting shifts so we only remove rows
    // newly created (or maintained forward) by THIS run.
    const runStartIso = new Date().toISOString();
    try {
      // 1. Targeted, idempotent materialization for the just-saved template,
      //    bounded to the next 4 weeks. The function's unique index on
      //    (source_template_id, starts_at) means re-creating already-existing
      //    occurrences is a no-op, so we only "create" the dates that the
      //    new contact/role/time actually uncover.
      const { data: matResult, error: matErr } = await supabase.functions.invoke(
        'materialize-oncall-shifts',
        {
          body: {
            template_id: templateId,
            weeks: 4,
            dry_run: false,
            triggered_by: 'manual',
          },
        },
      );
      const created = (matResult && typeof matResult.total_created === 'number')
        ? matResult.total_created
        : 0;
      const matErrorMsg = matErr?.message
        || (Array.isArray(matResult?.errors) && matResult.errors.length > 0
              ? String(matResult.errors[0])
              : null);

      // 2. Re-scan coverage gaps over the 4-week window so we can detect any
      //    new uncovered windows the change introduced (e.g. swapping the
      //    contact's role from primary→backup may leave a primary slot empty).
      let newGaps = 0;
      try {
        const { error: scanErr } = await supabase.functions.invoke(
          'detect-oncall-coverage-gaps',
          { body: { days: 28, min_gap_minutes: 60 } },
        );
        if (!scanErr) {
          const postCount = await countGapsIn4WeekWindow();
          newGaps = Math.max(0, postCount - preGapCount);
          // Refresh local gap UI state from the freshly-persisted rows.
          await loadGapsFromTable();
        }
      } catch { /* swallow — toast still fires with what we have */ }

      // 3. Toast: success or partial failure.
      if (matErrorMsg) {
        toast({
          variant: 'destructive',
          title: 'Schedule refresh failed',
          description: `Materialization error: ${matErrorMsg}. You may need to click "Run now" manually.`,
        });
      } else {
        const shiftsLabel = `${created} shift${created === 1 ? '' : 's'} re-created`;
        const gapsLabel = `${newGaps} new gap${newGaps === 1 ? '' : 's'} detected`;
        const deadlineMs = Date.now() + 60_000;
        // Capture the toast handle so the Undo flow can dismiss + replace
        // this toast with its confirmation message.
        const toastHandle = toast({
          title: 'Schedule refreshed',
          description: `${shiftsLabel}, ${gapsLabel} in the next 4 weeks.`,
          // Bundle two affordances inside a single wrapper element:
          //   - "Undo this change" (primary, time-boxed to 60s)
          //   - "View Schedule" (deep link)
          // We cast to `any` because ToastActionElement is typed as
          // ReactElement<typeof ToastAction>; our wrapper renders styled
          // buttons but TS doesn't see the structural equivalence at the
          // element-type level. Toaster.tsx just renders {action} verbatim
          // so the runtime behavior is unaffected.

          action: (
            <UndoAndViewActions
              deadlineMs={deadlineMs}
              onUndo={() => runUndoDeepLinkChange(
                originalSnapshot,
                runStartIso,
                deadlineMs,
                () => toastHandle.dismiss(),
              )}
              onView={() => goToTab('schedule', { template_id: templateId })}
            />
          ) as any,
        });
      }


      // 4. Refresh runs history so the orange "Last run" card updates.
      load();
      if (onMaterialized) onMaterialized();
    } finally {
      setIsRefreshingSchedule(false);
    }
  };


  const save = async () => {
    setError(null);
    if (!form.contact_id) return setError('Choose a contact for this template.');
    if (form.weekdays.length === 0) return setError('Pick at least one weekday.');
    if (!form.start_time || !form.end_time) return setError('Start and end times are required.');
    if (form.end_time <= form.start_time) return setError('End time must be after start time.');

    // Detect deep-link save BEFORE we wipe state below — drives the post-save
    // materialize + re-scan flow and the follow-up toast.
    const wasDeepLinkEdit = !!form.id && previewTemplateId === form.id;
    const savedTemplateId = form.id;
    // Capture the pre-edit snapshot so the post-save toast's "Undo this
    // change" affordance can revert contact_id/role/weekday/start_time/
    // end_time/timezone/active back to exactly these values within the
    // 60-second undo window. We do this BEFORE the supabase update runs
    // so we still have the old values in the local `templates` array.
    const originalSnapshot: Template | null = wasDeepLinkEdit
      ? (templates.find((t) => t.id === form.id) || null)
      : null;

    setIsSaving(true);
    if (form.id) {
      const { error: upErr } = await supabase
        .from('admin_oncall_shift_templates')
        .update({
          contact_id: form.contact_id,
          weekday: form.weekdays[0],
          start_time: form.start_time,
          end_time: form.end_time,
          role: form.role,
          timezone: form.timezone,
          active: form.active,
          notes: form.notes.trim() || null,
        })
        .eq('id', form.id);
      if (upErr) { setError(upErr.message); setIsSaving(false); return; }
    } else {
      const rows = form.weekdays.map((wd) => ({
        contact_id: form.contact_id,
        weekday: wd,
        start_time: form.start_time,
        end_time: form.end_time,
        role: form.role,
        timezone: form.timezone,
        active: form.active,
        notes: form.notes.trim() || null,
      }));
      const { error: insErr } = await supabase
        .from('admin_oncall_shift_templates')
        .insert(rows);
      if (insErr) { setError(insErr.message); setIsSaving(false); return; }
    }
    setIsSaving(false);
    setShowForm(false);
    setForm(emptyForm());
    setPreviewTemplateId(null);
    load();

    // Deep-link post-save flow: capture pre-baseline BEFORE materialize, then
    // kick off the targeted run + scan + toast in the background. We don't
    // await so the modal closes immediately and the admin gets a snappy UI.
    // The pre-edit snapshot (captured above) flows through so the toast's
    // 60-second "Undo this change" affordance can revert the template.
    if (wasDeepLinkEdit && savedTemplateId && originalSnapshot) {
      const preCount = await countGapsIn4WeekWindow();
      runDeepLinkSchedulePostSave(savedTemplateId, preCount, originalSnapshot);
    }
  };



  const remove = async (t: Template) => {
    if (!window.confirm(
      `Delete recurring ${t.role} shift for "${contactName(t.contact_id)}" on ${WEEKDAYS[t.weekday]}?\n\nFuture materialized shifts already in the calendar will NOT be removed automatically.`,
    )) return;
    const { error: delErr } = await supabase
      .from('admin_oncall_shift_templates')
      .delete()
      .eq('id', t.id);
    if (delErr) { setError(delErr.message); return; }
    setTemplates((prev) => prev.filter((row) => row.id !== t.id));
  };

  const toggleActive = async (t: Template) => {
    const { error: upErr } = await supabase
      .from('admin_oncall_shift_templates')
      .update({ active: !t.active })
      .eq('id', t.id);
    if (upErr) return setError(upErr.message);
    setTemplates((prev) => prev.map((r) => (r.id === t.id ? { ...r, active: !t.active } : r)));
  };

  const runNow = async (dryRun: boolean) => {
    setIsMaterializing(true);
    setError(null);
    setActiveRun(null);

    try {
      // Kick off the function but DO NOT await — start polling immediately so
      // the user sees per-template progress as it happens.
      const invokePromise = supabase.functions.invoke('materialize-oncall-shifts', {
        body: { weeks: weeksAhead, dry_run: dryRun, triggered_by: 'manual' },
      });

      // Find the most recent run id by polling briefly until it appears.
      // (For dry_run the function returns no run_id — fall back to plain await.)
      if (dryRun) {
        const { data, error: invErr } = await invokePromise;
        setIsMaterializing(false);
        if (invErr) { setError(invErr.message); return; }
        // Synthesize a run-like display from the response.
        setActiveRun({
          id: 'dry-run',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          status: 'success',
          triggered_by: 'manual',
          weeks: data?.weeks ?? weeksAhead,
          template_count: data?.template_count ?? 0,
          total_created: 0,
          total_skipped_existing: 0,
          errors: data?.errors ?? [],
          per_template: data?.per_template ?? [],
          dry_run: true,
          duration_ms: null,
        });
        return;
      }

      // For real runs: poll for the run we just kicked off.
      const startTime = Date.now();
      let foundId: string | null = null;
      while (Date.now() - startTime < 5000 && !foundId) {
        await new Promise((r) => setTimeout(r, 250));
        const { data: rrows } = await supabase
          .from('admin_oncall_materialization_runs')
          .select('id,started_at,status,triggered_by,dry_run')
          .eq('triggered_by', 'manual')
          .eq('dry_run', false)
          .order('started_at', { ascending: false })
          .limit(1);
        if (rrows && rrows.length > 0) {
          const r = rrows[0] as { id: string; started_at: string };
          if (new Date(r.started_at).getTime() >= startTime - 2000) {
            foundId = r.id;
          }
        }
      }
      if (foundId) setActiveRunId(foundId);

      // Still await the invoke promise so we surface any thrown error.
      const { error: invErr } = await invokePromise;
      if (invErr) {
        setError(invErr.message);
        setIsMaterializing(false);
        setActiveRunId(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to start materialization');
      setIsMaterializing(false);
    }
  };

  // ---------- Coverage gap detection ----------

  const loadGapsFromTable = async (): Promise<CoverageGap[]> => {
    const { data, error: e } = await supabase
      .from('admin_oncall_coverage_gaps')
      .select('id,starts_at,ends_at,duration_minutes,weekday,scan_id,resolved')
      .eq('resolved', false)
      .order('starts_at', { ascending: true });
    if (e) {
      setError(e.message);
      return [];
    }
    const rows = (data || []) as CoverageGap[];
    setGaps(rows);
    return rows;
  };

  const detectGaps = async (silent = false) => {
    if (!silent) setIsScanningGaps(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        'detect-oncall-coverage-gaps',
        { body: { days: 14, min_gap_minutes: 60 } },
      );
      if (invErr) {
        if (!silent) setError(invErr.message);
        return;
      }
      if (data) {
        setGapMeta({
          scanned_at: new Date().toISOString(),
          days: data.window?.days ?? 14,
          shifts_considered: data.shifts_considered ?? 0,
          total_uncovered_minutes: data.total_uncovered_minutes ?? 0,
        });
        // Refresh from the table (function persisted them already).
        await loadGapsFromTable();
      }
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Failed to scan for coverage gaps');
    } finally {
      setIsScanningGaps(false);
    }
  };

  // Auto-detect on first load + whenever templates list changes (debounced).
  useEffect(() => {
    if (isLoading) return;
    // Load existing persisted gaps quickly, then do a background re-scan.
    loadGapsFromTable();
    detectGaps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // After a successful (non-dry-run) materialization completes, re-scan.
  useEffect(() => {
    if (activeRun && activeRun.status === 'success' && !activeRun.dry_run) {
      detectGaps(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.status, activeRun?.dry_run]);

  // Build a "Fix with template" pre-filled form from a gap. Uses the browser's
  // local timezone to derive weekday + HH:MM, and selects every weekday the
  // gap touches so a single multi-day-spanning template can patch it in one go.
  const startNewFromGap = (gap: CoverageGap) => {
    const tz = browserTz();
    const startMs = new Date(gap.starts_at).getTime();
    const endMs = new Date(gap.ends_at).getTime();

    const partsAt = (ms: number) => {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = dtf.formatToParts(new Date(ms));
      const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
      const wdMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      };
      const weekday = wdMap[get('weekday')] ?? 0;
      // hour can come back as "24" for midnight in some impls — normalize.
      let hh = get('hour');
      if (hh === '24') hh = '00';
      const hhmm = `${hh}:${get('minute')}`;
      return { weekday, hhmm, dateKey: `${get('year')}-${get('month')}-${get('day')}` };
    };

    const startParts = partsAt(startMs);
    const endParts = partsAt(endMs);
    const sameDay = startParts.dateKey === endParts.dateKey;

    // Collect every weekday the gap covers in the local tz (capped at 7).
    const weekdays = new Set<number>([startParts.weekday]);
    const dayStep = 24 * 3600 * 1000;
    for (let t = startMs; t < endMs && weekdays.size < 7; t += dayStep) {
      weekdays.add(partsAt(t).weekday);
    }
    weekdays.add(endParts.weekday);

    const start_time = startParts.hhmm;
    // If the gap crosses midnight in the local tz, clip end to 23:59 so the
    // single-day template constraint (end > start, same day) is satisfied.
    let end_time = sameDay ? endParts.hhmm : '23:59';
    if (end_time <= start_time) end_time = '23:59';

    setForm({
      id: '',
      contact_id: '',
      weekdays: Array.from(weekdays).sort(),
      start_time,
      end_time,
      role: 'primary',
      timezone: tz,
      active: true,
      notes: `Fixes coverage gap on ${new Date(gap.starts_at).toLocaleString(undefined, { timeZone: tz })}`,
    });
    setShowForm(true);
  };

  const dismissGap = async (gap: CoverageGap) => {
    if (!gap.id) return;
    const { error: e } = await supabase
      .from('admin_oncall_coverage_gaps')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', gap.id);
    if (e) { setError(e.message); return; }
    setGaps((prev) => prev.filter((g) => g.id !== gap.id));
  };

  // ---------- end coverage gap detection ----------

  // ---------- Template suggestions (grouped recurring patterns) ----------

  // Convert an absolute timestamp into local-tz parts (weekday + HH:MM + dateKey).
  const localPartsAt = (ms: number, tz: string) => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = dtf.formatToParts(new Date(ms));
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const wdMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const weekday = wdMap[get('weekday')] ?? 0;
    let hh = get('hour');
    if (hh === '24') hh = '00';
    const hhmm = `${hh}:${get('minute')}`;
    return { weekday, hhmm, dateKey: `${get('year')}-${get('month')}-${get('day')}` };
  };

  // Compute pattern groups from the current set of gaps. Each gap maps to a
  // single (weekday, start, end) pattern in the browser's local timezone. Gaps
  // that cross midnight locally are clipped to '23:59' for that weekday so
  // they still group cleanly with same-shape patterns from other weeks.
  const computePatterns = (gapList: CoverageGap[]) => {
    const tz = browserTz();
    const map = new Map<string, {
      pattern_key: string;
      weekday: number;
      start_time: string;
      end_time: string;
      timezone: string;
      gap_count: number;
      total_minutes: number;
    }>();
    for (const g of gapList) {
      const startMs = new Date(g.starts_at).getTime();
      const endMs = new Date(g.ends_at).getTime();
      const sp = localPartsAt(startMs, tz);
      const ep = localPartsAt(endMs, tz);
      const sameDay = sp.dateKey === ep.dateKey;
      const start_time = sp.hhmm;
      let end_time = sameDay ? ep.hhmm : '23:59';
      if (end_time <= start_time) end_time = '23:59';
      const pattern_key = `${sp.weekday}|${start_time}|${end_time}|${tz}`;
      const existing = map.get(pattern_key);
      if (existing) {
        existing.gap_count += 1;
        existing.total_minutes += g.duration_minutes;
      } else {
        map.set(pattern_key, {
          pattern_key,
          weekday: sp.weekday,
          start_time,
          end_time,
          timezone: tz,
          gap_count: 1,
          total_minutes: g.duration_minutes,
        });
      }
    }
    return Array.from(map.values());
  };

  // Sync computed patterns to the suggestions table:
  //   - Skip patterns with status='dismissed' or 'accepted' (admin already decided).
  //   - Update gap_count / total_minutes / last_seen_at on existing 'pending'.
  //   - Insert new rows for patterns we've never seen before.
  // Returns the list of currently-visible (pending) suggestions.
  const syncSuggestions = async (gapList: CoverageGap[]) => {
    const patterns = computePatterns(gapList);
    if (patterns.length === 0) {
      // Still show any previously-pending suggestions for context (e.g. they
      // were dismissed-but-recently-recurring); but in the common case there
      // are none, so just clear and return.
      const { data } = await supabase
        .from('admin_oncall_template_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('gap_count', { ascending: false });
      setSuggestions((data || []) as Suggestion[]);
      return;
    }

    const keys = patterns.map((p) => p.pattern_key);
    const { data: existingRows, error: selErr } = await supabase
      .from('admin_oncall_template_suggestions')
      .select('*')
      .in('pattern_key', keys);
    if (selErr) {
      setError(selErr.message);
      return;
    }
    const existingByKey = new Map<string, Suggestion>();
    for (const r of (existingRows || []) as Suggestion[]) {
      existingByKey.set(r.pattern_key, r);
    }

    const nowIso = new Date().toISOString();
    const toInsert: any[] = [];
    const toUpdate: Array<{ id: string; gap_count: number; total_minutes: number }> = [];

    for (const p of patterns) {
      const ex = existingByKey.get(p.pattern_key);
      if (!ex) {
        toInsert.push({
          pattern_key: p.pattern_key,
          weekday: p.weekday,
          start_time: p.start_time,
          end_time: p.end_time,
          timezone: p.timezone,
          gap_count: p.gap_count,
          total_minutes: p.total_minutes,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          status: 'pending',
        });
      } else if (ex.status === 'pending') {
        toUpdate.push({
          id: ex.id!,
          gap_count: p.gap_count,
          total_minutes: p.total_minutes,
        });
      }
      // accepted / dismissed → leave alone (skip)
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from('admin_oncall_template_suggestions')
        .insert(toInsert);
      if (insErr) setError(insErr.message);
    }

    // Sequential updates (small N), each setting last_seen_at + counters.
    for (const u of toUpdate) {
      await supabase
        .from('admin_oncall_template_suggestions')
        .update({
          gap_count: u.gap_count,
          total_minutes: u.total_minutes,
          last_seen_at: nowIso,
        })
        .eq('id', u.id);
    }

    // Reload pending rows for these patterns to get authoritative state + ids.
    const { data: refreshed } = await supabase
      .from('admin_oncall_template_suggestions')
      .select('*')
      .in('pattern_key', keys)
      .eq('status', 'pending')
      .order('gap_count', { ascending: false });
    setSuggestions((refreshed || []) as Suggestion[]);
  };

  // Re-sync suggestions whenever the gap list changes (after a scan).
  useEffect(() => {
    if (isLoading) return;
    syncSuggestions(gaps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaps, isLoading]);

  const acceptSuggestion = async (s: Suggestion, contactIdOverride?: string): Promise<boolean> => {
    setError(null);
    const contact_id = contactIdOverride ?? suggestionContacts[s.pattern_key] ?? '';
    if (!contact_id) {
      setError('Pick a contact to assign before creating this template.');
      return false;
    }
    setIsAcceptingSuggestion(s.pattern_key);
    try {
      const { data: inserted, error: insErr } = await supabase
        .from('admin_oncall_shift_templates')
        .insert([{
          contact_id,
          weekday: s.weekday,
          start_time: s.start_time,
          end_time: s.end_time,
          role: 'primary',
          timezone: s.timezone,
          active: true,
          notes: `Auto-created from suggested pattern (${s.gap_count} occurrence${s.gap_count === 1 ? '' : 's'})`,
        }])
        .select('id')
        .single();
      if (insErr) {
        setError(insErr.message);
        return false;
      }

      // Mark suggestion as accepted, record the new template id.
      if (s.id) {
        await supabase
          .from('admin_oncall_template_suggestions')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_template_ids: inserted ? [inserted.id] : [],
          })
          .eq('id', s.id);
      }
      // Optimistic UI update.
      setSuggestions((prev) => prev.filter((x) => x.pattern_key !== s.pattern_key));
      return true;
    } finally {
      setIsAcceptingSuggestion(null);
    }
  };

  const dismissSuggestion = async (s: Suggestion) => {
    if (!s.id) return;
    const { error: upErr } = await supabase
      .from('admin_oncall_template_suggestions')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', s.id);
    if (upErr) { setError(upErr.message); return; }
    setSuggestions((prev) => prev.filter((x) => x.pattern_key !== s.pattern_key));
  };

  const createAllSuggestions = async () => {
    setError(null);
    if (suggestions.length === 0) return;
    // Default any unset contact picks to the first active contact.
    const firstActive = contacts.find((c) => c.is_active)?.id;
    if (!firstActive) {
      setError('Add at least one active admin contact first.');
      return;
    }
    setIsCreatingAllSuggestions(true);
    try {
      const list = [...suggestions];
      for (const s of list) {
        const cid = suggestionContacts[s.pattern_key] || firstActive;
        // eslint-disable-next-line no-await-in-loop
        await acceptSuggestion(s, cid);
      }
      // Refresh the templates list once at the end.
      load();
    } finally {
      setIsCreatingAllSuggestions(false);
    }
  };

  // ---------- end template suggestions ----------



  const activeTemplates = useMemo(() => templates.filter((t) => t.active), [templates]);

  const lastSuccess = useMemo(
    () => runs.find((r) => r.status === 'success' && !r.dry_run) || null,
    [runs],
  );
  const lastRun = useMemo(
    () => runs.find((r) => !r.dry_run) || null,
    [runs],
  );

  // Compute next scheduled auto-run time (last successful + 7 days).
  const nextAutoRunAt = useMemo(() => {
    if (!lastSuccess?.finished_at) return null;
    return new Date(
      new Date(lastSuccess.finished_at).getTime() + AUTO_INTERVAL_HOURS * 3600 * 1000,
    );
  }, [lastSuccess]);

  const progressPct = useMemo(() => {
    if (!activeRun || activeRun.status !== 'running') return null;
    const total = activeRun.template_count ?? 0;
    const done = activeRun.per_template?.length ?? 0;
    if (total <= 0) return null;
    return Math.min(100, Math.round((done / total) * 100));
  }, [activeRun]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Recurring Weekly Templates</h3>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Define a weekday-based rotation (e.g. <em>“Alice every Mon/Wed 9am–5pm ET”</em>). The
            schedule auto-runs weekly to keep the rolling horizon full — re-runs are idempotent.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Inline progress pill — shown between the deep-link Save closing
              the modal and the follow-up toast firing. Lets the admin know
              the targeted materialize + gap re-scan is in flight without
              having to look at the run history table. */}
          {isRefreshingSchedule && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
              <RefreshIcon className="animate-spin" size={12} />
              Refreshing schedule…
            </span>
          )}
          <button
            onClick={load}
            className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshIcon size={16} /> Refresh
          </button>
          <button
            onClick={startNew}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
          >
            + Add Template
          </button>
        </div>
      </div>


      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangleIcon size={18} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Schedule + last-run summary card */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <ClockIcon className="text-orange-600 mt-0.5" size={20} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-orange-900">Auto-runs weekly</p>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Scheduled
                </span>
              </div>
              <p className="text-sm text-orange-800 mt-0.5">
                The schedule maintains a {DEFAULT_WEEKS_AHEAD}-week rolling horizon by re-running every{' '}
                {Math.round(AUTO_INTERVAL_HOURS / 24)} days. Manual runs use:
                <select
                  value={weeksAhead}
                  onChange={(e) => setWeeksAhead(Number(e.target.value))}
                  className="mx-1.5 px-2 py-0.5 border border-orange-300 rounded bg-white text-orange-900 font-medium"
                >
                  {[1, 2, 4, 6, 8, 12, 26].map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                week{weeksAhead === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runNow(true)}
              disabled={isMaterializing || activeTemplates.length === 0}
              className="px-3 py-2 text-sm bg-white border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50"
            >
              Preview (dry run)
            </button>
            <button
              onClick={() => runNow(false)}
              disabled={isMaterializing || activeTemplates.length === 0}
              className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isMaterializing && <RefreshIcon className="animate-spin" size={14} />}
              {isMaterializing ? 'Running…' : 'Run now'}
            </button>
          </div>
        </div>

        {/* Last run + next run grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-white border border-orange-200 rounded-xl p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Last run</div>
            {lastRun ? (
              <>
                <div className="mt-1 flex items-center gap-2">
                  {lastRun.status === 'success' ? (
                    <CheckCircleIcon size={16} className="text-emerald-600" />
                  ) : lastRun.status === 'error' ? (
                    <XCircleIcon size={16} className="text-red-600" />
                  ) : (
                    <RefreshIcon size={16} className="text-blue-600 animate-spin" />
                  )}
                  <span className="font-semibold text-gray-900">
                    {fmtRelative(lastRun.finished_at || lastRun.started_at)}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${triggerStyle(lastRun.triggered_by)}`}>
                    {triggerLabel(lastRun.triggered_by)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(lastRun.finished_at || lastRun.started_at).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-gray-500 mt-1">Never</div>
            )}
          </div>

          <div className="bg-white border border-orange-200 rounded-xl p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Result</div>
            {lastSuccess ? (
              <>
                <div className="mt-1 text-gray-900 font-semibold">
                  {lastSuccess.total_created ?? 0} created
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {lastSuccess.total_skipped_existing ?? 0} skipped ·{' '}
                  {lastSuccess.template_count ?? 0} templates ·{' '}
                  {lastSuccess.weeks ?? 0}wk horizon
                  {lastSuccess.duration_ms != null && (
                    <> · {(lastSuccess.duration_ms / 1000).toFixed(1)}s</>
                  )}
                </div>
              </>
            ) : (
              <div className="text-gray-500 mt-1">No successful runs yet</div>
            )}
          </div>

          <div className="bg-white border border-orange-200 rounded-xl p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Next auto-run</div>
            {nextAutoRunAt ? (
              <>
                <div className="mt-1 text-gray-900 font-semibold">
                  {nextAutoRunAt > new Date() ? (
                    <>in {Math.max(1, Math.round((nextAutoRunAt.getTime() - Date.now()) / 3600000 / 24))}d</>
                  ) : (
                    <>Due now</>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {nextAutoRunAt.toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-gray-500 mt-1">On next page load</div>
            )}
          </div>
        </div>

        {/* Live progress for the active run */}
        {activeRun && (activeRun.status === 'running' || isMaterializing) && (
          <div className="bg-white border border-orange-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <RefreshIcon size={14} className="animate-spin text-orange-600" />
                Live progress
              </div>
              <div className="text-xs text-gray-500 tabular-nums">
                {activeRun.per_template?.length ?? 0} / {activeRun.template_count ?? '?'} templates
              </div>
            </div>
            <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-600 transition-all duration-300"
                style={{
                  width: progressPct != null
                    ? `${progressPct}%`
                    : activeRun.template_count == null
                      ? '15%'
                      : '0%',
                }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-600 tabular-nums flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>{activeRun.total_created ?? 0}</strong> created</span>
              <span><strong>{activeRun.total_skipped_existing ?? 0}</strong> skipped</span>
              {(activeRun.errors?.length ?? 0) > 0 && (
                <span className="text-red-600">{activeRun.errors!.length} error(s)</span>
              )}
            </div>
          </div>
        )}

        {/* Completed-run details */}
        {activeRun && activeRun.status !== 'running' && !isMaterializing && (
          <div className="bg-white border border-orange-200 rounded-xl p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              {activeRun.status === 'success' ? (
                <CheckCircleIcon size={16} className="text-emerald-600" />
              ) : (
                <XCircleIcon size={16} className="text-red-600" />
              )}
              <span className="font-semibold text-gray-900">
                {activeRun.dry_run ? 'Dry run complete' : `Run ${activeRun.status}`}
              </span>
              {activeRun.duration_ms != null && (
                <span className="text-xs text-gray-500">
                  in {(activeRun.duration_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
              <span><strong>{activeRun.total_created ?? 0}</strong> shifts created</span>
              <span><strong>{activeRun.total_skipped_existing ?? 0}</strong> already existed (skipped)</span>
              <span>{activeRun.weeks ?? weeksAhead}-week horizon</span>
              {(activeRun.errors?.length ?? 0) > 0 && (
                <span className="text-red-600">{activeRun.errors!.length} error(s)</span>
              )}
            </div>
            {activeRun.per_template && activeRun.per_template.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-orange-700 text-xs font-medium">
                  Per-template fan-out preview
                </summary>
                <div className="mt-2 space-y-2">
                  {activeRun.per_template.map((p) => {
                    const t = templates.find((x) => x.id === p.template_id);
                    return (
                      <div key={p.template_id} className="border border-gray-200 rounded-lg p-2">
                        <div className="text-xs font-semibold text-gray-800">
                          {contactName(p.contact_id)} · {WEEKDAYS[p.weekday]}{' '}
                          {t ? `${trimSeconds(t.start_time)}–${trimSeconds(t.end_time)} ${t.timezone}` : ''}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {p.created} created · {p.skipped_existing} skipped · {p.occurrences_planned} planned
                        </div>
                        {p.preview.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.preview.map((o, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] border"
                                title={o.starts_at}
                              >
                                {fmtPreview(o.starts_at, t?.timezone || 'UTC')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Run history */}
        {runs.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs font-medium text-orange-700 hover:text-orange-900"
            >
              {showHistory ? 'Hide' : 'Show'} run history ({runs.length})
            </button>
            {showHistory && (
              <div className="mt-2 bg-white border border-orange-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">When</th>
                      <th className="text-left px-3 py-2">Trigger</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Created</th>
                      <th className="text-right px-3 py-2">Skipped</th>
                      <th className="text-right px-3 py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {runs.map((r) => (
                      <tr key={r.id} className={r.dry_run ? 'opacity-60' : ''}>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {new Date(r.started_at).toLocaleString()}
                          {r.dry_run && <span className="ml-1 text-[10px] text-gray-400">(dry)</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${triggerStyle(r.triggered_by)}`}>
                            {triggerLabel(r.triggered_by)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r.status === 'success' ? (
                            <span className="text-emerald-700 font-medium">✓ success</span>
                          ) : r.status === 'error' ? (
                            <span className="text-red-700 font-medium">✕ error</span>
                          ) : (
                            <span className="text-blue-700 font-medium">running…</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.total_created ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.total_skipped_existing ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                          {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coverage gap detection card */}
      {gaps.length > 0 ? (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2 mt-0.5">
                <AlertTriangleIcon className="text-red-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-red-900">
                  Coverage gaps detected
                </h4>
                <p className="text-sm text-red-800 mt-0.5">
                  <strong>{gaps.length}</strong> uncovered window
                  {gaps.length === 1 ? '' : 's'} of 1+ hour found in the next{' '}
                  {gapMeta?.days ?? 14} days
                  {gapMeta && gapMeta.total_uncovered_minutes > 0 && (
                    <> ({Math.round(gapMeta.total_uncovered_minutes / 60)} total uncovered hours)</>
                  )}
                  . Add a recurring template to fill them automatically.
                </p>
              </div>
            </div>
            <button
              onClick={() => detectGaps(false)}
              disabled={isScanningGaps}
              className="px-3 py-2 text-sm bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshIcon className={isScanningGaps ? 'animate-spin' : ''} size={14} />
              {isScanningGaps ? 'Scanning…' : 'Re-scan'}
            </button>
          </div>

          <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-red-700 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Weekday</th>
                  <th className="text-left px-3 py-2">Starts</th>
                  <th className="text-left px-3 py-2">Ends</th>
                  <th className="text-right px-3 py-2">Duration</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {(showAllGaps ? gaps : gaps.slice(0, 6)).map((g, idx) => {
                  const tz = browserTz();
                  const localStart = new Date(g.starts_at);
                  const localWeekday = localStart.toLocaleString(undefined, {
                    weekday: 'short', timeZone: tz,
                  });
                  const hrs = Math.floor(g.duration_minutes / 60);
                  const mins = g.duration_minutes % 60;
                  return (
                    <tr key={g.id || idx} className="hover:bg-red-50/40">
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {localWeekday}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {fmtPreview(g.starts_at, tz)}
                      </td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                        {fmtPreview(g.ends_at, tz)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {hrs > 0 ? `${hrs}h` : ''}
                        {mins > 0 ? ` ${mins}m` : hrs === 0 ? `${mins}m` : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => startNewFromGap(g)}
                            className="px-2.5 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 font-medium"
                          >
                            Fix with template
                          </button>
                          <button
                            onClick={() => dismissGap(g)}
                            className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                            title="Dismiss this gap (mark as acknowledged)"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {gaps.length > 6 && (
              <button
                onClick={() => setShowAllGaps((v) => !v)}
                className="w-full text-center text-xs font-medium text-red-700 hover:text-red-900 py-2 border-t border-red-100 bg-red-50/40"
              >
                {showAllGaps
                  ? `Show first 6`
                  : `Show ${gaps.length - 6} more gap${gaps.length - 6 === 1 ? '' : 's'}…`}
              </button>
            )}
          </div>

          {gapMeta && (
            <p className="text-[11px] text-red-700/80">
              Last scanned {fmtRelative(gapMeta.scanned_at)} ·{' '}
              {gapMeta.shifts_considered} shift{gapMeta.shifts_considered === 1 ? '' : 's'} considered
              · weekdays shown in your local timezone ({browserTz()})
            </p>
          )}
        </div>
      ) : gapMeta && !isLoading ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-3">
          <CheckCircleIcon className="text-emerald-600" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">
              No coverage gaps in the next {gapMeta.days} days
            </p>
            <p className="text-xs text-emerald-700">
              Last scanned {fmtRelative(gapMeta.scanned_at)} · {gapMeta.shifts_considered}{' '}
              shift{gapMeta.shifts_considered === 1 ? '' : 's'} considered
            </p>
          </div>
          <button
            onClick={() => detectGaps(false)}
            disabled={isScanningGaps}
            className="px-3 py-1.5 text-xs bg-white border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshIcon className={isScanningGaps ? 'animate-spin' : ''} size={12} />
            Re-scan
          </button>
        </div>
      ) : null}

      {/* Suggested templates card (recurring patterns from grouped gaps) */}
      {suggestions.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-indigo-100 p-2 mt-0.5">
                <ClockIcon className="text-indigo-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-indigo-900">Suggested templates</h4>
                <p className="text-sm text-indigo-800 mt-0.5">
                  Found <strong>{suggestions.length}</strong> recurring weekday/time pattern
                  {suggestions.length === 1 ? '' : 's'} across your gaps. Pick a contact for each
                  and accept — or use <em>Create all</em> to apply them in bulk. Dismissed
                  patterns won&rsquo;t be suggested again.
                </p>
              </div>
            </div>
            <button
              onClick={createAllSuggestions}
              disabled={isCreatingAllSuggestions || isAcceptingSuggestion !== null || contacts.filter(c => c.is_active).length === 0}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              title={contacts.filter(c => c.is_active).length === 0 ? 'Add an active admin contact first' : `Create ${suggestions.length} template${suggestions.length === 1 ? '' : 's'} at once`}
            >
              {isCreatingAllSuggestions && <RefreshIcon className="animate-spin" size={14} />}
              {isCreatingAllSuggestions ? 'Creating…' : `Create all (${suggestions.length})`}
            </button>
          </div>

          <div className="bg-white border border-indigo-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50 text-indigo-700 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2">Pattern</th>
                  <th className="text-left px-3 py-2">Frequency</th>
                  <th className="text-left px-3 py-2">Assign to</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100">
                {suggestions.map((s) => {
                  const assignedId = suggestionContacts[s.pattern_key] || '';
                  const isThisAccepting = isAcceptingSuggestion === s.pattern_key;
                  const isRecurring = s.gap_count >= 2;
                  return (
                    <tr key={s.pattern_key} className="hover:bg-indigo-50/40">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-gray-900">
                          {WEEKDAYS[s.weekday]}s {s.start_time}–{s.end_time}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {s.timezone} · {Math.round(s.total_minutes / 60)}h total uncovered
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isRecurring ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            <AlertTriangleIcon size={12} />
                            {s.gap_count} weeks in a row
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {s.gap_count} occurrence
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={assignedId}
                          onChange={(e) =>
                            setSuggestionContacts((prev) => ({
                              ...prev,
                              [s.pattern_key]: e.target.value,
                            }))
                          }
                          className="w-full max-w-[200px] px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">— Pick contact —</option>
                          {contacts
                            .filter((c) => c.is_active)
                            .map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => acceptSuggestion(s)}
                            disabled={isThisAccepting || isCreatingAllSuggestions || !assignedId}
                            className="px-2.5 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 font-medium disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {isThisAccepting && <RefreshIcon className="animate-spin" size={10} />}
                            Create template
                          </button>
                          <button
                            onClick={() => dismissSuggestion(s)}
                            disabled={isCreatingAllSuggestions}
                            className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            title="Don't suggest this pattern again"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-indigo-700/80">
            Patterns are grouped by weekday + time range in your local timezone ({browserTz()}).
            Accepted suggestions create a new recurring template; dismissed ones are remembered
            so they won&rsquo;t reappear next scan.
          </p>
        </div>
      )}

      {/* Templates list */}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshIcon className="animate-spin text-gray-400" size={28} />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
          <ClockIcon className="text-gray-400 mx-auto mb-2" size={32} />
          <p className="text-gray-700 font-medium">No recurring templates yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Add a template to set up a weekly rotation, then generate shifts.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Contact</th>
                <th className="text-left px-4 py-2.5">Weekday</th>
                <th className="text-left px-4 py-2.5">Hours</th>
                <th className="text-left px-4 py-2.5">Timezone</th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => {
                const isHighlighted = highlightedTemplateId === t.id;
                const isFocused = focusedTemplateId === t.id;
                return (
                <React.Fragment key={t.id}>
                <tr
                  ref={(el) => {
                    if (el) templateRowRefs.current.set(t.id, el);
                    else templateRowRefs.current.delete(t.id);
                  }}
                  data-template-id={t.id}
                  className={`${!t.active ? 'opacity-60' : ''} ${
                    isHighlighted
                      ? 'bg-orange-50 ring-2 ring-orange-400 ring-inset transition-shadow duration-300'
                      : isFocused
                        ? 'bg-orange-50/50 transition-shadow duration-300'
                        : 'transition-shadow duration-300'
                  }`}
                >

                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 font-medium text-gray-900">
                      <UserIcon size={14} className="text-gray-400" />
                      {contactName(t.contact_id)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{WEEKDAYS[t.weekday]}</td>
                  <td className="px-4 py-2.5 text-gray-700 tabular-nums">
                    {trimSeconds(t.start_time)} – {trimSeconds(t.end_time)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{t.timezone}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleStyle(t.role)}`}>
                      {t.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {t.active ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                        <CheckCircleIcon size={14} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500 text-xs font-medium">
                        <XCircleIcon size={14} /> Paused
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => toggleActive(t)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                      >
                        {t.active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => startEdit(t)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setHistoryTemplate(t)}
                        className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                        title="View previous versions of this template and restore one"
                      >
                        History
                      </button>
                      <button
                        onClick={() => remove(t)}
                        className="px-2 py-1 text-xs rounded border border-red-200 hover:bg-red-50 text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Contextual deep-link affordance: shown immediately under the
                    focused row when the admin landed here from a Notification
                    Log "auto-resolved by template …" badge. Stays visible
                    until they click Edit or Dismiss so they have unbounded
                    time to react after the scroll/highlight settles. */}
                {isFocused && (
                  <tr className="bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="rounded-full bg-orange-100 p-1.5 mt-0.5 flex-shrink-0">
                            <ClockIcon className="text-orange-600" size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-orange-900">
                              You navigated here from a notification
                            </p>
                            <p className="text-xs text-orange-800/90 mt-0.5">
                              This is the template that auto-resolved the escalation.
                              Adjust its contact, role (primary → backup), weekday, or hours
                              to fine-tune the rotation.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button

                            onClick={() => {
                              startEdit(t);
                              // Mark this edit session as "preview-enabled" so
                              // the modal renders the live conflict preview
                              // against admin_oncall_shifts. Routine Edit
                              // clicks from the table's row Action column
                              // do NOT set this and stay lean.
                              setPreviewTemplateId(t.id);
                              setFocusedTemplateId(null);
                            }}
                            className="px-3 py-1.5 text-xs rounded-md bg-orange-600 text-white hover:bg-orange-700 font-medium inline-flex items-center gap-1.5"
                          >
                            <UserIcon size={12} />
                            Edit this template
                          </button>

                          <button
                            onClick={() => setFocusedTemplateId(null)}
                            className="px-2 py-1.5 text-xs rounded-md border border-orange-300 text-orange-700 hover:bg-orange-100"
                            title="Dismiss this prompt"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>

          </table>
        </div>
      )}


      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {form.id ? 'Edit Recurring Template' : 'Add Recurring Template'}
              </h3>
              <button onClick={cancel} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <XCircleIcon size={22} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Live preview against next-4-week shift schedule. Only rendered
                  when the modal was opened from the deep-link affordance — see
                  setPreviewTemplateId. Surfaces overlap / uncovered / invalidated
                  warnings inline so the admin can spot conflicts before saving. */}
              {previewTemplateId && form.id === previewTemplateId && (() => {
                const original = templates.find((x) => x.id === previewTemplateId);
                if (!original) return null;
                return (
                  <TemplateChangePreview
                    template={original}
                    form={{
                      contact_id: form.contact_id,
                      weekdays: form.weekdays,
                      start_time: form.start_time,
                      end_time: form.end_time,
                      role: form.role,
                      timezone: form.timezone,
                      active: form.active,
                    }}
                  />
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
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
                        {c.name}{!c.is_active ? ' (inactive)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekdays {form.id && <span className="text-xs text-gray-500">(editing — pick exactly one)</span>}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((wd, idx) => {
                    const selected = form.weekdays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (form.id) setForm({ ...form, weekdays: [idx] });
                          else toggleWeekday(idx);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                          selected
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {wd}
                      </button>
                    );
                  })}
                </div>
                {!form.id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: select multiple weekdays — one template row will be created per day.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                  {!COMMON_TIMEZONES.includes(form.timezone) && (
                    <option value={form.timezone}>{form.timezone}</option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Times are interpreted in this timezone, so DST shifts itself correctly.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g. Weekday daytime rotation"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded"
                />
                Active (paused templates are not materialized)
              </label>
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
                {isSaving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version-history drawer. Slides in from the right when an admin
          clicks "History" on a template row. Lists every snapshot captured
          by the BEFORE-UPDATE trigger, with a "Restore this version" button
          per row that auto re-materializes + re-scans gaps. The trigger
          captures the current state on the way out, so restores are
          themselves audited and rollback-able. */}
      <TemplateVersionHistoryDrawer
        open={historyTemplate !== null}
        template={historyTemplate}
        contactName={contactName}
        onClose={() => setHistoryTemplate(null)}
        onRestored={() => {
          // Pull the freshly-reverted template + reload runs/gaps so the
          // table, schedule card, and gap card all reflect the restored
          // state immediately.
          load();
          loadGapsFromTable();
          if (onMaterialized) onMaterialized();
        }}
      />
    </div>
  );
};

export default AdminOncallTemplates;
