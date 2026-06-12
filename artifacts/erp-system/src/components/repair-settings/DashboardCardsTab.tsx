import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, CheckCircle2, Trash2, Pencil, Bell, AlertCircle, ArrowRight, Info, Save, Lock, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { DASHBOARD_CARD_ICONS, DASHBOARD_CARD_COLORS } from "@/lib/repairConstants";

interface DashboardCardRow {
  id: number;
  name: string;
  statuses: string[];
  color: string;
  icon: string;
  alert_threshold: number | null;
  sort_order: number;
  is_active: boolean;
  is_system?: boolean;
}

export default function DashboardCardsTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cards = [], isLoading } = useQuery<DashboardCardRow[]>({
    queryKey: ["/api/repair-dashboard-cards"],
    queryFn: () => authFetch(api("/api/repair-dashboard-cards")).then(r => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const [editing, setEditing] = useState<DashboardCardRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/repair-dashboard-cards"] });
    qc.invalidateQueries({ queryKey: ["/api/repair-dashboard"] });
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[idx], next[target]] = [next[target], next[idx]];
    const ids = next.map(c => c.id);
    try {
      await authFetch(api("/api/repair-dashboard-cards/reorder"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      invalidate();
    } catch { toast({ title: "تعذر إعادة الترتيب", variant: "destructive" }); }
  };

  const remove = async (id: number) => {
    if (!confirm("حذف هذا الكارت؟")) return;
    setBusyId(id);
    try {
      const r = await authFetch(api(`/api/repair-dashboard-cards/${id}`), { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "تعذر الحذف");
      }
      toast({ title: "تم حذف الكارت" });
      invalidate();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "تعذر الحذف", variant: "destructive" });
    } finally { setBusyId(null); }
  };

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-amber-400/70" />
          </div>
          <h3 className="text-ink/80 text-sm font-bold mb-1">صلاحيات المسؤول مطلوبة</h3>
          <p className="text-ink/35 text-[12px] leading-relaxed">
            تخصيص كروت لوحة الصيانة متاح لمدير النظام فقط لضمان توحيد العرض بين الفرع والفنيين.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 flex-1">
            <Info className="w-4 h-4 text-amber-400/85 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-300/70 leading-relaxed">
              كل كارت يضمّ حالة واحدة أو أكثر، يُعرض أعلى صفحة الصيانة بحجم نسبي حسب عدد البطاقات. الترتيب من اليمين لليسار.
            </p>
          </div>
        </div>
        <button onClick={() => { setShowNew(true); setEditing(null); }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all">
          <Plus className="w-3.5 h-3.5" /> كارت جديد
        </button>
      </div>

      {/* List */}
      <div className="px-5 py-4">
        {isLoading && <div className="text-center text-ink/30 text-sm py-8">جارٍ التحميل...</div>}
        {!isLoading && cards.length === 0 && (
          <div className="text-center text-ink/30 text-sm py-8">لا توجد كروت — أضف كارت جديد</div>
        )}
        <div className="flex flex-col gap-2">
          {cards.map((c, i) => {
            const Icon = DASHBOARD_CARD_ICONS[c.icon] ?? Wrench;
            return (
              <div key={c.id}
                className="rounded-2xl border border-line bg-surface p-3 flex items-center gap-3 hover:border-line transition-all">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-ink/30 hover:text-ink/70 hover:bg-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                    <ArrowRight className="w-3 h-3 rotate-90" />
                  </button>
                  <button onClick={() => move(i, +1)} disabled={i === cards.length - 1}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-ink/30 hover:text-ink/70 hover:bg-surface disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                    <ArrowRight className="w-3 h-3 -rotate-90" />
                  </button>
                </div>

                {/* Icon + color preview */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{ background: `${c.color}22`, borderColor: `${c.color}40` }}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold text-ink/85 truncate">{c.name}</span>
                    {c.is_system && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface text-ink/40 font-medium">افتراضي</span>}
                    {c.alert_threshold != null && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/80 font-medium flex items-center gap-1">
                        <Bell className="w-2.5 h-2.5" /> ≥ {c.alert_threshold}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.statuses.slice(0, 5).map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface text-ink/45 font-mono">{s}</span>
                    ))}
                    {c.statuses.length > 5 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface text-ink/35">+{c.statuses.length - 5}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(c); setShowNew(false); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-ink/30 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                    title="تعديل">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)} disabled={busyId === c.id || cards.length <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-ink/30 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title={cards.length <= 1 ? "لا يمكن حذف الكارت الأخير" : "حذف"}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit/Create dialog */}
      {(editing || showNew) && (
        <DashboardCardEditor
          initial={editing}
          onClose={() => { setEditing(null); setShowNew(false); }}
          onSaved={() => { setEditing(null); setShowNew(false); invalidate(); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD CARD EDITOR (modal-within-modal)
══════════════════════════════════════════════════════════════ */
interface CompanyStatus {
  id: number;
  key: string;
  label_ar: string;
  color: string;
  sort_order: number;
  is_system: boolean;
}

function DashboardCardEditor({
  initial, onClose, onSaved,
}: {
  initial: DashboardCardRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [statuses, setStatuses] = useState<string[]>(initial?.statuses ?? []);
  const [color, setColor] = useState(initial?.color ?? DASHBOARD_CARD_COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? "Wrench");
  const [alertThreshold, setAlertThreshold] = useState<string>(initial?.alert_threshold?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  /* Fetch the REAL per-company statuses (same list jobs are tagged with).
     This includes system defaults like waiting_parts plus any custom ones
     the company has added via /api/repair-statuses CRUD. */
  const { data: companyStatuses = [], isLoading: loadingStatuses } = useQuery<CompanyStatus[]>({
    queryKey: ["/api/repair-statuses"],
    queryFn: () => authFetch(api("/api/repair-statuses")).then(r => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  /* Inline "add status" form */
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(DASHBOARD_CARD_COLORS[0]);
  const [creatingStatus, setCreatingStatus] = useState(false);

  const PreviewIcon = DASHBOARD_CARD_ICONS[icon] ?? Wrench;

  const toggleStatus = (key: string) => {
    setStatuses(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  /* Auto-generate a clean snake_case key from Arabic/English label */
  const slugify = (label: string): string => {
    const ascii = label.toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, "")
      .trim().replace(/\s+/g, "_");
    return ascii.match(/[\u0600-\u06FF]/) ? `custom_${Date.now().toString(36)}` : ascii;
  };

  const createStatus = async () => {
    const label = newStatusLabel.trim();
    if (!label) { toast({ title: "اكتب اسم الحالة", variant: "destructive" }); return; }
    const key = slugify(label);
    setCreatingStatus(true);
    try {
      const r = await authFetch(api("/api/repair-statuses"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          label_ar: label,
          color: newStatusColor,
          sort_order: companyStatuses.length + 1,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "تعذر إضافة الحالة");
      }
      const created = await r.json();
      toast({ title: "تم إضافة الحالة" });
      setStatuses(prev => [...prev, created.key ?? key]);
      setNewStatusLabel("");
      setShowAddStatus(false);
      qc.invalidateQueries({ queryKey: ["/api/repair-statuses"] });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "تعذر إضافة الحالة", variant: "destructive" });
    } finally { setCreatingStatus(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast({ title: "الاسم مطلوب", variant: "destructive" }); return; }
    if (statuses.length === 0) { toast({ title: "اختَر حالة واحدة على الأقل", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        statuses,
        color,
        icon,
        alert_threshold: alertThreshold.trim() === "" ? null : Number(alertThreshold),
      };
      const url = initial
        ? api(`/api/repair-dashboard-cards/${initial.id}`)
        : api("/api/repair-dashboard-cards");
      const r = await authFetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "تعذر الحفظ");
      }
      toast({ title: initial ? "تم تحديث الكارت" : "تم إنشاء الكارت" });
      onSaved();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "تعذر الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-8 pb-8 bg-black/70 backdrop-blur-md" dir="rtl"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel rounded-2xl border border-line w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxWidth: 580, maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${color}22`, border: `1px solid ${color}40` }}>
            <PreviewIcon className="w-4 h-4" style={{ color }} />
          </div>
          <h3 className="flex-1 text-sm font-bold text-ink/85">
            {initial ? "تعديل الكارت" : "كارت جديد"}
          </h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink/30 hover:text-ink/70 hover:bg-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Live preview */}
          <div className="rounded-2xl p-3 border bg-gradient-to-br to-transparent flex flex-col gap-1"
            style={{ background: `linear-gradient(135deg, ${color}22, transparent)`, borderColor: `${color}40` }}>
            <div className="flex items-center justify-between">
              <PreviewIcon className="w-4 h-4" style={{ color }} />
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `${color}cc` }}>
                {name || "اسم الكارت"}
              </span>
            </div>
            <div className="text-3xl font-black leading-none tracking-tight" style={{ color }}>
              0
            </div>
            <div className="h-1 rounded-full mt-1" style={{ background: `${color}33` }}>
              <div className="h-full rounded-full transition-all" style={{ width: "40%", background: color }} />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[11px] text-ink/45 font-bold mb-1.5 block">اسم الكارت</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="مثال: بانتظار قطعة" maxLength={40}
              className="erp-input w-full text-sm" />
          </div>

          {/* Statuses — pulled from REAL per-company list (includes waiting_parts
              and any custom statuses you add). */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] text-ink/45 font-bold">
                الحالات المضمومة <span className="text-amber-400/85">({statuses.length})</span>
              </label>
              <button type="button" onClick={() => setShowAddStatus(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-surface border border-line text-ink/55 text-[10px] font-bold transition-all">
                <Plus className="w-3 h-3" /> حالة جديدة
              </button>
            </div>

            {/* Inline create form */}
            {showAddStatus && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2 mb-2 flex items-center gap-2">
                <input value={newStatusLabel} onChange={e => setNewStatusLabel(e.target.value)}
                  placeholder="اسم الحالة بالعربية" maxLength={40}
                  className="erp-input flex-1 text-[12px]" />
                <div className="flex gap-0.5">
                  {DASHBOARD_CARD_COLORS.slice(0, 6).map(c => (
                    <button key={c} type="button" onClick={() => setNewStatusColor(c)}
                      className="w-5 h-5 rounded-md border-2"
                      style={{
                        background: c,
                        borderColor: newStatusColor === c ? "var(--text-1)" : "transparent",
                      }}
                      title={c} />
                  ))}
                </div>
                <button type="button" onClick={createStatus} disabled={creatingStatus}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 border border-amber-500/50 text-amber-100 text-[11px] font-bold disabled:opacity-50">
                  {creatingStatus ? "..." : "إضافة"}
                </button>
              </div>
            )}

            <div className="rounded-xl border border-line p-2 max-h-56 overflow-y-auto">
              {loadingStatuses ? (
                <div className="text-center text-ink/30 text-xs py-4">جارٍ التحميل...</div>
              ) : companyStatuses.length === 0 ? (
                <div className="text-center text-ink/35 text-xs py-4">
                  لا توجد حالات بعد — أضف واحدة بالأعلى
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {companyStatuses.map(s => {
                    const on = statuses.includes(s.key);
                    return (
                      <button key={s.key} type="button" onClick={() => toggleStatus(s.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          on
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                            : "bg-surface border-line text-ink/45 hover:text-ink/75 hover:border-line"
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                        {s.label_ar}
                        {!s.is_system && (
                          <span className="text-[8px] px-1 rounded bg-amber-500/15 text-amber-300/80 font-bold">مخصص</span>
                        )}
                        {on && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Show stale/orphan statuses (in card but not in current list) */}
            {(() => {
              const known = new Set(companyStatuses.map(s => s.key));
              const orphans = statuses.filter(k => !known.has(k));
              if (orphans.length === 0) return null;
              return (
                <p className="text-[10px] text-amber-400/70 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  حالات لم تعد موجودة: {orphans.join(", ")} — احذفها أو أبقِها للسجلّات القديمة
                </p>
              );
            })()}
          </div>

          {/* Color */}
          <div>
            <label className="text-[11px] text-ink/45 font-bold mb-1.5 block">اللون</label>
            <div className="flex flex-wrap gap-1.5">
              {DASHBOARD_CARD_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-lg border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: color === c ? "var(--text-1)" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}40` : "none",
                  }}
                  title={c} />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-[11px] text-ink/45 font-bold mb-1.5 block">الأيقونة</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DASHBOARD_CARD_ICONS).map(([key, IconC]) => (
                <button key={key} type="button" onClick={() => setIcon(key)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                    icon === key
                      ? "bg-amber-500/20 border-amber-500/50 text-ink"
                      : "bg-surface border-line text-ink/40 hover:text-ink/75 hover:border-line"
                  }`}
                  title={key}>
                  <IconC className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Alert threshold */}
          <div>
            <label className="text-[11px] text-ink/45 font-bold mb-1.5 block flex items-center gap-1.5">
              <Bell className="w-3 h-3" /> تنبيه عند تجاوز (اختياري)
            </label>
            <input value={alertThreshold} onChange={e => setAlertThreshold(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="مثال: 5" inputMode="numeric"
              className="erp-input w-full text-sm" />
            <p className="text-[10px] text-ink/30 mt-1">يتغيّر شكل الكارت لتنبيه بصري عند بلوغ هذا الحد</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-line shrink-0 bg-surface">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface hover:bg-surface border border-line text-ink/60 text-xs font-bold transition-all">
            إلغاء
          </button>
          <div className="flex-1" />
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/40 text-amber-100 text-xs font-bold transition-all disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════════════════════
   DEVICE MODELS TAB — إضافة موديلات مخصّصة لكل ماركة وفئة
══════════════════════════════════════════════════════════════ */

export const BRAND_CATEGORIES: Record<string, string[]> = {
  "Apple":   ["iPhone","iPad","Apple Watch","AirPods","Mac"],
  "Samsung": ["Galaxy S","Galaxy A","Galaxy M","Galaxy Z","Galaxy Tab"],
  "Xiaomi":  ["Redmi","Xiaomi","POCO","Xiaomi Pad"],
  "Huawei":  ["P Series","Mate Series","Nova Series","Y Series","MatePad"],
  "Oppo":    ["A Series","Reno","Find X","F Series"],
  "Vivo":    ["Y Series","V Series","X Series"],
  "Realme":  ["C Series","Number Series","GT Series","Narzo"],
  "Nokia":   ["G Series","C Series","X Series"],
  "OnePlus": ["OnePlus","Nord"],
  "أخرى":    ["جهاز آخر"],
};


