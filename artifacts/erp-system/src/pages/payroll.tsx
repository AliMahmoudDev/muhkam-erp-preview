import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Wallet,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Play,
  X,
  Loader2,
  FileText,
  Banknote,
} from 'lucide-react';

type AnyRec = Record<string, unknown>;

/* ── helpers ─────────────────────────────────────────────── */
function numFmt(v: unknown, cur = 'EGP') {
  const n = parseFloat(String(v ?? '0'));
  if (isNaN(n)) return '—';
  return (
    n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + cur
  );
}
function dateFmt(v: unknown) {
  if (!v) return '—';
  const s = String(v);
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Status badge ────────────────────────────────────────── */
const STATUS_MAP: Record<string, [string, string]> = {
  draft: ['مسودة', 'erp-badge erp-badge-neutral'],
  processing: ['جاري الحساب', 'erp-badge erp-badge-warning'],
  approved: ['معتمدة', 'erp-badge erp-badge-success'],
  paid: ['مدفوعة', 'erp-badge erp-badge-info'],
  cancelled: ['ملغاة', 'erp-badge erp-badge-danger'],
};
function PeriodBadge({ s }: { s: string }) {
  const [label, cls] = STATUS_MAP[s] ?? [s, 'erp-badge erp-badge-neutral'];
  return <span className={cls}>{label}</span>;
}
const REC_STATUS_MAP: Record<string, [string, string]> = {
  draft: ['مسودة', 'erp-badge erp-badge-neutral'],
  approved: ['معتمد', 'erp-badge erp-badge-success'],
  rejected: ['مرفوض', 'erp-badge erp-badge-danger'],
  paid: ['مدفوع', 'erp-badge erp-badge-info'],
};
function RecBadge({ s }: { s: string }) {
  const [label, cls] = REC_STATUS_MAP[s] ?? [s, 'erp-badge erp-badge-neutral'];
  return <span className={cls}>{label}</span>;
}

/* ── Line type label ─────────────────────────────────────── */
function lineTypeLabel(t: string) {
  const m: Record<string, string> = {
    base: 'الراتب الأساسي',
    allowance: 'بدل',
    deduction: 'خصم',
    advance: 'سلفة',
    tax: 'ضريبة',
    incentive: 'حافز',
    other: 'أخرى',
  };
  return m[t] ?? t;
}

export default function Payroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'can_manage_payroll');
  const canApprove = hasPermission(user, 'can_approve_payroll');

  const [showCreate, setShowCreate] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({ safe_id: '', notes: '' });
  // Per-employee pay: { recId, name, net }
  const [payRecModal, setPayRecModal] = useState<{
    recId: number;
    name: string;
    net: number;
    currency: string;
  } | null>(null);
  const [payRecSafeId, setPayRecSafeId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<AnyRec | null>(null);
  const [expandedRecId, setExpandedRecId] = useState<number | null>(null);
  const [expandedLineItems, setExpandedLineItems] = useState<AnyRec[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  /* ── today & month defaults ─────────────────────────────── */
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]!;
  const monthName = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  const [form, setForm] = useState({
    name: `رواتب ${monthName}`,
    start_date: firstDay,
    end_date: lastDay,
    notes: '',
  });

  const f = async (url: string, opts?: RequestInit) => {
    const r = await authFetch(api(url), opts);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(((d as AnyRec).error as string) || 'خطأ');
    }
    return r.json();
  };

  /* ── Queries ─────────────────────────────────────────────── */
  const periods = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => f('/api/payroll/periods'),
  });

  const periodDetail = useQuery({
    queryKey: ['payroll-period', selectedPeriod?.id],
    queryFn: () => f(`/api/payroll/periods/${selectedPeriod!.id}`),
    enabled: !!selectedPeriod,
  });

  const safesQuery = useQuery({
    queryKey: ['settings-safes'],
    queryFn: () => f('/api/settings/safes'),
  });

  /* ── Mutations ───────────────────────────────────────────── */
  const mutOk = (k: string | string[], msg: string) => ({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] });
      toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const createPeriod = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/payroll/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOk(['payroll-periods'], 'تم إنشاء فترة الراتب'),
    onSuccess: (row: AnyRec) => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      toast({ title: 'تم إنشاء فترة الراتب' });
      setShowCreate(false);
      setSelectedPeriod(row);
    },
  });

  const processPeriod = useMutation({
    mutationFn: (id: number) => f(`/api/payroll/periods/${id}/process`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-period', id] });
      toast({ title: 'تم احتساب رواتب الموظفين' });
      setSelectedPeriod((p) => ({ ...p!, status: 'processing' }));
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const approvePeriod = useMutation({
    mutationFn: (id: number) => f(`/api/payroll/periods/${id}/approve`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-period', id] });
      toast({ title: 'تمت الموافقة على فترة الرواتب' });
      setSelectedPeriod((p) => ({ ...p!, status: 'approved' }));
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const payPeriod = useMutation({
    mutationFn: ({ id, safe_id, notes }: { id: number; safe_id: number; notes: string }) =>
      f(`/api/payroll/periods/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safe_id, notes }),
      }),
    onSuccess: (data: AnyRec, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-period', vars.id] });
      qc.invalidateQueries({ queryKey: ['settings-safes'] });
      toast({
        title: `✓ تم صرف الرواتب من خزانة "${String(data.safe_name ?? '')}" بمجموع ${numFmt(data.total_paid)}`,
      });
      setSelectedPeriod((p) => ({ ...p!, status: 'paid' }));
      setShowPay(false);
      setPayForm({ safe_id: '', notes: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const payRecord = useMutation({
    mutationFn: ({ recId, safe_id }: { recId: number; safe_id: number }) =>
      f(`/api/payroll/records/${recId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safe_id }),
      }),
    onSuccess: (data: AnyRec) => {
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
      qc.invalidateQueries({ queryKey: ['payroll-period', selectedPeriod?.id] });
      qc.invalidateQueries({ queryKey: ['settings-safes'] });
      toast({
        title: `✓ صُرف راتب ${String(data.emp_name ?? '')} من "${String(data.safe_name ?? '')}"`,
      });
      setPayRecModal(null);
      setPayRecSafeId('');
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Line items expansion ────────────────────────────────── */
  async function toggleLines(recId: number) {
    if (expandedRecId === recId) {
      setExpandedRecId(null);
      return;
    }
    setExpandedRecId(recId);
    setLoadingLines(true);
    try {
      const lines = await f(`/api/payroll/records/${recId}`);
      setExpandedLineItems(safeArray((lines as AnyRec).line_items));
    } catch {
      setExpandedLineItems([]);
    } finally {
      setLoadingLines(false);
    }
  }

  const periodList = safeArray(periods.data);
  const detail = periodDetail.data as (AnyRec & { records?: AnyRec[] }) | undefined;
  const recordsList = safeArray(detail?.records);
  const safesList = safeArray(safesQuery.data);

  /* ── Stats for selected period ───────────────────────────── */
  const totalGross = recordsList.reduce((s, r) => s + (Number(r.gross_salary) || 0), 0);
  const totalNet = recordsList.reduce((s, r) => s + (Number(r.net_salary) || 0), 0);
  const unpaidNet = recordsList
    .filter((r) => r.status !== 'paid')
    .reduce((s, r) => s + (Number(r.net_salary) || 0), 0);
  const unpaidCount = recordsList.filter((r) => r.status !== 'paid').length;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Wallet size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-ink">إدارة الرواتب</h1>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
          >
            <Plus size={14} /> فترة جديدة
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left: periods list ───────────────────────────── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-ink/50 uppercase tracking-wider">
            فترات الرواتب
          </h2>
          {periods.isLoading && (
            <div className="text-ink/40 text-sm text-center py-6">جاري التحميل…</div>
          )}
          {periodList.length === 0 && !periods.isLoading && (
            <div className="text-ink/40 text-sm text-center py-6">لا توجد فترات رواتب</div>
          )}
          {periodList.map((p) => (
            <button
              key={String(p.id)}
              onClick={() => setSelectedPeriod(p)}
              className={`w-full text-right p-3 rounded-xl border transition-all ${
                selectedPeriod?.id === p.id
                  ? 'border-amber-500/60 bg-amber-500/10'
                  : 'border-line bg-surface hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink text-sm truncate">
                  {String(p.name ?? '')}
                </span>
                <PeriodBadge s={String(p.status ?? '')} />
              </div>
              <div className="text-xs text-ink/40 mt-1">
                {dateFmt(p.start_date)} — {dateFmt(p.end_date)}
              </div>
            </button>
          ))}
        </div>

        {/* ── Right: period detail ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedPeriod && (
            <div className="flex items-center justify-center h-48 text-ink/30 text-sm">
              اختر فترة لعرض تفاصيلها
            </div>
          )}

          {selectedPeriod && (
            <>
              {/* Period header */}
              <div className="erp-card p-4 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-ink text-lg">
                      {String(selectedPeriod.name ?? '')}
                    </h2>
                    <p className="text-ink/50 text-sm">
                      {dateFmt(selectedPeriod.start_date)} — {dateFmt(selectedPeriod.end_date)}
                    </p>
                  </div>
                  <PeriodBadge s={String(selectedPeriod.status ?? '')} />
                </div>

                {/* Summary stats */}
                {recordsList.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="erp-card p-3 rounded-lg text-center">
                      <p className="text-xs text-ink/40">عدد الموظفين</p>
                      <p className="text-xl font-bold text-ink">{recordsList.length}</p>
                    </div>
                    <div className="erp-card p-3 rounded-lg text-center">
                      <p className="text-xs text-ink/40">إجمالي الرواتب</p>
                      <p className="text-base font-bold text-amber-400">{numFmt(totalGross)}</p>
                    </div>
                    <div className="erp-card p-3 rounded-lg text-center">
                      <p className="text-xs text-ink/40">صافي الرواتب</p>
                      <p className="text-base font-bold text-emerald-400">{numFmt(totalNet)}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {canManage && selectedPeriod.status === 'draft' && (
                    <button
                      onClick={() => processPeriod.mutate(Number(selectedPeriod.id))}
                      disabled={processPeriod.isPending}
                      className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
                    >
                      {processPeriod.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      احتساب الرواتب
                    </button>
                  )}
                  {canApprove && selectedPeriod.status === 'processing' && (
                    <button
                      onClick={() => approvePeriod.mutate(Number(selectedPeriod.id))}
                      disabled={approvePeriod.isPending}
                      className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
                    >
                      {approvePeriod.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      اعتماد الرواتب
                    </button>
                  )}
                  {canApprove && selectedPeriod.status === 'approved' && (
                    <button
                      onClick={() => setShowPay(true)}
                      disabled={payPeriod.isPending}
                      className="erp-btn flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-ink border border-emerald-500/50 disabled:opacity-50"
                    >
                      {payPeriod.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Banknote size={14} />
                      )}
                      صرف الرواتب
                    </button>
                  )}
                  {selectedPeriod.status === 'paid' && (
                    <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                      <CheckCircle2 size={14} /> تم صرف الرواتب بالكامل
                    </div>
                  )}
                </div>
              </div>

              {/* Records table */}
              {periodDetail.isLoading && (
                <div className="text-ink/40 text-sm text-center py-8">
                  جاري تحميل بيانات الرواتب…
                </div>
              )}

              {recordsList.length === 0 &&
                !periodDetail.isLoading &&
                selectedPeriod.status === 'draft' && (
                  <div className="erp-card p-6 rounded-xl text-center text-ink/40 text-sm">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <p>اضغط "احتساب الرواتب" لبدء معالجة رواتب الموظفين</p>
                  </div>
                )}

              {recordsList.length > 0 && (
                <div className="erp-card rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-ink/50 text-xs">
                        <th className="text-right p-3">الموظف</th>
                        <th className="text-center p-3">الراتب الإجمالي</th>
                        <th className="text-center p-3">صافي الراتب</th>
                        <th className="text-center p-3">الحالة</th>
                        {canApprove && <th className="text-center p-3">صرف</th>}
                        <th className="text-center p-3">تفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordsList.map((rec) => (
                        <Fragment key={String(rec.id)}>
                          <tr className="border-b border-line hover:bg-surface transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-ink">
                                {rec.first_name_ar} {rec.last_name_ar}
                              </div>
                              <div className="text-xs text-ink/40">
                                {String(rec.employee_code ?? '')}
                              </div>
                            </td>
                            <td className="p-3 text-center text-amber-300 font-mono font-semibold">
                              {numFmt(rec.gross_salary, String(rec.currency ?? 'EGP'))}
                            </td>
                            <td className="p-3 text-center text-emerald-400 font-mono font-semibold">
                              {numFmt(rec.net_salary, String(rec.currency ?? 'EGP'))}
                            </td>
                            <td className="p-3 text-center">
                              <RecBadge s={String(rec.status ?? '')} />
                            </td>
                            {canApprove && (
                              <td className="p-3 text-center">
                                {rec.status !== 'paid' && selectedPeriod.status === 'approved' ? (
                                  <button
                                    onClick={() =>
                                      setPayRecModal({
                                        recId: Number(rec.id),
                                        name: `${String(rec.first_name_ar ?? '')} ${String(rec.last_name_ar ?? '')}`.trim(),
                                        net: Number(rec.net_salary ?? 0),
                                        currency: String(rec.currency ?? 'EGP'),
                                      })
                                    }
                                    className="flex items-center gap-1 mx-auto px-2 py-1 rounded-lg text-xs bg-emerald-600/70 hover:bg-emerald-600 text-ink border border-emerald-500/40 transition-colors"
                                  >
                                    <Banknote size={12} /> صرف
                                  </button>
                                ) : rec.status === 'paid' ? (
                                  <CheckCircle2 size={14} className="text-emerald-400 mx-auto" />
                                ) : (
                                  <span className="text-ink/20 text-xs">—</span>
                                )}
                              </td>
                            )}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => toggleLines(Number(rec.id))}
                                className="text-ink/40 hover:text-amber-400 transition-colors"
                              >
                                {expandedRecId === Number(rec.id) ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Line items */}
                          {expandedRecId === Number(rec.id) && (
                            <tr key={`lines-${rec.id}`}>
                              <td colSpan={canApprove ? 6 : 5} className="bg-surface px-6 py-3">
                                {loadingLines ? (
                                  <div className="text-ink/40 text-xs text-center py-2">
                                    جاري التحميل…
                                  </div>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-ink/40">
                                        <th className="text-right pb-1">البند</th>
                                        <th className="text-left pb-1">النوع</th>
                                        <th className="text-left pb-1">المبلغ</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedLineItems.map((li, i) => (
                                        <tr
                                          key={`${String(li.component_name ?? '')}-${String(li.component_type ?? '')}-${i}`}
                                          className="border-t border-line"
                                        >
                                          <td className="py-1 text-ink/80">
                                            {String(li.component_name ?? '')}
                                          </td>
                                          <td className="py-1 text-ink/50">
                                            {lineTypeLabel(String(li.component_type ?? ''))}
                                          </td>
                                          <td
                                            className={`py-1 font-mono ${Number(li.amount) < 0 ? 'text-red-400' : 'text-emerald-400'}`}
                                          >
                                            {numFmt(li.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Per-Employee Pay Modal ───────────────────────────── */}
      {payRecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h2 className="font-bold text-ink flex items-center gap-2 text-base">
                <Banknote size={15} className="text-emerald-400" /> صرف راتب
              </h2>
              <button
                onClick={() => {
                  setPayRecModal(null);
                  setPayRecSafeId('');
                }}
                className="text-ink/40 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Employee & amount */}
              <div className="erp-card p-3 rounded-xl space-y-1">
                <p className="text-sm font-semibold text-ink">{payRecModal.name}</p>
                <p className="text-xs text-ink/50">صافي الراتب المستحق</p>
                <p className="text-lg font-bold text-emerald-400 font-mono">
                  {numFmt(payRecModal.net, payRecModal.currency)}
                </p>
              </div>
              {/* Safe selector */}
              <div>
                <label className="text-xs text-ink/50 block mb-1">
                  الخزانة <span className="text-red-400">*</span>
                </label>
                <select
                  className="erp-input w-full"
                  value={payRecSafeId}
                  onChange={(e) => setPayRecSafeId(e.target.value)}
                >
                  <option value="">— اختر الخزانة —</option>
                  {safesList.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name ?? '')} — رصيد:{' '}
                      {numFmt(s.balance, String(s.currency ?? 'EGP'))}
                    </option>
                  ))}
                </select>
                {payRecSafeId &&
                  (() => {
                    const safe = safesList.find((s) => String(s.id) === payRecSafeId);
                    if (!safe) return null;
                    const bal = Number(safe.balance ?? 0);
                    const enough = bal >= payRecModal.net;
                    return (
                      <p className={`text-xs mt-1 ${enough ? 'text-emerald-400' : 'text-red-400'}`}>
                        {enough
                          ? `✓ رصيد كافٍ — المتبقي: ${numFmt(bal - payRecModal.net)}`
                          : `✗ رصيد غير كافٍ — يُنقص ${numFmt(payRecModal.net - bal)}`}
                      </p>
                    );
                  })()}
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-line">
              <button
                onClick={() =>
                  payRecord.mutate({ recId: payRecModal.recId, safe_id: Number(payRecSafeId) })
                }
                disabled={payRecord.isPending || !payRecSafeId}
                className="erp-btn flex-1 flex items-center gap-1 justify-center bg-emerald-600/80 hover:bg-emerald-600 text-ink border border-emerald-500/40 disabled:opacity-40"
              >
                {payRecord.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Banknote size={14} />
                )}
                {payRecord.isPending
                  ? 'جاري الصرف…'
                  : `تأكيد صرف ${numFmt(payRecModal.net, payRecModal.currency)}`}
              </button>
              <button
                onClick={() => {
                  setPayRecModal(null);
                  setPayRecSafeId('');
                }}
                className="erp-btn erp-btn-ghost"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Period Modal ─────────────────────────────────── */}
      {showPay && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h2 className="font-bold text-ink flex items-center gap-2">
                <Banknote size={16} className="text-emerald-400" /> صرف رواتب —{' '}
                {String(selectedPeriod.name ?? '')}
              </h2>
              <button onClick={() => setShowPay(false)} className="text-ink/40 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Unpaid summary */}
              <div className="erp-card p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink/50">الموظفون المتبقون للصرف</span>
                  <span className="text-sm font-bold text-ink">{unpaidCount} موظف</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink/50">المبلغ المستحق الصرف</span>
                  <span className="font-bold text-emerald-400 text-base font-mono">
                    {numFmt(unpaidNet)}
                  </span>
                </div>
                {unpaidCount < recordsList.length && (
                  <p className="text-xs text-amber-400/80 pt-1 border-t border-line">
                    ملاحظة: تم صرف {recordsList.length - unpaidCount} موظف مسبقاً وسيُتخطّون
                  </p>
                )}
              </div>

              {/* Safe picker */}
              <div>
                <label className="text-xs text-ink/50 block mb-1">
                  الخزانة <span className="text-red-400">*</span>
                </label>
                <select
                  className="erp-input w-full"
                  value={payForm.safe_id}
                  onChange={(e) => setPayForm((p) => ({ ...p, safe_id: e.target.value }))}
                >
                  <option value="">— اختر الخزانة —</option>
                  {safesList.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name ?? '')} — رصيد:{' '}
                      {numFmt(s.balance, String(s.currency ?? 'EGP'))}
                    </option>
                  ))}
                </select>
                {payForm.safe_id &&
                  (() => {
                    const safe = safesList.find((s) => String(s.id) === payForm.safe_id);
                    if (!safe) return null;
                    const bal = Number(safe.balance ?? 0);
                    const enough = bal >= unpaidNet;
                    return (
                      <p className={`text-xs mt-1 ${enough ? 'text-emerald-400' : 'text-red-400'}`}>
                        {enough
                          ? `✓ الرصيد كافٍ — المتبقي بعد الصرف: ${numFmt(bal - unpaidNet)}`
                          : `✗ رصيد الخزانة غير كافٍ — يُنقص ${numFmt(unpaidNet - bal)}`}
                      </p>
                    );
                  })()}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-ink/50 block mb-1">ملاحظات (اختياري)</label>
                <input
                  className="erp-input w-full"
                  value={payForm.notes}
                  onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={`صرف رواتب — ${String(selectedPeriod.name ?? '')}`}
                />
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-line">
              <button
                onClick={() =>
                  payPeriod.mutate({
                    id: Number(selectedPeriod.id),
                    safe_id: Number(payForm.safe_id),
                    notes: payForm.notes,
                  })
                }
                disabled={payPeriod.isPending || !payForm.safe_id}
                className="erp-btn flex-1 flex items-center gap-1 justify-center bg-emerald-600/80 hover:bg-emerald-600 text-ink border border-emerald-500/40 disabled:opacity-40"
              >
                {payPeriod.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Banknote size={14} />
                )}
                {payPeriod.isPending ? 'جاري الصرف…' : `تأكيد صرف ${numFmt(unpaidNet)}`}
              </button>
              <button onClick={() => setShowPay(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Period Modal ──────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h2 className="font-bold text-ink flex items-center gap-2">
                <Plus size={16} className="text-amber-400" /> فترة راتب جديدة
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-ink/40 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-ink/50 block mb-1">اسم الفترة</label>
                <input
                  className="erp-input w-full"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: رواتب مايو 2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink/50 block mb-1">من تاريخ</label>
                  <input
                    type="date"
                    className="erp-input w-full"
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-ink/50 block mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    className="erp-input w-full"
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-ink/50 block mb-1">ملاحظات (اختياري)</label>
                <input
                  className="erp-input w-full"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-line">
              <button
                onClick={() => createPeriod.mutate(form as unknown as AnyRec)}
                disabled={createPeriod.isPending || !form.name.trim()}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createPeriod.isPending ? 'جاري الإنشاء…' : 'إنشاء الفترة'}
              </button>
              <button onClick={() => setShowCreate(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
