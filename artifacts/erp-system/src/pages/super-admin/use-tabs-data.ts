import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { type AuditRow, type PlanSetting, type ActiveTab, authHeaders } from './types';
import { queryKeys } from '@/lib/queryKeys';

interface RevenueData {
  mrr: number;
  arr: number;
  arpu: number;
  conversionRate: number;
  activeCompanies: number;
  trialCompanies: number;
  paidCompanies: number;
  planBreakdown: { plan: string; price: number; count: number; revenue: number }[];
  monthlyRevenue: { month: string; revenue: number; count: number }[];
  totalPaidEver: number;
  totalTrialEver: number;
}

interface AlertItem {
  type: 'warning' | 'danger' | 'info' | 'success';
  category: string;
  title: string;
  body: string;
  company_id?: number;
  company_name?: string;
  days?: number;
}

interface AlertsData {
  alerts: AlertItem[];
  summary: { critical: number; warnings: number; info: number; successes: number; total: number };
}

interface TrialMonitoringData {
  redis_ok: boolean;
  status: 'normal' | 'warning' | 'paused';
  registrations_in_window: number;
  alert_threshold: number;
  block_threshold: number;
  pause_until: string | null;
  pause_remaining_seconds: number;
  warning_fired_at: string | null;
  pause_reason: string | null;
  top_ips: { ip: string; count: number }[];
  top_fingerprints: { fingerprint: string; count: number }[];
  suspicious_companies: {
    id: number;
    name: string;
    email: string | null;
    trial_score: number;
    is_suspicious: boolean;
    verification_status: string;
  }[];
  recent_blocks: { email: string; ip: string; reason: string; created_at: string }[];
}

interface HealthData {
  health: {
    status: string;
    db: boolean;
    memory_mb: number;
    uptime_hours: number;
    db_read_latency_ms: number;
    db_write_latency_ms: number;
    pool_ok: boolean;
    node_version: string;
  };
  metrics: {
    uptime_seconds: number;
    total_requests: number;
    status_codes: Record<string, number>;
    latency_ms: { p50: number; p95: number; p99: number; samples: number };
  };
  pool: { total: number; idle: number; waiting: number };
  memory: { heap_used_mb: number; heap_total_mb: number; rss_mb: number; external_mb: number };
  process: { uptime_hours: number; node_version: string; pid: number; env: string };
  timestamp: string;
}

interface RedisHealthData {
  status: 'ok' | 'down';
  latency_ms?: number;
  message?: string;
}

interface AnnounceItem {
  id: number;
  title: string;
  body: string;
  type: string;
  target: string;
  company_id: number | null;
  is_active: boolean;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

export function useTabsData(
  activeTab: ActiveTab,
  settingsActiveCard: string | null,
  showToast: (msg: string, type?: 'success' | 'error') => void
) {
  const fetcher = useCallback(
    (url: string) =>
      authFetch(api(url)).then(async (r) => {
        if (!r.ok) {
          let detail = '';
          try {
            const b = await r.json();
            detail = b?.error || b?.message || '';
          } catch {
            /* ignore */
          }
          throw new Error(
            detail ? `فشل جلب البيانات: ${detail}` : `فشل جلب البيانات (${r.status})`
          );
        }
        return r.json();
      }),
    []
  );

  /* ── Audit log state (shared between settings + audit_log tabs) ── */
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditAction, setAuditAction] = useState('');

