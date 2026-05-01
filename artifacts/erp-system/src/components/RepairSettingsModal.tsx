import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  X, ClipboardList, GitBranch, Users, QrCode,
  Plus, ChevronDown, CheckCircle2, XCircle, Trash2, Pencil,
  Bell, BellOff, Percent, AlertCircle, Zap,
  ArrowLeft, ArrowRight, Copy, Printer,
  Info, Settings2, Save, LayoutDashboard, Lock,
  Search, Wrench, Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { DASHBOARD_CARD_ICONS, DASHBOARD_CARD_COLORS } from "@/lib/repairConstants";
import { useAppSettings } from "@/contexts/app-settings";

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
type DeviceType =
  | "iphone" | "ipad" | "watch" | "airpods" | "mac"
  | "samsung_phone" | "samsung_tablet"
  | "android_phone" | "android_tablet"
  | "other";
type SettingsTab = "checklist" | "statuses" | "dashboard-cards" | "technicians" | "qr" | "models";

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
const DEVICE_TYPE_META: Array<{ key: DeviceType; label: string; emoji: string }> = [
  { key: "iphone",         label: "آيفون",          emoji: "📱" },
  { key: "ipad",           label: "آيباد",          emoji: "📱" },
  { key: "watch",          label: "أبل ووتش",       emoji: "⌚" },
  { key: "airpods",        label: "إيربودز",        emoji: "🎧" },
  { key: "mac",            label: "ماك",            emoji: "💻" },
  { key: "samsung_phone",  label: "سامسونج موبايل", emoji: "📱" },
  { key: "samsung_tablet", label: "سامسونج تابلت",  emoji: "📱" },
  { key: "android_phone",  label: "أندرويد موبايل", emoji: "🤖" },
  { key: "android_tablet", label: "أندرويد تابلت",  emoji: "🤖" },
  { key: "other",          label: "أخرى",           emoji: "🔧" },
];

const DEVICE_TYPE_LABEL: Record<DeviceType, string> =
  Object.fromEntries(DEVICE_TYPE_META.map(d => [d.key, d.label])) as Record<DeviceType, string>;

/* ══════════════════════════════════════════════════════════════
   MANUFACTURER HIERARCHY — 2-level selector
══════════════════════════════════════════════════════════════ */
const MFR_STORAGE_KEY = "muhkam_repair_mfrs_v1";

interface DeviceCategory { key: string; label: string; emoji: string; }
interface Manufacturer   { key: string; label: string; emoji: string; categories: DeviceCategory[]; }

const DEFAULT_MANUFACTURERS: Manufacturer[] = [
  {
    key: "apple", label: "Apple", emoji: "🍎",
    categories: [
      { key: "iphone",  label: "آيفون",    emoji: "📱" },
      { key: "ipad",    label: "آيباد",    emoji: "📱" },
      { key: "watch",   label: "أبل ووتش", emoji: "⌚" },
      { key: "airpods", label: "إيربودز",  emoji: "🎧" },
      { key: "mac",     label: "ماك",      emoji: "💻" },
    ],
  },
  {
    key: "android", label: "Android", emoji: "🤖",
    categories: [
      { key: "android_phone",  label: "موبايل", emoji: "📱" },
      { key: "android_tablet", label: "تابلت",  emoji: "📱" },
    ],
  },
  {
    key: "samsung", label: "Samsung", emoji: "📱",
    categories: [
      { key: "samsung_phone",  label: "سامسونج موبايل", emoji: "📱" },
      { key: "samsung_tablet", label: "سامسونج تابلت",  emoji: "📱" },
    ],
  },
  {
    key: "other", label: "أخرى", emoji: "🔧",
    categories: [
      { key: "other", label: "أخرى", emoji: "🔧" },
    ],
  },
];

function loadManufacturers(): Manufacturer[] {
  try {
    const s = localStorage.getItem(MFR_STORAGE_KEY);
    if (!s) return DEFAULT_MANUFACTURERS;
    const parsed = JSON.parse(s) as Manufacturer[];
    return parsed.length > 0 ? parsed : DEFAULT_MANUFACTURERS;
  } catch { return DEFAULT_MANUFACTURERS; }
}
function saveManufacturers(mfrs: Manufacturer[]) {
  localStorage.setItem(MFR_STORAGE_KEY, JSON.stringify(mfrs));
}

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

const TABS: Array<{
  id: SettingsTab;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  adminOnly?: boolean;
}> = [
  { id: "checklist",       label: "بنود الفحص",       sublabel: "قوالب الفحص و QC حسب نوع الجهاز", icon: ClipboardList },
  { id: "statuses",        label: "حالات الصيانة",    sublabel: "مسار الإصلاح",       icon: GitBranch },
  { id: "dashboard-cards", label: "كروت اللوحة",      sublabel: "تخصيص ملخّص الصفحة", icon: LayoutDashboard, adminOnly: true },
  { id: "technicians",     label: "الفنيين",          sublabel: "إعدادات الموظفين",   icon: Users },
  { id: "qr",              label: "QR والتتبع",       sublabel: "متابعة العميل",      icon: QrCode },
  { id: "models",          label: "الموديلات",        sublabel: "إضافة موديلات مخصّصة",icon: Smartphone },
];

/* Curated Lucide icon set available for dashboard cards */

