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
  Toast, DarkInput, Modal, ConfirmDeleteModal,
} from './super-admin/ui';
import { TabOverview } from './super-admin/tab-overview';
import { TabRevenue } from './super-admin/tab-revenue';
import { TabAlerts } from './super-admin/tab-alerts';
import { TabAuditLog } from './super-admin/tab-audit-log';
import { TabAnnouncements } from './super-admin/tab-announcements';
import { TabHealth } from './super-admin/tab-health';
import { TabPlans } from './super-admin/tab-plans';
import { TabMonitoring } from './super-admin/tab-monitoring';
import { TabCompanies } from './super-admin/tab-companies';
import { TabManagers } from './super-admin/tab-managers';
import { TabSettings } from './super-admin/tab-settings';


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
      authFetch('/api/super/health/redis')
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
  const { data: sysSettings, refetch: refetchSupportSettings } = useQuery<Record<string, string>>({
    queryKey: ['/api/super/support-settings'],
    queryFn: () => fetcher('/api/super/support-settings'),
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
      const res = await authFetch(api('/api/super/support-settings'), {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          support_whatsapp: supportWa.trim(),
          support_email: supportEmail.trim(),
        }),
      });
      if (!res.ok) { showToast('فشل حفظ الإعدادات', 'error'); return; }
      showToast('✅ تم حفظ إعدادات التواصل');
      void refetchSupportSettings();
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
          <TabCompanies
            stats={stats}
            companies={companies}
            filtered={filtered}
            paged={paged}
            coLoading={coLoading}
            statCards={statCards}
            STATUS_FILTERS={STATUS_FILTERS}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            setActiveTab={setActiveTab}
            page={page}
            setPage={setPage}
            perPage={perPage}
            setPerPage={setPerPage}
            totalPages={totalPages}
            safePage={safePage}
            viewMode={viewMode}
            setViewMode={setViewMode}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            showCreate={showCreate}
            setShowCreate={setShowCreate}
            newName={newName}
            setNewName={setNewName}
            newPlan={newPlan}
            setNewPlan={setNewPlan}
            newEdition={newEdition}
            setNewEdition={setNewEdition}
            newDays={newDays}
            setNewDays={setNewDays}
            newAdminName={newAdminName}
            setNewAdminName={setNewAdminName}
            newAdminUsername={newAdminUsername}
            setNewAdminUsername={setNewAdminUsername}
            setCreateResult={setCreateResult}
            setSubModal={setSubModal}
            setSubForm={setSubForm}
            setPanelTab={setPanelTab}
            setSnapshotCompany={setSnapshotCompany}
            setDeleteTarget={setDeleteTarget}
            setDeleteCoErr={setDeleteCoErr}
            DEFAULT_FEATS_ULTIMATE={DEFAULT_FEATS_ULTIMATE}
            DEFAULT_FEATS_ADVANCED={DEFAULT_FEATS_ADVANCED}
            coMutate={coMutate}
            resetPassword={resetPassword}
            expiryInfo={expiryInfo}
            showToast={showToast}
          />
        )}
        {/* ══════════════════════════════
            TAB: MANAGERS
            ══════════════════════════════ */}
        {activeTab === 'managers' && (
          <TabManagers
            managers={managers}
            mgLoading={mgLoading}
            mgError={mgError}
            mgRefetch={mgRefetch}
            currentUserId={user?.id}
            mgToggleMutate={(id) => mgToggle.mutate(id)}
            openEdit={openEdit}
            setDeleteMgrErr={setDeleteMgrErr}
            setDeleteMgr={setDeleteMgr}
            resetAddForm={resetAddForm}
            setShowAddMgr={setShowAddMgr}
          />
        )}
        {/* ══════════════════════════════
            TAB: SETTINGS  (support + audit + backups + security)
            ══════════════════════════════ */}
        {activeTab === 'settings' && (
          <TabSettings
            settingsActiveCard={settingsActiveCard}
            setSettingsActiveCard={setSettingsActiveCard}
            supportWa={supportWa}
            setSupportWa={setSupportWa}
            supportEmail={supportEmail}
            setSupportEmail={setSupportEmail}
            settingSaving={settingSaving}
            saveSupportSettings={saveSupportSettings}
            backupData={backupData}
            creatingBackup={creatingBackup}
            downloadingFile={downloadingFile}
            restoring={restoring}
            restoreOk={restoreOk}
            restoreErr={restoreErr}
            triggerBackup={triggerBackup}
            downloadBackup={downloadBackup}
            openRestorePicker={openRestorePicker}
            restoreInputRef={restoreInputRef}
            handleRestoreFileChange={handleRestoreFileChange}
            restoreModal={restoreModal}
            setRestoreModal={setRestoreModal}
            pendingRestoreFile={pendingRestoreFile}
            setPendingRestoreFile={setPendingRestoreFile}
            restoreCode={restoreCode}
            setRestoreCode={setRestoreCode}
            confirmRestore={confirmRestore}
            encEnabled={encEnabled}
            encKey={encKey}
            encKeyLoading={encKeyLoading}
            encKeyVisible={encKeyVisible}
            encKeyCopied={encKeyCopied}
            loadEncKey={loadEncKey}
            copyEncKey={copyEncKey}
            emailEncKey={emailEncKey}
            totpStatus={totpStatus}
            totpSetupData={totpSetupData}
            totpInput={totpInput}
            setTotpInput={setTotpInput}
            disableTotpInput={disableTotpInput}
            setDisableTotpInput={setDisableTotpInput}
            secLoading={secLoading}
            secMsg={secMsg}
            setSecMsg={setSecMsg}
            showDisable={showDisable}
            setShowDisable={setShowDisable}
            startTotpSetup={startTotpSetup}
            confirmTotpSetup={confirmTotpSetup}
            confirmDisableTotp={confirmDisableTotp}
            auditData={auditData}
            auditLoading={auditLoading}
            refetchAudit={refetchAudit}
            auditAction={auditAction}
            setAuditAction={setAuditAction}
            auditLimit={auditLimit}
            setAuditLimit={setAuditLimit}
            tgConfig={tgConfig}
            setTgConfig={setTgConfig}
            tgSaving={tgSaving}
            tgBotStatus={tgBotStatus}
            tgBotLoading={tgBotLoading}
            tgBotRefetch={tgBotRefetch}
            tgLoading={tgLoading}
            tgError={tgError}
            tgErrorObj={tgErrorObj}
            tgRefetch={tgRefetch}
            tgBotToken={tgBotToken}
            setTgBotToken={setTgBotToken}
            tgChatId={tgChatId}
            setTgChatId={setTgChatId}
            tgShowToken={tgShowToken}
            setTgShowToken={setTgShowToken}
            tgCredSaving={tgCredSaving}
            saveTgCredentials={saveTgCredentials}
            tgTesting={tgTesting}
            testTelegramConnection={testTelegramConnection}
            tgTestResult={tgTestResult}
            saveTelegramSettings={saveTelegramSettings}
          />
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
