import React, { useEffect, useMemo, useRef, useState } from 'react';
import { database as supabase } from '@/lib/database';
import {
  RefreshIcon, XCircleIcon, ClockIcon, CheckCircleIcon, AlertTriangleIcon,
  DownloadIcon, FilterIcon, ChevronDownIcon, BookmarkIcon, TrashIcon, StarIcon,
} from '@/components/ui/Icons';


import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAdminTab } from '@/contexts/AdminTabContext';



// One row from admin_oncall_shift_template_versions. snapshot.* contains the
// pre-update state of the template (captured by the BEFORE-UPDATE trigger).
export interface TemplateVersionRow {
  id: string;
  template_id: string;
  version_number: number;
  changed_at: string;
  changed_by: string | null;
  snapshot: {
    id: string;
    contact_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    role: string;
    timezone: string;
    active: boolean;
    notes: string | null;
  };
}

export interface TemplateLike {
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const trimSeconds = (t: string) => (t && t.length >= 5 ? t.slice(0, 5) : t || '');

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

interface Props {
  open: boolean;
  template: TemplateLike | null;
  contactName: (id: string) => string;
  onClose: () => void;
  // Called after a successful restore so the parent can reload the templates
  // list, refresh runs history, and re-scan gaps. Receives the restored
  // template's id.
  onRestored: (templateId: string) => void;
}

// Renders a side drawer listing every historical version of a template
// captured by the BEFORE-UPDATE trigger on admin_oncall_shift_templates.
// Each row has a "Restore this version" affordance that:
//   1. Updates the template to match the snapshot's contact_id / weekday /
//      start_time / end_time / role / timezone / active / notes. (This itself
//      causes the trigger to capture the just-replaced state as a new
//      version, so the history is monotonic and the restore is itself
//      undoable.)
//   2. Re-runs materialize-oncall-shifts for the next 4 weeks (idempotent
//      via the unique index on source_template_id + starts_at).
//   3. Re-runs detect-oncall-coverage-gaps so the gap UI reflects the
//      restored config.
//   4. Surfaces a success toast with a deep-link back into the Shift
//      Schedule view, mirroring the post-save flow's affordance.
//
// Unlike the 60-second post-save Undo, restores here are unbounded —
// admins can roll back to ANY captured version weeks or months later.
const TemplateVersionHistoryDrawer: React.FC<Props> = ({
  open, template, contactName, onClose, onRestored,
}) => {
  const [versions, setVersions] = useState<TemplateVersionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  // Map of changed_by uuid -> resolved user record. Populated lazily after
  // versions load via the lookup-admin-users edge function. Unknown ids stay
  // out of the map and fall back to a uuid-prefix label.
  const [userMap, setUserMap] = useState<Record<string, { email: string | null; display_name: string }>>({});
  // Compare-selection: each entry is either a version row id or the literal
  // string 'current' for the live template. We cap at 2 selections — picking
  // a third drops the oldest selection (FIFO) so the user can rapidly sweep
  // through comparisons without having to manually deselect.
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  // CSV export busy flag — set while we (optionally) resolve any still-unknown
  // changed_by uuids and assemble the file. Disables the button to prevent
  // double-clicks producing two downloads.
  const [isExporting, setIsExporting] = useState(false);

  // ---- Filter bar state ---------------------------------------------------
  // All filters are applied client-side over the already-loaded `versions`
  // array (no refetch). The filtered result drives the rendered list, the
  // CSV export (so reviewers only get the rows the admin is currently
  // looking at), and a stale-selection cleanup for compareSelection.
  type DatePreset = 'all' | '24h' | '7d' | '30d' | 'custom';
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  // Custom date inputs are <input type="date">-friendly YYYY-MM-DD strings.
  // Empty string means "unbounded" on that side. Only consulted when
  // datePreset === 'custom'.
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  // 'Changed by' filter: list of changed_by uuids to include. Empty means
  // "no restriction" (every author passes). The literal string '__null__'
  // represents rows with a null changed_by (system / pre-RLS edits) so
  // admins can include or exclude them as a distinct bucket.
  const [changedByFilter, setChangedByFilter] = useState<string[]>([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  // 'Field changed' filter: list of field names. A version passes if its
  // diff-vs-next-older intersects this set. Empty means "no restriction".
  // The genesis (oldest) row has no predecessor; we treat it as passing
  // any field filter so admins always see it as context for the timeline.
  const [fieldFilter, setFieldFilter] = useState<string[]>([]);

  // ---- Filter-preset state ------------------------------------------------
  // Persistable named bundles of (datePreset, dateFrom, dateTo,
  // changedByFilter, fieldFilter) + a scope flag controlling whether the
  // preset is template-specific or shared across templates. Stored per-admin
  // in admin_oncall_history_filter_presets with RLS so each admin only sees
  // their own presets — useful for SOC2/compliance workflows where a
  // reviewer wants to repeatedly slice "Alice's edits to active flag" or
  // "anything in the last 7 days touching role/timezone".
  interface FilterPresetFiltersJson {
    datePreset: DatePreset;
    dateFrom: string;
    dateTo: string;
    changedByFilter: string[];
    fieldFilter: string[];
    // 'current_template' = only show/apply to the template whose id is
    // captured in template_id below. 'any_template' = applicable to any
    // template's history drawer (template_id is null).
    scope: 'current_template' | 'any_template';
    template_id: string | null;
  }
  interface FilterPresetRow {
    id: string;
    name: string;
    owner_user_id: string;
    filters: FilterPresetFiltersJson;
    created_at: string;
  }
  const [presets, setPresets] = useState<FilterPresetRow[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);
  // Inline save form state (revealed by the "Save current filters as
  // preset…" button). Kept inline rather than a modal so the admin's filter
  // selections stay in view as they name the preset.
  const [saveFormOpen, setSaveFormOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savePresetScope, setSavePresetScope] = useState<'current_template' | 'any_template'>('current_template');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  // Tracks which preset (if any) is currently "active" — i.e. the last one
  // the admin loaded. Cleared the moment they edit any filter manually so
  // the selector doesn't lie about what's applied.
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  // Auth user id, needed to stamp the owner_user_id column on insert. RLS
  // would also enforce this server-side, but we set it client-side so the
  // INSERT statement is well-formed even if the policy ever loosens.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ---- Default-preset state ----------------------------------------------
  // A "default" pins one preset as the auto-applied filter set when the
  // drawer opens. Bindings live in admin_oncall_history_default_presets and
  // are keyed by (owner_user_id, template_id) — with template_id = NULL
  // representing the cross-template default. The auto-apply logic prefers
  // the template-specific binding over the cross-template one, so an admin
  // can have a global "last 7 days" default that's selectively overridden
  // for a particularly noisy template.
  //
  // IMPORTANT semantic: once an admin pins a default, ONLY an explicit
  // 'Unset default' click clears it. Manually editing filters or applying
  // a different preset clears `activePresetId` (the badge) but DOES NOT
  // touch the underlying default row — so the next time the drawer opens
  // the default still kicks in. This matches the user's expectation that
  // "default" means "what this drawer should look like on open", not
  // "what's currently applied".
  interface DefaultPresetRow {
    id: string;
    owner_user_id: string;
    template_id: string | null;
    preset_id: string;
    created_at: string;
  }
  const [defaultPresets, setDefaultPresets] = useState<DefaultPresetRow[]>([]);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  // We auto-apply the most-specific default exactly once per drawer-open
  // cycle. This ref captures the (template?.id ?? '__none__') we last
  // auto-applied for, so a re-render triggered by, say, a userMap update
  // doesn't redundantly slam the filter state back to the default and
  // clobber any manual edits the admin has made since opening.
  const autoAppliedKeyRef = useRef<string | null>(null);

  const { toast } = useToast();
  const { goToTab } = useAdminTab();





  const loadVersions = async (templateId: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('admin_oncall_shift_template_versions')
      .select('id,template_id,version_number,changed_at,changed_by,snapshot')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false });
    if (e) setError(e.message);
    else setVersions((data || []) as TemplateVersionRow[]);
    setIsLoading(false);
  };

  // After versions load, collect the unique non-null changed_by ids and
  // resolve them to email/display_name in a single edge-function round-trip.
  // We merge into existing userMap so toggling between templates doesn't
  // re-fetch ids we've already resolved this session.
  useEffect(() => {
    const idsToLookup = Array.from(
      new Set(
        versions
          .map((v) => v.changed_by)
          .filter((id): id is string => !!id && !(id in userMap)),
      ),
    );
    if (idsToLookup.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('lookup-admin-users', {
          body: { user_ids: idsToLookup },
        });
        if (cancelled) return;
        const resolved = (data?.users || []) as Array<{ id: string; email: string | null; display_name: string }>;
        if (resolved.length > 0) {
          setUserMap((prev) => {
            const next = { ...prev };
            for (const u of resolved) {
              next[u.id] = { email: u.email, display_name: u.display_name };
            }
            return next;
          });
        }
      } catch {
        // Lookup is purely cosmetic — silently fall back to uuid prefixes.
      }
    })();
    return () => { cancelled = true; };
  }, [versions, userMap]);

  useEffect(() => {
    if (open && template?.id) loadVersions(template.id);
    else setVersions([]);
    // Reset compare selection whenever the drawer opens for a new template
    // or closes — comparing snapshots from different templates would be
    // meaningless, and a stale selection on reopen would surface a phantom
    // diff panel from the previous session.
    setCompareSelection([]);
    // Reset all filter controls too: filter state from a previous template's
    // history (e.g. "only edits by Alice in the last 7 days") is almost
    // never what the admin wants when they pop open history for a different
    // template, and silently carrying it over hides rows the admin assumes
    // are visible. NOTE: if a default preset is configured, the auto-apply
    // effect below will overwrite these resets once presets+defaults load.
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setChangedByFilter([]);
    setUserDropdownOpen(false);
    setFieldFilter([]);
    // Reset preset UI state. activePresetId tracks the currently-loaded
    // preset for the badge in the dropdown trigger; both must clear so
    // a new template's drawer doesn't show a stale "active" preset that
    // referenced a different template's filter state.
    setActivePresetId(null);
    setPresetDropdownOpen(false);
    setSaveFormOpen(false);
    setSavePresetName('');
    setSavePresetScope('current_template');
    // Reset the auto-apply guard so the next (open, template) combination
    // gets a fresh chance to auto-apply its default. We also clear the
    // defaultsLoaded flag so the auto-apply effect waits for the new
    // drawer's defaults fetch to finish before doing anything.
    autoAppliedKeyRef.current = null;
    setDefaultsLoaded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id]);


  // Resolve current auth user once on mount — needed to stamp owner_user_id
  // on preset inserts (RLS will reject mismatches but having the value
  // client-side keeps the INSERT well-formed and means we don't need to
  // round-trip auth on every save).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(data?.user?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load presets when the drawer opens. Refetched on each open so that a
  // preset saved in one drawer session is visible the next time the admin
  // pops it open without a hard reload. Filtered to the current template's
  // scope-applicable rows in the render-time `applicablePresets` memo, not
  // here, so the in-state list always reflects the full per-user catalog.
  useEffect(() => {
    if (!open || !currentUserId) return;
    let cancelled = false;
    (async () => {
      setPresetsLoading(true);
      setPresetsError(null);
      const { data, error: e } = await supabase
        .from('admin_oncall_history_filter_presets')
        .select('id,name,owner_user_id,filters,created_at')
        .eq('owner_user_id', currentUserId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (e) setPresetsError(e.message);
      else setPresets((data || []) as FilterPresetRow[]);
      setPresetsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserId]);

  // Load this admin's default-preset bindings on drawer open. We fetch ALL
  // of their bindings (not just the two that could match this drawer's
  // template) so the "set as default" star UI elsewhere in the dropdown
  // can render correct on/off state for every applicable preset — a
  // current_template default for *another* template is invisible from this
  // drawer's perspective, but a cross-template default still affects
  // every drawer's auto-apply behavior. RLS already restricts to the
  // calling admin, but we mirror the filter client-side to keep the
  // intent explicit.
  useEffect(() => {
    if (!open || !currentUserId) return;
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from('admin_oncall_history_default_presets')
        .select('id,owner_user_id,template_id,preset_id,created_at')
        .eq('owner_user_id', currentUserId);
      if (cancelled) return;
      if (e) {
        // Defaults are nice-to-have, not load-blocking — surface a console
        // warning but don't block the drawer with a destructive toast.
        // eslint-disable-next-line no-console
        console.warn('[TemplateVersionHistoryDrawer] failed to load default presets:', e.message);
        setDefaultPresets([]);
      } else {
        setDefaultPresets((data || []) as DefaultPresetRow[]);
      }
      setDefaultsLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserId]);


  // Whenever the admin manually edits any filter, clear activePresetId so
  // the dropdown trigger stops claiming a preset is "applied" when in
  // reality the live state has diverged from the saved snapshot. We
  // intentionally do NOT clear it inside applyPreset / loadPreset; only
  // user-initiated edits should de-couple from the loaded preset.
  useEffect(() => {
    setActivePresetId((prev) => {
      if (!prev) return prev;
      const p = presets.find((x) => x.id === prev);
      if (!p) return null;
      const f = p.filters;
      const matches =
        f.datePreset === datePreset
        && (f.datePreset !== 'custom' || (f.dateFrom === dateFrom && f.dateTo === dateTo))
        && f.changedByFilter.length === changedByFilter.length
        && f.changedByFilter.every((x) => changedByFilter.includes(x))
        && f.fieldFilter.length === fieldFilter.length
        && f.fieldFilter.every((x) => fieldFilter.includes(x));
      return matches ? prev : null;
    });
  }, [datePreset, dateFrom, dateTo, changedByFilter, fieldFilter, presets]);

  // Filter presets down to those applicable to the current drawer context:
  // any 'any_template' preset is always applicable; a 'current_template'
  // preset is applicable only when its captured template_id matches the
  // template currently being viewed. This is what populates the load-
  // preset dropdown so an admin doesn't have to mentally filter out
  // presets that were saved against a different template.
  const applicablePresets = useMemo(() => {
    return presets.filter((p) => {
      const f = p.filters;
      if (f.scope === 'any_template') return true;
      return !!template && f.template_id === template.id;
    });
  }, [presets, template]);


  // ---- Default-preset derivations + auto-apply ---------------------------

  // Resolve the (owner, template_id=current) and (owner, NULL) bindings to
  // their preset_ids. Either may be null if the admin hasn't pinned that
  // specific scope. We index by template_id ?? '__null__' so the map
  // lookup mirrors the COALESCE-to-sentinel uniqueness in the DB.
  const templateSpecificDefaultPresetId = useMemo<string | null>(() => {
    if (!template) return null;
    const row = defaultPresets.find((d) => d.template_id === template.id);
    return row ? row.preset_id : null;
  }, [defaultPresets, template]);

  const crossTemplateDefaultPresetId = useMemo<string | null>(() => {
    const row = defaultPresets.find((d) => d.template_id === null);
    return row ? row.preset_id : null;
  }, [defaultPresets]);

  // The most-specific default that should auto-apply for this drawer:
  // template-specific wins over cross-template, both fall back to null.
  // We additionally verify the referenced preset still exists in `presets`
  // — if a binding points at a deleted preset (e.g. a different device
  // deleted it after this admin's session loaded), we treat it as no
  // default rather than silently doing nothing on auto-apply.
  const effectiveDefault = useMemo<{
    presetId: string;
    scope: 'template' | 'cross';
  } | null>(() => {
    if (templateSpecificDefaultPresetId
        && presets.some((p) => p.id === templateSpecificDefaultPresetId)) {
      return { presetId: templateSpecificDefaultPresetId, scope: 'template' };
    }
    if (crossTemplateDefaultPresetId
        && presets.some((p) => p.id === crossTemplateDefaultPresetId)) {
      return { presetId: crossTemplateDefaultPresetId, scope: 'cross' };
    }
    return null;
  }, [templateSpecificDefaultPresetId, crossTemplateDefaultPresetId, presets]);

  // Auto-apply the most-specific default ONCE per drawer-open cycle. We
  // wait until BOTH presets and defaults have loaded so we don't briefly
  // apply a cross-template default and then immediately overwrite it with
  // a (still-loading) template-specific one. The autoAppliedKeyRef guard
  // prevents us from re-applying after the user has manually edited
  // filters in the same session — re-apply would clobber their edits and
  // is exactly the "default keeps overwriting my work" anti-pattern we
  // want to avoid.
  useEffect(() => {
    if (!open) return;
    if (presetsLoading || !defaultsLoaded) return;
    const key = `${open ? '1' : '0'}:${template?.id ?? '__none__'}`;
    if (autoAppliedKeyRef.current === key) return;
    // Mark as handled before mutating state so a synchronous re-render
    // triggered by the setDatePreset / setChangedByFilter / setFieldFilter
    // calls below can't loop us back through this effect.
    autoAppliedKeyRef.current = key;
    if (!effectiveDefault) return;
    const preset = presets.find((p) => p.id === effectiveDefault.presetId);
    if (!preset) return;
    const f = preset.filters;
    setDatePreset(f.datePreset || 'all');
    setDateFrom(f.dateFrom || '');
    setDateTo(f.dateTo || '');
    setChangedByFilter(Array.isArray(f.changedByFilter) ? [...f.changedByFilter] : []);
    setFieldFilter(Array.isArray(f.fieldFilter) ? [...f.fieldFilter] : []);
    setActivePresetId(preset.id);
    // Surface a discreet toast so the admin understands why the drawer
    // didn't open with empty filters. The toast also calls out which scope
    // the default came from — important for an admin who has both a
    // cross-template default AND a per-template override and needs to
    // remember which one is in effect right now.
    toast({
      title: 'Default filters applied',
      description: effectiveDefault.scope === 'template'
        ? `"${preset.name}" — pinned as the default for this template.`
        : `"${preset.name}" — your cross-template default.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id, presetsLoading, defaultsLoaded, effectiveDefault, presets]);


  // ---- Default-preset actions --------------------------------------------

  // Pin a preset as the default for an explicit scope. We pass scope in
  // rather than inferring from `preset.filters.scope` because the two
  // concepts are independent — an admin might want to pin an
  // 'any_template' preset as the default for THIS template only (because
  // it happens to be perfect for this specific drawer), or vice versa.
  // We use upsert with onConflict on the (owner, COALESCE(template_id,
  // sentinel)) unique key — though Supabase JS doesn't support COALESCE
  // expressions in onConflict, so we instead delete-then-insert in a
  // single round-trip-equivalent (deleteExisting + insertNew) so the
  // admin's previous default in this scope is replaced atomically from
  // the user's perspective.
  const setDefaultPreset = async (
    preset: FilterPresetRow,
    scope: 'template' | 'cross',
  ) => {
    if (!currentUserId) {
      toast({
        variant: 'destructive',
        title: 'Not signed in',
        description: 'Could not resolve your user id — refresh the page and try again.',
      });
      return;
    }
    if (scope === 'template' && !template) {
      toast({
        variant: 'destructive',
        title: 'No template in scope',
        description: 'Cannot pin a template-specific default without a template.',
      });
      return;
    }
    const targetTemplateId = scope === 'template' ? (template?.id ?? null) : null;
    // Delete any existing binding for this (owner, scope) so the unique
    // index doesn't reject the insert. RLS scopes both ops to this admin.
    const delQuery = supabase
      .from('admin_oncall_history_default_presets')
      .delete()
      .eq('owner_user_id', currentUserId);
    const { error: delErr } = await (
      targetTemplateId === null
        ? delQuery.is('template_id', null)
        : delQuery.eq('template_id', targetTemplateId)
    );
    if (delErr) {
      toast({
        variant: 'destructive',
        title: 'Could not set default',
        description: delErr.message,
      });
      return;
    }
    const { data: insData, error: insErr } = await supabase
      .from('admin_oncall_history_default_presets')
      .insert({
        owner_user_id: currentUserId,
        template_id: targetTemplateId,
        preset_id: preset.id,
      })
      .select('id,owner_user_id,template_id,preset_id,created_at')
      .single();
    if (insErr || !insData) {
      toast({
        variant: 'destructive',
        title: 'Could not set default',
        description: insErr?.message || 'Unknown error',
      });
      return;
    }
    const row = insData as DefaultPresetRow;
    // Replace any in-state row that matched the same (owner, template_id)
    // tuple, then prepend the new one. Using a single setState pass keeps
    // the divergence detection coherent.
    setDefaultPresets((prev) => {
      const filtered = prev.filter((d) => d.template_id !== targetTemplateId);
      return [row, ...filtered];
    });
    toast({
      title: 'Default pinned',
      description: scope === 'template'
        ? `"${preset.name}" will auto-apply when you open this template's history.`
        : `"${preset.name}" will auto-apply on every template's history (unless overridden).`,
    });
  };

  // Remove a default-preset binding by id. We don't ask for confirmation
  // because (a) the action is reversible (the admin can re-pin in one
  // click) and (b) requiring a confirm dialog for a low-stakes preference
  // toggle would be the kind of friction that makes admins stop using
  // the feature.
  const unsetDefaultPreset = async (defaultRow: DefaultPresetRow) => {
    const { error: e } = await supabase
      .from('admin_oncall_history_default_presets')
      .delete()
      .eq('id', defaultRow.id);
    if (e) {
      toast({
        variant: 'destructive',
        title: 'Could not unset default',
        description: e.message,
      });
      return;
    }
    setDefaultPresets((prev) => prev.filter((d) => d.id !== defaultRow.id));
    toast({
      title: 'Default unpinned',
      description: defaultRow.template_id === null
        ? 'Cross-template default cleared. Drawers will open with empty filters unless a per-template default is set.'
        : 'Template-specific default cleared. This drawer will fall back to the cross-template default (if any) on next open.',
    });
  };

  // Compute a small diff between a snapshot and the current live template,
  // returning the labels of the fields that differ. Drives the "what changed"
  // chip row beneath each version.
  const diffFields = (snap: TemplateVersionRow['snapshot'], cur: TemplateLike): string[] => {
    const out: string[] = [];
    if (snap.contact_id !== cur.contact_id) out.push('contact');
    if (snap.weekday !== cur.weekday) out.push('weekday');
    if (trimSeconds(snap.start_time) !== trimSeconds(cur.start_time)) out.push('start');
    if (trimSeconds(snap.end_time) !== trimSeconds(cur.end_time)) out.push('end');
    if (snap.role !== cur.role) out.push('role');
    if (snap.timezone !== cur.timezone) out.push('timezone');
    if (snap.active !== cur.active) out.push('active');
    if ((snap.notes || '') !== (cur.notes || '')) out.push('notes');
    return out;
  };

  // Field-list variant of the snapshot-vs-snapshot diff. Used by both the
  // 'Field changed' filter (intersect against fieldFilter) and the CSV
  // export (joined into the fields_changed column). Field names match the
  // checkbox values in the filter bar so the user's mental model lines up
  // 1:1 with what the underlying diff considers a "change".
  const snapshotChangedFields = (
    newer: TemplateVersionRow['snapshot'],
    older: TemplateVersionRow['snapshot'],
  ): string[] => {
    const out: string[] = [];
    if (newer.contact_id !== older.contact_id) out.push('contact');
    if (newer.weekday !== older.weekday) out.push('weekday');
    if (trimSeconds(newer.start_time) !== trimSeconds(older.start_time)) out.push('start_time');
    if (trimSeconds(newer.end_time) !== trimSeconds(older.end_time)) out.push('end_time');
    if (newer.role !== older.role) out.push('role');
    if (newer.timezone !== older.timezone) out.push('timezone');
    if (newer.active !== older.active) out.push('active');
    if ((newer.notes || '') !== (older.notes || '')) out.push('notes');
    return out;
  };

  // Build a "current" pseudo-version row for visual reference at the top of
  // the list, so admins can compare every historical snapshot against where
  // things stand right now. Declared up here (rather than near the JSX)
  // because the compare-pair memo below depends on it.
  const currentRow = useMemo(() => {
    if (!template) return null;
    return template;
  }, [template]);


  // ---- Compare-two-snapshots machinery -------------------------------------
  //
  // We treat the live template as a virtual entry keyed 'current' so admins
  // can compare ANY historical snapshot against where things are right now,
  // OR compare two historical snapshots against each other to see exactly
  // what one specific edit changed (e.g. v3 vs v4). The selection behaves
  // as a FIFO queue capped at 2: picking a third checkbox drops the
  // earliest selection so toggling around stays effortless.

  // A normalized snapshot shape used by the diff panel — handles both the
  // historical row case (snapshot jsonb) and the current-template case.
  interface NormalizedSnapshot {
    key: string;          // 'current' or version row id
    label: string;        // 'Current' or 'v3'
    sublabel: string;     // 'live now' or relative timestamp
    contact_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    role: string;
    timezone: string;
    active: boolean;
    notes: string | null;
    sortKey: number;      // for chronological ordering: higher = newer
  }

  const normalizeCurrent = (cur: TemplateLike): NormalizedSnapshot => ({
    key: 'current',
    label: 'Current',
    sublabel: 'live now',
    contact_id: cur.contact_id,
    weekday: cur.weekday,
    start_time: cur.start_time,
    end_time: cur.end_time,
    role: cur.role,
    timezone: cur.timezone,
    active: cur.active,
    notes: cur.notes,
    // Current is always the newest: use +Infinity so it sorts after every
    // captured version regardless of version_number.
    sortKey: Number.POSITIVE_INFINITY,
  });

  const normalizeVersion = (v: TemplateVersionRow): NormalizedSnapshot => ({
    key: v.id,
    label: `v${v.version_number}`,
    sublabel: fmtRelative(v.changed_at),
    contact_id: v.snapshot.contact_id,
    weekday: v.snapshot.weekday,
    start_time: v.snapshot.start_time,
    end_time: v.snapshot.end_time,
    role: v.snapshot.role,
    timezone: v.snapshot.timezone,
    active: v.snapshot.active,
    notes: v.snapshot.notes,
    sortKey: v.version_number,
  });

  // Toggle a key in/out of the compare selection. When already at the cap
  // (2) and adding a new key, drop the oldest (FIFO) so admins can sweep
  // through comparisons quickly without manual deselection.
  const toggleCompare = (key: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length < 2) return [...prev, key];
      // Drop oldest, append new.
      return [prev[1], key];
    });
  };

  // Resolve the two selected keys to NormalizedSnapshot objects, then
  // chronologically order them: older on the left (red strikethrough side),
  // newer on the right (green side). Returns null if fewer than two are
  // selected or any key fails to resolve (e.g. a row was filtered out).
  const comparePair = useMemo((): { older: NormalizedSnapshot; newer: NormalizedSnapshot } | null => {
    if (compareSelection.length !== 2 || !currentRow) return null;
    const lookup = (key: string): NormalizedSnapshot | null => {
      if (key === 'current') return normalizeCurrent(currentRow);
      const v = versions.find((x) => x.id === key);
      return v ? normalizeVersion(v) : null;
    };
    const a = lookup(compareSelection[0]);
    const b = lookup(compareSelection[1]);
    if (!a || !b) return null;
    // sortKey ascending: older first.
    return a.sortKey <= b.sortKey ? { older: a, newer: b } : { older: b, newer: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSelection, versions, currentRow]);


  // ---- Filter machinery ---------------------------------------------------

  // Build the list of distinct authors who appear in the loaded versions,
  // for the 'Changed by' multi-select. We include a synthetic '__null__'
  // bucket when at least one version has a null changed_by so admins can
  // explicitly include or exclude system / pre-RLS edits as a category.
  // Sorted by primary label (display_name, then email, then uuid prefix)
  // so the dropdown reads alphabetically — important once a template has
  // been edited by a dozen+ admins over its lifetime.
  const availableUsers = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ id: string; primary: string; secondary: string | null }> = [];
    let hasNull = false;
    for (const v of versions) {
      if (v.changed_by === null) {
        hasNull = true;
        continue;
      }
      if (seen.has(v.changed_by)) continue;
      seen.add(v.changed_by);
      const resolved = userMap[v.changed_by];
      const primary = resolved?.display_name
        || resolved?.email
        || `${v.changed_by.slice(0, 8)}…`;
      const secondary = resolved?.display_name && resolved?.email
        && resolved.display_name !== resolved.email
        ? resolved.email
        : null;
      out.push({ id: v.changed_by, primary, secondary });
    }
    out.sort((a, b) => a.primary.localeCompare(b.primary));
    if (hasNull) {
      out.push({
        id: '__null__',
        primary: '(System / unattributed)',
        secondary: 'changed_by is null',
      });
    }
    return out;
  }, [versions, userMap]);

  // Translate the active datePreset into a concrete [from, to] millisecond
  // window. Returns null on either side for "unbounded". For 'custom' the
  // from/to inputs are interpreted as the START of the from day and the
  // END of the to day in local time — i.e. an inclusive day range — which
  // matches what an admin typing "2024-03-01 to 2024-03-05" expects.
  const dateBounds = useMemo((): { from: number | null; to: number | null } => {
    const now = Date.now();
    if (datePreset === '24h') return { from: now - 24 * 60 * 60 * 1000, to: null };
    if (datePreset === '7d') return { from: now - 7 * 24 * 60 * 60 * 1000, to: null };
    if (datePreset === '30d') return { from: now - 30 * 24 * 60 * 60 * 1000, to: null };
    if (datePreset === 'custom') {
      // <input type="date"> values are YYYY-MM-DD. Parsing them as
      // `${value}T00:00:00` (no Z) treats them as local time, which is
      // the principle of least surprise for an admin filtering "edits
      // made on Monday".
      const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
      return { from: Number.isFinite(fromMs as number) ? fromMs : null,
               to: Number.isFinite(toMs as number) ? toMs : null };
    }
    return { from: null, to: null };
  }, [datePreset, dateFrom, dateTo]);

  // The on-screen list. Applies all three filters in series. Field-changed
  // filtering needs a row's diff-vs-next-older, so we compute it using the
  // index in the FULL versions array (not the filter result) — that way
  // narrowing by date or author doesn't break the field-filter's notion of
  // "what this edit changed". The genesis row (oldest, no predecessor) is
  // treated as passing any field filter so admins still see the timeline's
  // origin point as anchor context.
  const filteredVersions = useMemo(() => {
    const fieldSet = new Set(fieldFilter);
    const userSet = new Set(changedByFilter);
    return versions.filter((v, i) => {
      // Date filter
      const ts = new Date(v.changed_at).getTime();
      if (dateBounds.from !== null && ts < dateBounds.from) return false;
      if (dateBounds.to !== null && ts > dateBounds.to) return false;
      // Changed-by filter
      if (userSet.size > 0) {
        const key = v.changed_by ?? '__null__';
        if (!userSet.has(key)) return false;
      }
      // Field-changed filter
      if (fieldSet.size > 0) {
        const previous = versions[i + 1]; // older neighbor in DESC-sorted list
        if (!previous) {
          // Genesis row — pass through so the timeline's anchor stays
          // visible even when narrowing by field.
          return true;
        }
        const changed = snapshotChangedFields(v.snapshot, previous.snapshot);
        const intersects = changed.some((f) => fieldSet.has(f));
        if (!intersects) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, dateBounds, changedByFilter, fieldFilter]);

  // Derived: how many filters are currently constraining the list. Drives
  // the Reset button's enabled state and the badge on the filter heading.
  const activeFilterCount =
    (datePreset !== 'all' ? 1 : 0)
    + (changedByFilter.length > 0 ? 1 : 0)
    + (fieldFilter.length > 0 ? 1 : 0);

  // When filters change such that one of the currently-checked compare
  // rows is no longer visible, drop that selection so the diff panel
  // doesn't reference a hidden row (which would be confusing — the user
  // would see a diff against something they can't see in the list). We
  // keep 'current' selections regardless because the Current card lives
  // above the filter bar and is always visible.
  useEffect(() => {
    setCompareSelection((prev) => {
      const visibleIds = new Set(filteredVersions.map((v) => v.id));
      const next = prev.filter((key) => key === 'current' || visibleIds.has(key));
      // Avoid spurious re-renders if nothing changed.
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [filteredVersions]);

  // Convenience: wipe every filter back to its "no constraint" default.
  // Bound to the Reset button in the filter bar.
  const resetFilters = () => {
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setChangedByFilter([]);
    setFieldFilter([]);
  };

  // Toggle helpers for the multi-select / checkbox group filters.
  const toggleChangedBy = (id: string) => {
    setChangedByFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleField = (field: string) => {
    setFieldFilter((prev) =>
      prev.includes(field) ? prev.filter((x) => x !== field) : [...prev, field],
    );
  };

  // The eight field-checkbox values, kept in one place so the filter UI
  // and the underlying diff logic can never drift apart.
  const FIELD_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'contact', label: 'Contact' },
    { value: 'weekday', label: 'Weekday' },
    { value: 'start_time', label: 'Start time' },
    { value: 'end_time', label: 'End time' },
    { value: 'role', label: 'Role' },
    { value: 'timezone', label: 'Timezone' },
    { value: 'active', label: 'Active' },
    { value: 'notes', label: 'Notes' },
  ];


  // ---- Filter-preset actions ----------------------------------------------

  // Apply a saved preset by setting every filter state value in one shot.
  // We deliberately set ALL five filter axes (datePreset, dateFrom, dateTo,
  // changedByFilter, fieldFilter) even when the preset doesn't constrain a
  // given axis — otherwise loading a preset over a dirty filter bar would
  // leave residue from the previous selection. activePresetId is set last
  // so the divergence-detector effect doesn't immediately clear it on the
  // same render where we just loaded it.
  const applyPreset = (preset: FilterPresetRow) => {
    const f = preset.filters;
    setDatePreset(f.datePreset || 'all');
    setDateFrom(f.dateFrom || '');
    setDateTo(f.dateTo || '');
    setChangedByFilter(Array.isArray(f.changedByFilter) ? [...f.changedByFilter] : []);
    setFieldFilter(Array.isArray(f.fieldFilter) ? [...f.fieldFilter] : []);
    setActivePresetId(preset.id);
    setPresetDropdownOpen(false);
    toast({
      title: 'Preset applied',
      description: `"${preset.name}" — ${preset.filters.scope === 'any_template' ? 'any template' : 'this template only'}.`,
    });
  };

  // Persist the current filter combination as a new named preset. Validation
  // is intentionally minimal (just a non-empty trimmed name) since presets
  // are personal-scope (RLS) and a misnamed one is one click to delete.
  // We refresh the in-state list with the inserted row so the new preset
  // shows up in the dropdown immediately without a refetch.
  const savePreset = async () => {
    const name = savePresetName.trim();
    if (!name) {
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Give the preset a memorable name (e.g. "SOC2 Q3 review — Alice\'s edits to active flag").',
      });
      return;
    }
    if (!currentUserId) {
      toast({
        variant: 'destructive',
        title: 'Not signed in',
        description: 'Could not resolve your user id — refresh the page and try again.',
      });
      return;
    }
    setIsSavingPreset(true);
    try {
      const filtersJson: FilterPresetFiltersJson = {
        datePreset,
        dateFrom,
        dateTo,
        changedByFilter: [...changedByFilter],
        fieldFilter: [...fieldFilter],
        scope: savePresetScope,
        // Only stamp template_id when the admin chose 'current_template' —
        // 'any_template' presets must store null so they apply across
        // every template's history drawer (otherwise applicablePresets
        // would erroneously hide them when the admin moves to another
        // template).
        template_id: savePresetScope === 'current_template' ? (template?.id ?? null) : null,
      };
      const { data, error: e } = await supabase
        .from('admin_oncall_history_filter_presets')
        .insert({
          name,
          owner_user_id: currentUserId,
          filters: filtersJson,
        })
        .select('id,name,owner_user_id,filters,created_at')
        .single();
      if (e || !data) {
        toast({
          variant: 'destructive',
          title: 'Could not save preset',
          description: e?.message || 'Unknown error',
        });
        return;
      }
      const row = data as FilterPresetRow;
      setPresets((prev) => [row, ...prev]);
      setActivePresetId(row.id);
      setSaveFormOpen(false);
      setSavePresetName('');
      // Don't reset savePresetScope — keep the admin's last choice as the
      // default for the next save in this session, since most admins reuse
      // the same scope when bulk-saving a workflow's presets.
      toast({
        title: 'Preset saved',
        description: savePresetScope === 'any_template'
          ? `"${name}" is reusable on any template.`
          : `"${name}" is scoped to this template only.`,
      });
    } finally {
      setIsSavingPreset(false);
    }
  };

  // Delete a preset by id. Confirms first because there's no undo — the row
  // is gone the moment Supabase ACKs the delete. RLS guarantees only the
  // owner can issue the delete, so the confirm copy doesn't need to mention
  // multi-user side-effects.
  const deletePreset = async (preset: FilterPresetRow) => {
    if (!window.confirm(
      `Delete preset "${preset.name}"?\n\nThis only affects your account; other admins keep their own presets.`,
    )) return;
    const { error: e } = await supabase
      .from('admin_oncall_history_filter_presets')
      .delete()
      .eq('id', preset.id);
    if (e) {
      toast({
        variant: 'destructive',
        title: 'Could not delete preset',
        description: e.message,
      });
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== preset.id));
    // The DB CASCADEs default-preset rows that referenced this preset, but
    // we mirror the cleanup in local state so the star UI doesn't briefly
    // claim a non-existent preset is "default" until the next refetch.
    setDefaultPresets((prev) => prev.filter((d) => d.preset_id !== preset.id));
    // If we just deleted the currently-active preset, clear that pointer
    // so the dropdown trigger stops showing its name.
    setActivePresetId((curr) => (curr === preset.id ? null : curr));
    toast({
      title: 'Preset deleted',
      description: `"${preset.name}" is gone.`,
    });
  };


  // Pretty-print a preset's filter contents for the dropdown row's secondary
  // line — gives admins a quick "what does this preset actually do?" hint
  // without having to load it. Returns a short comma-separated summary.
  const summarizePresetFilters = (f: FilterPresetFiltersJson): string => {
    const parts: string[] = [];
    if (f.datePreset === 'custom') {
      const from = f.dateFrom || '…';
      const to = f.dateTo || '…';
      parts.push(`${from} → ${to}`);
    } else if (f.datePreset && f.datePreset !== 'all') {
      const map: Record<string, string> = { '24h': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' };
      parts.push(map[f.datePreset] || f.datePreset);
    }
    if (f.changedByFilter && f.changedByFilter.length > 0) {
      parts.push(`${f.changedByFilter.length} author${f.changedByFilter.length === 1 ? '' : 's'}`);
    }
    if (f.fieldFilter && f.fieldFilter.length > 0) {
      parts.push(`fields: ${f.fieldFilter.join('+')}`);
    }
    if (parts.length === 0) parts.push('no filters');
    return parts.join(' · ');
  };



  const restore = async (v: TemplateVersionRow) => {
    if (!template) return;
    if (!window.confirm(
      `Restore template to version ${v.version_number} from ${new Date(v.changed_at).toLocaleString()}?\n\n`
      + 'This will overwrite the current contact, weekday, hours, role, timezone, '
      + 'active flag, and notes — and re-materialize the next 4 weeks of shifts. '
      + 'The current state will itself be captured as a new version, so this is reversible.',
    )) return;

    setRestoringId(v.id);
    setError(null);
    try {
      // 1. Revert template to the snapshot. The AFTER-UPDATE trigger will
      //    capture the just-replaced (current) state as a new version, so
      //    the audit trail stays complete and this restore is itself
      //    rollbackable from the same drawer.
      const snap = v.snapshot;
      const { error: upErr } = await supabase
        .from('admin_oncall_shift_templates')
        .update({
          contact_id: snap.contact_id,
          weekday: snap.weekday,
          start_time: snap.start_time,
          end_time: snap.end_time,
          role: snap.role,
          timezone: snap.timezone,
          active: snap.active,
          notes: snap.notes,
        })
        .eq('id', template.id);
      if (upErr) {
        setError(upErr.message);
        toast({
          variant: 'destructive',
          title: 'Restore failed',
          description: upErr.message,
        });
        return;
      }

      // 2. Re-materialize the restored template's next 4 weeks. Idempotent:
      //    existing future shifts for this template are left alone (unique
      //    index on source_template_id + starts_at) and only newly-uncovered
      //    occurrences become rows.
      let created = 0;
      try {
        const { data: matResult } = await supabase.functions.invoke(
          'materialize-oncall-shifts',
          {
            body: {
              template_id: template.id,
              weeks: 4,
              dry_run: false,
              triggered_by: 'manual',
            },
          },
        );
        if (matResult && typeof matResult.total_created === 'number') {
          created = matResult.total_created;
        }
      } catch { /* swallow — toast still confirms restore */ }

      // 3. Re-scan coverage gaps so the gap UI reflects the restored config.
      try {
        await supabase.functions.invoke(
          'detect-oncall-coverage-gaps',
          { body: { days: 28, min_gap_minutes: 60 } },
        );
      } catch { /* ignore */ }

      // 4. Reload version list (the new entry from the trigger should now
      //    appear at the top) so the admin can see the audit trail update.
      await loadVersions(template.id);

      // 5. Tell the parent to reload templates + runs + gaps.
      onRestored(template.id);

      // 6. Confirmation toast with deep-link to Shift Schedule.
      toast({
        title: `Restored to version ${v.version_number}`,
        description: `Template reverted · ${created} shift${created === 1 ? '' : 's'} re-created in the next 4 weeks.`,
        action: (
          <ToastAction
            altText="View shift schedule"
            onClick={() => goToTab('schedule', { template_id: template.id })}
          >
            View Schedule
          </ToastAction>
        ),
      });
    } finally {
      setRestoringId(null);
    }
  };


  // ---- CSV audit-log export ------------------------------------------------
  //
  // Builds a single CSV file containing every captured version of the current
  // template (one row per version) plus a synthetic `fields_changed` column
  // derived by diffing each version against the *next-older* version — i.e.
  // the diff describes what THIS version's edit changed relative to the
  // state immediately preceding it. The oldest version has no predecessor
  // and gets `(initial)` so reviewers can tell it's the seed snapshot.
  //
  // The file is generated entirely in-browser (no server round-trip beyond
  // the optional one-shot lookup of any still-unresolved changed_by uuids)
  // and downloaded via a Blob URL, which means SOC2/compliance reviewers
  // never need a database account or service-role key — the admin can hand
  // them the file directly.
  //
  // Naming: `oncall-template-{id}-history-{YYYYMMDD}.csv` — the date
  // segment is derived in local time so multiple exports on the same day
  // overwrite cleanly in the reviewer's downloads folder while exports
  // across days are clearly distinguishable.

  // Escape a single CSV cell value per RFC 4180: wrap in double-quotes if it
  // contains a comma, double-quote, CR, or LF; double-up any embedded quotes.
  // null/undefined become empty strings (so a blank notes field doesn't
  // surface as the literal text "null" in compliance reports).
  const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  // Diff one snapshot against another snapshot (or the current template's
  // snapshot-shaped projection) and return the list of changed field names
  // joined by '; '. Mirrors the shape used by diffFields() but works on two
  // snapshot-ish objects rather than snapshot-vs-template.
  const diffSnapshotPair = (
    newer: TemplateVersionRow['snapshot'],
    older: TemplateVersionRow['snapshot'],
  ): string => {
    const out: string[] = [];
    if (newer.contact_id !== older.contact_id) out.push('contact');
    if (newer.weekday !== older.weekday) out.push('weekday');
    if (trimSeconds(newer.start_time) !== trimSeconds(older.start_time)) out.push('start_time');
    if (trimSeconds(newer.end_time) !== trimSeconds(older.end_time)) out.push('end_time');
    if (newer.role !== older.role) out.push('role');
    if (newer.timezone !== older.timezone) out.push('timezone');
    if (newer.active !== older.active) out.push('active');
    if ((newer.notes || '') !== (older.notes || '')) out.push('notes');
    return out.length === 0 ? '(no fields changed)' : out.join('; ');
  };

  const exportCsv = async () => {
    if (!template || filteredVersions.length === 0) return;
    setIsExporting(true);
    try {
      // Best-effort: make sure every changed_by uuid in the export is
      // resolved before we serialize. The drawer's load-time effect already
      // does this, but a long-lived drawer might have additional unresolved
      // ids if the user hits export immediately after a restore (which adds
      // a fresh version row whose author may not yet be in userMap). We
      // restrict the lookup to the rows we're actually exporting (i.e.
      // post-filter) to avoid resolving authors the admin chose to exclude.
      let mapForExport = userMap;
      const unresolvedIds = Array.from(
        new Set(
          filteredVersions
            .map((v) => v.changed_by)
            .filter((id): id is string => !!id && !(id in mapForExport)),
        ),
      );
      if (unresolvedIds.length > 0) {
        try {
          const { data } = await supabase.functions.invoke('lookup-admin-users', {
            body: { user_ids: unresolvedIds },
          });
          const resolved = (data?.users || []) as Array<{ id: string; email: string | null; display_name: string }>;
          if (resolved.length > 0) {
            mapForExport = { ...mapForExport };
            for (const u of resolved) {
              mapForExport[u.id] = { email: u.email, display_name: u.display_name };
            }
            // Also commit to React state so the on-screen rows update — no
            // reason to throw away a lookup we already paid for.
            setUserMap(mapForExport);
          }
        } catch {
          // Non-fatal — we'll just fall back to uuid prefixes for any
          // ids that didn't resolve, same as the on-screen rendering.
        }
      }

      // Header row. Order is chosen so reviewers reading top-to-bottom see
      // identity (who/when), then full snapshot, then the derived
      // fields_changed verdict at the end as the "answer" column.
      const header = [
        'version_number',
        'changed_at',
        'changed_by_id',
        'changed_by_email',
        'changed_by_display_name',
        'contact_id',
        'contact_name',
        'weekday',
        'start_time',
        'end_time',
        'role',
        'timezone',
        'active',
        'notes',
        'fields_changed',
      ];

      // We export only the filtered rows so reviewers receive exactly what
      // the admin sees on screen. Critically, the fields_changed column
      // still derives from each row's predecessor in the FULL versions
      // array (not the filtered one) — otherwise a date-narrowed export
      // would silently mis-attribute changes by comparing against a row
      // that wasn't actually the temporal predecessor. We look up the
      // original index by id once into a map for O(1) access.
      const indexById = new Map(versions.map((v, i) => [v.id, i]));
      const rows = filteredVersions.map((v) => {
        const fullIdx = indexById.get(v.id) ?? -1;
        const previous = fullIdx >= 0 ? versions[fullIdx + 1] : undefined;
        const fieldsChanged = previous
          ? diffSnapshotPair(v.snapshot, previous.snapshot)
          : '(initial)';
        const resolved = v.changed_by ? mapForExport[v.changed_by] : undefined;
        return [
          v.version_number,
          v.changed_at,
          v.changed_by || '',
          resolved?.email || '',
          resolved?.display_name || '',
          v.snapshot.contact_id,
          contactName(v.snapshot.contact_id),
          WEEKDAYS[v.snapshot.weekday] ?? String(v.snapshot.weekday),
          trimSeconds(v.snapshot.start_time),
          trimSeconds(v.snapshot.end_time),
          v.snapshot.role,
          v.snapshot.timezone,
          v.snapshot.active ? 'true' : 'false',
          v.snapshot.notes || '',
          fieldsChanged,
        ];
      });

      // Assemble CSV. Use \r\n per RFC 4180 — Excel and Google Sheets
      // both accept it, and it survives email-attachment round-trips
      // better than bare \n on some Windows mail clients.
      const csv = [header, ...rows]
        .map((row) => row.map(csvCell).join(','))
        .join('\r\n');

      // Prepend a UTF-8 BOM so Excel auto-detects the encoding and
      // doesn't mangle non-ASCII names/notes (e.g. é, ñ, em-dashes).
      const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // Build the YYYYMMDD segment from local time so admins in different
      // timezones get filenames that match their own calendar day.
      const now = new Date();
      const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `oncall-template-${template.id}-history-${yyyymmdd}.csv`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      // Append-then-click-then-remove pattern needed for Firefox; Chrome
      // and Safari accept a detached anchor but Firefox silently no-ops.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so the browser has time to start the download stream
      // before we yank the URL out from under it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({
        title: 'Audit log exported',
        description: activeFilterCount > 0
          ? `${filteredVersions.length} of ${versions.length} version${versions.length === 1 ? '' : 's'} (filtered) written to ${filename}`
          : `${filteredVersions.length} version${filteredVersions.length === 1 ? '' : 's'} written to ${filename}`,
      });
    } finally {
      setIsExporting(false);
    }
  };


  if (!open) return null;


  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 p-5 border-b">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClockIcon className="text-orange-600" size={18} />
              <h3 className="font-semibold text-gray-900">Version history</h3>
            </div>
            {template && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {contactName(template.contact_id)} · {WEEKDAYS[template.weekday]}{' '}
                {trimSeconds(template.start_time)}–{trimSeconds(template.end_time)} · {template.timezone}
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              Every edit is captured by a database trigger. Restoring a version is itself
              audited — the current state becomes a new version on the way out, so you can
              always roll forward again.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close history"
          >
            <XCircleIcon size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 flex items-start gap-2 text-sm">
              <AlertTriangleIcon size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Filter-preset toolbar — sits above the filter bar so admins can
              one-click recall a previously-saved combination of filters
              (date range + changed-by + field-changed) under a memorable
              name. Presets are personal-scope (RLS); each admin sees only
              their own. The 'Apply to current template only' vs 'Apply to
              any template' scope flag controls whether a preset shows up
              in the dropdown for other templates' history drawers. */}
          {!isLoading && currentUserId && (
            <div className="border border-indigo-200 bg-indigo-50/60 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <BookmarkIcon size={14} className="text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-900">Filter presets</span>
                {presetsLoading && (
                  <RefreshIcon className="animate-spin text-indigo-400" size={12} />
                )}
                {activePresetId && (() => {
                  const active = presets.find((p) => p.id === activePresetId);
                  return active ? (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 truncate max-w-[200px]"
                      title={`Currently applied: ${active.name}`}
                    >
                      Applied: {active.name}
                    </span>
                  ) : null;
                })()}
              </div>

              {presetsError && (
                <div className="text-[11px] text-red-600">
                  Could not load presets: {presetsError}
                </div>
              )}

              {/* Two-column control row: (left) Load-preset dropdown,
                  (right) Save-current-as-preset button. Stacks on narrow
                  drawer widths via flex-wrap. */}
              <div className="flex items-stretch gap-2 flex-wrap">
                {/* Load-preset dropdown. Trigger summarizes count of
                    applicable presets and the active one's name when
                    present. The dropdown body lists every applicable
                    preset with its filter summary + scope badge + a
                    delete affordance per row. */}
                <div className="relative flex-1 min-w-[180px]">
                  <button
                    onClick={() => setPresetDropdownOpen((v) => !v)}
                    disabled={presetsLoading}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-indigo-300 bg-white text-[11px] text-gray-700 hover:border-indigo-500 disabled:opacity-50"
                    title={
                      applicablePresets.length === 0
                        ? 'No saved presets apply to this drawer yet — save the current filters to create one'
                        : `${applicablePresets.length} preset${applicablePresets.length === 1 ? '' : 's'} available`
                    }
                  >
                    <span className="truncate text-left flex items-center gap-1.5">
                      <BookmarkIcon size={11} className="text-indigo-500 flex-shrink-0" />
                      {applicablePresets.length === 0 ? (
                        <span className="text-gray-400">No presets yet — save one below</span>
                      ) : activePresetId ? (
                        (() => {
                          const a = presets.find((p) => p.id === activePresetId);
                          return a ? a.name : 'Load preset…';
                        })()
                      ) : (
                        <span>Load preset… ({applicablePresets.length} available)</span>
                      )}
                    </span>
                    <ChevronDownIcon
                      size={12}
                      className={`flex-shrink-0 transition-transform text-gray-400 ${presetDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {presetDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg p-1">
                      {applicablePresets.length === 0 ? (
                        <div className="px-2 py-3 text-[11px] text-gray-500 text-center">
                          {presets.length === 0
                            ? 'No saved presets yet.'
                            : `${presets.length} preset${presets.length === 1 ? '' : 's'} saved, but none apply to this template. Save a new one below or use the "Apply to any template" scope when saving.`}
                        </div>
                      ) : (
                        applicablePresets.map((p) => {
                          const isActive = p.id === activePresetId;
                          // Determine which (if any) default-preset bindings
                          // currently point at THIS preset. We surface both
                          // template-specific and cross-template bindings as
                          // separate visual states because their semantics
                          // differ — the admin needs to know exactly which
                          // scope's default they're toggling on/off when
                          // they click the star.
                          const tplDefaultRow = template
                            ? defaultPresets.find(
                                (d) => d.template_id === template.id && d.preset_id === p.id,
                              )
                            : undefined;
                          const crossDefaultRow = defaultPresets.find(
                            (d) => d.template_id === null && d.preset_id === p.id,
                          );
                          const isTplDefault = !!tplDefaultRow;
                          const isCrossDefault = !!crossDefaultRow;
                          // Where the star action targets when clicked. We
                          // infer from the preset's own scope: an
                          // 'any_template' preset's star toggles the
                          // cross-template default (since that's the
                          // natural "global" pin for it); a 'current_template'
                          // preset's star toggles the template-specific
                          // default for the current drawer. This keeps the
                          // single-click action unambiguous.
                          const starScope: 'template' | 'cross'
                            = p.filters.scope === 'any_template' ? 'cross' : 'template';
                          // Whether the star is "filled" (i.e. this preset
                          // is currently pinned in its natural scope). We
                          // treat the star as on iff the relevant scope's
                          // binding points at this preset.
                          const starFilled = starScope === 'template'
                            ? isTplDefault
                            : isCrossDefault;
                          // For the unset path, we need the actual row id
                          // of the binding to delete. Look it up by scope.
                          const starBindingToUnset = starScope === 'template'
                            ? tplDefaultRow
                            : crossDefaultRow;
                          // Disable the template-scope star when no template
                          // is loaded (defensive — applicablePresets shouldn't
                          // include current_template presets without a
                          // template, but the dropdown might briefly during
                          // a template switch).
                          const starDisabled = starScope === 'template' && !template;
                          return (
                            <div
                              key={p.id}
                              className={`flex items-start gap-2 px-2 py-1.5 rounded ${
                                isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-indigo-50/60'
                              }`}
                            >
                              <button
                                onClick={() => applyPreset(p)}
                                className="flex-1 text-left min-w-0"
                                title={`Apply this preset: ${summarizePresetFilters(p.filters)}`}
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-medium text-gray-800 truncate max-w-[220px]">
                                    {p.name}
                                  </span>
                                  <span
                                    className={`px-1 py-0.5 rounded text-[9px] font-semibold border ${
                                      p.filters.scope === 'any_template'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                    title={p.filters.scope === 'any_template'
                                      ? 'Reusable across every template'
                                      : 'Scoped to this template only'}
                                  >
                                    {p.filters.scope === 'any_template' ? 'ANY' : 'THIS'}
                                  </span>
                                  {isActive && (
                                    <span className="text-[9px] text-indigo-700 font-semibold">· applied</span>
                                  )}
                                  {/* Default-state indicator(s). A preset
                                      can simultaneously be the template
                                      default AND the cross-template default
                                      (the admin pinned it twice for two
                                      different scopes), so we render both
                                      badges when applicable. */}
                                  {isTplDefault && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300"
                                      title="Auto-applies when you open this template's history"
                                    >
                                      <StarIcon size={8} className="fill-yellow-500 text-yellow-600" />
                                      default · this template
                                    </span>
                                  )}
                                  {isCrossDefault && (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200"
                                      title="Auto-applies on every template's history (unless overridden)"
                                    >
                                      <StarIcon size={8} className="fill-yellow-400 text-yellow-500" />
                                      default · any template
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                  {summarizePresetFilters(p.filters)}
                                </div>
                              </button>
                              {/* Star button: pin / unpin as default for the
                                  preset's natural scope (template-specific
                                  for current_template presets, cross-template
                                  for any_template presets). Filled = pinned;
                                  outline = not pinned. We do NOT mutate any
                                  filter state on click — the default only
                                  takes effect on the NEXT drawer open, which
                                  is the contract the user expects. */}
                              <button
                                onClick={() => {
                                  if (starDisabled) return;
                                  if (starFilled && starBindingToUnset) {
                                    unsetDefaultPreset(starBindingToUnset);
                                  } else {
                                    setDefaultPreset(p, starScope);
                                  }
                                }}
                                disabled={starDisabled}
                                className={`flex-shrink-0 p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                  starFilled
                                    ? 'text-yellow-600 hover:bg-yellow-50'
                                    : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                                }`}
                                title={
                                  starDisabled
                                    ? 'No template loaded — cannot pin a template-specific default'
                                    : starFilled
                                      ? (starScope === 'template'
                                          ? `Unset as default for this template (drawer will fall back to ${isCrossDefault ? 'cross-template default' : 'empty filters'} on next open)`
                                          : 'Unset as cross-template default (drawers will open with empty filters unless a per-template default is set)')
                                      : (starScope === 'template'
                                          ? 'Pin as default for this template — auto-applies on next open'
                                          : 'Pin as cross-template default — auto-applies on every template\'s history (unless overridden)')
                                }
                                aria-label={
                                  starFilled
                                    ? `Unset "${p.name}" as default`
                                    : `Set "${p.name}" as default`
                                }
                                aria-pressed={starFilled}
                              >
                                <StarIcon
                                  size={12}
                                  className={starFilled ? 'fill-yellow-500' : ''}
                                />
                              </button>
                              <button
                                onClick={() => deletePreset(p)}
                                className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                                title={`Delete preset "${p.name}"`}
                                aria-label={`Delete preset ${p.name}`}
                              >
                                <TrashIcon size={11} />
                              </button>
                            </div>
                          );
                        })

                      )}
                      {/* Footer: link to "any-template" presets that aren't
                          applicable to this view — only shown when there
                          are presets the admin saved against OTHER templates,
                          to make the gap explicit. */}
                      {presets.length > applicablePresets.length && (
                        <div className="border-t border-gray-100 mt-1 pt-1 px-2 text-[10px] text-gray-500">
                          {presets.length - applicablePresets.length} preset
                          {presets.length - applicablePresets.length === 1 ? ' is' : 's are'} hidden
                          (saved against other templates).
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Save-current-as-preset button. Disabled when there's
                    nothing to save (every filter at default) since saving
                    "no filters" as a preset would be a footgun — loading
                    it would just clear the bar, which Reset already does. */}
                <button
                  onClick={() => setSaveFormOpen((v) => !v)}
                  disabled={activeFilterCount === 0 && !saveFormOpen}
                  className="px-2.5 py-1.5 text-[11px] rounded-md border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 flex-shrink-0"
                  title={
                    activeFilterCount === 0
                      ? 'Set at least one filter before saving a preset'
                      : saveFormOpen
                        ? 'Cancel save'
                        : 'Save the current filter combination as a named preset'
                  }
                >
                  <BookmarkIcon size={11} />
                  {saveFormOpen ? 'Cancel' : 'Save current filters as preset…'}
                </button>
              </div>

              {/* Inline save form — revealed by the Save button. Asks for
                  a preset name and a scope (this template only vs any
                  template). Pressing Enter inside the name input submits. */}
              {saveFormOpen && (
                <div className="border border-indigo-200 bg-white rounded-md p-2 space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">
                      Preset name
                    </label>
                    <input
                      type="text"
                      value={savePresetName}
                      onChange={(e) => setSavePresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isSavingPreset) {
                          e.preventDefault();
                          savePreset();
                        }
                      }}
                      placeholder="e.g. SOC2 Q3 review — Alice's edits to active flag"
                      maxLength={120}
                      autoFocus
                      disabled={isSavingPreset}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      {savePresetName.trim().length}/120 characters
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">
                      Scope
                    </label>
                    <div className="flex flex-col gap-1">
                      <label className={`flex items-start gap-2 px-2 py-1 rounded border cursor-pointer text-[11px] ${
                        savePresetScope === 'current_template'
                          ? 'border-indigo-400 bg-indigo-50/60'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}>
                        <input
                          type="radio"
                          name="savePresetScope"
                          value="current_template"
                          checked={savePresetScope === 'current_template'}
                          onChange={() => setSavePresetScope('current_template')}
                          disabled={isSavingPreset || !template}
                          className="mt-0.5 accent-indigo-600 cursor-pointer"
                        />
                        <span>
                          <span className="font-medium text-gray-800">Apply to current template only</span>
                          <span className="block text-[10px] text-gray-500">
                            Pinned to {template ? contactName(template.contact_id) : 'this template'}
                            {template && (
                              <> · {WEEKDAYS[template.weekday]} {trimSeconds(template.start_time)}–{trimSeconds(template.end_time)}</>
                            )}
                            . Won't appear in other templates' drawers.
                          </span>
                        </span>
                      </label>
                      <label className={`flex items-start gap-2 px-2 py-1 rounded border cursor-pointer text-[11px] ${
                        savePresetScope === 'any_template'
                          ? 'border-indigo-400 bg-indigo-50/60'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}>
                        <input
                          type="radio"
                          name="savePresetScope"
                          value="any_template"
                          checked={savePresetScope === 'any_template'}
                          onChange={() => setSavePresetScope('any_template')}
                          disabled={isSavingPreset}
                          className="mt-0.5 accent-indigo-600 cursor-pointer"
                        />
                        <span>
                          <span className="font-medium text-gray-800">Apply to any template</span>
                          <span className="block text-[10px] text-gray-500">
                            Reusable in every template's history drawer. Best for generic slices like
                            "last 7 days, fields=role+timezone".
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={savePreset}
                      disabled={isSavingPreset || savePresetName.trim().length === 0}
                      className="px-3 py-1 text-[11px] rounded-md bg-indigo-600 text-white hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      {isSavingPreset && <RefreshIcon className="animate-spin" size={10} />}
                      {isSavingPreset ? 'Saving…' : 'Save preset'}
                    </button>
                    <button
                      onClick={() => { setSaveFormOpen(false); setSavePresetName(''); }}
                      disabled={isSavingPreset}
                      className="px-2 py-1 text-[11px] rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      Saving: {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Filter bar — three client-side controls (date range, changed-by
              multi-select, fields-changed checkboxes) that narrow the version
              list. Sits at the top of the drawer (above the Current card and
              the CSV toolbar) so an admin investigating a SOC2 question can
              dial in the relevant slice of history first, then export
              exactly what they're looking at. */}
          {!isLoading && versions.length > 0 && (
            <div className="border border-gray-200 bg-gray-50 rounded-xl p-3 space-y-3">
              {/* Filter heading + reset button + result counter */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <FilterIcon size={14} className="text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] tabular-nums ${
                      activeFilterCount > 0 ? 'text-orange-700 font-medium' : 'text-gray-500'
                    }`}
                    title="Number of version rows currently visible vs total captured"
                  >
                    Showing {filteredVersions.length} of {versions.length} version{versions.length === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={resetFilters}
                    disabled={activeFilterCount === 0}
                    className="text-[11px] text-gray-600 hover:text-gray-900 underline disabled:no-underline disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Clear every filter and show all captured versions"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* (1) Date range — preset chips + custom from/to. Chips are
                  mutually exclusive so the visual state always matches the
                  underlying datePreset. Picking 'Custom' reveals two date
                  inputs; picking any other preset hides them so the bar
                  doesn't waste vertical space when not needed. */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Date range</div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { value: 'all', label: 'All time' },
                    { value: '24h', label: 'Last 24h' },
                    { value: '7d', label: 'Last 7d' },
                    { value: '30d', label: 'Last 30d' },
                    { value: 'custom', label: 'Custom…' },
                  ] as Array<{ value: DatePreset; label: string }>).map((opt) => {
                    const active = datePreset === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setDatePreset(opt.value)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                          active
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {datePreset === 'custom' && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-gray-700">
                    <label className="flex items-center gap-1">
                      <span className="text-gray-500">From</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        max={dateTo || undefined}
                        className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-gray-500">To</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom || undefined}
                        className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                    </label>
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="text-gray-500 hover:text-gray-700 underline text-[10px]"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* (2) Changed-by multi-select. Collapsed dropdown by default so
                  the bar stays compact; the trigger summarizes the active
                  selection ("3 selected" / "Anyone" / a single name) so the
                  admin can scan it at a glance. Empty options state is
                  surfaced when the loaded versions only have null authors. */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Changed by</div>
                {availableUsers.length === 0 ? (
                  <div className="text-[11px] text-gray-400 italic">No identifiable authors in this history.</div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setUserDropdownOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md border border-gray-300 bg-white text-[11px] text-gray-700 hover:border-orange-400"
                    >
                      <span className="truncate text-left">
                        {changedByFilter.length === 0
                          ? <span className="text-gray-400">Anyone ({availableUsers.length} option{availableUsers.length === 1 ? '' : 's'})</span>
                          : changedByFilter.length === 1
                            ? availableUsers.find((u) => u.id === changedByFilter[0])?.primary || changedByFilter[0]
                            : `${changedByFilter.length} selected`}
                      </span>
                      <ChevronDownIcon
                        size={12}
                        className={`flex-shrink-0 transition-transform text-gray-400 ${userDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {userDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg p-1">
                        {availableUsers.map((u) => {
                          const checked = changedByFilter.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-start gap-2 px-2 py-1 rounded cursor-pointer hover:bg-orange-50 ${
                                checked ? 'bg-orange-50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleChangedBy(u.id)}
                                className="h-3.5 w-3.5 mt-0.5 accent-orange-600 cursor-pointer flex-shrink-0"
                              />
                              <span className="flex flex-col leading-tight min-w-0">
                                <span className="text-[11px] text-gray-800 truncate">{u.primary}</span>
                                {u.secondary && (
                                  <span className="text-[10px] text-gray-400 truncate">{u.secondary}</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                        {changedByFilter.length > 0 && (
                          <div className="border-t border-gray-100 mt-1 pt-1 px-1">
                            <button
                              onClick={() => setChangedByFilter([])}
                              className="text-[10px] text-gray-500 hover:text-gray-700 underline"
                            >
                              Clear selection
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* (3) Field-changed checkbox group. A version passes the
                  filter iff its diff-vs-next-older intersects the chosen
                  set. Genesis row passes regardless — see comment on
                  filteredVersions. We keep these as inline pill checkboxes
                  rather than a dropdown so all 8 options are visible at a
                  glance, since "what kind of change" is usually the
                  primary axis admins want to slice on. */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Field changed</div>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_FILTER_OPTIONS.map((opt) => {
                    const checked = fieldFilter.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-orange-100 border-orange-400 text-orange-800'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-orange-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleField(opt.value)}
                          className="h-3 w-3 accent-orange-600 cursor-pointer"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                {fieldFilter.length > 0 && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    Showing edits that touched: <strong>{fieldFilter.join(', ')}</strong>. The
                    initial (oldest) version is always shown for context.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compliance/audit toolbar — single button that bundles every
              captured version + a derived "what changed in this edit"
              column into a downloadable CSV. Generated entirely client-side
              (Blob URL) so admins can hand the file to SOC2/compliance
              reviewers without granting them DB access. Disabled while
              versions are still loading or when there's nothing to export.
              Honors the active filter: only filtered rows go into the CSV,
              and the disabled state / tooltip reflect filtered count. */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-gray-500 leading-snug">
              Need to share this audit trail with compliance? Download a
              CSV with every captured version, who changed it, and which
              fields each edit modified.
              {activeFilterCount > 0 && (
                <span className="block mt-0.5 text-orange-700">
                  Filters are active — the export will include only the {filteredVersions.length} visible row{filteredVersions.length === 1 ? '' : 's'}.
                </span>
              )}
            </p>
            <button
              onClick={exportCsv}
              disabled={isExporting || isLoading || filteredVersions.length === 0}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 flex-shrink-0"
              title={
                versions.length === 0
                  ? 'No versions captured yet — edit this template at least once to enable export'
                  : filteredVersions.length === 0
                    ? 'Current filters match zero versions — adjust filters or Reset to enable export'
                    : activeFilterCount > 0
                      ? `Download a CSV of the ${filteredVersions.length} filtered version${filteredVersions.length === 1 ? '' : 's'} (of ${versions.length} total) with field-level change diffs`
                      : `Download a CSV of all ${versions.length} captured version${versions.length === 1 ? '' : 's'} (with field-level change diffs)`
              }
            >
              {isExporting
                ? <RefreshIcon className="animate-spin" size={12} />
                : <DownloadIcon size={12} />}
              {isExporting
                ? 'Exporting…'
                : activeFilterCount > 0
                  ? `Export filtered (${filteredVersions.length})`
                  : 'Export audit log (CSV)'}
            </button>
          </div>



          {/* Current state card — non-restorable, just for orientation, but
              checkable so admins can compare any historical version against
              the live state with one click. */}
          {currentRow && (() => {
            const checked = compareSelection.includes('current');
            return (
              <div className={`border rounded-xl p-3 transition-colors ${
                checked
                  ? 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300'
                  : 'border-emerald-200 bg-emerald-50'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCompare('current')}
                      aria-label="Select Current for comparison"
                      title="Select to compare against another version"
                      className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                    />
                    <CheckCircleIcon size={14} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-900">Current</span>
                    <span className="text-[11px] text-emerald-700">live now</span>
                  </div>
                </div>
                <div className="mt-1.5 text-xs text-gray-700 grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <div><strong>Contact:</strong> {contactName(currentRow.contact_id)}</div>
                  <div><strong>Weekday:</strong> {WEEKDAYS[currentRow.weekday]}</div>
                  <div><strong>Hours:</strong> {trimSeconds(currentRow.start_time)}–{trimSeconds(currentRow.end_time)}</div>
                  <div><strong>Role:</strong> {currentRow.role}</div>
                  <div><strong>Timezone:</strong> {currentRow.timezone}</div>
                  <div><strong>Status:</strong> {currentRow.active ? 'Active' : 'Paused'}</div>
                </div>
              </div>
            );
          })()}

          {/* Compare-mode helper banner. Shows persistent guidance whenever
              fewer than two are selected, plus a Clear affordance once one
              is picked. Disappears entirely once the diff panel renders. */}
          {compareSelection.length > 0 && compareSelection.length < 2 && (
            <div className="border border-blue-200 bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-800 flex items-center justify-between gap-2">
              <span>
                <strong>1 selected.</strong> Pick one more (another version or
                Current) to see a side-by-side diff.
              </span>
              <button
                onClick={() => setCompareSelection([])}
                className="text-blue-700 hover:text-blue-900 underline text-xs"
              >
                Clear
              </button>
            </div>
          )}

          {/* Side-by-side two-column diff. Renders only when exactly two
              snapshots are selected (where one may be the live 'current'
              row). Older state on the left with red strikethrough on
              fields that differ; newer state on the right in green. Fields
              that match render as plain muted text on both sides. */}
          {comparePair && (
            <div className="border-2 border-orange-300 bg-orange-50/50 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <ClockIcon size={14} className="text-orange-600" />
                  <span className="text-sm font-semibold text-orange-900">
                    Compare: {comparePair.older.label} → {comparePair.newer.label}
                  </span>
                </div>
                <button
                  onClick={() => setCompareSelection([])}
                  className="text-[11px] text-gray-500 hover:text-gray-700 underline"
                >
                  Clear comparison
                </button>
              </div>

              {/* Two-column header */}
              <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                <div className="bg-red-100 border border-red-200 rounded px-2 py-1">
                  <div className="font-semibold text-red-900">{comparePair.older.label}</div>
                  <div className="text-red-700">{comparePair.older.sublabel} · older</div>
                </div>
                <div className="bg-emerald-100 border border-emerald-200 rounded px-2 py-1">
                  <div className="font-semibold text-emerald-900">{comparePair.newer.label}</div>
                  <div className="text-emerald-700">{comparePair.newer.sublabel} · newer</div>
                </div>
              </div>

              {/* Field-by-field rows. Each field renders the older value on
                  the left and the newer on the right; when they differ, the
                  older is shown with red strikethrough and the newer with a
                  green highlight, mirroring git/GitHub diff conventions. */}
              {(() => {
                // Build display values for each field on each side. We
                // resolve contact_id to a human name via contactName() and
                // trim seconds off times for readability.
                const fieldDefs: Array<{
                  label: string;
                  older: string;
                  newer: string;
                }> = [
                  {
                    label: 'Contact',
                    older: contactName(comparePair.older.contact_id),
                    newer: contactName(comparePair.newer.contact_id),
                  },
                  {
                    label: 'Weekday',
                    older: WEEKDAYS[comparePair.older.weekday] ?? String(comparePair.older.weekday),
                    newer: WEEKDAYS[comparePair.newer.weekday] ?? String(comparePair.newer.weekday),
                  },
                  {
                    label: 'Start time',
                    older: trimSeconds(comparePair.older.start_time),
                    newer: trimSeconds(comparePair.newer.start_time),
                  },
                  {
                    label: 'End time',
                    older: trimSeconds(comparePair.older.end_time),
                    newer: trimSeconds(comparePair.newer.end_time),
                  },
                  {
                    label: 'Role',
                    older: comparePair.older.role,
                    newer: comparePair.newer.role,
                  },
                  {
                    label: 'Timezone',
                    older: comparePair.older.timezone,
                    newer: comparePair.newer.timezone,
                  },
                  {
                    label: 'Active',
                    older: comparePair.older.active ? 'Active' : 'Paused',
                    newer: comparePair.newer.active ? 'Active' : 'Paused',
                  },
                  {
                    label: 'Notes',
                    older: comparePair.older.notes || '—',
                    newer: comparePair.newer.notes || '—',
                  },
                ];

                const anyDifferent = fieldDefs.some((f) => f.older !== f.newer);

                return (
                  <>
                    {!anyDifferent && (
                      <div className="text-[11px] text-emerald-700 inline-flex items-center gap-1 mb-2">
                        <CheckCircleIcon size={10} />
                        These two snapshots are identical across every audited field.
                      </div>
                    )}
                    <div className="divide-y divide-gray-200 border border-gray-200 rounded bg-white">
                      {fieldDefs.map((f) => {
                        const differs = f.older !== f.newer;
                        return (
                          <div key={f.label} className="grid grid-cols-[80px_1fr_1fr] gap-2 px-2 py-1.5 text-[11px]">
                            <div className="font-semibold text-gray-600 self-center">{f.label}</div>
                            <div
                              className={`break-words ${
                                differs
                                  ? 'bg-red-50 text-red-900 line-through decoration-red-400 px-1 py-0.5 rounded'
                                  : 'text-gray-700'
                              }`}
                              title={differs ? `Was: ${f.older}` : f.older}
                            >
                              {f.older || <span className="text-gray-300">—</span>}
                            </div>
                            <div
                              className={`break-words ${
                                differs
                                  ? 'bg-emerald-50 text-emerald-900 font-medium px-1 py-0.5 rounded'
                                  : 'text-gray-700'
                              }`}
                              title={differs ? `Now: ${f.newer}` : f.newer}
                            >
                              {f.newer || <span className="text-gray-300">—</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}


          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshIcon className="animate-spin text-gray-400" size={24} />
            </div>
          ) : versions.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
              No previous versions yet. The trigger captures a snapshot every time the
              contact, weekday, hours, role, timezone, active flag, or notes change — edit
              this template once and a version will appear here.
            </div>
          ) : filteredVersions.length === 0 ? (
            // Versions exist but none pass the active filter set. Surface
            // a clear, actionable empty state with a one-click escape hatch
            // so the admin doesn't have to hunt for the Reset button.
            <div className="border border-dashed border-orange-300 bg-orange-50/50 rounded-xl p-6 text-center text-sm text-orange-800">
              <div className="font-medium mb-1">No versions match the current filters</div>
              <div className="text-[11px] text-orange-700 mb-3">
                {versions.length} captured version{versions.length === 1 ? ' is' : 's are'} hidden by the {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}.
              </div>
              <button
                onClick={resetFilters}
                className="px-3 py-1 text-xs rounded-md bg-orange-600 text-white hover:bg-orange-700 font-medium"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredVersions.map((v) => {

              const diff = currentRow ? diffFields(v.snapshot, currentRow) : [];
              const isRestoring = restoringId === v.id;
              const checked = compareSelection.includes(v.id);
              return (
                <div
                  key={v.id}
                  className={`border rounded-xl p-3 transition-colors ${
                    checked
                      ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-300'
                      : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCompare(v.id)}
                          aria-label={`Select v${v.version_number} for comparison`}
                          title={
                            checked
                              ? 'Deselect from comparison'
                              : compareSelection.length === 0
                                ? 'Select to compare against another version'
                                : compareSelection.length === 1
                                  ? `Compare v${v.version_number} with the other selection`
                                  : 'Already 2 selected — picking this drops the older selection'
                          }
                          className="h-3.5 w-3.5 accent-orange-600 cursor-pointer"
                        />
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                          v{v.version_number}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {fmtRelative(v.changed_at)}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(v.changed_at).toLocaleString()}
                        </span>
                      </div>

                      {v.changed_by && (() => {
                        const resolved = userMap[v.changed_by];
                        // Initial for the avatar circle: prefer display_name's
                        // first letter, then email's first letter, then '?'.
                        const initial = (
                          resolved?.display_name?.[0]
                          || resolved?.email?.[0]
                          || '?'
                        ).toUpperCase();
                        // Primary label: display_name if resolved, else email,
                        // else a uuid prefix as a last resort.
                        const primary = resolved?.display_name
                          || resolved?.email
                          || `${v.changed_by.slice(0, 8)}…`;
                        // Show email as a muted secondary line ONLY when the
                        // primary label is the display_name (avoids showing
                        // the same string twice).
                        const showEmailSecondary = !!resolved?.display_name && !!resolved?.email
                          && resolved.display_name !== resolved.email;
                        return (
                          <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-1.5">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold border border-orange-200 flex-shrink-0"
                              title={resolved ? 'Resolved via lookup-admin-users' : 'User not found in auth.users — showing uuid prefix'}
                            >
                              {initial}
                            </span>
                            <span className="flex flex-col leading-tight min-w-0">
                              <span
                                className="truncate max-w-[200px] font-medium text-gray-700"
                                title={resolved ? `${resolved.display_name}${resolved.email ? ` (${resolved.email})` : ''} · ${v.changed_by}` : v.changed_by}
                              >
                                {primary}
                              </span>
                              {showEmailSecondary && (
                                <span className="truncate max-w-[200px] text-[10px] text-gray-400">
                                  {resolved!.email}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      onClick={() => restore(v)}
                      disabled={isRestoring || restoringId !== null}
                      className="px-2.5 py-1 text-xs rounded-md bg-orange-600 text-white hover:bg-orange-700 font-medium disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                      title="Roll the template back to this snapshot"
                    >
                      {isRestoring && <RefreshIcon className="animate-spin" size={10} />}
                      {isRestoring ? 'Restoring…' : 'Restore this version'}
                    </button>
                  </div>

                  {/* Snapshot field summary */}
                  <div className="mt-2 text-[11px] text-gray-700 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <div>
                      <strong>Contact:</strong> {contactName(v.snapshot.contact_id)}
                    </div>
                    <div>
                      <strong>Weekday:</strong> {WEEKDAYS[v.snapshot.weekday]}
                    </div>
                    <div>
                      <strong>Hours:</strong> {trimSeconds(v.snapshot.start_time)}–{trimSeconds(v.snapshot.end_time)}
                    </div>
                    <div>
                      <strong>Role:</strong> {v.snapshot.role}
                    </div>
                    <div>
                      <strong>Timezone:</strong> {v.snapshot.timezone}
                    </div>
                    <div>
                      <strong>Status:</strong> {v.snapshot.active ? 'Active' : 'Paused'}
                    </div>
                  </div>

                  {/* "What changed since this version" diff chips */}
                  {diff.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">
                        Differs from current:
                      </span>
                      {diff.map((field) => (
                        <span
                          key={field}
                          className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  )}
                  {diff.length === 0 && currentRow && (
                    <div className="mt-2 text-[10px] text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircleIcon size={10} />
                      Identical to current
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateVersionHistoryDrawer;
