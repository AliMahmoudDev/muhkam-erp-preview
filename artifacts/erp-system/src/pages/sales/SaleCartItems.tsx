/**
 * SaleCartItems.tsx
 * Right-panel: cart header (count, hold/resume/clear controls,
 * held-invoice list, warehouse/salesperson info) + the scrollable
 * cart items list with inline quantity / price / discount editing.
 */
import {
  ShoppingCart, RotateCcw, PauseCircle, PlayCircle, Vault,
  Lock, Plus, Minus, Trash2, Tag,
} from 'lucide-react';
import { CartItem, HeldInvoice } from './salesTypes';
import { Combobox } from '@/components/ui/combobox';

interface SaleProduct {
  id: number;
  sale_price: number;
}

interface SaleWarehouse {
  id: number;
  name: string;
}

interface SaleCartItemsProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  products: SaleProduct[];
  heldInvoices: HeldInvoice[];
  showHeld: boolean;
  setShowHeld: React.Dispatch<React.SetStateAction<boolean>>;
  canEditPrice: boolean;
  editingPrice: { pid: number; val: string } | null;
  setEditingPrice: React.Dispatch<React.SetStateAction<{ pid: number; val: string } | null>>;
  editingDisc: { pid: number; val: string; mode: 'pct' | 'amt' } | null;
  setEditingDisc: React.Dispatch<
    React.SetStateAction<{ pid: number; val: string; mode: 'pct' | 'amt' } | null>
  >;
  cartSubtotal: number;
  isRestricted: boolean;
  warehouseId: string;
  setWarehouseId: React.Dispatch<React.SetStateAction<string>>;
  warehouses: SaleWarehouse[];
  effectiveWarehouseName: string;
  salespersonName: string;
  updateQty: (pid: number, delta: number) => void;
  updatePrice: (pid: number, rawVal: string) => void;
  updateItemDisc: (pid: number, val: string, mode: 'pct' | 'amt') => void;
  onClear: () => void;
  onHold: () => void;
  onResume: (id: string) => void;
  onDeleteHold: (id: string) => void;
}

