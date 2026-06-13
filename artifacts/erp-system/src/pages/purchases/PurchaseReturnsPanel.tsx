import { useState, useEffect } from 'react';
import { safeArray } from '@/lib/safe-data';
import { useGetCustomers, useGetSettingsSafes } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/format';
import { Plus, Minus, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { api } from '@/lib/api';

interface PurchaseReturnRecord {
  id: number;
  return_no: string;
  date: string | null;
  supplier_name: string | null;
  refund_type: string;
  total_amount: number;
  reason: string | null;
  created_at: string;
}

interface PurchaseItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ReturnCartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  max_quantity: number;
  unit_price: number;
  total_price: number;
  original_purchase_item_id: number | null;
}

export default function PurchaseReturnsPanel() {
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw);
  const suppliers = customers.filter((c) => c.is_supplier);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: returns = [], isLoading } = useQuery<PurchaseReturnRecord[]>({
    queryKey: ['/api/purchase-returns'],
    queryFn: () =>
      authFetch(api('/api/purchase-returns')).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const { data: purchasesRaw = [] } = useQuery<
    { id: number; invoice_no: string; supplier_name: string | null; posting_status: string }[]
  >({
    queryKey: ['/api/purchases'],
    queryFn: () =>
      authFetch(api('/api/purchases')).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState<string>('');
  const [purchaseId, setPurchaseId] = useState<string>('');
  const [cart, setCart] = useState<ReturnCartItem[]>([]);
  const [refundType, setRefundType] = useState<'cash' | 'balance_credit'>('balance_credit');
  const [safeId, setSafeId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: purchaseItems = [] } = useQuery<PurchaseItem[]>({
    queryKey: ['/api/purchases', purchaseId, 'items'],
    queryFn: async () => {
      if (!purchaseId) return [];
      const r = await authFetch(api(`/api/purchases/${purchaseId}`));
      if (!r.ok) return [];
      const j = await r.json();
      return safeArray(j.items ?? []);
    },
    enabled: !!purchaseId,
  });

  const purchaseItemIds = purchaseItems.map((i) => i.id).join(',');

  useEffect(() => {
    if (purchaseItems.length > 0) {
      setCart(
        purchaseItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          max_quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.unit_price * i.quantity,
          original_purchase_item_id: i.id,
        }))
      );
    }
  }, [purchaseItemIds]);

  const postedPurchases = purchasesRaw.filter((p) => p.posting_status === 'posted');

  const total = cart.reduce((s, i) => s + i.total_price, 0);

  const updateQty = (idx: number, val: number) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const q = Math.max(0.01, Math.min(item.max_quantity, val));
        return { ...item, quantity: q, total_price: q * item.unit_price };
      })
    );
  };

  const removeItem = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setSupplierId('');
    setPurchaseId('');
    setCart([]);
    setRefundType('balance_credit');
    setSafeId('');
    setReason('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cart.length) throw new Error('أضف أصناف المرتجع');
      if (refundType === 'cash' && !safeId) throw new Error('اختر الخزينة للاسترداد النقدي');
      const supplier = suppliers.find((s) => String(s.id) === supplierId);
      const body = {
        purchase_id: purchaseId ? parseInt(purchaseId) : null,
        customer_id: supplierId ? parseInt(supplierId) : null,
        customer_name: supplier?.name ?? null,
        supplier_name: supplier?.name ?? null,
        items: cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
          original_purchase_item_id: i.original_purchase_item_id,
        })),
        reason: reason || null,
        notes: notes || null,
        date,
        refund_type: refundType,
        safe_id: safeId ? parseInt(safeId) : null,
      };
      const r = await authFetch(api('/api/purchase-returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في تسجيل المرتجع');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تسجيل مرتجع الشراء — البضاعة عادت للمخزون' });
      qc.invalidateQueries({ queryKey: ['/api/purchase-returns'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      qc.invalidateQueries({ queryKey: ['/api/customers'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            resetForm();
            setShowForm((v) => !v);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${showForm ? 'bg-surface text-ink/60' : 'btn-primary'}`}
        >
          <Plus className="w-4 h-4" /> مرتجع شراء جديد
        </button>
      </div>

      {showForm && (
        <div className="glass-panel rounded-3xl p-6 border border-line space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-ink">تسجيل مرتجع شراء</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-ink/60 text-xs font-semibold mb-1">المورد</label>
              <select
                className="glass-input"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setPurchaseId('');
                  setCart([]);
                }}
              >
                <option value="">— اختر المورد —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-ink/60 text-xs font-semibold mb-1">
                فاتورة الشراء (اختياري)
              </label>
              <select
                className="glass-input"
                value={purchaseId}
                onChange={(e) => {
                  setPurchaseId(e.target.value);
                  setCart([]);
                }}
              >
                <option value="">— بدون ربط بفاتورة —</option>
                {postedPurchases.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.invoice_no}
                    {p.supplier_name ? ` — ${p.supplier_name}` : ''}
                  </option>
                ))}
              </select>
              {purchaseId && purchaseItems.length === 0 && (
                <p className="text-ink/40 text-xs mt-1">جاري تحميل بنود الفاتورة…</p>
              )}
            </div>

            <div>
              <label className="block text-ink/60 text-xs font-semibold mb-1">التاريخ</label>
              <input
                type="date"
                className="glass-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-ink/60 text-xs font-semibold mb-1">نوع الاسترداد</label>
              <div className="flex gap-2">
                {(['balance_credit', 'cash'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRefundType(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${refundType === t ? (t === 'cash' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-blue-500/20 border-blue-500/50 text-blue-400') : 'bg-surface border-line text-ink/40 hover:text-ink/60'}`}
                  >
                    {t === 'cash' ? '💵 نقدي' : '📒 قيد دائن'}
                  </button>
                ))}
              </div>
            </div>

            {refundType === 'cash' && (
              <div>
                <label className="block text-ink/60 text-xs font-semibold mb-1">الخزينة *</label>
                <select
                  className="glass-input"
                  value={safeId}
                  onChange={(e) => setSafeId(e.target.value)}
                >
                  <option value="">— اختر الخزينة —</option>
                  {safes.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-ink/60 text-xs font-semibold mb-1">السبب</label>
              <input
                type="text"
                className="glass-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: منتج تالف"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-ink/60 text-xs font-semibold">أصناف المرتجع</span>
              {cart.length > 0 && (
                <span className="text-amber-400 font-bold text-sm">{formatCurrency(total)}</span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="bg-surface border border-line rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-ink/20 mx-auto mb-2" />
                <p className="text-ink/40 text-sm">
                  {purchaseId ? 'جاري تحميل بنود الفاتورة…' : 'اختر فاتورة لتحميل بنودها تلقائياً'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-surface rounded-2xl px-4 py-3 border border-line"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-ink font-bold text-sm truncate">{item.product_name}</p>
                      <p className="text-ink/40 text-xs">
                        {formatCurrency(item.unit_price)} / وحدة
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(idx, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-surface text-ink/60 hover:bg-raised flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={0.01}
                        max={item.max_quantity}
                        step={0.01}
                        value={item.quantity}
                        onChange={(e) => updateQty(idx, parseFloat(e.target.value) || 0)}
                        className="w-16 text-center bg-surface border border-line rounded-lg text-ink text-sm py-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(idx, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-surface text-ink/60 hover:bg-raised flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-amber-400 font-bold text-sm w-24 text-left shrink-0">
                      {formatCurrency(item.total_price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-ink/60 text-xs font-semibold mb-1">ملاحظات</label>
            <input
              type="text"
              className="glass-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || cart.length === 0}
              className="flex-1 btn-primary py-3 font-bold disabled:opacity-50"
            >
              {createMutation.isPending
                ? 'جاري التسجيل…'
                : `✦ تسجيل المرتجع — ${formatCurrency(total)}`}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-6 btn-secondary py-3"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span className="text-ink font-bold text-sm">سجل مرتجعات المشتريات</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-ink/80 whitespace-nowrap text-sm">
            <thead className="bg-surface border-b border-line">
              <tr>
                <th className="p-3 font-medium">رقم المرتجع</th>
                <th className="p-3 font-medium">المورد</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">نوع الاسترداد</th>
                <th className="p-3 font-medium">السبب</th>
                <th className="p-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={4} />
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-ink/40">
                    لا توجد مرتجعات بعد
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id} className="border-b border-line erp-table-row">
                    <td className="p-3 font-mono text-amber-400">{r.return_no}</td>
                    <td className="p-3 font-bold text-ink">{r.supplier_name || '—'}</td>
                    <td className="p-3 font-bold text-blue-400">
                      {formatCurrency(r.total_amount)}
                    </td>
                    <td className="p-3">
                      {r.refund_type === 'cash' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                          نقدي
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                          قيد دائن
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-ink/60">{r.reason || '—'}</td>
                    <td className="p-3 text-ink/50">
                      {r.date || r.created_at?.slice(0, 10) || '—'}
                    </td>
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
