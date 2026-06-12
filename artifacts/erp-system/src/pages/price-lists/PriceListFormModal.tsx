import { useState, useMemo } from "react";
import { Tags, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { safeNum } from "./helpers";
import { ProductPickerModal } from "./ProductPickerModal";
import type { PriceListDetail, Product, PriceListFormData } from "./types";

/* ──────────────────────────────── List Form Modal ──────────────────────── */

export function PriceListFormModal({
  initial,
  products,
  onSave,
  onClose,
}: {
  initial?: PriceListDetail;
  products: Product[];
  onSave: (data: PriceListFormData) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [items, setItems] = useState<{ product_id: number; markup_percent: string }[]>(
    initial?.items.map(i => ({ product_id: i.product_id, markup_percent: i.markup_percent != null ? String(i.markup_percent) : "" })) ?? []
  );
  const [showPicker, setShowPicker] = useState(false);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const selectedIds = useMemo(() => new Set(items.map(i => i.product_id)), [items]);

  const handleProductsConfirm = (ids: Set<number>) => {
    setShowPicker(false);
    setItems(prev => {
      const existingMap = new Map(prev.map(i => [i.product_id, i]));
      const newItems: { product_id: number; markup_percent: string }[] = [];
      ids.forEach(id => {
        newItems.push(existingMap.get(id) ?? { product_id: id, markup_percent: "" });
      });
      return newItems;
    });
  };

  const updateMarkup = (productId: number, value: string) => {
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, markup_percent: value } : i));
  };

  const removeItem = (productId: number) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      is_active: isActive,
      items: items.map(i => ({
        product_id: i.product_id,
        markup_percent: i.markup_percent !== "" ? parseFloat(i.markup_percent) : null,
      })),
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl rounded-2xl flex flex-col"
          style={{ background: "var(--erp-bg-card)", border: "1px solid var(--erp-border-md)", maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Tags className="w-4 h-4 text-amber-400" />
              </div>
              <p className="font-bold text-ink">{initial ? "تعديل قائمة الأسعار" : "إنشاء قائمة أسعار جديدة"}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-ink/40 hover:text-ink"><X className="w-4 h-4" /></button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-ink/50 font-semibold mb-1.5 uppercase tracking-wide">اسم القائمة *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: أسعار تجار الجملة"
                className="w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-ink/50 font-semibold mb-1.5 uppercase tracking-wide">الوصف (اختياري)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="وصف مختصر للقائمة..."
                className="w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {/* Active */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsActive(v => !v)}
                className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${isActive ? "bg-amber-500" : "bg-raised"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${isActive ? "right-1" : "left-1"}`} />
              </button>
              <span className="text-sm text-ink/70">القائمة {isActive ? "مفعّلة" : "معطّلة"}</span>
            </div>

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-ink/50 font-semibold uppercase tracking-wide">المنتجات ({items.length})</label>
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {items.length > 0 ? "تعديل المنتجات" : "إضافة منتجات"}
                </button>
              </div>

              {items.length === 0 ? (
                <div className="border border-dashed border-line rounded-xl py-8 text-center text-ink/30 text-sm">
                  لم يتم إضافة منتجات بعد
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {items.map(item => {
                    const prod = productMap.get(item.product_id);
                    if (!prod) return null;
                    const cost = safeNum(prod.cost_price);
                    const markup = parseFloat(item.markup_percent);
                    const previewPrice = !isNaN(markup) && cost > 0
                      ? cost * (1 + markup / 100)
                      : null;

                    return (
                      <div key={item.product_id} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5 border border-line">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink truncate">{prod.name}</p>
                          <p className="text-xs text-ink/30">
                            تكلفة: {formatCurrency(cost)}
                            {previewPrice != null && (
                              <span className="text-amber-400/70 mr-2">← سعر البيع: {formatCurrency(previewPrice)}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.markup_percent}
                            onChange={e => updateMarkup(item.product_id, e.target.value)}
                            placeholder="هامش%"
                            className="w-20 bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-ink outline-none text-right"
                          />
                          <span className="text-ink/30 text-xs">%</span>
                        </div>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="p-1.5 rounded-lg text-ink/20 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-line flex justify-between items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-line text-ink/50 hover:text-ink text-sm transition">
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-5 py-2 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {initial ? "حفظ التعديلات" : "إنشاء القائمة"}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <div style={{ zIndex: 60, position: "fixed", inset: 0 }}>
          <ProductPickerModal
            products={products}
            selectedIds={selectedIds}
            onConfirm={handleProductsConfirm}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </>
  );
}
