import { openPrintWindow, escapeHtml } from '@/lib/print-utils';
import type { Device } from './types';

/* ── Print Sale Receipt ── */
export function printSaleReceipt(d: Device, companyName: string) {
  const price = parseFloat(d.sold_price ?? d.sale_price ?? "0").toLocaleString("ar-EG");
  const date = d.sold_at ? new Date(d.sold_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const payMethods: Record<string, string> = { cash: "نقداً", card: "بطاقة", instapay: "InstaPay", transfer: "تحويل" };
  const payStatuses: Record<string, string> = { paid: "مدفوع بالكامل", partial: "مدفوع جزئياً", unpaid: "غير مدفوع" };

  const _html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة بيع — ${escapeHtml(d.brand)} ${escapeHtml(d.model)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #111; padding: 20px; font-size: 13px; }
  .header { text-align: center; border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 22px; font-weight: 900; color: #1f2937; letter-spacing: 1px; }
  .header p { color: #666; font-size: 11px; margin-top: 2px; }
  .badge { display: inline-block; background: #1f2937; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 999px; margin-top: 6px; }
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
  .stamp { border: 2px dashed #374151; border-radius: 50%; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; margin: 10px auto; color: #374151; font-weight: 900; font-size: 11px; text-align: center; }
  @media print { body { padding: 0; } @page { size: A4; margin: 10mm 12mm; } }
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
  <p>شكراً لثقتك بنا — ${escapeHtml(companyName)}</p>
  <p style="margin-top:4px">هذه الفاتورة صادرة إلكترونياً وتُعدّ وثيقة رسمية</p>
</div>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
  openPrintWindow(_html, { width: 420, height: 680 });
}
