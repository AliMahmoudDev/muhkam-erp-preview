import { openPrintWindow } from '../print-utils';
import { escapeHtml, getSettings, getNumSettings, fmtMoney, fmtDate, payLabel, INVOICE_STYLES, invoiceWindow } from './_shared';

export interface FullSaleItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface FullSaleData {
  invoice_no: string;
  customer_name: string | null;
  phone?: string | null;
  date: string | null;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: string;
  status?: string;
  safe_name?: string | null;
  notes?: string | null;
  items: FullSaleItem[];
}

export function printSaleInvoice(sale: FullSaleData): void {
  const s = getSettings();
  const { dateLocale } = getNumSettings();
  const dateStr = sale.date
    ? new Date(sale.date + 'T12:00:00').toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : fmtDate(sale.created_at);

  const rows = sale.items
    .map(
      (it, i) => `<tr>
    <td>${i + 1}</td>
    <td style="font-weight:700">${escapeHtml(it.product_name)}</td>
    <td>${Number(it.quantity)}</td>
    <td>${fmtMoney(it.unit_price)}</td>
    <td style="font-weight:700;color:#d97706">${fmtMoney(it.total_price)}</td>
  </tr>`
    )
    .join('');

  const subtotal = sale.items.reduce((s, i) => s + Number(i.total_price), 0);

  const body = `<div class="inv">
  <div class="inv-head">
    <div>
      <div class="co-name">${escapeHtml(s.companyName)}</div>
      ${s.phone ? `<div class="co-sub">📞 ${escapeHtml(s.phone)}</div>` : ''}
      ${s.address ? `<div class="co-sub">📍 ${escapeHtml(s.address)}</div>` : ''}
    </div>
    <div class="inv-meta">
      <div class="inv-title">فاتورة مبيعات</div>
      <div class="inv-no">رقم: ${escapeHtml(sale.invoice_no)}</div>
      <div class="inv-date">التاريخ: ${dateStr}</div>
    </div>
  </div>
  <hr class="gold">
  ${
    sale.customer_name
      ? `<div class="party-box">
    <div class="party-title">بيانات العميل</div>
    <div class="party-name">${escapeHtml(sale.customer_name)}</div>
    ${sale.phone ? `<div class="party-phone">📞 ${escapeHtml(sale.phone)}</div>` : ''}
  </div>`
      : ''
  }
  <table class="items">
    <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right;color:#6b7280">الإجمالي الفرعي (${sale.items.length} صنف)</td>
      <td style="color:#d97706">${fmtMoney(subtotal)}</td>
    </tr></tfoot>
  </table>
  <div class="totals">
    <div class="totals-inner">
      <div class="t-row grand"><span>الإجمالي الكلي</span><span>${fmtMoney(sale.total_amount)}</span></div>
      <div class="t-row paid"><span>المدفوع ✓</span><span>${fmtMoney(sale.paid_amount)}</span></div>
      ${Number(sale.remaining_amount) > 0 ? `<div class="t-row remaining"><span>المتبقي ⚠</span><span>${fmtMoney(sale.remaining_amount)}</span></div>` : ''}
    </div>
  </div>
  <div class="foot-row">
    <div>
      <div><strong>طريقة الدفع:</strong> <span class="badge badge-${sale.payment_type}">${payLabel(sale.payment_type)}</span></div>
      ${sale.safe_name ? `<div style="margin-top:4px"><strong>الخزينة:</strong> ${escapeHtml(sale.safe_name)}</div>` : ''}
      ${sale.notes ? `<div style="margin-top:4px"><strong>ملاحظات:</strong> ${escapeHtml(sale.notes)}</div>` : ''}
    </div>
    <div style="text-align:left;color:#9ca3af;font-size:11px">
      ${escapeHtml(s.companyName)}<br>تم الإنشاء: ${fmtDate(sale.created_at)}
    </div>
  </div>
  <div class="thank">🙏 شكراً لتعاملكم معنا — ${escapeHtml(s.companyName)}</div>
</div>`;

  invoiceWindow(escapeHtml(sale.invoice_no), body);
}

