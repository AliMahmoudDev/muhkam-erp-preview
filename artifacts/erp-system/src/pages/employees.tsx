import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import {
  UserCheck,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  UserX,
  FileText,
  Phone,
  IdCard,
  Building2,
  Briefcase,
  CalendarDays,
  Wallet,
  ChevronLeft,
  Banknote,
  MinusCircle,
  BarChart2,
  Percent,
  Award,
  Package,
  CheckCircle,
  Printer,
  Download,
  UserPlus,
  KeyRound,
} from 'lucide-react';
import { api } from '@/lib/api';


/* ── Types ────────────────────────────────────────────────────── */
interface Employee {
  id: number;
  company_id: number;
  employee_code: string;
  first_name_ar: string;
  last_name_ar: string;
  first_name_en: string;
  last_name_en: string;
  email?: string | null;
  phone?: string | null;
  personal_phone?: string | null;
  national_id?: string | null;
  national_id_image?: string | null;
  job_title_id?: number | null;
  department_id?: number | null;
  branch_id?: number | null;
  hire_date: string;
  employment_status: string;
  salary?: number | null;
  currency: string;
  salary_type?: 'fixed' | 'commission' | 'fixed_plus_commission';
  commission_rate?: number | null;
  commission_basis?: 'gross' | 'net' | null;
  commission_scope_dept_id?: number | null;
  bank_account?: string | null;
  address_ar?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  department_name?: string | null;
  job_title_name?: string | null;
  branch_name?: string | null;
  created_at?: string;
  updated_at?: string;
}
interface Department {
  id: number;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
}
interface JobTitle {
  id: number;
  name_ar: string;
  name_en: string;
}
interface Branch {
  id: number;
  name: string;
  is_active: boolean;
}
interface EmpDocument {
  id: number;
  document_type: string;
  file_name: string;
  expiry_date?: string | null;
  verified_at?: string | null;
  notes?: string | null;
  created_at?: string;
}
type AnyRec = Record<string, unknown>;

