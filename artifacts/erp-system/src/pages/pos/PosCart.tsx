import { ShoppingCart, Plus, Minus, Trash2, X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { CartItem } from './PosReceipt';

interface Props {
  cart: CartItem[];
  canEditPrice: boolean;
  editingPriceId: number | null;
  editingPriceVal: string;
  setEditingPriceId: (id: number | null) => void;
  setEditingPriceVal: (v: string) => void;
  commitPrice: (pid: number, val: string) => void;
  updateQty: (pid: number, delta: number) => void;
  removeItem: (pid: number) => void;
  clearCart: () => void;
}

export function PosCart({
  cart,
  canEditPrice,
  editingPriceId,
  editingPriceVal,
  setEditingPriceId,
  setEditingPriceVal,
  commitPrice,
  updateQty,
  removeItem,
  clearCart,
}: Props) {
  return (
    <>
      {/* Cart header */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[var(--brand)]" />
          <span className="font-bold text-sm">السلة</span>
          {cart.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-black text-[11px] font-black flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40"
          >
            <Trash2 className="w-3 h-3" /> مسح السلة
          </button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
            <ShoppingCart className="w-10 h-10" />
            <p className="text-sm">السلة فارغة</p>
            <p className="text-xs opacity-70">اضغط Enter لإضافة أول صنف</p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="bg-[var(--surface)] border border-[var(--line)] rounded-xl flex items-center gap-2 px-3 py-2.5"
              >
                {/* Name + Price */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-snug line-clamp-1">
                    {item.product_name}
                  </p>
                  {canEditPrice && editingPriceId === item.product_id ? (
                    <input
                      autoFocus
                      type="number"
                      step="0.01"
                      value={editingPriceVal}
                      onChange={(e) => setEditingPriceVal(e.target.value)}
                      onBlur={() => commitPrice(item.product_id, editingPriceVal)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitPrice(item.product_id, editingPriceVal);
                        if (e.key === 'Escape') setEditingPriceId(null);
                      }}
                      className="erp-input text-xs mt-0.5 py-0.5 px-1.5 border-amber-500/50"
                    />
                  ) : (
                    <p
                      className={`text-[var(--brand)] text-xs mt-0.5 ${canEditPrice ? 'cursor-pointer hover:underline' : ''}`}
                      onClick={() => {
                        if (!canEditPrice) return;
                        setEditingPriceId(item.product_id);
                        setEditingPriceVal(String(item.unit_price));
                      }}
                    >
                      {formatCurrency(item.unit_price)}
                      {canEditPrice && <span className="opacity-50 text-[10px] ms-1">✏</span>}
                    </p>
                  )}
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => updateQty(item.product_id, -1)}
                    className="w-7 h-7 p-0 rounded-lg bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="tabular-nums font-bold w-7 text-center text-sm">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.product_id, 1)}
                    className="w-7 h-7 p-0 rounded-lg bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] flex items-center justify-center"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Line total */}
                <p className="tabular-nums font-bold text-sm w-16 text-start shrink-0">
                  {formatCurrency(item.total_price)}
                </p>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.product_id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 text-red-400 hover:bg-red-500/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
