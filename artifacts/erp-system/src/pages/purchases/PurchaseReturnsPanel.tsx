import { useState, useEffect } from 'react';
import { safeArray } from '@/lib/safe-data';
import { useGetCustomers, useGetSettingsSafes } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/format';
import { Plus, Minus, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Combobox } from '@/components/ui/combobox';

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
      {/* New return toggle button */}
      <div className="flex justify-end">
        <Button
          variant={showForm ? 'ghost' : 'default'}
          onClick={() => {
            resetForm();
            setShowForm((v) => !v);
          }}
        >
          <Plus /> مرتجع شراء جديد
        </Button>
      </div>

      {/* New return form */}
      {showForm && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <RotateCcw className="w-5 h-5 text-[var(--brand)]" />
            <h3 className="text-lg font-bold">تسجيل مرتجع شراء</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <label className="block opacity-60 text-xs font-semibold mb-1">المورد</label>
              <Combobox
                options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                value={supplierId}
                onChange={(v) => {
                  setSupplierId(v);
                  setPurchaseId('');
                  setCart([]);
                }}
                placeholder="— اختر المورد —"
                className="w-full"
              />
            </div>

            {/* Linked purchase */}
            <div>
              <label className="block opacity-60 text-xs font-semibold mb-1">
                فاتورة الشراء (اختياري)
              </label>
              <Combobox
                options={postedPurchases.map((p) => ({
                  value: String(p.id),
                  label: `${p.invoice_no}${p.supplier_name ? ` — ${p.supplier_name}` : ''}`,
                }))}
                value={purchaseId}
                onChange={(v) => {
                  setPurchaseId(v);
                  setCart([]);
                }}
                placeholder="— بدون ربط بفاتورة —"
                className="w-full"
              />
              {purchaseId && purchaseItems.length === 0 && (
                <p className="opacity-40 text-xs mt-1">جاري تحميل بنود الفاتورة…</p>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block opacity-60 text-xs font-semibold mb-1">التاريخ</label>
              <input
                type="date"
                className="erp-input w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Refund type */}
            <div>
              <label className="block opacity-60 text-xs font-semibold mb-1">نوع الاسترداد</label>
              <div className="flex gap-2">
                {(['balance_credit', 'cash'] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={refundType === t ? 'outline' : 'ghost'}
                    className={`flex-1 ${
                      refundType === t
                        ? t === 'cash'
                          ? 'border-emerald-500/50 text-emerald-400'
                          : 'border-blue-500/50 text-blue-400'
                        : ''
                    }`}
                    onClick={() => setRefundType(t)}
                  >
                    {t === 'cash' ? '💵 نقدي' : '📒 قيد دائن'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Safe (cash refund only) */}
            {refundType === 'cash' && (
              <div>
                <label className="block opacity-60 text-xs font-semibold mb-1">الخزينة *</label>
                <Combobox
                  options={safes.map((s) => ({ value: String(s.id), label: s.name }))}
                  value={safeId}
                  onChange={(v) => setSafeId(v)}
                  placeholder="— اختر الخزينة —"
                  className="w-full"
                  searchable={false}
                />
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block opacity-60 text-xs font-semibold mb-1">السبب</label>
              <input
                type="text"
                className="erp-input w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: منتج تالف"
              />
            </div>
          </div>

          {/* Cart items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="opacity-60 text-xs font-semibold">أصناف المرتجع</span>
              {cart.length > 0 && (
                <span className="text-[var(--brand)] font-bold text-sm">
                  {formatCurrency(total)}
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <Card className="p-6 text-center">
                <AlertCircle className="w-8 h-8 opacity-20 mx-auto mb-2" />
                <p className="opacity-40 text-sm">
                  {purchaseId
                    ? 'جاري تحميل بنود الفاتورة…'
                    : 'اختر فاتورة لتحميل بنودها تلقائياً'}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-[var(--surface)] rounded-2xl px-4 py-3 border border-[var(--line)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.product_name}</p>
                      <p className="opacity-40 text-xs">
                        {formatCurrency(item.unit_price)} / وحدة
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(idx, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-[var(--surface)] opacity-60 hover:bg-[var(--raised)] flex items-center justify-center"
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
                        className="w-16 text-center bg-[var(--surface)] border border-[var(--line)] rounded-lg text-sm py-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(idx, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-[var(--surface)] opacity-60 hover:bg-[var(--raised)] flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[var(--brand)] font-bold text-sm w-24 text-start shrink-0">
                      {formatCurrency(item.total_price)}
                    </span>
                    <IconButton
                      aria-label="حذف الصنف"
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block opacity-60 text-xs font-semibold mb-1">ملاحظات</label>
            <input
              type="text"
              className="erp-input w-full"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 py-3"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || cart.length === 0}
              loading={createMutation.isPending}
            >
              {createMutation.isPending
                ? 'جاري التسجيل…'
                : `✦ تسجيل المرتجع — ${formatCurrency(total)}`}
            </Button>
            <Button
              variant="ghost"
              className="px-6 py-3"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* Returns history */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <RotateCcw className="w-4 h-4 text-[var(--brand)]" />
          <span className="font-bold text-sm">سجل مرتجعات المشتريات</span>
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : returns.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="لا توجد مرتجعات بعد"
            description="سجّل أول مرتجع شراء للبدء"
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>رقم المرتجع</TableHeader>
                <TableHeader>المورد</TableHeader>
                <TableHeader>الإجمالي</TableHeader>
                <TableHeader>نوع الاسترداد</TableHeader>
                <TableHeader>السبب</TableHeader>
                <TableHeader>التاريخ</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="font-mono font-bold text-[var(--brand)]">
                      {r.return_no}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold">{r.supplier_name || '—'}</span>
                  </TableCell>
                  <TableCell variant="number">
                    <span className="font-bold text-blue-400">
                      {formatCurrency(r.total_amount)}
                    </span>
                  </TableCell>
                  <TableCell variant="status">
                    {r.refund_type === 'cash' ? (
                      <Badge variant="paid">نقدي</Badge>
                    ) : (
                      <Badge variant="info">قيد دائن</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="opacity-60">{r.reason || '—'}</span>
                  </TableCell>
                  <TableCell variant="date">
                    {r.date || r.created_at?.slice(0, 10) || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
