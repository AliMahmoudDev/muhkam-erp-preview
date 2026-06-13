/**
 * EmployeeFilters.tsx — search + department filter bar for the employee list.
 */
import { Search, Plus } from 'lucide-react';
import type { Department } from './types';

interface EmployeeFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  deptFilter: number | '';
  setDeptFilter: (v: number | '') => void;
  departments: Department[];
  canManage: boolean;
  onAddEmployee: () => void;
}

export function EmployeeFilters({
  search,
  setSearch,
  deptFilter,
  setDeptFilter,
  departments,
  canManage,
  onAddEmployee,
}: EmployeeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-ink/40" />
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
          onClick={onAddEmployee}
          className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
        >
          <Plus size={14} /> موظف جديد
        </button>
      )}
    </div>
  );
}
