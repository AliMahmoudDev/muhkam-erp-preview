import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { DollarSign, Plus, X, ChevronLeft, FileText, Layers, Percent, Shield } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
type AnyRec = Record<string, unknown>;

function statusBadge(s: string) {
  switch (s) {
    case 'approved':
      return 'erp-badge erp-badge-success';
    case 'processing':
      return 'erp-badge erp-badge-info';
    case 'paid':
      return 'erp-badge erp-badge-pending';
    case 'rejected':
      return 'erp-badge erp-badge-danger';
    case 'cancelled':
      return 'erp-badge erp-badge-neutral';
    default:
      return 'erp-badge erp-badge-neutral';
  }
}
function statusAr(s: string) {
  const m: Record<string, string> = {
    draft: 'مسودة',
    processing: 'جاري المعالجة',
    approved: 'معتمد',
    paid: 'مدفوع',
    rejected: 'مرفوض',
    cancelled: 'ملغي',
  };
  return m[s] ?? s;
}
function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '—';
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'can_manage_payroll');
  const canApprove = hasPermission(user, 'can_approve_payroll');

  const [activeTab, setActiveTab] = useState('periods');
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [showStructForm, setShowStructForm] = useState(false);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [showContribForm, setShowContribForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AnyRec | null>(null);
  const [periodForm, setPeriodForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [structForm, setStructForm] = useState({
    name_ar: '',
    name_en: '',
    base_salary: '',
    description: '',
  });
  const [taxForm, setTaxForm] = useState({
    fiscal_year: new Date().getFullYear().toString(),
    min_salary: '',
    max_salary: '',
    tax_rate: '',
  });
  const [contribForm, setContribForm] = useState({
    contribution_type: 'social_insurance',
    name_ar: '',
    name_en: '',
    employee_percentage: '',
    employer_percentage: '',
  });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(((d as AnyRec).error as string) || 'خطأ');
    }
    return r.json();
  }, []);

  const periods = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => f('/api/payroll/periods'),
  });
  const structures = useQuery({
    queryKey: ['salary-structures'],
    queryFn: () => f('/api/salary-structures'),
  });
  const taxBrackets = useQuery({
    queryKey: ['tax-brackets'],
    queryFn: () => f('/api/tax-brackets'),
  });
  const contributions = useQuery({
    queryKey: ['statutory-contribs'],
    queryFn: () => f('/api/statutory-contributions'),
  });
  const periodDetail = useQuery({
    queryKey: ['payroll-period', selectedPeriod?.id],
    queryFn: () => f(`/api/payroll/periods/${selectedPeriod?.id}`),
    enabled: selectedPeriod != null,
  });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
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
    ...mutOpts('payroll-periods', 'تم إنشاء فترة المرتبات'),
  });
  const processPeriod = useMutation({
    mutationFn: (id: number) =>
      f(`/api/payroll/periods/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    ...mutOpts('payroll-periods', 'تمت معالجة المرتبات بنجاح'),
  });
  const approvePeriod = useMutation({
    mutationFn: (id: number) =>
      f(`/api/payroll/periods/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    ...mutOpts('payroll-periods', 'تم اعتماد فترة المرتبات'),
  });
  const createStructure = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/salary-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('salary-structures', 'تم إنشاء الهيكل الوظيفي'),
  });
  const createTax = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/tax-brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('tax-brackets', 'تم إضافة شريحة ضريبية'),
  });
  const createContrib = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/statutory-contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('statutory-contribs', 'تم إضافة الاشتراك الإلزامي'),
  });

  const periodsList = safeArray(periods.data);
  const structsList = safeArray(structures.data);
  const taxList = safeArray(taxBrackets.data);
  const contribsList = safeArray(contributions.data);
  const detailData = periodDetail.data as AnyRec | undefined;
  const detailRecords = safeArray(detailData?.records);

  const TABS = [
    { key: 'periods', label: 'فترات المرتبات', icon: FileText },
    { key: 'structures', label: 'الهياكل الوظيفية', icon: Layers },
    { key: 'tax', label: 'الشرائح الضريبية', icon: Percent },
    { key: 'contrib', label: 'الاشتراكات الإلزامية', icon: Shield },
  ] as const;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <DollarSign size={22} className="text-amber-400" />
        <h1 className="text-xl font-bold text-white">إدارة المرتبات</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-400' : 'text-white/50 hover:text-white/80'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── فترات المرتبات ── */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowPeriodForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> إنشاء فترة مرتبات
            </button>
          )}
          {periods.isLoading ? (
            <TableSkeleton />
          ) : periodsList.length === 0 ? (
            <div className="erp-card">
              <div className="erp-empty-state">
                <DollarSign size={36} className="erp-empty-icon mb-2" />
                <p className="erp-empty-label">لا توجد فترات مرتبات — أنشئ أول فترة</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                {periodsList.map((p) => (
                  <button
                    key={String(p.id)}
                    onClick={() => setSelectedPeriod(p)}
                    className={`w-full text-right p-4 rounded-xl border transition-all ${selectedPeriod?.id === p.id ? 'border-amber-500 bg-amber-500/10' : 'erp-card'}`}
                  >
                    <div className="font-bold text-white text-sm">{String(p.name)}</div>
                    <div className="text-xs text-white/50 mt-1 font-mono">
                      {String(p.start_date)} — {String(p.end_date)}
                    </div>
                    <div className="mt-2">
                      <span className={statusBadge(String(p.status))}>
                        {statusAr(String(p.status))}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="lg:col-span-2">
                {selectedPeriod ? (
                  <div className="erp-card space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">{String(selectedPeriod.name)}</h3>
                      <div className="flex gap-2">
                        {canManage && String(selectedPeriod.status) === 'draft' && (
                          <button
                            onClick={() =>
                              processPeriod.mutate(selectedPeriod.id as number, {
                                onSuccess: () => {
                                  setSelectedPeriod((prev) =>
                                    prev ? { ...prev, status: 'processing' } : null
                                  );
                                  qc.invalidateQueries({ queryKey: ['payroll-periods'] });
                                },
                              })
                            }
                            disabled={processPeriod.isPending}
                            className="erp-btn erp-btn-primary text-xs"
                          >
                            {processPeriod.isPending ? 'جاري...' : 'معالجة المرتبات'}
                          </button>
                        )}
                        {canApprove && String(selectedPeriod.status) === 'processing' && (
                          <button
                            onClick={() =>
                              approvePeriod.mutate(selectedPeriod.id as number, {
                                onSuccess: () => {
                                  setSelectedPeriod((prev) =>
                                    prev ? { ...prev, status: 'approved' } : null
                                  );
                                  qc.invalidateQueries({ queryKey: ['payroll-periods'] });
                                },
                              })
                            }
                            disabled={approvePeriod.isPending}
                            className="erp-btn erp-btn-primary text-xs bg-emerald-600"
                          >
                            {approvePeriod.isPending ? 'جاري...' : 'اعتماد الفترة'}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPeriod(null)}
                          className="text-white/40 hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    {periodDetail.isLoading ? (
                      <TableSkeleton />
                    ) : detailRecords.length === 0 ? (
                      <div className="text-center py-8 text-white/40 text-sm">
                        لا توجد سجلات — قم بمعالجة المرتبات أولاً
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="erp-table w-full">
                          <thead>
                            <tr className="erp-table-header">
                              <th className="p-3 text-right text-xs">الموظف</th>
                              <th className="p-3 text-right text-xs">الراتب الإجمالي</th>
                              <th className="p-3 text-right text-xs">صافي الراتب</th>
                              <th className="p-3 text-right text-xs">الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailRecords.map((r) => (
                              <tr key={String(r.id)} className="erp-table-row">
                                <td className="p-3 text-sm">
                                  {String(r.first_name_ar ?? '')} {String(r.last_name_ar ?? '')}{' '}
                                  <span className="text-white/40 text-xs font-mono">
                                    ({String(r.employee_code ?? '')})
                                  </span>
                                </td>
                                <td className="p-3 text-sm font-mono">{fmt(r.gross_salary)}</td>
                                <td className="p-3 text-sm font-bold text-amber-300 font-mono">
                                  {fmt(r.net_salary)}
                                </td>
                                <td className="p-3">
                                  <span className={statusBadge(String(r.status))}>
                                    {statusAr(String(r.status))}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-white/10">
                            <tr>
                              <td className="p-3 text-white/40 text-xs">
                                إجمالي {detailRecords.length} موظف
                              </td>
                              <td className="p-3 font-bold text-sm font-mono">
                                {fmt(detailRecords.reduce((s, r) => s + Number(r.gross_salary), 0))}
                              </td>
                              <td className="p-3 font-bold text-amber-300 text-sm font-mono">
                                {fmt(detailRecords.reduce((s, r) => s + Number(r.net_salary), 0))}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="erp-card flex items-center justify-center min-h-[200px]">
                    <div className="flex items-center gap-2 text-white/30 text-sm">
                      <ChevronLeft size={16} /> اختر فترة مرتبات لعرض التفاصيل
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── الهياكل الوظيفية ── */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowStructForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> إضافة هيكل وظيفي
            </button>
          )}
          {structures.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {structsList.map((s) => (
                <div key={String(s.id)} className="erp-card">
                  <div className="font-bold text-sm">{String(s.name_ar)}</div>
                  <div className="text-xs text-white/50 mt-1">{String(s.name_en)}</div>
                  <div className="mt-3 text-amber-300 font-bold text-lg font-mono">
                    {fmt(s.base_salary)} <span className="text-xs text-white/40">/ شهر</span>
                  </div>
                </div>
              ))}
              {structsList.length === 0 && (
                <div className="erp-card col-span-3">
                  <div className="erp-empty-state">
                    <Layers size={36} className="erp-empty-icon mb-2" />
                    <p className="erp-empty-label">لا توجد هياكل وظيفية — أضف أول هيكل</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── الشرائح الضريبية ── */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowTaxForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> إضافة شريحة ضريبية
            </button>
          )}
          <div className="erp-card overflow-x-auto">
            {taxBrackets.isLoading ? (
              <TableSkeleton />
            ) : (
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">السنة المالية</th>
                    <th className="p-3 text-right text-xs">من (ج.م)</th>
                    <th className="p-3 text-right text-xs">إلى (ج.م)</th>
                    <th className="p-3 text-right text-xs">نسبة الضريبة</th>
                  </tr>
                </thead>
                <tbody>
                  {taxList.map((t) => (
                    <tr key={String(t.id)} className="erp-table-row">
                      <td className="p-3 text-sm font-mono">{String(t.fiscal_year)}</td>
                      <td className="p-3 text-sm font-mono">{fmt(t.min_salary)}</td>
                      <td className="p-3 text-sm font-mono">
                        {t.max_salary ? fmt(t.max_salary) : 'غير محدود'}
                      </td>
                      <td className="p-3 text-amber-300 font-bold text-sm">
                        {Number(t.tax_rate)}%
                      </td>
                    </tr>
                  ))}
                  {taxList.length === 0 && !taxBrackets.isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center py-12">
                        <div className="erp-empty-state">
                          <Percent size={28} className="erp-empty-icon mb-2" />
                          <p className="erp-empty-label">لا توجد شرائح ضريبية</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── الاشتراكات الإلزامية ── */}
      {activeTab === 'contrib' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowContribForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> إضافة اشتراك إلزامي
            </button>
          )}
          <div className="erp-card overflow-x-auto">
            {contributions.isLoading ? (
              <TableSkeleton />
            ) : (
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">الاسم</th>
                    <th className="p-3 text-right text-xs">النوع</th>
                    <th className="p-3 text-right text-xs">نسبة الموظف</th>
                    <th className="p-3 text-right text-xs">نسبة صاحب العمل</th>
                  </tr>
                </thead>
                <tbody>
                  {contribsList.map((c) => (
                    <tr key={String(c.id)} className="erp-table-row">
                      <td className="p-3 text-sm font-semibold">{String(c.name_ar)}</td>
                      <td className="p-3 text-sm text-white/60">{String(c.contribution_type)}</td>
                      <td className="p-3 text-sm text-amber-300 font-mono">
                        {Number(c.employee_percentage)}%
                      </td>
                      <td className="p-3 text-sm text-emerald-300 font-mono">
                        {Number(c.employer_percentage)}%
                      </td>
                    </tr>
                  ))}
                  {contribsList.length === 0 && !contributions.isLoading && (
                    <tr>
                      <td colSpan={4} className="text-center py-12">
                        <div className="erp-empty-state">
                          <Shield size={28} className="erp-empty-icon mb-2" />
                          <p className="erp-empty-label">لا توجد اشتراكات إلزامية</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* فورم فترة المرتبات */}
      {showPeriodForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-lg" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <DollarSign size={16} className="text-amber-400" /> إنشاء فترة مرتبات جديدة
              </h2>
              <button
                onClick={() => setShowPeriodForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="اسم الفترة *">
                <input
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm((p) => ({ ...p, name: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="مثال: مرتبات يونيو 2025"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="تاريخ البداية *">
                  <input
                    type="date"
                    value={periodForm.start_date}
                    onChange={(e) => setPeriodForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="erp-input w-full"
                    required
                  />
                </Field>
                <Field label="تاريخ النهاية *">
                  <input
                    type="date"
                    value={periodForm.end_date}
                    onChange={(e) => setPeriodForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="erp-input w-full"
                    required
                  />
                </Field>
              </div>
              <Field label="ملاحظات">
                <input
                  value={periodForm.notes}
                  onChange={(e) => setPeriodForm((p) => ({ ...p, notes: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="اختياري"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createPeriod.mutate(periodForm, {
                    onSuccess: () => {
                      setShowPeriodForm(false);
                      setPeriodForm({ name: '', start_date: '', end_date: '', notes: '' });
                    },
                  });
                }}
                disabled={createPeriod.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createPeriod.isPending ? 'جاري الحفظ...' : 'إنشاء'}
              </button>
              <button onClick={() => setShowPeriodForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* فورم الهيكل الوظيفي */}
      {showStructForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Layers size={16} className="text-amber-400" /> هيكل وظيفي جديد
              </h2>
              <button
                onClick={() => setShowStructForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الاسم (عربي) *">
                <input
                  value={structForm.name_ar}
                  onChange={(e) => setStructForm((p) => ({ ...p, name_ar: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="هيكل المبيعات"
                />
              </Field>
              <Field label="الاسم (إنجليزي)">
                <input
                  value={structForm.name_en}
                  onChange={(e) => setStructForm((p) => ({ ...p, name_en: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="Sales Structure"
                />
              </Field>
              <Field label="الراتب الأساسي">
                <input
                  type="number"
                  value={structForm.base_salary}
                  onChange={(e) => setStructForm((p) => ({ ...p, base_salary: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="0"
                />
              </Field>
              <Field label="الوصف">
                <input
                  value={structForm.description}
                  onChange={(e) => setStructForm((p) => ({ ...p, description: e.target.value }))}
                  className="erp-input w-full"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createStructure.mutate(structForm, {
                    onSuccess: () => {
                      setShowStructForm(false);
                      setStructForm({ name_ar: '', name_en: '', base_salary: '', description: '' });
                    },
                  });
                }}
                disabled={createStructure.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createStructure.isPending ? 'جاري...' : 'إضافة'}
              </button>
              <button onClick={() => setShowStructForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* فورم الشريحة الضريبية */}
      {showTaxForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Percent size={16} className="text-amber-400" /> شريحة ضريبية جديدة
              </h2>
              <button
                onClick={() => setShowTaxForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="السنة المالية *">
                <input
                  value={taxForm.fiscal_year}
                  onChange={(e) => setTaxForm((p) => ({ ...p, fiscal_year: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="2025"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="من (ج.م)">
                  <input
                    type="number"
                    value={taxForm.min_salary}
                    onChange={(e) => setTaxForm((p) => ({ ...p, min_salary: e.target.value }))}
                    className="erp-input w-full"
                    placeholder="0"
                  />
                </Field>
                <Field label="إلى (ج.م)">
                  <input
                    type="number"
                    value={taxForm.max_salary}
                    onChange={(e) => setTaxForm((p) => ({ ...p, max_salary: e.target.value }))}
                    className="erp-input w-full"
                    placeholder="غير محدود"
                  />
                </Field>
              </div>
              <Field label="نسبة الضريبة % *">
                <input
                  type="number"
                  step="0.01"
                  value={taxForm.tax_rate}
                  onChange={(e) => setTaxForm((p) => ({ ...p, tax_rate: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="0.00"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createTax.mutate(taxForm, {
                    onSuccess: () => {
                      setShowTaxForm(false);
                      setTaxForm({
                        fiscal_year: new Date().getFullYear().toString(),
                        min_salary: '',
                        max_salary: '',
                        tax_rate: '',
                      });
                    },
                  });
                }}
                disabled={createTax.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createTax.isPending ? 'جاري...' : 'إضافة'}
              </button>
              <button onClick={() => setShowTaxForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* فورم الاشتراك الإلزامي */}
      {showContribForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Shield size={16} className="text-amber-400" /> اشتراك إلزامي جديد
              </h2>
              <button
                onClick={() => setShowContribForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="النوع">
                <select
                  value={contribForm.contribution_type}
                  onChange={(e) =>
                    setContribForm((p) => ({ ...p, contribution_type: e.target.value }))
                  }
                  className="erp-input w-full"
                >
                  <option value="social_insurance">تأمين اجتماعي</option>
                  <option value="health_insurance">تأمين صحي</option>
                  <option value="pension">معاش</option>
                  <option value="other">أخرى</option>
                </select>
              </Field>
              <Field label="الاسم (عربي) *">
                <input
                  value={contribForm.name_ar}
                  onChange={(e) => setContribForm((p) => ({ ...p, name_ar: e.target.value }))}
                  className="erp-input w-full"
                />
              </Field>
              <Field label="الاسم (إنجليزي)">
                <input
                  value={contribForm.name_en}
                  onChange={(e) => setContribForm((p) => ({ ...p, name_en: e.target.value }))}
                  className="erp-input w-full"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="نسبة الموظف %">
                  <input
                    type="number"
                    step="0.01"
                    value={contribForm.employee_percentage}
                    onChange={(e) =>
                      setContribForm((p) => ({ ...p, employee_percentage: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="نسبة صاحب العمل %">
                  <input
                    type="number"
                    step="0.01"
                    value={contribForm.employer_percentage}
                    onChange={(e) =>
                      setContribForm((p) => ({ ...p, employer_percentage: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createContrib.mutate(contribForm, {
                    onSuccess: () => {
                      setShowContribForm(false);
                      setContribForm({
                        contribution_type: 'social_insurance',
                        name_ar: '',
                        name_en: '',
                        employee_percentage: '',
                        employer_percentage: '',
                      });
                    },
                  });
                }}
                disabled={createContrib.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createContrib.isPending ? 'جاري...' : 'إضافة'}
              </button>
              <button onClick={() => setShowContribForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
