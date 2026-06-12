import { useState, useRef, useEffect, useMemo } from "react";
import { useAppSettings } from "@/contexts/app-settings";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone, Plus, CheckCircle2,
  ShoppingCart, Wrench,
  Trash2, RotateCcw, Package,
  TrendingUp, Banknote, Printer,
  MoreVertical, Eye, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { api } from '@/lib/api';
import Warranty from '@/pages/warranty';
import { DeviceFormModal } from './DeviceFormModal';
import { DeviceDetails } from './DeviceDetails';
import { DeviceList } from './DeviceList';
import { SellModal } from './SellModal';
import { ReturnModal } from './ReturnModal';
import { printSaleReceipt } from './printSaleReceipt';

/* ── Re-export types from shared types file ── */
export type { DeviceStatus, PaymentMethod, PaymentStatus, Device } from './types';
export type { Stats } from './types';
import type { Device, DeviceStatus, PaymentMethod } from './types';
import type { Stats } from './types';

/* ── Re-export extracted modules for backward compatibility ── */
export { SellModal } from './SellModal';
export { ReturnModal, RETURN_REASONS } from './ReturnModal';
export { printSaleReceipt } from './printSaleReceipt';

/* ── Helpers ── */
export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const r = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e || `HTTP ${r.status}`); }
  return r.json() as Promise<T>;
}

export const GRADES = ["A+", "A", "B", "C", "D"];

export const WARRANTY_OPTS = [
  { label: "بدون ضمان", value: 0 },
  { label: "شهر", value: 1 },
  { label: "3 أشهر", value: 3 },
  { label: "6 أشهر", value: 6 },
  { label: "سنة", value: 12 },
];
export const PAY_METHODS: { v: PaymentMethod; l: string }[] = [
  { v: "cash", l: "كاش" },
  { v: "card", l: "بطاقة" },
  { v: "instapay", l: "انستاباي" },
  { v: "transfer", l: "تحويل بنكي" },
];

