import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ArrowUpFromLine,
  ArrowDownToLine,
  Printer,
  MessageCircle,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useGetSales, useGetPurchases } from '@workspace/api-client-react';
import { safeArray } from '@/lib/safe-data';
import { openPrintWindow } from '@/lib/print-utils';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

/* ─── أنواع البيانات ─── */
interface ReceiptVoucher {
  id: number;
  voucher_no: string;
  customer_id: number | null;
  amount: number;
  safe_name: string;
  date: string;
  notes: string | null;
  created_at: string;
}
interface PaymentVoucher {
  id: number;
  voucher_no: string;
  customer_id: number | null;
  amount: number;
  safe_name: string;
  date: string;
  notes: string | null;
  created_at: string;
}
interface SaleReturn {
  id: number;
  return_no: string;
  customer_id: number | null;
  customer_name: string | null;
  total_amount: number;
  refund_type: string | null;
  safe_name: string | null;
  date: string | null;
  reason: string | null;
  created_at: string;
}
interface PurchaseReturn {
  id: number;
  return_no: string;
  customer_id: number | null;
  customer_name: string | null;
  supplier_name: string | null;
  total_amount: number;
  date: string | null;
  created_at: string;
}
interface FinancialTransaction {
  id: number;
  type: string;
  customer_id: number | null;
  amount: number;
  direction: string;
  description: string | null;
  date: string | null;
  created_at: string;
}

