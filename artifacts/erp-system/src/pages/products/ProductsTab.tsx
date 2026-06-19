import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useGetProducts, useGetCategories } from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';
import {
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  Pencil,
  FileDown,
  FileUp,
  Download,
  Package,
  X,
  QrCode,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { exportProductsExcel } from '@/lib/export-excel';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { ConfirmModal } from '@/components/confirm-modal';
import {
  ProductFormModal,
  ProductFormData,
  emptyProductForm,
} from '@/components/product-form-modal';
import { safeArray } from '@/lib/safe-data';
import { api } from '@/lib/api';
import { useProductsImport } from '@/pages/settings/data/hooks/useImportActions';

export function ProductsTab() {
  const { data: productsRaw = [], isLoading } = useGetProducts();
  const products = safeArray(productsRaw);
  const { data: categoriesRaw } = useGetCategories();
  const categories = safeArray(categoriesRaw);
  const { user } = useAuth();
  const canViewProducts = hasPermission(user, 'can_view_products') === true;
  const canManageProducts = hasPermission(user, 'can_manage_products') === true;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      const r = await authFetch(api('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const r = await authFetch(api(`/api/products/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });

  const refreshLog = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
  };

  const {
    prodImporting,
    prodResult,
    prodRef,
    handleProductsImport,
    downloadProductsTemplate,
  } = useProductsImport(refreshLog);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState<(ProductFormData & { id: number }) | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [qrProduct, setQrProduct] = useState<{
    id: number;
    name: string;
    sku?: string | null;
  } | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      const r = await authFetch(api(`/api/products/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في التحديث');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تعديل المنتج بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setEditProduct(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.includes(search) ||
      (p.sku && p.sku.includes(search)) ||
      (p.category_name && p.category_name.includes(search)) ||
      (p.category && p.category.includes(search));
    const matchCat = !catFilter || p.category_name === catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleAdd = (data: ProductFormData) => {
    createMutation.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: '✅ تم إضافة المنتج بنجاح' });
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          setShowAdd(false);
        },
        onError: () => toast({ title: 'حدث خطأ', variant: 'destructive' }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: 'تم حذف المنتج بنجاح' });
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          setConfirmDeleteId(null);
        },
        onError: (e: Error) => {
          toast({ title: e.message, variant: 'destructive' });
          setConfirmDeleteId(null);
        },
      }
    );
  };

  const openEdit = (product: (typeof products)[0]) => {
    setEditProduct({
      id: product.id,
      name: product.name,
      sku: product.sku || '',
      category_id: product.category_id ?? null,
      category_name: product.category_name || product.category || '',
      quantity: Number(product.quantity),
      cost_price: Number(product.cost_price),
      sale_price: Number(product.sale_price),
      low_stock_threshold: product.low_stock_threshold ?? 5,
      tax_rate: Number((product as { tax_rate?: unknown }).tax_rate ?? 0),
    });
  };

  if (!canViewProducts)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="w-14 h-14 text-red-400/40 mb-4" />
        <p className="text-ink/60 font-bold text-lg">غير مصرح</p>
        <p className="text-ink/30 text-sm mt-1">
          غير مصرح لك بالوصول إلى المنتجات — تواصل مع المدير لتفعيل الصلاحية
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
            <input
              type="text"
              placeholder="بحث عن منتج..."
              className="glass-input pl-4 icon-pr w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <select
              className="glass-input appearance-none w-44 cursor-pointer"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="">كل الأصناف</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name} className="bg-gray-900">
                  {cat.name} ({cat.product_count})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Export Excel */}
          <button
            onClick={() => exportProductsExcel(products)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all whitespace-nowrap"
            title="تصدير Excel"
          >
            <FileDown className="w-4 h-4" /> تصدير
          </button>

          {canManageProducts && (
            <>
              {/* Import Excel */}
              <button
                onClick={() => prodRef.current?.click()}
                disabled={prodImporting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/40 text-violet-400 hover:bg-violet-500/30 transition-all whitespace-nowrap disabled:opacity-50"
                title="استيراد من Excel"
              >
                {prodImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileUp className="w-4 h-4" />
                )}
                {prodImporting ? 'جاري...' : 'استيراد Excel'}
              </button>

              {/* Download template */}
              <button
                onClick={downloadProductsTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-surface border border-line text-ink/50 hover:text-ink hover:border-line/80 transition-all whitespace-nowrap"
                title="تحميل نموذج فارغ"
              >
                <Download className="w-4 h-4" /> نموذج
              </button>

              {/* Hidden file input */}
              <input
                ref={prodRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleProductsImport}
              />

              {/* Add product */}
              <button
                onClick={() => setShowAdd(true)}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" /> إضافة منتج
              </button>
            </>
          )}
        </div>
      </div>

      {/* Import result banner */}
      {prodResult && (
        <div
          className={`px-4 py-3 rounded-xl border text-sm space-y-2 ${
            prodResult.failed === 0
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              تم استيراد <strong>{prodResult.success}</strong> صنف
              {prodResult.failed > 0 && (
                <span className="text-red-400"> — فشل {prodResult.failed} صنف</span>
              )}
            </span>
          </div>
          {prodResult.errors.length > 0 && (
            <ul className="text-xs text-red-400 space-y-0.5 pr-6 list-disc">
              {prodResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAdd && (
        <ProductFormModal
          title="منتج جديد"
          initial={emptyProductForm}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          isPending={createMutation.isPending}
        />
      )}
      {confirmDeleteId !== null && (
        <ConfirmModal
          title="حذف المنتج"
          description="هل أنت متأكد؟ سيتم حذف المنتج نهائياً ولا يمكن التراجع."
          isPending={deleteMutation.isPending}
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {editProduct && (
        <ProductFormModal
          title={`تعديل: ${editProduct.name}`}
          initial={editProduct}
          onSave={(data) => updateMutation.mutate({ id: editProduct.id, data })}
          onClose={() => setEditProduct(null)}
          isPending={updateMutation.isPending}
        />
      )}
      {qrProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          dir="rtl"
          onClick={() => setQrProduct(null)}
        >
          <div
            className="glass-panel rounded-3xl p-6 w-full max-w-xs border border-line space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-ink">رمز QR للمنتج</h2>
              <button onClick={() => setQrProduct(null)} className="text-ink/40 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={`MUHKAM-PRODUCT|id:${qrProduct.id}|name:${qrProduct.name}${qrProduct.sku ? `|sku:${qrProduct.sku}` : ''}`}
                size={180}
                level="H"
              />
            </div>
            <p className="text-ink font-bold text-sm">{qrProduct.name}</p>
            {qrProduct.sku && <p className="text-ink/40 text-xs font-mono">SKU: {qrProduct.sku}</p>}
            <p className="text-ink/30 text-xs">امسح الرمز لتحديد المنتج</p>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-ink/80 whitespace-nowrap">
            <thead className="bg-surface border-b border-line">
              <tr>
                <th className="p-4 font-semibold text-ink/60">المنتج</th>
                <th className="p-4 font-semibold text-ink/60">الباركود</th>
                <th className="p-4 font-semibold text-ink/60">التصنيف</th>
                <th className="p-4 font-semibold text-ink/60">التكلفة</th>
                <th className="p-4 font-semibold text-ink/60">سعر البيع</th>
                <th className="p-4 font-semibold text-ink/60">الهامش</th>
                <th className="p-4 font-semibold text-ink/60">الكمية</th>
                <th className="p-4 font-semibold text-ink/60 w-24 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={8} rows={6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-14 text-center">
                    <Package className="w-10 h-10 text-ink/20 mx-auto mb-3" />
                    <p className="text-ink/40 font-bold">لا توجد منتجات</p>
                    <p className="text-ink/20 text-sm mt-1">
                      {search || catFilter
                        ? 'جرب كلمة بحث أو تصنيف مختلف'
                        : 'اضغط «إضافة منتج» لإضافة منتجات'}
                    </p>
                    {canManageProducts && !search && !catFilter && (
                      <button
                        onClick={() => setShowAdd(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all"
                      >
                        <Plus className="w-4 h-4" /> إضافة أول منتج
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const displayCat = product.category_name || product.category;
                  const isLow =
                    product.low_stock_threshold !== null &&
                    product.quantity <= (product.low_stock_threshold ?? 5);
                  const margin =
                    Number(product.sale_price) > 0
                      ? ((Number(product.sale_price) - Number(product.cost_price)) /
                          Number(product.sale_price)) *
                        100
                      : 0;
                  return (
                    <tr key={product.id} className="border-b border-line erp-table-row">
                      <td className="p-4 font-bold text-ink">{product.name}</td>
                      <td className="p-4 text-amber-300/70 font-mono text-xs">
                        {product.sku || '—'}
                      </td>
                      <td className="p-4">
                        {displayCat ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            {displayCat}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-4 text-ink/70">
                        {formatCurrency(Number(product.cost_price))}
                      </td>
                      <td className="p-4 font-bold text-emerald-400">
                        {formatCurrency(Number(product.sale_price))}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`text-xs font-bold ${margin >= 30 ? 'text-emerald-400' : margin >= 15 ? 'text-yellow-400' : 'text-orange-400'}`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${isLow ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          {product.quantity}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              setQrProduct({ id: product.id, name: product.name, sku: product.sku })
                            }
                            title="رمز QR"
                            className="p-2 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          {canManageProducts && (
                            <button
                              onClick={() => openEdit(product)}
                              title="تعديل المنتج"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-blue-400 text-xs font-bold cursor-pointer border border-blue-400/40 bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                            >
                              <Pencil style={{ width: '14px', height: '14px' }} /> تعديل
                            </button>
                          )}
                          {canManageProducts && (
                            <button
                              onClick={() => setConfirmDeleteId(product.id)}
                              title="حذف المنتج"
                              className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
