import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { safeArray } from '@/lib/safe-data';
import {
  useGetProducts,
  useGetCustomers,
  useGetSettingsSafes,
} from '@workspace/api-client-react';
import { ConfirmModal } from '@/components/confirm-modal';
import { RotateCcw } from 'lucide-react';
import type { SalesReturn, InvoiceSummary, InvoiceDetail, ReturnLineItem } from './salesTypes';
import { InvoiceSearchModal } from './returns/InvoiceSearchModal';
import { InvoiceReturnForm } from './returns/InvoiceReturnForm';
import { StandaloneReturnForm } from './returns/StandaloneReturnForm';
import { SalesReturnsList } from './returns/SalesReturnsList';


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
      toast({ title: 'لا يمكن إرجاع أكثر من قيمة الفاتورة المتاحة للإرجاع', variant: 'destructive' });
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


  const updateReturnQty = (idx: number, val: number) => {
    // Sentinel values for bulk actions from child component
    if (idx === -1) {
      setReturnItems((prev) => prev.map((i) => ({ ...i, returnQty: i.maxQty })));
      return;
    }
    if (idx === -2) {
      setReturnItems((prev) => prev.map((i) => ({ ...i, returnQty: 0 })));
      return;
    }
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const q = Math.max(0, Math.min(item.maxQty, isNaN(val) ? 0 : val));
        return { ...item, returnQty: q };
      })
    );
  };

  const handleSelectInvoice = (sale: InvoiceSummary) => {
    setSelectedSaleId(sale.id);
    setRefundType(sale.payment_type === 'cash' ? 'cash' : 'credit');
    setSafeId(sale.safe_id ? String(sale.safe_id) : '');
    setReason('');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnItems([]);
    setPhase('return-form');
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
        <InvoiceSearchModal
          invoiceSearch={invoiceSearch}
          setInvoiceSearch={setInvoiceSearch}
          filteredSales={filteredSales}
          salesFetching={salesFetching}
          onSelectInvoice={handleSelectInvoice}
          onClose={() => setPhase('list')}
        />
      )}

      {phase === 'return-form' && (
        <InvoiceReturnForm
          saleDetail={saleDetail}
          returnItems={returnItems}
          activeReturnItems={activeReturnItems}
          returnTotal={returnTotal}
          refundType={refundType}
          setRefundType={setRefundType}
          safeId={safeId}
          setSafeId={setSafeId}
          safes={safes}
          reason={reason}
          setReason={setReason}
          returnDate={returnDate}
          setReturnDate={setReturnDate}
          invoiceAlreadyReturned={invoiceAlreadyReturned}
          invoiceReturnableRemaining={invoiceReturnableRemaining}
          isOverInvoiceLimit={isOverInvoiceLimit}
          isPending={createMutation.isPending}
          updateReturnQty={updateReturnQty}
          onSubmit={handleSubmitReturn}
          onBack={() => { setPhase('select-invoice'); setSelectedSaleId(null); setReturnItems([]); }}
          onCancel={() => { setPhase('list'); setSelectedSaleId(null); setReturnItems([]); }}
        />
      )}

      {phase === 'standalone' && (
        <StandaloneReturnForm
          standalone={standalone}
          setStandalone={setStandalone}
          standaloneCustomerItems={standaloneCustomerItems}
          products={products}
          safes={safes}
          standalonePrice={standalonePrice}
          standaloneTotal={standaloneTotal}
          isPending={createMutation.isPending}
          onSubmit={handleStandaloneSubmit}
          onClose={() => setPhase('list')}
        />
      )}

      <SalesReturnsList
        returns={returns_}
        isLoading={isLoading}
        canDelete={canCancelSale}
        onDelete={(id) => setConfirmDeleteId(id)}
      />
    </div>
  );
}
