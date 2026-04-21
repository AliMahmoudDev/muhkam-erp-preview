/**
 * Super Admin Dashboard — manage all SaaS companies + super_admin accounts
 * Only accessible to users with role = "super_admin"
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

/* ── Types ───────────────────────────────────────── */
interface BackupFile {
  filename: string;
  size_mb: string;
  created_at: string;
}
interface Company {
  id: number;
  name: string;
  plan_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  admin_email: string | null;
  daysRemaining: number;
  status: 'active' | 'trial' | 'expired' | 'suspended';
  userCount: number;
  created_at: string;
}
interface Stats {
  total: number;
  active: number;
  trial: number;
  paid: number;
  expired: number;
  suspended: number;
  totalUsers: number;
  expiringSoon: number;
  expiringSoonList: { id: number; name: string; end_date: string; plan_type: string; days_left: number }[];
  recentSignups: number;
  monthlySignups: { month: string; count: number }[];
  userCountByCompany: Record<number, number>;
}
interface Manager {
  id: number;
  name: string;
  username: string;
  email: string | null;
  active: boolean | null;
  last_login: string | null;
  created_at: string;
}

/* ── Constants ───────────────────────────────────── */
const STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active: {
    bg: 'rgba(34,197,94,0.12)',
    text: '#22C55E',
    border: 'rgba(34,197,94,0.3)',
    label: 'نشط',
  },
  trial: {
    bg: 'rgba(249,115,22,0.12)',
    text: '#F97316',
    border: 'rgba(249,115,22,0.3)',
    label: 'تجريبي',
  },
  expired: {
    bg: 'rgba(239,68,68,0.12)',
    text: '#EF4444',
    border: 'rgba(239,68,68,0.3)',
    label: 'منتهي',
  },
  suspended: {
    bg: 'rgba(148,163,184,0.1)',
    text: '#94A3B8',
    border: 'rgba(148,163,184,0.2)',
    label: 'موقوف',
  },
};
const PLAN_LABELS: Record<string, string> = {
  trial: 'تجريبي',
  basic: 'أساسي',
  professional: 'احترافي',
  pro: 'احترافي',
  paid: 'مدفوع',
};
const translatePlan = (p: string) => PLAN_LABELS[p] ?? p;

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  orange: '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  text: '#F8FAFC',
  muted: '#94A3B8',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  blue: '#3B82F6',
};
const PER_PAGE = 10;
const FONT = "'Tajawal','Cairo',sans-serif";

/* ── Animated counter ───────────────────────────── */
function AnimatedNumber({ target }: { target: number | string }) {
  const [display, setDisplay] = useState<number | string>(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (typeof target !== 'number') {
      setDisplay(target);
      return;
    }
    const duration = 700;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);
  return <>{display}</>;
}

