import { escapeHtml, fmtMoney, fmtDate, payLabel, buildWindow } from './_shared';

export interface PurchaseForPdf {
  invoice_no: string;
  supplier_name?: string | null;
  customer_name?: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: string;
  status: string;
  created_at: string;
}

export function printPurchasesReport(purchases: PurchaseForPdf[]) {
  const total = purchases.reduce((s, v) => s + Number(v.total_amount), 0);
  const paid = purchases.reduce((s, v) => s + Number(v.paid_amount), 0);
  const remaining = purchases.reduce((s, v) => s + Number(v.remaining_amount), 0);

  const rows = purchases
    .map(
      (p) => `
    <tr>
      <td><strong>${escapeHtml(p.invoice_no)}</strong></td>
      <td>${escapeHtml(p.supplier_name) || '—'}</td>
      <td>${escapeHtml(p.customer_name) || '—'}</td>
      <td><strong>${fmtMoney(Number(p.total_amount))}</strong></td>
      <td style="color:#059669;font-weight:700">${fmtMoney(Number(p.paid_amount))}</td>
      <td style="color:${Number(p.remaining_amount) > 0 ? '#dc2626' : '#9ca3af'};font-weight:700">${Number(p.remaining_amount) > 0 ? fmtMoney(Number(p.remaining_amount)) : '—'}</td>
      <td><span class="badge badge-${p.payment_type === 'cash' ? 'green' : p.payment_type === 'credit' ? 'red' : 'yellow'}">${payLabel(p.payment_type)}</span></td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(p.created_at)}</td>
    </tr>`
    )
    .join('');

  const body = `
    <div class="summary">
      <div class="card"><div class="card-label">إجمالي المشتريات</div><div class="card-value">${fmtMoney(total)}</div></div>
      <div class="card"><div class="card-label">المدفوع</div><div class="card-value green">${fmtMoney(paid)}</div></div>
      <div class="card"><div class="card-label">المتبقي</div><div class="card-value amber">${fmtMoney(remaining)}</div></div>
      <div class="card"><div class="card-label">عدد الفواتير</div><div class="card-value">${purchases.length}</div></div>
    </div>
    <table>
      <thead><tr>
        <th>رقم الفاتورة</th><th>المورد</th><th>العميل</th><th>الإجمالي</th>
        <th>المدفوع</th><th>المتبقي</th><th>طريقة الدفع</th><th>التاريخ</th>
      </tr></thead>
      <tbody>${rows.length ? rows : '<tr><td colspan="8" class="no-data">لا توجد مشتريات</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="3">الإجمالي (${purchases.length} فاتورة)</td>
        <td>${fmtMoney(total)}</td>
        <td style="color:#059669">${fmtMoney(paid)}</td>
        <td style="color:#dc2626">${fmtMoney(remaining)}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>`;

  buildWindow('تقرير المشتريات', body);
}

export interface CustomerForPdf {
  name: string;
  phone?: string | null;
  address?: string | null;
  balance: number;
}

