import { ClipboardList, Plus, CheckCircle, Warehouse, Loader2 } from 'lucide-react';
import type { CountSessionEnriched } from '../_shared';

export function CountHistory({
  sessions,
  warehouses,
  applyingId,
  isPending,
  onApply,
  onSwitchToNew,
}: {
  sessions: CountSessionEnriched[];
  warehouses: { id: number; name: string }[];
  applyingId: number | null;
  isPending: boolean;
  onApply: (id: number) => void;
  onSwitchToNew: () => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-surface border border-line rounded-2xl">
        <ClipboardList className="w-10 h-10 text-ink/10 mb-3" />
        <p className="text-ink/40 font-bold mb-1">لا توجد جلسات جرد سابقة</p>
        <p className="text-ink/25 text-xs mb-4">ابدأ جلسة جديدة لتسجيل الكميات الفعلية</p>
        <button
          onClick={onSwitchToNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition-all"
        >
          <Plus className="w-4 h-4" /> بدء جرد جديد
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const whName =
          warehouses.find((w) => w.id === s.warehouse_id)?.name ?? `مخزن #${s.warehouse_id}`;
        const dateStr = new Date(s.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const timeStr = new Date(s.created_at).toLocaleTimeString('ar-EG-u-nu-latn', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div key={s.id} className="bg-canvas border border-line rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-ink font-bold">جلسة #{s.id}</span>
                  <span
                    className={s.status === 'applied' ? 'erp-status erp-status-paid' : 'erp-status erp-status-draft'}
                  >
                    {s.status === 'applied' ? '✓ مطبّق' : 'مسودة'}
                  </span>
                  {s.items_count > 0 && (
                    <span className="erp-status erp-status-inactive">
                      {s.items_count} منتج
                    </span>
                  )}
                  {s.adjustments_count > 0 && (
                    <span className="erp-status erp-status-partial">
                      {s.adjustments_count} تسوية
                    </span>
                  )}
                  {s.items_count > 0 && s.adjustments_count === 0 && s.status === 'applied' && (
                    <span className="erp-status erp-status-active">
                      لا فروق
                    </span>
                  )}
                </div>
                <div className="text-ink/50 text-xs flex items-center gap-2">
                  <Warehouse className="w-3 h-3 shrink-0" />
                  <span>{whName}</span>
                  <span className="text-ink/20">·</span>
                  <span>
                    {dateStr} الساعة {timeStr}
                  </span>
                </div>
                {s.notes && <div className="text-ink/30 text-xs truncate max-w-xs">{s.notes}</div>}
                {s.applied_at && (
                  <div className="text-emerald-400/50 text-xs">
                    طُبِّق: {new Date(s.applied_at).toLocaleDateString('ar-EG-u-nu-latn')}
                  </div>
                )}
              </div>
              {s.status === 'draft' && (
                <button
                  onClick={() => onApply(s.id)}
                  disabled={isPending && applyingId === s.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isPending && applyingId === s.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  تطبيق
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
