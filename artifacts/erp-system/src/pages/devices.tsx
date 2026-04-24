import { useState, type ElementType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone, Plus, Search, X, CheckCircle2, XCircle,
  ShoppingCart, Wrench, BadgeCheck, Info,
  Trash2, RotateCcw, AlertTriangle, Battery, Package,
  Tag, User, TrendingUp, Banknote, Printer,
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

type Stats = {
  total: number; available: number; sold: number; maintenance: number;
  stock_purchase_value: number; stock_sale_value: number; stock_profit_potential: number;
  sold_revenue: number; sold_profit: number;
};

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

/* ── Print Sale Receipt ── */
function printSaleReceipt(d: Device) {
  const price = parseFloat(d.sold_price ?? d.sale_price ?? "0").toLocaleString("ar-EG");
  const profit = parseFloat(d.sold_price ?? "0") - parseFloat(d.purchase_price ?? "0");
  const date = d.sold_at ? new Date(d.sold_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const payMethods: Record<string, string> = { cash: "نقداً", card: "بطاقة", instapay: "InstaPay", transfer: "تحويل" };
  const payStatuses: Record<string, string> = { paid: "مدفوع بالكامل", partial: "مدفوع جزئياً", unpaid: "غير مدفوع" };

  const win = window.open("", "_blank", "width=420,height=680");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة بيع — ${d.brand} ${d.model}</title>
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
  <h1>MUHKAM | مُحكم</h1>
  <p>نظام إدارة الموبايلات المستعملة</p>
  <span class="badge">فاتورة بيع رسمية</span>
</div>

<div class="price-box">
  <div class="amount">${price} ج.م</div>
  <div class="label2">إجمالي مبلغ الفاتورة</div>
</div>

<div class="section">
  <div class="section-title">بيانات الجهاز</div>
  <div class="row"><span class="label">الماركة والموديل</span><span class="value">${d.brand} ${d.model}</span></div>
  ${d.color ? `<div class="row"><span class="label">اللون</span><span class="value">${d.color}</span></div>` : ""}
  ${d.storage ? `<div class="row"><span class="label">السعة التخزينية</span><span class="value">${d.storage}</span></div>` : ""}
  ${d.imei ? `<div class="row"><span class="label">رقم IMEI</span><span class="value" style="direction:ltr;text-align:right">${d.imei}</span></div>` : ""}
  ${d.serial_no ? `<div class="row"><span class="label">الرقم التسلسلي</span><span class="value" style="direction:ltr;text-align:right">${d.serial_no}</span></div>` : ""}
  ${d.grade ? `<div class="row"><span class="label">الدرجة</span><span class="value">${d.grade}</span></div>` : ""}
  ${d.battery_health ? `<div class="row"><span class="label">صحة البطارية</span><span class="value">${d.battery_health}%</span></div>` : ""}
  <div class="row"><span class="label">رقم الجهاز</span><span class="value" style="direction:ltr;text-align:right">${d.device_no}</span></div>
</div>

<div class="section">
  <div class="section-title">بيانات البيع</div>
  <div class="row"><span class="label">اسم العميل</span><span class="value">${d.sold_to_customer_name ?? "—"}</span></div>
  <div class="row"><span class="label">تاريخ البيع</span><span class="value">${date}</span></div>
  <div class="row"><span class="label">طريقة الدفع</span><span class="value">${payMethods[d.payment_method ?? ""] ?? d.payment_method ?? "—"}</span></div>
  <div class="row"><span class="label">حالة الدفع</span><span class="value">${payStatuses[d.payment_status ?? ""] ?? d.payment_status ?? "—"}</span></div>
  ${d.sold_by_user_name ? `<div class="row"><span class="label">البائع</span><span class="value">${d.sold_by_user_name}</span></div>` : ""}
</div>

${d.warranty_months ? `
<div class="warranty">
  <strong>ضمان ${d.warranty_months} شهر</strong> — يسري من تاريخ الشراء
</div>
` : ""}

<div class="stamp">مُحكم<br/>ERP</div>

<div class="footer">
  <p>شكراً لثقتك بنا — MUHKAM Enterprise Solutions</p>
  <p style="margin-top:4px">هذه الفاتورة صادرة إلكترونياً وتُعدّ وثيقة رسمية</p>
  <p style="margin-top:4px; color:#bbb;">الربح الصافي من هذه الصفقة: ${profit.toLocaleString("ar-EG")} ج.م</p>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
  win.document.close();
}

/* ══════════════════════════════════════════════════════════
   DEVICE CATALOG — 4-level: Brand → Category → Model → {colors,storages}
══════════════════════════════════════════════════════════ */
const OTHER = "أخرى";

type ModelSpec = { colors: string[]; storages: string[] };
type FullCatalog = Record<string, Record<string, Record<string, ModelSpec>>>;

const CATALOG: FullCatalog = {
  "Apple": {
    "iPhone": {
      "iPhone 17 Pro Max":  { colors: ["Desert Titanium","Black Titanium","White Titanium","Natural Titanium"], storages: ["256GB","512GB","1TB"] },
      "iPhone 17 Pro":      { colors: ["Desert Titanium","Black Titanium","White Titanium","Natural Titanium"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 17 Air":      { colors: ["Sky Blue","Black","White","Ultramarine"], storages: ["128GB","256GB","512GB"] },
      "iPhone 17":          { colors: ["Black","White","Ultramarine","Teal","Pink"], storages: ["128GB","256GB","512GB"] },
      "iPhone 16 Pro Max":  { colors: ["Desert Titanium","Black Titanium","White Titanium","Natural Titanium"], storages: ["256GB","512GB","1TB"] },
      "iPhone 16 Pro":      { colors: ["Desert Titanium","Black Titanium","White Titanium","Natural Titanium"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 16 Plus":     { colors: ["Black","White","Pink","Teal","Ultramarine"], storages: ["128GB","256GB","512GB"] },
      "iPhone 16":          { colors: ["Black","White","Pink","Teal","Ultramarine"], storages: ["128GB","256GB","512GB"] },
      "iPhone 15 Pro Max":  { colors: ["Black Titanium","White Titanium","Blue Titanium","Natural Titanium"], storages: ["256GB","512GB","1TB"] },
      "iPhone 15 Pro":      { colors: ["Black Titanium","White Titanium","Blue Titanium","Natural Titanium"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 15 Plus":     { colors: ["Black","Blue","Green","Yellow","Pink"], storages: ["128GB","256GB","512GB"] },
      "iPhone 15":          { colors: ["Black","Blue","Green","Yellow","Pink"], storages: ["128GB","256GB","512GB"] },
      "iPhone 14 Pro Max":  { colors: ["Deep Purple","Gold","Silver","Space Black"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 14 Pro":      { colors: ["Deep Purple","Gold","Silver","Space Black"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 14 Plus":     { colors: ["Midnight","Starlight","Blue","Purple","Yellow","Red"], storages: ["128GB","256GB","512GB"] },
      "iPhone 14":          { colors: ["Midnight","Starlight","Blue","Purple","Yellow","Red"], storages: ["128GB","256GB","512GB"] },
      "iPhone 13 Pro Max":  { colors: ["Sierra Blue","Silver","Gold","Alpine Green","Graphite"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 13 Pro":      { colors: ["Sierra Blue","Silver","Gold","Alpine Green","Graphite"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPhone 13 mini":     { colors: ["Midnight","Starlight","Blue","Pink","Green","Red"], storages: ["128GB","256GB","512GB"] },
      "iPhone 13":          { colors: ["Midnight","Starlight","Blue","Pink","Green","Red"], storages: ["128GB","256GB","512GB"] },
      "iPhone 12 Pro Max":  { colors: ["Pacific Blue","Gold","Silver","Graphite"], storages: ["128GB","256GB","512GB"] },
      "iPhone 12 Pro":      { colors: ["Pacific Blue","Gold","Silver","Graphite"], storages: ["128GB","256GB","512GB"] },
      "iPhone 12 mini":     { colors: ["Black","White","Red","Blue","Green","Purple"], storages: ["64GB","128GB","256GB"] },
      "iPhone 12":          { colors: ["Black","White","Red","Blue","Green","Purple"], storages: ["64GB","128GB","256GB"] },
      "iPhone 11 Pro Max":  { colors: ["Midnight Green","Gold","Silver","Space Gray"], storages: ["64GB","256GB","512GB"] },
      "iPhone 11 Pro":      { colors: ["Midnight Green","Gold","Silver","Space Gray"], storages: ["64GB","256GB","512GB"] },
      "iPhone 11":          { colors: ["Black","White","Yellow","Purple","Green","Red"], storages: ["64GB","128GB","256GB"] },
      "iPhone XS Max":      { colors: ["Gold","Silver","Space Gray"], storages: ["64GB","256GB","512GB"] },
      "iPhone XS":          { colors: ["Gold","Silver","Space Gray"], storages: ["64GB","256GB","512GB"] },
      "iPhone XR":          { colors: ["Black","White","Blue","Yellow","Coral","Red"], storages: ["64GB","128GB","256GB"] },
      "iPhone X":           { colors: ["Silver","Space Gray"], storages: ["64GB","256GB"] },
      "iPhone 8 Plus":      { colors: ["Gold","Silver","Space Gray","Red"], storages: ["64GB","128GB","256GB"] },
      "iPhone 8":           { colors: ["Gold","Silver","Space Gray","Red"], storages: ["64GB","128GB","256GB"] },
      "iPhone 7 Plus":      { colors: ["Jet Black","Matte Black","Gold","Silver","Rose Gold","Red"], storages: ["32GB","128GB","256GB"] },
      "iPhone 7":           { colors: ["Jet Black","Matte Black","Gold","Silver","Rose Gold","Red"], storages: ["32GB","128GB","256GB"] },
      "iPhone 6s Plus":     { colors: ["Gold","Silver","Space Gray","Rose Gold"], storages: ["16GB","32GB","64GB","128GB"] },
      "iPhone 6s":          { colors: ["Gold","Silver","Space Gray","Rose Gold"], storages: ["16GB","32GB","64GB","128GB"] },
      "iPhone 6 Plus":      { colors: ["Gold","Silver","Space Gray"], storages: ["16GB","64GB","128GB"] },
      "iPhone 6":           { colors: ["Gold","Silver","Space Gray"], storages: ["16GB","64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "iPad": {
      "iPad Pro 13\" M4":    { colors: ["Silver","Space Black"], storages: ["256GB","512GB","1TB","2TB"] },
      "iPad Pro 11\" M4":    { colors: ["Silver","Space Black"], storages: ["256GB","512GB","1TB","2TB"] },
      "iPad Air M3 13\"":    { colors: ["Blue","Purple","Starlight","Space Gray"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPad Air M3 11\"":    { colors: ["Blue","Purple","Starlight","Space Gray"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPad Air M2 13\"":    { colors: ["Blue","Purple","Starlight","Space Gray"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPad Air M2 11\"":    { colors: ["Blue","Purple","Starlight","Space Gray"], storages: ["128GB","256GB","512GB","1TB"] },
      "iPad Pro 12.9\" M2":  { colors: ["Silver","Space Gray"], storages: ["128GB","256GB","512GB","1TB","2TB"] },
      "iPad Pro 11\" M2":    { colors: ["Silver","Space Gray"], storages: ["128GB","256GB","512GB","1TB","2TB"] },
      "iPad (10th Gen)":     { colors: ["Blue","Pink","Silver","Yellow"], storages: ["64GB","256GB"] },
      "iPad (9th Gen)":      { colors: ["Silver","Space Gray"], storages: ["64GB","256GB"] },
      "iPad mini 7":         { colors: ["Blue","Pink","Starlight","Purple"], storages: ["128GB","512GB"] },
      "iPad mini 6":         { colors: ["Purple","Starlight","Pink","Space Gray"], storages: ["64GB","256GB"] },
      "iPad Air 5":          { colors: ["Blue","Purple","Starlight","Pink","Space Gray"], storages: ["64GB","256GB"] },
      "iPad Air 4":          { colors: ["Space Gray","Silver","Rose Gold","Green","Sky Blue"], storages: ["64GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Apple Watch": {
      "Apple Watch Ultra 3":   { colors: ["Natural Titanium","Black Titanium"], storages: ["49mm"] },
      "Apple Watch Ultra 2":   { colors: ["Natural Titanium","Black Titanium"], storages: ["49mm"] },
      "Apple Watch Ultra":     { colors: ["Natural Titanium"], storages: ["49mm"] },
      "Apple Watch Series 10": { colors: ["Jet Black","Rose Gold","Silver","Titanium Natural","Titanium Black","Titanium Gold"], storages: ["42mm","46mm"] },
      "Apple Watch Series 9":  { colors: ["Midnight","Starlight","Silver","Pink","Red","Gold"], storages: ["41mm","45mm"] },
      "Apple Watch Series 8":  { colors: ["Midnight","Starlight","Silver","Red"], storages: ["41mm","45mm"] },
      "Apple Watch Series 7":  { colors: ["Midnight","Starlight","Green","Blue","Red"], storages: ["41mm","45mm"] },
      "Apple Watch Series 6":  { colors: ["Blue","Red","Space Gray","Silver","Gold","Gold Pink"], storages: ["40mm","44mm"] },
      "Apple Watch SE 2":      { colors: ["Midnight","Starlight","Silver"], storages: ["40mm","44mm"] },
      "Apple Watch SE":        { colors: ["Space Gray","Silver","Gold"], storages: ["40mm","44mm"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "MacBook": {
      "MacBook Air 15\" M4": { colors: ["Sky Blue","Stardust","Midnight","Starlight"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Air 13\" M4": { colors: ["Sky Blue","Stardust","Midnight","Starlight"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Air 15\" M3": { colors: ["Midnight","Starlight","Space Gray","Silver"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Air 13\" M3": { colors: ["Midnight","Starlight","Space Gray","Silver"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Air 13\" M2": { colors: ["Midnight","Starlight","Space Gray","Silver"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Air 13\" M1": { colors: ["Space Gray","Silver","Gold","Rose Gold"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Pro 16\" M4": { colors: ["Space Black","Silver"], storages: ["512GB","1TB","2TB","4TB"] },
      "MacBook Pro 14\" M4": { colors: ["Space Black","Silver"], storages: ["512GB","1TB","2TB","4TB"] },
      "MacBook Pro 16\" M3": { colors: ["Space Black","Silver"], storages: ["512GB","1TB","2TB","4TB"] },
      "MacBook Pro 14\" M3": { colors: ["Space Black","Silver"], storages: ["512GB","1TB","2TB","4TB"] },
      "MacBook Pro 16\" M2": { colors: ["Space Gray","Silver"], storages: ["512GB","1TB","2TB","4TB"] },
      "MacBook Pro 14\" M2": { colors: ["Space Gray","Silver"], storages: ["512GB","1TB","2TB","4TB"] },
      "MacBook Pro 13\" M2": { colors: ["Space Gray","Silver"], storages: ["256GB","512GB","1TB","2TB"] },
      "MacBook Pro 13\" M1": { colors: ["Space Gray","Silver"], storages: ["256GB","512GB","1TB","2TB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "AirPods": {
      "AirPods 4 (ANC)":      { colors: ["White"], storages: [] },
      "AirPods 4":            { colors: ["White"], storages: [] },
      "AirPods 3rd Gen":      { colors: ["White"], storages: [] },
      "AirPods 2nd Gen":      { colors: ["White"], storages: [] },
      "AirPods Pro 2nd Gen":  { colors: ["White"], storages: [] },
      "AirPods Pro 1st Gen":  { colors: ["White"], storages: [] },
      "AirPods Max (2024)":   { colors: ["Midnight","Starlight","Blue","Purple","Orange"], storages: [] },
      "AirPods Max":          { colors: ["Space Gray","Silver","Green","Sky Blue","Pink"], storages: [] },
      [OTHER]: { colors: [], storages: [] },
    },
    "iMac": {
      "iMac 24\" M4": { colors: ["Silver","Blue","Green","Pink","Yellow","Orange","Purple"], storages: ["256GB","512GB","1TB","2TB"] },
      "iMac 24\" M3": { colors: ["Silver","Blue","Green","Pink","Yellow","Orange","Purple"], storages: ["256GB","512GB","1TB","2TB"] },
      "iMac 24\" M1": { colors: ["Silver","Blue","Green","Pink","Yellow","Orange","Purple"], storages: ["256GB","512GB","1TB","2TB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Samsung": {
    "Galaxy S": {
      "Galaxy S25 Ultra":  { colors: ["تيتانيوم أزرق فضي","تيتانيوم أسود","تيتانيوم أبيض","تيتانيوم رمادي"], storages: ["256GB","512GB","1TB"] },
      "Galaxy S25+":       { colors: ["أزرق جليدي","نعناعي","كحلي","ظل فضي"], storages: ["256GB","512GB"] },
      "Galaxy S25":        { colors: ["أزرق جليدي","نعناعي","كحلي","ظل فضي"], storages: ["128GB","256GB","512GB"] },
      "Galaxy S24 Ultra":  { colors: ["تيتانيوم أسود","تيتانيوم رمادي","تيتانيوم بنفسجي","تيتانيوم أصفر"], storages: ["256GB","512GB","1TB"] },
      "Galaxy S24+":       { colors: ["بنفسجي كوبالت","أخضر زمردي","أسود أونيكس","برتقالي رملي"], storages: ["256GB","512GB"] },
      "Galaxy S24":        { colors: ["بنفسجي كوبالت","أخضر زمردي","أسود أونيكس","رمادي رخامي"], storages: ["128GB","256GB","512GB"] },
      "Galaxy S24 FE":     { colors: ["أزرق","رمادي","أخضر","أصفر"], storages: ["128GB","256GB"] },
      "Galaxy S23 Ultra":  { colors: ["أسود فانتوم","كريم","أخضر","لافندر"], storages: ["256GB","512GB"] },
      "Galaxy S23+":       { colors: ["أسود فانتوم","كريم","أخضر","لافندر"], storages: ["256GB","512GB"] },
      "Galaxy S23":        { colors: ["أسود فانتوم","كريم","أخضر","لافندر"], storages: ["128GB","256GB","512GB"] },
      "Galaxy S23 FE":     { colors: ["جرافيت","أخضر","كريم","بنفسجي"], storages: ["128GB","256GB"] },
      "Galaxy S22 Ultra":  { colors: ["بورجندي","أخضر","أسود فانتوم","أبيض فانتوم"], storages: ["128GB","256GB","512GB","1TB"] },
      "Galaxy S22+":       { colors: ["أخضر","أسود فانتوم","أبيض فانتوم","بنفسجي"], storages: ["128GB","256GB"] },
      "Galaxy S22":        { colors: ["أخضر","أسود فانتوم","أبيض فانتوم","وردي ذهبي"], storages: ["128GB","256GB"] },
      "Galaxy S21 Ultra":  { colors: ["أسود فانتوم","فضي فانتوم","تيتانيوم","قهوة"], storages: ["128GB","256GB","512GB"] },
      "Galaxy S21+":       { colors: ["أسود فانتوم","فضي فانتوم","بنفسجي","ذهبي وردي"], storages: ["128GB","256GB"] },
      "Galaxy S21":        { colors: ["أسود فانتوم","رمادي فانتوم","أبيض فانتوم","بنفسجي","ذهبي وردي"], storages: ["128GB","256GB"] },
      "Galaxy S21 FE":     { colors: ["أبيض","أسود","أخضر","لافندر","وردي"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Galaxy A": {
      "Galaxy A55":  { colors: ["أزرق جليدي","ليلكي","كحلي"], storages: ["128GB","256GB"] },
      "Galaxy A54":  { colors: ["أبيض مذهل","أسود مذهل","أخضر مذهل","بنفسجي مذهل"], storages: ["128GB","256GB"] },
      "Galaxy A35":  { colors: ["أزرق جليدي","ليلكي","كحلي"], storages: ["128GB","256GB"] },
      "Galaxy A34":  { colors: ["لايم","فضي","بنفسجي","أسود"], storages: ["128GB","256GB"] },
      "Galaxy A25":  { colors: ["أسود مذهل","أزرق مذهل","أصفر مذهل"], storages: ["128GB","256GB"] },
      "Galaxy A24":  { colors: ["أسود","أخضر فاتح","وردي فاتح"], storages: ["128GB","256GB"] },
      "Galaxy A15":  { colors: ["أسود","أزرق","أصفر","أزرق فاتح"], storages: ["128GB"] },
      "Galaxy A14":  { colors: ["أسود","أخضر فاتح","فضي"], storages: ["64GB","128GB"] },
      "Galaxy A13":  { colors: ["أسود","أبيض","أزرق","وردي"], storages: ["32GB","64GB","128GB"] },
      "Galaxy A12":  { colors: ["أسود","أبيض","أزرق","أحمر"], storages: ["32GB","64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Galaxy Z": {
      "Galaxy Z Fold 6":  { colors: ["أزرق","وردي","ظل فضي","أبيض"], storages: ["256GB","512GB","1TB"] },
      "Galaxy Z Fold 5":  { colors: ["كريم","أيس نيلي","فانتوم أسود"], storages: ["256GB","512GB","1TB"] },
      "Galaxy Z Fold 4":  { colors: ["أخضر مطفي","بيج","فانتوم أسود","بورجندي"], storages: ["256GB","512GB","1TB"] },
      "Galaxy Z Flip 6":  { colors: ["أزرق","أصفر","فضي","نعناعي"], storages: ["256GB","512GB"] },
      "Galaxy Z Flip 5":  { colors: ["كريم","جرافيت","لافندر","نعناعي"], storages: ["256GB","512GB"] },
      "Galaxy Z Flip 4":  { colors: ["بنفسجي","أزرق","ذهبي","جرافيت","وردي ذهبي"], storages: ["128GB","256GB","512GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Galaxy Tab": {
      "Galaxy Tab S9 Ultra": { colors: ["بيج","جرافيت"], storages: ["128GB","256GB","512GB","1TB"] },
      "Galaxy Tab S9+":      { colors: ["بيج","جرافيت"], storages: ["128GB","256GB","512GB"] },
      "Galaxy Tab S9":       { colors: ["بيج","جرافيت"], storages: ["128GB","256GB"] },
      "Galaxy Tab S9 FE":    { colors: ["أخضر","لافندر","رمادي","أبيض"], storages: ["128GB","256GB"] },
      "Galaxy Tab S8 Ultra": { colors: ["جرافيت"], storages: ["128GB","256GB","512GB"] },
      "Galaxy Tab S8+":      { colors: ["فضي","جرافيت"], storages: ["128GB","256GB"] },
      "Galaxy Tab S8":       { colors: ["فضي","جرافيت","وردي ذهبي"], storages: ["128GB","256GB"] },
      "Galaxy Tab A8":       { colors: ["فضي","رمادي","وردي ذهبي"], storages: ["32GB","64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Xiaomi": {
    "Xiaomi": {
      "Xiaomi 14 Ultra":  { colors: ["أبيض","أسود","تيتانيوم"], storages: ["256GB","512GB","1TB"] },
      "Xiaomi 14 Pro":    { colors: ["أسود","أبيض","أخضر","بنفسجي"], storages: ["256GB","512GB","1TB"] },
      "Xiaomi 14":        { colors: ["أسود","أبيض","أخضر","أزرق"], storages: ["256GB","512GB"] },
      "Xiaomi 14T Pro":   { colors: ["أسود ألباين","أبيض ألباين","سماوي"], storages: ["256GB","512GB","1TB"] },
      "Xiaomi 14T":       { colors: ["أسود ألباين","أبيض ألباين","سماوي"], storages: ["256GB","512GB"] },
      "Xiaomi 13 Pro":    { colors: ["أسود سيراميك","أبيض سيراميك","أخضر زيتوني"], storages: ["256GB","512GB"] },
      "Xiaomi 13":        { colors: ["أسود","أبيض","أخضر"], storages: ["128GB","256GB"] },
      "Xiaomi 12 Pro":    { colors: ["رمادي","أزرق","بنفسجي","أبيض"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Redmi": {
      "Redmi Note 14 Pro+": { colors: ["أسود","أخضر","بنفسجي"], storages: ["256GB","512GB"] },
      "Redmi Note 14 Pro":  { colors: ["أسود","أخضر","بنفسجي"], storages: ["128GB","256GB"] },
      "Redmi Note 14":      { colors: ["أسود","أخضر","أزرق"], storages: ["128GB","256GB"] },
      "Redmi Note 13 Pro+": { colors: ["أسود","أبيض","أخضر","بنفسجي"], storages: ["256GB","512GB"] },
      "Redmi Note 13 Pro":  { colors: ["أسود","أبيض","أخضر","بنفسجي"], storages: ["128GB","256GB","512GB"] },
      "Redmi Note 13":      { colors: ["أسود","أخضر","أزرق","وردي"], storages: ["128GB","256GB"] },
      "Redmi Note 12 Pro":  { colors: ["أبيض","أسود","أزرق"], storages: ["128GB","256GB"] },
      "Redmi Note 12":      { colors: ["أبيض","أسود","أزرق","وردي"], storages: ["64GB","128GB","256GB"] },
      "Redmi 13C":          { colors: ["أسود","أخضر","أزرق"], storages: ["64GB","128GB"] },
      "Redmi 12":           { colors: ["أسود","أزرق","ذهبي","فضي"], storages: ["64GB","128GB","256GB"] },
      "Redmi 10C":          { colors: ["أسود","رمادي","أزرق","وردي"], storages: ["32GB","64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "POCO": {
      "POCO F6 Pro":  { colors: ["أسود","أبيض","رمادي"], storages: ["256GB","512GB","1TB"] },
      "POCO X6 Pro":  { colors: ["أسود","أبيض","أصفر"], storages: ["256GB","512GB"] },
      "POCO X5 Pro":  { colors: ["أسود","أصفر","أزرق"], storages: ["128GB","256GB"] },
      "POCO M6 Pro":  { colors: ["أسود","أبيض","بنفسجي"], storages: ["128GB","256GB","512GB"] },
      "POCO M5":      { colors: ["أسود","أصفر","أخضر"], storages: ["64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Huawei": {
    "سلسلة P": {
      "Huawei P60 Pro": { colors: ["أسود","رمادي لؤلؤي","أبيض"], storages: ["128GB","256GB","512GB"] },
      "Huawei P50 Pro": { colors: ["أسود","ذهبي","أبيض","أخضر"], storages: ["128GB","256GB","512GB"] },
      "Huawei P40 Pro": { colors: ["أسود","فضي جليدي","أخضر أعماق","سماوي"], storages: ["128GB","256GB","512GB"] },
      "Huawei P40":     { colors: ["أسود","فضي جليدي","أزرق"], storages: ["128GB","256GB"] },
      "Huawei P30 Pro": { colors: ["أسود","أبيض","تدرج الفجر","تدرج المحيط","أصفر"], storages: ["128GB","256GB","512GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "سلسلة Mate": {
      "Huawei Mate 50 Pro": { colors: ["أسود","أبيض","برتقالي"], storages: ["256GB","512GB"] },
      "Huawei Mate 40 Pro": { colors: ["أسود","فضي","ذهبي"], storages: ["128GB","256GB","512GB"] },
      "Huawei Mate 30 Pro": { colors: ["رمادي فضائي","أسود","بنفسجي فضائي","أخضر زمردي"], storages: ["128GB","256GB","512GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "سلسلة Nova": {
      "Huawei Nova 11": { colors: ["أسود","أخضر","ذهبي"], storages: ["128GB","256GB"] },
      "Huawei Nova 9":  { colors: ["أسود","أبيض","أزرق"], storages: ["128GB","256GB"] },
      "Huawei Nova 7":  { colors: ["أسود","فضي","أزرق سماوي","وردي"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "MatePad": {
      "Huawei MatePad Pro 13.2\"": { colors: ["أسود","فضي"], storages: ["128GB","256GB","512GB"] },
      "Huawei MatePad 11\"":       { colors: ["أبيض","رمادي","أخضر"], storages: ["64GB","128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "OPPO": {
    "Reno": {
      "OPPO Reno 12 Pro": { colors: ["بني ناعم","أخضر ناعم","رمادي"], storages: ["256GB","512GB"] },
      "OPPO Reno 11":     { colors: ["أسود","أخضر","وردي"], storages: ["128GB","256GB"] },
      "OPPO Reno 10 Pro": { colors: ["أبيض لامع","رمادي","بنفسجي"], storages: ["256GB"] },
      "OPPO Reno 10":     { colors: ["أبيض لامع","رمادي","بنفسجي"], storages: ["128GB","256GB"] },
      "OPPO Reno 8":      { colors: ["أسود لامع","أخضر لامع","أبيض"], storages: ["128GB","256GB"] },
      "OPPO Reno 7":      { colors: ["أسود","أزرق","ذهبي","وردي"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Find X": {
      "OPPO Find X7 Pro": { colors: ["أسود","بني مرمري","أخضر فارسي"], storages: ["256GB","512GB","1TB"] },
      "OPPO Find X6 Pro": { colors: ["أسود","بني","أبيض"], storages: ["256GB","512GB"] },
      "OPPO Find X5 Pro": { colors: ["أسود","أبيض"], storages: ["256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "A Series": {
      "OPPO A98": { colors: ["أسود","ذهبي","أزرق"], storages: ["128GB","256GB"] },
      "OPPO A78": { colors: ["أسود","أخضر","وردي"], storages: ["128GB"] },
      "OPPO A58": { colors: ["أسود","أخضر"], storages: ["128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "OnePlus": {
    "الرئيسية": {
      "OnePlus 12":     { colors: ["أسود سيليكاي","أخضر زمردي"], storages: ["256GB","512GB"] },
      "OnePlus 12R":    { colors: ["أسود","أخضر"], storages: ["128GB","256GB"] },
      "OnePlus 11":     { colors: ["أخضر زمردي","أسود تيتانيوم"], storages: ["128GB","256GB"] },
      "OnePlus 10 Pro": { colors: ["أسود ألكانتارا","أسود فولكانو","أخضر إمرالد"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Nord": {
      "OnePlus Nord 4":    { colors: ["أسود","أخضر","فضي","برتقالي"], storages: ["128GB","256GB","512GB"] },
      "OnePlus Nord CE 4": { colors: ["أسود","فضي رمادي","أصفر"], storages: ["128GB","256GB"] },
      "OnePlus Nord 3":    { colors: ["أخضر دودج","رمادي تمبست"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "realme": {
    "GT": {
      "realme GT 6":     { colors: ["أسود","أبيض"], storages: ["256GB","512GB","1TB"] },
      "realme GT 5 Pro": { colors: ["أسود","أبيض","أزرق","برتقالي"], storages: ["256GB","512GB","1TB"] },
      "realme GT 2 Pro": { colors: ["أبيض ورقي","أسود ورقي","أزرق ستيل"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "C Series": {
      "realme C67": { colors: ["أسود","أخضر","أزرق"], storages: ["128GB","256GB"] },
      "realme C55": { colors: ["أسود","أخضر","أبيض"], storages: ["64GB","128GB","256GB"] },
      "realme C35": { colors: ["أسود","أبيض","أخضر"], storages: ["64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Vivo": {
    "X Series": {
      "Vivo X100 Pro": { colors: ["أسود","أبيض","برتقالي"], storages: ["256GB","512GB","1TB"] },
      "Vivo X90 Pro":  { colors: ["أسود","أحمر أنتيك","أبيض"], storages: ["256GB","512GB"] },
      "Vivo X80 Pro":  { colors: ["أسود","أبيض"], storages: ["256GB","512GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "V Series": {
      "Vivo V30 Pro": { colors: ["أسود","ذهبي","وردي"], storages: ["256GB","512GB"] },
      "Vivo V27":     { colors: ["أسود الكون","أخضر لمس الأمطار","وردي"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Y Series": {
      "Vivo Y38": { colors: ["أسود","أخضر","ذهبي"], storages: ["128GB","256GB"] },
      "Vivo Y36": { colors: ["أسود","أخضر","ذهبي"], storages: ["128GB"] },
      "Vivo Y35": { colors: ["أسود","ذهبي","أبيض"], storages: ["128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Honor": {
    "Magic": {
      "Honor Magic 6 Pro": { colors: ["أسود","أخضر","برتقالي"], storages: ["256GB","512GB","1TB"] },
      "Honor Magic 5 Pro": { colors: ["أسود","أخضر","أزرق سماوي"], storages: ["256GB","512GB"] },
      "Honor Magic 4 Pro": { colors: ["أسود","أخضر","ذهبي"], storages: ["256GB","512GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "الرئيسية": {
      "Honor 90 Pro": { colors: ["أسود","أخضر","وردي"], storages: ["256GB","512GB"] },
      "Honor 90":     { colors: ["أسود","أخضر","وردي","فضي"], storages: ["256GB","512GB"] },
      "Honor 70":     { colors: ["أسود","فضي","أخضر"], storages: ["128GB","256GB"] },
      "Honor X9a":    { colors: ["أسود","أخضر","فضي"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Tecno": {
    "CAMON": {
      "Tecno CAMON 30 Pro": { colors: ["أسود","أخضر","أبيض"], storages: ["256GB","512GB"] },
      "Tecno CAMON 20 Pro": { colors: ["أسود","أخضر","أبيض"], storages: ["256GB"] },
      "Tecno CAMON 19 Pro": { colors: ["أسود","أبيض","أخضر"], storages: ["256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "SPARK": {
      "Tecno SPARK 20 Pro": { colors: ["أسود","أبيض","أزرق"], storages: ["128GB","256GB"] },
      "Tecno SPARK 10 Pro": { colors: ["أسود","أبيض","أزرق"], storages: ["128GB","256GB"] },
      "Tecno SPARK 20":     { colors: ["أسود","أبيض","أزرق","أخضر"], storages: ["64GB","128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "Phantom": {
      "Tecno Phantom X2 Pro": { colors: ["مارتيان ستينهيم","ستيلث بلاك"], storages: ["256GB","512GB"] },
      "Tecno Phantom X2":     { colors: ["مارتيان ستينهيم","ستيلث بلاك"], storages: ["256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Infinix": {
    "NOTE": {
      "Infinix NOTE 40 Pro": { colors: ["أسود","أخضر","رمادي"], storages: ["256GB","512GB"] },
      "Infinix NOTE 30":     { colors: ["أسود","أخضر","رمادي","أبيض"], storages: ["128GB","256GB"] },
      "Infinix NOTE 12":     { colors: ["أسود","أزرق","أبيض"], storages: ["128GB","256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "HOT": {
      "Infinix HOT 40 Pro": { colors: ["أسود","أبيض","أخضر","أحمر"], storages: ["128GB","256GB"] },
      "Infinix HOT 30":     { colors: ["أسود","أبيض","أخضر","برتقالي"], storages: ["64GB","128GB","256GB"] },
      "Infinix HOT 20":     { colors: ["أسود","أبيض","أخضر","ذهبي"], storages: ["64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
    "ZERO": {
      "Infinix ZERO 30 5G": { colors: ["أسود","أخضر","ذهبي"], storages: ["256GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
  "Nokia": {
    "الرئيسية": {
      "Nokia G42":  { colors: ["بنفسجي مطفي","رمادي","أخضر"], storages: ["128GB","256GB"] },
      "Nokia X30":  { colors: ["أزرق جليدي","رمادي أنثراسايت"], storages: ["128GB","256GB"] },
      "Nokia G21":  { colors: ["أزرق نورديك","رمادي نورديك"], storages: ["64GB","128GB"] },
      "Nokia C32":  { colors: ["أسود","أخضر","أبيض"], storages: ["64GB","128GB"] },
      [OTHER]: { colors: [], storages: [] },
    },
  },
};

const BRANDS = [...Object.keys(CATALOG), OTHER];
const DEFAULT_STORAGES = ["16GB","32GB","64GB","128GB","256GB","512GB","1TB"];
const DEFAULT_COLORS   = ["أسود","أبيض","فضي","رمادي","ذهبي","أزرق","أحمر","أخضر","بنفسجي","وردي","بيج","برتقالي","أصفر"];

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
   ADD DEVICE MODAL  — 4-level cascade: Brand → Category → Model → Color/Storage
════════════════════════════════════════════════════════ */
function AddDeviceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();

  /* ── 4 cascade selectors ── */
  const [brandSel,    setBrandSel]    = useState("");
  const [catSel,      setCatSel]      = useState("");
  const [modelSel,    setModelSel]    = useState("");
  const [colorSel,    setColorSel]    = useState("");
  const [brandCustom,   setBrandCustom]   = useState("");
  const [modelCustom,   setModelCustom]   = useState("");
  const [colorCustom,   setColorCustom]   = useState("");
  const [storageCustom, setStorageCustom] = useState("");
  const [storageModeOther, setStorageModeOther] = useState(false);

  const isOtherBrand   = brandSel === OTHER;
  const isOtherModel   = modelSel === OTHER;
  const isOtherColor   = colorSel === OTHER;
  const isOtherStorage = storageModeOther;

  /* derived data from catalog */
  const categories   = brandSel && !isOtherBrand ? Object.keys(CATALOG[brandSel] ?? {}) : [];
  const modelSpecs   = catSel && !isOtherBrand   ? CATALOG[brandSel]?.[catSel] ?? {}    : {};
  const modelNames   = Object.keys(modelSpecs);
  const currentSpec: ModelSpec | null = (modelSel && !isOtherModel) ? modelSpecs[modelSel] ?? null : null;
  const availColors  = currentSpec && currentSpec.colors.length ? [...currentSpec.colors, OTHER] : [...DEFAULT_COLORS, OTHER];
  const availStorages= currentSpec && currentSpec.storages.length ? [...currentSpec.storages, OTHER] : [...DEFAULT_STORAGES, OTHER];

  /* effective values to store */
  const effectiveBrand = isOtherBrand ? brandCustom : brandSel;
  const effectiveModel = isOtherModel ? modelCustom : modelSel;
  const effectiveColor = isOtherColor ? colorCustom : colorSel;

  const [form, setForm] = useState({
    storage: "128GB",
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

  /* cascade resets */
  const resetStorageOther = () => { setStorageModeOther(false); setStorageCustom(""); };
  const handleBrandChange = (v: string) => {
    setBrandSel(v); setCatSel(""); setModelSel(""); setColorSel("");
    setColorCustom(""); setBrandCustom(""); setModelCustom(""); resetStorageOther();
    setForm(p => ({ ...p, storage: "" }));
  };
  const handleCatChange = (v: string) => {
    setCatSel(v); setModelSel(""); setColorSel("");
    setColorCustom(""); setModelCustom(""); resetStorageOther();
    setForm(p => ({ ...p, storage: "" }));
  };
  const handleModelChange = (v: string) => {
    setModelSel(v);
    setColorSel(""); setColorCustom(""); setModelCustom(""); resetStorageOther();
    const spec = catSel && brandSel ? CATALOG[brandSel]?.[catSel]?.[v] : undefined;
    const defaultStorage = spec && spec.storages.length ? spec.storages[0] : "128GB";
    setForm(p => ({ ...p, storage: defaultStorage }));
    if (spec && spec.colors.length === 1) setColorSel(spec.colors[0]);
  };
  const handleStorageChange = (v: string) => {
    if (v === OTHER) { setStorageModeOther(true); setStorageCustom(""); }
    else { setStorageModeOther(false); setStorageCustom(""); setForm(p => ({ ...p, storage: v })); }
  };

  const handleSave = async () => {
    if (!effectiveBrand.trim() || !effectiveModel.trim()) {
      toast({ title: "اختر الشركة المصنعة والموديل على الأقل", variant: "destructive" }); return;
    }
    if (!form.purchase_price) {
      toast({ title: "أدخل سعر الشراء", variant: "destructive" }); return;
    }
    const finalStorage = storageCustom.trim() || form.storage;
    setSaving(true);
    try {
      await apPost("/api/devices", {
        ...form,
        storage: finalStorage,
        brand: effectiveBrand,
        model: effectiveModel,
        color: effectiveColor || undefined,
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

  const inputCls  = "erp-input w-full text-sm";
  const labelCls  = "text-[11px] text-white/40 mb-1 block text-right";
  const selectCls = "erp-input w-full text-sm";
  const disabledSelectCls = `${selectCls} opacity-40 cursor-not-allowed`;

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

          {/* ── Row 1: Brand + Category ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>الشركة المصنعة *</label>
              <select value={brandSel} onChange={e => handleBrandChange(e.target.value)} className={selectCls}>
                <option value="">— اختر الشركة —</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {isOtherBrand && (
                <input value={brandCustom} onChange={e => setBrandCustom(e.target.value)}
                  placeholder="اسم الشركة المصنعة" className={`${inputCls} mt-1.5`} />
              )}
            </div>
            <div>
              <label className={labelCls}>فئة المنتج *</label>
              {isOtherBrand ? (
                <input placeholder="مثال: iPhone" className={inputCls}
                  onChange={e => setCatSel(e.target.value)} value={catSel} />
              ) : (
                <select value={catSel} onChange={e => handleCatChange(e.target.value)}
                  className={brandSel ? selectCls : disabledSelectCls} disabled={!brandSel}>
                  <option value="">— اختر الفئة —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* ── Row 2: Model ── */}
          <div>
            <label className={labelCls}>الموديل *</label>
            {isOtherBrand || (catSel && modelNames.length === 0) ? (
              <input value={modelCustom} onChange={e => setModelCustom(e.target.value)}
                placeholder="اكتب الموديل مباشرة" className={inputCls} />
            ) : (
              <>
                <select value={modelSel} onChange={e => handleModelChange(e.target.value)}
                  className={catSel ? selectCls : disabledSelectCls} disabled={!catSel}>
                  <option value="">— اختر الموديل —</option>
                  {modelNames.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {isOtherModel && (
                  <input value={modelCustom} onChange={e => setModelCustom(e.target.value)}
                    placeholder="اكتب الموديل" className={`${inputCls} mt-1.5`} />
                )}
              </>
            )}
          </div>

          {/* ── Row 3: Color + Storage + Grade ── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>اللون</label>
              <select value={colorSel} onChange={e => setColorSel(e.target.value)}
                className={(modelSel || isOtherBrand) ? selectCls : disabledSelectCls}
                disabled={!modelSel && !isOtherBrand}>
                <option value="">— اللون —</option>
                {availColors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {isOtherColor && (
                <input value={colorCustom} onChange={e => setColorCustom(e.target.value)}
                  placeholder="اكتب اللون" className={`${inputCls} mt-1.5`} />
              )}
            </div>
            <div>
              <label className={labelCls}>السعة / الحجم</label>
              <select value={isOtherStorage ? OTHER : form.storage}
                onChange={e => handleStorageChange(e.target.value)}
                className={(modelSel || isOtherBrand) ? selectCls : disabledSelectCls}
                disabled={!modelSel && !isOtherBrand}>
                <option value="">— السعة —</option>
                {availStorages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {isOtherStorage && (
                <input value={storageCustom} onChange={e => setStorageCustom(e.target.value)}
                  placeholder="مثال: 256GB" className={`${inputCls} mt-1.5`} />
              )}
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
   RETURN DEVICE MODAL
════════════════════════════════════════════════════════ */
const RETURN_REASONS = [
  "عيب مصنعي",
  "الجهاز لا يعمل بشكل صحيح",
  "لم يعجب العميل",
  "وجد جهاز آخر",
  "تغيير رأي العميل",
  "الجهاز تالف",
  "خلاف على السعر",
  "أخرى",
];

function ReturnModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReturn = async () => {
    setSaving(true);
    try {
      await apPost(`/api/devices/${device.id}/return`, {
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

/* ════════════════════════════════════════════════════════
   DEVICE DETAIL PANEL
════════════════════════════════════════════════════════ */
function DeviceDetail({ device, onClose, onRefresh }: { device: Device; onClose: () => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showSell, setShowSell] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
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
                {device.status === "sold" && (
                  <>
                    <button onClick={() => printSaleReceipt(device)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm font-bold hover:bg-violet-500/25 transition-all">
                      <Printer className="w-3.5 h-3.5" /> طباعة الفاتورة
                    </button>
                    <button onClick={() => setShowReturn(true)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-500/20 transition-all">
                      <RotateCcw className="w-3.5 h-3.5" />
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
      {showReturn && (
        <ReturnModal device={device} onClose={() => setShowReturn(false)} onDone={() => { onRefresh(); onClose(); }} />
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
          <p className="text-[10px] text-white/20 mt-0.5">
            هامش متوقع على الأجهزة المتاحة
          </p>
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
                  {/* Prices + Profit */}
                  <td className="px-3 py-3">
                    <p className="text-white/80 font-semibold">
                      {parseFloat(d.status === "sold" && d.sold_price ? d.sold_price : d.sale_price).toLocaleString()}
                      <span className="text-[10px] text-white/25 mr-0.5">ج.م</span>
                    </p>
                    <p className="text-[11px] text-white/25">شراء: {parseFloat(d.purchase_price).toLocaleString()}</p>
                    {(() => {
                      const sellP = parseFloat(d.status === "sold" && d.sold_price ? d.sold_price : d.sale_price);
                      const buyP  = parseFloat(d.purchase_price);
                      const profit = sellP - buyP;
                      const pct = buyP > 0 ? Math.round((profit / buyP) * 100) : 0;
                      return (
                        <span className={`text-[10px] font-bold ${profit >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                          {profit >= 0 ? "+" : ""}{profit.toLocaleString()} ج.م ({pct}%)
                        </span>
                      );
                    })()}
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
