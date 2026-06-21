import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  X,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Edit3,
  FileSpreadsheet,
  FileText,
  CalendarDays,
} from 'lucide-react';
import { api, movementTypeLabel } from './_shared';
import type { AuditProduct, AuditSummary, ProductDetail } from './_shared';

import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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

  const hasActiveFilter = showZeroOnly || showLowOnly || showPositiveOnly || !!search;

  return (
    <div className="space-y-4">
      {/* ── Legend + export + refresh ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { c: 'bg-blue-500/20 text-blue-300', t: '↑ افتتاحي' },
            { c: 'bg-emerald-500/20 text-emerald-300', t: '↑ مشتريات' },
            { c: 'bg-teal-500/20 text-teal-300', t: '↑ مرتجع مبيعات' },
            { c: 'bg-red-500/20 text-red-300', t: '↓ مبيعات' },
            { c: 'bg-orange-500/20 text-orange-300', t: '↓ مرتجع مشتريات' },
            { c: 'bg-surface text-ink/60', t: '± تسوية' },
            { c: 'bg-amber-500/20 text-amber-300', t: '↓ خروج' },
            { c: 'bg-cyan-500/20 text-cyan-300', t: '↑ دخول' },
          ].map((b) => (
            <span key={b.t} className={`px-2 py-1 rounded-lg ${b.c}`}>
              {b.t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
          >
            <FileSpreadsheet /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={filtered.length === 0}
          >
            <FileText /> PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw /> تحديث
          </Button>
        </div>
      </div>

      {/* ── Search + quick filters ───────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            placeholder="ابحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <Button
          variant={showZeroOnly ? 'outline' : 'ghost'}
          size="sm"
          className={showZeroOnly ? 'border-[var(--brand)] text-[var(--brand)]' : ''}
          onClick={() => {
            setShowZeroOnly((p) => !p);
            setShowLowOnly(false);
            setShowPositiveOnly(false);
          }}
        >
          <TrendingDown /> منتجات بدون مخزون
          <Badge variant="count">{zeroCount}</Badge>
        </Button>

        <Button
          variant={showPositiveOnly ? 'outline' : 'ghost'}
          size="sm"
          className={showPositiveOnly ? 'border-[var(--brand)] text-[var(--brand)]' : ''}
          onClick={() => {
            setShowPositiveOnly((p) => !p);
            setShowZeroOnly(false);
            setShowLowOnly(false);
          }}
        >
          <TrendingUp /> منتجات موجبة
          <Badge variant="count">{positiveCount}</Badge>
        </Button>

        <Button
          variant={showLowOnly ? 'outline' : 'ghost'}
          size="sm"
          className={showLowOnly ? 'border-[var(--brand)] text-[var(--brand)]' : ''}
          onClick={() => {
            setShowLowOnly((p) => !p);
            setShowZeroOnly(false);
            setShowPositiveOnly(false);
          }}
        >
          <AlertTriangle /> تحت حد الطلب فقط
          <Badge variant="count">{lowCount}</Badge>
        </Button>
      </div>

      {/* ── Table / states ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <SkeletonTable rows={7} cols={12} />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant={hasActiveFilter ? 'no-results' : 'no-data'}
          query={search || undefined}
          title={
            showZeroOnly
              ? 'لا توجد منتجات نافدة'
              : showPositiveOnly
                ? 'لا توجد منتجات بكميات موجبة'
                : showLowOnly
                  ? 'لا توجد منتجات تحت حد الطلب'
                  : 'لا توجد منتجات في هذا المخزن'
          }
          description={
            !showZeroOnly && !showLowOnly && !showPositiveOnly && !search
              ? 'أضف منتجات من قسم المنتجات لتظهر هنا'
              : undefined
          }
        />
      ) : (
        <Table className="min-w-[1100px]">
          <TableHead>
            <TableRow>
              {(
                [
                  { key: 'name' as const, label: 'المنتج' },
                  { key: 'opening_qty' as const, label: 'افتتاحي' },
                  { key: 'purchased_qty' as const, label: 'وارد' },
                  { key: 'sale_return_qty' as const, label: 'مرتجع مبيعات' },
                  { key: 'sold_qty' as const, label: 'صادر' },
                  { key: 'purchase_return_qty' as const, label: 'مرتجع مشتريات' },
                  { key: 'calculated_qty' as const, label: 'محسوب' },
                  { key: 'actual_qty' as const, label: 'فعلي (إجمالي)' },
                  { key: 'discrepancy' as const, label: 'فرق' },
                  { key: 'cost_price' as const, label: 'تكلفة' },
                  { key: 'total_value' as const, label: 'قيمة المخزون' },
                ] as { key: keyof AuditProduct; label: string }[]
              ).map((col) => (
                <TableHeader
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="cursor-pointer select-none hover:opacity-80"
                >
                  {col.label}
                  <SortIcon k={col.key} />
                </TableHeader>
              ))}
              <TableHeader>إجراء</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((p) => {
              const isLow =
                p.low_stock_threshold !== null && p.actual_qty <= p.low_stock_threshold;
              const isZero = p.actual_qty <= 0;
              const hasDisc = Math.abs(p.discrepancy) > 0.001;
              return (
                <TableRow key={p.id}>
                  {/* Product name + SKU + category */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isZero ? (
                        <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                      ) : isLow ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Package className="w-4 h-4 opacity-30 shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.sku && <div className="opacity-40 text-xs">{p.sku}</div>}
                        {p.category && (
                          <div className="mt-0.5">
                            <Badge variant="neutral">{p.category}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Opening qty — blue */}
                  <TableCell variant="number">
                    <span className="text-blue-300 font-mono">
                      {p.opening_qty > 0 ? `+${p.opening_qty}` : '—'}
                    </span>
                  </TableCell>

                  {/* Purchased qty — emerald */}
                  <TableCell variant="number">
                    <span className="text-emerald-400 font-mono">
                      {p.purchased_qty > 0 ? `+${p.purchased_qty}` : '—'}
                    </span>
                  </TableCell>

                  {/* Sale return qty — teal */}
                  <TableCell variant="number">
                    <span className="text-teal-300 font-mono">
                      {p.sale_return_qty > 0 ? `+${p.sale_return_qty}` : '—'}
                    </span>
                  </TableCell>

                  {/* Sold qty — red */}
                  <TableCell variant="number">
                    <span className="text-red-400 font-mono">
                      {p.sold_qty > 0 ? `-${p.sold_qty}` : '—'}
                    </span>
                  </TableCell>

                  {/* Purchase return qty — orange */}
                  <TableCell variant="number">
                    <span className="text-orange-300 font-mono">
                      {p.purchase_return_qty > 0 ? `-${p.purchase_return_qty}` : '—'}
                    </span>
                  </TableCell>

                  {/* Calculated qty */}
                  <TableCell variant="number">
                    <span className="font-bold font-mono">{p.calculated_qty.toFixed(2)}</span>
                  </TableCell>

                  {/* Actual qty — status-colored */}
                  <TableCell variant="number">
                    {isZero ? (
                      <StatusBadge variant="critical" label={p.actual_qty.toFixed(2)} />
                    ) : isLow ? (
                      <StatusBadge variant="neutral" label={p.actual_qty.toFixed(2)} />
                    ) : (
                      <span className="font-bold font-mono text-emerald-400">
                        {p.actual_qty.toFixed(2)}
                      </span>
                    )}
                  </TableCell>

                  {/* Discrepancy */}
                  <TableCell variant="number">
                    {hasDisc ? (
                      <span className="text-red-400 font-bold font-mono">
                        {p.discrepancy > 0
                          ? `+${p.discrepancy.toFixed(2)}`
                          : p.discrepancy.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-emerald-400">✓</span>
                    )}
                  </TableCell>

                  {/* Cost price */}
                  <TableCell variant="number">
                    <span className="opacity-70">{formatCurrency(p.cost_price)}</span>
                  </TableCell>

                  {/* Total value */}
                  <TableCell variant="number">
                    <span className="font-bold">{formatCurrency(p.total_value)}</span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell variant="action">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(p.id);
                          setModalDateFrom('');
                          setModalDateTo('');
                        }}
                      >
                        الحركات
                      </Button>
                      {canAdjustInventory && (
                        <IconButton
                          aria-label="تسوية يدوية"
                          title="تسوية يدوية"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAdjust(p.id);
                            setAdjustQty(String(p.actual_qty));
                            setAdjustNotes('');
                          }}
                        >
                          <Edit3 />
                        </IconButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Load more */}
            {filtered.length > chunkLimit && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChunkLimit((c) => c + ROWS_PER_CHUNK)}
                  >
                    عرض المزيد ({filtered.length - chunkLimit} متبقي)
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {/* Footer totals */}
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--line)] bg-[var(--surface)]">
                <td className="p-3 opacity-60 font-bold" colSpan={10}>
                  المجموع
                </td>
                <td className="p-3 font-bold text-end">
                  {formatCurrency(filtered.reduce((s, p) => s + p.total_value, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
      )}

      {/* ── Modal: product movement history ─────────────────────────────────── */}
      {selectedProduct &&
        productDetail &&
        (() => {
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
              <Card
                className="p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold">{productDetail.product.name}</h2>
                    <p className="text-xs opacity-40 mt-1 font-mono">{productDetail.formula}</p>
                  </div>
                  <IconButton
                    aria-label="إغلاق"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProduct(null)}
                  >
                    <X />
                  </IconButton>
                </div>

                {/* Mini stat grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    {
                      label: 'كمية محسوبة',
                      val: productDetail.calculated_qty.toFixed(2),
                      color: '',
                    },
                    {
                      label: 'كمية فعلية',
                      val: productDetail.actual_qty.toFixed(2),
                      color: productDetail.actual_qty <= 0 ? 'text-red-400' : 'text-emerald-400',
                    },
                    {
                      label: 'فرق',
                      val:
                        Math.abs(productDetail.discrepancy) > 0.001
                          ? productDetail.discrepancy.toFixed(2)
                          : '✓ صفر',
                      color:
                        Math.abs(productDetail.discrepancy) > 0.001
                          ? 'text-red-400'
                          : 'text-emerald-400',
                    },
                  ].map((c) => (
                    <div key={c.label} className="bg-[var(--surface)] rounded-xl p-3 text-center">
                      <div className="text-xs opacity-40">{c.label}</div>
                      <div className={`text-xl font-bold ${c.color}`}>{c.val}</div>
                    </div>
                  ))}
                </div>

                {/* Date filter */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <CalendarDays className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  <span className="opacity-40 text-xs">فلتر الفترة:</span>
                  <Input
                    type="date"
                    value={modalDateFrom}
                    onChange={(e) => setModalDateFrom(e.target.value)}
                    className="h-7 text-xs w-36"
                  />
                  <span className="opacity-30 text-xs">→</span>
                  <Input
                    type="date"
                    value={modalDateTo}
                    onChange={(e) => setModalDateTo(e.target.value)}
                    className="h-7 text-xs w-36"
                  />
                  {isDateFiltered && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setModalDateFrom('');
                        setModalDateTo('');
                      }}
                    >
                      <X /> مسح
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold opacity-60 mb-2 flex items-center gap-2">
                    سجل الحركات
                    <Badge variant="count">
                      {isDateFiltered
                        ? `${filteredMovements.length} / ${allMovements.length}`
                        : allMovements.length}
                    </Badge>
                    {isDateFiltered && (
                      <Badge variant="neutral">مفلترة</Badge>
                    )}
                  </h3>
                  {filteredMovements.length === 0 && (
                    <p className="opacity-30 text-sm text-center py-4">
                      {isDateFiltered ? 'لا توجد حركات في هذه الفترة' : 'لا توجد حركات مسجّلة'}
                    </p>
                  )}
                  <MovementsVirtualList movements={filteredMovements} />
                </div>
              </Card>
            </div>
          );
        })()}

      {/* ── Modal: manual adjustment ─────────────────────────────────────────── */}
      {showAdjust !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4"
          onClick={() => setShowAdjust(null)}
        >
          <Card
            className="p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">تسوية يدوية للمخزون</h2>
            {(() => {
              const p = products.find((x) => x.id === showAdjust);
              return p ? (
                <>
                  <p className="opacity-60 text-sm mb-4">
                    {p.name} — الكمية الحالية:{' '}
                    <span className="font-bold opacity-100">{p.actual_qty}</span>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs opacity-50 mb-1 block">الكمية الجديدة</label>
                      <Input
                        type="number"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(e.target.value)}
                        min="0"
                        step="0.001"
                      />
                    </div>
                    <div>
                      <label className="text-xs opacity-50 mb-1 block">سبب التسوية</label>
                      <Input
                        type="text"
                        value={adjustNotes}
                        onChange={(e) => setAdjustNotes(e.target.value)}
                        placeholder="مثال: كسر أثناء النقل"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1"
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
                        loading={adjustMutation.isPending}
                      >
                        {adjustMutation.isPending ? 'جاري الحفظ...' : 'تأكيد التسوية'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={() => setShowAdjust(null)}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                </>
              ) : null;
            })()}
          </Card>
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
    <div ref={parentRef} className="max-h-[420px] overflow-y-auto" style={{ contain: 'strict' }}>
      <div style={{ height: virt.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const m = movements[vi.index];
          const mt = movementTypeLabel[m.movement_type] ?? {
            label: m.movement_type,
            color: 'bg-surface text-ink/60',
          };
          const qtyNum = Number(m.quantity);
          const isIn = qtyNum > 0;
          return (
            <div
              key={m.id}
              ref={virt.measureElement}
              data-index={vi.index}
              style={{
                position: 'absolute',
                top: 0,
                insetInlineStart: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
              className="px-1 pb-2"
            >
              <div className="flex items-start gap-3 bg-[var(--surface)] rounded-xl p-3">
                <div className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium ${mt.color}`}>
                  {mt.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold font-mono text-sm ${isIn ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {isIn ? '+' : ''}
                      {qtyNum.toFixed(3)}
                    </span>
                    <span className="opacity-30 text-xs font-mono">
                      {m.quantity_before.toFixed(2)} → {m.quantity_after.toFixed(2)}
                    </span>
                  </div>
                  <div className="opacity-50 text-xs mt-0.5 flex gap-3">
                    {m.reference_no && <span className="font-mono">{m.reference_no}</span>}
                    {m.date && <span>{m.date}</span>}
                    {m.notes && <span className="truncate">{m.notes}</span>}
                  </div>
                </div>
                <div className="opacity-30 text-xs shrink-0">
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
