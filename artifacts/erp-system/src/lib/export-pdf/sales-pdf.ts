import { escapeHtml, fmtMoney, fmtDate, payLabel, statusLabel, buildWindow } from './_shared';

export interface SaleForPdf {
  invoice_no: string;
  customer_name?: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: string;
  status: string;
  created_at: string;
}

export function printSalesReport(sales: SaleForPdf[]) {
  const total = sales.reduce((s, v) => s + Number(v.total_amount), 0);
  const paid = sales.reduce((s, v) => s + Number(v.paid_amount), 0);
  const remaining = sales.reduce((s, v) => s + Number(v.remaining_amount), 0);

  const rows = sales
    .map(
      (s) => `
    <tr>
      <td><strong>${escapeHtml(s.invoice_no)}</strong></td>
      <td>${escapeHtml(s.customer_name) || 'عميل نقدي'}</td>
      <td><strong>${fmtMoney(Number(s.total_amount))}</strong></td>
      <td style="color:#059669;font-weight:700">${fmtMoney(Number(s.paid_amount))}</td>
      <td style="color:${Number(s.remaining_amount) > 0 ? '#dc2626' : '#9ca3af'};font-weight:700">${Number(s.remaining_amount) > 0 ? fmtMoney(Number(s.remaining_amount)) : '—'}</td>
      <td><span class="badge badge-${s.payment_type === 'cash' ? 'green' : s.payment_type === 'credit' ? 'red' : 'yellow'}">${payLabel(s.payment_type)}</span></td>
      <td><span class="badge badge-${s.status === 'paid' ? 'green' : s.status === 'partial' ? 'yellow' : 'red'}">${statusLabel(s.status)}</span></td>
      <td style="color:#6b7280;font-size:11px">${fmtDate(s.created_at)}</td>
    </tr>`
    )
    .join('');

  const body = `
    <div class="summary">
      <div class="card"><div class="card-label">إجمالي المبيعات</div><div class="card-value">${fmtMoney(total)}</div></div>
      <div class="card"><div class="card-label">المحصَّل</div><div class="card-value green">${fmtMoney(paid)}</div></div>
      <div class="card"><div class="card-label">الديون المتبقية</div><div class="card-value red">${fmtMoney(remaining)}</div></div>
      <div class="card"><div class="card-label">عدد الفواتير</div><div class="card-value">${sales.length}</div></div>
    </div>
    <table>
      <thead><tr>
        <th>رقم الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th>
        <th>المتبقي</th><th>طريقة الدفع</th><th>الحالة</th><th>التاريخ</th>
      </tr></thead>
      <tbody>${rows.length ? rows : '<tr><td colspan="8" class="no-data">لا توجد فواتير</td></tr>'}</tbody>
      <tfoot><tr>
        <td colspan="2">الإجمالي (${sales.length} فاتورة)</td>
        <td>${fmtMoney(total)}</td>
        <td style="color:#059669">${fmtMoney(paid)}</td>
        <td style="color:#dc2626">${fmtMoney(remaining)}</td>
        <td colspan="3"></td>
      </tr></tfoot>
    </table>`;

  buildWindow('تقرير المبيعات', body);
}
