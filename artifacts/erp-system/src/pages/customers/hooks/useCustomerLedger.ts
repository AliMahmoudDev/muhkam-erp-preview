import { useQuery } from '@tanstack/react-query';
import { useGetSales, useGetPurchases } from '@workspace/api-client-react';
import { safeArray } from '@/lib/safe-data';
import { openPrintWindow } from '@/lib/print-utils';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';

export interface ReceiptVoucher {
  id: number; voucher_no: string; customer_id: number | null;
  amount: number; safe_name: string; date: string; notes: string | null; created_at: string;
}
export interface PaymentVoucher {
  id: number; voucher_no: string; customer_id: number | null;
  amount: number; safe_name: string; date: string; notes: string | null; created_at: string;
}
export interface SaleReturn {
  id: number; return_no: string; customer_id: number | null; customer_name: string | null;
  total_amount: number; refund_type: string | null; safe_name: string | null;
  date: string | null; reason: string | null; created_at: string;
}
export interface PurchaseReturn {
  id: number; return_no: string; customer_id: number | null; customer_name: string | null;
  supplier_name: string | null; total_amount: number; date: string | null; created_at: string;
}
export interface FinancialTransaction {
  id: number; type: string; customer_id: number | null; amount: number;
  direction: string; description: string | null; date: string | null; created_at: string;
}
export interface LedgerEntry {
  id: number; type: string; amount: number; balance_after: number;
  reference_type: string | null; reference_no: string | null;
  description: string | null; date: string | null; created_at: string;
}
export interface CustomerLedgerData {
  customer_id: number; customer_name: string; balance: number; entries: LedgerEntry[];
}
export interface TxRow {
  date: string; type: string; label: string; ref: string; debit: number; credit: number; balance: number;
}
export interface ReportStmtRow {
  date: string; type: string; description: string; debit: number; credit: number; balance: number; reference_no?: string | null;
}
export interface ReportData {
  customer: { id: number; name: string; balance: number };
  opening_balance: number; statement: ReportStmtRow[]; closing_balance: number;
}

