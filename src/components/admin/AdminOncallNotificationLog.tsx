import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { database as supabase } from '@/lib/database';
import {
  RefreshIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FileTextIcon,
  CalendarIcon,
} from '@/components/ui/Icons';
import AutoCoverGapModal, {
  ContactOption,
  ProposedTemplate,
  deriveTemplateFromGap,
} from './AutoCoverGapModal';
import { useAdminTab } from '@/contexts/AdminTabContext';


type WindowKey = '24h' | '7d' | '30d';

const WINDOW_LABEL: Record<WindowKey, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

const WINDOW_HOURS: Record<WindowKey, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

interface NotificationRow {
  id: string;
  digest_id: string;
  scan_id: string | null;
  channel: 'email' | 'sms' | string;
  contact_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  gap_count: number | null;
  gap_ids: string[] | null;
  gap_fingerprints: string[] | null;
  window_days: number | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface EscalationRow {
  id: string;
  digest_id: string;
  scan_id: string | null;
  triggered_at: string;
  digest_sent_at: string | null;
  tier: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  unresolved_gap_count: number | null;
  unresolved_gap_ids: string[] | null;
  templates_created_since_digest: number | null;
  status: string;
  skip_reason: string | null;
  error_message: string | null;
  twilio_sid: string | null;
  resolved_by_template_id: string | null;
  created_at: string;
}


interface CoverageGapRow {
  id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number | null;
  weekday: number | null;
  resolved: boolean;
  resolved_at: string | null;
}

interface DigestStatusRow {
  digest_id: string;
  handled_by: string | null;
  handled_at: string;
  handled_reason: string | null;
  notes: string | null;
}

interface DigestGroup {
  digest_id: string;
  first_sent_at: string;
  notifications: NotificationRow[];
  escalations: EscalationRow[];
  gap_ids: string[];
  gaps: CoverageGapRow[];
  status: DigestStatusRow | null;
}

const HANDLED_REASONS = [
  'Covered manually (one-off shift added)',
  'Covered by recurring template',
  'False alarm / detection bug',
  'Outside business hours — acceptable gap',
  'Other',
];

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const fmtRelative = (iso: string | null | undefined) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
};

