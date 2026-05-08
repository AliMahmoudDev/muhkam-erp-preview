import { AlertTriangle, X, Check, Upload } from 'lucide-react';

interface BackupRestoreModalProps {
  pending: {
    fileName: string;
    parsed: unknown;
    version: string | null;
    date: string | null;
    tableCount: number;
  } | null;
  modalText: string;
  understood: boolean;
  canConfirm: boolean;
  onSetModalText: (v: string) => void;
  onToggleUnderstood: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function BackupRestoreModal({
  pending, modalText, understood, canConfirm,
  onSetModalText, onToggleUnderstood, onClose, onConfirm,
}: BackupRestoreModalProps) {
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-[#0F1623] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="font-bold text-red-400 text-sm">تأكيد الاستعادة</p>
              <p className="text-white/30 text-xs">{pending.fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-red-300 font-bold text-sm">⚠️ سيتم حذف البيانات الحالية واستبدالها</p>
            <p className="text-white/35 text-xs mt-0.5">
              {pending.tableCount} جداول · الإصدار {pending.version ?? 'legacy'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-white/55 text-sm block">
              اكتب <span className="text-red-400 font-black tracking-widest">RESTORE</span> للمتابعة:
            </label>
            <input
              type="text"
              value={modalText}
              onChange={(e) => onSetModalText(e.target.value)}
              placeholder="RESTORE"
              spellCheck={false}
              autoComplete="off"
              className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm font-bold text-center tracking-widest outline-none transition-all ${modalText === 'RESTORE' ? 'border-emerald-500/50 text-emerald-400' : modalText.length > 0 ? 'border-red-500/40 text-white' : 'border-white/10 text-white'}`}
            />
          </div>

          <label
            className="flex items-start gap-3 cursor-pointer"
            onClick={onToggleUnderstood}
          >
            <div
              className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${understood ? 'bg-red-500 border-red-500' : 'border-white/20'}`}
            >
              {understood && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-white/55 text-sm leading-relaxed select-none">
              أفهم أن{' '}
              <span className="text-red-400 font-bold">جميع البيانات الحالية ستُحذف</span>
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 hover:text-white transition-all text-sm font-bold"
            >
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${canConfirm ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
            >
              <Upload className="w-4 h-4" /> استعادة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
