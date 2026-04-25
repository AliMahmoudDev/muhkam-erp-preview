import { api } from '@/lib/api';
/**
 * صفحة المرتجعات — مرتجعات المبيعات والمشتريات
 * مع تفاصيل كل مرتجع وطباعة
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { formatCurrency } from '@/lib/format';
import {
  RotateCcw, TrendingDown, TrendingUp, ArrowUpFromLine,
  ArrowDownToLine, Eye, Printer, X,
} from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';


interface SaleReturn {
  id: number; return_no: string; sale_id: number | null;
  customer_id: number | null; customer_name: string | null;
  total_amount: number; reason: string | null; refund_type: string | null;
  notes: string | null; date: string | null; created_at: string;
  items?: ReturnItem[];
}
interface PurchaseReturn {
  id: number; return_no: string; purchase_id: number | null;
  supplier_id: number | null; supplier_name: string | null; customer_name: string | null;
  total_amount: number; reason: string | null; refund_type: string | null;
  notes: string | null; date: string | null; created_at: string;
  items?: ReturnItem[];
}
interface ReturnItem {
  id: number; product_name: string; quantity: number;
  unit_price: number; total_price: number;
}

type Tab = 'sales' | 'purchases';

const REFUND_LABELS: Record<string, string> = {
  cash: 'نقدي', credit: 'ذمة', exchange: 'استبدال',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── مودال التفاصيل والطباعة ─────────────────────────────────────── */
