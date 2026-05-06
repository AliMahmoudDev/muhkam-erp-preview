import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { openPrintWindow as _openPrintWindow } from '@/lib/print-utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import {
  UserCheck,
  X,
  UserX,
  Banknote,
  Target,
  MinusCircle,
  Award,
  Package,
  CheckCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { EmployeeList } from './EmployeeList';
import { EmployeeDetail } from './EmployeeDetail';
import { EmployeeForm } from './EmployeeForm';
import type { Employee, Department, JobTitle, Branch, EmpDocument, AnyRec } from './types';

/* ── Lazy-loaded sub-page tabs ───────────────────────────────── */
const AdvanceSettingsTab = lazy(() => import('./advance-settings-tab'));
const SalesTargetsTab    = lazy(() => import('./sales-targets-tab'));

type PageTab = 'list' | 'advance-settings' | 'sales-targets';

const PAGE_TABS: { id: PageTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'list',             label: 'الموظفون',       icon: (p) => <UserCheck {...p} /> },
  { id: 'advance-settings', label: 'إعدادات السلف',  icon: (p) => <Banknote {...p} /> },
  { id: 'sales-targets',   label: 'أهداف المبيعات', icon: (p) => <Target {...p} />   },
];

function SubTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse max-w-2xl mt-6">
      <div className="h-8 w-48 bg-white/5 rounded-xl" />
      <div className="h-4 w-64 bg-white/3 rounded-lg" />
      <div className="grid grid-cols-2 gap-4 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white/3 rounded-2xl" />
        ))}
      </div>
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