export const LEDGER_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  sale: { label: 'فاتورة مبيعات', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  sale_return: { label: 'مرتجع مبيعات', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  sale_cancel: { label: 'إلغاء فاتورة', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  receipt_voucher: { label: 'سند قبض', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  payment: { label: 'سداد مباشر', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  purchase: { label: 'مشتريات منه', color: 'text-ink/60', bg: 'bg-surface border-line' },
  supplier_payment: { label: 'تسديد دفعة', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  adjustment: { label: 'تسوية', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
  opening_balance: { label: 'رصيد افتتاحي', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
};

export const TX_TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  sale: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: '↑' },
  purchase: { color: 'text-ink/60', bg: 'bg-surface border-line', icon: '↓' },
  receipt: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '→' },
  payment: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: '←' },
  supplier_payment: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: '⬆' },
  purchase_return: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: '↺' },
  return_credit: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: '↩' },
  return_cash: { color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', icon: '↩' },
};

export const REPORT_TYPE_MAP: Record<string, { label: string; cls: string }> = {
  opening_balance: { label: 'رصيد أول المدة', cls: 'text-amber-400' },
  sale: { label: 'فاتورة مبيعات', cls: 'text-blue-400' },
  receipt: { label: 'سند قبض', cls: 'text-emerald-400' },
  sale_return: { label: 'مرتجع مبيعات', cls: 'text-orange-400' },
};

export function printCustomerStatement(opts: {
  customerName: string; customerPhone: string; customerBalance: number;
  rows: { date: string; label: string; ref: string; debit: number; credit: number; balance: number }[];
  summaryCards: { label: string; value: number; count: number }[];
  companyName: string; companySlogan: string;
}) {
  const { customerName, customerPhone, customerBalance, rows, summaryCards, companyName, companySlogan } = opts;
  const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const rowsHtml = rows.map((r, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${r.date ? r.date.split('T')[0] : '—'}</td>
      <td>${r.label}</td>
      <td class="mono">${r.ref}</td>
      <td class="num ${r.debit > 0 ? 'debit' : ''}">${r.debit > 0 ? r.debit.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 }) : '—'}</td>
      <td class="num ${r.credit > 0 ? 'credit' : ''}">${r.credit > 0 ? r.credit.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 }) : '—'}</td>
      <td class="num bold ${r.balance > 0 ? 'debit' : r.balance < 0 ? 'credit-neg' : ''}">${r.balance !== 0 ? `${Math.abs(r.balance).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} ${r.balance > 0 ? 'عليه' : 'له'}` : 'صفر'}</td>
    </tr>`).join('');
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const balanceLabel = customerBalance > 0
    ? `${Math.abs(customerBalance).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} — العميل مدين`
    : customerBalance < 0 ? `${Math.abs(customerBalance).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} — دائن للعميل` : 'متسوّى (صفر)';
  const cardsHtml = summaryCards.map((c) => `<div class="card"><div class="card-label">${c.label}</div><div class="card-value">${c.value.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })}</div><div class="card-count">${c.count} حركة</div></div>`).join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب — ${customerName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Tahoma,sans-serif;background:#fff;color:#1a1a1a;font-size:13px;direction:rtl;}.page{max-width:900px;margin:0 auto;padding:30px 40px;}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #B8860B;padding-bottom:16px;margin-bottom:20px;}.company-name{font-size:22px;font-weight:900;color:#B8860B;}.company-slogan{font-size:11px;color:#888;margin-top:3px;}.doc-title{text-align:left;}.doc-title h2{font-size:18px;font-weight:900;color:#222;}.doc-title .date{font-size:11px;color:#888;margin-top:4px;}.customer-box{background:#FFF8E1;border:1px solid #B8860B40;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;}.customer-name{font-size:17px;font-weight:900;color:#222;}.balance-badge{font-size:15px;font-weight:900;padding:6px 14px;border-radius:6px;}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;}.card{background:#F8F8F8;border:1px solid #E0E0E0;border-radius:8px;padding:10px 12px;text-align:center;}.card-label{font-size:10px;color:#888;margin-bottom:4px;}.card-value{font-size:13px;font-weight:900;color:#222;}.card-count{font-size:10px;color:#aaa;margin-top:2px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;}thead tr{background:#B8860B;color:#fff;}thead th{padding:10px 8px;font-weight:700;text-align:center;}tbody tr.even{background:#fff;}tbody tr.odd{background:#FAFAFA;}td{padding:8px;border-bottom:1px solid #F0F0F0;vertical-align:middle;}td.num{text-align:center;font-variant-numeric:tabular-nums;}td.mono{font-family:monospace;font-size:11px;color:#666;}td.bold{font-weight:900;}td.debit{color:#C62828;}td.credit{color:#2E7D32;}td.credit-neg{color:#1565C0;}tfoot tr{background:#333;color:#fff;font-weight:900;}tfoot td{padding:10px 8px;}@media print{body{background:#fff!important;}.page{padding:15px 20px;}}</style>
</head><body><div class="page"><div class="header"><div><div class="company-name">${companyName}</div><div class="company-slogan">${companySlogan}</div></div><div class="doc-title"><h2>كشف حساب عميل</h2><div class="date">تاريخ الطباعة: ${today}</div></div></div>
<div class="customer-box"><div><div class="customer-name">${customerName}</div>${customerPhone ? `<div style="font-size:12px;color:#666;margin-top:3px;">📞 ${customerPhone}</div>` : ''}</div><div class="balance-badge">${balanceLabel}</div></div>
<div class="cards">${cardsHtml}</div>
${rows.length === 0 ? '<p style="text-align:center;color:#aaa;padding:30px">لا توجد حركات مسجلة</p>' : `<table><thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>مدين (علينا)</th><th>دائن (له)</th><th>الرصيد</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td colspan="3">الإجمالي</td><td class="num debit">${totalDebit.toLocaleString('ar-EG-u-nu-latn',{minimumFractionDigits:2})}</td><td class="num credit">${totalCredit.toLocaleString('ar-EG-u-nu-latn',{minimumFractionDigits:2})}</td><td class="num">${balanceLabel}</td></tr></tfoot></table>`}
<div style="margin-top:30px;display:flex;justify-content:space-between;border-top:1px dashed #ccc;padding-top:16px;"><div style="text-align:center;"><div style="width:160px;border-bottom:1px solid #333;margin:0 auto 6px;"></div><div style="font-size:11px;color:#888;">المحاسب</div></div><div style="text-align:center;"><div style="width:160px;border-bottom:1px solid #333;margin:0 auto 6px;"></div><div style="font-size:11px;color:#888;">المدير</div></div><div style="text-align:center;"><div style="width:160px;border-bottom:1px solid #333;margin:0 auto 6px;"></div><div style="font-size:11px;color:#888;">العميل</div></div></div>
</div><script>window.onload=()=>{window.print();}</script></body></html>`;
  openPrintWindow(html, { width: 1000, height: 700 });
}

