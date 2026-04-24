import { useState, type ElementType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone, Plus, Search, X, CheckCircle2, XCircle,
  ShoppingCart, Wrench, BadgeCheck, Info,
  Trash2, RotateCcw, AlertTriangle, Battery, Package,
  Tag, User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/contexts/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

/* ── Types ── */
type DeviceStatus = "available" | "sold" | "maintenance";
type PaymentMethod = "cash" | "card" | "instapay" | "transfer";
type PaymentStatus = "paid" | "partial" | "unpaid";

type Device = {
  id: number; company_id: number; branch_id?: number;
  device_no: string;
  brand: string; model: string; color?: string; storage?: string;
  imei?: string; serial_no?: string;
  battery_health?: number; grade?: string; condition_notes?: string;
  purchase_price: string; sale_price: string;
  status: DeviceStatus;
  dual_sim: boolean; with_box: boolean;
  icloud_locked: boolean; network_locked: boolean; previously_opened: boolean;
  supplier_name?: string; purchase_invoice_no?: string; inspector_name?: string;
  sold_to_customer_name?: string; sold_at?: string;
  sold_by_user_name?: string; sold_price?: string;
  warranty_months?: number; payment_method?: string; payment_status?: string;
  added_by_user_name?: string; created_at: string;
};

type Stats = { total: number; available: number; sold: number; maintenance: number };

/* ── Helpers ── */
function apiFetch<T>(url: string): Promise<T> {
  return authFetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

async function apPost<T>(url: string, body: unknown): Promise<T> {
  const r = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e || `HTTP ${r.status}`); }
  return r.json() as Promise<T>;
}

async function apPatch<T>(url: string, body: unknown): Promise<T> {
  const r = await authFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e || `HTTP ${r.status}`); }
  return r.json() as Promise<T>;
}

const GRADES = ["A+", "A", "B", "C", "D"];
const STORAGES = ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];
const WARRANTY_OPTS = [
  { label: "بدون ضمان", value: 0 },
  { label: "شهر", value: 1 },
  { label: "3 أشهر", value: 3 },
  { label: "6 أشهر", value: 6 },
  { label: "سنة", value: 12 },
];
const PAY_METHODS: { v: PaymentMethod; l: string }[] = [
  { v: "cash", l: "كاش" },
  { v: "card", l: "بطاقة" },
  { v: "instapay", l: "انستاباي" },
  { v: "transfer", l: "تحويل بنكي" },
];

