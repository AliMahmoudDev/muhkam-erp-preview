import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useToast } from '@/hooks/use-toast';
import { safeArray } from '@/lib/safe-data';
import { useAuth } from '@/contexts/auth';
import {
  Product,
  Warehouse,
  PayType,
  PayRow,
  DiscMode,
  PartLine,
  ReceiptBase,
  SafeRow,
  JobLite,
  PreSavedPart,
  lineDiscountAmount,
  lineNet,
} from './types';
import { getTenantScopedStorageKey } from '@/lib/tenant-storage';

export function useDeliveryGate(job: JobLite, onSaved: () => void) {
  const { user } = useAuth();
  const { toast } = useToast();

  /* ── Safes ── */
  const { data: safesRaw } = useGetSettingsSafes();
  const allSafes: SafeRow[] = safeArray(safesRaw) as SafeRow[];
  const isScopedRole = user?.role === 'cashier' || user?.role === 'salesperson';
  const safes =
    isScopedRole && user?.safe_id ? allSafes.filter((s) => s.id === user.safe_id) : allSafes;

  /* ── Receipt data + service lines (parallel fetch) ── */
  const [receiptData, setReceiptData] = useState<ReceiptBase | null>(null);
  const [fetchErr, setFetchErr] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);

  /* map: product_name → service_amount (للقطع المرتبطة بخدمة، نستخدم الاسم لأن الـ schema لا يحتفظ بـ product_id في repair_job_parts) */
  const [partServiceAmountMap, setPartServiceAmountMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch(api(`/api/repair-jobs/${job.id}/receipt-data`)).then(async (r) => {
        if (!r.ok)
          throw new Error(((await r.json()) as { error?: string }).error ?? 'تعذّر تحميل البيانات');
        return r.json() as Promise<ReceiptBase>;
      }),
      authFetch(api(`/api/repair-jobs/${job.id}/services`)).then((r) =>
        r.ok
          ? (r.json() as Promise<
              Array<{
                amount: string | number;
                linked_parts?: Array<{ id: number; product_name?: string }>;
              }>
            >)
          : Promise.resolve([])
      ),
    ])
      .then(([d, svs]) => {
        if (cancelled) return;
        setReceiptData(d);
        if (d.final_discount > 0) setDiscount(String(d.final_discount));
        /* بناء الـ map: product_name → مبلغ الخدمة المرتبطة */
        const map = new Map<string, number>();
        for (const sv of Array.isArray(svs) ? svs : []) {
          const amt = Number(sv.amount ?? 0);
          for (const lp of sv.linked_parts ?? []) {
            if (lp.product_name) map.set(lp.product_name, amt);
          }
        }
        setPartServiceAmountMap(map);
        setFetchLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setFetchErr(e instanceof Error ? e.message : 'خطأ');
          setFetchLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  /* ── Warehouses ── */
  const { warehouses: warehousesRaw } = useWarehouses();
  const warehouses = warehousesRaw as Warehouse[];
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  useEffect(() => {
    if (warehouses.length === 1 && !selectedWarehouseId) setSelectedWarehouseId(warehouses[0].id);
  }, [warehouses.length, selectedWarehouseId]);

  /* ── Products ── */
  const { data: productsRaw } = useQuery<Product[]>({
    queryKey: ['/api/products', selectedWarehouseId],
    queryFn: () => {
      const url = selectedWarehouseId
        ? api(`/api/products?warehouse_id=${selectedWarehouseId}`)
        : api('/api/products');
      return authFetch(url).then((r) => r.json());
    },
  });
  const products: Product[] = safeArray(productsRaw) as Product[];

  /* ── Draft key ── */
  const draftKey = getTenantScopedStorageKey(`delivery-gate-draft:${job.id}`);
  const [draftRestored, setDraftRestored] = useState(false);

  /* ── Part lines state ── */
  const [partLines, setPartLines] = useState<PartLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [addQty, setAddQty] = useState('1');
  const [addPrice, setAddPrice] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 30);
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productSearch]);

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setAddPrice(String(Number(p.sell_price) || ''));
    setShowProductDrop(false);
  }

  function addPartLine() {
    if (!selectedProduct) return;
    const qty = Math.max(1, parseInt(addQty) || 1);
    const price = parseFloat(addPrice) || 0;
    setPartLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qty,
        unit_price: price,
        warehouse_id: selectedWarehouseId,
        discount_value: 0,
        discount_mode: 'pct',
        source: 'internal',
      },
    ]);
    setSelectedProduct(null);
    setProductSearch('');
    setAddQty('1');
    setAddPrice('');
    productSearchRef.current?.focus();
  }

  /* ── External repair ── */
  const [showExtForm, setShowExtForm] = useState(false);
  const [extVendor, setExtVendor] = useState('');
  const [extDesc, setExtDesc] = useState('');
  const [extPrice, setExtPrice] = useState('');
  const [extVendorCost, setExtVendorCost] = useState('');
  const [extVendorPayType, setExtVendorPayType] = useState<'cash' | 'credit'>('cash');
  const [extVendorSafeId, setExtVendorSafeId] = useState<number | null>(null);

  useEffect(() => {
    if (safes.length === 1 && extVendorSafeId === null) setExtVendorSafeId(safes[0].id);
  }, [safes.length]);

  function addExternalLine() {
    const desc = extDesc.trim();
    const price = parseFloat(extPrice) || 0;
    if (!desc) {
      toast({ title: 'اكتب وصف الإصلاح الخارجي', variant: 'destructive' });
      return;
    }
    if (price <= 0) {
      toast({ title: 'اكتب التكلفة على العميل', variant: 'destructive' });
      return;
    }
    const vCost = parseFloat(extVendorCost) || 0;
    if (vCost > 0 && extVendorPayType === 'cash' && !extVendorSafeId && safes.length > 0) {
      toast({ title: 'اختر الخزنة لدفع تكلفة الورشة نقداً', variant: 'destructive' });
      return;
    }
    const vendor = extVendor.trim();
    setPartLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        product_id: null,
        product_name: vendor ? `${desc} — ورشة: ${vendor}` : desc,
        quantity: 1,
        unit_price: price,
        warehouse_id: null,
        discount_value: 0,
        discount_mode: 'pct',
        source: 'external',
        external_vendor: vendor || undefined,
        vendor_cost: vCost > 0 ? vCost : undefined,
        vendor_payment_type: vCost > 0 ? extVendorPayType : undefined,
        vendor_safe_id: vCost > 0 && extVendorPayType === 'cash' ? extVendorSafeId : undefined,
      },
    ]);
    setExtVendor('');
    setExtDesc('');
    setExtPrice('');
    setExtVendorCost('');
    setExtVendorPayType('cash');
    setShowExtForm(false);
  }

  function updateLineDiscount(id: string, value: number, mode: DiscMode) {
    setPartLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, discount_value: Math.max(0, value), discount_mode: mode } : l
      )
    );
  }

  const partsDiscSum = partLines.reduce((s, l) => s + lineDiscountAmount(l), 0);
  const partsTotal = partLines.reduce((s, l) => s + lineNet(l), 0);

  /* ── Payment state ── */
  const [payRows, setPayRows] = useState<PayRow[]>([]);
  const [payType, setPayType] = useState<PayType>('cash');
  const [paySafe, setPaySafe] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // auto-select first safe so cash payment works without manual selection
  useEffect(() => {
    if (safes.length > 0 && paySafe === null) setPaySafe(safes[0].id);
  }, [safes.length]);

  const paidSoFar = payRows.reduce((s, r) => s + r.amount, 0);

  function addPayRow() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    if (payType === 'cash' && !paySafe && safes.length > 0) {
      toast({ title: 'اختر خزنة لإضافة الدفعة النقدية', variant: 'destructive' });
      return;
    }
    setPayRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: payType,
        safe_id: payType === 'cash' ? paySafe : null,
        amount: amt,
      },
    ]);
    setPayAmount('');
  }

  /* ── Broker ── */
  const [brokerName, setBrokerName] = useState(job.broker_name ?? '');
  const [brokerComm, setBrokerComm] = useState(String(Number(job.broker_commission) || ''));

  /* ── Shipping & discount ── */
  const [cost, setCost] = useState('0');
  const [safeId, setSafeId] = useState<string>('');
  const [discount, setDiscount] = useState('0');

  useEffect(() => {
    if (safes.length === 1 && !safeId) setSafeId(String(safes[0].id));
  }, [safes.length, safeId]);

  /* ── Draft restore ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        partLines?: PartLine[];
        payRows?: PayRow[];
        brokerName?: string;
        brokerComm?: string;
        cost?: string;
        safeId?: string;
        discount?: string;
        selectedWarehouseId?: number | null;
      };
      if (Array.isArray(d.partLines)) setPartLines(d.partLines);
      if (Array.isArray(d.payRows)) setPayRows(d.payRows);
      if (typeof d.brokerName === 'string') setBrokerName(d.brokerName);
      if (typeof d.brokerComm === 'string') setBrokerComm(d.brokerComm);
      if (typeof d.cost === 'string') setCost(d.cost);
      if (typeof d.safeId === 'string') setSafeId(d.safeId);
      if (typeof d.discount === 'string') setDiscount(d.discount);
      if (d.selectedWarehouseId != null) setSelectedWarehouseId(d.selectedWarehouseId);
      setDraftRestored(true);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  /* ── Computed ── */
  const numericCost = Number(cost) || 0;
  const numericDisc = Number(discount) || 0;
  const dep = receiptData?.deposit_paid ?? 0;
  const sc = Math.max(numericCost, 0);
  const disc = Math.max(numericDisc, 0);
  const preSavedPartsTotal = receiptData?.parts_total ?? 0;
  const preSavedParts: PreSavedPart[] = receiptData?.parts ?? [];
  const sub = partsTotal + preSavedPartsTotal + sc;
  const total = Math.max(sub - disc, 0);
  const totalRem = Math.max(total - dep, 0);
  const grandTotal = totalRem;
  const remaining = Math.max(grandTotal - paidSoFar, 0);
  const payIsDone = grandTotal > 0 && paidSoFar >= grandTotal;

  function fillAll() {
    if (remaining <= 0) return;
    setPayAmount(remaining.toFixed(2));
  }

  /* ── Errors & saving ── */
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function buildPreDeliveryBody() {
    const cashTotal = payRows.filter((r) => r.type === 'cash').reduce((s, r) => s + r.amount, 0);
    const primarySafe = payRows.find((r) => r.type === 'cash')?.safe_id ?? paySafe ?? null;
    const pt =
      grandTotal > 0
        ? paidSoFar >= grandTotal
          ? 'cash'
          : paidSoFar > 0
            ? 'partial'
            : 'credit'
        : 'cash';
    return {
      broker_name: brokerName.trim() || null,
      broker_commission: Number(brokerComm) || 0,
      parts: partLines.map((l) => {
        const netUnit = l.quantity > 0 ? lineNet(l) / l.quantity : 0;
        return {
          product_id: l.product_id,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: netUnit,
          warehouse_id: l.warehouse_id,
          source: l.source,
          vendor_cost: l.vendor_cost,
          vendor_payment_type: l.vendor_payment_type,
          vendor_safe_id: l.vendor_safe_id,
        };
      }),
      payment: {
        payment_type: pt,
        paid_amount: cashTotal,
        safe_id: primarySafe,
        payments: payRows.map((r) => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })),
      },
    };
  }

  function handleSave() {
    setErrors([]);
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          v: 1,
          savedAt: new Date().toISOString(),
          partLines,
          payRows,
          brokerName,
          brokerComm,
          cost,
          safeId,
          discount,
          selectedWarehouseId,
        })
      );
      toast({
        title: '✓ تم حفظ بيانات الفاتورة',
        description: 'البيانات محفوظة محلياً. عند مجيء العميل افتح البطاقة واضغط «تأكيد التسليم»',
      });
    } catch {
      toast({ title: 'تعذّر حفظ البيانات محلياً', variant: 'destructive' });
    }
  }

  async function handleConfirm() {
    const errs: string[] = [];
    if (!Number.isFinite(numericCost) || numericCost < 0) errs.push('تكلفة الشحن غير صحيحة');
    if (!Number.isFinite(numericDisc) || numericDisc < 0) errs.push('قيمة الخصم غير صحيحة');
    if (numericCost > 0 && !safeId) errs.push('يجب اختيار خزنة لخصم تكلفة الشحن');
    if (grandTotal > 0 && remaining > 0.01) {
      errs.push(
        `يجب تحديد طريقة دفع المبلغ المتبقي (${remaining.toFixed(2)} ج.م) — اضغط «نقدي» أو «آجل» ثم «إضافة»`
      );
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const r1 = await authFetch(api(`/api/repair-jobs/${job.id}/pre-delivery`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPreDeliveryBody()),
      });
      const d1 = (await r1.json().catch(() => ({}))) as { error?: string };
      if (!r1.ok) {
        setErrors([d1.error ?? 'تعذّر حفظ بيانات المحاسبة']);
        setSaving(false);
        return;
      }

      const deliveryCashPaid = payRows
        .filter((r) => r.type === 'cash')
        .reduce((s, r) => s + r.amount, 0);
      const deliveryCreditAmt = payRows
        .filter((r) => r.type === 'credit')
        .reduce((s, r) => s + r.amount, 0);
      const r2 = await authFetch(api(`/api/repair-jobs/${job.id}/shipping`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_cost: numericCost,
          safe_id: numericCost > 0 ? Number(safeId) : null,
          final_discount: numericDisc,
          notes: `تسليم بطاقة صيانة ${job.job_no}`,
          delivery_grand_total: grandTotal,
          delivery_cash_paid: deliveryCashPaid,
          delivery_credit: deliveryCreditAmt,
        }),
      });
      const d2 = (await r2.json().catch(() => ({}))) as { error?: string };
      if (!r2.ok) {
        setErrors([d2.error ?? 'تعذّر تسجيل بيانات الشحن']);
        setSaving(false);
        return;
      }

      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      toast({ title: '✓ تم التسليم', description: 'تمّت محاسبة العميل وتسجيل التسليم بنجاح' });
      onSaved();
    } catch {
      setErrors(['تعذّر الاتصال بالخادم']);
      setSaving(false);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setPartLines([]);
    setPayRows([]);
    setBrokerName(job.broker_name ?? '');
    setBrokerComm(String(Number(job.broker_commission) || ''));
    setCost('0');
    setDiscount('0');
    setDraftRestored(false);
    toast({ title: 'تم حذف المسوّدة' });
  }

  return {
    safes,
    receiptData,
    fetchErr,
    fetchLoading,
    warehouses,
    selectedWarehouseId,
    setSelectedWarehouseId,
    products,
    filteredProducts,
    productSearch,
    setProductSearch,
    showProductDrop,
    setShowProductDrop,
    productSearchRef,
    addQty,
    setAddQty,
    addPrice,
    setAddPrice,
    selectedProduct,
    setSelectedProduct,
    partLines,
    setPartLines,
    partsTotal,
    partsDiscSum,
    preSavedParts,
    preSavedPartsTotal,
    showExtForm,
    setShowExtForm,
    extVendor,
    setExtVendor,
    extDesc,
    setExtDesc,
    extPrice,
    setExtPrice,
    extVendorCost,
    setExtVendorCost,
    extVendorPayType,
    setExtVendorPayType,
    extVendorSafeId,
    setExtVendorSafeId,
    selectProduct,
    addPartLine,
    addExternalLine,
    updateLineDiscount,
    payRows,
    setPayRows,
    payType,
    setPayType,
    paySafe,
    setPaySafe,
    payAmount,
    setPayAmount,
    paidSoFar,
    addPayRow,
    fillAll,
    payIsDone,
    brokerName,
    setBrokerName,
    brokerComm,
    setBrokerComm,
    cost,
    setCost,
    safeId,
    setSafeId,
    discount,
    setDiscount,
    numericCost: sc,
    numericDisc: disc,
    dep,
    total,
    totalRem,
    grandTotal,
    remaining,
    draftRestored,
    clearDraft,
    errors,
    saving,
    handleSave,
    handleConfirm,
    partServiceAmountMap,
  };
}
