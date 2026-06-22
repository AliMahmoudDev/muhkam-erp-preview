import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
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
}

function stockBadgeVariant(qty: number): 'unpaid' | 'partial' | 'neutral' {
  if (qty <= 0) return 'unpaid';
  if (qty <= 5) return 'partial';
  return 'neutral';
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
}: PosProductGridProps) {
  const cm = cashierMode;

  return (
    <div className="flex flex-col flex-1 min-w-0 border-s border-[var(--line)]">
      {/* Search bar */}
      <div className="px-3 py-2.5 bg-[var(--surface)] border-b border-[var(--line)] shrink-0">
        <SearchInput
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => {
            setSearch('');
            searchRef.current?.focus();
          }}
          placeholder="بحث عن صنف... (F2)"
          style={{ fontSize: cm ? '1rem' : '0.875rem' }}
        />
      </div>

      {/* Result count hint */}
      {search && (
        <div className="px-3 py-1 bg-[var(--surface)] border-b border-[var(--line)] shrink-0">
          <span className="text-[11px] opacity-50">{filtered.length} نتيجة</span>
        </div>
      )}

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            {search ? (
              <EmptyState
                variant="no-results"
                query={search}
                action={
                  <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                    مسح البحث
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="no-data"
                title="لا توجد منتجات"
                description="لم يتم إضافة أي منتجات لهذا الفرع بعد"
              />
            )}
          </div>
        ) : (
          <div
            className={cn(
              'grid gap-2',
              cm
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            )}
          >
            {filtered.map((p) => {
              const qty = Number(p.quantity);
              const outOfStock = qty <= 0;
              const isJustAdded = recentlyAdded === p.id;
              const inCart = cart.find((i) => i.product_id === p.id);

              return (
                <button
                  key={p.id}
                  onClick={() => !outOfStock && addToCart(p)}
                  disabled={outOfStock}
                  className={cn(
                    'relative flex flex-col text-right p-3 rounded-[0.875rem] transition-all active:scale-[0.97]',
                    'bg-[var(--surface)] border border-[var(--line)]',
                    outOfStock && 'opacity-40 cursor-not-allowed',
                    isJustAdded && 'border-amber-500/70 bg-amber-500/10 scale-[0.97]',
                    !outOfStock && !isJustAdded && inCart && 'border-emerald-500/40 bg-emerald-500/10'
                  )}
                >
                  {inCart && (
                    <div className="absolute top-2 start-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-black">
                      {inCart.quantity}
                    </div>
                  )}
                  <p
                    className="font-bold leading-snug line-clamp-2 mb-2 flex-1"
                    style={{ fontSize: cm ? '0.9375rem' : '0.8125rem' }}
                  >
                    {p.name}
                  </p>
                  <div className="flex items-end justify-between gap-1 mt-auto">
                    <p
                      className="text-[var(--brand)] font-black"
                      style={{ fontSize: cm ? '1.125rem' : '0.9375rem' }}
                    >
                      {formatCurrency(p.sale_price)}
                    </p>
                    <Badge variant={stockBadgeVariant(qty)} className="text-[10px]">
                      {qty > 0 ? qty : 'نفد'}
                    </Badge>
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
