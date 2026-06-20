import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner'));
import { Camera } from 'lucide-react';
import { api, today, nowTime } from '../_shared';
import type { AuditProduct, AuditSummary, CountSessionEnriched } from '../_shared';

import type { CountTabProps, CountMode } from './types';
import { computeVariance } from './helpers';
import { CountSessionForm } from './CountSessionForm';
import { PartialProductSelector } from './PartialProductSelector';
import { CountVarianceSummary } from './CountVarianceSummary';
import { CountItemsTable } from './CountItemsTable';
import { CountHistory } from './CountHistory';

const ROWS_PER_CHUNK = 200;
const SCAN_DEDUPE_MS = 1200;

function CountTab({ warehouses, currentWarehouseId, qc, toast }: CountTabProps) {
  const defaultWH =
    warehouses.length > 0
      ? (warehouses.find((w) => w.id === currentWarehouseId)?.id ?? warehouses[0].id)
      : 0;

  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(defaultWH);
  const [countDate, setCountDate] = useState(today());
  const [countTime, setCountTime] = useState(nowTime());
  const [sessionNotes, setSessionNotes] = useState('');
  const [countMode, setCountMode] = useState<CountMode>('full');

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
      !ps || p.name.toLowerCase().includes(ps) || (p.sku ?? '').toLowerCase().includes(ps);
    const matchCat = partialCategory === 'all' || p.category === partialCategory;
    return matchSearch && matchCat;
  });

  const countTableProducts =
    countMode === 'full'
      ? allProducts
      : countMode === 'positive'
        ? allProducts.filter((p) => p.calculated_qty > 0)
        : allProducts.filter((p) => selectedProductIds.has(p.id));

  const variance = computeVariance(
    allProducts,
    physicalQtys,
    itemNotes,
    selectedWarehouse,
    countDate,
    countTime
  );

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
        const err = await createRes.json().catch(() => ({}) as { error?: string });
        throw new Error((err as { error?: string }).error ?? 'خطأ في إنشاء الجلسة');
      }
      const { session_id } = await createRes.json();

      const applyRes = await authFetch(api(`/api/inventory/count-sessions/${session_id}/apply`), {
        method: 'POST',
      });
      if (!applyRes.ok) {
        const err = await applyRes.json().catch(() => ({}) as { error?: string });
        throw new Error((err as { error?: string }).error ?? 'خطأ في تطبيق الجرد');
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

  const [chunkLimit, setChunkLimit] = useState(ROWS_PER_CHUNK);
  useEffect(() => {
    setChunkLimit(ROWS_PER_CHUNK);
  }, [countMode, selectedWarehouse, selectedProductIds]);
  const visibleCountRows = countTableProducts.slice(0, chunkLimit);

  const handleBarcode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      const now = Date.now();
      if (lastScanRef.current.code === trimmed && now - lastScanRef.current.at < SCAN_DEDUPE_MS) {
        return;
      }
      lastScanRef.current = { code: trimmed, at: now };
      const found = allProducts.find((p) => (p.sku ?? '').toLowerCase() === trimmed.toLowerCase());
      if (!found) {
        setLastScanned(trimmed);
        toast({ title: `لم يُعثر على منتج بالباركود ${trimmed}`, variant: 'destructive' });
        return;
      }
      setLastScanned(trimmed);
      setPhysicalQtys((prev) => {
        const cur = parseFloat(prev[found.id] ?? '0') || 0;
        return { ...prev, [found.id]: String(cur + 1) };
      });
      toast({ title: `${found.name} +1` });
      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>(`input[data-qty-input="${found.id}"]`);
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
      title: `جلسة جرد — ${countDate} ${countTime} — ${variance.enteredProducts.length} منتج`,
      columns: [
        { header: 'المنتج', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        {
          header: 'النظام',
          key: 'calculated_qty',
          width: 12,
          format: (r) => r.calculated_qty.toFixed(2),
        },
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
      rows: variance.enteredProducts,
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
      rows: variance.enteredProducts,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setSessionView('new')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${sessionView === 'new' ? 'bg-amber-500 text-black' : 'bg-surface text-ink/60 hover:text-ink'}`}
        >
          جرد جديد
        </button>
        <button
          onClick={() => setSessionView('history')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${sessionView === 'history' ? 'bg-amber-500 text-black' : 'bg-surface text-ink/60 hover:text-ink'}`}
        >
          سجل الجرد ({sessions.length})
        </button>
      </div>

      {sessionView === 'new' && (
        <div className="space-y-5">
          <CountSessionForm
            warehouses={warehouses}
            selectedWarehouse={selectedWarehouse}
            setSelectedWarehouse={setSelectedWarehouse}
            countDate={countDate}
            setCountDate={setCountDate}
            countTime={countTime}
            setCountTime={setCountTime}
            sessionNotes={sessionNotes}
            setSessionNotes={setSessionNotes}
            countMode={countMode}
            setCountMode={setCountMode}
          />

          {countMode === 'partial' && selectedWarehouse > 0 && (
            <PartialProductSelector
              allProducts={allProducts}
              filteredForSelector={filteredForSelector}
              selectedProductIds={selectedProductIds}
              setSelectedProductIds={setSelectedProductIds}
              partialSearch={partialSearch}
              setPartialSearch={setPartialSearch}
              partialCategory={partialCategory}
              setPartialCategory={setPartialCategory}
              categories={categories}
              loadingProducts={loadingProducts}
            />
          )}

          {variance.enteredProducts.length > 0 && (
            <CountVarianceSummary
              variance={variance}
              selectedWarehouse={selectedWarehouse}
              countDate={countDate}
              countTime={countTime}
              isPending={createAndApplyMutation.isPending}
              onApply={() => createAndApplyMutation.mutate()}
              onClear={() => {
                if (confirm(`هل تريد مسح ${variance.enteredProducts.length} كمية مدخلة؟`)) {
                  setPhysicalQtys({});
                  setItemNotes({});
                }
              }}
              onExportExcel={handleExportSession}
              onExportPDF={handleExportSessionPDF}
            />
          )}

          {/* شريط أدوات الجرد — باركود */}
          {selectedWarehouse > 0 && countMode !== 'partial' && (
            <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-ink/50">
                <Camera className="w-3.5 h-3.5 text-ink/40" />
                <span>استخدم الماسح الضوئي لإضافة الكميات بسرعة</span>
                {lastScanned && (
                  <span className="font-mono text-amber-300">آخر مسح: {lastScanned}</span>
                )}
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs font-bold transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> فتح ماسح الباركود
              </button>
            </div>
          )}

          <CountItemsTable
            selectedWarehouse={selectedWarehouse}
            countMode={countMode}
            selectedProductIds={selectedProductIds}
            loadingProducts={loadingProducts}
            countTableProducts={countTableProducts}
            visibleCountRows={visibleCountRows}
            chunkLimit={chunkLimit}
            setChunkLimit={setChunkLimit}
            physicalQtys={physicalQtys}
            setPhysicalQtys={setPhysicalQtys}
            itemNotes={itemNotes}
            setItemNotes={setItemNotes}
          />
        </div>
      )}

      {sessionView === 'history' && (
        <CountHistory
          sessions={sessions}
          warehouses={warehouses}
          applyingId={applyingId}
          isPending={applyExistingMutation.isPending}
          onApply={(id) => {
            setApplyingId(id);
            applyExistingMutation.mutate(id);
          }}
          onSwitchToNew={() => setSessionView('new')}
        />
      )}

      <Suspense fallback={null}>
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={handleBarcode}
        />
      </Suspense>
    </div>
  );
}

export default CountTab;
