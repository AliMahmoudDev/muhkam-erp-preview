/**
 * صفحة الموردين — عرض مُخصَّص لجهات الشراء (is_supplier = true)
 * يعرض الرصيد من منظور الذمم الدائنة (AP)
 */
import { safeArray } from '@/lib/safe-data';
import { useState } from 'react';
import { useGetCustomers, useGetSettingsSafes } from '@workspace/api-client-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import {
  Truck, Search, DollarSign, FileText, X, CreditCard,
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

export default function Suppliers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: customersRaw, isLoading } = useGetCustomers();
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const allCustomers = safeArray(customersRaw);

  // موردون فقط
  const suppliers = allCustomers.filter(c => c.is_supplier);

  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState<{ id: number; name: string; balance: number } | null>(null);
  const [paymentData, setPaymentData] = useState({ amount: '', safe_id: '', notes: '' });

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search))
  );

  // إحصائيات
  const totalOwed = suppliers.filter(s => Number(s.balance) < -0.001).reduce((sum, s) => sum + Math.abs(Number(s.balance)), 0);
  const totalCredit = suppliers.filter(s => Number(s.balance) > 0.001).reduce((sum, s) => sum + Number(s.balance), 0);
  const creditorCount = suppliers.filter(s => Number(s.balance) < -0.001).length;

  const canManage = hasPermission(user, 'can_manage_customers');

  const paymentMutation = useMutation({
    mutationFn: async (data: { customer_id: number; safe_id: number; amount: number; notes?: string }) => {
      const res = await authFetch(api(`/api/customers/${data.customer_id}/supplier-payment`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safe_id: data.safe_id, amount: data.amount, notes: data.notes }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
    onSuccess: () => {
      toast({ title: 'تم تسجيل الدفعة بنجاح' });
      qc.invalidateQueries({ queryKey: ['/api/customers'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setShowPayment(null);
      setPaymentData({ amount: '', safe_id: '', notes: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayment) return;
    if (!paymentData.safe_id) { toast({ title: 'اختر الخزينة', variant: 'destructive' }); return; }
    const amt = parseFloat(paymentData.amount);
    if (!amt || amt <= 0) { toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' }); return; }
    paymentMutation.mutate({ customer_id: showPayment.id, safe_id: parseInt(paymentData.safe_id), amount: amt, notes: paymentData.notes || undefined });
  };

  return (
    <div className="space-y-5">
      {/* ─── رأس الصفحة ─── */}
      <div className="flex items-center gap-3">
        <Truck className="w-6 h-6 text-indigo-400" />
        <h2 className="text-xl font-bold text-white">الموردون</h2>
        <span className="text-white/30 text-sm">({suppliers.length} جهة شراء)</span>
      </div>

      {/* ─── بطاقات إحصائية ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-red-500/15">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-white/40 text-xs font-bold">ذمم دائنة (AP)</p>
          </div>
          <p className="text-2xl font-black text-red-400">{formatCurrency(totalOwed)}</p>
          <p className="text-white/30 text-xs mt-0.5">{creditorCount} مورد له رصيد عليك</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/15">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-white/40 text-xs font-bold">رصيد لصالحك</p>
          </div>
          <p className="text-2xl font-black text-emerald-400">{formatCurrency(totalCredit)}</p>
          <p className="text-white/30 text-xs mt-0.5">دفعت أكثر من المشتريات</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-indigo-400" />
            <p className="text-white/40 text-xs font-bold">إجمالي الموردون</p>
          </div>
          <p className="text-2xl font-black text-indigo-400">{suppliers.length}</p>
          <p className="text-white/30 text-xs mt-0.5">
            {suppliers.filter(s => Number(s.balance) === 0).length} مسوّى كاملاً
          </p>
        </div>
      </div>

      {/* ─── بحث ─── */}
      <div className="relative max-w-xs">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="بحث باسم المورد..."
          className="glass-input pl-3 pr-9 w-full py-2 text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button onClick={() => setSearch('')}><X className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 hover:text-white/60" /></button>}
      </div>

      {/* ─── الجدول ─── */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-semibold text-white/60">المورد</th>
                <th className="p-4 font-semibold text-white/60">رقم الهاتف</th>
                <th className="p-4 font-semibold text-white/60">
                  الرصيد
                  <span className="text-white/25 text-xs font-normal mr-1">(− عليك | + لك)</span>
                </th>
                <th className="p-4 font-semibold text-white/60">الحالة</th>
                <th className="p-4 font-semibold text-white/60">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={5} rows={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Truck className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40">
                      {suppliers.length === 0
                        ? 'لا يوجد موردون — افتح صفحة العملاء وفعّل خيار «يتم الشراء منه»'
                        : 'لا توجد نتائج للبحث'}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(s => {
                  const bal = Number(s.balance);
                  return (
                    <tr key={s.id} className="border-b border-white/5 erp-table-row">
                      <td className="p-4 font-bold text-white">{s.name}</td>
                      <td className="p-4 text-white/50">{s.phone || '—'}</td>
                      <td className="p-4 font-bold">
                        {bal < -0.001 ? (
                          <span className="text-red-400 flex items-center gap-1.5">
                            {formatCurrency(Math.abs(bal))}
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/20">AP عليك</span>
                          </span>
                        ) : bal > 0.001 ? (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            {formatCurrency(bal)}
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/20">لصالحك</span>
                          </span>
                        ) : (
                          <span className="text-white/30">متسوّى</span>
                        )}
                      </td>
                      <td className="p-4">
                        {bal < -0.001 ? (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> مستحق
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" /> سليم
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {canManage && bal < -0.001 && (
                            <button
                              onClick={() => { setPaymentData({ amount: '', safe_id: '', notes: '' }); setShowPayment({ id: s.id, name: s.name, balance: bal }); }}
                              className="flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg text-sm font-bold border border-cyan-500/30"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> تسديد
                            </button>
                          )}
                          <button className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg text-sm font-bold border border-blue-500/30">
                            <FileText className="w-3.5 h-3.5" /> كشف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── مودال تسديد ─── */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <form onSubmit={handlePay} className="glass-panel rounded-3xl p-8 w-full max-w-md space-y-4 modal-panel">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setShowPayment(null)}><X className="w-5 h-5 text-white/40" /></button>
              <h3 className="text-xl font-bold text-white">تسديد للمورد</h3>
            </div>
            <div className="rounded-2xl p-3 bg-red-500/10 border border-red-500/20 flex justify-between">
              <span className="text-red-300 text-sm font-bold">{showPayment.name}</span>
              <span className="text-red-400 font-black">{formatCurrency(Math.abs(showPayment.balance))} عليك</span>
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">الخزينة *</label>
              <select required className="glass-input w-full" value={paymentData.safe_id} onChange={e => setPaymentData(d => ({ ...d, safe_id: e.target.value }))}>
                <option value="">-- اختر --</option>
                {safes.map(s => <option key={s.id} value={s.id}>{s.name} ({formatCurrency(Number(s.balance))})</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">المبلغ (ج.م) *</label>
              <input required type="number" step="0.01" min="0.01" className="glass-input w-full" placeholder="0.00" value={paymentData.amount} onChange={e => setPaymentData(d => ({ ...d, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">ملاحظات</label>
              <input type="text" className="glass-input w-full" placeholder="اختياري" value={paymentData.notes} onChange={e => setPaymentData(d => ({ ...d, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={paymentMutation.isPending} className="flex-1 btn-primary py-3 rounded-xl font-bold disabled:opacity-50">
                {paymentMutation.isPending ? 'جاري التسديد...' : '✓ تسديد'}
              </button>
              <button type="button" onClick={() => setShowPayment(null)} className="flex-1 bg-white/10 py-3 rounded-xl font-bold hover:bg-white/20">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