export function SaleCartItems({
  cart,
  setCart,
  products,
  heldInvoices,
  showHeld,
  setShowHeld,
  canEditPrice,
  editingPrice,
  setEditingPrice,
  editingDisc,
  setEditingDisc,
  cartSubtotal,
  isRestricted,
  warehouseId,
  setWarehouseId,
  warehouses,
  effectiveWarehouseName,
  salespersonName,
  updateQty,
  updatePrice,
  updateItemDisc,
  onClear,
  onHold,
  onResume,
  onDeleteHold,
}: SaleCartItemsProps) {
  return (
    <>
      {/* ─── رأس اللوحة ─── */}
      <div className="sale-cart-header px-4 pt-3 pb-2.5 border-b sale-border shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-full ${cart.length > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'sale-badge-empty'}`}
            >
              {cart.length} صنف
            </span>
            {cart.length > 0 && (
              <button
                onClick={onClear}
                title="تفريغ الفاتورة"
                className="text-[11px] sale-muted-text hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> تفريغ
              </button>
            )}
            {cart.length > 0 && (
              <button
                onClick={onHold}
                title="إيداع الفاتورة"
                className="text-[11px] sale-muted-text hover:text-blue-400 transition-colors flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3" /> إيداع
              </button>
            )}
            {heldInvoices.length > 0 && (
              <button
                onClick={() => setShowHeld((v) => !v)}
                title="الفواتير المودعة"
                className="text-[11px] relative flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <PlayCircle className="w-3 h-3" />
                <span className="bg-blue-500/25 px-1.5 py-0.5 rounded-full font-black">
                  {heldInvoices.length}
                </span>
              </button>
            )}
          </div>
          <h3 className="font-black sale-text-primary flex items-center gap-2 text-sm">
            <ShoppingCart className="w-4 h-4 text-amber-400" /> فاتورة مبيعات
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {isRestricted ? (
            <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
              <Vault className="w-3.5 h-3.5 sale-muted-text shrink-0" />
              <span className="sale-label-text text-xs shrink-0">الفرع</span>
              <span className="text-emerald-400 text-xs font-bold truncate">
                {effectiveWarehouseName}
              </span>
            </div>
          ) : (
            <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
              <Vault className="w-3.5 h-3.5 sale-muted-text shrink-0" />
              <span className="sale-label-text text-xs shrink-0">المخزن</span>
              <Combobox
                options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                value={warehouseId}
                onChange={(v) => setWarehouseId(v)}
                className="w-full text-xs sale-text-primary"
              />
            </div>
          )}
          <div className="sale-field-row border !border-amber-500/22 flex items-center gap-2 rounded-xl px-3 py-2">
            <Lock className="w-3.5 h-3.5 text-amber-400/55 shrink-0" />
            <span className="sale-label-text text-xs shrink-0">المندوب</span>
            <span className="text-amber-400 text-xs font-bold truncate">{salespersonName}</span>
          </div>
        </div>
      </div>

      {/* ─── أصناف الفاتورة ─── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
            <div className="sale-empty-icon-bg w-16 h-16 rounded-2xl flex items-center justify-center">
              <ShoppingCart className="w-7 h-7 sale-muted-text opacity-40" />
            </div>
            <p className="text-sm sale-muted-text font-bold opacity-50">
              اضغط على أي منتج للإضافة
            </p>
          </div>
        ) : (
          <>
            {showHeld && heldInvoices.length > 0 && (
              <div className="mx-2 mb-1 rounded-xl overflow-hidden border border-blue-500/20 bg-blue-500/5 shrink-0">
                {heldInvoices.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-blue-500/10 last:border-0 hover:bg-blue-500/10 transition-colors"
                  >
                    <button
                      onClick={() => onResume(h.id)}
                      className="flex-1 flex items-center gap-2 text-right"
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold sale-text-primary truncate">{h.label}</p>
                        <p className="text-[10px] sale-muted-text">
                          {h.cart.length} صنف ·{' '}
                          {new Date(h.ts).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => onDeleteHold(h.id)}
                      className="w-5 h-5 flex items-center justify-center text-red-400/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="sale-invoice-header flex items-center gap-1 px-3 py-1.5 shrink-0">
              <span className="sale-muted-text text-[10px] font-bold flex-1">المنتج</span>
              <span className="sale-muted-text text-[10px] font-bold w-[66px] text-center">
                الكمية
              </span>
              <span className="sale-muted-text text-[10px] font-bold w-[46px] text-center">
                سعر
              </span>
              <span className="sale-muted-text text-[10px] font-bold w-[44px] text-center flex items-center justify-center gap-0.5">
                <Tag className="w-2.5 h-2.5" />
                خصم
              </span>
              <span className="sale-muted-text text-[10px] font-bold w-[60px] text-center">
                الإجمالي
              </span>
              <span className="w-5 shrink-0" />
            </div>

            <div className="flex-1 overflow-y-auto cart-items-area px-2 py-1 space-y-0.5">
              {cart.map((item, index) => {
                const origPrice =
                  products.find((p) => p.id === item.product_id)?.sale_price ?? item.unit_price;
                const priceChanged = Math.abs(item.unit_price - Number(origPrice)) > 0.001;
                const shortNum = (n: number) =>
                  n >= 1000
                    ? n.toLocaleString('en', { maximumFractionDigits: 0 })
                    : n.toFixed(n % 1 === 0 ? 0 : 1);
                return (
                  <div
                    key={item.product_id}
                    className="pos-cart-item flex items-center gap-1 px-2 py-2.5 rounded-xl"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="sale-row-num">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="sale-text-primary text-xs font-bold truncate leading-tight">
                          {item.product_name}
                        </p>
                        {priceChanged && (
                          <span className="text-amber-400 text-[9px] font-bold leading-none">
                            ⚠ معدّل
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-[66px] flex items-center justify-center gap-0.5 shrink-0">
                      <button
                        onClick={() => updateQty(item.product_id, -1)}
                        className="pos-qty-btn w-6 h-6 rounded-lg flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="sale-text-primary font-black text-xs w-[18px] text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.product_id, 1)}
                        className="pos-qty-btn pos-qty-btn-add w-6 h-6 rounded-lg flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="w-[46px] shrink-0 flex items-center justify-center">
                      {canEditPrice ? (
                        editingPrice?.pid === item.product_id ? (
                          <input
                            type="number"
                            step="0.01"
                            autoFocus
                            className="sale-price-input w-full rounded-md px-1 py-0.5 text-[10px] outline-none tabular-nums text-center"
                            value={editingPrice.val}
                            onChange={(e) =>
                              setEditingPrice((p) => (p ? { ...p, val: e.target.value } : null))
                            }
                            onBlur={() => {
                              updatePrice(item.product_id, editingPrice.val);
                              setEditingPrice(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updatePrice(item.product_id, editingPrice.val);
                                setEditingPrice(null);
                              }
                              if (e.key === 'Escape') setEditingPrice(null);
                            }}
                          />
                        ) : (
                          <button
                            onClick={() =>
                              setEditingPrice({
                                pid: item.product_id,
                                val: String(item.unit_price),
                              })
                            }
                            className={`text-[10px] tabular-nums transition-colors hover:text-amber-400 text-center truncate w-full ${priceChanged ? 'text-amber-400' : 'sale-muted-text'}`}
                            title="اضغط لتعديل السعر"
                          >
                            {shortNum(item.unit_price)}
                          </button>
                        )
                      ) : (
                        <span
                          className={`text-[10px] tabular-nums text-center ${priceChanged ? 'text-amber-400' : 'sale-muted-text'}`}
                        >
                          {shortNum(item.unit_price)}
                        </span>
                      )}
                    </div>

                    <div className="w-[44px] shrink-0 flex items-center justify-center">
                      {editingDisc?.pid === item.product_id ? (
                        <div className="flex items-center gap-0.5 w-full">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            autoFocus
                            className="sale-price-input flex-1 min-w-0 rounded-md px-0.5 py-0.5 text-[10px] outline-none tabular-nums text-center"
                            value={editingDisc.val}
                            onChange={(e) =>
                              setEditingDisc((d) => (d ? { ...d, val: e.target.value } : null))
                            }
                            onBlur={() => {
                              updateItemDisc(item.product_id, editingDisc.val, editingDisc.mode);
                              setEditingDisc(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateItemDisc(
                                  item.product_id,
                                  editingDisc.val,
                                  editingDisc.mode
                                );
                                setEditingDisc(null);
                              }
                              if (e.key === 'Escape') setEditingDisc(null);
                            }}
                          />
                          <button
                            className="text-[9px] text-amber-400 font-black shrink-0 hover:opacity-70"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEditingDisc((d) =>
                                d ? { ...d, mode: d.mode === 'pct' ? 'amt' : 'pct' } : null
                              );
                            }}
                          >
                            {editingDisc.mode === 'pct' ? '%' : 'ج'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setEditingDisc({
                              pid: item.product_id,
                              val: String(item.item_disc ?? ''),
                              mode: item.item_disc_mode ?? 'pct',
                            })
                          }
                          className={`text-[10px] tabular-nums text-center w-full transition-colors hover:text-rose-400 ${item.item_disc ? 'text-rose-400 font-bold' : 'sale-muted-text opacity-40 hover:opacity-100'}`}
                          title="اضغط لإضافة خصم على الصنف"
                        >
                          {item.item_disc
                            ? `${shortNum(item.item_disc)}${item.item_disc_mode === 'pct' ? '%' : 'ج'}`
                            : '—'}
                        </button>
                      )}
                    </div>

                    <span className="w-[60px] shrink-0 text-center font-black text-emerald-400 text-xs tabular-nums">
                      {shortNum(item.total_price)}
                    </span>

                    <button
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((i) => i.product_id !== item.product_id)
                        )
                      }
                      className="pos-del-btn w-6 h-6 shrink-0 flex items-center justify-center"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {cart.length > 1 && (
              <div className="sale-invoice-subtotal border-t sale-border flex items-center justify-between px-3 py-1.5 shrink-0">
                <span className="sale-muted-text text-[10px] tabular-nums">
                  {cart.reduce((s, i) => s + i.quantity, 0)} وحدة
                </span>
                <span className="sale-muted-text text-[10px] font-bold tabular-nums">
                  مجموع: {cartSubtotal.toLocaleString('en', { maximumFractionDigits: 0 })} ج.م
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
