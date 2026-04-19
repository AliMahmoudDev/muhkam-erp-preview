/**
 * صفحة المرتجعات — مرتجعات المبيعات والمشتريات
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { RotateCcw, TrendingDown, TrendingUp, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

interface SaleReturn {
  id: number; return_no: string; sale_id: number | null;
  customer_id: number | null; customer_name: string | null;
  total_amount: number; reason: string | null; refund_type: string | null;
  safe_name: string | null; date: string | null; created_at: string;
}
interface PurchaseReturn {
  id: number; return_no: string; purchase_id: number | null;
  customer_id: number | null; customer_name: string | null; supplier_name: string | null;
  total_amount: number; reason: string | null; refund_type: string | null;
  safe_name: string | null; date: string | null; created_at: string;
}

type Tab = 'sales' | 'purchases';

const REFUND_LABELS: Record<string, string> = {
  cash: 'نقدي', credit: 'ذمة', exchange: 'استبدال',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Returns() {
  const [tab, setTab] = useState<Tab>('sales');

  const { data: salesReturns = [], isLoading: loadSales } = useQuery<SaleReturn[]>({
    queryKey: ['/api/sales-returns'],
    queryFn: () => authFetch(api('/api/sales-returns')).then(r => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    staleTime: 30_000,
  });
  const { data: purchaseReturns = [], isLoading: loadPurchases } = useQuery<PurchaseReturn[]>({
    queryKey: ['/api/purchase-returns'],
    queryFn: () => authFetch(api('/api/purchase-returns')).then(r => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    staleTime: 30_000,
  });

  const totalSalesRet = salesReturns.reduce((s, r) => s + r.total_amount, 0);
  const totalPurchRet = purchaseReturns.reduce((s, r) => s + r.total_amount, 0);

  const isLoading = tab === 'sales' ? loadSales : loadPurchases;
  const rows = tab === 'sales' ? salesReturns : purchaseReturns;

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
          { id: 'sales', label: 'مرتجعات المبيعات', count: salesReturns.length, color: 'text-orange-400' },
          { id: 'purchases', label: 'مرتجعات المشتريات', count: purchaseReturns.length, color: 'text-blue-400' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.id ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white hover:bg-white/8'}`}
          >
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={5} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <RotateCcw className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40">لا توجد مرتجعات</div>
                    <div className="text-white/25 text-sm mt-1">
                      {tab === 'sales'
                        ? 'أنشئ مرتجعاً من صفحة المبيعات ← الفاتورة ← «مرتجع»'
                        : 'أنشئ مرتجعاً من صفحة المشتريات ← الفاتورة ← «مرتجع»'}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r: SaleReturn & PurchaseReturn) => (
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
                          r.refund_type === 'cash' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : r.refund_type === 'credit' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {REFUND_LABELS[r.refund_type] ?? r.refund_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-white/50 text-sm max-w-[180px] truncate">{r.reason || '—'}</td>
                    <td className="p-4 text-white/40 text-sm">{fmt(r.date || r.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
