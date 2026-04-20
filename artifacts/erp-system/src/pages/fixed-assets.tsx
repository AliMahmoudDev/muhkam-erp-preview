import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import {
  Plus, X, Building2, TrendingDown, Calendar, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Package, Trash2, ArrowDownCircle, BarChart3,
  Clock, DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

interface FixedAsset {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  purchase_date: string;
  purchase_cost: number;
  residual_value: number;
  useful_life_months: number;
  depreciation_method: string;
  accumulated_depreciation: number;
  book_value: number;
  status: string;
  disposal_date: string | null;
  disposal_proceeds: number | null;
}

interface ScheduleRow {
  period: string;
  depreciation: number;
  accumulated: number;
  book_value: number;
}

interface DeprecRunRow {
  id: number;
  period: string;
  amount: number;
  entry_id: number | null;
}

interface AssetDetail extends FixedAsset {
  schedule: ScheduleRow[];
  runs: DeprecRunRow[];
}

const CATEGORIES: Record<string, string> = {
  equipment: "معدات",
  vehicle: "مركبات",
  furniture: "أثاث ومفروشات",
  electronics: "أجهزة إلكترونية",
  building: "مباني",
  land: "أراضي",
  other: "أخرى",
};

const METHODS: Record<string, string> = {
  straight_line: "القسط الثابت",
  reducing_balance: "القسط المتناقص",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> نشط</span>;
  return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"><X className="w-3 h-3" /> مستبعد</span>;
}

/* ─── Add Asset Modal ─── */
function AddAssetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "equipment",
    description: "",
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_cost: "",
    residual_value: "",
    useful_life_months: "",
    depreciation_method: "straight_line",
  });

  const mutation = useMutation({
    mutationFn: (data: object) => authFetch(api("/api/fixed-assets"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: "✅ تم إضافة الأصل بنجاح" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const monthlyCost = form.purchase_cost && form.residual_value !== undefined && form.useful_life_months
    ? ((Number(form.purchase_cost) - Number(form.residual_value || 0)) / Number(form.useful_life_months)).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 sticky top-0 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="text-lg font-bold text-white">إضافة أصل ثابت جديد</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20"><X className="w-4 h-4 text-white/70" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-white/50 mb-1">اسم الأصل *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="مثال: جهاز لحام كهربائي" className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">الكود (اختياري)</label>
              <input value={form.code} onChange={e => set("code", e.target.value)} placeholder="سيُنشأ تلقائياً" className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">التصنيف</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm">
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k} className="bg-gray-900">{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">تاريخ الشراء *</label>
              <input type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)} className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">طريقة الإهلاك</label>
              <select value={form.depreciation_method} onChange={e => set("depreciation_method", e.target.value)} className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm">
                {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k} className="bg-gray-900">{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">تكلفة الشراء (ج.م) *</label>
              <input type="number" min="0" value={form.purchase_cost} onChange={e => set("purchase_cost", e.target.value)} placeholder="0.00" className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">القيمة المتبقية (ج.م)</label>
              <input type="number" min="0" value={form.residual_value} onChange={e => set("residual_value", e.target.value)} placeholder="0.00" className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">العمر الإنتاجي (بالشهور) *</label>
              <input type="number" min="1" value={form.useful_life_months} onChange={e => set("useful_life_months", e.target.value)} placeholder="مثال: 60 = 5 سنوات" className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-white/50 mb-1">ملاحظات</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="w-full glass-input px-4 py-3 rounded-2xl text-white text-sm resize-none" />
            </div>
          </div>

          {monthlyCost && (
            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-violet-400 shrink-0" />
              <div>
                <p className="text-xs text-white/50">الإهلاك الشهري المقدر ({METHODS[form.depreciation_method]})</p>
                <p className="text-violet-300 font-bold text-lg">{formatCurrency(Number(monthlyCost))}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => mutation.mutate(form)} disabled={!form.name || !form.purchase_cost || !form.useful_life_months || mutation.isPending} className="flex-1 btn-primary py-3 disabled:opacity-50">
              {mutation.isPending ? "..." : "إضافة الأصل"}
            </button>
            <button onClick={onClose} className="px-6 btn-secondary py-3">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Asset Detail Modal ─── */
function AssetDetailModal({ assetId, onClose }: { assetId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showSchedule, setShowSchedule] = useState(false);
  const [depPeriod, setDepPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [disposeForm, setDisposeForm] = useState({ date: new Date().toISOString().split("T")[0], proceeds: "" });
  const [showDispose, setShowDispose] = useState(false);
  const [confirmDispose, setConfirmDispose] = useState(false);

  const { data: asset, isLoading } = useQuery<AssetDetail>({
    queryKey: ["/api/fixed-assets", assetId],
    queryFn: () => authFetch(api(`/api/fixed-assets/${assetId}`)).then(r => r.json()),
  });

  const depMutation = useMutation({
    mutationFn: () => authFetch(api(`/api/fixed-assets/${assetId}/depreciate`), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: depPeriod }),
    }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets", assetId] });
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      toast({ title: `✅ تم تسجيل إهلاك ${depPeriod} بنجاح` });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const disposeMutation = useMutation({
    mutationFn: () => authFetch(api(`/api/fixed-assets/${assetId}/dispose`), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposal_date: disposeForm.date, disposal_proceeds: Number(disposeForm.proceeds || 0) }),
    }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets", assetId] });
      qc.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      const gl = data.gain_loss;
      toast({ title: `✅ تم استبعاد الأصل — ${gl >= 0 ? `ربح ${formatCurrency(gl)}` : `خسارة ${formatCurrency(Math.abs(gl))}`}` });
      setConfirmDispose(false);
    },
    onError: (e: Error) => { toast({ title: "خطأ", description: e.message, variant: "destructive" }); setConfirmDispose(false); },
  });

  const completedPeriods = new Set(asset?.runs.map(r => r.period) ?? []);

  return (
    <>
    {confirmDispose && (
      <ConfirmModal
        title="استبعاد الأصل"
        description={`سيتم استبعاد هذا الأصل وتسجيل قيد محاسبي بأرباح/خسائر الاستبعاد. لا يمكن التراجع.`}
        isPending={disposeMutation.isPending}
        onConfirm={() => disposeMutation.mutate()}
        onCancel={() => setConfirmDispose(false)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel rounded-3xl w-full max-w-4xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{asset?.name ?? "..."}</h3>
              {asset && <p className="text-xs text-violet-400 font-mono">{asset.code}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {asset && <StatusBadge status={asset.status} />}
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20"><X className="w-4 h-4 text-white/70" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {isLoading ? <TableSkeleton /> : !asset ? null : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/40 mb-1">تكلفة الشراء</p>
                  <p className="text-white font-bold">{formatCurrency(asset.purchase_cost)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-orange-300/60 mb-1">مجمع الإهلاك</p>
                  <p className="text-orange-300 font-bold">{formatCurrency(asset.accumulated_depreciation)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-300/60 mb-1">القيمة الدفترية</p>
                  <p className="text-emerald-300 font-bold">{formatCurrency(asset.book_value)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/40 mb-1">القيمة الباقية</p>
                  <p className="text-white font-bold">{formatCurrency(asset.residual_value)}</p>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                <div><p className="text-xs text-white/40">التصنيف</p><p className="text-white/80 text-sm mt-0.5">{CATEGORIES[asset.category] ?? asset.category}</p></div>
                <div><p className="text-xs text-white/40">طريقة الإهلاك</p><p className="text-white/80 text-sm mt-0.5">{METHODS[asset.depreciation_method] ?? asset.depreciation_method}</p></div>
                <div><p className="text-xs text-white/40">تاريخ الشراء</p><p className="text-white/80 text-sm mt-0.5">{asset.purchase_date}</p></div>
                <div><p className="text-xs text-white/40">العمر الإنتاجي</p><p className="text-white/80 text-sm mt-0.5">{asset.useful_life_months} شهر ({(asset.useful_life_months / 12).toFixed(1)} سنة)</p></div>
              </div>

              {/* Progress bar */}
              {asset.status === "active" && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex justify-between text-xs text-white/50 mb-2">
                    <span>نسبة الإهلاك المتراكم</span>
                    <span>{((asset.accumulated_depreciation / Math.max(asset.purchase_cost - asset.residual_value, 1)) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-orange-500 transition-all"
                      style={{ width: `${Math.min(100, (asset.accumulated_depreciation / Math.max(asset.purchase_cost - asset.residual_value, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Run depreciation */}
              {asset.status === "active" && (
                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                  <p className="text-sm font-bold text-violet-300 mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4" /> تسجيل إهلاك شهري</p>
                  <div className="flex gap-3">
                    <input type="month" value={depPeriod} onChange={e => setDepPeriod(e.target.value)}
                      className="glass-input px-4 py-2 rounded-xl text-white text-sm flex-1" />
                    <button onClick={() => depMutation.mutate()} disabled={depMutation.isPending}
                      className="px-5 py-2 rounded-xl bg-violet-500/30 text-violet-300 hover:bg-violet-500/40 text-sm font-bold border border-violet-500/30 transition-colors disabled:opacity-50">
                      {depMutation.isPending ? "..." : "تسجيل الإهلاك"}
                    </button>
                  </div>
                </div>
              )}

              {/* Runs history */}
              {asset.runs.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> سجل الإهلاك المسجل ({asset.runs.length} فترة)</p>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {asset.runs.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="text-xs text-white/50 font-mono">{r.period}</span>
                        <span className="text-xs text-orange-300 font-bold">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Depreciation Schedule */}
              <div>
                <button onClick={() => setShowSchedule(p => !p)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors">
                  <span className="text-sm font-bold text-white/70 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> جدول الإهلاك الكامل ({asset.schedule.length} فترة)</span>
                  {showSchedule ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                </button>
                {showSchedule && (
                  <div className="mt-2 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-black/60 backdrop-blur-sm">
                          <tr>
                            <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">الفترة</th>
                            <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">الإهلاك</th>
                            <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">مجمع الإهلاك</th>
                            <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">القيمة الدفترية</th>
                            <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {asset.schedule.map((row, i) => {
                            const done = completedPeriods.has(row.period);
                            return (
                              <tr key={i} className={`border-t border-white/5 ${done ? "bg-emerald-500/5" : ""}`}>
                                <td className="px-4 py-2 text-white/70 font-mono text-xs">{row.period}</td>
                                <td className="px-4 py-2 text-orange-300">{formatCurrency(row.depreciation)}</td>
                                <td className="px-4 py-2 text-white/60">{formatCurrency(row.accumulated)}</td>
                                <td className="px-4 py-2 text-emerald-300">{formatCurrency(row.book_value)}</td>
                                <td className="px-4 py-2">
                                  {done
                                    ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> مسجل</span>
                                    : <span className="text-xs text-white/30">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Disposal */}
              {asset.status === "active" && (
                <div>
                  {!showDispose ? (
                    <button onClick={() => setShowDispose(true)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm transition-colors">
                      <ArrowDownCircle className="w-4 h-4" /> استبعاد الأصل
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
                      <p className="text-sm font-bold text-red-400">استبعاد الأصل الثابت</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">تاريخ الاستبعاد</label>
                          <input type="date" value={disposeForm.date}
                            onChange={e => setDisposeForm(p => ({ ...p, date: e.target.value }))}
                            className="w-full glass-input px-4 py-2 rounded-xl text-white text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">عائد البيع (ج.م) — اختياري</label>
                          <input type="number" min="0" value={disposeForm.proceeds}
                            onChange={e => setDisposeForm(p => ({ ...p, proceeds: e.target.value }))}
                            placeholder="0" className="w-full glass-input px-4 py-2 rounded-xl text-white text-sm" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setConfirmDispose(true)} className="flex-1 py-2 rounded-xl bg-red-500/30 text-red-300 hover:bg-red-500/40 text-sm font-bold border border-red-500/30 transition-colors">
                          تأكيد الاستبعاد
                        </button>
                        <button onClick={() => setShowDispose(false)} className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-white/70">إلغاء</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {asset.status === "disposed" && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm font-bold text-red-400 mb-2">تم استبعاد هذا الأصل</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-white/40">تاريخ الاستبعاد</p><p className="text-white/80">{asset.disposal_date}</p></div>
                    <div><p className="text-xs text-white/40">عائد البيع</p><p className="text-white/80">{formatCurrency(asset.disposal_proceeds ?? 0)}</p></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

/* ─── Main Page ─── */
export default function FixedAssetsPage() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disposed">("active");

  const { data: assets = [], isLoading } = useQuery<FixedAsset[]>({
    queryKey: ["/api/fixed-assets"],
    queryFn: () => authFetch(api("/api/fixed-assets")).then(r => r.json()),
  });

  const filtered = assets.filter(a => filterStatus === "all" || a.status === filterStatus);

  const totalCost = filtered.filter(a => a.status === "active").reduce((s, a) => s + a.purchase_cost, 0);
  const totalAccDep = filtered.filter(a => a.status === "active").reduce((s, a) => s + a.accumulated_depreciation, 0);
  const totalBookValue = totalCost - totalAccDep;

  return (
    <div className="space-y-6 p-6">
      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} />}
      {selectedId !== null && <AssetDetailModal assetId={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">الأصول الثابتة</h1>
            <p className="text-white/40 text-sm mt-0.5">إدارة الأصول وحساب الإهلاك</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary px-5 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" /> إضافة أصل
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-400" /></div>
            <div>
              <p className="text-xs text-white/40">إجمالي التكلفة</p>
              <p className="text-white font-bold text-lg">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-orange-400" /></div>
            <div>
              <p className="text-xs text-white/40">مجمع الإهلاك</p>
              <p className="text-orange-300 font-bold text-lg">{formatCurrency(totalAccDep)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-emerald-400" /></div>
            <div>
              <p className="text-xs text-white/40">إجمالي القيمة الدفترية</p>
              <p className="text-emerald-300 font-bold text-lg">{formatCurrency(totalBookValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "disposed"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterStatus === s ? "bg-violet-500/30 text-violet-300 border border-violet-500/40" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {s === "all" ? "الكل" : s === "active" ? "نشطة" : "مستبعدة"}
            <span className="mr-2 text-xs opacity-60">({assets.filter(a => s === "all" || a.status === s).length})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
        {isLoading ? <TableSkeleton /> : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-14 h-14 text-white/10 mb-4" />
            <p className="text-white/40">لا توجد أصول ثابتة</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 btn-primary px-5 py-2 text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة أول أصل</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">الأصل</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">التصنيف</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">تاريخ الشراء</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">التكلفة</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">مجمع الإهلاك</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">القيمة الدفترية</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">طريقة الإهلاك</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr key={asset.id} onClick={() => setSelectedId(asset.id)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{asset.name}</p>
                          <p className="text-white/40 text-xs font-mono">{asset.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-white/60">{CATEGORIES[asset.category] ?? asset.category}</td>
                    <td className="px-5 py-3 text-white/60">{asset.purchase_date}</td>
                    <td className="px-5 py-3 text-white">{formatCurrency(asset.purchase_cost)}</td>
                    <td className="px-5 py-3 text-orange-300">{formatCurrency(asset.accumulated_depreciation)}</td>
                    <td className="px-5 py-3 text-emerald-300 font-bold">{formatCurrency(asset.book_value)}</td>
                    <td className="px-5 py-3 text-white/60">{METHODS[asset.depreciation_method] ?? asset.depreciation_method}</td>
                    <td className="px-5 py-3"><StatusBadge status={asset.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
