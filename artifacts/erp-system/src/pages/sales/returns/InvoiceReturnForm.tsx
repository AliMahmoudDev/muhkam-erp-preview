import { X, Minus, Plus, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { InvoiceDetail, ReturnLineItem } from '../salesTypes';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

interface Safe {
  id: number;
  name: string;
}

interface InvoiceReturnFormProps {
  saleDetail: InvoiceDetail | undefined;
  returnItems: ReturnLineItem[];
  activeReturnItems: ReturnLineItem[];
  returnTotal: number;
  refundType: 'cash' | 'credit';
  setRefundType: (v: 'cash' | 'credit') => void;
  safeId: string;
  setSafeId: (v: string) => void;
  safes: Safe[];
  reason: string;
  setReason: (v: string) => void;
  returnDate: string;
  setReturnDate: (v: string) => void;
  invoiceAlreadyReturned: number;
  invoiceReturnableRemaining: number;
  isOverInvoiceLimit: boolean;
  isPending: boolean;
  updateReturnQty: (idx: number, val: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export function InvoiceReturnForm({
  saleDetail,
  returnItems,
  activeReturnItems,
  returnTotal,
  refundType,
  setRefundType,
  safeId,
  setSafeId,
  safes,
  reason,
  setReason,
  returnDate,
  setReturnDate,
  invoiceAlreadyReturned,
  invoiceReturnableRemaining,
  isOverInvoiceLimit,
  isPending,
  updateReturnQty,
  onSubmit,
  onBack,
  onCancel,
}: InvoiceReturnFormProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
      <Card className="w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)] shrink-0">
          <div className="flex items-center gap-3">
            <IconButton
              aria-label="رجوع"
              variant="ghost"
              size="sm"
              onClick={onBack}
            >
              <X />
            </IconButton>
            <div>
              <p className="opacity-50 text-xs">مرتجع من فاتورة</p>
              <h3 className="text-lg font-bold leading-tight">
                {saleDetail ? saleDetail.invoice_no : 'جاري التحميل...'}
              </h3>
            </div>
          </div>
          {saleDetail && (
            <div className="text-start">
              <p className="opacity-40 text-xs">{saleDetail.customer_name || 'نقدي'}</p>
              <p className="text-[var(--brand)] font-bold text-sm">
                {formatCurrency(saleDetail.total_amount)}
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {!saleDetail && (
            <div className="py-8 text-center opacity-40 text-sm">جاري تحميل بنود الفاتورة…</div>
          )}
          {saleDetail && returnItems.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500/40 mx-auto" />
              <p className="opacity-40 text-sm">جميع أصناف هذه الفاتورة تم إرجاعها بالكامل</p>
            </div>
          )}

          {returnItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="opacity-50 text-xs font-semibold">أصناف الفاتورة</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateReturnQty(-1, -1)}
                    className="text-xs text-[var(--brand)]/70 hover:text-[var(--brand)] transition-colors font-bold"
                  >
                    إرجاع الكل
                  </button>
                  <span className="opacity-20">|</span>
                  <button
                    type="button"
                    onClick={() => updateReturnQty(-2, 0)}
                    className="text-xs opacity-30 hover:opacity-50 transition-opacity"
                  >
                    إلغاء الكل
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {returnItems.map((item, idx) => (
                  <div
                    key={item.original_sale_item_id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${item.returnQty > 0 ? 'bg-orange-500/8 border-orange-500/20' : 'bg-[var(--surface)] border-[var(--line)]'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.product_name}</p>
                      <p className="opacity-40 text-xs">
                        {formatCurrency(item.unit_price)} × {item.maxQty} ←{' '}
                        {item.maxQty !==
                        (saleDetail?.items?.find((i) => i.id === item.original_sale_item_id)
                          ?.quantity ?? item.maxQty)
                          ? 'متبقي'
                          : 'الكمية المباعة'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateReturnQty(idx, item.returnQty - 1)}
                        className="w-7 h-7 rounded-lg bg-[var(--surface)] opacity-60 hover:bg-[var(--raised)] flex items-center justify-center"
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
                        className="w-14 text-center bg-[var(--surface)] border border-[var(--line)] rounded-lg text-sm py-1 font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => updateReturnQty(idx, item.returnQty + 1)}
                        className="w-7 h-7 rounded-lg bg-[var(--surface)] opacity-60 hover:bg-[var(--raised)] flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span
                      className={`text-sm font-bold w-20 text-start shrink-0 tabular-nums ${item.returnQty > 0 ? 'text-orange-400' : 'opacity-20'}`}
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
              {/* Refund type */}
              <div>
                <label className="opacity-50 text-xs font-semibold block mb-2">نوع الاسترداد</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={refundType === 'credit' ? 'outline' : 'ghost'}
                    className={refundType === 'credit' ? 'border-blue-500/50 text-blue-300' : ''}
                    onClick={() => setRefundType('credit')}
                  >
                    📒 خصم رصيد العميل
                  </Button>
                  <Button
                    type="button"
                    variant={refundType === 'cash' ? 'outline' : 'ghost'}
                    className={refundType === 'cash' ? 'border-emerald-500/50 text-emerald-300' : ''}
                    onClick={() => setRefundType('cash')}
                  >
                    💵 استرداد نقدي
                  </Button>
                </div>
                {saleDetail.payment_type === 'cash' && refundType === 'credit' && (
                  <p className="text-[var(--brand)]/70 text-xs mt-1.5">
                    ⚠ الفاتورة الأصلية نقدية — يُنصح بالاسترداد نقدياً
                  </p>
                )}
                {saleDetail.payment_type === 'credit' && refundType === 'cash' && (
                  <p className="text-blue-400/70 text-xs mt-1.5">
                    ⚠ الفاتورة الأصلية آجل — يُنصح بخصم الرصيد
                  </p>
                )}
              </div>

              {/* Safe selector */}
              {refundType === 'cash' && (
                <div>
                  <label className="opacity-50 text-xs font-semibold block mb-1">
                    الخزينة الصارفة *
                  </label>
                  <select
                    className="erp-input w-full"
                    value={safeId}
                    onChange={(e) => setSafeId(e.target.value)}
                  >
                    <option value="">— اختر خزينة —</option>
                    {safes.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date + reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="opacity-50 text-xs font-semibold block mb-1">التاريخ</label>
                  <input
                    type="date"
                    className="erp-input w-full"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="opacity-50 text-xs font-semibold block mb-1">سبب الإرجاع</label>
                  <input
                    type="text"
                    className="erp-input w-full"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="عيب مصنعي..."
                  />
                </div>
              </div>

              {/* Already returned info */}
              {saleDetail && invoiceAlreadyReturned > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs space-y-1">
                  <div className="flex justify-between opacity-40">
                    <span>تم إرجاعه سابقاً</span>
                    <span className="tabular-nums">{formatCurrency(invoiceAlreadyReturned)}</span>
                  </div>
                  <div className="flex justify-between font-bold opacity-55">
                    <span>الحد الأقصى المتاح</span>
                    <span className="tabular-nums text-[var(--brand)]/80">
                      {formatCurrency(invoiceReturnableRemaining)}
                    </span>
                  </div>
                </div>
              )}

              {/* Return total */}
              {activeReturnItems.length > 0 && (
                <div
                  className={`rounded-2xl px-4 py-3 flex justify-between items-center border transition-all ${isOverInvoiceLimit ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/25'}`}
                >
                  <div>
                    <span
                      className={`text-sm font-bold ${isOverInvoiceLimit ? 'text-red-400' : 'opacity-60'}`}
                    >
                      إجمالي المرتجع ({activeReturnItems.length} صنف)
                    </span>
                    {isOverInvoiceLimit && (
                      <p className="text-red-400 text-xs mt-0.5">⚠ يتجاوز الحد المسموح به</p>
                    )}
                  </div>
                  <span
                    className={`font-black text-lg tabular-nums ${isOverInvoiceLimit ? 'text-red-400' : 'text-orange-400'}`}
                  >
                    {formatCurrency(returnTotal)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {returnItems.length > 0 && saleDetail && (
          <div className="p-5 border-t border-[var(--line)] shrink-0 flex gap-3">
            <Button
              className={`flex-1 py-3 ${isOverInvoiceLimit ? 'bg-red-500/20 border-red-500/30 text-red-400 cursor-not-allowed' : ''}`}
              variant={isOverInvoiceLimit ? 'ghost' : 'default'}
              onClick={onSubmit}
              disabled={isPending || activeReturnItems.length === 0 || isOverInvoiceLimit}
              loading={isPending}
            >
              {isPending
                ? 'جاري التسجيل…'
                : isOverInvoiceLimit
                  ? '⚠ تجاوز حد الإرجاع'
                  : `✦ تسجيل المرتجع${returnTotal > 0 ? ` — ${formatCurrency(returnTotal)}` : ''}`}
            </Button>
            <Button variant="ghost" className="px-5 py-3" onClick={onCancel}>
              إلغاء
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