/* ── Toast ──────────────────────────────────────── */
function Toast({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  const isErr = type === 'error';
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: isErr ? '#2e1a1a' : '#1a2e1a',
        border: `1px solid ${isErr ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
        borderRadius: '12px',
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 700,
        color: isErr ? C.danger : C.success,
        zIndex: 3000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'sa-fade-in 0.3s ease',
        fontFamily: FONT,
      }}
    >
      {isErr ? '⚠️' : '✅'} {msg}
    </div>
  );
}

/* ── Generic dark input ─────────────────────────── */
function DarkInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '14px' }}>
      <label
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: C.muted,
          display: 'block',
          marginBottom: '5px',
        }}
      >
        {label}
        {required && <span style={{ color: C.danger }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          borderRadius: '10px',
          border: `1.5px solid ${focused ? C.orange : C.border}`,
          background: C.bg,
          color: C.text,
          fontSize: '14px',
          fontFamily: FONT,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {hint && <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

/* ── Modal shell ────────────────────────────────── */
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        style={{
          background: C.card,
          borderRadius: '20px',
          border: `1px solid ${C.border}`,
          padding: '28px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          fontFamily: FONT,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '22px',
          }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: 900, color: C.orange, margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.muted,
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ───────────────────────── */
function ConfirmDeleteModal({
  title,
  body,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  title: string;
  body: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
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
          border: `1px solid ${C.border}`,
          padding: '32px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
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
            🗑️
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: C.text, margin: 0 }}>{title}</h3>
        </div>
        <div style={{ fontSize: '14px', color: C.muted, lineHeight: 1.8, marginBottom: '20px' }}>
          {body}
        </div>
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              marginBottom: '16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              fontSize: '13px',
              color: C.danger,
            }}
          >
            ⚠️ {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: loading ? '#6b2020' : C.danger,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'جاري الحذف...' : 'نعم، احذف'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
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
  );
}

/* ── ActionBtn ──────────────────────────────────── */
function ActionBtn({
  label,
  icon,
  color,
  onClick,
}: {
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '8px 14px',
        borderRadius: '10px',
        border: `1.5px solid ${color}44`,
        background: `${color}18`,
        color,
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: FONT,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}30`;
        e.currentTarget.style.borderColor = `${color}88`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}18`;
        e.currentTarget.style.borderColor = `${color}44`;
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

/* ── PageBtn ────────────────────────────────────── */
function PageBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: FONT,
        border: `1px solid ${disabled ? 'rgba(51,65,85,0.4)' : C.border}`,
        background: 'transparent',
        color: disabled ? 'rgba(148,163,184,0.3)' : C.muted,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export default function SuperAdmin() {
  const { user, token, logout } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  /* ── Tab ─── */
  const [activeTab, setActiveTab] = useState<
    'companies' | 'managers' | 'backups' | 'security' | 'settings' |
    'revenue' | 'alerts' | 'audit' | 'announcements' | 'health'
  >('companies');

  /* ── Companies state ─── */
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [extendDays, setExtendDays] = useState<Record<number, number>>({});
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
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteCoErr, setDeleteCoErr] = useState('');
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

  /* ── Support settings state ─── */
  const [supportWa, setSupportWa] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [settingSaving, setSettingSaving] = useState(false);

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

  if (user?.role !== 'super_admin') {
    setLocation('/');
    return null;
  }

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetcher = useCallback(
    (url: string) =>
      fetch(api(url), { headers: authHeaders(token ?? '') }).then((r) => {
        if (!r.ok) throw new Error('فشل جلب البيانات');
        return r.json();
      }),
    [token]
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
      const res = await fetch(api('/api/super/encryption-key'), {
        headers: authHeaders(token ?? ''),
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
    enabled: activeTab === 'audit',
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
      const res = await fetch(api('/api/super/announcements'), {
        method: 'POST',
        headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
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
    await fetch(api(`/api/super/announcements/${id}`), {
      method: 'PATCH',
      headers: { ...authHeaders(token ?? ''), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active }),
    });
    void refetchAnn();
  }

  async function deleteAnn(id: number) {
    await fetch(api(`/api/super/announcements/${id}`), {
      method: 'DELETE', headers: authHeaders(token ?? ''),
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
    enabled: activeTab === 'health',
    staleTime: 10_000,
    refetchInterval: activeTab === 'health' ? 15_000 : false,
  });

  /* CSV Export */
  async function exportCompaniesCSV() {
    try {
      const res = await fetch(api('/api/super/export/companies'), {
        headers: authHeaders(token ?? ''),
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
    enabled: activeTab === 'backups',
    staleTime: 30_000,
  });

  async function triggerBackup() {
    setCreatingBackup(true);
    try {
      const res = await fetch(api('/api/super/backup/create'), {
        method: 'POST',
        headers: authHeaders(token ?? ''),
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
      const res = await fetch(api(`/api/super/backup/download/${encodeURIComponent(filename)}`), {
        headers: authHeaders(token ?? ''),
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
      let headers: HeadersInit = authHeaders(token ?? '');
      if (isEnc) {
        body = await pendingRestoreFile.arrayBuffer();
        headers = { ...headers, 'Content-Type': 'application/octet-stream' };
      } else {
        const text = await pendingRestoreFile.text();
        body = text;
        headers = { ...headers, 'Content-Type': 'application/json' };
      }
      const res = await fetch(api('/api/system/restore'), {
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
    enabled: activeTab === 'security',
    staleTime: 10_000,
  });

  async function startTotpSetup() {
    setSecLoading(true);
    setSecMsg(null);
    try {
      const res = await fetch(api('/api/auth/2fa/setup'), {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
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
      const res = await fetch(api('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: authHeaders(token ?? ''),
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
      const res = await fetch(api('/api/auth/2fa/disable'), {
        method: 'POST',
        headers: authHeaders(token ?? ''),
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

  async function saveSupportSettings() {
    setSettingSaving(true);
    try {
      const upsert = async (key: string, value: string) => {
        await fetch(api('/api/settings/system'), {
          method: 'POST',
          headers: authHeaders(token ?? ''),
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
        headers: authHeaders(token ?? ''),
        body: body ? JSON.stringify(body) : undefined,
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/companies'] });
      qc.invalidateQueries({ queryKey: ['/api/super/stats'] });
    },
  });

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
        headers: authHeaders(token ?? ''),
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
        headers: authHeaders(token ?? ''),
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
        headers: authHeaders(token ?? ''),
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
        headers: authHeaders(token ?? ''),
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
        headers: authHeaders(token ?? ''),
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
        headers: authHeaders(token ?? ''),
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

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

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px' }}>
        {/* ── Tab bar ─── */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
          {(
            [
              { key: 'companies',     label: '🏢 الشركات' },
              { key: 'revenue',       label: '📊 الإيرادات' },
              { key: 'alerts',        label: '🔔 التنبيهات' },
              { key: 'audit',         label: '📋 سجل التدقيق' },
              { key: 'announcements', label: '📢 الإعلانات' },
              { key: 'health',        label: '🌡️ صحة السيرفر' },
              { key: 'managers',      label: '👑 المديرون' },
              { key: 'backups',       label: '💾 النسخ' },
              { key: 'security',      label: '🔐 الأمان' },
              { key: 'settings',      label: '⚙️ الإعدادات' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 22px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.18s',
                  border: active ? 'none' : `1.5px solid ${C.border}`,
                  background: active ? C.orange : 'transparent',
                  color: active ? '#fff' : C.muted,
                  boxShadow: active ? `0 4px 16px rgba(249,115,22,0.3)` : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

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

              {/* Search + filter */}
              <div
                style={{
                  padding: '14px 24px',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '12px',
                      transform: 'translateY(-50%)',
                      fontSize: '15px',
                      pointerEvents: 'none',
                    }}
                  >
                    🔍
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث عن شركة…"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 38px 9px 14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${C.border}`,
                      background: C.bg,
                      color: C.text,
                      fontSize: '13px',
                      fontFamily: FONT,
                      outline: 'none',
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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {STATUS_FILTERS.map((f) => {
                    const active = statusFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: FONT,
                          transition: 'all 0.15s',
                          border: active ? 'none' : `1px solid ${C.border}`,
                          background: active ? C.orange : 'transparent',
                          color: active ? '#fff' : C.muted,
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
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
                            onSuccess: (data: any) => {
                              setShowCreate(false);
                              setNewName(''); setNewPlan('trial'); setNewEdition('ultimate'); setNewDays(14);
                              setNewAdminName(''); setNewAdminUsername('');
                              setCreateResult({
                                company_name: data.company?.name ?? newName,
                                username:     data.admin?.username ?? '',
                                admin_name:   data.admin?.name    ?? newAdminName,
                                temp_password: data.admin?.temp_password ?? '',
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

              {/* Table body */}
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
                              background: (co as any).edition === 'advanced' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                              color: (co as any).edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
                              border: `1px solid ${(co as any).edition === 'advanced' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                            }}>
                              {(co as any).edition === 'advanced' ? '🚀 ADVANCED' : '⭐ ULTIMATE'}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                  value={extendDays[co.id] ?? 7}
                                  onChange={(e) =>
                                    setExtendDays((prev) => ({
                                      ...prev,
                                      [co.id]: Number(e.target.value),
                                    }))
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    border: `1px solid ${C.border}`,
                                    borderRadius: '8px',
                                    padding: '7px 10px',
                                    fontSize: '13px',
                                    background: C.card,
                                    color: C.text,
                                    fontFamily: FONT,
                                  }}
                                >
                                  {[7, 14, 30, 90, 365].map((d) => (
                                    <option key={d} value={d}>
                                      {d} يوم
                                    </option>
                                  ))}
                                </select>
                                <ActionBtn
                                  label="تمديد"
                                  icon="⏳"
                                  color={C.warning}
                                  onClick={() =>
                                    coMutate.mutate({
                                      url: `/api/super/companies/${co.id}/extend`,
                                      body: { days: extendDays[co.id] ?? 7, plan_type: 'paid' },
                                    })
                                  }
                                />
                              </div>
                              <ActionBtn
                                label="⭐ ترقية إلى مدفوع"
                                icon=""
                                color={C.orange}
                                onClick={() =>
                                  coMutate.mutate({
                                    url: `/api/super/companies/${co.id}`,
                                    method: 'PUT',
                                    body: { plan_type: 'paid' },
                                  })
                                }
                              />

                              {/* Edition switcher */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '6px 12px' }}>
                                <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>🏷️ النسخة:</span>
                                <select
                                  value={(co as any).edition ?? 'ultimate'}
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
                                    border: `1.5px solid ${(co as any).edition === 'advanced' ? '#f59e0b' : '#6366f1'}`,
                                    borderRadius: '8px',
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    background: C.bg,
                                    color: (co as any).edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
                                    fontFamily: FONT,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="ultimate">⭐ ULTIMATE (كاملة)</option>
                                  <option value="advanced">🚀 ADVANCED (متوسطة)</option>
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    padding: '14px 24px',
                    borderTop: `1px solid ${C.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: C.muted }}>
                    عرض {(safePage - 1) * PER_PAGE + 1}–
                    {Math.min(safePage * PER_PAGE, filtered.length)} من {filtered.length} شركة
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <PageBtn
                      label="السابق"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    />
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: FONT,
                          transition: 'all 0.15s',
                          border: p === safePage ? 'none' : `1px solid ${C.border}`,
                          background: p === safePage ? C.orange : 'transparent',
                          color: p === safePage ? '#fff' : C.muted,
                        }}
                      >
                        {p}
                      </button>
                    ))}
                    <PageBtn
                      label="التالي"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    />
                  </div>
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
        {activeTab === 'backups' && (
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
                  {backupData ? `${backupData.total} نسخة متوفرة` : 'جاري التحميل...'}
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
              ) : backupData.backups.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>💾</div>
                  <div>لا توجد نسخ احتياطية بعد</div>
                  <div style={{ fontSize: '12px', marginTop: '6px' }}>
                    اضغط "إنشاء نسخة الآن" للبدء
                  </div>
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
        {activeTab === 'security' && (
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
                      background: secMsg.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: secMsg.ok ? C.success : '#EF4444',
                      border: `1px solid ${secMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}
                  >
                    {secMsg.text}
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
                        src={totpSetupData.qr_code}
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
                      {totpSetupData.secret}
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
            TAB: SETTINGS
            ══════════════════════════════ */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: '560px' }}>
            <div
              style={{
                background: C.card,
                borderRadius: '20px',
                border: `1px solid ${C.border}`,
                padding: '28px 32px',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
                معلومات التواصل للدعم
              </h2>
              <p style={{ fontSize: '12px', color: C.muted, margin: '0 0 24px' }}>
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
                onClick={() => {
                  void saveSupportSettings();
                }}
                disabled={settingSaving}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: settingSaving ? C.border : C.orange,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: settingSaving ? 'not-allowed' : 'pointer',
                  fontFamily: FONT,
                  transition: 'filter 0.15s',
                  marginTop: '8px',
                }}
              >
                {settingSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
            </div>
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

              {/* Monthly Revenue Chart (CSS bars) */}
              <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: '15px', color: C.text }}>📅 الإيراد الشهري (آخر 12 شهراً)</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {revenueData.monthlyRevenue.map((m, i) => {
                    const maxRev = Math.max(...revenueData.monthlyRevenue.map(x => x.revenue), 1);
                    const pct = (m.revenue / maxRev) * 100;
                    const isLast = i === revenueData.monthlyRevenue.length - 1;
                    return (
                      <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, minWidth: '48px' }}>
                        {m.revenue > 0 && <span style={{ fontSize: '10px', color: C.muted }}>{m.revenue.toLocaleString('ar-EG')}</span>}
                        <div style={{
                          width: '100%', borderRadius: '6px 6px 0 0',
                          background: isLast ? 'linear-gradient(180deg, #A78BFA, #7C3AED)' : 'rgba(167,139,250,0.3)',
                          height: `${Math.max(pct, 4)}%`,
                          border: isLast ? '1px solid rgba(167,139,250,0.5)' : 'none',
                          transition: 'height 0.5s ease',
                        }} />
                        <span style={{ fontSize: '9px', color: C.muted, whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'top right' }}>{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Plan Breakdown */}
              <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>💳 توزيع الخطط</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {revenueData.planBreakdown.filter(p => p.count > 0 || p.plan === 'trial').map(p => {
                    const planColors: Record<string, string> = { trial: '#94A3B8', basic: '#60A5FA', pro: '#A78BFA', paid: '#34D399', professional: '#F59E0B' };
                    const planNames: Record<string, string> = { trial: 'تجريبية', basic: 'أساسية', pro: 'احترافية', paid: 'مدفوعة', professional: 'مميزة' };
                    const col = planColors[p.plan] ?? '#94A3B8';
                    const maxCount = Math.max(...revenueData.planBreakdown.map(x => x.count), 1);
                    return (
                      <div key={p.plan}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: col }}>{planNames[p.plan] ?? p.plan}</span>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: C.muted }}>
                            <span>{p.count} شركة</span>
                            <span style={{ color: col, fontWeight: 700 }}>{p.revenue.toLocaleString('ar-EG')} ج.م./شهر</span>
                            <span>{p.price} ج.م./شركة</span>
                          </div>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '4px', background: col, width: `${(p.count / maxCount) * 100}%`, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
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
          ) : alertsData?.alerts.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px', background: C.card,
              borderRadius: '18px', border: `1px solid ${C.border}`,
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>لا توجد تنبيهات</div>
              <div style={{ fontSize: '13px', color: C.muted, marginTop: '8px' }}>كل شيء يسير بشكل طبيعي</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alertsData?.alerts.map((alert, i) => {
                const colors: Record<string, { bg: string; border: string; badge: string }> = {
                  danger:  { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.25)',   badge: '#EF4444' },
                  warning: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.25)',  badge: '#F59E0B' },
                  success: { bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.25)',  badge: '#34D399' },
                  info:    { bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.25)',  badge: '#60A5FA' },
                };
                const col = colors[alert.type] ?? colors.info;
                return (
                  <div key={i} style={{
                    background: col.bg, borderRadius: '14px', border: `1px solid ${col.border}`,
                    padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px',
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: col.badge, flexShrink: 0, marginTop: '6px',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: C.text, marginBottom: '4px' }}>{alert.title}</div>
                      <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>{alert.body}</div>
                    </div>
                    {alert.company_id && (
                      <button
                        onClick={() => setActiveTab('companies')}
                        style={{
                          flexShrink: 0, padding: '6px 12px', borderRadius: '8px',
                          border: `1px solid ${col.border}`, background: 'transparent',
                          color: col.badge, fontSize: '11px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: FONT,
                        }}
                      >عرض</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          TAB: AUDIT LOG  📋
          ═══════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header + controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>📋 سجل التدقيق الجنائي</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>كل إجراء قام به المدير العام مُسجَّل هنا</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                <option value="CREATE">إنشاء</option>
                <option value="UPDATE">تحديث</option>
                <option value="DELETE">حذف</option>
                <option value="ACTIVATE">تفعيل</option>
                <option value="SUSPEND">تعليق</option>
                <option value="EXTEND">تمديد</option>
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
                  {auditData.rows.map(row => {
                    const actionColors: Record<string, string> = {
                      CREATE: '#34D399', UPDATE: '#60A5FA', DELETE: '#EF4444',
                      ACTIVATE: '#A78BFA', SUSPEND: '#F59E0B', EXTEND: '#FB923C',
                    };
                    const col = actionColors[row.action] ?? '#94A3B8';
                    return (
                      <div key={row.id} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
                        padding: '12px 20px', gap: '12px',
                        borderBottom: `1px solid rgba(255,255,255,0.04)`,
                        fontSize: '12px', alignItems: 'center',
                      }}>
                        <span style={{ color: col, fontWeight: 700 }}>{row.action}</span>
                        <span style={{ color: C.muted }}>{row.record_type}</span>
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
                  إجمالي السجلات المعروضة: {auditData.count}
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
            </>
          ) : null}
        </div>
      )}

      </div>{/* end maxWidth container */}

      <style>{`
        @keyframes sa-fade-in { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );
}
