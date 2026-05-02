import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tags, Plus, Edit2, Trash2, ChevronDown, ChevronRight, X, Check, Search, AlertCircle, Printer } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

/* ──────────────────────────────── Types ────────────────────────────────── */

interface PriceList {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface PriceListItem {
  id: number;
  price_list_id: number;
  product_id: number;
  markup_percent: number | null;
  product_name: string;
  cost_price: number;
  sale_price: number;
  sku: string | null;
}

interface PriceListDetail extends PriceList {
  items: PriceListItem[];
}

interface Product {
  id: number;
  name: string;
  cost_price: number;
  sale_price: number;
  sku: string | null;
  category_name?: string | null;
}

/* ──────────────────────────────── Helpers ──────────────────────────────── */

function safeNum(v: number | string | null | undefined) {
  return typeof v === "string" ? parseFloat(v) : (v ?? 0);
}

/* ──────────────────────────────── Product Picker Modal ─────────────────── */

function ProductPickerModal({
  products,
  selectedIds,
  onConfirm,
  onClose,
}: {
  products: Product[];
  selectedIds: Set<number>;
  onConfirm: (ids: Set<number>) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set(selectedIds));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
  }, [products, search]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: "var(--erp-bg-card)", border: "1px solid var(--erp-border-md)", maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <p className="font-bold text-white">اختر المنتجات</p>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white transition"><X className="w-4 h-4" /></button>
        </div>
        {/* Search */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الباركود..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white outline-none"
              autoFocus
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.map(p => {
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? "bg-amber-500/15 border border-amber-500/30" : "border border-transparent hover:bg-white/5"
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-amber-500 border-amber-500" : "border-white/20"
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{p.name}</p>
                  <p className="text-xs text-white/40">تكلفة: {formatCurrency(safeNum(p.cost_price))}</p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-white/30 text-sm">لا توجد منتجات</div>
          )}
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex justify-between items-center">
          <span className="text-white/50 text-sm">{selected.size} منتج محدد</span>
          <button
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
          >
            تأكيد الاختيار
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────── List Form Modal ──────────────────────── */

function PriceListFormModal({
  initial,
  products,
  onSave,
  onClose,
}: {
  initial?: PriceListDetail;
  products: Product[];
  onSave: (data: { name: string; description: string; is_active: boolean; items: { product_id: number; markup_percent: number | null }[] }) => void;
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Tags className="w-4 h-4 text-amber-400" />
              </div>
              <p className="font-bold text-white">{initial ? "تعديل قائمة الأسعار" : "إنشاء قائمة أسعار جديدة"}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-white/50 font-semibold mb-1.5 uppercase tracking-wide">اسم القائمة *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: أسعار تجار الجملة"
                className="w-full glass-input rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-white/50 font-semibold mb-1.5 uppercase tracking-wide">الوصف (اختياري)</label>
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
                className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${isActive ? "bg-amber-500" : "bg-white/15"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${isActive ? "right-1" : "left-1"}`} />
              </button>
              <span className="text-sm text-white/70">القائمة {isActive ? "مفعّلة" : "معطّلة"}</span>
            </div>

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50 font-semibold uppercase tracking-wide">المنتجات ({items.length})</label>
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {items.length > 0 ? "تعديل المنتجات" : "إضافة منتجات"}
                </button>
              </div>

              {items.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-xl py-8 text-center text-white/30 text-sm">
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
                      <div key={item.product_id} className="flex items-center gap-2 bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{prod.name}</p>
                          <p className="text-xs text-white/30">
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
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-right"
                          />
                          <span className="text-white/30 text-xs">%</span>
                        </div>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition"
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
          <div className="px-5 py-4 border-t border-white/8 flex justify-between items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition">
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

/* ──────────────────────────────── List Card ─────────────────────────────── */

function PriceListCard({
  list,
  products,
  onEdit,
  onDelete,
}: {
  list: PriceList;
  products: Product[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<PriceListDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printing, setPrinting] = useState(false);

  const fetchDetail = async (): Promise<PriceListDetail> => {
    if (detail) return detail;
    const r = await authFetch(api(`/api/price-lists/${list.id}`));
    const d: PriceListDetail = await r.json();
    setDetail(d);
    return d;
  };

  const handleExpand = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try { setDetail(await fetchDetail()); }
      finally { setLoadingDetail(false); }
    }
    setExpanded(v => !v);
  };

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPrinting(true);
    try {
      const d = await fetchDetail();
      const dateStr = new Date().toLocaleDateString("ar-EG", {
        year: "numeric", month: "long", day: "numeric",
      });
      const rows = d.items.map(item => {
        const markup = item.markup_percent;
        const clientPrice = markup != null && item.cost_price > 0
          ? (item.cost_price * (1 + markup / 100)).toFixed(2)
          : item.sale_price.toFixed(2);
        return `
          <tr>
            <td>${item.product_name}</td>
            <td>${markup != null ? markup + "%" : "—"}</td>
            <td class="price">${Number(clientPrice).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م</td>
          </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<title>${d.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; color: #111; background: #fff; padding: 32px; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
  .header .meta { font-size: 13px; color: #555; display: flex; justify-content: center; gap: 24px; margin-top: 8px; }
  .header .meta span strong { color: #222; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: #1a1a2e; color: #fff; padding: 10px 14px; text-align: right; font-weight: 700; }
  tbody tr:nth-child(even) { background: #f5f5f5; }
  tbody td { padding: 9px 14px; border-bottom: 1px solid #e0e0e0; }
  td.price { font-weight: 700; color: #1a1a2e; }
  .footer { margin-top: 28px; border-top: 1px dashed #ccc; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .note { font-size: 11px; color: #888; max-width: 60%; line-height: 1.6; }
  .note strong { color: #c00; display: block; margin-bottom: 4px; font-size: 12px; }
  .stamp { font-size: 11px; color: #555; text-align: left; }
  @media print {
    body { padding: 16px; }
    @page { margin: 1cm; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>${d.name}</h1>
  ${d.description ? `<p style="font-size:13px;color:#666;margin-top:4px">${d.description}</p>` : ""}
  <div class="meta">
    <span>تاريخ الإصدار: <strong>${dateStr}</strong></span>
    <span>عدد المنتجات: <strong>${d.items.length} منتج</strong></span>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>المنتج</th>
      <th>نسبة الهامش</th>
      <th>سعر العميل</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">
  <div class="note">
    <strong>⚠ تنبيه هام</strong>
    هذه الأسعار قابلة للتغيير في أي وقت دون إشعار مسبق.<br/>
    يُرجى التواصل معنا للتأكد من الأسعار الحالية قبل إتمام أي طلب.
  </div>
  <div class="stamp">
    طُبع بتاريخ: ${dateStr}
  </div>
</div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;

      const win = window.open("", "_blank", "width=900,height=700");
      if (win) { win.document.write(html); win.document.close(); }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--erp-bg-card)", border: "1px solid var(--erp-border-md)" }}
    >
      {/* Row */}
      <div
        className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-white/3 transition"
        onClick={handleExpand}
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <Tags className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white text-sm truncate">{list.name}</p>
            {!list.is_active && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">معطّل</span>
            )}
          </div>
          {list.description && <p className="text-xs text-white/40 truncate mt-0.5">{list.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            disabled={printing}
            title="طباعة قائمة الأسعار"
            className="p-2 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded
            ? <ChevronDown className="w-4 h-4 text-white/30" />
            : <ChevronRight className="w-4 h-4 text-white/30" />
          }
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4">
          {loadingDetail ? (
            <div className="py-4 text-center text-white/30 text-sm">جاري التحميل...</div>
          ) : !detail || detail.items.length === 0 ? (
            <div className="py-4 text-center text-white/30 text-sm">لا توجد منتجات في هذه القائمة</div>
          ) : (
            <div className="mt-3 space-y-1.5">
              <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] font-semibold uppercase text-white/30">
                <span>المنتج</span>
                <span className="text-center">سعر التكلفة</span>
                <span className="text-left">هامش الربح</span>
              </div>
              {detail.items.map(item => {
                const markup = item.markup_percent;
                const previewPrice = markup != null && item.cost_price > 0
                  ? item.cost_price * (1 + markup / 100)
                  : null;
                return (
                  <div key={item.id} className="grid grid-cols-3 px-3 py-2 rounded-xl bg-white/2 text-sm items-center">
                    <span className="text-white/80 truncate">{item.product_name}</span>
                    <span className="text-center text-white/50">{formatCurrency(item.cost_price)}</span>
                    <div className="text-left">
                      {markup != null ? (
                        <span className="text-amber-400 font-bold">{markup}%
                          {previewPrice != null && (
                            <span className="text-white/30 font-normal text-xs mr-1">← {formatCurrency(previewPrice)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-white/25 text-xs">يرث من العميل</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────── Main Page ─────────────────────────────── */

export default function PriceLists() {
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingList, setEditingList] = useState<PriceListDetail | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: lists = [], isLoading: loadingLists } = useQuery<PriceList[]>({
    queryKey: ["/api/price-lists"],
    queryFn: () => authFetch(api("/api/price-lists")).then(r => r.json()),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: () => authFetch(api("/api/products")).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; is_active: boolean; items: { product_id: number; markup_percent: number | null }[] }) =>
      authFetch(api("/api/price-lists"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/price-lists"] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description: string; is_active: boolean; items: { product_id: number; markup_percent: number | null }[] } }) =>
      authFetch(api(`/api/price-lists/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/price-lists"] }); setEditingList(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/price-lists/${id}`), { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/price-lists"] }); setDeletingId(null); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleEdit = async (id: number) => {
    const r = await authFetch(api(`/api/price-lists/${id}`));
    const detail: PriceListDetail = await r.json();
    setEditingList(detail);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Tags className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-black text-white">قوائم الأسعار</h1>
            <p className="text-xs text-white/40">قوائم مخصصة لتسعير المنتجات للعملاء</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
        >
          <Plus className="w-4 h-4" />
          قائمة جديدة
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingLists ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl animate-pulse bg-white/5 border border-white/5" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Tags className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 font-semibold">لا توجد قوائم أسعار بعد</p>
            <p className="text-white/25 text-sm mt-1">أنشئ قائمة أسعار وخصصها للعملاء</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition"
            >
              <Plus className="w-4 h-4" />
              إنشاء أول قائمة
            </button>
          </div>
        ) : (
          lists.map(list => (
            <PriceListCard
              key={list.id}
              list={list}
              products={products}
              onEdit={() => handleEdit(list.id)}
              onDelete={() => { setDeletingId(list.id); setDeleteError(null); }}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <PriceListFormModal
          products={products}
          onSave={data => createMutation.mutate(data)}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit Modal */}
      {editingList && (
        <PriceListFormModal
          initial={editingList}
          products={products}
          onSave={data => updateMutation.mutate({ id: editingList.id, data })}
          onClose={() => setEditingList(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.7)" }}
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--erp-bg-card)", border: "1px solid var(--erp-border-md)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-bold text-white">حذف قائمة الأسعار</p>
                <p className="text-white/50 text-sm">سيتم إلغاء ربطها من جميع العملاء</p>
              </div>
            </div>
            {deleteError && (
              <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-xl">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