  /* ── Announcements state ── */
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annType, setAnnType] = useState('info');
  const [annTarget, setAnnTarget] = useState('all');
  const [annCompanyId, setAnnCompanyId] = useState('');
  const [annExpires, setAnnExpires] = useState('');
  const [annSaving, setAnnSaving] = useState(false);

  /* ── Alert filter state ── */
  const [alertSearch, setAlertSearch] = useState('');
  const [alertTypeFilter, setAlertTypeFilter] = useState<
    'all' | 'danger' | 'warning' | 'info' | 'success'
  >('all');

  /* ── Plan state ── */
  const [editingPlan, setEditingPlan] = useState<PlanSetting | null>(null);
  const [planSaving, setPlanSaving] = useState(false);

  /* ── Unblock (monitoring) state ── */
  interface UnblockRow {
    id: number;
    email: string;
    ip: string;
    fingerprint: string | null;
    override_reason: string | null;
    created_at: string;
  }
  interface UnblockResult {
    active_blocks: number;
    overridden_blocks: number;
    rows: UnblockRow[];
  }
  const [unblockIP, setUnblockIP] = useState('');
  const [unblockEmail, setUnblockEmail] = useState('');
  const [unblockResult, setUnblockResult] = useState<UnblockResult | null>(null);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [unblockMsg, setUnblockMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Queries ── */
  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: queryKeys.super.revenue,
    queryFn: () => fetcher('/api/super/revenue') as Promise<RevenueData>,
    enabled: activeTab === 'revenue',
    staleTime: 60_000,
  });

  const {
    data: alertsData,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useQuery<AlertsData>({
    queryKey: queryKeys.super.alerts,
    queryFn: () => fetcher('/api/super/alerts') as Promise<AlertsData>,
    enabled: activeTab === 'alerts',
    staleTime: 30_000,
    refetchInterval: activeTab === 'alerts' ? 60_000 : false,
  });

  const {
    data: monData,
    isLoading: monLoading,
    isError: monError,
    refetch: refetchMon,
  } = useQuery<TrialMonitoringData>({
    queryKey: queryKeys.super.trialMonitoring,
    queryFn: () =>
      authFetch('/api/super/trial-monitoring').then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }) as Promise<TrialMonitoringData>,
    enabled: activeTab === 'monitoring',
    staleTime: 15_000,
    refetchInterval: activeTab === 'monitoring' ? 30_000 : false,
    retry: 1,
  });

  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
    dataUpdatedAt: healthUpdated,
  } = useQuery<HealthData>({
    queryKey: queryKeys.super.health,
    queryFn: () => fetcher('/api/super/health') as Promise<HealthData>,
    enabled: activeTab === 'health' || activeTab === 'overview',
    staleTime: 10_000,
    refetchInterval: activeTab === 'health' || activeTab === 'overview' ? 30_000 : false,
  });

  const { data: redisHealth } = useQuery<RedisHealthData>({
    queryKey: queryKeys.super.healthRedis,
    queryFn: () =>
      authFetch('/api/super/health/redis')
        .then((r) => r.json() as Promise<RedisHealthData>)
        .catch(() => ({ status: 'down' as const })),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 20_000,
  });

  const {
    data: auditData,
    isLoading: auditLoading,
    refetch: refetchAudit,
  } = useQuery<{ count: number; rows: AuditRow[] }>({
    queryKey: queryKeys.super.auditLog.list(auditLimit, auditAction),
    queryFn: () =>
      fetcher(
        `/api/super/audit-log?limit=${auditLimit}${auditAction ? `&action=${auditAction}` : ''}`
      ) as Promise<{ count: number; rows: AuditRow[] }>,
    enabled:
      activeTab === 'audit_log' || (activeTab === 'settings' && settingsActiveCard === 'audit_log'),
    staleTime: 30_000,
  });

  const { data: overviewAudit } = useQuery<{ count: number; rows: AuditRow[] }>({
    queryKey: queryKeys.super.auditLog.list(5, ''),
    queryFn: () =>
      fetcher('/api/super/audit-log?limit=5') as Promise<{ count: number; rows: AuditRow[] }>,
    enabled: activeTab === 'overview',
    staleTime: 30_000,
  });

  const {
    data: planSettings,
    isLoading: planSettingsLoading,
    refetch: refetchPlans,
  } = useQuery<PlanSetting[]>({
    queryKey: queryKeys.super.planSettings,
    queryFn: () => fetcher('/api/super/plan-settings') as Promise<PlanSetting[]>,
    enabled: activeTab === 'plans',
    staleTime: 30_000,
  });

  const { data: annData, refetch: refetchAnn } = useQuery<{
    announcements: AnnounceItem[];
    total: number;
  }>({
    queryKey: queryKeys.super.announcements,
    queryFn: () =>
      fetcher('/api/super/announcements') as Promise<{
        announcements: AnnounceItem[];
        total: number;
      }>,
    enabled: activeTab === 'announcements',
    staleTime: 30_000,
  });

  /* ── Handlers ── */
  async function saveAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) {
      showToast('العنوان والنص مطلوبان', 'error');
      return;
    }
    setAnnSaving(true);
    try {
      const res = await authFetch(api('/api/super/announcements'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle.trim(),
          body: annBody.trim(),
          type: annType,
          target: annTarget,
          company_id: annTarget !== 'all' && annCompanyId ? Number(annCompanyId) : undefined,
          expires_at: annExpires || undefined,
        }),
      });
      if (!res.ok) {
        showToast('فشل الحفظ', 'error');
        return;
      }
      showToast('✅ تم نشر الإشعار');
      setAnnTitle('');
      setAnnBody('');
      setAnnExpires('');
      setAnnCompanyId('');
      void refetchAnn();
    } catch {
      showToast('فشل الحفظ', 'error');
    } finally {
      setAnnSaving(false);
    }
  }

  async function toggleAnn(id: number, is_active: boolean) {
    await authFetch(api(`/api/super/announcements/${id}`), {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active }),
    });
    void refetchAnn();
  }

  async function deleteAnn(id: number) {
    await authFetch(api(`/api/super/announcements/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    void refetchAnn();
  }

  async function savePlan(plan: PlanSetting) {
    setPlanSaving(true);
    try {
      const res = await authFetch(api('/api/super/plan-settings/' + plan.key), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_ar: plan.name_ar,
          description: plan.description,
          price: Number(plan.price),
          includes_mobile: plan.includes_mobile,
          is_active: plan.is_active,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchPlans();
      setEditingPlan(null);
    } catch (e: unknown) {
      alert('خطأ في الحفظ: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPlanSaving(false);
    }
  }

  return {
    /* revenue */
    revenueData,
    revenueLoading,
    /* alerts */
    alertsData,
    alertsLoading,
    refetchAlerts,
    alertSearch,
    setAlertSearch,
    alertTypeFilter,
    setAlertTypeFilter,
    /* monitoring */
    monData,
    monLoading,
    monError,
    refetchMon,
    /* health */
    healthData,
    healthLoading,
    refetchHealth,
    healthUpdated,
    redisHealth,
    /* audit */
    auditData,
    auditLoading,
    refetchAudit,
    auditLimit,
    setAuditLimit,
    auditAction,
    setAuditAction,
    /* overview audit */
    overviewAudit,
    /* announcements */
    annData,
    annTitle,
    setAnnTitle,
    annBody,
    setAnnBody,
    annType,
    setAnnType,
    annTarget,
    setAnnTarget,
    annCompanyId,
    setAnnCompanyId,
    annExpires,
    setAnnExpires,
    annSaving,
    saveAnnouncement,
    toggleAnn,
    deleteAnn,
    /* plans */
    planSettings,
    planSettingsLoading,
    editingPlan,
    setEditingPlan,
    planSaving,
    savePlan,
    /* unblock (monitoring) */
    unblockIP,
    setUnblockIP,
    unblockEmail,
    setUnblockEmail,
    unblockResult,
    setUnblockResult,
    unblockLoading,
    setUnblockLoading,
    unblockMsg,
    setUnblockMsg,
  };
}