/* ─── دالة طباعة كشف الحساب كـ PDF ─── */
function printCustomerStatement(opts: {
  customerName: string;
  customerPhone: string;
  customerBalance: number;
  rows: {
    date: string;
    label: string;
    ref: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  summaryCards: { label: string; value: number; count: number }[];
  companyName: string;
  companySlogan: string;
}) {
  const {
    customerName,
    customerPhone,
    customerBalance,
    rows,
    summaryCards,
    companyName,
    companySlogan,
  } = opts;
  const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rowsHtml = rows
    .map(
      (r, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${r.date ? r.date.split('T')[0] : '—'}</td>
      <td>${r.label}</td>
      <td class="mono">${r.ref}</td>
      <td class="num ${r.debit > 0 ? 'debit' : ''}">${r.debit > 0 ? r.debit.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 }) : '—'}</td>
      <td class="num ${r.credit > 0 ? 'credit' : ''}">${r.credit > 0 ? r.credit.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 }) : '—'}</td>
      <td class="num bold ${r.balance > 0 ? 'debit' : r.balance < 0 ? 'credit-neg' : ''}">${
        r.balance !== 0
          ? `${Math.abs(r.balance).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} ${r.balance > 0 ? 'عليه' : 'له'}`
          : 'صفر'
      }</td>
    </tr>
  `
    )
    .join('');

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  const balanceLabel =
    customerBalance > 0
      ? `${Math.abs(customerBalance).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} — العميل مدين`
      : customerBalance < 0
        ? `${Math.abs(customerBalance).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} — دائن للعميل`
        : 'متسوّى (صفر)';

  const cardsHtml = summaryCards
    .map(
      (c) => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value">${c.value.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })}</div>
      <div class="card-count">${c.count} حركة</div>
    </div>
  `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب — ${customerName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #1a1a1a; font-size: 13px; direction: rtl; }
    .page { max-width: 900px; margin: 0 auto; padding: 30px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #B8860B; padding-bottom: 16px; margin-bottom: 20px; }
    .company-name { font-size: 22px; font-weight: 900; color: #B8860B; }
    .company-slogan { font-size: 11px; color: #888; margin-top: 3px; }
    .doc-title { text-align: left; }
    .doc-title h2 { font-size: 18px; font-weight: 900; color: #222; }
    .doc-title .date { font-size: 11px; color: #888; margin-top: 4px; }
    .customer-box { background: #FFF8E1; border: 1px solid #B8860B40; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .customer-name { font-size: 17px; font-weight: 900; color: #222; }
    .customer-phone { font-size: 12px; color: #666; margin-top: 3px; }
    .balance-badge { font-size: 15px; font-weight: 900; padding: 6px 14px; border-radius: 6px; }
    .balance-debit { background: #FFF3E0; color: #E65100; border: 1px solid #FFCC80; }
    .balance-credit { background: #E8F5E9; color: #2E7D32; border: 1px solid #A5D6A7; }
    .balance-zero { background: #F5F5F5; color: #757575; border: 1px solid #E0E0E0; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .card { background: #F8F8F8; border: 1px solid #E0E0E0; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .card-label { font-size: 10px; color: #888; margin-bottom: 4px; }
    .card-value { font-size: 13px; font-weight: 900; color: #222; }
    .card-count { font-size: 10px; color: #aaa; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    thead tr { background: #B8860B; color: #fff; }
    thead th { padding: 10px 8px; font-weight: 700; text-align: center; }
    thead th:first-child, thead th:nth-child(2), thead th:nth-child(3) { text-align: right; }
    tbody tr.even { background: #fff; }
    tbody tr.odd { background: #FAFAFA; }
    tbody tr:hover { background: #FFF8E1; }
    td { padding: 8px 8px; border-bottom: 1px solid #F0F0F0; vertical-align: middle; }
    td.num { text-align: center; font-variant-numeric: tabular-nums; }
    td.mono { font-family: monospace; font-size: 11px; color: #666; }
    td.bold { font-weight: 900; }
    td.debit { color: #C62828; }
    td.credit { color: #2E7D32; }
    td.credit-neg { color: #1565C0; }
    tfoot tr { background: #333; color: #fff; font-weight: 900; }
    tfoot td { padding: 10px 8px; }
    tfoot td.num { text-align: center; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px dashed #ccc; padding-top: 16px; }
    .seal { text-align: center; }
    .seal-line { width: 160px; border-bottom: 1px solid #333; margin: 0 auto 6px; }
    .seal-label { font-size: 11px; color: #888; }
    @media print {
      body { background: #fff !important; }
      .page { padding: 15px 20px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-slogan">${companySlogan}</div>
      </div>
      <div class="doc-title">
        <h2>كشف حساب عميل</h2>
        <div class="date">تاريخ الطباعة: ${today}</div>
      </div>
    </div>

    <div class="customer-box">
      <div>
        <div class="customer-name">${customerName}</div>
        ${customerPhone ? `<div class="customer-phone">📞 ${customerPhone}</div>` : ''}
      </div>
      <div class="balance-badge ${customerBalance > 0 ? 'balance-debit' : customerBalance < 0 ? 'balance-credit' : 'balance-zero'}">
        الرصيد: ${balanceLabel}
      </div>
    </div>

    <div class="cards">${cardsHtml}</div>

    ${
      rows.length === 0
        ? '<p style="text-align:center;color:#aaa;padding:30px">لا توجد حركات مسجلة</p>'
        : `
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>البيان</th>
          <th>المرجع</th>
          <th>مدين (علينا)</th>
          <th>دائن (له)</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">الإجمالي</td>
          <td class="num debit">${totalDebit.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })}</td>
          <td class="num credit">${totalCredit.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })}</td>
          <td class="num">${balanceLabel}</td>
        </tr>
      </tfoot>
    </table>`
    }

    <div class="footer">
      <div class="seal"><div class="seal-line"></div><div class="seal-label">المحاسب</div></div>
      <div class="seal"><div class="seal-line"></div><div class="seal-label">المدير</div></div>
      <div class="seal"><div class="seal-line"></div><div class="seal-label">العميل</div></div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  openPrintWindow(html, { width: 1000, height: 700 });
}

/* ─── دالة واتساب ─── */
function openWhatsApp(phone: string, customerName: string, balance: number, rowCount: number) {
  const balanceText =
    balance > 0
      ? `${Math.abs(balance).toFixed(2)} ج.م مدين`
      : balance < 0
        ? `${Math.abs(balance).toFixed(2)} ج.م دائن`
        : 'متسوّى';
  const text = `مرحباً ${customerName}،\n\nكشف حسابك لدينا:\n• عدد الحركات: ${rowCount}\n• الرصيد الحالي: ${balanceText}\n\nللتواصل والاستفسار، يرجى التواصل معنا.\nشكراً لتعاملكم معنا 🌟`;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const intlPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
  window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
}

/* ─── نوع دفتر الأستاذ ─── */
interface LedgerEntry {
  id: number;
  type: string;
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_no: string | null;
  description: string | null;
  date: string | null;
  created_at: string;
}
interface CustomerLedger {
  customer_id: number;
  customer_name: string;
  balance: number;
  entries: LedgerEntry[];
}

const LEDGER_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  sale: {
    label: 'فاتورة مبيعات',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  sale_return: {
    label: 'مرتجع مبيعات',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  sale_cancel: {
    label: 'إلغاء فاتورة',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  receipt_voucher: {
    label: 'سند قبض',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  payment: { label: 'سداد مباشر', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  purchase: {
    label: 'مشتريات منه',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  supplier_payment: {
    label: 'تسديد دفعة',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
  adjustment: { label: 'تسوية', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
  opening_balance: {
    label: 'رصيد افتتاحي',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
  },
};

/* ─── كشف الحساب ─── */
export function CustomerStatementModal({
  customerId,
  customerName,
  customerPhone,
  customerBalance: initialBalance,
  isSupplier,
  onClose,
  safes,
}: {
  customerId: number;
  customerName: string;
  customerPhone: string;
  customerBalance: number;
  isSupplier: boolean;
  onClose: () => void;
  safes: Array<{ id: number; name: string; balance: number }>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'statement' | 'ledger' | 'report'>('ledger');
  const [showDirectPayment, setShowDirectPayment] = useState(false);
  const [directPayForm, setDirectPayForm] = useState({ amount: '', safe_id: '', notes: '' });

  const thisMonthStart = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportFrom, setReportFrom] = useState(thisMonthStart);
  const [reportTo, setReportTo] = useState(todayStr);

  interface ReportStmtRow {
    date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    reference_no?: string | null;
  }
  interface ReportData {
    customer: { id: number; name: string; balance: number };
    opening_balance: number;
    statement: ReportStmtRow[];
    closing_balance: number;
  }
  const REPORT_TYPE_MAP: Record<string, { label: string; cls: string }> = {
    opening_balance: { label: 'رصيد أول المدة', cls: 'text-amber-400' },
    sale: { label: 'فاتورة مبيعات', cls: 'text-blue-400' },
    receipt: { label: 'سند قبض', cls: 'text-emerald-400' },
    sale_return: { label: 'مرتجع مبيعات', cls: 'text-orange-400' },
  };

  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: [`/api/reports/customer-statement`, customerId, reportFrom, reportTo],
    queryFn: () =>
      authFetch(
        api(
          `/api/reports/customer-statement?customer_id=${customerId}&date_from=${reportFrom}&date_to=${reportTo}`
        )
      ).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب التقرير');
        return r.json();
      }),
    enabled: activeTab === 'report',
    staleTime: 30_000,
  });
  const reportStmt = reportData?.statement ?? [];

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<CustomerLedger>({
    queryKey: [`/api/customers/${customerId}/ledger`],
    queryFn: () =>
      authFetch(api(`/api/customers/${customerId}/ledger`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const customerBalance = ledgerData ? ledgerData.balance : initialBalance;

  const directPayMutation = useMutation({
    mutationFn: async (data: { amount: string; safe_id: string; notes: string }) => {
      const r = await authFetch(api(`/api/customers/${customerId}/payment`), {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(data.amount),
          safe_id: data.safe_id ? parseInt(data.safe_id) : undefined,
          notes: data.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في تسجيل السداد');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تسجيل السداد في دفتر الأستاذ' });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/ledger`] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setShowDirectPayment(false);
      setDirectPayForm({ amount: '', safe_id: '', notes: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const { data: allSalesRaw } = useGetSales();
  const allSales = safeArray(allSalesRaw);
  const { data: allPurchasesRaw } = useGetPurchases();
  const allPurchases = safeArray(allPurchasesRaw);
  const { data: receiptVouchers = [] } = useQuery<ReceiptVoucher[]>({
    queryKey: ['/api/receipt-vouchers'],
    queryFn: () =>
      authFetch(api('/api/receipt-vouchers')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });
  const { data: paymentVouchers = [] } = useQuery<PaymentVoucher[]>({
    queryKey: ['/api/payment-vouchers'],
    queryFn: () =>
      authFetch(api('/api/payment-vouchers')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });
  const { data: salesReturns = [] } = useQuery<SaleReturn[]>({
    queryKey: ['/api/sales-returns'],
    queryFn: () =>
      authFetch(api('/api/sales-returns')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });
  const { data: allTransactions = [] } = useQuery<FinancialTransaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: () =>
      authFetch(api('/api/transactions')).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
    enabled: isSupplier,
  });
  const { data: allPurchaseReturns = [] } = useQuery<PurchaseReturn[]>({
    queryKey: ['/api/purchase-returns'],
    queryFn: () =>
      authFetch(api('/api/purchase-returns')).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
    enabled: isSupplier,
  });

  const sales = allSales.filter(
    (s) => s.customer_id === customerId || s.customer_name === customerName
  );
  const purchases = allPurchases.filter(
    (p) => p.customer_id === customerId || p.customer_name === customerName
  );
  const supplierPayments = allTransactions.filter(
    (t) => t.type === 'supplier_payment' && t.customer_id === customerId
  );
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

  type TxRow = {
    date: string;
    type: string;
    label: string;
    ref: string;
    debit: number;
    credit: number;
  };
  const rows: TxRow[] = [];

  sales.forEach((s) =>
    rows.push({
      date: s.created_at,
      type: 'sale',
      label: 'فاتورة مبيعات',
      ref: s.invoice_no,
      debit: Number(s.remaining_amount),
      credit: 0,
    })
  );
  purchases.forEach((p) =>
    rows.push({
      date: p.created_at,
      type: 'purchase',
      label: 'فاتورة مشتريات',
      ref: p.invoice_no ?? `P-${p.id}`,
      debit: 0,
      credit: Number(p.remaining_amount ?? p.total_amount),
    })
  );
  receipts.forEach((v) =>
    rows.push({
      date: v.date ?? v.created_at,
      type: 'receipt',
      label: 'سند قبض',
      ref: v.voucher_no,
      debit: 0,
      credit: Number(v.amount),
    })
  );
  payments.forEach((v) =>
    rows.push({
      date: v.date ?? v.created_at,
      type: 'payment',
      label: 'سند توريد',
      ref: v.voucher_no,
      debit: Number(v.amount),
      credit: 0,
    })
  );
  supplierPayments.forEach((v) =>
    rows.push({
      date: v.date ?? v.created_at,
      type: 'supplier_payment',
      label: 'تسديد دفعة',
      ref: `SP-${v.id}`,
      debit: Number(v.amount),
      credit: 0,
    })
  );
  purchaseReturns.forEach((r) =>
    rows.push({
      date: r.date ?? r.created_at,
      type: 'purchase_return',
      label: 'مرتجع مشتريات',
      ref: r.return_no,
      debit: Number(r.total_amount),
      credit: 0,
    })
  );
  returns_
    .filter((r) => r.refund_type !== 'cash')
    .forEach((r) =>
      rows.push({
        date: r.date ?? r.created_at,
        type: 'return_credit',
        label: 'مرتجع مبيعات (رصيد)',
        ref: r.return_no,
        debit: 0,
        credit: Number(r.total_amount),
      })
    );
  returns_
    .filter((r) => r.refund_type === 'cash')
    .forEach((r) =>
      rows.push({
        date: r.date ?? r.created_at,
        type: 'return_cash',
        label: 'مرتجع مبيعات (نقدي)',
        ref: r.return_no,
        debit: 0,
        credit: Number(r.total_amount),
      })
    );

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const rowsWithBalance = rows.map((r) => {
    running += r.debit - r.credit;
    return { ...r, balance: running };
  });

  const typeConfig: Record<string, { color: string; bg: string; icon: string }> = {
    sale: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: '↑' },
    purchase: { color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: '↓' },
    receipt: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      icon: '→',
    },
    payment: { color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: '←' },
    supplier_payment: {
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      icon: '⬆',
    },
    purchase_return: {
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      icon: '↺',
    },
    return_credit: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: '↩' },
    return_cash: { color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', icon: '↩' },
  };

  const summaryCards = [
    { label: 'المبيعات', value: totalSales, count: sales.length },
    { label: 'القبض', value: totalReceipts, count: receipts.length },
    ...(totalPurchases > 0
      ? [{ label: 'المشتريات', value: totalPurchases, count: purchases.length }]
      : []),
    ...(totalPayments > 0
      ? [{ label: 'التوريد', value: totalPayments, count: payments.length }]
      : []),
    ...(totalSupplierPayments > 0
      ? [{ label: 'تسديد دفعة', value: totalSupplierPayments, count: supplierPayments.length }]
      : []),
    ...(totalPurchaseReturns > 0
      ? [{ label: 'مرتجع مشتريات', value: totalPurchaseReturns, count: purchaseReturns.length }]
      : []),
    ...(totalReturns > 0
      ? [{ label: 'مرتجع مبيعات', value: totalReturns, count: returns_.length }]
      : []),
  ];

  const settings = JSON.parse(localStorage.getItem('halal_erp_settings') || '{}');
  const companyName = settings.companyName || 'مُحكم - MUHKAM ERP';
  const companySlogan = settings.companySlogan || '';

  const handlePrint = () => {
    printCustomerStatement({
      customerName,
      customerPhone,
      customerBalance,
      rows: rowsWithBalance,
      summaryCards,
      companyName,
      companySlogan,
    });
  };

  const handleWhatsApp = () => {
    if (!customerPhone) {
      toast({ title: 'لا يوجد رقم هاتف لهذا العميل', variant: 'destructive' });
      return;
    }
    openWhatsApp(customerPhone, customerName, customerBalance, rowsWithBalance.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl p-0 w-full max-w-4xl border border-white/10 shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-white">كشف حساب</h3>
              {isSupplier && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  يتم الشراء منه
                </span>
              )}
            </div>
            <p className="text-amber-400 font-bold text-lg mt-0.5">{customerName}</p>
            {customerPhone && <p className="text-white/40 text-xs mt-0.5">📞 {customerPhone}</p>}
            {isSupplier ? (
              <div className="mt-2 space-y-0.5 text-xs">
                <p className="text-white/50">
                  إجمالي المبيعات له:{' '}
                  <span className="text-amber-400 font-bold">{formatCurrency(totalSales)}</span>
                </p>
                <p className="text-white/50">
                  إجمالي المشتريات منه:{' '}
                  <span className="text-purple-400 font-bold">
                    {formatCurrency(totalPurchases)}
                  </span>
                </p>
                {totalPurchaseReturns > 0 && (
                  <p className="text-white/50">
                    مرتجع مشتريات:{' '}
                    <span className="text-violet-400 font-bold">
                      {formatCurrency(totalPurchaseReturns)}
                    </span>
                  </p>
                )}
                <p className="text-white/50">
                  المدفوعات والمقبوضات:{' '}
                  <span className="text-emerald-400 font-bold">
                    {formatCurrency(totalReceipts + totalSupplierPayments + totalPayments)}
                  </span>
                </p>
                <p
                  className={`font-bold text-sm mt-1 ${customerBalance > 0 ? 'text-green-400' : customerBalance < 0 ? 'text-red-400' : 'text-white/40'}`}
                >
                  الرصيد الصافي:{' '}
                  {customerBalance > 0
                    ? `عليه لنا ${formatCurrency(customerBalance)}`
                    : customerBalance < 0
                      ? `له علينا ${formatCurrency(Math.abs(customerBalance))}`
                      : 'متسوّى'}
                </p>
              </div>
            ) : (
              <p
                className={`text-sm mt-1 font-semibold ${customerBalance > 0 ? 'text-yellow-400' : customerBalance < 0 ? 'text-orange-400' : 'text-white/40'}`}
              >
                الرصيد:{' '}
                {customerBalance > 0
                  ? `${formatCurrency(customerBalance)} — العميل مدين`
                  : customerBalance < 0
                    ? `${formatCurrency(Math.abs(customerBalance))} — دائن للعميل`
                    : 'متسوّى'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsApp}
              title={customerPhone ? 'إرسال ملخص الكشف على واتساب' : 'لا يوجد رقم هاتف مسجل'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${customerPhone ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30' : 'bg-white/5 text-white/20 border-white/10 cursor-not-allowed'}`}
            >
              <MessageCircle className="w-4 h-4" />
              واتساب
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-2 rounded-xl text-sm font-bold border border-blue-500/30 transition-all"
            >
              <Printer className="w-4 h-4" />
              PDF / طباعة
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
              <p className="text-amber-400 text-xs mb-1 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" /> إجمالي المبيعات
              </p>
              <p className="text-white font-black">{formatCurrency(totalSales)}</p>
              <p className="text-white/40 text-xs">{sales.length} فاتورة</p>
            </div>
            {totalPurchases > 0 && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 text-center">
                <p className="text-purple-400 text-xs mb-1 flex items-center justify-center gap-1">
                  <TrendingDown className="w-3 h-3" /> مشترياتنا منه
                </p>
                <p className="text-white font-black">{formatCurrency(totalPurchases)}</p>
                <p className="text-white/40 text-xs">{purchases.length} فاتورة</p>
              </div>
            )}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
              <p className="text-emerald-400 text-xs mb-1 flex items-center justify-center gap-1">
                <ArrowDownToLine className="w-3 h-3" /> إجمالي القبض
              </p>
              <p className="text-white font-black">{formatCurrency(totalReceipts)}</p>
              <p className="text-white/40 text-xs">{receipts.length} سند</p>
            </div>
            {totalPayments > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 text-center">
                <p className="text-orange-400 text-xs mb-1 flex items-center justify-center gap-1">
                  <ArrowUpFromLine className="w-3 h-3" /> إجمالي التوريد
                </p>
                <p className="text-white font-black">{formatCurrency(totalPayments)}</p>
                <p className="text-white/40 text-xs">{payments.length} سند</p>
              </div>
            )}
            {totalReturns > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
                <p className="text-blue-400 text-xs mb-1 flex items-center justify-center gap-1">
                  <RotateCcw className="w-3 h-3" /> إجمالي المرتجعات
                </p>
                <p className="text-white font-black">{formatCurrency(totalReturns)}</p>
                <p className="text-white/40 text-xs">{returns_.length} مرتجع</p>
              </div>
            )}
            {isSupplier ? (
              <div
                className={`${customerBalance > 0 ? 'bg-green-500/10 border-green-500/20' : customerBalance < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'} border rounded-2xl p-3 text-center`}
              >
                <p
                  className={`text-xs mb-1 ${customerBalance > 0 ? 'text-green-400' : customerBalance < 0 ? 'text-red-400' : 'text-white/40'}`}
                >
                  الرصيد الصافي
                </p>
                <p
                  className={`font-black ${customerBalance > 0 ? 'text-green-400' : customerBalance < 0 ? 'text-red-400' : 'text-white/40'}`}
                >
                  {formatCurrency(Math.abs(customerBalance))}
                </p>
                <p className="text-white/40 text-xs">
                  {customerBalance > 0 ? 'عليه لنا' : customerBalance < 0 ? 'له علينا' : 'متسوّى'}
                </p>
              </div>
            ) : (
              <div
                className={`${customerBalance > 0 ? 'bg-amber-500/10 border-amber-500/20' : customerBalance < 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/10'} border rounded-2xl p-3 text-center`}
              >
                <p
                  className={`text-xs mb-1 ${customerBalance > 0 ? 'text-amber-400' : customerBalance < 0 ? 'text-blue-400' : 'text-white/40'}`}
                >
                  الرصيد الصافي
                </p>
                <p
                  className={`font-black ${customerBalance > 0 ? 'text-amber-400' : customerBalance < 0 ? 'text-blue-400' : 'text-white/40'}`}
                >
                  {formatCurrency(Math.abs(customerBalance))}
                </p>
                <p className="text-white/40 text-xs">
                  {customerBalance > 0 ? 'عليه' : customerBalance < 0 ? 'دائن له' : 'متسوّى'}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-1 rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ledger' ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
            >
              📒 دفتر الأستاذ
            </button>
            <button
              onClick={() => setActiveTab('statement')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'statement' ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
            >
              📋 كشف تفصيلي
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'report' ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'}`}
            >
              📊 تقرير بالفترة
            </button>
          </div>

          {activeTab === 'ledger' && (
            <div className="space-y-4">
              {!isSupplier && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDirectPayment((v) => !v)}
                    className="erp-btn erp-btn-primary text-sm px-4 py-2"
                  >
                    💳 تسجيل سداد مباشر
                  </button>
                </div>
              )}
              {showDirectPayment && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    directPayMutation.mutate(directPayForm);
                  }}
                  className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3"
                >
                  <p className="font-bold text-cyan-400">💳 تسجيل سداد مباشر في دفتر الأستاذ</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">المبلغ (ج.م)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={directPayForm.amount}
                        onChange={(e) =>
                          setDirectPayForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        placeholder="0.00"
                        className="erp-input w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">الخزينة (اختياري)</label>
                      <select
                        value={directPayForm.safe_id}
                        onChange={(e) =>
                          setDirectPayForm((f) => ({ ...f, safe_id: e.target.value }))
                        }
                        className="erp-input w-full"
                      >
                        <option value="">— بدون خزينة —</option>
                        {safes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">ملاحظات</label>
                    <input
                      type="text"
                      value={directPayForm.notes}
                      onChange={(e) => setDirectPayForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="سبب السداد..."
                      className="erp-input w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={directPayMutation.isPending}
                      className="erp-btn erp-btn-primary flex-1"
                    >
                      {directPayMutation.isPending ? 'جاري التسجيل...' : 'تأكيد السداد'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDirectPayment(false)}
                      className="erp-btn flex-1"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              {ledgerLoading ? (
                <div className="text-center py-8 text-white/40">جاري تحميل دفتر الأستاذ...</div>
              ) : !ledgerData || ledgerData.entries.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  <p className="text-4xl mb-2">📒</p>
                  <p>لا توجد حركات مسجلة في دفتر الأستاذ</p>
                  <p className="text-xs mt-1 text-white/20">
                    ستظهر هنا الفواتير والإيصالات والمرتجعات تلقائياً
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="p-3 text-white/60 font-semibold">التاريخ</th>
                        <th className="p-3 text-white/60 font-semibold">نوع الحركة</th>
                        <th className="p-3 text-white/60 font-semibold">البيان</th>
                        <th className="p-3 text-white/60 font-semibold text-center">مدين</th>
                        <th className="p-3 text-white/60 font-semibold text-center">دائن</th>
                        <th className="p-3 text-white/60 font-semibold text-center">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData.entries.map((entry) => {
                        const cfg = LEDGER_TYPE_LABELS[entry.type] ?? {
                          label: entry.type,
                          color: 'text-white/60',
                          bg: 'bg-white/5 border-white/10',
                        };
                        const isDebit = entry.amount > 0;
                        return (
                          <tr key={entry.id} className="border-b border-white/5 erp-table-row">
                            <td className="p-3 text-white/50 text-xs whitespace-nowrap">
                              {entry.date ?? '—'}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="p-3 text-white/60 text-xs">
                              {entry.description ?? entry.reference_no ?? '—'}
                            </td>
                            <td className="p-3 text-center font-bold text-amber-400">
                              {isDebit ? formatCurrency(entry.amount) : '—'}
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-400">
                              {!isDebit ? formatCurrency(Math.abs(entry.amount)) : '—'}
                            </td>
                            <td className="p-3 text-center font-black">
                              <span
                                className={
                                  entry.balance_after > 0
                                    ? 'text-amber-400'
                                    : entry.balance_after < 0
                                      ? 'text-blue-400'
                                      : 'text-white/40'
                                }
                              >
                                {entry.balance_after !== 0
                                  ? `${formatCurrency(Math.abs(entry.balance_after))} ${entry.balance_after > 0 ? 'عليه' : 'دائن'}`
                                  : 'صفر'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-white/5 border-t border-white/10">
                      <tr>
                        <td colSpan={3} className="p-3 text-white/60 font-bold text-right">
                          الرصيد الحالي
                        </td>
                        <td className="p-3 text-center font-black text-amber-400">
                          {formatCurrency(
                            ledgerData.entries
                              .filter((e) => e.amount > 0)
                              .reduce((s, e) => s + e.amount, 0)
                          )}
                        </td>
                        <td className="p-3 text-center font-black text-emerald-400">
                          {formatCurrency(
                            Math.abs(
                              ledgerData.entries
                                .filter((e) => e.amount < 0)
                                .reduce((s, e) => s + e.amount, 0)
                            )
                          )}
                        </td>
                        <td className="p-3 text-center font-black">
                          <span
                            className={
                              ledgerData.balance > 0
                                ? 'text-amber-400'
                                : ledgerData.balance < 0
                                  ? 'text-blue-400'
                                  : 'text-white/40'
                            }
                          >
                            {ledgerData.balance !== 0
                              ? `${formatCurrency(Math.abs(ledgerData.balance))} ${ledgerData.balance > 0 ? 'عليه' : 'دائن'}`
                              : 'صفر'}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'statement' && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <span
                    key={key}
                    className={`px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.icon}{' '}
                    {key === 'sale'
                      ? 'مبيعات'
                      : key === 'purchase'
                        ? 'مشتريات'
                        : key === 'receipt'
                          ? 'قبض'
                          : key === 'payment'
                            ? 'توريد'
                            : key === 'supplier_payment'
                              ? 'تسديد دفعة'
                              : key === 'purchase_return'
                                ? 'مرتجع مشتريات'
                                : key === 'return_credit'
                                  ? 'مرتجع مبيعات'
                                  : 'مرتجع نقدي'}
                  </span>
                ))}
              </div>

              {rowsWithBalance.length === 0 ? (
                <div className="text-center py-12 text-white/30">
                  لا توجد حركات مسجلة لهذا العميل
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="p-3 text-white/60 font-semibold">التاريخ</th>
                        <th className="p-3 text-white/60 font-semibold">البيان</th>
                        <th className="p-3 text-white/60 font-semibold">المرجع</th>
                        <th className="p-3 text-white/60 font-semibold text-center">مدين</th>
                        <th className="p-3 text-white/60 font-semibold text-center">دائن</th>
                        <th className="p-3 text-white/60 font-semibold text-center">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsWithBalance.map((r, i) => {
                        const cfg = typeConfig[r.type] || typeConfig['sale'];
                        return (
                          <tr key={`${r.type}-${r.ref ?? ''}-${i}`} className="border-b border-white/5 erp-table-row">
                            <td className="p-3 text-white/50 text-xs whitespace-nowrap">
                              {r.date ? r.date.split('T')[0] : '—'}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color}`}
                              >
                                {cfg.icon} {r.label}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-white/60 text-xs">{r.ref}</td>
                            <td className="p-3 text-center font-bold text-amber-400">
                              {r.debit > 0 ? formatCurrency(r.debit) : '—'}
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-400">
                              {r.credit > 0 ? formatCurrency(r.credit) : '—'}
                            </td>
                            <td className="p-3 text-center font-black">
                              {isSupplier ? (
                                <span
                                  className={
                                    r.balance > 0
                                      ? 'text-green-400'
                                      : r.balance < 0
                                        ? 'text-red-400'
                                        : 'text-white/40'
                                  }
                                >
                                  {r.balance !== 0
                                    ? `${formatCurrency(Math.abs(r.balance))} ${r.balance > 0 ? 'عليه لنا' : 'له علينا'}`
                                    : 'صفر'}
                                </span>
                              ) : (
                                <span
                                  className={
                                    r.balance > 0
                                      ? 'text-yellow-400'
                                      : r.balance < 0
                                        ? 'text-blue-400'
                                        : 'text-white/40'
                                  }
                                >
                                  {r.balance !== 0
                                    ? `${formatCurrency(Math.abs(r.balance))} ${r.balance > 0 ? 'عليه' : 'دائن'}`
                                    : 'صفر'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-white/5 border-t border-white/10">
                      <tr>
                        <td colSpan={3} className="p-3 text-white/60 font-bold text-right">
                          الإجمالي
                        </td>
                        <td className="p-3 text-center font-black text-amber-400">
                          {formatCurrency(rowsWithBalance.reduce((s, r) => s + r.debit, 0))}
                        </td>
                        <td className="p-3 text-center font-black text-emerald-400">
                          {formatCurrency(rowsWithBalance.reduce((s, r) => s + r.credit, 0))}
                        </td>
                        <td className="p-3 text-center font-black">
                          {isSupplier ? (
                            <span
                              className={
                                customerBalance > 0
                                  ? 'text-green-400'
                                  : customerBalance < 0
                                    ? 'text-red-400'
                                    : 'text-white/40'
                              }
                            >
                              {formatCurrency(Math.abs(customerBalance))}{' '}
                              {customerBalance > 0
                                ? 'عليه لنا'
                                : customerBalance < 0
                                  ? 'له علينا'
                                  : ''}
                            </span>
                          ) : (
                            <span
                              className={
                                customerBalance > 0
                                  ? 'text-yellow-400'
                                  : customerBalance < 0
                                    ? 'text-blue-400'
                                    : 'text-white/40'
                              }
                            >
                              {formatCurrency(Math.abs(customerBalance))}{' '}
                              {customerBalance > 0 ? 'عليه' : customerBalance < 0 ? 'دائن' : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/40 text-xs font-bold">من</span>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="glass-input rounded-xl px-3 py-1.5 text-sm text-white"
                />
                <span className="text-white/40 text-xs font-bold">إلى</span>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="glass-input rounded-xl px-3 py-1.5 text-sm text-white"
                />
              </div>

              {reportData && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-panel rounded-2xl p-4 border border-white/5">
                    <p className="text-white/40 text-xs mb-1">رصيد أول المدة</p>
                    <p
                      className={`text-lg font-black ${reportData.opening_balance >= 0 ? 'text-amber-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(reportData.opening_balance)}
                    </p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4 border border-white/5">
                    <p className="text-white/40 text-xs mb-1">رصيد الختام</p>
                    <p
                      className={`text-lg font-black ${reportData.closing_balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(reportData.closing_balance)}
                    </p>
                  </div>
                  <div className="glass-panel rounded-2xl p-4 border border-white/5">
                    <p className="text-white/40 text-xs mb-1">الرصيد الفعلي (الدفتر)</p>
                    <p
                      className={`text-lg font-black ${reportData.customer.balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(reportData.customer.balance)}
                    </p>
                  </div>
                </div>
              )}

              <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm whitespace-nowrap">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="p-3 text-white/50">التاريخ</th>
                        <th className="p-3 text-white/50">النوع</th>
                        <th className="p-3 text-white/50">البيان</th>
                        <th className="p-3 text-white/50">مدين (له)</th>
                        <th className="p-3 text-white/50">دائن (عليه)</th>
                        <th className="p-3 text-white/50">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLoading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-white/40 text-xs">
                            جاري التحميل...
                          </td>
                        </tr>
                      ) : reportStmt.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-white/40">
                            لا توجد حركات في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        reportStmt.map((row, i) => {
                          const meta = REPORT_TYPE_MAP[row.type] ?? {
                            label: row.type,
                            cls: 'text-white/50',
                          };
                          return (
                            <tr key={`${row.date ?? ''}-${row.type}-${row.reference_no ?? ''}-${i}`} className="border-b border-white/5 erp-table-row">
                              <td className="p-3 font-mono text-white/60 text-xs">{row.date}</td>
                              <td className="p-3">
                                <span className={`text-xs font-bold ${meta.cls}`}>
                                  {meta.label}
                                </span>
                              </td>
                              <td className="p-3 text-white/70">
                                {row.description}
                                {row.reference_no && (
                                  <span className="text-white/30 text-xs mr-2">
                                    {row.reference_no}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-blue-400 font-bold">
                                {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                              </td>
                              <td className="p-3 text-emerald-400 font-bold">
                                {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                              </td>
                              <td
                                className={`p-3 font-black ${row.balance >= 0 ? 'text-white' : 'text-red-400'}`}
                              >
                                {formatCurrency(row.balance)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
