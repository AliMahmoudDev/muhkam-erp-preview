import React from 'react';
import { Loader2, Download, Upload, CheckCircle2, Package, ShoppingCart } from 'lucide-react';
import { FieldLabel, SInput, SSelect } from '../_shared';
import { PurchaseRow } from './data-utils';

interface ImportProductsProps {
  prodImporting: boolean;
  prodExporting: boolean;
  prodResult: { success: number; failed: number } | null;
  prodRef: React.RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadProductTemplate: () => void;
}

function ImportProductsTab({
  prodImporting, prodExporting, prodResult, prodRef,
  onExport, onImport, onDownloadProductTemplate: onDownloadTemplate,
}: ImportProductsProps) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
        <div>
          <p className="text-emerald-400 font-bold text-sm">تصدير الأصناف الحالية</p>
          <p className="text-ink/30 text-xs">تحميل جميع الأصناف كملف Excel</p>
        </div>
        <button
          onClick={onExport}
          disabled={prodExporting}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/25 rounded-xl text-emerald-400 font-bold text-xs transition-all disabled:opacity-40"
        >
          {prodExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {prodExporting ? 'جاري التصدير...' : 'تصدير Excel'}
        </button>
      </div>

      <div className="h-px bg-surface" />

      <div className="space-y-3">
        <p className="text-ink/50 text-sm font-semibold">استيراد أصناف جديدة</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => prodRef.current?.click()}
            disabled={prodImporting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 rounded-xl text-amber-400 font-bold text-xs transition-all disabled:opacity-40"
          >
            {prodImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {prodImporting ? 'جاري الاستيراد...' : 'رفع ملف Excel'}
          </button>
          <button
            onClick={onDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 border border-line hover:border-line rounded-xl text-ink/40 hover:text-ink text-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" /> نموذج فارغ
          </button>
        </div>
        <input ref={prodRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} />
        {prodResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl border text-xs ${prodResult.failed === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              تم استيراد <strong>{prodResult.success}</strong> صنف
              {prodResult.failed > 0 && <span className="text-red-400"> — فشل {prodResult.failed}</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ImportPurchasesProps {
  purRows: PurchaseRow[];
  purParsed: boolean;
  purLoading: boolean;
  purConfirming: boolean;
  purResult: string | null;
  purSupplier: string;
  purPayType: 'cash' | 'credit';
  purRef: React.RefObject<HTMLInputElement | null>;
  validRows: PurchaseRow[];
  onPurchaseFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdatePurRow: (idx: number, field: 'quantity' | 'unitPrice', val: string) => void;
  onPurchaseConfirm: () => void;
  onDownloadPurchaseTemplate: () => void;
  onReset: () => void;
  onSetPurSupplier: (v: string) => void;
  onSetPurPayType: (v: 'cash' | 'credit') => void;
}

function ImportPurchasesTab({
  purRows, purParsed, purLoading, purConfirming, purResult,
  purSupplier, purPayType, purRef, validRows,
  onPurchaseFile, onUpdatePurRow, onPurchaseConfirm, onDownloadPurchaseTemplate: onDownloadTemplate,
  onReset, onSetPurSupplier, onSetPurPayType,
}: ImportPurchasesProps) {
  return (
    <div className="p-5 space-y-4">
      {!purParsed ? (
        <div className="space-y-3">
          <p className="text-ink/50 text-sm">ارفع ملف Excel يحتوي بنود فاتورة المشتريات</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => purRef.current?.click()}
              disabled={purLoading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 rounded-xl text-violet-400 font-bold text-xs transition-all disabled:opacity-40"
            >
              {purLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {purLoading ? 'جاري القراءة...' : 'رفع ملف Excel'}
            </button>
            <button
              onClick={onDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-line hover:border-line rounded-xl text-ink/40 hover:text-ink text-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" /> نموذج فارغ
            </button>
          </div>
          <input ref={purRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPurchaseFile} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line">
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-400 font-bold">{validRows.length} صحيح ✓</span>
              {purRows.filter((r) => r.errors.length > 0).length > 0 && (
                <span className="text-red-400 font-bold">
                  {purRows.filter((r) => r.errors.length > 0).length} خطأ ✗
                </span>
              )}
            </div>
            <button onClick={onReset} className="text-xs text-ink/35 hover:text-ink transition-colors">
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>المورد (اختياري)</FieldLabel>
              <SInput placeholder="اسم المورد" value={purSupplier} onChange={(e) => onSetPurSupplier(e.target.value)} />
            </div>
            <div>
              <FieldLabel>طريقة الدفع</FieldLabel>
              <SSelect value={purPayType} onChange={(e) => onSetPurPayType(e.target.value as 'cash' | 'credit')}>
                <option value="cash">نقدي</option>
                <option value="credit">آجل</option>
              </SSelect>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="bg-surface border-b border-line">
                  {['SKU', 'الصنف', 'الكمية', 'السعر', 'الإجمالي', 'الحالة'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-right text-ink/35 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purRows.map((r) => {
                  const hasErr = r.errors.length > 0;
                  const total  = (+r.quantity || 0) * (+r.unitPrice || 0);
                  return (
                    <tr key={r.idx} className={`border-b border-line ${hasErr ? 'bg-red-500/5' : 'hover:bg-surface'}`}>
                      <td className="px-3 py-2 text-ink/40 font-mono">{r.sku || '—'}</td>
                      <td className="px-3 py-2 text-ink/60 max-w-[100px] truncate">{r.name || '—'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number" value={r.quantity}
                          onChange={(e) => onUpdatePurRow(r.idx, 'quantity', e.target.value)}
                          className={`w-16 px-2 py-1 rounded-lg bg-surface border text-ink text-center text-xs outline-none ${!r.quantity || +r.quantity <= 0 ? 'border-red-500/50' : 'border-line'}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" value={r.unitPrice}
                          onChange={(e) => onUpdatePurRow(r.idx, 'unitPrice', e.target.value)}
                          className={`w-20 px-2 py-1 rounded-lg bg-surface border text-ink text-center text-xs outline-none ${!r.unitPrice || +r.unitPrice <= 0 ? 'border-red-500/50' : 'border-line'}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-ink/45 font-mono">{isNaN(total) ? '—' : total.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        {hasErr
                          ? <span className="text-red-400 text-[10px]" title={r.errors.join(' | ')}>✗ {r.errors[0]}</span>
                          : <span className="text-emerald-400 text-[10px]">✓ صالح</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {validRows.length > 0 && (
            <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-surface border border-line">
              <span className="text-ink/40 text-sm">إجمالي الفاتورة</span>
              <span className="text-amber-400 font-black text-lg">
                {validRows.reduce((s, r) => s + (+r.quantity || 0) * (+r.unitPrice || 0), 0).toFixed(2)}
              </span>
            </div>
          )}

          {purResult && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> {purResult}
            </div>
          )}

          <button
            onClick={onPurchaseConfirm}
            disabled={purConfirming || !validRows.length}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 rounded-xl text-violet-300 font-bold text-sm transition-all disabled:opacity-40"
          >
            {purConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {purConfirming ? 'جاري إنشاء الفاتورة...' : `تأكيد استيراد ${validRows.length} صنف وإنشاء فاتورة`}
          </button>
        </>
      )}
    </div>
  );
}

interface ImportSectionProps extends ImportProductsProps, ImportPurchasesProps {
  importTab: 'products' | 'purchases';
  onSetImportTab: (tab: 'products' | 'purchases') => void;
}

export default function ImportSection({ importTab, onSetImportTab, ...rest }: ImportSectionProps) {
  return (
    <div className="bg-[#111827] border border-line rounded-2xl overflow-hidden">
      <div className="flex border-b border-line">
        {([
          ['products',  <Package className="w-4 h-4" />,     'استيراد الأصناف',    'Excel → مخزن' ],
          ['purchases', <ShoppingCart className="w-4 h-4" />, 'استيراد المشتريات', 'Excel → فاتورة'],
        ] as const).map(([id, icon, label, sub]) => (
          <button
            key={id}
            onClick={() => onSetImportTab(id)}
            className={`flex-1 flex items-center gap-2.5 px-4 py-3.5 text-right transition-all border-b-2 ${importTab === id ? 'border-amber-400 bg-amber-500/5' : 'border-transparent hover:bg-surface'}`}
          >
            <span className={importTab === id ? 'text-amber-400' : 'text-ink/30'}>{icon}</span>
            <div>
              <p className={`text-sm font-bold ${importTab === id ? 'text-amber-400' : 'text-ink/50'}`}>{label}</p>
              <p className="text-ink/25 text-xs">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {importTab === 'products' && <ImportProductsTab {...rest} />}
      {importTab === 'purchases' && <ImportPurchasesTab {...rest} />}
    </div>
  );
}
