import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { safeArray } from '@/lib/safe-data';
import {
  AlertTriangle,
  Truck,
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  ArrowRightLeft,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
import { api } from './_shared';
import type { AuditProduct, TransferEnriched, TransferPrefill } from './_shared';

interface TransferLine {
  product_id: number;
  product_name: string;
  quantity: string;
}

function TransferTab({
  warehouses,
  qc,
  toast,
  prefill,
  onClearPrefill,
}: {
  warehouses: { id: number; name: string }[];
  qc: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>['toast'];
  prefill: TransferPrefill | null;
  onClearPrefill: () => void;
}) {
  const defaultFirst = warehouses[0]?.id ?? 1;
  const defaultSecond = warehouses[1]?.id ?? 2;
  const [fromWH, setFromWH] = useState<number>(defaultFirst);
  const [toWH, setToWH] = useState<number>(defaultSecond);
  const [transferNotes, setTransferNotes] = useState('');
  const [lines, setLines] = useState<TransferLine[]>([
    { product_id: 0, product_name: '', quantity: '' },
  ]);
  const [view, setView] = useState<'new' | 'history'>('new');

  useEffect(() => {
    if (!prefill) return;
    setFromWH(prefill.fromWH);
    setToWH(prefill.toWH);
    setLines([
      {
        product_id: prefill.productId,
        product_name: prefill.productName,
        quantity: String(prefill.qty),
      },
    ]);
    setView('new');
    onClearPrefill();
  }, [prefill]);

  const { data: auditData } = useQuery<{ products: AuditProduct[] }>({
    queryKey: ['inventory-audit', null],
    queryFn: () => authFetch(api('/api/inventory/audit')).then((r) => r.json()),
  });

  const { data: fromWhAudit, isLoading: loadingFromWh } = useQuery<{ products: AuditProduct[] }>({
    queryKey: ['inventory-audit', fromWH],
    queryFn: () =>
      authFetch(api(`/api/inventory/audit?warehouse_id=${fromWH}`)).then((r) => r.json()),
    enabled: fromWH > 0,
    staleTime: 15_000,
  });

  const { data: enrichedTransfers, refetch: refetchTransfers } = useQuery<TransferEnriched[]>({
    queryKey: ['inventory-transfers-enriched'],
    queryFn: () => authFetch(api('/api/inventory/transfers-enriched')).then((r) => r.json()),
  });

  const allProducts = auditData?.products ?? [];
  const fromWhStock = new Map((fromWhAudit?.products ?? []).map((p) => [p.id, p.calculated_qty]));

  useEffect(() => {
    if (!prefill) {
      setLines([{ product_id: 0, product_name: '', quantity: '' }]);
    }
  }, [fromWH]);

  function getAvailableQty(productId: number): number {
    if (!productId) return 0;
    return fromWhStock.get(productId) ?? 0;
  }

  function lineHasInsufficientQty(line: TransferLine): boolean {
    if (!line.product_id || !line.quantity) return false;
    const qty = parseFloat(line.quantity);
    return qty > 0 && qty > getAvailableQty(line.product_id);
  }

  const hasAnyInsufficientQty = lines.some(lineHasInsufficientQty);

  const transferMutation = useMutation({
    mutationFn: () => {
      if (fromWH === toWH) throw new Error('لا يمكن التحويل من مخزن إلى نفسه');
      const validLines = lines.filter((l) => l.product_id > 0 && parseFloat(l.quantity) > 0);
      if (validLines.length === 0) throw new Error('أضف منتجاً واحداً على الأقل مع كمية صحيحة');
      if (hasAnyInsufficientQty) throw new Error('كمية غير كافية في مخزن المصدر لبعض المنتجات');
      return authFetch(api('/api/inventory/transfers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_warehouse_id: fromWH,
          to_warehouse_id: toWH,
          notes: transferNotes || undefined,
          items: validLines.map((l) => ({
            product_id: l.product_id,
            quantity: parseFloat(l.quantity),
          })),
        }),
      }).then((r) =>
        r.json().then((d) => {
          if (!r.ok) throw new Error(d.error ?? 'خطأ في التحويل');
          return d;
        })
      );
    },
    onSuccess: (data) => {
      toast({ title: `✅ تم التحويل — ${data.from_warehouse} ← ${data.to_warehouse}` });
      setLines([{ product_id: 0, product_name: '', quantity: '' }]);
      setTransferNotes('');
      qc.invalidateQueries({ queryKey: ['inventory-audit'] });
      qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
      qc.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      refetchTransfers();
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  function updateLine(idx: number, field: keyof TransferLine, value: string | number) {
    setLines((prev) => {
      const updated = [...prev];
      if (field === 'product_id') {
        const prod = allProducts.find((p) => p.id === Number(value));
        updated[idx] = {
          ...updated[idx],
          product_id: Number(value),
          product_name: prod?.name ?? '',
        };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  }

  const validLinesCount = lines.filter(
    (l) => l.product_id > 0 && parseFloat(l.quantity) > 0
  ).length;
  const transfers = safeArray(enrichedTransfers) as TransferEnriched[];

  function handleExportExcel() {
    void exportToExcel({
      filename: `transfers-history-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'سجل التحويلات',
      title: `سجل تحويلات المخزون — ${transfers.length} تحويل`,
      columns: [
        { header: 'رقم التحويل', key: 'id', width: 12 },
        {
          header: 'من مخزن',
          key: '_from',
          width: 20,
          format: (t: TransferEnriched) =>
            warehouses.find((w) => w.id === t.from_warehouse_id)?.name ?? `#${t.from_warehouse_id}`,
        },
        {
          header: 'إلى مخزن',
          key: '_to',
          width: 20,
          format: (t: TransferEnriched) =>
            warehouses.find((w) => w.id === t.to_warehouse_id)?.name ?? `#${t.to_warehouse_id}`,
        },
        { header: 'عدد الأصناف', key: 'items_count', width: 12 },
        {
          header: 'إجمالي الوحدات',
          key: 'total_qty',
          width: 14,
          format: (t: TransferEnriched) => t.total_qty.toFixed(2),
        },
        { header: 'الحالة', key: 'status', width: 12 },
        {
          header: 'التاريخ',
          key: '_date',
          width: 18,
          format: (t: TransferEnriched) => new Date(t.created_at).toLocaleString('ar-EG-u-nu-latn'),
        },
        { header: 'ملاحظات', key: 'notes', width: 30 },
      ],
      rows: transfers,
    });
  }

  function handleExportPDF() {
    exportToPDF({
      filename: 'transfers-history',
      title: `سجل تحويلات المخزون — ${transfers.length} تحويل`,
      columns: [
        { header: '#', key: 'id' },
        {
          header: 'من',
          key: '_from',
          format: (t: TransferEnriched) =>
            warehouses.find((w) => w.id === t.from_warehouse_id)?.name ?? `#${t.from_warehouse_id}`,
        },
        {
          header: 'إلى',
          key: '_to',
          format: (t: TransferEnriched) =>
            warehouses.find((w) => w.id === t.to_warehouse_id)?.name ?? `#${t.to_warehouse_id}`,
        },
        { header: 'أصناف', key: 'items_count' },
        {
          header: 'وحدات',
          key: 'total_qty',
          format: (t: TransferEnriched) => t.total_qty.toFixed(2),
        },
        {
          header: 'التاريخ',
          key: '_date',
          format: (t: TransferEnriched) =>
            new Date(t.created_at).toLocaleDateString('ar-EG-u-nu-latn'),
        },
        { header: 'ملاحظات', key: 'notes' },
      ],
      rows: transfers,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setView('new')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'new' ? 'bg-amber-500 text-black' : 'bg-surface text-ink/60 hover:text-ink'}`}
          >
            تحويل جديد
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${view === 'history' ? 'bg-amber-500 text-black' : 'bg-surface text-ink/60 hover:text-ink'}`}
          >
            سجل التحويلات ({transfers.length})
          </button>
        </div>
        {view === 'history' && transfers.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs rounded-xl border border-emerald-500/20 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs rounded-xl border border-rose-500/20 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        )}
      </div>

      {view === 'new' && (
        <div className="space-y-5">
          <div className="bg-canvas border border-line rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink/70 flex items-center gap-2">
              <Truck className="w-4 h-4 text-ink/50" /> بيانات التحويل
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div>
                <label className="block text-ink/50 text-xs mb-1.5">
                  من مخزن <span className="text-red-400">*</span>
                </label>
                <select
                  value={fromWH}
                  onChange={(e) => setFromWH(Number(e.target.value))}
                  className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:border-amber-500/40"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} className="bg-surface">
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-center pb-1">
                <div className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 text-ink/40" />
                </div>
              </div>
              <div>
                <label className="block text-ink/50 text-xs mb-1.5">
                  إلى مخزن <span className="text-red-400">*</span>
                </label>
                <select
                  value={toWH}
                  onChange={(e) => setToWH(Number(e.target.value))}
                  className={`w-full bg-surface border rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                    fromWH === toWH ? 'border-red-500/40' : 'border-line'
                  }`}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} className="bg-surface">
                      {w.name}
                    </option>
                  ))}
                </select>
                {fromWH === toWH && (
                  <p className="text-red-400 text-xs mt-1">يجب اختيار مخزن مختلف</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-ink/50 text-xs mb-1.5">ملاحظات (اختياري)</label>
              <input
                type="text"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="سبب التحويل..."
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              />
            </div>
          </div>

          <div className="bg-canvas border border-line rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink/70">المنتجات المحوَّلة</h3>
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const availableQty = getAvailableQty(line.product_id);
                const insufficient = lineHasInsufficientQty(line);
                const requestedQty = parseFloat(line.quantity) || 0;
                return (
                  <div
                    key={idx}
                    className={`border rounded-xl p-4 space-y-3 transition-colors ${insufficient ? 'border-red-500/30 bg-red-500/5' : 'border-line bg-surface'}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-start">
                      <div>
                        <label className="block text-ink/50 text-xs mb-1.5">المنتج</label>
                        <select
                          value={line.product_id}
                          onChange={(e) => updateLine(idx, 'product_id', e.target.value)}
                          className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                        >
                          <option value={0} className="bg-surface">
                            — اختر منتجاً —
                          </option>
                          {allProducts.map((p) => (
                            <option key={p.id} value={p.id} className="bg-surface">
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {line.product_id > 0 && (
                          <div
                            className={`mt-1 text-xs flex items-center gap-1 ${availableQty > 0 ? 'text-ink/40' : 'text-red-400/70'}`}
                          >
                            <span>
                              متاح في {warehouses.find((w) => w.id === fromWH)?.name ?? 'المصدر'}:
                            </span>
                            <span
                              className={`font-bold font-mono ${availableQty <= 0 ? 'text-red-400' : availableQty < 5 ? 'text-amber-400' : 'text-emerald-400'}`}
                            >
                              {loadingFromWh ? '...' : availableQty.toFixed(2)}
                            </span>
                            <span>وحدة</span>
                          </div>
                        )}
                      </div>
                      <div className="md:w-36">
                        <label className="block text-ink/50 text-xs mb-1.5">الكمية</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          placeholder="0"
                          className={`w-full bg-surface border rounded-xl px-3 py-2 text-ink text-sm placeholder:text-ink/30 focus:outline-none focus:ring-2 font-mono ${
                            insufficient
                              ? 'border-red-500/40 focus:ring-red-400/40'
                              : 'border-line focus:ring-violet-400/50'
                          }`}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={lines.length === 1}
                          className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {insufficient && (
                      <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        الكمية المطلوبة ({requestedQty.toFixed(2)}) تتجاوز المتاح (
                        {availableQty.toFixed(2)} وحدة)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() =>
                setLines((prev) => [...prev, { product_id: 0, product_name: '', quantity: '' }])
              }
              className="flex items-center gap-2 text-sm text-ink/50 hover:text-ink transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة منتج
            </button>
          </div>

          <button
            onClick={() => transferMutation.mutate()}
            disabled={
              transferMutation.isPending ||
              validLinesCount === 0 ||
              fromWH === toWH ||
              hasAnyInsufficientQty
            }
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> جاري التحويل...
              </>
            ) : (
              <>
                <Truck className="w-4 h-4" /> تنفيذ التحويل ({validLinesCount} منتج)
              </>
            )}
          </button>
          {hasAnyInsufficientQty && (
            <p className="text-red-400 text-xs text-center">
              بعض الكميات تتجاوز المتاح في مخزن المصدر
            </p>
          )}
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-3">
          {transfers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-surface border border-line rounded-2xl">
              <Truck className="w-10 h-10 text-ink/10 mb-3" />
              <p className="text-ink/40 font-bold mb-1">لا توجد تحويلات سابقة</p>
              <p className="text-ink/25 text-xs mb-4">قم بنقل المخزون بين المخازن لتظهر هنا</p>
              <button
                onClick={() => setView('new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition-all"
              >
                <ArrowRightLeft className="w-4 h-4" /> إنشاء تحويل جديد
              </button>
            </div>
          )}
          {transfers.map((t) => {
            const fromName =
              warehouses.find((w) => w.id === t.from_warehouse_id)?.name ??
              `#${t.from_warehouse_id}`;
            const toName =
              warehouses.find((w) => w.id === t.to_warehouse_id)?.name ?? `#${t.to_warehouse_id}`;
            const dateStr = new Date(t.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const timeStr = new Date(t.created_at).toLocaleTimeString('ar-EG-u-nu-latn', {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div key={t.id} className="bg-canvas border border-line rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-ink font-bold">تحويل #{t.id}</span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300">
                        {t.status === 'completed' ? '✓ مكتمل' : t.status}
                      </span>
                      {t.items_count > 0 && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-surface text-ink/50">
                          {t.items_count} صنف
                        </span>
                      )}
                      {t.total_qty > 0 && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-surface text-ink/50 border border-line">
                          {t.total_qty.toFixed(2)} وحدة إجمالاً
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-300 font-medium">{fromName}</span>
                      <ArrowLeft className="w-4 h-4 text-ink/30" />
                      <span className="text-emerald-300 font-medium">{toName}</span>
                    </div>
                    <div className="text-ink/30 text-xs">
                      {dateStr} · {timeStr}
                    </div>
                    {t.notes && <p className="text-ink/30 text-xs">{t.notes}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TransferTab;