const DEDUCTION_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  late:    { label: 'تأخير',      color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  absence: { label: 'غياب',      color: 'text-red-300',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
  damage:  { label: 'تلف/خسائر', color: 'text-rose-300',  bg: 'bg-rose-500/10',  border: 'border-rose-500/20' },
  other:   { label: 'أخرى',      color: 'text-white/70',  bg: 'bg-white/5',      border: 'border-white/10' },
};
function dedLabel(t: string) { return DEDUCTION_LABELS[t] ?? DEDUCTION_LABELS['other']; }

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

  /* ── Page-level tab ─────────────────────────────────────────── */
  const [pageTab, setPageTab] = useState<PageTab>('list');

  /* ── List state ─────────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<number | ''>('');
  const [empPage, setEmpPage] = useState(1);
  const EMP_PAGE_SIZE = 50;
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
  const [approveModal, setApproveModal] = useState<{ id: number; requestedAmount: number; currency: string } | null>(null);
  const [approveForm, setApproveForm] = useState({ approved_amount: '', safe_id: '', notes: '' });

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

  /* All safes (خزائن) — نُحمّل الكل بدون تصفية حسب الدور */
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

  const safesForEmployee = (_emp: Employee | null) => safes;

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
    mutationFn: ({ id, approved_amount, safe_id, notes }: { id: number; approved_amount?: number; safe_id?: number | null; notes?: string }) =>
      authFetch(api(`/api/salary-advances/${id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_amount, safe_id: safe_id || undefined, notes }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances', selected?.id] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setApproveModal(null);
      setApproveForm({ approved_amount: '', safe_id: '', notes: '' });
      toast({ title: 'تم اعتماد السلفة ✓' });
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

  /* ── Filtered employees ───────────────────────────────────── */
  const filtered = useMemo(
    () =>
      employees.filter((e) => {
        if (deptFilter !== '' && e.department_id !== deptFilter) return false;
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
    [employees, search, deptFilter]
  );

  useEffect(() => { setEmpPage(1); }, [search, deptFilter]);

  const paginatedEmps = useMemo(
    () => filtered.slice((empPage - 1) * EMP_PAGE_SIZE, empPage * EMP_PAGE_SIZE),
    [filtered, empPage, EMP_PAGE_SIZE]
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

  /* ── Shared page header + tab nav ─────────────────────────── */
  const PageHeader = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <UserCheck size={22} className="text-amber-400" />
        <h1 className="text-xl font-bold text-white">إدارة الموظفين</h1>
        {pageTab === 'list' && (
          <span className="erp-badge erp-badge-info">{totalActive} نشط</span>
        )}
      </div>
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-white/8 pb-0">
        {PAGE_TABS.map((t) => {
          const Icon = t.icon;
          const active = pageTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setPageTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 -mb-px ${
                active
                  ? 'text-amber-400 border-amber-400 bg-amber-500/5'
                  : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/3'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ── Early returns for sub-page tabs ─────────────────────── */
  if (pageTab === 'advance-settings') {
    return (
      <div className="p-4 space-y-4" dir="rtl">
        {PageHeader}
        <Suspense fallback={<SubTabSkeleton />}>
          <AdvanceSettingsTab />
        </Suspense>
      </div>
    );
  }

  if (pageTab === 'sales-targets') {
    return (
      <div className="p-4 space-y-4" dir="rtl">
        {PageHeader}
        <Suspense fallback={<SubTabSkeleton />}>
          <SalesTargetsTab />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {PageHeader}
      {/* Main grid */}
      <div className={`grid grid-cols-1 ${isSelfService ? '' : 'xl:grid-cols-3'} gap-4`}>
        {/* ── Left: List Panel ─── */}
        {!isSelfService && (
          <EmployeeList
            empsLoading={empsLoading}
            filtered={filtered}
            paginatedEmps={paginatedEmps}
            empPage={empPage}
            EMP_PAGE_SIZE={EMP_PAGE_SIZE}
            setEmpPage={setEmpPage}
            search={search}
            setSearch={setSearch}
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            departments={departments}
            canManage={canManage}
            canViewSalary={canViewSalary}
            selected={selected}
            openCreate={openCreate}
            openEdit={openEdit}
            setDeleteId={setDeleteId}
            setSelected={setSelected}
            setDetailTab={setDetailTab}
          />
        )}

        {/* ── Right: Detail Panel ──────────────────────────────── */}
        {selected && (
          <EmployeeDetail
            selected={selected}
            isSelfService={isSelfService}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            canManage={canManage}
            canViewSalary={canViewSalary}
            loans={loans}
            loansLoading={loansLoading}
            deductions={deductions}
            ledgerLoading={ledgerLoading}
            bonuses={bonuses}
            custody={custody}
            documents={documents}
            totalLoans={totalLoans}
            remainingLoans={remainingLoans}
            totalDeducted={totalDeducted}
            openEdit={openEdit}
            setSelected={setSelected}
            onAddLoan={() => setShowLoanForm(true)}
            onApproveLoan={({ id, requestedAmount, currency, safeId }) => {
              setApproveModal({ id, requestedAmount, currency });
              setApproveForm({ approved_amount: String(requestedAmount), safe_id: safeId != null ? String(safeId) : '', notes: '' });
            }}
            onPayLoan={(loanId) => setShowPayModal(loanId)}
            onAddDeduction={() => setShowDeductForm(true)}
            onDeleteDeduction={(id) => deleteDeduction.mutate(id)}
            onAddBonus={() => setShowBonusForm(true)}
            onDeleteBonus={(id) => deleteBonus.mutate(id)}
            onAddCustody={() => setShowCustodyForm(true)}
            onSettleCustody={(custodyId) => {
              setShowSettleCustody(custodyId);
              setSettleLines([blankSettleLine()]);
              setSettleNotes('');
            }}
            onReimburseCustody={(custodyId) => {
              setShowReimburseCustody(custodyId);
              setReimburseSafeId('');
              setReimburseNotes('');
            }}
            onDeleteCustody={(id) => deleteCustody.mutate(id)}
          />
        )}
      </div>
      {/* Employee Create/Edit Form */}
      <EmployeeForm
        showForm={showForm}
        setShowForm={setShowForm}
        editId={editId}
        editEmp={editEmp}
        set={set}
        saveEmployee={saveEmployee}
        createEmp={createEmp}
        updateEmp={updateEmp}
        departments={departments}
        jobTitles={jobTitles}
        branches={branches}
        showInlineDept={showInlineDept}
        setShowInlineDept={setShowInlineDept}
        inlineDept={inlineDept}
        setInlineDept={setInlineDept}
        createInlineDept={createInlineDept}
        showInlineJt={showInlineJt}
        setShowInlineJt={setShowInlineJt}
        inlineJt={inlineJt}
        setInlineJt={setInlineJt}
        createInlineJt={createInlineJt}
        toast={toast}
      />
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

      {/* ══════════════════════════════════════════════════════════
          APPROVE LOAN MODAL
      ══════════════════════════════════════════════════════════ */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-400" />
                اعتماد السلفة
              </h2>
              <button onClick={() => setApproveModal(null)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-300">
                المبلغ المطلوب: <span className="font-bold font-mono">{approveModal.requestedAmount.toLocaleString('ar-EG-u-nu-latn')} {approveModal.currency}</span>
              </div>
              <Field label="المبلغ المعتمد *">
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={approveForm.approved_amount}
                  onChange={(e) => setApproveForm((p) => ({ ...p, approved_amount: e.target.value }))}
                  className="erp-input w-full"
                />
              </Field>
              <Field label="الخزينة *">
                <select
                  value={approveForm.safe_id}
                  onChange={(e) => setApproveForm((p) => ({ ...p, safe_id: e.target.value }))}
                  className="erp-input w-full"
                >
                  <option value="">— اختر الخزينة —</option>
                  {safesForEmployee(selected).map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name)}{s.balance != null ? ` — الرصيد: ${Number(s.balance).toLocaleString('ar-EG-u-nu-latn')}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-amber-300/70 mt-1">⚠️ إلزامي — سيُخصم المبلغ من الخزينة المختارة فور الاعتماد</p>
              </Field>
              <Field label="ملاحظات الاعتماد (اختياري)">
                <input
                  value={approveForm.notes}
                  onChange={(e) => setApproveForm((p) => ({ ...p, notes: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="سبب الاعتماد أو ملاحظة..."
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  if (!approveForm.safe_id) {
                    toast({ title: 'الخزينة مطلوبة', description: 'يجب اختيار الخزينة قبل الاعتماد', variant: 'destructive' });
                    return;
                  }
                  approveLoan.mutate({
                    id: approveModal.id,
                    approved_amount: Number(approveForm.approved_amount) || approveModal.requestedAmount,
                    safe_id: Number(approveForm.safe_id),
                    notes: approveForm.notes || undefined,
                  });
                }}
                disabled={approveLoan.isPending || !approveForm.safe_id}
                className="erp-btn erp-btn-primary flex-1 flex items-center justify-center gap-1"
              >
                <CheckCircle size={14} />
                {approveLoan.isPending ? 'جاري الاعتماد...' : 'اعتماد وصرف السلفة'}
              </button>
              <button onClick={() => setApproveModal(null)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