export interface StatementSale {
  invoice_no: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: string;
  status: string;
  created_at: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface StatementReturn {
  return_no: string;
  total_amount: number;
  refund_type?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface StatementVoucher {
  voucher_no: string;
  amount: number;
  safe_name: string;
  notes?: string | null;
  date: string;
}

export function printCustomerStatement(
  customer: CustomerForPdf,
  sales: StatementSale[],
  salesReturns: StatementReturn[],
  receiptVouchers: StatementVoucher[],
  depositVouchers: StatementVoucher[],
  paymentVouchers: StatementVoucher[]
) {
  const totalSales = sales.reduce((s, v) => s + Number(v.total_amount), 0);
  const totalPaid = sales.reduce((s, v) => s + Number(v.paid_amount), 0);
  const totalReturns = salesReturns.reduce((s, v) => s + Number(v.total_amount), 0);
  const totalReceipts = receiptVouchers.reduce((s, v) => s + Number(v.amount), 0);
  const totalDeposits = depositVouchers.reduce((s, v) => s + Number(v.amount), 0);
  const totalPayments = paymentVouchers.reduce((s, v) => s + Number(v.amount), 0);

  const salesRows = sales
    .map(
      (s) => `
    <tr>
      <td><strong style="color:#d97706">${escapeHtml(s.invoice_no)}</strong></td>
      <td>${fmtMoney(Number(s.total_amount))}</td>
      <td style="color:#059669;font-weight:700">${fmtMoney(Number(s.paid_amount))}</td>
      <td style="color:${Number(s.remaining_amount) > 0 ? '#dc2626' : '#9ca3af'};font-weight:700">${Number(s.remaining_amount) > 0 ? fmtMoney(Number(s.remaining_amount)) : '—'}</td>
      <td><span class="badge badge-${s.payment_type === 'cash' ? 'green' : s.payment_type === 'credit' ? 'red' : 'yellow'}">${payLabel(s.payment_type)}</span></td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(s.created_at)}</td>
    </tr>`
    )
    .join('');

  const returnRows = salesReturns
    .map(
      (r) => `
    <tr>
      <td><strong style="color:#dc2626">${escapeHtml(r.return_no)}</strong></td>
      <td style="color:#dc2626;font-weight:700">${fmtMoney(Number(r.total_amount))}</td>
      <td>${r.refund_type === 'cash' ? 'نقدي' : 'رصيد'}</td>
      <td style="color:#6b7280">${escapeHtml(r.reason) || '—'}</td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(r.created_at)}</td>
    </tr>`
    )
    .join('');

  const receiptRows = receiptVouchers
    .map(
      (v) => `
    <tr>
      <td><strong style="color:#059669">${escapeHtml(v.voucher_no)}</strong></td>
      <td style="color:#059669;font-weight:700">${fmtMoney(Number(v.amount))}</td>
      <td>${escapeHtml(v.safe_name)}</td>
      <td style="color:#6b7280">${escapeHtml(v.notes) || '—'}</td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(v.date)}</td>
    </tr>`
    )
    .join('');

  const depositRows = depositVouchers
    .map(
      (v) => `
    <tr>
      <td><strong style="color:#2563eb">${escapeHtml(v.voucher_no)}</strong></td>
      <td style="color:#2563eb;font-weight:700">${fmtMoney(Number(v.amount))}</td>
      <td>${escapeHtml(v.safe_name)}</td>
      <td style="color:#6b7280">${escapeHtml(v.notes) || '—'}</td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(v.date)}</td>
    </tr>`
    )
    .join('');

  const paymentRows = paymentVouchers
    .map(
      (v) => `
    <tr>
      <td><strong style="color:#7c3aed">${escapeHtml(v.voucher_no)}</strong></td>
      <td style="color:#7c3aed;font-weight:700">${fmtMoney(Number(v.amount))}</td>
      <td>${escapeHtml(v.safe_name)}</td>
      <td style="color:#6b7280">${escapeHtml(v.notes) || '—'}</td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(v.date)}</td>
    </tr>`
    )
    .join('');

  const body = `
    <div class="customer-info">
      <div class="info-item"><label>اسم العميل</label><span>${escapeHtml(customer.name)}</span></div>
      <div class="info-item"><label>الهاتف</label><span>${escapeHtml(customer.phone) || '—'}</span></div>
      <div class="info-item"><label>الرصيد المستحق</label><span style="color:${Number(customer.balance) > 0 ? '#dc2626' : '#059669'}">${fmtMoney(Number(customer.balance))}</span></div>
    </div>

    <div class="summary">
      <div class="card"><div class="card-label">إجمالي المبيعات</div><div class="card-value">${fmtMoney(totalSales)}</div></div>
      <div class="card"><div class="card-label">المحصَّل (فواتير)</div><div class="card-value green">${fmtMoney(totalPaid)}</div></div>
      ${totalReturns > 0 ? `<div class="card"><div class="card-label">المرتجعات</div><div class="card-value red">${fmtMoney(totalReturns)}</div></div>` : ''}
      ${totalReceipts > 0 ? `<div class="card"><div class="card-label">سندات القبض</div><div class="card-value green">${fmtMoney(totalReceipts)}</div></div>` : ''}
      ${totalDeposits > 0 ? `<div class="card"><div class="card-label">سندات الإيداع</div><div class="card-value">${fmtMoney(totalDeposits)}</div></div>` : ''}
      ${totalPayments > 0 ? `<div class="card"><div class="card-label">سندات الصرف</div><div class="card-value red">${fmtMoney(totalPayments)}</div></div>` : ''}
      <div class="card"><div class="card-label">الرصيد المستحق</div><div class="card-value ${Number(customer.balance) > 0 ? 'red' : 'green'}">${fmtMoney(Number(customer.balance))}</div></div>
    </div>

    ${
      sales.length > 0
        ? `
      <div class="section-title">فواتير المبيعات (${sales.length})</div>
      <table>
        <thead><tr><th>رقم الفاتورة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead>
        <tbody>${salesRows}</tbody>
        <tfoot><tr>
          <td>الإجمالي</td>
          <td>${fmtMoney(totalSales)}</td>
          <td style="color:#059669">${fmtMoney(totalPaid)}</td>
          <td style="color:#dc2626">${fmtMoney(totalSales - totalPaid)}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table>`
        : ''
    }

    ${
      salesReturns.length > 0
        ? `
      <div class="section-title">المرتجعات (${salesReturns.length})</div>
      <table>
        <thead><tr><th>رقم المرتجع</th><th>المبلغ</th><th>نوع الاسترداد</th><th>السبب</th><th>التاريخ</th></tr></thead>
        <tbody>${returnRows}</tbody>
        <tfoot><tr>
          <td>الإجمالي</td>
          <td style="color:#dc2626">${fmtMoney(totalReturns)}</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>`
        : ''
    }

    ${
      receiptVouchers.length > 0
        ? `
      <div class="section-title">سندات القبض — مدفوعات العميل (${receiptVouchers.length})</div>
      <table>
        <thead><tr><th>رقم السند</th><th>المبلغ</th><th>الخزينة</th><th>بيان</th><th>التاريخ</th></tr></thead>
        <tbody>${receiptRows}</tbody>
        <tfoot><tr>
          <td>الإجمالي</td>
          <td style="color:#059669">${fmtMoney(totalReceipts)}</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>`
        : ''
    }

    ${
      depositVouchers.length > 0
        ? `
      <div class="section-title">سندات الإيداع (${depositVouchers.length})</div>
      <table>
        <thead><tr><th>رقم السند</th><th>المبلغ</th><th>الخزينة</th><th>بيان</th><th>التاريخ</th></tr></thead>
        <tbody>${depositRows}</tbody>
        <tfoot><tr>
          <td>الإجمالي</td>
          <td style="color:#2563eb">${fmtMoney(totalDeposits)}</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>`
        : ''
    }

    ${
      paymentVouchers.length > 0
        ? `
      <div class="section-title">سندات الصرف — مردودات للعميل (${paymentVouchers.length})</div>
      <table>
        <thead><tr><th>رقم السند</th><th>المبلغ</th><th>الخزينة</th><th>بيان</th><th>التاريخ</th></tr></thead>
        <tbody>${paymentRows}</tbody>
        <tfoot><tr>
          <td>الإجمالي</td>
          <td style="color:#7c3aed">${fmtMoney(totalPayments)}</td>
          <td colspan="3"></td>
        </tr></tfoot>
      </table>`
        : ''
    }

    ${
      sales.length === 0 &&
      salesReturns.length === 0 &&
      receiptVouchers.length === 0 &&
      depositVouchers.length === 0 &&
      paymentVouchers.length === 0
        ? '<div class="no-data">لا توجد حركات مالية لهذا العميل</div>'
        : ''
    }
  `;

  buildWindow(`كشف حساب — ${customer.name}`, body);
}