/* ── Grade Badge ── */
export function GradeBadge({ grade }: { grade?: string }) {
  const colors: Record<string, string> = {
    "A+": "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    "A":  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    "B":  "text-amber-300 bg-amber-500/10 border-amber-500/20",
    "C":  "text-orange-300 bg-orange-500/10 border-orange-500/20",
    "D":  "text-red-400 bg-red-500/10 border-red-500/20",
  };
  const c = colors[grade ?? "B"] ?? "text-ink/40 bg-surface border-line";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${c}`}>
      {grade ?? "—"}
    </span>
  );
}

/* ── Status Badge ── */
export function StatusBadge({ status }: { status: DeviceStatus }) {
  const map: Record<DeviceStatus, { label: string; cls: string }> = {
    available:   { label: "متاح",     cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" },
    sold:        { label: "مباع",     cls: "text-blue-300 bg-blue-500/15 border-blue-500/30" },
    maintenance: { label: "صيانة",   cls: "text-amber-300 bg-amber-500/15 border-amber-500/30" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

/** Mask IMEI: first 6 + ••••• + last 3 */
export function maskImei(imei: string): string {
  if (!imei || imei.length < 9) return imei;
  return `${imei.slice(0, 6)}•••••${imei.slice(-3)}`;
}

/** Row action menu (three-dot) */
export function RowMenu({ device, onDetail, onRefresh }: {
  device: Device; onDetail: () => void; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [showSell, setShowSell] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "maintenance" | "available" | "return" | null>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const btnRef      = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      const inWrapper  = wrapperRef.current?.contains(t);
      const inDropdown = dropdownRef.current?.contains(t);
      if (!inWrapper && !inDropdown) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onMouse);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownWidth = 176; // w-44 = 11rem = 176px
      // Align dropdown's right edge with button's right edge, clamped to viewport
      const leftPos = Math.max(4, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 4));
      setMenuPos({ top: rect.bottom + 4, left: leftPos });
    }
    setOpen(v => !v);
  };

  const doAction = async (action: "delete" | "maintenance" | "available") => {
    try {
      if (action === "delete") {
        const r = await authFetch(api(`/api/devices/${device.id}`), { method: "DELETE" });
        if (!r.ok) throw new Error();
        toast({ title: "تم حذف الجهاز" });
      } else {
        await apiPost(`/api/devices/${device.id}/${action}`, {});
        toast({ title: action === "maintenance" ? "أُرسل للصيانة" : "أُرجع كمتاح" });
      }
      onRefresh();
    } catch {
      toast({ title: "خطأ في العملية", variant: "destructive" });
    }
    setConfirming(null); setOpen(false);
  };

  const menuItems = device.status === "available"
    ? [
        { label: "بيع الجهاز",     icon: ShoppingCart, action: () => { setOpen(false); setShowSell(true); }, cls: "text-emerald-300" },
        { label: "إرسال للصيانة",  icon: Wrench,       action: () => { setOpen(false); setConfirming("maintenance"); }, cls: "text-amber-300" },
        { label: "حذف الجهاز",     icon: Trash2,       action: () => { setOpen(false); setConfirming("delete"); }, cls: "text-red-400" },
      ]
    : device.status === "sold"
      ? [
          { label: "طباعة الفاتورة", icon: Printer,   action: () => { setOpen(false); printSaleReceipt(device, settings.companyName); }, cls: "text-violet-300" },
          { label: "إرجاع من العميل",icon: RotateCcw, action: () => { setOpen(false); setConfirming("return"); }, cls: "text-amber-300" },
          { label: "حذف الجهاز",    icon: Trash2,     action: () => { setOpen(false); setConfirming("delete"); }, cls: "text-red-400" },
        ]
      : [
          { label: "إرجاع كمتاح",  icon: RotateCcw, action: () => { setOpen(false); setConfirming("available"); }, cls: "text-emerald-300" },
          { label: "حذف الجهاز",   icon: Trash2,    action: () => { setOpen(false); setConfirming("delete"); }, cls: "text-red-400" },
        ];

  return (
    <div ref={wrapperRef} className="relative flex items-center gap-1">
      {/* Eye icon */}
      <button onClick={(e) => { e.stopPropagation(); onDetail(); }}
        title="تفاصيل الجهاز"
        className="p-1.5 rounded-lg text-ink/25 hover:text-violet-300 hover:bg-violet-500/10 transition-all">
        <Eye className="w-3.5 h-3.5" />
      </button>

      {/* Three-dot */}
      <button ref={btnRef} onClick={handleOpenMenu}
        className="p-1.5 rounded-lg text-ink/25 hover:text-ink/70 hover:bg-surface transition-all">
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="row-menu-dropdown"
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 99999 }}
          dir="rtl">
          {menuItems.map(({ label, icon: Icon, action, cls }) => (
            <button key={label} onClick={(e) => { e.stopPropagation(); action(); }}
              className={cls}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Confirm dialog */}
      {confirming && confirming !== "return" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl"
          onClick={e => e.stopPropagation()}>
          <div className="glass-panel rounded-2xl border border-line p-5 w-72 space-y-4">
            <p className="font-bold text-ink text-center">
              {confirming === "delete" ? "حذف الجهاز؟" : confirming === "maintenance" ? "إرسال للصيانة؟" : "إرجاع كمتاح؟"}
            </p>
            <p className="text-ink/40 text-xs text-center">{device.brand} {device.model}</p>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                className="flex-1 py-2 rounded-xl border border-line text-ink/50 text-sm">إلغاء</button>
              <button onClick={(e) => { e.stopPropagation(); doAction(confirming as "delete" | "maintenance" | "available"); }}
                className={`flex-1 py-2 rounded-xl border text-sm font-bold ${
                  confirming === "delete" ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                }`}>تأكيد</button>
            </div>
          </div>
        </div>
      )}

      {showSell && (
        <SellModal device={device} onClose={() => setShowSell(false)} onDone={onRefresh} />
      )}
      {confirming === "return" && (
        <ReturnModal device={device} onClose={() => setConfirming(null)} onDone={() => { onRefresh(); setConfirming(null); }} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN DEVICES PAGE
════════════════════════════════════════════════════════ */
export default function Devices() {
  const qc = useQueryClient();
  const [pageView, setPageView] = useState<"devices" | "warranty">("devices");
  const [statusFilter, setStatusFilter] = useState<"all" | DeviceStatus>("all");
  const [search, setSearch] = useState("");
  const [devicePage, setDevicePage] = useState(1);
  const DEVICE_PAGE_SIZE = 30;
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Device | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/devices"] });
    qc.invalidateQueries({ queryKey: ["/api/devices/stats"] });
  };

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/devices/stats"],
    queryFn: () => authFetch(api("/api/devices/stats")).then(r => r.json() as Promise<Stats>),
    staleTime: 30_000,
  });

  const { data: allDevices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices", statusFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (search.trim()) p.set("search", search.trim());
      return authFetch(api(`/api/devices?${p}`)).then(r => r.json() as Promise<Device[]>);
    },
    staleTime: 30_000,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  useEffect(() => { setDevicePage(1); }, [search, statusFilter]);

  const paginatedDevices = useMemo(
    () => allDevices.slice((devicePage - 1) * DEVICE_PAGE_SIZE, devicePage * DEVICE_PAGE_SIZE),
    [allDevices, devicePage, DEVICE_PAGE_SIZE]
  );

  const FILTERS: { v: "all" | DeviceStatus; l: string; count: number }[] = [
    { v: "all",        l: "الكل",   count: stats?.total ?? 0 },
    { v: "available",  l: "متاح",   count: stats?.available ?? 0 },
    { v: "maintenance",l: "صيانة",  count: stats?.maintenance ?? 0 },
    { v: "sold",       l: "مباع",   count: stats?.sold ?? 0 },
  ];

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto" dir="rtl">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink leading-tight">الأجهزة المستعملة</h1>
            <p className="text-[11px] text-ink/30">شراء وبيع الأجهزة — البيع والصيانة</p>
          </div>
        </div>
        {pageView === "devices" && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 text-sm font-bold hover:bg-violet-500/30 transition-all">
            <Plus className="w-4 h-4" /> إضافة جهاز
          </button>
        )}
      </div>

      {/* ── Page-level tab bar ── */}
      <div className="flex gap-1 border-b border-line pb-0">
        {[
          { id: "devices" as const, label: "الأجهزة", icon: Smartphone },
          { id: "warranty" as const, label: "الضمانات", icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPageView(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-all -mb-px ${
              pageView === id
                ? id === "warranty"
                  ? "border-amber-500 text-amber-300"
                  : "border-violet-500 text-violet-300"
                : "border-transparent text-ink/40 hover:text-ink/70"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Warranty tab ── */}
      {pageView === "warranty" && <Warranty embedded />}

      {/* ── Devices content (hidden on warranty tab) ── */}
      {pageView === "devices" && <>

      {/* ── Stats cards — Row 1: Counts ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "إجمالي الأجهزة", value: stats?.total ?? 0,        color: "text-ink",       icon: Smartphone },
          { label: "متاح للبيع",     value: stats?.available ?? 0,     color: "text-emerald-400", icon: CheckCircle2 },
          { label: "في الصيانة",     value: stats?.maintenance ?? 0,   color: "text-amber-400",   icon: Wrench },
          { label: "إجمالي المباع",  value: stats?.sold ?? 0,          color: "text-blue-400",    icon: ShoppingCart },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="glass-panel rounded-xl border border-line p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-ink/30">{label}</span>
              <Icon className={`w-3.5 h-3.5 ${color} opacity-60`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Stats cards — Row 2: Financial ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-panel rounded-xl border border-violet-500/15 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-ink/30">قيمة المخزون (شراء)</span>
            <Package className="w-3.5 h-3.5 text-violet-400/60" />
          </div>
          <p className="text-lg font-bold text-violet-300">
            {(stats?.stock_purchase_value ?? 0).toLocaleString("ar-EG")}
            <span className="text-[10px] font-normal text-ink/25 mr-1">ج.م</span>
          </p>
          <p className="text-[10px] text-ink/20 mt-0.5">
            سعر بيع متوقع: {(stats?.stock_sale_value ?? 0).toLocaleString("ar-EG")} ج.م
          </p>
        </div>
        <div className="glass-panel rounded-xl border border-emerald-500/15 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-ink/30">ربح متوقع من المخزون</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400/60" />
          </div>
          <p className="text-lg font-bold text-emerald-300">
            {(stats?.stock_profit_potential ?? 0).toLocaleString("ar-EG")}
            <span className="text-[10px] font-normal text-ink/25 mr-1">ج.م</span>
          </p>
          <p className="text-[10px] text-ink/20 mt-0.5">هامش متوقع على الأجهزة المتاحة</p>
        </div>
        <div className="glass-panel rounded-xl border border-blue-500/15 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-ink/30">إيراد المبيعات الفعلي</span>
            <Banknote className="w-3.5 h-3.5 text-blue-400/60" />
          </div>
          <p className="text-lg font-bold text-blue-300">
            {(stats?.sold_revenue ?? 0).toLocaleString("ar-EG")}
            <span className="text-[10px] font-normal text-ink/25 mr-1">ج.م</span>
          </p>
          <p className={`text-[10px] mt-0.5 font-semibold ${(stats?.sold_profit ?? 0) >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
            صافي الربح: {(stats?.sold_profit ?? 0).toLocaleString("ar-EG")} ج.م
          </p>
        </div>
      </div>

      <DeviceList
        isLoading={isLoading}
        allDevices={allDevices}
        paginatedDevices={paginatedDevices}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        search={search}
        setSearch={setSearch}
        viewMode={viewMode}
        setViewMode={setViewMode}
        filters={FILTERS}
        devicePage={devicePage}
        setDevicePage={setDevicePage}
        pageSize={DEVICE_PAGE_SIZE}
        setSelected={setSelected}
        refresh={refresh}
      />

      </>}

      {/* ── Modals ── */}
      {showAdd && <DeviceFormModal onClose={() => setShowAdd(false)} onSaved={refresh} />}
      {selected && <DeviceDetails device={selected} onClose={() => setSelected(null)} onRefresh={refresh} />}
    </div>
  );
}
