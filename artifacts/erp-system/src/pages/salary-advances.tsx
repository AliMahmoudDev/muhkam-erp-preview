import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { Banknote, Plus, X, Settings, Clock, BookOpen } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
type AnyRec = Record<string, unknown>;
function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '0';
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case 'approved':
    case 'active':
      return 'erp-badge erp-badge-success';
    case 'pending':
      return 'erp-badge erp-badge-warning';
    case 'rejected':
      return 'erp-badge erp-badge-danger';
    case 'completed':
      return 'erp-badge erp-badge-info';
    case 'cancelled':
      return 'erp-badge erp-badge-neutral';
    default:
      return 'erp-badge erp-badge-neutral';
  }
}
function statusAr(s: string) {
  const m: Record<string, string> = {
    pending: 'معلّق',
    approved: 'معتمد',
    active: 'نشط (جاري السداد)',
    rejected: 'مرفوض',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };
  return m[s] ?? s;
}
function typeAr(t: string) {
  const m: Record<string, string> = {
    emergency: 'طارئ',
    personal: 'شخصي',
    medical: 'علاجي',
    educational: 'تعليمي',
    other: 'أخرى',
  };
  return m[t] ?? t;
}

export default function SalaryAdvances() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'can_manage_payroll');

  const [activeTab, setActiveTab] = useState('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [ledgerEmpId, setLedgerEmpId] = useState('');
  const [requestForm, setRequestForm] = useState({
    employee_id: '',
    requested_amount: '',
    advance_type: 'personal',
    reason: '',
  });
  const [settingsForm, setSettingsForm] = useState({
    max_advance_percentage: '50',
    max_concurrent_advances: '2',
    min_salary_for_advance: '3000',
    repayment_tenure_months: '1',
  });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(((d as AnyRec).error as string) || 'خطأ');
    }
    return r.json();
  }, []);

  const listParams = new URLSearchParams();
  if (statusFilter) listParams.set('status', statusFilter);

  const advances = useQuery({
    queryKey: ['salary-advances', statusFilter],
    queryFn: () => f(`/api/salary-advances?${listParams}`),
  });
  const pending = useQuery({
    queryKey: ['salary-advances-pending'],
    queryFn: () => f('/api/salary-advances/pending-approvals'),
    enabled: canManage,
  });
  const settings = useQuery({
    queryKey: ['salary-advance-settings'],
    queryFn: () => f('/api/salary-advances/settings'),
  });
  const ledger = useQuery({
    queryKey: ['salary-advance-ledger', ledgerEmpId],
    queryFn: () => f(`/api/salary-advances/${ledgerEmpId}/ledger`),
    enabled: Boolean(ledgerEmpId),
  });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const createAdvance = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/salary-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts(['salary-advances', statusFilter], 'تم تقديم طلب السلفة'),
  });
  const approveAdv = useMutation({
    mutationFn: (id: number) =>
      f(`/api/salary-advances/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    ...mutOpts(['salary-advances-pending', `salary-advances,${statusFilter}`], 'تم اعتماد السلفة'),
  });
  const rejectAdv = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      f(`/api/salary-advances/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    ...mutOpts(['salary-advances-pending', `salary-advances,${statusFilter}`], 'تم رفض السلفة'),
  });
  const cancelAdv = useMutation({
    mutationFn: (id: number) =>
      f(`/api/salary-advances/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    ...mutOpts(['salary-advances', statusFilter], 'تم إلغاء السلفة'),
  });
  const manualPay = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      f(`/api/salary-advances/${id}/manual-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      }),
    ...mutOpts(['salary-advances', statusFilter], 'تم تسجيل الدفعة'),
  });
  const updateSettings = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/salary-advances/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('salary-advance-settings', 'تم تحديث الإعدادات'),
  });

  const advancesList = safeArray(advances.data);
  const pendingList = safeArray(pending.data);
  const ledgerList = safeArray(ledger.data);
  const cfg = settings.data as AnyRec | undefined;

  const totalOutstanding = advancesList
    .filter((a) => ['active', 'approved'].includes(String(a.status)))
    .reduce((s, a) => s + Number(a.remaining_balance), 0);

  const TABS = [
    { key: 'list', label: 'السلف' },
    ...(canManage
      ? [
          {
            key: 'pending',
            label: `طلبات الاعتماد${pendingList.length > 0 ? ` (${pendingList.length})` : ''}`,
          },
        ]
      : []),
    { key: 'ledger', label: 'دفتر الأستاذ' },
  ] as const;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Banknote size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">السلف على الراتب</h1>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button
              onClick={() => {
                setSettingsForm({
                  max_advance_percentage: String(cfg?.max_advance_percentage ?? 50),
                  max_concurrent_advances: String(cfg?.max_concurrent_advances ?? 2),
                  min_salary_for_advance: String(cfg?.min_salary_for_advance ?? 3000),
                  repayment_tenure_months: String(cfg?.repayment_tenure_months ?? 1),
                });
                setShowSettingsForm(true);
              }}
              className="erp-btn erp-btn-ghost flex items-center gap-1 text-xs"
            >
              <Settings size={12} /> الإعدادات
            </button>
          )}
          <button
            onClick={() => setShowRequestForm(true)}
            className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
          >
            <Plus size={14} /> طلب سلفة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي السلف', val: advancesList.length, color: 'text-white' },
          {
            label: 'معلّقة',
            val: advancesList.filter((a) => a.status === 'pending').length,
            color: 'text-amber-300',
          },
          {
            label: 'نشطة',
            val: advancesList.filter((a) => a.status === 'active').length,
            color: 'text-emerald-300',
          },
          { label: 'الرصيد المتبقي', val: `${fmt(totalOutstanding)} ج.م`, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="erp-card p-4 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-400' : 'text-white/50 hover:text-white/80'}`}
          >
            {t.label}
            {t.key === 'pending' && pendingList.length > 0 && (
              <span className="mr-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs inline-flex items-center justify-center">
                {pendingList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── قائمة السلف ── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['', 'pending', 'active', 'approved', 'completed', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`erp-btn text-xs ${statusFilter === s ? 'erp-btn-primary' : 'erp-btn-ghost'}`}
              >
                {s === '' ? 'الكل' : statusAr(s)}
              </button>
            ))}
          </div>
          <div className="erp-card overflow-x-auto">
            {advances.isLoading ? (
              <TableSkeleton />
            ) : advancesList.length === 0 ? (
              <div className="erp-empty-state">
                <Banknote size={36} className="erp-empty-icon mb-2" />
                <p className="erp-empty-label">لا توجد سلف</p>
              </div>
            ) : (
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">الموظف</th>
                    <th className="p-3 text-right text-xs">النوع</th>
                    <th className="p-3 text-right text-xs">المبلغ</th>
                    <th className="p-3 text-right text-xs">الرصيد المتبقي</th>
                    <th className="p-3 text-right text-xs">الحالة</th>
                    <th className="p-3 text-right text-xs">التاريخ</th>
                    {canManage && <th className="p-3 text-right text-xs">إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {advancesList.map((a) => (
                    <tr key={String(a.id)} className="erp-table-row">
                      <td className="p-3 text-sm">
                        <div>
                          {String(a.first_name_ar ?? '')} {String(a.last_name_ar ?? '')}
                        </div>
                        <div className="text-xs text-white/40 font-mono">
                          {String(a.employee_code ?? '')}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-white/60">
                        {typeAr(String(a.advance_type))}
                      </td>
                      <td className="p-3 text-sm text-amber-300 font-bold font-mono">
                        {fmt(a.requested_amount)} {String(a.currency)}
                      </td>
                      <td className="p-3 text-sm font-mono">
                        {Number(a.remaining_balance) > 0 ? (
                          <span className="text-red-400">{fmt(a.remaining_balance)}</span>
                        ) : (
                          <span className="text-emerald-300">مسدّد</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={statusBadge(String(a.status))}>
                          {statusAr(String(a.status))}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-white/40 font-mono">
                        {String(a.requested_date)}
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {a.status === 'active' && (
                              <button
                                onClick={() => setShowPaymentModal(a.id as number)}
                                className="erp-btn erp-btn-ghost p-1 text-xs text-emerald-400 border border-emerald-500/30"
                              >
                                دفعة
                              </button>
                            )}
                            {(a.status === 'active' || a.status === 'approved') && (
                              <button
                                onClick={() => cancelAdv.mutate(a.id as number)}
                                className="erp-btn erp-btn-ghost p-1 text-xs text-red-400 border border-red-500/30"
                              >
                                إلغاء
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── طلبات الاعتماد ── */}
      {activeTab === 'pending' && canManage && (
        <div className="space-y-3">
          {pending.isLoading ? (
            <TableSkeleton />
          ) : pendingList.length === 0 ? (
            <div className="erp-card">
              <div className="erp-empty-state">
                <Clock size={36} className="erp-empty-icon mb-2" />
                <p className="erp-empty-label">لا توجد طلبات معلّقة</p>
              </div>
            </div>
          ) : (
            pendingList.map((a) => (
              <div key={String(a.id)} className="erp-card border-amber-500/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-sm">
                      {String(a.first_name_ar ?? '')} {String(a.last_name_ar ?? '')}{' '}
                      <span className="text-xs text-white/40 font-mono">
                        ({String(a.employee_code ?? '')})
                      </span>
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      الراتب الأساسي: <span className="font-mono">{fmt(a.salary)} ج.م</span>
                    </div>
                    <div className="text-amber-300 font-bold mt-2 text-lg font-mono">
                      {fmt(a.requested_amount)} {String(a.currency)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      النوع: {typeAr(String(a.advance_type))} • التاريخ:{' '}
                      <span className="font-mono">{String(a.requested_date)}</span>
                    </div>
                    {a.reason && (
                      <div className="text-sm text-white/60 mt-2 bg-white/5 rounded p-2">
                        {String(a.reason)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveAdv.mutate(a.id as number)}
                      disabled={approveAdv.isPending}
                      className="erp-btn erp-btn-primary text-xs"
                    >
                      قبول
                    </button>
                    <button
                      onClick={() => setRejectId(a.id as number)}
                      className="erp-btn erp-btn-ghost text-xs text-red-400 border border-red-500/30"
                    >
                      رفض
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── دفتر الأستاذ ── */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <input
              type="number"
              className="erp-input w-48"
              placeholder="رقم الموظف"
              value={ledgerEmpId}
              onChange={(e) => setLedgerEmpId(e.target.value)}
            />
            <span className="text-white/30 text-sm">أدخل رقم الموظف لعرض كشف حسابه</span>
          </div>
          {ledgerEmpId && ledger.isLoading ? (
            <TableSkeleton />
          ) : ledgerList.length > 0 ? (
            <div className="erp-card overflow-x-auto">
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">التاريخ</th>
                    <th className="p-3 text-right text-xs">نوع الحركة</th>
                    <th className="p-3 text-right text-xs">المبلغ</th>
                    <th className="p-3 text-right text-xs">الرصيد</th>
                    <th className="p-3 text-right text-xs">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerList.map((l) => {
                    const ltAr: Record<string, string> = {
                      advance_granted: 'سلفة ممنوحة',
                      deduction: 'خصم من المرتب',
                      manual_payment: 'دفعة يدوية',
                      reversal: 'استرداد',
                    };
                    const isDebit = String(l.ledger_type) === 'advance_granted';
                    return (
                      <tr key={String(l.id)} className="erp-table-row">
                        <td className="p-3 text-sm text-white/60 font-mono">
                          {String(l.ledger_date)}
                        </td>
                        <td className="p-3 text-sm">
                          {ltAr[String(l.ledger_type)] ?? String(l.ledger_type)}
                        </td>
                        <td
                          className={`p-3 text-sm font-bold font-mono ${isDebit ? 'text-amber-300' : 'text-emerald-300'}`}
                        >
                          {isDebit ? '+' : '-'}
                          {fmt(l.amount)}
                        </td>
                        <td className="p-3 text-sm font-mono">{fmt(l.balance)}</td>
                        <td className="p-3 text-xs text-white/40">{String(l.notes ?? '—')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : ledgerEmpId ? (
            <div className="erp-card">
              <div className="erp-empty-state">
                <BookOpen size={36} className="erp-empty-icon mb-2" />
                <p className="erp-empty-label">لا توجد حركات لهذا الموظف</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* طلب سلفة */}
      {showRequestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Banknote size={16} className="text-amber-400" /> طلب سلفة على الراتب
              </h2>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {cfg && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
                  الحد الأقصى: {Number(cfg.max_advance_percentage)}% من الراتب • الحد الأدنى للراتب:{' '}
                  <span className="font-mono">{fmt(cfg.min_salary_for_advance)}</span> ج.م
                </div>
              )}
              <Field label="رقم الموظف *">
                <input
                  type="number"
                  value={requestForm.employee_id}
                  onChange={(e) => setRequestForm((p) => ({ ...p, employee_id: e.target.value }))}
                  className="erp-input w-full"
                  required
                />
              </Field>
              <Field label="المبلغ المطلوب *">
                <input
                  type="number"
                  value={requestForm.requested_amount}
                  onChange={(e) =>
                    setRequestForm((p) => ({ ...p, requested_amount: e.target.value }))
                  }
                  className="erp-input w-full"
                  required
                />
              </Field>
              <Field label="النوع">
                <select
                  value={requestForm.advance_type}
                  onChange={(e) => setRequestForm((p) => ({ ...p, advance_type: e.target.value }))}
                  className="erp-input w-full"
                >
                  {[
                    ['personal', 'شخصي'],
                    ['emergency', 'طارئ'],
                    ['medical', 'علاجي'],
                    ['educational', 'تعليمي'],
                    ['other', 'أخرى'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="السبب *">
                <input
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))}
                  className="erp-input w-full"
                  required
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createAdvance.mutate(requestForm, {
                    onSuccess: () => {
                      setShowRequestForm(false);
                      setRequestForm({
                        employee_id: '',
                        requested_amount: '',
                        advance_type: 'personal',
                        reason: '',
                      });
                    },
                  });
                }}
                disabled={createAdvance.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createAdvance.isPending ? 'جاري التقديم...' : 'تقديم'}
              </button>
              <button onClick={() => setShowRequestForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* إعدادات */}
      {showSettingsForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Settings size={16} className="text-amber-400" /> إعدادات السلف
              </h2>
              <button
                onClick={() => setShowSettingsForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الحد الأقصى من الراتب (%)">
                <input
                  type="number"
                  value={settingsForm.max_advance_percentage}
                  onChange={(e) =>
                    setSettingsForm((p) => ({ ...p, max_advance_percentage: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
              <Field label="الحد الأقصى للسلف المتزامنة">
                <input
                  type="number"
                  value={settingsForm.max_concurrent_advances}
                  onChange={(e) =>
                    setSettingsForm((p) => ({ ...p, max_concurrent_advances: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
              <Field label="الحد الأدنى للراتب للأهلية (ج.م)">
                <input
                  type="number"
                  value={settingsForm.min_salary_for_advance}
                  onChange={(e) =>
                    setSettingsForm((p) => ({ ...p, min_salary_for_advance: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
              <Field label="مدة السداد (شهور)">
                <input
                  type="number"
                  value={settingsForm.repayment_tenure_months}
                  onChange={(e) =>
                    setSettingsForm((p) => ({ ...p, repayment_tenure_months: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  updateSettings.mutate(
                    {
                      max_advance_percentage: Number(settingsForm.max_advance_percentage),
                      max_concurrent_advances: Number(settingsForm.max_concurrent_advances),
                      min_salary_for_advance: Number(settingsForm.min_salary_for_advance),
                      repayment_tenure_months: Number(settingsForm.repayment_tenure_months),
                    },
                    { onSuccess: () => setShowSettingsForm(false) }
                  );
                }}
                disabled={updateSettings.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {updateSettings.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setShowSettingsForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* رفض السلفة */}
      {rejectId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white">رفض طلب السلفة</h2>
              <button
                onClick={() => {
                  setRejectId(null);
                  setRejectReason('');
                }}
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="سبب الرفض *">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="erp-input w-full"
                  placeholder="اكتب سبب الرفض..."
                />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => {
                  rejectAdv.mutate(
                    { id: rejectId, reason: rejectReason },
                    {
                      onSuccess: () => {
                        setRejectId(null);
                        setRejectReason('');
                      },
                    }
                  );
                }}
                disabled={!rejectReason.trim() || rejectAdv.isPending}
                className="erp-btn flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
              >
                {rejectAdv.isPending ? 'جاري...' : 'رفض'}
              </button>
              <button
                onClick={() => {
                  setRejectId(null);
                  setRejectReason('');
                }}
                className="erp-btn erp-btn-ghost flex-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* دفعة يدوية */}
      {showPaymentModal != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Banknote size={16} className="text-amber-400" /> تسجيل دفعة يدوية
              </h2>
              <button
                onClick={() => {
                  setShowPaymentModal(null);
                  setPaymentAmount('');
                }}
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="المبلغ *">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="erp-input w-full"
                  placeholder="0.00"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => {
                  manualPay.mutate(
                    { id: showPaymentModal, amount: Number(paymentAmount) },
                    {
                      onSuccess: () => {
                        setShowPaymentModal(null);
                        setPaymentAmount('');
                      },
                    }
                  );
                }}
                disabled={!paymentAmount || Number(paymentAmount) <= 0 || manualPay.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {manualPay.isPending ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(null);
                  setPaymentAmount('');
                }}
                className="erp-btn erp-btn-ghost flex-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
