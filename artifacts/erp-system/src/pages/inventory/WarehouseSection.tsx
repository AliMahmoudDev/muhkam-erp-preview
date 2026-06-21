import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { Package, X, Plus, Trash2, Warehouse, Loader2, FileSpreadsheet, Eye } from 'lucide-react';
import { api } from './_shared';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface WarehouseItem {
  id: number;
  name: string;
  address: string | null;
  branch_id: number | null;
  created_at: string;
}

interface Branch {
  id: number;
  name: string;
}

interface WarehouseSummaryItem {
  warehouse_id: number;
  warehouse_name: string;
  item_count: number;
  total_value: number;
  pct_of_total: number;
}

interface AuditProductLite {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  actual_qty: number;
  total_value: number;
  low_stock_threshold: number | null;
  cost_price: number;
  sale_price: number;
}

interface WarehouseSectionProps {
  warehouses: WarehouseItem[];
  branches: Branch[];
  whSummaryMap: Map<number, WarehouseSummaryItem>;
  grandTotal: number;
  currentWarehouseIdNum: number | null;
  isAdmin: boolean;
  canAdjustInventory: boolean;
  loadingWH: boolean;
  allProducts: AuditProductLite[];
  whDetailProducts: AuditProductLite[];
  whDetailLoading: boolean;
  setWarehouseId: (id: string) => void;
  createWH: { isPending: boolean };
  deleteWH: {
    mutate: (id: number, opts: { onSuccess: () => void; onError: (e: unknown) => void }) => void;
    isPending: boolean;
  };
  invalidateWH: () => void;
  qc: ReturnType<typeof useQueryClient>;
  toast: (opts: {
    title: string;
    variant?: 'default' | 'destructive' | 'warning' | 'info' | null;
  }) => void;
  handleOverviewExport: () => void;
  showAddWH: boolean;
  setShowAddWH: (v: boolean) => void;
  deleteWHTarget: { id: number; name: string } | null;
  setDeleteWHTarget: (v: { id: number; name: string } | null) => void;
  warehouseDetailId: number | null;
  setWarehouseDetailId: (v: number | null) => void;
  whForm: { name: string; address: string; branch_id: string };
  setWhForm: (
    fn: (f: { name: string; address: string; branch_id: string }) => {
      name: string;
      address: string;
      branch_id: string;
    }
  ) => void;
}

