import { CheckCircle, Loader2, X, FileSpreadsheet, FileText } from 'lucide-react';
import type { VarianceData } from './types';

export function CountVarianceSummary({
  variance,
  selectedWarehouse,
  countDate,
  countTime,
  isPending,
  onApply,
  onClear,
  onExportExcel,
  onExportPDF,
}: {
  variance: VarianceData;
  selectedWarehouse: number;
  countDate: string;
  countTime: string;
  isPending: boolean;
  onApply: () => void;
  onClear: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
}) {
  const { enteredProducts, itemsWithDiff, itemsWithPosDiff, itemsWithNegDiff, totalPosDiff, totalNegDiff, missingNotes, canApply } = variance;

  return (
    <div
      className={`rounded-2xl p-4 border ${itemsWithDiff.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p
            className={`font-bold text-sm ${itemsWithDiff.length > 0 ? 'text-amber-300' : 'text-emerald-300'}`}
          >
            {enteredProducts.length} منتج مُسجَّل
            {itemsWithDiff.length > 0
              ? ` — ${itemsWithDiff.length} بفرق`
              : ' — لا توجد فروق ✓'}
          </p>
          {itemsWithDiff.length > 0 && (
            <div className="flex gap-4 text-xs">
              {itemsWithPosDiff.length > 0 && (
                <span className="text-emerald-400">
                  ↑ زيادة: +{totalPosDiff.toFixed(2)} وحدة ({itemsWithPosDiff.length} صنف)
                </span>
              )}
              {itemsWithNegDiff.length > 0 && (
                <span className="text-red-400">
                  ↓ نقص: {totalNegDiff.toFixed(2)} وحدة ({itemsWithNegDiff.length} صنف)
                </span>
              )}
            </div>
          )}
          {(!selectedWarehouse || !countDate || !countTime) && (
            <p className="text-amber-400/70 text-xs">
              {!selectedWarehouse && '⚠ اختر مخزناً  '}
              {!countDate && '⚠ التاريخ مطلوب  '}
              {!countTime && '⚠ الوقت مطلوب'}
            </p>
          )}
          {missingNotes && itemsWithDiff.length > 0 && (
            <p className="text-red-400 text-xs font-bold">
              ⚠ يجب إدخال سبب الفرق لجميع المنتجات التي بها فرق
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2 flex-wrap">
          {enteredProducts.length > 0 && (
            <>
              <button
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-colors"
                title="تصدير Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
              <button
                onClick={onExportPDF}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-colors"
                title="تصدير PDF"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={onClear}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" /> مسح الكميات
              </button>
            </>
          )}
          <button
            onClick={onApply}
            disabled={isPending || !canApply}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> جاري التطبيق...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" /> تطبيق الجرد ({enteredProducts.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
