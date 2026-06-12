import { UserCheck, Pencil, Trash2, ChevronLeft } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';
import { PaginationBar } from '@/components/PaginationBar';
import { EmployeeFilters } from './EmployeeFilters';
import type { Employee, Department, DetailTab } from './types';

interface EmployeeListProps {
  search: string;
  setSearch: (v: string) => void;
  deptFilter: number | '';
  setDeptFilter: (v: number | '') => void;
  departments: Department[];
  empsLoading: boolean;
  filtered: Employee[];
  paginatedEmps: Employee[];
  empPage: number;
  EMP_PAGE_SIZE: number;
  setEmpPage: (v: number) => void;
  selected: Employee | null;
  setSelected: (e: Employee | null) => void;
  setDetailTab: (t: DetailTab) => void;
  canManage: boolean;
  canViewSalary: boolean;
  openCreate: () => void;
  openEdit: (emp: Employee) => void;
  setDeleteId: (id: number | null) => void;
}

export function EmployeeList({
  search,
  setSearch,
  deptFilter,
  setDeptFilter,
  departments,
  empsLoading,
  filtered,
  paginatedEmps,
  empPage,
  EMP_PAGE_SIZE,
  setEmpPage,
  selected,
  setSelected,
  setDetailTab,
  canManage,
  canViewSalary,
  openCreate,
  openEdit,
  setDeleteId,
}: EmployeeListProps) {
  return (
    <div className="xl:col-span-2 space-y-3">
      {/* Search & Filters */}
      <EmployeeFilters
        search={search}
        setSearch={setSearch}
        deptFilter={deptFilter}
        setDeptFilter={setDeptFilter}
        departments={departments}
        canManage={canManage}
        onAddEmployee={openCreate}
      />

      {/* Table */}
      <div className="erp-card overflow-x-auto">
        {empsLoading ? (
          <table className="erp-table w-full"><tbody><TableSkeleton /></tbody></table>
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
                  <td colSpan={7} className="text-center py-12 text-ink/40">
                    <div className="erp-empty-state">
                      <UserCheck size={36} className="mb-2 opacity-30" />
                      <p>لا توجد بيانات موظفين</p>
                    </div>
                  </td>
                </tr>
              )}
              {paginatedEmps.map((emp) => (
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
                      <div className="text-xs text-ink/30 font-mono">{emp.national_id}</div>
                    )}
                  </td>
                  <td className="p-3 text-sm text-ink/70">{emp.department_name ?? '—'}</td>
                  <td className="p-3 text-sm text-ink/70">{emp.job_title_name ?? '—'}</td>
                  <td className="p-3 text-xs text-ink/60 font-mono">{emp.hire_date}</td>
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
        {/* Pagination */}
        <PaginationBar
          page={empPage}
          totalItems={filtered.length}
          pageSize={EMP_PAGE_SIZE}
          onPageChange={setEmpPage}
          itemLabel="موظف"
        />
      </div>
    </div>
  );
}
