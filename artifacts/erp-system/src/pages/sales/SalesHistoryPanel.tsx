import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { TableSkeleton } from '@/components/skeletons';
import { useWarehouse } from '@/contexts/warehouse';
import { api } from '@/lib/api';

interface SaleRecord {
  id: number;
  invoice_no: string;
  date: string | null;
  customer_name: string | null;
  payment_type: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  posting_status: string;
  status: string;
}

function SalesPostingBadge({ status }: { status: string }) {
  if (status === 'posted')
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
        مرحَّل
      </span>
    );
  if (status === 'cancelled')
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
        ملغى
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-medium">
      مسودة
    </span>
  );
}

function buildSaleWhatsAppUrl(s: SaleRecord): string {
  const paid      = Number(s.paid_amount);
  const remaining = Number(s.remaining_amount);
  const total     = Number(s.total_amount);

  let payLine: string;
  if (s.payment_type === 'credit') {
    payLine = `طريقة الدفع: آجل — مديونية: ${total.toFixed(2)} ج.م`;
  } else if (s.payment_type === 'partial') {
    payLine = `طريقة الدفع: جزئي — مدفوع: ${paid.toFixed(2)} ج.م / متبقي: ${remaining.toFixed(2)} ج.م`;
  } else {
    payLine = `طريقة الدفع: نقدي — مدفوع بالكامل`;
  }

  const lines = [
    `🧾 *فاتورة مبيعات*`,
    `رقم الفاتورة: ${s.invoice_no}`,
    s.customer_name ? `العميل: ${s.customer_name}` : '',
    `الإجمالي: ${total.toFixed(2)} ج.م`,
    payLine,
    ``,
    `شكراً لتعاملكم معنا 🙏`,
  ].filter(Boolean);
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function SalesHistoryPanel() {
  const { user: currentUser } = useAuth();
  const canCancelSale = hasPermission(currentUser, 'can_cancel_sale') === true;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentWarehouseId } = useWarehouse();
  const warehouseParam = currentWarehouseId ? `?warehouse_id=${currentWarehouseId}` : '';

  const { data: sales = [], isLoading } = useQuery<SaleRecord[]>({
    queryKey: ['/api/sales', currentWarehouseId],
    queryFn: () =>
      authFetch(api(`/api/sales${warehouseParam}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['/api/sales'] });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/sales/${id}/post`), { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'فشل الترحيل');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ تم ترحيل الفاتورة وإنشاء القيد المحاسبي' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/sales/${id}/cancel`), { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'فشل الإلغاء');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إلغاء الفاتورة وإنشاء قيد عكسي' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  return (
    <div className="glass-panel rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-white/80 whitespace-nowrap text-sm">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="p-3 font-medium">رقم الفاتورة</th>
              <th className="p-3 font-medium">العميل</th>
              <th className="p-3 font-medium">الإجمالي</th>
              <th className="p-3 font-medium">نوع الدفع</th>
              <th className="p-3 font-medium">حالة الترحيل</th>
              <th className="p-3 font-medium">التاريخ</th>
              <th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton cols={7} rows={5} />
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/40">
                  لا توجد فواتير بعد
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-3 font-mono text-amber-400">{s.invoice_no}</td>
                  <td className="p-3 font-bold text-white">{s.customer_name || 'نقدي'}</td>
                  <td className="p-3 font-bold text-emerald-400">
                    {formatCurrency(s.total_amount)}
                  </td>
                  <td className="p-3 text-white/60">
                    {s.payment_type === 'cash'
                      ? 'نقدي'
                      : s.payment_type === 'credit'
                        ? 'آجل'
                        : 'جزئي'}
                  </td>
                  <td className="p-3">
                    <SalesPostingBadge status={s.posting_status} />
                  </td>
                  <td className="p-3 text-white/50">{s.date || '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {s.posting_status === 'draft' && canCancelSale && (
                        <button
                          onClick={() => postMutation.mutate(s.id)}
                          disabled={postMutation.isPending}
                          title="ترحيل"
                          className="btn-icon text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {s.posting_status === 'posted' && canCancelSale && (
                        <button
                          onClick={() => cancelMutation.mutate(s.id)}
                          disabled={cancelMutation.isPending}
                          title="إلغاء"
                          className="btn-icon text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <a
                        href={buildSaleWhatsAppUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="إرسال عبر واتساب"
                        className="btn-icon text-[#25D366] hover:text-[#20ba58] hover:bg-[#25D366]/10"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