const csvEscape = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const triggerCsvDownload = (filename: string, rows: string[][]) => {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const AdminOncallNotificationLog: React.FC = () => {
  const [windowKey, setWindowKey] = useState<WindowKey>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [gaps, setGaps] = useState<Record<string, CoverageGapRow>>({});
  const [statuses, setStatuses] = useState<Record<string, DigestStatusRow>>({});
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [resendingDigestId, setResendingDigestId] = useState<string | null>(null);
  const [handlingDigestId, setHandlingDigestId] = useState<string | null>(null);
  const [coveringGapId, setCoveringGapId] = useState<string | null>(null);
  const [markHandledModal, setMarkHandledModal] = useState<{
    digestId: string;
    initial?: DigestStatusRow | null;
  } | null>(null);
  const [autoCoverModal, setAutoCoverModal] = useState<{
    gap: CoverageGapRow;
    digestId: string;
  } | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);


  const sinceIso = useMemo(() => {
    const hours = WINDOW_HOURS[windowKey];
    return new Date(Date.now() - hours * 3600_000).toISOString();
  }, [windowKey]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notifRes, escRes, contactsRes] = await Promise.all([
        supabase
          .from('admin_oncall_notification_log')
          .select('*')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('admin_oncall_escalation_log')
          .select('*')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('admin_emergency_contacts')
          .select('id, name, role, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      const notifs = (notifRes.data || []) as NotificationRow[];
      const escs = (escRes.data || []) as EscalationRow[];
      setNotifications(notifs);
      setEscalations(escs);

      const contactRows = (contactsRes.data || []) as Array<{
        id: string;
        name: string;
        role: string | null;
      }>;
      setContacts(contactRows.map((c) => ({ id: c.id, name: c.name, role: c.role })));

      // Collect referenced gap_ids
      const gapIdSet = new Set<string>();
      for (const n of notifs) (n.gap_ids || []).forEach((g) => gapIdSet.add(g));
      for (const e of escs) (e.unresolved_gap_ids || []).forEach((g) => gapIdSet.add(g));

      // Collect referenced digest_ids
      const digestIdSet = new Set<string>();
      for (const n of notifs) if (n.digest_id) digestIdSet.add(n.digest_id);
      for (const e of escs) if (e.digest_id) digestIdSet.add(e.digest_id);

      // Load gaps in chunks
      if (gapIdSet.size > 0) {
        const ids = Array.from(gapIdSet);
        const chunkSize = 200;
        const map: Record<string, CoverageGapRow> = {};
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data } = await supabase
            .from('admin_oncall_coverage_gaps')
            .select('id, starts_at, ends_at, duration_minutes, weekday, resolved, resolved_at')
            .in('id', chunk);
          for (const g of (data || []) as CoverageGapRow[]) map[g.id] = g;
        }
        setGaps(map);
      } else {
        setGaps({});
      }

      // Load digest_status rows for any digest in the window
      if (digestIdSet.size > 0) {
        const ids = Array.from(digestIdSet);
        const chunkSize = 200;
        const map: Record<string, DigestStatusRow> = {};
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data } = await supabase
            .from('admin_oncall_digest_status')
            .select('digest_id, handled_by, handled_at, handled_reason, notes')
            .in('digest_id', chunk);
          for (const s of (data || []) as DigestStatusRow[]) map[s.digest_id] = s;
        }
        setStatuses(map);
      } else {
        setStatuses({});
      }
    } catch (err: any) {
      setToast({ kind: 'err', msg: `Failed to load: ${err?.message || err}` });
    } finally {
      setIsLoading(false);
    }
  }, [sinceIso]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group by digest_id
  const groups = useMemo<DigestGroup[]>(() => {
    const byId = new Map<string, DigestGroup>();
    for (const n of notifications) {
      if (!n.digest_id) continue;
      let g = byId.get(n.digest_id);
      if (!g) {
        g = {
          digest_id: n.digest_id,
          first_sent_at: n.sent_at || n.created_at,
          notifications: [],
          escalations: [],
          gap_ids: [],
          gaps: [],
          status: null,
        };
        byId.set(n.digest_id, g);
      }
      g.notifications.push(n);
      const ts = n.sent_at || n.created_at;
      if (ts && new Date(ts).getTime() < new Date(g.first_sent_at).getTime()) {
        g.first_sent_at = ts;
      }
    }
    for (const e of escalations) {
      if (!e.digest_id) continue;
      let g = byId.get(e.digest_id);
      if (!g) {
        g = {
          digest_id: e.digest_id,
          first_sent_at: e.digest_sent_at || e.created_at,
          notifications: [],
          escalations: [],
          gap_ids: [],
          gaps: [],
          status: null,
        };
        byId.set(e.digest_id, g);
      }
      g.escalations.push(e);
    }

    const result: DigestGroup[] = [];
    for (const g of byId.values()) {
      const gapIdSet = new Set<string>();
      for (const n of g.notifications) (n.gap_ids || []).forEach((id) => gapIdSet.add(id));
      for (const e of g.escalations) (e.unresolved_gap_ids || []).forEach((id) => gapIdSet.add(id));
      g.gap_ids = Array.from(gapIdSet);
      g.gaps = g.gap_ids.map((id) => gaps[id]).filter(Boolean) as CoverageGapRow[];
      g.status = statuses[g.digest_id] || null;
      result.push(g);
    }
    result.sort(
      (a, b) => new Date(b.first_sent_at).getTime() - new Date(a.first_sent_at).getTime(),
    );
    return result;
  }, [notifications, escalations, gaps, statuses]);

  const summary = useMemo(() => {
    const totalDigests = groups.length;
    let emailRows = 0;
    let smsRows = 0;
    let escSent = 0;
    let unresolvedDigests = 0;
    let handledDigests = 0;
    for (const g of groups) {
      for (const n of g.notifications) {
        if (n.channel === 'email' && n.status === 'sent') emailRows++;
        if (n.channel === 'sms' && n.status === 'sent') smsRows++;
      }
      for (const e of g.escalations) {
        if (e.status === 'sent') escSent++;
      }
      const unresolved = g.gaps.some((gap) => !gap.resolved);
      if (unresolved && g.gaps.length > 0) unresolvedDigests++;
      if (g.status) handledDigests++;
    }
    return { totalDigests, emailRows, smsRows, escSent, unresolvedDigests, handledDigests };
  }, [groups]);

  const handleResend = async (digestId: string) => {
    setResendingDigestId(digestId);
    setToast(null);
    try {
      const { data, error } = await supabase.functions.invoke('escalate-unfixed-gaps', {
        body: { digest_id: digestId, force_backup_tier: true },
      });
      if (error) throw error;
      const summaryMsg =
        (data && (data.message || data.skip_reason)) ||
        `Escalation re-run dispatched for digest ${digestId.slice(0, 8)}…`;
      setToast({ kind: 'ok', msg: String(summaryMsg) });
      await loadData();
    } catch (err: any) {
      setToast({
        kind: 'err',
        msg: `Resend failed: ${err?.message || err}`,
      });
    } finally {
      setResendingDigestId(null);
    }
  };

  const handleSubmitHandled = async (
    digestId: string,
    handled_reason: string,
    notes: string,
  ) => {
    setHandlingDigestId(digestId);
    setToast(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const handled_by = userData?.user?.id ?? null;
      const payload = {
        digest_id: digestId,
        handled_by,
        handled_at: new Date().toISOString(),
        handled_reason: handled_reason || null,
        notes: notes || null,
      };
      const { error } = await supabase
        .from('admin_oncall_digest_status')
        .upsert(payload, { onConflict: 'digest_id' });
      if (error) throw error;
      setToast({
        kind: 'ok',
        msg: `Digest ${digestId.slice(0, 8)}… marked handled — future escalations suppressed.`,
      });
      setMarkHandledModal(null);
      await loadData();
    } catch (err: any) {
      setToast({
        kind: 'err',
        msg: `Failed to mark handled: ${err?.message || err}`,
      });
    } finally {
      setHandlingDigestId(null);
    }
  };

  const handleClearHandled = async (digestId: string) => {
    setHandlingDigestId(digestId);
    setToast(null);
    try {
      const { error } = await supabase
        .from('admin_oncall_digest_status')
        .delete()
        .eq('digest_id', digestId);
      if (error) throw error;
      setToast({
        kind: 'ok',
        msg: `Cleared handled state for digest ${digestId.slice(0, 8)}…`,
      });
      await loadData();
    } catch (err: any) {
      setToast({ kind: 'err', msg: `Failed to clear: ${err?.message || err}` });
    } finally {
      setHandlingDigestId(null);
    }
  };

  /**
   * True iff the given gap window falls entirely inside the template's
   * recurring slot, evaluated in the template's own timezone. Used to decide
   * which sibling gaps in the same digest should be marked resolved when
   * an admin auto-creates a covering template from one specific gap row.
   */
  const templateCoversGap = (
    tpl: ProposedTemplate,
    gap: { starts_at: string; ends_at: string },
  ): boolean => {
    try {
      const derived = deriveTemplateFromGap(gap, tpl.timezone);
      if (derived.weekday !== tpl.weekday) return false;
      // Same-day, no wraparound.
      if (tpl.start_time >= tpl.end_time) return false;
      return derived.start_time >= tpl.start_time && derived.end_time <= tpl.end_time;
    } catch {
      return false;
    }
  };

  const handleAutoCoverGap = async (
    proposed: ProposedTemplate,
    rootGap: CoverageGapRow,
    digestId: string,
  ) => {
    setCoveringGapId(rootGap.id);
    setToast(null);
    try {
      // 1. Insert the template.
      const { data: insertedTpl, error: insErr } = await supabase
        .from('admin_oncall_shift_templates')
        .insert({
          contact_id: proposed.contact_id,
          weekday: proposed.weekday,
          start_time: proposed.start_time,
          end_time: proposed.end_time,
          role: proposed.role,
          timezone: proposed.timezone,
          active: proposed.active,
          notes: proposed.notes,
        })
        .select('id, weekday, start_time, end_time, timezone, role, contact_id')
        .single();
      if (insErr || !insertedTpl) {
        throw new Error(insErr?.message || 'Failed to insert template');
      }
      const templateId = insertedTpl.id as string;

      // 2. Find which gaps in this digest the new template covers.
      const digestGroup = groups.find((g) => g.digest_id === digestId);
      const candidateGaps = digestGroup?.gaps || [rootGap];
      const coveredIds: string[] = [];
      for (const cg of candidateGaps) {
        if (cg.resolved) continue;
        if (templateCoversGap(proposed, cg)) {
          coveredIds.push(cg.id);
        }
      }
      // The clicked gap should always be considered covered (we derived the
      // template from it); guard against tz drift edge-cases.
      if (!coveredIds.includes(rootGap.id) && !rootGap.resolved) {
        coveredIds.push(rootGap.id);
      }

      // 3. Mark those gaps resolved.
      const nowIso = new Date().toISOString();
      if (coveredIds.length > 0) {
        const { error: updErr } = await supabase
          .from('admin_oncall_coverage_gaps')
          .update({
            resolved: true,
            resolved_at: nowIso,
            notes: `Auto-resolved by template ${templateId} (digest ${digestId.slice(0, 8)})`,
          })
          .in('id', coveredIds);
        if (updErr) throw new Error(updErr.message);
      }

      // 4. Re-run detect-oncall-coverage-gaps so the unresolved-gap inventory
      //    is refreshed (without firing a fresh notification email).
      let rescanError: string | null = null;
      try {
        const { error: detectErr } = await supabase.functions.invoke(
          'detect-oncall-coverage-gaps',
          { body: { notify: false } },
        );
        if (detectErr) rescanError = detectErr.message || String(detectErr);
      } catch (e: any) {
        rescanError = e?.message || 'rescan_failed';
      }

      // 5. Audit row in admin_oncall_escalation_log linking template -> digest.
      // Hydrate scan_id + digest_sent_at from any notification row for this digest.
      const sourceNotif = (digestGroup?.notifications || []).find(
        (n) => n.scan_id || n.sent_at,
      );
      const auditPayload = {
        digest_id: digestId,
        scan_id: sourceNotif?.scan_id || null,
        triggered_at: nowIso,
        digest_sent_at: sourceNotif?.sent_at || null,
        tier: 'auto_resolve',
        contact_id: null,
        contact_name: null,
        contact_phone: null,
        unresolved_gap_count: Math.max(
          0,
          (digestGroup?.gaps.filter((x) => !x.resolved).length || 0) - coveredIds.length,
        ),
        unresolved_gap_ids: (digestGroup?.gaps || [])
          .filter((x) => !x.resolved && !coveredIds.includes(x.id))
          .map((x) => x.id),
        unresolved_gap_fingerprints: [] as string[],
        templates_created_since_digest: 1,
        status: 'skipped',
        skip_reason: 'auto_resolved_by_template',
        error_message: `Auto-created template ${templateId}; resolved ${coveredIds.length}/${candidateGaps.length} gap(s) in this digest.${
          rescanError ? ` Rescan warning: ${rescanError}` : ''
        }`,
        twilio_sid: null,
        resolved_by_template_id: templateId,
      };
      const { error: auditErr } = await supabase
        .from('admin_oncall_escalation_log')
        .insert(auditPayload);
      if (auditErr) {
        // Non-fatal — the template + resolution still happened.
        console.warn('Failed to write escalation audit row', auditErr.message);
      }

      setToast({
        kind: 'ok',
        msg:
          `Created template ${templateId.slice(0, 8)}… and resolved ` +
          `${coveredIds.length} gap${coveredIds.length === 1 ? '' : 's'} in this digest` +
          `${rescanError ? ` (rescan warning: ${rescanError})` : ''}.`,
      });
      setAutoCoverModal(null);
      await loadData();
    } catch (err: any) {
      setToast({
        kind: 'err',
        msg: `Auto-cover failed: ${err?.message || err}`,
      });
    } finally {
      setCoveringGapId(null);
    }
  };

  const handleExportCsv = () => {
    const rows: string[][] = [
      [
        'digest_id',
        'first_sent_at',
        'channel_or_event',
        'tier',
        'status',
        'contact_name',
        'contact_destination',
        'gap_count',
        'unresolved_gap_count',
        'gap_ids',
        'templates_created_since_digest',
        'twilio_sid',
        'error_message',
        'skip_reason',
        'event_at',
        'handled',
        'handled_at',
        'handled_reason',
        'resolved_by_template_id',
      ],
    ];
    for (const g of groups) {
      const unresolvedCount = g.gaps.filter((x) => !x.resolved).length;
      const handledFlag = g.status ? 'true' : 'false';
      const handledAt = g.status?.handled_at || '';
      const handledReason = g.status?.handled_reason || '';
      for (const n of g.notifications) {
        rows.push([
          g.digest_id,
          g.first_sent_at,
          `notification:${n.channel}`,
          '',
          n.status,
          n.contact_name || '',
          n.contact_email || '',
          String(n.gap_count ?? ''),
          String(unresolvedCount),
          (n.gap_ids || []).join('|'),
          '',
          '',
          n.error_message || '',
          '',
          n.sent_at || n.created_at,
          handledFlag,
          handledAt,
          handledReason,
          '',
        ]);
      }
      for (const e of g.escalations) {
        rows.push([
          g.digest_id,
          g.first_sent_at,
          'escalation',
          e.tier,
          e.status,
          e.contact_name || '',
          e.contact_phone || '',
          '',
          String(e.unresolved_gap_count ?? ''),
          (e.unresolved_gap_ids || []).join('|'),
          String(e.templates_created_since_digest ?? ''),
          e.twilio_sid || '',
          e.error_message || '',
          e.skip_reason || '',
          e.triggered_at || e.created_at,
          handledFlag,
          handledAt,
          handledReason,
          e.resolved_by_template_id || '',
        ]);
      }
    }
    triggerCsvDownload(
      `oncall-notification-log-${windowKey}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">On-Call Notification Log</h2>
          <p className="text-sm text-gray-500">
            Combined timeline of coverage-gap digests and follow-up escalations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            {(['24h', '7d', '30d'] as WindowKey[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindowKey(w)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  windowKey === w
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshIcon size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={groups.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileTextIcon size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
            toast.kind === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.kind === 'ok' ? (
            <CheckCircleIcon size={16} className="mt-0.5" />
          ) : (
            <AlertTriangleIcon size={16} className="mt-0.5" />
          )}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-current opacity-60 hover:opacity-100">
            <XCircleIcon size={16} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <SummaryCard label="Digests" value={summary.totalDigests} accent="purple" />
        <SummaryCard label="Emails sent" value={summary.emailRows} accent="blue" />
        <SummaryCard label="SMS sent" value={summary.smsRows} accent="green" />
        <SummaryCard label="Escalations sent" value={summary.escSent} accent="amber" />
        <SummaryCard label="Unresolved" value={summary.unresolvedDigests} accent="red" />
        <SummaryCard label="Handled" value={summary.handledDigests} accent="emerald" />
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshIcon className="animate-spin text-gray-400" size={28} />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <CheckCircleIcon className="mx-auto text-green-500" size={40} />
          <p className="mt-3 text-gray-700 font-medium">No coverage-gap digests in this window</p>
          <p className="text-sm text-gray-500">
            That's a good thing — every on-call shift is covered.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <DigestCard
              key={g.digest_id}
              group={g}
              onResend={handleResend}
              onMarkHandled={(digestId) =>
                setMarkHandledModal({ digestId, initial: g.status })
              }
              onClearHandled={handleClearHandled}
              onAutoCoverGap={(gap) =>
                setAutoCoverModal({ gap, digestId: g.digest_id })
              }
              coveringGapId={coveringGapId}
              isResending={resendingDigestId === g.digest_id}
              isHandling={handlingDigestId === g.digest_id}
            />
          ))}
        </div>
      )}

      {markHandledModal && (
        <MarkHandledModal
          digestId={markHandledModal.digestId}
          initial={markHandledModal.initial ?? null}
          isSubmitting={handlingDigestId === markHandledModal.digestId}
          onClose={() => setMarkHandledModal(null)}
          onSubmit={handleSubmitHandled}
        />
      )}

      {autoCoverModal && (
        <AutoCoverGapModal
          gap={autoCoverModal.gap}
          digestId={autoCoverModal.digestId}
          contacts={contacts}
          isSubmitting={coveringGapId === autoCoverModal.gap.id}
          onClose={() => setAutoCoverModal(null)}
          onConfirm={(proposed) =>
            handleAutoCoverGap(proposed, autoCoverModal.gap, autoCoverModal.digestId)
          }
        />
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: number;
  accent: 'purple' | 'blue' | 'green' | 'amber' | 'red' | 'emerald';
}> = ({ label, value, accent }) => {
  const accentMap: Record<string, string> = {
    purple: 'text-purple-700 bg-purple-50',
    blue: 'text-blue-700 bg-blue-50',
    green: 'text-green-700 bg-green-50',
    amber: 'text-amber-700 bg-amber-50',
    red: 'text-red-700 bg-red-50',
    emerald: 'text-emerald-700 bg-emerald-50',
  };
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className={`mt-1 inline-flex px-2 py-1 rounded-md text-2xl font-bold ${accentMap[accent]}`}>
        {value}
      </div>
    </div>
  );
};

const ChannelBadge: React.FC<{ channel: string; status: string }> = ({ channel, status }) => {
  const isSent = status === 'sent';
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium';
  if (channel === 'email') {
    return (
      <span
        className={`${base} ${
          isSent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 line-through'
        }`}
      >
        Email
      </span>
    );
  }
  if (channel === 'sms') {
    return (
      <span
        className={`${base} ${
          isSent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 line-through'
        }`}
      >
        SMS
      </span>
    );
  }
  return <span className={`${base} bg-gray-100 text-gray-700`}>{channel}</span>;
};

const TierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const isPrimary = tier === 'primary';
  const isAuto = tier === 'auto_resolve';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
        isAuto
          ? 'bg-emerald-100 text-emerald-700'
          : isPrimary
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700'
      }`}
    >
      {isAuto ? 'Auto-resolve' : isPrimary ? 'Primary tier' : 'Backup tier'}
    </span>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    sent: 'bg-green-100 text-green-700',
    skipped: 'bg-gray-100 text-gray-600',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-xs font-medium ${
        map[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
};

const DigestCard: React.FC<{
  group: DigestGroup;
  onResend: (digestId: string) => void;
  onMarkHandled: (digestId: string) => void;
  onClearHandled: (digestId: string) => void;
  onAutoCoverGap?: (gap: CoverageGapRow) => void;
  coveringGapId?: string | null;
  isResending: boolean;
  isHandling: boolean;
}> = ({ group, onResend, onMarkHandled, onClearHandled, onAutoCoverGap, coveringGapId, isResending, isHandling }) => {

  const [open, setOpen] = useState(false);
  // Used by the "auto-resolved by template …" badge under each escalation row
  // to deep-link into the Shift Schedule tab with the matching template_id
  // already focused/highlighted.
  const { goToTab } = useAdminTab();


  const channelsHit = useMemo(() => {
    const set = new Set<string>();
    for (const n of group.notifications) {
      if (n.status === 'sent') set.add(n.channel);
    }
    return set;
  }, [group.notifications]);

  const escalationTier = useMemo(() => {
    let reached: 'none' | 'primary' | 'backup' = 'none';
    for (const e of group.escalations) {
      if (e.status === 'sent') {
        if (e.tier === 'backup') reached = 'backup';
        else if (e.tier === 'primary' && reached === 'none') reached = 'primary';
      }
    }
    return reached;
  }, [group.escalations]);

  const uniqueContacts = useMemo(() => {
    const map = new Map<string, { name: string; dest: string; channel: string; status: string }>();
    for (const n of group.notifications) {
      const key = `${n.channel}:${n.contact_id || n.contact_email || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          name: n.contact_name || '(unnamed)',
          dest: n.contact_email || '',
          channel: n.channel,
          status: n.status,
        });
      }
    }
    return Array.from(map.values());
  }, [group.notifications]);

  const totalGaps = group.gaps.length || group.gap_ids.length;
  const unresolvedGaps = group.gaps.filter((x) => !x.resolved).length;
  const resolvedAll = totalGaps > 0 && unresolvedGaps === 0;
  const isHandled = !!group.status;

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
        isHandled ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-100'
      }`}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-500">
                digest {group.digest_id.slice(0, 8)}…
              </span>
              {channelsHit.has('email') && <ChannelBadge channel="email" status="sent" />}
              {channelsHit.has('sms') && <ChannelBadge channel="sms" status="sent" />}
              {escalationTier !== 'none' && (
                <TierBadge tier={escalationTier === 'backup' ? 'backup' : 'primary'} />
              )}
              {isHandled && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"
                  title={`Handled ${fmtDateTime(group.status!.handled_at)}${
                    group.status!.handled_reason ? ` · ${group.status!.handled_reason}` : ''
                  }`}
                >
                  <CheckCircleIcon size={12} /> Handled
                </span>
              )}
              {!isHandled && resolvedAll ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircleIcon size={12} /> all resolved
                </span>
              ) : !isHandled && unresolvedGaps > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">
                  <AlertTriangleIcon size={12} /> {unresolvedGaps} unresolved
                </span>
              ) : !isHandled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                  no gap data
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-gray-700">
              <ClockIcon size={12} className="inline mr-1 text-gray-400" />
              Sent {fmtDateTime(group.first_sent_at)}{' '}
              <span className="text-gray-400">· {fmtRelative(group.first_sent_at)}</span>
              <span className="ml-3 text-gray-500">
                {totalGaps} gap{totalGaps === 1 ? '' : 's'}
              </span>
              <span className="ml-3 text-gray-500">
                {uniqueContacts.length} contact{uniqueContacts.length === 1 ? '' : 's'} paged
              </span>
              <span className="ml-3 text-gray-500">
                {group.escalations.length} escalation event
                {group.escalations.length === 1 ? '' : 's'}
              </span>
            </p>
            {isHandled && group.status && (
              <p className="mt-1 text-xs text-emerald-700">
                Marked handled {fmtRelative(group.status.handled_at)}
                {group.status.handled_reason && (
                  <> · <span className="font-medium">{group.status.handled_reason}</span></>
                )}
                {group.status.notes && (
                  <> · <span className="text-emerald-600">{group.status.notes}</span></>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isHandled ? (
              <button
                onClick={() => onClearHandled(group.digest_id)}
                disabled={isHandling}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Re-open this digest — escalations may fire again"
              >
                {isHandling ? (
                  <RefreshIcon size={14} className="animate-spin" />
                ) : (
                  <XCircleIcon size={14} />
                )}
                Re-open
              </button>
            ) : (
              <button
                onClick={() => onMarkHandled(group.digest_id)}
                disabled={isHandling}
                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Manually close the loop on this digest — suppresses future escalations"
              >
                {isHandling ? (
                  <RefreshIcon size={14} className="animate-spin" />
                ) : (
                  <CheckCircleIcon size={14} />
                )}
                Mark digest handled
              </button>
            )}
            <button
              onClick={() => onResend(group.digest_id)}
              disabled={isResending}
              className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Re-run escalate-unfixed-gaps with force_backup_tier=true"
            >
              {isResending ? (
                <RefreshIcon size={14} className="animate-spin" />
              ) : (
                <AlertTriangleIcon size={14} />
              )}
              Resend escalation (backup)
            </button>
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              {open ? 'Hide details' : 'View details'}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-5">
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Notifications ({group.notifications.length})
            </h4>
            {group.notifications.length === 0 ? (
              <p className="text-sm text-gray-500">No notification rows in this window.</p>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">When</th>
                      <th className="text-left px-3 py-2 font-medium">Channel</th>
                      <th className="text-left px-3 py-2 font-medium">Contact</th>
                      <th className="text-left px-3 py-2 font-medium">Destination</th>
                      <th className="text-left px-3 py-2 font-medium">Gaps</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.notifications.map((n) => (
                      <tr key={n.id}>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {fmtDateTime(n.sent_at || n.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <ChannelBadge channel={n.channel} status={n.status} />
                        </td>
                        <td className="px-3 py-2 text-gray-700">{n.contact_name || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                          {n.contact_email || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{n.gap_count ?? 0}</td>
                        <td className="px-3 py-2">
                          <StatusPill status={n.status} />
                          {n.error_message && (
                            <div className="text-xs text-red-600 mt-1">{n.error_message}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Escalations ({group.escalations.length})
            </h4>
            {group.escalations.length === 0 ? (
              <p className="text-sm text-gray-500">
                No escalation has fired for this digest yet. The 30-minute follow-up window may not
                have elapsed.
              </p>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Triggered</th>
                      <th className="text-left px-3 py-2 font-medium">Tier</th>
                      <th className="text-left px-3 py-2 font-medium">Contact</th>
                      <th className="text-left px-3 py-2 font-medium">Phone</th>
                      <th className="text-left px-3 py-2 font-medium">Unresolved</th>
                      <th className="text-left px-3 py-2 font-medium">Templates added</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.escalations.map((e) => (
                      <tr key={e.id}>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {fmtDateTime(e.triggered_at || e.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <TierBadge tier={e.tier} />
                        </td>
                        <td className="px-3 py-2 text-gray-700">{e.contact_name || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                          {e.contact_phone || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{e.unresolved_gap_count ?? 0}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {e.templates_created_since_digest ?? 0}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={e.status} />
                          {e.skip_reason && (
                            <div className="text-xs text-gray-500 mt-1">{e.skip_reason}</div>
                          )}
                          {e.error_message && (
                            <div className="text-xs text-red-600 mt-1">{e.error_message}</div>
                          )}
                          {e.resolved_by_template_id && (
                            <button
                              type="button"
                              onClick={() =>
                                goToTab('schedule', {
                                  template_id: e.resolved_by_template_id!,
                                })
                              }
                              title={`View covering template ${e.resolved_by_template_id} on the Shift Schedule tab`}
                              className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
                            >
                              <CalendarIcon size={10} />
                              auto-resolved by template {e.resolved_by_template_id.slice(0, 8)}…
                            </button>
                          )}

                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Coverage gaps in this digest ({totalGaps})
            </h4>
            {totalGaps === 0 ? (
              <p className="text-sm text-gray-500">No gap rows found for this digest.</p>
            ) : (
              <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Gap window</th>
                      <th className="text-left px-3 py-2 font-medium">Duration</th>
                      <th className="text-left px-3 py-2 font-medium">Resolution</th>
                      <th className="text-left px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.gaps.length === 0
                      ? group.gap_ids.map((id) => (
                          <tr key={id}>
                            <td colSpan={4} className="px-3 py-2 text-xs font-mono text-gray-500">
                              gap {id.slice(0, 8)}… (not loaded — outside time window)
                            </td>
                          </tr>
                        ))
                      : group.gaps.map((gp) => {
                          const isCoveringThis = coveringGapId === gp.id;
                          const isCoveringOther = !!coveringGapId && coveringGapId !== gp.id;
                          return (
                            <tr key={gp.id}>
                              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                {fmtDateTime(gp.starts_at)} → {fmtDateTime(gp.ends_at)}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {gp.duration_minutes ?? '—'} min
                              </td>
                              <td className="px-3 py-2">
                                {gp.resolved ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700">
                                    <CheckCircleIcon size={12} /> resolved{' '}
                                    {fmtRelative(gp.resolved_at)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">
                                    <AlertTriangleIcon size={12} /> unresolved
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {!gp.resolved && onAutoCoverGap && (
                                  <button
                                    onClick={() => onAutoCoverGap(gp)}
                                    disabled={isCoveringThis || isCoveringOther}
                                    title="Create a recurring on-call template covering this gap window"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {isCoveringThis ? (
                                      <RefreshIcon size={12} className="animate-spin" />
                                    ) : (
                                      <CalendarIcon size={12} />
                                    )}
                                    Auto-cover gap
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

const MarkHandledModal: React.FC<{
  digestId: string;
  initial: DigestStatusRow | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (digestId: string, handled_reason: string, notes: string) => void;
}> = ({ digestId, initial, isSubmitting, onClose, onSubmit }) => {
  const [reason, setReason] = useState<string>(initial?.handled_reason || HANDLED_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>(
    initial?.handled_reason && !HANDLED_REASONS.includes(initial.handled_reason)
      ? initial.handled_reason
      : '',
  );
  const [notes, setNotes] = useState<string>(initial?.notes || '');

  const isOther = reason === 'Other';
  const finalReason = isOther ? customReason.trim() : reason;
  const canSubmit = finalReason.length > 0 && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Mark digest handled</h3>
            <p className="text-xs text-gray-500 font-mono">
              digest {digestId.slice(0, 8)}…
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
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            <p className="font-medium">This will close the loop on the digest, even if the gaps weren't auto-resolved.</p>
            <p className="mt-1 text-xs text-emerald-700">
              Future runs of <span className="font-mono">escalate-unfixed-gaps</span> will short-circuit
              with <span className="font-mono">skip_reason=digest_marked_handled</span>.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resolution reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {HANDLED_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {isOther && (
              <input
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe how this digest was handled…"
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the next admin should know about this digest…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
            onClick={() => canSubmit && onSubmit(digestId, finalReason, notes.trim())}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <RefreshIcon size={14} className="animate-spin" />
            ) : (
              <CheckCircleIcon size={14} />
            )}
            Mark handled
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOncallNotificationLog;
