import { SearchableSelect } from '@/components/searchable-select';

export interface CustomerPickerItem {
  value: string;
  label: string;
  searchKeys: string[];
}

interface Props {
  items: CustomerPickerItem[];
  value: string;
  onChange: (v: string) => void;
}

export function PosCustomerPicker({ items, value, onChange }: Props) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl flex items-center gap-2 px-3 py-1.5">
      <span className="text-xs opacity-50 shrink-0">العميل</span>
      <SearchableSelect
        items={items}
        value={value}
        onChange={onChange}
        placeholder="عميل نقدي / اختر..."
        emptyLabel="عميل نقدي"
        className="flex-1"
      />
    </div>
  );
}
