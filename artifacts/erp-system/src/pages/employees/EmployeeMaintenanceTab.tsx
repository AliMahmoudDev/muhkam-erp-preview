import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { Wrench } from 'lucide-react';

function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '0';
}

const SVC_STATUS_AR: Record<string, string> = {
  pending: 'معلق',
  in_progress: 'جارِ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};
const JOB_STATUS_AR: Record<string, string> = {
  received: 'مستلم',
  in_progress: 'قيد الإصلاح',
  repaired: 'تم الإصلاح',
  delivered: 'مُسلَّم',
  cancelled: 'ملغي',
  pending: 'معلق',
};


export function EmployeeMaintenanceTab({
  employeeId,
  canManage = false,
}: {
  employeeId: number;
  canManage?: boolean;
}) {
  const { data, isLoading } = useQuery<MaintenanceData>({
    queryKey: ['/api/employees', employeeId, 'maintenance-tab'],
    queryFn: async () => {
      const r = await authFetch(`/api/employees/${employeeId}/maintenance-tab`);
      if (!r.ok) throw new Error('failed');
      return r.json() as Promise<MaintenanceData>;
    },
    enabled: !!employeeId,
  });

  if (isLoading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );

  if (!data) return <div className="text-xs text-ink/40 text-center py-6">لا توجد بيانات</div>;

  if (!data.has_user)
    return (
      <div className="text-center py-8 space-y-2">
        <Wrench size={28} className="mx-auto text-ink/20" />
        <p className="text-xs text-ink/40">هذا الموظف لا يملك حساب مستخدم مرتبط</p>
        <p className="text-[10px] text-ink/25">لا يمكن تتبع خدمات الصيانة بدون ربط بحساب</p>
      </div>
    );

  if (data.total_assigned === 0)
    return (
      <div className="text-center py-8 space-y-2">
        <Wrench size={28} className="mx-auto text-ink/20" />
        <p className="text-xs text-ink/40">لم تُسند لهذا الفني أي خدمات بعد</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'إجمالي المُسنَدة', value: String(data.total_assigned), color: 'text-ink/80' },
          { label: 'النشطة', value: String(data.active_count), color: 'text-amber-300' },
          { label: 'المُسلَّمة', value: String(data.delivered_count), color: 'text-emerald-300' },
          { label: 'عمولات محققة', value: fmt(data.total_earned), color: 'text-emerald-300' },
          { label: 'عمولات معلقة', value: fmt(data.pending_commission), color: 'text-amber-300' },
          { label: 'متوسط العمولة', value: fmt(data.avg_commission), color: 'text-ink/60' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-line rounded-xl p-2.5 text-center"
          >
            <div className={`text-sm font-bold font-mono ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-ink/35 mt-0.5 leading-tight">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── جدول الخدمات الأخيرة ── */}
      {data.services.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-ink/50 mb-1.5">
            آخر {data.services.length} خدمة
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-[10px]">
              <thead className="bg-surface text-ink/40">
                <tr>
                  {[
                    'رقم البطاقة',
                    'العميل',
                    'نوع الخدمة',
                    'المبلغ',
                    'العمولة',
                    'حالة الخدمة',
                    'حالة البطاقة',
                    'تاريخ الإضافة',
                    'تاريخ التسليم',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-right px-2 py-2 font-semibold whitespace-nowrap border-b border-line"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.services.map((s) => (
                  <tr key={s.id} className="border-t border-line hover:bg-surface">
                    <td className="px-2 py-1.5 font-mono text-amber-300 whitespace-nowrap">
                      {s.job_no}
                    </td>
                    <td className="px-2 py-1.5 text-ink/70 max-w-[70px] truncate">
                      {s.customer_name}
                    </td>
                    <td className="px-2 py-1.5 text-ink/60 max-w-[70px] truncate">
                      {s.service_type}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink/80 whitespace-nowrap">
                      {fmt(s.amount)}
                    </td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      {s.commission_locked ? (
                        <span className="text-emerald-300">{fmt(s.commission_computed ?? 0)}</span>
                      ) : (
                        <span className="text-ink/25">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          s.service_status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : s.service_status === 'in_progress'
                              ? 'bg-amber-500/20 text-amber-300'
                              : s.service_status === 'cancelled'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-surface text-ink/50'
                        }`}
                      >
                        {SVC_STATUS_AR[s.service_status] ?? s.service_status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          s.job_status === 'delivered'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : s.job_status === 'cancelled'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-surface text-ink/50'
                        }`}
                      >
                        {JOB_STATUS_AR[s.job_status] ?? s.job_status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink/35 whitespace-nowrap">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleDateString('ar-EG-u-nu-latn')
                        : '—'}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-ink/35 whitespace-nowrap">
                      {s.delivered_at
                        ? new Date(s.delivered_at).toLocaleDateString('ar-EG-u-nu-latn')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── قسم ملخص العمولات ── */}
      <div className="bg-surface border border-line rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-semibold text-ink/50 border-b border-line pb-1.5">
          ملخص العمولات
        </p>
        <div className="space-y-1.5">
          {[
            {
              label: 'إجمالي العمولات المحققة',
              value: fmt(data.total_earned),
              color: 'text-emerald-300',
            },
            {
              label: 'إجمالي العمولات المعلقة',
              value: fmt(data.pending_commission),
              color: 'text-amber-300',
            },
            {
              label: 'خدمات تم احتساب عمولتها',
              value: String(data.commission_services_count),
              color: 'text-emerald-300',
            },
            {
              label: 'خدمات لم تُحتسب عمولتها بعد',
              value: String(data.no_commission_services_count),
              color: 'text-ink/50',
            },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-xs text-ink/40">{row.label}</span>
              <span className={`text-xs font-bold font-mono ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── دفتر العمولات والصرف ── */}
      <CommissionLedgerSection employeeId={employeeId} canManage={canManage} />
    </div>
  );
}
