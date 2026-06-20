/**
 * SaleProductPicker.tsx
 * Left column of the POS panel: search bar, barcode toggle,
 * category pills, and the product card grid.
 */
import { Search, X, ScanLine, Package, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface SaleProduct {
  id: number;
  name: string;
  sale_price: number;
  quantity: number;
  sku?: string | null;
  category?: string | null;
  category_name?: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface SaleProductPickerProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  barcodeMode: boolean;
  setBarcodeMode: React.Dispatch<React.SetStateAction<boolean>>;
  categoryFilter: string;
  setCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  categories: Category[];
  filteredProducts: SaleProduct[];
  recentlyAdded: number | null;
  onAddToCart: (product: SaleProduct) => void;
  onCreateProduct: () => void;
}

export function SaleProductPicker({
  search,
  setSearch,
  searchInputRef,
  handleSearchKeyDown,
  barcodeMode,
  setBarcodeMode,
  categoryFilter,
  setCategoryFilter,
  categories,
  filteredProducts,
  recentlyAdded,
  onAddToCart,
  onCreateProduct,
}: SaleProductPickerProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {/* شريط البحث + الفئات */}
      <div className="sale-search-bar rounded-2xl px-3 pt-3 pb-2 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-amber-400/60 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="ابحث عن منتج... (Enter للإضافة)"
            className="sale-search-input bg-transparent text-sm w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {search && filteredProducts.filter((p) => Number(p.quantity) > 0).length > 0 && (
            <span className="shrink-0 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap font-bold">
              ↵{' '}
              {filteredProducts.filter((p) => Number(p.quantity) > 0).length === 1
                ? filteredProducts[0].name.slice(0, 18)
                : `${filteredProducts.filter((p) => Number(p.quantity) > 0).length} نتيجة`}
            </span>
          )}
          {search && (
            <button
              onClick={() => setSearch('')}
              className="shrink-0 sale-muted-text hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setBarcodeMode((v) => !v)}
            title={barcodeMode ? 'إيقاف وضع الباركود' : 'تفعيل وضع الباركود'}
            className={`shrink-0 transition-colors rounded-lg p-1 ${barcodeMode ? 'text-amber-400 bg-amber-500/15' : 'sale-muted-text hover:text-amber-400'}`}
          >
            <ScanLine className="w-4 h-4" />
          </button>
        </div>
        {barcodeMode && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-1 pb-0.5 animate-pulse">
            <ScanLine className="w-3 h-3" />
            وضع الباركود نشط — امسح الكود وسيُضاف تلقائياً
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setCategoryFilter('')}
            className={`sale-cat-pill text-xs font-bold px-3 py-1 rounded-full shrink-0 ${!categoryFilter ? 'active' : ''}`}
          >
            كل الأصناف
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter((prev) => (prev === cat.name ? '' : cat.name))}
              className={`sale-cat-pill text-xs font-bold px-3 py-1 rounded-full shrink-0 ${categoryFilter === cat.name ? 'active' : ''}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* شبكة المنتجات */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-1">
          {filteredProducts.map((product) => {
            const outOfStock = product.quantity <= 0;
            const lowStock = !outOfStock && product.quantity <= 5;
            const isFlashing = recentlyAdded === product.id;
            return (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                disabled={outOfStock}
                className={`sale-product-card group relative rounded-2xl p-3.5 text-right overflow-hidden ${isFlashing ? 'pos-card-flash' : ''}`}
              >
                <span
                  className={`absolute top-2 start-2 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-md sale-stock-badge ${
                    outOfStock
                      ? '!bg-red-500/15 !text-red-400'
                      : lowStock
                        ? '!bg-orange-500/15 !text-orange-400'
                        : ''
                  }`}
                >
                  {outOfStock ? 'نفد' : lowStock ? `${product.quantity} ⚠` : product.quantity}
                </span>
                <div className="sale-product-icon-bg h-12 rounded-xl mb-3 flex items-center justify-center">
                  <Package className="sale-product-icon w-5 h-5" />
                </div>
                <p className="sale-product-name font-bold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                  {product.name}
                </p>
                {product.category && (
                  <span className="text-[10px] text-amber-500/70 font-bold mt-0.5 block truncate">
                    {product.category}
                  </span>
                )}
                <div className="mt-2.5">
                  <span className="text-emerald-400 font-black text-sm tabular-nums">
                    {formatCurrency(product.sale_price)}
                  </span>
                </div>
                {!outOfStock && (
                  <div
                    className="mt-2 py-1 rounded-lg text-[11px] font-black text-center opacity-0 group-hover:opacity-100 transition-all duration-150 scale-95 group-hover:scale-100"
                    style={{
                      background: 'rgba(245,158,11,0.11)',
                      color: 'var(--status-warning)',
                      border: '1px solid rgba(245,158,11,0.20)',
                    }}
                  >
                    + أضف للفاتورة
                  </div>
                )}
              </button>
            );
          })}

          {search && filteredProducts.length === 0 && (
            <button
              onClick={onCreateProduct}
              className="rounded-2xl p-3.5 text-right border border-dashed border-line bg-surface hover:bg-raised hover:border-amber-500/30 transition-all flex flex-col items-center justify-center gap-2 min-h-[140px]"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-amber-400 text-xs font-bold">إضافة منتج جديد</p>
                <p className="sale-muted-text text-xs mt-0.5 truncate max-w-[120px] opacity-70">
                  «{search}»
                </p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
