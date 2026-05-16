/**
 * hooks/useEmployeeData.ts
 * All React Query fetches for the Employees page.
 * No mutations here — those live in useEmployeeForm and EmployeeSalaryModal.
 */
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { api } from '@/lib/api';
import { useBranches } from '@/hooks/useBranches';
import { useSafes } from '@/hooks/useSafes';
import type { Employee, Department, JobTitle, Branch, EmpDocument, AnyRec, DetailTab } from '../types';

interface UseEmployeeDataParams {
  search: string;
  deptFilter: number | '';
  selected: Employee | null;
  detailTab: DetailTab;
}

export function useEmployeeData({ search, deptFilter, selected, detailTab }: UseEmployeeDataParams) {
  /* ── Global lists ─────────────────────────────────────────── */
  const { data: empsRaw, isLoading: empsLoading } = useQuery({
    queryKey: ['/api/employees', search, deptFilter],
    queryFn: () =>
      authFetch(
        api(`/api/employees?search=${encodeURIComponent(search)}&department_id=${deptFilter}`)
      ).then((r) => r.json()),
  });
  const employees: Employee[] = safeArray(empsRaw);

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

  const { branches: _branchesRaw } = useBranches();
  const branches = _branchesRaw as Branch[];

  /* All safes (خزائن) — بدون تصفية حسب الدور */
  const { safes } = useSafes();

  const { data: expCatsRaw } = useQuery({
    queryKey: ['/api/expense-categories'],
    queryFn: () => authFetch(api('/api/expense-categories')).then((r) => r.json()),
  });
  const expenseCategories: AnyRec[] = safeArray(expCatsRaw);

  /* ── Employee sub-data (conditional) ─────────────────────── */
  const { data: docsRaw } = useQuery({
    queryKey: ['/api/employees', selected?.id, 'documents'],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employees/${selected.id}/documents`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && detailTab === 'docs',
  });
  const documents: EmpDocument[] = safeArray(docsRaw);

  const { data: bonusesRaw } = useQuery({
    queryKey: ['/api/employee-bonuses', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employee-bonuses?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'bonuses' || detailTab === 'reports'),
  });
  const bonuses: AnyRec[] = safeArray(bonusesRaw);

  const { data: custodyRaw } = useQuery({
    queryKey: ['/api/employee-custody', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employee-custody?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'custody' || detailTab === 'reports'),
  });
  const custody: AnyRec[] = safeArray(custodyRaw);

  const { data: loansRaw, isLoading: loansLoading } = useQuery({
    queryKey: ['/api/salary-advances', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/salary-advances?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'loans' || detailTab === 'reports'),
  });
  const loans: AnyRec[] = safeArray(loansRaw);

  const { data: deductionsRaw, isLoading: ledgerLoading } = useQuery({
    queryKey: ['/api/employee-deductions', selected?.id],
    queryFn: () =>
      selected
        ? authFetch(api(`/api/employee-deductions?employee_id=${selected.id}`)).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selected && (detailTab === 'deductions' || detailTab === 'reports'),
  });
  const deductions: AnyRec[] = safeArray(deductionsRaw);

  return {
    employees, empsLoading,
    departments,
    jobTitles,
    branches,
    safes,
    expenseCategories,
    documents,
    bonuses,
    custody,
    loans, loansLoading,
    deductions, ledgerLoading,
  };
}