export function openWhatsApp(phone: string, customerName: string, balance: number, rowCount: number) {
  const balanceText = balance > 0 ? `${Math.abs(balance).toFixed(2)} ج.م مدين` : balance < 0 ? `${Math.abs(balance).toFixed(2)} ج.م دائن` : 'متسوّى';
  const text = `مرحباً ${customerName}،\n\nكشف حسابك لدينا:\n• عدد الحركات: ${rowCount}\n• الرصيد الحالي: ${balanceText}\n\nللتواصل والاستفسار، يرجى التواصل معنا.\nشكراً لتعاملكم معنا 🌟`;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const intlPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
  window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
}

export function useCustomerLedger({
  customerId, customerName, isSupplier, activeTab, reportFrom, reportTo, initialBalance,
}: {
  customerId: number; customerName: string; isSupplier: boolean;
  activeTab: string; reportFrom: string; reportTo: string; initialBalance: number;
}) {
  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: [`/api/reports/customer-statement`, customerId, reportFrom, reportTo],
    queryFn: () =>
      authFetch(api(`/api/reports/customer-statement?customer_id=${customerId}&date_from=${reportFrom}&date_to=${reportTo}`))
        .then((r) => { if (!r.ok) throw new Error('خطأ في جلب التقرير'); return r.json(); }),
    enabled: activeTab === 'report',
    staleTime: 30_000,
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<CustomerLedgerData>({
    queryKey: [`/api/customers/${customerId}/ledger`],
    queryFn: () =>
      authFetch(api(`/api/customers/${customerId}/ledger`)).then((r) => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
  });

  const { data: allSalesRaw } = useGetSales();
  const allSales = safeArray(allSalesRaw);
  const { data: allPurchasesRaw } = useGetPurchases();
  const allPurchases = safeArray(allPurchasesRaw);

  const { data: receiptVouchers = [] } = useQuery<ReceiptVoucher[]>({
    queryKey: ['/api/receipt-vouchers'],
    queryFn: () => authFetch(api('/api/receipt-vouchers')).then((r) => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
  });
  const { data: paymentVouchers = [] } = useQuery<PaymentVoucher[]>({
    queryKey: ['/api/payment-vouchers'],
    queryFn: () => authFetch(api('/api/payment-vouchers')).then((r) => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
  });
  const { data: salesReturns = [] } = useQuery<SaleReturn[]>({
    queryKey: ['/api/sales-returns'],
    queryFn: () => authFetch(api('/api/sales-returns')).then((r) => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
  });
  const { data: allTransactions = [] } = useQuery<FinancialTransaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: () => authFetch(api('/api/transactions')).then((r) => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    enabled: isSupplier,
  });
  const { data: allPurchaseReturns = [] } = useQuery<PurchaseReturn[]>({
    queryKey: ['/api/purchase-returns'],
    queryFn: () => authFetch(api('/api/purchase-returns')).then((r) => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    enabled: isSupplier,
  });

  const customerBalance = ledgerData ? ledgerData.balance : initialBalance;
  const reportStmt = reportData?.statement ?? [];

  const sales = allSales.filter((s) => s.customer_id === customerId || s.customer_name === customerName);
  const purchases = allPurchases.filter((p) => p.customer_id === customerId || p.customer_name === customerName);
  const supplierPayments = allTransactions.filter((t) => t.type === 'supplier_payment' && t.customer_id === customerId);
  const receipts = receiptVouchers.filter((v) => v.customer_id === customerId);
  const payments = paymentVouchers.filter((v) => v.customer_id === customerId);
  const returns_ = salesReturns.filter((r) => r.customer_id === customerId);
  const purchaseReturns = allPurchaseReturns.filter((r) => r.customer_id === customerId);

  const totalSales = sales.reduce((s, v) => s + Number(v.total_amount), 0);
  const totalPurchases = purchases.reduce((s, v) => s + Number(v.total_amount), 0);
  const totalReceipts = receipts.reduce((s, v) => s + Number(v.amount), 0);
  const totalPayments = payments.reduce((s, v) => s + Number(v.amount), 0);
  const totalReturns = returns_.reduce((s, v) => s + Number(v.total_amount), 0);
  const totalSupplierPayments = supplierPayments.reduce((s, v) => s + Number(v.amount), 0);
  const totalPurchaseReturns = purchaseReturns.reduce((s, v) => s + Number(v.total_amount), 0);

  const rawRows: Omit<TxRow, 'balance'>[] = [];
  sales.forEach((s) => rawRows.push({ date: s.created_at, type: 'sale', label: 'فاتورة مبيعات', ref: s.invoice_no, debit: Number(s.remaining_amount), credit: 0 }));
  purchases.forEach((p) => rawRows.push({ date: p.created_at, type: 'purchase', label: 'فاتورة مشتريات', ref: p.invoice_no ?? `P-${p.id}`, debit: 0, credit: Number(p.remaining_amount ?? p.total_amount) }));
  receipts.forEach((v) => rawRows.push({ date: v.date ?? v.created_at, type: 'receipt', label: 'سند قبض', ref: v.voucher_no, debit: 0, credit: Number(v.amount) }));
  payments.forEach((v) => rawRows.push({ date: v.date ?? v.created_at, type: 'payment', label: 'سند توريد', ref: v.voucher_no, debit: Number(v.amount), credit: 0 }));
  supplierPayments.forEach((v) => rawRows.push({ date: v.date ?? v.created_at, type: 'supplier_payment', label: 'تسديد دفعة', ref: `SP-${v.id}`, debit: Number(v.amount), credit: 0 }));
  purchaseReturns.forEach((r) => rawRows.push({ date: r.date ?? r.created_at, type: 'purchase_return', label: 'مرتجع مشتريات', ref: r.return_no, debit: Number(r.total_amount), credit: 0 }));
  returns_.filter((r) => r.refund_type !== 'cash').forEach((r) => rawRows.push({ date: r.date ?? r.created_at, type: 'return_credit', label: 'مرتجع مبيعات (رصيد)', ref: r.return_no, debit: 0, credit: Number(r.total_amount) }));
  returns_.filter((r) => r.refund_type === 'cash').forEach((r) => rawRows.push({ date: r.date ?? r.created_at, type: 'return_cash', label: 'مرتجع مبيعات (نقدي)', ref: r.return_no, debit: 0, credit: Number(r.total_amount) }));

  rawRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  const rowsWithBalance: TxRow[] = rawRows.map((r) => { running += r.debit - r.credit; return { ...r, balance: running }; });

  const summaryCards = [
    { label: 'المبيعات', value: totalSales, count: sales.length },
    { label: 'القبض', value: totalReceipts, count: receipts.length },
    ...(totalPurchases > 0 ? [{ label: 'المشتريات', value: totalPurchases, count: purchases.length }] : []),
    ...(totalPayments > 0 ? [{ label: 'التوريد', value: totalPayments, count: payments.length }] : []),
    ...(totalSupplierPayments > 0 ? [{ label: 'تسديد دفعة', value: totalSupplierPayments, count: supplierPayments.length }] : []),
    ...(totalPurchaseReturns > 0 ? [{ label: 'مرتجع مشتريات', value: totalPurchaseReturns, count: purchaseReturns.length }] : []),
    ...(totalReturns > 0 ? [{ label: 'مرتجع مبيعات', value: totalReturns, count: returns_.length }] : []),
  ];

  return {
    ledgerData, ledgerLoading, reportData, reportLoading, reportStmt, customerBalance,
    rowsWithBalance, summaryCards,
    sales, purchases, receipts, payments, returns_, purchaseReturns, supplierPayments,
    totalSales, totalPurchases, totalReceipts, totalPayments, totalReturns, totalSupplierPayments, totalPurchaseReturns,
  };
}
