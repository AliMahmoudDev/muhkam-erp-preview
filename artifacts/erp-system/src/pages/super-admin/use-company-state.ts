import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import {
  type Company, type Stats, type SubForm, type CreateResult, type ResetPassResult,
  type PanelCompanyDetail, type AuditLogResp, type SnapshotData, type ActiveTab,
  C, authHeaders, DEFAULT_FEATS_ULTIMATE, DEFAULT_FEATS_ADVANCED,
} from './types';

interface CoMutateArgs { url: string; method?: string; body?: object; }

export function useCompanyState(
  stats: Stats | undefined,
  showToast: (msg: string, type?: 'success' | 'error') => void,
) {
  const qc = useQueryClient();

  const fetcher = useCallback(
    (url: string) =>
      authFetch(api(url)).then(async (r) => {
        if (!r.ok) {
          let detail = '';
          try { const b = await r.json(); detail = b?.error || b?.message || ''; } catch { /* ignore */ }
          throw new Error(detail ? `فشل جلب البيانات: ${detail}` : `فشل جلب البيانات (${r.status})`);
        }
        return r.json();
      }),
    []
  );

  /* ── State ── */
  const [expandedId, setExpandedId]           = useState<number | null>(null);
  const [showCreate, setShowCreate]           = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newPlan, setNewPlan]                 = useState('trial');
  const [newEdition, setNewEdition]           = useState<'advanced' | 'ultimate'>('ultimate');
  const [newDays, setNewDays]                 = useState(14);
  const [newAdminName, setNewAdminName]       = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [createResult, setCreateResult]       = useState<CreateResult | null>(null);
  const [search, setSearch]                   = useState('');
  const [statusFilter, setStatusFilter]       = useState('all');
  const [page, setPage]                       = useState(1);
  const [perPage, setPerPage]                 = useState(10);
  const [viewMode, setViewMode]               = useState<'table' | 'cards'>('table');
  const [deleteTarget, setDeleteTarget]       = useState<Company | null>(null);
  const [deleteCoErr, setDeleteCoErr]         = useState('');
  const [subModal, setSubModal]               = useState<Company | null>(null);
  const [subForm, setSubForm]                 = useState<SubForm>({
    plan_type: 'trial', edition: 'ultimate', extend_mode: 'days',
    extend_days: 30, end_date: '', is_active: true, features: DEFAULT_FEATS_ULTIMATE,
  });
  const [subSaving, setSubSaving]             = useState(false);
  const [panelTab, setPanelTab]               = useState<0 | 1 | 2 | 3>(0);
  const [deleteStep, setDeleteStep]           = useState<'confirm' | 'code'>('confirm');
  const [generatedCode, setGeneratedCode]     = useState('');
  const [enteredCode, setEnteredCode]         = useState('');
  const [resetPassResult, setResetPassResult] = useState<ResetPassResult | null>(null);
  const [resetPassCopied, setResetPassCopied] = useState(false);
  const [snapshotCompany, setSnapshotCompany] = useState<number | null>(null);

  /* ── Queries ── */
  const { data: companies = [], isLoading: coLoading } = useQuery<Company[]>({
    queryKey: ['/api/super/companies'],
    queryFn: () => fetcher('/api/super/companies') as Promise<Company[]>,
    staleTime: 30_000,
  });

  const { data: panelCompanyDetail, isLoading: panelDetailLoading } = useQuery<PanelCompanyDetail>({
    queryKey: ['/api/super/companies', subModal?.id, 'panel-detail'],
    queryFn: () => fetcher(`/api/super/companies/${subModal!.id}`) as Promise<PanelCompanyDetail>,
    enabled: subModal !== null && panelTab === 2,
    staleTime: 30_000,
  });

  const { data: panelAuditResp, isLoading: panelAuditLoading } = useQuery<AuditLogResp>({
    queryKey: ['/api/super/audit-log', 'company-type', subModal?.id],
    queryFn: () => fetcher('/api/super/audit-log?record_type=company&limit=500') as Promise<AuditLogResp>,
    enabled: subModal !== null && panelTab === 3,
    staleTime: 60_000,
  });

  const { data: snapshotData, isLoading: snapshotLoading } = useQuery<SnapshotData>({
    queryKey: ['/api/super/companies', snapshotCompany, 'snapshot'],
    queryFn: () => fetcher(`/api/super/companies/${snapshotCompany}/snapshot`) as Promise<SnapshotData>,
    enabled: snapshotCompany !== null,
    staleTime: 30_000,
  });

  /* ── Filtering + pagination ── */
  useEffect(() => { setPage(1); }, [search, statusFilter, perPage]);

  const filtered = companies.filter((co) => {
    const q = search.trim().toLowerCase();
    return (
      (!q || co.name.toLowerCase().includes(q) || (co.admin_email ?? '').toLowerCase().includes(q)) &&
      (statusFilter === 'all' || co.status === statusFilter)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  /* ── Stat cards ── */
  const activePercent = stats?.total ? Math.round((stats.active / stats.total) * 100) : 0;
  const statCards = [
    { label: 'إجمالي الشركات',      value: stats?.total ?? 0,        icon: '🏢', color: C.orange,   sub: `${activePercent}% نشطة`,   filter: 'all',       tab: 'companies' as ActiveTab },
    { label: 'نشطة',                value: stats?.active ?? 0,       icon: '✅', color: C.success,  sub: 'اشتراك فعّال',             filter: 'active',    tab: 'companies' as ActiveTab },
    { label: 'مدفوعة',              value: stats?.paid ?? 0,         icon: '💎', color: '#7c3aed',  sub: 'خطة مدفوعة',              filter: 'active',    tab: 'companies' as ActiveTab },
    { label: 'تجريبية',             value: stats?.trial ?? 0,        icon: '⏳', color: C.warning,  sub: 'فترة تجريبية',            filter: 'trial',     tab: 'companies' as ActiveTab },
    { label: 'منتهية',              value: stats?.expired ?? 0,      icon: '❌', color: C.danger,   sub: 'تجاوزت التاريخ',          filter: 'expired',   tab: 'companies' as ActiveTab },
    { label: 'موقوفة',              value: stats?.suspended ?? 0,    icon: '⛔', color: C.muted,    sub: 'معطّلة',                  filter: 'suspended', tab: 'companies' as ActiveTab },
    { label: 'المستخدمون',          value: stats?.totalUsers ?? 0,   icon: '👥', color: C.blue,     sub: 'إجمالي الحسابات',         filter: null,        tab: 'managers' as ActiveTab },
    { label: 'انضموا هذا الشهر',   value: stats?.recentSignups ?? 0, icon: '🆕', color: '#06b6d4', sub: 'آخر 30 يوم',              filter: 'all',       tab: 'companies' as ActiveTab },
  ];

  const STATUS_FILTERS = [
    { key: 'all',       label: 'الكل' },
    { key: 'active',    label: 'نشطة' },
    { key: 'trial',     label: 'تجريبية' },
    { key: 'suspended', label: 'موقوفة' },
    { key: 'expired',   label: 'منتهية' },
  ];

  /* ── Helpers ── */
  const expiryInfo = (co: Company) => {
    const formatted = new Date(co.end_date).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
    if (co.daysRemaining < 0) return { text: `❌ انتهى: ${formatted}`, color: C.danger };
    if (co.daysRemaining <= 7) return { text: `⚠️ ينتهي: ${formatted}`, color: C.warning };
    return { text: `ينتهي: ${formatted}`, color: C.success };
  };

  async function exportCompaniesCSV() {
    try {
      const res = await authFetch(api('/api/super/export/companies'), { headers: authHeaders() });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `muhkam-companies-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('✅ تم تصدير بيانات الشركات');
    } catch { showToast('فشل التصدير', 'error'); }
  }

  /* ── Mutations ── */
  const coMutate = useMutation({
    mutationFn: ({ url, method = 'POST', body }: CoMutateArgs) =>
      authFetch(api(url), {
        method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined,
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/companies'] });
      qc.invalidateQueries({ queryKey: ['/api/super/stats'] });
    },
  });

  const coDelete = useMutation({
    mutationFn: ({ id, force, confirm_code, expected_code }: { id: number; force?: boolean; confirm_code?: string; expected_code?: string }) =>
      authFetch(api(`/api/super/companies/${id}`), {
        method: 'DELETE', headers: authHeaders(),
        body: JSON.stringify({ force, confirm_code, expected_code }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw Object.assign(new Error(d.error ?? 'خطأ'), { data: d }); return d; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/super/companies'] });
      qc.invalidateQueries({ queryKey: ['/api/super/stats'] });
      setDeleteTarget(null); setDeleteCoErr(''); setDeleteStep('confirm'); setGeneratedCode(''); setEnteredCode('');
      showToast('تم حذف الشركة بنجاح');
    },
    onError: (e: Error & { data?: { has_users?: boolean; user_count?: number } }) => {
      if (e.data?.has_users) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(code); setEnteredCode(''); setDeleteCoErr(''); setDeleteStep('code');
      } else {
        setDeleteCoErr(e.message);
      }
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
    } catch { showToast('حدث خطأ أثناء الحفظ'); }
    finally { setSubSaving(false); }
  }

  const resetPassword = useMutation({
    mutationFn: ({ id, company_name }: { id: number; company_name: string }) =>
      authFetch(api(`/api/super/companies/${id}/reset-admin-password`), { method: 'POST' })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'خطأ في إعادة التعيين'); return { ...d, company_name }; }),
    onSuccess: (data) => { setResetPassResult(data as ResetPassResult); setResetPassCopied(false); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  return {
    /* state */
    expandedId, setExpandedId,
    showCreate, setShowCreate,
    newName, setNewName, newPlan, setNewPlan,
    newEdition, setNewEdition, newDays, setNewDays,
    newAdminName, setNewAdminName, newAdminUsername, setNewAdminUsername,
    createResult, setCreateResult,
    search, setSearch, statusFilter, setStatusFilter,
    page, setPage, perPage, setPerPage, viewMode, setViewMode,
    deleteTarget, setDeleteTarget, deleteCoErr, setDeleteCoErr,
    subModal, setSubModal, subForm, setSubForm, subSaving,
    panelTab, setPanelTab,
    deleteStep, setDeleteStep, generatedCode, setGeneratedCode, enteredCode, setEnteredCode,
    resetPassResult, setResetPassResult, resetPassCopied, setResetPassCopied,
    snapshotCompany, setSnapshotCompany,
    /* queries */
    companies, coLoading,
    panelCompanyDetail, panelDetailLoading,
    panelAuditResp, panelAuditLoading,
    snapshotData, snapshotLoading,
    /* derived */
    filtered, paged, totalPages, safePage,
    statCards, STATUS_FILTERS,
    /* helpers & mutations */
    expiryInfo, exportCompaniesCSV, saveSubscription,
    coMutate, coDelete, resetPassword,
    /* constants */
    DEFAULT_FEATS_ULTIMATE, DEFAULT_FEATS_ADVANCED,
  };
}
