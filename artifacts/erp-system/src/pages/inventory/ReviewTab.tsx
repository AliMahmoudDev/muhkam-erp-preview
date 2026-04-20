import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { formatCurrency } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
import { Package, AlertTriangle, TrendingDown, TrendingUp, Search, X, RefreshCw, ChevronUp, ChevronDown, Edit3, FileSpreadsheet, FileText, CalendarDays, Settings2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, movementTypeLabel } from './_shared';
import type {
  AuditProduct,
  AuditSummary,
  ProductDetail,
} from './_shared';

function ReviewTab({
  currentWarehouseId,
  canAdjustInventory,
  qc,
  toast,
  quickFilter,
  onFilterApplied,
}: {
  currentWarehouseId: number | null;
  canAdjustInventory: boolean;
  qc: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>['toast'];
  quickFilter?: 'all' | 'zero' | 'low';
  onFilterApplied?: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<keyof AuditProduct>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showAdjust, setShowAdjust] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showPositiveOnly, setShowPositiveOnly] = useState(false);
  const [modalDateFrom, setModalDateFrom] = useState('');
  const [modalDateTo, setModalDateTo] = useState('');
  const [showColPicker, setShowColPicker] = useState(false);

  /* ── column visibility (localStorage) ── */
  const ALL_COLS = ['opening_qty','purchased_qty','sale_return_qty','sold_qty','purchase_return_qty','calculated_qty','discrepancy','cost_price'] as const;
  type OptCol = typeof ALL_COLS[number];
  const [visibleCols, setVisibleCols] = useState<Set<OptCol>>(() => {
    try {
      const stored = localStorage.getItem('inv_review_cols');
      if (stored) return new Set(JSON.parse(stored) as OptCol[]);
    } catch { /* ignore */ }
    return new Set(ALL_COLS);
  });
  function toggleCol(col: OptCol) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      try { localStorage.setItem('inv_review_cols', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  /* ── movements chart ── */
  const { data: chartData = [] } = useQuery<{ day: string; in_qty: number; out_qty: number; net: number }[]>({
    queryKey: ['inventory-movements-chart', currentWarehouseId],
    queryFn: () => {
      const param = currentWarehouseId ? `?warehouse_id=${currentWarehouseId}` : '';
      return authFetch(api(`/api/inventory/movements-chart${param}`)).then(r => r.json());
    },
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!quickFilter || quickFilter === 'all') return;
    setShowZeroOnly(quickFilter === 'zero');
    setShowLowOnly(quickFilter === 'low');
    onFilterApplied?.();
  }, [quickFilter]);

  const warehouseParam = currentWarehouseId ? `?warehouse_id=${currentWarehouseId}` : '';

  const {
    data: auditData,
    isLoading,
    refetch,
  } = useQuery<{ products: AuditProduct[]; summary: AuditSummary }>({
    queryKey: ['inventory-audit', currentWarehouseId],
    queryFn: () =>
      authFetch(api(`/api/inventory/audit${warehouseParam}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });

  const { data: productDetail } = useQuery<ProductDetail>({
    queryKey: ['inventory-product', selectedProduct],
    queryFn: () =>
      authFetch(api(`/api/inventory/product/${selectedProduct}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
    enabled: selectedProduct !== null,
  });

  const adjustMutation = useMutation({
    mutationFn: ({
      product_id,
      new_quantity,
      notes,
    }: {
      product_id: number;
      new_quantity: number;
      notes: string;
    }) =>
      authFetch(api('/api/inventory/adjustment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id, new_quantity, notes }),
      }).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-audit'] });
      qc.invalidateQueries({ queryKey: ['inventory-product'] });
      qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
      setShowAdjust(null);
      setAdjustQty('');
      setAdjustNotes('');
      toast({ title: 'تم تعديل المخزون بنجاح' });
    },
    onError: () => toast({ title: 'حدث خطأ أثناء تعديل المخزون', variant: 'destructive' }),
  });

  const products = auditData?.products ?? [];
  const _summary = auditData?.summary;

  const q = debouncedSearch.toLowerCase();
  const searched = products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
  );

  const zeroCount = searched.filter((p) => p.actual_qty <= 0).length;
  const positiveCount = searched.filter((p) => p.actual_qty > 0).length;
  const lowCount = searched.filter(
    (p) => p.low_stock_threshold !== null && p.actual_qty <= p.low_stock_threshold
  ).length;

  const filtered = searched
    .filter((p) => !showZeroOnly || p.actual_qty <= 0)
    .filter((p) => !showPositiveOnly || p.actual_qty > 0)
    .filter(
      (p) =>
        !showLowOnly || (p.low_stock_threshold !== null && p.actual_qty <= p.low_stock_threshold)
    )
    .sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string')
        return sortAsc ? va.localeCompare(vb, 'ar') : vb.localeCompare(va, 'ar');
      return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });

  function toggleSort(key: keyof AuditProduct) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const ROWS_PER_CHUNK = 200;
  const [chunkLimit, setChunkLimit] = useState(ROWS_PER_CHUNK);
  useEffect(() => {
    setChunkLimit(ROWS_PER_CHUNK);
  }, [debouncedSearch, showZeroOnly, showLowOnly, showPositiveOnly]);
  const visibleRows = filtered.slice(0, chunkLimit);

  function handleExportExcel() {
    void exportToExcel({
      filename: `inventory-review-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'مراجعة المخزون',
      title: `تقرير مراجعة المخزون — ${filtered.length} صنف`,
      columns: [
        { header: 'المنتج', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'التصنيف', key: 'category', width: 16 },
        { header: 'افتتاحي', key: 'opening_qty', width: 10 },
        { header: 'وارد', key: 'purchased_qty', width: 10 },
        { header: 'مرتجع مبيعات', key: 'sale_return_qty', width: 13 },
        { header: 'صادر', key: 'sold_qty', width: 10 },
        { header: 'مرتجع مشتريات', key: 'purchase_return_qty', width: 14 },
        { header: 'محسوب', key: 'calculated_qty', width: 11 },
        { header: 'فعلي', key: 'actual_qty', width: 11 },
        { header: 'فرق', key: 'discrepancy', width: 11 },
        { header: 'تكلفة', key: 'cost_price', width: 12 },
        { header: 'قيمة المخزون', key: 'total_value', width: 14 },
      ],
      rows: filtered,
    });
  }
  function handleExportPDF() {
    exportToPDF({
      filename: 'inventory-review',
      title: `تقرير مراجعة المخزون — ${filtered.length} صنف`,
      columns: [
        { header: 'المنتج', key: 'name' },
        { header: 'SKU', key: 'sku' },
        { header: 'محسوب', key: 'calculated_qty', format: (r) => r.calculated_qty.toFixed(2) },
        { header: 'فعلي', key: 'actual_qty', format: (r) => r.actual_qty.toFixed(2) },
        { header: 'فرق', key: 'discrepancy', format: (r) => r.discrepancy.toFixed(2) },
        { header: 'القيمة', key: 'total_value', format: (r) => formatCurrency(r.total_value) },
      ],
      rows: filtered,
    });
  }

  const SortIcon = ({ k }: { k: keyof AuditProduct }) =>
    sortKey === k ? (
      sortAsc ? (
        <ChevronUp className="w-3 h-3 inline ms-1" />
      ) : (
        <ChevronDown className="w-3 h-3 inline ms-1" />
      )
    ) : null;

  return (
    <div className="space-y-4">
      {/* أسطورة الألوان + أزرار تصفية + زر تحديث */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { c: 'bg-blue-500/20 text-blue-300', t: '↑ افتتاحي' },
            { c: 'bg-emerald-500/20 text-emerald-300', t: '↑ مشتريات' },
            { c: 'bg-teal-500/20 text-teal-300', t: '↑ مرتجع مبيعات' },
            { c: 'bg-red-500/20 text-red-300', t: '↓ مبيعات' },
            { c: 'bg-orange-500/20 text-orange-300', t: '↓ مرتجع مشتريات' },
            { c: 'bg-violet-500/20 text-violet-300', t: '± تسوية' },
            { c: 'bg-amber-500/20 text-amber-300', t: '↓ خروج' },
            { c: 'bg-cyan-500/20 text-cyan-300', t: '↑ دخول' },
          ].map((b) => (
            <span key={b.t} className={`px-2 py-1 rounded-lg ${b.c}`}>
              {b.t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Column Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColPicker(p => !p)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition-colors border ${showColPicker ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'}`}
              title="تخصيص الأعمدة"
            >
              <Settings2 className="w-3.5 h-3.5" /> الأعمدة
            </button>
            {showColPicker && (
              <div className="absolute left-0 top-full mt-1 z-50 glass-card border border-white/10 rounded-2xl p-3 shadow-2xl min-w-[180px]">
                <p className="text-white/50 text-xs mb-2 font-medium">اختر الأعمدة</p>
                {([
                  { id: 'opening_qty', label: 'افتتاحي' },
                  { id: 'purchased_qty', label: 'وارد (مشتريات)' },
                  { id: 'sale_return_qty', label: 'مرتجع مبيعات' },
                  { id: 'sold_qty', label: 'صادر (مبيعات)' },
                  { id: 'purchase_return_qty', label: 'مرتجع مشتريات' },
                  { id: 'calculated_qty', label: 'محسوب' },
                  { id: 'discrepancy', label: 'فرق' },
                  { id: 'cost_price', label: 'تكلفة الوحدة' },
                ] as { id: OptCol; label: string }[]).map(col => (
                  <label key={col.id} className="flex items-center gap-2 py-1 cursor-pointer group text-sm text-white/70 hover:text-white">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.id)}
                      onChange={() => toggleCol(col.id)}
                      className="accent-violet-500 w-3.5 h-3.5"
                    />
                    {col.label}
                  </label>
                ))}
                <div className="mt-2 pt-2 border-t border-white/10 flex gap-1">
                  <button onClick={() => { const all = new Set(ALL_COLS); setVisibleCols(all); localStorage.setItem('inv_review_cols', JSON.stringify([...all])); }} className="text-[10px] text-violet-300 hover:text-violet-200">الكل</button>
                  <span className="text-white/20 text-[10px]">|</span>
                  <button onClick={() => { const none = new Set<OptCol>([]); setVisibleCols(none); localStorage.setItem('inv_review_cols', JSON.stringify([])); }} className="text-[10px] text-white/40 hover:text-white/70">الأقل</button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-300 text-sm rounded-xl transition-colors"
            title="تصدير Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 text-sm rounded-xl transition-colors"
            title="تصدير PDF"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> تحديث
          </button>
        </div>
      </div>

      {/* مخطط الحركات (30 يوم) */}
      {chartData.length > 0 && (
        <div className="glass-card p-4 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/70 text-sm font-medium">حركات المخزون — آخر 30 يوم</p>
            <div className="flex gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> وارد</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> صادر</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={8} barGap={2}>
              <XAxis
                dataKey="day"
                tick={{ fill: '#ffffff50', fontSize: 10 }}
                tickFormatter={d => d.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#fff' }}
                labelStyle={{ color: '#ffffff90' }}
                formatter={(v: number, name: string) => [v.toFixed(2), name === 'in_qty' ? 'وارد' : 'صادر']}
                labelFormatter={(l: string) => l}
              />
              <Bar dataKey="in_qty" fill="#10b981" radius={[3,3,0,0]} name="وارد" />
              <Bar dataKey="out_qty" fill="#f87171" radius={[3,3,0,0]} name="صادر" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* بحث + فلاتر سريعة */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pe-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setShowZeroOnly((p) => !p);
            setShowLowOnly(false);
            setShowPositiveOnly(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${
            showZeroOnly
              ? 'bg-red-500/20 border-red-500/30 text-red-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" /> منتجات بدون مخزون
          <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono">{zeroCount}</span>
        </button>
        <button
          onClick={() => {
            setShowPositiveOnly((p) => !p);
            setShowZeroOnly(false);
            setShowLowOnly(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${
            showPositiveOnly
              ? 'bg-green-500/20 border-green-500/30 text-green-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> منتجات موجبة
          <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono">{positiveCount}</span>
        </button>
        <button
          onClick={() => {
            setShowLowOnly((p) => !p);
            setShowZeroOnly(false);
            setShowPositiveOnly(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${
            showLowOnly
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> تحت حد الطلب فقط
          <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono">{lowCount}</span>
        </button>
      </div>

      {/* الجدول */}
      {isLoading ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm min-w-[1100px]">
            <tbody>
              <TableSkeleton cols={12} rows={7} />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {(
                  [
                    { key: 'name' as const, label: 'المنتج', always: true },
                    { key: 'opening_qty' as const, label: 'افتتاحي', always: false },
                    { key: 'purchased_qty' as const, label: 'وارد', always: false },
                    { key: 'sale_return_qty' as const, label: 'مرتجع مبيعات', always: false },
                    { key: 'sold_qty' as const, label: 'صادر', always: false },
                    { key: 'purchase_return_qty' as const, label: 'مرتجع مشتريات', always: false },
                    { key: 'calculated_qty' as const, label: 'محسوب', always: false },
                    { key: 'actual_qty' as const, label: 'فعلي (إجمالي)', always: true },
                    { key: 'discrepancy' as const, label: 'فرق', always: false },
                    { key: 'cost_price' as const, label: 'تكلفة', always: false },
                    { key: 'total_value' as const, label: 'قيمة المخزون', always: true },
                  ] as { key: keyof AuditProduct; label: string; always: boolean }[]
                ).filter(col => col.always || visibleCols.has(col.key as OptCol)).map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="p-3 text-right text-white/60 font-medium cursor-pointer hover:text-white/90 select-none whitespace-nowrap"
                  >
                    {col.label}
                    <SortIcon k={col.key} />
                  </th>
                ))}
                <th className="p-3 text-right text-white/60 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((p) => {
                const isLow =
                  p.low_stock_threshold !== null && p.actual_qty <= p.low_stock_threshold;
                const isZero = p.actual_qty <= 0;
                const hasDisc = Math.abs(p.discrepancy) > 0.001;
                return (
                  <tr key={p.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isZero ? (
                          <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                        ) : isLow ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Package className="w-4 h-4 text-white/30 shrink-0" />
                        )}
                        <div>
                          <div className="text-white font-medium">{p.name}</div>
                          {p.sku && <div className="text-white/40 text-xs">{p.sku}</div>}
                          {p.category && <div className="text-white/30 text-xs">{p.category}</div>}
                        </div>
                      </div>
                    </td>
                    {visibleCols.has('opening_qty') && <td className="p-3 text-blue-300 font-mono">{p.opening_qty > 0 ? `+${p.opening_qty}` : '—'}</td>}
                    {visibleCols.has('purchased_qty') && <td className="p-3 text-emerald-400 font-mono">{p.purchased_qty > 0 ? `+${p.purchased_qty}` : '—'}</td>}
                    {visibleCols.has('sale_return_qty') && <td className="p-3 text-teal-300 font-mono">{p.sale_return_qty > 0 ? `+${p.sale_return_qty}` : '—'}</td>}
                    {visibleCols.has('sold_qty') && <td className="p-3 text-red-400 font-mono">{p.sold_qty > 0 ? `-${p.sold_qty}` : '—'}</td>}
                    {visibleCols.has('purchase_return_qty') && <td className="p-3 text-orange-300 font-mono">{p.purchase_return_qty > 0 ? `-${p.purchase_return_qty}` : '—'}</td>}
                    {visibleCols.has('calculated_qty') && <td className="p-3 font-bold text-white font-mono">{p.calculated_qty.toFixed(2)}</td>}
                    <td className="p-3 font-bold font-mono">
                      <span className={isZero ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}>{p.actual_qty.toFixed(2)}</span>
                    </td>
                    {visibleCols.has('discrepancy') && <td className="p-3 font-mono">{hasDisc ? (<span className="text-red-400 font-bold">{p.discrepancy > 0 ? `+${p.discrepancy.toFixed(2)}` : p.discrepancy.toFixed(2)}</span>) : (<span className="text-emerald-400">✓</span>)}</td>}
                    {visibleCols.has('cost_price') && <td className="p-3 text-white/70">{formatCurrency(p.cost_price)}</td>}
                    <td className="p-3 text-white font-bold">{formatCurrency(p.total_value)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedProduct(p.id);
                            setModalDateFrom('');
                            setModalDateTo('');
                          }}
                          className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors whitespace-nowrap"
                        >
                          الحركات
                        </button>
                        {canAdjustInventory && (
                          <button
                            onClick={() => {
                              setShowAdjust(p.id);
                              setAdjustQty(String(p.actual_qty));
                              setAdjustNotes('');
                            }}
                            className="px-2 py-1 text-xs bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length > chunkLimit && (
                <tr>
                  <td colSpan={4 + visibleCols.size} className="py-3 text-center bg-white/[0.03]">
                    <button
                      onClick={() => setChunkLimit((c) => c + ROWS_PER_CHUNK)}
                      className="px-4 py-1.5 text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg transition-colors"
                    >
                      عرض المزيد ({filtered.length - chunkLimit} متبقي)
                    </button>
                  </td>
                </tr>
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4 + visibleCols.size} className="py-16 text-center">
                    <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <p className="text-white/40 font-bold mb-1">
                      {showZeroOnly
                        ? 'لا توجد منتجات نافدة'
                        : showPositiveOnly
                          ? 'لا توجد منتجات بكميات موجبة'
                          : showLowOnly
                            ? 'لا توجد منتجات تحت حد الطلب'
                            : 'لا توجد منتجات في هذا المخزن'}
                    </p>
                    {!showZeroOnly && !showLowOnly && !showPositiveOnly && (
                      <p className="text-white/25 text-xs">
                        أضف منتجات من قسم <span className="text-violet-300">المنتجات</span> لتظهر
                        هنا
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/20 bg-white/5">
                  <td className="p-3 text-white/60 font-bold" colSpan={3 + visibleCols.size}>
                    المجموع
                  </td>
                  <td className="p-3 text-white font-bold">
                    {formatCurrency(filtered.reduce((s, p) => s + p.total_value, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Modal: تفاصيل حركات منتج */}
      {selectedProduct && productDetail && (() => {
        const allMovements = productDetail.movements;
        const filteredMovements = allMovements.filter((m) => {
          const movDate = m.date ?? m.created_at.slice(0, 10);
          if (modalDateFrom && movDate < modalDateFrom) return false;
          if (modalDateTo && movDate > modalDateTo) return false;
          return true;
        });
        const isDateFiltered = modalDateFrom || modalDateTo;
        return (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-8 px-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{productDetail.product.name}</h2>
                <p className="text-xs text-white/40 mt-1 font-mono">{productDetail.formula}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                {
                  label: 'كمية محسوبة',
                  val: productDetail.calculated_qty.toFixed(2),
                  cls: 'text-white',
                },
                {
                  label: 'كمية فعلية',
                  val: productDetail.actual_qty.toFixed(2),
                  cls: productDetail.actual_qty <= 0 ? 'text-red-400' : 'text-emerald-400',
                },
                {
                  label: 'فرق',
                  val:
                    Math.abs(productDetail.discrepancy) > 0.001
                      ? productDetail.discrepancy.toFixed(2)
                      : '✓ صفر',
                  cls:
                    Math.abs(productDetail.discrepancy) > 0.001
                      ? 'text-red-400'
                      : 'text-emerald-400',
                },
              ].map((c) => (
                <div key={c.label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-xs text-white/40">{c.label}</div>
                  <div className={`text-xl font-bold ${c.cls}`}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* فلتر التاريخ */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <CalendarDays className="w-3.5 h-3.5 text-white/40 shrink-0" />
              <span className="text-white/40 text-xs">فلتر الفترة:</span>
              <input
                type="date"
                value={modalDateFrom}
                onChange={(e) => setModalDateFrom(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50"
              />
              <span className="text-white/30 text-xs">→</span>
              <input
                type="date"
                value={modalDateTo}
                onChange={(e) => setModalDateTo(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50"
              />
              {isDateFiltered && (
                <button
                  onClick={() => { setModalDateFrom(''); setModalDateTo(''); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white/50 hover:text-white bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> مسح
                </button>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/60 mb-2 flex items-center gap-2">
                سجل الحركات
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-mono text-white/50">
                  {isDateFiltered
                    ? `${filteredMovements.length} / ${allMovements.length}`
                    : allMovements.length}
                </span>
                {isDateFiltered && (
                  <span className="text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-md">مفلترة</span>
                )}
              </h3>
              {filteredMovements.length === 0 && (
                <p className="text-white/30 text-sm text-center py-4">
                  {isDateFiltered ? 'لا توجد حركات في هذه الفترة' : 'لا توجد حركات مسجّلة'}
                </p>
              )}
              <MovementsVirtualList movements={filteredMovements} />
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal: التسوية اليدوية */}
      {showAdjust !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          onClick={() => setShowAdjust(null)}
        >
          <div
            className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white mb-4">تسوية يدوية للمخزون</h2>
            {(() => {
              const p = products.find((x) => x.id === showAdjust);
              return p ? (
                <>
                  <p className="text-white/60 text-sm mb-4">
                    {p.name} — الكمية الحالية:{' '}
                    <span className="text-white font-bold">{p.actual_qty}</span>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">الكمية الجديدة</label>
                      <input
                        type="number"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(e.target.value)}
                        min="0"
                        step="0.001"
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">سبب التسوية</label>
                      <input
                        type="text"
                        value={adjustNotes}
                        onChange={(e) => setAdjustNotes(e.target.value)}
                        placeholder="مثال: كسر أثناء النقل"
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          const qty = parseFloat(adjustQty);
                          if (isNaN(qty) || qty < 0) {
                            toast({ title: 'الكمية غير صالحة', variant: 'destructive' });
                            return;
                          }
                          adjustMutation.mutate({
                            product_id: showAdjust!,
                            new_quantity: qty,
                            notes: adjustNotes,
                          });
                        }}
                        disabled={adjustMutation.isPending}
                        className="flex-1 py-2 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
                      >
                        {adjustMutation.isPending ? 'جاري الحفظ...' : 'تأكيد التسوية'}
                      </button>
                      <button
                        onClick={() => setShowAdjust(null)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function MovementsVirtualList({ movements }: { movements: import('./_shared').StockMovement[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virt = useVirtualizer({
    count: movements.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });
  const items = virt.getVirtualItems();
  return (
    <div
      ref={parentRef}
      className="max-h-[420px] overflow-y-auto"
      style={{ contain: 'strict' }}
    >
      <div style={{ height: virt.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const m = movements[vi.index];
          const mt = movementTypeLabel[m.movement_type] ?? {
            label: m.movement_type,
            color: 'bg-white/10 text-white/60',
          };
          const qtyNum = Number(m.quantity);
          const isIn = qtyNum > 0;
          return (
            <div
              key={m.id}
              ref={virt.measureElement}
              data-index={vi.index}
              style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
              className="px-1 pb-2"
            >
              <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                <div className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium ${mt.color}`}>
                  {mt.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono text-sm ${isIn ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isIn ? '+' : ''}
                      {qtyNum.toFixed(3)}
                    </span>
                    <span className="text-white/30 text-xs font-mono">
                      {m.quantity_before.toFixed(2)} → {m.quantity_after.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-white/50 text-xs mt-0.5 flex gap-3">
                    {m.reference_no && <span className="font-mono">{m.reference_no}</span>}
                    {m.date && <span>{m.date}</span>}
                    {m.notes && <span className="truncate">{m.notes}</span>}
                  </div>
                </div>
                <div className="text-white/30 text-xs shrink-0">
                  {formatCurrency(Number(m.unit_cost))}/وحدة
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReviewTab;
