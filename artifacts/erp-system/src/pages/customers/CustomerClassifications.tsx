import { BarChart2, Printer, X } from 'lucide-react';
import { ConfirmModal } from '@/components/confirm-modal';
import { openPrintWindow } from '@/lib/print-utils';
import { formatCurrency } from '@/lib/format';

interface Classification {
  id: number;
  name: string;
}

interface Customer {
  id: number;
  name: string;
}

export interface CustomerReportRow {
  id: number;
  name: string;
  customer_code: number;
  classification_name: string | null;
  opening_balance: number;
  period_debits: number;
  period_credits: number;
  closing_balance: number;
}

export interface ReportFilters {
  customerId: string;
  classificationId: string;
  dateFrom: string;
  dateTo: string;
}

/* ─── دالة طباعة تقرير العملاء ─── */
export function printCustomerReport(opts: {
  rows: CustomerReportRow[];
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

/* ─── تأكيد حذف التصنيف ─── */
export function DeleteClassificationConfirm({
  confirmDeleteClassificationId,
  classifications,
  setConfirmDeleteClassificationId,
  handleDeleteClassification,
}: {
  confirmDeleteClassificationId: number | null;
  classifications: Classification[];
  setConfirmDeleteClassificationId: (id: number | null) => void;
  handleDeleteClassification: (id: number) => Promise<void>;
}) {
  if (confirmDeleteClassificationId === null) return null;
  return (
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
  );
}

/* ─── مودال تقارير العملاء ─── */
export function CustomerReportsModal({
  showReports,
  setShowReports,
  customers,
  classifications,
  reportFilters,
  setReportFilters,
  reportData,
  setReportData,
  reportLoading,
  handleFetchReport,
  companyName,
}: {
  showReports: boolean;
  setShowReports: (v: boolean) => void;
  customers: Customer[];
  classifications: Classification[];
  reportFilters: ReportFilters;
  setReportFilters: React.Dispatch<React.SetStateAction<ReportFilters>>;
  reportData: CustomerReportRow[] | null;
  setReportData: (v: CustomerReportRow[] | null) => void;
  reportLoading: boolean;
  handleFetchReport: () => Promise<void>;
  companyName: string;
}) {
  if (!showReports) return null;
  // setReportData kept in props to allow callers to clear; not used internally currently.
  void setReportData;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-4 px-4 bg-black/60 backdrop-blur-sm modal-overlay overflow-y-auto">
      <div className="glass-panel rounded-3xl w-full max-w-5xl border border-line flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-ink">تقارير العملاء</h2>
          </div>
          <button
            onClick={() => setShowReports(false)}
            className="p-2 rounded-xl hover:bg-surface text-ink/50 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 border-b border-line">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-ink/50 text-xs mb-1">العميل</label>
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
              <label className="block text-ink/50 text-xs mb-1">التصنيف</label>
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
              <label className="block text-ink/50 text-xs mb-1">من تاريخ</label>
              <input
                type="date"
                className="glass-input w-full text-sm"
                value={reportFilters.dateFrom}
                onChange={(e) => setReportFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-ink/50 text-xs mb-1">إلى تاريخ</label>
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
                  <span className="w-4 h-4 border-2 border-line border-t-white rounded-full animate-spin" />
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
                    companyName,
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
            <div className="flex items-center justify-center py-16 text-ink/30 text-sm">
              اضغط "عرض التقرير" لتحميل البيانات
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-ink/30 text-sm">
              لا توجد بيانات بهذه الفلاتر
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-surface text-ink/50 text-xs">
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
                    className={`border-t border-line ${i % 2 === 0 ? 'bg-surface' : ''} hover:bg-surface transition-colors`}
                  >
                    <td className="px-4 py-2 text-ink/40 text-xs">{row.customer_code}</td>
                    <td className="px-4 py-2 text-ink/90 font-medium">{row.name}</td>
                    <td className="px-4 py-2 text-ink/50 text-xs">
                      {row.classification_name ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-2 text-left font-mono text-sm font-bold ${row.opening_balance > 0 ? 'text-red-400' : row.opening_balance < 0 ? 'text-green-400' : 'text-ink/40'}`}
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
                      className={`px-4 py-2 text-left font-mono text-sm font-bold ${row.closing_balance > 0 ? 'text-red-400' : row.closing_balance < 0 ? 'text-green-400' : 'text-ink/40'}`}
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
                <tr className="border-t-2 border-line bg-surface font-bold text-sm">
                  <td colSpan={3} className="px-4 py-2.5 text-ink/60">
                    الإجمالي ({reportData.length} عميل)
                  </td>
                  <td className="px-4 py-2.5 text-left font-mono text-ink/70">
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
  );
}
