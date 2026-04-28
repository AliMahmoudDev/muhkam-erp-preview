import { api } from '@/lib/api';
/**
 * Super Admin Dashboard — manage all SaaS companies + super_admin accounts
 * Only accessible to users with role = "super_admin"
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
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
    queryFn: () => authFetch(`/api/super/companies/${snapshotCompany}/snapshot`).then(r => r.json()),
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
  const [tgConfig, setTgConfig]   = useState<TgConfig | null>(null);
  const [tgSaving, setTgSaving]   = useState(false);


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
      authFetch(api(url)).then((r) => {
        if (!r.ok) throw new Error('فشل جلب البيانات');
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
    enabled: activeTab === 'settings' && settingsActiveCard === 'audit_log',
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
      enabled: activeTab === 'settings' && settingsActiveCard === 'plans',
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
  const { data: tgConfigData } = useQuery<TgConfig>({
    queryKey: ['/api/super/telegram-settings'],
    queryFn:  () => fetcher('/api/super/telegram-settings'),
    enabled:  activeTab === 'settings' && settingsActiveCard === 'telegram',
    staleTime: 30_000,
  });
  useEffect(() => { if (tgConfigData) setTgConfig(tgConfigData); }, [tgConfigData]);

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
            { key: 'revenue',       label: 'الإيرادات',         icon: '📊', color: '#10B981', shadow: 'rgba(16,185,129,0.45)',  desc: 'تقارير الإيرادات والمالية' },
            { key: 'alerts',        label: 'التنبيهات',         icon: '🔔', color: '#EF4444', shadow: 'rgba(239,68,68,0.45)',   desc: 'تنبيهات النظام والأحداث' },
            { key: 'announcements', label: 'الإعلانات',         icon: '📢', color: '#8B5CF6', shadow: 'rgba(139,92,246,0.45)', desc: 'إشعارات للمستخدمين' },
            { key: 'health',        label: 'صحة السيرفر',       icon: '🌡️', color: '#06B6D4', shadow: 'rgba(6,182,212,0.45)',   desc: 'مراقبة أداء الخوادم' },
            { key: 'monitoring',    label: 'مراقبة التجريبي',  icon: '🛡️', color: '#6366F1', shadow: 'rgba(99,102,241,0.45)',  desc: 'البيئة التجريبية' },
            { key: 'settings',      label: 'الإعدادات',         icon: '⚙️', color: '#64748B', shadow: 'rgba(100,116,139,0.45)', desc: 'إعدادات النظام والأمان' },
          ] as const;

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
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
        {activeTab === 'overview' && (() => {
          const ovHealth = healthData?.health;
          const ovMetrics = healthData?.metrics;
          const healthColor = ovHealth?.status === 'healthy' ? '#34D399' : ovHealth?.status === 'degraded' ? '#F59E0B' : '#EF4444';
          const healthLabel = ovHealth?.status === 'healthy' ? 'يعمل بشكل طبيعي' : ovHealth?.status === 'degraded' ? 'أداء منخفض' : 'مشكلة حرجة';

          const OV_ACTION_AR: Record<string, { label: string; color: string }> = {
            create: { label: 'إنشاء', color: '#34D399' }, update: { label: 'تعديل', color: '#60A5FA' },
            delete: { label: 'حذف', color: '#EF4444' }, cancel: { label: 'إلغاء', color: '#EF4444' },
            lock_period: { label: 'إغلاق فترة', color: '#F87171' }, unlock_period: { label: 'فتح فترة', color: '#34D399' },
            reversal_created: { label: 'سند عكسي', color: '#60A5FA' }, correction_created: { label: 'سند تصحيحي', color: '#A78BFA' },
            COMPANY_ACTIVATED: { label: 'تفعيل شركة', color: '#34D399' }, COMPANY_SUSPENDED: { label: 'إيقاف شركة', color: '#F59E0B' },
            COMPANY_EXTENDED: { label: 'تمديد اشتراك', color: '#38BDF8' }, COMPANY_DELETED: { label: 'حذف شركة', color: '#EF4444' },
            ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: '#A78BFA' },
            RESTORE_STARTED: { label: 'بدء استعادة', color: '#A78BFA' }, RESTORE_COMPLETED: { label: 'اكتمال استعادة', color: '#34D399' },
            SUPER_ADMIN_ACCESS: { label: 'وصول مدير عام', color: '#818CF8' }, SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
            INVENTORY_TRANSFER: { label: 'تحويل مخزون', color: '#38BDF8' }, INTEGRITY_REPAIR: { label: 'إصلاح محاسبي', color: '#FB7185' },
            price_override: { label: 'تجاوز سعر', color: '#FBBF24' }, PERIOD_OVERRIDE: { label: 'تجاوز إغلاق مالي', color: '#FB923C' },
          };

          const expiringSoon = (stats?.expiringSoonList ?? []).slice(0, 5);
          const totalR = ovMetrics?.total_requests ?? 0;
          const ok2xx = (ovMetrics?.status_codes?.['200'] ?? 0) + (ovMetrics?.status_codes?.['201'] ?? 0);
          const err5xx = Object.entries(ovMetrics?.status_codes ?? {}).filter(([k]) => k.startsWith('5')).reduce((s, [, v]) => s + v, 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>🏠 نظرة عامة على النظام</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
                    {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {ovHealth && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 18px', borderRadius: '12px',
                    background: `${healthColor}15`, border: `1px solid ${healthColor}40`,
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, display: 'inline-block',
                      boxShadow: `0 0 8px ${healthColor}` }} />
                    <span style={{ color: healthColor, fontWeight: 800, fontSize: '13px' }}>{healthLabel}</span>
                  </div>
                )}
              </div>

              {/* Row 1 — 4 big KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {[
                  {
                    icon: '🏢', label: 'الشركات النشطة', value: stats?.active ?? '—',
                    sub: `من إجمالي ${stats?.total ?? '—'} شركة`,
                    color: '#34D399', action: () => { setActiveTab('companies'); setStatusFilter('active'); },
                  },
                  {
                    icon: '⚠️', label: 'تنتهي خلال 7 أيام', value: stats?.expiringSoon ?? '—',
                    sub: 'تحتاج تجديد عاجل',
                    color: '#F59E0B', action: () => setActiveTab('alerts'),
                  },
                  {
                    icon: '👥', label: 'إجمالي المستخدمين', value: stats?.totalUsers ?? '—',
                    sub: `${stats?.recentSignups ?? 0} انضموا هذا الشهر`,
                    color: '#60A5FA', action: () => { setActiveTab('settings'); setSettingsActiveCard('managers'); },
                  },
                  {
                    icon: (stats?.expired ?? 0) > 0 ? '⛔' : '✅',
                    label: 'اشتراكات منتهية',
                    value: stats?.expired ?? '—',
                    sub: `${stats?.suspended ?? 0} موقوفة إضافياً`,
                    color: (stats?.expired ?? 0) > 0 ? '#EF4444' : '#34D399',
                    action: () => { setActiveTab('companies'); setStatusFilter('expired'); },
                  },
                ].map(kpi => (
                  <div
                    key={kpi.label}
                    onClick={kpi.action}
                    style={{
                      background: C.card, borderRadius: '18px',
                      border: `1px solid ${C.border}`, borderTop: `3px solid ${kpi.color}`,
                      padding: '22px 20px', cursor: 'pointer',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${kpi.color}20`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '10px' }}>{kpi.icon}</div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginTop: '8px' }}>{kpi.label}</div>
                    <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Row 2 — Server Health + API metrics side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Server health */}
                <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
                  <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>🌡️ صحة السيرفر</h3>
                  {healthLoading ? (
                    <div style={{ color: C.muted, fontSize: '13px' }}>⏳ جارٍ الفحص...</div>
                  ) : ovHealth ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { label: 'قاعدة البيانات', value: ovHealth.db ? '✅ متصلة' : '❌ منقطعة', color: ovHealth.db ? '#34D399' : '#EF4444' },
                        { label: 'استهلاك الذاكرة', value: `${ovHealth.memory_mb} MB`, color: ovHealth.memory_mb > 400 ? '#F59E0B' : '#34D399' },
                        { label: 'وقت التشغيل', value: `${ovHealth.uptime_hours} ساعة`, color: '#60A5FA' },
                        { label: 'استجابة DB', value: ovHealth.db_read_latency_ms >= 0 ? `${ovHealth.db_read_latency_ms} ms` : 'غير متاح', color: (ovHealth.db_read_latency_ms ?? 0) > 200 ? '#F59E0B' : '#34D399' },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: C.muted }}>{row.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => setActiveTab('health')}
                        style={{ marginTop: '8px', padding: '8px', borderRadius: '8px', border: `1px solid ${C.border}`,
                          background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}
                      >عرض التفاصيل الكاملة ←</button>
                    </div>
                  ) : <div style={{ color: C.muted, fontSize: '13px' }}>البيانات غير متاحة</div>}
                </div>

                {/* API metrics */}
                <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
                  <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>📡 مؤشرات الـ API</h3>
                  {ovMetrics ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { label: 'إجمالي الطلبات', value: totalR.toLocaleString('ar-EG'), color: '#60A5FA' },
                        { label: 'طلبات ناجحة (2xx)', value: ok2xx.toLocaleString('ar-EG'), color: '#34D399' },
                        { label: 'أخطاء سيرفر (5xx)', value: err5xx.toLocaleString('ar-EG'), color: err5xx > 0 ? '#EF4444' : '#34D399' },
                        { label: 'زمن الاستجابة p95', value: `${ovMetrics.latency_ms?.p95 ?? 0} ms`, color: (ovMetrics.latency_ms?.p95 ?? 0) > 500 ? '#F59E0B' : '#34D399' },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: C.muted }}>{row.label}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ color: C.muted, fontSize: '13px' }}>⏳ جارٍ التحميل...</div>}
                </div>
              </div>

              {/* Row 3 — Expiring soon + Recent audit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Expiring soon */}
                <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>⚠️ تنتهي قريباً</h3>
                    <button onClick={() => setActiveTab('alerts')}
                      style={{ fontSize: '12px', color: C.orange, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                      عرض الكل ←
                    </button>
                  </div>
                  {expiringSoon.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>✅ لا توجد اشتراكات تنتهي قريباً</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {expiringSoon.map(co => (
                        <div key={co.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', borderRadius: '10px',
                          background: co.days_left <= 3 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                          border: `1px solid ${co.days_left <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                        }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{co.name}</div>
                            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                              {new Date(co.end_date).toLocaleDateString('ar-EG')}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '13px', fontWeight: 900,
                            color: co.days_left <= 3 ? '#EF4444' : '#F59E0B',
                          }}>
                            {co.days_left} يوم
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent audit */}
                <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>📋 آخر الإجراءات</h3>
                    <button onClick={() => { setActiveTab('settings'); setSettingsActiveCard('audit_log'); }}
                      style={{ fontSize: '12px', color: C.orange, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
                      سجل التدقيق ←
                    </button>
                  </div>
                  {!overviewAudit?.rows.length ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>لا توجد سجلات</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {overviewAudit.rows.map(row => {
                        const meta = OV_ACTION_AR[row.action] ?? { label: row.action, color: '#94A3B8' };
                        const ts = new Date(row.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
                        return (
                          <div key={row.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 10px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                          }}>
                            <span style={{
                              fontSize: '11px', fontWeight: 800, color: meta.color,
                              background: `${meta.color}15`, border: `1px solid ${meta.color}30`,
                              padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap',
                            }}>{meta.label}</span>
                            <span style={{ fontSize: '12px', color: C.text, flex: 1 }}>{row.username ?? '—'}</span>
                            <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{ts}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 4 — Quick-access shortcuts */}
              <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
                <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>⚡ وصول سريع</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {[
                    { label: '🏢 إدارة الشركات', tab: 'companies' as const },
                    { label: '📊 لوحة الإيرادات', tab: 'revenue' as const },
                    { label: '🔔 مركز التنبيهات', tab: 'alerts' as const },
                    { label: '⚙️ الإعدادات والأمان', tab: 'settings' as const },
                  ].map(s => (
                    <button
                      key={s.tab}
                      onClick={() => setActiveTab(s.tab)}
                      style={{
                        padding: '10px 18px', borderRadius: '10px', border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.text, fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.orange; (e.currentTarget as HTMLButtonElement).style.color = C.orange; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
                    >{s.label}</button>
                  ))}
                </div>
              </div>

            </div>
          );
        })()}

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
            TAB: BACKUPS
            ══════════════════════════════ */}
        {false && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  background: '#111827', borderRadius: '20px',
                  border: '1px solid rgba(239,68,68,0.4)', padding: '28px',
                  width: '100%', maxWidth: '440px', direction: 'rtl',
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</div>
                  <h3 style={{ color: '#EF4444', fontWeight: 800, marginBottom: '8px' }}>
                    تأكيد الاستعادة
                  </h3>
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
                    >
                      إلغاء
                    </button>
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
                    >
                      تأكيد الاستعادة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Header card */}
            <div style={{
              background: C.card, borderRadius: '16px',
              border: `1px solid ${C.border}`, padding: '20px 24px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                  النسخ الاحتياطية للقاعدة
                </h2>
                <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>
                  النسخ التلقائي يعمل يومياً الساعة 3:00 صباحاً •{' '}
                  {backupData ? `${backupData!.total} نسخة متوفرة` : 'جاري التحميل...'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { void triggerBackup(); }}
                  disabled={creatingBackup}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 18px', borderRadius: '10px', border: 'none',
                    background: creatingBackup ? C.border : C.orange,
                    color: '#fff', fontSize: '13px', fontWeight: 800,
                    cursor: creatingBackup ? 'not-allowed' : 'pointer',
                    fontFamily: FONT,
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
                    cursor: restoring ? 'not-allowed' : 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  {restoring ? '⏳ جاري الاستعادة...' : '📥 استعادة من ملف'}
                </button>
              </div>
            </div>

            {/* Restore result */}
            {restoreOk && (
              <div style={{
                padding: '14px 18px', borderRadius: '12px',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                color: '#22C55E', fontSize: '13px', fontWeight: 700,
              }}>
                ✅ {restoreOk}
              </div>
            )}
            {restoreErr && (
              <div style={{
                padding: '14px 18px', borderRadius: '12px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444', fontSize: '13px',
              }}>
                ❌ {restoreErr}
              </div>
            )}

            {/* Backups table */}
            <div style={{
              background: C.card, borderRadius: '16px',
              border: `1px solid ${C.border}`, overflow: 'hidden',
            }}>
              {/* Column headers */}
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
                <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>
                  جاري التحميل...
                </div>
              ) : backupData!.backups.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>💾</div>
                  <div>لا توجد نسخ احتياطية بعد</div>
                  <div style={{ fontSize: '12px', marginTop: '6px' }}>
                    اضغط "إنشاء نسخة الآن" للبدء
                  </div>
                </div>
              ) : (
                backupData!.backups.map((b, idx) => {
                  const isEnc = b.filename.endsWith('.enc');
                  const isDownloading = downloadingFile === b.filename;
                  return (
                    <div
                      key={b.filename}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px',
                        gap: '8px', padding: '12px 20px', alignItems: 'center',
                        borderBottom: idx < backupData!.backups.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: idx % 2 === 1 ? 'rgba(15,23,42,0.4)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '14px' }}>{isEnc ? '🔒' : '📄'}</span>
                        <span style={{
                          fontSize: '12px', color: C.text,
                          fontFamily: 'monospace', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {b.filename}
                        </span>
                        {isEnc && (
                          <span style={{
                            fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                            background: 'rgba(251,191,36,0.15)', color: '#FBB024',
                            fontWeight: 700, flexShrink: 0,
                          }}>
                            مشفّر
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>
                        {b.size_mb} MB
                      </div>
                      <div style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>
                        {new Date(b.created_at).toLocaleString('ar-EG-u-nu-latn', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => { void downloadBackup(b.filename); }}
                          disabled={isDownloading}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            border: '1px solid rgba(34,197,94,0.3)',
                            background: isDownloading ? 'transparent' : 'rgba(34,197,94,0.1)',
                            color: isDownloading ? C.muted : '#22C55E',
                            fontSize: '11px', fontWeight: 700,
                            cursor: isDownloading ? 'not-allowed' : 'pointer',
                            fontFamily: FONT,
                          }}
                        >
                          {isDownloading ? '...' : '⬇ تنزيل'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Info note */}
            <div style={{
              padding: '12px 16px', borderRadius: '10px',
              background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)',
              fontSize: '12px', color: C.muted,
            }}>
              💡 الملفات المشفّرة (.json.enc) محمية بتشفير AES-256. احتفظ بمفتاح التشفير في مكان آمن — بدونه لا يمكن فك تشفير أي نسخة.
            </div>

            {/* ── بطاقة معلومات التشفير ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(17,24,39,1) 0%, rgba(30,15,40,1) 100%)',
              borderRadius: '18px',
              border: '1px solid rgba(168,85,247,0.25)',
              overflow: 'hidden',
            }}>
              {/* رأس البطاقة */}
              <div style={{
                padding: '18px 22px',
                borderBottom: '1px solid rgba(168,85,247,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(168,85,247,0.07)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(168,85,247,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px',
                  }}>🔑</div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#E9D5FF', fontSize: '14px' }}>
                      مفتاح تشفير النسخ الاحتياطية
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(168,85,247,0.7)', marginTop: '1px' }}>
                      AES-256-GCM — {encEnabled ? 'مفعّل ✓' : 'غير مفعّل'}
                    </div>
                  </div>
                </div>
                {!encKeyVisible && (
                  <button
                    onClick={() => { void loadEncKey(); }}
                    disabled={encKeyLoading}
                    style={{
                      padding: '8px 16px', borderRadius: '9px',
                      border: '1px solid rgba(168,85,247,0.35)',
                      background: 'rgba(168,85,247,0.12)',
                      color: '#C084FC', fontSize: '12px', fontWeight: 700,
                      cursor: encKeyLoading ? 'not-allowed' : 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    {encKeyLoading ? '...' : '👁 إظهار المفتاح'}
                  </button>
                )}
              </div>

              {/* تحذير */}
              <div style={{
                margin: '16px 22px 0',
                padding: '10px 14px', borderRadius: '10px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', gap: '8px', alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                <p style={{ fontSize: '11px', color: 'rgba(252,165,165,0.85)', margin: 0, lineHeight: 1.6 }}>
                  هذا المفتاح <strong style={{ color: '#FCA5A5' }}>سري للغاية</strong>. لا تشاركه مع أحد.
                  بدونه لا يمكن فتح أي نسخة احتياطية مشفّرة. احتفظ بنسخة منه في مكان آمن خارج السيرفر.
                </p>
              </div>

              {/* قيمة المفتاح */}
              <div style={{ padding: '16px 22px' }}>
                {!encKeyVisible ? (
                  <div style={{
                    padding: '14px', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                    textAlign: 'center', color: 'rgba(255,255,255,0.25)',
                    fontSize: '13px', letterSpacing: '4px',
                  }}>
                    ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●
                  </div>
                ) : (
                  <div style={{
                    padding: '14px 16px', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(168,85,247,0.2)',
                    fontFamily: 'monospace', fontSize: '12px',
                    color: '#C4B5FD', wordBreak: 'break-all', lineHeight: 1.7,
                    position: 'relative',
                  }}>
                    {encKey || '—'}
                  </div>
                )}

                {/* أزرار الإجراءات */}
                {encKeyVisible && encKey && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={copyEncKey}
                      style={{
                        flex: 1, minWidth: '120px', padding: '10px 16px',
                        borderRadius: '10px', border: '1px solid rgba(168,85,247,0.3)',
                        background: encKeyCopied ? 'rgba(34,197,94,0.12)' : 'rgba(168,85,247,0.1)',
                        color: encKeyCopied ? '#86EFAC' : '#C084FC',
                        fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      {encKeyCopied ? '✅ تم النسخ' : '📋 نسخ المفتاح'}
                    </button>

                    <button
                      onClick={emailEncKey}
                      style={{
                        flex: 1, minWidth: '160px', padding: '10px 16px',
                        borderRadius: '10px', border: '1px solid rgba(59,130,246,0.3)',
                        background: 'rgba(59,130,246,0.1)',
                        color: '#93C5FD',
                        fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      ✉️ إرسال لـ m.elmelegy@me.com
                    </button>

                    <button
                      onClick={() => setEncKeyVisible(false)}
                      style={{
                        padding: '10px 14px', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'transparent', color: 'rgba(255,255,255,0.3)',
                        fontSize: '13px', cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      🙈 إخفاء
                    </button>
                  </div>
                )}

                {/* تعليمات الحفظ */}
                <div style={{
                  marginTop: '16px', padding: '12px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontWeight: 700 }}>
                    📌 أماكن الحفظ الموصى بها:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {[
                      ['🖨️', 'اطبعه وضعه في خزنة أو مكان آمن'],
                      ['🔐', 'احفظه في برنامج كلمات مرور (1Password / Bitwarden)'],
                      ['✉️', 'أرسله لبريدك الشخصي كنسخة طوارئ'],
                    ].map(([icon, text]) => (
                      <div key={text} style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        <span>{icon}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            TAB: SECURITY
            ══════════════════════════════ */}
        {false && (
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, marginBottom: '20px' }}>
              إعدادات الأمان
            </h2>

            {/* ── 2FA Card ─── */}
            <div
              style={{
                background: C.card,
                borderRadius: '16px',
                border: `1px solid ${C.border}`,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      color: C.text,
                      marginBottom: '4px',
                    }}
                  >
                    المصادقة الثنائية (2FA)
                  </div>
                  <div style={{ fontSize: '12px', color: C.muted }}>
                    تضيف طبقة أمان إضافية لحسابك — يتطلب Google Authenticator أو Authy
                  </div>
                </div>
                {totpStatus?.totp_enabled ? (
                  <span
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      background: 'rgba(34,197,94,0.15)',
                      color: C.success,
                      fontSize: '12px',
                      fontWeight: 700,
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}
                  >
                    ✅ مفعلة
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      background: 'rgba(148,163,184,0.1)',
                      color: C.muted,
                      fontSize: '12px',
                      fontWeight: 700,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    غير مفعلة
                  </span>
                )}
              </div>

              <div style={{ padding: '24px' }}>
                {/* Feedback message */}
                {secMsg && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: secMsg!.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: secMsg!.ok ? C.success : '#EF4444',
                      border: `1px solid ${secMsg!.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}
                  >
                    {secMsg!.text}
                  </div>
                )}

                {/* ── NOT enabled → show setup flow ─── */}
                {!totpStatus?.totp_enabled && !totpSetupData && (
                  <button
                    onClick={() => {
                      void startTotpSetup();
                    }}
                    disabled={secLoading}
                    style={{
                      padding: '11px 22px',
                      borderRadius: '10px',
                      border: 'none',
                      background: secLoading ? C.border : C.orange,
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 800,
                      cursor: secLoading ? 'not-allowed' : 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    {secLoading ? 'جاري الإعداد...' : '🔐 تفعيل المصادقة الثنائية'}
                  </button>
                )}

                {/* ── Setup step: show QR + input ─── */}
                {!totpStatus?.totp_enabled && totpSetupData && (
                  <div>
                    <p style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
                      امسح الكود بتطبيق{' '}
                      <strong style={{ color: C.text }}>Google Authenticator</strong> أو{' '}
                      <strong style={{ color: C.text }}>Authy</strong>، ثم أدخل الرمز المكون من 6
                      أرقام للتأكيد:
                    </p>
                    <div
                      style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}
                    >
                      <img
                        src={totpSetupData!.qr_code}
                        alt="QR Code"
                        style={{
                          width: '200px',
                          height: '200px',
                          borderRadius: '12px',
                          border: `2px solid ${C.border}`,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        background: 'rgba(15,23,42,0.6)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '11px',
                        color: C.muted,
                        wordBreak: 'break-all',
                      }}
                    >
                      <span style={{ color: C.orange, fontWeight: 700 }}>إدخال يدوي: </span>
                      {totpSetupData!.secret}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        value={totpInput}
                        onChange={(e) =>
                          setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="أدخل الرمز (6 أرقام)"
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: `1px solid ${C.border}`,
                          background: 'rgba(15,23,42,0.5)',
                          color: C.text,
                          fontSize: '18px',
                          letterSpacing: '6px',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          outline: 'none',
                        }}
                        maxLength={6}
                      />
                      <button
                        onClick={() => {
                          void confirmTotpSetup();
                        }}
                        disabled={secLoading || totpInput.length !== 6}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '10px',
                          border: 'none',
                          background: totpInput.length === 6 ? C.orange : C.border,
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: 800,
                          cursor: totpInput.length !== 6 ? 'not-allowed' : 'pointer',
                          fontFamily: FONT,
                        }}
                      >
                        {secLoading ? '...' : 'تأكيد'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Enabled → show disable option ─── */}
                {totpStatus?.totp_enabled && (
                  <div>
                    {!showDisable ? (
                      <button
                        onClick={() => {
                          setShowDisable(true);
                          setSecMsg(null);
                        }}
                        style={{
                          padding: '11px 22px',
                          borderRadius: '10px',
                          border: '1px solid rgba(239,68,68,0.4)',
                          background: 'rgba(239,68,68,0.1)',
                          color: '#EF4444',
                          fontSize: '14px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: FONT,
                        }}
                      >
                        🚫 إيقاف المصادقة الثنائية
                      </button>
                    ) : (
                      <div>
                        <p style={{ fontSize: '13px', color: C.muted, marginBottom: '12px' }}>
                          أدخل رمز التحقق من التطبيق للتأكيد:
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input
                            value={disableTotpInput}
                            onChange={(e) =>
                              setDisableTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            placeholder="6 أرقام"
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid rgba(239,68,68,0.4)',
                              background: 'rgba(239,68,68,0.05)',
                              color: C.text,
                              fontSize: '18px',
                              letterSpacing: '6px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              outline: 'none',
                            }}
                            maxLength={6}
                          />
                          <button
                            onClick={() => {
                              void confirmDisableTotp();
                            }}
                            disabled={secLoading || disableTotpInput.length !== 6}
                            style={{
                              padding: '10px 18px',
                              borderRadius: '10px',
                              border: 'none',
                              background: disableTotpInput.length === 6 ? '#EF4444' : C.border,
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: 800,
                              cursor: disableTotpInput.length !== 6 ? 'not-allowed' : 'pointer',
                              fontFamily: FONT,
                            }}
                          >
                            {secLoading ? '...' : 'إيقاف'}
                          </button>
                          <button
                            onClick={() => {
                              setShowDisable(false);
                              setDisableTotpInput('');
                              setSecMsg(null);
                            }}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: `1px solid ${C.border}`,
                              background: 'transparent',
                              color: C.muted,
                              fontSize: '14px',
                              cursor: 'pointer',
                              fontFamily: FONT,
                            }}
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── IP Restriction info ─── */}
            <div
              style={{
                background: C.card,
                borderRadius: '16px',
                border: `1px solid ${C.border}`,
                padding: '20px 24px',
                marginTop: '16px',
              }}
            >
              <div
                style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '8px' }}
              >
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
                  background: '#111827', borderRadius: '20px',
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

            {/* ═══ كروت الإعدادات (4 أقسام) ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {([
                { key: 'support'   as const, icon: '⚙️', label: 'معلومات التواصل', desc: 'واتساب وبريد الدعم الفني',    color: '#F97316' },
                { key: 'backup'    as const, icon: '💾', label: 'النسخ الاحتياطية', desc: 'إنشاء / استعادة / تشفير',     color: '#34D399' },
                { key: 'security'  as const, icon: '🔐', label: 'الأمان',            desc: 'المصادقة الثنائية وقيود IP', color: '#A78BFA' },
                { key: 'audit_log' as const, icon: '📋', label: 'سجل العمليات',      desc: 'مراقبة جميع إجراءات النظام', color: '#60A5FA' },
                { key: 'managers'  as const, icon: '👑', label: 'المديرون',           desc: 'إدارة مديري النظام',          color: '#F472B6' },
                { key: 'plans'     as const, icon: '💰', label: 'الخطط',             desc: 'إعداد خطط الاشتراك والأسعار', color: '#FBBF24' },
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
              <div style={{ background: C.card, borderRadius: '18px', border: `1.5px solid ${settingsActiveCard === 'support' ? '#F97316' : settingsActiveCard === 'backup' ? '#34D399' : settingsActiveCard === 'security' ? '#A78BFA' : settingsActiveCard === 'audit_log' ? '#60A5FA' : settingsActiveCard === 'managers' ? '#F472B6' : settingsActiveCard === 'plans' ? '#FBBF24' : settingsActiveCard === 'telegram' ? '#38BDF8' : C.border}50`, overflow: 'hidden', animation: 'sa-panel-in 0.25s ease-out both' }}>
                {(() => {
                  const CARD_COLOR: Record<string, string> = { support: '#F97316', backup: '#34D399', security: '#A78BFA', audit_log: '#60A5FA', managers: '#F472B6', plans: '#FBBF24', telegram: '#38BDF8' };
                  const hc = settingsActiveCard ? (CARD_COLOR[settingsActiveCard] ?? C.border) : C.border;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: `${hc}12` }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: hc }}>
                        {settingsActiveCard === 'support'   && '⚙️ معلومات التواصل للدعم'}
                        {settingsActiveCard === 'backup'    && '💾 النسخ الاحتياطية'}
                        {settingsActiveCard === 'security'  && '🔐 الأمان'}
                        {settingsActiveCard === 'audit_log' && '📋 سجل العمليات'}
                        {settingsActiveCard === 'managers'  && '👑 المديرون'}
                        {settingsActiveCard === 'plans'     && '💰 الخطط والأسعار'}
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
                {settingsActiveCard === 'telegram' && (
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Loading state */}
                    {!tgConfig && (
                      <div style={{ textAlign: 'center', padding: '40px', color: C.muted, fontSize: '14px' }}>
                        ⏳ جاري تحميل الإعدادات...
                      </div>
                    )}

                    {tgConfig && (<>
                      {/* Master switch */}
                      <div style={{
                        background: tgConfig.enabled ? 'rgba(56,189,248,0.08)' : 'rgba(239,68,68,0.06)',
                        border: `1.5px solid ${tgConfig.enabled ? 'rgba(56,189,248,0.35)' : 'rgba(239,68,68,0.25)'}`,
                        borderRadius: '14px', padding: '18px 22px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                      }}>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 900, color: C.text, marginBottom: '4px' }}>
                            📨 تليجرام — المفتاح الرئيسي
                          </div>
                          <div style={{ fontSize: '12px', color: C.muted }}>
                            {tgConfig.enabled
                              ? 'البوت يعمل ويرسل التنبيهات المفعّلة أدناه'
                              : 'جميع الرسائل متوقفة — لن يصل أي إشعار'}
                          </div>
                        </div>
                        <button
                          onClick={() => setTgConfig(c => c ? { ...c, enabled: !c.enabled } : c)}
                          style={{
                            padding: '10px 22px', borderRadius: '30px', border: 'none', fontFamily: FONT,
                            fontWeight: 800, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                            background: tgConfig.enabled ? '#38BDF8' : 'rgba(148,163,184,0.15)',
                            color: tgConfig.enabled ? '#0F172A' : C.muted,
                            minWidth: '90px',
                          }}
                        >
                          {tgConfig.enabled ? '✅ مفعّل' : '⛔ موقوف'}
                        </button>
                      </div>

                      {/* Per-alert rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', color: C.muted, fontWeight: 700, marginBottom: '4px', paddingRight: '4px' }}>
                          التحكم في كل نوع تنبيه على حدة:
                        </div>
                        {Object.entries(tgConfig.alerts).map(([key, rule]) => (
                          <div
                            key={key}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              background: 'rgba(15,23,42,0.4)', borderRadius: '12px',
                              border: `1px solid ${rule.enabled ? 'rgba(56,189,248,0.2)' : C.border}`,
                              padding: '12px 16px', transition: 'border-color 0.15s',
                              opacity: tgConfig.enabled ? 1 : 0.45,
                            }}
                          >
                            {/* Toggle button */}
                            <button
                              onClick={() => setTgConfig(c => {
                                if (!c) return c;
                                return { ...c, alerts: { ...c.alerts, [key]: { ...rule, enabled: !rule.enabled } } };
                              })}
                              disabled={!tgConfig.enabled}
                              style={{
                                flexShrink: 0, width: '38px', height: '22px', borderRadius: '11px',
                                border: 'none', cursor: tgConfig.enabled ? 'pointer' : 'not-allowed',
                                background: rule.enabled ? '#38BDF8' : 'rgba(148,163,184,0.2)',
                                position: 'relative', transition: 'background 0.15s',
                              }}
                              title={rule.enabled ? 'إيقاف هذا التنبيه' : 'تفعيل هذا التنبيه'}
                            >
                              <span style={{
                                position: 'absolute', top: '3px',
                                left: rule.enabled ? '18px' : '3px',
                                width: '16px', height: '16px', borderRadius: '50%',
                                background: '#fff', transition: 'left 0.15s',
                              }} />
                            </button>

                            {/* Label */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: rule.enabled ? C.text : C.muted }}>
                                {rule.label}
                              </div>
                              <div style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace', marginTop: '1px' }}>
                                {key}
                              </div>
                            </div>

                            {/* Cooldown input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>cooldown</span>
                              <input
                                type="number"
                                min={0}
                                max={168}
                                value={rule.cooldownHours}
                                onChange={e => {
                                  const h = Math.max(0, Math.min(168, Number(e.target.value) || 0));
                                  setTgConfig(c => c ? { ...c, alerts: { ...c.alerts, [key]: { ...rule, cooldownHours: h } } } : c);
                                }}
                                disabled={!tgConfig.enabled}
                                style={{
                                  width: '52px', padding: '5px 8px', borderRadius: '8px',
                                  border: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.6)',
                                  color: C.text, fontSize: '13px', textAlign: 'center',
                                  outline: 'none', fontFamily: FONT,
                                }}
                              />
                              <span style={{ fontSize: '11px', color: C.muted }}>ساعة</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Save button */}
                      <button
                        onClick={() => { void saveTelegramSettings(); }}
                        disabled={tgSaving}
                        style={{
                          width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                          background: tgSaving ? C.border : '#38BDF8',
                          color: tgSaving ? C.muted : '#0F172A',
                          fontSize: '14px', fontWeight: 900,
                          cursor: tgSaving ? 'not-allowed' : 'pointer',
                          fontFamily: FONT, transition: 'all 0.15s',
                        }}
                      >
                        {tgSaving ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
                      </button>
                    </>)}
                  </div>
                )}

                {/* ── Managers ── */}
                {settingsActiveCard === 'managers' && (
                  <div>
                    <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>المديرون العامون</h2>
                        <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>{managers.length} مدير عام مسجّل</p>
                      </div>
                      <button onClick={() => { resetAddForm(); setShowAddMgr(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', background: '#F472B6', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                        <span>➕</span><span>مدير عام جديد</span>
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 140px 160px 90px 1fr', gap: '8px', padding: '10px 24px', background: 'rgba(244,114,182,0.08)', borderBottom: `1px solid ${C.border}`, fontSize: '11px', fontWeight: 700, color: '#F472B6', alignItems: 'center' }}>
                      <div>#</div><div>الاسم</div><div>اسم المستخدم</div><div>آخر دخول</div><div style={{ textAlign: 'center' }}>الحالة</div><div style={{ textAlign: 'center' }}>الإجراءات</div>
                    </div>
                    {mgLoading ? (
                      <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>جاري التحميل...</div>
                    ) : mgError ? (
                      <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
                        <div style={{ color: C.danger, fontWeight: 700, marginBottom: '8px' }}>تعذّر جلب بيانات المديرين</div>
                        <button onClick={() => void mgRefetch()} style={{ padding: '8px 20px', borderRadius: '10px', background: C.orange, color: '#fff', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>إعادة المحاولة</button>
                      </div>
                    ) : managers.length === 0 ? (
                      <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>لا يوجد مديرون عامون مسجّلون</div>
                    ) : managers.map((m, idx) => {
                      const isMgr = m.id === user?.id;
                      const isOddRow = idx % 2 === 1;
                      const isMgrActive = m.active !== false;
                      const lastLogin = m.last_login ? new Date(m.last_login).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : 'لم يسجل بعد';
                      return (
                        <div key={m.id} style={{ borderBottom: `1px solid ${C.border}`, background: isOddRow ? 'rgba(15,23,42,0.4)' : 'transparent' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 140px 160px 90px 1fr', gap: '8px', padding: '14px 24px', alignItems: 'center' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, color: '#F472B6', flexShrink: 0 }}>#{m.id}</div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{m.name}{isMgr && <span style={{ marginRight: '8px', fontSize: '10px', fontWeight: 700, color: '#F472B6', background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.3)', padding: '2px 8px', borderRadius: '10px' }}>أنت</span>}</div>
                              {m.email && <div style={{ fontSize: '11px', color: C.muted }}>{m.email}</div>}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: C.muted, direction: 'ltr' }}>@{m.username}</div>
                            <div style={{ fontSize: '12px', color: m.last_login ? C.success : C.muted }}>{lastLogin}</div>
                            <div style={{ textAlign: 'center' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'inline-block', background: isMgrActive ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)', color: isMgrActive ? C.success : C.muted, border: `1px solid ${isMgrActive ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.2)'}` }}>{isMgrActive ? 'نشط' : 'موقوف'}</span></div>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button onClick={() => openEdit(m)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(244,114,182,0.4)', background: 'rgba(244,114,182,0.1)', color: '#F472B6', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>✏️ تعديل</button>
                              {!isMgr && <button onClick={() => mgToggle.mutate(m.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${isMgrActive ? C.danger : C.success}44`, background: isMgrActive ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: isMgrActive ? C.danger : C.success, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>{isMgrActive ? '⛔ إيقاف' : '✅ تفعيل'}</button>}
                              {!isMgr && <button onClick={() => { setDeleteMgrErr(''); setDeleteMgr(m); }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: C.danger, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>🗑️ حذف</button>}
                              {isMgr && <span style={{ fontSize: '11px', color: C.muted, alignSelf: 'center' }}>لا يمكن تعديل الحساب الحالي هنا</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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

                {/* ── Plans ── */}
                {settingsActiveCard === 'plans' && (
                  <div style={{ padding: '24px' }}>
                    {planSettingsLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>جارٍ التحميل…</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                        {(planSettings ?? []).map(plan => {
                          const isEditingP = editingPlan?.key === plan.key;
                          const ep = isEditingP ? editingPlan! : plan;
                          return (
                            <div key={plan.key} style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '16px', border: `1.5px solid ${isEditingP ? C.orange : C.border}`, padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: isEditingP ? '0 4px 24px rgba(249,115,22,0.15)' : 'none', transition: 'border-color 0.2s' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: ep.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: ep.is_active ? '#22c55e' : '#ef4444' }}>{ep.is_active ? 'فعّالة' : 'معطّلة'}</span>
                                <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{plan.key}</span>
                              </div>
                              {isEditingP ? (
                                <>
                                  <div>
                                    <label style={{ fontSize: '11px', color: C.muted, display: 'block', marginBottom: '4px' }}>اسم الخطة (عربي)</label>
                                    <input value={ep.name_ar} onChange={e => setEditingPlan({ ...ep, name_ar: e.target.value })} style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px', color: C.text, fontSize: '14px', fontFamily: FONT, boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', color: C.muted, display: 'block', marginBottom: '4px' }}>الوصف</label>
                                    <input value={ep.description ?? ''} onChange={e => setEditingPlan({ ...ep, description: e.target.value })} style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px', color: C.text, fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '11px', color: C.muted, display: 'block', marginBottom: '4px' }}>السعر الشهري (ج.م.)</label>
                                    <input type="number" min={0} value={ep.price} onChange={e => setEditingPlan({ ...ep, price: Number(e.target.value) })} style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px', color: C.orange, fontSize: '18px', fontWeight: 800, fontFamily: FONT, boxSizing: 'border-box' }} />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input type="checkbox" id={`sp-mobile-${plan.key}`} checked={ep.includes_mobile} onChange={e => setEditingPlan({ ...ep, includes_mobile: e.target.checked })} />
                                    <label htmlFor={`sp-mobile-${plan.key}`} style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}>تشمل تطبيق الموبايل</label>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input type="checkbox" id={`sp-active-${plan.key}`} checked={ep.is_active} onChange={e => setEditingPlan({ ...ep, is_active: e.target.checked })} />
                                    <label htmlFor={`sp-active-${plan.key}`} style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}>الخطة فعّالة</label>
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                    <button onClick={() => savePlan(ep)} disabled={planSaving} style={{ flex: 1, background: C.orange, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontWeight: 800, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>{planSaving ? 'جارٍ الحفظ…' : '💾 حفظ'}</button>
                                    <button onClick={() => setEditingPlan(null)} style={{ flex: 1, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px', fontWeight: 700, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>إلغاء</button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <div style={{ fontSize: '18px', fontWeight: 900, color: C.text }}>{plan.name_ar}</div>
                                    {plan.description && <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>{plan.description}</div>}
                                  </div>
                                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#FBBF24' }}>
                                    {plan.price.toLocaleString('ar-EG')}
                                    <span style={{ fontSize: '14px', color: C.muted, fontWeight: 600, marginRight: '4px' }}>ج.م./شهر</span>
                                  </div>
                                  {plan.includes_mobile && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', alignSelf: 'flex-start' }}>📱 يشمل الموبايل</span>}
                                  <button onClick={() => setEditingPlan({ ...plan })} style={{ background: 'transparent', border: `1.5px solid #FBBF24`, color: '#FBBF24', borderRadius: '10px', padding: '8px', fontWeight: 700, fontSize: '13px', fontFamily: FONT, cursor: 'pointer', marginTop: '4px' }}>✏️ تعديل السعر</button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: C.muted, lineHeight: 1.6 }}>⚠️ تغيير الأسعار يؤثر فقط على حسابات الإيرادات والتقارير. لا يتم تحديث الرسوم تلقائياً للعملاء الحاليين.</p>
                    </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>📊 لوحة الإيرادات</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>تتبع الإيرادات الشهرية والنمو ومعدلات التحويل</p>
            </div>
            <button onClick={() => exportCompaniesCSV()} style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)',
              background: 'rgba(34,197,94,0.1)', color: '#86EFAC', fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            }}>📤 تصدير CSV</button>
          </div>

          {revenueLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ جارٍ التحميل...</div>
          ) : revenueData ? (
            <>
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'MRR', value: `${revenueData.mrr.toLocaleString('ar-EG')} ج.م.`, sub: 'الإيراد الشهري المتكرر', color: '#A78BFA', icon: '💰' },
                  { label: 'ARR', value: `${revenueData.arr.toLocaleString('ar-EG')} ج.م.`, sub: 'الإيراد السنوي المتوقع', color: '#34D399', icon: '📈' },
                  { label: 'ARPU', value: `${revenueData.arpu.toLocaleString('ar-EG')} ج.م.`, sub: 'متوسط إيراد العميل', color: '#60A5FA', icon: '👤' },
                  { label: 'معدل التحويل', value: `${revenueData.conversionRate}%`, sub: 'من تجريبي إلى مدفوع', color: '#F59E0B', icon: '🔄' },
                  { label: 'شركات نشطة', value: String(revenueData.activeCompanies), sub: `${revenueData.paidCompanies} مدفوعة • ${revenueData.trialCompanies} تجريبية`, color: '#FB923C', icon: '🏢' },
                ].map(kpi => (
                  <div key={kpi.label} style={{
                    background: C.card, borderRadius: '16px', border: `1px solid ${kpi.color}22`,
                    padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '22px' }}>{kpi.icon}</span>
                      <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>{kpi.label}</span>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Monthly Revenue Chart — Recharts AreaChart */}
              <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>📅 الإيراد الشهري (آخر 12 شهراً)</h3>
                  <button
                    onClick={() => {
                      const rows = revenueData.monthlyRevenue.map(m => `${m.month},${m.revenue},${m.count}`).join('\n');
                      const blob = new Blob([`الشهر,الإيراد,عدد الشركات\n${rows}`], { type: 'text/csv' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'revenue.csv'; a.click();
                    }}
                    style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#86EFAC', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                  >📥 CSV</button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueData.monthlyRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#A78BFA" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: FONT }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: FONT }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <ReTooltip
                      contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontFamily: FONT, fontSize: '12px' }}
                      formatter={(v: number) => [`${v.toLocaleString('ar-EG')} ج.م.`, 'الإيراد']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#A78BFA" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ r: 3, fill: '#A78BFA', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Plan Breakdown — Recharts PieChart + table */}
              <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: '15px', color: C.text }}>💳 توزيع الخطط</h3>
                {(() => {
                  const planColors: Record<string, string> = { trial: '#94A3B8', basic: '#60A5FA', pro: '#A78BFA', paid: '#34D399', professional: '#F59E0B' };
                  const planNames: Record<string, string>  = { trial: 'تجريبية', basic: 'أساسية', pro: 'احترافية', paid: 'مدفوعة', professional: 'مميزة' };
                  const pieData = revenueData.planBreakdown.filter(p => p.count > 0).map(p => ({
                    name: planNames[p.plan] ?? p.plan, value: p.count,
                    revenue: p.revenue, color: planColors[p.plan] ?? '#94A3B8',
                  }));
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', alignItems: 'center' }}>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                            {pieData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                          </Pie>
                          <ReTooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontFamily: FONT, fontSize: '12px' }} formatter={(v: number, _n, p) => [`${v} شركة — ${p.payload.revenue.toLocaleString('ar-EG')} ج.م./شهر`, p.payload.name]} />
                          <Legend wrapperStyle={{ fontSize: '11px', fontFamily: FONT }} formatter={v => v} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {revenueData.planBreakdown.filter(p => p.count > 0 || p.plan === 'trial').map(p => {
                          const col = planColors[p.plan] ?? '#94A3B8';
                          return (
                            <div key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: `${col}11`, border: `1px solid ${col}22` }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: col }}>{planNames[p.plan] ?? p.plan}</span>
                              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: C.muted, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <span>{p.count} شركة</span>
                                <span style={{ color: col, fontWeight: 700 }}>{p.revenue.toLocaleString('ar-EG')} ج.م./شهر</span>
                                <span>{p.price} ج.م./شركة</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TAB: ALERTS  🔔
          ═══════════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>🔔 مركز التنبيهات الذكية</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>يتجدد تلقائياً كل دقيقة</p>
            </div>
            <button onClick={() => void refetchAlerts()} style={{
              padding: '10px 20px', borderRadius: '10px', border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            }}>🔄 تحديث</button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={alertSearch}
              onChange={e => setAlertSearch(e.target.value)}
              placeholder="🔍 ابحث في التنبيهات..."
              style={{
                flex: 1, minWidth: '200px', padding: '10px 16px', borderRadius: '12px',
                border: `1.5px solid ${C.border}`, background: C.card, color: C.text,
                fontSize: '13px', fontFamily: FONT, outline: 'none',
              }}
            />
            {(['all', 'danger', 'warning', 'info', 'success'] as const).map(t => {
              const typeLabels: Record<string, string> = { all: 'الكل', danger: '🚨 حرج', warning: '⚠️ تحذير', info: 'ℹ️ معلومات', success: '✅ إيجابي' };
              const typeColors: Record<string, string> = { all: C.orange, danger: '#EF4444', warning: '#F59E0B', info: '#60A5FA', success: '#34D399' };
              const isActive = alertTypeFilter === t;
              return (
                <button key={t} onClick={() => setAlertTypeFilter(t)} style={{
                  padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                  border: isActive ? 'none' : `1.5px solid ${C.border}`,
                  background: isActive ? typeColors[t] : 'transparent',
                  color: isActive ? '#fff' : C.muted,
                }}>
                  {typeLabels[t]}
                </button>
              );
            })}
          </div>

          {/* Summary Cards */}
          {alertsData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'حرجة', count: alertsData.summary.critical, color: '#EF4444', icon: '🚨' },
                { label: 'تحذيرات', count: alertsData.summary.warnings, color: '#F59E0B', icon: '⚠️' },
                { label: 'معلومات', count: alertsData.summary.info, color: '#60A5FA', icon: 'ℹ️' },
                { label: 'إيجابية', count: alertsData.summary.successes, color: '#34D399', icon: '✅' },
              ].map(s => (
                <div key={s.label} style={{
                  background: C.card, borderRadius: '14px', border: `1px solid ${s.color}33`,
                  padding: '16px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '24px' }}>{s.icon}</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Alerts List */}
          {alertsLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ جارٍ التحميل...</div>
          ) : (() => {
            const filtered = (alertsData?.alerts ?? []).filter(a =>
              (alertTypeFilter === 'all' || a.type === alertTypeFilter) &&
              (!alertSearch || `${a.title} ${a.body} ${a.company_name ?? ''}`.toLowerCase().includes(alertSearch.toLowerCase()))
            );
            if (filtered.length === 0 && alertsData) return (
              <div style={{ textAlign: 'center', padding: '60px', background: C.card, borderRadius: '18px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>
                  {alertSearch || alertTypeFilter !== 'all' ? 'لا توجد نتائج' : 'لا توجد تنبيهات'}
                </div>
                <div style={{ fontSize: '13px', color: C.muted, marginTop: '8px' }}>
                  {alertSearch || alertTypeFilter !== 'all' ? 'جرب تغيير الفلتر أو مسح البحث' : 'كل شيء يسير بشكل طبيعي'}
                </div>
              </div>
            );
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filtered.map((alert, i) => {
                  const colors: Record<string, { bg: string; border: string; badge: string }> = {
                    danger:  { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.25)',   badge: '#EF4444' },
                    warning: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.25)',  badge: '#F59E0B' },
                    success: { bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.25)',  badge: '#34D399' },
                    info:    { bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.25)',  badge: '#60A5FA' },
                  };
                  const col = colors[alert.type] ?? colors.info;
                  return (
                    <div key={i} style={{ background: col.bg, borderRadius: '14px', border: `1px solid ${col.border}`, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.badge, flexShrink: 0, marginTop: '6px' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: C.text, marginBottom: '4px' }}>{alert.title}</div>
                        <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>{alert.body}</div>
                        {alert.company_name && (
                          <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px', opacity: 0.7 }}>🏢 {alert.company_name}</div>
                        )}
                      </div>
                      {alert.company_id && (
                        <button
                          onClick={() => { setActiveTab('companies'); setSnapshotCompany(alert.company_id!); }}
                          style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '8px', border: `1px solid ${col.border}`, background: 'transparent', color: col.badge, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                        >عرض</button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TAB: AUDIT LOG  📋
          ═══════════════════════════════════════════════ */}
      {activeTab === 'audit_log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header + controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>📋 سجل التدقيق الجنائي</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>كل إجراء قام به المدير العام مُسجَّل هنا</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (!auditData?.rows.length) return;
                  const rows = auditData.rows.map(r =>
                    `${r.action},${r.record_type},${r.record_id},${r.note ?? ''},${r.created_at}`
                  ).join('\n');
                  const blob = new Blob([`الإجراء,نوع السجل,رقم السجل,الملاحظة,التاريخ\n${rows}`], { type: 'text/csv' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit-log.csv'; a.click();
                }}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#86EFAC', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >📥 CSV</button>
              <select
                value={auditAction}
                onChange={e => setAuditAction(e.target.value)}
                style={{
                  padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`,
                  background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer',
                }}
              >
                <option value="">كل الإجراءات</option>
                <option value="SUPER_ADMIN_LIST_VIEW">عرض الشركات</option>
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
              </select>
              <select
                value={auditLimit}
                onChange={e => setAuditLimit(Number(e.target.value))}
                style={{
                  padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`,
                  background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer',
                }}
              >
                {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} سجل</option>)}
              </select>
              <button onClick={() => void refetchAudit()} style={{
                padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.border}`,
                background: 'transparent', color: C.muted, fontSize: '13px',
                fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              }}>🔄 تحديث</button>
            </div>
          </div>

          {/* Table */}
          {auditLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ جارٍ التحميل...</div>
          ) : (
            <div style={{
              background: C.card, borderRadius: '18px',
              border: `1px solid ${C.border}`, overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.03)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: '11px', fontWeight: 800, color: C.muted, gap: '12px',
              }}>
                <span>الإجراء</span><span>النوع</span><span>رقم السجل</span><span>الملاحظة</span><span>التاريخ</span>
              </div>
              {!auditData?.rows.length ? (
                <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>لا توجد سجلات</div>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {auditData!.rows.map(row => {
                    const ACTION_AR: Record<string, { label: string; color: string }> = {
                      create:             { label: 'إنشاء',                color: '#34D399' },
                      update:             { label: 'تعديل',                color: '#60A5FA' },
                      delete:             { label: 'حذف',                  color: '#EF4444' },
                      cancel:             { label: 'إلغاء',                color: '#EF4444' },
                      price_override:     { label: 'تجاوز سعر',           color: '#FBBF24' },
                      lock_period:        { label: 'إغلاق فترة',           color: '#F87171' },
                      unlock_period:      { label: 'فتح فترة',             color: '#34D399' },
                      lock_blocked:       { label: 'محاولة إغلاق مرفوضة', color: '#FB923C' },
                      reversal_created:   { label: 'سند عكسي',             color: '#60A5FA' },
                      correction_created: { label: 'سند تصحيحي',           color: '#A78BFA' },
                      INTEGRITY_REPAIR:        { label: 'إصلاح محاسبي',      color: '#FB7185' },
                      INVENTORY_ADJUSTMENT:    { label: 'تسوية مخزون',       color: '#22D3EE' },
                      INVENTORY_COUNT_APPLIED: { label: 'تطبيق جرد مخزون',  color: '#22D3EE' },
                      INVENTORY_TRANSFER:      { label: 'تحويل مخزون',       color: '#38BDF8' },
                      PERIOD_OVERRIDE:         { label: 'تجاوز إغلاق مالي', color: '#FB923C' },
                      COMPANY_ACTIVATED:    { label: 'تفعيل شركة',        color: '#34D399' },
                      COMPANY_SUSPENDED:    { label: 'إيقاف شركة',        color: '#F59E0B' },
                      COMPANY_EXTENDED:     { label: 'تمديد اشتراك',      color: '#38BDF8' },
                      COMPANY_DELETED:      { label: 'حذف شركة',          color: '#EF4444' },
                      ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: '#A78BFA' },
                      RESTORE_STARTED:      { label: 'بدء استعادة',       color: '#A78BFA' },
                      RESTORE_REJECTED:     { label: 'رفض استعادة',       color: '#EF4444' },
                      RESTORE_FAILED:       { label: 'فشل استعادة',       color: '#EF4444' },
                      RESTORE_COMPLETED:    { label: 'اكتمال استعادة',    color: '#34D399' },
                      SUPER_ADMIN_ACCESS:    { label: 'وصول مدير عام',      color: '#818CF8' },
                      SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
                    };
                    const RECORD_AR: Record<string, string> = {
                      customer: 'عميل', supplier: 'مورد', sale: 'فاتورة بيع',
                      sale_return: 'مرتجع مبيعات', purchase: 'فاتورة شراء',
                      purchase_return: 'مرتجع مشتريات', product: 'منتج',
                      financial_lock: 'قفل مالي', expense: 'مصروف',
                      safe_transfer: 'تحويل خزينة', receipt_voucher: 'سند قبض',
                      payment_voucher: 'سند صرف', deposit_voucher: 'سند إيداع',
                      treasury_voucher: 'سند خزينة', user: 'مستخدم',
                      erp_user: 'حساب مستخدم', account_balances: 'أرصدة الحسابات',
                      customer_balances: 'أرصدة العملاء', employee: 'موظف',
                      company: 'شركة', subscription: 'اشتراك',
                      payroll_period: 'دورة رواتب', salary_advance: 'سلفة راتب',
                      fiscal_year: 'سنة مالية', system: 'النظام',
                      announcement: 'إعلان', warranty: 'ضمان',
                    };
                    const actionMeta = ACTION_AR[row.action] ?? { label: row.action, color: '#94A3B8' };
                    return (
                      <div key={row.id} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
                        padding: '12px 20px', gap: '12px',
                        borderBottom: `1px solid rgba(255,255,255,0.04)`,
                        fontSize: '12px', alignItems: 'center',
                      }}>
                        <span style={{ color: actionMeta.color, fontWeight: 700 }}>{actionMeta.label}</span>
                        <span style={{ color: C.muted }}>{RECORD_AR[row.record_type] ?? row.record_type}</span>
                        <span style={{ color: C.muted, textAlign: 'center' }}>#{row.record_id}</span>
                        <span style={{ color: C.text, fontSize: '11px', lineHeight: 1.4 }}>{row.note ?? '—'}</span>
                        <span style={{ color: C.muted, fontSize: '11px', direction: 'ltr', textAlign: 'right' }}>
                          {new Date(row.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {auditData && (
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, fontSize: '12px', color: C.muted }}>
                  إجمالي السجلات المعروضة: {auditData!.count}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TAB: ANNOUNCEMENTS  📢
          ═══════════════════════════════════════════════ */}
      {activeTab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div>
            <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>📢 إعلانات وإشعارات النظام</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>أرسل إشعارات لشركة محددة أو لجميع العملاء</p>
          </div>

          {/* Create form */}
          <div style={{
            background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '24px',
          }}>
            <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: '15px', color: C.text }}>➕ إشعار جديد</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: C.muted, fontWeight: 700, display: 'block', marginBottom: '6px' }}>نوع الإشعار</label>
                  <select value={annType} onChange={e => setAnnType(e.target.value)} style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                    fontSize: '13px', fontFamily: FONT,
                  }}>
                    <option value="info">ℹ️ معلوماتي</option>
                    <option value="success">✅ إيجابي</option>
                    <option value="warning">⚠️ تحذير</option>
                    <option value="danger">🚨 عاجل</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: C.muted, fontWeight: 700, display: 'block', marginBottom: '6px' }}>الجمهور المستهدف</label>
                  <select value={annTarget} onChange={e => setAnnTarget(e.target.value)} style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                    fontSize: '13px', fontFamily: FONT,
                  }}>
                    <option value="all">🌐 جميع الشركات</option>
                    <option value="specific">🏢 شركة محددة</option>
                  </select>
                </div>
                {annTarget === 'specific' && (
                  <div>
                    <label style={{ fontSize: '12px', color: C.muted, fontWeight: 700, display: 'block', marginBottom: '6px' }}>رقم الشركة (ID)</label>
                    <input
                      type="number"
                      value={annCompanyId}
                      onChange={e => setAnnCompanyId(e.target.value)}
                      placeholder="مثال: 5"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                        border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                        fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '12px', color: C.muted, fontWeight: 700, display: 'block', marginBottom: '6px' }}>عنوان الإشعار *</label>
                <input
                  value={annTitle}
                  onChange={e => setAnnTitle(e.target.value)}
                  placeholder="مثال: صيانة مجدولة يوم الجمعة"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                    fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: C.muted, fontWeight: 700, display: 'block', marginBottom: '6px' }}>نص الرسالة *</label>
                <textarea
                  value={annBody}
                  onChange={e => setAnnBody(e.target.value)}
                  placeholder="اكتب تفاصيل الإشعار هنا..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                    fontSize: '13px', fontFamily: FONT, resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '12px', color: C.muted, fontWeight: 700, display: 'block', marginBottom: '6px' }}>تاريخ انتهاء الإشعار (اختياري)</label>
                  <input
                    type="datetime-local"
                    value={annExpires}
                    onChange={e => setAnnExpires(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                      fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  onClick={() => void saveAnnouncement()}
                  disabled={annSaving}
                  style={{
                    padding: '11px 28px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    border: 'none', color: '#fff', fontSize: '14px',
                    fontWeight: 800, cursor: annSaving ? 'not-allowed' : 'pointer',
                    fontFamily: FONT, whiteSpace: 'nowrap',
                  }}
                >
                  {annSaving ? '...' : '📢 نشر الإشعار'}
                </button>
              </div>
            </div>
          </div>

          {/* Announcements list */}
          <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 800, fontSize: '14px', color: C.text }}>
              📋 الإشعارات المنشورة ({annData?.total ?? 0})
            </div>
            {!annData?.announcements.length ? (
              <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>لا توجد إشعارات بعد</div>
            ) : (
              <div>
                {annData.announcements.map(ann => {
                  const typeColors: Record<string, { color: string; icon: string }> = {
                    info:    { color: '#60A5FA', icon: 'ℹ️' },
                    success: { color: '#34D399', icon: '✅' },
                    warning: { color: '#F59E0B', icon: '⚠️' },
                    danger:  { color: '#EF4444', icon: '🚨' },
                  };
                  const tc = typeColors[ann.type] ?? typeColors.info;
                  return (
                    <div key={ann.id} style={{
                      padding: '16px 20px', borderBottom: `1px solid rgba(255,255,255,0.04)`,
                      display: 'flex', gap: '16px', alignItems: 'flex-start',
                      opacity: ann.is_active ? 1 : 0.5,
                    }}>
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{tc.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: C.text }}>{ann.title}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
                            background: `${tc.color}22`, color: tc.color, fontWeight: 700,
                          }}>{ann.type}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
                            background: ann.is_active ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.15)',
                            color: ann.is_active ? '#34D399' : '#94A3B8', fontWeight: 700,
                          }}>{ann.is_active ? 'نشط' : 'معطّل'}</span>
                          <span style={{ fontSize: '11px', color: C.muted }}>
                            {ann.target === 'all' ? '🌐 للجميع' : `🏢 شركة #${ann.company_id}`}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>{ann.body}</p>
                        <div style={{ fontSize: '11px', color: C.muted }}>
                          {new Date(ann.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                          {ann.expires_at && ` • ينتهي: ${new Date(ann.expires_at).toLocaleDateString('ar-EG')}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => void toggleAnn(ann.id, ann.is_active)}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            border: `1px solid ${C.border}`, background: 'transparent',
                            color: ann.is_active ? '#F59E0B' : '#34D399',
                            fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                          }}
                        >{ann.is_active ? '⏸ إيقاف' : '▶️ تفعيل'}</button>
                        <button
                          onClick={() => void deleteAnn(ann.id)}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.3)', background: 'transparent',
                            color: '#EF4444', fontSize: '11px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: FONT,
                          }}
                        >🗑 حذف</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TAB: SERVER HEALTH  🌡️
          ═══════════════════════════════════════════════ */}
      {activeTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>🌡️ صحة السيرفر والنظام</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
                يتجدد كل 15 ثانية
                {healthUpdated ? ` • آخر تحديث: ${new Date(healthUpdated).toLocaleTimeString('ar-EG')}` : ''}
              </p>
            </div>
            <button onClick={() => void refetchHealth()} style={{
              padding: '10px 20px', borderRadius: '10px', border: `1px solid ${C.border}`,
              background: 'transparent', color: C.muted, fontSize: '13px',
              fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            }}>🔄 تحديث فوري</button>
          </div>

          {healthLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ جارٍ جلب بيانات السيرفر...</div>
          ) : healthData ? (
            <>
              {/* Status Banner */}
              <div style={{
                padding: '20px 24px', borderRadius: '16px',
                background: healthData.health.status === 'healthy'
                  ? 'rgba(52,211,153,0.1)' : healthData.health.status === 'degraded'
                  ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${healthData.health.status === 'healthy' ? 'rgba(52,211,153,0.3)' : healthData.health.status === 'degraded' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <span style={{ fontSize: '36px' }}>
                  {healthData.health.status === 'healthy' ? '✅' : healthData.health.status === 'degraded' ? '⚠️' : '🚨'}
                </span>
                <div>
                  <div style={{
                    fontSize: '20px', fontWeight: 900,
                    color: healthData.health.status === 'healthy' ? '#34D399' : healthData.health.status === 'degraded' ? '#F59E0B' : '#EF4444',
                  }}>
                    {healthData.health.status === 'healthy' ? 'النظام يعمل بشكل مثالي' : healthData.health.status === 'degraded' ? 'أداء منخفض' : 'النظام يواجه مشكلة'}
                  </div>
                  <div style={{ fontSize: '13px', color: C.muted, marginTop: '2px' }}>
                    Node.js {healthData.process.node_version} • PID {healthData.process.pid} • {healthData.process.env}
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'وقت التشغيل', value: `${healthData.process.uptime_hours}h`, icon: '⏱️', color: '#A78BFA' },
                  { label: 'ذاكرة Heap', value: `${healthData.memory.heap_used_mb} MB`, icon: '💾', color: healthData.memory.heap_used_mb > 400 ? '#EF4444' : '#34D399' },
                  { label: 'RSS الكلي', value: `${healthData.memory.rss_mb} MB`, icon: '📊', color: '#60A5FA' },
                  { label: 'قاعدة البيانات', value: healthData.health.db ? '✓ متصل' : '✗ منقطع', icon: '🗄️', color: healthData.health.db ? '#34D399' : '#EF4444' },
                  { label: 'زمن قراءة DB', value: `${healthData.health.db_read_latency_ms}ms`, icon: '📖', color: healthData.health.db_read_latency_ms > 200 ? '#F59E0B' : '#34D399' },
                  { label: 'زمن كتابة DB', value: `${healthData.health.db_write_latency_ms}ms`, icon: '✏️', color: healthData.health.db_write_latency_ms > 500 ? '#F59E0B' : '#34D399' },
                  { label: 'طلبات API', value: healthData.metrics.total_requests.toLocaleString('ar-EG'), icon: '🌐', color: '#FB923C' },
                  { label: 'اتصالات DB', value: `${healthData.pool.total}/${healthData.pool.idle} نشط`, icon: '🔌', color: '#F472B6' },
                ].map(k => (
                  <div key={k.label} style={{
                    background: C.card, borderRadius: '14px', border: `1px solid ${k.color}22`,
                    padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '20px' }}>{k.icon}</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* API Latency */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '14px', color: C.text }}>⚡ زمن استجابة API</h3>
                  {[
                    { label: 'P50 (متوسط)', value: healthData.metrics.latency_ms.p50, good: 200, warn: 500 },
                    { label: 'P95 (95% من الطلبات)', value: healthData.metrics.latency_ms.p95, good: 500, warn: 1000 },
                    { label: 'P99 (أبطأ الطلبات)', value: healthData.metrics.latency_ms.p99, good: 1000, warn: 2000 },
                  ].map(l => {
                    const col = l.value <= l.good ? '#34D399' : l.value <= l.warn ? '#F59E0B' : '#EF4444';
                    return (
                      <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: C.muted }}>{l.label}</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: col, fontFamily: 'monospace' }}>{l.value}ms</span>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: '11px', color: C.muted, marginTop: '8px' }}>
                    إجمالي العينات: {healthData.metrics.latency_ms.samples.toLocaleString('ar-EG')}
                  </div>
                </div>

                {/* Status codes */}
                <div style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '14px', color: C.text }}>📊 رموز الاستجابة</h3>
                  {Object.entries(healthData.metrics.status_codes)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([code, count]) => {
                      const col = code.startsWith('2') ? '#34D399' : code.startsWith('4') ? '#F59E0B' : code.startsWith('5') ? '#EF4444' : '#94A3B8';
                      const total = Object.values(healthData.metrics.status_codes).reduce((s, v) => s + v, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={code} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: col, fontWeight: 700, fontFamily: 'monospace' }}>{code}</span>
                            <span style={{ fontSize: '12px', color: C.muted }}>{count.toLocaleString('ar-EG')} ({pct}%)</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)' }}>
                            <div style={{ height: '100%', borderRadius: '3px', background: col, width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  {!Object.keys(healthData.metrics.status_codes).length && (
                    <div style={{ color: C.muted, fontSize: '13px' }}>لا توجد بيانات بعد</div>
                  )}
                </div>
              </div>

              {/* DB Pool */}
              <div style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '14px', color: C.text }}>🔌 اتصالات قاعدة البيانات (Connection Pool)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {[
                    { label: 'إجمالي الاتصالات', value: healthData.pool.total, color: '#60A5FA', max: 50 },
                    { label: 'اتصالات خاملة', value: healthData.pool.idle, color: '#34D399', max: healthData.pool.total || 1 },
                    { label: 'طلبات في الانتظار', value: healthData.pool.waiting, color: healthData.pool.waiting > 5 ? '#EF4444' : '#94A3B8', max: 20 },
                  ].map(p => (
                    <div key={p.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: C.muted }}>{p.label}</span>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: p.color }}>{p.value}</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{ height: '100%', borderRadius: '4px', background: p.color, width: `${Math.min((p.value / p.max) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Redis Health Card ─────────────────────────────────────── */}
              {(() => {
                const ok      = redisHealth?.status === 'ok';
                const color   = redisHealth ? (ok ? '#34D399' : '#EF4444') : '#94A3B8';
                const bgColor = redisHealth ? (ok ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)') : 'rgba(148,163,184,0.06)';
                const label   = !redisHealth ? '⚠️ غير متاح حالياً' : ok ? '🟢 يعمل' : '🔴 متوقف';
                return (
                  <div style={{
                    background: bgColor,
                    borderRadius: '16px',
                    border: `1px solid ${color}33`,
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span style={{ fontSize: '28px' }}>🗄️</span>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: C.text, marginBottom: '2px' }}>حالة Redis</div>
                        <div style={{ fontSize: '13px', color: C.muted }}>يتجدد كل 10 ثوانٍ</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>الحالة</div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color }}>
                          {label}
                        </div>
                      </div>
                      {redisHealth?.status === 'ok' && redisHealth.latency_ms !== undefined && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>الاستجابة</div>
                          <div style={{
                            fontSize: '18px', fontWeight: 900, fontFamily: 'monospace',
                            color: redisHealth.latency_ms > 50 ? '#F59E0B' : '#34D399',
                          }}>
                            {redisHealth.latency_ms}ms
                          </div>
                        </div>
                      )}
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                        flexShrink: 0,
                      }} />
                    </div>
                  </div>
                );
              })()}
            </>
          ) : null}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PLAN SETTINGS TAB
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 900, color: C.text, margin: 0 }}>
                💰 إدارة الخطط والأسعار
              </h1>
              <p style={{ fontSize: '13px', color: C.muted, margin: '4px 0 0' }}>
                تعديل أسعار اشتراكات خطط النظام — تُحسب الإيرادات بناءً على هذه الأسعار
              </p>
            </div>
          </div>

          {planSettingsLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>جارٍ التحميل…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              {(planSettings ?? []).map(plan => {
                const isEditing = editingPlan?.key === plan.key;
                const ep = isEditing ? editingPlan! : plan;
                return (
                  <div key={plan.key} style={{
                    background: C.card, borderRadius: '16px', border: `1.5px solid ${isEditing ? C.orange : C.border}`,
                    padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
                    boxShadow: isEditing ? `0 4px 24px rgba(249,115,22,0.15)` : 'none',
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                        background: ep.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: ep.is_active ? '#22c55e' : '#ef4444',
                      }}>{ep.is_active ? 'فعّالة' : 'معطّلة'}</span>
                      <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{plan.key}</span>
                    </div>

                    {isEditing ? (
                      <>
                        <div>
                          <label style={{ fontSize: '11px', color: C.muted, display: 'block', marginBottom: '4px' }}>اسم الخطة (عربي)</label>
                          <input
                            value={ep.name_ar}
                            onChange={e => setEditingPlan({ ...ep, name_ar: e.target.value })}
                            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
                              padding: '8px 12px', color: C.text, fontSize: '14px', fontFamily: FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: C.muted, display: 'block', marginBottom: '4px' }}>الوصف</label>
                          <input
                            value={ep.description ?? ''}
                            onChange={e => setEditingPlan({ ...ep, description: e.target.value })}
                            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
                              padding: '8px 12px', color: C.text, fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: C.muted, display: 'block', marginBottom: '4px' }}>السعر الشهري (ج.م.)</label>
                          <input
                            type="number" min={0}
                            value={ep.price}
                            onChange={e => setEditingPlan({ ...ep, price: Number(e.target.value) })}
                            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
                              padding: '8px 12px', color: C.orange, fontSize: '18px', fontWeight: 800, fontFamily: FONT, boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input type="checkbox" id={`mobile-${plan.key}`}
                            checked={ep.includes_mobile}
                            onChange={e => setEditingPlan({ ...ep, includes_mobile: e.target.checked })}
                          />
                          <label htmlFor={`mobile-${plan.key}`} style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}>
                            تشمل تطبيق الموبايل
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input type="checkbox" id={`active-${plan.key}`}
                            checked={ep.is_active}
                            onChange={e => setEditingPlan({ ...ep, is_active: e.target.checked })}
                          />
                          <label htmlFor={`active-${plan.key}`} style={{ fontSize: '13px', color: C.text, cursor: 'pointer' }}>
                            الخطة فعّالة
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                          <button
                            onClick={() => savePlan(ep)}
                            disabled={planSaving}
                            style={{ flex: 1, background: C.orange, color: '#fff', border: 'none', borderRadius: '10px',
                              padding: '10px', fontWeight: 800, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}
                          >{planSaving ? 'جارٍ الحفظ…' : '💾 حفظ'}</button>
                          <button
                            onClick={() => setEditingPlan(null)}
                            style={{ flex: 1, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`,
                              borderRadius: '10px', padding: '10px', fontWeight: 700, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}
                          >إلغاء</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: 900, color: C.text }}>{plan.name_ar}</div>
                          {plan.description && (
                            <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>{plan.description}</div>
                          )}
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: 900, color: C.orange }}>
                          {plan.price.toLocaleString('ar-EG')}
                          <span style={{ fontSize: '14px', color: C.muted, fontWeight: 600, marginRight: '4px' }}>ج.م./شهر</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {plan.includes_mobile && (
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                              background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>📱 يشمل الموبايل</span>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingPlan({ ...plan })}
                          style={{ background: 'transparent', border: `1.5px solid ${C.orange}`, color: C.orange,
                            borderRadius: '10px', padding: '8px', fontWeight: 700, fontSize: '13px', fontFamily: FONT,
                            cursor: 'pointer', marginTop: '4px' }}
                        >✏️ تعديل السعر</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '32px', padding: '16px 20px', borderRadius: '12px',
            background: 'rgba(249,115,22,0.06)', border: `1px solid rgba(249,115,22,0.2)` }}>
            <p style={{ margin: 0, fontSize: '12px', color: C.muted, lineHeight: 1.6 }}>
              ⚠️ تغيير الأسعار يؤثر فقط على حسابات الإيرادات والتقارير. لا يتم تحديث الرسوم تلقائياً للعملاء الحاليين.
              تحقق دائماً من إعدادات بوابة الدفع عند تغيير أي سعر.
            </p>
          </div>
        </div>
      )}


      {/* ══════════════════════════════
          TAB: MONITORING  🛡️
          ══════════════════════════════ */}
      {activeTab === 'monitoring' && (() => {
        /* ── Status config ── */
        const MON_ST: Record<string, { label: string; color: string; bg: string; border: string; icon: string; glow: string; grad: string }> = {
          normal:  { label: 'طبيعي',        color: '#34D399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.3)',  icon: '✅', glow: 'rgba(52,211,153,0.2)',  grad: 'linear-gradient(135deg,rgba(52,211,153,0.12),rgba(16,185,129,0.04))' },
          warning: { label: 'تحذير',         color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.35)', icon: '⚠️', glow: 'rgba(245,158,11,0.2)',  grad: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,88,12,0.04))' },
          paused:  { label: 'متوقف مؤقتاً', color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.35)',  icon: '🚫', glow: 'rgba(239,68,68,0.2)',   grad: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.04))' },
        };
        const st = MON_ST[monData?.status ?? 'normal'] ?? MON_ST['normal'];

        /* ── Quick-nav scroll ── */
        const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        /* ── Helpers ── */
        const Pill = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 11px', borderRadius: '30px', fontSize: '11px', fontWeight: 700, color, background: bg, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{label}</span>
        );

        const SectionCard = ({ id, children, accentColor }: { id: string; children: React.ReactNode; accentColor?: string }) => (
          <div id={id} style={{ background: C.card, border: `1px solid ${accentColor ? accentColor + '22' : C.border}`, borderRadius: '16px', overflow: 'hidden', position: 'relative', borderTop: accentColor ? `3px solid ${accentColor}` : undefined }}>
            {children}
          </div>
        );

        const SectionHead = ({ icon, title, sub, extra }: { icon: string; title: string; sub?: string; extra?: React.ReactNode }) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{icon}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{title}</div>
                {sub && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{sub}</div>}
              </div>
            </div>
            {extra}
          </div>
        );

        const inputSt: React.CSSProperties = {
          width: '100%', padding: '12px 16px', borderRadius: '14px',
          border: `1.5px solid ${C.border}`, background: 'rgba(255,255,255,0.04)',
          color: C.text, fontFamily: 'monospace', fontSize: '13px',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
        };

        /* ── Unblock actions ── */
        const doLookup = async () => {
          if (!unblockIP.trim() && !unblockEmail.trim()) return;
          setUnblockLoading(true); setUnblockResult(null); setUnblockMsg(null);
          try {
            const p = new URLSearchParams();
            if (unblockIP.trim()) p.set('ip', unblockIP.trim());
            if (unblockEmail.trim()) p.set('email', unblockEmail.trim());
            const r = await authFetch(`/api/super/trial-abuse/lookup?${p}`);
            setUnblockResult(await r.json());
          } catch { setUnblockMsg({ ok: false, text: 'فشل الفحص — تحقق من الاتصال' }); }
          finally { setUnblockLoading(false); }
        };

        const doUnblockAll = async () => {
          if (!unblockIP.trim() && !unblockEmail.trim()) return;
          if (!window.confirm(`رفع جميع الحجوبات عن:\nIP: ${unblockIP || 'غير محدد'}\nEmail: ${unblockEmail || 'غير محدد'}\n\nهل أنت متأكد؟`)) return;
          setUnblockLoading(true); setUnblockMsg(null);
          try {
            const dbRes = await authFetch('/api/super/trial-abuse/bulk-override', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ip: unblockIP.trim() || undefined, email: unblockEmail.trim() || undefined, reason: 'رفع يدوي من السوبر أدمن' }),
            });
            const dbData = await dbRes.json();
            let redisPart = '';
            if (unblockIP.trim()) {
              try {
                await authFetch('/api/super/trial-monitoring/unblock-ip', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ip: unblockIP.trim() }),
                });
                redisPart = ' + Redis ✓';
              } catch { redisPart = ' (Redis غير متاح)'; }
            }
            const p = new URLSearchParams();
            if (unblockIP.trim()) p.set('ip', unblockIP.trim());
            if (unblockEmail.trim()) p.set('email', unblockEmail.trim());
            setUnblockResult(await (await authFetch(`/api/super/trial-abuse/lookup?${p}`)).json());
            setUnblockMsg({ ok: true, text: `✅ تم رفع ${dbData.overridden_count ?? 0} حجب من قاعدة البيانات${redisPart} — العميل يستطيع التسجيل الآن` });
            void refetchMon();
          } catch { setUnblockMsg({ ok: false, text: 'فشل رفع الحجب — تحقق من اللوجز' }); }
          finally { setUnblockLoading(false); }
        };

        /* ── Bar util for IP/FP ── */
        const maxCount = Math.max(...(monData?.top_ips ?? []).map(e => e.count), 1);
        const maxFPCount = Math.max(...(monData?.top_fingerprints ?? []).map(e => e.count), 1);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* ════════════ ANIMATIONS ════════════ */}
            <style>{`
              @keyframes mon-fade-up   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
              @keyframes mon-pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
              @keyframes mon-spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
              @keyframes mon-glow-beat { 0%,100%{box-shadow:0 0 18px var(--glow)} 50%{box-shadow:0 0 36px var(--glow)} }
              @keyframes mon-bar-in    { from{width:0} to{width:var(--w)} }

              .mon-nav-card { cursor:pointer; transition:all 0.2s; border-top:3px solid transparent; }
              .mon-nav-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.3) !important; }
              .mon-nav-card:active { transform:translateY(-1px); }

              .mon-sec { animation:mon-fade-up 0.45s ease both; }
              .mon-sec:nth-child(2) { animation-delay:0.05s }
              .mon-sec:nth-child(3) { animation-delay:0.10s }
              .mon-sec:nth-child(4) { animation-delay:0.15s }
              .mon-sec:nth-child(5) { animation-delay:0.20s }
              .mon-sec:nth-child(6) { animation-delay:0.25s }
              .mon-sec:nth-child(7) { animation-delay:0.30s }

              .mon-btn { transition:all 0.18s; }
              .mon-btn:hover { filter:brightness(1.12); transform:translateY(-1px); }
              .mon-btn:active { transform:translateY(0); }
              .mon-input:focus { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.14) !important; }
              .mon-row:hover { background:rgba(255,255,255,0.035) !important; }
              .mon-bar { animation:mon-bar-in 0.7s cubic-bezier(.34,1.56,.64,1) both; }
              .mon-stat:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.28) !important; }
            `}</style>

            {/* ════════════ HEADER — matches other tabs ════════════ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>🛡️ مراقبة التسجيلات التجريبية</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>تحكم شامل في حماية التسجيلات — يتجدد كل 30 ثانية تلقائياً</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {monData && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px',
                    background: monData.redis_ok ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${monData.redis_ok ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    fontSize: '12px', fontWeight: 700,
                    color: monData.redis_ok ? '#34D399' : '#F59E0B',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: monData.redis_ok ? '#34D399' : '#F59E0B', display: 'inline-block', animation: 'mon-pulse-dot 2s infinite' }} />
                    {monData.redis_ok ? 'Redis متصل' : 'Redis غير متصل'}
                  </div>
                )}
                <button onClick={() => void refetchMon()} className="mon-btn"
                  style={{ padding: '8px 18px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'rgba(34,197,94,0.1)', color: '#86EFAC', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  🔄 تحديث
                </button>
              </div>
            </div>

            {/* ════════════ QUICK NAV — compact strip ════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px' }}>
              {[
                { id: 'mon-status',   icon: '🟢', label: 'حالة النظام',   color: st.color },
                { id: 'mon-stats',    icon: '📊', label: 'الإحصائيات',    color: '#60A5FA' },
                { id: 'mon-unblock',  icon: '🔓', label: 'رفع الحجب',     color: '#10B981' },
                { id: 'mon-ips',      icon: '🌐', label: 'أعلى IPs',      color: '#A78BFA' },
                { id: 'mon-suspects', icon: '🚨', label: 'المشبوهون',     color: '#EF4444' },
                { id: 'mon-blocks',   icon: '🔒', label: 'آخر الحجوبات', color: '#F59E0B' },
              ].map(n => (
                <div key={n.id} className="mon-nav-card" onClick={() => scrollTo(n.id)}
                  style={{
                    padding: '12px 10px', borderRadius: '14px', textAlign: 'center',
                    background: C.card, border: `1px solid ${C.border}`,
                    borderTop: `3px solid ${n.color}`,
                  }}>
                  <div style={{ fontSize: '18px', marginBottom: '5px' }}>{n.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: n.color }}>{n.label}</div>
                </div>
              ))}
            </div>

            {/* ════════════ LOADING ════════════ */}
            {monLoading && (
              <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', margin: '0 auto 16px', animation: 'mon-spin 0.8s linear infinite' }} />
                <div style={{ fontWeight: 700 }}>جارٍ تحميل بيانات المراقبة...</div>
              </div>
            )}

            {/* ════════════ ERROR ════════════ */}
            {monError && !monLoading && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: '16px', padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔴</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#EF4444', marginBottom: '8px' }}>تعذّر تحميل بيانات المراقبة</div>
                <div style={{ fontSize: '13px', color: C.muted, marginBottom: '20px' }}>تحقق من اتصال السيرفر وأعد المحاولة</div>
                <button onClick={() => void refetchMon()} className="mon-btn"
                  style={{ padding: '10px 24px', borderRadius: '10px', border: `1px solid rgba(239,68,68,0.3)`, background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: '13px' }}>
                  🔄 إعادة المحاولة
                </button>
              </div>
            )}

            {monData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* ════════════ REDIS WARNING ════════════ */}
                {!monData.redis_ok && (
                  <div className="mon-sec" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(234,88,12,0.06))', border: '1.5px solid rgba(245,158,11,0.35)', borderRadius: '18px', padding: '18px 24px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>⚠️</div>
                    <div>
                      <div style={{ fontWeight: 900, color: '#F59E0B', fontSize: '14px', marginBottom: '4px' }}>Redis غير متاح — المراقبة المتقدمة معطلة جزئياً</div>
                      <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.7 }}>
                        التسجيل يعمل عادياً. لتفعيل المراقبة الكاملة: <code style={{ background: 'rgba(0,0,0,0.3)', color: '#86EFAC', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px' }}>REDIS_URL=redis://127.0.0.1:6379</code>
                      </div>
                    </div>
                  </div>
                )}

                {/* ════════════ §1 STATUS HERO ════════════ */}
                <div id="mon-status" className="mon-sec" style={{
                  background: C.card,
                  border: `1px solid ${st.border}`,
                  borderTop: `3px solid ${st.color}`,
                  borderRadius: '16px',
                  padding: '24px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: st.grad, pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                      <div style={{
                        width: '64px', height: '64px', borderRadius: '16px',
                        background: st.bg, border: `1px solid ${st.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px',
                        animation: 'mon-glow-beat 3s ease infinite',
                        '--glow': st.glow,
                      } as React.CSSProperties}>
                        {st.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: C.muted, marginBottom: '4px' }}>حالة نظام الحماية</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: st.color, lineHeight: 1 }}>{st.label}</div>
                        {monData.pause_reason && <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>📝 {monData.pause_reason}</div>}
                        {monData.pause_until && (
                          <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '4px', fontWeight: 700 }}>
                            ⏱️ متوقف حتى: {new Date(monData.pause_until).toLocaleString('ar-EG')}
                            {monData.pause_remaining_seconds > 0 && ` — ${Math.ceil(monData.pause_remaining_seconds / 60)} دقيقة متبقية`}
                          </div>
                        )}
                        {monData.warning_fired_at && monData.status === 'warning' && (
                          <div style={{ fontSize: '12px', color: '#F59E0B', marginTop: '4px', fontWeight: 700 }}>⚡ تحذير نشط منذ: {new Date(monData.warning_fired_at).toLocaleString('ar-EG')}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {monData.status === 'warning' && (
                        <button className="mon-btn" onClick={async () => { await authFetch('/api/super/trial-monitoring/clear-warning', { method: 'POST' }); void refetchMon(); }}
                          style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: '13px' }}>
                          🧹 مسح التحذير
                        </button>
                      )}
                      {monData.status !== 'paused' ? (
                        <button className="mon-btn" onClick={async () => {
                          const mins = prompt('مدة الإيقاف بالدقائق (1-1440):');
                          if (!mins || isNaN(Number(mins))) return;
                          const reason = prompt('سبب الإيقاف:') || 'إيقاف يدوي من المشرف';
                          await authFetch('/api/super/trial-monitoring/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: Number(mins), reason }) });
                          void refetchMon();
                        }}
                          style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: '13px' }}>
                          ⏸️ إيقاف مؤقت
                        </button>
                      ) : (
                        <button className="mon-btn" onClick={async () => { await authFetch('/api/super/trial-monitoring/resume', { method: 'POST' }); void refetchMon(); }}
                          style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.12)', color: '#34D399', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: '13px' }}>
                          ▶️ استئناف التسجيلات
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ════════════ §2 STATS GRID ════════════ */}
                <div id="mon-stats" className="mon-sec" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '16px' }}>
                  {(() => {
                    const reg = monData.registrations_in_window;
                    const regColor = reg >= monData.block_threshold ? '#EF4444' : reg >= monData.alert_threshold ? '#F59E0B' : '#34D399';
                    const regGlow  = reg >= monData.block_threshold ? 'rgba(239,68,68,0.2)' : reg >= monData.alert_threshold ? 'rgba(245,158,11,0.2)' : 'rgba(52,211,153,0.2)';
                    const pct = Math.min(100, Math.round((reg / monData.block_threshold) * 100));
                    return [
                      { icon: '📈', label: 'تسجيلات في النافذة', value: reg, sub: `آخر 15 دقيقة`, color: regColor, glow: regGlow, bar: pct, barMax: 100, barColor: regColor },
                      { icon: '⚠️', label: 'حد التحذير',         value: monData.alert_threshold, sub: 'تسجيل / نافذة', color: '#F59E0B', glow: 'rgba(245,158,11,0.15)', bar: null, barMax: 0, barColor: '' },
                      { icon: '🚫', label: 'حد الإيقاف',        value: monData.block_threshold,  sub: 'تسجيل / نافذة', color: '#EF4444', glow: 'rgba(239,68,68,0.15)',  bar: null, barMax: 0, barColor: '' },
                      { icon: '⏱️', label: 'وقت الإيقاف',       value: monData.pause_remaining_seconds > 0 ? `${Math.ceil(monData.pause_remaining_seconds / 60)} د` : '—', sub: 'متبقي', color: monData.pause_remaining_seconds > 0 ? '#EF4444' : C.muted, glow: 'rgba(99,102,241,0.15)', bar: null, barMax: 0, barColor: '' },
                    ];
                  })().map(m => (
                    <div key={m.label} className="mon-stat" style={{
                      background: C.card,
                      borderRadius: '16px',
                      border: `1px solid ${m.color}22`,
                      borderTop: `3px solid ${m.color}`,
                      padding: '20px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      cursor: 'default', transition: 'all 0.2s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '22px' }}>{m.icon}</span>
                        <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>{m.sub}</span>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: '11px', color: C.muted }}>{m.label}</div>
                      {m.bar !== null && (
                        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '4px' }}>
                          <div className="mon-bar" style={{ height: '100%', borderRadius: '2px', background: m.barColor, '--w': `${m.bar}%`, width: `${m.bar}%` } as React.CSSProperties} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* ════════════ §3 UNBLOCK TOOL ════════════ */}
                <SectionCard id="mon-unblock" accentColor="#10B981">
                  <div className="mon-sec">
                    <SectionHead icon="🔓" title="أداة رفع الحجب الشاملة" sub="رفع فوري من قاعدة البيانات + Redis في خطوة واحدة" extra={
                      <Pill label="DB + Redis" color="#10B981" bg="rgba(16,185,129,0.12)" />
                    } />
                    <div style={{ padding: '20px 24px' }}>
                      {/* Steps */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        {[{ n: '1', t: 'أدخل IP أو البريد' }, { n: '2', t: 'اضغط فحص' }, { n: '3', t: 'ارفع الحجب' }].map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', border: '1.5px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, color: '#10B981' }}>{s.n}</div>
                            <span style={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>{s.t}</span>
                            {i < 2 && <span style={{ color: C.muted, fontSize: '12px', margin: '0 2px' }}>←</span>}
                          </div>
                        ))}
                      </div>

                      {/* Inputs + quick check */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end', marginBottom: '14px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: C.muted, fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🌐 عنوان IP</div>
                          <input value={unblockIP} onChange={e => setUnblockIP(e.target.value)} onKeyDown={e => e.key === 'Enter' && void doLookup()}
                            placeholder="41.234.56.78" dir="ltr" className="mon-input" style={inputSt} />
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: C.muted, fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✉️ البريد الإلكتروني</div>
                          <input value={unblockEmail} onChange={e => setUnblockEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && void doLookup()}
                            placeholder="customer@email.com" dir="ltr" className="mon-input" style={inputSt} />
                        </div>
                        <button className="mon-btn" disabled={unblockLoading || (!unblockIP.trim() && !unblockEmail.trim())}
                          onClick={() => void doLookup()}
                          style={{ padding: '12px 22px', borderRadius: '14px', border: '1.5px solid rgba(6,182,212,0.45)', background: 'rgba(6,182,212,0.12)', color: '#06B6D4', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap', opacity: (!unblockIP.trim() && !unblockEmail.trim()) ? 0.4 : 1 }}>
                          🔍 فحص
                        </button>
                      </div>

                      {/* Main unblock button */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <button className="mon-btn" disabled={unblockLoading || (!unblockIP.trim() && !unblockEmail.trim())}
                          onClick={() => void doUnblockAll()}
                          style={{
                            flex: 1, minWidth: '220px', padding: '14px 28px', borderRadius: '16px',
                            background: unblockLoading ? 'rgba(16,185,129,0.1)' : 'linear-gradient(135deg,#10B981,#06B6D4)',
                            border: 'none', color: '#fff', cursor: unblockLoading ? 'not-allowed' : 'pointer',
                            fontFamily: FONT, fontWeight: 900, fontSize: '15px',
                            opacity: (!unblockIP.trim() && !unblockEmail.trim()) ? 0.4 : 1,
                            boxShadow: (!unblockIP.trim() && !unblockEmail.trim()) ? 'none' : '0 6px 24px rgba(16,185,129,0.35)',
                          }}>
                          {unblockLoading ? '⏳ جارٍ رفع الحجب...' : '🔓 رفع جميع الحجوبات (DB + Redis)'}
                        </button>
                        <button className="mon-btn" onClick={() => { setUnblockIP(''); setUnblockEmail(''); setUnblockResult(null); setUnblockMsg(null); }}
                          style={{ padding: '14px 20px', borderRadius: '16px', border: `1.5px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: '14px' }}>
                          🗑️ مسح
                        </button>
                      </div>

                      {/* Feedback */}
                      {unblockMsg && (
                        <div style={{
                          padding: '16px 20px', borderRadius: '16px', marginBottom: '16px',
                          background: unblockMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                          border: `1.5px solid ${unblockMsg.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                          color: unblockMsg.ok ? '#10B981' : '#EF4444', fontSize: '14px', fontWeight: 800,
                        }}>
                          {unblockMsg.text}
                        </div>
                      )}

                      {/* Lookup Result */}
                      {unblockResult && (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '12px', marginBottom: '16px' }}>
                            {[
                              { label: 'حجوبات نشطة',  value: unblockResult.active_blocks ?? 0,            color: (unblockResult.active_blocks ?? 0) > 0 ? '#EF4444' : '#34D399', bg: (unblockResult.active_blocks ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)', border: (unblockResult.active_blocks ?? 0) > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)' },
                              { label: 'تم رفع حجبها',  value: unblockResult.overridden_blocks ?? 0,        color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)' },
                              { label: 'إجمالي السجلات', value: (unblockResult.rows ?? []).length,           color: C.text,    bg: 'rgba(255,255,255,0.04)', border: C.border },
                            ].map(s => (
                              <div key={s.label} style={{ padding: '16px', borderRadius: '16px', background: s.bg, border: `1.5px solid ${s.border}`, textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: C.muted, fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                                <div style={{ fontSize: '32px', fontWeight: 900, color: s.color }}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                          {(unblockResult.active_blocks ?? 0) === 0 && (unblockResult.rows ?? []).length === 0 && (
                            <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)', color: '#F59E0B', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
                              ⚠️ لا توجد سجلات في قاعدة البيانات — تحقق من Redis أو IP مختلف
                            </div>
                          )}
                          {(unblockResult.rows ?? []).length > 0 && (
                            <div style={{ overflowX: 'auto', borderRadius: '14px', border: `1px solid ${C.border}` }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                  {['البريد', 'IP', 'البصمة', 'الحالة', 'التاريخ'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', color: C.muted, fontWeight: 700, borderBottom: `1px solid ${C.border}`, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {(unblockResult.rows ?? []).map(r => (
                                    <tr key={r.id} className="mon-row" style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}>
                                      <td style={{ padding: '10px 14px', color: C.text, fontFamily: 'monospace' }}>{r.email}</td>
                                      <td style={{ padding: '10px 14px', color: C.muted, fontFamily: 'monospace' }}>{r.ip}</td>
                                      <td style={{ padding: '10px 14px', color: C.muted, fontFamily: 'monospace', fontSize: '11px' }}>{r.fingerprint ? r.fingerprint.slice(0, 10) + '…' : '—'}</td>
                                      <td style={{ padding: '10px 14px' }}>
                                        {r.override_reason
                                          ? <Pill label="✓ مرفوع" color="#34D399" bg="rgba(52,211,153,0.1)" />
                                          : <Pill label="🚫 محجوب" color="#EF4444" bg="rgba(239,68,68,0.1)" />}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: C.muted, fontSize: '11px' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* ════════════ §4 TOP IPs + FPs ════════════ */}
                <div id="mon-ips" className="mon-sec" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                  {/* Top IPs */}
                  <SectionCard id="mon-ips-inner2" accentColor="#6366f1">
                    <SectionHead icon="🌐" title="أعلى عناوين IP" sub={`${(monData.top_ips ?? []).length} عنوان مشبوه`} />
                    <div style={{ padding: '20px 24px' }}>
                      {(monData.top_ips ?? []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted, fontSize: '13px' }}>
                          {monData.redis_ok ? '✅ لا توجد بيانات في النافذة الحالية' : '⚠️ Redis غير متاح'}
                        </div>
                      ) : (monData.top_ips ?? []).map((e, i) => {
                        const pct = Math.round((e.count / maxCount) * 100);
                        const danger = e.count >= 5;
                        return (
                          <div key={e.ip} style={{ marginBottom: i < (monData.top_ips ?? []).length - 1 ? '14px' : '0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: C.muted, minWidth: '16px', textAlign: 'center' }}>#{i + 1}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: C.text }}>{e.ip}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 900, color: danger ? '#EF4444' : '#F59E0B' }}>{e.count}</span>
                                <button className="mon-btn" onClick={() => { setUnblockIP(e.ip); setUnblockResult(null); setUnblockMsg(null); scrollTo('mon-unblock'); }}
                                  style={{ padding: '4px 12px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10B981', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: FONT }}>
                                  رفع
                                </button>
                              </div>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div className="mon-bar" style={{ height: '100%', borderRadius: '3px', background: danger ? 'linear-gradient(90deg,#EF4444,#F97316)' : 'linear-gradient(90deg,#F59E0B,#FBBF24)', '--w': `${pct}%`, width: `${pct}%`, animationDelay: `${i * 0.07}s` } as React.CSSProperties} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>

                  {/* Top Fingerprints */}
                  <SectionCard id="mon-fps-inner2" accentColor="#8B5CF6">
                    <SectionHead icon="🖥️" title="أعلى بصمات الأجهزة" sub={`${(monData.top_fingerprints ?? []).length} جهاز مشبوه`} />
                    <div style={{ padding: '20px 24px' }}>
                      {(monData.top_fingerprints ?? []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted, fontSize: '13px' }}>
                          {monData.redis_ok ? '✅ لا توجد بيانات في النافذة الحالية' : '⚠️ Redis غير متاح'}
                        </div>
                      ) : (monData.top_fingerprints ?? []).map((e, i) => {
                        const pct = Math.round((e.count / maxFPCount) * 100);
                        const danger = e.count >= 3;
                        return (
                          <div key={e.fingerprint} style={{ marginBottom: i < (monData.top_fingerprints ?? []).length - 1 ? '14px' : '0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: C.muted, minWidth: '16px', textAlign: 'center' }}>#{i + 1}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: C.muted }}>{e.fingerprint.slice(0, 18)}…</span>
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 900, color: danger ? '#EF4444' : '#F59E0B' }}>{e.count}</span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div className="mon-bar" style={{ height: '100%', borderRadius: '3px', background: danger ? 'linear-gradient(90deg,#8B5CF6,#EF4444)' : 'linear-gradient(90deg,#8B5CF6,#A78BFA)', '--w': `${pct}%`, width: `${pct}%`, animationDelay: `${i * 0.07}s` } as React.CSSProperties} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                </div>

                {/* ════════════ §5 SUSPICIOUS COMPANIES ════════════ */}
                <div id="mon-suspects" className="mon-sec">
                  <SectionCard id="mon-suspects-inner2" accentColor="#EF4444">
                    <SectionHead icon="🚨" title="الحسابات المشبوهة" sub={`${(monData.suspicious_companies ?? []).length} حساب يستحق المراجعة`} extra={
                      (monData.suspicious_companies ?? []).length > 0
                        ? <Pill label={`${(monData.suspicious_companies ?? []).length} مشبوه`} color="#EF4444" bg="rgba(239,68,68,0.1)" />
                        : <Pill label="✅ لا شيء" color="#34D399" bg="rgba(52,211,153,0.1)" />
                    } />
                    <div style={{ padding: '16px 24px 24px' }}>
                      {(monData.suspicious_companies ?? []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                          <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>لا توجد حسابات مشبوهة حالياً</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {(monData.suspicious_companies ?? []).map(c => {
                            const sc = c.trial_score < 30 ? '#EF4444' : c.trial_score < 60 ? '#F59E0B' : '#34D399';
                            return (
                              <div key={c.id} className="mon-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', alignItems: 'center', padding: '14px 18px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, transition: 'background 0.15s' }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '14px', color: C.text }}>{c.name}</div>
                                  <div style={{ fontSize: '12px', color: C.muted, fontFamily: 'monospace', marginTop: '2px' }}>{c.email ?? '—'}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '10px', color: C.muted, fontWeight: 700, marginBottom: '3px' }}>درجة الثقة</div>
                                  <div style={{ fontSize: '22px', fontWeight: 900, color: sc }}>{c.trial_score}</div>
                                </div>
                                <Pill
                                  label={c.verification_status === 'verified' ? '✓ موثق' : c.verification_status === 'pending' ? '⏳ معلق' : c.verification_status}
                                  color={c.verification_status === 'verified' ? '#34D399' : '#F59E0B'}
                                  bg={c.verification_status === 'verified' ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)'}
                                />
                                <Pill label="🚨 مشبوه" color="#EF4444" bg="rgba(239,68,68,0.1)" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>

                {/* ════════════ §6 RECENT BLOCKS ════════════ */}
                <div id="mon-blocks" className="mon-sec">
                  <SectionCard id="mon-blocks-inner2" accentColor="#F59E0B">
                    <SectionHead icon="🔒" title="آخر محاولات محجوبة" sub="الـ 20 محاولة الأخيرة في الوقت الفعلي" extra={
                      (monData.recent_blocks ?? []).length > 0
                        ? <Pill label={`${(monData.recent_blocks ?? []).length} محاولة`} color="#F59E0B" bg="rgba(245,158,11,0.1)" />
                        : <Pill label="✅ لا شيء" color="#34D399" bg="rgba(52,211,153,0.1)" />
                    } />
                    <div style={{ padding: '16px 24px 24px' }}>
                      {(monData.recent_blocks ?? []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                          <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>لم يتم حجب أي محاولة مؤخراً</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {(monData.recent_blocks ?? []).map((b, i) => (
                            <div key={i} className="mon-row" style={{
                              display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
                              gap: '12px', alignItems: 'center',
                              padding: '13px 18px', borderRadius: '14px',
                              background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                              transition: 'background 0.15s',
                            }}>
                              <div>
                                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: C.text }}>{b.email}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: C.muted, marginTop: '2px' }}>{b.ip}</div>
                              </div>
                              <div>
                                <Pill label={b.reason} color="#EF4444" bg="rgba(239,68,68,0.1)" />
                                <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{new Date(b.created_at).toLocaleString('ar-EG')}</div>
                              </div>
                              <Pill label="🚫 محجوب" color="#EF4444" bg="rgba(239,68,68,0.08)" />
                              <button className="mon-btn"
                                onClick={() => { setUnblockIP(b.ip); setUnblockEmail(b.email ?? ''); setUnblockResult(null); setUnblockMsg(null); scrollTo('mon-unblock'); }}
                                style={{ padding: '8px 16px', borderRadius: '12px', border: '1.5px solid rgba(16,185,129,0.45)', background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1))', color: '#10B981', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                🔓 رفع الحجب
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>

              </div>
            )}
          </div>
        );
      })()}


      </div>{/* end maxWidth container */}

      {/* ── Subscription Management Modal ─────────────────────────────────── */}
      {subModal && (
        <div
          onClick={() => setSubModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '18px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', fontFamily: FONT, direction: 'rtl' }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#e2e8f0' }}>📋 إدارة الاشتراك</div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{subModal.name}</div>
              </div>
              <button onClick={() => setSubModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Current Status */}
            <div style={{ margin: '16px 24px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'الخطة الحالية', value: translatePlan(subModal.plan_type), color: C.orange },
                { label: 'النسخة', value: subModal.edition === 'advanced' ? '🚀 Advanced' : '⭐ Pro', color: subModal.edition === 'advanced' ? '#fcd34d' : '#a5b4fc' },
                { label: 'الحالة', value: subModal.status === 'active' ? '✅ نشط' : subModal.status === 'trial' ? '🔵 تجريبي' : subModal.status === 'expired' ? '❌ منتهي' : '⛔ موقوف', color: subModal.status === 'active' || subModal.status === 'trial' ? C.success : C.danger },
                { label: 'الأيام المتبقية', value: subModal.daysRemaining < 0 ? 'منتهي' : `${subModal.daysRemaining} يوم`, color: subModal.daysRemaining < 0 ? C.danger : subModal.daysRemaining <= 7 ? C.warning : C.success },
                { label: 'تاريخ الانتهاء', value: new Date(subModal.end_date).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }), color: '#e2e8f0' },
                { label: 'عدد المستخدمين', value: `${subModal.userCount} مستخدم`, color: '#e2e8f0' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

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
                        ...f,
                        edition: val,
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

              {/* Module Feature Control */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>⚙️ التحكم في الوحدات</label>
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
                        background: subForm.features[key] ? 'rgba(52,211,153,0.03)' : 'transparent',
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
              </div>

              {/* Date control */}
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

              {/* Save button */}
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
            background: '#0f0f1a', borderRadius: '24px', border: '1.5px solid rgba(255,255,255,0.1)',
            width: '100%', maxWidth: '720px', maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Modal header */}
            <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: C.text }}>
                  🏢 {snapshotData?.company.name ?? 'جارٍ التحميل...'}
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

              {snapshotData && (() => {
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
