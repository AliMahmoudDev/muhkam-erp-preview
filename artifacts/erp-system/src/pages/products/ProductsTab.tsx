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
  Trash2,
  Pencil,
  FileDown,
  FileUp,
  Download,
  X,
  QrCode,
} from 'lucide-react';
import { exportProductsExcel } from '@/lib/export-excel';
import { useToast } from '@/hooks/use-toast';
import { ConfirmModal } from '@/components/confirm-modal';
import {
  ProductFormModal,
  ProductFormData,
  emptyProductForm,
} from '@/components/product-form-modal';
import { safeArray } from '@/lib/safe-data';
import { api } from '@/lib/api';
import { useProductsImport } from '@/pages/settings/data/hooks/useImportActions';

import { PageToolbar } from '@/components/patterns';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Combobox } from '@/components/ui/combobox';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';

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

  /* ── Permission gate ──────────────────────────────────────── */
  if (!canViewProducts)
    return (
      <EmptyState
        variant="no-data"
        title="غير مصرح"
        description="غير مصرح لك بالوصول إلى المنتجات — تواصل مع المدير لتفعيل الصلاحية"
      />
    );

  const hasActiveFilter = !!(search || catFilter);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <PageToolbar
        searchSlot={
          <SearchInput
            placeholder="بحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        }
        filtersSlot={
          categories.length > 0 ? (
            <Combobox
              options={categories.map((cat) => ({
                value: cat.name,
                label: `${cat.name} (${cat.product_count})`,
              }))}
              value={catFilter}
              onChange={(v) => setCatFilter(v)}
              placeholder="كل الأصناف"
              clearable
              className="w-44"
            />
          ) : null
        }
        actionsSlot={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => exportProductsExcel(products)}>
              <FileDown /> تصدير
            </Button>

            {canManageProducts && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => prodRef.current?.click()}
                  loading={prodImporting}
                  disabled={prodImporting}
                >
                  <FileUp /> {prodImporting ? 'جاري...' : 'استيراد Excel'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadProductsTemplate}
                >
                  <Download /> نموذج
                </Button>

                {/* Hidden file input */}
                <input
                  ref={prodRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleProductsImport}
                />

                <Button size="sm" onClick={() => setShowAdd(true)}>
                  <Plus /> إضافة منتج
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ── Import result banner ─────────────────────────────── */}
      {prodResult && (
        <Banner
          variant={prodResult.failed === 0 ? 'success' : 'warning'}
          title={
            prodResult.failed === 0
              ? `تم استيراد ${prodResult.success} صنف بنجاح`
              : `تم استيراد ${prodResult.success} صنف — فشل ${prodResult.failed} صنف`
          }
          description={
            prodResult.errors.length > 0
              ? prodResult.errors.join(' / ')
              : undefined
          }
        />
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
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

      {/* ── QR code modal ───────────────────────────────────── */}
      {qrProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          dir="rtl"
          onClick={() => setQrProduct(null)}
        >
          <Card
            className="p-6 w-full max-w-xs space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">رمز QR للمنتج</h2>
              <IconButton
                aria-label="إغلاق"
                variant="ghost"
                size="sm"
                onClick={() => setQrProduct(null)}
              >
                <X />
              </IconButton>
            </div>
            <div className="flex justify-center p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={`MUHKAM-PRODUCT|id:${qrProduct.id}|name:${qrProduct.name}${qrProduct.sku ? `|sku:${qrProduct.sku}` : ''}`}
                size={180}
                level="H"
              />
            </div>
            <p className="font-bold text-sm">{qrProduct.name}</p>
            {qrProduct.sku && (
              <p className="text-xs font-mono opacity-40">SKU: {qrProduct.sku}</p>
            )}
            <p className="text-xs opacity-30">امسح الرمز لتحديد المنتج</p>
          </Card>
        </div>
      )}

      {/* ── Table / states ──────────────────────────────────── */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant={hasActiveFilter ? 'no-results' : 'no-data'}
          query={search || undefined}
          title={hasActiveFilter ? undefined : 'لا توجد منتجات'}
          description={hasActiveFilter ? undefined : 'اضغط «إضافة منتج» لإضافة منتجات.'}
          action={
            !hasActiveFilter && canManageProducts ? (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus /> إضافة أول منتج
              </Button>
            ) : hasActiveFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setCatFilter('');
                }}
              >
                <X /> مسح الفلتر
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>المنتج</TableHeader>
              <TableHeader>الباركود</TableHeader>
              <TableHeader>التصنيف</TableHeader>
              <TableHeader>التكلفة</TableHeader>
              <TableHeader>سعر البيع</TableHeader>
              <TableHeader>الهامش</TableHeader>
              <TableHeader>الكمية</TableHeader>
              <TableHeader>إجراءات</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((product) => {
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
                <TableRow key={product.id}>
                  {/* Product name */}
                  <TableCell>
                    <span className="font-bold">{product.name}</span>
                  </TableCell>

                  {/* SKU / Barcode */}
                  <TableCell variant="metadata">
                    {product.sku ? (
                      <span className="font-mono">{product.sku}</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    {displayCat ? (
                      <Badge variant="neutral">{displayCat}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>

                  {/* Cost */}
                  <TableCell variant="number">
                    {formatCurrency(Number(product.cost_price))}
                  </TableCell>

                  {/* Sale price */}
                  <TableCell variant="number">
                    <span className="font-bold">
                      {formatCurrency(Number(product.sale_price))}
                    </span>
                  </TableCell>

                  {/* Margin */}
                  <TableCell variant="number">
                    <StatusBadge
                      variant={
                        margin >= 30 ? 'positive' : margin >= 15 ? 'neutral' : 'critical'
                      }
                      label={`${margin.toFixed(1)}%`}
                      icon={<></>}
                    />
                  </TableCell>

                  {/* Quantity */}
                  <TableCell variant="number">
                    {isLow ? (
                      <StatusBadge variant="critical" label={String(product.quantity)} />
                    ) : (
                      <span className="font-bold">{product.quantity}</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell variant="action">
                    <div className="flex items-center gap-1.5">
                      <IconButton
                        aria-label="رمز QR"
                        title="رمز QR"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setQrProduct({ id: product.id, name: product.name, sku: product.sku })
                        }
                      >
                        <QrCode />
                      </IconButton>
                      {canManageProducts && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(product)}
                          title="تعديل المنتج"
                        >
                          <Pencil /> تعديل
                        </Button>
                      )}
                      {canManageProducts && (
                        <IconButton
                          aria-label="حذف المنتج"
                          title="حذف المنتج"
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmDeleteId(product.id)}
                        >
                          <Trash2 />
                        </IconButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
