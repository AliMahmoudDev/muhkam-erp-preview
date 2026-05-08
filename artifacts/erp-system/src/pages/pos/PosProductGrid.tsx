import { Search, X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { CartItem } from './PosReceipt';
import type { PosProduct } from './hooks/usePosData';

interface PosProductGridProps {
  search: string;
  setSearch: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  filtered: PosProduct[];
  cart: CartItem[];
  recentlyAdded: number | null;
  cashierMode: boolean;
  addToCart: (product: PosProduct) => void;
  stockClass: (qty: number) => string;
}

export function PosProductGrid({
  search,
  setSearch,
  searchRef,
  filtered,
  cart,
  recentlyAdded,
  cashierMode,
  addToCart,
  stockClass,
}: PosProductGridProps) {
  const cm = cashierMode;

  return (
    <div
      className="flex flex-col flex-1 min-w-0"
      style={{ borderLeft: '1px solid var(--erp-border)' }}
    >
      {/* Search bar */}
      <div
        className="px-3 shrink-0"
        style={{
          paddingTop: '0.625rem',
          paddingBottom: '0.625rem',
          background: 'var(--erp-bg-soft)',
          borderBottom: '1px solid var(--erp-border)',
        }}
      >
        <div className="relative">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 erp-text-muted"
            style={{ color: 'var(--erp-text-3)' }}
          />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن صنف... (F2)"
            className="erp-input pr-10"
            style={{
              fontSize: cm ? '1rem' : '0.875rem',
              paddingTop: cm ? '0.75rem' : '0.625rem',
              paddingBottom: cm ? '0.75rem' : '0.625rem',
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                searchRef.current?.focus();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 erp-text-muted hover:opacity-100 opacity-50 transition-opacity"
              style={{ color: 'var(--erp-text-3)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Products count */}
      {search && (
        <div
          className="px-3 py-1"
          style={{
            background: 'var(--erp-bg-soft)',
            borderBottom: '1px solid var(--erp-border)',
          }}
        >
          <span className="erp-label text-[11px]">{filtered.length} نتيجة</span>
        </div>
      )}

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="erp-empty h-full">
            <Search className="w-8 h-8" style={{ color: 'var(--erp-text-4)' }} />
            <p>{search ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات'}</p>
          </div>
        ) : (
          <div
            className={`grid gap-2 ${
              cm
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            }`}
          >
            {filtered.map((p) => {
              const qty = Number(p.quantity);
              const outOfStock = qty <= 0;
              const isJustAdded = recentlyAdded === p.id;
              const inCart = cart.find((i) => i.product_id === p.id);

              let cardStyle: React.CSSProperties = {
                background: 'var(--erp-bg-card)',
                border: `1px solid var(--erp-border)`,
                borderRadius: '0.875rem',
                transition: 'all 0.15s ease',
              };
              if (outOfStock) {
                cardStyle = { ...cardStyle, opacity: 0.4, cursor: 'not-allowed' };
              } else if (isJustAdded) {
                cardStyle = {
                  ...cardStyle,
                  border: '1px solid rgba(245,158,11,0.7)',
                  background: 'rgba(245,158,11,0.08)',
                  transform: 'scale(0.97)',
                };
              } else if (inCart) {
                cardStyle = {
                  ...cardStyle,
                  border: '1px solid rgba(16,185,129,0.4)',
                  background: 'rgba(16,185,129,0.06)',
                };
              }

              return (
                <button
                  key={p.id}
                  onClick={() => !outOfStock && addToCart(p)}
                  disabled={outOfStock}
                  className="relative flex flex-col text-right p-3 active:scale-[0.97]"
                  style={cardStyle}
                >
                  {inCart && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">
                      {inCart.quantity}
                    </div>
                  )}
                  <p
                    className="erp-text font-bold leading-snug line-clamp-2 mb-2 flex-1"
                    style={{ fontSize: cm ? '0.9375rem' : '0.8125rem' }}
                  >
                    {p.name}
                  </p>
                  <div className="flex items-end justify-between gap-1 mt-auto">
                    <p
                      className="text-amber-500 font-black"
                      style={{ fontSize: cm ? '1.125rem' : '0.9375rem' }}
                    >
                      {formatCurrency(p.sale_price)}
                    </p>
                    <span className={`${stockClass(qty)} text-[10px]`}>
                      {qty > 0 ? qty : 'نفد'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
