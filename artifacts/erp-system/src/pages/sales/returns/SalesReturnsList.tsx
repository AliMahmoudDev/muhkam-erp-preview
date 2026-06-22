import { Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import type { SalesReturn } from '../salesTypes';

import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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

interface SalesReturnsListProps {
  returns: SalesReturn[];
  isLoading: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
}

export function SalesReturnsList({
  returns: returns_,
  isLoading,
  canDelete,
  onDelete,
}: SalesReturnsListProps) {
  if (isLoading) {
    return <SkeletonTable rows={5} cols={7} />;
  }

  if (returns_.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="لا توجد مرتجعات"
        description="سجّل أول مرتجع مبيعات للبدء"
      />
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>رقم المرتجع</TableHeader>
          <TableHeader>العميل</TableHeader>
          <TableHeader>الإجمالي</TableHeader>
          <TableHeader>نوع الاسترداد</TableHeader>
          <TableHeader>السبب</TableHeader>
          <TableHeader>التاريخ</TableHeader>
          <TableHeader />
        </TableRow>
      </TableHead>
      <TableBody>
        {returns_.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <span className="font-bold font-mono text-[var(--brand)]">{r.return_no}</span>
            </TableCell>

            <TableCell>
              <span className="font-medium">{r.customer_name || 'عميل نقدي'}</span>
            </TableCell>

            <TableCell variant="number">
              <span className="font-bold text-orange-400">{formatCurrency(r.total_amount)}</span>
            </TableCell>

            <TableCell variant="status">
              {r.refund_type === 'cash' ? (
                <Badge variant="paid">
                  نقدي{r.safe_name ? ` — ${r.safe_name}` : ''}
                </Badge>
              ) : (
                <Badge variant="info">خصم رصيد</Badge>
              )}
            </TableCell>

            <TableCell>
              <span className="opacity-60">{r.reason || '—'}</span>
            </TableCell>

            <TableCell variant="date">
              {r.date || formatDate(r.created_at)}
            </TableCell>

            <TableCell variant="action">
              {canDelete && (
                <IconButton
                  aria-label="حذف المرتجع"
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => onDelete(r.id)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
