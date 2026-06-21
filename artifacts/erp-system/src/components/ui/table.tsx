import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TableDensity = 'compact' | 'comfortable' | 'spacious';

interface TableContextValue {
  density: TableDensity;
  stickyHeader: boolean;
}

const TableContext = React.createContext<TableContextValue>({
  density: 'comfortable',
  stickyHeader: false,
});

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
  stickyHeader?: boolean;
}

function Table({
  density = 'comfortable',
  stickyHeader = false,
  className,
  children,
  ...props
}: TableProps) {
  return (
    <TableContext.Provider value={{ density, stickyHeader }}>
      <div
        className={cn(
          'erp-table-wrap',
          density === 'compact'   && 'erp-table-wrap--compact',
          density === 'spacious'  && 'erp-table-wrap--spacious',
        )}
      >
        <table className={cn('erp-table', className)} {...props}>
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
}

function TableHead({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  const { stickyHeader } = React.useContext(TableContext);
  return (
    <thead
      className={cn(
        'erp-table-head',
        stickyHeader && 'erp-table-head--sticky',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('erp-table-body', className)} {...props}>
      {children}
    </tbody>
  );
}

export type SortDirection = 'asc' | 'desc' | 'none';

export interface TableHeaderProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
}

const ARIA_SORT_MAP: Record<SortDirection, React.AriaAttributes['aria-sort']> =
  {
    asc:  'ascending',
    desc: 'descending',
    none: 'none',
  };

function TableHeader({
  sortable = false,
  sortDirection = 'none',
  onSort,
  className,
  children,
  ...props
}: TableHeaderProps) {
  return (
    <th
      className={cn(
        'erp-table-th',
        sortable && 'erp-table-th--sortable',
        className,
      )}
      aria-sort={sortable ? ARIA_SORT_MAP[sortDirection] : undefined}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <span className="erp-table-th-content">
        {children}
        {sortable && (
          <span className="erp-table-th-sort" aria-hidden="true">
            {sortDirection === 'asc'  && <ChevronUp  />}
            {sortDirection === 'desc' && <ChevronDown />}
            {sortDirection === 'none' && <ChevronsUpDown />}
          </span>
        )}
      </span>
    </th>
  );
}

export interface TableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  disabled?: boolean;
}

function TableRow({
  selected = false,
  disabled = false,
  className,
  children,
  ...props
}: TableRowProps) {
  return (
    <tr
      className={cn(
        'erp-table-row',
        selected && 'erp-table-row--selected',
        disabled && 'erp-table-row--disabled',
        className,
      )}
      aria-selected={selected || undefined}
      aria-disabled={disabled || undefined}
      data-selected={selected || undefined}
      {...props}
    >
      {children}
    </tr>
  );
}

export type TableCellVariant =
  | 'text'
  | 'number'
  | 'status'
  | 'action'
  | 'date'
  | 'metadata';

export interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  variant?: TableCellVariant;
}

function TableCell({
  variant = 'text',
  className,
  children,
  ...props
}: TableCellProps) {
  return (
    <td
      className={cn(
        'erp-table-td',
        variant === 'number'   && 'erp-table-td--number',
        variant === 'status'   && 'erp-table-td--status',
        variant === 'action'   && 'erp-table-td--action',
        variant === 'date'     && 'erp-table-td--date',
        variant === 'metadata' && 'erp-table-td--metadata',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

Table.displayName       = 'Table';
TableHead.displayName   = 'TableHead';
TableBody.displayName   = 'TableBody';
TableHeader.displayName = 'TableHeader';
TableRow.displayName    = 'TableRow';
TableCell.displayName   = 'TableCell';

export {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
};
