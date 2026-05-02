import { useState, useEffect } from "react";
import { TrendingUp, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useAuthFetch } from "../../lib/auth-fetch";
import { api } from "../../lib/api";
import { PageHeader, SectionCard, SectionTitle, PrimaryBtn, FieldLabel, SInput } from "./_shared";

type Category = { id: number; name: string };

interface BulkUpdateResult {
  success: boolean;
  updated: number;
  margin_percent: number;
}

export function PricingTab() {
  const authFetch = useAuthFetch();
  const [marginPercent, setMarginPercent] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BulkUpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // جلب الفئات عند أول تحميل
  useEffect(() => {
    setLoadingCats(true);
    authFetch(api("/api/categories"))
      .then(r => r.json())
      .then((data: Category[]) => setCategories(data))
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const margin = parseFloat(marginPercent);
  const isValid = !isNaN(margin) && margin >= 0 && margin <= 500;

  const handleApply = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    setResult(null);
    setShowConfirm(false);
    try {
      const body: Record<string, unknown> = { margin_percent: margin };
      if (categoryId) body.category_id = parseInt(categoryId, 10);
      const r = await authFetch(api("/api/products/bulk-margin-update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "حدث خطأ");
      setResult(data as BulkUpdateResult);
      setMarginPercent("");
      setCategoryId("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="تسعير المنتجات"
        sub="تطبيق هامش ربح عالمي على جميع المنتجات دفعة واحدة"
      />

      {/* Bulk Margin Update */}
      <SectionCard>
        <SectionTitle
          icon={TrendingUp}
          title="تحديث أسعار البيع بالجملة"
          sub="يُحسب سعر البيع = سعر التكلفة × (1 + نسبة الهامش%)"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* نسبة الهامش */}
          <div>
            <FieldLabel>نسبة هامش الربح %</FieldLabel>
            <div className="relative">
              <SInput
                type="number"
                min="0"
                max="500"
                step="0.5"
                value={marginPercent}
                onChange={e => { setMarginPercent(e.target.value); setResult(null); setError(null); }}
                placeholder="مثال: 25"
                className="pr-10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-bold">%</span>
            </div>
            {isValid && marginPercent !== "" && (
              <p className="text-xs text-amber-400/70 mt-1.5">
                مثال: منتج تكلفته 100 ج.م → سعر البيع {(100 * (1 + margin / 100)).toFixed(2)} ج.م
              </p>
            )}
          </div>

          {/* فئة (اختياري) */}
          <div>
            <FieldLabel>تطبيق على فئة معينة (اختياري)</FieldLabel>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              disabled={loadingCats}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">كل المنتجات</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* تحذير + زر تأكيد */}
        {!showConfirm ? (
          <div className="mt-5 flex justify-end">
            <PrimaryBtn
              disabled={!isValid || !marginPercent || saving}
              onClick={() => setShowConfirm(true)}
            >
              <TrendingUp className="w-4 h-4" />
              {saving ? "جاري التحديث..." : "تطبيق على المنتجات"}
            </PrimaryBtn>
          </div>
        ) : (
          <div className="mt-5 bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-bold text-sm">تأكيد التحديث الجماعي</p>
                <p className="text-red-300/70 text-xs mt-1">
                  سيتم تحديث أسعار البيع لـ{categoryId ? " الفئة المحددة" : " جميع المنتجات"} بنسبة هامش {margin}%.<br />
                  <span className="font-bold">هذه العملية لا يمكن التراجع عنها تلقائياً.</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 text-white/60 hover:text-white/90 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleApply}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                نعم، طبّق التحديث
              </button>
            </div>
          </div>
        )}

        {/* نتيجة التحديث */}
        {result && (
          <div className="mt-4 flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-green-300 font-bold text-sm">تم التحديث بنجاح!</p>
              <p className="text-green-300/60 text-xs mt-0.5">
                تم تحديث أسعار بيع <span className="font-bold">{result.updated}</span> منتج بهامش {result.margin_percent}%
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </SectionCard>

      {/* شرح الآلية */}
      <SectionCard>
        <SectionTitle icon={TrendingUp} title="كيف يعمل؟" />
        <div className="space-y-2 text-sm text-white/50">
          <p>• سعر البيع الجديد = سعر التكلفة × (1 + الهامش ÷ 100)</p>
          <p>• المنتجات التي سعر تكلفتها صفر أو غير محدد تُستثنى تلقائياً</p>
          <p>• يمكنك اختيار فئة معينة لتطبيق الهامش عليها فقط</p>
          <p>• بعد التطبيق، يمكنك تعديل سعر أي منتج بشكل فردي من صفحة المنتجات</p>
        </div>
      </SectionCard>
    </div>
  );
}
