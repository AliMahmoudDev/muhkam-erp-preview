import { api } from '@/lib/api';
/**
 * صفحة المرتجعات — سجل كامل + تقارير تفصيلية
 */
import { useState, useMemo, useEffect } from 'react';
import { useSearch } from 'wouter';
import { openPrintWindow } from '@/lib/print-utils';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { formatCurrency } from '@/lib/format';
import {
  RotateCcw, TrendingDown, ArrowUpFromLine,
  ArrowDownToLine, Eye, Printer, X, Search,
  Calendar, ExternalLink, FileText, ChevronDown, ChevronUp,
  Package,
} from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';


/* ── Types ─────────────────────────────────────────────────────────── */
interface SaleReturn {
  id: number; return_no: string; sale_id: number | null; sale_no: string | null;
  customer_id: number | null; customer_name: string | null;
  total_amount: number; reason: string | null; refund_type: string | null;
  notes: string | null; date: string | null; created_at: string;
  items?: ReturnItem[];
}
interface PurchaseReturn {
  id: number; return_no: string; purchase_id: number | null; invoice_no: string | null;
  customer_id: number | null; customer_name: string | null; supplier_name?: string | null;
  total_amount: number; reason: string | null; refund_type: string | null;
  notes: string | null; date: string | null; created_at: string;
  items?: ReturnItem[];
}
interface ReturnItem {
  id: number; product_name: string; quantity: number;
  unit_price: number; total_price: number;
}

type Tab = 'sales' | 'purchases';
type SortKey = 'date' | 'amount' | 'party';
type SortDir = 'asc' | 'desc';

