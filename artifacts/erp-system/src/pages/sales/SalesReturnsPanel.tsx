import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { safeArray } from '@/lib/safe-data';
import {
  useGetProducts,
  useGetCustomers,
  useGetSettingsSafes,
} from '@workspace/api-client-react';
import { ConfirmModal } from '@/components/confirm-modal';
import { SearchableSelect } from '@/components/searchable-select';
import { TableSkeleton } from '@/components/skeletons';
import {
  X, Search, RotateCcw, Minus, Plus, CheckCircle, Trash2, Receipt,
} from 'lucide-react';
import type { SalesReturn, InvoiceSummary, InvoiceDetail, ReturnLineItem } from './salesTypes';

export default function SalesReturnsPanel() {
  const { user: currentUser } = useAuth();
  const canCancelSale = hasPermission(currentUser, 'can_cancel_sale') === true;
  const isAdmin = currentUser?.role === 'admin';
  const { toast } = useToast();
  const qc = useQueryClient();

  type Phase = 'list' | 'select-invoice' | 'return-form' | 'standalone';
  const [phase, setPhase] = useState<Phase>('list');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const [returnItems, setReturnItems] = useState<ReturnLineItem[]>([]);
  const [refundType, setRefundType] = useState<'cash' | 'credit'>('credit');
  const [safeId, setSafeId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  const resetStandalone = () =>
    setStandalone({
      customer_id: '',
      reason: '',
      item_id: '',
      quantity: '1',
      refund_type: 'credit',
      safe_id: '',
      date: new Date().toISOString().split('T')[0],
    });
  const [standalone, setStandalone] = useState({
    customer_id: '',
    reason: '',
    item_id: '',
    quantity: '1',
    refund_type: 'credit',
    safe_id: '',
    date: new Date().toISOString().split('T')[0],
  });

  const { data: returns_ = [], isLoading } = useQuery<SalesReturn[]>({
    queryKey: ['/api/sales-returns'],
    queryFn: () =>
      authFetch(api('/api/sales-returns')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (phase !== 'select-invoice') return;
    const t = setTimeout(() => setDebouncedSearch(invoiceSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [invoiceSearch, phase]);

  const invoiceSearchUrl = debouncedSearch
    ? `/api/sales?sort=desc&limit=100&q=${encodeURIComponent(debouncedSearch)}`
    : `/api/sales?sort=desc&limit=40`;

  const { data: salesList = [], isFetching: salesFetching } = useQuery<InvoiceSummary[]>({
    queryKey: ['/api/sales/search', debouncedSearch, phase],
    queryFn: () =>
      authFetch(api(invoiceSearchUrl)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r
          .json()
          .then((d: InvoiceSummary[] | { data: InvoiceSummary[] }) =>
            Array.isArray(d) ? d : ((d as { data: InvoiceSummary[] }).data ?? [])
          );
      }),
    enabled: phase === 'select-invoice',
  });

  const { data: saleDetail } = useQuery<InvoiceDetail>({
    queryKey: ['/api/sales', selectedSaleId],
    queryFn: () =>
      authFetch(api(`/api/sales/${selectedSaleId}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
    enabled: !!selectedSaleId && phase === 'return-form',
  });

  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw).filter((c) => c.is_customer !== false);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);

  const saleDetailItemIds = saleDetail?.items?.map((i) => i.id).join(',') ?? '';
  useEffect(() => {
    if (!saleDetail?.items?.length) return;
    const returnable = saleDetail.items
      .map((i) => ({
        original_sale_item_id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        maxQty: i.quantity - (i.quantity_returned ?? 0),
        returnQty: i.quantity - (i.quantity_returned ?? 0),
        unit_price: i.unit_price,
      }))
      .filter((i) => i.maxQty > 0);
    setReturnItems(returnable);
  }, [saleDetailItemIds]);

  const filteredSales = useMemo(
    () => safeArray(salesList).filter((s) => s.status !== 'cancelled'),
    [salesList]
  );

  const activeReturnItems = returnItems.filter((i) => i.returnQty > 0);
  const returnTotal = activeReturnItems.reduce((s, i) => s + i.returnQty * i.unit_price, 0);
  const totalReturns = returns_.reduce((s, r) => s + r.total_amount, 0);

  const invoiceAlreadyReturned = saleDetail?.items
    ? saleDetail.items.reduce((s, i) => s + (i.quantity_returned ?? 0) * i.unit_price, 0)
    : 0;
  const invoiceReturnableRemaining = saleDetail
    ? saleDetail.total_amount - invoiceAlreadyReturned
    : 0;
  const isOverInvoiceLimit = saleDetail != null && returnTotal > invoiceReturnableRemaining + 0.01;

  const standaloneProduct = products.find((p) => String(p.id) === standalone.item_id);
  const standaloneCustomer = customers.find((c) => String(c.id) === standalone.customer_id);
  const standaloneCustomerItems = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: `${c.customer_code ? `[${c.customer_code}] ` : ''}${c.name}`,
        searchKeys: [String(c.customer_code ?? ''), c.name],
      })),
    [customers]
  );
  const standalonePrice = standaloneProduct ? Number(standaloneProduct.sale_price) : 0;
  const standaloneTotal = (parseInt(standalone.quantity) || 1) * standalonePrice;

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      authFetch(api('/api/sales-returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/sales-returns'] });
      qc.invalidateQueries({ queryKey: ['/api/customers'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      qc.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      if (selectedSaleId) qc.invalidateQueries({ queryKey: ['/api/sales', selectedSaleId] });
      setPhase('list');
      setSelectedSaleId(null);
      setReturnItems([]);
      resetStandalone();
      toast({ title: '✅ تم تسجيل المرتجع — البضاعة عادت للمخزون' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/sales-returns/${id}`), { method: 'DELETE' }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/sales-returns'] });
      qc.invalidateQueries({ queryKey: ['/api/customers'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      toast({ title: 'تم الحذف وعكس جميع الحركات' });
    },
  });

  const handleSubmitReturn = () => {
    if (!activeReturnItems.length) {
      toast({ title: 'حدد كمية إرجاع على الأقل لصنف واحد', variant: 'destructive' });
      return;
    }
    if (isOverInvoiceLimit) {
      toast({
        title: 'لا يمكن إرجاع أكثر من قيمة الفاتورة المتاحة للإرجاع',
        variant: 'destructive',
      });
      return;
    }
    if (refundType === 'cash' && !safeId) {
      toast({ title: 'اختر الخزينة للاسترداد النقدي', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      sale_id: selectedSaleId,
      customer_id: saleDetail?.customer_id ?? null,
      customer_name: saleDetail?.customer_name ?? null,
      reason: reason || null,
      refund_type: refundType,
      safe_id: refundType === 'cash' ? parseInt(safeId) : null,
      date: returnDate,
      items: activeReturnItems.map((i) => ({
        original_sale_item_id: i.original_sale_item_id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.returnQty,
        unit_price: i.unit_price,
        total_price: i.returnQty * i.unit_price,
      })),
    });
  };

  const handleStandaloneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!standalone.item_id) {
      toast({ title: 'اختر الصنف المرتجع', variant: 'destructive' });
      return;
    }
    if (standalone.refund_type === 'cash' && !standalone.safe_id) {
      toast({ title: 'اختر الخزينة', variant: 'destructive' });
      return;
    }
    const qty = parseInt(standalone.quantity) || 1;
    createMutation.mutate({
      customer_id: standalone.customer_id ? parseInt(standalone.customer_id) : null,
      customer_name: standaloneCustomer?.name ?? null,
      reason: standalone.reason || null,
      refund_type: standalone.refund_type,
      safe_id: standalone.refund_type === 'cash' ? parseInt(standalone.safe_id) : null,
      date: standalone.date,
      items: [
        {
          product_id: parseInt(standalone.item_id),
          product_name: standaloneProduct?.name ?? '',
          quantity: qty,
          unit_price: standalonePrice,
          total_price: qty * standalonePrice,
        },
      ],
    });
  };

  const ptLabel = (pt: string) =>
    pt === 'cash'
      ? { label: 'نقدي', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
      : pt === 'credit'
        ? { label: 'آجل', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
        : { label: 'جزئي', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };

  const updateReturnQty = (idx: number, val: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const q = Math.max(0, Math.min(item.maxQty, isNaN(val) ? 0 : val));
        return { ...item, returnQty: q };
      })
    );
  };

  return (
    <div className="space-y-4">
      {confirmDeleteId !== null && (
        <ConfirmModal
          title="حذف مرتجع مبيعات"
          description="سيتم حذف المرتجع وعكس تأثيره على رصيد العميل والمخزون نهائياً."
          isPending={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) })
          }
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <div className="flex gap-3 items-center justify-between flex-wrap">
        {totalReturns > 0 && (
          <div className="glass-panel rounded-2xl px-5 py-2 border border-orange-500/20 bg-orange-500/5 text-sm">
            إجمالي المرتجعات:{' '}
            <span className="text-orange-400 font-black">{formatCurrency(totalReturns)}</span>
          </div>
        )}
        <div className="flex gap-2 mr-auto items-center">
          {isAdmin && (
            <button
              onClick={() => { resetStandalone(); setPhase('standalone'); }}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-white/15 text-white/40 hover:text-white/60 hover:border-white/25 transition-all"
            >
              مرتجع مستقل
            </button>
          )}
          <button
            onClick={() => { setInvoiceSearch(''); setPhase('select-invoice'); }}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> مرتجع جديد
          </button>
        </div>
      </div>

      {phase === 'select-invoice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">اختر الفاتورة المراد إرجاعها</h3>
                <p className="text-white/40 text-xs mt-0.5">ابحث بالرقم أو اسم العميل</p>
              </div>
              <button onClick={() => setPhase('list')} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="p-4 border-b border-white/10 shrink-0">
              <div className="relative">
                <Search
                  className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${salesFetching ? 'text-amber-400 animate-pulse' : 'text-white/30'}`}
                />
                <input
                  autoFocus
                  type="text"
                  className="glass-input icon-pr w-full"
                  placeholder="رقم الفاتورة / اسم العميل / رمز العميل..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />
                {invoiceSearch && (
                  <button
                    onClick={() => setInvoiceSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!invoiceSearch && (
                <p className="text-white/30 text-xs mt-2 text-center">
                  آخر 40 فاتورة — ابحث للعثور على المزيد
                </p>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {salesFetching && filteredSales.length === 0 ? (
                <div className="p-10 text-center text-white/40">جاري البحث…</div>
              ) : filteredSales.length === 0 ? (
                <div className="p-10 text-center text-white/40">لا توجد نتائج</div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="p-3 text-white/50 font-medium">رقم الفاتورة</th>
                      <th className="p-3 text-white/50 font-medium">العميل</th>
                      <th className="p-3 text-white/50 font-medium">نوع الدفع</th>
                      <th className="p-3 text-white/50 font-medium">التاريخ</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => {
                      const pt = ptLabel(sale.payment_type);
                      return (
                        <tr
                          key={sale.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedSaleId(sale.id);
                            setRefundType(sale.payment_type === 'cash' ? 'cash' : 'credit');
                            setSafeId(sale.safe_id ? String(sale.safe_id) : '');
                            setReason('');
                            setReturnDate(new Date().toISOString().split('T')[0]);
                            setReturnItems([]);
                            setPhase('return-form');
                          }}
                        >
                          <td className="p-3 font-mono font-bold text-amber-400">{sale.invoice_no}</td>
                          <td className="p-3 text-white">
                            {sale.customer_name || <span className="text-white/30">نقدي</span>}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${pt.cls}`}>
                              {pt.label}
                            </span>
                          </td>
                          <td className="p-3 text-white/40 text-xs">{sale.date || '—'}</td>
                          <td className="p-3">
                            <button className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'return-form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl w-full max-w-xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setPhase('select-invoice'); setSelectedSaleId(null); setReturnItems([]); }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div>
                  <p className="text-white/50 text-xs">مرتجع من فاتورة</p>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {saleDetail ? saleDetail.invoice_no : 'جاري التحميل...'}
                  </h3>
                </div>
              </div>
              {saleDetail && (
                <div className="text-left">
                  <p className="text-white/40 text-xs">{saleDetail.customer_name || 'نقدي'}</p>
                  <p className="text-amber-400 font-bold text-sm">{formatCurrency(saleDetail.total_amount)}</p>
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {!saleDetail && (
                <div className="py-8 text-center text-white/40 text-sm">جاري تحميل بنود الفاتورة…</div>
              )}
              {saleDetail && returnItems.length === 0 && (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-500/40 mx-auto" />
                  <p className="text-white/40 text-sm">جميع أصناف هذه الفاتورة تم إرجاعها بالكامل</p>
                </div>
              )}
              {returnItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/50 text-xs font-semibold">أصناف الفاتورة</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReturnItems((prev) => prev.map((i) => ({ ...i, returnQty: i.maxQty })))}
                        className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors font-bold"
                      >
                        إرجاع الكل
                      </button>
                      <span className="text-white/20">|</span>
                      <button
                        type="button"
                        onClick={() => setReturnItems((prev) => prev.map((i) => ({ ...i, returnQty: 0 })))}
                        className="text-xs text-white/30 hover:text-white/50 transition-colors"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {returnItems.map((item, idx) => (
                      <div
                        key={item.original_sale_item_id}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${item.returnQty > 0 ? 'bg-orange-500/8 border-orange-500/20' : 'bg-white/3 border-white/8'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{item.product_name}</p>
                          <p className="text-white/40 text-xs">
                            {formatCurrency(item.unit_price)} × {item.maxQty} ←{' '}
                            {item.maxQty !== (saleDetail?.items?.find((i) => i.id === item.original_sale_item_id)?.quantity ?? item.maxQty) ? 'متبقي' : 'الكمية المباعة'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateReturnQty(idx, item.returnQty - 1)}
                            className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={item.maxQty}
                            step={1}
                            value={item.returnQty}
                            onChange={(e) => updateReturnQty(idx, parseFloat(e.target.value))}
                            className="w-14 text-center bg-white/10 border border-white/20 rounded-lg text-white text-sm py-1 font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => updateReturnQty(idx, item.returnQty + 1)}
                            className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span
                          className={`text-sm font-bold w-20 text-left shrink-0 tabular-nums ${item.returnQty > 0 ? 'text-orange-400' : 'text-white/20'}`}
                        >
                          {formatCurrency(item.returnQty * item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {returnItems.length > 0 && saleDetail && (
                <>
                  <div>
                    <label className="text-white/50 text-xs font-semibold block mb-2">نوع الاسترداد</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRefundType('credit')}
                        className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${refundType === 'credit' ? 'bg-blue-500/25 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}
                      >
                        📒 خصم رصيد العميل
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefundType('cash')}
                        className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${refundType === 'cash' ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'}`}
                      >
                        💵 استرداد نقدي
                      </button>
                    </div>
                    {saleDetail.payment_type === 'cash' && refundType === 'credit' && (
                      <p className="text-amber-400/70 text-xs mt-1.5">⚠ الفاتورة الأصلية نقدية — يُنصح بالاسترداد نقدياً</p>
                    )}
                    {saleDetail.payment_type === 'credit' && refundType === 'cash' && (
                      <p className="text-blue-400/70 text-xs mt-1.5">⚠ الفاتورة الأصلية آجل — يُنصح بخصم الرصيد</p>
                    )}
                  </div>

                  {refundType === 'cash' && (
                    <div>
                      <label className="text-white/50 text-xs font-semibold block mb-1">الخزينة الصارفة *</label>
                      <select
                        className="glass-input w-full appearance-none"
                        value={safeId}
                        onChange={(e) => setSafeId(e.target.value)}
                      >
                        <option value="" className="bg-gray-900">— اختر خزينة —</option>
                        {safes.map((s) => (
                          <option key={s.id} value={String(s.id)} className="bg-gray-900">{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs font-semibold block mb-1">التاريخ</label>
                      <input type="date" className="glass-input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs font-semibold block mb-1">سبب الإرجاع</label>
                      <input type="text" className="glass-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="عيب مصنعي..." />
                    </div>
                  </div>

                  {saleDetail && invoiceAlreadyReturned > 0 && (
                    <div className="bg-white/3 border border-white/8 rounded-xl px-3 py-2 text-xs space-y-1">
                      <div className="flex justify-between text-white/40">
                        <span>تم إرجاعه سابقاً</span>
                        <span className="tabular-nums">{formatCurrency(invoiceAlreadyReturned)}</span>
                      </div>
                      <div className="flex justify-between text-white/55 font-bold">
                        <span>الحد الأقصى المتاح</span>
                        <span className="tabular-nums text-amber-400/80">{formatCurrency(invoiceReturnableRemaining)}</span>
                      </div>
                    </div>
                  )}

                  {activeReturnItems.length > 0 && (
                    <div
                      className={`rounded-2xl px-4 py-3 flex justify-between items-center border transition-all ${isOverInvoiceLimit ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/25'}`}
                    >
                      <div>
                        <span className={`text-sm font-bold ${isOverInvoiceLimit ? 'text-red-400' : 'text-white/60'}`}>
                          إجمالي المرتجع ({activeReturnItems.length} صنف)
                        </span>
                        {isOverInvoiceLimit && (
                          <p className="text-red-400 text-xs mt-0.5">⚠ يتجاوز الحد المسموح به</p>
                        )}
                      </div>
                      <span className={`font-black text-lg tabular-nums ${isOverInvoiceLimit ? 'text-red-400' : 'text-orange-400'}`}>
                        {formatCurrency(returnTotal)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {returnItems.length > 0 && saleDetail && (
              <div className="p-5 border-t border-white/10 shrink-0 flex gap-3">
                <button
                  onClick={handleSubmitReturn}
                  disabled={createMutation.isPending || activeReturnItems.length === 0 || isOverInvoiceLimit}
                  className={`flex-1 py-3 font-bold disabled:opacity-40 rounded-xl transition-all ${isOverInvoiceLimit ? 'bg-red-500/20 border border-red-500/30 text-red-400 cursor-not-allowed' : 'btn-primary'}`}
                >
                  {createMutation.isPending
                    ? 'جاري التسجيل…'
                    : isOverInvoiceLimit
                      ? '⚠ تجاوز حد الإرجاع'
                      : `✦ تسجيل المرتجع${returnTotal > 0 ? ` — ${formatCurrency(returnTotal)}` : ''}`}
                </button>
                <button
                  onClick={() => { setPhase('list'); setSelectedSaleId(null); setReturnItems([]); }}
                  className="px-5 btn-secondary py-3"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'standalone' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
          <form
            onSubmit={handleStandaloneSubmit}
            className="glass-panel rounded-3xl p-7 w-full max-w-md border border-white/10 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">مرتجع مستقل</h3>
                <p className="text-white/40 text-xs mt-0.5">مقتصر على المسؤول — بدون ربط بفاتورة</p>
              </div>
              <button type="button" onClick={() => setPhase('list')} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['credit', 'cash'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStandalone((f) => ({ ...f, refund_type: t, safe_id: '' }))}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${standalone.refund_type === t ? (t === 'cash' ? 'bg-emerald-500/30 border-emerald-500/60 text-emerald-300' : 'bg-blue-500/30 border-blue-500/60 text-blue-300') : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  {t === 'cash' ? 'استرداد نقدي' : 'خصم رصيد'}
                </button>
              ))}
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">العميل</label>
              <SearchableSelect
                items={standaloneCustomerItems}
                value={standalone.customer_id}
                onChange={(v) => setStandalone((f) => ({ ...f, customer_id: v }))}
                placeholder="ابحث باسم أو كود..."
                emptyLabel="-- نقدي --"
              />
            </div>
            {standalone.refund_type === 'cash' && (
              <div>
                <label className="text-white/60 text-xs mb-1 block">الخزينة *</label>
                <select
                  required
                  className="glass-input w-full appearance-none"
                  value={standalone.safe_id}
                  onChange={(e) => setStandalone((f) => ({ ...f, safe_id: e.target.value }))}
                >
                  <option value="" className="bg-gray-900">-- اختر خزينة --</option>
                  {safes.map((s) => (
                    <option key={s.id} value={String(s.id)} className="bg-gray-900">{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-white/60 text-xs mb-1 block">الصنف *</label>
              <select
                required
                className="glass-input w-full appearance-none"
                value={standalone.item_id}
                onChange={(e) => setStandalone((f) => ({ ...f, item_id: e.target.value }))}
              >
                <option value="" className="bg-gray-900">-- اختر صنف --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">الكمية</label>
                <input
                  type="number"
                  min="1"
                  className="glass-input"
                  value={standalone.quantity}
                  onChange={(e) => setStandalone((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">سعر الوحدة</label>
                <div className="glass-input opacity-70 cursor-not-allowed">
                  <span className="text-emerald-400 font-bold">
                    {standaloneProduct ? formatCurrency(standalonePrice) : '—'}
                  </span>
                </div>
              </div>
            </div>
            {standaloneTotal > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 flex justify-between">
                <span className="text-white/60 text-sm">الإجمالي</span>
                <span className="text-orange-400 font-bold">{formatCurrency(standaloneTotal)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">التاريخ</label>
                <input type="date" className="glass-input" value={standalone.date} onChange={(e) => setStandalone((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">السبب</label>
                <input type="text" className="glass-input" value={standalone.reason} onChange={(e) => setStandalone((f) => ({ ...f, reason: e.target.value }))} placeholder="اختياري..." />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={createMutation.isPending} className="flex-1 btn-primary py-3">
                {createMutation.isPending ? 'جاري الحفظ...' : 'تسجيل المرتجع'}
              </button>
              <button type="button" onClick={() => setPhase('list')} className="flex-1 btn-secondary py-3">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 text-white/60">رقم المرتجع</th>
                <th className="p-4 text-white/60">العميل</th>
                <th className="p-4 text-white/60">الإجمالي</th>
                <th className="p-4 text-white/60">نوع الاسترداد</th>
                <th className="p-4 text-white/60">السبب</th>
                <th className="p-4 text-white/60">التاريخ</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={7} rows={5} />
              ) : returns_.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-white/40">لا توجد مرتجعات</td>
                </tr>
              ) : (
                returns_.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-4 font-bold text-amber-400 font-mono">{r.return_no}</td>
                    <td className="p-4 text-white">{r.customer_name || 'عميل نقدي'}</td>
                    <td className="p-4 font-bold text-orange-400">{formatCurrency(r.total_amount)}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${r.refund_type === 'cash' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                      >
                        {r.refund_type === 'cash' ? `نقدي — ${r.safe_name || ''}` : 'خصم رصيد'}
                      </span>
                    </td>
                    <td className="p-4 text-white/50">{r.reason || '—'}</td>
                    <td className="p-4 text-white/40 text-xs">{r.date || formatDate(r.created_at)}</td>
                    <td className="p-4">
                      {canCancelSale && (
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
