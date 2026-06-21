/**
 * FinancialSummary — accounting-convention summary table.
 *
 * Conventions:
 *   - "subtotal" type: single underline above the row
 *   - "grand-total" type: double underline above and below the row
 *   - tabular numerals throughout
 *   - negative values styled with debit/danger colour
 *   - no calculation logic — all values passed pre-computed
 *
 * Line types:
 *   normal       — standard detail row
 *   subtotal     — subtotal row (single underline)
 *   discount     — shown with a minus prefix if positive number passed
 *   tax          — VAT / tax row
 *   payment      — payment already made
 *   grand-total  — final total (double underline, bold)
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type FinancialLineType =
  | 'normal'
  | 'subtotal'
  | 'discount'
  | 'tax'
  | 'payment'
  | 'grand-total';

export interface FinancialLine {
  /** Row label. */
  label: string;
  /**
   * Pre-formatted value string (e.g. "١٬٢٣٤.٥٦ ر.س").
   * Pass a negative string (e.g. "-١٢.٠٠ ر.س") for debit styling.
   */
  value: string;
  type?: FinancialLineType;
  /**
   * Explicit negative flag — applies debit colour.
   * If omitted, auto-detected when value string starts with '-'.
   */
  negative?: boolean;
  /** Optional supporting note (e.g. tax rate "15%"). */
  note?: string;
}

export interface FinancialSummaryProps {
  lines: FinancialLine[];
  className?: string;
}

function isNegative(line: FinancialLine): boolean {
  if (line.negative !== undefined) return line.negative;
  return typeof line.value === 'string' && line.value.trim().startsWith('-');
}

export function FinancialSummary({ lines, className }: FinancialSummaryProps) {
  return (
    <table
      className={cn('erp-financial-summary', className)}
      aria-label="ملخص مالي"
    >
      <tbody>
        {lines.map((line, i) => {
          const type = line.type ?? 'normal';
          const neg  = isNegative(line);

          return (
            <tr
              key={i}
              className={cn(
                'erp-financial-row',
                `erp-financial-row--${type}`,
                neg && 'erp-financial-row--negative',
              )}
            >
              <td className="erp-financial-label">
                {line.label}
                {line.note && (
                  <span className="erp-financial-note">{line.note}</span>
                )}
              </td>
              <td className="erp-financial-value">
                {type === 'discount' && !neg && '−'}
                {line.value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
