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

function statusColor(s: string) {
  switch (s) {
    case "approved": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "processing": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "paid": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }
}
function statusAr(s: string) {
  const m: Record<string,string> = { draft:"مسودة", processing:"جاري المعالجة", approved:"معتمد", paid:"مدفوع", rejected:"مرفوض", cancelled:"ملغي" };
  return m[s] ?? s;
}
function fmt(v: unknown) { return v != null ? Number(Number(v).toFixed(2)).toLocaleString("ar-EG") : "—"; }

export default function Payroll() {
  const { user, authFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_payroll");
  const canApprove = hasPermission(user, "can_approve_payroll");

  const [activeTab, setActiveTab] = useState("periods");
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [showStructureForm, setShowStructureForm] = useState(false);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [showContribForm, setShowContribForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AnyRec | null>(null);
  const [periodForm, setPeriodForm] = useState({ name: "", start_date: "", end_date: "", notes: "" });
  const [structForm, setStructForm] = useState({ name_ar: "", name_en: "", base_salary: "", description: "" });
  const [taxForm, setTaxForm] = useState({ fiscal_year: new Date().getFullYear().toString(), min_salary: "", max_salary: "", tax_rate: "" });
  const [contribForm, setContribForm] = useState({ contribution_type: "social_insurance", name_ar: "", name_en: "", employee_percentage: "", employer_percentage: "" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, [authFetch]);

  const periods       = useQuery({ queryKey: ["payroll-periods"],    queryFn: () => f("/api/payroll/periods") });
  const structures    = useQuery({ queryKey: ["salary-structures"],  queryFn: () => f("/api/salary-structures") });
  const taxBrackets   = useQuery({ queryKey: ["tax-brackets"],       queryFn: () => f("/api/tax-brackets") });
  const contributions = useQuery({ queryKey: ["statutory-contribs"],queryFn: () => f("/api/statutory-contributions") });
  const periodDetail  = useQuery({ queryKey: ["payroll-period", selectedPeriod?.id], queryFn: () => f(`/api/payroll/periods/${selectedPeriod?.id}`), enabled: selectedPeriod != null });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createPeriod = useMutation({ mutationFn: (d: AnyRec) => f("/api/payroll/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("payroll-periods", "تم إنشاء فترة المرتبات") });
  const processPeriod = useMutation({ mutationFn: (id: number) => f(`/api/payroll/periods/${id}/process`, { method: "POST", headers: { "Content-Type": "application/json" } }), ...mutOpts("payroll-periods", "تمت معالجة المرتبات بنجاح") });
  const approvePeriod = useMutation({ mutationFn: (id: number) => f(`/api/payroll/periods/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } }), ...mutOpts("payroll-periods", "تم اعتماد فترة المرتبات") });
  const createStructure = useMutation({ mutationFn: (d: AnyRec) => f("/api/salary-structures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("salary-structures", "تم إنشاء الهيكل الوظيفي") });
  const createTax = useMutation({ mutationFn: (d: AnyRec) => f("/api/tax-brackets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("tax-brackets", "تم إضافة شريحة ضريبية") });
  const createContrib = useMutation({ mutationFn: (d: AnyRec) => f("/api/statutory-contributions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("statutory-contribs", "تم إضافة الاشتراك الإلزامي") });

  const safeArr = (v: unknown) => (Array.isArray(v) ? v : []) as AnyRec[];

  const periodsList   = safeArr(periods.data);
  const structsList   = safeArr(structures.data);
  const taxList       = safeArr(taxBrackets.data);
  const contribsList  = safeArr(contributions.data);
  const detailRecords = safeArr((periodDetail.data as AnyRec)?.records);

  function submitPeriod(e: React.FormEvent) {
    e.preventDefault();
    createPeriod.mutate(periodForm, { onSuccess: () => { setShowPeriodForm(false); setPeriodForm({ name: "", start_date: "", end_date: "", notes: "" }); } });
  }
  function submitStructure(e: React.FormEvent) {
    e.preventDefault();
    createStructure.mutate(structForm, { onSuccess: () => { setShowStructureForm(false); setStructForm({ name_ar: "", name_en: "", base_salary: "", description: "" }); } });
  }
  function submitTax(e: React.FormEvent) {
    e.preventDefault();
    createTax.mutate(taxForm, { onSuccess: () => { setShowTaxForm(false); setTaxForm({ fiscal_year: new Date().getFullYear().toString(), min_salary: "", max_salary: "", tax_rate: "" }); } });
  }
  function submitContrib(e: React.FormEvent) {
    e.preventDefault();
    createContrib.mutate(contribForm, { onSuccess: () => { setShowContribForm(false); setContribForm({ contribution_type: "social_insurance", name_ar: "", name_en: "", employee_percentage: "", employer_percentage: "" }); } });
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">إدارة المرتبات</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="periods"  className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">فترات المرتبات</TabsTrigger>
          <TabsTrigger value="structures" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الهياكل الوظيفية</TabsTrigger>
          <TabsTrigger value="tax"      className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الشرائح الضريبية</TabsTrigger>
          <TabsTrigger value="contrib"  className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الاشتراكات الإلزامية</TabsTrigger>
        </TabsList>

        {/* ── Payroll Periods ── */}
        <TabsContent value="periods" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowPeriodForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              + إنشاء فترة مرتبات
            </Button>
          )}

          {showPeriodForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitPeriod} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
                <h2 className="text-lg font-bold text-white">إنشاء فترة مرتبات جديدة</h2>
                <div className="grid grid-cols-1 gap-3">
                  <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="اسم الفترة (مثال: مرتبات يونيو 2025)" value={periodForm.name} onChange={e => setPeriodForm(p => ({ ...p, name: e.target.value }))} required />
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/50 block mb-1">تاريخ البداية</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={periodForm.start_date} onChange={e => setPeriodForm(p => ({ ...p, start_date: e.target.value }))} required /></div>
                    <div><label className="text-xs text-white/50 block mb-1">تاريخ النهاية</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={periodForm.end_date} onChange={e => setPeriodForm(p => ({ ...p, end_date: e.target.value }))} required /></div>
                  </div>
                  <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="ملاحظات (اختياري)" value={periodForm.notes} onChange={e => setPeriodForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowPeriodForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createPeriod.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createPeriod.isPending ? "جاري الحفظ..." : "إنشاء"}</Button>
                </div>
              </form>
            </div>
          )}

          {periods.isLoading ? (
            <div className="text-center py-12 text-white/40">جاري التحميل...</div>
          ) : periodsList.length === 0 ? (
            <div className="text-center py-12 text-white/40">لا توجد فترات مرتبات بعد</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 space-y-2">
                {periodsList.map((p) => (
                  <button key={String(p.id)} onClick={() => setSelectedPeriod(p)} className={`w-full text-right p-4 rounded-xl border transition-all ${selectedPeriod?.id === p.id ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-white/3 hover:border-white/20"}`}>
                    <div className="font-bold text-white">{String(p.name)}</div>
                    <div className="text-xs text-white/50 mt-1">{String(p.start_date)} — {String(p.end_date)}</div>
                    <div className="mt-2"><Badge className={statusColor(String(p.status))}>{statusAr(String(p.status))}</Badge></div>
                  </button>
                ))}
              </div>
              <div className="lg:col-span-2">
                {selectedPeriod ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white">{String(selectedPeriod.name)}</h3>
                      <div className="flex gap-2">
                        {canManage && String(selectedPeriod.status) === "draft" && (
                          <Button size="sm" onClick={() => processPeriod.mutate(selectedPeriod.id as number, { onSuccess: () => { setSelectedPeriod(prev => prev ? { ...prev, status: "processing" } : null); qc.invalidateQueries({ queryKey: ["payroll-periods"] }); } })} disabled={processPeriod.isPending} className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
                            {processPeriod.isPending ? "جاري..." : "معالجة المرتبات"}
                          </Button>
                        )}
                        {canApprove && String(selectedPeriod.status) === "processing" && (
                          <Button size="sm" onClick={() => approvePeriod.mutate(selectedPeriod.id as number, { onSuccess: () => { setSelectedPeriod(prev => prev ? { ...prev, status: "approved" } : null); qc.invalidateQueries({ queryKey: ["payroll-periods"] }); } })} disabled={approvePeriod.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
                            {approvePeriod.isPending ? "جاري..." : "اعتماد الفترة"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {periodDetail.isLoading ? (
                      <div className="text-center py-8 text-white/40">جاري التحميل...</div>
                    ) : detailRecords.length === 0 ? (
                      <div className="text-center py-8 text-white/40">لا توجد سجلات مرتبات — قم بمعالجة المرتبات أولاً</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-white/40 border-b border-white/10">
                              <th className="text-right pb-2">الموظف</th>
                              <th className="text-right pb-2">الراتب الإجمالي</th>
                              <th className="text-right pb-2">صافي الراتب</th>
                              <th className="text-right pb-2">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {detailRecords.map((r) => (
                              <tr key={String(r.id)} className="hover:bg-white/3">
                                <td className="py-2 text-white">{String(r.first_name_ar ?? "")} {String(r.last_name_ar ?? "")}<span className="text-white/40 mr-1 text-xs">({String(r.employee_code ?? "")})</span></td>
                                <td className="py-2 text-white">{fmt(r.gross_salary)}</td>
                                <td className="py-2 text-amber-400 font-bold">{fmt(r.net_salary)}</td>
                                <td className="py-2"><Badge className={statusColor(String(r.status))}>{statusAr(String(r.status))}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-white/10">
                            <tr>
                              <td className="pt-2 text-white/40 text-xs">إجمالي {detailRecords.length} موظف</td>
                              <td className="pt-2 font-bold text-white">{fmt(detailRecords.reduce((s, r) => s + Number(r.gross_salary), 0))}</td>
                              <td className="pt-2 font-bold text-amber-400">{fmt(detailRecords.reduce((s, r) => s + Number(r.net_salary), 0))}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-white/30">
                    اختر فترة مرتبات لعرض التفاصيل
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Salary Structures ── */}
        <TabsContent value="structures" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowStructureForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              + إضافة هيكل وظيفي
            </Button>
          )}
          {showStructureForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitStructure} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">هيكل وظيفي جديد</h2>
                <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="الاسم بالعربية *" value={structForm.name_ar} onChange={e => setStructForm(p => ({ ...p, name_ar: e.target.value }))} required />
                <Input className="bg-white/5 border-white/10 text-white" placeholder="Name in English" value={structForm.name_en} onChange={e => setStructForm(p => ({ ...p, name_en: e.target.value }))} />
                <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="الراتب الأساسي" value={structForm.base_salary} onChange={e => setStructForm(p => ({ ...p, base_salary: e.target.value }))} />
                <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="الوصف" value={structForm.description} onChange={e => setStructForm(p => ({ ...p, description: e.target.value }))} />
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowStructureForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createStructure.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createStructure.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {structsList.map((s) => (
              <div key={String(s.id)} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="font-bold text-white">{String(s.name_ar)}</div>
                <div className="text-xs text-white/50 mt-1">{String(s.name_en)}</div>
                <div className="mt-3 text-amber-400 font-bold text-lg">{fmt(s.base_salary)} <span className="text-xs text-white/40">ج.م / شهر</span></div>
              </div>
            ))}
            {structsList.length === 0 && !structures.isLoading && (
              <div className="col-span-3 text-center py-12 text-white/40">لا توجد هياكل وظيفية — أضف أول هيكل</div>
            )}
          </div>
        </TabsContent>

        {/* ── Tax Brackets ── */}
        <TabsContent value="tax" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowTaxForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              + إضافة شريحة ضريبية
            </Button>
          )}
          {showTaxForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitTax} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">شريحة ضريبية جديدة</h2>
                <Input className="bg-white/5 border-white/10 text-white" placeholder="السنة المالية (مثال: 2025)" value={taxForm.fiscal_year} onChange={e => setTaxForm(p => ({ ...p, fiscal_year: e.target.value }))} required />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/50 mb-1 block">من (ج.م)</label><Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="0" value={taxForm.min_salary} onChange={e => setTaxForm(p => ({ ...p, min_salary: e.target.value }))} /></div>
                  <div><label className="text-xs text-white/50 mb-1 block">إلى (ج.م)</label><Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="غير محدود" value={taxForm.max_salary} onChange={e => setTaxForm(p => ({ ...p, max_salary: e.target.value }))} /></div>
                </div>
                <Input type="number" step="0.01" className="bg-white/5 border-white/10 text-white" placeholder="نسبة الضريبة %" value={taxForm.tax_rate} onChange={e => setTaxForm(p => ({ ...p, tax_rate: e.target.value }))} required />
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowTaxForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createTax.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createTax.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-right pb-3">السنة المالية</th>
                  <th className="text-right pb-3">من</th>
                  <th className="text-right pb-3">إلى</th>
                  <th className="text-right pb-3">نسبة الضريبة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {taxList.map((t) => (
                  <tr key={String(t.id)} className="hover:bg-white/3">
                    <td className="py-3 text-white">{String(t.fiscal_year)}</td>
                    <td className="py-3 text-white">{fmt(t.min_salary)} ج.م</td>
                    <td className="py-3 text-white">{t.max_salary ? fmt(t.max_salary) + " ج.م" : "غير محدود"}</td>
                    <td className="py-3 text-amber-400 font-bold">{Number(t.tax_rate)}%</td>
                  </tr>
                ))}
                {taxList.length === 0 && !taxBrackets.isLoading && (
                  <tr><td colSpan={4} className="text-center py-12 text-white/40">لا توجد شرائح ضريبية</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Statutory Contributions ── */}
        <TabsContent value="contrib" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowContribForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              + إضافة اشتراك إلزامي
            </Button>
          )}
          {showContribForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitContrib} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">اشتراك إلزامي جديد</h2>
                <select className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-right" value={contribForm.contribution_type} onChange={e => setContribForm(p => ({ ...p, contribution_type: e.target.value }))}>
                  <option value="social_insurance">تأمين اجتماعي</option>
                  <option value="health_insurance">تأمين صحي</option>
                  <option value="pension">معاش</option>
                  <option value="other">أخرى</option>
                </select>
                <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="الاسم بالعربية *" value={contribForm.name_ar} onChange={e => setContribForm(p => ({ ...p, name_ar: e.target.value }))} required />
                <Input className="bg-white/5 border-white/10 text-white" placeholder="Name in English" value={contribForm.name_en} onChange={e => setContribForm(p => ({ ...p, name_en: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/50 mb-1 block">نسبة الموظف %</label><Input type="number" step="0.01" className="bg-white/5 border-white/10 text-white" value={contribForm.employee_percentage} onChange={e => setContribForm(p => ({ ...p, employee_percentage: e.target.value }))} /></div>
                  <div><label className="text-xs text-white/50 mb-1 block">نسبة صاحب العمل %</label><Input type="number" step="0.01" className="bg-white/5 border-white/10 text-white" value={contribForm.employer_percentage} onChange={e => setContribForm(p => ({ ...p, employer_percentage: e.target.value }))} /></div>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowContribForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createContrib.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createContrib.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-right pb-3">الاشتراك</th>
                  <th className="text-right pb-3">النوع</th>
                  <th className="text-right pb-3">نسبة الموظف</th>
                  <th className="text-right pb-3">نسبة صاحب العمل</th>
                  <th className="text-right pb-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contribsList.map((c) => (
                  <tr key={String(c.id)} className="hover:bg-white/3">
                    <td className="py-3 text-white font-bold">{String(c.name_ar)}</td>
                    <td className="py-3 text-white/60">{String(c.contribution_type)}</td>
                    <td className="py-3 text-amber-400">{Number(c.employee_percentage)}%</td>
                    <td className="py-3 text-blue-400">{Number(c.employer_percentage)}%</td>
                    <td className="py-3"><Badge className={c.is_active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>{c.is_active ? "نشط" : "غير نشط"}</Badge></td>
                  </tr>
                ))}
                {contribsList.length === 0 && !contributions.isLoading && (
                  <tr><td colSpan={5} className="text-center py-12 text-white/40">لا توجد اشتراكات إلزامية</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
