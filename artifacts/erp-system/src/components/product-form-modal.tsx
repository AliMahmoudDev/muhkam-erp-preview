import { useState, useRef, useEffect } from 'react';
import { X, Plus, RefreshCw, Tag, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useGetCategories } from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { useVatSettings } from '@/hooks/useVatSettings';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';

export type ProductFormData = {
  name: string;
  sku: string;
  category_id: number | null;
  category_name: string;
  quantity: number;
  cost_price: number;
  sale_price: number;
  low_stock_threshold: number;
  tax_rate: number;
};

export const emptyProductForm: ProductFormData = {
  name: '',
  sku: '',
  category_id: null,
  category_name: '',
  quantity: 0,
  cost_price: 0,
  sale_price: 0,
  low_stock_threshold: 5,
  tax_rate: 0,
};

export function generateBarcode(): string {
  const ts = Date.now().toString().slice(-9);
  const rand = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, '0');
  return `HT${ts}${rand}`;
}

function generateSmartSku(name: string): string {
  const n = name;
  const nl = n.toLowerCase();

  // --- Type prefix ---
  let prefix = '';
  if (/شاشة|screen|lcd|oled|display/i.test(n)) prefix = 'SCR';
  else if (/بطارية|battery/i.test(n)) prefix = 'BAT';
  else if (/هاوسنج|هيكل|housing|back.*cover|غطاء.*خلفي/i.test(n)) prefix = 'HSG';
  else if (/كاميرا|camera/i.test(n)) prefix = 'CAM';
  else if (/شاحن|charger|كابل|cable/i.test(n)) prefix = 'CHR';
  else if (/سماعة|earpiece|speaker/i.test(n)) prefix = 'SPK';
  else if (/سوار|حزام|band|strap/i.test(n)) prefix = 'BND';
  else if (/زجاج|glass/i.test(n)) prefix = 'GLS';
  else if (/مايك|mic|microphone/i.test(n)) prefix = 'MIC';
  else if (/موصل|connector|منفذ|port/i.test(n)) prefix = 'CNT';
  else if (/درع|حماية|protector/i.test(n)) prefix = 'PRT';

  // --- Model ---
  let model = '';
  // iPhone with sub-model
  const ipMatch =
    nl.match(
      /i(?:phone|فون)\s*(\d{1,2})\s*(pro\s*max|pro\s*plus|pro|plus|mini|برو\s*ماكس|برو\s*بلس|برو|بلس|ميني)?/
    ) ||
    nl.match(
      /ايفون\s*(\d{1,2})\s*(برو\s*ماكس|برو\s*بلس|برو|بلس|ميني|pro\s*max|pro\s*plus|pro|plus|mini)?/
    );
  if (ipMatch) {
    model = `IP${ipMatch[1]}`;
    const sub = (ipMatch[2] || '').toLowerCase();
    if (/max|ماكس/.test(sub)) model += 'PM';
    else if (/pro|برو/.test(sub)) model += 'P';
    else if (/plus|بلس/.test(sub)) model += 'PL';
    else if (/mini|ميني/.test(sub)) model += 'M';
  }
  // iPad
  if (!model) {
    const ipadMatch = nl.match(/i(?:pad|باد)\s*(pro|air|mini|برو|اير|ميني)?\s*(\d{1,2})?/);
    if (ipadMatch) {
      model = 'IPD';
      const sub = (ipadMatch[1] || '').toLowerCase();
      if (/pro|برو/.test(sub)) model += 'P';
      else if (/air|اير/.test(sub)) model += 'A';
      else if (/mini|ميني/.test(sub)) model += 'M';
      if (ipadMatch[2]) model += ipadMatch[2];
    }
  }
  // Apple Watch
  if (!model && /watch|واتش|ساعة/.test(nl)) {
    model = 'AW';
    const s = nl.match(/series\s*(\d+)|سيريز\s*(\d+)/);
    if (s) model += s[1] || s[2];
    const ult = /ultra/.test(nl);
    if (ult) model += 'U';
  }
  // MacBook
  if (!model && /macbook|ماك/.test(nl)) {
    model = 'MB';
  }
  // AirPods
  if (!model && /airpods|ايربودز/.test(nl)) {
    model = 'AP';
  }

  // --- Quality suffix ---
  let quality = '';
  if (/أصلي|اصلي|original|org\b|og\b/i.test(n)) quality = 'OG';
  else if (/كوبي.*a\+|copy.*a\+|hard.*oled|a\+/i.test(n)) quality = 'CPA';
  else if (/كوبي|copy/i.test(n)) quality = 'CP';
  else if (/مستعمل|used/i.test(n)) quality = 'USD';

  const parts = [prefix, model, quality].filter(Boolean);
  if (parts.length === 0) return generateBarcode();

  // Add 2-digit random suffix to avoid collisions when same combination exists
  const rand = Math.floor(Math.random() * 99)
    .toString()
    .padStart(2, '0');
  return parts.join('-') + '-' + rand;
}

