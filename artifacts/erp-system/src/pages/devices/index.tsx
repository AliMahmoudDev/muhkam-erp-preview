import { useState, useRef, useEffect, useMemo } from "react";
import { useAppSettings } from "@/contexts/app-settings";
import { openPrintWindow, escapeHtml } from '@/lib/print-utils';
import { useGetCustomers } from "@workspace/api-client-react";
import { safeArray } from "@/lib/safe-data";
import { SearchableSelect } from "@/components/searchable-select";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone, Plus, CheckCircle2, XCircle,
  ShoppingCart, Wrench,
  Trash2, RotateCcw, Package,
  User, TrendingUp, Banknote, Printer,
  MoreVertical, Eye, Percent, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/contexts/auth";
import { api } from '@/lib/api';
import Warranty from '@/pages/warranty';
import { DeviceFormModal } from './DeviceFormModal';
import { DeviceDetails } from './DeviceDetails';
import { DeviceList } from './DeviceList';


/* ── Types ── */
export type DeviceStatus = "available" | "sold" | "maintenance";
export type PaymentMethod = "cash" | "card" | "instapay" | "transfer";
export type PaymentStatus = "paid" | "partial" | "unpaid";

export type Device = {
  id: number; company_id: number; branch_id?: number;
  device_no: string;
  brand: string; model: string; color?: string; storage?: string;
  imei?: string; serial_no?: string;
  battery_health?: number; grade?: string; condition_notes?: string;
  purchase_price: string; sale_price: string;
  status: DeviceStatus;
  dual_sim: boolean; with_box: boolean;
  icloud_locked: boolean; network_locked: boolean; previously_opened: boolean; mdm_locked: boolean;
  supplier_name?: string; purchase_invoice_no?: string; inspector_name?: string;
  sold_to_customer_name?: string; sold_at?: string;
  sold_by_user_name?: string; sold_price?: string;
  warranty_months?: number; payment_method?: string; payment_status?: string;
  added_by_user_name?: string; created_at: string;
  supplier_phone?: string; id_card_data?: string;
};

type Stats = {
  total: number; available: number; sold: number; maintenance: number;
  stock_purchase_value: number; stock_sale_value: number; stock_profit_potential: number;
  sold_revenue: number; sold_profit: number;
};

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

