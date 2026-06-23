import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '0';
}


export function EmployeeRepairsTab({ employeeId }: { employeeId: number }) {
  const { data, isLoading } = useQuery<{
    employee_id: number;
    jobs_count: number;
    total_revenue: number;
    jobs: Array<{
      id: number;
      job_no: string;
      customer_name: string;
      device_brand: string;
      device_model: string;
      status: string;
      final_cost: number;
      received_at: string;
      delivered_at?: string;
    }>;
  }>({
    queryKey: ['/api/employees', employeeId, 'repair-stats'],
    queryFn: async () => {
      const r = await authFetch(`/api/employees/${employeeId}/repair-stats`);
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    enabled: !!employeeId,
  });

  if (isLoading)
    return <div className="text-xs text-ink/40 text-center py-6">جارِ تحميل بيانات الصيانة…</div>;
  if (!data || data.jobs_count === 0)
    return (
      <div className="text-xs text-ink/40 text-center py-6 bg-surface rounded-xl">
        لا توجد بطاقات صيانة لهذا الفني
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface rounded-xl p-3 text-center border border-line">
          <div className="text-lg font-bold text-amber-300 font-mono">{data.jobs_count}</div>
          <div className="text-[10px] text-ink/40">بطاقات الصيانة</div>
        </div>
        <div className="bg-surface rounded-xl p-3 text-center border border-line">
          <div className="text-lg font-bold text-emerald-300 font-mono">
            {fmt(data.total_revenue)}
          </div>
          <div className="text-[10px] text-ink/40">إجمالي الإيرادات</div>
        </div>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {data.jobs.map((j) => (
          <div
            key={j.id}
            className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 border border-line text-xs"
          >
            <div>
              <span className="text-ink/80 font-bold font-mono">{j.job_no}</span>
              <span className="text-ink/40 mr-2">{j.customer_name}</span>
            </div>
            <div className="text-left">
              <span className="text-amber-300 font-mono">{fmt(j.final_cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
