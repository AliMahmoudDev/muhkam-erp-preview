import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { authFetch } from "@/lib/auth-fetch";
import { safeArray } from "@/lib/safe-data";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { Gift, Plus, X, UserPlus, BarChart2, Trophy } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type AnyRec = Record<string, unknown>;
function fmt(v: unknown) { return v != null ? Number(Number(v).toFixed(2)).toLocaleString("ar-EG") : "0"; }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-white/50">{label}</label>{children}</div>;
}

const metricTypeAr: Record<string, string> = { sales_amount: "مبيعات", units_sold: "وحدات مباعة", invoices_created: "فواتير منشأة", customers_acquired: "عملاء جدد", manual: "يدوي" };
const calcMethodAr: Record<string, string> = { achievement: "إنجاز", slab: "شرائح", tiered: "تدرّجي" };

export default function Incentives() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_payroll");

  const [activeTab, setActiveTab]               = useState("schemes");
  const [selectedScheme, setSelectedScheme]     = useState<AnyRec | null>(null);
  const [showSchemeForm, setShowSchemeForm]     = useState(false);
  const [showRuleForm, setShowRuleForm]         = useState(false);
  const [showMetricForm, setShowMetricForm]     = useState(false);
  const [showAssignForm, setShowAssignForm]     = useState(false);
  const [trackingEmpId, setTrackingEmpId]       = useState("");
  const [trackingMonth, setTrackingMonth]       = useState(() => new Date().toISOString().substring(0, 7));
  const [schemeForm, setSchemeForm]             = useState({ name_ar: "", name_en: "", description: "" });
  const [ruleForm, setRuleForm]                 = useState({ metric_type: "sales_amount", target_value: "", incentive_amount: "", incentive_type: "fixed", calculation_method: "achievement", currency: "EGP" });
  const [metricForm, setMetricForm]             = useState({ employee_id: "", incentive_rule_id: "", metric_date: new Date().toISOString().split("T")[0]!, metric_value: "" });
  const [assignForm, setAssignForm]             = useState({ employee_id: "", incentive_scheme_id: "", assigned_date: new Date().toISOString().split("T")[0]! });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, []);

  const schemes  = useQuery({ queryKey: ["incentive-schemes"],                                          queryFn: () => f("/api/incentive-schemes") });
  const rules    = useQuery({ queryKey: ["incentive-rules", selectedScheme?.id],                        queryFn: () => f(`/api/incentive-rules/${selectedScheme?.id}`),                          enabled: selectedScheme != null });
  const tracking = useQuery({ queryKey: ["incentive-tracking", trackingEmpId, trackingMonth],           queryFn: () => f(`/api/incentive-tracking/${trackingEmpId}?month=${trackingMonth}`),    enabled: Boolean(trackingEmpId) });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createScheme  = useMutation({ mutationFn: (d: AnyRec) => f("/api/incentive-schemes",                         { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("incentive-schemes",     "تم إنشاء مخطط الحوافز") });
  const createRule    = useMutation({ mutationFn: (d: AnyRec) => f("/api/incentive-rules",                           { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["incentive-rules", selectedScheme?.id as unknown as string], "تم إضافة قاعدة الحافز") });
  const recordMetric  = useMutation({ mutationFn: (d: AnyRec) => f("/api/incentive-metrics/record",                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["incentive-tracking", trackingEmpId, trackingMonth], "تم تسجيل المقياس واحتساب الحافز") });
  const assignScheme  = useMutation({ mutationFn: (d: AnyRec) => f("/api/employee-incentive-assignments",            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("employee-incentive-assignments", "تم تعيين مخطط الحوافز") });

  const schemesList  = safeArray(schemes.data);
  const rulesList    = safeArray(rules.data);
  const trackingData = tracking.data as AnyRec | undefined;
  const accruals     = safeArray(trackingData?.accruals);

  const TABS = [
    { key: "schemes",  label: "المخططات",     icon: Gift },
    { key: "tracking", label: "تتبع الحوافز", icon: Trophy },
  ] as const;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Gift size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">نظام الحوافز</h1>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setShowAssignForm(true)} className="erp-btn erp-btn-ghost flex items-center gap-1 text-xs text-blue-300 border-blue-500/40">
              <UserPlus size={12} /> تعيين مخطط لموظف
            </button>
            <button onClick={() => setShowMetricForm(true)} className="erp-btn erp-btn-ghost flex items-center gap-1 text-xs text-emerald-300 border-emerald-500/40">
              <BarChart2 size={12} /> تسجيل مقياس
            </button>
            <button onClick={() => setShowSchemeForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <Plus size={14} /> مخطط جديد
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400" : "text-white/50 hover:text-white/80"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── المخططات ── */}
      {activeTab === "schemes" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            {schemes.isLoading ? <TableSkeleton /> : (
              <>
                {schemesList.map(s => (
                  <button key={String(s.id)} onClick={() => setSelectedScheme(s)}
                    className={`w-full text-right p-4 rounded-xl border transition-all ${selectedScheme?.id === s.id ? "border-amber-500 bg-amber-500/10" : "erp-card"}`}>
                    <div className="font-bold text-sm text-white">{String(s.name_ar)}</div>
                    {s.description && <div className="text-xs text-white/40 mt-1">{String(s.description)}</div>}
                    <div className="mt-2">
                      <span className={s.status === "active" ? "erp-badge erp-badge-success" : "erp-badge erp-badge-neutral"}>{s.status === "active" ? "نشط" : "موقوف"}</span>
                    </div>
                  </button>
                ))}
                {schemesList.length === 0 && (
                  <div className="erp-card"><div className="erp-empty-state"><Gift size={28} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد مخططات</p></div></div>
                )}
              </>
            )}
          </div>
          <div className="lg:col-span-2">
            {selectedScheme ? (
              <div className="erp-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white">{String(selectedScheme.name_ar)} — القواعد</h3>
                  <div className="flex gap-2">
                    {canManage && <button onClick={() => setShowRuleForm(true)} className="erp-btn erp-btn-primary text-xs flex items-center gap-1"><Plus size={12} /> إضافة قاعدة</button>}
                    <button onClick={() => setSelectedScheme(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
                  </div>
                </div>
                {rules.isLoading ? <TableSkeleton /> : rulesList.length === 0 ? (
                  <div className="erp-empty-state"><BarChart2 size={28} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد قواعد — أضف أول قاعدة حافز</p></div>
                ) : (
                  <div className="space-y-3">
                    {rulesList.map(r => (
                      <div key={String(r.id)} className="erp-card-soft p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{metricTypeAr[String(r.metric_type)] ?? String(r.metric_type)}</div>
                          <span className="erp-badge erp-badge-info">{calcMethodAr[String(r.calculation_method)] ?? String(r.calculation_method)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                          <div><span className="text-white/40">الهدف: </span><span className="text-amber-300 font-bold font-mono">{fmt(r.target_value)}</span></div>
                          {r.incentive_amount ? <div><span className="text-white/40">الحافز: </span><span className="text-emerald-300 font-bold font-mono">{fmt(r.incentive_amount)} {String(r.currency)}</span></div> : null}
                        </div>
                        {safeArray(r.slabs).length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs text-white/40 mb-2">الشرائح:</div>
                            <div className="flex flex-wrap gap-2">
                              {safeArray(r.slabs).map(sl => (
                                <span key={String(sl.id)} className="erp-badge erp-badge-pending text-xs">
                                  {Number(sl.from_percentage)}%{sl.to_percentage ? `–${Number(sl.to_percentage)}%` : "+"} → {fmt(sl.incentive_value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="erp-card flex items-center justify-center min-h-[200px]">
                <p className="text-white/30 text-sm">اختر مخططاً لعرض قواعده</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── تتبع الحوافز ── */}
      {activeTab === "tracking" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center flex-wrap">
            <input type="number" className="erp-input w-40" placeholder="رقم الموظف" value={trackingEmpId} onChange={e => setTrackingEmpId(e.target.value)} />
            <input type="month" className="erp-input w-40" value={trackingMonth} onChange={e => setTrackingMonth(e.target.value)} />
          </div>
          {!trackingEmpId ? (
            <div className="erp-card"><div className="erp-empty-state"><Trophy size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">أدخل رقم الموظف لعرض تتبع الحوافز</p></div></div>
          ) : tracking.isLoading ? <TableSkeleton /> : (
            <div className="space-y-4">
              <div className="erp-card border-amber-500/30 p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/50">إجمالي الحوافز المستحقة — {trackingMonth}</div>
                  <div className="text-3xl font-bold text-amber-300 mt-1 font-mono">{fmt(trackingData?.total_accrued)} ج.م</div>
                </div>
                <Trophy size={40} className="text-amber-300/30" />
              </div>
              {accruals.length === 0 ? (
                <div className="erp-card"><div className="erp-empty-state"><BarChart2 size={28} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد حوافز مسجّلة لهذا الشهر</p></div></div>
              ) : (
                <div className="erp-card overflow-x-auto">
                  <table className="erp-table w-full">
                    <thead><tr className="erp-table-header">
                      <th className="p-3 text-right text-xs">التاريخ</th>
                      <th className="p-3 text-right text-xs">المخطط</th>
                      <th className="p-3 text-right text-xs">المقياس</th>
                      <th className="p-3 text-right text-xs">الهدف</th>
                      <th className="p-3 text-right text-xs">الإنجاز</th>
                      <th className="p-3 text-right text-xs">الحافز</th>
                    </tr></thead>
                    <tbody>
                      {accruals.map(a => (
                        <tr key={String(a.id)} className="erp-table-row">
                          <td className="p-3 text-sm text-white/60 font-mono">{String(a.accrual_date)}</td>
                          <td className="p-3 text-sm">{String(a.scheme_name ?? "—")}</td>
                          <td className="p-3 text-sm font-mono">{fmt(a.metric_value)}</td>
                          <td className="p-3 text-sm text-white/60 font-mono">{fmt(a.target_value)}</td>
                          <td className="p-3 text-sm"><span className={Number(a.achievement_percentage) >= 100 ? "text-emerald-300 font-bold" : "text-amber-300"}>{Number(a.achievement_percentage).toFixed(1)}%</span></td>
                          <td className="p-3 text-sm text-amber-300 font-bold font-mono">{fmt(a.accrued_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* مخطط حوافز جديد */}
      {showSchemeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Gift size={16} className="text-amber-400" /> مخطط حوافز جديد</h2>
              <button onClick={() => setShowSchemeForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الاسم (عربي) *"><input value={schemeForm.name_ar} onChange={e => setSchemeForm(p => ({ ...p, name_ar: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="الاسم (إنجليزي)"><input value={schemeForm.name_en} onChange={e => setSchemeForm(p => ({ ...p, name_en: e.target.value }))} className="erp-input w-full" /></Field>
              <Field label="الوصف"><input value={schemeForm.description} onChange={e => setSchemeForm(p => ({ ...p, description: e.target.value }))} className="erp-input w-full" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createScheme.mutate(schemeForm, { onSuccess: () => { setShowSchemeForm(false); setSchemeForm({ name_ar: "", name_en: "", description: "" }); } }); }} disabled={createScheme.isPending} className="erp-btn erp-btn-primary flex-1">
                {createScheme.isPending ? "جاري..." : "إنشاء"}
              </button>
              <button onClick={() => setShowSchemeForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* قاعدة حافز */}
      {showRuleForm && selectedScheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><BarChart2 size={16} className="text-amber-400" /> قاعدة حافز — {String(selectedScheme.name_ar)}</h2>
              <button onClick={() => setShowRuleForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="نوع المقياس">
                <select value={ruleForm.metric_type} onChange={e => setRuleForm(p => ({ ...p, metric_type: e.target.value }))} className="erp-input w-full">
                  {Object.entries(metricTypeAr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="طريقة الحساب">
                <select value={ruleForm.calculation_method} onChange={e => setRuleForm(p => ({ ...p, calculation_method: e.target.value }))} className="erp-input w-full">
                  {Object.entries(calcMethodAr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="القيمة المستهدفة *"><input type="number" value={ruleForm.target_value} onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="مبلغ الحافز"><input type="number" value={ruleForm.incentive_amount} onChange={e => setRuleForm(p => ({ ...p, incentive_amount: e.target.value }))} className="erp-input w-full" placeholder="اتركه فارغاً للشرائح" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createRule.mutate({ ...ruleForm, incentive_scheme_id: selectedScheme.id }, { onSuccess: () => { setShowRuleForm(false); setRuleForm({ metric_type: "sales_amount", target_value: "", incentive_amount: "", incentive_type: "fixed", calculation_method: "achievement", currency: "EGP" }); } }); }} disabled={createRule.isPending} className="erp-btn erp-btn-primary flex-1">
                {createRule.isPending ? "جاري..." : "إضافة"}
              </button>
              <button onClick={() => setShowRuleForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* تسجيل مقياس */}
      {showMetricForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><BarChart2 size={16} className="text-amber-400" /> تسجيل مقياس أداء</h2>
              <button onClick={() => setShowMetricForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="رقم الموظف *"><input type="number" value={metricForm.employee_id} onChange={e => setMetricForm(p => ({ ...p, employee_id: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="رقم قاعدة الحافز *"><input type="number" value={metricForm.incentive_rule_id} onChange={e => setMetricForm(p => ({ ...p, incentive_rule_id: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="التاريخ *"><input type="date" value={metricForm.metric_date} onChange={e => setMetricForm(p => ({ ...p, metric_date: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="قيمة المقياس *"><input type="number" value={metricForm.metric_value} onChange={e => setMetricForm(p => ({ ...p, metric_value: e.target.value }))} className="erp-input w-full" required /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { recordMetric.mutate(metricForm, { onSuccess: () => { setShowMetricForm(false); setMetricForm({ employee_id: "", incentive_rule_id: "", metric_date: new Date().toISOString().split("T")[0]!, metric_value: "" }); } }); }} disabled={recordMetric.isPending} className="erp-btn erp-btn-primary flex-1">
                {recordMetric.isPending ? "جاري..." : "تسجيل"}
              </button>
              <button onClick={() => setShowMetricForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* تعيين مخطط لموظف */}
      {showAssignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><UserPlus size={16} className="text-amber-400" /> تعيين مخطط حوافز لموظف</h2>
              <button onClick={() => setShowAssignForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="رقم الموظف *"><input type="number" value={assignForm.employee_id} onChange={e => setAssignForm(p => ({ ...p, employee_id: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="المخطط *">
                <select value={assignForm.incentive_scheme_id} onChange={e => setAssignForm(p => ({ ...p, incentive_scheme_id: e.target.value }))} className="erp-input w-full" required>
                  <option value="">— اختر المخطط —</option>
                  {schemesList.map(s => <option key={String(s.id)} value={String(s.id)}>{String(s.name_ar)}</option>)}
                </select>
              </Field>
              <Field label="تاريخ التعيين *"><input type="date" value={assignForm.assigned_date} onChange={e => setAssignForm(p => ({ ...p, assigned_date: e.target.value }))} className="erp-input w-full" required /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { assignScheme.mutate(assignForm, { onSuccess: () => setShowAssignForm(false) }); }} disabled={assignScheme.isPending} className="erp-btn erp-btn-primary flex-1">
                {assignScheme.isPending ? "جاري..." : "تعيين"}
              </button>
              <button onClick={() => setShowAssignForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
