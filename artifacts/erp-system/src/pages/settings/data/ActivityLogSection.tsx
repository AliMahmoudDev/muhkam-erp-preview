import { History } from 'lucide-react';
import { ActivityEntry, ACTIVITY_STYLE, ACTIVITY_KEY } from './data-utils';

interface ActivityLogSectionProps {
  log: ActivityEntry[];
  onClear: () => void;
}

export default function ActivityLogSection({ log, onClear }: ActivityLogSectionProps) {
  return (
    <div className="bg-canvas border border-line rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center">
            <History className="w-4 h-4 text-ink/35" />
          </div>
          <div>
            <p className="font-bold text-ink text-sm">سجل العمليات</p>
            <p className="text-ink/30 text-xs">آخر {log.length} عملية</p>
          </div>
        </div>
        {log.length > 0 && (
          <button
            onClick={() => {
              localStorage.removeItem(ACTIVITY_KEY);
              onClear();
            }}
            className="text-xs text-ink/20 hover:text-red-400 transition-colors"
          >
            مسح السجل
          </button>
        )}
      </div>

      {log.length === 0 ? (
        <div className="py-8 text-center text-ink/20 text-sm">لا توجد عمليات مسجلة بعد</div>
      ) : (
        <div className="divide-y divide-white/4">
          {log.map((e) => {
            const s = ACTIVITY_STYLE[e.type];
            return (
              <div
                key={e.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-surface transition-colors"
              >
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${s.cls}`}>
                  {s.label}
                </span>
                <span className="text-ink/35 text-xs font-mono shrink-0">
                  {new Date(e.date).toLocaleString('ar-EG-u-nu-latn', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
                <span className="text-ink/40 text-xs truncate flex-1">{e.file}</span>
                <span className="text-ink/45 text-xs shrink-0">{e.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
