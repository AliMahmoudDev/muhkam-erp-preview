/**
 * LedgerRow — presentation-only debit/credit line.
 *
 * Renders as a <div> grid row (use inside a ledger table shell).
 * Also exports LedgerTable for a complete accessible <table> wrapper.
 *
 * Conventions:
 *   - null/undefined debit or credit → em dash (—)
 *   - tabular numerals on all financial cells
 *   - debit column: positive amounts only
 *   - credit column: positive amounts only
 *   - negative display handled by caller; this component is display-only
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

const EM_DASH = '—';

export interface LedgerRowData {
  /** Account name (e.g. "النقدية", "حسابات القبض"). */
  accountName: string;
  /** Account code (e.g. "1010"). Optional. */
  accountCode?: string;
  /** Pre-formatted debit amount. null/undefined → em dash. */
  debit?: string | null;
  /** Pre-formatted credit amount. null/undefined → em dash. */
  credit?: string | null;
  /** Row description / narration. */
  description?: string;
  /** Pre-formatted date string. */
  date?: string;
  /** Reference number (e.g. journal entry number). */
  reference?: string;
}

export interface LedgerRowProps extends LedgerRowData {
  /** Renders as a <tr> inside a <table> when true; <div> row otherwise. */
  asTableRow?: boolean;
  className?: string;
}

/**
 * LedgerRow — renders as a <div> grid row (default) or <tr>.
 */
export function LedgerRow({
  accountName,
  accountCode,
  debit,
  credit,
  description,
  date,
  reference,
  asTableRow = false,
  className,
}: LedgerRowProps) {
  const debitDisplay  = debit  ?? EM_DASH;
  const creditDisplay = credit ?? EM_DASH;
  const isCreditRow   = !debit && !!credit;

  if (asTableRow) {
    return (
      <tr className={cn('erp-ledger-row', className)}>
        {date && (
          <td className="erp-ledger-cell erp-ledger-cell--date">{date}</td>
        )}
        <td
          className={cn(
            'erp-ledger-cell erp-ledger-cell--account',
            isCreditRow && 'erp-ledger-cell--account-indent',
          )}
        >
          {accountCode && (
            <span className="erp-ledger-account-code">{accountCode}</span>
          )}
          <span className="erp-ledger-account-name">{accountName}</span>
        </td>
        {description && (
          <td className="erp-ledger-cell erp-ledger-cell--desc">
            {description}
          </td>
        )}
        {reference && (
          <td className="erp-ledger-cell erp-ledger-cell--ref">{reference}</td>
        )}
        <td className="erp-ledger-cell erp-ledger-cell--debit">
          {debitDisplay}
        </td>
        <td className="erp-ledger-cell erp-ledger-cell--credit">
          {creditDisplay}
        </td>
      </tr>
    );
  }

  return (
    <div className={cn('erp-ledger-row erp-ledger-row--div', className)}>
      {date && (
        <span className="erp-ledger-cell erp-ledger-cell--date">{date}</span>
      )}
      <span
        className={cn(
          'erp-ledger-cell erp-ledger-cell--account',
          isCreditRow && 'erp-ledger-cell--account-indent',
        )}
      >
        {accountCode && (
          <span className="erp-ledger-account-code">{accountCode}</span>
        )}
        <span className="erp-ledger-account-name">{accountName}</span>
      </span>
      {description && (
        <span className="erp-ledger-cell erp-ledger-cell--desc">
          {description}
        </span>
      )}
      {reference && (
        <span className="erp-ledger-cell erp-ledger-cell--ref">{reference}</span>
      )}
      <span className="erp-ledger-cell erp-ledger-cell--debit">
        {debitDisplay}
      </span>
      <span className="erp-ledger-cell erp-ledger-cell--credit">
        {creditDisplay}
      </span>
    </div>
  );
}

/* ─── LedgerTable ────────────────────────────────────────────────────
   Convenience wrapper: renders a full <table> with header + footer.
─────────────────────────────────────────────────────────────────── */
export interface LedgerTableProps {
  rows: LedgerRowData[];
  /** Show date column. */
  showDate?: boolean;
  /** Show reference column. */
  showReference?: boolean;
  /** Show description column. */
  showDescription?: boolean;
  /** Pre-formatted debit total. */
  debitTotal?: string;
  /** Pre-formatted credit total. */
  creditTotal?: string;
  className?: string;
}

export function LedgerTable({
  rows,
  showDate = false,
  showReference = false,
  showDescription = true,
  debitTotal,
  creditTotal,
  className,
}: LedgerTableProps) {
  return (
    <table className={cn('erp-ledger-table', className)}>
      <thead className="erp-ledger-head">
        <tr className="erp-ledger-head-row">
          {showDate        && <th className="erp-ledger-th erp-ledger-th--date">التاريخ</th>}
          <th className="erp-ledger-th erp-ledger-th--account">الحساب</th>
          {showDescription && <th className="erp-ledger-th erp-ledger-th--desc">البيان</th>}
          {showReference   && <th className="erp-ledger-th erp-ledger-th--ref">المرجع</th>}
          <th className="erp-ledger-th erp-ledger-th--debit">مدين</th>
          <th className="erp-ledger-th erp-ledger-th--credit">دائن</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <LedgerRow
            key={i}
            {...row}
            date={showDate ? row.date : undefined}
            reference={showReference ? row.reference : undefined}
            description={showDescription ? row.description : undefined}
            asTableRow
          />
        ))}
      </tbody>
      {(debitTotal || creditTotal) && (
        <tfoot className="erp-ledger-foot">
          <tr className="erp-ledger-foot-row">
            {showDate        && <td />}
            <td className="erp-ledger-foot-label">المجموع</td>
            {showDescription && <td />}
            {showReference   && <td />}
            <td className="erp-ledger-cell erp-ledger-cell--debit erp-ledger-total">
              {debitTotal  ?? EM_DASH}
            </td>
            <td className="erp-ledger-cell erp-ledger-cell--credit erp-ledger-total">
              {creditTotal ?? EM_DASH}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
