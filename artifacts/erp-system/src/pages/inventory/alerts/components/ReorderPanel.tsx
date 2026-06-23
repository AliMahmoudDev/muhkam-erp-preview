import {
  ShoppingCart,
  ClipboardList,
  X,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { ReorderSuggestion } from '../types';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../constants';

interface ReorderPanelProps {
  reorderData:
    | {
        suggestions: ReorderSuggestion[];
        total_cost: number;
        days_analyzed: number;
        cover_days: number;
      }
    | undefined;
  loadingReorder: boolean;
  reorderSuggestions: ReorderSuggestion[];
  selectedForPO: Set<number>;
  poSelectedCount: number;
  toggleSelectPO: (productId: number) => void;
  selectAllPO: () => void;
  clearSelectPO: () => void;
  setShowPOModal: (v: boolean) => void;
  handleExportReorderExcel: () => void;
  refetchReorder: () => void;
}

export function ReorderPanel({
  reorderData,
  loadingReorder,
  reorderSuggestions,
  selectedForPO,
  poSelectedCount,
  toggleSelectPO,
  selectAllPO,
  clearSelectPO,
  setShowPOModal,
  handleExportReorderExcel,
  refetchReorder,
}: ReorderPanelProps) {
  return (
    <div className="bg-canvas border border-line rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-ink font-bold text-sm">مقترحات إعادة الطلب</h3>
            <p className="text-ink/40 text-xs">
              حسب سرعة المبيعات في آخر {reorderData?.days_analyzed ?? 30} يوم — تغطية{' '}
              {reorderData?.cover_days ?? 30} يوم
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reorderSuggestions.length > 0 && (
            <>
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                إجمالي مقدّر: {formatCurrency(reorderData?.total_cost ?? 0)}
              </span>
              {poSelectedCount > 0 ? (
                <button
                  onClick={() => setShowPOModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs rounded-xl font-bold border border-amber-400 transition-colors"
                >
                  <ClipboardList className="w-3 h-3" /> إنشاء أمر شراء ({poSelectedCount})
                </button>
              ) : (
                <button
                  onClick={selectAllPO}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs rounded-xl border border-amber-500/20 transition-colors"
                >
                  <ClipboardList className="w-3 h-3" /> تحديد الكل لأمر الشراء
                </button>
              )}
              {poSelectedCount > 0 && (
                <button
                  onClick={clearSelectPO}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-surface hover:bg-surface text-ink/50 text-xs rounded-xl border border-line transition-colors"
                >
                  <X className="w-3 h-3" /> إلغاء
                </button>
              )}
              <button
                onClick={handleExportReorderExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs rounded-xl border border-emerald-500/20"
              >
                <FileSpreadsheet className="w-3 h-3" /> Excel
              </button>
            </>
          )}
          <button
            onClick={() => refetchReorder()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface text-ink/60 text-xs rounded-xl border border-line"
          >
            <RefreshCw className="w-3 h-3" /> تحديث
          </button>
        </div>
      </div>

      {loadingReorder ? (
        <div className="text-center py-8 text-ink/40 text-sm">جاري التحليل...</div>
      ) : reorderSuggestions.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-10 h-10 text-emerald-500/30 mx-auto mb-2" />
          <p className="text-ink/40 text-sm">لا توجد مقترحات توريد حالياً</p>
        </div>
      ) : (
        <>
          {poSelectedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>
                تم تحديد {poSelectedCount} صنف · إجمالي مقدّر:{' '}
                {formatCurrency(
                  reorderSuggestions
                    .filter((s) => selectedForPO.has(s.product_id))
                    .reduce((a, s) => a + s.suggested_cost, 0)
                )}
              </span>
              <button
                onClick={() => setShowPOModal(true)}
                className="ms-auto underline font-bold hover:text-amber-200"
              >
                إنشاء أمر الشراء الآن
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm min-w-[850px]">
              <thead>
                <tr className="border-b border-line bg-surface">
                  <th className="p-2.5 text-center text-ink/60 font-medium text-xs w-8">
                    <input
                      type="checkbox"
                      checked={
                        poSelectedCount === reorderSuggestions.length &&
                        reorderSuggestions.length > 0
                      }
                      onChange={(e) => (e.target.checked ? selectAllPO() : clearSelectPO())}
                      className="w-3.5 h-3.5 accent-violet-500"
                    />
                  </th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">الأولوية</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">المنتج</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">الحالي</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">سرعة (يوم)</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">التغطية</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">مقترح</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">تكلفة مقدّرة</th>
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">السبب</th>
                </tr>
              </thead>
              <tbody>
                {reorderSuggestions.slice(0, 50).map((s) => {
                  const isChecked = selectedForPO.has(s.product_id);
                  return (
                    <tr
                      key={s.product_id}
                      className={`border-b border-line erp-table-row cursor-pointer ${isChecked ? 'bg-amber-500/5' : ''}`}
                      onClick={() => toggleSelectPO(s.product_id)}
                    >
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectPO(s.product_id)}
                          className="w-3.5 h-3.5 accent-violet-500"
                        />
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold ${PRIORITY_COLORS[s.priority]}`}
                        >
                          {PRIORITY_LABELS[s.priority]}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="text-ink text-sm font-medium">{s.product_name}</div>
                        {s.sku && <div className="text-ink/40 text-xs font-mono">{s.sku}</div>}
                      </td>
                      <td className="p-2.5 font-mono text-ink/70 text-sm">
                        {s.current_qty.toFixed(2)}
                      </td>
                      <td className="p-2.5 font-mono text-ink/70 text-xs">
                        <TrendingUp className="w-3 h-3 inline me-1 text-emerald-400" />
                        {s.daily_velocity.toFixed(2)}
                      </td>
                      <td className="p-2.5 font-mono text-xs">
                        <span
                          className={
                            s.coverage_days !== null && s.coverage_days <= 7
                              ? 'text-red-400 font-bold'
                              : 'text-ink/60'
                          }
                        >
                          {s.coverage_days !== null ? `${s.coverage_days.toFixed(1)} يوم` : '∞'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 font-bold font-mono text-sm">
                          {s.suggested_qty}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-emerald-300 text-xs">
                        {formatCurrency(s.suggested_cost)}
                      </td>
                      <td className="p-2.5 text-ink/50 text-xs">{s.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {reorderSuggestions.length > 50 && (
              <div className="p-2 text-center text-ink/30 text-xs bg-surface">
                عُرضت أعلى 50 من {reorderSuggestions.length} — حمّل Excel لرؤية الكل
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
