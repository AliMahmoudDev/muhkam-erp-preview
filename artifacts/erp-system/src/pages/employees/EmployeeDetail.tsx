import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { openPrintWindow } from '@/lib/print-utils';
import {
  IdCard, Banknote, MinusCircle, Award, Package, BarChart2, FileText,
  Phone, Building2, Briefcase, CalendarDays, Wallet, Percent,
  Plus, Pencil, Trash2, Printer, Download, X, CheckCircle, Wrench,
} from 'lucide-react';
import type { Employee, AnyRec, EmpDocument, DetailTab } from './types';
import { EmployeeDocuments } from './EmployeeDocuments';

/* ── Local helpers (only used in this component) ── */
function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '0';
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={13} className="text-amber-400/60 mt-0.5 shrink-0" />
      <span className="text-white/40 shrink-0">{label}:</span>
      <span className="text-white/80 break-all">{value}</span>
    </div>
  );
}

function advStatusBadge(s: string) {
  const map: Record<string, string> = {
    approved: 'erp-badge erp-badge-success', active: 'erp-badge erp-badge-success',
    pending: 'erp-badge erp-badge-warning',  rejected: 'erp-badge erp-badge-danger',
    completed: 'erp-badge erp-badge-info',   cancelled: 'erp-badge erp-badge-neutral',
  };
  return map[s] ?? 'erp-badge erp-badge-neutral';
}
function advStatusAr(s: string) {
  const m: Record<string, string> = {
    pending: 'معلّق', approved: 'معتمد', active: 'نشط',
    rejected: 'مرفوض', completed: 'مكتمل', cancelled: 'ملغي',
  };
  return m[s] ?? s;
}

