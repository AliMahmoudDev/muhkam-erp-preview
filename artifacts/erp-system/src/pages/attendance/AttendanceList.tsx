import { Clock, LogOut, Pencil } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';

type AnyRec = Record<string, unknown>;

function statusBadge(s: string) {
  switch (s) {
    case 'present':
      return 'erp-badge erp-badge-success';
    case 'late':
      return 'erp-badge erp-badge-warning';
    case 'absent':
      return 'erp-badge erp-badge-danger';
    case 'on_leave':
      return 'erp-badge erp-badge-info';
    case 'holiday':
      return 'erp-badge erp-badge-pending';
    case 'excused':
      return 'erp-badge erp-badge-info';
    default:
      return 'erp-badge erp-badge-neutral';
  }
}
function statusAr(s: string) {
  const m: Record<string, string> = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    on_leave: 'إجازة',
    holiday: 'إجازة رسمية',
    weekend: 'عطلة',
    excused: 'استأذن',
  };
  return m[s] ?? s;
}

export default function AttendanceList({
  isLoading,
  recordsList,
  totalHours,
  from,
  setFrom,
  to,
  setTo,
  empSearch,
  setEmpSearch,
  statusFilter,
  setStatusFilter,
  canManage,
  openCheckOut,
  openEdit,
}: {
  isLoading: boolean;
  recordsList: AnyRec[];
  totalHours: number;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  empSearch: string;
  setEmpSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  canManage: boolean;
  openCheckOut: (rec: AnyRec) => void;
  openEdit: (rec: AnyRec) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink/50">من:</label>
          <input
            type="date"
            className="erp-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink/50">إلى:</label>
          <input
            type="date"
            className="erp-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <input
          className="erp-input"
          placeholder="بحث بالاسم أو الرمز"
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
        />
        <select
          className="erp-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="present">حاضر</option>
          <option value="late">متأخر</option>
          <option value="absent">غائب</option>
          <option value="on_leave">إجازة</option>
          <option value="holiday">إجازة رسمية</option>
        </select>
      </div>

      <div className="text-xs text-ink/40 flex gap-4">
        <span>
          إجمالي ساعات العمل:{' '}
          <span className="text-amber-300 font-bold">{totalHours.toFixed(1)} س</span>
        </span>
        <span>
          السجلات الظاهرة: <span className="text-ink/60">{recordsList.length}</span>
        </span>
      </div>

      <div className="erp-card overflow-x-auto">
        {isLoading ? (
          <table className="erp-table w-full">
            <tbody>
              <TableSkeleton />
            </tbody>
          </table>
        ) : recordsList.length === 0 ? (
          <div className="erp-empty-state">
            <Clock size={36} className="erp-empty-icon mb-2" />
            <p className="erp-empty-label">لا توجد سجلات حضور للفترة المحددة</p>
          </div>
        ) : (
          <table className="erp-table w-full">
            <thead>
              <tr className="erp-table-header">
                <th className="p-3 text-right text-xs">الموظف</th>
                <th className="p-3 text-right text-xs">التاريخ</th>
                <th className="p-3 text-right text-xs">الحضور</th>
                <th className="p-3 text-right text-xs">الانصراف</th>
                <th className="p-3 text-right text-xs">ساعات</th>
                <th className="p-3 text-right text-xs">تأخير</th>
                <th className="p-3 text-right text-xs">الحالة</th>
                {canManage && <th className="p-3 text-right text-xs">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {recordsList.map((r) => (
                <tr key={String(r.id)} className="erp-table-row">
                  <td className="p-3 text-sm">
                    {String(r.first_name_ar ?? '')} {String(r.last_name_ar ?? '')}
                    <span className="text-ink/30 text-xs mr-1">
                      {String(r.employee_code ?? '')}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-ink/60 font-mono">{String(r.attendance_date)}</td>
                  <td className="p-3 text-sm text-emerald-300 font-mono">
                    {r.check_in_time ? String(r.check_in_time).substring(0, 5) : '—'}
                  </td>
                  <td className="p-3 text-sm text-red-400 font-mono">
                    {r.check_out_time ? String(r.check_out_time).substring(0, 5) : '—'}
                  </td>
                  <td className="p-3 text-sm font-mono">
                    {r.working_hours ? `${Number(r.working_hours).toFixed(1)}س` : '—'}
                  </td>
                  <td className="p-3 text-sm text-amber-300 font-mono">
                    {r.late_minutes ? `${r.late_minutes}د` : '—'}
                  </td>
                  <td className="p-3">
                    <span className={statusBadge(String(r.status))}>
                      {statusAr(String(r.status))}
                    </span>
                  </td>
                  {canManage && (
                    <td className="p-3">
                      <div className="flex gap-1">
                        {Boolean(r.check_in_time) && !r.check_out_time && (
                          <button
                            onClick={() => openCheckOut(r)}
                            title="تسجيل انصراف"
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            <LogOut size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(r)}
                          title="تعديل"
                          className="p-1.5 rounded-lg bg-surface text-ink/50 hover:bg-surface hover:text-ink transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
