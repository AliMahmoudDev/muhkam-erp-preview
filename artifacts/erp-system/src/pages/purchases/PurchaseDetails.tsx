import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useAppSettings } from '@/contexts/app-settings';
import { formatCurrency } from '@/lib/format';
import { openPrintWindow } from '@/lib/print-utils';
import { Receipt, Printer, X } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface PurchaseDetail {
  id: number;
  invoice_no: string;
  date: string | null;
  created_at: string;
  supplier_name: string | null;
  customer_name: string | null;
  payment_type: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  posting_status: string;
  notes: string | null;
  currency?: string;
  exchange_rate?: number;
  items: {
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

export default function PurchaseDetails({
  purchaseId,
  onClose,
}: {
  purchaseId: number;
  onClose: () => void;
}) {
  const { settings } = useAppSettings();
  const { data: purchase, isLoading } = useQuery<PurchaseDetail>({
    queryKey: ['/api/purchases', purchaseId],
    queryFn: () =>
      authFetch(api(`/api/purchases/${purchaseId}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const payLabels: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };

  const handlePrint = () => {
    if (!purchase) return;
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const itemsHtml = purchase.items
      .map(
        (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.product_name)}</td>
        <td>${it.quantity}</td>
        <td>${it.unit_price.toFixed(2)}</td>
        <td>${it.total_price.toFixed(2)}</td>
      </tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>فاتورة شراء — ${esc(purchase.invoice_no)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,sans-serif;background:#fff;color:#111;padding:24px;font-size:13px}
  .header{text-align:center;border-bottom:2px solid #f59e0b;padding-bottom:14px;margin-bottom:18px}
  .company{font-size:22px;font-weight:900;color:#92400e}
  .title{font-size:16px;font-weight:700;color:#b45309;margin-top:6px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:16px;padding:12px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-label{font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase}
  .meta-value{font-weight:700;color:#111;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
  thead{background:#92400e;color:#fff}
  th,td{padding:8px 10px;text-align:right}
  td{border-bottom:1px solid #e5e7eb}
  tbody tr:nth-child(even){background:#fffbeb}
  .totals{border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;background:#fffbeb}
  .total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
  .total-final{font-size:18px;font-weight:900;border-top:2px solid #b45309;padding-top:8px;margin-top:6px;color:#92400e}
  .footer{text-align:center;margin-top:20px;font-size:11px;color:#9ca3af;border-top:1px dashed #d1d5db;padding-top:12px}
  @media print{body{padding:10px}}
</style></head><body>
<div class="header">
  <div class="company">${esc(settings.companyName || 'محكم')}</div>
  <div class="title">فاتورة مشتريات — ${esc(purchase.invoice_no)}</div>
</div>
<div class="meta">
  <div class="meta-item"><span class="meta-label">رقم الفاتورة</span><span class="meta-value">${esc(purchase.invoice_no)}</span></div>
  <div class="meta-item"><span class="meta-label">التاريخ</span><span class="meta-value">${purchase.date || new Date(purchase.created_at).toLocaleDateString('ar-EG')}</span></div>
  <div class="meta-item"><span class="meta-label">المورد</span><span class="meta-value">${esc(purchase.supplier_name || purchase.customer_name || '—')}</span></div>
  <div class="meta-item"><span class="meta-label">طريقة الدفع</span><span class="meta-value">${payLabels[purchase.payment_type] || purchase.payment_type}</span></div>
</div>
${purchase.notes ? `<p style="margin-bottom:12px;font-size:12px;color:#6b7280;font-style:italic">${esc(purchase.notes)}</p>` : ''}
<table>
  <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span>الإجمالي</span><span>${purchase.total_amount.toFixed(2)} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${purchase.paid_amount.toFixed(2)} ج.م</span></div>
  ${purchase.remaining_amount > 0 ? `<div class="total-row" style="color:#dc2626"><span>المتبقي</span><span>${purchase.remaining_amount.toFixed(2)} ج.م</span></div>` : ''}
  <div class="total-row total-final"><span>الإجمالي الكلي</span><span>${purchase.total_amount.toFixed(2)} ج.م</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — ${esc(settings.companyName || 'محكم')}</div>
</body></html>`;
    openPrintWindow(html, { width: 800, height: 900, delay: 500, autoClose: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      dir="rtl"
    >
      <Card className="p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[var(--brand)]" /> تفاصيل فاتورة الشراء
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || !purchase}
            >
              <Printer /> طباعة
            </Button>
            <IconButton aria-label="إغلاق" variant="ghost" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        </div>

        {/* States */}
        {isLoading ? (
          <SkeletonTable rows={4} cols={2} />
        ) : !purchase ? (
          <EmptyState variant="no-data" title="لم يتم العثور على الفاتورة" />
        ) : (
          <div className="space-y-5">
            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--surface)] rounded-2xl border border-[var(--line)]">
              <div>
                <p className="opacity-40 text-xs mb-1">رقم الفاتورة</p>
                <p className="text-[var(--brand)] font-bold font-mono">{purchase.invoice_no}</p>
              </div>
              <div>
                <p className="opacity-40 text-xs mb-1">التاريخ</p>
                <p className="text-sm">
                  {purchase.date ||
                    new Date(purchase.created_at).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                </p>
              </div>
              <div>
                <p className="opacity-40 text-xs mb-1">المورد / البائع</p>
                <p className="font-semibold text-sm">
                  {purchase.supplier_name || purchase.customer_name || '—'}
                </p>
              </div>
              <div>
                <p className="opacity-40 text-xs mb-1">طريقة الدفع</p>
                <p className="text-sm">
                  {payLabels[purchase.payment_type] || purchase.payment_type}
                </p>
              </div>
              {purchase.notes && (
                <div className="col-span-2">
                  <p className="opacity-40 text-xs mb-1">ملاحظات</p>
                  <p className="opacity-70 text-sm italic">{purchase.notes}</p>
                </div>
              )}
            </div>

            {/* Items table */}
            <div>
              <h4 className="font-bold mb-3 text-sm">أصناف الفاتورة</h4>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>الصنف</TableHeader>
                    <TableHeader>الكمية</TableHeader>
                    <TableHeader>سعر الوحدة</TableHeader>
                    <TableHeader>الإجمالي</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchase.items.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell variant="metadata">{i + 1}</TableCell>
                      <TableCell>
                        <span className="font-medium">{item.product_name}</span>
                      </TableCell>
                      <TableCell variant="number">{item.quantity}</TableCell>
                      <TableCell variant="number">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell variant="number">
                        <span className="text-blue-400 font-bold">
                          {formatCurrency(item.total_price)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="opacity-50">الإجمالي</span>
                <span className="font-bold">{formatCurrency(purchase.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-50">المدفوع</span>
                <span className="text-emerald-400 font-bold">
                  {formatCurrency(purchase.paid_amount)}
                </span>
              </div>
              {purchase.remaining_amount > 0 && (
                <div className="flex justify-between text-sm border-t border-[var(--line)] pt-2">
                  <span className="text-red-400/80">المتبقي</span>
                  <span className="text-red-400 font-bold">
                    {formatCurrency(purchase.remaining_amount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
