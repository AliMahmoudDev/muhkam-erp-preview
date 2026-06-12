import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { SearchableSelect } from '@/components/searchable-select';

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
        className="glass-panel rounded-3xl p-7 w-full max-w-md border border-line shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-ink">مرتجع مستقل</h3>
            <p className="text-ink/40 text-xs mt-0.5">مقتصر على المسؤول — بدون ربط بفاتورة</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-surface hover:bg-raised">
            <X className="w-4 h-4 text-ink/70" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['credit', 'cash'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStandalone((f) => ({ ...f, refund_type: t, safe_id: '' }))}
              className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${standalone.refund_type === t ? (t === 'cash' ? 'bg-emerald-500/30 border-emerald-500/60 text-emerald-300' : 'bg-blue-500/30 border-blue-500/60 text-blue-300') : 'bg-surface border-line text-ink/50'}`}
            >
              {t === 'cash' ? 'استرداد نقدي' : 'خصم رصيد'}
            </button>
          ))}
        </div>
        <div>
          <label className="text-ink/60 text-xs mb-1 block">العميل</label>
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
            <label className="text-ink/60 text-xs mb-1 block">الخزينة *</label>
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
          <label className="text-ink/60 text-xs mb-1 block">الصنف *</label>
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
            <label className="text-ink/60 text-xs mb-1 block">الكمية</label>
            <input
              type="number"
              min="1"
              className="glass-input"
              value={standalone.quantity}
              onChange={(e) => setStandalone((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-ink/60 text-xs mb-1 block">سعر الوحدة</label>
            <div className="glass-input opacity-70 cursor-not-allowed">
              <span className="text-emerald-400 font-bold">
                {standaloneProduct ? formatCurrency(standalonePrice) : '—'}
              </span>
            </div>
          </div>
        </div>
        {standaloneTotal > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 flex justify-between">
            <span className="text-ink/60 text-sm">الإجمالي</span>
            <span className="text-orange-400 font-bold">{formatCurrency(standaloneTotal)}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-ink/60 text-xs mb-1 block">التاريخ</label>
            <input type="date" className="glass-input" value={standalone.date} onChange={(e) => setStandalone((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-ink/60 text-xs mb-1 block">السبب</label>
            <input type="text" className="glass-input" value={standalone.reason} onChange={(e) => setStandalone((f) => ({ ...f, reason: e.target.value }))} placeholder="اختياري..." />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={isPending} className="flex-1 btn-primary py-3">
            {isPending ? 'جاري الحفظ...' : 'تسجيل المرتجع'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