/* ── Print Sale Receipt ── */
export function printSaleReceipt(d: Device, companyName: string) {
  const price = parseFloat(d.sold_price ?? d.sale_price ?? "0").toLocaleString("ar-EG");
  const profit = parseFloat(d.sold_price ?? "0") - parseFloat(d.purchase_price ?? "0");
  const date = d.sold_at ? new Date(d.sold_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const payMethods: Record<string, string> = { cash: "نقداً", card: "بطاقة", instapay: "InstaPay", transfer: "تحويل" };
  const payStatuses: Record<string, string> = { paid: "مدفوع بالكامل", partial: "مدفوع جزئياً", unpaid: "غير مدفوع" };

  const _html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة بيع — ${escapeHtml(d.brand)} ${escapeHtml(d.model)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #111; padding: 20px; font-size: 13px; }
  .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 22px; font-weight: 900; color: #7c3aed; letter-spacing: 1px; }
  .header p { color: #666; font-size: 11px; margin-top: 2px; }
  .badge { display: inline-block; background: #7c3aed; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 999px; margin-top: 6px; }
  .section { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .section-title { background: #f3f4f6; padding: 6px 12px; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .row { display: flex; justify-content: space-between; padding: 7px 12px; border-top: 1px solid #f3f4f6; }
  .row:first-of-type { border-top: none; }
  .label { color: #6b7280; font-size: 12px; }
  .value { font-weight: 600; color: #111; font-size: 12px; }
  .price-box { background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 10px 16px; text-align: center; margin: 12px 0; }
  .price-box .amount { font-size: 26px; font-weight: 900; color: #15803d; }
  .price-box .label2 { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #d1d5db; padding-top: 12px; color: #9ca3af; font-size: 10px; }
  .warranty { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 8px 12px; text-align: center; margin: 8px 0; }
  .warranty strong { color: #1d4ed8; }
  .stamp { border: 2px dashed #7c3aed; border-radius: 50%; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; margin: 10px auto; color: #7c3aed; font-weight: 900; font-size: 11px; text-align: center; }
  @media print { body { padding: 8px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(companyName)}</h1>
  <p>نظام إدارة الموبايلات المستعملة</p>
  <span class="badge">فاتورة بيع رسمية</span>
</div>

<div class="price-box">
  <div class="amount">${escapeHtml(price)} ج.م</div>
  <div class="label2">إجمالي مبلغ الفاتورة</div>
</div>

<div class="section">
  <div class="section-title">بيانات الجهاز</div>
  <div class="row"><span class="label">الماركة والموديل</span><span class="value">${escapeHtml(d.brand)} ${escapeHtml(d.model)}</span></div>
  ${d.color ? `<div class="row"><span class="label">اللون</span><span class="value">${escapeHtml(d.color)}</span></div>` : ""}
  ${d.storage ? `<div class="row"><span class="label">السعة التخزينية</span><span class="value">${escapeHtml(d.storage)}</span></div>` : ""}
  ${d.imei ? `<div class="row"><span class="label">رقم IMEI</span><span class="value" style="direction:ltr;text-align:right">${escapeHtml(d.imei)}</span></div>` : ""}
  ${d.serial_no ? `<div class="row"><span class="label">الرقم التسلسلي</span><span class="value" style="direction:ltr;text-align:right">${escapeHtml(d.serial_no)}</span></div>` : ""}
  ${d.grade ? `<div class="row"><span class="label">الدرجة</span><span class="value">${escapeHtml(d.grade)}</span></div>` : ""}
  ${d.battery_health ? `<div class="row"><span class="label">صحة البطارية</span><span class="value">${escapeHtml(String(d.battery_health))}%</span></div>` : ""}
  <div class="row"><span class="label">رقم الجهاز</span><span class="value" style="direction:ltr;text-align:right">${escapeHtml(d.device_no)}</span></div>
</div>

<div class="section">
  <div class="section-title">بيانات البيع</div>
  <div class="row"><span class="label">اسم العميل</span><span class="value">${escapeHtml(d.sold_to_customer_name) || "—"}</span></div>
  <div class="row"><span class="label">تاريخ البيع</span><span class="value">${escapeHtml(date)}</span></div>
  <div class="row"><span class="label">طريقة الدفع</span><span class="value">${escapeHtml(payMethods[d.payment_method ?? ""] ?? d.payment_method ?? "—")}</span></div>
  <div class="row"><span class="label">حالة الدفع</span><span class="value">${escapeHtml(payStatuses[d.payment_status ?? ""] ?? d.payment_status ?? "—")}</span></div>
  ${d.sold_by_user_name ? `<div class="row"><span class="label">البائع</span><span class="value">${escapeHtml(d.sold_by_user_name)}</span></div>` : ""}
</div>

${d.warranty_months ? `
<div class="warranty">
  <strong>ضمان ${escapeHtml(String(d.warranty_months))} شهر</strong> — يسري من تاريخ الشراء
</div>
` : ""}

<div class="stamp">${escapeHtml(companyName.split(/[|\-]/)[0].trim())}<br/>ERP</div>

<div class="footer">
  <p>شكراً لثقتك بنا — MUHKAM Enterprise Solutions</p>
  <p style="margin-top:4px">هذه الفاتورة صادرة إلكترونياً وتُعدّ وثيقة رسمية</p>
  <p style="margin-top:4px; color:#bbb;">الربح الصافي من هذه الصفقة: ${profit.toLocaleString("ar-EG")} ج.م</p>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
  openPrintWindow(_html, { width: 420, height: 680 });
}

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
  const c = colors[grade ?? "B"] ?? "text-white/40 bg-white/5 border-white/10";
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

/* ════════════════════════════════════════════════════════
   SELL DEVICE MODAL
════════════════════════════════════════════════════════ */
export function SellModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const { data: customersRaw } = useGetCustomers();
  const customerItems = useMemo(() => {
    const list = safeArray(customersRaw as { id: number; name: string }[] | undefined);
    return list.map(c => ({ value: String(c.id), label: c.name, searchKeys: [c.name] }));
  }, [customersRaw]);
  const [basePrice, setBasePrice] = useState(parseFloat(device.sale_price ?? "0"));
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountVal, setDiscountVal] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payStatus, setPayStatus] = useState<PaymentStatus>("paid");
  const [warrantyMonths, setWarrantyMonths] = useState(3);
  const [saving, setSaving] = useState(false);

  const discountAmount = discountType === "percent"
    ? Math.round(basePrice * discountVal / 100)
    : discountType === "fixed" ? discountVal : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  const handleSell = async () => {
    if (!customerName.trim() && !customerId) { toast({ title: "أدخل اسم العميل أو اختر عميلاً", variant: "destructive" }); return; }
    const resolvedName = customerId
      ? (customerItems.find(c => c.value === customerId)?.label ?? customerName.trim())
      : customerName.trim();
    setSaving(true);
    try {
      await apiPost(`/api/devices/${device.id}/sell`, {
        customer_name: resolvedName,
        customer_id: customerId ? Number(customerId) : undefined,
        sold_price: finalPrice,
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

  const lCls = "text-[11px] text-white/40 mb-1 block text-right";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 bg-black/70 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="glass-panel rounded-2xl border border-white/10 w-full max-w-sm mx-4 my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-bold text-white text-sm">بيع الجهاز</span>
              <p className="text-[10px] text-white/30">{device.brand} {device.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Device summary */}
        <div className="mx-4 mt-4 flex items-center gap-3 p-3 bg-white/4 rounded-xl border border-white/8">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm truncate">{device.brand} {device.model}</p>
            <p className="text-white/40 text-xs mt-0.5">
              {device.storage && <span className="ml-2">{device.storage}</span>}
              {device.color && <span className="ml-2">· {device.color}</span>}
              {device.imei && <span className="ml-2 font-mono">· IMEI: ···{device.imei.slice(-4)}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 font-bold text-sm">{finalPrice.toLocaleString()} ج.م</p>
            <p className="text-white/25 text-[10px]">سعر البيع</p>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Customer */}
          <div>
            <label className={lCls}>العميل *</label>
            {customerItems.length > 0 ? (
              <SearchableSelect
                items={customerItems}
                value={customerId}
                onChange={id => { setCustomerId(id); setCustomerName(""); }}
                placeholder="ابحث في العملاء..."
              />
            ) : null}
            {!customerId && (
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder={customerItems.length > 0 ? "أو أدخل اسم عميل جديد..." : "اسم العميل..."}
                className={`erp-input w-full text-sm ${customerItems.length > 0 ? "mt-2" : ""}`} />
            )}
            {customerId && (
              <button onClick={() => setCustomerId("")}
                className="mt-1 text-xs text-white/30 hover:text-red-400 transition-colors">
                × إلغاء التحديد
              </button>
            )}
          </div>

          {/* Base price */}
          <div>
            <label className={lCls}>سعر البيع الأساسي</label>
            <input type="number" value={basePrice}
              onChange={e => setBasePrice(parseFloat(e.target.value) || 0)}
              className="erp-input w-full text-sm" />
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lCls}>نوع الخصم</label>
              <select value={discountType} onChange={e => { setDiscountType(e.target.value as "none"|"percent"|"fixed"); setDiscountVal(0); }}
                className="erp-input w-full text-sm">
                <option value="none">بدون خصم</option>
                <option value="percent">نسبة %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>
            <div>
              <label className={lCls}>قيمة الخصم</label>
              <div className="relative">
                <input type="number" min={0} value={discountVal} onChange={e => setDiscountVal(parseFloat(e.target.value) || 0)}
                  disabled={discountType === "none"}
                  className="erp-input w-full text-sm disabled:opacity-40 disabled:cursor-not-allowed" />
                {discountType === "percent" && (
                  <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                )}
              </div>
            </div>
          </div>
          {discountType !== "none" && discountAmount > 0 && (
            <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 text-xs">
              <span className="text-white/50">الخصم: {discountAmount.toLocaleString()} ج.م</span>
              <span className="text-emerald-400 font-bold">الإجمالي بعد الخصم: {finalPrice.toLocaleString()} ج.م</span>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className={lCls}>طريقة الدفع</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PAY_METHODS.map(({ v, l }) => (
                <button key={v} onClick={() => setPayMethod(v)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                    payMethod === v
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/3 text-white/40 hover:text-white/70"
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Payment status */}
          <div>
            <label className={lCls}>حالة الدفع</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["paid",    "مدفوع بالكامل", "text-emerald-300 bg-emerald-500/15 border-emerald-500/50"],
                ["partial", "دفع جزئي",      "text-amber-300 bg-amber-500/15 border-amber-500/50"],
                ["unpaid",  "غير مدفوع",     "text-red-300 bg-red-500/15 border-red-500/50"],
              ] as [PaymentStatus, string, string][]).map(([v, l, cls]) => (
                <button key={v} onClick={() => setPayStatus(v)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    payStatus === v ? cls : "border-white/10 bg-white/3 text-white/40 hover:text-white/70"
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Warranty + Seller */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lCls}>فترة الضمان</label>
              <select value={warrantyMonths} onChange={e => setWarrantyMonths(parseInt(e.target.value))} className="erp-input w-full text-sm">
                {WARRANTY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lCls}>البائع</label>
              <div className="erp-input w-full text-sm text-white/50 flex items-center gap-1.5">
                <User className="w-3 h-3 shrink-0" />
                <span className="truncate">{(user as { name?: string })?.name ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/80">
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
   RETURN DEVICE MODAL
════════════════════════════════════════════════════════ */
export const RETURN_REASONS = [
  "عيب مصنعي",
  "الجهاز لا يعمل بشكل صحيح",
  "لم يعجب العميل",
  "وجد جهاز آخر",
  "تغيير رأي العميل",
  "الجهاز تالف",
  "خلاف على السعر",
  "أخرى",
];

export function ReturnModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReturn = async () => {
    setSaving(true);
    try {
      await apiPost(`/api/devices/${device.id}/return`, {
        return_reason: reason === "أخرى" ? customReason.trim() || "أخرى" : reason,
      });
      toast({ title: "✅ تم إرجاع الجهاز وأصبح متاحاً" });
      onDone(); onClose();
    } catch {
      toast({ title: "خطأ في عملية الإرجاع", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const returnPrice = device.sold_price ?? device.sale_price;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-2xl border border-amber-500/20 w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white">إرجاع الجهاز من العميل</span>
          </div>
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Device info */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 text-sm space-y-1">
            <p className="text-white/80 font-bold">{device.brand} {device.model}</p>
            <p className="text-white/40 text-xs">{device.device_no} — {device.color ?? ""}</p>
            {device.sold_to_customer_name && (
              <p className="text-white/50 text-xs">العميل: {device.sold_to_customer_name}</p>
            )}
          </div>

          {/* Return price (read-only, equals sale price) */}
          <div>
            <label className="text-[11px] text-white/40 mb-1 block text-right">سعر الإرجاع (نفس سعر الفاتورة)</label>
            <div className="erp-input w-full text-sm flex items-center justify-between opacity-70 cursor-not-allowed">
              <span className="text-emerald-300 font-bold">
                {parseFloat(returnPrice ?? "0").toLocaleString("ar-EG")} ج.م
              </span>
              <span className="text-white/30 text-xs">غير قابل للتعديل</span>
            </div>
          </div>

          {/* Return reason */}
          <div>
            <label className="text-[11px] text-white/40 mb-1 block text-right">سبب الإرجاع *</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="erp-input w-full text-sm">
              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === "أخرى" && (
              <input value={customReason} onChange={e => setCustomReason(e.target.value)}
                placeholder="اكتب سبب الإرجاع" className="erp-input w-full text-sm mt-1.5" />
            )}
          </div>

          <p className="text-[11px] text-amber-400/70 bg-amber-500/8 border border-amber-500/15 rounded-lg p-2.5">
            سيتم إرجاع الجهاز لحالة «متاح» وحفظ سبب الإرجاع في ملاحظات الجهاز.
          </p>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/80">
            إلغاء
          </button>
          <button onClick={handleReturn} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            تأكيد الإرجاع
          </button>
        </div>
      </div>
    </div>
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
        className="p-1.5 rounded-lg text-white/25 hover:text-violet-300 hover:bg-violet-500/10 transition-all">
        <Eye className="w-3.5 h-3.5" />
      </button>

      {/* Three-dot */}
      <button ref={btnRef} onClick={handleOpenMenu}
        className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/8 transition-all">
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
          <div className="glass-panel rounded-2xl border border-white/10 p-5 w-72 space-y-4">
            <p className="font-bold text-white text-center">
              {confirming === "delete" ? "حذف الجهاز؟" : confirming === "maintenance" ? "إرسال للصيانة؟" : "إرجاع كمتاح؟"}
            </p>
            <p className="text-white/40 text-xs text-center">{device.brand} {device.model}</p>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm">إلغاء</button>
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
            <h1 className="text-lg font-bold text-white leading-tight">الأجهزة المستعملة</h1>
            <p className="text-[11px] text-white/30">شراء وبيع الأجهزة — البيع والصيانة</p>
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
      <div className="flex gap-1 border-b border-white/8 pb-0">
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
                : "border-transparent text-white/40 hover:text-white/70"
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
          { label: "إجمالي الأجهزة", value: stats?.total ?? 0,        color: "text-white",       icon: Smartphone },
          { label: "متاح للبيع",     value: stats?.available ?? 0,     color: "text-emerald-400", icon: CheckCircle2 },
          { label: "في الصيانة",     value: stats?.maintenance ?? 0,   color: "text-amber-400",   icon: Wrench },
          { label: "إجمالي المباع",  value: stats?.sold ?? 0,          color: "text-blue-400",    icon: ShoppingCart },
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

      {/* ── Stats cards — Row 2: Financial ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-panel rounded-xl border border-violet-500/15 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">قيمة المخزون (شراء)</span>
            <Package className="w-3.5 h-3.5 text-violet-400/60" />
          </div>
          <p className="text-lg font-bold text-violet-300">
            {(stats?.stock_purchase_value ?? 0).toLocaleString("ar-EG")}
            <span className="text-[10px] font-normal text-white/25 mr-1">ج.م</span>
          </p>
          <p className="text-[10px] text-white/20 mt-0.5">
            سعر بيع متوقع: {(stats?.stock_sale_value ?? 0).toLocaleString("ar-EG")} ج.م
          </p>
        </div>
        <div className="glass-panel rounded-xl border border-emerald-500/15 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">ربح متوقع من المخزون</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400/60" />
          </div>
          <p className="text-lg font-bold text-emerald-300">
            {(stats?.stock_profit_potential ?? 0).toLocaleString("ar-EG")}
            <span className="text-[10px] font-normal text-white/25 mr-1">ج.م</span>
          </p>
          <p className="text-[10px] text-white/20 mt-0.5">هامش متوقع على الأجهزة المتاحة</p>
        </div>
        <div className="glass-panel rounded-xl border border-blue-500/15 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30">إيراد المبيعات الفعلي</span>
            <Banknote className="w-3.5 h-3.5 text-blue-400/60" />
          </div>
          <p className="text-lg font-bold text-blue-300">
            {(stats?.sold_revenue ?? 0).toLocaleString("ar-EG")}
            <span className="text-[10px] font-normal text-white/25 mr-1">ج.م</span>
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
