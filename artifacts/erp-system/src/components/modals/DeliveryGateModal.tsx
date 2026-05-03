/**
 * DeliveryGateModal — بوّابة "جاهز للتسليم" → "التسليم"
 *
 * تجمع في صفحة واحدة:
 *  1) محاسبة العميل: قطع الغيار + طريقة الدفع + الوسيط
 *  2) الفاتورة النهائية: عرض مدمج + حقل الشحن + الخصم + طباعة + واتساب
 *
 * عند التأكيد:
 *   ① POST /pre-delivery  → يُسجّل pre_delivery_reviewed_at + القطع + الدفع
 *   ② POST /shipping      → يُسجّل shipping_settled_at + تكلفة الشحن + الخصم
 *   ③ onSaved()           → applyGatedTransition("delivered")
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  PackageCheck, Loader2, X, AlertTriangle,
  Coins, Clock, Plus, Trash2, UserCog,
  FileText, Printer, MessageCircle, CheckCircle2, Truck, Save, Wrench,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/safe-data";
import { useAuth } from "@/contexts/auth";

/* ══════════════════════════════════════════════
   أنواع البيانات
══════════════════════════════════════════════ */
interface Product {
  id: number;
  name: string;
  quantity: string | number;
  sell_price: string | number;
  warehouse_id?: number | null;
}
interface Warehouse { id: number; name: string; }
type PayType = "cash" | "credit";
interface PayRow { id: string; type: PayType; safe_id: number | null; amount: number; }
type DiscMode = 'amt' | 'pct';
type PartSource = 'internal' | 'external';
interface PartLine {
  id: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;          /* السعر الأصلي قبل الخصم */
  warehouse_id: number | null;
  discount_value: number;      /* قيمة الخصم (نسبة أو رقم) */
  discount_mode: DiscMode;     /* 'pct' = نسبة، 'amt' = مبلغ ثابت على السطر */
  source: PartSource;          /* 'internal' = من المخزن، 'external' = إصلاح خارجي */
  external_vendor?: string;    /* اسم الورشة الخارجية (للعرض فقط) */
}

/* احسب مبلغ الخصم على السطر الواحد */
function lineDiscountAmount(l: Pick<PartLine, "quantity" | "unit_price" | "discount_value" | "discount_mode">): number {
  const gross = l.quantity * l.unit_price;
  if (l.discount_value <= 0 || gross <= 0) return 0;
  const raw = l.discount_mode === 'pct'
    ? (gross * Math.min(l.discount_value, 100)) / 100
    : Math.min(l.discount_value, gross);
  return Math.max(0, raw);
}
function lineNet(l: Pick<PartLine, "quantity" | "unit_price" | "discount_value" | "discount_mode">): number {
  return Math.max(0, l.quantity * l.unit_price - lineDiscountAmount(l));
}
interface ReceiptBase {
  job_no:              string;
  customer_name:       string | null;
  customer_phone:      string | null;
  device_brand:        string | null;
  device_model:        string | null;
  imei:                string | null;
  received_at:         string | null;
  problem_description: string | null;
  technician_name:     string | null;
  final_cost:          number;
  deposit_paid:        number;
  shipping_cost:       number;
  final_discount:      number;
}
interface SafeRow { id: number; name: string; balance: string | number; }

interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  customer_name?: string | null;
  final_cost?: string | number | null;
  broker_name?: string | null;
  broker_commission?: string | number | null;
}
interface Props {
  job:      JobLite;
  onClose:  () => void;
  onSaved:  () => void;
}

const fmtCurrency = (n: number) => formatCurrency(n);
const fmt = (n: number) => formatNumber(Number(n ?? 0));

