import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  X, ClipboardList, CheckSquare, GitBranch, Users, QrCode,
  Plus, ChevronDown, CheckCircle2, XCircle, Trash2, Pencil,
  Bell, BellOff, Percent, AlertCircle, Zap,
  ArrowLeft, Copy,
  Info, Settings2, Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
type Platform = "apple" | "android";
type SettingsTab = "checklist" | "qc" | "statuses" | "technicians" | "qr";
type ChecklistKind = "inspection" | "qc";

interface ChecklistRow {
  id: number;
  label_ar: string;
  category: string;
  device_type: string;
  sort_order: number;
}

interface ERP_User {
  id: number;
  name: string;
  role?: string;
  active?: boolean;
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const PLATFORM_META: Record<Platform, { label: string; icon: string; apiPrefix: string }> = {
  apple:   { label: "أبل",    icon: "", apiPrefix: "" },
  android: { label: "أندرويد", icon: "🤖", apiPrefix: "android" },
};

const PIPELINE_STAGES: Array<{
  key: string; label: string;
  color: string; dot: string;
  desc: string; terminal?: boolean;
}> = [
  { key: "received",                  label: "استلام الجهاز",        color: "text-violet-400", dot: "bg-violet-400",   desc: "تسجيل الطلب واستلام الجهاز من العميل" },
  { key: "initial_inspection",        label: "الفحص الأولي",          color: "text-indigo-400", dot: "bg-indigo-400",   desc: "فحص الجهاز ظاهرياً وتسجيل حالته" },
  { key: "diagnosis",                 label: "التشخيص",              color: "text-blue-400",   dot: "bg-blue-400",     desc: "تحديد الأعطال وتشخيص المشكلة" },
  { key: "waiting_customer_approval", label: "انتظار موافقة العميل",  color: "text-amber-400",  dot: "bg-amber-400",    desc: "انتظار قرار العميل بالإصلاح" },
  { key: "approved",                  label: "تمت الموافقة",          color: "text-emerald-400",dot: "bg-emerald-400",  desc: "وافق العميل على السعر والإجراء" },
  { key: "in_repair",                 label: "جاري الإصلاح",         color: "text-cyan-400",   dot: "bg-cyan-400",     desc: "الجهاز يُصلَّح حالياً من قِبل الفني" },
  { key: "repaired",                  label: "تم الإصلاح",           color: "text-teal-400",   dot: "bg-teal-400",     desc: "اكتمل الإصلاح وجاهز للمراجعة" },
  { key: "final_quality_check",       label: "مراقبة الجودة",         color: "text-purple-400", dot: "bg-purple-400",   desc: "مراجعة الجودة النهائية قبل التسليم" },
  { key: "ready_for_delivery",        label: "جاهز للتسليم",         color: "text-lime-400",   dot: "bg-lime-400",     desc: "الجهاز جاهز وبانتظار استلام العميل" },
  { key: "delivered",                 label: "تم التسليم",           color: "text-green-400",  dot: "bg-green-400",    desc: "تم تسليم الجهاز للعميل بنجاح" },
  { key: "rejected",                  label: "مرفوض",               color: "text-red-400",    dot: "bg-red-400",      desc: "رفض العميل الإصلاح أو التشخيص", terminal: true },
  { key: "cancelled",                 label: "ملغي",                 color: "text-rose-400",   dot: "bg-rose-400",     desc: "إلغاء الطلب من النظام", terminal: true },
];

const TABS: Array<{ id: SettingsTab; label: string; sublabel: string; icon: React.FC<{ className?: string }> }> = [
  { id: "checklist",   label: "بنود الفحص",      sublabel: "قوالب الفحص الأولي",  icon: ClipboardList },
  { id: "qc",          label: "بنود QC",          sublabel: "مراقبة الجودة",       icon: CheckSquare },
  { id: "statuses",    label: "حالات الصيانة",    sublabel: "مسار الإصلاح",        icon: GitBranch },
  { id: "technicians", label: "الفنيين",          sublabel: "إعدادات الموظفين",    icon: Users },
  { id: "qr",          label: "QR والتتبع",       sublabel: "متابعة العميل",       icon: QrCode },
];

/* ══════════════════════════════════════════════════════════════
   CHECKLIST TAB (shared for inspection + QC)
══════════════════════════════════════════════════════════════ */
function ChecklistTab({ kind }: { kind: ChecklistKind }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activePlatform, setActivePlatform] = useState<Platform>("apple");
  const [editingId, setEditingId]           = useState<number | null>(null);
  const [editLabel, setEditLabel]           = useState("");
  const [addingToCat, setAddingToCat]       = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel]     = useState("");
  const [showNewCat, setShowNewCat]         = useState(false);
  const [newCatInput, setNewCatInput]       = useState("");
  const [seeding, setSeeding]               = useState(false);
  const [localCats, setLocalCats]           = useState<string[]>([]);
  const [expandedCats, setExpandedCats]     = useState<Set<string>>(new Set());

  /* device_type encoding: inspection → "apple"/"android", QC → "qc_apple"/"qc_android" */
  const deviceType = kind === "inspection"
    ? activePlatform
    : `qc_${activePlatform}`;

  const qKey = ["/api/repair-checklist-items", deviceType];

  const { data: rawItems, isLoading, isError } = useQuery<ChecklistRow[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await authFetch(api(`/api/repair-checklist-items?device_type=${deviceType}`));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 0,
  });

  const items = useMemo(
    () => (rawItems ?? []).map(i => ({ ...i, category: i.category ?? "عام", device_type: i.device_type ?? deviceType })),
    [rawItems, deviceType],
  );

  const dbCategories = useMemo(() => {
    const seen = new Set<string>(); const order: string[] = [];
    for (const item of items) { if (!seen.has(item.category)) { seen.add(item.category); order.push(item.category); } }
    return order;
  }, [items]);

  const allCategories = useMemo(() => {
    const result = [...dbCategories];
    for (const lc of localCats) { if (!result.includes(lc)) result.push(lc); }
    return result;
  }, [dbCategories, localCats]);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: qKey }), [qc, qKey.join(",")]);

  useEffect(() => {
    if (!dbCategories.length) return;
    setExpandedCats(prev => { const n = new Set(prev); dbCategories.forEach(c => n.add(c)); return n; });
  }, [dbCategories.join(",")]);

  useEffect(() => {
    setEditingId(null); setAddingToCat(null); setNewItemLabel(""); setLocalCats([]); setExpandedCats(new Set());
  }, [activePlatform]);

  const toggleCat = (cat: string) =>
    setExpandedCats(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  const seedPlatform = async () => {
    if (kind === "qc") {
      toast({ title: "بنود QC يُضاف يدوياً — لا يوجد seed افتراضي" }); return;
    }
    setSeeding(true);
    const r = await authFetch(api("/api/repair-checklist-items/seed-platform"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: activePlatform }),
    });
    setSeeding(false);
    if (r.status === 409) { toast({ title: "البنود محملة مسبقاً" }); return; }
    if (!r.ok)            { toast({ title: "خطأ في تحميل البنود", variant: "destructive" }); return; }
    const { count } = await r.json();
    toast({ title: `✓ تم تحميل ${count} بند` });
    invalidate();
  };

  const addItemToCat = async (cat: string) => {
    const label = newItemLabel.trim(); if (!label) return;
    const r = await authFetch(api("/api/repair-checklist-items"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label_ar: label, category: cat, device_type: deviceType }),
    });
    if (!r.ok) { toast({ title: "خطأ في الإضافة", variant: "destructive" }); return; }
    setNewItemLabel(""); setAddingToCat(null);
    setLocalCats(prev => prev.filter(c => c !== cat));
    invalidate();
  };

  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) return;
    const r = await authFetch(api(`/api/repair-checklist-items/${id}`), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label_ar: editLabel.trim() }),
    });
    if (!r.ok) { toast({ title: "خطأ في التعديل", variant: "destructive" }); return; }
    setEditingId(null); invalidate();
  };

  const deleteItem = async (id: number) => {
    await authFetch(api(`/api/repair-checklist-items/${id}`), { method: "DELETE" });
    invalidate();
  };

  const openAddToCat = (cat: string) => {
    if (!dbCategories.includes(cat)) setLocalCats(prev => prev.includes(cat) ? prev : [...prev, cat]);
    setExpandedCats(prev => { const n = new Set(prev); n.add(cat); return n; });
    setAddingToCat(cat); setNewItemLabel(""); setEditingId(null); setShowNewCat(false);
  };

  const confirmAddCat = () => {
    const name = newCatInput.trim();
    if (!name || allCategories.includes(name)) return;
    openAddToCat(name); setNewCatInput("");
  };

  const isEmpty = !isLoading && !isError && items.length === 0 && localCats.length === 0;
  const isApple = activePlatform === "apple";

  /* colours */
  const accent    = isApple ? "text-white"        : "text-emerald-300";
  const accentDim = isApple ? "text-white/55"     : "text-emerald-400/70";
  const accentBg  = isApple ? "bg-white/10"       : "bg-emerald-500/12";
  const accentBdr = isApple ? "border-white/20"   : "border-emerald-500/25";
  const badgeCls  = isApple ? "bg-white/8 text-white/40" : "bg-emerald-500/10 text-emerald-500/60";
  const kindColor = kind === "inspection" ? "violet" : "purple";
  const kindLabel = kind === "inspection" ? "بنود الفحص" : "بنود QC";

  return (
    <div className="flex flex-col h-full">
      {/* Platform tabs */}
      <div className="flex border-b border-white/10 shrink-0">
        {(["apple", "android"] as Platform[]).map(p => {
          const meta = PLATFORM_META[p]; const isActive = activePlatform === p;
          return (
            <button key={p} onClick={() => setActivePlatform(p)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
                isActive
                  ? p === "apple"
                    ? "border-white/70 text-white bg-white/5"
                    : "border-emerald-400 text-emerald-300 bg-emerald-500/8"
                  : "border-transparent text-white/30 hover:text-white/55"
              }`}>
              <span className="text-base">{meta.icon}</span>
              <span>{meta.label}</span>
              {isActive && items.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums ${badgeCls}`}>
                  {items.length}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="flex items-center px-4 gap-2">
          <button onClick={() => setShowNewCat(v => !v)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors border border-white/8 hover:border-white/20 rounded-lg px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> تصنيف جديد
          </button>
          {kind === "inspection" && (
            <button onClick={seedPlatform} disabled={seeding}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40 ${
                isApple ? "bg-white/8 border-white/15 text-white/60 hover:bg-white/12" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/15"
              }`}>
              <Zap className="w-3 h-3" />
              {seeding ? "جاري..." : "تحميل افتراضي"}
            </button>
          )}
        </div>
      </div>

      {/* Add cat input */}
      {showNewCat && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/2 shrink-0">
          <input autoFocus value={newCatInput}
            onChange={e => setNewCatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmAddCat(); if (e.key === "Escape") { setShowNewCat(false); setNewCatInput(""); }}}
            placeholder="اسم التصنيف..."
            className="erp-input flex-1 text-sm py-1" />
          <button onClick={confirmAddCat} disabled={!newCatInput.trim()} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30">
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowNewCat(false); setNewCatInput(""); }} className="text-white/30 hover:text-white/60">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-32 gap-2 text-red-400/70 text-sm">
            <AlertCircle className="w-4 h-4" /> خطأ في تحميل البيانات
          </div>
        )}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 px-8">
            <div className={`w-12 h-12 rounded-2xl bg-${kindColor}-500/10 flex items-center justify-center`}>
              {kind === "inspection" ? <ClipboardList className={`w-6 h-6 text-${kindColor}-400/60`} /> : <CheckSquare className={`w-6 h-6 text-${kindColor}-400/60`} />}
            </div>
            <p className="text-white/40 text-sm text-center">لا توجد بنود {kindLabel} لـ {PLATFORM_META[activePlatform].label}</p>
            {kind === "inspection" && (
              <button onClick={seedPlatform} disabled={seeding}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${accentBg} ${accentBdr} ${accent}`}>
                <Zap className="w-4 h-4" />
                {seeding ? "جاري التحميل..." : `تحميل بنود ${PLATFORM_META[activePlatform].label}`}
              </button>
            )}
            <button onClick={() => { setShowNewCat(true); }}
              className="text-xs text-white/25 hover:text-white/50 transition-colors">
              أو أضف تصنيفاً يدوياً
            </button>
          </div>
        )}
        {!isLoading && !isError && !isEmpty && (
          <div className="pb-4">
            {allCategories.map(cat => {
              const catItems = items.filter(i => i.category === cat).sort((a, b) => a.sort_order - b.sort_order);
              const isExpanded = expandedCats.has(cat);
              const isLocal    = !dbCategories.includes(cat);
              return (
                <div key={cat} className="border-b border-white/5 last:border-b-0">
                  <button onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-right">
                    <ChevronDown className={`w-3.5 h-3.5 ${accentDim} transition-transform duration-200 shrink-0 ${isExpanded ? "" : "-rotate-90"}`} />
                    <span className={`text-[13px] font-semibold flex-1 text-right ${accentDim}`}>
                      {cat}
                      {isLocal && <span className="text-[10px] text-white/25 font-normal mr-2">جديد</span>}
                    </span>
                    {!isLocal && <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${badgeCls}`}>{catItems.length}</span>}
                    <span onClick={e => { e.stopPropagation(); openAddToCat(cat); }}
                      className="flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-lg border border-transparent text-white/25 hover:bg-white/8 hover:border-white/12 hover:text-white/60 transition-all shrink-0">
                      <Plus className="w-3 h-3" /> بند
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-2 pt-0.5 pb-2 space-y-0.5">
                      {catItems.length === 0 && addingToCat !== cat && (
                        <p className="text-center text-white/20 text-xs py-4">لا توجد بنود — اضغط «بند» لإضافة الأول</p>
                      )}
                      {catItems.map((item, idx) => (
                        <div key={item.id}
                          className="flex items-center gap-2 py-2 px-3 rounded-xl border border-transparent hover:border-white/8 hover:bg-white/[0.03] transition-all group">
                          <span className="text-[10px] text-white/15 w-5 text-left shrink-0 tabular-nums group-hover:text-white/35">{idx + 1}</span>
                          {editingId === item.id ? (
                            <>
                              <input autoFocus value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                                className="erp-input flex-1 text-sm py-0.5" />
                              <button onClick={() => saveEdit(item.id)} className="text-emerald-400 hover:text-emerald-300 p-1 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditingId(null)} className="text-white/30 p-1 shrink-0"><XCircle className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-white/75">{item.label_ar}</span>
                              <button onClick={() => { setEditingId(item.id); setEditLabel(item.label_ar); setAddingToCat(null); }}
                                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-violet-400 p-1 transition-all shrink-0">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      {addingToCat === cat && (
                        <div className="flex items-center gap-2 py-1.5 px-3 mt-0.5 rounded-xl border border-white/10 bg-white/3">
                          <input autoFocus value={newItemLabel}
                            onChange={e => setNewItemLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addItemToCat(cat); if (e.key === "Escape") { setAddingToCat(null); setNewItemLabel(""); }}}
                            placeholder={`بند جديد في «${cat}»...`}
                            className="erp-input flex-1 text-sm py-0.5" />
                          <button onClick={() => addItemToCat(cat)} disabled={!newItemLabel.trim()}
                            className="text-emerald-400 hover:text-emerald-300 p-1 disabled:opacity-30 shrink-0"><CheckCircle2 className="w-4 h-4" /></button>
                          <button onClick={() => { setAddingToCat(null); setNewItemLabel(""); }}
                            className="text-white/25 hover:text-white/60 p-1 shrink-0"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATUSES TAB
══════════════════════════════════════════════════════════════ */
function StatusesTab() {
  const mainStages  = PIPELINE_STAGES.filter(s => !s.terminal);
  const termStages  = PIPELINE_STAGES.filter(s =>  s.terminal);

  const StageRow = ({ s, index }: { s: typeof PIPELINE_STAGES[0]; index?: number }) => (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors group">
      {index !== undefined && (
        <span className="text-[10px] text-white/15 tabular-nums w-4 mt-0.5 shrink-0">{index + 1}</span>
      )}
      <div className={`w-2 h-2 rounded-full ${s.dot} mt-1.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${s.color}`}>{s.label}</span>
          {s.terminal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400/70 font-medium">طرفي</span>
          )}
        </div>
        <p className="text-[12px] text-white/35 mt-0.5">{s.desc}</p>
      </div>
      <code className="text-[10px] text-white/20 font-mono shrink-0 mt-0.5 hidden group-hover:block">{s.key}</code>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-white/8">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
          <Info className="w-4 h-4 text-blue-400/70 shrink-0 mt-0.5" />
          <p className="text-[12px] text-blue-300/60 leading-relaxed">
            مسار الصيانة محدد من النظام ولا يمكن تغيير ترتيبه. يمكنك مراجعة تسلسل الحالات والانتقالات المتاحة بين كل مرحلة.
          </p>
        </div>
      </div>

      {/* Main pipeline */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[11px] font-bold tracking-widest text-white/25 uppercase mb-1">المسار الرئيسي</h3>
      </div>
      <div className="mx-5 rounded-xl border border-white/8 overflow-hidden">
        {/* Visual flow */}
        <div className="flex items-center gap-0 px-4 py-3 border-b border-white/8 bg-white/[0.02] overflow-x-auto">
          {mainStages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-0 shrink-0">
              <div className={`flex flex-col items-center gap-1`}>
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className={`text-[9px] font-medium ${s.color} whitespace-nowrap`}>{s.label}</span>
              </div>
              {i < mainStages.length - 1 && (
                <ArrowLeft className="w-3 h-3 text-white/15 mx-1.5" />
              )}
            </div>
          ))}
        </div>
        {mainStages.map((s, i) => <StageRow key={s.key} s={s} index={i} />)}
      </div>

      {/* Terminal states */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[11px] font-bold tracking-widest text-white/25 uppercase mb-1">الحالات الطرفية</h3>
      </div>
      <div className="mx-5 mb-5 rounded-xl border border-white/8 overflow-hidden">
        {termStages.map(s => <StageRow key={s.key} s={s} />)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TECHNICIANS TAB
══════════════════════════════════════════════════════════════ */
const TECH_STORAGE_KEY = "repair_tech_settings";

interface TechSettings {
  commission: number;    /* % */
  notifications: boolean;
  specialty: string;
}

function TechniciansTab() {
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<ERP_User[]>({
    queryKey: ["/api/auth/users"],
    queryFn: async () => {
      const r = await authFetch(api("/api/auth/users"));
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    staleTime: 60_000,
  });

  /* settings stored locally per user id */
  const [settings, setSettings] = useState<Record<number, TechSettings>>(() => {
    try { return JSON.parse(localStorage.getItem(TECH_STORAGE_KEY) ?? "{}"); }
    catch { return {}; }
  });

  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editBuf,   setEditBuf]       = useState<TechSettings>({ commission: 0, notifications: true, specialty: "" });

  const persist = (next: Record<number, TechSettings>) => {
    localStorage.setItem(TECH_STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
  };

  const startEdit = (u: ERP_User) => {
    setEditingId(u.id);
    setEditBuf(settings[u.id] ?? { commission: 0, notifications: true, specialty: "" });
  };

  const saveEdit = (id: number) => {
    persist({ ...settings, [id]: editBuf });
    setEditingId(null);
    toast({ title: "✓ تم حفظ إعدادات الفني" });
  };

  const techUsers = users.filter(u => u.active !== false);

  const getSettings = (id: number): TechSettings =>
    settings[id] ?? { commission: 0, notifications: true, specialty: "" };

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2 text-white/30 text-[12px]">
          <Info className="w-3.5 h-3.5" />
          <span>الإعدادات تُخزّن محلياً لكل جهاز</span>
        </div>
        <span className="text-[11px] text-white/20">{techUsers.length} فني</span>
      </div>

      <div className="overflow-y-auto flex-1">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && techUsers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-white/30 text-sm">
            <Users className="w-8 h-8 opacity-40" />
            لا يوجد مستخدمون نشطون
          </div>
        )}

        {!isLoading && techUsers.map(u => {
          const s = getSettings(u.id);
          const isEdit = editingId === u.id;
          return (
            <div key={u.id}
              className="border-b border-white/5 last:border-b-0 px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-3">
                {/* avatar */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center shrink-0 text-sm font-bold text-violet-300">
                  {u.name[0] ?? "؟"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white/85">{u.name}</span>
                    {u.role && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/35">{u.role}</span>}
                  </div>

                  {!isEdit ? (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[12px] text-white/35">
                        <Percent className="w-3 h-3" /> {s.commission}%
                      </span>
                      <span className="text-white/15">·</span>
                      {s.specialty && <span className="text-[12px] text-white/35">{s.specialty}</span>}
                      {s.specialty && <span className="text-white/15">·</span>}
                      <span className={`flex items-center gap-1 text-[12px] ${s.notifications ? "text-emerald-400/60" : "text-white/25"}`}>
                        {s.notifications ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                        {s.notifications ? "إشعارات مفعّلة" : "إشعارات مُعطّلة"}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-white/35 w-24 shrink-0">التخصص</label>
                        <input value={editBuf.specialty}
                          onChange={e => setEditBuf(b => ({ ...b, specialty: e.target.value }))}
                          placeholder="مثال: هواتف — شاشات"
                          className="erp-input flex-1 text-sm py-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-white/35 w-24 shrink-0">نسبة العمولة</label>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={100} value={editBuf.commission}
                            onChange={e => setEditBuf(b => ({ ...b, commission: Number(e.target.value) }))}
                            className="erp-input w-20 text-sm py-1 text-center" />
                          <span className="text-white/35 text-sm">%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-white/35 w-24 shrink-0">الإشعارات</label>
                        <button onClick={() => setEditBuf(b => ({ ...b, notifications: !b.notifications }))}
                          className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[12px] transition-all ${
                            editBuf.notifications
                              ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-400"
                              : "bg-white/5 border-white/12 text-white/35"
                          }`}>
                          {editBuf.notifications ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                          {editBuf.notifications ? "مفعّلة" : "مُعطّلة"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => saveEdit(u.id)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/20 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> حفظ
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg border border-white/10 text-white/30 text-[12px] hover:border-white/20 hover:text-white/50 transition-colors">
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isEdit && (
                  <button onClick={() => startEdit(u)}
                    className="text-white/20 hover:text-white/55 p-1.5 transition-colors shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   QR & TRACKING TAB
══════════════════════════════════════════════════════════════ */
const QR_STORAGE_KEY = "repair_qr_settings";

function QrTrackingTab() {
  const { toast } = useToast();

  const [baseUrl, setBaseUrl] = useState<string>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QR_STORAGE_KEY) ?? "{}");
      return saved.baseUrl ?? "";
    } catch { return ""; }
  });

  const [sampleJobNo, setSampleJobNo]   = useState("REP-0001");
  const [copied, setCopied]             = useState(false);
  const [editingUrl, setEditingUrl]     = useState(false);
  const [urlBuf, setUrlBuf]             = useState(baseUrl);

  const effectiveBase = baseUrl || `${window.location.origin}/track`;
  const trackingUrl   = `${effectiveBase}/${sampleJobNo}`;

  const saveUrl = () => {
    const trimmed = urlBuf.trim().replace(/\/$/, "");
    localStorage.setItem(QR_STORAGE_KEY, JSON.stringify({ baseUrl: trimmed }));
    setBaseUrl(trimmed);
    setEditingUrl(false);
    toast({ title: "✓ تم حفظ إعدادات QR" });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-5">

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/8 border border-violet-500/15">
          <QrCode className="w-5 h-5 text-violet-400/70 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-violet-300/80 mb-1">تتبع العميل عبر QR</p>
            <p className="text-[12px] text-violet-300/50 leading-relaxed">
              كل طلب صيانة يحصل على رمز QR خاص به. العميل يصوّره ويتابع حالة جهازه في أي وقت دون الحاجة لتواصل مباشر.
            </p>
          </div>
        </div>

        {/* Base URL setting */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white/50">رابط التتبع الأساسي</span>
            <button onClick={() => { setUrlBuf(baseUrl); setEditingUrl(v => !v); }}
              className="text-[11px] text-white/25 hover:text-white/50 transition-colors">
              {editingUrl ? "إلغاء" : "تعديل"}
            </button>
          </div>
          <div className="px-4 py-3">
            {editingUrl ? (
              <div className="flex items-center gap-2">
                <input value={urlBuf} onChange={e => setUrlBuf(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveUrl(); if (e.key === "Escape") setEditingUrl(false); }}
                  placeholder="https://your-domain.com/track"
                  className="erp-input flex-1 text-sm py-1 font-mono text-[12px]" />
                <button onClick={saveUrl}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> حفظ
                </button>
              </div>
            ) : (
              <p className="text-[12px] font-mono text-white/45">{effectiveBase}</p>
            )}
          </div>
        </div>

        {/* Sample job no */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8">
            <span className="text-[12px] font-semibold text-white/50">معاينة QR — رقم الطلب</span>
          </div>
          <div className="px-4 py-3">
            <input value={sampleJobNo} onChange={e => setSampleJobNo(e.target.value)}
              placeholder="REP-0001"
              className="erp-input text-sm py-1 w-48 font-mono text-center" />
          </div>
        </div>

        {/* QR Preview */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white/50">معاينة رمز QR</span>
            <div className="flex items-center gap-2">
              <button onClick={copyLink}
                className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 border border-white/8 hover:border-white/20 rounded-lg px-2.5 py-1 transition-all">
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "تم النسخ" : "نسخ الرابط"}
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-5 py-8 px-4">
            {/* QR Code */}
            <div className="p-4 bg-white rounded-2xl shadow-lg shadow-black/30">
              <QRCodeSVG
                value={trackingUrl}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
            {/* URL display */}
            <div className="text-center space-y-1">
              <p className="text-[11px] text-white/25">رابط التتبع</p>
              <code className="text-[12px] text-white/55 font-mono break-all text-center px-2">{trackingUrl}</code>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8">
            <span className="text-[12px] font-semibold text-white/50">كيف يعمل النظام</span>
          </div>
          <div className="divide-y divide-white/5">
            {[
              { step: "١", label: "إنشاء الطلب",   desc: "عند إنشاء طلب صيانة يُنشأ رمز QR تلقائياً" },
              { step: "٢", label: "طباعة QR",      desc: "اطبع رمز الـ QR وضعه على الجهاز أو الإيصال" },
              { step: "٣", label: "تصوير العميل",  desc: "العميل يصوّر الكود ويصل لصفحة التتبع فوراً" },
              { step: "٤", label: "تحديث الحالة",  desc: "كل تحديث في النظام يظهر تلقائياً للعميل" },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 px-4 py-3">
                <span className="text-[13px] font-bold text-white/20 w-5 shrink-0 mt-0.5">{s.step}</span>
                <div>
                  <p className="text-[12px] font-semibold text-white/55">{s.label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════════ */
interface RepairSettingsModalProps {
  onClose: () => void;
  initialTab?: SettingsTab;
}

export default function RepairSettingsModal({ onClose, initialTab = "checklist" }: RepairSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const tabIcon = (tab: typeof TABS[0], active: boolean) => {
    const Icon = tab.icon;
    return <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-300" : "text-white/30"}`} />;
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-4 pb-4 bg-black/75 backdrop-blur-md" dir="rtl"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="glass-panel rounded-2xl border border-white/10 w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxWidth: 860, maxHeight: "94vh" }}>

        {/* ═══ TOP BAR ═══ */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Settings2 className="w-4 h-4 text-violet-300/80" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white/85">إعدادات الصيانة</h2>
            <p className="text-[11px] text-white/30">تخصيص قوالب الفحص والفنيين ومسار الإصلاح</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ BODY: sidebar + content ═══ */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar ── */}
          <div className="w-52 border-l border-white/8 shrink-0 bg-white/[0.015] overflow-y-auto flex flex-col">
            <nav className="flex-1 py-2">
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-right transition-all relative ${
                      active
                        ? "bg-violet-500/12 text-white"
                        : "text-white/40 hover:text-white/65 hover:bg-white/[0.03]"
                    }`}>
                    {active && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-violet-400 rounded-full" />
                    )}
                    {tabIcon(tab, active)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold leading-tight ${active ? "text-white/90" : "text-white/50"}`}>
                        {tab.label}
                      </p>
                      <p className={`text-[11px] leading-tight mt-0.5 ${active ? "text-white/35" : "text-white/25"}`}>
                        {tab.sublabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* sidebar footer */}
            <div className="px-4 py-3 border-t border-white/8">
              <p className="text-[10px] text-white/18 leading-relaxed">
                مُحكم ERP — وحدة الصيانة
              </p>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "checklist"   && <ChecklistTab kind="inspection" />}
            {activeTab === "qc"          && <ChecklistTab kind="qc" />}
            {activeTab === "statuses"    && <StatusesTab />}
            {activeTab === "technicians" && <TechniciansTab />}
            {activeTab === "qr"          && <QrTrackingTab />}
          </div>

        </div>

      </div>
    </div>,
    document.body,
  );
}
