import { api } from '@/lib/api';
/**
 * Super Admin Dashboard — manage all SaaS companies + super_admin accounts
 * Only accessible to users with role = "super_admin"
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { authFetch } from '@/lib/auth-fetch';
import { useLocation } from 'wouter';
import {
  type BackupFile, type Company, type CompanyFeatures, type Stats, type Manager,
  STATUS, translatePlan, C, FONT, authHeaders,
} from './super-admin/types';
import {
  AnimatedNumber, Toast, DarkInput, Modal, ConfirmDeleteModal, ActionBtn, PageBtn,
} from './super-admin/ui';
import { TabOverview } from './super-admin/tab-overview';
import { TabRevenue } from './super-admin/tab-revenue';
import { TabAlerts } from './super-admin/tab-alerts';
import { TabAuditLog } from './super-admin/tab-audit-log';
import { TabAnnouncements } from './super-admin/tab-announcements';
import { TabHealth } from './super-admin/tab-health';
import { TabPlans } from './super-admin/tab-plans';
import { TabMonitoring } from './super-admin/tab-monitoring';


/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export default function SuperAdmin() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (user && user.role !== 'super_admin') setLocation('/');
  }, [user, setLocation]);

  /* ── Tab ─── */
  const [activeTab, setActiveTab] = useState<
    'overview' | 'companies' | 'managers' | 'settings' |
    'revenue' | 'alerts' | 'announcements' | 'health' | 'plans' | 'monitoring' | 'audit_log'
  >('overview');

  /* ── Companies state ─── */
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlan, setNewPlan] = useState('trial');
  const [newEdition, setNewEdition] = useState<'advanced' | 'ultimate'>('ultimate');
  const [newDays, setNewDays] = useState(14);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [createResult, setCreateResult] = useState<{
    company_name: string;
    username: string;
    admin_name: string;
    temp_password: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteCoErr, setDeleteCoErr] = useState('');
  /* Subscription management modal */
  const [subModal, setSubModal] = useState<Company | null>(null);
  const DEFAULT_FEATS_ULTIMATE: CompanyFeatures = { accounting: false, hr: true, pos: true, warranty: true, consignment: true, fixed_assets: false, maintenance: false, budgets: false, bank_reconciliation: false };
  const DEFAULT_FEATS_ADVANCED: CompanyFeatures = { accounting: true, hr: true, pos: true, warranty: true, consignment: true, fixed_assets: true, maintenance: false, budgets: true, bank_reconciliation: true };
  const [subForm, setSubForm] = useState<{
    plan_type: string; edition: 'advanced' | 'ultimate';
    extend_mode: 'days' | 'date'; extend_days: number;
    end_date: string; is_active: boolean; features: CompanyFeatures;
  }>({ plan_type: 'trial', edition: 'ultimate', extend_mode: 'days', extend_days: 30, end_date: '', is_active: true, features: DEFAULT_FEATS_ULTIMATE });
  const [subSaving, setSubSaving] = useState(false);
  const [panelTab, setPanelTab] = useState<0 | 1 | 2 | 3>(0);
  /* Confirm-code delete flow */
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'code'>('confirm');
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  /* ── Managers state ─── */
  const [showAddMgr, setShowAddMgr] = useState(false);
  const [editMgr, setEditMgr] = useState<Manager | null>(null);
  const [deleteMgr, setDeleteMgr] = useState<Manager | null>(null);
  const [deleteMgrErr, setDeleteMgrErr] = useState('');

  /* Add form */
  const [mgName, setMgName] = useState('');
  const [mgUser, setMgUser] = useState('');
  const [mgPin, setMgPin] = useState('');
  const [mgPin2, setMgPin2] = useState('');
  const [mgErr, setMgErr] = useState('');

  /* Edit form */
  const [eName, setEName] = useState('');
  const [eUser, setEUser] = useState('');
  const [ePin, setEPin] = useState('');
  const [ePin2, setEPin2] = useState('');
  const [eErr, setEErr] = useState('');

  /* ── Alerts filter state ─── */
  const [alertSearch, setAlertSearch] = useState('');
  const [alertTypeFilter, setAlertTypeFilter] = useState<'all' | 'danger' | 'warning' | 'info' | 'success'>('all');

  /* ── Company snapshot modal ─── */
  const [snapshotCompany, setSnapshotCompany] = useState<number | null>(null);
  interface SnapshotData {
    company: Company;
    admins: { id: number; name: string; username: string; role: string; active: boolean; last_login: string | null }[];
    recentAudit: { id: number; action: string; note: string | null; username: string | null; created_at: string }[];
    stats: { salesCount: number; salesRevenue: number; purchasesCount: number };
  }
  const { data: snapshotData, isLoading: snapshotLoading } = useQuery<SnapshotData>({
    queryKey: ['/api/super/companies', snapshotCompany, 'snapshot'],
    queryFn: () => fetcher(`/api/super/companies/${snapshotCompany}/snapshot`),
    enabled: snapshotCompany !== null,
    staleTime: 30_000,
  });

  /* ── Support settings state ─── */
  const [supportWa, setSupportWa] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingsActiveCard, setSettingsActiveCard] = useState<'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram' | null>(null);

  /* ── Telegram alert settings ── */
  interface TgAlertRule { enabled: boolean; cooldownHours: number; label: string; }
  interface TgConfig    { enabled: boolean; alerts: Record<string, TgAlertRule>; }
  interface TgBotStatus {
    connected: boolean; token_set: boolean; chat_id_set: boolean;
    bot_username?: string; bot_name?: string; error?: string;
    token_masked: string | null; chat_id: string | null; source: 'db' | 'env' | 'none';
  }
  const [tgConfig, setTgConfig]         = useState<TgConfig | null>(null);
  const [tgSaving, setTgSaving]         = useState(false);
  const [tgBotStatus, setTgBotStatus]   = useState<TgBotStatus | null>(null);
  const [tgBotToken, setTgBotToken]     = useState('');
  const [tgChatId, setTgChatId]         = useState('');
  const [tgShowToken, setTgShowToken]   = useState(false);
  const [tgCredSaving, setTgCredSaving] = useState(false);
  const [tgTesting, setTgTesting]       = useState(false);
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; msg: string } | null>(null);


  /* ── Unblock Tool ─── */
  const [unblockIP, setUnblockIP]       = useState('');
  const [unblockEmail, setUnblockEmail] = useState('');
  const [unblockResult, setUnblockResult] = useState<{
    active_blocks: number;
    overridden_blocks: number;
    rows: { id: number; email: string; ip: string; fingerprint: string | null; override_reason: string | null; created_at: string }[];
  } | null>(null);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [unblockMsg, setUnblockMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Password Reset ─── */
  const [resetPassResult, setResetPassResult] = useState<{
    company_name: string;
    username: string;
    name: string;
    temp_password: string;
  } | null>(null);
  const [resetPassCopied, setResetPassCopied] = useState(false);

  /* ── Toast ─── */
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetcher = useCallback(
    (url: string) =>
      authFetch(api(url)).then(async (r) => {
        if (!r.ok) {
          let detail = '';
          try {
            const body = await r.json();
            detail = body?.error || body?.message || '';
          } catch { /* ignore JSON parse errors */ }
          throw new Error(detail ? `فشل جلب البيانات: ${detail}` : `فشل جلب البيانات (${r.status})`);
        }
        return r.json();
      }),
    []
  );

  /* ── Queries ─── */
  const { data: stats } = useQuery<Stats>({
    queryKey: ['/api/super/stats'],
    queryFn: () => fetcher('/api/super/stats'),
    staleTime: 30_000,
  });
  const { data: companies = [], isLoading: coLoading } = useQuery<Company[]>({
    queryKey: ['/api/super/companies'],
    queryFn: () => fetcher('/api/super/companies'),
    staleTime: 30_000,
  });

  /* ── Panel: per-company detail (users) ─── */
  interface PanelUser { id: number; name: string; username: string; email: string | null; role: string; active: boolean; }
  interface PanelCompanyDetail extends Company { users: PanelUser[]; }
  const { data: panelCompanyDetail, isLoading: panelDetailLoading } = useQuery<PanelCompanyDetail>({
    queryKey: ['/api/super/companies', subModal?.id, 'panel-detail'],
    queryFn: () => fetcher(`/api/super/companies/${subModal!.id}`),
    enabled: subModal !== null && panelTab === 2,
    staleTime: 30_000,
  });

  /* ── Panel: audit log for specific company (record_type=company) ─── */
  interface AuditEntry { id: number; action: string; record_type: string | null; record_id: number | null; note: string | null; username: string | null; created_at: string; }
  interface AuditLogResp { count: number; rows: AuditEntry[]; }
  const { data: panelAuditResp, isLoading: panelAuditLoading } = useQuery<AuditLogResp>({
    queryKey: ['/api/super/audit-log', 'company-type', subModal?.id],
    queryFn: () => fetcher('/api/super/audit-log?record_type=company&limit=500'),
    enabled: subModal !== null && panelTab === 3,
    staleTime: 60_000,
  });

  const {
    data: managers = [],
    isLoading: mgLoading,
    isError: mgError,
    refetch: mgRefetch,
  } = useQuery<Manager[]>({
    queryKey: ['/api/super/managers'],
    queryFn: () => fetcher('/api/super/managers'),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  /* ── Backup state + query ─── */
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreOk, setRestoreOk] = useState<string | null>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const [restoreModal, setRestoreModal] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  /* ── Encryption key info ─── */
  const [encKey, setEncKey] = useState<string | null>(null);
  const [encEnabled, setEncEnabled] = useState(false);
  const [encKeyVisible, setEncKeyVisible] = useState(false);
  const [encKeyCopied, setEncKeyCopied] = useState(false);
  const [encKeyLoading, setEncKeyLoading] = useState(false);

  async function loadEncKey() {
    if (encKey !== null) { setEncKeyVisible(true); return; }
    setEncKeyLoading(true);
    try {
      const res = await authFetch(api('/api/super/encryption-key'), {
        headers: authHeaders(),
      });
      const data: { key: string | null; enabled: boolean } = await res.json();
      setEncEnabled(data.enabled);
      setEncKey(data.key ?? '');
      setEncKeyVisible(true);
    } catch {
      showToast('فشل جلب مفتاح التشفير', 'error');
    } finally {
      setEncKeyLoading(false);
    }
  }

  function copyEncKey() {
    if (!encKey) return;
    void navigator.clipboard.writeText(encKey).then(() => {
      setEncKeyCopied(true);
      setTimeout(() => setEncKeyCopied(false), 2500);
    });
  }

  function emailEncKey() {
    if (!encKey) return;
    const subject = encodeURIComponent('مفتاح تشفير النسخ الاحتياطية — MUHKAM ERP');
    const body = encodeURIComponent(
      `مفتاح تشفير النسخ الاحتياطية لنظام مُحكم:\n\n${encKey}\n\n` +
      `التاريخ: ${new Date().toLocaleString('ar-EG')}\n\n` +
      `⚠️ تحذير: احتفظ بهذا المفتاح في مكان آمن. بدونه لا يمكن استعادة أي نسخة مشفّرة.`
    );
    window.open(`mailto:m.elmelegy@me.com?subject=${subject}&body=${body}`, '_blank');
  }

  /* ══════════════════════════════════════════════
     New Tab Queries
     ══════════════════════════════════════════════ */

  /* Revenue */
  interface RevenueData {
    mrr: number; arr: number; arpu: number; conversionRate: number;
    activeCompanies: number; trialCompanies: number; paidCompanies: number;
    planBreakdown: { plan: string; price: number; count: number; revenue: number }[];
    monthlyRevenue: { month: string; revenue: number; count: number }[];
    totalPaidEver: number; totalTrialEver: number;
  }
  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: ['/api/super/revenue'],
    queryFn: () => fetcher('/api/super/revenue'),
    enabled: activeTab === 'revenue',
    staleTime: 60_000,
  });

  /* Alerts */
  interface AlertItem {
    type: 'warning' | 'danger' | 'info' | 'success';
    category: string; title: string; body: string;
    company_id?: number; company_name?: string; days?: number;
  }
  interface AlertsData {
    alerts: AlertItem[];
    summary: { critical: number; warnings: number; info: number; successes: number; total: number };
  }
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<AlertsData>({
    queryKey: ['/api/super/alerts'],
    queryFn: () => fetcher('/api/super/alerts'),
    enabled: activeTab === 'alerts',
    staleTime: 30_000,
    refetchInterval: activeTab === 'alerts' ? 60_000 : false,
  });

  /* Trial Monitoring */
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
      id: number; name: string; email: string | null;
      trial_score: number; is_suspicious: boolean; verification_status: string;
    }[];
    recent_blocks: { email: string; ip: string; reason: string; created_at: string }[];
  }
  const {
    data: monData, isLoading: monLoading, isError: monError, refetch: refetchMon,
  } = useQuery<TrialMonitoringData>({
    queryKey: ['/api/super/trial-monitoring'],
    queryFn: () => authFetch('/api/super/trial-monitoring').then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    enabled: activeTab === 'monitoring',
    staleTime: 15_000,
    refetchInterval: activeTab === 'monitoring' ? 30_000 : false,
    retry: 1,
  });

  /* Audit log */
  interface AuditRow {
    id: number; action: string; record_type: string; record_id: number;
    user_id: number | null; username: string | null; note: string | null;
    company_id: number | null; created_at: string;
  }
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditAction, setAuditAction] = useState('');
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery<{ count: number; rows: AuditRow[] }>({
    queryKey: ['/api/super/audit-log', auditLimit, auditAction],
    queryFn: () => fetcher(`/api/super/audit-log?limit=${auditLimit}${auditAction ? `&action=${auditAction}` : ''}`),
    enabled: activeTab === 'audit_log' || (activeTab === 'settings' && settingsActiveCard === 'audit_log'),
    staleTime: 30_000,
  });

  /* Announcements */
  interface AnnounceItem {
    id: number; title: string; body: string; type: string;
    target: string; company_id: number | null; is_active: boolean;
    created_by: string; expires_at: string | null; created_at: string;
  }
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annType, setAnnType] = useState('info');
  const [annTarget, setAnnTarget] = useState('all');
  const [annCompanyId, setAnnCompanyId] = useState('');
  const [annExpires, setAnnExpires] = useState('');
  const [annSaving, setAnnSaving] = useState(false);
  const { data: annData, refetch: refetchAnn } = useQuery<{ announcements: AnnounceItem[]; total: number }>({
    queryKey: ['/api/super/announcements'],
    queryFn: () => fetcher('/api/super/announcements'),
    enabled: activeTab === 'announcements',
    staleTime: 30_000,
  });

  async function saveAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) { showToast('العنوان والنص مطلوبان', 'error'); return; }
    setAnnSaving(true);
    try {
      const res = await authFetch(api('/api/super/announcements'), {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle.trim(), body: annBody.trim(),
          type: annType, target: annTarget,
          company_id: annTarget !== 'all' && annCompanyId ? Number(annCompanyId) : undefined,
          expires_at: annExpires || undefined,
        }),
      });
      if (!res.ok) { showToast('فشل الحفظ', 'error'); return; }
      showToast('✅ تم نشر الإشعار');
      setAnnTitle(''); setAnnBody(''); setAnnExpires(''); setAnnCompanyId('');
      void refetchAnn();
    } catch { showToast('فشل الحفظ', 'error'); }
    finally { setAnnSaving(false); }
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
      method: 'DELETE', headers: authHeaders(),
    });
    void refetchAnn();
  }

  /* Health */
  interface HealthData {
    health: { status: string; db: boolean; memory_mb: number; uptime_hours: number; db_read_latency_ms: number; db_write_latency_ms: number; pool_ok: boolean; node_version: string };
    metrics: { uptime_seconds: number; total_requests: number; status_codes: Record<string, number>; latency_ms: { p50: number; p95: number; p99: number; samples: number } };
    pool: { total: number; idle: number; waiting: number };
    memory: { heap_used_mb: number; heap_total_mb: number; rss_mb: number; external_mb: number };
    process: { uptime_hours: number; node_version: string; pid: number; env: string };
    timestamp: string;
  }
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth, dataUpdatedAt: healthUpdated } = useQuery<HealthData>({
    queryKey: ['/api/super/health'],
    queryFn: () => fetcher('/api/super/health'),
    enabled: activeTab === 'health' || activeTab === 'overview',
    staleTime: 10_000,
    refetchInterval: (activeTab === 'health' || activeTab === 'overview') ? 30_000 : false,
  });

  /* Redis Health — polled every 10 s always (used in navbar + health tab) */
  interface RedisHealthData {
    status: 'ok' | 'down';
    latency_ms?: number;
    message?: string;
  }
  const { data: redisHealth } = useQuery<RedisHealthData>({
    queryKey: ['/api/super/health/redis'],
    queryFn: () =>
      fetch('/api/super/health/redis', { headers: authHeaders() })
        .then(r => r.json() as Promise<RedisHealthData>)
        .catch(() => ({ status: 'down' as const })),
    refetchInterval: 10_000,
    retry: false,
    staleTime: 8_000,
  });

  /* Overview — recent audit events (last 5) */
  const { data: overviewAudit } = useQuery<{ count: number; rows: AuditRow[] }>({
    queryKey: ['/api/super/audit-log', 5, ''],
    queryFn: () => fetcher('/api/super/audit-log?limit=5'),
    enabled: activeTab === 'overview',
    staleTime: 30_000,
  });

  /* Plan Settings */
  interface PlanSetting {
    id: number; key: string; name_ar: string; description: string | null;
    price: number; includes_mobile: boolean; is_active: boolean;
    created_at: string; updated_at: string;
  }
  const { data: planSettings, isLoading: planSettingsLoading, refetch: refetchPlans } =
    useQuery<PlanSetting[]>({
      queryKey: ['/api/super/plan-settings'],
      queryFn: () => fetcher('/api/super/plan-settings'),
      enabled: activeTab === 'plans',
      staleTime: 30_000,
    });

  const [editingPlan, setEditingPlan] = useState<PlanSetting | null>(null);
  const [planSaving, setPlanSaving] = useState(false);

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

  /* CSV Export */
  async function exportCompaniesCSV() {
    try {
      const res = await authFetch(api('/api/super/export/companies'), {
        headers: authHeaders(),
      });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `muhkam-companies-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('✅ تم تصدير بيانات الشركات');
    } catch { showToast('فشل التصدير', 'error'); }
  }

  const { data: backupData, refetch: refetchBackups } = useQuery<{
    backups: BackupFile[];
    total: number;
  }>({
    queryKey: ['/api/super/backup/list'],
    queryFn: () => fetcher('/api/super/backup/list'),
    enabled: activeTab === 'settings',
    staleTime: 30_000,
  });

  async function triggerBackup() {
    setCreatingBackup(true);
    try {
      const res = await authFetch(api('/api/super/backup/create'), {
        method: 'POST',
        headers: authHeaders(),
      });
      const data: {
        success?: boolean;
        message?: string;
        filename?: string;
        size_mb?: string;
        error?: string;
      } = await res.json();
      if (data.success) {
        showToast(`✅ ${data.message ?? 'تم إنشاء النسخة الاحتياطية'} (${data.size_mb} MB)`);
        void refetchBackups();
      } else {
        showToast(data.error ?? 'فشل إنشاء النسخة الاحتياطية', 'error');
      }
    } catch {
      showToast('فشل إنشاء النسخة الاحتياطية', 'error');
    } finally {
      setCreatingBackup(false);
    }
  }

  async function downloadBackup(filename: string) {
    setDownloadingFile(filename);
    try {
      const res = await authFetch(api(`/api/super/backup/download/${encodeURIComponent(filename)}`), {
        headers: authHeaders(),
      });
      if (!res.ok) { showToast('فشل التنزيل', 'error'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast('خطأ في التنزيل', 'error');
    } finally {
      setDownloadingFile(null);
    }
  }

  function openRestorePicker() {
    setRestoreOk(null);
    setRestoreErr(null);
    restoreInputRef.current?.click();
  }

  async function handleRestoreFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.json') && !file.name.endsWith('.json.enc')) {
      showToast('يجب اختيار ملف .json أو .json.enc', 'error');
      return;
    }
    setPendingRestoreFile(file);
    setRestoreCode('');
    setRestoreModal(true);
  }

  async function confirmRestore() {
    if (!pendingRestoreFile || restoreCode !== 'RESTORE') return;
    setRestoreModal(false);
    setRestoring(true);
    setRestoreOk(null);
    setRestoreErr(null);
    try {
      const isEnc = pendingRestoreFile.name.endsWith('.enc');
      let body: BodyInit;
      let headers: HeadersInit = authHeaders();
      if (isEnc) {
        body = await pendingRestoreFile.arrayBuffer();
        headers = { ...headers, 'Content-Type': 'application/octet-stream' };
      } else {
        const text = await pendingRestoreFile.text();
        body = text;
        headers = { ...headers, 'Content-Type': 'application/json' };
      }
      const res = await authFetch(api('/api/system/restore'), {
        method: 'POST',
        headers,
        body,
      });
      const data: { counts?: Record<string, number>; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل الاستعادة');
      const total = Object.values(data.counts ?? {}).reduce((a, b) => a + b, 0);
      setRestoreOk(`تمت الاستعادة بنجاح — ${total} سجل`);
      showToast(`✅ تمت الاستعادة — ${total} سجل`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRestoreErr(msg);
      showToast('فشل الاستعادة: ' + msg, 'error');
    } finally {
      setRestoring(false);
      setPendingRestoreFile(null);
    }
  }

  /* ── Security / 2FA state ─── */
  const [totpSetupData, setTotpSetupData] = useState<{ qr_code: string; secret: string } | null>(
    null
  );
  const [totpInput, setTotpInput] = useState('');
  const [disableTotpInput, setDisableTotpInput] = useState('');
  const [secLoading, setSecLoading] = useState(false);
  const [secMsg, setSecMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showDisable, setShowDisable] = useState(false);

  const { data: totpStatus, refetch: refetchTotpStatus } = useQuery<{ totp_enabled: boolean }>({
    queryKey: ['/api/auth/2fa/status'],
    queryFn: () => fetcher('/api/auth/2fa/status'),
    enabled: activeTab === 'settings',
    staleTime: 10_000,
  });

  async function startTotpSetup() {
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await authFetch(api('/api/auth/2fa/setup'));
      const data: { qr_code?: string; secret?: string; error?: string } = await res.json();
      if (data.qr_code) {
        setTotpSetupData({ qr_code: data.qr_code, secret: data.secret! });
      } else setSecMsg({ text: data.error ?? 'فشل الإعداد', ok: false });
    } catch {
      setSecMsg({ text: 'فشل الاتصال', ok: false });
    } finally {
      setSecLoading(false);
    }
  }

  async function confirmTotpSetup() {
    if (totpInput.length !== 6) {
      setSecMsg({ text: 'أدخل 6 أرقام', ok: false });
      return;
    }
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await authFetch(api('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: totpInput }),
      });
      const data: { success?: boolean; message?: string; error?: string } = await res.json();
      if (data.success) {
        setSecMsg({ text: data.message ?? 'تم تفعيل 2FA ✅', ok: true });
        setTotpSetupData(null);
        setTotpInput('');
        void refetchTotpStatus();
      } else setSecMsg({ text: data.error ?? 'رمز خاطئ', ok: false });
    } catch {
      setSecMsg({ text: 'فشل الاتصال', ok: false });
    } finally {
      setSecLoading(false);
    }
  }

  async function confirmDisableTotp() {
    if (disableTotpInput.length !== 6) {
      setSecMsg({ text: 'أدخل 6 أرقام', ok: false });
      return;
    }
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await authFetch(api('/api/auth/2fa/disable'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: disableTotpInput }),
      });
      const data: { success?: boolean; message?: string; error?: string } = await res.json();
      if (data.success) {
        setSecMsg({ text: data.message ?? 'تم إيقاف 2FA', ok: true });
        setShowDisable(false);
        setDisableTotpInput('');
        void refetchTotpStatus();
      } else setSecMsg({ text: data.error ?? 'رمز خاطئ', ok: false });
    } catch {
      setSecMsg({ text: 'فشل الاتصال', ok: false });
    } finally {
      setSecLoading(false);
    }
  }

  /* ── Support settings query ─── */
  const { data: sysSettings } = useQuery<Record<string, string>>({
    queryKey: ['/api/settings/system'],
    queryFn: () => fetcher('/api/settings/system'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (sysSettings) {
      setSupportWa(sysSettings['support_whatsapp'] ?? '');
      setSupportEmail(sysSettings['support_email'] ?? '');
    }
  }, [sysSettings]);

  /* ── Telegram settings query ── */
  const isTgOpen = activeTab === 'settings' && settingsActiveCard === 'telegram';

  const {
    data:    tgConfigData,
    isLoading: tgLoading,
    isError:   tgError,
    error:     tgErrorObj,
    refetch:   tgRefetch,
  } = useQuery<TgConfig, Error>({
    queryKey: ['/api/super/telegram-settings'],
    queryFn:  () => fetcher('/api/super/telegram-settings'),
    enabled:  isTgOpen,
    staleTime: 30_000,
    retry: 1,
  });
  useEffect(() => { if (tgConfigData) setTgConfig(tgConfigData); }, [tgConfigData]);

  const {
    data:      tgBotData,
    isLoading: tgBotLoading,
    refetch:   tgBotRefetch,
  } = useQuery<TgBotStatus, Error>({
    queryKey: ['/api/super/telegram-config'],
    queryFn:  () => fetcher('/api/super/telegram-config'),
    enabled:  isTgOpen,
    staleTime: 20_000,
    retry: 1,
  });
  useEffect(() => {
    if (tgBotData) {
      setTgBotStatus(tgBotData);
      if (!tgBotData.connected) {
        setTgBotToken('');
        setTgChatId(tgBotData.chat_id ?? '');
      }
    }
  }, [tgBotData]);

  async function saveTelegramSettings() {
    if (!tgConfig) return;
    setTgSaving(true);
    try {
      await authFetch(api('/api/super/telegram-settings'), {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify(tgConfig),
      });
      showToast('تم حفظ إعدادات تليجرام ✅');
    } catch {
      showToast('فشل حفظ الإعدادات', 'error');
    } finally {
      setTgSaving(false);
    }
  }

  async function saveTgCredentials() {
    if (!tgBotToken.trim() || !tgChatId.trim()) {
      showToast('أدخل رمز البوت ومعرّف المحادثة', 'error');
      return;
    }
    setTgCredSaving(true);
    setTgTestResult(null);
    try {
      const res = await authFetch(api('/api/super/telegram-config'), {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify({ bot_token: tgBotToken.trim(), chat_id: tgChatId.trim() }),
      });
      const json = await res.json() as TgBotStatus & { success?: boolean; error?: string };
      if (!res.ok) { showToast(json.error ?? 'فشل الحفظ', 'error'); return; }
      setTgBotStatus(json);
      setTgBotToken('');
      tgBotRefetch();
      showToast(json.connected ? `✅ تم الاتصال بـ @${json.bot_username ?? 'البوت'}` : '⚠️ تم الحفظ لكن البوت لم يتصل — تحقق من Token', json.connected ? 'success' : 'error');
    } catch {
      showToast('فشل حفظ البيانات', 'error');
    } finally {
      setTgCredSaving(false);
    }
  }

  async function testTelegramConnection() {
    setTgTesting(true);
    setTgTestResult(null);
    try {
      const res = await authFetch(api('/api/super/telegram-test'), {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({}),
      });
      const json = await res.json() as { success: boolean; message?: string; error?: string };
      setTgTestResult({ ok: json.success, msg: json.success ? 'تم الإرسال بنجاح — تحقق من محادثة التيليجرام' : (json.error ?? 'فشل الإرسال') });
    } catch {
      setTgTestResult({ ok: false, msg: 'تعذّر الاتصال بالخادم' });
    } finally {
      setTgTesting(false);
    }
  }

  async function saveSupportSettings() {
    setSettingSaving(true);
    try {
      const upsert = async (key: string, value: string) => {
        await authFetch(api('/api/settings/system'), {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ key, value }),
        });
      };
      await upsert('support_whatsapp', supportWa.trim());
      await upsert('support_email', supportEmail.trim());
      showToast('تم حفظ إعدادات التواصل');
    } catch {
      showToast('فشل حفظ الإعدادات', 'error');
    } finally {
      setSettingSaving(false);
    }
  }

  /* ── Mutations ─── */
  const coMutate = useMutation({
    mutationFn: ({ url, method = 'POST', body }: { url: string; method?: string; body?: object }) =>
      fetch(api(url), {
        method,
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/companies'] });
      qc.invalidateQueries({ queryKey: ['/api/super/stats'] });
    },
  });

  async function saveSubscription() {
    if (!subModal) return;
    setSubSaving(true);
    try {
      const h = { ...authHeaders(), 'Content-Type': 'application/json' };
      if (subForm.extend_mode === 'days') {
        await authFetch(api(`/api/super/companies/${subModal.id}/extend`), {
          method: 'POST', headers: h,
          body: JSON.stringify({ days: subForm.extend_days, plan_type: subForm.plan_type }),
        });
        await authFetch(api(`/api/super/companies/${subModal.id}`), {
          method: 'PUT', headers: h,
          body: JSON.stringify({ edition: subForm.edition, is_active: subForm.is_active, features: subForm.features }),
        });
      } else {
        await authFetch(api(`/api/super/companies/${subModal.id}`), {
          method: 'PUT', headers: h,
          body: JSON.stringify({ plan_type: subForm.plan_type, edition: subForm.edition, end_date: subForm.end_date, is_active: subForm.is_active, features: subForm.features }),
        });
      }
      qc.invalidateQueries({ queryKey: ['/api/super/companies'] });
      qc.invalidateQueries({ queryKey: ['/api/super/stats'] });
      showToast('✅ تم تحديث الاشتراك بنجاح');
      setSubModal(null);
    } catch {
      showToast('حدث خطأ أثناء الحفظ');
    } finally {
      setSubSaving(false);
    }
  }

  const coDelete = useMutation({
    mutationFn: ({
      id,
      force,
      confirm_code,
      expected_code,
    }: {
      id: number;
      force?: boolean;
      confirm_code?: string;
      expected_code?: string;
    }) =>
      fetch(api(`/api/super/companies/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ force, confirm_code, expected_code }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Object.assign(new Error(d.error ?? 'خطأ'), { data: d });
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/companies'] });
      qc.invalidateQueries({ queryKey: ['/api/super/stats'] });
      setDeleteTarget(null);
      setDeleteCoErr('');
      setDeleteStep('confirm');
      setGeneratedCode('');
      setEnteredCode('');
      showToast('تم حذف الشركة بنجاح');
    },
    onError: (e: Error & { data?: { has_users?: boolean; user_count?: number } }) => {
      if (e.data?.has_users) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(code);
        setEnteredCode('');
        setDeleteCoErr('');
        setDeleteStep('code');
      } else {
        setDeleteCoErr(e.message);
      }
    },
  });

  const mgCreate = useMutation({
    mutationFn: (body: object) =>
      fetch(api('/api/super/managers'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/managers'] });
      setShowAddMgr(false);
      resetAddForm();
      showToast('تم إضافة المدير بنجاح');
    },
    onError: (e: Error) => setMgErr(e.message),
  });

  const mgUpdate = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      fetch(api(`/api/super/managers/${id}`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/managers'] });
      setEditMgr(null);
      resetEditForm();
      showToast('تم تحديث بيانات المدير');
    },
    onError: (e: Error) => setEErr(e.message),
  });

  const mgToggle = useMutation({
    mutationFn: (id: number) =>
      fetch(api(`/api/super/managers/${id}/toggle`), {
        method: 'PATCH',
        headers: authHeaders(),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/managers'] });
      showToast('تم تحديث حالة المدير');
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const mgDelete = useMutation({
    mutationFn: (id: number) =>
      fetch(api(`/api/super/managers/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/managers'] });
      setDeleteMgr(null);
      setDeleteMgrErr('');
      showToast('تم حذف المدير بنجاح');
    },
    onError: (e: Error) => setDeleteMgrErr(e.message),
  });

  /* ── Reset company admin password ─── */
  const resetPassword = useMutation({
    mutationFn: ({ id, company_name }: { id: number; company_name: string }) =>
      fetch(api(`/api/super/companies/${id}/reset-admin-password`), {
        method: 'POST',
        headers: authHeaders(),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'خطأ في إعادة التعيين');
        return { ...d, company_name };
      }),
    onSuccess: (data) => {
      setResetPassResult(data);
      setResetPassCopied(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  /* ── Form helpers ─── */
  const resetAddForm = () => {
    setMgName('');
    setMgUser('');
    setMgPin('');
    setMgPin2('');
    setMgErr('');
  };
  const resetEditForm = () => {
    setEName('');
    setEUser('');
    setEPin('');
    setEPin2('');
    setEErr('');
  };

  const openEdit = (m: Manager) => {
    setEName(m.name);
    setEUser(m.username);
    setEPin('');
    setEPin2('');
    setEErr('');
    setEditMgr(m);
  };

  const handleAddMgr = () => {
    if (!mgName.trim()) {
      setMgErr('الاسم الكامل مطلوب');
      return;
    }
    if (!mgUser.trim()) {
      setMgErr('اسم المستخدم مطلوب');
      return;
    }
    if (/\s/.test(mgUser)) {
      setMgErr('اسم المستخدم لا يجب أن يحتوي على مسافات');
      return;
    }
    if (mgPin.length < 4) {
      setMgErr('الرقم السري يجب أن يكون 4 أحرف على الأقل');
      return;
    }
    if (mgPin !== mgPin2) {
      setMgErr('الرقم السري وتأكيده غير متطابقين');
      return;
    }
    setMgErr('');
    mgCreate.mutate({ name: mgName.trim(), username: mgUser.trim(), pin: mgPin });
  };

  const handleEditMgr = () => {
    if (!editMgr) return;
    if (!eName.trim()) {
      setEErr('الاسم الكامل مطلوب');
      return;
    }
    if (!eUser.trim()) {
      setEErr('اسم المستخدم مطلوب');
      return;
    }
    if (/\s/.test(eUser)) {
      setEErr('اسم المستخدم لا يجب أن يحتوي على مسافات');
      return;
    }
    if (ePin && ePin.length < 4) {
      setEErr('الرقم السري يجب أن يكون 4 أحرف على الأقل');
      return;
    }
    if (ePin && ePin !== ePin2) {
      setEErr('الرقم السري وتأكيده غير متطابقين');
      return;
    }
    setEErr('');
    const body: Record<string, string> = { name: eName.trim(), username: eUser.trim() };
    if (ePin) body.pin = ePin;
    mgUpdate.mutate({ id: editMgr.id, body });
  };

  /* ── Companies filtering ─── */
  const filtered = companies.filter((co) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        co.name.toLowerCase().includes(q) ||
        (co.admin_email ?? '').toLowerCase().includes(q)) &&
      (statusFilter === 'all' || co.status === statusFilter)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, perPage]);

  const expiryInfo = (co: Company) => {
    const formatted = new Date(co.end_date).toLocaleDateString('ar-EG-u-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (co.daysRemaining < 0) return { text: `❌ انتهى: ${formatted}`, color: C.danger };
    if (co.daysRemaining <= 7) return { text: `⚠️ ينتهي: ${formatted}`, color: C.warning };
    return { text: `ينتهي: ${formatted}`, color: C.success };
  };

  /* ── Stats cards ─── */
  const activePercent = stats?.total ? Math.round((stats.active / stats.total) * 100) : 0;
  const statCards = [
    {
      label: 'إجمالي الشركات',
      value: stats?.total ?? 0,
      icon: '🏢',
      color: C.orange,
      sub: `${activePercent}% نشطة`,
      filter: 'all',
      tab: 'companies' as const,
    },
    {
      label: 'نشطة',
      value: stats?.active ?? 0,
      icon: '✅',
      color: C.success,
      sub: 'اشتراك فعّال',
      filter: 'active',
      tab: 'companies' as const,
    },
    {
      label: 'مدفوعة',
      value: stats?.paid ?? 0,
      icon: '💎',
      color: '#7c3aed',
      sub: 'خطة مدفوعة',
      filter: 'active',
      tab: 'companies' as const,
    },
    {
      label: 'تجريبية',
      value: stats?.trial ?? 0,
      icon: '⏳',
      color: C.warning,
      sub: 'فترة تجريبية',
      filter: 'trial',
      tab: 'companies' as const,
    },
    {
      label: 'منتهية',
      value: stats?.expired ?? 0,
      icon: '❌',
      color: C.danger,
      sub: 'تجاوزت التاريخ',
      filter: 'expired',
      tab: 'companies' as const,
    },
    {
      label: 'موقوفة',
      value: stats?.suspended ?? 0,
      icon: '⛔',
      color: C.muted,
      sub: 'معطّلة',
      filter: 'suspended',
      tab: 'companies' as const,
    },
    {
      label: 'المستخدمون',
      value: stats?.totalUsers ?? 0,
      icon: '👥',
      color: C.blue,
      sub: 'إجمالي الحسابات',
      filter: null,
      tab: 'managers' as const,
    },
    {
      label: 'انضموا هذا الشهر',
      value: stats?.recentSignups ?? 0,
      icon: '🆕',
      color: '#06b6d4',
      sub: 'آخر 30 يوم',
      filter: 'all',
      tab: 'companies' as const,
    },
  ];

  const STATUS_FILTERS = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'نشطة' },
    { key: 'trial', label: 'تجريبية' },
    { key: 'suspended', label: 'موقوفة' },
    { key: 'expired', label: 'منتهية' },
  ];

  const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!user || user.role !== 'super_admin') return null;

  return (
    <div
      dir="rtl"
      style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.text }}
    >
      {/* ── Modals ─── */}

      {/* ── Password Reset Result Modal ─── */}
      {resetPassResult && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={() => setResetPassResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '20px', padding: '36px',
              maxWidth: '460px', width: '100%', direction: 'rtl',
              boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
              border: '2px solid #7c3aed22',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '52px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', fontFamily: FONT }}>
                تم إعادة تعيين كلمة المرور
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', fontFamily: FONT }}>
                {resetPassResult.company_name}
              </div>
            </div>

            <div style={{
              background: '#f9f5ff', border: '1.5px solid #7c3aed44',
              borderRadius: '14px', padding: '20px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '12px', color: '#7c3aed', fontFamily: FONT, marginBottom: '8px', fontWeight: 700 }}>
                بيانات الدخول المؤقتة:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: FONT }}>اسم المستخدم:</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111', fontFamily: FONT, letterSpacing: '0.5px' }}>
                    {resetPassResult.username}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: FONT }}>الاسم:</span>
                  <span style={{ fontSize: '13px', color: '#374151', fontFamily: FONT }}>{resetPassResult.name}</span>
                </div>
                <div style={{ height: '1px', background: '#7c3aed22' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: FONT }}>كلمة المرور المؤقتة:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{
                      fontSize: '18px', fontWeight: 800, color: '#7c3aed',
                      background: '#ede9fe', padding: '6px 14px', borderRadius: '8px',
                      letterSpacing: '2px', fontFamily: 'monospace',
                    }}>
                      {resetPassResult.temp_password}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(resetPassResult.temp_password);
                        setResetPassCopied(true);
                        setTimeout(() => setResetPassCopied(false), 2000);
                      }}
                      style={{
                        padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #7c3aed44',
                        background: resetPassCopied ? '#7c3aed' : '#f9f5ff',
                        color: resetPassCopied ? '#fff' : '#7c3aed',
                        fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
                        fontFamily: FONT,
                      }}
                    >
                      {resetPassCopied ? '✓ نُسخ' : '📋 نسخ'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: '#fef3c7', border: '1px solid #fcd34d',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
              fontSize: '12px', color: '#92400e', fontFamily: FONT, lineHeight: '1.6',
            }}>
              ⚠️ أرسل كلمة المرور المؤقتة هذه للعميل بشكل آمن. ستُفقد عند إغلاق هذه النافذة.
              يُنصح العميل بتغيير كلمة المرور فور تسجيل الدخول.
            </div>

            <button
              onClick={() => setResetPassResult(null)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                border: 'none', background: '#7c3aed', color: '#fff',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                fontFamily: FONT, transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed'; }}
            >
              تم — إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── Create Company Result Modal — shows credentials ── */}
      {createResult && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={() => setCreateResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '24px', padding: '40px',
              maxWidth: '500px', width: '100%', direction: 'rtl',
              boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
              border: '2px solid #f97316',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg,#f97316,#fbbf24)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: '28px',
              }}>🏢</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', fontFamily: FONT }}>
                تم إنشاء الشركة بنجاح!
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontFamily: FONT }}>
                {createResult.company_name}
              </div>
            </div>

            {/* Credentials box */}
            <div style={{
              background: '#fff7ed', border: '1.5px solid #fed7aa',
              borderRadius: '16px', padding: '20px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 700, fontFamily: FONT, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔐</span> بيانات دخول المدير — أرسلها للعميل
              </div>

              {[
                { label: 'اسم المدير', value: createResult.admin_name, mono: false },
                { label: 'اسم المستخدم', value: createResult.username, mono: true },
                { label: 'كلمة المرور المؤقتة', value: createResult.temp_password, mono: true, secret: true },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid #fed7aa',
                }}>
                  <span style={{ fontSize: '12px', color: '#92400e', fontFamily: FONT }}>{row.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {row.mono ? (
                      <code style={{
                        fontSize: row.secret ? '18px' : '14px',
                        fontWeight: 800,
                        color: row.secret ? '#ea580c' : '#1e293b',
                        background: row.secret ? '#fff7ed' : '#f8fafc',
                        padding: '4px 10px', borderRadius: '8px',
                        letterSpacing: row.secret ? '2px' : '0.5px',
                        fontFamily: 'monospace',
                      }}>
                        {row.value}
                      </code>
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', fontFamily: FONT }}>
                        {row.value}
                      </span>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(row.value)}
                      title="نسخ"
                      style={{
                        padding: '4px 8px', borderRadius: '6px', border: '1px solid #fed7aa',
                        background: '#fff', cursor: 'pointer', fontSize: '12px',
                      }}
                    >📋</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Copy all button */}
            <button
              onClick={() => {
                const text = `بيانات دخول نظام مُحكم ERP\nالشركة: ${createResult.company_name}\nاسم المستخدم: ${createResult.username}\nكلمة المرور المؤقتة: ${createResult.temp_password}\n\nيرجى تغيير كلمة المرور فور تسجيل الدخول.`;
                navigator.clipboard.writeText(text);
                showToast('تم نسخ بيانات الدخول!');
              }}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px',
                border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT, marginBottom: '10px',
              }}
            >
              📋 نسخ كل بيانات الدخول
            </button>

            <div style={{
              background: '#fef3c7', borderRadius: '10px', padding: '12px',
              fontSize: '12px', color: '#92400e', fontFamily: FONT, lineHeight: '1.6',
              marginBottom: '16px',
            }}>
              ⚠️ احفظ كلمة المرور الآن — لن تظهر مجدداً. يمكنك دائماً إعادة تعيينها من قائمة الشركات.
            </div>

            <button
              onClick={() => setCreateResult(null)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                border: '1px solid #e2e8f0', background: '#f8fafc',
                color: '#64748b', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              تم — إغلاق
            </button>
          </div>
        </div>
      )}

      {deleteTarget && deleteStep === 'confirm' && (
        <ConfirmDeleteModal
          title="حذف الشركة"
          body={
            <>
              هل أنت متأكد من حذف شركة{' '}
              <strong style={{ color: C.text }}>"{deleteTarget.name}"</strong>؟<br />
              <span style={{ color: C.danger, fontSize: '13px' }}>
                سيتم حذف جميع البيانات المرتبطة بها نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </span>
            </>
          }
          loading={coDelete.isPending}
          error={deleteCoErr}
          onConfirm={() => coDelete.mutate({ id: deleteTarget.id })}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteCoErr('');
            setDeleteStep('confirm');
            setGeneratedCode('');
            setEnteredCode('');
          }}
        />
      )}

      {deleteTarget && deleteStep === 'code' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            dir="rtl"
            style={{
              background: C.card,
              borderRadius: '20px',
              border: `1px solid rgba(239,68,68,0.4)`,
              padding: '32px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              fontFamily: FONT,
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: C.danger, margin: 0 }}>
                تأكيد الحذف النهائي
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: C.muted, lineHeight: 1.8, marginBottom: '8px' }}>
              الشركة <strong style={{ color: C.text }}>"{deleteTarget.name}"</strong> تحتوي على
              مستخدمين مرتبطين. سيتم حذف الشركة وجميع مستخدميها نهائياً.
            </p>
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '12px', color: C.muted, marginBottom: '6px' }}>
                كود التأكيد — اكتبه في الحقل أدناه
              </div>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 900,
                  letterSpacing: '10px',
                  color: C.danger,
                  fontFamily: 'monospace',
                }}
              >
                {generatedCode}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{ fontSize: '13px', color: C.muted, display: 'block', marginBottom: '6px' }}
              >
                أدخل الكود للتأكيد:
              </label>
              <input
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  border: `2px solid ${enteredCode.length === 6 && enteredCode === generatedCode ? C.success : 'rgba(239,68,68,0.4)'}`,
                  background: 'rgba(15,23,42,0.6)',
                  color: C.text,
                  fontSize: '24px',
                  fontWeight: 900,
                  letterSpacing: '8px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {deleteCoErr && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  marginBottom: '14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  fontSize: '13px',
                  color: C.danger,
                }}
              >
                ⚠️ {deleteCoErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                disabled={enteredCode !== generatedCode || coDelete.isPending}
                onClick={() =>
                  coDelete.mutate({
                    id: deleteTarget.id,
                    force: true,
                    confirm_code: enteredCode,
                    expected_code: generatedCode,
                  })
                }
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: enteredCode === generatedCode ? C.danger : '#4a1a1a',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: enteredCode === generatedCode ? 'pointer' : 'not-allowed',
                  fontFamily: FONT,
                  opacity: enteredCode === generatedCode ? 1 : 0.5,
                }}
              >
                {coDelete.isPending ? 'جاري الحذف...' : 'احذف نهائياً'}
              </button>
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteCoErr('');
                  setDeleteStep('confirm');
                  setGeneratedCode('');
                  setEnteredCode('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.muted,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteMgr && (
        <ConfirmDeleteModal
          title="حذف المدير"
          body={
            <>
              هل أنت متأكد من حذف المدير{' '}
              <strong style={{ color: C.text }}>"{deleteMgr.name}"</strong>؟<br />
              <span style={{ color: C.danger, fontSize: '13px' }}>
                لا يمكن التراجع عن هذا الإجراء.
              </span>
            </>
          }
          loading={mgDelete.isPending}
          error={deleteMgrErr}
          onConfirm={() => mgDelete.mutate(deleteMgr.id)}
          onCancel={() => {
            setDeleteMgr(null);
            setDeleteMgrErr('');
          }}
        />
      )}

      {showAddMgr && (
        <Modal
          title="➕ إضافة مدير عام جديد"
          onClose={() => {
            setShowAddMgr(false);
            resetAddForm();
          }}
        >
          <DarkInput
            label="الاسم الكامل"
            value={mgName}
            onChange={setMgName}
            placeholder="مثال: محمد العلي"
            required
          />
          <DarkInput
            label="اسم المستخدم"
            value={mgUser}
            onChange={setMgUser}
            placeholder="بدون مسافات"
            required
            hint="لا يحتوي على مسافات"
          />
          <DarkInput
            label="الرقم السري"
            value={mgPin}
            onChange={setMgPin}
            type="password"
            placeholder="4 أحرف على الأقل"
            required
          />
          <DarkInput
            label="تأكيد الرقم السري"
            value={mgPin2}
            onChange={setMgPin2}
            type="password"
            placeholder="أعد كتابة الرقم السري"
            required
          />
          {mgErr && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                fontSize: '13px',
                color: C.danger,
                marginBottom: '14px',
              }}
            >
              ⚠️ {mgErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAddMgr}
              disabled={mgCreate.isPending}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: C.orange,
                color: '#fff',
                fontSize: '14px',
                fontWeight: 800,
                cursor: mgCreate.isPending ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                opacity: mgCreate.isPending ? 0.7 : 1,
              }}
            >
              {mgCreate.isPending ? 'جاري الإضافة...' : 'إضافة المدير'}
            </button>
            <button
              onClick={() => {
                setShowAddMgr(false);
                resetAddForm();
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.muted,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {editMgr && (
        <Modal
          title="✏️ تعديل بيانات المدير"
          onClose={() => {
            setEditMgr(null);
            resetEditForm();
          }}
        >
          <DarkInput
            label="الاسم الكامل"
            value={eName}
            onChange={setEName}
            placeholder="الاسم الكامل"
            required
          />
          <DarkInput
            label="اسم المستخدم"
            value={eUser}
            onChange={setEUser}
            placeholder="بدون مسافات"
            required
          />
          <DarkInput
            label="الرقم السري الجديد"
            value={ePin}
            onChange={setEPin}
            type="password"
            placeholder="اتركه فارغاً إذا لم تريد تغييره"
            hint="اختياري — فارغ يعني عدم التغيير"
          />
          {ePin && (
            <DarkInput
              label="تأكيد الرقم السري الجديد"
              value={ePin2}
              onChange={setEPin2}
              type="password"
              placeholder="أعد كتابة الرقم السري الجديد"
            />
          )}
          {eErr && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                fontSize: '13px',
                color: C.danger,
                marginBottom: '14px',
              }}
            >
              ⚠️ {eErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleEditMgr}
              disabled={mgUpdate.isPending}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: C.orange,
                color: '#fff',
                fontSize: '14px',
                fontWeight: 800,
                cursor: mgUpdate.isPending ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                opacity: mgUpdate.isPending ? 0.7 : 1,
              }}
            >
              {mgUpdate.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button
              onClick={() => {
                setEditMgr(null);
                resetEditForm();
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.muted,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── Sticky Header ─── */}
      <div
        style={{
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: C.orangeDim,
              border: '1px solid rgba(249,115,22,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
              لوحة تحكم المدير العام
            </div>
            <div style={{ fontSize: '11px', color: C.muted }}>{today}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Redis status indicator */}
          <div
            title={redisHealth?.status === 'ok' ? `Redis يعمل — ${redisHealth.latency_ms}ms` : 'Redis متوقف'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '20px',
              background: redisHealth?.status === 'ok' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${redisHealth?.status === 'ok' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
              fontSize: '12px', fontWeight: 700,
              color: redisHealth?.status === 'ok' ? '#34D399' : '#EF4444',
              cursor: 'default',
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: redisHealth?.status === 'ok' ? '#34D399' : '#EF4444',
              display: 'inline-block',
              boxShadow: redisHealth?.status === 'ok' ? '0 0 6px #34D399' : '0 0 6px #EF4444',
            }} />
            Redis
          </div>

          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              color: C.muted,
              padding: '8px 18px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: FONT,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.danger;
              e.currentTarget.style.color = C.danger;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.muted;
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
        {/* ── Navigation Cards ─── */}
        {(() => {
          const NAV_CARDS = [
            { key: 'overview',      label: 'نظرة عامة',       icon: '🏠', color: '#F97316', shadow: 'rgba(249,115,22,0.45)',  desc: 'لوحة التحكم الرئيسية' },
            { key: 'companies',     label: 'الشركات',          icon: '🏢', color: '#3B82F6', shadow: 'rgba(59,130,246,0.45)',  desc: 'إدارة الشركات المشتركة' },
            { key: 'managers',      label: 'المديرون',          icon: '👑', color: '#F472B6', shadow: 'rgba(244,114,182,0.45)', desc: 'حسابات مديري النظام' },
            { key: 'revenue',       label: 'الإيرادات',         icon: '📊', color: '#10B981', shadow: 'rgba(16,185,129,0.45)',  desc: 'تقارير الإيرادات والمالية' },
            { key: 'alerts',        label: 'التنبيهات',         icon: '🔔', color: '#EF4444', shadow: 'rgba(239,68,68,0.45)',   desc: 'تنبيهات النظام والأحداث' },
            { key: 'plans',         label: 'الخطط',             icon: '💰', color: '#FBBF24', shadow: 'rgba(251,191,36,0.45)',  desc: 'إعداد خطط الاشتراك والأسعار' },
            { key: 'announcements', label: 'الإعلانات',         icon: '📢', color: '#8B5CF6', shadow: 'rgba(139,92,246,0.45)', desc: 'إشعارات للمستخدمين' },
            { key: 'health',        label: 'صحة السيرفر',       icon: '🌡️', color: '#06B6D4', shadow: 'rgba(6,182,212,0.45)',   desc: 'مراقبة أداء الخوادم' },
            { key: 'monitoring',    label: 'مراقبة التجريبي',  icon: '🛡️', color: '#6366F1', shadow: 'rgba(99,102,241,0.45)',  desc: 'البيئة التجريبية' },
            { key: 'settings',      label: 'الإعدادات',         icon: '⚙️', color: '#64748B', shadow: 'rgba(100,116,139,0.45)', desc: 'إعدادات النظام والأمان' },
          ] as const;

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
              gap: '10px',
              marginBottom: '32px',
            }}>
              {NAV_CARDS.map((card) => {
                const active = activeTab === card.key;
                return (
                  <button
                    key={card.key}
                    onClick={() => setActiveTab(card.key)}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px) scale(1.04)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 10px 28px ${card.shadow}`;
                        (e.currentTarget as HTMLButtonElement).style.borderColor = card.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0) scale(1)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 8px rgba(0,0,0,0.12)`;
                        (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                      }
                    }}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '14px 6px 12px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                      border: active ? `2px solid ${card.color}` : `1.5px solid ${C.border}`,
                      background: active
                        ? `linear-gradient(145deg, ${card.color}22 0%, ${card.color}08 100%)`
                        : C.card,
                      boxShadow: active
                        ? `0 8px 24px ${card.shadow}, inset 0 1px 0 ${card.color}30`
                        : `0 2px 8px rgba(0,0,0,0.12)`,
                      transform: active ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
                      outline: 'none',
                      overflow: 'hidden',
                      minWidth: 0,
                    }}
                  >
                    {active && (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0,
                        height: '3px',
                        background: `linear-gradient(90deg, ${card.color}, ${card.color}99)`,
                        borderRadius: '14px 14px 0 0',
                      }} />
                    )}
                    <span style={{
                      fontSize: '22px',
                      lineHeight: 1,
                      filter: active ? 'drop-shadow(0 2px 6px ' + card.shadow + ')' : 'none',
                      transition: 'filter 0.2s',
                    }}>
                      {card.icon}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: active ? card.color : C.text,
                      letterSpacing: '0.01em',
                      transition: 'color 0.2s',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}>
                      {card.label}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      color: active ? card.color + 'bb' : C.muted,
                      textAlign: 'center',
                      lineHeight: 1.3,
                      transition: 'color 0.2s',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    }}>
                      {card.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* ══════════════════════════════
            TAB: OVERVIEW  🏠
            ══════════════════════════════ */}
        {activeTab === 'overview' && (
          <TabOverview
            healthData={healthData}
            healthLoading={healthLoading}
            stats={stats}
            overviewAudit={overviewAudit}
            setActiveTab={setActiveTab}
            setStatusFilter={setStatusFilter}
            setSettingsActiveCard={setSettingsActiveCard}
          />
        )}

        {/* ══════════════════════════════
            TAB: COMPANIES
            ══════════════════════════════ */}
        {activeTab === 'companies' && (
          <>
            {/* Stats cards — 8 in one row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                gap: '12px',
                marginBottom: '28px',
              }}
            >
              {statCards.map((s) => (
                <div
                  key={s.label}
                  onClick={() => {
                    setActiveTab(s.tab);
                    if (s.filter !== null && s.tab === 'companies') setStatusFilter(s.filter);
                    setTimeout(() => {
                      document.getElementById('companies-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  style={{
                    background: C.card,
                    borderRadius: '14px',
                    border: `1px solid ${C.border}`,
                    borderTop: `3px solid ${s.color}`,
                    padding: '16px 10px 14px',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Glow blob */}
                  <div style={{
                    position: 'absolute', top: '-10px', right: '-10px',
                    width: '50px', height: '50px', borderRadius: '50%',
                    background: `${s.color}18`, pointerEvents: 'none',
                  }} />
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>
                    <AnimatedNumber target={s.value} />
                  </div>
                  <div style={{ fontSize: '11px', color: C.text, marginTop: '6px', fontWeight: 700, lineHeight: 1.3 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>{s.sub}</div>
                  {/* Arrow hint */}
                  <div style={{
                    position: 'absolute', bottom: '6px', left: '8px',
                    fontSize: '10px', color: s.color, opacity: 0.6,
                  }}>↗</div>
                </div>
              ))}
            </div>

            {/* ── Expiring Soon Alert ── */}
            {stats && stats.expiringSoon > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1.5px solid rgba(239,68,68,0.3)',
                borderRadius: '16px',
                padding: '18px 22px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <span style={{ fontWeight: 800, color: C.danger, fontSize: '15px' }}>
                    {stats.expiringSoon} شركة اشتراكها ينتهي خلال 7 أيام
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.expiringSoonList.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: C.card, borderRadius: '10px', padding: '10px 16px',
                      border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: c.days_left <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)',
                          color: c.days_left <= 2 ? C.danger : C.warning,
                          borderRadius: '8px', padding: '3px 10px',
                          fontSize: '13px', fontWeight: 700,
                        }}>
                          {c.days_left === 0 ? 'ينتهي اليوم' : `${c.days_left} يوم`}
                        </span>
                        <span style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>{c.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: C.muted }}>{c.end_date}</span>
                        <button
                          onClick={() => coMutate.mutate({
                            url: `/api/super/companies/${c.id}/extend`,
                            body: { days: 30, plan_type: c.plan_type },
                          })}
                          style={{
                            padding: '5px 12px', borderRadius: '8px',
                            border: '1px solid rgba(249,115,22,0.4)',
                            background: 'rgba(249,115,22,0.1)',
                            color: C.warning, fontSize: '12px',
                            fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                          }}
                        >
                          ⏳ تمديد 30 يوم
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Monthly Signups — Compact Strip ── */}
            {stats && stats.monthlySignups && stats.monthlySignups.some(m => m.count > 0) && (() => {
              const raw   = stats.monthlySignups;
              const total = raw.reduce((s, m) => s + m.count, 0);
              const last  = raw[raw.length - 1]?.count ?? 0;
              const prev     = raw[raw.length - 2]?.count ?? 0;
              const growthPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
              const growing   = growthPct >= 0;
              const maxVal    = Math.max(...raw.map(m => m.count), 1);

              return (
                <div style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                }}>
                  {/* Label + total */}
                  <div style={{ flexShrink: 0, borderLeft: `3px solid ${C.orange}`, paddingLeft: '14px' }}>
                    <div style={{ fontSize: '11px', color: C.muted, marginBottom: '4px', whiteSpace: 'nowrap' }}>
                      التسجيلات — آخر 6 أشهر
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '26px', fontWeight: 900, color: C.orange, lineHeight: 1 }}>
                        {total}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '20px',
                        background: growing ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: growing ? C.success : C.danger,
                        border: `1px solid ${growing ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {growing ? '↑' : '↓'}{Math.abs(growthPct)}%
                      </span>
                    </div>
                  </div>

                  {/* Month columns */}
                  <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    {raw.map((m, i) => {
                      const pct    = maxVal > 0 ? m.count / maxVal : 0;
                      const isLast = i === raw.length - 1;
                      const barH   = Math.max(pct * 36, m.count > 0 ? 4 : 2);
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          {/* Count */}
                          <div style={{
                            fontSize: '13px',
                            fontWeight: isLast ? 900 : 600,
                            color: isLast ? C.orange : m.count > 0 ? C.text : C.muted,
                          }}>
                            {m.count || '—'}
                          </div>
                          {/* Bar */}
                          <div style={{
                            width: '100%',
                            height: `${barH}px`,
                            borderRadius: '4px',
                            background: isLast
                              ? `linear-gradient(to top, ${C.orange}, ${C.warning})`
                              : m.count > 0
                                ? `rgba(249,115,22,${0.2 + pct * 0.5})`
                                : C.border,
                          }} />
                          {/* Month */}
                          <div style={{
                            fontSize: '10px',
                            color: isLast ? C.orange : C.muted,
                            fontWeight: isLast ? 700 : 400,
                            whiteSpace: 'nowrap',
                          }}>
                            {m.month}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Companies table card */}
            <div
              id="companies-table"
              style={{
                background: C.card,
                borderRadius: '20px',
                border: `1px solid ${C.border}`,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>
                    الشركات المسجّلة
                  </h2>
                  <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>
                    عرض {filtered.length} من {companies.length} شركة
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: showCreate ? 'transparent' : C.orange,
                    color: showCreate ? C.muted : '#fff',
                    border: showCreate ? `1px solid ${C.border}` : 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    transition: 'all 0.18s',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{showCreate ? '✕' : '+'}</span>
                  <span>{showCreate ? 'إلغاء' : 'شركة جديدة'}</span>
                </button>
              </div>

              {/* Search + filter + per-page + view mode */}
              <div
                style={{
                  padding: '14px 24px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
                  <span style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث عن شركة…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 36px 8px 12px', borderRadius: '10px',
                      border: `1.5px solid ${C.border}`, background: C.bg,
                      color: C.text, fontSize: '13px', fontFamily: FONT,
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = C.border; }}
                  />
                </div>

                {/* Status filters */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {STATUS_FILTERS.map((f) => {
                    const active = statusFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        style={{
                          padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                          fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                          transition: 'all 0.15s',
                          border: active ? 'none' : `1px solid ${C.border}`,
                          background: active ? C.orange : 'transparent',
                          color: active ? '#fff' : C.muted,
                        }}
                      >{f.label}</button>
                    );
                  })}
                </div>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Per-page selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' }}>عدد الصفوف:</span>
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    style={{
                      padding: '6px 10px', borderRadius: '8px', border: `1px solid ${C.border}`,
                      background: C.bg, color: C.text, fontSize: '12px',
                      fontFamily: FONT, cursor: 'pointer', outline: 'none',
                    }}
                  >
                    {[10, 25, 50, 100].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* View mode toggle */}
                <div style={{ display: 'flex', gap: '4px', background: C.bg, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '3px' }}>
                  {(['table', 'cards'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      title={m === 'table' ? 'عرض جدول' : 'عرض بطاقات'}
                      style={{
                        padding: '5px 10px', borderRadius: '7px', border: 'none',
                        background: viewMode === m ? C.orange : 'transparent',
                        color: viewMode === m ? '#fff' : C.muted,
                        fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s',
                        lineHeight: 1,
                      }}
                    >
                      {m === 'table' ? '☰' : '⊞'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Create form */}
              {showCreate && (
                <div
                  style={{
                    padding: '20px 24px',
                    background: 'rgba(249,115,22,0.06)',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div style={{ flex: '2 1 200px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: C.muted,
                          display: 'block',
                          marginBottom: '6px',
                        }}
                      >
                        اسم الشركة *
                      </label>
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="مثال: شركة الأمل التجارية"
                        style={{
                          width: '100%',
                          border: `1.5px solid ${C.border}`,
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          outline: 'none',
                          fontFamily: FONT,
                          boxSizing: 'border-box',
                          background: C.bg,
                          color: C.text,
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = C.orange;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = C.border;
                        }}
                      />
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: C.muted,
                          display: 'block',
                          marginBottom: '6px',
                        }}
                      >
                        نوع الاشتراك
                      </label>
                      <select
                        value={newPlan}
                        onChange={(e) => setNewPlan(e.target.value)}
                        style={{
                          width: '100%',
                          border: `1.5px solid ${C.border}`,
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '14px',
                          background: C.bg,
                          color: C.text,
                          fontFamily: FONT,
                        }}
                      >
                        <option value="trial">تجريبي</option>
                        <option value="basic">أساسي</option>
                        <option value="professional">احترافي</option>
                        <option value="paid">مدفوع</option>
                      </select>
                    </div>

                    {/* Edition (ADVANCED / ULTIMATE) */}
                    <div style={{ flex: '1 1 150px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                        🏷️ نسخة النظام
                      </label>
                      <select
                        value={newEdition}
                        onChange={(e) => setNewEdition(e.target.value as 'advanced' | 'ultimate')}
                        style={{
                          width: '100%',
                          border: `1.5px solid ${newEdition === 'ultimate' ? '#6366f1' : '#f59e0b'}`,
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '14px',
                          background: C.bg,
                          color: newEdition === 'ultimate' ? '#a5b4fc' : '#fcd34d',
                          fontFamily: FONT,
                          fontWeight: 700,
                        }}
                      >
                        <option value="ultimate">⭐ MUHKAM ULTIMATE (كاملة)</option>
                        <option value="advanced">🚀 MUHKAM ADVANCED (متوسطة)</option>
                      </select>
                    </div>

                    <div style={{ flex: '1 1 110px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: C.muted,
                          display: 'block',
                          marginBottom: '6px',
                        }}
                      >
                        المدة (أيام)
                      </label>
                      <select
                        value={newDays}
                        onChange={(e) => setNewDays(Number(e.target.value))}
                        style={{
                          width: '100%',
                          border: `1.5px solid ${C.border}`,
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '14px',
                          background: C.bg,
                          color: C.text,
                          fontFamily: FONT,
                        }}
                      >
                        {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                          <option key={d} value={d}>
                            {d} يوم
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Admin name */}
                    <div style={{ flex: '1 1 160px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                        اسم المدير *
                      </label>
                      <input
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="مثال: أحمد محمد"
                        style={{
                          width: '100%', border: `1.5px solid ${C.border}`,
                          borderRadius: '10px', padding: '10px 14px',
                          fontSize: '14px', outline: 'none', fontFamily: FONT,
                          boxSizing: 'border-box', background: C.bg, color: C.text,
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = C.border; }}
                      />
                    </div>

                    {/* Admin username */}
                    <div style={{ flex: '1 1 150px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                        اسم مستخدم المدير
                        <span style={{ fontWeight: 400, color: C.muted, marginRight: '4px' }}>(اختياري)</span>
                      </label>
                      <input
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                        placeholder="مثال: ahmed_mgr"
                        dir="ltr"
                        style={{
                          width: '100%', border: `1.5px solid ${C.border}`,
                          borderRadius: '10px', padding: '10px 14px',
                          fontSize: '14px', outline: 'none', fontFamily: 'monospace',
                          boxSizing: 'border-box', background: C.bg, color: C.text,
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = C.border; }}
                      />
                      <div style={{ fontSize: '10px', color: C.muted, marginTop: '3px' }}>
                        يُكمَّل تلقائياً لو تُركت فارغة
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      onClick={() => {
                        if (!newName.trim() || !newAdminName.trim()) return;
                        coMutate.mutate(
                          {
                            url: '/api/super/companies',
                            method: 'POST',
                            body: {
                              name: newName.trim(),
                              plan_type: newPlan,
                              edition: newEdition,
                              duration_days: newDays,
                              admin_name: newAdminName.trim(),
                              admin_username: newAdminUsername.trim() || undefined,
                            },
                          },
                          {
                            onSuccess: (data: unknown) => {
                              setShowCreate(false);
                              setNewName(''); setNewPlan('trial'); setNewEdition('ultimate'); setNewDays(14);
                              setNewAdminName(''); setNewAdminUsername('');
                              const d = data as { company?: { name?: string }; admin?: { username?: string; name?: string; temp_password?: string } } | null;
                              setCreateResult({
                                company_name: d?.company?.name ?? newName,
                                username:     d?.admin?.username ?? '',
                                admin_name:   d?.admin?.name    ?? newAdminName,
                                temp_password: d?.admin?.temp_password ?? '',
                              });
                            },
                          }
                        );
                      }}
                      disabled={!newName.trim() || !newAdminName.trim() || coMutate.isPending}
                      style={{
                        padding: '10px 22px', borderRadius: '10px', border: 'none',
                        background: (newName.trim() && newAdminName.trim()) ? C.orange : C.border,
                        color: '#fff', fontSize: '14px', fontWeight: 700,
                        cursor: (newName.trim() && newAdminName.trim()) ? 'pointer' : 'default',
                        fontFamily: FONT, flexShrink: 0, transition: 'filter 0.15s',
                        alignSelf: 'flex-end', marginBottom: '20px',
                      }}
                    >
                      {coMutate.isPending ? 'جاري الإنشاء...' : '🏢 إنشاء الشركة'}
                    </button>
                  </div>
                </div>
              )}

              {/* Table / Cards body */}
              {coLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
                  جاري التحميل...
                </div>
              ) : paged.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
                  {search || statusFilter !== 'all'
                    ? 'لا توجد نتائج مطابقة للبحث'
                    : 'لا توجد شركات مسجّلة بعد'}
                </div>
              ) : viewMode === 'cards' ? (
                <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                  {paged.map((co) => {
                    const st = STATUS[co.status] ?? STATUS.active;
                    const expiry = expiryInfo(co);
                    return (
                      <div
                        key={co.id}
                        style={{
                          background: C.bg, borderRadius: '14px',
                          border: `1.5px solid ${C.border}`, padding: '16px',
                          display: 'flex', flexDirection: 'column', gap: '10px',
                          transition: 'border-color 0.18s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                      >
                        {/* Card header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: C.orangeDim, border: '1px solid rgba(249,115,22,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', flexShrink: 0,
                          }}>🏢</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '14px', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{co.name}</div>
                            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{co.admin_email ?? '—'}</div>
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '3px 8px',
                            borderRadius: '20px', background: st.bg, color: st.text, whiteSpace: 'nowrap',
                          }}>{st.label}</span>
                        </div>
                        {/* Info rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: C.muted }}>الخطة</span>
                            <span style={{ color: C.text, fontWeight: 700 }}>{translatePlan(co.plan_type)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: C.muted }}>الانتهاء</span>
                            <span style={{ color: expiry.color, fontWeight: 600, fontSize: '11px' }}>{expiry.text}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: C.muted }}>المستخدمون</span>
                            <span style={{ color: C.text, fontWeight: 700 }}>{co.userCount ?? 0}</span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', paddingTop: '4px', flexWrap: 'wrap' }}>
                          <ActionBtn
                            label="الاشتراك" icon="💳" color={C.orange}
                            onClick={() => {
                              setPanelTab(0);
                              setSubModal(co);
                              setSubForm({
                                plan_type: co.plan_type ?? 'trial',
                                edition: (co.edition as 'advanced' | 'ultimate') ?? 'ultimate',
                                extend_mode: 'days', extend_days: 30,
                                end_date: co.end_date?.slice(0, 10) ?? '',
                                is_active: co.status === 'active',
                                features: (co.features as CompanyFeatures) ?? DEFAULT_FEATS_ULTIMATE,
                              });
                            }}
                          />
                          <ActionBtn
                            label="لقطة" icon="📊" color="#60A5FA"
                            onClick={() => setSnapshotCompany(co.id)}
                          />
                          <ActionBtn
                            label="حذف" icon="🗑" color={C.danger}
                            onClick={() => { setDeleteTarget(co); setDeleteCoErr(''); }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  {/* Column headers */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
                      gap: '8px',
                      padding: '10px 24px',
                      background: 'rgba(249,115,22,0.08)',
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: '11px',
                      fontWeight: 700,
                      color: C.orange,
                      alignItems: 'center',
                    }}
                  >
                    <div>#</div>
                    <div>الشركة</div>
                    <div style={{ textAlign: 'center' }}>الحالة</div>
                    <div>تاريخ الانتهاء</div>
                    <div style={{ textAlign: 'center' }}>مستخدمين</div>
                    <div style={{ textAlign: 'center' }}>الخطة</div>
                    <div />
                  </div>

                  {paged.map((co, idx) => {
                    const isExpanded = expandedId === co.id;
                    const st = STATUS[co.status] ?? STATUS.active;
                    const isOdd = idx % 2 === 1;
                    const expiry = expiryInfo(co);
                    return (
                      <div key={co.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : co.id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
                            gap: '8px',
                            padding: '14px 24px',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            background: isOdd ? 'rgba(15,23,42,0.4)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(249,115,22,0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isOdd
                              ? 'rgba(15,23,42,0.4)'
                              : 'transparent';
                          }}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: C.orangeDim,
                              border: '1px solid rgba(249,115,22,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 900,
                              color: C.orange,
                              flexShrink: 0,
                            }}
                          >
                            #{co.id}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                color: C.text,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {co.name}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: C.muted,
                                direction: 'ltr',
                                textAlign: 'right',
                              }}
                            >
                              {co.admin_email ?? '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span
                              style={{
                                background: st.bg,
                                color: st.text,
                                border: `1px solid ${st.border}`,
                                padding: '3px 10px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-block',
                              }}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: expiry.color,
                              lineHeight: 1.5,
                            }}
                          >
                            {expiry.text}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: C.orange }}>
                              {co.userCount}
                            </div>
                            <div style={{ fontSize: '10px', color: C.muted }}>مستخدم</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted }}>
                              {translatePlan(co.plan_type)}
                            </div>
                            <span style={{
                              display: 'inline-block',
                              marginTop: '3px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: co.edition === 'advanced' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                              color: co.edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
                              border: `1px solid ${co.edition === 'advanced' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                            }}>
                              {co.edition === 'advanced' ? '🚀 MuhKam Advanced' : '⭐ MuhKam Pro'}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: C.muted,
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                              textAlign: 'center',
                            }}
                          >
                            ▶
                          </div>
                        </div>

                        {isExpanded && (
                          <div
                            style={{
                              padding: '16px 24px 20px',
                              background: 'rgba(15,23,42,0.6)',
                              borderTop: `1px solid ${C.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                alignItems: 'center',
                              }}
                            >
                              {!co.is_active && (
                                <ActionBtn
                                  label="تفعيل الشركة"
                                  icon="✅"
                                  color={C.success}
                                  onClick={() =>
                                    coMutate.mutate({
                                      url: `/api/super/companies/${co.id}/activate`,
                                    })
                                  }
                                />
                              )}
                              {co.is_active && (
                                <ActionBtn
                                  label="إيقاف الشركة"
                                  icon="⛔"
                                  color={C.danger}
                                  onClick={() =>
                                    coMutate.mutate({
                                      url: `/api/super/companies/${co.id}/suspend`,
                                    })
                                  }
                                />
                              )}
                              <ActionBtn
                                label="إدارة الاشتراك"
                                icon="📋"
                                color={C.orange}
                                onClick={() => {
                                  const ed = (co.edition ?? 'ultimate') as 'advanced' | 'ultimate';
                                  const defaultFeats = ed === 'advanced' ? DEFAULT_FEATS_ADVANCED : DEFAULT_FEATS_ULTIMATE;
                                  const feats: CompanyFeatures = co.features
                                    ? { ...defaultFeats, ...co.features }
                                    : { ...defaultFeats };
                                  setPanelTab(0);
                                  setSubModal(co);
                                  setSubForm({
                                    plan_type: co.plan_type,
                                    edition: ed,
                                    extend_mode: 'days',
                                    extend_days: 30,
                                    end_date: co.end_date?.slice(0, 10) ?? '',
                                    is_active: co.is_active,
                                    features: feats,
                                  });
                                }}
                              />

                              {/* Edition switcher */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '6px 12px' }}>
                                <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>🏷️ النسخة:</span>
                                <select
                                  value={co.edition ?? 'ultimate'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    coMutate.mutate({
                                      url: `/api/super/companies/${co.id}`,
                                      method: 'PUT',
                                      body: { edition: e.target.value },
                                    });
                                  }}
                                  style={{
                                    border: `1.5px solid ${co.edition === 'advanced' ? '#f59e0b' : '#6366f1'}`,
                                    borderRadius: '8px',
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    background: C.bg,
                                    color: co.edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
                                    fontFamily: FONT,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="ultimate">⭐ MuhKam Pro</option>
                                  <option value="advanced">🚀 MuhKam Advanced</option>
                                </select>
                              </div>

                              <ActionBtn
                                label="🔑 إعادة تعيين كلمة المرور"
                                icon=""
                                color="#7c3aed"
                                onClick={() =>
                                  resetPassword.mutate({
                                    id: co.id,
                                    company_name: co.name,
                                  })
                                }
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteCoErr('');
                                  setDeleteTarget(co);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 14px',
                                  borderRadius: '10px',
                                  border: '1.5px solid rgba(239,68,68,0.4)',
                                  background: 'rgba(239,68,68,0.1)',
                                  color: C.danger,
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  fontFamily: FONT,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                                }}
                              >
                                🗑️ <span>حذف الشركة</span>
                              </button>
                              <div
                                style={{ fontSize: '12px', color: C.muted, marginRight: 'auto' }}
                              >
                                تسجيل:{' '}
                                {new Date(co.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination — always visible */}
              {!coLoading && filtered.length > 0 && (
                <div
                  style={{
                    padding: '12px 24px',
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    background: 'rgba(249,115,22,0.03)',
                  }}
                >
                  <span style={{ fontSize: '12px', color: C.muted }}>
                    عرض {filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)} من {filtered.length} شركة
                    {' · '}الصفحة {safePage} من {totalPages}
                  </span>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <PageBtn
                        label="السابق"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      />
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const start = Math.max(1, safePage - 3);
                        return start + i;
                      }).filter(p => p <= totalPages).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            fontFamily: FONT, transition: 'all 0.15s',
                            border: p === safePage ? 'none' : `1px solid ${C.border}`,
                            background: p === safePage ? C.orange : 'transparent',
                            color: p === safePage ? '#fff' : C.muted,
                          }}
                        >{p}</button>
                      ))}
                      <PageBtn
                        label="التالي"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════
            TAB: MANAGERS
            ══════════════════════════════ */}
        {activeTab === 'managers' && (
          <div
            style={{
              background: C.card,
              borderRadius: '20px',
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>
                  المديرون العامون
                </h2>
                <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>
                  {managers.length} مدير عام مسجّل
                </p>
              </div>
              <button
                onClick={() => {
                  resetAddForm();
                  setShowAddMgr(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: C.orange,
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                <span>➕</span>
                <span>مدير عام جديد</span>
              </button>
            </div>

            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 140px 160px 90px 1fr',
                gap: '8px',
                padding: '10px 24px',
                background: 'rgba(249,115,22,0.08)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: '11px',
                fontWeight: 700,
                color: C.orange,
                alignItems: 'center',
              }}
            >
              <div>#</div>
              <div>الاسم</div>
              <div>اسم المستخدم</div>
              <div>آخر دخول</div>
              <div style={{ textAlign: 'center' }}>الحالة</div>
              <div style={{ textAlign: 'center' }}>الإجراءات</div>
            </div>

            {mgLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
                جاري التحميل...
              </div>
            ) : mgError ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
                <div style={{ color: C.danger, fontWeight: 700, marginBottom: '8px' }}>
                  تعذّر جلب بيانات المديرين
                </div>
                <div style={{ color: C.muted, fontSize: '13px', marginBottom: '16px' }}>
                  تحقق من الاتصال بالخادم أو أعد تسجيل الدخول
                </div>
                <button
                  onClick={() => void mgRefetch()}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    background: C.orange,
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : managers.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
                لا يوجد مديرون عامون مسجّلون
              </div>
            ) : (
              managers.map((m, idx) => {
                const isMe = m.id === user?.id;
                const isOdd = idx % 2 === 1;
                const isActive = m.active !== false;
                const lastLogin = m.last_login
                  ? new Date(m.last_login).toLocaleDateString('ar-EG-u-nu-latn', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'لم يسجل بعد';

                return (
                  <div
                    key={m.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      background: isOdd ? 'rgba(15,23,42,0.4)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr 140px 160px 90px 1fr',
                        gap: '8px',
                        padding: '14px 24px',
                        alignItems: 'center',
                      }}
                    >
                      {/* ID badge */}
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: C.orangeDim,
                          border: '1px solid rgba(249,115,22,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 900,
                          color: C.orange,
                          flexShrink: 0,
                        }}
                      >
                        #{m.id}
                      </div>

                      {/* Name */}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
                          {m.name}
                          {isMe && (
                            <span
                              style={{
                                marginRight: '8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: C.orange,
                                background: C.orangeDim,
                                border: `1px solid rgba(249,115,22,0.3)`,
                                padding: '2px 8px',
                                borderRadius: '10px',
                              }}
                            >
                              أنت
                            </span>
                          )}
                        </div>
                        {m.email && (
                          <div style={{ fontSize: '11px', color: C.muted }}>{m.email}</div>
                        )}
                      </div>

                      {/* Username */}
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: C.muted,
                          direction: 'ltr',
                        }}
                      >
                        @{m.username}
                      </div>

                      {/* Last login */}
                      <div style={{ fontSize: '12px', color: m.last_login ? C.success : C.muted }}>
                        {lastLogin}
                      </div>

                      {/* Status */}
                      <div style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-block',
                            background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)',
                            color: isActive ? C.success : C.muted,
                            border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.2)'}`,
                          }}
                        >
                          {isActive ? 'نشط' : 'موقوف'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          justifyContent: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(m)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: `1.5px solid ${C.orange}44`,
                            background: `${C.orange}18`,
                            color: C.orange,
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: FONT,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = `${C.orange}30`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = `${C.orange}18`;
                          }}
                        >
                          ✏️ تعديل
                        </button>

                        {/* Toggle */}
                        {!isMe && (
                          <button
                            onClick={() => mgToggle.mutate(m.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: `1.5px solid ${isActive ? C.danger : C.success}44`,
                              background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                              color: isActive ? C.danger : C.success,
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: FONT,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '0.8';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                          >
                            {isActive ? '⛔ إيقاف' : '✅ تفعيل'}
                          </button>
                        )}

                        {/* Delete */}
                        {!isMe && (
                          <button
                            onClick={() => {
                              setDeleteMgrErr('');
                              setDeleteMgr(m);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1.5px solid rgba(239,68,68,0.4)',
                              background: 'rgba(239,68,68,0.1)',
                              color: C.danger,
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: FONT,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                            }}
                          >
                            🗑️ حذف
                          </button>
                        )}

                        {isMe && (
                          <span style={{ fontSize: '11px', color: C.muted, alignSelf: 'center' }}>
                            لا يمكن تعديل الحساب الحالي هنا
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}


        {/* ══════════════════════════════
            TAB: SETTINGS  (support + audit + backups + security)
            ══════════════════════════════ */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Hidden restore file input */}
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,.json.enc"
              style={{ display: 'none' }}
              onChange={(e) => { void handleRestoreFileChange(e); }}
            />

            {/* Restore confirmation modal */}
            {restoreModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.7)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: '20px',
              }}>
                <div style={{
                  background: C.card, borderRadius: '20px',
                  border: '1px solid rgba(239,68,68,0.4)', padding: '28px',
                  width: '100%', maxWidth: '440px', direction: 'rtl', fontFamily: FONT,
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</div>
                  <h3 style={{ color: '#EF4444', fontWeight: 800, marginBottom: '8px' }}>تأكيد الاستعادة</h3>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>
                    سيتم حذف البيانات الحالية لجميع الشركات واستبدالها بمحتوى الملف.<br />
                    <strong style={{ color: '#F97316' }}>{pendingRestoreFile?.name}</strong>
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>
                    اكتب <strong style={{ color: '#EF4444' }}>RESTORE</strong> للتأكيد:
                  </p>
                  <input
                    value={restoreCode}
                    onChange={(e) => setRestoreCode(e.target.value)}
                    placeholder="RESTORE"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '14px', marginBottom: '16px',
                      fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => { setRestoreModal(false); setPendingRestoreFile(null); }}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                        color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: FONT,
                      }}
                    >إلغاء</button>
                    <button
                      onClick={() => { void confirmRestore(); }}
                      disabled={restoreCode !== 'RESTORE'}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                        background: restoreCode === 'RESTORE' ? '#EF4444' : 'rgba(239,68,68,0.2)',
                        color: restoreCode === 'RESTORE' ? '#fff' : 'rgba(255,255,255,0.3)',
                        cursor: restoreCode === 'RESTORE' ? 'pointer' : 'not-allowed',
                        fontWeight: 800, fontFamily: FONT,
                      }}
                    >تأكيد الاستعادة</button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ كروت الإعدادات ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
              {([
                { key: 'support'   as const, icon: '⚙️', label: 'معلومات التواصل', desc: 'واتساب وبريد الدعم الفني',    color: '#F97316' },
                { key: 'backup'    as const, icon: '💾', label: 'النسخ الاحتياطية', desc: 'إنشاء / استعادة / تشفير',     color: '#34D399' },
                { key: 'security'  as const, icon: '🔐', label: 'الأمان',            desc: 'المصادقة الثنائية وقيود IP', color: '#A78BFA' },
                { key: 'audit_log' as const, icon: '📋', label: 'سجل العمليات',      desc: 'مراقبة جميع إجراءات النظام', color: '#60A5FA' },
                { key: 'telegram'  as const, icon: '📨', label: 'إشعارات تليجرام',   desc: 'تحكم في التنبيهات والـ Cooldown', color: '#38BDF8' },
              ]).map(card => {
                const isActive = settingsActiveCard === card.key;
                return (
                  <div
                    key={card.key}
                    onClick={() => setSettingsActiveCard(isActive ? null : card.key)}
                    style={{
                      background: isActive ? `${card.color}1A` : C.card,
                      border: `1.5px solid ${isActive ? card.color : C.border}`,
                      borderRadius: '16px', padding: '22px 20px',
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', gap: '10px',
                      boxShadow: isActive ? `0 0 0 3px ${card.color}30, 0 8px 32px ${card.color}25` : 'none',
                      transform: isActive ? 'translateY(-2px)' : '',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = card.color; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 4px 20px ${card.color}20`; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none'; } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '28px' }}>{card.icon}</span>
                      {isActive && <span style={{ color: card.color, fontSize: '18px', fontWeight: 900 }}>✕</span>}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: isActive ? card.color : C.text }}>{card.label}</div>
                    <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.5 }}>{card.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* ═══ لوحة المحتوى المنبثقة ═══ */}
            {settingsActiveCard && (
              <div style={{ background: C.card, borderRadius: '18px', border: `1.5px solid ${settingsActiveCard === 'support' ? '#F97316' : settingsActiveCard === 'backup' ? '#34D399' : settingsActiveCard === 'security' ? '#A78BFA' : settingsActiveCard === 'audit_log' ? '#60A5FA' : settingsActiveCard === 'telegram' ? '#38BDF8' : C.border}50`, overflow: 'hidden', animation: 'sa-panel-in 0.25s ease-out both' }}>
                {(() => {
                  const CARD_COLOR: Record<string, string> = { support: '#F97316', backup: '#34D399', security: '#A78BFA', audit_log: '#60A5FA', telegram: '#38BDF8' };
                  const hc = settingsActiveCard ? (CARD_COLOR[settingsActiveCard] ?? C.border) : C.border;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: `${hc}12` }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: hc }}>
                        {settingsActiveCard === 'support'   && '⚙️ معلومات التواصل للدعم'}
                        {settingsActiveCard === 'backup'    && '💾 النسخ الاحتياطية'}
                        {settingsActiveCard === 'security'  && '🔐 الأمان'}
                        {settingsActiveCard === 'audit_log' && '📋 سجل العمليات'}
                        {settingsActiveCard === 'telegram'  && '📨 إشعارات تليجرام'}
                      </h3>
                      <button onClick={() => setSettingsActiveCard(null)} style={{ background: 'transparent', border: `1px solid ${hc}50`, borderRadius: '8px', color: hc, fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '4px 10px', fontWeight: 700 }}>✕</button>
                    </div>
                  );
                })()}
                {/* ── Support ── */}
                {settingsActiveCard === 'support' && (
                  <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: '12px', color: C.muted, margin: '0 0 20px' }}>
                      تُستخدم هذه المعلومات في صفحة انتهاء الاشتراك وفي شريط التنبيه للمستخدمين
                    </p>
                    <DarkInput
                      label="رقم واتساب للدعم"
                      value={supportWa}
                      onChange={setSupportWa}
                      placeholder="مثال: 966501234567"
                      hint="أدخل الرقم كاملاً مع رمز الدولة بدون + أو مسافات"
                    />
                    <DarkInput
                      label="البريد الإلكتروني للدعم"
                      value={supportEmail}
                      onChange={setSupportEmail}
                      placeholder="support@example.com"
                      type="email"
                    />
                    <button
                      onClick={() => { void saveSupportSettings(); }}
                      disabled={settingSaving}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                        background: settingSaving ? C.border : C.orange,
                        color: '#fff', fontSize: '14px', fontWeight: 800,
                        cursor: settingSaving ? 'not-allowed' : 'pointer',
                        fontFamily: FONT, transition: 'filter 0.15s', marginTop: '4px',
                      }}
                    >
                  {settingSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
                </button>
                  </div>
                )}
                {/* ── Backup ── */}
                {settingsActiveCard === 'backup' && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Header actions */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                    }}>
                      <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>
                        النسخ التلقائي يعمل يومياً الساعة 3:00 صباحاً •{' '}
                        {backupData ? `${backupData.total} نسخة متوفرة` : 'جاري التحميل...'}
                      </p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { void triggerBackup(); }}
                          disabled={creatingBackup}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 18px', borderRadius: '10px', border: 'none',
                            background: creatingBackup ? C.border : C.orange,
                            color: '#fff', fontSize: '13px', fontWeight: 800,
                            cursor: creatingBackup ? 'not-allowed' : 'pointer', fontFamily: FONT,
                          }}
                        >
                          💾 {creatingBackup ? 'جاري الإنشاء...' : 'إنشاء نسخة الآن'}
                        </button>
                        <button
                          onClick={openRestorePicker}
                          disabled={restoring}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 18px', borderRadius: '10px',
                            border: '1px solid rgba(139,92,246,0.4)',
                            background: 'rgba(139,92,246,0.1)',
                            color: '#A78BFA', fontSize: '13px', fontWeight: 800,
                            cursor: restoring ? 'not-allowed' : 'pointer', fontFamily: FONT,
                          }}
                        >
                          {restoring ? '⏳ جاري الاستعادة...' : '📥 استعادة من ملف'}
                        </button>
                      </div>
                    </div>
                    {restoreOk && (
                      <div style={{
                        padding: '14px 18px', borderRadius: '12px',
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        color: '#22C55E', fontSize: '13px', fontWeight: 700,
                      }}>✅ {restoreOk}</div>
                    )}
                    {restoreErr && (
                      <div style={{
                        padding: '14px 18px', borderRadius: '12px',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#EF4444', fontSize: '13px',
                      }}>❌ {restoreErr}</div>
                    )}
                    {/* Backups table */}
                    <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px',
                        gap: '8px', padding: '10px 20px',
                        background: 'rgba(249,115,22,0.08)',
                        borderBottom: `1px solid ${C.border}`,
                        fontSize: '11px', fontWeight: 700, color: C.orange,
                      }}>
                        <div>اسم الملف</div>
                        <div style={{ textAlign: 'center' }}>الحجم</div>
                        <div style={{ textAlign: 'center' }}>التاريخ</div>
                        <div style={{ textAlign: 'center' }}>تنزيل</div>
                      </div>
                      {!backupData ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>جاري التحميل...</div>
                      ) : backupData.backups.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>
                          <div style={{ fontSize: '32px', marginBottom: '12px' }}>💾</div>
                          <div>لا توجد نسخ احتياطية بعد</div>
                          <div style={{ fontSize: '12px', marginTop: '6px' }}>اضغط "إنشاء نسخة الآن" للبدء</div>
                        </div>
                      ) : (
                        backupData.backups.map((b, idx) => {
                          const isEnc = b.filename.endsWith('.enc');
                          const isDownloading = downloadingFile === b.filename;
                          return (
                            <div
                              key={b.filename}
                              style={{
                                display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px',
                                gap: '8px', padding: '12px 20px', alignItems: 'center',
                                borderBottom: idx < backupData.backups.length - 1 ? `1px solid ${C.border}` : 'none',
                                background: idx % 2 === 1 ? 'rgba(15,23,42,0.4)' : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ fontSize: '14px' }}>{isEnc ? '🔒' : '📄'}</span>
                                <span style={{
                                  fontSize: '12px', color: C.text, fontFamily: 'monospace',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{b.filename}</span>
                                {isEnc && (
                                  <span style={{
                                    fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                                    background: 'rgba(139,92,246,0.2)', color: '#A78BFA',
                                    border: '1px solid rgba(139,92,246,0.3)', whiteSpace: 'nowrap',
                                  }}>مشفّر</span>
                                )}
                              </div>
                              <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted }}>{b.size_mb} MB</div>
                              <div style={{ textAlign: 'center', fontSize: '11px', color: C.muted, direction: 'ltr' }}>
                                {new Date(b.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => { void downloadBackup(b.filename); }}
                                  disabled={isDownloading}
                                  style={{
                                    padding: '6px 12px', borderRadius: '8px',
                                    border: '1px solid rgba(34,197,94,0.3)',
                                    background: 'rgba(34,197,94,0.1)',
                                    color: '#22C55E', fontSize: '12px', fontWeight: 700,
                                    cursor: isDownloading ? 'not-allowed' : 'pointer', fontFamily: FONT,
                                  }}
                                >
                                  {isDownloading ? '⏳' : '⬇️ تنزيل'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {/* Encryption Key */}
                    <div style={{
                      background: 'rgba(15,23,42,0.4)', borderRadius: '14px',
                      border: `1px solid ${C.border}`, padding: '20px 24px',
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>
                        🔑 مفتاح تشفير النسخ
                      </div>
                      <div style={{ fontSize: '12px', color: C.muted, marginBottom: '14px', lineHeight: 1.6 }}>
                        {encEnabled
                          ? 'النسخ الاحتياطية مشفّرة — احتفظ بهذا المفتاح في مكان آمن.'
                          : 'التشفير غير مفعّل — عيّن متغير BACKUP_ENCRYPTION_KEY في ملف .env لتفعيله.'}
                      </div>
                      {encEnabled && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => void loadEncKey()}
                            disabled={encKeyLoading}
                            style={{
                              padding: '8px 16px', borderRadius: '10px',
                              border: `1px solid ${C.border}`,
                              background: 'transparent', color: C.muted, fontSize: '13px',
                              fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                            }}
                          >
                            {encKeyLoading ? '⏳ ...' : encKeyVisible ? '🙈 إخفاء' : '👁 عرض المفتاح'}
                          </button>
                          {encKeyVisible && encKey && (
                            <>
                              <button onClick={copyEncKey} style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid rgba(34,197,94,0.3)',
                                background: 'rgba(34,197,94,0.1)',
                                color: '#22C55E', fontSize: '13px', fontWeight: 700,
                                cursor: 'pointer', fontFamily: FONT,
                              }}>
                                {encKeyCopied ? '✅ تم النسخ' : '📋 نسخ'}
                              </button>
                              <button onClick={emailEncKey} style={{
                                padding: '8px 16px', borderRadius: '10px',
                                border: '1px solid rgba(59,130,246,0.3)',
                                background: 'rgba(59,130,246,0.1)',
                                color: '#60A5FA', fontSize: '13px', fontWeight: 700,
                                cursor: 'pointer', fontFamily: FONT,
                              }}>
                                📧 إرسال بالبريد
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {encKeyVisible && encKey && (
                        <div style={{
                          marginTop: '12px', padding: '10px 14px', borderRadius: '10px',
                          background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}`,
                          fontSize: '12px', color: '#A78BFA', fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}>{encKey}</div>
                      )}
                    </div>
                  </div>
                )}
                {/* ── Security ── */}
                {settingsActiveCard === 'security' && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* 2FA */}
                    <div style={{
                      background: 'rgba(15,23,42,0.4)', borderRadius: '14px',
                      border: `1px solid ${C.border}`, overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '12px', flexWrap: 'wrap',
                      }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>
                            المصادقة الثنائية (2FA)
                          </div>
                          <div style={{ fontSize: '12px', color: C.muted }}>
                            تضيف طبقة أمان إضافية — يتطلب Google Authenticator أو Authy
                          </div>
                        </div>
                        {totpStatus?.totp_enabled ? (
                          <span style={{
                            padding: '6px 14px', borderRadius: '999px',
                            background: 'rgba(34,197,94,0.15)', color: C.success,
                            fontSize: '12px', fontWeight: 700, border: '1px solid rgba(34,197,94,0.3)',
                          }}>✅ مفعلة</span>
                        ) : (
                          <span style={{
                            padding: '6px 14px', borderRadius: '999px',
                            background: 'rgba(148,163,184,0.1)', color: C.muted,
                            fontSize: '12px', fontWeight: 700, border: `1px solid ${C.border}`,
                          }}>غير مفعلة</span>
                        )}
                      </div>
                      <div style={{ padding: '24px' }}>
                        {secMsg && (
                          <div style={{
                            padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                            fontSize: '13px', fontWeight: 700,
                            background: secMsg.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: secMsg.ok ? C.success : '#EF4444',
                            border: `1px solid ${secMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}>{secMsg.text}</div>
                        )}
                        {!totpStatus?.totp_enabled && !totpSetupData && (
                          <button
                            onClick={() => { void startTotpSetup(); }}
                            disabled={secLoading}
                            style={{
                              padding: '11px 22px', borderRadius: '10px', border: 'none',
                              background: secLoading ? C.border : C.orange,
                              color: '#fff', fontSize: '14px', fontWeight: 800,
                              cursor: secLoading ? 'not-allowed' : 'pointer', fontFamily: FONT,
                            }}
                          >
                            {secLoading ? 'جاري الإعداد...' : '🔐 تفعيل المصادقة الثنائية'}
                          </button>
                        )}
                        {!totpStatus?.totp_enabled && totpSetupData && (
                          <div>
                            <p style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
                              امسح الكود بتطبيق <strong style={{ color: C.text }}>Google Authenticator</strong> أو{' '}
                              <strong style={{ color: C.text }}>Authy</strong>، ثم أدخل الرمز:
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                              <img src={totpSetupData.qr_code} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: '12px', border: `2px solid ${C.border}` }} />
                            </div>
                            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '11px', color: C.muted, wordBreak: 'break-all' }}>
                              <span style={{ color: C.orange, fontWeight: 700 }}>إدخال يدوي: </span>{totpSetupData.secret}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <input
                                value={totpInput}
                                onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="أدخل الرمز (6 أرقام)"
                                style={{
                                  flex: 1, padding: '10px 14px', borderRadius: '10px',
                                  border: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                                  color: C.text, fontSize: '18px', letterSpacing: '6px',
                                  textAlign: 'center', fontFamily: 'monospace', outline: 'none',
                                }}
                                maxLength={6}
                              />
                              <button
                                onClick={() => { void confirmTotpSetup(); }}
                                disabled={secLoading || totpInput.length !== 6}
                                style={{
                                  padding: '10px 18px', borderRadius: '10px', border: 'none',
                                  background: totpInput.length === 6 ? C.orange : C.border,
                                  color: '#fff', fontSize: '14px', fontWeight: 800,
                                  cursor: totpInput.length !== 6 ? 'not-allowed' : 'pointer', fontFamily: FONT,
                                }}
                              >{secLoading ? '...' : 'تأكيد'}</button>
                            </div>
                          </div>
                        )}
                        {totpStatus?.totp_enabled && (
                          <div>
                            {!showDisable ? (
                              <button
                                onClick={() => { setShowDisable(true); setSecMsg(null); }}
                                style={{
                                  padding: '11px 22px', borderRadius: '10px',
                                  border: '1px solid rgba(239,68,68,0.4)',
                                  background: 'rgba(239,68,68,0.1)',
                                  color: '#EF4444', fontSize: '14px', fontWeight: 800,
                                  cursor: 'pointer', fontFamily: FONT,
                                }}
                              >🚫 إيقاف المصادقة الثنائية</button>
                            ) : (
                              <div>
                                <p style={{ fontSize: '13px', color: C.muted, marginBottom: '12px' }}>أدخل رمز التحقق من التطبيق للتأكيد:</p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <input
                                    value={disableTotpInput}
                                    onChange={(e) => setDisableTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="6 أرقام"
                                    style={{
                                      flex: 1, padding: '10px 14px', borderRadius: '10px',
                                      border: '1px solid rgba(239,68,68,0.4)',
                                      background: 'rgba(239,68,68,0.05)',
                                      color: C.text, fontSize: '18px', letterSpacing: '6px',
                                      textAlign: 'center', fontFamily: 'monospace', outline: 'none',
                                    }}
                                    maxLength={6}
                                  />
                                  <button
                                    onClick={() => { void confirmDisableTotp(); }}
                                    disabled={secLoading || disableTotpInput.length !== 6}
                                    style={{
                                      padding: '10px 18px', borderRadius: '10px', border: 'none',
                                      background: disableTotpInput.length === 6 ? '#EF4444' : C.border,
                                      color: '#fff', fontSize: '14px', fontWeight: 800,
                                      cursor: disableTotpInput.length !== 6 ? 'not-allowed' : 'pointer', fontFamily: FONT,
                                    }}
                                  >{secLoading ? '...' : 'إيقاف'}</button>
                                  <button
                                    onClick={() => { setShowDisable(false); setDisableTotpInput(''); setSecMsg(null); }}
                                    style={{
                                      padding: '10px 14px', borderRadius: '10px',
                                      border: `1px solid ${C.border}`, background: 'transparent',
                                      color: C.muted, fontSize: '14px', cursor: 'pointer', fontFamily: FONT,
                                    }}
                                  >إلغاء</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* IP Restriction */}
                    <div style={{
                      background: 'rgba(15,23,42,0.4)', borderRadius: '14px',
                      border: `1px solid ${C.border}`, padding: '20px 24px',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>
                        قيود عنوان IP
                      </div>
                      <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.8 }}>
                        لتقييد الوصول لعناوين IP محددة، أضف المتغير التالي في ملف{' '}
                        <code style={{ color: C.orange }}>.env</code> على السيرفر:
                        <br />
                        <code style={{ color: C.success, fontSize: '12px' }}>
                          SUPER_ADMIN_IPS=197.60.235.65,89.167.85.156
                        </code>
                        <br />
                        <span style={{ color: C.warning }}>
                          ⚠️ اتركه فارغاً للسماح لجميع الـ IPs (وضع التطوير)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Telegram Alert Settings ── */}
                {settingsActiveCard === 'telegram' && (() => {
                  const TG_BLUE = '#38BDF8';
                  const TG_BG   = 'rgba(56,189,248,0.07)';
                  const ALERT_ICONS: Record<string, string> = {
                    server_start:           '🚀', server_slow:            '🐢', server_high_memory: '🧠',
                    db_slow:                '🗄️', backup_failed:          '⚠️', backup_success:     '💾',
                    brute_force:            '🔐', subscription_expiring:  '⏰', subscription_expired:'❌',
                    new_company_registered: '🏢', ip_blocked:             '🚫',
                  };
                  const ALERT_DESC: Record<string, string> = {
                    server_start:           'عند بدء تشغيل الخادم',
                    server_slow:            'عند تباطؤ استجابة الخادم',
                    server_high_memory:     'عند ارتفاع استهلاك الذاكرة',
                    db_slow:                'عند تباطؤ استعلامات قاعدة البيانات',
                    backup_failed:          'عند فشل النسخ الاحتياطي',
                    backup_success:         'عند اكتمال النسخ الاحتياطي بنجاح',
                    brute_force:            'عند محاولات اختراق متكررة من IP',
                    subscription_expiring:  'عند اقتراب انتهاء اشتراك شركة',
                    subscription_expired:   'عند انتهاء اشتراك شركة',
                    new_company_registered: 'عند تسجيل شركة جديدة في المنصة',
                    ip_blocked:             'عند حجب عنوان IP بسبب الاختراق',
                  };
                  const TgToggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
                    <button
                      onClick={onClick}
                      disabled={disabled}
                      style={{
                        flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px',
                        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                        background: on ? TG_BLUE : 'rgba(148,163,184,0.2)',
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: '4px',
                        right: on ? '4px' : '20px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#fff', transition: 'right 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </button>
                  );

                  return (
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                      {/* ── 1. Connection Status Banner ── */}
                      <div style={{
                        borderRadius: '14px',
                        border: `1.5px solid ${tgBotStatus?.connected ? 'rgba(52,211,153,0.4)' : tgBotStatus && !tgBotStatus.connected ? 'rgba(239,68,68,0.35)' : `${TG_BLUE}30`}`,
                        background: tgBotStatus?.connected ? 'rgba(52,211,153,0.07)' : tgBotStatus && !tgBotStatus.connected ? 'rgba(239,68,68,0.06)' : TG_BG,
                        padding: '16px 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {tgBotLoading && !tgBotStatus
                            ? <div style={{ fontSize: '24px' }}>⏳</div>
                            : tgBotStatus?.connected
                            ? <div style={{ fontSize: '28px' }}>✅</div>
                            : <div style={{ fontSize: '28px' }}>❌</div>
                          }
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 900, color: C.text }}>
                              {tgBotLoading && !tgBotStatus ? 'جاري التحقق من الاتصال...'
                                : tgBotStatus?.connected
                                  ? `متصل — @${tgBotStatus.bot_username ?? 'البوت'}`
                                  : 'غير متصل'}
                            </div>
                            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                              {tgBotStatus?.connected
                                ? `اسم البوت: ${tgBotStatus.bot_name ?? '—'}  |  المصدر: ${tgBotStatus.source === 'db' ? 'قاعدة البيانات' : 'متغير البيئة'}`
                                : tgBotStatus?.error ?? 'أدخل بيانات البوت في القسم أدناه'}
                            </div>
                            {tgBotStatus?.connected && tgBotStatus.token_masked && (
                              <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', fontFamily: 'monospace' }}>
                                الرمز: {tgBotStatus.token_masked}  |  المعرّف: {tgBotStatus.chat_id}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => tgBotRefetch()}
                          style={{ padding: '7px 14px', borderRadius: '10px', border: `1px solid ${TG_BLUE}40`, background: TG_BG, color: TG_BLUE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}
                        >🔄 تحديث</button>
                      </div>

                      {/* ── 2. Bot Credentials Setup ── */}
                      <div style={{
                        borderRadius: '14px', border: `1.5px solid ${C.border}`,
                        background: C.card, overflow: 'hidden',
                      }}>
                        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>🤖</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 900, color: C.text }}>بيانات البوت</div>
                            <div style={{ fontSize: '11px', color: C.muted }}>أنشئ بوتاً عبر @BotFather في تيليجرام واحفظ بياناته هنا</div>
                          </div>
                        </div>
                        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                          {/* رمز البوت */}
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                              رمز البوت
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={tgShowToken ? 'text' : 'password'}
                                placeholder={tgBotStatus?.token_masked ?? '123456789:ABCDEF-ghijklmnopqrstuvwxyz...'}
                                value={tgBotToken}
                                onChange={e => setTgBotToken(e.target.value)}
                                style={{
                                  width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px',
                                  border: `1.5px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                                  color: C.text, fontSize: '13px', outline: 'none',
                                  fontFamily: 'monospace', boxSizing: 'border-box',
                                }}
                              />
                              <button
                                onClick={() => setTgShowToken(v => !v)}
                                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: C.muted }}
                              >{tgShowToken ? '🙈' : '👁️'}</button>
                            </div>
                          </div>

                          {/* معرّف المحادثة */}
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                              معرّف المحادثة
                            </label>
                            <input
                              type="text"
                              placeholder={tgBotStatus?.chat_id ?? '-1001234567890 أو معرّف القناة'}
                              value={tgChatId}
                              onChange={e => setTgChatId(e.target.value)}
                              style={{
                                width: '100%', padding: '10px 14px', borderRadius: '10px',
                                border: `1.5px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                                color: C.text, fontSize: '13px', outline: 'none',
                                fontFamily: 'monospace', boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ fontSize: '11px', color: C.muted, marginTop: '5px' }}>
                              📌 للحصول على المعرّف: أضف @userinfobot إلى المحادثة أو القناة
                            </div>
                          </div>

                          {/* Save Credentials */}
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => { void saveTgCredentials(); }}
                              disabled={tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()}
                              style={{
                                flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
                                background: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? 'rgba(148,163,184,0.12)' : TG_BLUE,
                                color: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? C.muted : '#0F172A',
                                fontSize: '13px', fontWeight: 800, cursor: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? 'not-allowed' : 'pointer',
                                fontFamily: FONT, transition: 'all 0.15s',
                              }}
                            >
                              {tgCredSaving ? '⏳ جاري الحفظ...' : '💾 حفظ بيانات البوت'}
                            </button>
                            <button
                              onClick={() => { void testTelegramConnection(); }}
                              disabled={tgTesting || !tgBotStatus?.connected}
                              style={{
                                padding: '11px 18px', borderRadius: '10px',
                                border: `1.5px solid ${tgBotStatus?.connected ? 'rgba(52,211,153,0.45)' : C.border}`,
                                background: tgBotStatus?.connected ? 'rgba(52,211,153,0.1)' : 'transparent',
                                color: tgBotStatus?.connected ? '#34D399' : C.muted,
                                fontSize: '13px', fontWeight: 800, fontFamily: FONT,
                                cursor: (tgTesting || !tgBotStatus?.connected) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s', whiteSpace: 'nowrap',
                              }}
                            >
                              {tgTesting ? '⏳...' : '🧪 اختبار'}
                            </button>
                          </div>

                          {/* Test result */}
                          {tgTestResult && (
                            <div style={{
                              padding: '10px 14px', borderRadius: '10px',
                              background: tgTestResult.ok ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                              border: `1px solid ${tgTestResult.ok ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                              fontSize: '12px', fontWeight: 700,
                              color: tgTestResult.ok ? '#34D399' : '#EF4444',
                            }}>
                              {tgTestResult.ok ? '✅' : '❌'} {tgTestResult.msg}
                            </div>
                          )}

                        </div>
                      </div>

                      {/* ── 3. Loading/Error for alert rules ── */}
                      {tgLoading && !tgConfig && (
                        <div style={{ textAlign: 'center', padding: '24px', color: C.muted, fontSize: '13px' }}>⏳ جاري تحميل إعدادات التنبيهات...</div>
                      )}
                      {tgError && !tgConfig && (
                        <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '13px', color: '#EF4444' }}>❌ تعذّر تحميل إعدادات التنبيهات</div>
                          {tgErrorObj?.message && <div style={{ fontSize: '11px', color: C.muted }}>{tgErrorObj.message}</div>}
                          <button onClick={() => tgRefetch()} style={{ padding: '7px 18px', borderRadius: '10px', border: `1px solid ${TG_BLUE}40`, background: TG_BG, color: TG_BLUE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>🔄 إعادة المحاولة</button>
                        </div>
                      )}

                      {/* ── 4. Alert Settings ── */}
                      {tgConfig && (<>
                        {/* Master Switch */}
                        <div style={{
                          borderRadius: '14px', padding: '16px 20px',
                          background: tgConfig.enabled ? 'rgba(56,189,248,0.09)' : 'rgba(239,68,68,0.06)',
                          border: `1.5px solid ${tgConfig.enabled ? 'rgba(56,189,248,0.4)' : 'rgba(239,68,68,0.3)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                        }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 900, color: C.text, marginBottom: '4px' }}>
                              📨 تفعيل إشعارات تيليجرام
                            </div>
                            <div style={{ fontSize: '12px', color: C.muted }}>
                              {tgConfig.enabled ? '✅ البوت يرسل التنبيهات المفعّلة أدناه' : '⛔ جميع الإشعارات موقوفة حالياً'}
                            </div>
                          </div>
                          <TgToggle
                            on={tgConfig.enabled}
                            onClick={() => setTgConfig(c => c ? { ...c, enabled: !c.enabled } : c)}
                          />
                        </div>

                        {/* Alert rules */}
                        <div style={{ borderRadius: '14px', border: `1.5px solid ${C.border}`, overflow: 'hidden', opacity: tgConfig.enabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, background: 'rgba(56,189,248,0.05)' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: TG_BLUE }}>⚙️ إدارة التنبيهات</div>
                            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>فعّل أو أوقف كل نوع تنبيه بشكل مستقل</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {Object.entries(tgConfig.alerts).map(([key, rule], i) => (
                              <div
                                key={key}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '12px',
                                  padding: '13px 18px',
                                  borderBottom: i < Object.keys(tgConfig.alerts).length - 1 ? `1px solid ${C.border}` : 'none',
                                  background: rule.enabled ? 'rgba(56,189,248,0.04)' : 'transparent',
                                  transition: 'background 0.15s',
                                }}
                              >
                                <span style={{ fontSize: '20px', flexShrink: 0 }}>{ALERT_ICONS[key] ?? '🔔'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: rule.enabled && tgConfig.enabled ? C.text : C.muted }}>
                                    {rule.label}
                                  </div>
                                  <div style={{ fontSize: '11px', color: C.muted, marginTop: '1px' }}>
                                    {ALERT_DESC[key] ?? rule.label}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                  <select
                                    value={rule.cooldownHours}
                                    onChange={e => {
                                      const h = Number(e.target.value);
                                      setTgConfig(c => c ? { ...c, alerts: { ...c.alerts, [key]: { ...rule, cooldownHours: h } } } : c);
                                    }}
                                    disabled={!tgConfig.enabled || !rule.enabled}
                                    style={{
                                      padding: '4px 8px', borderRadius: '8px',
                                      border: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                                      color: C.muted, fontSize: '11px', outline: 'none', cursor: 'pointer', fontFamily: FONT,
                                    }}
                                    title="مدة الانتظار قبل إعادة إرسال نفس النوع"
                                  >
                                    {[0,1,2,4,6,8,12,24,48].map(h => (
                                      <option key={h} value={h}>{h === 0 ? 'بدون انتظار' : `${h}س`}</option>
                                    ))}
                                  </select>
                                  <TgToggle
                                    on={rule.enabled}
                                    onClick={() => setTgConfig(c => c ? { ...c, alerts: { ...c.alerts, [key]: { ...rule, enabled: !rule.enabled } } } : c)}
                                    disabled={!tgConfig.enabled}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Save Alert Settings */}
                        <button
                          onClick={() => { void saveTelegramSettings(); }}
                          disabled={tgSaving}
                          style={{
                            width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                            background: tgSaving ? 'rgba(148,163,184,0.15)' : TG_BLUE,
                            color: tgSaving ? C.muted : '#0F172A',
                            fontSize: '14px', fontWeight: 900,
                            cursor: tgSaving ? 'not-allowed' : 'pointer',
                            fontFamily: FONT, transition: 'all 0.15s',
                          }}
                        >
                          {tgSaving ? '⏳ جاري الحفظ...' : '💾 حفظ إعدادات التنبيهات'}
                        </button>
                      </>)}
                    </div>
                  );
                })()}


                {/* ── Audit Log ── */}
                {settingsActiveCard === 'audit_log' && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: C.muted }}>كل إجراء قام به المدير العام مُسجَّل هنا</p>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => { if (!auditData?.rows.length) return; const rows = auditData.rows.map(r => `${r.action},${r.record_type},${r.record_id},${r.note ?? ''},${r.created_at}`).join('\n'); const blob = new Blob([`الإجراء,نوع السجل,رقم السجل,الملاحظة,التاريخ\n${rows}`], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit-log.csv'; a.click(); }} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#86EFAC', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>📥 CSV</button>
                        <select value={auditAction} onChange={e => setAuditAction(e.target.value)} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                          <option value="">كل الإجراءات</option>
                          <option value="COMPANY_CREATED">إنشاء شركة</option>
                          <option value="COMPANY_UPDATED">تحديث شركة</option>
                          <option value="COMPANY_ACTIVATED">تفعيل شركة</option>
                          <option value="COMPANY_SUSPENDED">إيقاف شركة</option>
                          <option value="COMPANY_EXTENDED">تمديد اشتراك</option>
                          <option value="COMPANY_DELETED">حذف شركة</option>
                          <option value="COMPANY_SUBSCRIPTION_UPDATED">تحديث اشتراك</option>
                          <option value="ADMIN_PASSWORD_RESET">إعادة كلمة المرور</option>
                          <option value="MANAGER_CREATED">إنشاء مدير</option>
                          <option value="MANAGER_UPDATED">تحديث مدير</option>
                          <option value="MANAGER_TOGGLED">تغيير حالة مدير</option>
                          <option value="MANAGER_DELETED">حذف مدير</option>
                          <option value="PLAN_SETTINGS_UPDATED">تحديث إعدادات الخطة</option>
                          <option value="BACKUP_CREATED">نسخة احتياطية</option>
                          <option value="RESTORE_STARTED">استعادة</option>
                          <option value="SUPER_ADMIN_LIST_VIEW">عرض الشركات</option>
                        </select>
                        <select value={auditLimit} onChange={e => setAuditLimit(Number(e.target.value))} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                          {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} سجل</option>)}
                        </select>
                        <button onClick={() => void refetchAudit()} style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>🔄 تحديث</button>
                      </div>
                    </div>
                    {auditLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ جارٍ التحميل...</div>
                    ) : (
                      <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px', padding: '10px 20px', background: 'rgba(96,165,250,0.08)', borderBottom: `1px solid ${C.border}`, fontSize: '11px', fontWeight: 800, color: '#60A5FA', gap: '12px' }}>
                          <span>الإجراء</span><span>النوع</span><span>رقم</span><span>الملاحظة</span><span>التاريخ</span>
                        </div>
                        {!auditData?.rows.length ? (
                          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>لا توجد سجلات</div>
                        ) : (
                          <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                            {auditData!.rows.map(row => {
                              const AUD_COLORS: Record<string, { label: string; color: string }> = {
                                COMPANY_ACTIVATED: { label: 'تفعيل شركة', color: '#34D399' },
                                COMPANY_SUSPENDED: { label: 'إيقاف شركة', color: '#F59E0B' },
                                COMPANY_EXTENDED: { label: 'تمديد اشتراك', color: '#38BDF8' },
                                COMPANY_DELETED: { label: 'حذف شركة', color: '#EF4444' },
                                COMPANY_CREATED: { label: 'إنشاء شركة', color: '#34D399' },
                                COMPANY_UPDATED: { label: 'تحديث شركة', color: '#60A5FA' },
                                COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك', color: '#60A5FA' },
                                ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: '#A78BFA' },
                                MANAGER_CREATED: { label: 'إنشاء مدير', color: '#34D399' },
                                MANAGER_UPDATED: { label: 'تحديث مدير', color: '#60A5FA' },
                                MANAGER_TOGGLED: { label: 'تغيير حالة مدير', color: '#F59E0B' },
                                MANAGER_DELETED: { label: 'حذف مدير', color: '#EF4444' },
                                PLAN_SETTINGS_UPDATED: { label: 'تحديث إعدادات الخطة', color: '#FBBF24' },
                                BACKUP_CREATED: { label: 'نسخة احتياطية', color: '#34D399' },
                                RESTORE_STARTED: { label: 'بدء استعادة', color: '#A78BFA' },
                                RESTORE_COMPLETED: { label: 'اكتمال استعادة', color: '#34D399' },
                                RESTORE_FAILED: { label: 'فشل استعادة', color: '#EF4444' },
                                SUPER_ADMIN_ACCESS: { label: 'وصول مدير عام', color: '#818CF8' },
                                SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
                                TELEGRAM_SETTINGS_UPDATED: { label: 'تحديث تليجرام', color: '#38BDF8' },
                              };
                              const REC_AR: Record<string, string> = { company: 'شركة', subscription: 'اشتراك', system: 'النظام', user: 'مستخدم' };
                              const am = AUD_COLORS[row.action] ?? { label: row.action, color: '#94A3B8' };
                              return (
                                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px', padding: '11px 20px', gap: '12px', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: '12px', alignItems: 'center' }}>
                                  <span style={{ color: am.color, fontWeight: 700 }}>{am.label}</span>
                                  <span style={{ color: C.muted }}>{REC_AR[row.record_type] ?? row.record_type}</span>
                                  <span style={{ color: C.muted, textAlign: 'center' }}>#{row.record_id}</span>
                                  <span style={{ color: C.text, fontSize: '11px', lineHeight: 1.4 }}>{row.note ?? '—'}</span>
                                  <span style={{ color: C.muted, fontSize: '11px', direction: 'ltr', textAlign: 'right' }}>{new Date(row.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {auditData && <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.border}`, fontSize: '12px', color: C.muted }}>إجمالي السجلات: {auditData!.count}</div>}
                      </div>
                    )}
                  </div>
                )}


              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════
          TAB: REVENUE  📊
          ═══════════════════════════════════════════════ */}
      {activeTab === 'revenue' && (
        <TabRevenue
          revenueData={revenueData}
          revenueLoading={revenueLoading}
          onExportCSV={exportCompaniesCSV}
        />
      )}

      {/* ═══════════════════════════════════════════════
          TAB: ALERTS  🔔
          ═══════════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <TabAlerts
          alertsData={alertsData}
          alertsLoading={alertsLoading}
          onRefetch={refetchAlerts}
          alertSearch={alertSearch}
          setAlertSearch={setAlertSearch}
          alertTypeFilter={alertTypeFilter}
          setAlertTypeFilter={setAlertTypeFilter}
          setActiveTab={setActiveTab}
          setSnapshotCompany={setSnapshotCompany}
        />
      )}

      {/* ═══════════════════════════════════════════════
          TAB: AUDIT LOG  📋
          ═══════════════════════════════════════════════ */}
      {activeTab === 'audit_log' && (
        <TabAuditLog
          auditData={auditData}
          auditLoading={auditLoading}
          onRefetch={refetchAudit}
          auditAction={auditAction}
          setAuditAction={setAuditAction}
          auditLimit={auditLimit}
          setAuditLimit={setAuditLimit}
        />
      )}

      {/* ═══════════════════════════════════════════════
          TAB: ANNOUNCEMENTS  📢
          ═══════════════════════════════════════════════ */}
      {activeTab === 'announcements' && (
        <TabAnnouncements
          annData={annData}
          annType={annType}      setAnnType={setAnnType}
          annTarget={annTarget}  setAnnTarget={setAnnTarget}
          annCompanyId={annCompanyId} setAnnCompanyId={setAnnCompanyId}
          annTitle={annTitle}    setAnnTitle={setAnnTitle}
          annBody={annBody}      setAnnBody={setAnnBody}
          annExpires={annExpires} setAnnExpires={setAnnExpires}
          annSaving={annSaving}
          onSave={saveAnnouncement}
          onToggle={toggleAnn}
          onDelete={deleteAnn}
        />
      )}

      {/* ═══════════════════════════════════════════════
          TAB: SERVER HEALTH  🌡️
          ═══════════════════════════════════════════════ */}
      {activeTab === 'health' && (
        <TabHealth
          healthData={healthData}
          healthLoading={healthLoading}
          onRefetch={refetchHealth}
          healthUpdated={healthUpdated}
          redisHealth={redisHealth}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PLAN SETTINGS TAB
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <TabPlans
          planSettings={planSettings}
          planSettingsLoading={planSettingsLoading}
          editingPlan={editingPlan}
          setEditingPlan={setEditingPlan}
          planSaving={planSaving}
          onSavePlan={savePlan}
        />
      )}


      {/* ══════════════════════════════
          TAB: MONITORING  🛡️
          ══════════════════════════════ */}
      {activeTab === 'monitoring' && (
        <TabMonitoring
          monData={monData}
          monLoading={monLoading}
          monError={!!monError}
          onRefetch={() => void refetchMon()}
          unblockIP={unblockIP}            setUnblockIP={setUnblockIP}
          unblockEmail={unblockEmail}      setUnblockEmail={setUnblockEmail}
          unblockResult={unblockResult}    setUnblockResult={setUnblockResult}
          unblockLoading={unblockLoading}  setUnblockLoading={setUnblockLoading}
          unblockMsg={unblockMsg}          setUnblockMsg={setUnblockMsg}
        />
      )}


      </div>{/* end maxWidth container */}

      {/* ── Company Management Slide Panel ───────────────────────────────── */}
      {subModal && (
        <div
          onClick={() => setSubModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            className="co-mgmt-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', borderLeft: '1px solid rgba(99,102,241,0.25)', width: '100%', maxWidth: '520px', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: FONT, direction: 'rtl' }}
          >
            {/* ── Panel Header ── */}
            <div style={{ padding: '20px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              {/* Company name + close */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#e2e8f0' }}>🏢 {subModal.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                      background: STATUS[subModal.status]?.bg ?? 'rgba(148,163,184,0.1)',
                      color: STATUS[subModal.status]?.text ?? '#94a3b8',
                    }}>{STATUS[subModal.status]?.label ?? subModal.status}</span>
                    <span>{subModal.admin_email ?? '—'}</span>
                    <span style={{ color: '#475569' }}>·</span>
                    <span>{subModal.userCount} مستخدم</span>
                  </div>
                </div>
                <button onClick={() => setSubModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>✕</button>
              </div>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {([
                  { label: '📋 الاشتراك', idx: 0 },
                  { label: '⚙️ الوحدات', idx: 1 },
                  { label: '👥 المستخدمون', idx: 2 },
                  { label: '📜 السجل', idx: 3 },
                ] as { label: string; idx: 0 | 1 | 2 | 3 }[]).map(({ label, idx }) => (
                  <button
                    key={idx}
                    onClick={() => setPanelTab(idx)}
                    style={{
                      padding: '9px 13px',
                      border: 'none',
                      background: panelTab === idx ? 'rgba(99,102,241,0.18)' : 'transparent',
                      color: panelTab === idx ? '#a5b4fc' : '#64748b',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                      transition: 'all 0.15s', borderRadius: '8px 8px 0 0',
                      borderBottom: panelTab === idx ? '2px solid #6366f1' : '2px solid transparent',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* ── Tab Content (scrollable) ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* ── Tab 0: Subscription ── */}
              {panelTab === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Current info grid */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'الخطة الحالية', value: translatePlan(subModal.plan_type), color: C.orange },
                      { label: 'النسخة', value: subModal.edition === 'advanced' ? '🚀 Advanced' : '⭐ Pro', color: subModal.edition === 'advanced' ? '#fcd34d' : '#a5b4fc' },
                      { label: 'الحالة', value: subModal.status === 'active' ? '✅ نشط' : subModal.status === 'trial' ? '🔵 تجريبي' : subModal.status === 'expired' ? '❌ منتهي' : '⛔ موقوف', color: subModal.status === 'active' || subModal.status === 'trial' ? C.success : C.danger },
                      { label: 'الأيام المتبقية', value: subModal.daysRemaining < 0 ? 'منتهي' : `${subModal.daysRemaining} يوم`, color: subModal.daysRemaining < 0 ? C.danger : subModal.daysRemaining <= 7 ? C.warning : C.success },
                      { label: 'تاريخ الانتهاء', value: new Date(subModal.end_date).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }), color: '#e2e8f0' },
                      { label: 'تاريخ الإنشاء', value: new Date(subModal.created_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }), color: '#e2e8f0' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px 12px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>{label}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Plan */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>📦 الخطة</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { val: 'trial', label: 'تجريبي', color: '#64748b' },
                        { val: 'basic', label: 'أساسي', color: '#3b82f6' },
                        { val: 'professional', label: 'احترافي', color: '#8b5cf6' },
                        { val: 'paid', label: 'مدفوع', color: C.orange },
                      ].map(({ val, label, color }) => (
                        <button
                          key={val}
                          onClick={() => setSubForm(f => ({ ...f, plan_type: val }))}
                          style={{
                            padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                            background: subForm.plan_type === val ? color : 'rgba(255,255,255,0.05)',
                            border: `2px solid ${subForm.plan_type === val ? color : 'rgba(255,255,255,0.12)'}`,
                            color: subForm.plan_type === val ? '#fff' : '#94a3b8',
                          }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Edition */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>🏷️ النسخة</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { val: 'ultimate' as const, label: '⭐ MuhKam Pro', color: '#6366f1', desc: 'بدون محاسبة' },
                        { val: 'advanced' as const, label: '🚀 MuhKam Advanced', color: '#f59e0b', desc: 'مع محاسبة كاملة' },
                      ].map(({ val, label, color, desc }) => (
                        <button
                          key={val}
                          onClick={() => setSubForm(f => ({
                            ...f, edition: val,
                            features: val === 'advanced' ? { ...DEFAULT_FEATS_ADVANCED } : { ...DEFAULT_FEATS_ULTIMATE },
                          }))}
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, textAlign: 'center', transition: 'all 0.15s',
                            background: subForm.edition === val ? (val === 'advanced' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)') : 'rgba(255,255,255,0.04)',
                            border: `2px solid ${subForm.edition === val ? color : 'rgba(255,255,255,0.1)'}`,
                            color: subForm.edition === val ? color : '#64748b',
                          }}
                        >
                          <div>{label}</div>
                          <div style={{ fontSize: '10px', fontWeight: 400, marginTop: '2px', opacity: 0.7 }}>{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date / Extend */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>📅 تجديد الاشتراك</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      {[
                        { val: 'days' as const, label: '⏳ تمديد بأيام' },
                        { val: 'date' as const, label: '📆 تحديد تاريخ' },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => setSubForm(f => ({ ...f, extend_mode: val }))}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                            background: subForm.extend_mode === val ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                            border: `2px solid ${subForm.extend_mode === val ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                            color: subForm.extend_mode === val ? '#a5b4fc' : '#64748b',
                          }}
                        >{label}</button>
                      ))}
                    </div>
                    {subForm.extend_mode === 'days' ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                          <button
                            key={d}
                            onClick={() => setSubForm(f => ({ ...f, extend_days: d }))}
                            style={{
                              padding: '7px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                              background: subForm.extend_days === d ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)',
                              border: `2px solid ${subForm.extend_days === d ? C.orange : 'rgba(255,255,255,0.1)'}`,
                              color: subForm.extend_days === d ? C.orange : '#94a3b8',
                            }}
                          >{d === 365 ? 'سنة' : `${d} يوم`}</button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={subForm.end_date}
                        onChange={(e) => setSubForm(f => ({ ...f, end_date: e.target.value }))}
                        min={new Date().toISOString().slice(0, 10)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '2px solid rgba(99,102,241,0.4)', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: '14px', fontFamily: FONT, boxSizing: 'border-box' }}
                      />
                    )}
                  </div>

                  {/* Status toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px 16px', border: `1px solid ${subForm.is_active ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>حالة الشركة</div>
                      <div style={{ fontSize: '11px', color: subForm.is_active ? C.success : C.danger, marginTop: '2px' }}>{subForm.is_active ? '✅ نشطة ويمكن تسجيل الدخول' : '⛔ موقوفة ولا يمكن تسجيل الدخول'}</div>
                    </div>
                    <button
                      onClick={() => setSubForm(f => ({ ...f, is_active: !f.is_active }))}
                      style={{
                        padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, border: 'none', transition: 'all 0.2s',
                        background: subForm.is_active ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)',
                        color: subForm.is_active ? C.success : C.danger,
                      }}
                    >{subForm.is_active ? '✅ نشط' : '⛔ موقوف'}</button>
                  </div>

                  {/* Save */}
                  <button
                    onClick={() => void saveSubscription()}
                    disabled={subSaving || (subForm.extend_mode === 'date' && !subForm.end_date)}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: subSaving ? 'wait' : 'pointer', fontFamily: FONT, border: 'none', transition: 'all 0.2s',
                      background: subSaving ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      color: '#fff', opacity: (subSaving || (subForm.extend_mode === 'date' && !subForm.end_date)) ? 0.6 : 1,
                    }}
                  >{subSaving ? '⏳ جاري الحفظ...' : '💾 حفظ التغييرات'}</button>
                </div>
              )}

              {/* ── Tab 1: Modules ── */}
              {panelTab === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>التحكم في الوحدات المُفعَّلة لهذه الشركة</div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    {([
                      { key: 'accounting' as const, label: 'المحاسبة الكاملة', icon: '📊', desc: 'شجرة الحسابات، القيود، الميزانية' },
                      { key: 'hr' as const, label: 'الموارد البشرية', icon: '👥', desc: 'الموظفون والحضور والانصراف' },
                      { key: 'pos' as const, label: 'نقطة البيع (POS)', icon: '🖥️', desc: 'واجهة البيع المباشرة' },
                      { key: 'warranty' as const, label: 'الضمان', icon: '🛡️', desc: 'إدارة ضمانات المنتجات' },
                      { key: 'consignment' as const, label: 'الأمانات', icon: '📦', desc: 'بيع وإدارة بضاعة الأمانة' },
                      { key: 'fixed_assets' as const, label: 'الأصول الثابتة', icon: '🏗️', desc: 'تتبع وإهلاك الأصول' },
                      { key: 'budgets' as const, label: 'الموازنات ومراكز التكلفة', icon: '💹', desc: 'ميزانيات ومراكز التكلفة' },
                      { key: 'bank_reconciliation' as const, label: 'المطابقة البنكية', icon: '🏦', desc: 'مطابقة كشوف البنك' },
                      { key: 'maintenance' as const, label: 'الصيانة', icon: '🔧', desc: 'وحدة الصيانة (قريباً)' },
                    ] as { key: keyof CompanyFeatures; label: string; icon: string; desc: string }[]).map(({ key, label, icon, desc }, i) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderBottom: i < 8 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          background: subForm.features[key] ? 'rgba(52,211,153,0.04)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '18px' }}>{icon}</span>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: subForm.features[key] ? '#e2e8f0' : '#64748b' }}>{label}</div>
                            <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>{desc}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSubForm(f => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }))}
                          style={{
                            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: subForm.features[key] ? 'linear-gradient(135deg,#34d399,#059669)' : 'rgba(255,255,255,0.12)',
                            position: 'relative', transition: 'all 0.2s', flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: '3px',
                            right: subForm.features[key] ? '3px' : 'auto',
                            left: subForm.features[key] ? 'auto' : '3px',
                            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                            transition: 'all 0.2s', display: 'block',
                          }} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => void saveSubscription()}
                    disabled={subSaving}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: subSaving ? 'wait' : 'pointer', fontFamily: FONT, border: 'none', transition: 'all 0.2s',
                      background: subSaving ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      color: '#fff', opacity: subSaving ? 0.6 : 1,
                    }}
                  >{subSaving ? '⏳ جاري الحفظ...' : '💾 حفظ إعدادات الوحدات'}</button>
                </div>
              )}

              {/* ── Tab 2: Users ── */}
              {panelTab === 2 && (
                <div>
                  {panelDetailLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ جارٍ التحميل...</div>
                  ) : (panelCompanyDetail?.users ?? []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                      <div>لا يوجد مستخدمون لهذه الشركة</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: C.muted, marginBottom: '4px' }}>
                        {(panelCompanyDetail?.users ?? []).length} مستخدم مسجّل
                      </div>
                      {(panelCompanyDetail?.users ?? []).map((u) => (
                        <div key={u.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
                          padding: '12px 14px', border: '1px solid rgba(255,255,255,0.07)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                              background: u.active ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.12)',
                              border: `1px solid ${u.active ? 'rgba(52,211,153,0.3)' : 'rgba(148,163,184,0.18)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                            }}>👤</div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{u.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>@{u.username}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                              background: u.active ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.1)',
                              color: u.active ? '#34d399' : '#94a3b8',
                            }}>{u.active ? 'نشط' : 'غير نشط'}</span>
                            <span style={{ fontSize: '10px', color: '#475569' }}>{u.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab 3: Audit Log ── */}
              {panelTab === 3 && (
                <div>
                  {panelAuditLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ جارٍ تحميل السجل...</div>
                  ) : (() => {
                    const coAudit = (panelAuditResp?.rows ?? []).filter(e => e.record_id === subModal.id);
                    const ACTION_COLORS: Record<string, string> = {
                      update: '#6366f1', COMPANY_ACTIVATED: '#22c55e', COMPANY_SUSPENDED: '#ef4444',
                      COMPANY_EXTENDED: '#f59e0b', SUPER_ADMIN_ACCESS: '#64748b',
                      create: '#22c55e', delete: '#ef4444', COMPANY_CREATED: '#22c55e',
                    };
                    return coAudit.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
                        <div>لا يوجد سجل نشاط لهذه الشركة بعد</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: C.muted, marginBottom: '4px' }}>{coAudit.length} إجراء مسجّل</div>
                        {coAudit.map((entry) => {
                          const color = ACTION_COLORS[entry.action] ?? '#64748b';
                          return (
                            <div key={entry.id} style={{
                              background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
                              padding: '12px 14px 10px',
                              border: '1px solid rgba(255,255,255,0.07)',
                              borderRight: `3px solid ${color}`,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color }}>{entry.action}</span>
                                <span style={{ fontSize: '10px', color: '#475569' }}>
                                  {new Date(entry.created_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              {entry.note && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{entry.note}</div>}
                              {entry.username && <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px' }}>بواسطة: {entry.username}</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ── Panel Footer: Quick Actions ── */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0,
              background: 'rgba(0,0,0,0.2)',
            }}>
              {!subModal.is_active ? (
                <button
                  onClick={() => { coMutate.mutate({ url: `/api/super/companies/${subModal.id}/activate` }); setSubModal(null); }}
                  style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: C.success, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                >✅ تفعيل</button>
              ) : (
                <button
                  onClick={() => { coMutate.mutate({ url: `/api/super/companies/${subModal.id}/suspend` }); setSubModal(null); }}
                  style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: C.danger, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                >⛔ إيقاف</button>
              )}
              <button
                onClick={() => { resetPassword.mutate({ id: subModal.id, company_name: subModal.name }); setSubModal(null); }}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.1)', color: '#a78bfa', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >🔑 إعادة كلمة المرور</button>
              <button
                onClick={() => { setSubModal(null); setSnapshotCompany(subModal.id); }}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >📊 لقطة</button>
              <button
                onClick={() => { setSubModal(null); setDeleteCoErr(''); setDeleteTarget(subModal); }}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: C.danger, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginRight: 'auto' }}
              >🗑️ حذف</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
      {/* ════════════════════════════════════════
          COMPANY SNAPSHOT MODAL
          ════════════════════════════════════════ */}
      {snapshotCompany !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setSnapshotCompany(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
        >
          <div style={{
            background: C.card, borderRadius: '24px', border: `1.5px solid ${C.border}`,
            width: '100%', maxWidth: '720px', maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Modal header */}
            <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: C.text }}>
                  🏢 {snapshotData?.company?.name ?? 'جارٍ التحميل...'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: C.muted }}>لقطة سريعة — آخر تحديث الآن</p>
              </div>
              <button onClick={() => setSnapshotCompany(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: C.muted, lineHeight: 1 }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {snapshotLoading && (
                <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ جارٍ التحميل...</div>
              )}

              {snapshotData?.company && (() => {
                const c = snapshotData.company;
                const planColors: Record<string, string> = { trial: '#94A3B8', basic: '#60A5FA', pro: '#A78BFA', paid: '#34D399', professional: '#F59E0B' };
                const planNames: Record<string, string>  = { trial: 'تجريبية', basic: 'أساسية', pro: 'احترافية', paid: 'مدفوعة', professional: 'مميزة' };
                const planCol = planColors[c.plan_type] ?? '#94A3B8';
                const mkBadge = (label: string, color: string, bg: string) => (
                  <span style={{ fontSize: '11px', fontWeight: 700, color, background: bg, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{label}</span>
                );
                const statusColor = c.status === 'active' ? '#34D399' : c.status === 'trial' ? '#60A5FA' : c.status === 'suspended' ? '#94A3B8' : '#EF4444';
                const statusBg   = c.status === 'active' ? 'rgba(52,211,153,0.1)' : c.status === 'trial' ? 'rgba(96,165,250,0.1)' : c.status === 'suspended' ? 'rgba(148,163,184,0.1)' : 'rgba(239,68,68,0.1)';
                const statusAr   = c.status === 'active' ? 'نشط' : c.status === 'trial' ? 'تجريبي' : c.status === 'suspended' ? 'موقوف' : 'منتهي';
                return (
                  <>
                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      {[
                        { icon: '🛒', label: 'المبيعات', value: snapshotData.stats.salesCount.toLocaleString('ar-EG'), sub: `${snapshotData.stats.salesRevenue.toLocaleString('ar-EG')} ج.م.` },
                        { icon: '📦', label: 'المشتريات', value: snapshotData.stats.purchasesCount.toLocaleString('ar-EG'), sub: '—' },
                        { icon: '👥', label: 'المديرون', value: String(snapshotData.admins.length), sub: `${snapshotData.admins.filter(a => a.active).length} نشط` },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
                          <div style={{ fontSize: '28px', marginBottom: '6px' }}>{s.icon}</div>
                          <div style={{ fontWeight: 900, fontSize: '20px', color: C.text }}>{s.value}</div>
                          <div style={{ fontSize: '12px', color: C.muted }}>{s.label}</div>
                          <div style={{ fontSize: '11px', color: C.muted, opacity: 0.7 }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Company info */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                        {([
                          { k: '📋 الخطة', v: <span style={{ color: planCol, fontWeight: 700 }}>{planNames[c.plan_type] ?? c.plan_type}</span> },
                          { k: '📊 الحالة', v: mkBadge(statusAr, statusColor, statusBg) },
                          { k: '📅 ينتهي', v: c.end_date ? new Date(c.end_date).toLocaleDateString('ar-EG') : '—' },
                          { k: '📅 أُنشئت', v: new Date(c.created_at).toLocaleDateString('ar-EG') },
                          { k: '⏳ متبقي', v: `${c.daysRemaining} يوم` },
                          { k: '👥 المستخدمون', v: `${c.userCount} مستخدم` },
                        ] as { k: string; v: React.ReactNode }[]).map(({ k, v }) => (
                          <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: C.muted, minWidth: '90px' }}>{k}</span>
                            <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Admins */}
                    {snapshotData.admins.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: '13px', color: C.muted }}>👤 المديرون</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {snapshotData.admins.map(a => (
                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{a.name}</span>
                                <span style={{ fontSize: '11px', color: C.muted, marginRight: '10px' }}>@{a.username}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {mkBadge(a.role, '#A78BFA', 'rgba(167,139,250,0.1)')}
                                {mkBadge(a.active ? 'نشط' : 'موقوف', a.active ? '#34D399' : '#EF4444', a.active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent audit */}
                    {snapshotData.recentAudit.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0 0 12px', fontWeight: 800, fontSize: '13px', color: C.muted }}>📋 آخر العمليات</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {snapshotData.recentAudit.slice(0, 8).map(r => (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', fontSize: '12px' }}>
                              <span style={{ color: '#A78BFA', fontWeight: 700 }}>{r.action}</span>
                              <span style={{ color: C.muted, flex: 1, padding: '0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note ?? '—'}</span>
                              <span style={{ color: C.muted, direction: 'ltr', flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#C4B5FD', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >🖨️ طباعة</button>
              <button
                onClick={() => setSnapshotCompany(null)}
                style={{ padding: '9px 18px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >إغلاق</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes sa-fade-in { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes sa-panel-in { from { opacity: 0; transform: translateY(-10px) scaleY(0.97); transform-origin: top; } to { opacity: 1; transform: translateY(0) scaleY(1); transform-origin: top; } }
      `}</style>
    </div>
  );
}