/* ══════════════════════════════════════════════════════════════
   CHECKLIST TAB — per device type (inspection + QC use same items)
══════════════════════════════════════════════════════════════ */
function ChecklistTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { settings: csSettings } = useAppSettings();
  const isLight = (csSettings.theme ?? "dark") === "light";

  /* ── manufacturer/category state ── */
  const [manufacturers, setManufacturers]   = useState<Manufacturer[]>(loadManufacturers);
  const [activeMfr, setActiveMfr]           = useState<string>("apple");
  const [showAddMfr, setShowAddMfr]         = useState(false);
  const [addMfrLabel, setAddMfrLabel]       = useState("");
  const [addMfrEmoji, setAddMfrEmoji]       = useState("📱");
  const [showAddCat, setShowAddCat]         = useState(false);
  const [addCatLabel, setAddCatLabel]       = useState("");
  const [addCatEmoji, setAddCatEmoji]       = useState("📱");

  /* ── item state ── */
  const [activeType, setActiveType]         = useState<string>("iphone");
  const [editingId, setEditingId]           = useState<number | null>(null);
  const [editLabel, setEditLabel]           = useState("");
  const [addingToCat, setAddingToCat]       = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel]     = useState("");
  const [showNewCat, setShowNewCat]         = useState(false);
  const [newCatInput, setNewCatInput]       = useState("");
  const [seeding, setSeeding]               = useState(false);
  const [copying, setCopying]               = useState(false);
  const [showCopyMenu, setShowCopyMenu]     = useState(false);
  const [localCats, setLocalCats]           = useState<string[]>([]);
  const [expandedCats, setExpandedCats]     = useState<Set<string>>(new Set());

  /* ── derived manufacturer / category helpers ── */
  const activeMfrData  = manufacturers.find(m => m.key === activeMfr) ?? manufacturers[0];
  const activeCatData  = activeMfrData?.categories.find(c => c.key === activeType);
  const allDeviceTypes = manufacturers.flatMap(m => m.categories);

  const doSelectMfr = (mfrKey: string) => {
    setActiveMfr(mfrKey);
    const mfr = manufacturers.find(m => m.key === mfrKey);
    if (mfr && mfr.categories.length > 0) setActiveType(mfr.categories[0].key);
    setShowAddMfr(false); setShowAddCat(false);
  };

  const doAddManufacturer = () => {
    const label = addMfrLabel.trim();
    if (!label) return;
    const key = `mfr_${label.toLowerCase().replace(/[^a-z0-9]/gi, "_").slice(0, 24)}_${Date.now()}`;
    const newMfr: Manufacturer = { key, label, emoji: addMfrEmoji, categories: [] };
    const updated = [...manufacturers, newMfr];
    setManufacturers(updated);
    saveManufacturers(updated);
    setActiveMfr(key);
    setAddMfrLabel(""); setAddMfrEmoji("📱"); setShowAddMfr(false);
  };

  const doAddCategory = () => {
    const label = addCatLabel.trim();
    if (!label) return;
    const key = `${activeMfr}_${label.replace(/\s+/g, "_").replace(/[^a-z0-9_\u0600-\u06ff]/g, "").slice(0, 24)}_${Date.now()}`;
    const newCat: DeviceCategory = { key, label, emoji: addCatEmoji };
    const updated = manufacturers.map(m =>
      m.key === activeMfr ? { ...m, categories: [...m.categories, newCat] } : m
    );
    setManufacturers(updated);
    saveManufacturers(updated);
    setActiveType(key);
    setAddCatLabel(""); setAddCatEmoji("📱"); setShowAddCat(false);
  };

  const deviceType = activeType;
  const qKey = ["/api/repair-checklist-items", deviceType];

  const { data: rawItems, isLoading, isError } = useQuery<ChecklistRow[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await authFetch(api(`/api/repair-checklist-items?device_type=${deviceType}`));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 0,
    select: (d) => (Array.isArray(d) ? d : []),
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
    setEditingId(null); setAddingToCat(null); setNewItemLabel(""); setLocalCats([]); setExpandedCats(new Set()); setShowCopyMenu(false);
  }, [activeType]);

  const toggleCat = (cat: string) =>
    setExpandedCats(prev => { const n = new Set(prev); if (n.has(cat)) { n.delete(cat); } else { n.add(cat); } return n; });

  const seedDeviceType = async () => {
    setSeeding(true);
    const r = await authFetch(api("/api/repair-checklist-items/seed-device-type"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_type: deviceType }),
    });
    setSeeding(false);
    if (r.status === 409) { toast({ title: "البنود محملة مسبقاً" }); return; }
    if (!r.ok)            { toast({ title: "خطأ في تحميل البنود", variant: "destructive" }); return; }
    const { count } = await r.json();
    toast({ title: `✓ تم تحميل ${count} بند` });
    invalidate();
  };

  const copyFrom = async (fromType: string) => {
    setCopying(true); setShowCopyMenu(false);
    const r = await authFetch(api("/api/repair-checklist-items/copy"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromType, to: deviceType }),
    });
    setCopying(false);
    if (!r.ok) { toast({ title: "تعذر النسخ", variant: "destructive" }); return; }
    const { count } = await r.json();
    const fromLabel = allDeviceTypes.find(t => t.key === fromType)?.label
      ?? DEVICE_TYPE_LABEL[fromType as DeviceType] ?? fromType;
    toast({ title: `✓ تم نسخ ${count} بند من ${fromLabel}` });
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

  /* activeMeta — safe for built-in and custom types */
  const activeMeta = {
    key:   activeType,
    label: activeCatData?.label ?? DEVICE_TYPE_LABEL[activeType as DeviceType] ?? activeType,
    emoji: activeCatData?.emoji ?? "📱",
  };

  /* أكسنت موحَّد عبر تبويبات هذه الصفحة — يتكيّف مع الوضع الفاتح والداكن */
  const accent    = isLight ? "text-amber-700"  : "text-amber-200";
  const accentDim = isLight ? "text-amber-600"  : "text-amber-300/75";
  const accentBg  = isLight ? "bg-amber-50"     : "bg-amber-500/10";
  const accentBdr = isLight ? "border-amber-300": "border-amber-500/30";
  const badgeCls  = isLight
    ? "bg-amber-100 text-amber-800 border border-amber-300/70"
    : "bg-amber-500/15 text-amber-200/85 border border-amber-500/25";

  /* بحث محلّي داخل البنود */
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /* ⌘K / Ctrl+K → focus search */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i =>
      i.label_ar.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  /* ── pill styles (light-aware) ── */
  const mfrActiveStyle = isLight ? {
    background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.10) 100%)",
    border: "1px solid rgba(245,158,11,0.55)",
    color: "#92400e",
    boxShadow: "0 4px 12px -4px rgba(245,158,11,0.30), 0 0 0 3px rgba(245,158,11,0.08)",
  } : {
    background: "linear-gradient(135deg, rgba(245,158,11,0.28) 0%, rgba(217,119,6,0.12) 100%)",
    border: "1px solid rgba(245,158,11,0.55)",
    color: "#fef3c7",
    boxShadow: "0 6px 16px -4px rgba(245,158,11,0.40), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 0 3px rgba(245,158,11,0.08)",
  };
  const mfrInactiveStyle = isLight ? {
    background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "rgba(15,23,42,0.65)",
  } : {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.62)",
  };
  const catActiveStyle = isLight ? {
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.45)",
    color: "#92400e",
  } : {
    background: "rgba(245,158,11,0.15)",
    border: "1px solid rgba(245,158,11,0.40)",
    color: "#fde68a",
  };
  const catInactiveStyle = isLight ? {
    background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.08)",
    color: "rgba(15,23,42,0.55)",
  } : {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.50)",
  };

  return (
    <div className="flex flex-col h-full">
      {/* ═════ HERO — manufacturer + category 2-level selector ═════ */}
      <div
        className="px-5 pt-4 pb-0 shrink-0 relative"
        style={{
          background: isLight
            ? "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 60%, transparent 100%)"
            : "linear-gradient(180deg, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0.01) 60%, transparent 100%)",
          borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* ── صف 1: عنوان + بيانات ── */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-300 to-amber-500" />
            <h3 className={`text-[11px] font-black tracking-[0.22em] uppercase ${isLight ? "text-slate-500" : "text-white/55"}`}>
              الشركة المصنعة
            </h3>
          </div>
          <div className={`flex items-center gap-2 text-[10px] ${isLight ? "text-slate-400" : "text-white/35"}`}>
            <span className="font-bold text-amber-500 tabular-nums">{items.length}</span>
            <span>بند في «{activeMeta.label}»</span>
          </div>
        </div>

        {/* ── صف 2: الشركات المصنعة + زر إضافة شركة ── */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {manufacturers.map(mfr => {
            const isMfrActive = activeMfr === mfr.key;
            return (
              <button
                key={mfr.key}
                onClick={() => doSelectMfr(mfr.key)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all"
                style={isMfrActive ? mfrActiveStyle : mfrInactiveStyle}
              >
                <span className="text-base leading-none">{mfr.emoji}</span>
                <span>{mfr.label}</span>
                {isMfrActive && mfr.categories.length > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-black tabular-nums"
                    style={isLight
                      ? { background: "rgba(245,158,11,0.15)", color: "#92400e", border: "1px solid rgba(245,158,11,0.30)" }
                      : { background: "rgba(0,0,0,0.25)", color: "#fde68a", border: "1px solid rgba(252,211,77,0.25)" }}
                  >
                    {mfr.categories.length}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => { setShowAddMfr(v => !v); setShowAddCat(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-bold whitespace-nowrap transition-all"
            style={isLight
              ? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "rgba(15,23,42,0.45)" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}
          >
            <Plus className="w-3.5 h-3.5" /> شركة جديدة
          </button>
        </div>

        {/* ── صف 3: فئات الشركة المختارة + زر إضافة فئة ── */}
        <div
          className="flex flex-wrap gap-1 pb-2.5 pt-2"
          style={{ borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.06)" }}
        >
          {activeMfrData?.categories.map(cat => {
            const isCatActive = activeType === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveType(cat.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all"
                style={isCatActive ? catActiveStyle : catInactiveStyle}
              >
                <span className="text-sm leading-none">{cat.emoji}</span>
                <span>{cat.label}</span>
                {isCatActive && items.length > 0 && (
                  <span
                    className="text-[10px] px-1 rounded font-black tabular-nums"
                    style={isLight
                      ? { background: "rgba(245,158,11,0.15)", color: "#92400e" }
                      : { background: "rgba(0,0,0,0.25)", color: "#fde68a" }}
                  >
                    {items.length}
                  </span>
                )}
              </button>
            );
          })}
          {activeMfrData && (
            <button
              onClick={() => { setShowAddCat(v => !v); setShowAddMfr(false); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
              style={isLight
                ? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(15,23,42,0.40)" }
                : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
            >
              <Plus className="w-3 h-3" /> فئة جديدة
            </button>
          )}
          {activeMfrData?.categories.length === 0 && (
            <p className={`text-[11px] py-0.5 ${isLight ? "text-slate-400" : "text-white/25"}`}>لا توجد فئات — اضغط «فئة جديدة» لإضافة الأولى</p>
          )}
        </div>
      </div>

      {/* ── Add Manufacturer inline form ── */}
      {showAddMfr && (
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={isLight ? { borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" } : { borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
          <select
            value={addMfrEmoji}
            onChange={e => setAddMfrEmoji(e.target.value)}
            className="text-lg bg-transparent outline-none cursor-pointer"
          >
            {["📱","💻","⌚","🎧","🖥️","🤖","🔧","🎮","📷","🖨️"].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input
            autoFocus
            value={addMfrLabel}
            onChange={e => setAddMfrLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") doAddManufacturer(); if (e.key === "Escape") { setShowAddMfr(false); setAddMfrLabel(""); } }}
            placeholder="اسم الشركة المصنعة (مثال: Huawei)..."
            className="erp-input flex-1 text-sm py-1"
          />
          <button onClick={doAddManufacturer} disabled={!addMfrLabel.trim()} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30">
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowAddMfr(false); setAddMfrLabel(""); }} className="text-white/30 hover:text-white/60">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Add Category inline form ── */}
      {showAddCat && (
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={isLight ? { borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" } : { borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
          <select
            value={addCatEmoji}
            onChange={e => setAddCatEmoji(e.target.value)}
            className="text-lg bg-transparent outline-none cursor-pointer"
          >
            {["📱","💻","⌚","🎧","🔧","🤖","📷","🖥️","🎮","🖨️"].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input
            autoFocus
            value={addCatLabel}
            onChange={e => setAddCatLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") doAddCategory(); if (e.key === "Escape") { setShowAddCat(false); setAddCatLabel(""); } }}
            placeholder={`اسم الفئة تحت ${activeMfrData?.label ?? ""}... (مثال: سمارت واتش)`}
            className="erp-input flex-1 text-sm py-1"
          />
          <button onClick={doAddCategory} disabled={!addCatLabel.trim()} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30">
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowAddCat(false); setAddCatLabel(""); }} className="text-white/30 hover:text-white/60">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═════ شريط البحث + الإجراءات — أسلوب Linear toolbar ═════ */}
      <div
        className="flex items-center flex-wrap gap-2 px-5 py-2.5 shrink-0"
        style={isLight
          ? { background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.08)" }
          : { background: "rgba(255,255,255,0.012)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* مربع البحث */}
        <div
          className="flex items-center gap-2 px-3 h-9 rounded-xl flex-1 min-w-[200px] max-w-[360px]"
          style={isLight
            ? { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)" }
            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Search className={`w-3.5 h-3.5 shrink-0 ${isLight ? "text-slate-400" : "text-white/40"}`} />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`ابحث في بنود ${activeMeta.label}...`}
            className={`flex-1 bg-transparent text-[12px] outline-none font-medium ${isLight ? "text-slate-700 placeholder:text-slate-400" : "text-white placeholder:text-white/45"}`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className={`shrink-0 ${isLight ? "text-slate-400 hover:text-slate-600" : "text-white/30 hover:text-white/70"}`}
              title="مسح البحث"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {!searchQuery && (
            <kbd className="rs-kbd shrink-0 hidden sm:inline-flex">⌘ K</kbd>
          )}
        </div>

        <div className="flex-1" />

        {/* الإجراءات */}
        <button
          onClick={() => setShowNewCat(v => !v)}
          className={`flex items-center gap-1.5 text-[11.5px] h-9 px-3 rounded-xl font-bold ${isLight ? "text-slate-600 hover:text-slate-800" : "text-white/70 hover:text-white"}`}
          style={isLight
            ? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)" }
            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <Plus className="w-3.5 h-3.5" /> تصنيف جديد
        </button>
        <div className="relative">
          <button
            onClick={() => setShowCopyMenu(v => !v)}
            disabled={copying}
            className={`flex items-center gap-1.5 text-[11.5px] h-9 px-3 rounded-xl disabled:opacity-40 font-bold ${isLight ? "text-slate-600 hover:text-slate-800" : "text-white/70 hover:text-white"}`}
            style={isLight
              ? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <Copy className="w-3.5 h-3.5" /> {copying ? "جاري النسخ..." : "نسخ من"}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          {showCopyMenu && (
            <div
              className="rs-popup-dark absolute left-0 top-full mt-1.5 z-20 w-56 rounded-xl py-1.5 max-h-80 overflow-y-auto rs-scroll"
              style={isLight
                ? {
                  background: "#1e293b",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 24px 48px -12px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06) inset",
                }
                : {
                  background: "rgba(15,19,32,0.98)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 24px 48px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
                }}
            >
              <p className="text-[10px] text-white/40 font-black tracking-wider uppercase px-3 pt-1 pb-1.5">
                انسخ بنود من:
              </p>
              {allDeviceTypes.filter(d => d.key !== activeType).map(d => (
                <button
                  key={d.key}
                  onClick={() => copyFrom(d.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-white/80 hover:bg-amber-500/10 hover:text-amber-200 text-right rounded-md mx-1 transition-colors"
                >
                  <span className="text-base">{d.emoji}</span>
                  <span className="flex-1 font-semibold">{d.label}</span>
                  <ArrowLeft className="w-3 h-3 opacity-40" />
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={seedDeviceType}
          disabled={seeding}
          className="flex items-center gap-1.5 text-[11.5px] h-9 px-3.5 rounded-xl font-black disabled:opacity-40 text-amber-50"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.85), rgba(217,119,6,0.65))",
            border: "1px solid rgba(245,158,11,0.55)",
            boxShadow:
              "0 4px 14px -3px rgba(245,158,11,0.45)," +
              "inset 0 1px 0 rgba(255,255,255,0.20)",
          }}
        >
          <Zap className="w-3.5 h-3.5" />
          {seeding ? "جاري التحميل..." : "تحميل بنود افتراضية"}
        </button>
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
            <div className="w-12 h-12 rounded-2xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center text-2xl">
              {activeMeta.emoji}
            </div>
            <p className="text-white/40 text-sm text-center">
              لا توجد بنود فحص لـ {activeMeta.label} بعد — تُستخدم نفس البنود في الفحص الأولي و QC
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={seedDeviceType} disabled={seeding}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${accentBg} ${accentBdr} ${accent} hover:bg-amber-500/20`}>
                <Zap className="w-4 h-4" />
                {seeding ? "جاري التحميل..." : `تحميل بنود ${activeMeta.label}`}
              </button>
              <button onClick={() => setShowCopyMenu(v => !v)} disabled={copying}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 disabled:opacity-50">
                <Copy className="w-4 h-4" /> نسخ من نوع آخر
              </button>
            </div>
            <button onClick={() => { setShowNewCat(true); }}
              className="text-xs text-white/25 hover:text-white/50 transition-colors">
              أو أضف تصنيفاً يدوياً
            </button>
          </div>
        )}
        {!isLoading && !isError && !isEmpty && (
          <div className="pb-4">
            {allCategories.map(cat => {
              const catItems = filteredItems.filter(i => i.category === cat).sort((a, b) => a.sort_order - b.sort_order);
              if (searchQuery && catItems.length === 0) return null;
              /* أثناء البحث، يفتح كل التصنيفات تلقائياً لإظهار النتائج */
              const isExpanded = searchQuery ? true : expandedCats.has(cat);
              const isLocal    = !dbCategories.includes(cat);
              return (
                <div key={cat} className="border-b border-white/5 last:border-b-0">
                  <button onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-right"
                    style={isLight ? { background: "rgba(0,0,0,0.025)" } : undefined}>
                    <ChevronDown
                      style={isLight ? { color: "#b45309" } : undefined}
                      className={`w-3.5 h-3.5 ${isLight ? "" : accentDim} transition-transform duration-200 shrink-0 ${isExpanded ? "" : "-rotate-90"}`} />
                    <span
                      style={isLight ? { color: "#b45309" } : undefined}
                      className={`text-[13px] font-semibold flex-1 text-right ${isLight ? "" : accentDim}`}>
                      {cat}
                      {isLocal && <span className={`text-[10px] font-normal mr-2 ${isLight ? "text-slate-400" : "text-white/25"}`}>جديد</span>}
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
                                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-amber-400 p-1 transition-all shrink-0">
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
    queryKey: ["/api/settings/users"],
    queryFn: async () => {
      const r = await authFetch(api("/api/settings/users"));
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    },
    staleTime: 60_000,
    select: (d) => (Array.isArray(d) ? d : []),
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

  const techUsers = (Array.isArray(users) ? users : []).filter(u => u.active !== false);

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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 text-sm font-bold text-amber-300">
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

  const printQR = () => {
    /* SEC-005: escape HTML entities لمنع أي XSS في نافذة الطباعة */
    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

    /* serialize the QR SVG and open in a print window */
    const svg = document.getElementById("qr-print-target")?.querySelector("svg");
    if (!svg) { toast({ title: "تعذر تحميل الرمز", variant: "destructive" }); return; }
    const svgStr = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank", "width=420,height=620");
    if (!win) { toast({ title: "السماح بالنوافذ مطلوب للطباعة", variant: "destructive" }); return; }
    win.document.write(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>QR — ${escHtml(sampleJobNo)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", "Tahoma", sans-serif; background: #fff; color: #111;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .ticket { border: 2px dashed #999; border-radius: 16px; padding: 28px 32px; text-align: center;
    width: 320px; }
  .brand { font-size: 11px; color: #888; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 18px; }
  .title { font-size: 18px; font-weight: 800; margin-bottom: 4px; color: #111; }
  .sub { font-size: 13px; color: #555; margin-bottom: 22px; }
  .qr-box { background: #fff; padding: 8px; border: 1px solid #eee; border-radius: 12px;
    display: inline-block; margin-bottom: 20px; }
  .qr-box svg { display: block; width: 200px; height: 200px; }
  .job-no { font-family: ui-monospace, "SF Mono", monospace; font-size: 16px; font-weight: 700;
    background: #f3f4f6; padding: 8px 18px; border-radius: 999px; display: inline-block; margin-bottom: 12px; }
  .url { font-family: ui-monospace, monospace; font-size: 9px; color: #888; word-break: break-all; padding: 0 8px; }
  .footer { margin-top: 18px; font-size: 11px; color: #666; line-height: 1.6; border-top: 1px solid #eee; padding-top: 14px; }
  @media print {
    .ticket { border: 1px solid #000; }
    @page { size: A6; margin: 0; }
  }
</style>
</head>
<body>
  <div class="ticket">
    <div class="brand">MUHKAM ERP — صيانة</div>
    <div class="title">تتبع طلب الصيانة</div>
    <div class="sub">صوّر الرمز لمتابعة حالة جهازك</div>
    <div class="qr-box">${svgStr}</div>
    <div class="job-no">${escHtml(sampleJobNo)}</div>
    <div class="url">${escHtml(trackingUrl)}</div>
    <div class="footer">شكراً لاختياركم خدمتنا<br/>سيتم تحديثكم بكل مرحلة من الإصلاح</div>
  </div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 250); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-5">

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <QrCode className="w-5 h-5 text-amber-400/85 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-amber-300/80 mb-1">تتبع العميل عبر QR</p>
            <p className="text-[12px] text-amber-300/50 leading-relaxed">
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
              <button onClick={printQR}
                className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg px-2.5 py-1 transition-all font-semibold">
                <Printer className="w-3 h-3" /> طباعة
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-5 py-8 px-4">
            {/* QR Code */}
            <div id="qr-print-target" className="p-4 bg-white rounded-2xl shadow-lg shadow-black/30">
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
   DASHBOARD CARDS TAB (admin only)
   Manage the customizable summary cards at the top of the
   repairs page: name, statuses grouped, color, icon, alerts.
══════════════════════════════════════════════════════════════ */
interface DashboardCardRow {
  id: number;
  name: string;
  statuses: string[];
  color: string;
  icon: string;
  sort_order: number;
  alert_threshold: number | null;
  is_system: boolean;
}

function DashboardCardsTab() {
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
          <h3 className="text-white/80 text-sm font-bold mb-1">صلاحيات المسؤول مطلوبة</h3>
          <p className="text-white/35 text-[12px] leading-relaxed">
            تخصيص كروت لوحة الصيانة متاح لمدير النظام فقط لضمان توحيد العرض بين الفرع والفنيين.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/8 flex items-start justify-between gap-3">
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
        {isLoading && <div className="text-center text-white/30 text-sm py-8">جارٍ التحميل...</div>}
        {!isLoading && cards.length === 0 && (
          <div className="text-center text-white/30 text-sm py-8">لا توجد كروت — أضف كارت جديد</div>
        )}
        <div className="flex flex-col gap-2">
          {cards.map((c, i) => {
            const Icon = DASHBOARD_CARD_ICONS[c.icon] ?? Wrench;
            return (
              <div key={c.id}
                className="rounded-2xl border border-white/8 bg-white/[0.025] p-3 flex items-center gap-3 hover:border-white/15 transition-all">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                    <ArrowRight className="w-3 h-3 rotate-90" />
                  </button>
                  <button onClick={() => move(i, +1)} disabled={i === cards.length - 1}
                    className="w-5 h-5 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
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
                    <span className="text-[13px] font-bold text-white/85 truncate">{c.name}</span>
                    {c.is_system && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40 font-medium">افتراضي</span>}
                    {c.alert_threshold != null && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400/80 font-medium flex items-center gap-1">
                        <Bell className="w-2.5 h-2.5" /> ≥ {c.alert_threshold}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.statuses.slice(0, 5).map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/45 font-mono">{s}</span>
                    ))}
                    {c.statuses.length > 5 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/35">+{c.statuses.length - 5}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(c); setShowNew(false); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                    title="تعديل">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)} disabled={busyId === c.id || cards.length <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
      <div className="glass-panel rounded-2xl border border-white/12 w-full mx-4 overflow-hidden flex flex-col"
        style={{ maxWidth: 580, maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${color}22`, border: `1px solid ${color}40` }}>
            <PreviewIcon className="w-4 h-4" style={{ color }} />
          </div>
          <h3 className="flex-1 text-sm font-bold text-white/85">
            {initial ? "تعديل الكارت" : "كارت جديد"}
          </h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-all">
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
            <label className="text-[11px] text-white/45 font-bold mb-1.5 block">اسم الكارت</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="مثال: بانتظار قطعة" maxLength={40}
              className="erp-input w-full text-sm" />
          </div>

          {/* Statuses — pulled from REAL per-company list (includes waiting_parts
              and any custom statuses you add). */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] text-white/45 font-bold">
                الحالات المضمومة <span className="text-amber-400/85">({statuses.length})</span>
              </label>
              <button type="button" onClick={() => setShowAddStatus(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/55 text-[10px] font-bold transition-all">
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
                        borderColor: newStatusColor === c ? "#fff" : "transparent",
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

            <div className="rounded-xl border border-white/8 p-2 max-h-56 overflow-y-auto">
              {loadingStatuses ? (
                <div className="text-center text-white/30 text-xs py-4">جارٍ التحميل...</div>
              ) : companyStatuses.length === 0 ? (
                <div className="text-center text-white/35 text-xs py-4">
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
                            : "bg-white/[0.02] border-white/8 text-white/45 hover:text-white/75 hover:border-white/15"
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
            <label className="text-[11px] text-white/45 font-bold mb-1.5 block">اللون</label>
            <div className="flex flex-wrap gap-1.5">
              {DASHBOARD_CARD_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-lg border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: color === c ? "#fff" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}40` : "none",
                  }}
                  title={c} />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="text-[11px] text-white/45 font-bold mb-1.5 block">الأيقونة</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DASHBOARD_CARD_ICONS).map(([key, IconC]) => (
                <button key={key} type="button" onClick={() => setIcon(key)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                    icon === key
                      ? "bg-amber-500/20 border-amber-500/50 text-white"
                      : "bg-white/[0.02] border-white/8 text-white/40 hover:text-white/75 hover:border-white/15"
                  }`}
                  title={key}>
                  <IconC className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Alert threshold */}
          <div>
            <label className="text-[11px] text-white/45 font-bold mb-1.5 block flex items-center gap-1.5">
              <Bell className="w-3 h-3" /> تنبيه عند تجاوز (اختياري)
            </label>
            <input value={alertThreshold} onChange={e => setAlertThreshold(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="مثال: 5" inputMode="numeric"
              className="erp-input w-full text-sm" />
            <p className="text-[10px] text-white/30 mt-1">يتغيّر شكل الكارت لتنبيه بصري عند بلوغ هذا الحد</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-white/10 shrink-0 bg-white/[0.02]">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-bold transition-all">
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

const BRAND_CATEGORIES: Record<string, string[]> = {
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

interface DeviceModel {
  id: number;
  brand: string;
  category: string;
  model: string;
  sort_order: number;
}

function DeviceModelsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { settings: csSettings } = useAppSettings();
  const isLight = (csSettings.theme ?? "dark") === "light";

  const accent    = isLight ? "text-amber-700"   : "text-amber-200";
  const accentBg  = isLight ? "bg-amber-50"      : "bg-amber-500/10";
  const accentBdr = isLight ? "border-amber-300" : "border-amber-500/30";
  const badgeCls  = isLight
    ? "bg-amber-100 text-amber-800 border border-amber-300/70"
    : "bg-amber-500/15 text-amber-200/85 border border-amber-500/25";

  const [selBrand, setSelBrand]     = useState("");
  const [selCat,   setSelCat]       = useState("");
  const [newModel, setNewModel]     = useState("");
  const [saving,   setSaving]       = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: models = [], isLoading } = useQuery<DeviceModel[]>({
    queryKey: ["/api/repair-device-models"],
    queryFn: () => authFetch(api("/api/repair-device-models")).then(r => r.json()),
  });

  const cats = selBrand ? (BRAND_CATEGORIES[selBrand] ?? []) : [];

  const filtered = useMemo(() =>
    models.filter(m => (!selBrand || m.brand === selBrand) && (!selCat || m.category === selCat)),
  [models, selBrand, selCat]);

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, DeviceModel[]>> = {};
    for (const m of (selBrand || selCat ? filtered : models)) {
      if (!map[m.brand]) map[m.brand] = {};
      if (!map[m.brand][m.category]) map[m.brand][m.category] = [];
      map[m.brand][m.category].push(m);
    }
    return map;
  }, [filtered, models, selBrand, selCat]);

  const handleAdd = async () => {
    if (!selBrand || !selCat || !newModel.trim()) {
      toast({ title: "أدخل الماركة والفئة والموديل", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await authFetch(api("/api/repair-device-models"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: selBrand, category: selCat, model: newModel.trim() }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "خطأ"); }
      await qc.invalidateQueries({ queryKey: ["/api/repair-device-models"] });
      setNewModel("");
      toast({ title: "تم إضافة الموديل بنجاح" });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "فشل الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await authFetch(api(`/api/repair-device-models/${id}`), { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["/api/repair-device-models"] });
      toast({ title: "تم حذف الموديل" });
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls = isLight
    ? "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
    : "w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60";
  const selectCls = isLight
    ? "px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
    : "px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`px-6 pt-5 pb-4 border-b ${isLight ? "border-slate-200" : "border-white/10"}`}>
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className={`w-4 h-4 ${accent}`} strokeWidth={1.8} />
          <h3 className={`font-semibold text-base ${isLight ? "text-slate-800" : "text-white"}`}>موديلات مخصّصة</h3>
        </div>
        <p className={`text-xs ${isLight ? "text-slate-500" : "text-white/50"}`}>
          أضف موديلات جديدة تظهر في قائمة الموديل عند إنشاء بطاقة صيانة
        </p>
      </div>

      {/* Add form */}
      <div className={`px-6 py-4 border-b ${isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.02]"}`}>
        <p className={`text-xs font-medium mb-3 ${isLight ? "text-slate-600" : "text-white/60"}`}>إضافة موديل جديد</p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              value={selBrand}
              onChange={e => { setSelBrand(e.target.value); setSelCat(""); }}
              className={`flex-1 ${selectCls}`}
            >
              <option value="">— الماركة —</option>
              {Object.keys(BRAND_CATEGORIES).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select
              value={selCat}
              onChange={e => setSelCat(e.target.value)}
              disabled={!selBrand}
              className={`flex-1 ${selectCls} disabled:opacity-40`}
            >
              <option value="">— الفئة —</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={newModel}
              onChange={e => setNewModel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="مثال: iPhone 17 Pro Max"
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !selBrand || !selCat || !newModel.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                isLight ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-amber-500/80 hover:bg-amber-500 text-black"
              }`}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              {saving ? "جارٍ الحفظ…" : "إضافة"}
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className={`px-6 py-2.5 border-b ${isLight ? "border-slate-200" : "border-white/10"} flex gap-2 items-center`}>
        <span className={`text-xs ${isLight ? "text-slate-500" : "text-white/40"}`}>تصفية:</span>
        <select
          value={selBrand}
          onChange={e => { setSelBrand(e.target.value); setSelCat(""); }}
          className={`text-xs ${selectCls} py-1`}
        >
          <option value="">الكل</option>
          {Object.keys(BRAND_CATEGORIES).map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          value={selCat}
          onChange={e => setSelCat(e.target.value)}
          disabled={!selBrand}
          className={`text-xs ${selectCls} py-1 disabled:opacity-40`}
        >
          <option value="">كل الفئات</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {models.length > 0 && (
          <span className={`mr-auto text-xs px-2 py-0.5 rounded-full ${badgeCls}`}>
            {filtered.length} موديل
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className={`text-sm text-center py-8 ${isLight ? "text-slate-400" : "text-white/30"}`}>جارٍ التحميل…</div>
        ) : models.length === 0 ? (
          <div className={`text-center py-12 ${isLight ? "text-slate-400" : "text-white/30"}`}>
            <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p className="text-sm">لا توجد موديلات مضافة بعد</p>
            <p className="text-xs mt-1 opacity-70">استخدم النموذج أعلاه لإضافة موديل جديد</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`text-center py-8 text-sm ${isLight ? "text-slate-400" : "text-white/30"}`}>
            لا توجد نتائج للتصفية الحالية
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([brand, catMap]) => (
              <div key={brand}>
                <div className={`flex items-center gap-2 mb-2`}>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>{brand}</span>
                </div>
                <div className="space-y-2 pr-2">
                  {Object.entries(catMap).map(([cat, items]) => (
                    <div key={cat}>
                      <p className={`text-[11px] font-medium mb-1.5 ${isLight ? "text-slate-500" : "text-white/40"}`}>{cat}</p>
                      <div className={`rounded-xl border ${accentBdr} ${accentBg} divide-y ${isLight ? "divide-amber-200/60" : "divide-white/5"}`}>
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between px-3 py-2">
                            <span className={`text-sm ${isLight ? "text-slate-700" : "text-white/85"}`}>{item.model}</span>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              className={`p-1 rounded-lg transition-colors ${
                                isLight ? "text-red-400 hover:bg-red-50 hover:text-red-600" : "text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                              } disabled:opacity-30`}
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
  const { settings } = useAppSettings();
  const isLight = (settings.theme ?? "dark") === "light";

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* عدّ إجمالي بنود الفحص عبر كل أنواع الأجهزة (لإظهاره في الرأس) */
  const { data: allItems = [] } = useQuery<ChecklistRow[]>({
    queryKey: ["/api/repair-checklist-items", "all"],
    queryFn: async () => {
      const r = await authFetch(api("/api/repair-checklist-items"));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 30_000,
  });
  const totalItemsCount = Array.isArray(allItems) ? allItems.length : 0;

  const activeMeta = TABS.find(t => t.id === activeTab)!;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: isLight ? "rgba(0,0,0,0.45)" : "rgba(2,4,10,0.82)",
        backdropFilter: "blur(14px) saturate(140%)",
      }}
      dir="rtl"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`rs-modal-enter rs-mesh-bg${isLight ? " rs-mesh-bg--light" : ""} relative w-full overflow-hidden flex flex-col rounded-[20px]`}
        style={{
          maxWidth: 1240,
          maxHeight: "95vh",
          border: isLight ? "1px solid rgba(0,0,0,0.11)" : "1px solid rgba(255,255,255,0.09)",
          boxShadow: isLight
            ? "0 20px 60px -10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)"
            : "0 40px 100px -20px rgba(0,0,0,0.85),0 0 0 1px rgba(255,255,255,0.04) inset,0 1px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        {/* ── Ambient corner glows (لمسة ضوئية) ── */}
        <div className="rs-glow rs-glow--amber"  style={{ top: -120, right: -120, width: 360, height: 360 }} />
        <div className="rs-glow rs-glow--violet" style={{ bottom: -160, left: -140, width: 380, height: 380, animationDelay: "1.5s" }} />

        {/* ═══ TOP BAR — أسلوب Command Bar ═══ */}
        <div
          className="relative flex items-center gap-3 px-5 py-3.5 shrink-0"
          style={isLight
            ? { background: "linear-gradient(180deg, rgba(0,0,0,0.025), rgba(0,0,0,0.010))", borderBottom: "1px solid rgba(0,0,0,0.08)" }
            : { background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* علامة التطبيق — مربع أمبر متوهّج */}
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow:
                  "0 6px 20px -4px rgba(245,158,11,0.55)," +
                  "inset 0 1px 0 rgba(255,255,255,0.30)," +
                  "inset 0 -1px 0 rgba(0,0,0,0.20)",
              }}
            >
              <Settings2 className="w-5 h-5 text-white drop-shadow" strokeWidth={2.4} />
            </div>
            <span
              className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-emerald-400"
              style={{ boxShadow: "0 0 10px rgba(52,211,153,0.7), 0 0 0 2px #0e1320" }}
            />
          </div>

          {/* العنوان */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[16px] font-black text-white tracking-[-0.01em]">إعدادات وحدة الصيانة</h2>
              <span className="text-[10px] font-bold text-amber-300/80 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 tabular-nums">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-white/40 mt-0.5 font-medium">
              {activeMeta.label} — {activeMeta.sublabel}
            </p>
          </div>

          {/* إحصائية مدمجة — عدد البنود الكلي */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl shrink-0"
            style={isLight
              ? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.09)" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            title="إجمالي بنود الفحص عبر كل أنواع الأجهزة"
          >
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
            <span className={`text-[11px] font-semibold ${isLight ? "text-slate-500" : "text-white/55"}`}>إجمالي البنود</span>
            <span className={`text-[12px] font-black tabular-nums ${isLight ? "text-slate-800" : "text-white"}`}>{totalItemsCount}</span>
          </div>

          {/* تلميح Esc */}
          <div className={`hidden lg:flex items-center gap-1.5 text-[10px] font-semibold shrink-0 ${isLight ? "text-slate-400" : "text-white/35"}`}>
            <span>للإغلاق</span>
            <kbd className="rs-kbd">Esc</kbd>
          </div>

          {/* زر الإغلاق */}
          <button
            onClick={onClose}
            title="إغلاق (Esc)"
            className={`w-9 h-9 flex items-center justify-center rounded-xl shrink-0 ${isLight ? "text-slate-500 hover:text-slate-800" : "text-white/45 hover:text-white"}`}
            style={isLight
              ? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.09)" }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ BODY: sidebar + content ═══ */}
        <div className="relative flex flex-1 overflow-hidden">

          {/* ── Sidebar — Linear-style nav ── */}
          <aside
            className="w-[244px] shrink-0 overflow-y-auto rs-scroll flex flex-col"
            style={isLight
              ? { background: "linear-gradient(180deg, rgba(0,0,0,0.025) 0%, rgba(0,0,0,0.010) 100%)", borderLeft: "1px solid rgba(0,0,0,0.07)" }
              : { background: "linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.004) 100%)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
          >
            {/* رأس الـ sidebar */}
            <div className="px-4 pt-4 pb-2">
              <p className={`text-[9px] font-black tracking-[0.22em] uppercase ${isLight ? "text-slate-400" : "text-white/30"}`}>
                الأقسام
              </p>
            </div>

            <nav className="flex-1 px-2 pb-2 space-y-0.5">
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="rs-nav-item w-full flex items-center gap-3 px-2.5 py-2.5 text-right rounded-xl group"
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 70%, transparent 100%)",
                            border: "1px solid rgba(245,158,11,0.25)",
                            boxShadow:
                              "0 4px 14px -4px rgba(245,158,11,0.30)," +
                              "inset 0 1px 0 rgba(255,255,255,0.05)",
                          }
                        : { border: "1px solid transparent" }
                    }
                  >
                    {active && (
                      <span
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full"
                        style={{
                          background: "linear-gradient(180deg, #fcd34d, #f59e0b)",
                          boxShadow: "0 0 12px rgba(245,158,11,0.6)",
                        }}
                      />
                    )}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, rgba(245,158,11,0.30), rgba(217,119,6,0.12))"
                          : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.035)",
                        border: active
                          ? "1px solid rgba(245,158,11,0.40)"
                          : isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: active
                          ? "0 2px 8px rgba(245,158,11,0.25)"
                          : "none",
                      }}
                    >
                      <Icon
                        className={`w-4 h-4 ${active ? "text-amber-300" : isLight ? "text-slate-500 group-hover:text-amber-600" : "text-white/50 group-hover:text-amber-300"} transition-colors`}
                        strokeWidth={active ? 2.4 : 2}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-bold leading-tight ${active ? (isLight ? "text-slate-800" : "text-white") : (isLight ? "text-slate-600 group-hover:text-slate-800" : "text-white/70 group-hover:text-white/95")} transition-colors`}>
                        {tab.label}
                      </p>
                      <p className={`text-[10.5px] leading-tight mt-1 truncate ${active ? "text-amber-500" : isLight ? "text-slate-400" : "text-white/50"}`}>
                        {tab.sublabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* sidebar footer — حالة + اختصار */}
            <div
              className="px-3 py-3 mx-2 mb-2 rounded-xl"
              style={isLight
                ? { background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }
                : { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-black tracking-wider uppercase ${isLight ? "text-slate-400" : "text-white/55"}`}>
                  الحالة
                </span>
                <span className={`flex items-center gap-1 text-[10px] font-bold ${isLight ? "text-emerald-700" : "text-emerald-300/85"}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  متصل
                </span>
              </div>
              <p className={`text-[10px] leading-relaxed ${isLight ? "text-slate-400" : "text-white/35"}`}>
                مُحكم ERP — وحدة الصيانة المتكاملة
              </p>
            </div>
          </aside>

          {/* ── Content ── */}
          <main
            key={activeTab}
            className="rs-content-enter flex-1 overflow-hidden flex flex-col relative"
            style={{
              background: isLight
                ? "radial-gradient(1200px 600px at 50% -200px, rgba(245,158,11,0.07), transparent 60%)"
                : "radial-gradient(1200px 600px at 50% -200px, rgba(245,158,11,0.025), transparent 60%), rgba(0,0,0,0.20)",
            }}
          >
            {activeTab === "checklist"        && <ChecklistTab />}
            {activeTab === "statuses"         && <StatusesTab />}
            {activeTab === "dashboard-cards"  && <DashboardCardsTab />}
            {activeTab === "technicians"      && <TechniciansTab />}
            {activeTab === "qr"               && <QrTrackingTab />}
            {activeTab === "models"           && <DeviceModelsTab />}
          </main>

        </div>

      </div>
    </div>,
    document.body,
  );
}