export default function WarehouseSection({
  warehouses,
  branches,
  whSummaryMap,
  grandTotal,
  currentWarehouseIdNum,
  isAdmin,
  loadingWH,
  allProducts,
  whDetailProducts,
  whDetailLoading,
  setWarehouseId,
  createWH,
  deleteWH,
  invalidateWH,
  qc,
  toast,
  handleOverviewExport,
  showAddWH,
  setShowAddWH,
  deleteWHTarget,
  setDeleteWHTarget,
  warehouseDetailId,
  setWarehouseDetailId,
  whForm,
  setWhForm,
}: WarehouseSectionProps) {
  return (
    <>
      {/* ══ Warehouse management section ══════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">المخازن</h2>
            <p className="opacity-40 text-sm mt-0.5">إدارة مواقع التخزين ومتابعة قيمة كل مخزن</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleOverviewExport()}
              disabled={allProducts.length === 0}
              title="تصدير نظرة عامة — Excel (3 ورقات)"
            >
              <FileSpreadsheet /> تصدير Excel
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  setWhForm(() => ({ name: '', address: '', branch_id: '' }));
                  setShowAddWH(true);
                }}
              >
                <Plus /> إضافة مخزن
              </Button>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loadingWH ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-[var(--surface)] border border-[var(--line)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="لا توجد مخازن بعد"
            icon={<Warehouse />}
            action={
              isAdmin ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setWhForm(() => ({ name: '', address: '', branch_id: '' }));
                    setShowAddWH(true);
                  }}
                >
                  إضافة أول مخزن
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {warehouses.map((w) => {
              const ws = whSummaryMap.get(w.id);
              const isSelected = currentWarehouseIdNum === w.id;
              return (
                <div
                  key={w.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setWarehouseId(String(w.id))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setWarehouseId(String(w.id));
                  }}
                  title="انقر لتعيين كمخزن نشط"
                  className={`group relative rounded-2xl p-5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] select-none border ${
                    isSelected
                      ? 'ring-2 ring-[var(--brand)] bg-[var(--surface)]'
                      : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--brand)]/20'
                  }`}
                >
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteWHTarget({ id: w.id, name: w.name });
                      }}
                      className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      title="حذف المخزن"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center mb-3">
                    <Warehouse className="w-5 h-5 text-[var(--brand)]" />
                  </div>
                  <p className="font-bold text-sm mb-1">{w.name}</p>
                  {w.address && <p className="opacity-40 text-xs truncate">{w.address}</p>}

                  {/* Branch assignment */}
                  {isAdmin && branches.length > 0 ? (
                    <select
                      className="mt-1.5 mb-2 w-full text-[10px] rounded-lg px-2 py-1 bg-[var(--surface)] border border-[var(--line)] opacity-50 hover:border-[var(--brand)]/25 transition-colors outline-none cursor-pointer"
                      value={w.branch_id ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        e.stopPropagation();
                        const bid = e.target.value;
                        await authFetch(api(`/api/settings/warehouses/${w.id}`), {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ branch_id: bid ? Number(bid) : null }),
                        });
                        invalidateWH();
                        qc.invalidateQueries({ queryKey: ['/api/branches'] });
                      }}
                    >
                      <option value="">— بدون فرع —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : w.branch_id ? (
                    <p className="opacity-40 text-[10px] mb-2">
                      {branches.find((b) => b.id === w.branch_id)?.name ?? ''}
                    </p>
                  ) : (
                    <div className="mb-2" />
                  )}

                  {/* Warehouse stats */}
                  {ws && (
                    <div className="space-y-1 pt-2 border-t border-[var(--line)]">
                      <div className="flex items-center justify-between">
                        <span className="opacity-40 text-xs">قيمة المخزون</span>
                        <span className="text-emerald-400 text-xs font-bold">
                          {formatCurrency(ws.total_value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="opacity-40 text-xs">عدد المنتجات</span>
                        <span className="opacity-70 text-xs font-bold">{ws.item_count}</span>
                      </div>
                      {grandTotal > 0 && (
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="opacity-30 text-xs">من الإجمالي</span>
                            <span className="opacity-50 text-xs font-bold">
                              {ws.pct_of_total}%
                            </span>
                          </div>
                          <div className="h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--brand)] rounded-full transition-all"
                              style={{ width: `${ws.pct_of_total}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active badge */}
                  {isSelected && (
                    <div className="mt-2">
                      <Badge variant="neutral">✓ المخزن النشط</Badge>
                    </div>
                  )}

                  {/* View products button */}
                  {ws && ws.item_count > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWarehouseDetailId(w.id);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] bg-[var(--surface)] hover:bg-[var(--raised)] opacity-50 hover:opacity-100 border border-[var(--line)] transition-all"
                    >
                      <Eye className="w-3 h-3" /> عرض المنتجات
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Modal: add warehouse ────────────────────────────────────────────── */}
      {showAddWH && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddWH(false)}
        >
          <Card
            className="p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-[var(--brand)]" /> إضافة مخزن جديد
              </h3>
              <IconButton
                aria-label="إغلاق"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddWH(false)}
              >
                <X />
              </IconButton>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block opacity-60 text-xs mb-1.5">
                  اسم المخزن <span className="text-red-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="المخزن الرئيسي"
                  value={whForm.name}
                  onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block opacity-60 text-xs mb-1.5">العنوان (اختياري)</label>
                <Input
                  type="text"
                  placeholder="القاهرة، مصر"
                  value={whForm.address}
                  onChange={(e) => setWhForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="block opacity-60 text-xs mb-1.5">الفرع (اختياري)</label>
                  <select
                    className="erp-input w-full"
                    value={whForm.branch_id}
                    onChange={(e) => setWhForm((f) => ({ ...f, branch_id: e.target.value }))}
                  >
                    <option value="">— بدون فرع —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1"
                disabled={createWH.isPending}
                loading={createWH.isPending}
                onClick={async () => {
                  if (!whForm.name.trim()) {
                    toast({ title: 'الاسم مطلوب', variant: 'destructive' });
                    return;
                  }
                  try {
                    const r = await authFetch(api('/api/settings/warehouses'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: whForm.name.trim(),
                        address: whForm.address.trim() || undefined,
                        branch_id: whForm.branch_id ? Number(whForm.branch_id) : undefined,
                      }),
                    });
                    if (!r.ok) throw new Error((await r.json()).error ?? 'فشل الإضافة');
                    invalidateWH();
                    qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
                    toast({ title: 'تم إضافة المخزن بنجاح' });
                    setWhForm(() => ({ name: '', address: '', branch_id: '' }));
                    setShowAddWH(false);
                  } catch (e: unknown) {
                    toast({
                      title: (e as Error)?.message ?? 'فشل الإضافة',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Plus /> إضافة
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setShowAddWH(false)}>
                إلغاء
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: delete warehouse ─────────────────────────────────────────── */}
      {deleteWHTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteWHTarget(null)}
        >
          <Card
            className="p-6 w-full max-w-sm shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Warehouse className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="font-bold text-lg mb-1">حذف المخزن</h3>
            <p className="opacity-50 text-sm mb-1">
              هل تريد حذف <span className="text-red-400 font-bold">"{deleteWHTarget.name}"</span>؟
            </p>
            <p className="opacity-30 text-xs mb-6">
              لا يمكن حذف مخزن له حركات أو جلسات جرد أو تحويلات مسجّلة
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteWH.isPending}
                loading={deleteWH.isPending}
                onClick={() =>
                  deleteWH.mutate(deleteWHTarget.id, {
                    onSuccess: () => {
                      invalidateWH();
                      qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
                      toast({ title: 'تم حذف المخزن' });
                      setDeleteWHTarget(null);
                    },
                    onError: (e: unknown) => {
                      toast({
                        title: (e as Error)?.message ?? 'فشل الحذف',
                        variant: 'destructive',
                      });
                      setDeleteWHTarget(null);
                    },
                  })
                }
              >
                <Trash2 /> حذف
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setDeleteWHTarget(null)}>
                إلغاء
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: warehouse product detail ────────────────────────────────── */}
      {warehouseDetailId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setWarehouseDetailId(null)}
        >
          <Card
            className="p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-[var(--brand)]" />
                {warehouses.find((w) => w.id === warehouseDetailId)?.name ?? 'تفاصيل المخزن'}
              </h3>
              <IconButton
                aria-label="إغلاق"
                variant="ghost"
                size="sm"
                onClick={() => setWarehouseDetailId(null)}
              >
                <X />
              </IconButton>
            </div>

            {/* Content */}
            {whDetailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin opacity-30" />
              </div>
            ) : whDetailProducts.length === 0 ? (
              <EmptyState
                variant="no-data"
                title="لا توجد منتجات في هذا المخزن"
                icon={<Package />}
              />
            ) : (
              <>
                <p className="opacity-40 text-xs mb-3">
                  {whDetailProducts.length} صنف في هذا المخزن
                </p>
                <div className="overflow-y-auto flex-1">
                  <Table>
                    <TableHead className="sticky top-0">
                      <TableRow>
                        <TableHeader>المنتج</TableHeader>
                        <TableHeader>التصنيف</TableHeader>
                        <TableHeader>الكمية</TableHeader>
                        <TableHeader>الحالة</TableHeader>
                        <TableHeader>قيمة المخزون</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {whDetailProducts.map((p) => {
                        const isZero = p.actual_qty <= 0;
                        const isLow =
                          p.low_stock_threshold !== null &&
                          p.actual_qty <= p.low_stock_threshold &&
                          !isZero;
                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-medium">{p.name}</div>
                              {p.sku && (
                                <div className="opacity-30 text-xs">{p.sku}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {p.category ? (
                                <Badge variant="neutral">{p.category}</Badge>
                              ) : (
                                <span className="opacity-20">—</span>
                              )}
                            </TableCell>
                            <TableCell variant="number">
                              <span
                                className={
                                  isZero
                                    ? 'text-red-400 font-bold'
                                    : isLow
                                      ? 'text-amber-400 font-bold'
                                      : 'text-emerald-400 font-bold'
                                }
                              >
                                {p.actual_qty.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell variant="status">
                              {isZero ? (
                                <StatusBadge variant="critical" label="نافد" />
                              ) : isLow ? (
                                <StatusBadge variant="neutral" label="منخفض" />
                              ) : (
                                <StatusBadge variant="positive" label="متوفر" />
                              )}
                            </TableCell>
                            <TableCell variant="number">
                              <span className="font-bold">{formatCurrency(p.total_value)}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <tfoot>
                      <tr className="border-t border-[var(--line)] bg-[var(--surface)]">
                        <td colSpan={4} className="p-3 opacity-50 font-bold">
                          الإجمالي
                        </td>
                        <td className="p-3 text-end font-bold">
                          {formatCurrency(whDetailProducts.reduce((s, p) => s + p.total_value, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
