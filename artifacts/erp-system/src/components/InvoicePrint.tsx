/**
 * InvoicePrint — فاتورة مطبوعة مع تفاصيل ضريبة القيمة المضافة
 * يُعرض في نافذة مستقلة عند الطباعة.
 */
import { useEffect, useRef } from "react";

interface InvoiceItem {
  name:      string;
  qty:       number;
  unit_price: number;
  tax_rate?:  number;
  total:     number;
}

export interface InvoiceData {
  id:             number;
  date:           string;
  customer_name?: string;
  items:          InvoiceItem[];
  subtotal:       number;
  tax_amount:     number;
  discount_amount?: number;
  total_amount:   number;
  paid_amount?:   number;
  note?:          string;
  company?: {
    name:     string;
    address:  string;
    phone:    string;
    tax_id:   string;
    header?:  string;
    footer?:  string;
  };
}

interface Props {
  data: InvoiceData;
  onClose: () => void;
}

export function InvoicePrint({ data, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة #${data.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; color: #111; direction: rtl; }
  .invoice { max-width: 800px; margin: 0 auto; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2bc54; padding-bottom: 16px; margin-bottom: 20px; }
  .company-name { font-size: 20px; font-weight: 900; color: #111; }
  .company-sub { font-size: 12px; color: #666; margin-top: 4px; line-height: 1.5; }
  .invoice-meta { text-align: left; }
  .invoice-meta h2 { font-size: 18px; font-weight: 900; color: #e2bc54; }
  .invoice-meta p { font-size: 11px; color: #555; margin-top: 2px; }
  .header-text { text-align: center; font-size: 13px; color: #444; margin-bottom: 16px; padding: 8px; background: #fffbf0; border-radius: 6px; }
  .customer-box { background: #f8f8f8; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; display: flex; gap: 24px; }
  .customer-box div { font-size: 12px; color: #555; }
  .customer-box strong { font-size: 13px; color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f0e8c8; color: #111; font-weight: 700; font-size: 12px; padding: 8px 10px; text-align: right; border: 1px solid #e0d0a0; }
  td { padding: 7px 10px; font-size: 12px; border: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals { float: left; min-width: 240px; }
  .totals table { border: 1px solid #e0d0a0; border-radius: 8px; overflow: hidden; }
  .totals td { padding: 6px 12px; }
  .totals .label { color: #666; font-size: 12px; }
  .totals .value { font-weight: 600; text-align: left; }
  .totals .total-row td { background: #e2bc54; color: #111; font-weight: 900; font-size: 14px; }
  .totals .vat-row td { background: #fff8e1; color: #b45309; font-weight: 700; }
  .clearfix::after { content: ""; display: table; clear: both; }
  .footer-text { text-align: center; font-size: 12px; color: #666; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; }
  .note { background: #f8f8f8; border-right: 3px solid #e2bc54; padding: 8px 12px; border-radius: 4px; font-size: 12px; color: #555; margin-bottom: 16px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="invoice">
  ${data.company?.header ? `<div class="header-text">${data.company.header}</div>` : ""}
  <div class="header">
    <div>
      <div class="company-name">${data.company?.name ?? "شركة حلال تك"}</div>
      <div class="company-sub">
        ${data.company?.address ? `${data.company.address}<br>` : ""}
        ${data.company?.phone ? `هاتف: ${data.company.phone}<br>` : ""}
        ${data.company?.tax_id ? `الرقم الضريبي: ${data.company.tax_id}` : ""}
      </div>
    </div>
    <div class="invoice-meta">
      <h2>فاتورة ضريبية</h2>
      <p>رقم الفاتورة: #${data.id}</p>
      <p>التاريخ: ${new Date(data.date).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
  </div>

  ${data.customer_name ? `
  <div class="customer-box">
    <div><div>عميل</div><strong>${data.customer_name}</strong></div>
  </div>` : ""}

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>الصنف</th>
        <th>الكمية</th>
        <th>سعر الوحدة</th>
        <th>الضريبة %</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.name}</td>
        <td>${it.qty}</td>
        <td>${Number(it.unit_price).toFixed(2)} ج.م</td>
        <td>${it.tax_rate != null ? `${it.tax_rate}%` : "—"}</td>
        <td>${Number(it.total).toFixed(2)} ج.م</td>
      </tr>`).join("")}
    </tbody>
  </table>

  ${data.note ? `<div class="note">ملاحظة: ${data.note}</div>` : ""}

  <div class="clearfix">
    <div class="totals">
      <table>
        <tr><td class="label">المجموع قبل الضريبة</td><td class="value">${Number(data.subtotal).toFixed(2)} ج.م</td></tr>
        ${data.discount_amount ? `<tr><td class="label">الخصم</td><td class="value" style="color:#e53e3e">(${Number(data.discount_amount).toFixed(2)} ج.م)</td></tr>` : ""}
        <tr class="vat-row"><td class="label">ضريبة القيمة المضافة</td><td class="value">${Number(data.tax_amount).toFixed(2)} ج.م</td></tr>
        <tr class="total-row"><td>الإجمالي</td><td>${Number(data.total_amount).toFixed(2)} ج.م</td></tr>
        ${data.paid_amount != null ? `<tr><td class="label">المدفوع</td><td class="value">${Number(data.paid_amount).toFixed(2)} ج.م</td></tr>` : ""}
        ${data.paid_amount != null ? `<tr><td class="label">المتبقي</td><td class="value" style="color:#e53e3e">${(Number(data.total_amount) - Number(data.paid_amount)).toFixed(2)} ج.م</td></tr>` : ""}
      </table>
    </div>
  </div>

  <br style="clear:both">
  ${data.company?.footer ? `<div class="footer-text">${data.company.footer}</div>` : '<div class="footer-text">شكراً لتعاملكم معنا — تم التوليد بنظام حلال تك ERP</div>'}
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" dir="rtl">
      <div ref={printRef} className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b bg-amber-50">
          <h2 className="font-bold text-gray-800 text-lg">فاتورة #${data.id}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors">
              🖨️ طباعة
            </button>
            <button onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-300 transition-colors">
              إغلاق
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="p-6 text-right font-sans" style={{ direction: "rtl" }}>
          {data.company?.header && (
            <div className="text-center text-sm text-gray-600 bg-amber-50 rounded-lg p-2 mb-4">
              {data.company.header}
            </div>
          )}
          <div className="flex justify-between items-start pb-4 mb-4 border-b-2 border-amber-400">
            <div>
              <div className="font-black text-gray-900 text-lg">{data.company?.name ?? "شركة حلال تك"}</div>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {data.company?.address && <div>{data.company.address}</div>}
                {data.company?.phone && <div>هاتف: {data.company.phone}</div>}
                {data.company?.tax_id && <div>الرقم الضريبي: {data.company.tax_id}</div>}
              </div>
            </div>
            <div className="text-left">
              <div className="text-amber-500 font-black text-lg">فاتورة ضريبية</div>
              <div className="text-xs text-gray-500">رقم: #{data.id}</div>
              <div className="text-xs text-gray-500">
                {new Date(data.date).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </div>

          {data.customer_name && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4 flex gap-6">
              <div><span className="text-xs text-gray-500">عميل</span><br /><strong className="text-gray-800">{data.customer_name}</strong></div>
            </div>
          )}

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-amber-100 text-gray-800">
                <th className="p-2 text-right border border-amber-200">#</th>
                <th className="p-2 text-right border border-amber-200">الصنف</th>
                <th className="p-2 text-right border border-amber-200">الكمية</th>
                <th className="p-2 text-right border border-amber-200">السعر</th>
                <th className="p-2 text-right border border-amber-200">الضريبة %</th>
                <th className="p-2 text-right border border-amber-200">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="p-2 border border-gray-100 text-gray-500">{i + 1}</td>
                  <td className="p-2 border border-gray-100 font-medium text-gray-800">{item.name}</td>
                  <td className="p-2 border border-gray-100 text-gray-600">{item.qty}</td>
                  <td className="p-2 border border-gray-100 text-gray-600">{Number(item.unit_price).toFixed(2)} ج.م</td>
                  <td className="p-2 border border-gray-100 text-orange-600">
                    {item.tax_rate != null ? `${item.tax_rate}%` : "—"}
                  </td>
                  <td className="p-2 border border-gray-100 font-semibold text-gray-800">{Number(item.total).toFixed(2)} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="min-w-56 border border-amber-200 rounded-xl overflow-hidden">
              <div className="flex justify-between px-4 py-2 bg-white text-sm">
                <span className="text-gray-500">المجموع</span>
                <span className="font-semibold">{Number(data.subtotal).toFixed(2)} ج.م</span>
              </div>
              {data.discount_amount ? (
                <div className="flex justify-between px-4 py-2 bg-white text-sm">
                  <span className="text-gray-500">الخصم</span>
                  <span className="font-semibold text-red-500">({Number(data.discount_amount).toFixed(2)} ج.م)</span>
                </div>
              ) : null}
              <div className="flex justify-between px-4 py-2 bg-amber-50 text-sm">
                <span className="text-orange-700">ضريبة القيمة المضافة</span>
                <span className="font-bold text-orange-700">{Number(data.tax_amount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-amber-400 text-base font-black text-gray-900">
                <span>الإجمالي</span>
                <span>{Number(data.total_amount).toFixed(2)} ج.م</span>
              </div>
              {data.paid_amount != null && (
                <>
                  <div className="flex justify-between px-4 py-2 bg-white text-sm">
                    <span className="text-gray-500">المدفوع</span>
                    <span className="font-semibold text-emerald-600">{Number(data.paid_amount).toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 bg-white text-sm">
                    <span className="text-gray-500">المتبقي</span>
                    <span className="font-semibold text-red-500">{(Number(data.total_amount) - Number(data.paid_amount)).toFixed(2)} ج.م</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {data.note && (
            <div className="mt-4 text-sm text-gray-600 bg-gray-50 border-r-4 border-amber-400 p-3 rounded">
              ملاحظة: {data.note}
            </div>
          )}

          <div className="mt-6 pt-4 border-t text-center text-xs text-gray-400">
            {data.company?.footer ?? "شكراً لتعاملكم معنا — تم التوليد بنظام حلال تك ERP"}
          </div>
        </div>
      </div>
    </div>
  );
}
