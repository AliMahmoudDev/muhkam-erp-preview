import { useState } from "react";
import { Tags, Edit2, Trash2, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { buildPrintHtml } from "./helpers";
import type { PriceList, PriceListDetail, Product } from "./types";

/* ──────────────────────────────── List Card ─────────────────────────────── */

export function PriceListCard({
  list,
  products: _products,
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
    const raw = await r.json().catch(() => null);
    const d: PriceListDetail = {
      ...(raw ?? {}),
      id: raw?.id ?? list.id,
      name: raw?.name ?? list.name,
      description: raw?.description ?? list.description,
      is_active: raw?.is_active ?? list.is_active,
      created_at: raw?.created_at ?? list.created_at,
      items: Array.isArray(raw?.items) ? raw.items : [],
    };
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
      const html = buildPrintHtml(d);
      const _plBlob = new Blob([html], { type: 'text/html' });
      const _plUrl = URL.createObjectURL(_plBlob);
      window.open(_plUrl, '_blank', 'width=900,height=700');
      setTimeout(() => URL.revokeObjectURL(_plUrl), 2000);
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
        className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-surface transition"
        onClick={handleExpand}
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <Tags className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-ink text-sm truncate">{list.name}</p>
            {!list.is_active && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-ink/30 border border-line">معطّل</span>
            )}
          </div>
          {list.description && <p className="text-xs text-ink/40 truncate mt-0.5">{list.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            disabled={printing}
            title="طباعة قائمة الأسعار"
            className="p-2 rounded-lg text-ink/30 hover:text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg text-ink/30 hover:text-amber-400 hover:bg-amber-500/10 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg text-ink/30 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded
            ? <ChevronDown className="w-4 h-4 text-ink/30" />
            : <ChevronRight className="w-4 h-4 text-ink/30" />
          }
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-line px-4 pb-4">
          {loadingDetail ? (
            <div className="py-4 text-center text-ink/30 text-sm">جاري التحميل...</div>
          ) : !detail || detail.items.length === 0 ? (
            <div className="py-4 text-center text-ink/30 text-sm">لا توجد منتجات في هذه القائمة</div>
          ) : (
            <div className="mt-3 space-y-1.5">
              <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] font-semibold uppercase text-ink/30">
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
                  <div key={item.id} className="grid grid-cols-3 px-3 py-2 rounded-xl bg-surface text-sm items-center">
                    <span className="text-ink/80 truncate">{item.product_name}</span>
                    <span className="text-center text-ink/50">{formatCurrency(item.cost_price)}</span>
                    <div className="text-left">
                      {markup != null ? (
                        <span className="text-amber-400 font-bold">{markup}%
                          {previewPrice != null && (
                            <span className="text-ink/30 font-normal text-xs mr-1">← {formatCurrency(previewPrice)}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink/25 text-xs">يرث من العميل</span>
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