const DEDUCTION_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  late:    { label: 'تأخير',     color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  absence: { label: 'غياب',     color: 'text-red-300',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
  damage:  { label: 'تلف/خسائر',color: 'text-rose-300',  bg: 'bg-rose-500/10',  border: 'border-rose-500/20' },
  other:   { label: 'أخرى',     color: 'text-white/70',  bg: 'bg-white/5',      border: 'border-white/10' },
};
function dedLabel(t: string) { return DEDUCTION_LABELS[t] ?? DEDUCTION_LABELS['other']; }

function CustodyLinesPanel({ custodyId }: { custodyId: number }) {
  const { data, isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['/api/employee-custody', custodyId, 'lines'],
    queryFn: async () => {
      const r = await authFetch(`/api/employee-custody/${custodyId}/lines`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });
  if (isLoading) return <div className="text-xs text-white/40 mt-2 text-center py-2">جارِ التحميل…</div>;
  const lines = data ?? [];
  if (lines.length === 0) return <div className="text-xs text-white/40 mt-2 text-center py-2 bg-white/5 rounded">لا توجد بنود مصروفات</div>;
  return (
    <div className="mt-2 bg-black/20 rounded border border-white/10 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-white/5 text-white/50">
          <tr>
            <th className="text-right p-1.5">المبلغ</th><th className="text-right p-1.5">النوع</th>
            <th className="text-right p-1.5">الوصف</th><th className="text-right p-1.5">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={String(l['id'])} className="border-t border-white/5">
              <td className="p-1.5 font-mono text-amber-300">{Number(l['amount'] ?? 0).toFixed(2)}</td>
              <td className="p-1.5 text-white/70">{String(l['category'] ?? '')}</td>
              <td className="p-1.5 text-white/60">{String(l['description'] ?? '—')}</td>
              <td className="p-1.5 font-mono text-white/40">{String(l['line_date'] ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Callbacks passed from parent (avoids threading many setters) ── */

/* ── Employee Maintenance Tab (Admin/Manager only) ── */
type MaintenanceServiceRow = {
  id: number; job_id: number; job_no: string; customer_name: string;
  service_type: string; amount: number;
  commission_computed: number | null; commission_locked: boolean;
  service_status: string; job_status: string;
  created_at: string; delivered_at: string | null;
};
type MaintenanceData = {
  employee_id: number; has_user: boolean;
  total_assigned: number; active_count: number; delivered_count: number;
  total_earned: number; pending_commission: number; avg_commission: number;
  commission_services_count: number; no_commission_services_count: number;
  services: MaintenanceServiceRow[];
};

const SVC_STATUS_AR: Record<string, string> = {
  pending: 'معلق', in_progress: 'جارِ', completed: 'مكتمل', cancelled: 'ملغي',
};
const JOB_STATUS_AR: Record<string, string> = {
  received: 'مستلم', in_progress: 'قيد الإصلاح', repaired: 'تم الإصلاح',
  delivered: 'مُسلَّم', cancelled: 'ملغي', pending: 'معلق',
};

function EmployeeMaintenanceTab({ employeeId }: { employeeId: number }) {
  const { data, isLoading } = useQuery<MaintenanceData>({
    queryKey: ['/api/employees', employeeId, 'maintenance-tab'],
    queryFn: async () => {
      const r = await authFetch(`/api/employees/${employeeId}/maintenance-tab`);
      if (!r.ok) throw new Error('failed');
      return r.json() as Promise<MaintenanceData>;
    },
    enabled: !!employeeId,
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
    </div>
  );

  if (!data) return (
    <div className="text-xs text-white/40 text-center py-6">لا توجد بيانات</div>
  );

  if (!data.has_user) return (
    <div className="text-center py-8 space-y-2">
      <Wrench size={28} className="mx-auto text-white/20" />
      <p className="text-xs text-white/40">هذا الموظف لا يملك حساب مستخدم مرتبط</p>
      <p className="text-[10px] text-white/25">لا يمكن تتبع خدمات الصيانة بدون ربط بحساب</p>
    </div>
  );

  if (data.total_assigned === 0) return (
    <div className="text-center py-8 space-y-2">
      <Wrench size={28} className="mx-auto text-white/20" />
      <p className="text-xs text-white/40">لم تُسند لهذا الفني أي خدمات بعد</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'إجمالي المُسنَدة', value: String(data.total_assigned), color: 'text-white/80' },
          { label: 'النشطة',           value: String(data.active_count),   color: 'text-amber-300' },
          { label: 'المُسلَّمة',        value: String(data.delivered_count), color: 'text-emerald-300' },
          { label: 'عمولات محققة',     value: fmt(data.total_earned),      color: 'text-emerald-300' },
          { label: 'عمولات معلقة',     value: fmt(data.pending_commission), color: 'text-amber-300' },
          { label: 'متوسط العمولة',    value: fmt(data.avg_commission),    color: 'text-purple-300' },
        ].map((card) => (
          <div key={card.label} className="bg-white/5 border border-white/8 rounded-xl p-2.5 text-center">
            <div className={`text-sm font-bold font-mono ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-white/35 mt-0.5 leading-tight">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── جدول الخدمات الأخيرة ── */}
      {data.services.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-white/50 mb-1.5">
            آخر {data.services.length} خدمة
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-[10px]">
              <thead className="bg-white/5 text-white/40">
                <tr>
                  {['رقم البطاقة','العميل','نوع الخدمة','المبلغ','العمولة','حالة الخدمة','حالة البطاقة','تاريخ الإضافة','تاريخ التسليم'].map(h => (
                    <th key={h} className="text-right px-2 py-2 font-semibold whitespace-nowrap border-b border-white/5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.services.map((s) => (
                  <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-2 py-1.5 font-mono text-amber-300 whitespace-nowrap">{s.job_no}</td>
                    <td className="px-2 py-1.5 text-white/70 max-w-[70px] truncate">{s.customer_name}</td>
                    <td className="px-2 py-1.5 text-white/60 max-w-[70px] truncate">{s.service_type}</td>
                    <td className="px-2 py-1.5 font-mono text-white/80 whitespace-nowrap">{fmt(s.amount)}</td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      {s.commission_locked
                        ? <span className="text-emerald-300">{fmt(s.commission_computed ?? 0)}</span>
                        : <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        s.service_status === 'completed'   ? 'bg-emerald-500/20 text-emerald-300' :
                        s.service_status === 'in_progress' ? 'bg-amber-500/20 text-amber-300' :
                        s.service_status === 'cancelled'   ? 'bg-red-500/20 text-red-300' :
                        'bg-white/8 text-white/50'
                      }`}>{SVC_STATUS_AR[s.service_status] ?? s.service_status}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        s.job_status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' :
                        s.job_status === 'cancelled' ? 'bg-red-500/20 text-red-300' :
                        'bg-white/8 text-white/50'
                      }`}>{JOB_STATUS_AR[s.job_status] ?? s.job_status}</span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-white/35 whitespace-nowrap">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString('ar-EG-u-nu-latn') : '—'}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-white/35 whitespace-nowrap">
                      {s.delivered_at ? new Date(s.delivered_at).toLocaleDateString('ar-EG-u-nu-latn') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── قسم ملخص العمولات ── */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-white/50 border-b border-white/8 pb-1.5">ملخص العمولات</p>
        <div className="space-y-1.5">
          {[
            { label: 'إجمالي العمولات المحققة',       value: fmt(data.total_earned),                             color: 'text-emerald-300' },
            { label: 'إجمالي العمولات المعلقة',       value: fmt(data.pending_commission),                       color: 'text-amber-300' },
            { label: 'خدمات تم احتساب عمولتها',       value: String(data.commission_services_count),             color: 'text-emerald-300' },
            { label: 'خدمات لم تُحتسب عمولتها بعد',  value: String(data.no_commission_services_count),          color: 'text-white/50' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-xs text-white/40">{row.label}</span>
              <span className={`text-xs font-bold font-mono ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Employee Repairs Tab ── */
function EmployeeRepairsTab({ employeeId }: { employeeId: number }) {
  const { data, isLoading } = useQuery<{
    employee_id: number;
    jobs_count: number;
    total_revenue: number;
    jobs: Array<{
      id: number; job_no: string; customer_name: string;
      device_brand: string; device_model: string; status: string;
      final_cost: number; received_at: string; delivered_at?: string;
    }>;
  }>({
    queryKey: ['/api/employees', employeeId, 'repair-stats'],
    queryFn: async () => {
      const r = await authFetch(`/api/employees/${employeeId}/repair-stats`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    enabled: !!employeeId,
  });

  if (isLoading) return <div className="text-xs text-white/40 text-center py-6">جارِ تحميل بيانات الصيانة…</div>;
  if (!data || data.jobs_count === 0) return <div className="text-xs text-white/40 text-center py-6 bg-white/5 rounded-xl">لا توجد بطاقات صيانة لهذا الفني</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/8">
          <div className="text-lg font-bold text-amber-300 font-mono">{data.jobs_count}</div>
          <div className="text-[10px] text-white/40">بطاقات الصيانة</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center border border-white/8">
          <div className="text-lg font-bold text-emerald-300 font-mono">{fmt(data.total_revenue)}</div>
          <div className="text-[10px] text-white/40">إجمالي الإيرادات</div>
        </div>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {data.jobs.map((j) => (
          <div key={j.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/6 text-xs">
            <div>
              <span className="text-white/80 font-bold font-mono">{j.job_no}</span>
              <span className="text-white/40 mr-2">{j.customer_name}</span>
            </div>
            <div className="text-left">
              <span className="text-amber-300 font-mono">{fmt(j.final_cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmployeeDetailCallbacks {
  onAddLoan: () => void;
  onApproveLoan: (data: { id: number; requestedAmount: number; currency: string; safeId: unknown }) => void;
  onPayLoan: (loanId: number) => void;
  onAddDeduction: () => void;
  onDeleteDeduction: (id: number) => void;
  onAddBonus: () => void;
  onDeleteBonus: (id: number) => void;
  onAddCustody: () => void;
  onSettleCustody: (custodyId: number) => void;
  onReimburseCustody: (custodyId: number) => void;
  onDeleteCustody: (id: number) => void;
  openEdit: (emp: Employee) => void;
  setSelected: (e: Employee | null) => void;
}

interface EmployeeDetailProps extends EmployeeDetailCallbacks {
  selected: Employee;
  isSelfService: boolean;
  detailTab: DetailTab;
  setDetailTab: (t: DetailTab) => void;
  canManage: boolean;
  canViewSalary: boolean;
  canViewMaintenance: boolean;
  loans: AnyRec[];
  loansLoading: boolean;
  deductions: AnyRec[];
  ledgerLoading: boolean;
  bonuses: AnyRec[];
  custody: AnyRec[];
  documents: EmpDocument[];
  totalLoans: number;
  remainingLoans: number;
  totalDeducted: number;
}

export function EmployeeDetail({
  selected, isSelfService, detailTab, setDetailTab,
  canManage, canViewSalary, canViewMaintenance, openEdit, setSelected,
  loans, loansLoading, deductions, ledgerLoading, bonuses, custody, documents,
  totalLoans, remainingLoans, totalDeducted,
  onAddLoan, onApproveLoan, onPayLoan,
  onAddDeduction, onDeleteDeduction,
  onAddBonus, onDeleteBonus,
  onAddCustody, onSettleCustody, onReimburseCustody, onDeleteCustody,
}: EmployeeDetailProps) {
  const [expandedCustody, setExpandedCustody] = useState<number | null>(null);

  const deductionsByType = (t: string) =>
    deductions.filter((d) => String(d.deduction_type) === t).reduce((s, d) => s + Number(d.amount ?? 0), 0);

  return (
    <div className={`erp-card space-y-3 ${isSelfService ? 'xl:col-span-3' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold text-white">
            {selected.first_name_ar} {selected.last_name_ar}
          </div>
          <div className="text-xs text-amber-300 font-mono">{selected.employee_code}</div>
        </div>
        <div className="flex items-center gap-2">
          {!isSelfService && (
            <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Detail Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-white/10 pb-2">
        {(
          [
            { key: 'info',        label: 'البيانات',    icon: IdCard,     show: true },
            { key: 'loans',       label: 'السلف',       icon: Banknote,   show: true },
            { key: 'deductions',  label: 'الخصومات',    icon: MinusCircle,show: true },
            { key: 'bonuses',     label: 'الحافز',      icon: Award,      show: true },
            { key: 'custody',     label: 'عهدة',        icon: Package,    show: true },
            { key: 'repairs',     label: 'البطاقات',    icon: Wrench,     show: true },
            { key: 'maintenance', label: 'الصيانة',     icon: Wrench,     show: canViewMaintenance },
            { key: 'reports',     label: 'التقارير',    icon: BarChart2,  show: true },
            { key: 'docs',        label: 'مستندات',     icon: FileText,   show: true },
          ] as const
        ).filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${
              detailTab === t.key ? 'bg-amber-500/20 text-amber-300' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Info Tab ── */}
      {detailTab === 'info' && (
        <div className="space-y-2 text-sm">
          <InfoRow icon={Phone} label="الهاتف" value={selected.phone} />
          <InfoRow icon={IdCard} label="رقم البطاقة" value={selected.national_id} />
          <InfoRow icon={Building2} label="القسم" value={selected.department_name} />
          <InfoRow icon={Briefcase} label="المسمى الوظيفي" value={selected.job_title_name} />
          <InfoRow icon={Building2} label="الفرع" value={selected.branch_name} />
          <InfoRow icon={CalendarDays} label="تاريخ التعيين" value={selected.hire_date} />
          {canViewSalary && (selected.salary ?? 0) > 0 && (
            <InfoRow icon={Wallet} label="الراتب" value={`${(selected.salary ?? 0).toLocaleString('ar-EG-u-nu-latn')} ${selected.currency}`} />
          )}
          {canViewSalary && (selected.commission_rate ?? 0) > 0 && (
            <InfoRow icon={Percent} label="نسبة العمولة" value={`${selected.commission_rate}%`} />
          )}
          {canViewSalary && selected.bank_account && (
            <InfoRow icon={Wallet} label="الحساب البنكي" value={selected.bank_account} />
          )}
          {selected.address_ar && (
            <InfoRow icon={Building2} label="العنوان" value={`${selected.address_ar}${selected.city ? ` — ${selected.city}` : ''}`} />
          )}
          {selected.notes && (
            <div className="bg-white/5 rounded p-2 text-white/60 text-xs">{selected.notes}</div>
          )}
          {canManage && (
            <button
              onClick={() => openEdit(selected)}
              className="erp-btn erp-btn-ghost w-full flex items-center justify-center gap-1 text-xs mt-2"
            >
              <Pencil size={12} /> تعديل البيانات
            </button>
          )}
        </div>
      )}

      {/* ── Loans Tab ── */}
      {detailTab === 'loans' && (
        <div className="space-y-2">
          {(canManage || isSelfService) && (
            <button
              onClick={onAddLoan}
              className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1"
            >
              <Plus size={12} />
              {isSelfService ? 'تقديم طلب سلفة' : 'طلب سلفة جديدة'}
            </button>
          )}
          {loansLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}
            </div>
          ) : loans.length === 0 ? (
            <div className="text-center py-6 text-white/30 text-xs">
              <Banknote size={28} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد سلف لهذا الموظف</p>
            </div>
          ) : (
            <div className={`space-y-2 ${loans.length > 5 ? 'max-h-[340px] overflow-y-auto pr-1 thin-scroll' : ''}`}>
              {loans.map((l) => (
                <div key={String(l.id)} className="bg-white/5 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-sm font-bold text-amber-300 font-mono">
                        {fmt(l.requested_amount)} {String(l.currency ?? 'EGP')}
                      </span>
                      <span className="text-xs text-white/40 mr-2">{String(l.advance_type ?? '')}</span>
                    </div>
                    <span className={advStatusBadge(String(l.status))}>{advStatusAr(String(l.status))}</span>
                  </div>
                  {Number(l.remaining_balance) > 0 && (
                    <div className="text-xs text-red-400">
                      متبقي: <span className="font-mono">{fmt(l.remaining_balance)}</span>
                    </div>
                  )}
                  {!!l.reason && <div className="text-xs text-white/40">{String(l.reason)}</div>}
                  <div className="text-xs text-white/30 font-mono">{String(l.requested_date ?? '')}</div>
                  {canManage && (
                    <div className="flex gap-1 mt-2">
                      {l.status === 'pending' && (
                        <button
                          onClick={() => onApproveLoan({ id: l.id as number, requestedAmount: Number(l.requested_amount), currency: String(l.currency ?? 'EGP'), safeId: l.safe_id })}
                          className="erp-btn erp-btn-ghost text-xs text-emerald-400 border border-emerald-500/30 p-1"
                        >
                          اعتماد
                        </button>
                      )}
                      {(l.status === 'active' || l.status === 'approved') && (
                        <button
                          onClick={() => onPayLoan(l.id as number)}
                          className="erp-btn erp-btn-ghost text-xs text-amber-400 border border-amber-500/30 p-1"
                        >
                          تسجيل دفعة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Deductions Tab ── */}
      {detailTab === 'deductions' && (
        <div className="space-y-2">
          {canManage && (
            <button
              onClick={onAddDeduction}
              className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1"
            >
              <Plus size={12} /> إضافة خصم
            </button>
          )}
          {deductions.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {(['late', 'absence', 'damage', 'other'] as const).map((t) => {
                const info = dedLabel(t);
                const total = deductionsByType(t);
                return (
                  <div key={t} className={`${info.bg} border ${info.border} rounded-lg p-2 text-center`}>
                    <div className={`text-[10px] ${info.color} opacity-80`}>{info.label}</div>
                    <div className={`text-xs font-bold ${info.color} font-mono mt-0.5`}>{fmt(total)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {ledgerLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}
            </div>
          ) : deductions.length === 0 ? (
            <div className="text-center py-6 text-white/30 text-xs">
              <MinusCircle size={28} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد خصومات</p>
            </div>
          ) : (
            <div className={`space-y-2 ${deductions.length > 5 ? 'max-h-[260px] overflow-y-auto pr-1 thin-scroll' : ''}`}>
              {deductions.map((d) => {
                const info = dedLabel(String(d.deduction_type ?? 'other'));
                return (
                  <div key={String(d.id)} className={`${info.bg} border ${info.border} rounded-lg p-3`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${info.border} ${info.color} ${info.bg} font-semibold`}>
                            {info.label}
                          </span>
                          <span className={`text-sm font-bold ${info.color} font-mono`}>- {fmt(d.amount)}</span>
                        </div>
                        {!!d.reason && <div className="text-xs text-white/60 mt-1">{String(d.reason)}</div>}
                        <div className="text-[10px] text-white/30 font-mono mt-1">{String(d.deduction_date ?? '')}</div>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => onDeleteDeduction(Number(d.id))}
                          className="text-red-400/60 hover:text-red-400 shrink-0"
                          title="حذف"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="bg-white/5 rounded-lg p-2 text-xs text-center">
                إجمالي الخصومات: <span className="text-red-400 font-bold font-mono">{fmt(totalDeducted)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reports Tab ── */}
      {detailTab === 'reports' && (() => {
        const baseSalary = Number(selected.salary ?? 0);
        const totalBonuses = bonuses.reduce((s, b) => s + Number(b.amount ?? 0), 0);
        const totalIncome = baseSalary + totalBonuses;
        const totalDeductionsAll = totalDeducted + remainingLoans;
        const netAmount = totalIncome - totalDeductionsAll;
        const fmtMoneyPrint = (n: number) => `${Number(n ?? 0).toFixed(2)} ${selected.currency ?? ''}`;
        const todayStr = new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
        const buildReportHTML = () => {
          const incomeRows: string[] = [];
          if (canViewSalary && baseSalary > 0) incomeRows.push(`<tr><td>الراتب الأساسي</td><td class="num green">${fmtMoneyPrint(baseSalary)}</td></tr>`);
          if ((selected.commission_rate ?? 0) > 0) incomeRows.push(`<tr><td>نسبة العمولة (${selected.commission_rate}%)</td><td class="num muted">—</td></tr>`);
          bonuses.forEach((b) => {
            const reason = b.reason ? ` — ${String(b.reason)}` : '';
            incomeRows.push(`<tr><td>حافز${reason}<div class="sub">${String(b.granted_date ?? '')}</div></td><td class="num green">${fmtMoneyPrint(Number(b.amount ?? 0))}</td></tr>`);
          });
          const dedRows: string[] = [];
          deductions.forEach((d) => {
            const info = dedLabel(String(d.deduction_type ?? 'other'));
            const reason = d.reason ? ` — ${String(d.reason)}` : '';
            dedRows.push(`<tr><td><span class="badge">${info.label}</span>${reason}<div class="sub">${String(d.deduction_date ?? '')}</div></td><td class="num red">${fmtMoneyPrint(Number(d.amount ?? 0))}</td></tr>`);
          });
          loans.filter((l) => Number(l.remaining_balance ?? 0) > 0).forEach((l) => {
            const reason = l.reason ? ` — ${String(l.reason)}` : '';
            dedRows.push(`<tr><td><span class="badge amber">سلفة</span>${reason}<div class="sub">متبقي من أصل ${fmtMoneyPrint(Number(l.requested_amount ?? 0))}</div></td><td class="num red">${fmtMoneyPrint(Number(l.remaining_balance ?? 0))}</td></tr>`);
          });
          return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>كشف حساب — ${selected.first_name_ar} ${selected.last_name_ar}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo','Tajawal','Arial',sans-serif;direction:rtl;background:#fff;color:#111827;font-size:13px;padding:24px}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #d97706;margin-bottom:20px}.h-title{font-size:20px;font-weight:900;color:#111}.h-sub{font-size:12px;color:#6b7280;margin-top:4px}.h-meta{text-align:left;font-size:11px;color:#6b7280}.h-meta .big{font-size:14px;color:#d97706;font-weight:800;margin-bottom:2px}.info{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.info .cell{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#fafafa}.info .label{font-size:10px;color:#6b7280;margin-bottom:3px}.info .val{font-size:13px;font-weight:700;color:#111}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}.summary .card{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}.summary .card .l{font-size:10px;color:#6b7280;margin-bottom:4px}.summary .card .v{font-size:16px;font-weight:900}.summary .green{background:#ecfdf5;border-color:#a7f3d0}.summary .green .v{color:#047857}.summary .red{background:#fef2f2;border-color:#fecaca}.summary .red .v{color:#b91c1c}.summary .net{background:#fffbeb;border-color:#fde68a}.summary .net .v{color:${netAmount>=0?'#059669':'#b91c1c'}}.section-title{font-size:13px;font-weight:800;padding:6px 12px;margin-top:14px;color:#92400e;background:#fef3c7;border-right:4px solid #d97706}table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px}th,td{padding:8px 12px;text-align:right;border-bottom:1px solid #f3f4f6}th{background:#f9fafb;font-weight:700;color:#374151;font-size:11px}td.num{font-family:'Courier New',monospace;font-weight:700;text-align:left;width:30%}td.num.green{color:#047857}td.num.red{color:#b91c1c}td.num.muted{color:#9ca3af}td .sub{font-size:10px;color:#9ca3af;margin-top:2px;font-family:'Courier New',monospace}.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;margin-left:6px}.badge.amber{background:#fef3c7;color:#92400e}tfoot td{background:#f3f4f6;font-weight:800;border-top:2px solid #d1d5db}.net-row td{background:${netAmount>=0?'#d1fae5':'#fee2e2'};color:${netAmount>=0?'#065f46':'#991b1b'};font-size:14px;padding:10px 12px}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;font-size:10px;color:#9ca3af}@media print{body{padding:16px}.no-print{display:none!important}@page{margin:16mm}}</style></head><body><div class="header"><div><div class="h-title">كشف حساب الموظف</div><div class="h-sub">${selected.first_name_ar} ${selected.last_name_ar} — كود ${selected.employee_code}</div></div><div class="h-meta"><div class="big">MUHKAM ERP</div><div>تاريخ الإصدار: ${todayStr}</div></div></div><div class="info"><div class="cell"><div class="label">القسم</div><div class="val">${selected.department_name??'—'}</div></div><div class="cell"><div class="label">الوظيفة</div><div class="val">${selected.job_title_name??'—'}</div></div><div class="cell"><div class="label">تاريخ التعيين</div><div class="val">${selected.hire_date??'—'}</div></div><div class="cell"><div class="label">الحالة</div><div class="val">${selected.employment_status==='active'?'نشط':selected.employment_status}</div></div></div><div class="summary"><div class="card green"><div class="l">إجمالي الدخل</div><div class="v">${fmtMoneyPrint(totalIncome)}</div></div><div class="card red"><div class="l">إجمالي الخصومات</div><div class="v">${fmtMoneyPrint(totalDeductionsAll)}</div></div><div class="card net"><div class="l">الصافي المستحق</div><div class="v">${fmtMoneyPrint(netAmount)}</div></div></div><div class="section-title">بنود الدخل</div><table><thead><tr><th>البند</th><th style="text-align:left">المبلغ</th></tr></thead><tbody>${incomeRows.length?incomeRows.join(''):'<tr><td colspan="2" class="empty">لا توجد بنود دخل</td></tr>'}</tbody><tfoot><tr><td>إجمالي الدخل</td><td class="num green">${fmtMoneyPrint(totalIncome)}</td></tr></tfoot></table><div class="section-title">الخصومات والسلف</div><table><thead><tr><th>البند</th><th style="text-align:left">المبلغ</th></tr></thead><tbody>${dedRows.length?dedRows.join(''):'<tr><td colspan="2" class="empty">لا توجد خصومات أو سلف</td></tr>'}</tbody><tfoot><tr><td>إجمالي الخصومات</td><td class="num red">${fmtMoneyPrint(totalDeductionsAll)}</td></tr></tfoot></table><table style="margin-top:6px"><tr class="net-row"><td>الصافي المستحق</td><td class="num" style="text-align:left">${fmtMoneyPrint(netAmount)}</td></tr></table><div class="footer">تم إصدار هذا الكشف من نظام MUHKAM ERP — ${todayStr}</div></body></html>`;
        };
        const openReport = (autoPrint: boolean) => openPrintWindow(buildReportHTML(), { width: 900, height: 700, ...(autoPrint ? { delay: 400 } : {}) });
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => openReport(true)} className="erp-btn flex items-center gap-1.5 text-xs px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-white">
                <Printer size={14} /> طباعة
              </button>
              <button onClick={() => openReport(false)} className="erp-btn flex items-center gap-1.5 text-xs px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-300">
                <Download size={14} /> معاينة / PDF
              </button>
            </div>
            <div className={`rounded-xl p-4 border-2 ${netAmount >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="text-xs text-white/50 mb-1">الصافي المستحق</div>
              <div className={`text-2xl font-bold font-mono ${netAmount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {fmt(netAmount)} {selected.currency}
              </div>
              <div className="text-[10px] text-white/40 mt-1">= دخل ({fmt(totalIncome)}) − خصومات ({fmt(totalDeductionsAll)})</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-white/5 border-b border-white/10 text-[10px] font-bold text-white/50 uppercase">
                <div>البند</div><div className="text-center w-20">دخل</div><div className="text-center w-20">صرف</div>
              </div>
              <div className="px-3 py-1.5 bg-emerald-500/10 text-[10px] font-bold text-emerald-300 flex items-center gap-1 sticky top-0 z-10">
                <Plus size={10} /> الدخل
              </div>
              <div className="max-h-[200px] overflow-y-auto thin-scroll">
                {canViewSalary && baseSalary > 0 && (
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                    <div className="text-white/70">الراتب الأساسي</div>
                    <div className="font-mono font-semibold text-emerald-300 w-20 text-center">{fmt(baseSalary)}</div>
                    <div className="w-20"></div>
                  </div>
                )}
                {(selected.commission_rate ?? 0) > 0 && (
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                    <div className="text-white/70">نسبة العمولة <span className="text-purple-300 font-mono">({selected.commission_rate}%)</span></div>
                    <div className="font-mono text-white/30 w-20 text-center">—</div>
                    <div className="w-20"></div>
                  </div>
                )}
                {bonuses.map((b) => (
                  <div key={`bonus-${String(b.id)}`} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                    <div className="min-w-0">
                      <div className="text-white/70 truncate">حافز{b.reason ? ` — ${String(b.reason)}` : ''}</div>
                      <div className="text-[10px] text-white/30 font-mono">{String(b.granted_date ?? '')}</div>
                    </div>
                    <div className="font-mono font-semibold text-emerald-300 w-20 text-center">{fmt(b.amount)}</div>
                    <div className="w-20"></div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-emerald-500/5 border-b border-white/10 text-xs font-bold">
                <div className="text-emerald-300">إجمالي الدخل</div>
                <div className="font-mono text-emerald-300 w-20 text-center">{fmt(totalIncome)}</div>
                <div className="w-20"></div>
              </div>
              <div className="px-3 py-1.5 bg-red-500/10 text-[10px] font-bold text-red-300 flex items-center gap-1">
                <MinusCircle size={10} /> الصرف / الخصومات
              </div>
              <div className="max-h-[200px] overflow-y-auto thin-scroll">
                {deductions.map((d) => {
                  const info = dedLabel(String(d.deduction_type ?? 'other'));
                  return (
                    <div key={`ded-${String(d.id)}`} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                      <div className="min-w-0">
                        <div className="text-white/70 truncate flex items-center gap-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${info.border} ${info.color} ${info.bg}`}>{info.label}</span>
                          {d.reason ? <span className="truncate">{String(d.reason)}</span> : null}
                        </div>
                        <div className="text-[10px] text-white/30 font-mono">{String(d.deduction_date ?? '')}</div>
                      </div>
                      <div className="w-20"></div>
                      <div className="font-mono font-semibold text-red-300 w-20 text-center">{fmt(d.amount)}</div>
                    </div>
                  );
                })}
                {loans.filter((l) => Number(l.remaining_balance ?? 0) > 0).map((l) => (
                  <div key={`loan-${String(l.id)}`} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                    <div className="min-w-0">
                      <div className="text-white/70 truncate flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-500/30 text-amber-300 bg-amber-500/10">سلفة</span>
                        {l.reason ? <span className="truncate">{String(l.reason)}</span> : null}
                      </div>
                      <div className="text-[10px] text-white/30 font-mono">متبقي من أصل {fmt(l.requested_amount)}</div>
                    </div>
                    <div className="w-20"></div>
                    <div className="font-mono font-semibold text-amber-300 w-20 text-center">{fmt(l.remaining_balance)}</div>
                  </div>
                ))}
                {deductions.length === 0 && remainingLoans === 0 && (
                  <div className="px-3 py-3 text-center text-[11px] text-white/30">لا توجد خصومات أو سلف</div>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-red-500/5 border-b border-white/10 text-xs font-bold">
                <div className="text-red-300">إجمالي الصرف</div>
                <div className="w-20"></div>
                <div className="font-mono text-red-300 w-20 text-center">{fmt(totalDeductionsAll)}</div>
              </div>
              <div className={`grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-3 text-sm font-bold ${netAmount >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                <div className={netAmount >= 0 ? 'text-emerald-200' : 'text-red-200'}>الصافي المستحق</div>
                <div className="w-20"></div>
                <div className={`font-mono w-20 text-center ${netAmount >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>{fmt(netAmount)}</div>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-white/70 border-b border-white/10 pb-1.5">السلف</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-sm font-bold text-white/70">{loans.length}</div><div className="text-[10px] text-white/40 mt-0.5">العدد</div></div>
                <div><div className="text-sm font-bold text-amber-300 font-mono">{fmt(totalLoans)}</div><div className="text-[10px] text-white/40 mt-0.5">إجمالي</div></div>
                <div><div className="text-sm font-bold text-red-400 font-mono">{fmt(remainingLoans)}</div><div className="text-[10px] text-white/40 mt-0.5">متبقي</div></div>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">تاريخ التعيين</span>
                <span className="font-mono text-white/70">{selected.hire_date}</span>
              </div>
              {selected.national_id && (
                <div className="flex justify-between">
                  <span className="text-white/40">رقم البطاقة</span>
                  <span className="font-mono text-white/70">{selected.national_id}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Documents Tab ── */}
      {detailTab === 'docs' && (
        <EmployeeDocuments selected={selected} documents={documents} />
      )}

      {/* ── Bonuses Tab ── */}
      {detailTab === 'bonuses' && (
        <div className="space-y-2">
          {canManage && (
            <button onClick={onAddBonus} className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1">
              <Plus size={12} /> إضافة حافز
            </button>
          )}
          {bonuses.length === 0 ? (
            <div className="text-center py-6 text-white/30 text-xs">
              <Award size={28} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد حوافز لهذا الموظف</p>
            </div>
          ) : (
            <div className={`space-y-2 ${bonuses.length > 5 ? 'max-h-[260px] overflow-y-auto pr-1 thin-scroll' : ''}`}>
              {bonuses.map((b) => (
                <div key={String(b.id)} className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-emerald-300 font-mono">+ {fmt(b.amount)} {String(b.currency ?? 'EGP')}</div>
                      {b.reason ? <div className="text-xs text-white/60 mt-1">{String(b.reason)}</div> : null}
                      <div className="text-xs text-white/30 font-mono mt-1">{String(b.granted_date ?? '')}</div>
                    </div>
                    {canManage && (
                      <button onClick={() => onDeleteBonus(b.id as number)} className="text-red-400/60 hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="bg-white/5 rounded-lg p-2 text-xs text-center">
                إجمالي الحوافز: <span className="text-emerald-300 font-bold font-mono">{fmt(bonuses.reduce((s, b) => s + Number(b.amount ?? 0), 0))}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Custody Tab ── */}
      {detailTab === 'custody' && (
        <div className="space-y-2">
          {canManage && (
            <button onClick={onAddCustody} className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1">
              <Plus size={12} /> إضافة عهدة
            </button>
          )}
          {custody.length === 0 ? (
            <div className="text-center py-6 text-white/30 text-xs">
              <Package size={28} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد عهد لهذا الموظف</p>
            </div>
          ) : (
            <div className="space-y-2">
              {custody.map((c) => {
                const isOpen = String(c.status) === 'open';
                const reimbursement = Number(c.reimbursement_due ?? 0);
                const isExpanded = expandedCustody === Number(c.id);
                return (
                  <div key={String(c.id)} className={`rounded-lg p-3 border ${isOpen ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-amber-300 font-mono">{fmt(c.amount)} {String(c.currency ?? 'EGP')}</div>
                        {c.purpose ? <div className="text-xs text-white/60 mt-1">{String(c.purpose)}</div> : null}
                        <div className="text-xs text-white/30 font-mono mt-1">{String(c.granted_date ?? '')}</div>
                        {!isOpen && (
                          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                            <CheckCircle size={10} /> مردودة: <span className="font-mono">{fmt(c.returned_amount)}</span>
                            {c.settled_date ? ` — ${String(c.settled_date)}` : ''}
                          </div>
                        )}
                        {reimbursement > 0 && (
                          <div className="text-xs text-rose-300 mt-1 flex items-center gap-2 bg-rose-500/10 border border-rose-400/30 rounded px-2 py-1">
                            <span>مستحق للموظف: <span className="font-mono font-bold">{fmt(reimbursement)}</span></span>
                            {canManage && (
                              <button
                                onClick={() => onReimburseCustody(Number(c.id))}
                                className="erp-btn erp-btn-ghost text-xs text-emerald-300 border border-emerald-400/40 px-2 py-0.5"
                              >
                                صرف المستحقات
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <span className={isOpen ? 'erp-badge erp-badge-warning' : 'erp-badge erp-badge-success'}>
                        {isOpen ? 'مفتوحة' : 'مسواة'}
                      </span>
                    </div>
                    {canManage && isOpen && (
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => onSettleCustody(c.id as number)}
                          className="erp-btn erp-btn-ghost text-xs text-emerald-400 border border-emerald-500/30 p-1"
                        >
                          تسوية
                        </button>
                        <button
                          onClick={() => onDeleteCustody(c.id as number)}
                          className="erp-btn erp-btn-ghost text-xs text-red-400 border border-red-500/30 p-1"
                        >
                          حذف
                        </button>
                      </div>
                    )}
                    {!isOpen && (
                      <button
                        onClick={() => setExpandedCustody(isExpanded ? null : Number(c.id))}
                        className="erp-btn erp-btn-ghost text-xs text-white/60 mt-2"
                      >
                        {isExpanded ? '▲ إخفاء التفاصيل' : '▼ عرض بنود التسوية'}
                      </button>
                    )}
                    {!isOpen && isExpanded && <CustodyLinesPanel custodyId={Number(c.id)} />}
                  </div>
                );
              })}
              <div className="bg-white/5 rounded-lg p-2 text-xs text-center">
                عهد مفتوحة:{' '}
                <span className="text-amber-300 font-bold font-mono">
                  {fmt(custody.filter((c) => String(c.status) === 'open').reduce((s, c) => s + Number(c.amount ?? 0) - Number(c.returned_amount ?? 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Repairs (بطاقات الإصلاح) Tab ── */}
      {detailTab === 'repairs' && (
        <EmployeeRepairsTab employeeId={selected.id} />
      )}

      {/* ── Maintenance Tab (Admin/Manager only) ── */}
      {detailTab === 'maintenance' && canViewMaintenance && (
        <EmployeeMaintenanceTab employeeId={selected.id} />
      )}
    </div>
  );
}
