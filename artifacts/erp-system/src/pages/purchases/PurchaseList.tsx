import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Eye, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import PurchaseDetails from './PurchaseDetails';

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

interface PurchaseRecord {
  id: number;
  invoice_no: string;
  date: string | null;
  supplier_name: string | null;
  payment_type: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  posting_status: string;
  status: string;
  currency?: string;
  exchange_rate?: number;
}

const postingLabel: Record<string, string> = {
  posted: 'مرحَّل',
  cancelled: 'ملغى',
  draft: 'مسودة',
};

const paymentLabel: Record<string, string> = {
  cash: 'نقدي',
  credit: 'آجل',
  partial: 'جزئي',
};

export default function PurchaseList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canCancel = hasPermission(user, 'can_cancel_purchase');
  const qc = useQueryClient();
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  const { data: purchases = [], isLoading } = useQuery<PurchaseRecord[]>({
    queryKey: ['/api/purchases'],
    queryFn: () =>
      authFetch(api('/api/purchases')).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['/api/purchases'] });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/purchases/${id}/post`), { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'فشل الترحيل');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ تم ترحيل الفاتورة وإنشاء القيد المحاسبي' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/purchases/${id}/cancel`), { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'فشل الإلغاء');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إلغاء الفاتورة وإنشاء قيد عكسي' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return <SkeletonTable rows={5} cols={7} />;
  }

  if (purchases.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="لا توجد فواتير بعد"
        description="انتقل إلى تبويب فاتورة شراء لتسجيل أول فاتورة"
      />
    );
  }

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>رقم الفاتورة</TableHeader>
            <TableHeader>المورد</TableHeader>
            <TableHeader>الإجمالي</TableHeader>
            <TableHeader>نوع الدفع</TableHeader>
            <TableHeader>حالة الترحيل</TableHeader>
            <TableHeader>التاريخ</TableHeader>
            <TableHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {purchases.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <span className="font-mono font-bold text-[var(--brand)]">{p.invoice_no}</span>
              </TableCell>

              <TableCell>
                <span className="font-bold">{p.supplier_name || '—'}</span>
              </TableCell>

              <TableCell variant="number">
                <span className="font-bold text-blue-400">
                  {formatCurrency(p.total_amount)}
                </span>
                {p.currency && p.currency !== 'EGP' && (
                  <span className="ms-1 text-xs text-blue-300/60 font-normal">
                    ({p.currency} × {p.exchange_rate?.toFixed(2)})
                  </span>
                )}
              </TableCell>

              <TableCell variant="status">
                <Badge variant="type">
                  {paymentLabel[p.payment_type] ?? p.payment_type}
                </Badge>
              </TableCell>

              <TableCell variant="status">
                <Badge variant={p.posting_status as 'posted' | 'cancelled' | 'draft'}>
                  {postingLabel[p.posting_status] ?? p.posting_status}
                </Badge>
              </TableCell>

              <TableCell variant="date">
                {p.date || '—'}
              </TableCell>

              <TableCell variant="action">
                <div className="flex items-center gap-1">
                  <IconButton
                    aria-label="عرض التفاصيل"
                    title="عرض التفاصيل"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPurchaseId(p.id)}
                  >
                    <Eye />
                  </IconButton>

                  {p.posting_status === 'draft' && (
                    <IconButton
                      aria-label="ترحيل"
                      title="ترحيل"
                      variant="ghost"
                      size="sm"
                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => postMutation.mutate(p.id)}
                      disabled={postMutation.isPending}
                    >
                      <CheckCircle />
                    </IconButton>
                  )}

                  {p.posting_status === 'posted' && canCancel && (
                    <IconButton
                      aria-label="إلغاء"
                      title="إلغاء"
                      variant="ghost"
                      size="sm"
                      className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      onClick={() => cancelMutation.mutate(p.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <XCircle />
                    </IconButton>
                  )}

                  <IconButton
                    aria-label="عرض مرتجعات هذه الفاتورة"
                    title="عرض مرتجعات هذه الفاتورة"
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    onClick={() =>
                      navigate(`/returns?q=${encodeURIComponent(p.invoice_no)}`)
                    }
                  >
                    <RotateCcw />
                  </IconButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedPurchaseId && (
        <PurchaseDetails
          purchaseId={selectedPurchaseId}
          onClose={() => setSelectedPurchaseId(null)}
        />
      )}
    </>
  );
}
