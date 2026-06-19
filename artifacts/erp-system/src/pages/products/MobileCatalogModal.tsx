import { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Loader2, Package, Search } from 'lucide-react';
import { MOBILE_CATALOG, CatalogProduct, CatalogBrand, CatalogModel } from './catalog-data';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SelectedItem {
  product: CatalogProduct;
  name: string;
  quantity: number;
  cost_price: number;
  sale_price: number;
}

interface ExistingProduct {
  id: number;
  quantity: number;
  name: string;
  sku: string;
  category?: string | null;
  cost_price: number;
  sale_price: number;
  low_stock_threshold?: number | null;
}

interface MobileCatalogModalProps {
  onClose: () => void;
  onDone: () => void;
  existingSkus: Map<string, ExistingProduct>;
}

type Level = 'category' | 'brand' | 'products';

export function MobileCatalogModal({ onClose, onDone, existingSkus }: MobileCatalogModalProps) {
  const { toast } = useToast();

  const [level, setLevel] = useState<Level>('category');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');

  const [selections, setSelections] = useState<Map<string, SelectedItem>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const selectedCat = MOBILE_CATALOG.find((c) => c.id === selectedCatId);
  const selectedBrand: CatalogBrand | undefined = selectedCat?.brands.find((b) => b.id === selectedBrandId);
  const selectedModel: CatalogModel | undefined = selectedBrand?.models.find((m) => m.id === selectedModelId);

  // Level-3: products of the selected model, filtered by search
  const filteredProducts = useMemo(() => {
    if (!selectedModel) return [];
    const q = productSearch.trim().toLowerCase();
    if (!q) return selectedModel.products;
    return selectedModel.products.filter(
      (p) =>
        p.defaultName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [selectedModel, productSearch]);

  // Level-2: models in selected brand, filtered by search
  const filteredModels = useMemo(() => {
    if (!selectedBrand) return [];
    const q = modelSearch.trim().toLowerCase();
    if (!q) return selectedBrand.models;
    return selectedBrand.models.filter((m) => m.label.toLowerCase().includes(q));
  }, [selectedBrand, modelSearch]);

  const toggleProduct = (product: CatalogProduct) => {
    setSelections((prev) => {
      const next = new Map(prev);
      if (next.has(product.sku)) {
        next.delete(product.sku);
      } else {
        next.set(product.sku, {
          product,
          name: product.defaultName,
          quantity: 1,
          cost_price: 0,
          sale_price: 0,
        });
      }
      return next;
    });
  };

  const updateSelection = (
    sku: string,
    field: 'name' | 'quantity' | 'cost_price' | 'sale_price',
    value: string | number
  ) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const item = next.get(sku);
      if (!item) return prev;
      next.set(sku, { ...item, [field]: value });
      return next;
    });
  };

  // Navigate: Category → Brand (show models grouped by brand)
  const handleGoToBrands = (catId: string) => {
    setSelectedCatId(catId);
    setSelectedBrandId(null);
    setSelectedModelId(null);
    setModelSearch('');
    setLevel('brand');
  };

  // Navigate: Brand level → select a brand to see its models
  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    setSelectedModelId(null);
    setModelSearch('');
  };

  // Navigate: Model selected → show that model's products
  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    setProductSearch('');
    setLevel('products');
  };

  const handleBack = () => {
    if (level === 'products') {
      setLevel('brand');
      setSelectedModelId(null);
      setProductSearch('');
    } else if (level === 'brand') {
      setLevel('category');
      setSelectedCatId(null);
      setSelectedBrandId(null);
      setModelSearch('');
    }
  };

  const totalSelected = selections.size;

  const handleSubmit = async () => {
    if (totalSelected === 0) return;
    setSubmitting(true);

    let added = 0;
    let updated = 0;
    let failed = 0;

    for (const item of selections.values()) {
      const existing = existingSkus.get(item.product.sku.toUpperCase());
      try {
        if (existing) {
          const newQty = existing.quantity + item.quantity;
          const r = await authFetch(api(`/api/products/${existing.id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: existing.name,
              sku: existing.sku,
              category: existing.category ?? undefined,
              quantity: newQty,
              cost_price: item.cost_price > 0 ? item.cost_price : existing.cost_price,
              sale_price: item.sale_price > 0 ? item.sale_price : existing.sale_price,
              low_stock_threshold: existing.low_stock_threshold ?? undefined,
            }),
          });
          if (r.ok) updated++;
          else failed++;
        } else {
          const r = await authFetch(api('/api/products'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              sku: item.product.sku,
              category: item.product.category,
              quantity: item.quantity,
              cost_price: item.cost_price,
              sale_price: item.sale_price,
            }),
          });
          if (r.ok) added++;
          else failed++;
        }
      } catch {
        failed++;
      }
    }

    setSubmitting(false);

    const parts: string[] = [];
    if (added > 0) parts.push(`أُضيف ${added} منتج`);
    if (updated > 0) parts.push(`حُدِّثت كمية ${updated} منتج`);
    if (failed > 0) parts.push(`فشل ${failed}`);

    toast({
      title: parts.join(' — '),
      variant: failed > 0 && added + updated === 0 ? 'destructive' : 'default',
    });

    onDone();
  };

  const breadcrumbParts: string[] = [];
  if (selectedCat) breadcrumbParts.push(selectedCat.label);
  if (selectedBrand) breadcrumbParts.push(selectedBrand.label);
  if (selectedModel) breadcrumbParts.push(selectedModel.label);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <div
        className="glass-panel rounded-3xl w-full max-w-2xl border border-line shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            {level !== 'category' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg text-ink/50 hover:text-ink hover:bg-surface transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-black text-ink flex items-center gap-2">
                <span>📱</span> كاتالوج المحمول
              </h2>
              {breadcrumbParts.length > 0 && (
                <p className="text-xs text-ink/40 flex items-center gap-1 mt-0.5">
                  {breadcrumbParts.map((b, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="w-3 h-3" />}
                      {b}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalSelected > 0 && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {totalSelected} محدد
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-surface hover:bg-raised transition-colors">
              <X className="w-4 h-4 text-ink/60" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Level 1: Categories */}
          {level === 'category' && (
            <div className="p-4 grid grid-cols-2 gap-3">
              {MOBILE_CATALOG.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleGoToBrands(cat.id)}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-line hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-right group"
                >
                  <span className="text-3xl">{cat.icon}</span>
                  <div>
                    <p className="text-ink font-bold text-sm group-hover:text-amber-300 transition-colors">
                      {cat.label}
                    </p>
                    <p className="text-ink/30 text-xs">{cat.brands.length} ماركة</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-ink/20 group-hover:text-amber-400 mr-auto transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Level 2: Brand tabs + model list */}
          {level === 'brand' && selectedCat && (
            <div className="flex h-full min-h-[400px]">
              {/* Brand sidebar */}
              <div className="w-32 shrink-0 border-l border-line bg-surface/40 overflow-y-auto">
                {selectedCat.brands.map((brand) => {
                  const isActive = selectedBrandId === brand.id;
                  const selectedInBrand = brand.models.reduce(
                    (sum, m) => sum + m.products.filter((p) => selections.has(p.sku)).length,
                    0
                  );
                  return (
                    <button
                      key={brand.id}
                      onClick={() => handleSelectBrand(brand.id)}
                      className={`w-full px-3 py-3 text-right text-sm transition-all border-b border-line ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-300 font-bold border-l-2 border-l-amber-400'
                          : 'text-ink/50 hover:text-ink hover:bg-surface'
                      }`}
                    >
                      <div className="truncate">{brand.label}</div>
                      {selectedInBrand > 0 && (
                        <span className="text-[10px] text-amber-400">{selectedInBrand}✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Model list */}
              <div className="flex-1 overflow-y-auto p-3">
                {!selectedBrandId ? (
                  <div className="flex items-center justify-center h-full text-ink/30 text-sm">
                    اختر ماركة من القائمة
                  </div>
                ) : (
                  <>
                    <div className="relative mb-3">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30" />
                      <input
                        type="text"
                        placeholder="بحث عن موديل..."
                        className="glass-input icon-pr w-full text-sm"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredModels.map((model) => {
                        const selectedCount = model.products.filter((p) =>
                          selections.has(p.sku)
                        ).length;
                        return (
                          <button
                            key={model.id}
                            onClick={() => handleSelectModel(model.id)}
                            className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-right group"
                          >
                            <div className="min-w-0">
                              <p className="text-ink text-sm font-semibold group-hover:text-amber-300 transition-colors truncate">
                                {model.label}
                              </p>
                              <p className="text-ink/30 text-xs">{model.products.length} منتج</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mr-1">
                              {selectedCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                  {selectedCount}✓
                                </span>
                              )}
                              <ChevronLeft className="w-3.5 h-3.5 text-ink/20 group-hover:text-amber-400 transition-colors" />
                            </div>
                          </button>
                        );
                      })}
                      {filteredModels.length === 0 && (
                        <div className="col-span-2 py-8 text-center text-ink/30 text-sm">
                          لا توجد موديلات مطابقة
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Level 3: Products of selected model */}
          {level === 'products' && selectedModel && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30" />
                <input
                  type="text"
                  placeholder="بحث في المنتجات..."
                  className="glass-input icon-pr w-full text-sm"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-10 text-center">
                  <Package className="w-10 h-10 text-ink/20 mx-auto mb-3" />
                  <p className="text-ink/40 text-sm">لا توجد نتائج</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const isSelected = selections.has(product.sku);
                    const sel = selections.get(product.sku);
                    const alreadyExists = existingSkus.has(product.sku.toUpperCase());
                    return (
                      <div
                        key={product.sku}
                        className={`rounded-xl border transition-all ${
                          isSelected
                            ? 'border-amber-500/50 bg-amber-500/8'
                            : 'border-line bg-surface hover:border-line/80'
                        }`}
                      >
                        {/* Product row */}
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => toggleProduct(product)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : 'border-line hover:border-amber-400'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            {isSelected && sel ? (
                              <input
                                type="text"
                                value={sel.name}
                                onChange={(e) =>
                                  updateSelection(product.sku, 'name', e.target.value)
                                }
                                className="w-full bg-transparent text-ink text-sm font-semibold outline-none border-b border-amber-500/30 pb-0.5 focus:border-amber-400"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <p className="text-ink text-sm font-semibold truncate">
                                {product.defaultName}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-ink/30 text-[10px] font-mono">{product.sku}</span>
                              {alreadyExists && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">
                                  موجود — سيُحدَّث
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded inputs when selected */}
                        {isSelected && sel && (
                          <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                            <div>
                              <label className="text-ink/40 text-[10px] block mb-1">الكمية</label>
                              <input
                                type="number"
                                min="1"
                                value={sel.quantity}
                                onChange={(e) =>
                                  updateSelection(product.sku, 'quantity', parseInt(e.target.value) || 1)
                                }
                                className="w-full px-2 py-1.5 rounded-lg bg-black/20 border border-line text-ink text-sm text-center outline-none focus:border-amber-400/60"
                              />
                            </div>
                            <div>
                              <label className="text-ink/40 text-[10px] block mb-1">سعر التكلفة</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={sel.cost_price || ''}
                                onChange={(e) =>
                                  updateSelection(product.sku, 'cost_price', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 rounded-lg bg-black/20 border border-line text-ink text-sm text-center outline-none focus:border-amber-400/60"
                              />
                            </div>
                            <div>
                              <label className="text-ink/40 text-[10px] block mb-1">سعر البيع</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={sel.sale_price || ''}
                                onChange={(e) =>
                                  updateSelection(product.sku, 'sale_price', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 rounded-lg bg-black/20 border border-line text-ink text-sm text-center outline-none focus:border-amber-400/60"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line shrink-0 flex items-center justify-between gap-3 bg-surface/30">
          <div className="text-xs text-ink/40">
            {totalSelected > 0 ? (
              <span className="text-amber-400 font-bold">{totalSelected} منتج محدد للإضافة</span>
            ) : (
              'حدد منتجات من الكاتالوج'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-ink/50 hover:text-ink transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={totalSelected === 0 || submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {submitting ? 'جاري الإضافة...' : `أضف المحدد للمخزون (${totalSelected})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