/* ── Grade Badge ── */
function GradeBadge({ grade }: { grade?: string }) {
  const colors: Record<string, string> = {
    "A+": "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    "A":  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    "B":  "text-amber-300 bg-amber-500/10 border-amber-500/20",
    "C":  "text-orange-300 bg-orange-500/10 border-orange-500/20",
    "D":  "text-red-400 bg-red-500/10 border-red-500/20",
  };
  const c = colors[grade ?? "B"] ?? "text-white/40 bg-white/5 border-white/10";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${c}`}>
      {grade ?? "—"}
    </span>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: DeviceStatus }) {
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

/* ════════════════════════════════════════════════════════
   ADD DEVICE MODAL
════════════════════════════════════════════════════════ */
function AddDeviceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    brand: "", model: "", color: "", storage: "128GB",
    imei: "", serial_no: "",
    battery_health: "", grade: "B",
    condition_notes: "",
    purchase_price: "", sale_price: "",
    supplier_name: "",
    dual_sim: false, with_box: false,
    icloud_locked: false, network_locked: false, previously_opened: false,
    inspector_name: (user as { name?: string })?.name ?? "",
  });
  const [saving, setSaving] = useState(false);

  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      toast({ title: "أدخل الشركة والموديل على الأقل", variant: "destructive" }); return;
    }
    if (!form.purchase_price) {
      toast({ title: "أدخل سعر الشراء", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await apPost("/api/devices", {
        ...form,
        battery_health: form.battery_health ? parseInt(form.battery_health) : null,
        purchase_price: parseFloat(form.purchase_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
      });
      toast({ title: "✅ تم إضافة الجهاز بنجاح" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "erp-input w-full text-sm";
  const labelCls = "text-[11px] text-white/40 mb-1 block text-right";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-2xl border border-white/10 w-full max-w-xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-violet-400" />
            <span className="font-bold text-white">إضافة جهاز جديد</span>
          </div>
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Brand + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>الشركة المصنعة *</label>
              <input value={form.brand} onChange={e => f("brand", e.target.value)}
                placeholder="Apple / Samsung ..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>الموديل *</label>
              <input value={form.model} onChange={e => f("model", e.target.value)}
                placeholder="iPhone 15 Pro Max" className={inputCls} />
            </div>
          </div>

          {/* Color + Storage + Grade */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>اللون</label>
              <input value={form.color} onChange={e => f("color", e.target.value)}
                placeholder="Black" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>السعة</label>
              <select value={form.storage} onChange={e => f("storage", e.target.value)} className={inputCls}>
                {STORAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>الدرجة</label>
              <select value={form.grade} onChange={e => f("grade", e.target.value)} className={inputCls}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* IMEI + Battery */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>IMEI / SN</label>
              <input value={form.imei} onChange={e => f("imei", e.target.value)}
                placeholder="123456789012345" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>نسبة البطارية %</label>
              <input type="number" min="1" max="100"
                value={form.battery_health} onChange={e => f("battery_health", e.target.value)}
                placeholder="85" className={inputCls} />
            </div>
          </div>

          {/* Purchase + Sale price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>سعر الشراء *</label>
              <input type="number" value={form.purchase_price}
                onChange={e => f("purchase_price", e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>سعر البيع</label>
              <input type="number" value={form.sale_price}
                onChange={e => f("sale_price", e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className={labelCls}>المورد / مصدر الجهاز</label>
            <input value={form.supplier_name} onChange={e => f("supplier_name", e.target.value)}
              placeholder="اسم المورد أو العميل الذي اشترينا منه..." className={inputCls} />
          </div>

          {/* Inspector + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>الفاحص</label>
              <input value={form.inspector_name} onChange={e => f("inspector_name", e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ملاحظات الحالة</label>
              <input value={form.condition_notes} onChange={e => f("condition_notes", e.target.value)}
                placeholder="خدوش خفيفة..." className={inputCls} />
            </div>
          </div>

          {/* Flags */}
          <div className="bg-white/3 rounded-xl border border-white/5 p-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2.5">حالة الجهاز</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["dual_sim",         "شريحتين"],
                ["with_box",         "بالعلبة"],
                ["previously_opened","مفتوح من قبل"],
                ["icloud_locked",    "مقفول iCloud"],
                ["network_locked",   "مقفول على شبكة"],
              ] as [string, string][]).map(([key, label]) => (
                <button key={key}
                  onClick={() => f(key, !(form as Record<string, unknown>)[key] as boolean)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all ${
                    (form as Record<string, unknown>)[key]
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                      : "border-white/8 bg-white/3 text-white/35 hover:border-white/20"
                  }`}>
                  {(form as Record<string, unknown>)[key]
                    ? <CheckCircle2 className="w-3 h-3" />
                    : <div className="w-3 h-3 rounded-full border border-white/20" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 shrink-0 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/80 transition-all">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 text-sm font-bold hover:bg-violet-500/30 transition-all disabled:opacity-40 flex items-center gap-2">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            حفظ الجهاز
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SELL DEVICE MODAL
════════════════════════════════════════════════════════ */
function SellModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [soldPrice, setSoldPrice] = useState(device.sale_price ?? "");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("paid");
  const [warrantyMonths, setWarrantyMonths] = useState(3);
  const [saving, setSaving] = useState(false);

  const handleSell = async () => {
    if (!customerName.trim()) { toast({ title: "أدخل اسم العميل", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apPost(`/api/devices/${device.id}/sell`, {
        customer_name: customerName.trim(),
        sold_price: parseFloat(soldPrice as string) || 0,
        payment_method: payMethod,
        payment_status: payStatus,
        warranty_months: warrantyMonths,
        sold_by_name: (user as { name?: string })?.name,
      });
      toast({ title: "✅ تم بيع الجهاز بنجاح" });
      onDone(); onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ";
      toast({ title: msg || "خطأ في البيع", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const inputCls = "erp-input w-full text-sm";
  const labelCls = "text-[11px] text-white/40 mb-1 block text-right";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-2xl border border-white/10 w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">بيع الجهاز</span>
          </div>
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Device summary */}
        <div className="mx-4 mt-4 p-3 bg-white/4 rounded-xl border border-white/8">
          <p className="font-bold text-white text-sm">{device.brand} {device.model}</p>
          <p className="text-white/40 text-xs mt-0.5">
            {device.storage} {device.color && `· ${device.color}`}
            {device.imei && ` · IMEI: ...${device.imei.slice(-4)}`}
          </p>
        </div>

        <div className="p-4 space-y-3">
          {/* Customer */}
          <div>
            <label className={labelCls}>اسم العميل *</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="ابحث عن عميل أو أدخل الاسم..." className={inputCls} />
          </div>

          {/* Sold price */}
          <div>
            <label className={labelCls}>سعر البيع</label>
            <input type="number" value={soldPrice} onChange={e => setSoldPrice(e.target.value)}
              className={inputCls} />
          </div>

          {/* Payment method */}
          <div>
            <label className={labelCls}>طريقة الدفع</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAY_METHODS.map(({ v, l }) => (
                <button key={v} onClick={() => setPayMethod(v)}
                  className={`py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    payMethod === v
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/3 text-white/40 hover:text-white/70"
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Payment status */}
          <div>
            <label className={labelCls}>حالة الدفع</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["paid", "مدفوع بالكامل", "text-emerald-300 bg-emerald-500/15 border-emerald-500/50"],
                ["partial", "دفع جزئي",   "text-amber-300 bg-amber-500/15 border-amber-500/50"],
                ["unpaid", "غير مدفوع",   "text-red-300 bg-red-500/15 border-red-500/50"],
              ] as [PaymentStatus, string, string][]).map(([v, l, cls]) => (
                <button key={v} onClick={() => setPayStatus(v)}
                  className={`py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    payStatus === v ? cls : "border-white/10 bg-white/3 text-white/40 hover:text-white/70"
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Warranty */}
          <div>
            <label className={labelCls}>فترة الضمان</label>
            <select value={warrantyMonths}
              onChange={e => setWarrantyMonths(parseInt(e.target.value))}
              className={inputCls}>
              {WARRANTY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/80">
            إلغاء
          </button>
          <button onClick={handleSell} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            تأكيد البيع
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   DEVICE DETAIL PANEL
════════════════════════════════════════════════════════ */
function DeviceDetail({ device, onClose, onRefresh }: { device: Device; onClose: () => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showSell, setShowSell] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "maintenance" | "available" | null>(null);

  const doAction = async (action: "delete" | "maintenance" | "available") => {
    try {
      if (action === "delete") {
        const r = await authFetch(api(`/api/devices/${device.id}`), { method: "DELETE" });
        if (!r.ok) throw new Error();
        toast({ title: "تم حذف الجهاز" });
      } else {
        await apPost(`/api/devices/${device.id}/${action}`, {});
        toast({ title: action === "maintenance" ? "تم إرسال الجهاز للصيانة" : "تم إرجاع الجهاز كمتاح" });
      }
      onRefresh(); onClose();
    } catch {
      toast({ title: "خطأ في العملية", variant: "destructive" });
    }
    setConfirming(null);
  };

  const InfoCard = ({ icon: Icon, label, value, color = "text-white/70" }: { icon: ElementType; label: string; value: string | number | undefined; color?: string }) => (
    <div className="bg-white/3 rounded-xl border border-white/6 p-2.5 flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <span className={`font-bold text-sm ${color}`}>{value ?? "—"}</span>
    </div>
  );

  const FlagChip = ({ label, val, warn = false }: { label: string; val: boolean; warn?: boolean }) => (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
      val
        ? warn
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
        : "border-white/6 bg-white/3 text-white/25"
    }`}>
      {val
        ? warn ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />
        : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );

  const profit = device.sold_price
    ? (parseFloat(device.sold_price) - parseFloat(device.purchase_price)).toFixed(2)
    : device.status === "available"
      ? (parseFloat(device.sale_price) - parseFloat(device.purchase_price)).toFixed(2)
      : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 bg-black/70 backdrop-blur-sm" dir="rtl">
        <div className="glass-panel rounded-2xl border border-white/10 w-full max-w-lg mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
            <div>
              <p className="font-bold text-white">{device.brand} {device.model}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{device.device_no}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={device.status} />
              <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-4 space-y-4">

            {/* Specs grid */}
            <div className="grid grid-cols-3 gap-2">
              <InfoCard icon={Package} label="السعة"    value={device.storage} />
              <InfoCard icon={Battery}  label="البطارية" value={device.battery_health ? `${device.battery_health}%` : undefined}
                color={device.battery_health && device.battery_health < 80 ? "text-amber-300" : "text-white/70"} />
              <div className="bg-white/3 rounded-xl border border-white/6 p-2.5 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
                  <BadgeCheck className="w-3 h-3" /> الدرجة
                </div>
                <GradeBadge grade={device.grade} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {device.color && <InfoCard icon={Tag}  label="اللون"   value={device.color} />}
              {device.imei  && <InfoCard icon={Info} label="IMEI/SN" value={device.imei} />}
            </div>

            {/* Flags */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">حالة الجهاز</p>
              <div className="flex flex-wrap gap-1.5">
                <FlagChip label="شريحتين"       val={device.dual_sim} />
                <FlagChip label="بالعلبة"        val={device.with_box} />
                <FlagChip label="الضريبة مدفوعة" val={true} />
                <FlagChip label="مفتوح من قبل"   val={device.previously_opened} warn />
                <FlagChip label="مقفول iCloud"   val={device.icloud_locked} warn />
                <FlagChip label="مقفول شبكة"     val={device.network_locked} warn />
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white/3 rounded-xl border border-white/6 p-3">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">التسعير</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-white/30">سعر الشراء</p>
                  <p className="font-bold text-white/60 text-sm">{parseFloat(device.purchase_price).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30">{device.status === "sold" ? "بيع بـ" : "سعر البيع"}</p>
                  <p className="font-bold text-white text-sm">
                    {parseFloat(device.status === "sold" ? (device.sold_price ?? device.sale_price) : device.sale_price).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30">الربح</p>
                  <p className={`font-bold text-sm ${profit && parseFloat(profit) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {profit ? parseFloat(profit).toLocaleString() : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Sold info */}
            {device.status === "sold" && (
              <div className="bg-blue-500/5 rounded-xl border border-blue-500/15 p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">بيانات البيع</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-white/30 text-xs">العميل: </span><span className="text-white/80">{device.sold_to_customer_name ?? "—"}</span></div>
                  <div><span className="text-white/30 text-xs">البائع: </span><span className="text-white/80">{device.sold_by_user_name ?? "—"}</span></div>
                  <div><span className="text-white/30 text-xs">الدفع: </span><span className="text-white/80">{device.payment_method ?? "—"}</span></div>
                  <div><span className="text-white/30 text-xs">الضمان: </span><span className="text-white/80">{device.warranty_months ? `${device.warranty_months} شهر` : "بدون"}</span></div>
                  {device.sold_at && <div className="col-span-2"><span className="text-white/30 text-xs">تاريخ البيع: </span><span className="text-white/60 text-xs">{new Date(device.sold_at).toLocaleDateString("ar-EG")}</span></div>}
                </div>
              </div>
            )}

            {/* Source */}
            {device.supplier_name && (
              <div className="flex items-center gap-2 text-xs text-white/30">
                <User className="w-3 h-3" /> المورد: <span className="text-white/50">{device.supplier_name}</span>
              </div>
            )}
            {device.condition_notes && (
              <div className="text-xs text-white/30">ملاحظات: <span className="text-white/50">{device.condition_notes}</span></div>
            )}
          </div>

          {/* Actions footer */}
          <div className="px-4 py-3.5 border-t border-white/10 shrink-0">
            {confirming ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">
                  {confirming === "delete" ? "تأكيد الحذف؟" : confirming === "maintenance" ? "إرسال للصيانة؟" : "إرجاع كمتاح؟"}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirming(null)} className="px-3 py-1.5 rounded-xl border border-white/10 text-white/50 text-xs">إلغاء</button>
                  <button onClick={() => doAction(confirming)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      confirming === "delete" ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    }`}>تأكيد</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {device.status === "available" && (
                  <>
                    <button onClick={() => setShowSell(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 transition-all">
                      <ShoppingCart className="w-3.5 h-3.5" /> بيع الجهاز
                    </button>
                    <button onClick={() => setConfirming("maintenance")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm hover:bg-amber-500/20 transition-all">
                      <Wrench className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {device.status === "maintenance" && (
                  <button onClick={() => setConfirming("available")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-all">
                    <RotateCcw className="w-3.5 h-3.5" /> إرجاع كمتاح
                  </button>
                )}
                <button onClick={() => setConfirming("delete")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSell && (
        <SellModal device={device} onClose={() => setShowSell(false)} onDone={onRefresh} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN DEVICES PAGE
════════════════════════════════════════════════════════ */
export default function Devices() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | DeviceStatus>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Device | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/devices"] });
    qc.invalidateQueries({ queryKey: ["/api/devices/stats"] });
  };

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/devices/stats"],
    queryFn: () => apiFetch<Stats>(api("/api/devices/stats")),
    staleTime: 0,
  });

  const { data: allDevices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices", statusFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (search.trim()) p.set("search", search.trim());
      return apiFetch<Device[]>(api(`/api/devices?${p}`));
    },
    staleTime: 0,
  });

  const FILTERS: { v: "all" | DeviceStatus; l: string; count: number }[] = [
    { v: "all",        l: "الكل",    count: stats?.total ?? 0 },
    { v: "available",  l: "متاح",    count: stats?.available ?? 0 },
    { v: "maintenance",l: "صيانة",   count: stats?.maintenance ?? 0 },
    { v: "sold",       l: "مباع",    count: stats?.sold ?? 0 },
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
            <h1 className="text-lg font-bold text-white leading-tight">الموبايلات المستعملة</h1>
            <p className="text-[11px] text-white/30">شراء وبيع الأجهزة — البيع والصيانة</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 text-sm font-bold hover:bg-violet-500/30 transition-all">
          <Plus className="w-4 h-4" /> إضافة جهاز
        </button>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "إجمالي الأجهزة", value: stats?.total ?? 0,       color: "text-white",        icon: Smartphone },
          { label: "متاح للبيع",     value: stats?.available ?? 0,    color: "text-emerald-400",  icon: CheckCircle2 },
          { label: "في الصيانة",     value: stats?.maintenance ?? 0,  color: "text-amber-400",    icon: Wrench },
          { label: "إجمالي المباع",  value: stats?.sold ?? 0,         color: "text-blue-400",     icon: ShoppingCart },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="glass-panel rounded-xl border border-white/8 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/30">{label}</span>
              <Icon className={`w-3.5 h-3.5 ${color} opacity-60`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1">
          {FILTERS.map(({ v, l, count }) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                statusFilter === v
                  ? "bg-violet-500/25 border-violet-500/50 text-violet-200"
                  : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"
              }`}>
              {l}
              <span className={`text-[10px] px-1.5 rounded-full ${
                statusFilter === v ? "bg-violet-500/30 text-violet-300" : "bg-white/5 text-white/25"
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-44">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالموديل / IMEI / العميل..."
            className="erp-input w-full pr-8 text-sm" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-white/30 hover:text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* ── Device List ── */}
      <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : allDevices.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Smartphone className="w-10 h-10 text-white/10 mx-auto" />
            <p className="text-white/30 text-sm">لا توجد أجهزة</p>
            <p className="text-white/15 text-xs">اضغط "إضافة جهاز" لتسجيل أول جهاز</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-right text-[11px] font-bold text-white/25 px-4 py-2.5">الجهاز</th>
                <th className="text-right text-[11px] font-bold text-white/25 px-3 py-2.5 hidden sm:table-cell">المواصفات</th>
                <th className="text-right text-[11px] font-bold text-white/25 px-3 py-2.5">الأسعار</th>
                <th className="text-center text-[11px] font-bold text-white/25 px-3 py-2.5">الحالة</th>
                <th className="text-right text-[11px] font-bold text-white/25 px-3 py-2.5 hidden md:table-cell">المورد / العميل</th>
              </tr>
            </thead>
            <tbody>
              {allDevices.map((d, idx) => (
                <tr key={d.id}
                  onClick={() => setSelected(d)}
                  className={`border-b border-white/4 cursor-pointer hover:bg-white/3 transition-colors ${idx % 2 === 0 ? "" : "bg-white/1"}`}>
                  {/* Device */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white/90 text-sm">{d.brand} {d.model}</p>
                    <p className="text-[11px] text-white/30">{d.device_no}</p>
                  </td>
                  {/* Specs */}
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {d.storage && <span className="text-[11px] text-white/50 bg-white/5 px-1.5 py-0.5 rounded">{d.storage}</span>}
                      {d.color  && <span className="text-[11px] text-white/40">{d.color}</span>}
                      {d.battery_health && (
                        <span className={`text-[11px] flex items-center gap-0.5 ${d.battery_health < 80 ? "text-amber-400/70" : "text-white/35"}`}>
                          <Battery className="w-2.5 h-2.5" />{d.battery_health}%
                        </span>
                      )}
                    </div>
                    <GradeBadge grade={d.grade} />
                  </td>
                  {/* Prices */}
                  <td className="px-3 py-3">
                    <p className="text-white/80 font-semibold">{parseFloat(d.sale_price).toLocaleString()}</p>
                    <p className="text-[11px] text-white/25">شراء: {parseFloat(d.purchase_price).toLocaleString()}</p>
                  </td>
                  {/* Status */}
                  <td className="px-3 py-3 text-center">
                    <StatusBadge status={d.status} />
                  </td>
                  {/* Source/customer */}
                  <td className="px-3 py-3 hidden md:table-cell">
                    <p className="text-[11px] text-white/40">
                      {d.status === "sold" ? d.sold_to_customer_name : d.supplier_name ?? "—"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onSaved={refresh} />}
      {selected && <DeviceDetail device={selected} onClose={() => setSelected(null)} onRefresh={refresh} />}
    </div>
  );
}
