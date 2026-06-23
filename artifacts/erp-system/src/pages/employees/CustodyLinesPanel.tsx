import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export function CustodyLinesPanel({ custodyId }: { custodyId: number }) {
  const { data, isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['/api/employee-custody', custodyId, 'lines'],
    queryFn: async () => {
      const r = await authFetch(`/api/employee-custody/${custodyId}/lines`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });
  if (isLoading)
    return <div className="text-xs text-ink/40 mt-2 text-center py-2">جارِ التحميل…</div>;
  const lines = data ?? [];
  if (lines.length === 0)
    return (
      <div className="text-xs text-ink/40 mt-2 text-center py-2 bg-surface rounded">
        لا توجد بنود مصروفات
      </div>
    );
  return (
    <div className="mt-2 bg-black/20 rounded border border-line overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-surface text-ink/50">
          <tr>
            <th className="text-right p-1.5">المبلغ</th>
            <th className="text-right p-1.5">النوع</th>
            <th className="text-right p-1.5">الوصف</th>
            <th className="text-right p-1.5">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={String(l['id'])} className="border-t border-line">
              <td className="p-1.5 font-mono text-amber-300">
                {Number(l['amount'] ?? 0).toFixed(2)}
              </td>
              <td className="p-1.5 text-ink/70">{String(l['category'] ?? '')}</td>
              <td className="p-1.5 text-ink/60">{String(l['description'] ?? '—')}</td>
              <td className="p-1.5 font-mono text-ink/40">{String(l['line_date'] ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