export interface FullPurchaseItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface FullPurchaseData {
  invoice_no: string;
  supplier_name?: string | null;
  customer_name?: string | null;
  date?: string | null;
  created_at: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: string;
  safe_name?: string | null;
  notes?: string | null;
  items: FullPurchaseItem[];
}

export function printPurchaseInvoice(purchase: FullPurchaseData): void {
  const s = getSettings();
  const { dateLocale } = getNumSettings();
  const party = purchase.supplier_name ?? purchase.customer_name ?? '—';
  const dateStr = purchase.date
    ? new Date(purchase.date + 'T12:00:00').toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : fmtDate(purchase.created_at);

  const rows = purchase.items
    .map(
      (it, i) => `<tr>
    <td>${i + 1}</td>
    <td style="font-weight:700">${escapeHtml(it.product_name)}</td>
    <td>${Number(it.quantity)}</td>
    <td>${fmtMoney(it.unit_price)}</td>
    <td style="font-weight:700;color:#2563eb">${fmtMoney(it.total_price)}</td>
  </tr>`
    )
    .join('');

  const subtotal = purchase.items.reduce((s, i) => s + Number(i.total_price), 0);

  const body = `<div class="inv">
  <div class="inv-head">
    <div>
      <div class="co-name">${escapeHtml(s.companyName)}</div>
      ${s.phone ? `<div class="co-sub">📞 ${escapeHtml(s.phone)}</div>` : ''}
      ${s.address ? `<div class="co-sub">📍 ${escapeHtml(s.address)}</div>` : ''}
    </div>
    <div class="inv-meta">
      <div class="inv-title" style="color:#2563eb">فاتورة مشتريات</div>
      <div class="inv-no">رقم: ${escapeHtml(purchase.invoice_no)}</div>
      <div class="inv-date">التاريخ: ${dateStr}</div>
    </div>
  </div>
  <hr style="border:none;border-top:2px solid #2563eb;margin:14px 0">
  ${
    party !== '—'
      ? `<div class="party-box">
    <div class="party-title">بيانات المورد</div>
    <div class="party-name">${escapeHtml(party)}</div>
  </div>`
      : ''
  }
  <table class="items">
    <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right;color:#6b7280">إجمالي المشتريات (${purchase.items.length} صنف)</td>
      <td style="color:#2563eb">${fmtMoney(subtotal)}</td>
    </tr></tfoot>
  </table>
  <div class="totals">
    <div class="totals-inner">
      <div class="t-row grand" style="background:#dbeafe"><span>إجمالي قيمة المشتريات</span><span>${fmtMoney(purchase.total_amount)}</span></div>
      <div class="t-row" style="color:#059669;font-weight:700"><span>المبلغ المدفوع ✓</span><span>${fmtMoney(purchase.paid_amount)}</span></div>
      ${Number(purchase.remaining_amount) > 0 ? `<div class="t-row remaining"><span>المتبقي للمورد ⚠</span><span>${fmtMoney(purchase.remaining_amount)}</span></div>` : ''}
    </div>
  </div>
  <div class="foot-row">
    <div>
      <div><strong>طريقة الدفع:</strong> <span class="badge badge-${purchase.payment_type}">${payLabel(purchase.payment_type)}</span></div>
      ${purchase.safe_name ? `<div style="margin-top:4px"><strong>الخزينة:</strong> ${escapeHtml(purchase.safe_name)}</div>` : ''}
      ${purchase.notes ? `<div style="margin-top:4px"><strong>ملاحظات:</strong> ${escapeHtml(purchase.notes)}</div>` : ''}
    </div>
    <div style="text-align:left;color:#9ca3af;font-size:11px">
      ${escapeHtml(s.companyName)}<br>تم التسجيل: ${fmtDate(purchase.created_at)}
    </div>
  </div>
  <div class="thank">📦 تم استلام البضاعة بنجاح — ${escapeHtml(s.companyName)}</div>
</div>`;

  invoiceWindow(escapeHtml(purchase.invoice_no), body);
}

// Re-export styles for any consumers that import INVOICE_STYLES directly
export { INVOICE_STYLES, invoiceWindow };
// openPrintWindow re-export for consumers
export { openPrintWindow };
