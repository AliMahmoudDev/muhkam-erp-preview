import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { SearchableSelect } from '@/components/searchable-select';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Combobox } from '@/components/ui/combobox';

interface Safe {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  sale_price: number;
}

interface StandaloneFormData {
  customer_id: string;
  reason: string;
  item_id: string;
  quantity: string;
  refund_type: string;
  safe_id: string;
  date: string;
}

interface StandaloneReturnFormProps {
  standalone: StandaloneFormData;
  setStandalone: React.Dispatch<React.SetStateAction<StandaloneFormData>>;
  standaloneCustomerItems: Array<{ value: string; label: string; searchKeys: string[] }>;
  products: Product[];
  safes: Safe[];
  standalonePrice: number;
  standaloneTotal: number;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function StandaloneReturnForm({
  standalone,
  setStandalone,
  standaloneCustomerItems,
  products,
  safes,
  standalonePrice,
  standaloneTotal,
  isPending,
  onSubmit,
  onClose,
}: StandaloneReturnFormProps) {
  const standaloneProduct = products.find((p) => String(p.id) === standalone.item_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <Card className="p-7 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">مرتجع مستقل</h3>
              <p className="opacity-40 text-xs mt-0.5">مقتصر على المسؤول — بدون ربط بفاتورة</p>
            </div>
            <IconButton
              type="button"
              aria-label="إغلاق"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X />
            </IconButton>
          </div>

          {/* Refund type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(['credit', 'cash'] as const).map((t) => (
              <Button
                key={t}
                type="button"
                variant={standalone.refund_type === t ? 'outline' : 'ghost'}
                className={
                  standalone.refund_type === t
                    ? t === 'cash'
                      ? 'border-emerald-500/60 text-emerald-300'
                      : 'border-blue-500/60 text-blue-300'
                    : ''
                }
                onClick={() => setStandalone((f) => ({ ...f, refund_type: t, safe_id: '' }))}
              >
                {t === 'cash' ? 'استرداد نقدي' : 'خصم رصيد'}
              </Button>
            ))}
          </div>

          {/* Customer */}
          <div>
            <label className="opacity-60 text-xs mb-1 block">العميل</label>
            <SearchableSelect
              items={standaloneCustomerItems}
              value={standalone.customer_id}
              onChange={(v) => setStandalone((f) => ({ ...f, customer_id: v }))}
              placeholder="ابحث باسم أو كود..."
              emptyLabel="-- نقدي --"
            />
          </div>

          {/* Safe */}
          {standalone.refund_type === 'cash' && (
            <div>
              <label className="opacity-60 text-xs mb-1 block">الخزينة *</label>
              <Combobox
                options={safes.map((s) => ({ value: String(s.id), label: s.name }))}
                value={standalone.safe_id}
                onChange={(v) => setStandalone((f) => ({ ...f, safe_id: v }))}
                placeholder="-- اختر خزينة --"
                className="w-full"
              />
            </div>
          )}

          {/* Product */}
          <div>
            <label className="opacity-60 text-xs mb-1 block">الصنف *</label>
            <Combobox
              options={products.map((p) => ({ value: String(p.id), label: p.name }))}
              value={standalone.item_id}
              onChange={(v) => setStandalone((f) => ({ ...f, item_id: v }))}
              placeholder="-- اختر صنف --"
              className="w-full"
            />
          </div>

          {/* Qty + price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opacity-60 text-xs mb-1 block">الكمية</label>
              <input
                type="number"
                min="1"
                className="erp-input w-full"
                value={standalone.quantity}
                onChange={(e) => setStandalone((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="opacity-60 text-xs mb-1 block">سعر الوحدة</label>
              <div className="erp-input opacity-70 cursor-not-allowed">
                <span className="text-emerald-400 font-bold">
                  {standaloneProduct ? formatCurrency(standalonePrice) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Total */}
          {standaloneTotal > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 flex justify-between">
              <span className="opacity-60 text-sm">الإجمالي</span>
              <span className="text-orange-400 font-bold">{formatCurrency(standaloneTotal)}</span>
            </div>
          )}

          {/* Date + reason */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="opacity-60 text-xs mb-1 block">التاريخ</label>
              <input
                type="date"
                className="erp-input w-full"
                value={standalone.date}
                onChange={(e) => setStandalone((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="opacity-60 text-xs mb-1 block">السبب</label>
              <input
                type="text"
                className="erp-input w-full"
                value={standalone.reason}
                onChange={(e) => setStandalone((f) => ({ ...f, reason: e.target.value }))}
                placeholder="اختياري..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="submit" disabled={isPending} loading={isPending} className="flex-1 py-3">
              {isPending ? 'جاري الحفظ...' : 'تسجيل المرتجع'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3">
              إلغاء
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
