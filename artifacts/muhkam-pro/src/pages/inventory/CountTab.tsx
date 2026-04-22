import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { safeArray } from '@/lib/safe-data';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { TrendingUp, Search, X, ClipboardList, Plus, CheckCircle, Warehouse, Loader2, Filter, Camera, FileSpreadsheet, FileText } from 'lucide-react';
import { api, today, nowTime } from './_shared';
import type {
  AuditProduct,
  AuditSummary,
  CountSessionEnriched,
} from './_shared';

function CountTab({
  warehouses,
  currentWarehouseId,
  qc,
  toast,
}: {
  warehouses: { id: number; name: string }[];
  currentWarehouseId: number | null;
  qc: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const defaultWH =
    warehouses.length > 0
      ? (warehouses.find((w) => w.id === currentWarehouseId)?.id ?? warehouses[0].id)
      : 0;

  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(defaultWH);
  const [countDate, setCountDate] = useState(today());
  const [countTime, setCountTime] = useState(nowTime());
  const [sessionNotes, setSessionNotes] = useState('');
  const [countMode, setCountMode] = useState<'full' | 'partial' | 'positive'>('full');

  const [partialSearch, setPartialSearch] = useState('');
  const debouncedPartialSearch = useDebouncedValue(partialSearch, 200);
  const [partialCategory, setPartialCategory] = useState('all');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  const [physicalQtys, setPhysicalQtys] = useState<Record<number, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [sessionView, setSessionView] = useState<'new' | 'history'>('new');
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const SCAN_DEDUPE_MS = 1200;

  useEffect(() => {
    setPhysicalQtys({});
    setItemNotes({});
    setSelectedProductIds(new Set());
  }, [selectedWarehouse]);

  const warehouseParam = selectedWarehouse ? `?warehouse_id=${selectedWarehouse}` : '';

  const { data: auditData, isLoading: loadingProducts } = useQuery<{
    products: AuditProduct[];
    summary: AuditSummary;
  }>({
    queryKey: ['inventory-audit', selectedWarehouse],
    queryFn: () =>
      authFetch(api(`/api/inventory/audit${warehouseParam}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
    enabled: selectedWarehouse > 0,
  });

  const { data: enrichedSessions, refetch: refetchSessions } = useQuery<CountSessionEnriched[]>({
    queryKey: ['count-sessions-enriched'],
    queryFn: () => authFetch(api('/api/inventory/count-sessions-enriched')).then((r) => r.json()),
  });

  const allProducts = auditData?.products ?? [];

  const categories = Array.from(
    new Set(allProducts.map((p) => p.category).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  const ps = debouncedPartialSearch.toLowerCase();
  const filteredForSelector = allProducts.filter((p) => {
    const matchSearch =
      !ps ||
      p.name.toLowerCase().includes(ps) ||
      (p.sku ?? '').toLowerCase().includes(ps);
    const matchCat = partialCategory === 'all' || p.category === partialCategory;
    return matchSearch && matchCat;
  });

  const countTableProducts =
    countMode === 'full'
      ? allProducts
      : countMode === 'positive'
        ? allProducts.filter((p) => p.calculated_qty > 0)
        : allProducts.filter((p) => selectedProductIds.has(p.id));

  const enteredProducts = allProducts.filter(
    (p) => physicalQtys[p.id] !== undefined && physicalQtys[p.id] !== ''
  );
  const itemsWithPosDiff = enteredProducts.filter((p) => {
    const diff = parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty;
    return diff > 0.001;
  });
  const itemsWithNegDiff = enteredProducts.filter((p) => {
    const diff = parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty;
    return diff < -0.001;
  });
  const itemsWithDiff = enteredProducts.filter((p) => {
    const diff = parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty;
    return Math.abs(diff) > 0.001;
  });
  const totalPosDiff = itemsWithPosDiff.reduce(
    (acc, p) => acc + (parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty),
    0
  );
  const totalNegDiff = itemsWithNegDiff.reduce(
    (acc, p) => acc + (parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty),
    0
  );

  const missingNotes = itemsWithDiff.some((p) => !itemNotes[p.id]?.trim());
  const canApply =
    enteredProducts.length > 0 &&
    selectedWarehouse > 0 &&
    !!countDate &&
    !!countTime &&
    !missingNotes;

  const createAndApplyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWarehouse) throw new Error('اختر مخزناً أولاً');
      if (!countDate) throw new Error('التاريخ مطلوب');
      if (!countTime) throw new Error('الوقت مطلوب');

      const items = allProducts
        .filter((p) => physicalQtys[p.id] !== undefined && physicalQtys[p.id] !== '')
        .map((p) => ({
          product_id: p.id,
          physical_qty: parseFloat(physicalQtys[p.id] || '0'),
          notes: itemNotes[p.id] ?? undefined,
        }));

      if (items.length === 0) throw new Error('أدخل كمية فعلية لمنتج واحد على الأقل');

      const notesWithDateTime = `جرد ${countDate} الساعة ${countTime}${sessionNotes ? ` — ${sessionNotes}` : ''}`;

      const createRes = await authFetch(api('/api/inventory/count-sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: selectedWarehouse, notes: notesWithDateTime, items }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error((err as any).error ?? 'خطأ في إنشاء الجلسة');
      }
      const { session_id } = await createRes.json();

      const applyRes = await authFetch(api(`/api/inventory/count-sessions/${session_id}/apply`), {
        method: 'POST',
      });
      if (!applyRes.ok) {
        const err = await applyRes.json().catch(() => ({}));
        throw new Error((err as any).error ?? 'خطأ في تطبيق الجرد');
      }
      return applyRes.json();
    },
    onSuccess: (data) => {
      toast({ title: `✅ تم تطبيق الجرد — ${data.adjustments_applied} تسوية` });
      setPhysicalQtys({});
      setItemNotes({});
      setSessionNotes('');
      setCountDate(today());
      setCountTime(nowTime());
      setSelectedProductIds(new Set());
      qc.invalidateQueries({ queryKey: ['inventory-audit'] });
      qc.invalidateQueries({ queryKey: ['count-sessions-enriched'] });
      qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
      qc.invalidateQueries({ queryKey: ['inventory-low-stock'] });
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  const applyExistingMutation = useMutation({
    mutationFn: (sessionId: number) =>
      authFetch(api(`/api/inventory/count-sessions/${sessionId}/apply`), { method: 'POST' }).then(
        (r) => {
          if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
          return r.json();
        }
      ),
    onSuccess: () => {
      toast({ title: 'تم تطبيق جلسة الجرد بنجاح' });
      refetchSessions();
      qc.invalidateQueries({ queryKey: ['inventory-audit'] });
      qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
      qc.invalidateQueries({ queryKey: ['inventory-low-stock'] });
      setApplyingId(null);
    },
    onError: (e) => {
      toast({ title: String(e), variant: 'destructive' });
      setApplyingId(null);
    },
  });

  const sessions = safeArray(enrichedSessions) as CountSessionEnriched[];

  const ROWS_PER_CHUNK = 200;
  const [chunkLimit, setChunkLimit] = useState(ROWS_PER_CHUNK);
  useEffect(() => {
    setChunkLimit(ROWS_PER_CHUNK);
  }, [countMode, selectedWarehouse, selectedProductIds]);
  const visibleCountRows = countTableProducts.slice(0, chunkLimit);

  const handleBarcode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      // Dedupe rapid duplicate emissions from ZXing (same code in <1.2s window)
      const now = Date.now();
      if (
        lastScanRef.current.code === trimmed &&
        now - lastScanRef.current.at < SCAN_DEDUPE_MS
      ) {
        return;
      }
      lastScanRef.current = { code: trimmed, at: now };
      const found = allProducts.find(
        (p) => (p.sku ?? '').toLowerCase() === trimmed.toLowerCase()
      );
      if (!found) {
        setLastScanned(trimmed);
        toast({ title: `لم يُعثر على منتج بالباركود ${trimmed}`, variant: 'destructive' });
        return;
      }
      setLastScanned(trimmed);
      // optimistic increment
      setPhysicalQtys((prev) => {
        const cur = parseFloat(prev[found.id] ?? '0') || 0;
        return { ...prev, [found.id]: String(cur + 1) };
      });
      toast({ title: `${found.name} +1` });
      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>(
          `input[data-qty-input="${found.id}"]`
        );
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.focus();
          el.select();
        }
      }, 50);
    },
    [allProducts, toast]
  );

  function handleExportSession() {
    void exportToExcel({
      filename: `count-session-${selectedWarehouse}-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'جلسة جرد',
      title: `جلسة جرد — ${countDate} ${countTime} — ${enteredProducts.length} منتج`,
      columns: [
        { header: 'المنتج', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'النظام', key: 'calculated_qty', width: 12, format: (r) => r.calculated_qty.toFixed(2) },
        {
          header: 'الفعلي',
          key: 'physical',
          width: 12,
          format: (r) => parseFloat(physicalQtys[r.id] ?? '0'),
        },
        {
          header: 'الفرق',
          key: 'diff',
          width: 12,
          format: (r) => (parseFloat(physicalQtys[r.id] ?? '0') - r.calculated_qty).toFixed(2),
        },
        { header: 'سبب الفرق', key: 'note', width: 30, format: (r) => itemNotes[r.id] ?? '' },
      ],
      rows: enteredProducts,
    });
  }
  function handleExportSessionPDF() {
    exportToPDF({
      filename: 'count-session',
      title: `جلسة جرد ${countDate} ${countTime}`,
      columns: [
        { header: 'المنتج', key: 'name' },
        { header: 'SKU', key: 'sku' },
        { header: 'النظام', key: 'calculated_qty', format: (r) => r.calculated_qty.toFixed(2) },
        {
          header: 'الفعلي',
          key: 'physical',
          format: (r) => parseFloat(physicalQtys[r.id] ?? '0').toFixed(2),
        },
        {
          header: 'الفرق',
          key: 'diff',
          format: (r) => (parseFloat(physicalQtys[r.id] ?? '0') - r.calculated_qty).toFixed(2),
        },
      ],
      rows: enteredProducts,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setSessionView('new')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${sessionView === 'new' ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
        >
          جرد جديد
        </button>
        <button
          onClick={() => setSessionView('history')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${sessionView === 'history' ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}
        >
          سجل الجرد ({sessions.length})
        </button>
      </div>

      {sessionView === 'new' && (
        <div className="space-y-5">
          {/* إعدادات جلسة الجرد */}
          <div className="bg-[#111827] border border-white/8 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white/70 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-violet-400" /> إعدادات جلسة الجرد
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-white/50 text-xs mb-1.5">
                  المخزن <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                >
                  <option value={0} className="bg-[#1a1a2e]">
                    — اختر مخزناً —
                  </option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#1a1a2e]">
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1.5">
                  تاريخ الجرد <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={countDate}
                  onChange={(e) => setCountDate(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1.5">
                  وقت الجرد <span className="text-red-400">*</span>
                </label>
                <input
                  type="time"
                  value={countTime}
                  onChange={(e) => setCountTime(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />
              </div>
              <div>
                <label className="block text-white/50 text-xs mb-1.5">
                  ملاحظات الجلسة (اختياري)
                </label>
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="مثال: جرد نهاية الشهر"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <span className="text-white/50 text-xs">نوع الجرد:</span>
              <div className="flex gap-2">
                {[
                  { v: 'full' as const, label: 'شامل — كل المنتجات' },
                  { v: 'positive' as const, label: 'منتجات موجبة' },
                  { v: 'partial' as const, label: 'جزئي — منتجات محددة' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setCountMode(opt.v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      countMode === opt.v
                        ? opt.v === 'positive'
                          ? 'bg-green-600 text-white'
                          : 'bg-violet-500 text-white'
                        : 'bg-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    {opt.v === 'positive' && (
                      <TrendingUp className="w-3 h-3 inline me-1" />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* محدد المنتجات — للجرد الجزئي فقط */}
          {countMode === 'partial' && selectedWarehouse > 0 && (
            <div className="bg-[#111827] border border-violet-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> اختر المنتجات للجرد
                  {selectedProductIds.size > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-violet-500/30 text-violet-200 text-xs font-bold">
                      {selectedProductIds.size} محدد
                    </span>
                  )}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedProductIds(new Set(allProducts.map((p) => p.id)))}
                    className="text-xs text-violet-400 hover:text-violet-200 transition-colors"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={() => setSelectedProductIds(new Set())}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    مسح الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    value={partialSearch}
                    onChange={(e) => setPartialSearch(e.target.value)}
                    placeholder="ابحث عن منتج..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 pe-9 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                  />
                  {partialSearch && (
                    <button
                      onClick={() => setPartialSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {categories.length > 0 && (
                  <select
                    value={partialCategory}
                    onChange={(e) => setPartialCategory(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                  >
                    <option value="all" className="bg-[#1a1a2e]">
                      جميع الفئات
                    </option>
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-[#1a1a2e]">
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto rounded-xl border border-white/8 divide-y divide-white/5">
                {loadingProducts ? (
                  <div className="p-4 text-center text-white/40 text-sm">جاري التحميل...</div>
                ) : filteredForSelector.length === 0 ? (
                  <div className="p-4 text-center text-white/30 text-sm">لا توجد منتجات</div>
                ) : (
                  filteredForSelector.map((p) => {
                    const isChecked = selectedProductIds.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isChecked ? 'bg-violet-500/10' : 'hover:bg-white/5'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedProductIds);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            setSelectedProductIds(next);
                          }}
                          className="w-4 h-4 rounded border-white/20 accent-violet-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-sm font-medium ${isChecked ? 'text-white' : 'text-white/70'}`}
                          >
                            {p.name}
                          </span>
                          {p.sku && <span className="text-white/30 text-xs ms-2">{p.sku}</span>}
                          {p.category && (
                            <span className="text-white/20 text-xs ms-2">({p.category})</span>
                          )}
                        </div>
                        <span className="text-white/40 text-xs font-mono shrink-0">
                          {p.calculated_qty.toFixed(2)} في المخزن
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ملخص الفروق */}
          {enteredProducts.length > 0 && (
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
                        onClick={handleExportSession}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-colors"
                        title="تصدير Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                      </button>
                      <button
                        onClick={handleExportSessionPDF}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition-colors"
                        title="تصدير PDF"
                      >
                        <FileText className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`هل تريد مسح ${enteredProducts.length} كمية مدخلة؟`)) {
                            setPhysicalQtys({});
                            setItemNotes({});
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5" /> مسح الكميات
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => createAndApplyMutation.mutate()}
                    disabled={createAndApplyMutation.isPending || !canApply}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    {createAndApplyMutation.isPending ? (
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
          )}

          {/* شريط أدوات الجرد — باركود */}
          {selectedWarehouse > 0 && countMode !== 'partial' && (
            <div className="flex items-center justify-between gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Camera className="w-3.5 h-3.5 text-violet-400" />
                <span>استخدم الماسح الضوئي لإضافة الكميات بسرعة</span>
                {lastScanned && (
                  <span className="font-mono text-violet-300">آخر مسح: {lastScanned}</span>
                )}
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg text-xs font-bold transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> فتح ماسح الباركود
              </button>
            </div>
          )}

          {/* جدول الجرد */}
          {selectedWarehouse === 0 ? (
            <div className="text-center py-16 text-white/30">اختر مخزناً لعرض المنتجات</div>
          ) : countMode === 'partial' && selectedProductIds.size === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Filter className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p>حدد المنتجات من القائمة أعلاه</p>
            </div>
          ) : loadingProducts ? (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <tbody>
                  <TableSkeleton cols={5} rows={6} />
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="p-3 text-right text-white/60 font-medium">المنتج</th>
                    <th className="p-3 text-right text-white/60 font-medium">
                      <span title="الكمية في هذا المخزن من حركات المخزون">كمية المخزن (نظام)</span>
                    </th>
                    <th className="p-3 text-right text-white/60 font-medium">
                      الكمية الفعلية (يُدخلها المستخدم)
                    </th>
                    <th className="p-3 text-center text-white/60 font-medium w-28">الفرق</th>
                    <th className="p-3 text-right text-white/60 font-medium">سبب الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCountRows.map((p) => {
                    const rawPhys = physicalQtys[p.id];
                    const physQty =
                      rawPhys !== undefined && rawPhys !== '' ? parseFloat(rawPhys) : null;
                    const sysQty = p.calculated_qty;
                    const diff = physQty !== null ? physQty - sysQty : null;
                    const hasDiff = diff !== null && Math.abs(diff) > 0.001;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-white/5 erp-table-row ${hasDiff ? 'bg-amber-500/5' : ''}`}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
                      >
                        <td className="p-3">
                          <div className="text-white font-medium">{p.name}</div>
                          {p.sku && <div className="text-white/40 text-xs">{p.sku}</div>}
                          {p.category && <div className="text-white/30 text-xs">{p.category}</div>}
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-white/80 font-bold text-sm">
                            {sysQty.toFixed(2)}
                          </span>
                          <span className="text-white/30 text-xs ms-1">وحدة</span>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            data-qty-input={p.id}
                            value={physicalQtys[p.id] ?? ''}
                            onChange={(e) =>
                              setPhysicalQtys((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const idx = countTableProducts.findIndex((x) => x.id === p.id);
                                const next = countTableProducts[idx + 1];
                                if (next) {
                                  e.preventDefault();
                                  const nextEl = document.querySelector<HTMLInputElement>(
                                    `input[data-qty-input="${next.id}"]`
                                  );
                                  if (nextEl) {
                                    nextEl.scrollIntoView({ block: 'nearest' });
                                    nextEl.focus();
                                    nextEl.select();
                                  }
                                }
                              }
                            }}
                            placeholder="أدخل الكمية"
                            className="w-32 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-sm font-mono"
                          />
                        </td>
                        <td className="p-3 text-center font-mono w-28">
                          {diff === null ? (
                            <span className="text-white/20">—</span>
                          ) : diff === 0 ? (
                            <span className="text-emerald-400 font-bold text-sm">✓ صفر</span>
                          ) : diff > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-sm">
                              +{diff.toFixed(3)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-400 font-bold text-sm">
                              {diff.toFixed(3)}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {hasDiff &&
                            (() => {
                              const noteMissing = !itemNotes[p.id]?.trim();
                              return (
                                <input
                                  type="text"
                                  value={itemNotes[p.id] ?? ''}
                                  onChange={(e) =>
                                    setItemNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                                  }
                                  placeholder="سبب الفرق (مطلوب) *"
                                  className={`w-44 bg-white/10 rounded-lg px-2 py-1 text-white focus:outline-none text-xs border ${
                                    noteMissing
                                      ? 'border-red-500/50 placeholder:text-red-400/60 focus:ring-1 focus:ring-red-400/40'
                                      : 'border-emerald-500/30 placeholder:text-amber-500/50 focus:ring-1 focus:ring-amber-400/40'
                                  }`}
                                />
                              );
                            })()}
                        </td>
                      </tr>
                    );
                  })}
                  {countTableProducts.length > chunkLimit && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center bg-white/[0.03]">
                        <button
                          onClick={() => setChunkLimit((c) => c + ROWS_PER_CHUNK)}
                          className="px-4 py-1.5 text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg transition-colors"
                        >
                          عرض المزيد ({countTableProducts.length - chunkLimit} متبقي)
                        </button>
                      </td>
                    </tr>
                  )}
                  {countTableProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-white/40 py-12">
                        {countMode === 'partial'
                          ? 'لم تُحدَّد منتجات للجرد الجزئي'
                          : 'لا توجد منتجات في هذا المخزن'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* سجل الجلسات — مُثرى */}
      {sessionView === 'history' && (
        <div className="space-y-3">
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white/3 border border-white/5 rounded-2xl">
              <ClipboardList className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-white/40 font-bold mb-1">لا توجد جلسات جرد سابقة</p>
              <p className="text-white/25 text-xs mb-4">ابدأ جلسة جديدة لتسجيل الكميات الفعلية</p>
              <button
                onClick={() => setSessionView('new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
              >
                <Plus className="w-4 h-4" /> بدء جرد جديد
              </button>
            </div>
          )}
          {sessions.map((s) => {
            const whName =
              warehouses.find((w) => w.id === s.warehouse_id)?.name ?? `مخزن #${s.warehouse_id}`;
            const dateStr = new Date(s.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const timeStr = new Date(s.created_at).toLocaleTimeString('ar-EG-u-nu-latn', {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div key={s.id} className="bg-[#111827] border border-white/8 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold">جلسة #{s.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold ${s.status === 'applied' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}
                      >
                        {s.status === 'applied' ? '✓ مطبّق' : 'مسودة'}
                      </span>
                      {s.items_count > 0 && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-white/5 text-white/50">
                          {s.items_count} منتج
                        </span>
                      )}
                      {s.adjustments_count > 0 && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-amber-500/10 text-amber-400">
                          {s.adjustments_count} تسوية
                        </span>
                      )}
                      {s.items_count > 0 && s.adjustments_count === 0 && s.status === 'applied' && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400">
                          لا فروق
                        </span>
                      )}
                    </div>
                    <div className="text-white/50 text-xs flex items-center gap-2">
                      <Warehouse className="w-3 h-3 shrink-0" />
                      <span>{whName}</span>
                      <span className="text-white/20">·</span>
                      <span>
                        {dateStr} الساعة {timeStr}
                      </span>
                    </div>
                    {s.notes && (
                      <div className="text-white/30 text-xs truncate max-w-xs">{s.notes}</div>
                    )}
                    {s.applied_at && (
                      <div className="text-emerald-400/50 text-xs">
                        طُبِّق: {new Date(s.applied_at).toLocaleDateString('ar-EG-u-nu-latn')}
                      </div>
                    )}
                  </div>
                  {s.status === 'draft' && (
                    <button
                      onClick={() => {
                        setApplyingId(s.id);
                        applyExistingMutation.mutate(s.id);
                      }}
                      disabled={applyExistingMutation.isPending && applyingId === s.id}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {applyExistingMutation.isPending && applyingId === s.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      تطبيق
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcode}
      />
    </div>
  );
}

export default CountTab;
