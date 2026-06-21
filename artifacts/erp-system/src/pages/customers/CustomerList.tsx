import { FileText, DollarSign, Pencil, Trash2, CreditCard, Smartphone } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
  Table,
  TableHead,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';

interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  balance: number | string;
  customer_code?: number | string | null;
  is_customer?: boolean | null;
  is_supplier?: boolean | null;
  classification_id?: number | null;
  source?: string | null;
  price_list_id?: number | null;
  price_list_markup?: number | null;
}

interface CustomerListProps {
  paginatedCustomers: Customer[];
  canManageCustomers: boolean;
  isMaintenanceCustomer: (c: object) => boolean;
  setShowStatement: (
    v: { id: number; name: string; phone: string; balance: number; isSupplier: boolean } | null
  ) => void;
  setReceiptData: (v: { amount: string; notes: string; safe_id: string }) => void;
  setShowReceipt: (v: { id: number; name: string; balance: number } | null) => void;
  setSupplierPaymentData: (v: { amount: string; notes: string; safe_id: string }) => void;
  setShowSupplierPayment: (v: { id: number; name: string; balance: number } | null) => void;
  setShowEdit: (
    v: {
      id: number;
      name: string;
      phone: string;
      is_customer: boolean;
      is_supplier: boolean;
      classification_id?: number | null;
    } | null
  ) => void;
  setEditFormData: (v: {
    name: string;
    phone: string;
    is_customer: boolean;
    is_supplier: boolean;
    classification_id: number | null;
    price_list_id: number | null;
    price_list_markup: string;
  }) => void;
  setDeleteConfirmId: (id: number | null) => void;
}

export function CustomerList({
  paginatedCustomers,
  canManageCustomers,
  isMaintenanceCustomer,
  setShowStatement,
  setReceiptData,
  setShowReceipt,
  setSupplierPaymentData,
  setShowSupplierPayment,
  setShowEdit,
  setEditFormData,
  setDeleteConfirmId,
}: CustomerListProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>الكود</TableHeader>
          <TableHeader>العميل</TableHeader>
          <TableHeader>رقم الهاتف</TableHeader>
          <TableHeader>
            الرصيد
            <span className="opacity-40 text-xs font-normal mr-1">(+ عليه | − له)</span>
          </TableHeader>
          <TableHeader>الإجراءات</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {paginatedCustomers.map((customer) => (
          <TableRow key={customer.id}>
            {/* Code */}
            <TableCell variant="metadata">
              <Badge variant="neutral">{customer.customer_code ?? '—'}</Badge>
            </TableCell>

            {/* Name + badges */}
            <TableCell>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{customer.name}</span>
                {isMaintenanceCustomer(customer) && (
                  <StatusBadge
                    variant="informative"
                    label="عميل صيانة"
                    icon={<Smartphone className="size-3.5" />}
                  />
                )}
                {customer.is_supplier && (
                  <StatusBadge variant="neutral" label="يتم الشراء منه" />
                )}
              </div>
            </TableCell>

            {/* Phone */}
            <TableCell variant="metadata">{customer.phone || '—'}</TableCell>

            {/* Balance */}
            <TableCell variant="number">
              {Number(customer.balance) > 0 ? (
                <span className="flex items-center gap-1.5 justify-end">
                  {formatCurrency(Number(customer.balance))}
                  <StatusBadge variant="critical" label="AR عليه" icon={<></>} />
                </span>
              ) : Number(customer.balance) < 0 ? (
                <span className="flex items-center gap-1.5 justify-end">
                  {formatCurrency(Math.abs(Number(customer.balance)))}
                  <StatusBadge variant="negative" label="AP له" icon={<></>} />
                </span>
              ) : (
                <span className="opacity-40">متسوّى</span>
              )}
            </TableCell>

            {/* Actions */}
            <TableCell variant="action">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setShowStatement({
                      id: customer.id,
                      name: customer.name,
                      phone: customer.phone || '',
                      balance: Number(customer.balance),
                      isSupplier: customer.is_supplier ?? false,
                    })
                  }
                >
                  <FileText /> كشف حساب
                </Button>

                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    setReceiptData({ amount: '', notes: '', safe_id: '' });
                    setShowReceipt({
                      id: customer.id,
                      name: customer.name,
                      balance: Number(customer.balance),
                    });
                  }}
                >
                  <DollarSign /> قبض دفعة
                </Button>

                {customer.is_supplier && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      setSupplierPaymentData({ amount: '', notes: '', safe_id: '' });
                      setShowSupplierPayment({
                        id: customer.id,
                        name: customer.name,
                        balance: Number(customer.balance),
                      });
                    }}
                  >
                    <CreditCard /> تسديد دفعة
                  </Button>
                )}

                {canManageCustomers && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label="تعديل"
                    title="تعديل"
                    onClick={() => {
                      setShowEdit({
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone || '',
                        is_customer: customer.is_customer ?? true,
                        is_supplier: customer.is_supplier ?? false,
                        classification_id: customer.classification_id ?? null,
                      });
                      setEditFormData({
                        name: customer.name,
                        phone: customer.phone || '',
                        is_customer: customer.is_customer ?? true,
                        is_supplier: customer.is_supplier ?? false,
                        classification_id: customer.classification_id ?? null,
                        price_list_id: customer.price_list_id ?? null,
                        price_list_markup:
                          customer.price_list_markup != null
                            ? String(customer.price_list_markup)
                            : '',
                      });
                    }}
                  >
                    <Pencil />
                  </IconButton>
                )}

                {canManageCustomers && (
                  <IconButton
                    variant="destructive"
                    size="sm"
                    aria-label="حذف"
                    title="حذف"
                    onClick={() => setDeleteConfirmId(customer.id)}
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