const REFUND_LABELS: Record<string, string> = {
  cash: 'نقدي', credit: 'ذمة', exchange: 'استبدال',
};
const REFUND_COLORS: Record<string, string> = {
  cash:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  credit:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  exchange: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMonth(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
}

/* ── مودال التفاصيل والطباعة ─────────────────────────────────────── */
function ReturnDetailModal({ type, id, onClose }: { type: Tab; id: number; onClose: () => void }) {
  const endpoint = type === 'sales' ? `/api/sales-returns/${id}` : `/api/purchase-returns/${id}`;
  const { data, isLoading } = useQuery<SaleReturn & PurchaseReturn>({
    queryKey: [endpoint],
    queryFn: async () => {
      const r = await authFetch(api(endpoint));
      if (!r.ok) throw new Error('خطأ في جلب التفاصيل');
      return r.json();
    },
    staleTime: 60_000,
  });
  const items: ReturnItem[] = safeArray(data?.items);
  const party = data?.customer_name || data?.supplier_name || '—';
  const originRef = type === 'sales' ? data?.sale_no : (data as PurchaseReturn | undefined)?.invoice_no;

  function handlePrint() {
    if (!data) return;
    const _html = `
      <html dir="rtl"><head><meta charset="UTF-8">
      <title>مرتجع ${data.return_no}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
        h1{font-size:18px;margin-bottom:4px}
        .meta{color:#555;margin-bottom:20px;font-size:12px;line-height:1.8}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#f3f4f6;text-align:right;padding:8px 10px;font-size:12px}
        td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}
        .total{font-weight:bold;font-size:14px;text-align:left;margin-top:16px}
        @media print{button{display:none}}
      </style></head><body>
      <h1>مرتجع ${type === 'sales' ? 'مبيعات' : 'مشتريات'} — ${data.return_no}</h1>
      <div class="meta">
        ${type === 'sales' ? 'العميل' : 'المورد'}: <strong>${party}</strong><br>
        التاريخ: <strong>${fmt(data.date || data.created_at)}</strong><br>
        نوع الاسترداد: <strong>${REFUND_LABELS[data.refund_type ?? ''] ?? (data.refund_type ?? '—')}</strong>
        ${originRef ? `<br>الفاتورة الأصلية: <strong>${originRef}</strong>` : ''}
        ${data.reason ? `<br>السبب: ${data.reason}` : ''}
        ${data.notes  ? `<br>ملاحظات: ${data.notes}` : ''}
      </div>
      <table>
        <thead><tr><th>المنتج/الخدمة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${items.map(i => `<tr>
            <td>${i.product_name}</td>
            <td>${i.quantity}</td>
            <td>${i.unit_price.toLocaleString('ar-EG')} ج.م</td>
            <td>${i.total_price.toLocaleString('ar-EG')} ج.م</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="total">الإجمالي: ${(data.total_amount ?? 0).toLocaleString('ar-EG')} ج.م</div>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `;
    openPrintWindow(_html, { width: 700, height: 900 });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#1a1a2e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/3">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-orange-400" />
            <div>
              <p className="font-bold text-white">{isLoading ? '...' : data?.return_no}</p>
              <p className="text-xs text-white/40">{type === 'sales' ? 'مرتجع مبيعات' : 'مرتجع مشتريات'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs bg-white/8 hover:bg-white/12 text-white/70 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                <Printer className="w-3.5 h-3.5" /> طباعة
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: type === 'sales' ? 'العميل' : 'المورد', value: party },
                  { label: 'التاريخ', value: fmt(data.date || data.created_at) },
                  { label: 'نوع الاسترداد', value: REFUND_LABELS[data.refund_type ?? ''] ?? (data.refund_type ?? '—') },
                  { label: 'الإجمالي', value: formatCurrency(data.total_amount ?? 0) },
                  ...(originRef ? [{ label: 'الفاتورة الأصلية', value: originRef }] : []),
                  ...(data.reason ? [{ label: 'السبب', value: data.reason }] : []),
                  ...(data.notes  ? [{ label: 'ملاحظات', value: data.notes }] : []),
                ].map(f => (
                  <div key={f.label} className="rounded-lg p-3 bg-white/4 border border-white/6">
                    <p className="text-[10px] text-white/40 mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-white/90">{f.value}</p>
                  </div>
                ))}
              </div>
              {items.length > 0 ? (
                <div className="rounded-xl overflow-hidden border border-white/8">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="py-2.5 px-4 text-xs font-medium text-white/50">المنتج / الخدمة</th>
                        <th className="py-2.5 px-4 text-xs font-medium text-white/50 text-center">الكمية</th>
                        <th className="py-2.5 px-4 text-xs font-medium text-white/50">سعر الوحدة</th>
                        <th className="py-2.5 px-4 text-xs font-medium text-white/50">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id} className={idx < items.length - 1 ? 'border-b border-white/5' : ''}>
                          <td className="py-3 px-4 text-white/80 font-medium">{item.product_name}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white/60">{formatCurrency(item.unit_price)}</td>
                          <td className="py-3 px-4 font-bold text-red-400">{formatCurrency(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-white/3 border-t border-white/10">
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-white/50 text-sm">الإجمالي</td>
                        <td className="py-3 px-4 font-black text-red-400">{formatCurrency(data.total_amount ?? 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-center text-white/30 text-sm py-4">لا توجد أصناف مسجّلة</p>
              )}
            </>
          ) : (
            <p className="text-center text-white/30 text-sm py-8">تعذّر تحميل التفاصيل</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── بطاقة الإحصائيات الشهرية ────────────────────────────────────── */
function MonthlyBreakdown({ rows, colorClass }: { rows: (SaleReturn & PurchaseReturn)[]; colorClass: string }) {
  const [open, setOpen] = useState(false);
  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    rows.forEach(r => {
      const d = r.date || r.created_at;
      const key = d ? d.slice(0, 7) : '?';
      const prev = map.get(key) ?? { count: 0, total: 0 };
      map.set(key, { count: prev.count + 1, total: prev.total + r.total_amount });
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [rows]);

  if (monthly.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-white/70 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> التوزيع الشهري</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {monthly.map(([month, { count, total }]) => (
            <div key={month} className="flex items-center justify-between text-sm">
              <span className="text-white/50">{fmtMonth(month + '-01')}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/30 text-xs">{count} مرتجع</span>
                <span className={`font-bold ${colorClass}`}>{formatCurrency(total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── تقرير أكثر المرتجعين ────────────────────────────────────────── */
function TopParties({ rows, nameKey, colorClass }: {
  rows: (SaleReturn & PurchaseReturn)[];
  nameKey: keyof (SaleReturn & PurchaseReturn);
  colorClass: string;
}) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    rows.forEach(r => {
      const name = (r[nameKey] as string | null | undefined) || 'غير محدد';
      const prev = map.get(name) ?? { count: 0, total: 0 };
      map.set(name, { count: prev.count + 1, total: prev.total + r.total_amount });
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [rows, nameKey]);

  if (grouped.length === 0) return null;
  const label = 'الأكثر إرجاعاً';

  return (
    <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-white/70 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> {label}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {grouped.map(([name, { count, total }]) => (
            <div key={name} className="flex items-center justify-between text-sm">
              <span className="text-white/70 truncate max-w-[200px]">{name}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/30 text-xs">{count} مرة</span>
                <span className={`font-bold ${colorClass}`}>{formatCurrency(total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── تقرير الأسباب ───────────────────────────────────────────────── */
function ReasonBreakdown({ rows }: { rows: (SaleReturn & PurchaseReturn)[] }) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    rows.forEach(r => {
      const reason = r.reason?.trim() || 'بدون سبب';
      const prev = map.get(reason) ?? { count: 0, total: 0 };
      map.set(reason, { count: prev.count + 1, total: prev.total + r.total_amount });
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
  }, [rows]);

  if (grouped.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-white/70 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Package className="w-4 h-4" /> أسباب الإرجاع</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {grouped.map(([reason, { count, total }]) => (
            <div key={reason} className="flex items-center justify-between text-sm">
              <span className="text-white/70 truncate max-w-[200px]">{reason}</span>
              <div className="flex items-center gap-3">
                <span className="text-white/30 text-xs">{count} مرة</span>
                <span className="font-bold text-white/60">{formatCurrency(total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── الصفحة الرئيسية ──────────────────────────────────────────────── */
export default function Returns() {
  const searchStr = useSearch();
  const urlQ = useMemo(() => new URLSearchParams(searchStr).get('q') ?? '', [searchStr]);

  const [tab, setTab]         = useState<Tab>('sales');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [search, setSearch]   = useState(urlQ);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [filterRefund, setFilterRefund] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => { if (urlQ) setSearch(urlQ); }, [urlQ]);

  const { data: rawSalesReturns, isLoading: loadSales } = useQuery({
    queryKey: ['/api/sales-returns'],
    queryFn: () => authFetch(api('/api/sales-returns')).then(r => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    staleTime: 30_000,
  });
  const { data: rawPurchReturns, isLoading: loadPurchases } = useQuery({
    queryKey: ['/api/purchase-returns'],
    queryFn: () => authFetch(api('/api/purchase-returns')).then(r => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    staleTime: 30_000,
  });

  const salesReturns: SaleReturn[]       = safeArray(rawSalesReturns);
  const purchaseReturns: PurchaseReturn[] = safeArray(rawPurchReturns);

  const totalSalesRet  = salesReturns.reduce((s, r) => s + r.total_amount, 0);
  const totalPurchRet  = purchaseReturns.reduce((s, r) => s + r.total_amount, 0);

  /* فلترة وترتيب */
  const activeRows = (tab === 'sales' ? salesReturns : purchaseReturns) as (SaleReturn & PurchaseReturn)[];

  const filtered = useMemo(() => {
    let rows = activeRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.return_no?.toLowerCase().includes(q) ||
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        (r.supplier_name ?? '').toLowerCase().includes(q) ||
        (r.reason ?? '').toLowerCase().includes(q) ||
        (r.sale_no ?? '').toLowerCase().includes(q) ||
        (r.invoice_no ?? '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) rows = rows.filter(r => (r.date || r.created_at) >= dateFrom);
    if (dateTo)   rows = rows.filter(r => (r.date || r.created_at) <= dateTo + 'T23:59:59');
    if (filterRefund !== 'all') rows = rows.filter(r => r.refund_type === filterRefund);

    rows = [...rows].sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortKey === 'date')   { va = a.date || a.created_at; vb = b.date || b.created_at; }
      else if (sortKey === 'amount') { va = a.total_amount; vb = b.total_amount; }
      else { va = a.customer_name || a.supplier_name || ''; vb = b.customer_name || b.supplier_name || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [activeRows, search, dateFrom, dateTo, filterRefund, sortKey, sortDir]);

  const filteredTotal = filtered.reduce((s, r) => s + r.total_amount, 0);

  const isLoading = tab === 'sales' ? loadSales : loadPurchases;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }
  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />)
    : null;

  const isFiltered = search || dateFrom || dateTo || filterRefund !== 'all';

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── رأس الصفحة ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <RotateCcw className="w-6 h-6 text-orange-400" />
          <div>
            <h2 className="text-xl font-bold text-white">سجل المرتجعات</h2>
            <p className="text-xs text-white/30 mt-0.5">مرجع كامل — المرتجعات تُنشأ من صفحتَي المبيعات والمشتريات</p>
          </div>
        </div>
      </div>

      {/* ── إحصائيات إجمالية ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel rounded-2xl p-4 border border-orange-500/15">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpFromLine className="w-4 h-4 text-orange-400" />
            <p className="text-white/40 text-xs font-bold">مرتجعات مبيعات</p>
          </div>
          <p className="text-xl font-black text-orange-400">{formatCurrency(totalSalesRet)}</p>
          <p className="text-white/30 text-xs mt-0.5">{salesReturns.length} مرتجع</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-blue-500/15">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownToLine className="w-4 h-4 text-blue-400" />
            <p className="text-white/40 text-xs font-bold">مرتجعات مشتريات</p>
          </div>
          <p className="text-xl font-black text-blue-400">{formatCurrency(totalPurchRet)}</p>
          <p className="text-white/30 text-xs mt-0.5">{purchaseReturns.length} مرتجع</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-red-500/10 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-white/40 text-xs font-bold">إجمالي المرتجعات</p>
          </div>
          <p className="text-2xl font-black text-red-400">{formatCurrency(totalSalesRet + totalPurchRet)}</p>
          <p className="text-white/30 text-xs mt-0.5">{salesReturns.length + purchaseReturns.length} مرتجع إجمالاً</p>
        </div>
      </div>

      {/* ── تاب بار ── */}
      <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/10 w-fit">
        {([
          { id: 'sales',     label: 'مرتجعات المبيعات',  count: salesReturns.length,    color: 'text-orange-400', icon: ArrowUpFromLine },
          { id: 'purchases', label: 'مرتجعات المشتريات', count: purchaseReturns.length, color: 'text-blue-400',   icon: ArrowDownToLine },
        ] as const).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setDateFrom(''); setDateTo(''); setFilterRefund('all'); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t.id ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white hover:bg-white/8'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            <span className={`text-xs ${tab === t.id ? 'text-black/60' : t.color}`}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* ── بانر التصفية من فاتورة ── */}
      {urlQ && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm">
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span>عرض مرتجعات الفاتورة: <strong className="font-mono">{urlQ}</strong></span>
          <button
            onClick={() => { setSearch(''); window.history.replaceState({}, '', '/returns'); }}
            className="mr-auto text-white/40 hover:text-white text-xs underline"
          >عرض الكل</button>
        </div>
      )}

      {/* ── تقارير قابلة للطي ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MonthlyBreakdown
          rows={activeRows}
          colorClass={tab === 'sales' ? 'text-orange-400' : 'text-blue-400'}
        />
        <TopParties
          rows={activeRows}
          nameKey="customer_name"
          colorClass={tab === 'sales' ? 'text-orange-400' : 'text-blue-400'}
        />
        <ReasonBreakdown rows={activeRows} />
      </div>

      {/* ── أدوات الفلترة ── */}
      <div className="glass-panel rounded-2xl p-3 border border-white/5 flex flex-wrap gap-2 items-center">
        {/* بحث */}
        <div className="relative flex-1 min-w-44">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="رقم المرتجع / العميل / السبب / رقم الفاتورة..."
            className="erp-input w-full icon-pr text-sm"
          />
        </div>
        {/* من */}
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-xs">من</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="erp-input text-sm w-36" />
        </div>
        {/* إلى */}
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-xs">إلى</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="erp-input text-sm w-36" />
        </div>
        {/* نوع الاسترداد */}
        <select value={filterRefund} onChange={e => setFilterRefund(e.target.value)}
          className="erp-input text-sm">
          <option value="all">كل أنواع الاسترداد</option>
          <option value="cash">نقدي</option>
          <option value="credit">ذمة</option>
          <option value="exchange">استبدال</option>
        </select>
        {/* مسح الفلاتر */}
        {isFiltered && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setFilterRefund('all'); }}
            className="text-xs text-white/40 hover:text-white flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X className="w-3 h-3" /> مسح الفلاتر
          </button>
        )}
      </div>

      {/* نتيجة الفلترة */}
      {isFiltered && (
        <div className="flex items-center justify-between text-sm px-1">
          <span className="text-white/40">{filtered.length} نتيجة من {activeRows.length}</span>
          <span className="font-bold text-red-400">{formatCurrency(filteredTotal)}</span>
        </div>
      )}

      {/* ── الجدول ── */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-semibold text-white/50 text-sm">رقم المرتجع</th>
                <th className="p-4 font-semibold text-white/50 text-sm">
                  الفاتورة الأصلية
                </th>
                <th className="p-4 font-semibold text-white/50 text-sm cursor-pointer hover:text-white/80 select-none"
                  onClick={() => toggleSort('party')}>
                  {tab === 'sales' ? 'العميل' : 'المورد'} <SortIcon k="party" />
                </th>
                <th className="p-4 font-semibold text-white/50 text-sm cursor-pointer hover:text-white/80 select-none"
                  onClick={() => toggleSort('amount')}>
                  المبلغ <SortIcon k="amount" />
                </th>
                <th className="p-4 font-semibold text-white/50 text-sm">نوع الاسترداد</th>
                <th className="p-4 font-semibold text-white/50 text-sm">السبب</th>
                <th className="p-4 font-semibold text-white/50 text-sm cursor-pointer hover:text-white/80 select-none"
                  onClick={() => toggleSort('date')}>
                  التاريخ <SortIcon k="date" />
                </th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={8} rows={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <RotateCcw className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40">
                      {isFiltered ? 'لا توجد نتائج تطابق الفلتر' : 'لا توجد مرتجعات'}
                    </div>
                    {!isFiltered && (
                      <div className="text-white/25 text-sm mt-1 flex items-center justify-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {tab === 'sales'
                          ? 'أنشئ مرتجعاً من: المبيعات ← الفاتورة ← مرتجع'
                          : 'أنشئ مرتجعاً من: المشتريات ← تبويب المرتجعات'}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const originRef = tab === 'sales' ? r.sale_no : r.invoice_no;
                  return (
                    <tr key={r.id} className="border-b border-white/5 erp-table-row">
                      <td className="p-4">
                        <span className="font-mono text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
                          {r.return_no}
                        </span>
                      </td>
                      <td className="p-4">
                        {originRef ? (
                          <span className="font-mono text-xs px-2 py-1 rounded-lg bg-white/5 text-white/50 border border-white/10">
                            {originRef}
                          </span>
                        ) : (
                          <span className="text-white/20 text-xs">مستقل</span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-white/80">
                        {r.customer_name || r.supplier_name || '—'}
                      </td>
                      <td className="p-4 font-black text-red-400">{formatCurrency(r.total_amount)}</td>
                      <td className="p-4">
                        {r.refund_type ? (
                          <span className={`text-xs px-2 py-1 rounded-lg font-bold border ${REFUND_COLORS[r.refund_type] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
                            {REFUND_LABELS[r.refund_type] ?? r.refund_type}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4 text-white/50 text-sm max-w-[160px] truncate">{r.reason || '—'}</td>
                      <td className="p-4 text-white/40 text-sm">{fmt(r.date || r.created_at)}</td>
                      <td className="p-4">
                        <button onClick={() => setDetailId(r.id)} title="تفاصيل وطباعة"
                          className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-orange-400 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال التفاصيل */}
      {detailId !== null && (
        <ReturnDetailModal type={tab} id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
