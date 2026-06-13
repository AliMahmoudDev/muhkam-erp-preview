import { Loader2 } from 'lucide-react';
import type { OBEntry } from '../types';

interface OBEntryTableProps {
  data: OBEntry[];
  isLoading: boolean;
  columns: { label: string; render: (e: OBEntry) => React.ReactNode }[];
}

export function OBEntryTable({ data, isLoading, columns }: OBEntryTableProps) {
  if (isLoading)
    return (
      <div className="p-8 text-center text-ink/40 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        جاري التحميل...
      </div>
    );
  if (data.length === 0)
    return <div className="p-8 text-center text-ink/25 text-sm">لا توجد قيود مسجلة</div>;
  return (
    <table className="w-full text-right text-sm">
      <thead className="bg-surface border-b border-line">
        <tr>
          {columns.map((c) => (
            <th key={c.label} className="p-3 text-ink/40 text-xs font-medium">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((e) => (
          <tr key={e.id} className="border-b border-line hover:bg-surface transition-colors">
            {columns.map((c) => (
              <td key={c.label} className="p-3 text-ink/70 text-sm">
                {c.render(e)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
