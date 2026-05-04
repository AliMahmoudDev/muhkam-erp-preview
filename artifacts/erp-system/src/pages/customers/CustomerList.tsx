import { FileText, DollarSign, Pencil, Trash2, CreditCard, Smartphone } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';
import { PaginationBar } from '@/components/PaginationBar';
import { formatCurrency } from '@/lib/format';

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
  isLoading: boolean;
  filtered: Customer[];
  paginatedCustomers: Customer[];
  custPage: number;
  CUST_PAGE_SIZE: number;
  setCustPage: (v: number) => void;
  canManageCustomers: boolean;
  isMaintenanceCustomer: (c: object) => boolean;
  setShowStatement: (v: { id: number; name: string; phone: string; balance: number; isSupplier: boolean } | null) => void;
  setReceiptData: (v: { amount: string; notes: string; safe_id: string }) => void;
  setShowReceipt: (v: { id: number; name: string; balance: number } | null) => void;
  setSupplierPaymentData: (v: { amount: string; notes: string; safe_id: string }) => void;
  setShowSupplierPayment: (v: { id: number; name: string; balance: number } | null) => void;
  setShowEdit: (v: { id: number; name: string; phone: string; is_customer: boolean; is_supplier: boolean; classification_id?: number | null } | null) => void;
  setEditFormData: (v: { name: string; phone: string; is_customer: boolean; is_supplier: boolean; classification_id: number | null; price_list_id: number | null; price_list_markup: string }) => void;
  setDeleteConfirmId: (id: number | null) => void;
}

export function CustomerList({
  isLoading,
  filtered,
  paginatedCustomers,
  custPage,
  CUST_PAGE_SIZE,
  setCustPage,
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
    <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-white/80 whitespace-nowrap">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="p-4 font-semibold text-white/60">الكود</th>
              <th className="p-4 font-semibold text-white/60">العميل</th>
              <th className="p-4 font-semibold text-white/60">رقم الهاتف</th>
              <th className="p-4 font-semibold text-white/60">
                الرصيد
                <span className="text-white/25 text-xs font-normal mr-1">(+ عليه | − له)</span>
              </th>
              <th className="p-4 font-semibold text-white/60">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton cols={5} rows={5} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-white/40">لا يوجد عملاء</td>
              </tr>
            ) : (
              paginatedCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-4">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {customer.customer_code ?? '—'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isMaintenanceCustomer(customer) && (
                        <span title="عميل صيانة" className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-violet-500/15 text-violet-300 border border-violet-500/40 shrink-0">
                          <Smartphone className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {customer.name}
                      {isMaintenanceCustomer(customer) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
                          عميل صيانة
                        </span>
                      )}
                      {customer.is_supplier && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
                          يتم الشراء منه
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-white/60">{customer.phone || '-'}</td>
                  <td className="p-4 font-bold">
                    {Number(customer.balance) > 0 ? (
                      <span className="text-amber-400 flex items-center gap-1.5">
                        {formatCurrency(Number(customer.balance))}
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20">AR عليه</span>
                      </span>
                    ) : Number(customer.balance) < 0 ? (
                      <span className="text-red-400 flex items-center gap-1.5">
                        {formatCurrency(Math.abs(Number(customer.balance)))}
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/20">AP له</span>
                      </span>
                    ) : (
                      <span className="text-white/30">متسوّى</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setShowStatement({ id: customer.id, name: customer.name, phone: customer.phone || '', balance: Number(customer.balance), isSupplier: customer.is_supplier ?? false })}
                        className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-blue-500/30"
                      >
                        <FileText className="w-3.5 h-3.5" /> كشف حساب
                      </button>
                      <button
                        onClick={() => {
                          setReceiptData({ amount: '', notes: '', safe_id: '' });
                          setShowReceipt({ id: customer.id, name: customer.name, balance: Number(customer.balance) });
                        }}
                        className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-emerald-500/30"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> قبض دفعة
                      </button>
                      {customer.is_supplier && (
                        <button
                          onClick={() => {
                            setSupplierPaymentData({ amount: '', notes: '', safe_id: '' });
                            setShowSupplierPayment({ id: customer.id, name: customer.name, balance: Number(customer.balance) });
                          }}
                          className="flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-cyan-500/30"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> تسديد دفعة
                        </button>
                      )}
                      {canManageCustomers && (
                        <button
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
                              price_list_markup: customer.price_list_markup != null ? String(customer.price_list_markup) : '',
                            });
                          }}
                          className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors border border-white/10"
                          title="تعديل"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canManageCustomers && (
                        <button
                          onClick={() => setDeleteConfirmId(customer.id)}
                          className="p-1.5 rounded-lg bg-red-500/5 text-red-400/50 hover:bg-red-500/15 hover:text-red-400 transition-colors border border-red-500/10"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={custPage}
        totalItems={filtered.length}
        pageSize={CUST_PAGE_SIZE}
        onPageChange={setCustPage}
        itemLabel="عميل"
      />
    </div>
  );
}