/* ══════════════════════════════════════════════
   المكوّن الرئيسي
══════════════════════════════════════════════ */
export default function DeliveryGateModal({ job, onClose, onSaved }: Props) {
  const { user }  = useAuth();
  const { toast } = useToast();

  /* ── Safes ── */
  const { data: safesRaw } = useGetSettingsSafes();
  const allSafes: SafeRow[] = safeArray(safesRaw) as SafeRow[];
  const isScopedRole = user?.role === "cashier" || user?.role === "salesperson";
  const safes = isScopedRole && user?.safe_id
    ? allSafes.filter(s => s.id === user.safe_id)
    : allSafes;

  /* ── بيانات الفاتورة الأساسية ── */
  const [receiptData, setReceiptData] = useState<ReceiptBase | null>(null);
  const [fetchErr, setFetchErr]       = useState("");
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch(api(`/api/repair-jobs/${job.id}/receipt-data`))
      .then(async r => {
        if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "تعذّر تحميل البيانات");
        return r.json() as Promise<ReceiptBase>;
      })
      .then(d => {
        if (!cancelled) {
          setReceiptData(d);
          setFetchLoading(false);
          if (d.final_discount > 0) setDiscount(String(d.final_discount));
        }
      })
      .catch(e => {
        if (!cancelled) { setFetchErr(e instanceof Error ? e.message : "خطأ"); setFetchLoading(false); }
      });
    return () => { cancelled = true; };
  }, [job.id]);

  /* ── المخازن ── */
  const { data: warehousesRaw } = useQuery<Warehouse[]>({
    queryKey: ["/api/settings/warehouses"],
    queryFn:  () => authFetch(api("/api/settings/warehouses")).then(r => r.json()),
  });
  const warehouses: Warehouse[] = safeArray(warehousesRaw) as Warehouse[];
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  useEffect(() => {
    if (warehouses.length === 1 && !selectedWarehouseId) setSelectedWarehouseId(warehouses[0].id);
  }, [warehouses.length, selectedWarehouseId]);

  /* ── المنتجات ── */
  const { data: productsRaw } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedWarehouseId],
    queryFn:  () => {
      const url = selectedWarehouseId
        ? api(`/api/products?warehouse_id=${selectedWarehouseId}`)
        : api("/api/products");
      return authFetch(url).then(r => r.json());
    },
  });
  const products: Product[] = safeArray(productsRaw) as Product[];

  /* ── مفتاح المسوّدة المحلية لكل بطاقة ── */
  const draftKey = `delivery-gate-draft:${job.id}`;
  const [draftRestored, setDraftRestored] = useState(false);

  /* ── القطع ── */
  const [partLines, setPartLines]           = useState<PartLine[]>([]);
  const [productSearch, setProductSearch]   = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [addQty, setAddQty]                 = useState("1");
  const [addPrice, setAddPrice]             = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 30);
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productSearch]);

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setAddPrice(String(Number(p.sell_price) || ""));
    setShowProductDrop(false);
  }

  function addPartLine() {
    if (!selectedProduct) return;
    const qty   = Math.max(1, parseInt(addQty) || 1);
    const price = parseFloat(addPrice) || 0;
    setPartLines(prev => [...prev, {
      id:             `${Date.now()}-${Math.random()}`,
      product_id:     selectedProduct.id,
      product_name:   selectedProduct.name,
      quantity:       qty,
      unit_price:     price,
      warehouse_id:   selectedWarehouseId,
      discount_value: 0,
      discount_mode:  'pct',
      source:         'internal',
    }]);
    setSelectedProduct(null);
    setProductSearch("");
    setAddQty("1");
    setAddPrice("");
    productSearchRef.current?.focus();
  }

  /* ── إصلاح خارجي ── */
  const [showExtForm, setShowExtForm]   = useState(false);
  const [extVendor, setExtVendor]       = useState("");
  const [extDesc, setExtDesc]           = useState("");
  const [extPrice, setExtPrice]         = useState("");

  function addExternalLine() {
    const desc  = extDesc.trim();
    const price = parseFloat(extPrice) || 0;
    if (!desc) { toast({ title: "اكتب وصف الإصلاح الخارجي", variant: "destructive" }); return; }
    if (price <= 0) { toast({ title: "اكتب التكلفة على العميل", variant: "destructive" }); return; }
    const vendor = extVendor.trim();
    setPartLines(prev => [...prev, {
      id:             `${Date.now()}-${Math.random()}`,
      product_id:     null,
      product_name:   vendor ? `${desc} — ورشة: ${vendor}` : desc,
      quantity:       1,
      unit_price:     price,
      warehouse_id:   null,
      discount_value: 0,
      discount_mode:  'pct',
      source:         'external',
      external_vendor: vendor || undefined,
    }]);
    setExtVendor(""); setExtDesc(""); setExtPrice("");
    setShowExtForm(false);
  }

  /* تعديل خصم سطر بعد إضافته */
  function updateLineDiscount(id: string, value: number, mode: DiscMode) {
    setPartLines(prev => prev.map(l => l.id === id ? { ...l, discount_value: Math.max(0, value), discount_mode: mode } : l));
  }

  const partsDiscSum = partLines.reduce((s, l) => s + lineDiscountAmount(l), 0);
  const partsTotal   = partLines.reduce((s, l) => s + lineNet(l), 0);

  /* ── الدفع ── */
  const [payRows, setPayRows]   = useState<PayRow[]>([]);
  const [payType, setPayType]   = useState<PayType>("cash");
  const [paySafe, setPaySafe]   = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const paidSoFar = payRows.reduce((s, r) => s + r.amount, 0);

  function addPayRow() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    if (payType === "cash" && !paySafe && safes.length > 0) {
      toast({ title: "اختر خزنة لإضافة الدفعة النقدية", variant: "destructive" });
      return;
    }
    setPayRows(prev => [...prev, {
      id:      `${Date.now()}-${Math.random()}`,
      type:    payType,
      safe_id: payType === "cash" ? paySafe : null,
      amount:  amt,
    }]);
    setPayAmount("");
  }

  function fillAll() {
    if (remaining <= 0) return;
    setPayAmount(remaining.toFixed(2));
  }

  /* ── الوسيط ── */
  const [brokerName, setBrokerName] = useState(job.broker_name ?? "");
  const [brokerComm, setBrokerComm] = useState(String(Number(job.broker_commission) || ""));

  /* ── الشحن والخصم ── */
  const [cost,     setCost]     = useState("0");
  const [safeId,   setSafeId]   = useState<string>("");
  const [discount, setDiscount] = useState("0");

  useEffect(() => {
    if (safes.length === 1 && !safeId) setSafeId(String(safes[0].id));
  }, [safes.length]);

  /* ── استعادة المسوّدة المحلية عند فتح المودال ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        partLines?: PartLine[]; payRows?: PayRow[];
        brokerName?: string; brokerComm?: string;
        cost?: string; safeId?: string; discount?: string;
        selectedWarehouseId?: number | null;
      };
      if (Array.isArray(d.partLines))         setPartLines(d.partLines);
      if (Array.isArray(d.payRows))           setPayRows(d.payRows);
      if (typeof d.brokerName === "string")   setBrokerName(d.brokerName);
      if (typeof d.brokerComm === "string")   setBrokerComm(d.brokerComm);
      if (typeof d.cost === "string")         setCost(d.cost);
      if (typeof d.safeId === "string")       setSafeId(d.safeId);
      if (typeof d.discount === "string")     setDiscount(d.discount);
      if (d.selectedWarehouseId != null)      setSelectedWarehouseId(d.selectedWarehouseId);
      setDraftRestored(true);
    } catch { /* تجاهل أي خلل في القراءة */ }

  }, [draftKey]);

  const numericCost = Number(cost) || 0;
  const numericDisc = Number(discount) || 0;
  const needsSafe   = numericCost > 0;

  /* حسابات الفاتورة المحدَّثة
     تكلفة الإصلاح (final_cost) لا تُحتسَب في محاسبة العميل —
     يُحاسَب العميل على قطع الغيار + الشحن − الخصم فقط. */
  const sc   = Math.max(numericCost, 0);
  const disc = Math.max(numericDisc, 0);
  const dep  = receiptData?.deposit_paid ?? 0;
  const sub  = partsTotal + sc;
  const total       = Math.max(sub - disc, 0);
  const totalRem    = Math.max(total - dep, 0);

  /* الإجمالي المستحق على العميل (المرجع لإقفال طريقة الدفع) =
     قطع الغيار + الشحن − الخصم − المدفوع مقدماً. */
  const grandTotal = totalRem;
  const remaining  = Math.max(grandTotal - paidSoFar, 0);
  const payIsDone  = grandTotal > 0 && paidSoFar >= grandTotal;

  /* ── الأخطاء والحفظ ── */
  const [errors,  setErrors]  = useState<string[]>([]);
  const [saving,  setSaving]  = useState(false);

  /* ── طباعة ── */
  function handlePrint() {
    if (!receiptData) return;
    const esc = (v: unknown): string =>
      String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const deviceLine = [receiptData.device_brand, receiptData.device_model].filter(Boolean).map(esc).join(" ") || "—";
    const html = `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>فاتورة تسليم ${esc(receiptData.job_no)}</title>
<style>
  body{font-family:'Tahoma','Segoe UI',sans-serif;padding:8px;font-size:11px;color:#000;max-width:80mm;margin:0 auto;}
  h1{text-align:center;font-size:13px;margin:6px 0;border-bottom:1px dashed #000;padding-bottom:4px;}
  .row{display:flex;justify-content:space-between;margin:2px 0;}
  .label{color:#555;}
  table{width:100%;border-collapse:collapse;margin:6px 0;}
  th,td{padding:3px 4px;border-bottom:1px dotted #999;text-align:right;font-size:10px;}
  .totals{margin-top:6px;padding-top:4px;border-top:1px dashed #000;}
  .grand{font-weight:bold;font-size:12px;}
  .discount{color:#c00;}
  .footer{text-align:center;margin-top:8px;color:#666;font-size:10px;border-top:1px dashed #000;padding-top:4px;}
  @media print{@page{size:80mm auto;margin:4mm;}body{padding:0;}}
</style></head><body>
<h1>فاتورة تسليم بطاقة صيانة</h1>
<div class="row"><span class="label">رقم البطاقة:</span><strong>${esc(receiptData.job_no)}</strong></div>
<div class="row"><span class="label">العميل:</span><span>${esc(receiptData.customer_name ?? "—")}</span></div>
<div class="row"><span class="label">الهاتف:</span><span>${esc(receiptData.customer_phone ?? "—")}</span></div>
<div class="row"><span class="label">الجهاز:</span><span>${deviceLine}</span></div>
${receiptData.imei ? `<div class="row"><span class="label">IMEI:</span><span>${esc(receiptData.imei)}</span></div>` : ""}
${receiptData.received_at ? `<div class="row"><span class="label">تاريخ الاستلام:</span><span>${esc(receiptData.received_at)}</span></div>` : ""}
<div class="row"><span class="label">تاريخ التسليم:</span><span>${new Date().toLocaleDateString("ar-EG")}</span></div>
${receiptData.technician_name ? `<div class="row"><span class="label">الفني:</span><span>${esc(receiptData.technician_name)}</span></div>` : ""}
${receiptData.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(receiptData.problem_description)}</div>` : ""}
${partLines.length > 0 ? `
<table>
  <thead><tr><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الإجمالي</th></tr></thead>
  <tbody>${partLines.map(p => {
    const d = lineDiscountAmount(p);
    const discCell = d > 0
      ? (p.discount_mode === 'pct' ? `${p.discount_value}% (-${fmt(d)})` : `- ${fmt(d)}`)
      : "—";
    return `<tr><td>${esc(p.product_name)}</td><td>${p.quantity}</td><td>${fmt(p.unit_price)}</td><td>${discCell}</td><td>${fmt(lineNet(p))}</td></tr>`;
  }).join("")}</tbody>
</table>` : ""}
<div class="totals">
  ${partsTotal > 0 ? `<div class="row"><span class="label">قطع الغيار:</span><span>${fmt(partsTotal)}</span></div>` : ""}
  ${sc > 0 ? `<div class="row"><span class="label">الشحن:</span><span>${fmt(sc)}</span></div>` : ""}
  ${disc > 0 ? `<div class="row discount"><span>خصم:</span><span>- ${fmt(disc)}</span></div>` : ""}
  <div class="row grand"><span>الإجمالي:</span><span>${fmt(total)}</span></div>
  <div class="row"><span class="label">المدفوع مقدماً:</span><span>${fmt(dep)}</span></div>
  <div class="row grand"><span>المتبقي:</span><span>${fmt(totalRem)}</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — مع تحيات إدارة الصيانة</div>