function ReturnDetailModal({
  type, id, onClose,
}: { type: Tab; id: number; onClose: () => void }) {
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

  function handlePrint() {
    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w || !data) return;
    w.document.write(`
      <html dir="rtl"><head><meta charset="UTF-8">
      <title>مرتجع ${data.return_no}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}
        h1{font-size:18px;margin-bottom:4px}
        .meta{color:#555;margin-bottom:20px;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th{background:#f3f4f6;text-align:right;padding:8px 10px;font-size:12px}
        td{padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}
        .total{font-weight:bold;font-size:14px;text-align:left;margin-top:16px}
        @media print{button{display:none}}
      </style></head><body>
      <h1>مرتجع ${type === 'sales' ? 'مبيعات' : 'مشتريات'} — ${data.return_no}</h1>
      <div class="meta">
        ${type === 'sales' ? 'العميل' : 'المورد'}: <strong>${party}</strong> &nbsp;|&nbsp;
        التاريخ: <strong>${fmt(data.date || data.created_at)}</strong> &nbsp;|&nbsp;
        نوع الاسترداد: <strong>${REFUND_LABELS[data.refund_type ?? ''] ?? (data.refund_type ?? '—')}</strong>
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
    `);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#1a1a2e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
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

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              {/* بيانات المرتجع */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: type === 'sales' ? 'العميل' : 'المورد', value: party },
                  { label: 'التاريخ', value: fmt(data.date || data.created_at) },
                  { label: 'نوع الاسترداد', value: REFUND_LABELS[data.refund_type ?? ''] ?? (data.refund_type ?? '—') },
                  { label: 'الإجمالي', value: formatCurrency(data.total_amount ?? 0) },
                  ...(data.reason ? [{ label: 'السبب', value: data.reason }] : []),
                  ...(data.notes  ? [{ label: 'ملاحظات', value: data.notes }] : []),
                ].map(f => (
                  <div key={f.label} className="rounded-lg p-3 bg-white/4 border border-white/6">
                    <p className="text-[10px] text-white/40 mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-white/90">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* جدول الأصناف */}
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
                <p className="text-center text-white/30 text-sm py-4">لا توجد أصناف مسجّلة لهذا المرتجع</p>
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

/* ── الصفحة الرئيسية ──────────────────────────────────────────────── */
export default function Returns() {
  const [tab, setTab] = useState<Tab>('sales');
  const [detailId, setDetailId] = useState<number | null>(null);

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

  const salesReturns: SaleReturn[]    = safeArray(rawSalesReturns);
  const purchaseReturns: PurchaseReturn[] = safeArray(rawPurchReturns);

  const totalSalesRet = salesReturns.reduce((s, r) => s + r.total_amount, 0);
  const totalPurchRet = purchaseReturns.reduce((s, r) => s + r.total_amount, 0);

  const isLoading = tab === 'sales' ? loadSales : loadPurchases;
  const rows      = tab === 'sales' ? salesReturns : purchaseReturns;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-6 h-6 text-orange-400" />
        <h2 className="text-xl font-bold text-white">المرتجعات</h2>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-orange-500/15">
          <div className="flex items-center gap-2 mb-1"><ArrowUpFromLine className="w-4 h-4 text-orange-400" /><p className="text-white/40 text-xs font-bold">مرتجعات مبيعات</p></div>
          <p className="text-xl font-black text-orange-400">{formatCurrency(totalSalesRet)}</p>
          <p className="text-white/30 text-xs mt-0.5">{salesReturns.length} مرتجع</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-blue-500/15">
          <div className="flex items-center gap-2 mb-1"><ArrowDownToLine className="w-4 h-4 text-blue-400" /><p className="text-white/40 text-xs font-bold">مرتجعات مشتريات</p></div>
          <p className="text-xl font-black text-blue-400">{formatCurrency(totalPurchRet)}</p>
          <p className="text-white/30 text-xs mt-0.5">{purchaseReturns.length} مرتجع</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-400" /><p className="text-white/40 text-xs font-bold">صافي المرتجعات</p></div>
          <p className="text-xl font-black text-red-400">{formatCurrency(totalSalesRet + totalPurchRet)}</p>
          <p className="text-white/30 text-xs mt-0.5">إجمالي الكل</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-white/30" /><p className="text-white/40 text-xs font-bold">ملاحظة</p></div>
          <p className="text-xs text-white/40 leading-relaxed mt-1">إنشاء المرتجعات يتم من صفحتَي المبيعات والمشتريات</p>
        </div>
      </div>

      {/* تاب بار */}
      <div className="flex gap-2 bg-white/5 rounded-2xl p-1.5 border border-white/10 w-fit">
        {([
          { id: 'sales',     label: 'مرتجعات المبيعات',   count: salesReturns.length,    color: 'text-orange-400' },
          { id: 'purchases', label: 'مرتجعات المشتريات',  count: purchaseReturns.length, color: 'text-blue-400'   },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white hover:bg-white/8'}`}>
            {t.label} <span className={`mr-1 text-xs ${tab === t.id ? 'text-black/60' : t.color}`}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* الجدول */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-semibold text-white/60">رقم المرتجع</th>
                <th className="p-4 font-semibold text-white/60">{tab === 'sales' ? 'العميل' : 'المورد'}</th>
                <th className="p-4 font-semibold text-white/60">المبلغ</th>
                <th className="p-4 font-semibold text-white/60">نوع الاسترداد</th>
                <th className="p-4 font-semibold text-white/60">السبب</th>
                <th className="p-4 font-semibold text-white/60">التاريخ</th>
                <th className="p-4 font-semibold text-white/60"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={7} rows={5} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <RotateCcw className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40">لا توجد مرتجعات</div>
                    <div className="text-white/25 text-sm mt-1">
                      {tab === 'sales' ? 'أنشئ مرتجعاً من صفحة المبيعات ← الفاتورة ← «مرتجع»' : 'أنشئ مرتجعاً من صفحة المشتريات ← الفاتورة ← «مرتجع»'}
                    </div>
                  </td>
                </tr>
              ) : (
                (rows as (SaleReturn & PurchaseReturn)[]).map((r) => (
                  <tr key={r.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-4">
                      <span className="font-mono text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold">
                        {r.return_no}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-white/80">{r.customer_name || r.supplier_name || '—'}</td>
                    <td className="p-4 font-black text-red-400">{formatCurrency(r.total_amount)}</td>
                    <td className="p-4">
                      {r.refund_type ? (
                        <span className={`text-xs px-2 py-1 rounded-lg font-bold border ${
                          r.refund_type === 'cash'   ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : r.refund_type === 'credit' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {REFUND_LABELS[r.refund_type] ?? r.refund_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-white/50 text-sm max-w-[180px] truncate">{r.reason || '—'}</td>
                    <td className="p-4 text-white/40 text-sm">{fmt(r.date || r.created_at)}</td>
                    <td className="p-4">
                      <button onClick={() => setDetailId(r.id)}
                        title="تفاصيل وطباعة"
                        className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-orange-400 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
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
