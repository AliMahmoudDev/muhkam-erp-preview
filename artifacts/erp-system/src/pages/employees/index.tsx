import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Banknote, Target } from 'lucide-react';
import { EmployeeList } from './EmployeeList';
import { EmployeeDetail } from './EmployeeDetail';
import { EmployeeForm } from './EmployeeForm';
import { useEmployeeData } from './hooks/useEmployeeData';
import { useEmployeeForm } from './hooks/useEmployeeForm';
import { EmployeeSalaryModal, type EmployeeSalaryModalRef } from './EmployeeSalaryModal';
import type { Employee, DetailTab } from './types';

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

/* ══════════════════════════════════════════════════════════════ */
export default function Employees() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage     = hasPermission(user, 'can_manage_employees');
  const canViewSalary = hasPermission(user, 'can_view_employee_salary');
  const isSelfService = user?.role === 'employee';
  const selfEmpId     = user?.employee_id ?? null;

  /* ── Page-level tab ─────────────────────────────────────────── */
  const [pageTab, setPageTab] = useState<PageTab>('list');

  /* ── List & selection state ─────────────────────────────────── */
  const [search,     setSearch]     = useState('');
  const [deptFilter, setDeptFilter] = useState<number | ''>('');
  const [empPage,    setEmpPage]    = useState(1);
  const EMP_PAGE_SIZE = 50;
  const [selected,   setSelected]   = useState<Employee | null>(null);
  const [detailTab,  setDetailTab]  = useState<DetailTab>('info');

  /* ── Modal controller ref ───────────────────────────────────── */
  const modalRef = useRef<EmployeeSalaryModalRef>(null);

  /* ── Data hook (queries only) ───────────────────────────────── */
  const {
    employees, empsLoading,
    departments, jobTitles, branches,
    safes, expenseCategories,
    documents, bonuses, custody,
    loans, loansLoading,
    deductions, ledgerLoading,
  } = useEmployeeData({ search, deptFilter, selected, detailTab });

  /* ── Form hook (form state + employee mutations) ────────────── */
  const {
    showForm, setShowForm,
    editEmp,
    editId,
    showInlineDept, setShowInlineDept,
    inlineDept, setInlineDept,
    showInlineJt, setShowInlineJt,
    inlineJt, setInlineJt,
    set, openCreate, openEdit, saveEmployee,
    createEmp, updateEmp,
    createInlineDept, createInlineJt,
  } = useEmployeeForm();

  /* ── Self-service: auto-select own profile ──────────────────── */
  useEffect(() => {
    if (isSelfService && selfEmpId && employees.length > 0 && !selected) {
      const own = employees.find((e) => e.id === selfEmpId);
      if (own) setSelected(own);
    }
  }, [isSelfService, selfEmpId, employees, selected]);

  /* ── Derived: filtered + paginated list ─────────────────────── */
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
    [employees, search, deptFilter],
  );
  useEffect(() => { setEmpPage(1); }, [search, deptFilter]);
  const paginatedEmps = useMemo(
    () => filtered.slice((empPage - 1) * EMP_PAGE_SIZE, empPage * EMP_PAGE_SIZE),
    [filtered, empPage],
  );

  /* ── Summary stats ──────────────────────────────────────────── */
  const totalLoans = loans.reduce((s, l) => s + Number(l.requested_amount ?? 0), 0);
  const remainingLoans = loans
    .filter((l) => ['active', 'approved'].includes(String(l.status)))
    .reduce((s, l) => s + Number(l.remaining_balance ?? 0), 0);
  const totalDeducted  = deductions.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const totalActive    = employees.filter((e) => e.employment_status === 'active').length;

  /* ── Page header (tabs + summary) ──────────────────────────── */
  const PageHeader = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <UserCheck size={22} className="text-amber-400" /> إدارة الموظفين
        </h1>
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPageTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pageTab === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {pageTab === 'list' && !isSelfService && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'الموظفون النشطون', value: totalActive,   color: 'text-emerald-300' },
            { label: 'إجمالي السلف',     value: totalLoans.toLocaleString('ar-EG-u-nu-latn'),    color: 'text-amber-300' },
            { label: 'رصيد السلف المتبقي', value: remainingLoans.toLocaleString('ar-EG-u-nu-latn'), color: 'text-rose-300' },
            { label: 'إجمالي الخصومات',  value: totalDeducted.toLocaleString('ar-EG-u-nu-latn'), color: 'text-red-300' },
          ].map((stat) => (
            <div key={stat.label} className="erp-card p-3">
              <div className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Sub-page early returns ─────────────────────────────────── */
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

  /* ── Main list view ─────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-4" dir="rtl">
      {PageHeader}

      <div className={`grid grid-cols-1 ${isSelfService ? '' : 'xl:grid-cols-3'} gap-4`}>
        {!isSelfService && (
          <EmployeeList
            search={search}
            setSearch={setSearch}
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            departments={departments}
            empsLoading={empsLoading}
            filtered={filtered}
            paginatedEmps={paginatedEmps}
            empPage={empPage}
            EMP_PAGE_SIZE={EMP_PAGE_SIZE}
            setEmpPage={setEmpPage}
            selected={selected}
            setSelected={setSelected}
            setDetailTab={setDetailTab}
            canManage={canManage}
            canViewSalary={canViewSalary}
            openCreate={openCreate}
            openEdit={openEdit}
            setDeleteId={(id) => { if (id !== null) modalRef.current?.openDelete(id); }}
          />
        )}

        {selected && (
          <EmployeeDetail
            selected={selected}
            setSelected={setSelected}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            canManage={canManage}
            canViewSalary={canViewSalary}
            isSelfService={isSelfService}
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
            onAddLoan={() => modalRef.current?.openLoanForm()}
            onPayLoan={(id) => modalRef.current?.openPayModal(id)}
            onApproveLoan={({ id, requestedAmount, currency, safeId }) =>
              modalRef.current?.openApproveModal({ id, requestedAmount, currency, safeId })
            }
            onAddDeduction={() => modalRef.current?.openDeductForm()}
            onDeleteDeduction={(id) => modalRef.current?.deleteDeduction(id)}
            onAddBonus={() => modalRef.current?.openBonusForm()}
            onDeleteBonus={(id) => modalRef.current?.deleteBonus(id)}
            onAddCustody={() => modalRef.current?.openCustodyForm()}
            onSettleCustody={(id) => modalRef.current?.openSettleCustody(id)}
            onReimburseCustody={(id) => modalRef.current?.openReimburseCustody(id)}
            onDeleteCustody={(id) => modalRef.current?.deleteCustody(id)}
          />
        )}
      </div>

      {/* Employee create/edit form */}
      {showForm && (
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
          createInlineJt={createInlineJt}
          showInlineJt={showInlineJt}
          setShowInlineJt={setShowInlineJt}
          inlineJt={inlineJt}
          setInlineJt={setInlineJt}
          toast={toast}
        />
      )}

      {/* All action modals (delete, loans, deductions, bonuses, custody) */}
      <EmployeeSalaryModal
        ref={modalRef}
        selected={selected}
        safes={safes}
        expenseCategories={expenseCategories}
        custody={custody}
        isSelfService={isSelfService}
        onEmployeeDeleted={() => setSelected(null)}
      />
    </div>
  );
}
