/**
 * InvoiceSummary — invoice display card.
 *
 * Presentation only: no calculation logic.
 * All monetary values passed as pre-formatted strings.
 * Status is a slot — caller passes any badge/chip.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InvoiceSummaryItem {
  /** Product / service name. */
  name: string;
  /** Quantity (numeric for display). */
  qty: number;
  /** Unit label (e.g. "قطعة", "ساعة"). */
  unit?: string;
  /** Pre-formatted unit price. */
  unitPrice: string;
  /** Pre-formatted line total. */
  lineTotal: string;
}

export interface InvoiceSummaryProps {
  /** Invoice document number (e.g. "INV-0042"). */
  invoiceNo: string;
  /** Pre-formatted issue date. */
  date: string;
  /** Customer / recipient name. */
  customerName: string;
  /** Line items — may be collapsed into a summary row. */
  items: InvoiceSummaryItem[];
  /** Pre-formatted subtotal before discount/tax. */
  subtotal: string;
  /** Pre-formatted discount amount. Omit to hide row. */
  discount?: string;
  /** Pre-formatted tax/VAT amount. Omit to hide row. */
  tax?: string;
  /** Pre-formatted grand total. */
  total: string;
  /** Pre-formatted amount already paid. */
  paid: string;
  /** Pre-formatted remaining balance. */
  remaining: string;
  /** Slot for status badge. */
  statusSlot?: React.ReactNode;
  /** Compact mode — hides items table, shows only totals. */
  compact?: boolean;
  className?: string;
}

export function InvoiceSummary({
  invoiceNo,
  date,
  customerName,
  items,
  subtotal,
  discount,
  tax,
  total,
  paid,
  remaining,
  statusSlot,
  compact = false,
  className,
}: InvoiceSummaryProps) {
  return (
    <div className={cn('erp-invoice-summary', className)}>
      {/* ── Header ── */}
      <div className="erp-invoice-header">
        <div className="erp-invoice-meta">
          <span className="erp-invoice-no">{invoiceNo}</span>
          <time className="erp-invoice-date">{date}</time>
        </div>
        {statusSlot && (
          <div className="erp-invoice-status">{statusSlot}</div>
        )}
      </div>

      {/* ── Customer ── */}
      <div className="erp-invoice-customer">
        <span className="erp-invoice-customer-label">العميل</span>
        <span className="erp-invoice-customer-name">{customerName}</span>
      </div>

      {/* ── Items table (hidden in compact mode) ── */}
      {!compact && items.length > 0 && (
        <table className="erp-invoice-items">
          <thead>
            <tr>
              <th className="erp-invoice-th">الصنف</th>
              <th className="erp-invoice-th erp-invoice-th--num">الكمية</th>
              <th className="erp-invoice-th erp-invoice-th--num">السعر</th>
              <th className="erp-invoice-th erp-invoice-th--num">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="erp-invoice-item-row">
                <td className="erp-invoice-td">
                  {item.name}
                  {item.unit && (
                    <span className="erp-invoice-unit"> / {item.unit}</span>
                  )}
                </td>
                <td className="erp-invoice-td erp-invoice-td--num">
                  {item.qty}
                </td>
                <td className="erp-invoice-td erp-invoice-td--num">
                  {item.unitPrice}
                </td>
                <td className="erp-invoice-td erp-invoice-td--num">
                  {item.lineTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Totals ── */}
      <div className="erp-invoice-totals">
        <div className="erp-invoice-total-row">
          <span>المجموع الفرعي</span>
          <span className="erp-invoice-amount">{subtotal}</span>
        </div>
        {discount && (
          <div className="erp-invoice-total-row erp-invoice-total-row--discount">
            <span>الخصم</span>
            <span className="erp-invoice-amount">−{discount}</span>
          </div>
        )}
        {tax && (
          <div className="erp-invoice-total-row">
            <span>ضريبة القيمة المضافة</span>
            <span className="erp-invoice-amount">{tax}</span>
          </div>
        )}
        <div className="erp-invoice-total-row erp-invoice-total-row--grand">
          <span>الإجمالي</span>
          <span className="erp-invoice-amount erp-invoice-amount--grand">
            {total}
          </span>
        </div>
      </div>

      {/* ── Payment status ── */}
      <div className="erp-invoice-payment">
        <div className="erp-invoice-payment-row">
          <span className="erp-invoice-payment-label">المدفوع</span>
          <span className="erp-invoice-amount erp-invoice-amount--paid">
            {paid}
          </span>
        </div>
        <div className="erp-invoice-payment-row">
          <span className="erp-invoice-payment-label">المتبقي</span>
          <span
            className={cn(
              'erp-invoice-amount',
              remaining !== '٠' && remaining !== '0' && remaining !== '0.00'
                ? 'erp-invoice-amount--remaining'
                : 'erp-invoice-amount--settled',
            )}
          >
            {remaining}
          </span>
        </div>
      </div>
    </div>
  );
}