const QUALITY_OPTIONS = [
  {
    label: '✦ أصلي',
    suffix: ' — أصلي',
    skuHint: 'OG',
    color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  },
  {
    label: '◈ كوبي A+',
    suffix: ' — كوبي A+',
    skuHint: 'CPA',
    color: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  },
  {
    label: '◇ كوبي',
    suffix: ' — كوبي',
    skuHint: 'CP',
    color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  },
  {
    label: '↺ مستعمل',
    suffix: ' — مستعمل',
    skuHint: 'USD',
    color: 'bg-gray-500/20 border-gray-500/40 text-gray-300',
  },
];

interface ProductFormModalProps {
  title?: string;
  initial?: Partial<ProductFormData>;
  onSave: (data: ProductFormData) => void;
  onClose: () => void;
  isPending: boolean;
}

export function ProductFormModal({
  title = 'منتج جديد',
  initial,
  onSave,
  onClose,
  isPending,
}: ProductFormModalProps) {
  const queryClient = useQueryClient();
  const { data: catsRaw } = useGetCategories();
  const categories = safeArray(catsRaw);
  const createCategoryMutation = useMutation({
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      const r = await authFetch(api('/api/categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const { data: vatSettings } = useVatSettings();
  const vatEnabled = vatSettings?.vatEnabled ?? false;
  const vatRate = vatSettings?.vatRate ?? 14;

  const [form, setForm] = useState<ProductFormData>({
    ...emptyProductForm,
    sku: generateBarcode(),
    tax_rate: vatEnabled ? vatRate : 0,
    ...initial,
  });

  const set = (k: keyof ProductFormData, v: string | number | null) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (vatSettings && initial?.tax_rate == null) {
      setForm((f) => ({ ...f, tax_rate: vatEnabled ? vatRate : 0 }));
    }
  }, [vatSettings, vatEnabled, vatRate, initial?.tax_rate]);

  const [catInput, setCatInput] = useState(initial?.category_name || '');
  const [catOpen, setCatOpen] = useState(false);
  const [catCreating, setCatCreating] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  const filtered = catInput.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(catInput.trim().toLowerCase()))
    : categories;

  const exactMatch = categories.some((c) => c.name.toLowerCase() === catInput.trim().toLowerCase());
  const canCreate = catInput.trim().length > 0 && !exactMatch;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectCategory = (cat: { id: number; name: string }) => {
    set('category_id', cat.id);
    set('category_name', cat.name);
    setCatInput(cat.name);
    setCatOpen(false);
  };

  const handleCreateCategory = () => {
    const name = catInput.trim();
    if (!name) return;
    setCatCreating(true);
    createCategoryMutation.mutate(
      { data: { name } },
      {
        onSuccess: (newCat) => {
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          selectCategory({ id: newCat.id, name: newCat.name });
          setCatCreating(false);
        },
        onError: () => setCatCreating(false),
      }
    );
  };

  const applyQuality = (suffix: string) => {
    const base = form.name.replace(/ — أصلي$| — كوبي A\+$| — كوبي$| — مستعمل$/u, '').trim();
    const newName = base + suffix;
    set('name', newName);
    set('sku', generateSmartSku(newName));
  };

  const margin =
    form.cost_price > 0 && form.sale_price > 0
      ? ((form.sale_price - form.cost_price) / form.sale_price) * 100
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSku = form.sku.trim() || generateBarcode();
    onSave({ ...form, sku: finalSku });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <form
        onSubmit={handleSubmit}
        className="glass-panel rounded-3xl p-8 w-full max-w-md shadow-2xl border border-line max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-ink flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-400" /> {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-surface hover:bg-raised transition-colors"
          >
            <X className="w-4 h-4 text-ink/60" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-ink/70 text-xs mb-1">اسم المنتج *</label>
            <input
              required
              type="text"
              className="glass-input"
              placeholder="مثال: شاشة iPhone 15 Pro — أصلي OLED"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          {/* Quality quick-select */}
          <div>
            <label className="block text-ink/50 text-xs mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400/70" />
              نوع/جودة — اضغط لإضافته للاسم وتوليد SKU تلقائياً
            </label>
            <div className="flex flex-wrap gap-2">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.skuHint}
                  type="button"
                  onClick={() => applyQuality(q.suffix)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:scale-105 active:scale-95 ${q.color}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barcode */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3">
            <label className="text-amber-400 text-xs font-bold mb-2 block">🔲 الباركود / SKU</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="glass-input flex-1 font-mono text-sm tracking-wider text-amber-300"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                placeholder="تلقائي عند الحفظ"
              />
              <button
                type="button"
                onClick={() =>
                  set('sku', form.name.trim() ? generateSmartSku(form.name) : generateBarcode())
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold shrink-0 transition-all"
              >
                <RefreshCw className="w-3 h-3" /> توليد
              </button>
            </div>
            <p className="text-ink/25 text-xs mt-1.5">
              مثال: <span className="font-mono text-amber-400/50">SCR-IP15P-OG-03</span> — أو اكتب
              SKU يدوياً
            </p>
          </div>

          {/* Category — combobox */}
          <div>
            <label className="flex items-center gap-1 text-ink/70 text-xs mb-1">
              <Tag className="w-3 h-3 text-ink/40" /> التصنيف *
            </label>
            <div className="relative" ref={catRef}>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required={!form.category_id}
                    className="glass-input w-full pl-8"
                    placeholder="ابحث أو أنشئ تصنيفاً..."
                    value={catInput}
                    autoComplete="off"
                    onChange={(e) => {
                      setCatInput(e.target.value);
                      set('category_id', null);
                      set('category_name', '');
                      setCatOpen(true);
                    }}
                    onFocus={() => setCatOpen(true)}
                  />
                  <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30 pointer-events-none" />
                </div>
                {catCreating && (
                  <div className="px-3 flex items-center">
                    <Loader2 className="w-4 h-4 text-ink/40 animate-spin" />
                  </div>
                )}
              </div>

              {catOpen && (
                <div className="absolute top-full mt-1 w-full z-50 glass-panel rounded-xl border border-line shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filtered.length === 0 && !canCreate && (
                    <p className="px-3 py-2 text-ink/40 text-xs text-center">لا توجد تصنيفات</p>
                  )}
                  {filtered.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => selectCategory(cat)}
                      className={`w-full text-right px-3 py-2 text-sm hover:bg-surface transition-colors flex items-center justify-between ${
                        form.category_id === cat.id
                          ? 'text-amber-300 bg-amber-500/10'
                          : 'text-ink/80'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-ink/30 text-xs">{cat.product_count} منتج</span>
                    </button>
                  ))}
                  {canCreate && (
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={catCreating}
                      className="w-full text-right px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/8 transition-colors border-t border-line flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إنشاء «{catInput.trim()}»
                    </button>
                  )}
                </div>
              )}
            </div>
            {form.category_id && (
              <p className="text-amber-400/70 text-xs mt-1 flex items-center gap-1">
                ✓ تم اختيار: {form.category_name}
              </p>
            )}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-ink/70 text-xs mb-1">سعر التكلفة *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className="glass-input"
                placeholder="0.00"
                value={form.cost_price || ''}
                onChange={(e) => set('cost_price', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-ink/70 text-xs mb-1">سعر البيع *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className="glass-input"
                placeholder="0.00"
                value={form.sale_price || ''}
                onChange={(e) => set('sale_price', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Margin preview */}
          {form.cost_price > 0 && form.sale_price > 0 && (
            <div
              className={`rounded-xl px-3 py-2 text-xs border ${
                margin >= 20
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : margin > 0
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              هامش الربح: {margin.toFixed(1)}% | ربح الوحدة:{' '}
              {formatCurrency(form.sale_price - form.cost_price)}
            </div>
          )}

          {/* Tax rate — shown only when VAT is enabled in settings */}
          {vatEnabled && (
            <div>
              <label className="block text-ink/70 text-xs mb-1">
                نسبة ضريبة القيمة المضافة (%)
                <span className="text-ink/30 mr-1">— {vatRate}% المعدل المضبوط</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  className="glass-input flex-1"
                  placeholder={String(vatRate)}
                  value={form.tax_rate ?? ''}
                  onChange={(e) => set('tax_rate', parseFloat(e.target.value) || 0)}
                />
                <span className="text-ink/40 text-sm">%</span>
              </div>
              {form.tax_rate > 0 && form.sale_price > 0 && (
                <p className="text-xs text-amber-400/70 mt-1">
                  سعر البيع شامل الضريبة: {(form.sale_price * (1 + form.tax_rate / 100)).toFixed(2)}{' '}
                  ج.م
                </p>
              )}
            </div>
          )}

          {/* Quantity + threshold */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-ink/70 text-xs mb-1">الكمية الافتتاحية</label>
              <input
                type="number"
                min="0"
                className="glass-input"
                value={form.quantity || ''}
                onChange={(e) => set('quantity', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-ink/70 text-xs mb-1">حد التنبيه</label>
              <input
                type="number"
                min="0"
                className="glass-input"
                value={form.low_stock_threshold || ''}
                onChange={(e) => set('low_stock_threshold', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={isPending} className="flex-1 btn-primary py-3 font-bold">
            {isPending ? 'جاري الحفظ...' : 'حفظ المنتج'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
