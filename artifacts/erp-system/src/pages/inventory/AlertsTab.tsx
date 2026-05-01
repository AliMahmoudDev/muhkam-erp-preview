import { useState } from 'react';
import { openPrintWindow } from '@/lib/print-utils';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { AlertSettingBanner } from '@/components/AlertSettingBanner';
import { AlertTriangle, TrendingDown, RefreshCw, CheckCircle, Filter, Bell, ArrowRightLeft, FileSpreadsheet, FileText, ShoppingCart, TrendingUp, ClipboardList, X, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
import { api } from './_shared';
import type {
  LowStockItem,
  TransferPrefill,
} from './_shared';

interface ReorderSuggestion {
  product_id: number;
  product_name: string;
  sku: string | null;
  category: string | null;
  cost_price: number;
  min_stock: number | null;
  current_qty: number;
  sold_qty_30d: number;
  daily_velocity: number;
  coverage_days: number | null;
  suggested_qty: number;
  suggested_cost: number;
  reason: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface Supplier {
  id:          number;
  name:        string;
  phone:       string | null;
  is_supplier?: boolean;
}

function POModal({
  selected,
  suggestions,
  onClose,
}: {
  selected: Set<number>;
  suggestions: ReorderSuggestion[];
  onClose: () => void;
}) {
  const { data: suppliersRaw = [] } = useQuery<Supplier[]>({
    queryKey: ['customers-suppliers'],
    queryFn: () =>
      authFetch(api('/api/customers')).then((r) => r.json()).then((d) => {
        const arr: Supplier[] = Array.isArray(d) ? d : (d.customers ?? []);
        return arr.filter((c) => c.is_supplier);
      }),
    staleTime: 60_000,
  });

  const items = suggestions.filter((s) => selected.has(s.product_id));
  const totalCost = items.reduce((a, s) => a + s.suggested_cost, 0);

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [poDate] = useState(() => new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }));
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  const selectedSupplier = suppliersRaw.find((s) => String(s.id) === supplierId);

  function printPO() {
    const rows = items
      .map(
        (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:right">${s.product_name}${s.sku ? `<br><small style="color:#6b7280">${s.sku}</small>` : ''}</td>
          <td>${s.current_qty.toFixed(2)}</td>
          <td style="font-weight:bold;color:#6d28d9">${s.suggested_qty}</td>
          <td>${s.cost_price.toLocaleString('ar-EG')}</td>
          <td style="font-weight:bold;color:#059669">${s.suggested_cost.toLocaleString('ar-EG')}</td>
          <td style="color:#6b7280;font-size:11px">${s.reason ?? ''}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html><html dir="rtl" lang="ar">
<head><meta charset="utf-8"><title>أمر شراء ${poNumber}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo','Segoe UI',Arial,sans-serif; direction: rtl; color: #111827; margin: 0; }
  .header { background: linear-gradient(135deg,#4c1d95,#6d28d9); color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 900; }
  .header .meta { font-size: 12px; opacity: 0.8; margin-top: 6px; }
  .header .po-no { font-size: 14px; font-weight: 700; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .info-box label { color: #6b7280; font-size: 11px; display: block; margin-bottom: 4px; }
  .info-box .val { font-weight: 700; font-size: 14px; color: #111827; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th { background: #4c1d95; color: white; padding: 8px 6px; text-align: center; font-weight: 700; }
  td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; text-align: center; }
  tr:nth-child(even) td { background: #f9f7ff; }
  .total-row td { background: #ede9fe; font-weight: 900; font-size: 13px; border-top: 2px solid #6d28d9; }
  .footer { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
  .sign-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 16px; min-width: 160px; text-align: center; }
  .sign-box label { display: block; color: #6b7280; margin-bottom: 24px; }
  .notes-box { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #92400e; }
</style></head>
<body>
<div class="header">
  <div>
    <h1>🛒 أمر شراء</h1>
    <div class="meta">MUHKAM ERP · ${poDate}</div>
  </div>
  <div class="po-no">${poNumber}</div>
</div>

<div class="info-grid">
  <div class="info-box">
    <label>المورد</label>
    <div class="val">${selectedSupplier?.name ?? 'غير محدد'}</div>
    ${selectedSupplier?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${selectedSupplier.phone}</div>` : ''}
  </div>
  <div class="info-box">
    <label>تاريخ الأمر</label>
    <div class="val">${poDate}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">رقم: ${poNumber}</div>
  </div>
</div>

${notes ? `<div class="notes-box">📝 ${notes}</div>` : ''}

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>الصنف</th>
      <th>الكمية الحالية</th>
      <th>الكمية المطلوبة</th>
      <th>سعر الوحدة (ج.م)</th>
      <th>الإجمالي (ج.م)</th>
      <th>السبب</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="3">الإجمالي الكلي المقدّر</td>
      <td>${items.reduce((a, s) => a + s.suggested_qty, 0)}</td>
      <td>—</td>
      <td>${totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <div class="sign-box"><label>توقيع المعتمد</label></div>
  <div class="sign-box"><label>توقيع المستلم</label></div>
  <div style="align-self:flex-end;font-size:10px">طُبع بواسطة MUHKAM ERP · ${new Date().toLocaleString('ar-EG-u-nu-latn')}</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;

    openPrintWindow(html, { width: 1024, height: 768 });
  }

  function exportPOExcel() {
    void exportToExcel({
      filename: `purchase-order-${poNumber}`,
      sheetName: 'أمر شراء',
      title: `أمر شراء ${poNumber} — ${selectedSupplier?.name ?? ''} — ${poDate}`,
      columns: [
        { header: '#', key: '_idx', width: 6, format: (_r: ReorderSuggestion, i?: number) => (i ?? 0) + 1 },
        { header: 'الصنف', key: 'product_name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'الكمية الحالية', key: 'current_qty', width: 14, format: (r) => r.current_qty.toFixed(2) },
        { header: 'الكمية المطلوبة', key: 'suggested_qty', width: 14 },
        { header: 'سعر الوحدة', key: 'cost_price', width: 14 },
        { header: 'الإجمالي', key: 'suggested_cost', width: 14, format: (r) => r.suggested_cost.toFixed(2) },
        { header: 'السبب', key: 'reason', width: 30 },
      ],
      rows: items,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] border border-violet-500/30 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">إنشاء أمر شراء</h2>
              <p className="text-white/40 text-xs">{items.length} صنف · إجمالي مقدّر: {formatCurrency(totalCost)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white/50 text-xs mb-1.5">المورد</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            >
              <option value="" className="bg-[#1a1a2e]">— اختر المورد (اختياري) —</option>
              {suppliersRaw.map((s) => (
                <option key={s.id} value={String(s.id)} className="bg-[#1a1a2e]">{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1.5">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: توريد عاجل / مواصفات خاصة..."
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            />
          </div>

          <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-2.5 text-right text-white/60 font-medium text-xs">الصنف</th>
                  <th className="p-2.5 text-center text-white/60 font-medium text-xs">الكمية المطلوبة</th>
                  <th className="p-2.5 text-center text-white/60 font-medium text-xs">التكلفة المقدّرة</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.product_id} className="border-b border-white/5">
                    <td className="p-2.5">
                      <div className="text-white text-sm font-medium">{s.product_name}</div>
                      {s.sku && <div className="text-white/40 text-xs font-mono">{s.sku}</div>}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-1 rounded-lg bg-violet-500/10 text-violet-300 font-bold font-mono text-sm">
                        {s.suggested_qty}
                      </span>
                    </td>
                    <td className="p-2.5 text-center text-emerald-300 font-mono text-sm">
                      {formatCurrency(s.suggested_cost)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-violet-500/30 bg-violet-500/5">
                  <td className="p-2.5 text-white/60 text-xs font-bold" colSpan={1}>الإجمالي</td>
                  <td className="p-2.5 text-center font-bold text-white font-mono">
                    {items.reduce((a, s) => a + s.suggested_qty, 0)} وحدة
                  </td>
                  <td className="p-2.5 text-center font-bold text-emerald-300 font-mono">
                    {formatCurrency(totalCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={printPO}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-500 hover:bg-violet-400 text-white rounded-xl font-bold text-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> طباعة / PDF
            </button>
            <button
              onClick={exportPOExcel}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl font-bold text-sm border border-emerald-500/30 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsTab({
  warehouses: _warehouses,
  currentWarehouseId: _currentWarehouseId,
  onTransferPrefill,
}: {
  warehouses: { id: number; name: string }[];
  currentWarehouseId: number | null;
  onTransferPrefill: (prefill: TransferPrefill) => void;
}) {
  const [filterWH, setFilterWH] = useState<number | 'all'>('all');
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [selectedForPO, setSelectedForPO] = useState<Set<number>>(new Set());
  const [showPOModal, setShowPOModal] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    items: LowStockItem[];
    zero_count: number;
    low_count: number;
  }>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => authFetch(api('/api/inventory/low-stock')).then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: reorderData, isLoading: loadingReorder, refetch: refetchReorder } = useQuery<{
    suggestions: ReorderSuggestion[];
    total_cost: number;
    days_analyzed: number;
    cover_days: number;
  }>({
    queryKey: ['inventory-reorder-suggestions'],
    queryFn: () =>
      authFetch(api('/api/inventory/reorder-suggestions')).then((r) => r.json()),
    enabled: showReorder,
    staleTime: 60_000,
  });

  function handleExportExcel() {
    void exportToExcel({
      filename: `inventory-alerts-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'تنبيهات المخزون',
      title: `تنبيهات المخزون — ${filtered.length} صنف`,
      columns: [
        { header: 'المنتج', key: 'product_name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'المخزن', key: 'warehouse_name', width: 18 },
        { header: 'الكمية الحالية', key: 'current_qty', width: 14 },
        { header: 'الحد الأدنى', key: 'min_stock', width: 12 },
        { header: 'العجز', key: 'shortage', width: 12 },
        { header: 'مقترح الطلب', key: 'suggested_qty', width: 14 },
      ],
      rows: filtered,
    });
  }
  function handleExportPDF() {
    exportToPDF({
      filename: 'inventory-alerts',
      title: `تنبيهات المخزون — ${filtered.length} صنف`,
      columns: [
        { header: 'المنتج', key: 'product_name' },
        { header: 'المخزن', key: 'warehouse_name' },
        { header: 'الحالي', key: 'current_qty', format: (r) => r.current_qty.toFixed(2) },
        { header: 'الحد', key: 'min_stock' },
        { header: 'مقترح', key: 'suggested_qty' },
      ],
      rows: filtered,
    });
  }
  function handleExportReorderExcel() {
    if (!reorderData) return;
    void exportToExcel({
      filename: `reorder-suggestions-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'مقترحات التوريد',
      title: `مقترحات إعادة الطلب — ${reorderData.suggestions.length} صنف — ${formatCurrency(reorderData.total_cost)}`,
      columns: [
        { header: 'المنتج', key: 'product_name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'الكمية الحالية', key: 'current_qty', width: 12, format: (r) => r.current_qty.toFixed(2) },
        { header: 'مبيعات 30 يوم', key: 'sold_qty_30d', width: 14, format: (r) => r.sold_qty_30d.toFixed(2) },
        { header: 'تغطية (يوم)', key: 'coverage_days', width: 12, format: (r) => r.coverage_days?.toFixed(1) ?? '∞' },
        { header: 'مقترح الكمية', key: 'suggested_qty', width: 14 },
        { header: 'تكلفة مقدّرة', key: 'suggested_cost', width: 14, format: (r) => r.suggested_cost.toFixed(2) },
        { header: 'الأولوية', key: 'priority', width: 10 },
        { header: 'السبب', key: 'reason', width: 30 },
      ],
      rows: reorderData.suggestions,
    });
  }

  function toggleSelectPO(productId: number) {
    setSelectedForPO((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }
  function selectAllPO() {
    const allIds = new Set((reorderData?.suggestions ?? []).map((s) => s.product_id));
    setSelectedForPO(allIds);
  }
  function clearSelectPO() {
    setSelectedForPO(new Set());
  }

  const allItems = data?.items ?? [];
  const zeroCount = data?.zero_count ?? 0;
  const lowCount = data?.low_count ?? 0;

  const uniqueWarehouses = Array.from(
    new Map(allItems.map((i) => [i.warehouse_id, i.warehouse_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filtered = allItems
    .filter((i) => filterWH === 'all' || i.warehouse_id === filterWH)
    .filter((i) => !showZeroOnly || i.is_zero);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const reorderSuggestions = reorderData?.suggestions ?? [];
  const poSelectedCount = selectedForPO.size;

  return (
    <div className="space-y-5">
      <AlertSettingBanner
        enabledKey="alert_low_stock_enabled"
        thresholdKey="alert_low_stock_qty"
        title="تنبيه انخفاض المخزون"
        thresholdLabel="حد الكمية"
        thresholdUnit="قطعة"
        icon="📦"
        color="orange"
        defaultThreshold="5"
      />

      {/* إحصائيات سريعة — قابلة للضغط للتصفية */}
      <div className="grid grid-cols-3 gap-4">
        <div
          role="button"
          tabIndex={0}
          title="اضغط لعرض المنتجات النافدة فقط"
          onClick={() => { setShowZeroOnly(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowZeroOnly(true); }}
          className={`rounded-2xl p-4 border flex items-center gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] ${
            showZeroOnly
              ? 'bg-red-500/20 border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.15)]'
              : zeroCount > 0
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-white/5 border-white/5'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <TrendingDown className={`w-5 h-5 ${zeroCount > 0 ? 'text-red-400' : 'text-white/20'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs">نفد المخزون</p>
            <p className={`text-2xl font-bold ${zeroCount > 0 ? 'text-red-400' : 'text-white/30'}`}>{zeroCount}</p>
            <p className="text-white/20 text-[10px] mt-0.5">انقر للتصفية</p>
          </div>
          {showZeroOnly && (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div
          role="button"
          tabIndex={0}
          title="اضغط لعرض المنتجات تحت حد الطلب"
          onClick={() => { setShowZeroOnly(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowZeroOnly(false); }}
          className={`rounded-2xl p-4 border flex items-center gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] ${
            !showZeroOnly
              ? 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
              : lowCount > 0
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-white/5 border-white/5'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <AlertTriangle className={`w-5 h-5 ${lowCount > 0 ? 'text-amber-400' : 'text-white/20'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs">تحت حد الطلب</p>
            <p className={`text-2xl font-bold ${lowCount > 0 ? 'text-amber-400' : 'text-white/30'}`}>{lowCount}</p>
            <p className="text-white/20 text-[10px] mt-0.5">انقر للتصفية</p>
          </div>
          {!showZeroOnly && (
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div
          role="button"
          tabIndex={0}
          title="عرض جميع التنبيهات"
          onClick={() => { setShowZeroOnly(false); setFilterWH('all'); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowZeroOnly(false); setFilterWH('all'); } }}
          className="rounded-2xl p-4 border bg-white/5 border-white/5 flex items-center gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 hover:brightness-110 hover:bg-white/8 hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)]"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Bell className={`w-5 h-5 ${zeroCount + lowCount > 0 ? 'text-white/40' : 'text-white/20'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-xs">إجمالي التنبيهات</p>
            <p className={`text-2xl font-bold ${zeroCount + lowCount > 0 ? 'text-white' : 'text-white/30'}`}>
              {zeroCount + lowCount}
            </p>
            <p className="text-white/20 text-[10px] mt-0.5">إعادة تعيين الفلاتر</p>
          </div>
        </div>
      </div>

      {allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
          <CheckCircle className="w-14 h-14 text-emerald-500/30 mb-4" />
          <h3 className="text-white font-bold text-lg mb-1">المخزون في حالة ممتازة</h3>
          <p className="text-white/40 text-sm">لا توجد منتجات تحت حد الطلب الدنى في أي مخزن</p>
          <button
            onClick={() => refetch()}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> تحديث
          </button>
        </div>
      )}

      {allItems.length > 0 && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1 text-white/50 text-xs">
              <Filter className="w-3.5 h-3.5" /> تصفية:
            </div>
            <select
              value={filterWH}
              onChange={(e) => setFilterWH(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/40"
            >
              <option value="all" className="bg-[#1a1a2e]">جميع المخازن</option>
              {uniqueWarehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#1a1a2e]">{w.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowZeroOnly((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                showZeroOnly
                  ? 'bg-red-500/20 border-red-500/30 text-red-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3 h-3" /> نافد فقط
            </button>
            <div className="flex-1" />
            <button
              onClick={() => { setShowReorder((p) => !p); if (showReorder) { setSelectedForPO(new Set()); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                showReorder
                  ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3 h-3" /> مقترحات التوريد
            </button>
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-300 text-xs rounded-xl transition-colors border border-emerald-500/20"
            >
              <FileSpreadsheet className="w-3 h-3" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 text-rose-300 text-xs rounded-xl transition-colors border border-rose-500/20"
            >
              <FileText className="w-3 h-3" /> PDF
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-xl transition-colors border border-white/10"
            >
              <RefreshCw className="w-3 h-3" /> تحديث
            </button>
          </div>

          {/* لوحة مقترحات إعادة الطلب */}
          {showReorder && (
            <div className="bg-[#111827] border border-violet-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-violet-300" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">مقترحات إعادة الطلب</h3>
                    <p className="text-white/40 text-xs">
                      حسب سرعة المبيعات في آخر {reorderData?.days_analyzed ?? 30} يوم — تغطية {reorderData?.cover_days ?? 30} يوم
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {reorderSuggestions.length > 0 && (
                    <>
                      <span className="px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold">
                        إجمالي مقدّر: {formatCurrency(reorderData?.total_cost ?? 0)}
                      </span>
                      {/* Create PO button */}
                      {poSelectedCount > 0 ? (
                        <button
                          onClick={() => setShowPOModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-400 text-white text-xs rounded-xl font-bold border border-violet-400 transition-colors"
                        >
                          <ClipboardList className="w-3 h-3" /> إنشاء أمر شراء ({poSelectedCount})
                        </button>
                      ) : (
                        <button
                          onClick={selectAllPO}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 text-xs rounded-xl border border-violet-500/20 transition-colors"
                        >
                          <ClipboardList className="w-3 h-3" /> تحديد الكل لأمر الشراء
                        </button>
                      )}
                      {poSelectedCount > 0 && (
                        <button
                          onClick={clearSelectPO}
                          className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 text-xs rounded-xl border border-white/10 transition-colors"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-xl border border-white/10"
                  >
                    <RefreshCw className="w-3 h-3" /> تحديث
                  </button>
                </div>
              </div>

              {loadingReorder ? (
                <div className="text-center py-8 text-white/40 text-sm">جاري التحليل...</div>
              ) : reorderSuggestions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 text-emerald-500/30 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">لا توجد مقترحات توريد حالياً</p>
                </div>
              ) : (
                <>
                  {poSelectedCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-violet-300">
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>تم تحديد {poSelectedCount} صنف · إجمالي مقدّر: {formatCurrency(reorderSuggestions.filter(s => selectedForPO.has(s.product_id)).reduce((a, s) => a + s.suggested_cost, 0))}</span>
                      <button onClick={() => setShowPOModal(true)} className="ms-auto underline font-bold hover:text-violet-200">إنشاء أمر الشراء الآن</button>
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-xl border border-white/8">
                    <table className="w-full text-sm min-w-[850px]">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          <th className="p-2.5 text-center text-white/60 font-medium text-xs w-8">
                            <input
                              type="checkbox"
                              checked={poSelectedCount === reorderSuggestions.length && reorderSuggestions.length > 0}
                              onChange={(e) => e.target.checked ? selectAllPO() : clearSelectPO()}
                              className="w-3.5 h-3.5 accent-violet-500"
                            />
                          </th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">الأولوية</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">المنتج</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">الحالي</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">سرعة (يوم)</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">التغطية</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">مقترح</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">تكلفة مقدّرة</th>
                          <th className="p-2.5 text-right text-white/60 font-medium text-xs">السبب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reorderSuggestions.slice(0, 50).map((s) => {
                          const colors: Record<string, string> = {
                            critical: 'bg-red-500/20 text-red-300',
                            high: 'bg-amber-500/20 text-amber-300',
                            medium: 'bg-violet-500/20 text-violet-300',
                            low: 'bg-white/10 text-white/60',
                          };
                          const labels: Record<string, string> = {
                            critical: 'حرج',
                            high: 'عالٍ',
                            medium: 'متوسط',
                            low: 'منخفض',
                          };
                          const isChecked = selectedForPO.has(s.product_id);
                          return (
                            <tr
                              key={s.product_id}
                              className={`border-b border-white/5 erp-table-row cursor-pointer ${isChecked ? 'bg-violet-500/5' : ''}`}
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
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${colors[s.priority]}`}>
                                  {labels[s.priority]}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <div className="text-white text-sm font-medium">{s.product_name}</div>
                                {s.sku && <div className="text-white/40 text-xs font-mono">{s.sku}</div>}
                              </td>
                              <td className="p-2.5 font-mono text-white/70 text-sm">{s.current_qty.toFixed(2)}</td>
                              <td className="p-2.5 font-mono text-white/70 text-xs">
                                <TrendingUp className="w-3 h-3 inline me-1 text-emerald-400" />
                                {s.daily_velocity.toFixed(2)}
                              </td>
                              <td className="p-2.5 font-mono text-xs">
                                <span className={s.coverage_days !== null && s.coverage_days <= 7 ? 'text-red-400 font-bold' : 'text-white/60'}>
                                  {s.coverage_days !== null ? `${s.coverage_days.toFixed(1)} يوم` : '∞'}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <span className="px-2 py-1 rounded-lg bg-violet-500/10 text-violet-300 font-bold font-mono text-sm">
                                  {s.suggested_qty}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-emerald-300 text-xs">
                                {formatCurrency(s.suggested_cost)}
                              </td>
                              <td className="p-2.5 text-white/50 text-xs">{s.reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reorderSuggestions.length > 50 && (
                      <div className="p-2 text-center text-white/30 text-xs bg-white/[0.02]">
                        عُرضت أعلى 50 من {reorderSuggestions.length} — حمّل Excel لرؤية الكل
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* جدول التنبيهات */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-3 text-right text-white/60 font-medium">المنتج</th>
                  <th className="p-3 text-right text-white/60 font-medium">المخزن</th>
                  <th className="p-3 text-right text-white/60 font-medium">الكمية الحالية</th>
                  <th className="p-3 text-right text-white/60 font-medium">الحد الدنى</th>
                  <th className="p-3 text-right text-white/60 font-medium">العجز</th>
                  <th className="p-3 text-right text-white/60 font-medium">مقترح الطلب</th>
                  <th className="p-3 text-right text-white/60 font-medium">متاح في مخازن أخرى</th>
                  <th className="p-3 text-right text-white/60 font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-white/30 py-10">
                      {showZeroOnly ? 'لا توجد منتجات نافدة في هذا المخزن' : 'لا توجد تنبيهات بهذه الفلاتر'}
                    </td>
                  </tr>
                )}
                {filtered.map((item, idx) => (
                  <tr
                    key={`${item.product_id}-${item.warehouse_id}-${idx}`}
                    className={`border-b border-white/5 erp-table-row ${item.is_zero ? 'bg-red-500/5' : 'bg-amber-500/5'}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {item.is_zero ? (
                          <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-white font-medium">{item.product_name}</div>
                          {item.sku && <div className="text-white/40 text-xs">{item.sku}</div>}
                          {item.category && <div className="text-white/30 text-xs">{item.category}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/60 font-medium">
                        {item.warehouse_name}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`font-bold font-mono text-sm ${item.is_zero ? 'text-red-400' : 'text-amber-400'}`}>
                        {item.current_qty.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-white/60 font-mono text-sm">{item.min_stock}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-red-400 text-sm font-bold">
                        {item.shortage > 0 ? `-${item.shortage.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-300 font-bold font-mono">
                        {item.suggested_qty} وحدة
                      </span>
                    </td>
                    <td className="p-3">
                      {item.available_elsewhere.length > 0 ? (
                        <div className="space-y-1">
                          {item.available_elsewhere.slice(0, 2).map((aw) => (
                            <div key={aw.warehouse_id} className="flex items-center gap-2">
                              <span className="text-xs text-emerald-300 font-medium">{aw.warehouse_name}</span>
                              <span className="text-emerald-400 font-mono text-xs font-bold">{aw.qty.toFixed(2)}</span>
                            </div>
                          ))}
                          {item.available_elsewhere.length > 2 && (
                            <div className="text-white/30 text-xs">+{item.available_elsewhere.length - 2} أخرى</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/25 text-xs">غير متاح</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5">
                        {item.available_elsewhere.length > 0 && (
                          <button
                            onClick={() =>
                              onTransferPrefill({
                                fromWH: item.available_elsewhere[0].warehouse_id,
                                toWH: item.warehouse_id,
                                productId: item.product_id,
                                productName: item.product_name,
                                qty: Math.min(item.suggested_qty, item.available_elsewhere[0].qty),
                              })
                            }
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 transition-all"
                          >
                            <ArrowRightLeft className="w-3 h-3" /> تحويل داخلي
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showPOModal && reorderSuggestions.length > 0 && (
        <POModal
          selected={selectedForPO}
          suggestions={reorderSuggestions}
          onClose={() => setShowPOModal(false)}
        />
      )}
    </div>
  );
}

export default AlertsTab;
