export default function AttendanceSummary({
  total,
  present,
  absent,
  late,
}: {
  total: number;
  present: number;
  absent: number;
  late: number;
}) {
  const stats = [
    { label: 'إجمالي السجلات', val: total, color: 'text-ink' },
    { label: 'حاضر', val: present, color: 'text-emerald-300' },
    { label: 'غائب', val: absent, color: 'text-red-400' },
    { label: 'متأخر', val: late, color: 'text-amber-300' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="erp-card p-4 text-center">
          <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
          <div className="text-xs text-ink/40 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
