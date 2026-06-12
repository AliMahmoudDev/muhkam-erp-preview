import { X, Database, Check } from 'lucide-react';
import { RESTORE_MODULE_GROUPS } from '../_constants';

interface BackupModSelectModalProps {
  pending: { fileName: string } | null;
  availMods: string[];
  selectedRestoreMods: Set<string>;
  onToggleMod: (key: string) => void;
  onToggleAll: () => void;
  onClose: () => void;
  onContinue: () => void;
}

export default function BackupModSelectModal({
  pending, availMods, selectedRestoreMods,
  onToggleMod, onToggleAll, onClose, onContinue,
}: BackupModSelectModalProps) {
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0F1623] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Database className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-amber-400 text-sm">اختر وحدات الاستعادة</p>
              <p className="text-ink/30 text-xs">{pending.fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink/30 hover:text-ink hover:bg-surface">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-ink/50 text-xs">الوحدات المتاحة في هذا الملف</p>
            <button
              onClick={onToggleAll}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              {selectedRestoreMods.size === availMods.length ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>
          </div>
          <div className="space-y-2">
            {RESTORE_MODULE_GROUPS.filter(g => availMods.includes(g.key)).map(g => {
              const on = selectedRestoreMods.has(g.key);
              return (
                <button
                  key={g.key}
                  onClick={() => onToggleMod(g.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all ${on ? 'bg-amber-500/10 border-amber-500/25' : 'bg-surface border-line hover:border-amber-500/15'}`}
                >
                  <span className="text-xl shrink-0">{g.icon}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${on ? 'text-amber-300' : 'text-ink/60'}`}>{g.label}</p>
                    <p className="text-ink/25 text-xs">{g.note}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-amber-500 border-amber-500' : 'border-line'}`}>
                    {on && <Check className="w-3 h-3 text-ink" />}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedRestoreMods.size === 0 && (
            <p className="text-center text-red-400 text-xs">اختر وحدة واحدة على الأقل</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-line text-ink/50 text-sm font-bold hover:text-ink transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={onContinue}
              disabled={selectedRestoreMods.size === 0}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              متابعة ({selectedRestoreMods.size} وحدات)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
