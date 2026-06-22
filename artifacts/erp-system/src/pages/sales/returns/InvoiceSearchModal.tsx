import { X, Search, Receipt } from 'lucide-react';
import type { InvoiceSummary } from '../salesTypes';

import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface InvoiceSearchModalProps {
  invoiceSearch: string;
  setInvoiceSearch: (v: string) => void;
  filteredSales: InvoiceSummary[];
  salesFetching: boolean;
  onSelectInvoice: (sale: InvoiceSummary) => void;
  onClose: () => void;
}

const paymentVariant: Record<string, 'paid' | 'unpaid' | 'partial'> = {
  cash: 'paid',
  credit: 'unpaid',
  partial: 'partial',
};
const paymentLabel: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };

export function InvoiceSearchModal({
  invoiceSearch,
  setInvoiceSearch,
  filteredSales,
  salesFetching,
  onSelectInvoice,
  onClose,
}: InvoiceSearchModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
      <Card className="w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--line)] shrink-0">
          <div>
            <h3 className="text-xl font-bold">اختر الفاتورة المراد إرجاعها</h3>
            <p className="opacity-40 text-xs mt-0.5">ابحث بالرقم أو اسم العميل</p>
          </div>
          <IconButton aria-label="إغلاق" variant="ghost" size="sm" onClick={onClose}>
            <X />
          </IconButton>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-[var(--line)] shrink-0">
          <div className="relative">
            <Search
              className={`w-4 h-4 absolute end-3 top-1/2 -translate-y-1/2 transition-colors ${salesFetching ? 'text-[var(--brand)] animate-pulse' : 'opacity-30'}`}
            />
            <input
              autoFocus
              type="text"
              className="erp-input icon-pr w-full"
              placeholder="رقم الفاتورة / اسم العميل / رمز العميل..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
            {invoiceSearch && (
              <button
                onClick={() => setInvoiceSearch('')}
                className="absolute start-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!invoiceSearch && (
            <p className="opacity-30 text-xs mt-2 text-center">
              آخر 40 فاتورة — ابحث للعثور على المزيد
            </p>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {salesFetching && filteredSales.length === 0 ? (
            <div className="p-10 text-center opacity-40">جاري البحث…</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-10 text-center opacity-40">لا توجد نتائج</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>رقم الفاتورة</TableHeader>
                  <TableHeader>العميل</TableHeader>
                  <TableHeader>نوع الدفع</TableHeader>
                  <TableHeader>التاريخ</TableHeader>
                  <TableHeader />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer"
                    onClick={() => onSelectInvoice(sale)}
                  >
                    <TableCell>
                      <span className="font-mono font-bold text-[var(--brand)]">
                        {sale.invoice_no}
                      </span>
                    </TableCell>
                    <TableCell>
                      {sale.customer_name || (
                        <span className="opacity-30">نقدي</span>
                      )}
                    </TableCell>
                    <TableCell variant="status">
                      <Badge variant={paymentVariant[sale.payment_type] ?? 'type'}>
                        {paymentLabel[sale.payment_type] ?? sale.payment_type}
                      </Badge>
                    </TableCell>
                    <TableCell variant="date">{sale.date || '—'}</TableCell>
                    <TableCell variant="action">
                      <IconButton
                        aria-label="اختيار الفاتورة"
                        variant="ghost"
                        size="sm"
                        className="text-[var(--brand)] hover:bg-[var(--brand)]/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectInvoice(sale);
                        }}
                      >
                        <Receipt />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
