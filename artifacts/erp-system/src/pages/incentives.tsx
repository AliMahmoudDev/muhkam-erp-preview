import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type AnyRec = Record<string, unknown>;
function fmt(v: unknown) { return v != null ? Number(Number(v).toFixed(2)).toLocaleString("ar-EG") : "0"; }

export default function Incentives() {
  const { user, authFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_payroll");

  const [activeTab, setActiveTab] = useState("schemes");
  const [selectedScheme, setSelectedScheme] = useState<AnyRec | null>(null);
  const [showSchemeForm, setShowSchemeForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [trackingEmpId, setTrackingEmpId] = useState("");
  const [trackingMonth, setTrackingMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [schemeForm, setSchemeForm] = useState({ name_ar: "", name_en: "", description: "" });
  const [ruleForm, setRuleForm] = useState({ metric_type: "sales_amount", target_value: "", incentive_amount: "", incentive_type: "fixed", calculation_method: "achievement", currency: "EGP" });
  const [metricForm, setMetricForm] = useState({ employee_id: "", incentive_rule_id: "", metric_date: new Date().toISOString().split("T")[0]!, metric_value: "" });
  const [assignForm, setAssignForm] = useState({ employee_id: "", incentive_scheme_id: "", assigned_date: new Date().toISOString().split("T")[0]! });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, [authFetch]);

  const schemes  = useQuery({ queryKey: ["incentive-schemes"], queryFn: () => f("/api/incentive-schemes") });
  const rules    = useQuery({ queryKey: ["incentive-rules", selectedScheme?.id], queryFn: () => f(`/api/incentive-rules/${selectedScheme?.id}`), enabled: selectedScheme != null });
  const tracking = useQuery({ queryKey: ["incentive-tracking", trackingEmpId, trackingMonth], queryFn: () => f(`/api/incentive-tracking/${trackingEmpId}?month=${trackingMonth}`), enabled: Boolean(trackingEmpId) });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createScheme = useMutation({ mutationFn: (d: AnyRec) => f("/api/incentive-schemes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("incentive-schemes", "تم إنشاء مخطط الحوافز") });
  const createRule = useMutation({ mutationFn: (d: AnyRec) => f("/api/incentive-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["incentive-rules", selectedScheme?.id as unknown as string], "تم إضافة قاعدة الحافز") });
  const recordMetric = useMutation({ mutationFn: (d: AnyRec) => f("/api/incentive-metrics/record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["incentive-tracking", trackingEmpId, trackingMonth], "تم تسجيل المقياس واحتساب الحافز") });
  const assignScheme = useMutation({ mutationFn: (d: AnyRec) => f("/api/employee-incentive-assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("employee-incentive-assignments", "تم تعيين مخطط الحوافز للموظف") });

  const safeArr = (v: unknown) => (Array.isArray(v) ? v : []) as AnyRec[];
  const schemesList = safeArr(schemes.data);
  const rulesList   = safeArr(rules.data);
  const trackingData = tracking.data as AnyRec | undefined;
  const accruals    = safeArr(trackingData?.accruals);

  const metricTypeAr: Record<string,string> = { sales_amount:"مبيعات", units_sold:"وحدات مباعة", invoices_created:"فواتير منشأة", customers_acquired:"عملاء جدد", manual:"يدوي" };
  const calcMethodAr: Record<string,string> = { achievement:"إنجاز", slab:"شرائح", tiered:"تدرّجي" };

  function submitScheme(e: React.FormEvent) {
    e.preventDefault();
    createScheme.mutate(schemeForm, { onSuccess: () => { setShowSchemeForm(false); setSchemeForm({ name_ar: "", name_en: "", description: "" }); } });
  }
  function submitRule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedScheme) return;
    createRule.mutate({ ...ruleForm, incentive_scheme_id: selectedScheme.id }, { onSuccess: () => { setShowRuleForm(false); setRuleForm({ metric_type: "sales_amount", target_value: "", incentive_amount: "", incentive_type: "fixed", calculation_method: "achievement", currency: "EGP" }); } });
  }
  function submitMetric(e: React.FormEvent) {
    e.preventDefault();
    recordMetric.mutate(metricForm, { onSuccess: () => { setShowMetricForm(false); setMetricForm({ employee_id: "", incentive_rule_id: "", metric_date: new Date().toISOString().split("T")[0]!, metric_value: "" }); } });
  }
  function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    assignScheme.mutate(assignForm, { onSuccess: () => { setShowAssignForm(false); } });
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">نظام الحوافز</h1>
        <div className="flex gap-2">
          {canManage && <Button onClick={() => setShowAssignForm(true)} variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">تعيين مخطط لموظف</Button>}
          {canManage && <Button onClick={() => setShowMetricForm(true)} variant="outline" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">تسجيل مقياس</Button>}
          {canManage && <Button onClick={() => setShowSchemeForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ مخطط جديد</Button>}
        </div>
      </div>

      {/* Scheme Form */}
      {showSchemeForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitScheme} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">مخطط حوافز جديد</h2>
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="الاسم بالعربية *" value={schemeForm.name_ar} onChange={e => setSchemeForm(p => ({ ...p, name_ar: e.target.value }))} required />
            <Input className="bg-white/5 border-white/10 text-white" placeholder="Name in English" value={schemeForm.name_en} onChange={e => setSchemeForm(p => ({ ...p, name_en: e.target.value }))} />
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="الوصف" value={schemeForm.description} onChange={e => setSchemeForm(p => ({ ...p, description: e.target.value }))} />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowSchemeForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={createScheme.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createScheme.isPending ? "جاري..." : "إنشاء"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Rule Form */}
      {showRuleForm && selectedScheme && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitRule} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">قاعدة حافز جديدة — {String(selectedScheme.name_ar)}</h2>
            <select className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-right" value={ruleForm.metric_type} onChange={e => setRuleForm(p => ({ ...p, metric_type: e.target.value }))}>
              {Object.entries(metricTypeAr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-right" value={ruleForm.calculation_method} onChange={e => setRuleForm(p => ({ ...p, calculation_method: e.target.value }))}>
              {Object.entries(calcMethodAr).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="القيمة المستهدفة *" value={ruleForm.target_value} onChange={e => setRuleForm(p => ({ ...p, target_value: e.target.value }))} required />
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="مبلغ الحافز (اتركه فارغاً للشرائح)" value={ruleForm.incentive_amount} onChange={e => setRuleForm(p => ({ ...p, incentive_amount: e.target.value }))} />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowRuleForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={createRule.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createRule.isPending ? "جاري..." : "إضافة"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Metric Form */}
      {showMetricForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitMetric} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">تسجيل مقياس أداء</h2>
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="رقم الموظف *" value={metricForm.employee_id} onChange={e => setMetricForm(p => ({ ...p, employee_id: e.target.value }))} required />
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="رقم قاعدة الحافز *" value={metricForm.incentive_rule_id} onChange={e => setMetricForm(p => ({ ...p, incentive_rule_id: e.target.value }))} required />
            <Input type="date" className="bg-white/5 border-white/10 text-white" value={metricForm.metric_date} onChange={e => setMetricForm(p => ({ ...p, metric_date: e.target.value }))} required />
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="قيمة المقياس *" value={metricForm.metric_value} onChange={e => setMetricForm(p => ({ ...p, metric_value: e.target.value }))} required />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowMetricForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={recordMetric.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">{recordMetric.isPending ? "جاري..." : "تسجيل"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Form */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitAssign} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">تعيين مخطط حوافز لموظف</h2>
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="رقم الموظف *" value={assignForm.employee_id} onChange={e => setAssignForm(p => ({ ...p, employee_id: e.target.value }))} required />
            <select className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-right" value={assignForm.incentive_scheme_id} onChange={e => setAssignForm(p => ({ ...p, incentive_scheme_id: e.target.value }))} required>
              <option value="">-- اختر المخطط --</option>
              {schemesList.map(s => <option key={String(s.id)} value={String(s.id)}>{String(s.name_ar)}</option>)}
            </select>
            <div><label className="text-xs text-white/50 mb-1 block">تاريخ التعيين</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={assignForm.assigned_date} onChange={e => setAssignForm(p => ({ ...p, assigned_date: e.target.value }))} required /></div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAssignForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={assignScheme.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{assignScheme.isPending ? "جاري..." : "تعيين"}</Button>
            </div>
          </form>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="schemes"  className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">المخططات</TabsTrigger>
          <TabsTrigger value="tracking" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">تتبع الحوافز</TabsTrigger>
        </TabsList>

        <TabsContent value="schemes" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              {schemesList.map(s => (
                <button key={String(s.id)} onClick={() => setSelectedScheme(s)} className={`w-full text-right p-4 rounded-xl border transition-all ${selectedScheme?.id === s.id ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-white/3 hover:border-white/20"}`}>
                  <div className="font-bold text-white">{String(s.name_ar)}</div>
                  {s.description && <div className="text-xs text-white/40 mt-1">{String(s.description)}</div>}
                  <Badge className={s.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mt-2 text-xs" : "bg-white/10 text-white/40 border-white/20 mt-2 text-xs"}>{s.status === "active" ? "نشط" : "موقوف"}</Badge>
                </button>
              ))}
              {schemesList.length === 0 && !schemes.isLoading && <div className="text-center py-8 text-white/40 text-sm">لا توجد مخططات</div>}
            </div>
            <div className="lg:col-span-2">
              {selectedScheme ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white">{String(selectedScheme.name_ar)} — القواعد</h3>
                    {canManage && <Button size="sm" onClick={() => setShowRuleForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold">+ إضافة قاعدة</Button>}
                  </div>
                  {rules.isLoading ? (
                    <div className="text-center py-8 text-white/40">جاري التحميل...</div>
                  ) : rulesList.length === 0 ? (
                    <div className="text-center py-8 text-white/40">لا توجد قواعد — أضف أول قاعدة حافز</div>
                  ) : (
                    <div className="space-y-3">
                      {rulesList.map(r => (
                        <div key={String(r.id)} className="bg-white/5 border border-white/5 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-white">{metricTypeAr[String(r.metric_type)] ?? String(r.metric_type)}</div>
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{calcMethodAr[String(r.calculation_method)] ?? String(r.calculation_method)}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                            <div><span className="text-white/40">الهدف:</span> <span className="text-amber-400 font-bold">{fmt(r.target_value)}</span></div>
                            {r.incentive_amount ? <div><span className="text-white/40">الحافز:</span> <span className="text-emerald-400 font-bold">{fmt(r.incentive_amount)} {String(r.currency)}</span></div> : null}
                          </div>
                          {(safeArr(r.slabs)).length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs text-white/40 mb-2">الشرائح:</div>
                              <div className="flex flex-wrap gap-2">
                                {safeArr(r.slabs).map(sl => (
                                  <Badge key={String(sl.id)} className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                    {Number(sl.from_percentage)}%{sl.to_percentage ? `–${Number(sl.to_percentage)}%` : "+"} → {fmt(sl.incentive_value)}
                                  </Badge>
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
                <div className="flex items-center justify-center h-full min-h-[200px] text-white/30">اختر مخططاً لعرض قواعده</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <div className="flex gap-3 items-center flex-wrap">
            <Input type="number" className="bg-white/5 border-white/10 text-white w-40" placeholder="رقم الموظف" value={trackingEmpId} onChange={e => setTrackingEmpId(e.target.value)} />
            <Input type="month" className="bg-white/5 border-white/10 text-white w-40" value={trackingMonth} onChange={e => setTrackingMonth(e.target.value)} />
          </div>
          {!trackingEmpId ? (
            <div className="text-center py-12 text-white/40">أدخل رقم الموظف لعرض تتبع الحوافز</div>
          ) : tracking.isLoading ? (
            <div className="text-center py-12 text-white/40">جاري التحميل...</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/50">إجمالي الحوافز المستحقة — {trackingMonth}</div>
                  <div className="text-3xl font-bold text-amber-400 mt-1">{fmt(trackingData?.total_accrued)} ج.م</div>
                </div>
                <div className="text-white/30 text-4xl">🏆</div>
              </div>
              {accruals.length === 0 ? (
                <div className="text-center py-8 text-white/40">لا توجد حوافز مسجّلة لهذا الشهر</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-white/40 border-b border-white/10">
                      <th className="text-right pb-3">التاريخ</th><th className="text-right pb-3">المخطط</th><th className="text-right pb-3">المقياس</th><th className="text-right pb-3">الهدف</th><th className="text-right pb-3">الإنجاز</th><th className="text-right pb-3">الحافز</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {accruals.map(a => (
                        <tr key={String(a.id)} className="hover:bg-white/3">
                          <td className="py-2 text-white/70">{String(a.accrual_date)}</td>
                          <td className="py-2 text-white">{String(a.scheme_name ?? "—")}</td>
                          <td className="py-2 text-white">{fmt(a.metric_value)}</td>
                          <td className="py-2 text-white/60">{fmt(a.target_value)}</td>
                          <td className="py-2"><span className={Number(a.achievement_percentage) >= 100 ? "text-emerald-400 font-bold" : "text-amber-400"}>{Number(a.achievement_percentage).toFixed(1)}%</span></td>
                          <td className="py-2 text-amber-400 font-bold">{fmt(a.accrued_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
