import { safeArray } from '@/lib/safe-data';
import { openPrintWindow } from '@/lib/print-utils';
import { AlertSettingBanner } from '@/components/AlertSettingBanner';
import BadDebts from '@/pages/bad-debts';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import {
  useGetCustomers,
  useCreateCustomer,
  useGetSales,
  useGetPurchases,
  useGetSettingsSafes,
} from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/format';
import { authFetch } from '@/lib/auth-fetch';
import {
  Plus,
  Search,
  DollarSign,
  FileText,
  X,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ArrowUpFromLine,
  ArrowDownToLine,
  Printer,
  MessageCircle,
  Vault,
  FileDown,
  Pencil,
  Trash2,
  CreditCard,
  BarChart2,
} from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';
import { ConfirmModal } from '@/components/confirm-modal';
import { exportCustomersExcel } from '@/lib/export-excel';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';


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
    /* شعار الشركة */
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #B8860B; padding-bottom: 16px; margin-bottom: 20px; }
    .company-name { font-size: 22px; font-weight: 900; color: #B8860B; }
    .company-slogan { font-size: 11px; color: #888; margin-top: 3px; }
    .doc-title { text-align: left; }
    .doc-title h2 { font-size: 18px; font-weight: 900; color: #222; }
    .doc-title .date { font-size: 11px; color: #888; margin-top: 4px; }
    /* بيانات العميل */
    .customer-box { background: #FFF8E1; border: 1px solid #B8860B40; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .customer-name { font-size: 17px; font-weight: 900; color: #222; }
    .customer-phone { font-size: 12px; color: #666; margin-top: 3px; }
    .balance-badge { font-size: 15px; font-weight: 900; padding: 6px 14px; border-radius: 6px; }
    .balance-debit { background: #FFF3E0; color: #E65100; border: 1px solid #FFCC80; }
    .balance-credit { background: #E8F5E9; color: #2E7D32; border: 1px solid #A5D6A7; }
    .balance-zero { background: #F5F5F5; color: #757575; border: 1px solid #E0E0E0; }
    /* بطاقات الملخص */
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .card { background: #F8F8F8; border: 1px solid #E0E0E0; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .card-label { font-size: 10px; color: #888; margin-bottom: 4px; }
    .card-value { font-size: 13px; font-weight: 900; color: #222; }
    .card-count { font-size: 10px; color: #aaa; margin-top: 2px; }
    /* الجدول */
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
    /* ختم */
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

/* ─── دالة طباعة تقرير العملاء ─── */
function printCustomerReport(opts: {
  rows: Array<{
    id: number;
    name: string;
    customer_code: number;
    classification_name: string | null;
    opening_balance: number;
    period_debits: number;
    period_credits: number;
    closing_balance: number;
  }>;
  customerName: string;
  classificationName: string;
  dateFrom: string;
  dateTo: string;
  companyName: string;
}) {
  const { rows, customerName, classificationName, dateFrom, dateTo, companyName } = opts;
  const esc = (s: unknown) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
    );
  const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const fmt = (n: number) =>
    Math.abs(n).toLocaleString('ar-EG-u-nu-latn', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const totalOpening = rows.reduce((s, r) => s + r.opening_balance, 0);
  const totalDebits = rows.reduce((s, r) => s + r.period_debits, 0);
  const totalCredits = rows.reduce((s, r) => s + r.period_credits, 0);
  const totalClosing = rows.reduce((s, r) => s + r.closing_balance, 0);

  const sideTag = (v: number) =>
    v === 0 ? '' : v > 0 ? '<span class="tag d">د</span>' : '<span class="tag l">ل</span>';

  const rowsHtml = rows
    .map(
      (r, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${esc(r.customer_code)}</td>
      <td>${esc(r.name)}</td>
      <td>${r.classification_name ? esc(r.classification_name) : '—'}</td>
      <td class="num">${fmt(r.opening_balance)} ${sideTag(r.opening_balance)}</td>
      <td class="num debit">${fmt(r.period_debits)}</td>
      <td class="num credit">${fmt(r.period_credits)}</td>
      <td class="num closing">${fmt(r.closing_balance)} ${sideTag(r.closing_balance)}</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
    <title>تقرير العملاء</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1a1a2e; background: #fff; padding: 24px; font-size: 13px; }
      .header { text-align: center; margin-bottom: 20px; }
      .company { font-size: 22px; font-weight: 900; color: #1a1a2e; }
      .title { font-size: 16px; font-weight: 700; color: #7c3aed; margin-top: 6px; }
      .meta { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin: 12px 0 18px; font-size: 12px; color: #555; }
      .meta span { background: #f3f0ff; padding: 4px 12px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #1a1a2e; color: #fff; padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; text-align: right; }
      tr.even { background: #fafafa; }
      tr.odd  { background: #fff; }
      .num { text-align: left; font-family: monospace; font-weight: 600; }
      .debit { color: #ea580c; }
      .credit { color: #16a34a; }
      .closing { font-weight: 800; color: #1a1a2e; }
      .tag { display: inline-block; font-size: 9px; padding: 1px 5px; border-radius: 4px; margin-right: 3px; vertical-align: middle; }
      .tag.d { background: #fee2e2; color: #b91c1c; }
      .tag.l { background: #dcfce7; color: #15803d; }
      tfoot td { font-weight: 800; background: #f3f0ff; border-top: 2px solid #7c3aed; color: #1a1a2e; }
      .footer { margin-top: 20px; font-size: 11px; color: #888; text-align: center; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="header">
      <div class="company">${esc(companyName)}</div>
      <div class="title">تقرير العملاء</div>
      <div class="meta">
        <span>العميل: ${customerName ? esc(customerName) : 'كل العملاء'}</span>
        <span>التصنيف: ${classificationName ? esc(classificationName) : 'كل التصنيفات'}</span>
        ${dateFrom ? `<span>من: ${esc(dateFrom)}</span>` : ''}
        ${dateTo ? `<span>إلى: ${esc(dateTo)}</span>` : ''}
        <span>تاريخ الطباعة: ${today}</span>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>كود</th><th>اسم العميل</th><th>التصنيف</th>
        <th>رصيد أول المدة</th><th>مدين (عليه)</th><th>دائن (له)</th><th>رصيد آخر المدة</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr>
        <td colspan="3">الإجمالي (${rows.length} عميل)</td>
        <td class="num">${fmt(totalOpening)} ${sideTag(totalOpening)}</td>
        <td class="num debit">${fmt(totalDebits)}</td>
        <td class="num credit">${fmt(totalCredits)}</td>
        <td class="num closing">${fmt(totalClosing)} ${sideTag(totalClosing)}</td>
      </tr></tfoot>
    </table>
    <div class="footer">نظام مُحكم - MUHKAM ERP — تم الطباعة بتاريخ ${today}</div>
    </body></html>`;

  openPrintWindow(html, { width: 1000, height: 700, delay: 400 });
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
function CustomerStatementModal({
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

  // دفتر الأستاذ من الجدول المخصص
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<CustomerLedger>({
    queryKey: [`/api/customers/${customerId}/ledger`],
    queryFn: () =>
      authFetch(api(`/api/customers/${customerId}/ledger`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const customerBalance = ledgerData ? ledgerData.balance : initialBalance;

  // سداد مباشر
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

  // قراءة اسم الشركة من الإعدادات المحلية
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
        {/* ─── رأس الكشف ─── */}
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
            {/* ─── زر واتساب ─── */}
            <button
              onClick={handleWhatsApp}
              title={customerPhone ? 'إرسال ملخص الكشف على واتساب' : 'لا يوجد رقم هاتف مسجل'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${customerPhone ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30' : 'bg-white/5 text-white/20 border-white/10 cursor-not-allowed'}`}
            >
              <MessageCircle className="w-4 h-4" />
              واتساب
            </button>
            {/* ─── زر PDF ─── */}
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
          {/* ─── ملخص الأرقام ─── */}
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

          {/* ─── تبويبات ─── */}
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

          {/* ─── محتوى دفتر الأستاذ ─── */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              {/* زر السداد المباشر */}
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
              {/* نموذج السداد */}
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

              {/* جدول دفتر الأستاذ */}
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

          {/* ─── محتوى كشف الحساب التفصيلي ─── */}
          {activeTab === 'statement' && (
            <>
              {/* ─── دليل الرموز ─── */}
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

              {/* ─── الجدول الموحد ─── */}
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
                          <tr key={i} className="border-b border-white/5 erp-table-row">
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

          {/* ─── تقرير بالفترة (date-filtered from API) ─── */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              {/* فلتر التاريخ */}
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

              {/* بطاقات الملخص */}
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

              {/* جدول الحركات */}
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
                            <tr key={i} className="border-b border-white/5 erp-table-row">
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

/* ─── الصفحة الرئيسية للعملاء ─── */
function AccessDenied({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="w-14 h-14 text-red-400/40 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 115.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
      <p className="text-white/60 font-bold text-lg">غير مصرح</p>
      <p className="text-white/30 text-sm mt-1">{msg}</p>
    </div>
  );
}

export default function Customers() {
  const { data: customers = [], isLoading } = useGetCustomers();
  const { user } = useAuth();
  const canViewCustomers = hasPermission(user, 'can_view_customers') === true;
  const canManageCustomers = hasPermission(user, 'can_manage_customers') === true;
  const createMutation = useCreateCustomer();
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pageView, setPageView] = useState<'customers' | 'bad-debts'>('customers');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customers' | 'suppliers' | 'debtors' | 'creditors'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showReceipt, setShowReceipt] = useState<{
    id: number;
    name: string;
    balance: number;
  } | null>(null);
  const [showStatement, setShowStatement] = useState<{
    id: number;
    name: string;
    phone: string;
    balance: number;
    isSupplier: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    balance: 0,
    is_customer: true,
    is_supplier: false,
    classification_id: null as number | null,
  });
  const [receiptData, setReceiptData] = useState({ amount: '', notes: '', safe_id: '' });

  const [showSupplierPayment, setShowSupplierPayment] = useState<{
    id: number;
    name: string;
    balance: number;
  } | null>(null);
  const [supplierPaymentData, setSupplierPaymentData] = useState({
    amount: '',
    notes: '',
    safe_id: '',
  });

  const [showEdit, setShowEdit] = useState<{
    id: number;
    name: string;
    phone: string;
    is_customer: boolean;
    is_supplier: boolean;
    classification_id?: number | null;
  } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    is_customer: true,
    is_supplier: false,
    classification_id: null as number | null,
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [showNewClassification, setShowNewClassification] = useState(false);
  const [newClassificationName, setNewClassificationName] = useState('');
  const [confirmDeleteClassificationId, setConfirmDeleteClassificationId] = useState<number | null>(
    null
  );

  const [showReports, setShowReports] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    customerId: '',
    classificationId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [reportData, setReportData] = useState<Array<{
    id: number;
    name: string;
    customer_code: number;
    classification_name: string | null;
    opening_balance: number;
    period_debits: number;
    period_credits: number;
    closing_balance: number;
  }> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const { data: classificationsRaw, refetch: refetchClassifications } = useQuery({
    queryKey: ['/api/customer-classifications'],
    queryFn: async () => {
      const r = await authFetch(api('/api/customer-classifications'));
      return (await r.json()) as Array<{ id: number; name: string }>;
    },
  });
  const classifications = safeArray(classificationsRaw);

  const handleAddClassification = async () => {
    if (!newClassificationName.trim()) return;
    try {
      const r = await authFetch(api('/api/customer-classifications'), {
        method: 'POST',
        body: JSON.stringify({ name: newClassificationName.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في الإضافة');
      await refetchClassifications();
      setFormData((f) => ({ ...f, classification_id: j.id }));
      setEditFormData((f) => ({ ...f, classification_id: j.id }));
      setNewClassificationName('');
      setShowNewClassification(false);
      toast({ title: '✅ تم إضافة التصنيف' });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteClassification = async (id: number) => {
    try {
      const r = await authFetch(api(`/api/customer-classifications/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في الحذف');
      await refetchClassifications();
      if (formData.classification_id === id)
        setFormData((f) => ({ ...f, classification_id: null }));
      if (editFormData.classification_id === id)
        setEditFormData((f) => ({ ...f, classification_id: null }));
      toast({ title: '✅ تم حذف التصنيف' });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleFetchReport = async () => {
    setReportLoading(true);
    setReportData(null);
    try {
      const params = new URLSearchParams();
      if (reportFilters.customerId) params.set('customer_id', reportFilters.customerId);
      if (reportFilters.classificationId)
        params.set('classification_id', reportFilters.classificationId);
      if (reportFilters.dateFrom) params.set('date_from', reportFilters.dateFrom);
      if (reportFilters.dateTo) params.set('date_to', reportFilters.dateTo);
      const r = await authFetch(api(`/api/customer-reports?${params}`));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      setReportData(j);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setReportLoading(false);
    }
  };

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.includes(search) ||
      (c.phone && c.phone.includes(search)) ||
      (c.customer_code && String(c.customer_code).includes(search));
    if (!matchSearch) return false;
    const bal = Number(c.balance);
    if (typeFilter === 'customers') return !c.is_supplier;
    if (typeFilter === 'suppliers') return !!c.is_supplier;
    if (typeFilter === 'debtors')  return bal > 0.001;           // عليه — ذمم مدينة
    if (typeFilter === 'creditors') return bal < -0.001;          // له — ذمم دائنة
    return true;
  });

  // إحصائيات AR/AP
  const totalAR = customers.filter(c => Number(c.balance) > 0.001).reduce((s, c) => s + Number(c.balance), 0);
  const totalAP = customers.filter(c => Number(c.balance) < -0.001).reduce((s, c) => s + Math.abs(Number(c.balance)), 0);
  const totalSuppliers = customers.filter(c => c.is_supplier).length;
  const debtorCount = customers.filter(c => Number(c.balance) > 0.001).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'أدخل اسم العميل', variant: 'destructive' });
      return;
    }
    createMutation.mutate(
      { data: formData as never },
      {
        onSuccess: () => {
          toast({ title: '✅ تم إضافة العميل بنجاح' });
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
          setShowAdd(false);
          setFormData({
            name: '',
            phone: '',
            balance: 0,
            is_customer: true,
            is_supplier: false,
            classification_id: null,
          });
          setShowNewClassification(false);
          setNewClassificationName('');
        },
        onError: (e: Error) => {
          const raw = e.message;
          const msg = raw.replace(/^HTTP \d+ [^:]+:\s*/, '');
          toast({ title: msg || 'خطأ في إضافة العميل', variant: 'destructive' });
        },
      }
    );
  };

  // سند القبض يستخدم مسار receipt-vouchers المباشر
  const receiptMutation = useMutation({
    mutationFn: async (data: {
      customer_id: number;
      customer_name: string;
      safe_id: string;
      amount: string;
      notes: string;
    }) => {
      const r = await authFetch(api('/api/receipt-vouchers'), {
        method: 'POST',
        body: JSON.stringify({
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          safe_id: parseInt(data.safe_id),
          amount: parseFloat(data.amount),
          notes: data.notes || null,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في سند القبض');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تسجيل سند القبض بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/receipt-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowReceipt(null);
      setReceiptData({ amount: '', notes: '', safe_id: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceipt) return;
    if (!receiptData.safe_id) {
      toast({ title: 'اختر الخزينة', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(receiptData.amount);
    if (!amt || amt <= 0) {
      toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' });
      return;
    }
    receiptMutation.mutate({
      customer_id: showReceipt.id,
      customer_name: showReceipt.name,
      safe_id: receiptData.safe_id,
      amount: receiptData.amount,
      notes: receiptData.notes,
    });
  };

  // ─── تسديد دفعة ───
  const supplierPaymentMutation = useMutation({
    mutationFn: async (data: {
      customer_id: number;
      safe_id: string;
      amount: string;
      notes: string;
    }) => {
      const r = await authFetch(api(`/api/customers/${data.customer_id}/supplier-payment`), {
        method: 'POST',
        body: JSON.stringify({
          safe_id: parseInt(data.safe_id),
          amount: parseFloat(data.amount),
          notes: data.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في تسديد الدفعة');
      return j;
    },
    onSuccess: () => {
      toast({ title: 'تم تسديد الدفعة بنجاح ✓' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowSupplierPayment(null);
      setSupplierPaymentData({ amount: '', notes: '', safe_id: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSupplierPayment) return;
    if (!supplierPaymentData.safe_id) {
      toast({ title: 'اختر الخزينة', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(supplierPaymentData.amount);
    if (!amt || amt <= 0) {
      toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' });
      return;
    }
    supplierPaymentMutation.mutate({
      customer_id: showSupplierPayment.id,
      safe_id: supplierPaymentData.safe_id,
      amount: supplierPaymentData.amount,
      notes: supplierPaymentData.notes,
    });
  };

  // ─── تعديل عميل ───
  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      phone: string;
      is_customer: boolean;
      is_supplier: boolean;
      classification_id: number | null;
    }) => {
      const r = await authFetch(api(`/api/customers/${data.id}`), {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name,
          phone: data.phone || null,
          is_customer: data.is_customer,
          is_supplier: data.is_supplier,
          classification_id: data.classification_id,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في التعديل');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تعديل بيانات العميل' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setShowEdit(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    if (!editFormData.name.trim()) {
      toast({ title: 'أدخل اسم العميل', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({
      id: showEdit.id,
      name: editFormData.name,
      phone: editFormData.phone,
      is_customer: editFormData.is_customer,
      is_supplier: editFormData.is_supplier,
      classification_id: editFormData.classification_id,
    });
  };

  // ─── حذف عميل ───
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/customers/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في الحذف');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم حذف العميل' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setDeleteConfirmId(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleDelete = () => {
    if (deleteConfirmId === null) return;
    const customer = customers.find((c) => c.id === deleteConfirmId);
    if (!customer) return;
    if (Number(customer.balance) !== 0) {
      toast({ title: 'لا يمكن الحذف، يوجد رصيد غير مسوّى', variant: 'destructive' });
      setDeleteConfirmId(null);
      return;
    }
    deleteMutation.mutate(deleteConfirmId);
  };

  if (!canViewCustomers)
    return <AccessDenied msg="غير مصرح لك بالوصول إلى العملاء — تواصل مع المدير لتفعيل الصلاحية" />;

  return (
    <div className="space-y-6">
      {/* ── شريط العنوان: التبويبات + أزرار الإجراءات ── */}
      <div className="flex items-end justify-between gap-3 border-b border-white/10">
        <div className="flex gap-1">
          {([
            { id: 'customers', label: 'العملاء والموردون' },
            { id: 'bad-debts', label: 'الديون المعدومة' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setPageView(t.id)}
              className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${pageView === t.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-white/40 hover:text-white/70'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {pageView === 'customers' && (
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => { setShowReports(true); setReportData(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/40 text-violet-400 hover:bg-violet-500/30 transition-all whitespace-nowrap"
            >
              <BarChart2 className="w-4 h-4" /> تقارير العملاء
            </button>
            <button
              onClick={() => exportCustomersExcel(customers)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" /> Excel
            </button>
            {canManageCustomers && (
              <button
                onClick={() => setShowAdd(true)}
                className="btn-primary flex items-center gap-2 whitespace-nowrap py-1.5"
              >
                <Plus className="w-4 h-4" /> إضافة عميل
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── الديون المعدومة ── */}
      {pageView === 'bad-debts' && <BadDebts embedded />}

      {/* ── عرض العملاء والموردون ── */}
      {pageView === 'customers' && <>
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="بحث بالاسم أو الهاتف..."
          className="glass-input pl-3 pr-9 w-full py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── إحصائيات AR / AP ── */}
      {customers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className="glass-panel rounded-2xl p-4 border cursor-pointer transition-all"
            style={{ borderColor: typeFilter === 'debtors' ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.15)', background: typeFilter === 'debtors' ? 'rgba(245,158,11,0.08)' : undefined }}
            onClick={() => setTypeFilter(f => f === 'debtors' ? 'all' : 'debtors')}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-white/40 text-xs font-bold">ذمم مدينة (AR)</p>
            </div>
            <p className="text-xl font-black text-amber-400">{formatCurrency(totalAR)}</p>
            <p className="text-white/30 text-xs mt-0.5">{debtorCount} عميل عليه رصيد</p>
          </div>
          <div
            className="glass-panel rounded-2xl p-4 border cursor-pointer transition-all"
            style={{ borderColor: typeFilter === 'creditors' ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.15)', background: typeFilter === 'creditors' ? 'rgba(239,68,68,0.06)' : undefined }}
            onClick={() => setTypeFilter(f => f === 'creditors' ? 'all' : 'creditors')}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <p className="text-white/40 text-xs font-bold">ذمم دائنة (AP)</p>
            </div>
            <p className="text-xl font-black text-red-400">{formatCurrency(totalAP)}</p>
            <p className="text-white/30 text-xs mt-0.5">{customers.filter(c => Number(c.balance) < -0.001).length} له رصيد عليك</p>
          </div>
          <div className="glass-panel rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-white/40 text-xs font-bold">الصافي</p>
            </div>
            <p className={`text-xl font-black ${totalAR - totalAP >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(Math.abs(totalAR - totalAP))}</p>
            <p className="text-white/30 text-xs mt-0.5">{totalAR - totalAP >= 0 ? 'لصالحك' : 'عليك صافياً'}</p>
          </div>
          <div
            className="glass-panel rounded-2xl p-4 border cursor-pointer transition-all"
            style={{ borderColor: typeFilter === 'suppliers' ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.15)', background: typeFilter === 'suppliers' ? 'rgba(99,102,241,0.08)' : undefined }}
            onClick={() => setTypeFilter(f => f === 'suppliers' ? 'all' : 'suppliers')}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-white/40 text-xs font-bold">موردون</p>
            </div>
            <p className="text-xl font-black text-indigo-400">{totalSuppliers}</p>
            <p className="text-white/30 text-xs mt-0.5">جهة يتم الشراء منها</p>
          </div>
        </div>
      )}

      <AlertSettingBanner
        enabledKey="alert_debt_enabled"
        thresholdKey="alert_debt_days"
        title="تنبيه الديون المتأخرة"
        thresholdLabel="التنبيه بعد"
        thresholdUnit="يوم"
        icon="💰"
        color="amber"
        defaultThreshold="30"
      />

      {/* فلتر النوع */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all',       label: 'الكل' },
          { key: 'customers', label: 'عملاء فقط' },
          { key: 'suppliers', label: 'موردون فقط' },
          { key: 'debtors',   label: 'عليهم رصيد (AR)' },
          { key: 'creditors', label: 'لهم رصيد (AP)' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(v => v === f.key ? 'all' : f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              typeFilter === f.key
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            {f.label}
            {typeFilter === f.key && filtered.length > 0 && (
              <span className="mr-1.5 text-amber-400/70">({filtered.length})</span>
            )}
          </button>
        ))}
        {(typeFilter !== 'all' || search) && (
          <button
            onClick={() => { setTypeFilter('all'); setSearch(''); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 transition-all flex items-center gap-1"
          >
            <X className="w-3 h-3" /> مسح الفلتر
          </button>
        )}
      </div>

      {/* كشف الحساب */}
      {showStatement && (
        <CustomerStatementModal
          customerId={showStatement.id}
          customerName={showStatement.name}
          customerPhone={showStatement.phone}
          customerBalance={showStatement.balance}
          isSupplier={showStatement.isSupplier}
          onClose={() => setShowStatement(null)}
          safes={safes}
        />
      )}

      {/* إضافة عميل */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
          <form
            onSubmit={handleAdd}
            className="glass-panel rounded-3xl p-8 w-full max-w-md border border-white/10"
          >
            <h3 className="text-2xl font-bold text-white mb-6">عميل جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">اسم العميل *</label>
                <input
                  required
                  type="text"
                  className="glass-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">رقم الهاتف * <span className="text-white/30 text-xs">(11 رقم)</span></label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  className="glass-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                  maxLength={11}
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">رصيد ابتدائي (عليه)</label>
                <input
                  type="number"
                  step="0.01"
                  className="glass-input"
                  value={formData.balance || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              {/* تصنيف العميل */}
              <div>
                <label className="block text-white/70 text-sm mb-1">تصنيف العميل</label>
                <div className="flex items-center gap-2">
                  <select
                    className="glass-input flex-1 appearance-none"
                    value={formData.classification_id ?? ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        classification_id: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                  >
                    <option value="" className="bg-gray-900">
                      -- بدون تصنيف --
                    </option>
                    {classifications.map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {formData.classification_id && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteClassificationId(formData.classification_id!)}
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                      title="حذف التصنيف نهائياً"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {canManageCustomers &&
                  (showNewClassification ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="text"
                        autoFocus
                        className="glass-input flex-1 text-sm py-1.5"
                        placeholder="اسم التصنيف الجديد"
                        value={newClassificationName}
                        onChange={(e) => setNewClassificationName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddClassification();
                          }
                          if (e.key === 'Escape') {
                            setShowNewClassification(false);
                            setNewClassificationName('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddClassification}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors shrink-0"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewClassification(false);
                          setNewClassificationName('');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/15 transition-colors shrink-0"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewClassification(true)}
                      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> إضافة تصنيف جديد
                    </button>
                  ))}
              </div>

              {/* أدوار الطرف الآخر */}
              <div className="border border-white/10 rounded-2xl p-4 bg-white/3 space-y-3">
                <p className="text-white/50 text-xs font-semibold mb-1">الدور في العمليات</p>
                <button
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, is_customer: !f.is_customer }))}
                  className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${formData.is_customer ? 'text-green-400' : 'text-white/50 hover:text-white/70'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${formData.is_customer ? 'bg-green-500 border-green-500' : 'border-white/30'}`}
                  >
                    {formData.is_customer && (
                      <span className="text-white text-xs font-black">✓</span>
                    )}
                  </div>
                  🛒 عميل — يمكن البيع له
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, is_supplier: !f.is_supplier }))}
                  className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${formData.is_supplier ? 'text-blue-400' : 'text-white/50 hover:text-white/70'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${formData.is_supplier ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}
                  >
                    {formData.is_supplier && (
                      <span className="text-white text-xs font-black">✓</span>
                    )}
                  </div>
                  🔄 مورد — يمكن الشراء منه
                </button>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 btn-primary py-3"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setFormData({
                    name: '',
                    phone: '',
                    balance: 0,
                    is_customer: true,
                    is_supplier: false,
                    classification_id: null,
                  });
                }}
                className="flex-1 btn-secondary py-3"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* سند قبض */}
      {showReceipt !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
          <form
            onSubmit={handleReceipt}
            className="glass-panel rounded-3xl p-8 w-full max-w-md border border-white/10 space-y-5"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-white">سند قبض</h3>
                <p className="text-white/50 text-sm mt-1">
                  استلام مبلغ من{' '}
                  <span className="text-amber-400 font-bold">{showReceipt.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceipt(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* رصيد العميل الحالي */}
            <div
              className={`rounded-xl px-4 py-2.5 border text-sm font-bold flex items-center justify-between ${showReceipt.balance > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : showReceipt.balance < 0 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}
            >
              <span>الرصيد الحالي:</span>
              <span>
                {showReceipt.balance > 0
                  ? `${formatCurrency(showReceipt.balance)} عليه`
                  : showReceipt.balance < 0
                    ? `${formatCurrency(Math.abs(showReceipt.balance))} دائن له`
                    : 'متسوّى'}
              </span>
            </div>

            {showReceipt.balance <= 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-300">
                ℹ️ رصيد العميل صفر أو دائن — القبض سيجعل رصيده دائناً (سنكون مدينين له بهذا المبلغ)
              </div>
            )}

            <div>
              <label className="block text-white/70 text-sm mb-1">الخزينة المستلِمة *</label>
              <select
                required
                className="glass-input w-full appearance-none"
                value={receiptData.safe_id}
                onChange={(e) => setReceiptData((d) => ({ ...d, safe_id: e.target.value }))}
              >
                <option value="" className="bg-gray-900">
                  -- اختر خزينة --
                </option>
                {safes.map((s) => (
                  <option key={s.id} value={s.id} className="bg-gray-900">
                    {s.name} ({formatCurrency(Number(s.balance))})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1">المبلغ المستلم *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                className="glass-input text-xl font-bold"
                value={receiptData.amount}
                onChange={(e) => setReceiptData((d) => ({ ...d, amount: e.target.value }))}
                placeholder="0.00"
              />
              {receiptData.amount && (
                <p className="text-xs text-white/40 mt-1">
                  الرصيد بعد القبض:{' '}
                  <span
                    className={
                      showReceipt.balance - parseFloat(receiptData.amount) < 0
                        ? 'text-blue-400 font-bold'
                        : 'text-amber-400 font-bold'
                    }
                  >
                    {formatCurrency(Math.abs(showReceipt.balance - parseFloat(receiptData.amount)))}
                    {showReceipt.balance - parseFloat(receiptData.amount) > 0
                      ? ' عليه'
                      : showReceipt.balance - parseFloat(receiptData.amount) < 0
                        ? ' دائن له'
                        : ' متسوّى'}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1">بيان (اختياري)</label>
              <input
                type="text"
                className="glass-input"
                placeholder="دفعة على الحساب..."
                value={receiptData.notes}
                onChange={(e) => setReceiptData((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={receiptMutation.isPending}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Vault className="w-4 h-4" />
                {receiptMutation.isPending ? 'جاري الحفظ...' : 'تأكيد القبض'}
              </button>
              <button
                type="button"
                onClick={() => setShowReceipt(null)}
                className="flex-1 btn-secondary py-3"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── تسديد دفعة ─── */}
      {showSupplierPayment !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
          <form
            onSubmit={handleSupplierPayment}
            className="glass-panel rounded-3xl p-8 w-full max-w-md border border-white/10 space-y-5"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-white">تسديد دفعة</h3>
                <p className="text-white/50 text-sm mt-1">
                  سداد مستحقات{' '}
                  <span className="text-cyan-400 font-bold">{showSupplierPayment.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierPayment(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div
              className={`rounded-xl px-4 py-2.5 border text-sm font-bold flex items-center justify-between ${showSupplierPayment.balance < 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : showSupplierPayment.balance > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}
            >
              <span>الرصيد الحالي:</span>
              <span>
                {showSupplierPayment.balance < 0
                  ? `له علينا ${formatCurrency(Math.abs(showSupplierPayment.balance))}`
                  : showSupplierPayment.balance > 0
                    ? `عليه لنا ${formatCurrency(showSupplierPayment.balance)}`
                    : 'متسوّى'}
              </span>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1">الخزينة المدفوعة منها *</label>
              <select
                required
                className="glass-input w-full appearance-none"
                value={supplierPaymentData.safe_id}
                onChange={(e) => setSupplierPaymentData((d) => ({ ...d, safe_id: e.target.value }))}
              >
                <option value="" className="bg-gray-900">
                  -- اختر خزينة --
                </option>
                {safes.map((s) => (
                  <option key={s.id} value={s.id} className="bg-gray-900">
                    {s.name} ({formatCurrency(Number(s.balance))})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1">المبلغ المسدَّد *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                className="glass-input text-xl font-bold"
                value={supplierPaymentData.amount}
                onChange={(e) => setSupplierPaymentData((d) => ({ ...d, amount: e.target.value }))}
                placeholder="0.00"
              />
              {supplierPaymentData.amount && (
                <p className="text-xs text-white/40 mt-1">
                  الرصيد بعد التسديد:{' '}
                  {(() => {
                    const newBal =
                      showSupplierPayment.balance + parseFloat(supplierPaymentData.amount);
                    return (
                      <span
                        className={
                          newBal < 0
                            ? 'text-red-400 font-bold'
                            : newBal > 0
                              ? 'text-green-400 font-bold'
                              : 'text-white/40 font-bold'
                        }
                      >
                        {newBal < 0
                          ? `له علينا ${formatCurrency(Math.abs(newBal))}`
                          : newBal > 0
                            ? `عليه لنا ${formatCurrency(newBal)}`
                            : 'متسوّى'}
                      </span>
                    );
                  })()}
                </p>
              )}
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1">ملاحظات (اختياري)</label>
              <input
                type="text"
                className="glass-input"
                placeholder="دفعة مقابل مشتريات..."
                value={supplierPaymentData.notes}
                onChange={(e) => setSupplierPaymentData((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={supplierPaymentMutation.isPending}
                className="flex-1 bg-cyan-500 text-white py-3 rounded-xl font-bold hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {supplierPaymentMutation.isPending ? 'جاري الحفظ...' : 'تأكيد التسديد'}
              </button>
              <button
                type="button"
                onClick={() => setShowSupplierPayment(null)}
                className="flex-1 btn-secondary py-3"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── تعديل عميل ─── */}
      {showEdit !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
          <form
            onSubmit={handleEdit}
            className="glass-panel rounded-3xl p-8 w-full max-w-md border border-white/10"
          >
            <h3 className="text-2xl font-bold text-white mb-6">تعديل بيانات العميل</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">اسم العميل *</label>
                <input
                  required
                  type="text"
                  className="glass-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">رقم الهاتف * <span className="text-white/30 text-xs">(11 رقم)</span></label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  className="glass-input"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                  maxLength={11}
                  placeholder="01xxxxxxxxx"
                />
              </div>
              {/* تصنيف العميل */}
              <div>
                <label className="block text-white/70 text-sm mb-1">تصنيف العميل</label>
                <div className="flex items-center gap-2">
                  <select
                    className="glass-input flex-1 appearance-none"
                    value={editFormData.classification_id ?? ''}
                    onChange={(e) =>
                      setEditFormData((f) => ({
                        ...f,
                        classification_id: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                  >
                    <option value="" className="bg-gray-900">
                      -- بدون تصنيف --
                    </option>
                    {classifications.map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {editFormData.classification_id && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteClassificationId(editFormData.classification_id!)
                      }
                      className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                      title="حذف التصنيف نهائياً"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {canManageCustomers &&
                  (showNewClassification ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="text"
                        autoFocus
                        className="glass-input flex-1 text-sm py-1.5"
                        placeholder="اسم التصنيف الجديد"
                        value={newClassificationName}
                        onChange={(e) => setNewClassificationName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddClassification();
                          }
                          if (e.key === 'Escape') {
                            setShowNewClassification(false);
                            setNewClassificationName('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddClassification}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors shrink-0"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewClassification(false);
                          setNewClassificationName('');
                        }}
                        className="px-2 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/15 transition-colors shrink-0"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewClassification(true)}
                      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> إضافة تصنيف جديد
                    </button>
                  ))}
              </div>

              <div className="border border-white/10 rounded-2xl p-4 bg-white/3 space-y-3">
                <p className="text-white/50 text-xs font-semibold mb-1">الدور في العمليات</p>
                <button
                  type="button"
                  onClick={() => setEditFormData((f) => ({ ...f, is_customer: !f.is_customer }))}
                  className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editFormData.is_customer ? 'text-green-400' : 'text-white/50 hover:text-white/70'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${editFormData.is_customer ? 'bg-green-500 border-green-500' : 'border-white/30'}`}
                  >
                    {editFormData.is_customer && (
                      <span className="text-white text-xs font-black">✓</span>
                    )}
                  </div>
                  🛒 عميل — يمكن البيع له
                </button>
                <button
                  type="button"
                  onClick={() => setEditFormData((f) => ({ ...f, is_supplier: !f.is_supplier }))}
                  className={`flex items-center gap-2 w-full text-sm font-bold transition-colors ${editFormData.is_supplier ? 'text-blue-400' : 'text-white/50 hover:text-white/70'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${editFormData.is_supplier ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}
                  >
                    {editFormData.is_supplier && (
                      <span className="text-white text-xs font-black">✓</span>
                    )}
                  </div>
                  🔄 مورد — يمكن الشراء منه
                </button>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 btn-primary py-3"
              >
                {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
              <button
                type="button"
                onClick={() => setShowEdit(null)}
                className="flex-1 btn-secondary py-3"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── تأكيد حذف التصنيف ─── */}
      {confirmDeleteClassificationId !== null && (
        <ConfirmModal
          title="حذف التصنيف"
          description={`هل أنت متأكد من حذف التصنيف "${classifications.find((c) => c.id === confirmDeleteClassificationId)?.name ?? ''}"؟ إذا كان هذا التصنيف مرتبطًا بأي عميل فلن يمكن حذفه.`}
          isPending={false}
          onConfirm={async () => {
            const id = confirmDeleteClassificationId;
            setConfirmDeleteClassificationId(null);
            await handleDeleteClassification(id);
          }}
          onCancel={() => setConfirmDeleteClassificationId(null)}
        />
      )}

      {/* ─── تأكيد الحذف ─── */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl p-8 w-full max-w-sm border border-white/10 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">حذف العميل</h3>
              <p className="text-white/50 text-sm mt-2">
                هل تريد حذف العميل{' '}
                <span className="text-white font-bold">
                  {customers.find((c) => c.id === deleteConfirmId)?.name}
                </span>
                ؟
              </p>
              {Number(customers.find((c) => c.id === deleteConfirmId)?.balance) !== 0 && (
                <p className="text-red-400 text-xs mt-2 font-bold">
                  ⚠ لا يمكن الحذف، يوجد رصيد غير مسوّى
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={
                  deleteMutation.isPending ||
                  Number(customers.find((c) => c.id === deleteConfirmId)?.balance) !== 0
                }
                className="flex-1 bg-red-500/80 hover:bg-red-500 text-white py-2.5 rounded-xl font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 btn-secondary py-2.5"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* جدول العملاء */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-semibold text-white/60">الكود</th>
                <th className="p-4 font-semibold text-white/60">العميل</th>
                <th className="p-4 font-semibold text-white/60">رقم الهاتف</th>
                <th className="p-4 font-semibold text-white/60">
                  الرصيد
                  <span className="text-white/25 text-xs font-normal mr-1">(+ عليه | − له)</span>
                </th>
                <th className="p-4 font-semibold text-white/60">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={5} rows={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-white/40">
                    لا يوجد عملاء
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr key={customer.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-4">
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {customer.customer_code ?? '—'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-white">
                      <div className="flex items-center gap-2 flex-wrap">
                        {customer.name}
                        {customer.is_supplier && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
                            يتم الشراء منه
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-white/60">{customer.phone || '-'}</td>
                    <td className="p-4 font-bold">
                      {Number(customer.balance) > 0 ? (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          {formatCurrency(Number(customer.balance))}
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20">AR عليه</span>
                        </span>
                      ) : Number(customer.balance) < 0 ? (
                        <span className="text-red-400 flex items-center gap-1.5">
                          {formatCurrency(Math.abs(Number(customer.balance)))}
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/20">AP له</span>
                        </span>
                      ) : (
                        <span className="text-white/30">متسوّى</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() =>
                            setShowStatement({
                              id: customer.id,
                              name: customer.name,
                              phone: customer.phone || '',
                              balance: Number(customer.balance),
                              isSupplier: customer.is_supplier ?? false,
                            })
                          }
                          className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-blue-500/30"
                        >
                          <FileText className="w-3.5 h-3.5" /> كشف حساب
                        </button>
                        <button
                          onClick={() => {
                            setReceiptData({ amount: '', notes: '', safe_id: '' });
                            setShowReceipt({
                              id: customer.id,
                              name: customer.name,
                              balance: Number(customer.balance),
                            });
                          }}
                          className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-emerald-500/30"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> قبض دفعة
                        </button>
                        {customer.is_supplier && (
                          <button
                            onClick={() => {
                              setSupplierPaymentData({ amount: '', notes: '', safe_id: '' });
                              setShowSupplierPayment({
                                id: customer.id,
                                name: customer.name,
                                balance: Number(customer.balance),
                              });
                            }}
                            className="flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-cyan-500/30"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> تسديد دفعة
                          </button>
                        )}
                        {canManageCustomers && (
                          <button
                            onClick={() => {
                              setShowEdit({
                                id: customer.id,
                                name: customer.name,
                                phone: customer.phone || '',
                                is_customer: customer.is_customer ?? true,
                                is_supplier: customer.is_supplier ?? false,
                                classification_id: (customer as { classification_id?: number | null }).classification_id ?? null,
                              });
                              setEditFormData({
                                name: customer.name,
                                phone: customer.phone || '',
                                is_customer: customer.is_customer ?? true,
                                is_supplier: customer.is_supplier ?? false,
                                classification_id: (customer as { classification_id?: number | null }).classification_id ?? null,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors border border-white/10"
                            title="تعديل"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManageCustomers && (
                          <button
                            onClick={() => setDeleteConfirmId(customer.id)}
                            className="p-1.5 rounded-lg bg-red-500/5 text-red-400/50 hover:bg-red-500/15 hover:text-red-400 transition-colors border border-red-500/10"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── مودال تقارير العملاء ───── */}
      {showReports && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-4 px-4 bg-black/60 backdrop-blur-sm modal-overlay overflow-y-auto">
          <div className="glass-panel rounded-3xl w-full max-w-5xl border border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-bold text-white">تقارير العملاء</h2>
              </div>
              <button
                onClick={() => setShowReports(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 border-b border-white/10">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-white/50 text-xs mb-1">العميل</label>
                  <select
                    className="glass-input w-full text-sm appearance-none"
                    value={reportFilters.customerId}
                    onChange={(e) =>
                      setReportFilters((f) => ({ ...f, customerId: e.target.value }))
                    }
                  >
                    <option value="" className="bg-gray-900">
                      كل العملاء
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1">التصنيف</label>
                  <select
                    className="glass-input w-full text-sm appearance-none"
                    value={reportFilters.classificationId}
                    onChange={(e) =>
                      setReportFilters((f) => ({ ...f, classificationId: e.target.value }))
                    }
                  >
                    <option value="" className="bg-gray-900">
                      كل التصنيفات
                    </option>
                    {classifications.map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1">من تاريخ</label>
                  <input
                    type="date"
                    className="glass-input w-full text-sm"
                    value={reportFilters.dateFrom}
                    onChange={(e) => setReportFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    className="glass-input w-full text-sm"
                    value={reportFilters.dateTo}
                    onChange={(e) => setReportFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleFetchReport}
                  disabled={reportLoading}
                  className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
                >
                  {reportLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحميل...
                    </>
                  ) : (
                    <>
                      <BarChart2 className="w-4 h-4" />
                      عرض التقرير
                    </>
                  )}
                </button>
                {reportData && reportData.length > 0 && (
                  <button
                    onClick={() =>
                      printCustomerReport({
                        rows: reportData,
                        customerName: reportFilters.customerId
                          ? (customers.find((c) => String(c.id) === reportFilters.customerId)
                              ?.name ?? '')
                          : '',
                        classificationName: reportFilters.classificationId
                          ? (classifications.find(
                              (c) => String(c.id) === reportFilters.classificationId
                            )?.name ?? '')
                          : '',
                        dateFrom: reportFilters.dateFrom,
                        dateTo: reportFilters.dateTo,
                        companyName: (user as { company_name?: string } | null)?.company_name ?? 'مُحكم - MUHKAM ERP',
                      })
                    }
                    className="px-6 py-2 text-sm flex items-center gap-2 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30 font-bold transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة التقرير
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              {reportData === null ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">
                  اضغط "عرض التقرير" لتحميل البيانات
                </div>
              ) : reportData.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">
                  لا توجد بيانات بهذه الفلاتر
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-white/5 text-white/50 text-xs">
                      <th className="px-4 py-2.5 text-right font-semibold">#</th>
                      <th className="px-4 py-2.5 text-right font-semibold">اسم العميل</th>
                      <th className="px-4 py-2.5 text-right font-semibold">التصنيف</th>
                      <th className="px-4 py-2.5 text-left font-semibold">رصيد أول المدة</th>
                      <th className="px-4 py-2.5 text-left font-semibold">مدين (عليه)</th>
                      <th className="px-4 py-2.5 text-left font-semibold">دائن (له)</th>
                      <th className="px-4 py-2.5 text-left font-semibold">رصيد آخر المدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`border-t border-white/5 ${i % 2 === 0 ? 'bg-white/2' : ''} hover:bg-white/5 transition-colors`}
                      >
                        <td className="px-4 py-2 text-white/40 text-xs">{row.customer_code}</td>
                        <td className="px-4 py-2 text-white/90 font-medium">{row.name}</td>
                        <td className="px-4 py-2 text-white/50 text-xs">
                          {row.classification_name ?? '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-left font-mono text-sm font-bold ${row.opening_balance > 0 ? 'text-red-400' : row.opening_balance < 0 ? 'text-green-400' : 'text-white/40'}`}
                        >
                          {formatCurrency(Math.abs(row.opening_balance))}
                          {row.opening_balance !== 0 && (
                            <span className="text-[10px] mr-1 opacity-70">
                              {row.opening_balance > 0 ? 'د' : 'ل'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-left font-mono text-sm text-orange-300">
                          {formatCurrency(row.period_debits)}
                        </td>
                        <td className="px-4 py-2 text-left font-mono text-sm text-green-300">
                          {formatCurrency(row.period_credits)}
                        </td>
                        <td
                          className={`px-4 py-2 text-left font-mono text-sm font-bold ${row.closing_balance > 0 ? 'text-red-400' : row.closing_balance < 0 ? 'text-green-400' : 'text-white/40'}`}
                        >
                          {formatCurrency(Math.abs(row.closing_balance))}
                          {row.closing_balance !== 0 && (
                            <span className="text-[10px] mr-1 opacity-70">
                              {row.closing_balance > 0 ? 'د' : 'ل'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/20 bg-white/5 font-bold text-sm">
                      <td colSpan={3} className="px-4 py-2.5 text-white/60">
                        الإجمالي ({reportData.length} عميل)
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono text-white/70">
                        {formatCurrency(
                          Math.abs(reportData.reduce((s, r) => s + r.opening_balance, 0))
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono text-orange-300">
                        {formatCurrency(reportData.reduce((s, r) => s + r.period_debits, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono text-green-300">
                        {formatCurrency(reportData.reduce((s, r) => s + r.period_credits, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono text-amber-300">
                        {formatCurrency(
                          Math.abs(reportData.reduce((s, r) => s + r.closing_balance, 0))
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
