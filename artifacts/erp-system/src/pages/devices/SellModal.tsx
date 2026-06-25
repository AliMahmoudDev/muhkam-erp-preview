import { useState, useMemo } from 'react';
import { Smartphone, CheckCircle2, XCircle, ShoppingCart, User, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth';
import { useGetCustomers } from '@workspace/api-client-react';
import { safeArray } from '@/lib/safe-data';
import { SearchableSelect } from '@/components/searchable-select';
import type { Device, PaymentMethod, PaymentStatus } from './types';
import { apiPost, WARRANTY_OPTS, PAY_METHODS } from './index';
import { Combobox } from '@/components/ui/combobox';

/* ════════════════════════════════════════════════════════
   SELL DEVICE MODAL
════════════════════════════════════════════════════════ */
export function SellModal({
  device,
  onClose,
  onDone,
}: {
  device: Device;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const { data: customersRaw } = useGetCustomers();
  const customerItems = useMemo(() => {
    const list = safeArray(customersRaw as { id: number; name: string }[] | undefined);
    return list.map((c) => ({ value: String(c.id), label: c.name, searchKeys: [c.name] }));
  }, [customersRaw]);
  const [basePrice, setBasePrice] = useState(parseFloat(device.sale_price ?? '0'));
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [discountVal, setDiscountVal] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payStatus, setPayStatus] = useState<PaymentStatus>('paid');
  const [warrantyMonths, setWarrantyMonths] = useState(3);
  const [saving, setSaving] = useState(false);

  const discountAmount =
    discountType === 'percent'
      ? Math.round((basePrice * discountVal) / 100)
      : discountType === 'fixed'
        ? discountVal
        : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleSell = async () => {
    if (!customerName.trim() && !customerId) {
      toast({ title: 'أدخل اسم العميل أو اختر عميلاً', variant: 'destructive' });
      return;
    }
    const resolvedName = customerId
      ? (customerItems.find((c) => c.value === customerId)?.label ?? customerName.trim())
      : customerName.trim();
    setSaving(true);
    try {
      await apiPost(`/api/devices/${device.id}/sell`, {
        customer_name: resolvedName,
        customer_id: customerId ? Number(customerId) : undefined,
        sold_price: finalPrice,
        payment_method: payMethod,
        payment_status: payStatus,
        warranty_months: warrantyMonths,
        sold_by_name: (user as { name?: string })?.name,
      });
      toast({ title: '✅ تم بيع الجهاز بنجاح' });
      onDone();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'خطأ';
      toast({ title: msg || 'خطأ في البيع', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const lCls = 'text-[11px] text-ink/40 mb-1 block text-right';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 bg-black/70 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="glass-panel rounded-2xl border border-line w-full max-w-sm mx-4 my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-bold text-ink text-sm">بيع الجهاز</span>
              <p className="text-[10px] text-ink/30">
                {device.brand} {device.model}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon text-ink/40 hover:text-ink">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Device summary */}
        <div className="mx-4 mt-4 flex items-center gap-3 p-3 bg-surface rounded-xl border border-line">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink text-sm truncate">
              {device.brand} {device.model}
            </p>
            <p className="text-ink/40 text-xs mt-0.5">
              {device.storage && <span className="ml-2">{device.storage}</span>}
              {device.color && <span className="ml-2">· {device.color}</span>}
              {device.imei && (
                <span className="ml-2 font-mono">· IMEI: ···{device.imei.slice(-4)}</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 font-bold text-sm">{finalPrice.toLocaleString()} ج.م</p>
            <p className="text-ink/25 text-[10px]">سعر البيع</p>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Customer */}
          <div>
            <label className={lCls}>العميل *</label>
            {customerItems.length > 0 ? (
              <SearchableSelect
                items={customerItems}
                value={customerId}
                onChange={(id) => {
                  setCustomerId(id);
                  setCustomerName('');
                }}
                placeholder="ابحث في العملاء..."
              />
            ) : null}
            {!customerId && (
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={
                  customerItems.length > 0 ? 'أو أدخل اسم عميل جديد...' : 'اسم العميل...'
                }
                className={`erp-input w-full text-sm ${customerItems.length > 0 ? 'mt-2' : ''}`}
              />
            )}
            {customerId && (
              <button
                onClick={() => setCustomerId('')}
                className="mt-1 text-xs text-ink/30 hover:text-red-400 transition-colors"
              >
                × إلغاء التحديد
              </button>
            )}
          </div>

          {/* Base price */}
          <div>
            <label className={lCls}>سعر البيع الأساسي</label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
              className="erp-input w-full text-sm"
            />
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lCls}>نوع الخصم</label>
              <Combobox
                options={[
                  { value: 'none', label: 'بدون خصم' },
                  { value: 'percent', label: 'نسبة %' },
                  { value: 'fixed', label: 'مبلغ ثابت' },
                ]}
                value={discountType}
                onChange={(v) => {
                  setDiscountType(v as 'none' | 'percent' | 'fixed');
                  setDiscountVal(0);
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className={lCls}>قيمة الخصم</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={discountVal}
                  onChange={(e) => setDiscountVal(parseFloat(e.target.value) || 0)}
                  disabled={discountType === 'none'}
                  className="erp-input w-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                />
                {discountType === 'percent' && (
                  <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-ink/30 pointer-events-none" />
                )}
              </div>
            </div>
          </div>
          {discountType !== 'none' && discountAmount > 0 && (
            <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
              <span className="text-ink/50">الخصم: {discountAmount.toLocaleString()} ج.م</span>
              <span className="text-emerald-400 font-bold">
                الإجمالي بعد الخصم: {finalPrice.toLocaleString()} ج.م
              </span>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className={lCls}>طريقة الدفع</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAY_METHODS.map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setPayMethod(v)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                    payMethod === v
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-line bg-surface text-ink/40 hover:text-ink/70'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Payment status */}
          <div>
            <label className={lCls}>حالة الدفع</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  [
                    'paid',
                    'مدفوع بالكامل',
                    'text-emerald-300 bg-emerald-500/15 border-emerald-500/50',
                  ],
                  ['partial', 'دفع جزئي', 'text-amber-300 bg-amber-500/15 border-amber-500/50'],
                  ['unpaid', 'غير مدفوع', 'text-red-300 bg-red-500/15 border-red-500/50'],
                ] as [PaymentStatus, string, string][]
              ).map(([v, l, cls]) => (
                <button
                  key={v}
                  onClick={() => setPayStatus(v)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    payStatus === v ? cls : 'border-line bg-surface text-ink/40 hover:text-ink/70'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Warranty + Seller */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lCls}>فترة الضمان</label>
              <Combobox
                options={WARRANTY_OPTS.map((o) => ({ value: String(o.value), label: o.label }))}
                value={String(warrantyMonths)}
                onChange={(v) => setWarrantyMonths(parseInt(v))}
                className="w-full"
              />
            </div>
            <div>
              <label className={lCls}>البائع</label>
              <div className="erp-input w-full text-sm text-ink/50 flex items-center gap-1.5">
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">{(user as { name?: string })?.name ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-line text-ink/50 text-sm hover:text-ink/80"
          >
            إلغاء
          </button>
          <button
            onClick={handleSell}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            تأكيد البيع
          </button>
        </div>
      </div>
    </div>
  );
}