/* ── Helpers ──────────────────────────────────────────────────── */
function CustodyLinesPanel({ custodyId }: { custodyId: number }) {
  const { data, isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['/api/employee-custody', custodyId, 'lines'],
    queryFn: async () => {
      const r = await authFetch(`/api/employee-custody/${custodyId}/lines`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });
  if (isLoading) {
    return <div className="text-xs text-white/40 mt-2 text-center py-2">جارِ التحميل…</div>;
  }
  const lines = data ?? [];
  if (lines.length === 0) {
    return (
      <div className="text-xs text-white/40 mt-2 text-center py-2 bg-white/5 rounded">
        لا توجد بنود مصروفات
      </div>
    );
  }
  return (
    <div className="mt-2 bg-black/20 rounded border border-white/10 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-white/5 text-white/50">
          <tr>
            <th className="text-right p-1.5">المبلغ</th>
            <th className="text-right p-1.5">النوع</th>
            <th className="text-right p-1.5">الوصف</th>
            <th className="text-right p-1.5">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={String(l['id'])} className="border-t border-white/5">
              <td className="p-1.5 font-mono text-amber-300">
                {Number(l['amount'] ?? 0).toFixed(2)}
              </td>
              <td className="p-1.5 text-white/70">{String(l['category'] ?? '')}</td>
              <td className="p-1.5 text-white/60">{String(l['description'] ?? '—')}</td>
              <td className="p-1.5 font-mono text-white/40">
                {String(l['line_date'] ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
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
    approved: 'erp-badge erp-badge-success',
    active: 'erp-badge erp-badge-success',
    pending: 'erp-badge erp-badge-warning',
    rejected: 'erp-badge erp-badge-danger',
    completed: 'erp-badge erp-badge-info',
    cancelled: 'erp-badge erp-badge-neutral',
  };
  return map[s] ?? 'erp-badge erp-badge-neutral';
}
function advStatusAr(s: string) {
  const m: Record<string, string> = {
    pending: 'معلّق',
    approved: 'معتمد',
    active: 'نشط',
    rejected: 'مرفوض',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };
  return m[s] ?? s;
}

/* ── Blank form ───────────────────────────────────────────────── */
function blankEmp(): Partial<Employee> {
  return {
    first_name_ar: '',
    last_name_ar: '',
    first_name_en: '',
    last_name_en: '',
    phone: '',
    national_id: '',
    national_id_image: null,
    email: '',
    job_title_id: null,
    department_id: null,
    branch_id: null,
    hire_date: new Date().toISOString().split('T')[0],
    salary: 0,
    currency: 'EGP',
    salary_type: 'fixed',
    commission_rate: null,
    commission_basis: null,
    commission_scope_dept_id: null,
    bank_account: '',
    address_ar: '',
    country: 'مصر',
    notes: '',
  };
}

/* ══════════════════════════════════════════════════════════════ */
export default function Employees() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'can_manage_employees');
  const canViewSalary = hasPermission(user, 'can_view_employee_salary');
  // Self-service portal: when role==='employee', auto-show only own profile
  const isSelfService = user?.role === 'employee';
  const selfEmpId = user?.employee_id ?? null;
  const [showCreateLogin, setShowCreateLogin] = useState(false);
  const [loginForm, setLoginForm] = useState<{ username: string; pin: string }>({ username: '', pin: '' });

  /* ── List state ─────────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<number | ''>('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [detailTab, setDetailTab] = useState<
    'info' | 'loans' | 'deductions' | 'reports' | 'docs' | 'bonuses' | 'custody'
  >('info');

  /* ── Form state ─────────────────────────────────────────────── */
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp] = useState<Partial<Employee>>(blankEmp());
  const [editId, setEditId] = useState<number | null>(null);

  /* ── Inline dept add ───────────────────────────────────────── */
  const [showInlineDept, setShowInlineDept] = useState(false);
  const [inlineDept, setInlineDept] = useState({ name_ar: '' });

  /* ── Inline job title add ──────────────────────────────────── */
  const [showInlineJt, setShowInlineJt] = useState(false);
  const [inlineJt, setInlineJt] = useState({ name_ar: '' });

  /* ── Other dialogs ─────────────────────────────────────────── */
  const [deleteId, setDeleteId] = useState<number | null>(null);

  /* ── Loans (salary advances) state ────────────────────────── */
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanForm, setLoanForm] = useState({
    requested_amount: '',
    advance_type: 'personal',
    reason: '',
    deduct_from: 'fixed' as 'fixed' | 'commission' | 'both',
    safe_id: '' as string | number,
  });
  const [showPayModal, setShowPayModal] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');

  /* ── Deductions state ──────────────────────────────────────── */
  const [showDeductForm, setShowDeductForm] = useState(false);
  const [deductForm, setDeductForm] = useState({
    amount: '',
    reason: '',
    deduction_type: 'late' as 'late' | 'absence' | 'damage' | 'other',
    deduction_date: new Date().toISOString().split('T')[0],
  });

  /* ── Bonuses (الحافز) state ────────────────────────────────── */
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [bonusForm, setBonusForm] = useState({
    amount: '',
    reason: '',
    granted_date: new Date().toISOString().split('T')[0],
  });

  /* ── Custody (عهدة) state ──────────────────────────────────── */
  const [showCustodyForm, setShowCustodyForm] = useState(false);
  const [custodyForm, setCustodyForm] = useState({
    amount: '',
    purpose: '',
    granted_date: new Date().toISOString().split('T')[0],
    notes: '',
    safe_id: '' as string | number,
  });
  const [showSettleCustody, setShowSettleCustody] = useState<number | null>(null);
  const [expandedCustody, setExpandedCustody] = useState<number | null>(null);
  const [showReimburseCustody, setShowReimburseCustody] = useState<number | null>(null);
  const [reimburseSafeId, setReimburseSafeId] = useState<string>('');
  const [reimburseNotes, setReimburseNotes] = useState<string>('');
  type SettleLine = { amount: string; category: string; description: string; date: string };
  const blankSettleLine = (): SettleLine => ({
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [settleLines, setSettleLines] = useState<SettleLine[]>([blankSettleLine()]);
  const [settleNotes, setSettleNotes] = useState('');

  /* ── Queries ─────────────────────────────────────────────── */
  const { data: empsRaw, isLoading: empsLoading } = useQuery({
    queryKey: ['/api/employees', search, deptFilter],
    queryFn: () =>
      authFetch(
        api(
          `/api/employees?search=${encodeURIComponent(search)}&department_id=${deptFilter}`
        )
      ).then((r) => r.json()),
  });
  const employees: Employee[] = safeArray(empsRaw);

  // Self-service: auto-select own employee record once data arrives
  useEffect(() => {
    if (isSelfService && selfEmpId && employees.length > 0 && !selected) {
      const own = employees.find((e) => e.id === selfEmpId);
      if (own) setSelected(own);
    }
  }, [isSelfService, selfEmpId, employees, selected]);

  const { data: deptsRaw } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: () => authFetch(api('/api/departments')).then((r) => r.json()),
  });
  const departments: Department[] = safeArray(deptsRaw);

  const { data: jtsRaw } = useQuery({
    queryKey: ['/api/job-titles'],
    queryFn: () => authFetch(api('/api/job-titles')).then((r) => r.json()),
  });
  const jobTitles: JobTitle[] = safeArray(jtsRaw);

  const { data: branchesRaw } = useQuery({
    queryKey: ['/api/branches'],
    queryFn: () => authFetch(api('/api/branches')).then((r) => r.json()),
  });
  const branches: Branch[] = safeArray(branchesRaw);

  /* All safes (خزائن) — filter per employee branch in form */
  const { data: safesRaw } = useQuery({
    queryKey: ['/api/settings/safes'],
    queryFn: () => authFetch(api('/api/settings/safes')).then((r) => r.json()),
  });
  const safes: AnyRec[] = safeArray(safesRaw);
  const { data: expCatsRaw } = useQuery({
    queryKey: ['/api/expense-categories'],
    queryFn: () => authFetch(api('/api/expense-categories')).then((r) => r.json()),
  });
  const expenseCategories: AnyRec[] = safeArray(expCatsRaw);

  const safesForEmployee = (emp: Employee | null) =>
    safes.filter(
      (s) =>
        s.branch_id == null ||
        emp?.branch_id == null ||
        Number(s.branch_id) === Number(emp.branch_id)
    );

  /* Employee sub-data */
  const { data: docsRaw } = useQuery({
    queryKey: ['/api/employees', selected?.id, 'documents'],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employees/${selected.id}/documents`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && detailTab === 'docs',
  });
  const documents: EmpDocument[] = safeArray(docsRaw);

  /* Bonuses for this employee */
  const { data: bonusesRaw } = useQuery({
    queryKey: ['/api/employee-bonuses', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employee-bonuses?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'bonuses' || detailTab === 'reports'),
  });
  const bonuses: AnyRec[] = safeArray(bonusesRaw);

  /* Custody for this employee */
  const { data: custodyRaw } = useQuery({
    queryKey: ['/api/employee-custody', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employee-custody?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'custody' || detailTab === 'reports'),
  });
  const custody: AnyRec[] = safeArray(custodyRaw);

  /* Salary advances for this employee */
  const { data: loansRaw, isLoading: loansLoading } = useQuery({
    queryKey: ['/api/salary-advances', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/salary-advances?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'loans' || detailTab === 'reports'),
  });
  const loans: AnyRec[] = safeArray(loansRaw);

  /* Standalone deductions (no loan required) — categorized: late/absence/damage/other */
  const { data: deductionsRaw, isLoading: ledgerLoading } = useQuery({
    queryKey: ['/api/employee-deductions', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employee-deductions?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'deductions' || detailTab === 'reports'),
  });
  const deductions: AnyRec[] = safeArray(deductionsRaw);

  /* ── Employee mutations ───────────────────────────────────── */
  const createEmp = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      authFetch(api('/api/employees'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowForm(false);
      toast({ title: 'تمت إضافة الموظف بنجاح' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const updateEmp = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      authFetch(api(`/api/employees/${editId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowForm(false);
      toast({ title: 'تم تحديث بيانات الموظف' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const deleteEmp = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employees/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employees'] });
      setDeleteId(null);
      setSelected(null);
      toast({ title: 'تم حذف الموظف' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  /* ── Bonuses + Custody mutations ─────────────────────────── */
  const createBonus = useMutation({
    mutationFn: (data: AnyRec) =>
      authFetch(api('/api/employee-bonuses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-bonuses', selected?.id] });
      setShowBonusForm(false);
      setBonusForm({
        amount: '',
        reason: '',
        granted_date: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'تمت إضافة الحافز' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const deleteBonus = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employee-bonuses/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-bonuses', selected?.id] });
      toast({ title: 'تم حذف الحافز' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const createCustody = useMutation({
    mutationFn: (data: AnyRec) =>
      authFetch(api('/api/employee-custody'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', selected?.id] });
      setShowCustodyForm(false);
      setCustodyForm({
        amount: '',
        purpose: '',
        granted_date: new Date().toISOString().split('T')[0],
        notes: '',
        safe_id: '',
      });
      toast({ title: 'تمت إضافة العهدة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const settleCustody = useMutation({
    mutationFn: (payload: {
      id: number;
      lines: { amount: number; category: string; description: string | null; date: string }[];
      returned_amount: number;
      notes: string | null;
    }) =>
      authFetch(api(`/api/employee-custody/${payload.id}/settle`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: payload.lines,
          returned_amount: payload.returned_amount,
          notes: payload.notes,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', selected?.id] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setShowSettleCustody(null);
      setSettleLines([blankSettleLine()]);
      setSettleNotes('');
      toast({ title: 'تم تسوية العهدة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const reimburseCustody = useMutation({
    mutationFn: (vars: { id: number; safe_id: number; notes?: string }) =>
      authFetch(api(`/api/employee-custody/${vars.id}/reimburse`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safe_id: vars.safe_id, notes: vars.notes }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', selected?.id] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setShowReimburseCustody(null);
      setReimburseSafeId('');
      setReimburseNotes('');
      toast({ title: 'تم صرف المستحقات' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const deleteCustody = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employee-custody/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-custody', selected?.id] });
      toast({ title: 'تم حذف العهدة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Inline dept/jt creation ─────────────────────────────── */
  const createInlineDept = useMutation({
    mutationFn: (data: { name_ar: string }) =>
      authFetch(api('/api/departments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, description_ar: '' }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: (d: Department) => {
      qc.invalidateQueries({ queryKey: ['/api/departments'] });
      setEditEmp((p) => ({ ...p, department_id: d.id }));
      setShowInlineDept(false);
      setInlineDept({ name_ar: '' });
      toast({ title: 'تمت إضافة القسم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const createInlineJt = useMutation({
    mutationFn: (data: { name_ar: string }) =>
      authFetch(api('/api/job-titles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: (d: JobTitle) => {
      qc.invalidateQueries({ queryKey: ['/api/job-titles'] });
      setEditEmp((p) => ({ ...p, job_title_id: d.id }));
      setShowInlineJt(false);
      setInlineJt({ name_ar: '' });
      toast({ title: 'تمت إضافة المسمى الوظيفي' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Loans mutations ─────────────────────────────────────── */
  const createLoan = useMutation({
    mutationFn: (data: AnyRec) =>
      authFetch(api('/api/salary-advances'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', selected?.id] });
      setShowLoanForm(false);
      setLoanForm({ requested_amount: '', advance_type: 'personal', reason: '', deduct_from: 'fixed', safe_id: '' });
      toast({ title: 'تم تقديم طلب السلفة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const approveLoan = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/salary-advances/${id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', selected?.id] });
      toast({ title: 'تم اعتماد السلفة' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const manualPay = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      authFetch(api(`/api/salary-advances/${id}/manual-payment`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', selected?.id] });
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', selected?.id, 'ledger'] });
      setShowPayModal(null);
      setPayAmount('');
      toast({ title: 'تم تسجيل الدفعة / الخصم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Standalone deduction mutations ───────────────────────── */
  const createDeduction = useMutation({
    mutationFn: (payload: {
      amount: number;
      reason: string;
      deduction_type: string;
      deduction_date: string;
    }) =>
      authFetch(api('/api/employee-deductions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, employee_id: selected?.id }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'فشل تسجيل الخصم');
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-deductions', selected?.id] });
      setShowDeductForm(false);
      setDeductForm({
        amount: '',
        reason: '',
        deduction_type: 'late',
        deduction_date: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'تم تسجيل الخصم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const deleteDeduction = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/employee-deductions/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'فشل الحذف');
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/employee-deductions', selected?.id] });
      toast({ title: 'تم حذف الخصم' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Deduction type labels / colors ──────────────────────── */
  const DEDUCTION_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    late:    { label: 'تأخير',         color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    absence: { label: 'غياب',          color: 'text-red-300',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
    damage:  { label: 'تلف/خسائر',     color: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
    other:   { label: 'أخرى',          color: 'text-white/70',    bg: 'bg-white/5',        border: 'border-white/10' },
  };
  const dedLabel = (t: string) => DEDUCTION_LABELS[t] ?? DEDUCTION_LABELS['other'];
  const deductionsByType = (t: string) =>
    deductions.filter((d) => String(d.deduction_type) === t).reduce((s, d) => s + Number(d.amount ?? 0), 0);

  /* ── Filtered employees ───────────────────────────────────── */
  const filtered = useMemo(
    () =>
      employees.filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.first_name_ar.includes(search) ||
          e.last_name_ar.includes(search) ||
          e.first_name_en.toLowerCase().includes(q) ||
          e.last_name_en.toLowerCase().includes(q) ||
          e.employee_code.toLowerCase().includes(q) ||
          (e.national_id ?? '').includes(search)
        );
      }),
    [employees, search]
  );

  /* ── Helpers ─────────────────────────────────────────────── */
  const set = (k: keyof Employee, v: unknown) => setEditEmp((prev) => ({ ...prev, [k]: v }));

  function openCreate() {
    setEditId(null);
    setEditEmp(blankEmp());
    setShowForm(true);
  }
  function openEdit(emp: Employee) {
    const inferredType: 'fixed' | 'commission' | 'fixed_plus_commission' =
      emp.salary_type ??
      ((emp.commission_rate ?? 0) > 0 && (emp.salary ?? 0) > 0
        ? 'fixed_plus_commission'
        : (emp.commission_rate ?? 0) > 0
          ? 'commission'
          : 'fixed');
    setEditId(emp.id);
    setEditEmp({ ...emp, salary_type: inferredType });
    setShowForm(true);
  }
  function saveEmployee() {
    const st = editEmp.salary_type ?? 'fixed';
    const phone = (editEmp.phone ?? '').toString().trim();
    const nid = (editEmp.national_id ?? '').toString().trim();
    if (phone && !/^\d{11}$/.test(phone)) {
      toast({ title: 'رقم الهاتف يجب أن يكون 11 رقم بالضبط', variant: 'destructive' });
      return;
    }
    if (nid && !/^\d{14}$/.test(nid)) {
      toast({ title: 'الرقم القومي يجب أن يكون 14 رقم بالضبط', variant: 'destructive' });
      return;
    }
    const payload: Partial<Employee> = {
      ...editEmp,
      phone: phone || null,
      national_id: nid || null,
      salary_type: st,
      salary: st === 'commission' ? 0 : Number(editEmp.salary ?? 0),
      commission_rate: st === 'fixed' ? null : Number(editEmp.commission_rate ?? 0),
      commission_basis: st === 'fixed' ? null : (editEmp.commission_basis ?? 'gross'),
      commission_scope_dept_id: st === 'fixed' ? null : (editEmp.commission_scope_dept_id ?? null),
    };
    if (editId) updateEmp.mutate(payload);
    else createEmp.mutate(payload);
  }

  /* Reports summary */
  const totalLoans = loans.reduce((s, l) => s + Number(l.requested_amount ?? 0), 0);
  const remainingLoans = loans
    .filter((l) => ['active', 'approved'].includes(String(l.status)))
    .reduce((s, l) => s + Number(l.remaining_balance ?? 0), 0);
  const totalDeducted = deductions.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const totalActive = employees.filter((e) => e.employment_status === 'active').length;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">إدارة الموظفين</h1>
          <span className="erp-badge erp-badge-info">{totalActive} نشط</span>
        </div>
      </div>
      {/* Main grid */}
      <div className={`grid grid-cols-1 ${isSelfService ? '' : 'xl:grid-cols-3'} gap-4`}>
        {/* ── Left: List Panel (hidden in self-service mode) ─── */}
        {!isSelfService && (
        <div className="xl:col-span-2 space-y-3">
          {/* Search & Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute top-1/2 -translate-y-1/2 right-3 text-white/40"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الكود أو الرقم القومي..."
                className="erp-input w-full text-sm pl-[20px] pr-[20px]"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="erp-input text-sm pl-[8px] pr-[8px] ml-[250px] mr-[250px]"
            >
              <option value="">كل الأقسام</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name_ar}
                </option>
              ))}
            </select>
            {canManage && (
              <button
                onClick={openCreate}
                className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
              >
                <Plus size={14} /> موظف جديد
              </button>
            )}
          </div>

          {/* Table */}
          <div className="erp-card overflow-x-auto">
            {empsLoading ? (
              <TableSkeleton />
            ) : (
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">الكود</th>
                    <th className="p-3 text-right text-xs">الاسم</th>
                    <th className="p-3 text-right text-xs">القسم</th>
                    <th className="p-3 text-right text-xs">المسمى</th>
                    <th className="p-3 text-right text-xs">التعيين</th>
                    {canViewSalary && <th className="p-3 text-right text-xs">الراتب - عمولة</th>}
                    <th className="p-3 text-right text-xs"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-white/40">
                        <div className="erp-empty-state">
                          <UserCheck size={36} className="mb-2 opacity-30" />
                          <p>لا توجد بيانات موظفين</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      className={`erp-table-row cursor-pointer ${selected?.id === emp.id ? 'bg-amber-500/10' : ''}`}
                      onClick={() => {
                        setSelected(emp);
                        setDetailTab('info');
                      }}
                    >
                      <td className="p-3 text-xs font-mono text-amber-300">{emp.employee_code}</td>
                      <td className="p-3">
                        <div className="font-semibold text-sm">
                          {emp.first_name_ar} {emp.last_name_ar}
                        </div>
                        {emp.national_id && (
                          <div className="text-xs text-white/30 font-mono">{emp.national_id}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-white/70">{emp.department_name ?? '—'}</td>
                      <td className="p-3 text-sm text-white/70">{emp.job_title_name ?? '—'}</td>
                      <td className="p-3 text-xs text-white/60 font-mono">{emp.hire_date}</td>
                      {canViewSalary && (
                        <td className="p-3 text-sm font-mono">
                          {emp.commission_rate ? (
                            <span className="text-purple-300">{emp.commission_rate}%</span>
                          ) : emp.salary != null ? (
                            <span className="text-emerald-300">
                              {emp.salary.toLocaleString('ar-EG-u-nu-latn')} {emp.currency}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      <td className="p-3">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEdit(emp)}
                                className="erp-btn erp-btn-ghost p-1"
                                title="تعديل"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteId(emp.id)}
                                className="erp-btn erp-btn-ghost p-1 text-red-400"
                                title="حذف"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setSelected(emp);
                              setDetailTab('info');
                            }}
                            className="erp-btn erp-btn-ghost p-1 text-amber-400"
                            title="التفاصيل"
                          >
                            <ChevronLeft size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )}

        {/* ── Right: Detail Panel ──────────────────────────────── */}
        {selected && (
          <div className={`erp-card space-y-3 ${isSelfService ? 'xl:col-span-3' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-white">
                  {selected.first_name_ar} {selected.last_name_ar}
                </div>
                <div className="text-xs text-amber-300 font-mono">{selected.employee_code}</div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && !isSelfService && (
                  <button
                    onClick={() => {
                      setLoginForm({ username: '', pin: '' });
                      setShowCreateLogin(true);
                    }}
                    className="erp-btn erp-btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                    title="إنشاء حساب دخول لهذا الموظف"
                  >
                    <UserPlus size={14} />
                    <span className="text-xs">إنشاء حساب دخول</span>
                  </button>
                )}
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
                  { key: 'info', label: 'البيانات', icon: IdCard },
                  { key: 'loans', label: 'السلف', icon: Banknote },
                  { key: 'deductions', label: 'الخصومات', icon: MinusCircle },
                  { key: 'bonuses', label: 'الحافز', icon: Award },
                  { key: 'custody', label: 'عهدة', icon: Package },
                  { key: 'reports', label: 'التقارير', icon: BarChart2 },
                  { key: 'docs', label: 'مستندات', icon: FileText },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setDetailTab(t.key)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-all ${
                    detailTab === t.key
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <t.icon size={11} /> {t.label}
                </button>
              ))}
            </div>

            {/* ── Info Tab ───────────────────────────────────── */}
            {detailTab === 'info' && (
              <div className="space-y-2 text-sm">
                <InfoRow icon={Phone} label="الهاتف" value={selected.phone} />
                <InfoRow icon={IdCard} label="رقم البطاقة" value={selected.national_id} />
                <InfoRow icon={Building2} label="القسم" value={selected.department_name} />
                <InfoRow icon={Briefcase} label="المسمى الوظيفي" value={selected.job_title_name} />
                <InfoRow icon={Building2} label="الفرع" value={selected.branch_name} />
                <InfoRow icon={CalendarDays} label="تاريخ التعيين" value={selected.hire_date} />
                {canViewSalary && (selected.salary ?? 0) > 0 && (
                  <InfoRow
                    icon={Wallet}
                    label="الراتب"
                    value={`${(selected.salary ?? 0).toLocaleString('ar-EG-u-nu-latn')} ${selected.currency}`}
                  />
                )}
                {canViewSalary && (selected.commission_rate ?? 0) > 0 && (
                  <InfoRow
                    icon={Percent}
                    label="نسبة العمولة"
                    value={`${selected.commission_rate}%`}
                  />
                )}
                {canViewSalary && selected.bank_account && (
                  <InfoRow icon={Wallet} label="الحساب البنكي" value={selected.bank_account} />
                )}
                {selected.address_ar && (
                  <InfoRow
                    icon={Building2}
                    label="العنوان"
                    value={`${selected.address_ar}${selected.city ? ` — ${selected.city}` : ''}`}
                  />
                )}
                {selected.notes && (
                  <div className="bg-white/5 rounded p-2 text-white/60 text-xs">
                    {selected.notes}
                  </div>
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

            {/* ── Loans Tab ──────────────────────────────────── */}
            {detailTab === 'loans' && (
              <div className="space-y-2">
                {(canManage || isSelfService) && (
                  <button
                    onClick={() => setShowLoanForm(true)}
                    className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1"
                  >
                    <Plus size={12} />
                    {isSelfService ? 'تقديم طلب سلفة' : 'طلب سلفة جديدة'}
                  </button>
                )}
                {loansLoading ? (
                  <TableSkeleton />
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
                            <span className="text-xs text-white/40 mr-2">
                              {String(l.advance_type ?? '')}
                            </span>
                          </div>
                          <span className={advStatusBadge(String(l.status))}>
                            {advStatusAr(String(l.status))}
                          </span>
                        </div>
                        {Number(l.remaining_balance) > 0 && (
                          <div className="text-xs text-red-400">
                            متبقي: <span className="font-mono">{fmt(l.remaining_balance)}</span>
                          </div>
                        )}
                        {!!l.reason && (
                          <div className="text-xs text-white/40">{String(l.reason)}</div>
                        )}
                        <div className="text-xs text-white/30 font-mono">
                          {String(l.requested_date ?? '')}
                        </div>
                        {canManage && (
                          <div className="flex gap-1 mt-2">
                            {l.status === 'pending' && (
                              <button
                                onClick={() => approveLoan.mutate(l.id as number)}
                                className="erp-btn erp-btn-ghost text-xs text-emerald-400 border border-emerald-500/30 p-1"
                              >
                                اعتماد
                              </button>
                            )}
                            {(l.status === 'active' || l.status === 'approved') && (
                              <button
                                onClick={() => {
                                  setShowPayModal(l.id as number);
                                  setPayAmount('');
                                }}
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

            {/* ── Deductions Tab ─────────────────────────────── */}
            {detailTab === 'deductions' && (
              <div className="space-y-2">
                {canManage && (
                  <button
                    onClick={() => setShowDeductForm(true)}
                    className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1"
                  >
                    <Plus size={12} /> إضافة خصم
                  </button>
                )}

                {/* Summary by category */}
                {deductions.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['late', 'absence', 'damage', 'other'] as const).map((t) => {
                      const info = dedLabel(t);
                      const total = deductionsByType(t);
                      return (
                        <div
                          key={t}
                          className={`${info.bg} border ${info.border} rounded-lg p-2 text-center`}
                        >
                          <div className={`text-[10px] ${info.color} opacity-80`}>{info.label}</div>
                          <div className={`text-xs font-bold ${info.color} font-mono mt-0.5`}>
                            {fmt(total)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {ledgerLoading ? (
                  <TableSkeleton />
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
                        <div
                          key={String(d.id)}
                          className={`${info.bg} border ${info.border} rounded-lg p-3`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${info.border} ${info.color} ${info.bg} font-semibold`}
                                >
                                  {info.label}
                                </span>
                                <span className={`text-sm font-bold ${info.color} font-mono`}>
                                  - {fmt(d.amount)}
                                </span>
                              </div>
                              {!!d.reason && (
                                <div className="text-xs text-white/60 mt-1">{String(d.reason)}</div>
                              )}
                              <div className="text-[10px] text-white/30 font-mono mt-1">
                                {String(d.deduction_date ?? '')}
                              </div>
                            </div>
                            {canManage && (
                              <button
                                onClick={() => deleteDeduction.mutate(Number(d.id))}
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
                      إجمالي الخصومات:{' '}
                      <span className="text-red-400 font-bold font-mono">{fmt(totalDeducted)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Reports Tab — Income & Deductions Statement ─ */}
            {detailTab === 'reports' && (() => {
              const baseSalary = Number(selected.salary ?? 0);
              const totalBonuses = bonuses.reduce((s, b) => s + Number(b.amount ?? 0), 0);
              const totalIncome = baseSalary + totalBonuses;
              const totalDeductionsAll = totalDeducted + remainingLoans;
              const netAmount = totalIncome - totalDeductionsAll;

              const fmtMoneyPrint = (n: number) =>
                `${Number(n ?? 0).toFixed(2)} ${selected.currency ?? ''}`;
              const todayStr = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
                year: 'numeric', month: 'long', day: 'numeric',
              });
              const buildReportHTML = () => {
                const incomeRows: string[] = [];
                if (canViewSalary && baseSalary > 0) {
                  incomeRows.push(
                    `<tr><td>الراتب الأساسي</td><td class="num green">${fmtMoneyPrint(baseSalary)}</td></tr>`
                  );
                }
                if ((selected.commission_rate ?? 0) > 0) {
                  incomeRows.push(
                    `<tr><td>نسبة العمولة (${selected.commission_rate}%)</td><td class="num muted">—</td></tr>`
                  );
                }
                bonuses.forEach((b) => {
                  const reason = b.reason ? ` — ${String(b.reason)}` : '';
                  incomeRows.push(
                    `<tr><td>حافز${reason}<div class="sub">${String(b.granted_date ?? '')}</div></td><td class="num green">${fmtMoneyPrint(Number(b.amount ?? 0))}</td></tr>`
                  );
                });

                const dedRows: string[] = [];
                deductions.forEach((d) => {
                  const info = dedLabel(String(d.deduction_type ?? 'other'));
                  const reason = d.reason ? ` — ${String(d.reason)}` : '';
                  dedRows.push(
                    `<tr><td><span class="badge">${info.label}</span>${reason}<div class="sub">${String(d.deduction_date ?? '')}</div></td><td class="num red">${fmtMoneyPrint(Number(d.amount ?? 0))}</td></tr>`
                  );
                });
                loans
                  .filter((l) => Number(l.remaining_balance ?? 0) > 0)
                  .forEach((l) => {
                    const reason = l.reason ? ` — ${String(l.reason)}` : '';
                    dedRows.push(
                      `<tr><td><span class="badge amber">سلفة</span>${reason}<div class="sub">متبقي من أصل ${fmtMoneyPrint(Number(l.requested_amount ?? 0))}</div></td><td class="num red">${fmtMoneyPrint(Number(l.remaining_balance ?? 0))}</td></tr>`
                    );
                  });

                return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>كشف حساب — ${selected.first_name_ar} ${selected.last_name_ar}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo','Tajawal','Arial',sans-serif; direction: rtl; background: #fff; color: #111827; font-size: 13px; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #d97706; margin-bottom: 20px; }
  .h-title { font-size: 20px; font-weight: 900; color: #111; }
  .h-sub { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .h-meta { text-align: left; font-size: 11px; color: #6b7280; }
  .h-meta .big { font-size: 14px; color: #d97706; font-weight: 800; margin-bottom: 2px; }
  .info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .info .cell { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #fafafa; }
  .info .label { font-size: 10px; color: #6b7280; margin-bottom: 3px; }
  .info .val { font-size: 13px; font-weight: 700; color: #111; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .summary .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .summary .card .l { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
  .summary .card .v { font-size: 16px; font-weight: 900; }
  .summary .green { background: #ecfdf5; border-color: #a7f3d0; } .summary .green .v { color: #047857; }
  .summary .red   { background: #fef2f2; border-color: #fecaca; } .summary .red .v   { color: #b91c1c; }
  .summary .net   { background: #fffbeb; border-color: #fde68a; } .summary .net .v   { color: ${netAmount >= 0 ? '#059669' : '#b91c1c'}; }
  .section-title { font-size: 13px; font-weight: 800; padding: 6px 12px; margin-top: 14px; color: #92400e; background: #fef3c7; border-right: 4px solid #d97706; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
  th, td { padding: 8px 12px; text-align: right; border-bottom: 1px solid #f3f4f6; }
  th { background: #f9fafb; font-weight: 700; color: #374151; font-size: 11px; }
  td.num { font-family: 'Courier New', monospace; font-weight: 700; text-align: left; width: 30%; }
  td.num.green { color: #047857; } td.num.red { color: #b91c1c; } td.num.muted { color: #9ca3af; }
  td .sub { font-size: 10px; color: #9ca3af; margin-top: 2px; font-family: 'Courier New', monospace; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #fee2e2; color: #991b1b; font-size: 10px; font-weight: 700; margin-left: 6px; }
  .badge.amber { background: #fef3c7; color: #92400e; }
  tfoot td { background: #f3f4f6; font-weight: 800; border-top: 2px solid #d1d5db; }
  .net-row td { background: ${netAmount >= 0 ? '#d1fae5' : '#fee2e2'}; color: ${netAmount >= 0 ? '#065f46' : '#991b1b'}; font-size: 14px; padding: 10px 12px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
  .empty { padding: 14px; color: #9ca3af; text-align: center; font-size: 12px; }
  @media print { body { padding: 16px; } .no-print { display: none !important; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="h-title">كشف حساب الموظف</div>
      <div class="h-sub">${selected.first_name_ar} ${selected.last_name_ar} — كود ${selected.employee_code}</div>
    </div>
    <div class="h-meta">
      <div class="big">MUHKAM ERP</div>
      <div>تاريخ الإصدار: ${todayStr}</div>
    </div>
  </div>

  <div class="info">
    <div class="cell"><div class="label">القسم</div><div class="val">${selected.department_name ?? '—'}</div></div>
    <div class="cell"><div class="label">الوظيفة</div><div class="val">${selected.job_title_name ?? '—'}</div></div>
    <div class="cell"><div class="label">تاريخ التعيين</div><div class="val">${selected.hire_date ?? '—'}</div></div>
    <div class="cell"><div class="label">الحالة</div><div class="val">${selected.employment_status === 'active' ? 'نشط' : selected.employment_status}</div></div>
  </div>

  <div class="summary">
    <div class="card green"><div class="l">إجمالي الدخل</div><div class="v">${fmtMoneyPrint(totalIncome)}</div></div>
    <div class="card red"><div class="l">إجمالي الخصومات</div><div class="v">${fmtMoneyPrint(totalDeductionsAll)}</div></div>
    <div class="card net"><div class="l">الصافي المستحق</div><div class="v">${fmtMoneyPrint(netAmount)}</div></div>
  </div>

  <div class="section-title">بنود الدخل</div>
  <table>
    <thead><tr><th>البند</th><th style="text-align:left">المبلغ</th></tr></thead>
    <tbody>${incomeRows.length ? incomeRows.join('') : '<tr><td colspan="2" class="empty">لا توجد بنود دخل</td></tr>'}</tbody>
    <tfoot><tr><td>إجمالي الدخل</td><td class="num green">${fmtMoneyPrint(totalIncome)}</td></tr></tfoot>
  </table>

  <div class="section-title">الخصومات والسلف</div>
  <table>
    <thead><tr><th>البند</th><th style="text-align:left">المبلغ</th></tr></thead>
    <tbody>${dedRows.length ? dedRows.join('') : '<tr><td colspan="2" class="empty">لا توجد خصومات أو سلف</td></tr>'}</tbody>
    <tfoot><tr><td>إجمالي الخصومات</td><td class="num red">${fmtMoneyPrint(totalDeductionsAll)}</td></tr></tfoot>
  </table>

  <table style="margin-top:6px">
    <tr class="net-row"><td>الصافي المستحق</td><td class="num" style="text-align:left">${fmtMoneyPrint(netAmount)}</td></tr>
  </table>

  <div class="footer">تم إصدار هذا الكشف من نظام MUHKAM ERP — ${todayStr}</div>
</body>
</html>`;
              };

              const openReport = (autoPrint: boolean) => {
                const w = window.open('', '_blank', 'width=900,height=700');
                if (!w) {
                  toast({ title: 'فضلاً اسمح بالنوافذ المنبثقة لطباعة التقرير', variant: 'destructive' });
                  return;
                }
                w.document.open();
                w.document.write(buildReportHTML());
                w.document.close();
                if (autoPrint) {
                  w.onload = () => { w.focus(); w.print(); };
                  // Fallback for browsers that don't fire onload after document.write
                  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
                }
              };

              return (
                <div className="space-y-3">
                  {/* Print / PDF actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openReport(true)}
                      className="erp-btn flex items-center gap-1.5 text-xs px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-white"
                      title="طباعة التقرير"
                    >
                      <Printer size={14} /> طباعة
                    </button>
                    <button
                      onClick={() => openReport(false)}
                      className="erp-btn flex items-center gap-1.5 text-xs px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-300"
                      title="معاينة التقرير — استخدم Ctrl+P ثم (حفظ كـ PDF) من نافذة الطباعة"
                    >
                      <Download size={14} /> معاينة / PDF
                    </button>
                  </div>

                  {/* Net Summary */}
                  <div
                    className={`rounded-xl p-4 border-2 ${
                      netAmount >= 0
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="text-xs text-white/50 mb-1">الصافي المستحق</div>
                    <div
                      className={`text-2xl font-bold font-mono ${
                        netAmount >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {fmt(netAmount)} {selected.currency}
                    </div>
                    <div className="text-[10px] text-white/40 mt-1">
                      = دخل ({fmt(totalIncome)}) − خصومات ({fmt(totalDeductionsAll)})
                    </div>
                  </div>

                  {/* Unified Balance Sheet — All items in one list */}
                  <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-white/5 border-b border-white/10 text-[10px] font-bold text-white/50 uppercase">
                      <div>البند</div>
                      <div className="text-center w-20">دخل</div>
                      <div className="text-center w-20">صرف</div>
                    </div>

                    {/* ═══ INCOME SECTION ═══ */}
                    <div className="px-3 py-1.5 bg-emerald-500/10 text-[10px] font-bold text-emerald-300 flex items-center justify-between gap-1 sticky top-0 z-10">
                      <span className="flex items-center gap-1"><Plus size={10} /> الدخل</span>
                      {(bonuses.length + (canViewSalary && baseSalary > 0 ? 1 : 0) + ((selected.commission_rate ?? 0) > 0 ? 1 : 0)) > 5 && (
                        <span className="text-[9px] text-emerald-300/60 font-normal">↕ مرّر للأسفل</span>
                      )}
                    </div>

                    <div className="max-h-[200px] overflow-y-auto thin-scroll">
                    {canViewSalary && baseSalary > 0 && (
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                        <div className="text-white/70">الراتب الأساسي</div>
                        <div className="font-mono font-semibold text-emerald-300 w-20 text-center">
                          {fmt(baseSalary)}
                        </div>
                        <div className="w-20"></div>
                      </div>
                    )}

                    {(selected.commission_rate ?? 0) > 0 && (
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs">
                        <div className="text-white/70">
                          نسبة العمولة{' '}
                          <span className="text-purple-300 font-mono">
                            ({selected.commission_rate}%)
                          </span>
                        </div>
                        <div className="font-mono text-white/30 w-20 text-center">—</div>
                        <div className="w-20"></div>
                      </div>
                    )}

                    {/* Each bonus as a line */}
                    {bonuses.map((b) => (
                      <div
                        key={`bonus-${b.id}`}
                        className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="text-white/70 truncate">
                            حافز{b.reason ? ` — ${String(b.reason)}` : ''}
                          </div>
                          <div className="text-[10px] text-white/30 font-mono">
                            {String(b.granted_date ?? '')}
                          </div>
                        </div>
                        <div className="font-mono font-semibold text-emerald-300 w-20 text-center">
                          {fmt(b.amount)}
                        </div>
                        <div className="w-20"></div>
                      </div>
                    ))}

                    </div>

                    {/* Income subtotal */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-emerald-500/5 border-b border-white/10 text-xs font-bold">
                      <div className="text-emerald-300">إجمالي الدخل</div>
                      <div className="font-mono text-emerald-300 w-20 text-center">
                        {fmt(totalIncome)}
                      </div>
                      <div className="w-20"></div>
                    </div>

                    {/* ═══ DEDUCTIONS SECTION ═══ */}
                    <div className="px-3 py-1.5 bg-red-500/10 text-[10px] font-bold text-red-300 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1"><MinusCircle size={10} /> الصرف / الخصومات</span>
                      {(deductions.length + loans.filter((l) => Number(l.remaining_balance ?? 0) > 0).length) > 5 && (
                        <span className="text-[9px] text-red-300/60 font-normal">↕ مرّر للأسفل</span>
                      )}
                    </div>

                    <div className="max-h-[200px] overflow-y-auto thin-scroll">
                    {/* Each deduction as a line */}
                    {deductions.map((d) => {
                      const info = dedLabel(String(d.deduction_type ?? 'other'));
                      return (
                        <div
                          key={`ded-${d.id}`}
                          className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="text-white/70 truncate flex items-center gap-1.5">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full border ${info.border} ${info.color} ${info.bg}`}
                              >
                                {info.label}
                              </span>
                              {d.reason ? <span className="truncate">{String(d.reason)}</span> : null}
                            </div>
                            <div className="text-[10px] text-white/30 font-mono">
                              {String(d.deduction_date ?? '')}
                            </div>
                          </div>
                          <div className="w-20"></div>
                          <div className="font-mono font-semibold text-red-300 w-20 text-center">
                            {fmt(d.amount)}
                          </div>
                        </div>
                      );
                    })}

                    {/* Each active loan as a line */}
                    {loans
                      .filter((l) => Number(l.remaining_balance ?? 0) > 0)
                      .map((l) => (
                        <div
                          key={`loan-${l.id}`}
                          className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="text-white/70 truncate flex items-center gap-1.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-500/30 text-amber-300 bg-amber-500/10">
                                سلفة
                              </span>
                              {l.reason ? <span className="truncate">{String(l.reason)}</span> : null}
                            </div>
                            <div className="text-[10px] text-white/30 font-mono">
                              متبقي من أصل {fmt(l.requested_amount)}
                            </div>
                          </div>
                          <div className="w-20"></div>
                          <div className="font-mono font-semibold text-amber-300 w-20 text-center">
                            {fmt(l.remaining_balance)}
                          </div>
                        </div>
                      ))}

                    {deductions.length === 0 && remainingLoans === 0 && (
                      <div className="px-3 py-3 text-center text-[11px] text-white/30">
                        لا توجد خصومات أو سلف
                      </div>
                    )}
                    </div>

                    {/* Deductions subtotal */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-red-500/5 border-b border-white/10 text-xs font-bold">
                      <div className="text-red-300">إجمالي الصرف</div>
                      <div className="w-20"></div>
                      <div className="font-mono text-red-300 w-20 text-center">
                        {fmt(totalDeductionsAll)}
                      </div>
                    </div>

                    {/* ═══ NET ═══ */}
                    <div
                      className={`grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-3 text-sm font-bold ${
                        netAmount >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                      }`}
                    >
                      <div className={netAmount >= 0 ? 'text-emerald-200' : 'text-red-200'}>
                        الصافي المستحق
                      </div>
                      <div className="w-20"></div>
                      <div
                        className={`font-mono w-20 text-center ${
                          netAmount >= 0 ? 'text-emerald-200' : 'text-red-200'
                        }`}
                      >
                        {fmt(netAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Loans summary */}
                  <div className="bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold text-white/70 border-b border-white/10 pb-1.5">
                      السلف
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-sm font-bold text-white/70">{loans.length}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">العدد</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-amber-300 font-mono">
                          {fmt(totalLoans)}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">إجمالي</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-red-400 font-mono">
                          {fmt(remainingLoans)}
                        </div>
                        <div className="text-[10px] text-white/40 mt-0.5">متبقي</div>
                      </div>
                    </div>
                  </div>

                  {/* Info summary */}
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

            {/* ── Documents Tab ──────────────────────────────── */}
            {detailTab === 'docs' && (
              <div className="space-y-2">
                {selected.national_id_image && (
                  <div className="bg-white/5 rounded-lg p-2 space-y-2">
                    <div className="flex items-center gap-1 text-xs font-semibold text-white">
                      <IdCard size={12} className="text-amber-400" /> صورة البطاقة الشخصية
                    </div>
                    <a
                      href={selected.national_id_image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={selected.national_id_image}
                        alt="بطاقة شخصية"
                        className="rounded max-h-48 w-auto border border-white/10"
                      />
                    </a>
                  </div>
                )}
                {documents.length === 0 && !selected.national_id_image && (
                  <p className="text-white/40 text-xs text-center py-4">لا توجد مستندات</p>
                )}
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white/5 rounded-lg p-2"
                  >
                    <div className="text-xs font-semibold text-white">{doc.file_name}</div>
                    <div className="text-xs text-white/50">{doc.document_type}</div>
                    {doc.expiry_date && (
                      <div className="text-xs text-amber-300">ينتهي: {doc.expiry_date}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Bonuses Tab (الحافز) ───────────────────────── */}
            {detailTab === 'bonuses' && (
              <div className="space-y-2">
                {canManage && (
                  <button
                    onClick={() => setShowBonusForm(true)}
                    className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1"
                  >
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
                      <div
                        key={String(b.id)}
                        className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-bold text-emerald-300 font-mono">
                              + {fmt(b.amount)} {String(b.currency ?? 'EGP')}
                            </div>
                            {b.reason ? (
                              <div className="text-xs text-white/60 mt-1">{String(b.reason)}</div>
                            ) : null}
                            <div className="text-xs text-white/30 font-mono mt-1">
                              {String(b.granted_date ?? '')}
                            </div>
                          </div>
                          {canManage && (
                            <button
                              onClick={() => deleteBonus.mutate(b.id as number)}
                              className="text-red-400/60 hover:text-red-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="bg-white/5 rounded-lg p-2 text-xs text-center">
                      إجمالي الحوافز:{' '}
                      <span className="text-emerald-300 font-bold font-mono">
                        {fmt(bonuses.reduce((s, b) => s + Number(b.amount ?? 0), 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Custody Tab (عهدة) ─────────────────────────── */}
            {detailTab === 'custody' && (
              <div className="space-y-2">
                {canManage && (
                  <button
                    onClick={() => setShowCustodyForm(true)}
                    className="erp-btn erp-btn-primary w-full text-xs flex items-center justify-center gap-1"
                  >
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
                        <div
                          key={String(c.id)}
                          className={`rounded-lg p-3 border ${
                            isOpen
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-bold text-amber-300 font-mono">
                                {fmt(c.amount)} {String(c.currency ?? 'EGP')}
                              </div>
                              {c.purpose ? (
                                <div className="text-xs text-white/60 mt-1">
                                  {String(c.purpose)}
                                </div>
                              ) : null}
                              <div className="text-xs text-white/30 font-mono mt-1">
                                {String(c.granted_date ?? '')}
                              </div>
                              {!isOpen && (
                                <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                                  <CheckCircle size={10} /> مردودة:{' '}
                                  <span className="font-mono">{fmt(c.returned_amount)}</span>
                                  {c.settled_date ? ` — ${String(c.settled_date)}` : ''}
                                </div>
                              )}
                              {reimbursement > 0 && (
                                <div className="text-xs text-rose-300 mt-1 flex items-center gap-2 bg-rose-500/10 border border-rose-400/30 rounded px-2 py-1">
                                  <span>
                                    مستحق للموظف:{' '}
                                    <span className="font-mono font-bold">
                                      {fmt(reimbursement)}
                                    </span>
                                  </span>
                                  {canManage && (
                                    <button
                                      onClick={() => {
                                        setShowReimburseCustody(Number(c.id));
                                        setReimburseSafeId('');
                                        setReimburseNotes('');
                                      }}
                                      className="erp-btn erp-btn-ghost text-xs text-emerald-300 border border-emerald-400/40 px-2 py-0.5"
                                    >
                                      صرف المستحقات
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <span
                              className={
                                isOpen
                                  ? 'erp-badge erp-badge-warning'
                                  : 'erp-badge erp-badge-success'
                              }
                            >
                              {isOpen ? 'مفتوحة' : 'مسواة'}
                            </span>
                          </div>
                          {canManage && isOpen && (
                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={() => {
                                  setShowSettleCustody(c.id as number);
                                  setSettleLines([blankSettleLine()]);
                                  setSettleNotes('');
                                }}
                                className="erp-btn erp-btn-ghost text-xs text-emerald-400 border border-emerald-500/30 p-1"
                              >
                                تسوية
                              </button>
                              <button
                                onClick={() => deleteCustody.mutate(c.id as number)}
                                className="erp-btn erp-btn-ghost text-xs text-red-400 border border-red-500/30 p-1"
                              >
                                حذف
                              </button>
                            </div>
                          )}
                          {!isOpen && (
                            <button
                              onClick={() =>
                                setExpandedCustody(isExpanded ? null : Number(c.id))
                              }
                              className="erp-btn erp-btn-ghost text-xs text-white/60 mt-2"
                            >
                              {isExpanded ? '▲ إخفاء التفاصيل' : '▼ عرض بنود التسوية'}
                            </button>
                          )}
                          {!isOpen && isExpanded && (
                            <CustodyLinesPanel custodyId={Number(c.id)} />
                          )}
                        </div>
                      );
                    })}
                    <div className="bg-white/5 rounded-lg p-2 text-xs text-center">
                      عهد مفتوحة:{' '}
                      <span className="text-amber-300 font-bold font-mono">
                        {fmt(
                          custody
                            .filter((c) => String(c.status) === 'open')
                            .reduce(
                              (s, c) =>
                                s + Number(c.amount ?? 0) - Number(c.returned_amount ?? 0),
                              0
                            )
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* ═══════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════ */}
      {/* Employee Create/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="erp-modal rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck size={18} className="text-amber-400" />
                {editId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="الاسم الأول (عربي) *">
                  <input
                    value={editEmp.first_name_ar ?? ''}
                    onChange={(e) => set('first_name_ar', e.target.value)}
                    className="erp-input w-full"
                    placeholder="صالح"
                  />
                </Field>
                <Field label="الاسم الأخير (عربي) *">
                  <input
                    value={editEmp.last_name_ar ?? ''}
                    onChange={(e) => set('last_name_ar', e.target.value)}
                    className="erp-input w-full"
                    placeholder="المليجي"
                  />
                </Field>
              </div>

              {/* Phone (11 digits exact) */}
              <Field label="الهاتف * (11 رقم)">
                <input
                  required
                  value={editEmp.phone ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                    set('phone', v);
                  }}
                  className="erp-input w-full"
                  placeholder="01012345678"
                  inputMode="numeric"
                  maxLength={11}
                />
                {(editEmp.phone ?? '') && (editEmp.phone ?? '').length !== 11 && (
                  <div className="text-xs text-red-400 mt-1">
                    يجب إدخال 11 رقم بالضبط ({(editEmp.phone ?? '').length}/11)
                  </div>
                )}
              </Field>

              {/* National ID + Image upload — same row */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="الرقم القومي (14 رقم)">
                  <div className="relative">
                    <IdCard
                      size={14}
                      className="absolute top-1/2 -translate-y-1/2 right-3 text-white/30"
                    />
                    <input
                      value={editEmp.national_id ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 14);
                        set('national_id', v);
                      }}
                      className="erp-input w-full pr-8"
                      placeholder="14 رقم"
                      inputMode="numeric"
                      maxLength={14}
                    />
                  </div>
                  {(editEmp.national_id ?? '') && (editEmp.national_id ?? '').length !== 14 && (
                    <div className="text-xs text-red-400 mt-1">
                      يجب 14 رقم ({(editEmp.national_id ?? '').length}/14)
                    </div>
                  )}
                </Field>
                <Field label="صورة البطاقة">
                  <div className="flex items-center gap-2">
                    <label className="erp-btn erp-btn-ghost text-xs cursor-pointer flex-1 text-center border border-white/10">
                      {editEmp.national_id_image ? 'تغيير الصورة' : 'رفع صورة'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 2 * 1024 * 1024) {
                            toast({
                              title: 'حجم الصورة يجب ألا يزيد عن 2 ميجابايت',
                              variant: 'destructive',
                            });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => set('national_id_image', String(reader.result));
                          reader.readAsDataURL(f);
                        }}
                      />
                    </label>
                    {editEmp.national_id_image && (
                      <>
                        <a
                          href={editEmp.national_id_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="erp-btn erp-btn-ghost text-xs px-2 border border-emerald-500/30 text-emerald-300"
                          title="عرض الصورة"
                        >
                          عرض
                        </a>
                        <button
                          type="button"
                          onClick={() => set('national_id_image', null)}
                          className="erp-btn erp-btn-ghost text-xs px-2 border border-red-500/30 text-red-300"
                          title="حذف"
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </Field>
              </div>

              {/* Department + Job Title — same row, both with inline add */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="القسم">
                  <div className="flex gap-2">
                    <select
                      value={editEmp.department_id ?? ''}
                      onChange={(e) =>
                        set('department_id', e.target.value ? Number(e.target.value) : null)
                      }
                      className="erp-input flex-1"
                    >
                      <option value="">— اختر القسم —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name_ar}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowInlineDept((v) => !v)}
                      className="erp-btn erp-btn-ghost px-2 text-amber-400 border border-amber-500/30"
                      title="إضافة قسم جديد"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {showInlineDept && (
                    <div className="mt-2 bg-white/5 rounded-lg p-3 space-y-2 border border-amber-500/20">
                      <div className="text-xs text-amber-300 mb-1">قسم جديد</div>
                      <input
                        value={inlineDept.name_ar}
                        onChange={(e) => setInlineDept((p) => ({ ...p, name_ar: e.target.value }))}
                        className="erp-input w-full text-sm"
                        placeholder="اسم القسم *"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => createInlineDept.mutate(inlineDept)}
                          disabled={!inlineDept.name_ar.trim() || createInlineDept.isPending}
                          className="erp-btn erp-btn-primary text-xs flex-1"
                        >
                          {createInlineDept.isPending ? 'جاري...' : 'إضافة'}
                        </button>
                        <button
                          onClick={() => setShowInlineDept(false)}
                          className="erp-btn erp-btn-ghost text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </Field>

                <Field label="المسمى الوظيفي">
                  <div className="flex gap-2">
                    <select
                      value={editEmp.job_title_id ?? ''}
                      onChange={(e) =>
                        set('job_title_id', e.target.value ? Number(e.target.value) : null)
                      }
                      className="erp-input flex-1"
                    >
                      <option value="">— اختر المسمى —</option>
                      {jobTitles.map((jt) => (
                        <option key={jt.id} value={jt.id}>
                          {jt.name_ar}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowInlineJt((v) => !v)}
                      className="erp-btn erp-btn-ghost px-2 text-amber-400 border border-amber-500/30"
                      title="إضافة مسمى جديد"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {showInlineJt && (
                    <div className="mt-2 bg-white/5 rounded-lg p-3 space-y-2 border border-amber-500/20">
                      <div className="text-xs text-amber-300 mb-1">مسمى وظيفي جديد</div>
                      <input
                        value={inlineJt.name_ar}
                        onChange={(e) => setInlineJt((p) => ({ ...p, name_ar: e.target.value }))}
                        className="erp-input w-full text-sm"
                        placeholder="اسم المسمى الوظيفي *"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => createInlineJt.mutate(inlineJt)}
                          disabled={!inlineJt.name_ar.trim() || createInlineJt.isPending}
                          className="erp-btn erp-btn-primary text-xs flex-1"
                        >
                          {createInlineJt.isPending ? 'جاري...' : 'إضافة'}
                        </button>
                        <button
                          onClick={() => setShowInlineJt(false)}
                          className="erp-btn erp-btn-ghost text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </Field>
              </div>

              {/* Hire Date & Branch */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="تاريخ التعيين *">
                  <input
                    type="date"
                    value={editEmp.hire_date ?? ''}
                    onChange={(e) => set('hire_date', e.target.value)}
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="الفرع">
                  <select
                    value={editEmp.branch_id ?? ''}
                    onChange={(e) =>
                      set('branch_id', e.target.value ? Number(e.target.value) : null)
                    }
                    className="erp-input w-full"
                  >
                    <option value="">— اختر الفرع —</option>
                    {branches
                      .filter((b) => b.is_active)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>

              {/* Salary section — 3 modes */}
              <div className="bg-white/5 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/50 ml-1">الراتب:</span>
                  {(
                    [
                      { v: 'fixed', label: 'راتب ثابت', icon: Wallet, color: 'emerald' },
                      { v: 'commission', label: 'نسبة عمولة', icon: Percent, color: 'purple' },
                      {
                        v: 'fixed_plus_commission',
                        label: 'راتب + عمولة',
                        icon: Plus,
                        color: 'amber',
                      },
                    ] as const
                  ).map(({ v, label, icon: Icon, color }) => {
                    const active = (editEmp.salary_type ?? 'fixed') === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('salary_type', v)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all ${
                          active
                            ? `bg-${color}-500/20 text-${color}-300 border border-${color}-500/30`
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        <Icon size={11} className="inline ml-1" /> {label}
                      </button>
                    );
                  })}
                </div>

                {/* Fixed-salary input (shown for fixed & fixed_plus_commission) */}
                {(editEmp.salary_type ?? 'fixed') !== 'commission' && (
                  <div>
                    <div className="text-xs text-white/40 mb-1">الراتب الأساسي</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={editEmp.salary ?? 0}
                        onChange={(e) => set('salary', Number(e.target.value))}
                        className="erp-input flex-1"
                        min={0}
                        placeholder="0.00"
                        style={{ minWidth: 0 }}
                      />
                      <select
                        value={editEmp.currency ?? 'EGP'}
                        onChange={(e) => set('currency', e.target.value)}
                        className="erp-input"
                        style={{ width: '90px', flexShrink: 0 }}
                      >
                        {['EGP', 'SAR', 'AED', 'USD'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Commission inputs (shown for commission & fixed_plus_commission) */}
                {(editEmp.salary_type ?? 'fixed') !== 'fixed' && (
                  <div className="space-y-2">
                    <div className="text-xs text-white/40 mb-1">نسبة العمولة</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editEmp.commission_rate ?? ''}
                          onChange={(e) => set('commission_rate', Number(e.target.value))}
                          className="erp-input w-full"
                          min={0}
                          max={100}
                          placeholder="مثال: 5"
                          style={{ minWidth: 0 }}
                        />
                        <span className="text-white/50 text-xs shrink-0">%</span>
                      </div>
                      <select
                        value={editEmp.commission_basis ?? 'gross'}
                        onChange={(e) => set('commission_basis', e.target.value as 'gross' | 'net')}
                        className="erp-input"
                        title="أساس حساب العمولة"
                      >
                        <option value="gross">من إجمالي الدخل</option>
                        <option value="net">من صافي الربح</option>
                      </select>
                      <select
                        value={editEmp.commission_scope_dept_id ?? ''}
                        onChange={(e) =>
                          set(
                            'commission_scope_dept_id',
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="erp-input"
                        title="نطاق العمولة (قسم)"
                      >
                        <option value="">— كل الأقسام —</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Address & Notes */}
              <Field label="العنوان">
                <input
                  value={editEmp.address_ar ?? ''}
                  onChange={(e) => set('address_ar', e.target.value)}
                  className="erp-input w-full"
                  placeholder="العنوان الكامل"
                />
              </Field>
              <div className="grid grid-cols-1 gap-3">
                <Field label="الحساب البنكي">
                  <input
                    value={editEmp.bank_account ?? ''}
                    onChange={(e) => set('bank_account', e.target.value)}
                    className="erp-input w-full"
                  />
                </Field>
              </div>
              <Field label="ملاحظات">
                <textarea
                  value={editEmp.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value)}
                  className="erp-input w-full"
                  rows={2}
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={saveEmployee}
                disabled={createEmp.isPending || updateEmp.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createEmp.isPending || updateEmp.isPending
                  ? 'جاري الحفظ...'
                  : editId
                    ? 'حفظ التعديلات'
                    : 'إضافة الموظف'}
              </button>
              <button onClick={() => setShowForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm p-5 text-center"
            dir="rtl"
          >
            <UserX size={36} className="text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">حذف الموظف</h2>
            <p className="text-white/50 text-sm mb-4">
              هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذه العملية.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => deleteEmp.mutate(deleteId)}
                disabled={deleteEmp.isPending}
                className="erp-btn flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
              >
                {deleteEmp.isPending ? 'جاري الحذف...' : 'حذف'}
              </button>
              <button onClick={() => setDeleteId(null)} className="erp-btn erp-btn-ghost flex-1">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* New Loan Form */}
      {showLoanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Banknote size={16} className="text-amber-400" />
                سلفة جديدة — {selected?.first_name_ar} {selected?.last_name_ar}
              </h2>
              <button
                onClick={() => setShowLoanForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="المبلغ المطلوب *">
                <input
                  type="number"
                  value={loanForm.requested_amount}
                  onChange={(e) => setLoanForm((p) => ({ ...p, requested_amount: e.target.value }))}
                  className="erp-input w-full"
                  min={0}
                />
              </Field>
              <Field label="نوع السلفة">
                <select
                  value={loanForm.advance_type}
                  onChange={(e) => setLoanForm((p) => ({ ...p, advance_type: e.target.value }))}
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
              <Field label="السبب (اختياري)">
                <input
                  value={loanForm.reason}
                  onChange={(e) => setLoanForm((p) => ({ ...p, reason: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="اكتب سبب السلفة..."
                />
              </Field>
              <Field label="خصم السلفة من">
                <select
                  value={loanForm.deduct_from}
                  onChange={(e) =>
                    setLoanForm((p) => ({
                      ...p,
                      deduct_from: e.target.value as 'fixed' | 'commission' | 'both',
                    }))
                  }
                  className="erp-input w-full"
                >
                  <option value="fixed">الراتب الثابت</option>
                  <option value="commission">العمولة</option>
                  <option value="both">من الراتب الثابت والعمولة معاً</option>
                </select>
              </Field>
              {!isSelfService && (
                <Field label="الخزينة (اختياري)">
                  <select
                    value={loanForm.safe_id}
                    onChange={(e) => setLoanForm((p) => ({ ...p, safe_id: e.target.value }))}
                    className="erp-input w-full"
                  >
                    <option value="">— بدون خزينة —</option>
                    {safesForEmployee(selected).map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>
                        {String(s.name)}
                        {s.balance != null
                          ? ` (الرصيد: ${Number(s.balance).toLocaleString('ar-EG-u-nu-latn')})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {selected?.branch_id && safesForEmployee(selected).length === 0 && (
                    <div className="text-xs text-amber-300/70 mt-1">
                      لا توجد خزائن متاحة لهذا الفرع
                    </div>
                  )}
                </Field>
              )}
              {isSelfService && (
                <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                  سيتم إرسال طلبك إلى المدير للاعتماد. ستصلك رسالة عند الرد.
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() =>
                  createLoan.mutate({
                    employee_id: selected?.id,
                    ...loanForm,
                    requested_amount: Number(loanForm.requested_amount),
                  })
                }
                disabled={
                  !loanForm.requested_amount || createLoan.isPending
                }
                className="erp-btn erp-btn-primary flex-1"
              >
                {createLoan.isPending ? 'جاري الإرسال...' : (isSelfService ? 'إرسال طلب السلفة' : 'تقديم السلفة')}
              </button>
              <button onClick={() => setShowLoanForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Manual Payment / Deduction modal */}
      {showPayModal != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white">تسجيل دفعة / خصم</h2>
              <button
                onClick={() => setShowPayModal(null)}
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <Field label="المبلغ *">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="erp-input w-full"
                  min={0}
                  autoFocus
                />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button
                onClick={() => manualPay.mutate({ id: showPayModal, amount: Number(payAmount) })}
                disabled={!payAmount || Number(payAmount) <= 0 || manualPay.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {manualPay.isPending ? 'جاري...' : 'تأكيد'}
              </button>
              <button onClick={() => setShowPayModal(null)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deduction Form */}
      {showDeductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <MinusCircle size={16} className="text-red-400" />
                خصم من الراتب — {selected?.first_name_ar} {selected?.last_name_ar}
              </h2>
              <button
                onClick={() => setShowDeductForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="نوع الخصم *">
                <div className="grid grid-cols-4 gap-1.5">
                  {(['late', 'absence', 'damage', 'other'] as const).map((t) => {
                    const info = dedLabel(t);
                    const active = deductForm.deduction_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDeductForm((p) => ({ ...p, deduction_type: t }))}
                        className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                          active
                            ? `${info.bg} ${info.border} ${info.color} ring-1 ring-white/20`
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="المبلغ *">
                <input
                  type="number"
                  value={deductForm.amount}
                  onChange={(e) => setDeductForm((p) => ({ ...p, amount: e.target.value }))}
                  className="erp-input w-full"
                  min={0}
                  placeholder="0.00"
                />
              </Field>
              <Field label="السبب / التفاصيل">
                <input
                  value={deductForm.reason}
                  onChange={(e) => setDeductForm((p) => ({ ...p, reason: e.target.value }))}
                  className="erp-input w-full"
                  placeholder={
                    deductForm.deduction_type === 'late'
                      ? 'مثال: تأخير 30 دقيقة يوم الأحد'
                      : deductForm.deduction_type === 'absence'
                      ? 'مثال: غياب يوم كامل'
                      : deductForm.deduction_type === 'damage'
                      ? 'مثال: تلف قطعة غيار X'
                      : 'تفاصيل الخصم'
                  }
                />
              </Field>
              <Field label="تاريخ الخصم">
                <input
                  type="date"
                  value={deductForm.deduction_date}
                  onChange={(e) =>
                    setDeductForm((p) => ({ ...p, deduction_date: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() =>
                  createDeduction.mutate({
                    amount: Number(deductForm.amount),
                    reason: deductForm.reason,
                    deduction_type: deductForm.deduction_type,
                    deduction_date: deductForm.deduction_date,
                  })
                }
                disabled={
                  !deductForm.amount ||
                  Number(deductForm.amount) <= 0 ||
                  createDeduction.isPending
                }
                className="erp-btn flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
              >
                {createDeduction.isPending ? 'جاري...' : 'تسجيل الخصم'}
              </button>
              <button onClick={() => setShowDeductForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bonus Form (الحافز) */}
      {showBonusForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Award size={16} className="text-emerald-400" />
                إضافة حافز — {selected?.first_name_ar} {selected?.last_name_ar}
              </h2>
              <button
                onClick={() => setShowBonusForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="قيمة الحافز *">
                <input
                  type="number"
                  value={bonusForm.amount}
                  onChange={(e) => setBonusForm((p) => ({ ...p, amount: e.target.value }))}
                  className="erp-input w-full"
                  min={0}
                  autoFocus
                />
              </Field>
              <Field label="السبب">
                <input
                  value={bonusForm.reason}
                  onChange={(e) => setBonusForm((p) => ({ ...p, reason: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="مثال: حافز إنتاجية، مكافأة..."
                />
              </Field>
              <Field label="تاريخ المنح">
                <input
                  type="date"
                  value={bonusForm.granted_date}
                  onChange={(e) =>
                    setBonusForm((p) => ({ ...p, granted_date: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() =>
                  createBonus.mutate({
                    employee_id: selected?.id,
                    amount: Number(bonusForm.amount),
                    reason: bonusForm.reason || null,
                    granted_date: bonusForm.granted_date,
                  })
                }
                disabled={
                  !bonusForm.amount || Number(bonusForm.amount) <= 0 || createBonus.isPending
                }
                className="erp-btn erp-btn-primary flex-1"
              >
                {createBonus.isPending ? 'جاري...' : 'إضافة الحافز'}
              </button>
              <button onClick={() => setShowBonusForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custody Form (عهدة) */}
      {showCustodyForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Package size={16} className="text-amber-400" />
                إضافة عهدة — {selected?.first_name_ar} {selected?.last_name_ar}
              </h2>
              <button
                onClick={() => setShowCustodyForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="قيمة العهدة *">
                <input
                  type="number"
                  value={custodyForm.amount}
                  onChange={(e) => setCustodyForm((p) => ({ ...p, amount: e.target.value }))}
                  className="erp-input w-full"
                  min={0}
                  autoFocus
                />
              </Field>
              <Field label="الغرض">
                <input
                  value={custodyForm.purpose}
                  onChange={(e) => setCustodyForm((p) => ({ ...p, purpose: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="مثال: شراء مستلزمات، مصاريف انتقالات..."
                />
              </Field>
              <Field label="تاريخ صرف العهدة">
                <input
                  type="date"
                  value={custodyForm.granted_date}
                  onChange={(e) =>
                    setCustodyForm((p) => ({ ...p, granted_date: e.target.value }))
                  }
                  className="erp-input w-full"
                />
              </Field>
              <Field label="الخزينة (اختياري)">
                <select
                  value={custodyForm.safe_id}
                  onChange={(e) => setCustodyForm((p) => ({ ...p, safe_id: e.target.value }))}
                  className="erp-input w-full"
                >
                  <option value="">— بدون خزينة —</option>
                  {safesForEmployee(selected).map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name)}
                      {s.balance != null
                        ? ` (الرصيد: ${Number(s.balance).toLocaleString('ar-EG-u-nu-latn')})`
                        : ''}
                    </option>
                  ))}
                </select>
                {selected?.branch_id && safesForEmployee(selected).length === 0 && (
                  <div className="text-xs text-amber-300/70 mt-1">
                    لا توجد خزائن متاحة لهذا الفرع
                  </div>
                )}
              </Field>
              <Field label="ملاحظات">
                <input
                  value={custodyForm.notes}
                  onChange={(e) => setCustodyForm((p) => ({ ...p, notes: e.target.value }))}
                  className="erp-input w-full"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() =>
                  createCustody.mutate({
                    employee_id: selected?.id,
                    amount: Number(custodyForm.amount),
                    purpose: custodyForm.purpose || null,
                    granted_date: custodyForm.granted_date,
                    notes: custodyForm.notes || null,
                    safe_id: custodyForm.safe_id || null,
                  })
                }
                disabled={
                  !custodyForm.amount ||
                  Number(custodyForm.amount) <= 0 ||
                  createCustody.isPending
                }
                className="erp-btn erp-btn-primary flex-1"
              >
                {createCustody.isPending ? 'جاري...' : 'إضافة العهدة'}
              </button>
              <button
                onClick={() => setShowCustodyForm(false)}
                className="erp-btn erp-btn-ghost"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Settle Custody */}
      {showSettleCustody != null && (() => {
        const current = custody.find((c: AnyRec) => Number(c.id) === showSettleCustody);
        const original = current ? Number(current.amount) : 0;
        const sumLines = settleLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
        const overspent = sumLines > original;
        const reimbursement = overspent ? +(sumLines - original).toFixed(2) : 0;
        const returned = overspent ? 0 : +(original - sumLines).toFixed(2);
        const linesValid = settleLines.every(
          (l) => Number(l.amount) > 0 && l.category.trim() !== '',
        );
        const canSubmit = linesValid && returned >= 0 && !settleCustody.isPending;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
              className="erp-modal rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
              dir="rtl"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" /> تسوية العهدة
                  {current && (
                    <span className="text-xs text-white/60 mr-2">
                      (إجمالي: {original.toLocaleString('ar-EG-u-nu-latn')})
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowSettleCustody(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 space-y-3 overflow-auto">
                <div className="text-xs text-white/60">
                  أدخل تفاصيل المصروفات الفعلية. كل بند سيُسجَّل كمصروف منفصل.
                </div>

                {settleLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 p-2 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="col-span-3">
                      <label className="text-[10px] text-white/50">المبلغ</label>
                      <input
                        type="number"
                        value={line.amount}
                        onChange={(e) =>
                          setSettleLines((arr) =>
                            arr.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)),
                          )
                        }
                        className="erp-input w-full text-sm"
                        min={0}
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-white/50">نوع المصروف</label>
                      <select
                        value={line.category}
                        onChange={(e) =>
                          setSettleLines((arr) =>
                            arr.map((l, i) => (i === idx ? { ...l, category: e.target.value } : l)),
                          )
                        }
                        className="erp-input w-full text-sm"
                      >
                        <option value="">— اختر —</option>
                        {expenseCategories.map((c) => (
                          <option key={String(c.id)} value={String(c.name)}>
                            {String(c.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-white/50">التاريخ</label>
                      <input
                        type="date"
                        value={line.date}
                        onChange={(e) =>
                          setSettleLines((arr) =>
                            arr.map((l, i) => (i === idx ? { ...l, date: e.target.value } : l)),
                          )
                        }
                        className="erp-input w-full text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-white/50">الوصف</label>
                      <input
                        value={line.description}
                        onChange={(e) =>
                          setSettleLines((arr) =>
                            arr.map((l, i) =>
                              i === idx ? { ...l, description: e.target.value } : l,
                            ),
                          )
                        }
                        className="erp-input w-full text-sm"
                        placeholder="اختياري"
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          setSettleLines((arr) =>
                            arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr,
                          )
                        }
                        disabled={settleLines.length === 1}
                        className="text-red-400 hover:text-red-300 disabled:opacity-30 p-1"
                        title="حذف البند"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setSettleLines((arr) => [...arr, blankSettleLine()])}
                  className="erp-btn erp-btn-ghost text-xs"
                >
                  + إضافة بند مصروف
                </button>

                <div className="grid grid-cols-3 gap-2 mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                  <div>
                    <div className="text-[10px] text-white/50">إجمالي العهدة</div>
                    <div className="font-bold text-white">
                      {original.toLocaleString('ar-EG-u-nu-latn')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/50">إجمالي المصروفات</div>
                    <div className="font-bold text-amber-300">
                      {sumLines.toLocaleString('ar-EG-u-nu-latn')}
                    </div>
                  </div>
                  <div>
                    {overspent ? (
                      <>
                        <div className="text-[10px] text-rose-300">مستحق للموظف</div>
                        <div className="font-bold text-rose-300">
                          {reimbursement.toLocaleString('ar-EG-u-nu-latn')}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] text-emerald-300">مرتجع للخزينة</div>
                        <div className="font-bold text-emerald-300">
                          {returned.toLocaleString('ar-EG-u-nu-latn')}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {overspent && (
                  <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-lg p-2">
                    تنبيه: مجموع المصروفات أكبر من العهدة. سيُسجَّل الفرق ({reimbursement}) كمستحق
                    للموظف.
                  </div>
                )}

                <Field label="ملاحظات التسوية">
                  <input
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    className="erp-input w-full"
                  />
                </Field>
              </div>
              <div className="flex gap-2 p-4 border-t border-white/10">
                <button
                  onClick={() =>
                    settleCustody.mutate({
                      id: showSettleCustody,
                      lines: settleLines.map((l) => ({
                        amount: Number(l.amount),
                        category: l.category.trim(),
                        description: l.description.trim() || null,
                        date: l.date,
                      })),
                      returned_amount: returned,
                      notes: settleNotes.trim() || null,
                    })
                  }
                  disabled={!canSubmit}
                  className="erp-btn erp-btn-primary flex-1"
                >
                  {settleCustody.isPending ? 'جاري...' : 'تأكيد التسوية'}
                </button>
                <button
                  onClick={() => setShowSettleCustody(null)}
                  className="erp-btn erp-btn-ghost"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showReimburseCustody != null && (() => {
        const current = custody.find(
          (c: AnyRec) => Number(c.id) === showReimburseCustody,
        );
        const due = Number(current?.['reimbursement_due'] ?? 0);
        const empBranch = selected?.branch_id ?? null;
        const eligibleSafes = safes.filter(
          (s) =>
            s['branch_id'] == null ||
            empBranch == null ||
            Number(s['branch_id']) === Number(empBranch),
        );
        const canSubmit =
          !!reimburseSafeId &&
          due > 0 &&
          !reimburseCustody.isPending;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="erp-card max-w-md w-full p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">صرف مستحقات الموظف</h3>
                <button
                  onClick={() => setShowReimburseCustody(null)}
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="bg-rose-500/10 border border-rose-400/30 rounded p-2 text-xs text-rose-200 mb-3">
                المبلغ المستحق:{' '}
                <span className="font-mono font-bold">{fmt(due)}</span>{' '}
                {String(current?.['currency'] ?? 'EGP')}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-white/60 block mb-1">
                    خزينة الصرف *
                  </label>
                  <select
                    value={reimburseSafeId}
                    onChange={(e) => setReimburseSafeId(e.target.value)}
                    className="erp-input w-full text-xs"
                  >
                    <option value="">— اختر —</option>
                    {eligibleSafes.map((s) => (
                      <option key={String(s['id'])} value={String(s['id'])}>
                        {String(s['name'])} (الرصيد: {fmt(s['balance'])})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">ملاحظات</label>
                  <input
                    value={reimburseNotes}
                    onChange={(e) => setReimburseNotes(e.target.value)}
                    placeholder="(اختياري)"
                    className="erp-input w-full text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  disabled={!canSubmit}
                  onClick={() =>
                    reimburseCustody.mutate({
                      id: showReimburseCustody!,
                      safe_id: Number(reimburseSafeId),
                      notes: reimburseNotes || undefined,
                    })
                  }
                  className="erp-btn erp-btn-primary disabled:opacity-50"
                >
                  {reimburseCustody.isPending ? 'جاري...' : 'تأكيد الصرف'}
                </button>
                <button
                  onClick={() => setShowReimburseCustody(null)}
                  className="erp-btn erp-btn-ghost"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Create Login Account Modal ─────────────────────────── */}
      {showCreateLogin && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="erp-card w-full max-w-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">إنشاء حساب دخول</h3>
              </div>
              <button onClick={() => setShowCreateLogin(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-white/60">
              للموظف: <span className="text-amber-300">{selected.first_name_ar} {selected.last_name_ar}</span>
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-white/70">اسم المستخدم</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="erp-input w-full"
                placeholder="مثال: ahmad"
                autoFocus
              />
              <label className="block text-xs text-white/70">رمز PIN (4-8 أرقام)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={loginForm.pin}
                onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                className="erp-input w-full font-mono"
                placeholder="••••"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={async () => {
                  if (!loginForm.username.trim() || loginForm.pin.length < 4) {
                    toast({ title: 'تحقق من البيانات', description: 'اسم المستخدم ورمز PIN (4 أرقام على الأقل) مطلوبان', variant: 'destructive' });
                    return;
                  }
                  try {
                    const res = await authFetch(api('/api/settings/users'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        username: loginForm.username.trim(),
                        pin: loginForm.pin,
                        role: 'employee',
                        employee_id: selected.id,
                        active: true,
                      }),
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      throw new Error(j.message || j.error || 'فشل إنشاء الحساب');
                    }
                    toast({ title: 'تم إنشاء الحساب', description: `يمكن للموظف الآن الدخول باسم ${loginForm.username}` });
                    setShowCreateLogin(false);
                  } catch (err: unknown) {
                    toast({ title: 'خطأ', description: (err as Error)?.message || 'فشل إنشاء الحساب', variant: 'destructive' });
                  }
                }}
                className="erp-btn erp-btn-primary"
              >
                إنشاء الحساب
              </button>
              <button onClick={() => setShowCreateLogin(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
