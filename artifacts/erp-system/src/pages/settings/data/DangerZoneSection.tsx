import { AlertTriangle, Loader2, Trash2, Check, X, Warehouse } from 'lucide-react';
import { SInput, SSelect, DangerBtn } from '../_shared';
import { DATA_GROUPS } from '../_constants';

interface DangerZoneSectionProps {
  selected: Set<string>;
  confirmText: string;
  clearBusy: boolean;
  canDelete: boolean;
  delCount: number;
  readyToDelete: boolean;
  resetText: string;
  canReset: boolean;
  resetCount: number;
  readyToReset: boolean;
  resetDbPending: boolean;
  allKeys: string[];
  selectedWarehouseId: number | '';
  warehousesList: { id: number; name: string }[];
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  onClear: () => void;
  onResetFull: () => void;
  onSetConfirmText: (v: string) => void;
  onSetResetText: (v: string) => void;
  onSetSelectedWarehouseId: (v: number | '') => void;
}

export default function DangerZoneSection({
  selected, confirmText, clearBusy, canDelete, delCount, readyToDelete,
  resetText, canReset, resetCount, readyToReset, resetDbPending,
  allKeys, selectedWarehouseId, warehousesList,
  onToggle, onToggleAll, onClear, onResetFull,
  onSetConfirmText, onSetResetText, onSetSelectedWarehouseId,
}: DangerZoneSectionProps) {
  return (
    <div className="bg-[#111827] border border-red-500/25 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-red-500/15 bg-red-500/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <p className="font-bold text-red-400 text-sm">منطقة الخطر</p>
          <p className="text-red-400/50 text-xs">العمليات هنا لا يمكن التراجع عنها — تأكد من نسخة احتياطية أولاً</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* الحذف الانتقائي */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-sm font-semibold flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400/70" /> حذف انتقائي
              {selected.size > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-bold">
                  {selected.size} محدد
                </span>
              )}
            </p>
            <button onClick={onToggleAll} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
              {selected.size === allKeys.length ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DATA_GROUPS.map((g) => {
              const on = selected.has(g.key);
              const isWarehouse = g.type === 'warehouse';
              return (
                <button
                  key={g.key}
                  onClick={() => onToggle(g.key)}
                  className={`p-3 rounded-xl text-right border transition-all ${on ? 'bg-red-500/12 border-red-500/35' : 'bg-[#1A2235] border-[#2D3748] hover:border-red-500/20'}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-bold flex items-center gap-1 ${on ? 'text-red-300' : 'text-white/60'}`}>
                      {isWarehouse && <Warehouse className="w-3 h-3" />}
                      {g.label}
                    </span>
                    {on ? (
                      <Check className="w-3 h-3 text-red-400" />
                    ) : (
                      <div className="w-3 h-3 rounded border border-white/15" />
                    )}
                  </div>
                  <p className="text-white/20 text-[10px]">{g.sub}</p>
                </button>
              );
            })}
          </div>

          {selected.has('warehouse') && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <p className="text-amber-300 text-xs font-bold flex items-center gap-2">
                <Warehouse className="w-3.5 h-3.5" /> اختر المخزن المراد تفريغه
              </p>
              <SSelect
                value={String(selectedWarehouseId)}
                onChange={(e) =>
                  onSetSelectedWarehouseId(e.target.value === '' ? '' : Number(e.target.value))
                }
              >
                <option value="">— كل المخازن —</option>
                {warehousesList.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </SSelect>
              <p className="text-white/25 text-[10px]">
                {selectedWarehouseId
                  ? `سيتم تفريغ حركات المخزن "${warehousesList.find((w) => w.id === selectedWarehouseId)?.name ?? ''}" فقط`
                  : 'سيتم تفريغ حركات جميع المخازن وتصفير الكميات'}
              </p>
            </div>
          )}

          {selected.size > 0 && (
            <div className="space-y-3 pt-2 border-t border-red-500/10">
              <div>
                <label className="text-white/45 text-xs block mb-2">
                  اكتب <span className="text-red-400 font-black">"تأكيد الحذف"</span> لتفعيل الزر:
                </label>
                <SInput
                  placeholder="تأكيد الحذف"
                  value={confirmText}
                  onChange={(e) => onSetConfirmText(e.target.value)}
                  className="border-red-500/20 focus:border-red-500/50"
                />
              </div>
              {readyToDelete && !canDelete && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                  <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
                  <p className="text-red-400 text-xs">
                    يمكنك الحذف بعد <span className="font-black">{delCount}</span> ثانية...
                  </p>
                </div>
              )}
              <DangerBtn onClick={onClear} disabled={clearBusy || !canDelete} className="w-full">
                {clearBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {clearBusy ? 'جاري المسح...' : `مسح ${selected.size} جدول`}
              </DangerBtn>
            </div>
          )}
        </div>

        <div className="h-px bg-red-500/10" />

        {/* إعادة التعيين الكاملة */}
        <div className="space-y-3">
          <div>
            <p className="text-red-300 font-semibold text-sm flex items-center gap-2">
              <X className="w-4 h-4" /> إعادة تعيين كاملة لقاعدة البيانات
            </p>
            <p className="text-red-300/40 text-xs mt-0.5">حذف جميع البيانات والإعادة للوضع الافتراضي</p>
          </div>
          <div>
            <label className="text-white/40 text-xs block mb-2">
              اكتب <span className="text-red-400 font-black">"إعادة تعيين كاملة"</span> لتفعيل الأمر:
            </label>
            <SInput
              placeholder="إعادة تعيين كاملة"
              value={resetText}
              onChange={(e) => onSetResetText(e.target.value)}
              className="border-red-800/30 focus:border-red-600/50"
            />
          </div>
          {readyToReset && !canReset && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
              <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" />
              <p className="text-red-400 text-xs">
                سيتم التنفيذ بعد <span className="font-black">{resetCount}</span> ثانية...
              </p>
            </div>
          )}
          <button
            onClick={onResetFull}
            disabled={resetDbPending || !canReset}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-900/25 hover:bg-red-900/40 border border-red-800/35 text-red-300 font-bold text-sm transition-all disabled:opacity-35"
          >
            {resetDbPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {resetDbPending ? 'جاري إعادة التعيين...' : 'إعادة تعيين كاملة'}
          </button>
        </div>
      </div>
    </div>
  );
}