<script>window.addEventListener('load',()=>{window.print();setTimeout(()=>window.close(),1000);});</script>
</body></html>`;
    const w = window.open("","_blank","width=400,height=700");
    if (!w) { toast({ title: "تعذّر فتح نافذة الطباعة", description: "تأكد من السماح بالنوافذ المنبثقة", variant: "destructive" }); return; }
    w.document.write(html);
    w.document.close();
    toast({ title: "جارٍ تجهيز الطباعة..." });
  }

  /* ── واتساب ── */
  function handleWhatsapp() {
    if (!receiptData?.customer_phone) { toast({ title: "لا يوجد رقم هاتف للعميل", variant: "destructive" }); return; }
    /* تفاصيل القطع مع خصم كل صنف */
    const partsBlock: string[] = [];
    if (partLines.length > 0) {
      partsBlock.push(`*قطع الغيار:*`);
      for (const p of partLines) {
        const d = lineDiscountAmount(p);
        const base = `• ${p.product_name} — ${p.quantity} × ${fmt(p.unit_price)}`;
        if (d > 0) {
          const discTxt = p.discount_mode === 'pct'
            ? `خصم ${p.discount_value}% (- ${fmt(d)})`
            : `خصم - ${fmt(d)}`;
          partsBlock.push(`${base} | ${discTxt} = ${fmt(lineNet(p))}`);
        } else {
          partsBlock.push(`${base} = ${fmt(lineNet(p))}`);
        }
      }
      if (partsDiscSum > 0) partsBlock.push(`إجمالي خصم القطع: - ${fmt(partsDiscSum)}`);
      partsBlock.push(``);
    }

    const lines = [
      `*فاتورة تسليم بطاقة صيانة*`,
      `رقم البطاقة: ${receiptData.job_no}`,
      `العميل: ${receiptData.customer_name ?? "—"}`,
      `الجهاز: ${[receiptData.device_brand, receiptData.device_model].filter(Boolean).join(" ") || "—"}`,
      receiptData.problem_description ? `المشكلة: ${receiptData.problem_description}` : "",
      ``,
      ...partsBlock,
      partsTotal > 0 ? `إجمالي صافي القطع: ${fmt(partsTotal)}` : "",
      sc > 0 ? `الشحن: ${fmt(sc)}` : "",
      disc > 0 ? `خصم إضافي: - ${fmt(disc)}` : "",
      `الإجمالي: ${fmt(total)}`,
      `المدفوع مقدماً: ${fmt(dep)}`,
      `*المتبقي: ${fmt(totalRem)} ج.م*`,
      ``,
      `شكراً لتعاملكم معنا 🙏`,
    ].filter(Boolean).join("\n");
    const cleanPhone = String(receiptData.customer_phone).replace(/[^\d]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`, "_blank", "noopener,noreferrer");
    toast({ title: "تم فتح واتساب" });
  }

  /* بناء جسم طلب pre-delivery (حفظ بيانات المحاسبة) */
  function buildPreDeliveryBody() {
    const cashTotal   = payRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0);
    const primarySafe = payRows.find(r => r.type === "cash")?.safe_id ?? paySafe ?? null;
    const pt          = grandTotal > 0 ? (paidSoFar >= grandTotal ? "cash" : paidSoFar > 0 ? "partial" : "credit") : "cash";
    return {
      broker_name:       brokerName.trim() || null,
      broker_commission: Number(brokerComm) || 0,
      /* عند الإرسال نمرر unit_price = صافي السطر / الكمية (بدقة كاملة)
         بحيث يحتسب الخادم إجمالي القطعة بعد خصم السطر دون الحاجة لتغيير
         المخطط، ودون أي انحراف بسبب التقريب. عمود numeric في PostgreSQL
         يستوعب الكسور العشرية كاملةً. */
      parts: partLines.map(l => {
        const netUnit = l.quantity > 0 ? lineNet(l) / l.quantity : 0;
        return {
          product_id:   l.product_id,
          product_name: l.product_name,
          quantity:     l.quantity,
          unit_price:   netUnit,
          warehouse_id: l.warehouse_id,
          source:       l.source,
        };
      }),
      payment: {
        payment_type: pt,
        paid_amount:  cashTotal,
        safe_id:      primarySafe,
        payments:     payRows.map(r => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })),
      },
    };
  }

  /* ── حفظ مسوّدة الفاتورة محلياً (بدون أي اتصال بالخادم وبدون انتقال للتسليم) ──
     الفكرة: زرار «حفظ» يخزّن الحالة الحالية للنموذج (قطع/خصومات/دفعات/شحن…)
     في localStorage لكي تستعيدها الواجهة عند فتح المودال مرة أخرى لنفس البطاقة.
     هذا يضمن:
       • عدم تكرار إدخال القطع أو الدفعات في قاعدة البيانات.
       • عدم انتقال البطاقة لحالة "جاهز للتسليم" قبل أن يأتي العميل فعلاً.
       • تكلفة الشحن تظل اختيارية تماماً عند الحفظ. */
  function handleSave() {
    setErrors([]);
    try {
      const draft = {
        v: 1,
        savedAt: new Date().toISOString(),
        partLines,
        payRows,
        brokerName,
        brokerComm,
        cost,
        safeId,
        discount,
        selectedWarehouseId,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      toast({ title: "✓ تم حفظ بيانات الفاتورة", description: "البيانات محفوظة محلياً. عند مجيء العميل افتح البطاقة واضغط «تأكيد التسليم»" });
    } catch {
      toast({ title: "تعذّر حفظ البيانات محلياً", variant: "destructive" });
    }
  }

  /* ── تأكيد التسليم النهائي (يُستخدَم لمّا يجي العميل يستلم) ── */
  async function handleConfirm() {
    const errs: string[] = [];
    if (!Number.isFinite(numericCost) || numericCost < 0) errs.push("تكلفة الشحن غير صحيحة");
    if (!Number.isFinite(numericDisc) || numericDisc < 0)  errs.push("قيمة الخصم غير صحيحة");
    if (numericCost > 0 && !safeId) errs.push("يجب اختيار خزنة لخصم تكلفة الشحن");
    if (errs.length) { setErrors(errs); return; }

    setSaving(true); setErrors([]);

    try {
      /* ① سجّل المحاسبة (pre-delivery) */
      const r1 = await authFetch(api(`/api/repair-jobs/${job.id}/pre-delivery`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(buildPreDeliveryBody()),
      });
      const d1 = await r1.json().catch(() => ({})) as { error?: string };
      if (!r1.ok) { setErrors([d1.error ?? "تعذّر حفظ بيانات المحاسبة"]); setSaving(false); return; }

      /* ② سجّل الشحن (shipping) */
      const r2 = await authFetch(api(`/api/repair-jobs/${job.id}/shipping`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          shipping_cost:  numericCost,
          safe_id:        numericCost > 0 ? Number(safeId) : null,
          final_discount: numericDisc,
          notes:          `تسليم بطاقة صيانة ${job.job_no}`,
        }),
      });
      const d2 = await r2.json().catch(() => ({})) as { error?: string };
      if (!r2.ok) { setErrors([d2.error ?? "تعذّر تسجيل بيانات الشحن"]); setSaving(false); return; }

      /* امسح المسوّدة المحلية بعد نجاح التسليم */
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }

      toast({ title: "✓ تم التسليم", description: "تمّت محاسبة العميل وتسجيل التسليم بنجاح" });
      onSaved();
    } catch {
      setErrors(["تعذّر الاتصال بالخادم"]);
      setSaving(false);
    }
  }

  /* ══════════════════════════════════════════════
     الـ UI
  ══════════════════════════════════════════════ */
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="my-4 rounded-2xl border border-white/10 w-full max-w-5xl shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(132,204,22,0.15)", border: "1px solid rgba(163,230,53,0.3)" }}
            >
              <PackageCheck className="w-4.5 h-4.5 text-lime-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">محاسبة العميل والفاتورة النهائية</h3>
              <p className="text-[11px] text-white/50">
                البطاقة <span className="text-white font-bold">{job.job_no}</span>
                {job.customer_name && <> · {job.customer_name}</>}
                {job.device_brand && <> · {job.device_brand} {job.device_model ?? ""}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* تنبيه استعادة المسوّدة */}
        {draftRestored && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl flex items-center justify-between gap-2"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}
          >
            <span className="text-[11px] text-blue-200">
              تم استعادة بيانات فاتورة محفوظة محلياً لهذه البطاقة. اضغط «حفظ» للتحديث أو «تأكيد التسليم» لإتمام العملية.
            </span>
            <button type="button"
              onClick={() => {
                try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
                setPartLines([]); setPayRows([]);
                setBrokerName(job.broker_name ?? "");
                setBrokerComm(String(Number(job.broker_commission) || ""));
                setCost("0"); setDiscount("0");
                setDraftRestored(false);
                toast({ title: "تم حذف المسوّدة" });
              }}
              className="shrink-0 text-[10px] text-red-300 hover:text-red-200 underline"
            >
              حذف المسوّدة
            </button>
          </div>
        )}

        {/* ── Body ── */}
        {fetchLoading && (
          <div className="flex items-center justify-center gap-2 text-white/60 text-xs py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل بيانات الفاتورة...
          </div>
        )}
        {fetchErr && (
          <div className="m-5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300">{fetchErr}</p>
          </div>
        )}

        {!fetchLoading && !fetchErr && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-white/5">

            {/* ════════ عمود اليمين: المحاسبة ════════ */}
            <div className="overflow-y-auto max-h-[65vh]">

              {/* قطع الغيار */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-[9px] text-blue-300 font-black">١</span>
                  القطع المستخدمة من المخزن (اختياري)
                </h4>

                {warehouses.length > 1 && (
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">المخزن</label>
                    <select
                      value={selectedWarehouseId ?? ""}
                      onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value) || null)}
                      className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40"
                    >
                      <option value="">-- اختر المخزن --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[180px] relative">
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">اختر قطعة من المخزن</label>
                    <input
                      ref={productSearchRef}
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); setSelectedProduct(null); }}
                      onFocus={() => setShowProductDrop(true)}
                      onBlur={() => setTimeout(() => setShowProductDrop(false), 180)}
                      placeholder="ابحث عن منتج..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/40"
                    />
                    {showProductDrop && filteredProducts.length > 0 && (
                      <div
                        className="absolute top-full right-0 left-0 z-50 mt-1 rounded-xl border border-white/10 overflow-hidden"
                        style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 200, overflowY: "auto" }}
                      >
                        {filteredProducts.map(p => (
                          <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                            className="w-full flex items-center justify-between px-3 py-2 text-right hover:bg-white/5"
                          >
                            <span className="text-[11px] text-white/85 truncate">{p.name}</span>
                            <span className="text-[10px] text-white/40 shrink-0 mr-2">{fmtCurrency(Number(p.sell_price))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ width: 56 }}>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">الكمية</label>
                    <input type="number" min={1} value={addQty} onChange={(e) => setAddQty(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40 text-center"
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">السعر (ج.م)</label>
                    <input type="number" min={0} step="any" value={addPrice} onChange={(e) => setAddPrice(e.target.value)}
                      placeholder="0.00" dir="ltr"
                      className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40"
                    />
                  </div>
                  <button type="button" onClick={addPartLine} disabled={!selectedProduct}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 shrink-0"
                    style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة
                  </button>
                </div>

                {/* زرار إضافة بند إصلاح خارجي */}
                <div className="mt-2">
                  <button type="button" onClick={() => setShowExtForm(v => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                    style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(192,132,252,0.3)", color: "#D8B4FE" }}
                  >
                    <Wrench className="w-3 h-3" /> {showExtForm ? "إغلاق" : "+ إصلاح خارجي (ورشة برّا)"}
                  </button>
                </div>

                {showExtForm && (
                  <div className="mt-2 p-3 rounded-xl flex flex-wrap gap-2 items-end"
                    style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}
                  >
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] font-bold text-purple-200/70 mb-1 block">وصف الإصلاح</label>
                      <input value={extDesc} onChange={(e) => setExtDesc(e.target.value)}
                        placeholder="مثلاً: تغيير شاشة"
                        className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-purple-400/25 text-[11px] text-white focus:outline-none focus:border-purple-400/50"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="text-[10px] font-bold text-purple-200/70 mb-1 block">اسم الورشة (اختياري)</label>
                      <input value={extVendor} onChange={(e) => setExtVendor(e.target.value)}
                        placeholder="ورشة الأمل"
                        className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-purple-400/25 text-[11px] text-white focus:outline-none focus:border-purple-400/50"
                      />
                    </div>
                    <div style={{ width: 110 }}>
                      <label className="text-[10px] font-bold text-purple-200/70 mb-1 block">التكلفة على العميل</label>
                      <input type="number" min={0} step="any" value={extPrice} onChange={(e) => setExtPrice(e.target.value)}
                        placeholder="0.00" dir="ltr"
                        className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-purple-400/25 text-[11px] text-white focus:outline-none focus:border-purple-400/50"
                      />
                    </div>
                    <button type="button" onClick={addExternalLine}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0"
                      style={{ background: "rgba(168,85,247,0.25)", border: "1px solid rgba(192,132,252,0.4)", color: "#E9D5FF" }}
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة
                    </button>
                  </div>
                )}

                {partLines.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {partLines.map(l => {
                      const d = lineDiscountAmount(l);
                      const isExt = l.source === 'external';
                      const cardStyle = isExt
                        ? { background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.22)" }
                        : { background: "rgba(59,130,246,0.06)",  border: "1px solid rgba(59,130,246,0.15)" };
                      return (
                        <div key={l.id} className="px-3 py-2 rounded-xl" style={cardStyle}>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPartLines(prev => prev.filter(x => x.id !== l.id))}
                              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400"
                              style={{ background: "rgba(239,68,68,0.08)" }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {isExt && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{ background: "rgba(168,85,247,0.2)", color: "#E9D5FF", border: "1px solid rgba(192,132,252,0.35)" }}
                              >
                                <Wrench className="w-2.5 h-2.5 inline-block ml-0.5" /> خارجي
                              </span>
                            )}
                            <span className="flex-1 text-[11px] text-white/80 truncate">{l.product_name}</span>
                            <span className="text-[10px] text-white/50 shrink-0">{l.quantity} × {fmtCurrency(l.unit_price)}</span>
                            <span className={`text-[11px] font-bold shrink-0 ${isExt ? "text-purple-300" : "text-blue-300"}`}>{fmtCurrency(lineNet(l))}</span>
                          </div>
                          {/* صف الخصم القابل للتعديل بعد الإضافة */}
                          <div className="mt-1.5 flex items-center gap-2 pl-7">
                            <span className="text-[10px] text-white/45">خصم على الصنف:</span>
                            <input
                              type="number" min={0} step="any"
                              value={l.discount_value}
                              onChange={(e) => updateLineDiscount(l.id, parseFloat(e.target.value) || 0, l.discount_mode)}
                              className="w-20 px-2 py-0.5 rounded-md bg-white/[0.03] border border-amber-400/20 text-[10px] text-white text-center focus:outline-none focus:border-amber-400/40"
                              dir="ltr"
                            />
                            <button type="button"
                              onClick={() => updateLineDiscount(l.id, l.discount_value, l.discount_mode === 'pct' ? 'amt' : 'pct')}
                              className="w-6 h-6 rounded-md text-[10px] font-black text-amber-300 border border-amber-400/30 hover:bg-amber-400/10"
                            >
                              {l.discount_mode === 'pct' ? '%' : 'ج'}
                            </button>
                            {d > 0 && (
                              <span className="text-[10px] font-bold text-red-300">- {fmtCurrency(d)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ملخص المبلغ — يُحاسَب العميل على القطع فقط (تكلفة الإصلاح داخلية) */}
              <div className="px-5 py-3 border-b border-white/5 bg-white/[0.015]">
                <div className="flex items-center justify-between text-[12px] font-black">
                  <span className="text-white">الإجمالي المستحق على العميل</span>
                  <span className="text-lime-300">{fmtCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* طريقة الدفع */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[9px] text-emerald-300 font-black">٢</span>
                  طريقة الدفع
                </h4>

                {payRows.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {payRows.map(row => (
                      <div key={row.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${row.type === "credit" ? "bg-indigo-500/8 border border-indigo-500/20" : "bg-emerald-500/8 border border-emerald-500/20"}`}
                      >
                        <button type="button" onClick={() => setPayRows(prev => prev.filter(r => r.id !== row.id))}
                          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400"
                          style={{ background: "rgba(239,68,68,0.08)" }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className={`text-[11px] font-bold shrink-0 flex items-center gap-1 ${row.type === "credit" ? "text-indigo-400" : "text-emerald-400"}`}>
                          {row.type === "cash" ? <Coins className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {row.type === "cash" ? (safes.find(s => s.id === row.safe_id)?.name ?? "نقدي") : "آجل"}
                        </span>
                        <span className="font-black text-sm text-white mr-auto">{fmtCurrency(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {grandTotal > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>{payIsDone ? "✓ مكتمل" : `متبقي: ${fmtCurrency(remaining)}`}</span>
                      <span>{Math.min(100, Math.round((paidSoFar / grandTotal) * 100))}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`,
                          background: payIsDone ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FBBF24)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {!payIsDone && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <button onClick={() => setPayType("cash")}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "cash" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-white/[0.03] text-white/50 border border-white/10 hover:bg-white/[0.06]"}`}
                      >
                        <Coins className="w-3 h-3" /> نقدي
                      </button>
                      <button onClick={() => setPayType("credit")}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "credit" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "bg-white/[0.03] text-white/50 border border-white/10 hover:bg-white/[0.06]"}`}
                      >
                        <Clock className="w-3 h-3" /> آجل
                      </button>
                    </div>
                    <div className="flex gap-1.5 items-stretch">
                      {payType === "cash" && safes.length > 0 ? (
                        <select value={paySafe ?? ""} onChange={(e) => setPaySafe(parseInt(e.target.value) || null)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-emerald-400/40"
                        >
                          {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex-1 flex items-center justify-end text-[11px] text-indigo-300/70 px-2 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                          ائتمان العميل
                        </div>
                      )}
                      <div className="relative shrink-0" style={{ width: 96 }}>
                        <input type="number" min={0} step="any" value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPayRow(); } }}
                          onFocus={(e) => e.target.select()}
                          placeholder={grandTotal > 0 ? remaining.toFixed(0) : "0"}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
                          dir="ltr"
                        />
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-white/30">ج.م</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={addPayRow}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/80 hover:text-white transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                      >
                        ↵ تأكيد
                      </button>
                      <button onClick={fillAll} disabled={remaining <= 0}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 hover:text-white transition-all disabled:opacity-30"
                        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
                      >
                        كل المتبقي ({fmtCurrency(remaining)})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* الوسيط */}
              <div className="px-5 pt-4 pb-4">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-[9px] text-amber-300 font-black">٣</span>
                  <UserCog className="w-3.5 h-3.5 text-amber-300" />
                  الوسيط (اختياري)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">اسم الوسيط</label>
                    <input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="اسم الوسيط..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">العمولة (ج.م)</label>
                    <input type="number" min={0} step="any" value={brokerComm}
                      onChange={(e) => setBrokerComm(e.target.value)} placeholder="0.00" dir="ltr"
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-amber-400/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ════════ عمود اليسار: الفاتورة + الشحن + الخصم ════════ */}
            <div className="overflow-y-auto max-h-[65vh]">

              {/* عنوان الفاتورة */}
              <div className="px-5 pt-4 pb-2 border-b border-white/5 bg-emerald-500/[0.03]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-300" />
                  <h4 className="text-[12px] font-black text-emerald-200">الفاتورة النهائية</h4>
                </div>
              </div>

              {/* بيانات العميل والجهاز */}
              {receiptData && (
                <div className="px-5 py-3 border-b border-white/5 space-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-white/50">رقم البطاقة:</span><span className="font-bold text-white">{receiptData.job_no}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">العميل:</span><span className="text-white">{receiptData.customer_name ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">الهاتف:</span><span className="text-white">{receiptData.customer_phone ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">الجهاز:</span><span className="text-white">{[receiptData.device_brand, receiptData.device_model].filter(Boolean).join(" ") || "—"}</span></div>
                  {receiptData.imei && <div className="flex justify-between"><span className="text-white/50">IMEI:</span><span className="text-white font-mono text-[10px]">{receiptData.imei}</span></div>}
                  {receiptData.technician_name && <div className="flex justify-between"><span className="text-white/50">الفني:</span><span className="text-white">{receiptData.technician_name}</span></div>}
                </div>
              )}

              {/* القطع المضافة في الفاتورة */}
              {partLines.length > 0 && (
                <div className="px-5 py-3 border-b border-white/5">
                  <p className="text-[10px] text-white/50 mb-2 font-bold">قطع الغيار:</p>
                  {partLines.map(l => (
                    <div key={l.id} className="flex justify-between text-[11px] text-white/70 py-0.5">
                      <span>{l.product_name} × {l.quantity}</span>
                      <span>{fmtCurrency(l.quantity * l.unit_price)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* حقل الشحن */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-sky-300" />
                  تكلفة الشحن (اترك 0 إن لم يكن هناك شحن)
                </h4>
                <div className="space-y-2">
                  <input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-sm text-white focus:outline-none focus:border-sky-400/40"
                    placeholder="0.00"
                  />
                  {needsSafe && (
                    <select value={safeId} onChange={(e) => setSafeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white focus:outline-none focus:border-sky-400/40"
                    >
                      <option value="">— اختر الخزنة —</option>
                      {safes.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#1a1530]">
                          {s.name} — رصيد: {Number(s.balance).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* حقل الخصم */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3">خصم نهائي (اترك 0 إن لم يكن)</h4>
                <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-red-400/20 text-sm text-white focus:outline-none focus:border-red-400/40"
                  placeholder="0.00"
                />
              </div>

              {/* ملخص الفاتورة النهائي */}
              <div className="px-5 py-4 space-y-1.5 text-[11px]">
                {partsTotal > 0 && <div className="flex justify-between"><span className="text-white/50">قطع الغيار:</span><span className="text-blue-300">{fmtCurrency(partsTotal)}</span></div>}
                {sc > 0 && <div className="flex justify-between"><span className="text-white/50">الشحن:</span><span className="text-sky-300">{fmtCurrency(sc)}</span></div>}
                {disc > 0 && <div className="flex justify-between text-red-400"><span>خصم نهائي:</span><span>- {fmtCurrency(disc)}</span></div>}
                <div className="flex justify-between font-bold text-white text-[12px] pt-1.5 border-t border-white/8">
                  <span>الإجمالي الكلي:</span><span className="text-lime-300">{fmtCurrency(total)}</span>
                </div>
                {dep > 0 && <div className="flex justify-between text-emerald-300"><span>المدفوع مقدماً:</span><span>{fmtCurrency(dep)}</span></div>}
                <div className="flex justify-between font-black text-amber-300 text-[13px] pt-1 border-t border-white/8">
                  <span>المتبقي على العميل:</span><span>{fmtCurrency(totalRem)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Errors ── */}
        {errors.length > 0 && (
          <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] font-bold text-red-400">خطأ:</p>
            </div>
            <ul className="list-disc list-inside">
              {errors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
            </ul>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-white/8 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleWhatsapp} disabled={!receiptData || !receiptData.customer_phone}
              className="py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}
            >
              <MessageCircle className="w-3.5 h-3.5" /> إرسال واتساب
            </button>
            <button onClick={handlePrint} disabled={!receiptData}
              className="py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
            >
              <Printer className="w-3.5 h-3.5" /> طباعة الفاتورة
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !receiptData}
              className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(59,130,246,0.75)", border: "1px solid rgba(96,165,250,0.45)" }}
              title="حفظ بيانات المحاسبة بدون تأكيد التسليم النهائي"
            >
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                : <><Save className="w-3.5 h-3.5" /> حفظ</>}
            </button>
            <button onClick={handleConfirm} disabled={saving || !receiptData}
              className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}
              title="تأكيد تسليم الجهاز للعميل نهائياً"
            >
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                : <><CheckCircle2 className="w-3.5 h-3.5" /> تأكيد التسليم</>}
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
