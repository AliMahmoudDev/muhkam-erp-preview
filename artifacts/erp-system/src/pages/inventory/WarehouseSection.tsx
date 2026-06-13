import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { Package, X, Plus, Trash2, Warehouse, Loader2, FileSpreadsheet, Eye } from 'lucide-react';
import { api } from './_shared';

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
      {/* ══ قسم إدارة المخازن ════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">المخازن</h2>
            <p className="text-ink/40 text-sm mt-0.5">إدارة مواقع التخزين ومتابعة قيمة كل مخزن</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleOverviewExport()}
              disabled={allProducts.length === 0}
              title="تصدير نظرة عامة — Excel (3 ورقات)"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setWhForm(() => ({ name: '', address: '', branch_id: '' }));
                  setShowAddWH(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
              >
                <Plus className="w-4 h-4" /> إضافة مخزن
              </button>
            )}
          </div>
        </div>

        {loadingWH ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 bg-surface border border-line rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center bg-surface border border-line rounded-2xl">
            <Warehouse className="w-10 h-10 text-ink/15 mb-3" />
            <p className="text-ink/40 font-bold">لا توجد مخازن بعد</p>
            {isAdmin && (
              <button
                onClick={() => {
                  setWhForm(() => ({ name: '', address: '', branch_id: '' }));
                  setShowAddWH(true);
                }}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
              >
                إضافة أول مخزن
              </button>
            )}
          </div>
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
                  className={`group relative rounded-2xl p-5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] select-none ${
                    isSelected
                      ? 'bg-violet-500/10 border border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                      : 'bg-[#111827] border border-line hover:border-violet-500/20'
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
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-3">
                    <Warehouse className="w-5 h-5 text-violet-400" />
                  </div>
                  <p className="text-ink font-bold text-sm mb-1">{w.name}</p>
                  {w.address && <p className="text-ink/40 text-xs truncate">{w.address}</p>}
                  {/* الفرع */}
                  {isAdmin && branches.length > 0 ? (
                    <select
                      className="mt-1.5 mb-2 w-full text-[10px] rounded-lg px-2 py-1 bg-surface border border-line text-ink/50 hover:border-violet-500/30 transition-colors outline-none cursor-pointer"
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
                    <p className="text-violet-400/70 text-[10px] mb-2">
                      {branches.find((b) => b.id === w.branch_id)?.name ?? ''}
                    </p>
                  ) : (
                    <div className="mb-2" />
                  )}
                  {ws && (
                    <div className="space-y-1 pt-2 border-t border-line">
                      <div className="flex items-center justify-between">
                        <span className="text-ink/40 text-xs">قيمة المخزون</span>
                        <span className="text-emerald-400 text-xs font-bold">
                          {formatCurrency(ws.total_value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-ink/40 text-xs">عدد المنتجات</span>
                        <span className="text-ink/70 text-xs font-bold">{ws.item_count}</span>
                      </div>
                      {grandTotal > 0 && (
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-ink/30 text-xs">من الإجمالي</span>
                            <span className="text-violet-300 text-xs font-bold">
                              {ws.pct_of_total}%
                            </span>
                          </div>
                          <div className="h-1 bg-surface rounded-full overflow-hidden">
                            <div
                              className="h-full bg-violet-400 rounded-full transition-all"
                              style={{ width: `${ws.pct_of_total}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg text-xs bg-violet-500/25 text-violet-300 font-bold border border-violet-500/30">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      المخزن النشط
                    </span>
                  )}
                  {/* زر عرض المنتجات */}
                  {ws && ws.item_count > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWarehouseDetailId(w.id);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[11px] bg-surface hover:bg-violet-500/15 text-ink/50 hover:text-violet-300 border border-line hover:border-violet-500/20 transition-all"
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

      {/* ── Modal: إضافة مخزن ── */}
      {showAddWH && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddWH(false)}
        >
          <div
            className="bg-[#111827] border border-line rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-violet-400" /> إضافة مخزن جديد
              </h3>
              <button
                onClick={() => setShowAddWH(false)}
                className="p-1.5 rounded-lg bg-surface hover:bg-raised transition-colors"
              >
                <X className="w-4 h-4 text-ink/60" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-ink/60 text-xs mb-1.5">
                  اسم المخزن <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="المخزن الرئيسي"
                  value={whForm.name}
                  onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-ink/60 text-xs mb-1.5">العنوان (اختياري)</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="القاهرة، مصر"
                  value={whForm.address}
                  onChange={(e) => setWhForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="block text-ink/60 text-xs mb-1.5">الفرع (اختياري)</label>
                  <select
                    className="glass-input w-full"
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
              <button
                disabled={createWH.isPending}
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
                className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-ink font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {createWH.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة
              </button>
              <button
                onClick={() => setShowAddWH(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-raised text-ink/60 font-bold text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: حذف مخزن ── */}
      {deleteWHTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteWHTarget(null)}
        >
          <div
            className="bg-[#111827] border border-line rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Warehouse className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-ink font-bold text-lg mb-1">حذف المخزن</h3>
            <p className="text-ink/50 text-sm mb-1">
              هل تريد حذف <span className="text-red-400 font-bold">"{deleteWHTarget.name}"</span>؟
            </p>
            <p className="text-ink/30 text-xs mb-6">
              لا يمكن حذف مخزن له حركات أو جلسات جرد أو تحويلات مسجّلة
            </p>
            <div className="flex gap-3">
              <button
                disabled={deleteWH.isPending}
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
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-50 text-ink font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {deleteWH.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                حذف
              </button>
              <button
                onClick={() => setDeleteWHTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface hover:bg-raised text-ink/60 font-bold text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تفاصيل مخزن (T2) ── */}
      {warehouseDetailId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setWarehouseDetailId(null)}
        >
          <div
            className="bg-[#111827] border border-line rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس الـ modal */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-violet-400" />
                {warehouses.find((w) => w.id === warehouseDetailId)?.name ?? 'تفاصيل المخزن'}
              </h3>
              <button
                onClick={() => setWarehouseDetailId(null)}
                className="p-1.5 rounded-lg bg-surface hover:bg-raised transition-colors"
              >
                <X className="w-4 h-4 text-ink/60" />
              </button>
            </div>

            {/* المحتوى */}
            {whDetailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : whDetailProducts.length === 0 ? (
              <div className="text-center py-16 text-ink/30">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد منتجات في هذا المخزن</p>
              </div>
            ) : (
              <>
                <p className="text-ink/40 text-xs mb-3">
                  {whDetailProducts.length} صنف في هذا المخزن
                </p>
                <div className="overflow-y-auto flex-1 rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#111827]">
                      <tr className="border-b border-line bg-surface text-ink/50 font-medium">
                        <th className="p-3 text-right">المنتج</th>
                        <th className="p-3 text-center">التصنيف</th>
                        <th className="p-3 text-center">الكمية</th>
                        <th className="p-3 text-center">الحالة</th>
                        <th className="p-3 text-center">قيمة المخزون</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whDetailProducts.map((p) => {
                        const isZero = p.actual_qty <= 0;
                        const isLow =
                          p.low_stock_threshold !== null &&
                          p.actual_qty <= p.low_stock_threshold &&
                          !isZero;
                        return (
                          <tr key={p.id} className="border-b border-line erp-table-row">
                            <td className="p-3">
                              <div className="text-ink font-medium">{p.name}</div>
                              {p.sku && <div className="text-ink/30 text-xs">{p.sku}</div>}
                            </td>
                            <td className="p-3 text-center">
                              {p.category ? (
                                <span className="px-2 py-0.5 rounded-lg bg-surface text-ink/50 text-xs">
                                  {p.category}
                                </span>
                              ) : (
                                <span className="text-ink/20">—</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              <span
                                className={
                                  isZero
                                    ? 'text-red-400'
                                    : isLow
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                }
                              >
                                {p.actual_qty.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {isZero ? (
                                <span className="px-2 py-0.5 rounded-lg bg-red-500/15 text-red-400 text-xs">
                                  نافد
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs">
                                  منخفض
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">
                                  متوفر
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-ink">
                              {formatCurrency(p.total_value)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-line bg-surface">
                        <td colSpan={4} className="p-3 text-ink/50 font-bold">
                          الإجمالي
                        </td>
                        <td className="p-3 text-center font-bold text-ink">
                          {formatCurrency(whDetailProducts.reduce((s, p) => s + p.total_value, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
