/**
 * EmployeeFilters.tsx — search + department filter bar for the employee list.
 */
import { Search, Plus } from 'lucide-react';
import type { Department } from './types';
import { Combobox } from '@/components/ui/combobox';

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
      <Combobox
        options={departments.map((d) => ({ value: String(d.id), label: d.name_ar }))}
        value={deptFilter === '' ? '' : String(deptFilter)}
        onChange={(v) => setDeptFilter(v === '' ? '' : Number(v))}
        placeholder="كل الأقسام"
        className="ml-[250px] mr-[250px]"
        clearable
      />
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
