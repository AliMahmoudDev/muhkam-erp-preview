import { useState } from 'react';
import { Printer, MessageCircle, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { useCustomerLedger, printCustomerStatement, openWhatsApp } from './hooks/useCustomerLedger';
import { getTenantSettingsStorageKey } from '@/lib/tenant-storage';
import { LedgerSummary } from './LedgerSummary';
import { LedgerTable } from './LedgerTable';
import { LedgerFilters } from './LedgerFilters';

interface DirectPayForm {
  amount: string;
  safe_id: string;
  notes: string;
}

export function CustomerStatementModal({
  customerId,
  customerName,
  customerPhone,
  customerBalance: initialBalance,
  isSupplier,
  onClose,
  safes,
}: {
  customerId: number;
  customerName: string;
  customerPhone: string;
  customerBalance: number;
  isSupplier: boolean;
  onClose: () => void;
  safes: Array<{ id: number; name: string; balance: number }>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'statement' | 'ledger' | 'report'>('ledger');
  const [showDirectPayment, setShowDirectPayment] = useState(false);
  const [directPayForm, setDirectPayForm] = useState<DirectPayForm>({
    amount: '',
    safe_id: '',
    notes: '',
  });

  const thisMonthStart = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportFrom, setReportFrom] = useState(thisMonthStart);
  const [reportTo, setReportTo] = useState(todayStr);

  const {
    ledgerData,
    ledgerLoading,
    reportData,
    reportLoading,
    reportStmt,
    customerBalance,
    rowsWithBalance,
    summaryCards,
    sales,
    purchases,
    receipts,
    payments,
    returns_,
    purchaseReturns,
    supplierPayments,
    totalSales,
    totalPurchases,
    totalReceipts,
    totalPayments,
    totalReturns,
    totalSupplierPayments,
    totalPurchaseReturns,
  } = useCustomerLedger({
    customerId,
    customerName,
    isSupplier,
    activeTab,
    reportFrom,
    reportTo,
    initialBalance,
  });

  const directPayMutation = useMutation({
    mutationFn: async (data: DirectPayForm) => {
      const r = await authFetch(api(`/api/customers/${customerId}/payment`), {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(data.amount),
          safe_id: data.safe_id ? parseInt(data.safe_id) : undefined,
          notes: data.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في تسجيل السداد');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تسجيل السداد في دفتر الأستاذ' });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/ledger`] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setShowDirectPayment(false);
      setDirectPayForm({ amount: '', safe_id: '', notes: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const settings = JSON.parse(localStorage.getItem(getTenantSettingsStorageKey()) || '{}');
  const companyName = settings.companyName || 'مُحكم - MUHKAM ERP';
  const companySlogan = settings.companySlogan || '';

  const handlePrint = () =>
    printCustomerStatement({
      customerName,
      customerPhone,
      customerBalance,
      rows: rowsWithBalance,
      summaryCards,
      companyName,
      companySlogan,
    });
  const handleWhatsApp = () => {
    if (!customerPhone) {
      toast({ title: 'لا يوجد رقم هاتف لهذا العميل', variant: 'destructive' });
      return;
    }
    openWhatsApp(customerPhone, customerName, customerBalance, rowsWithBalance.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl p-0 w-full max-w-4xl border border-line shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-line bg-surface flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-ink">كشف حساب</h3>
              {isSupplier && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  يتم الشراء منه
                </span>
              )}
            </div>
            <p className="text-amber-400 font-bold text-lg mt-0.5">{customerName}</p>
            {customerPhone && <p className="text-ink/40 text-xs mt-0.5">📞 {customerPhone}</p>}
            {isSupplier ? (
              <div className="mt-2 space-y-0.5 text-xs">
                <p className="text-ink/50">
                  إجمالي المبيعات له:{' '}
                  <span className="text-amber-400 font-bold">{formatCurrency(totalSales)}</span>
                </p>
                <p className="text-ink/50">
                  إجمالي المشتريات منه:{' '}
                  <span className="text-ink/70 font-bold">
                    {formatCurrency(totalPurchases)}
                  </span>
                </p>
                {totalPurchaseReturns > 0 && (
                  <p className="text-ink/50">
                    مرتجع مشتريات:{' '}
                    <span className="text-ink/70 font-bold">
                      {formatCurrency(totalPurchaseReturns)}
                    </span>
                  </p>
                )}
                <p className="text-ink/50">
                  المدفوعات والمقبوضات:{' '}
                  <span className="text-emerald-400 font-bold">
                    {formatCurrency(totalReceipts + totalSupplierPayments + totalPayments)}
                  </span>
                </p>
                <p
                  className={`font-bold text-sm mt-1 ${customerBalance > 0 ? 'text-green-400' : customerBalance < 0 ? 'text-red-400' : 'text-ink/40'}`}
                >
                  الرصيد الصافي:{' '}
                  {customerBalance > 0
                    ? `عليه لنا ${formatCurrency(customerBalance)}`
                    : customerBalance < 0
                      ? `له علينا ${formatCurrency(Math.abs(customerBalance))}`
                      : 'متسوّى'}
                </p>
              </div>
            ) : (
              <p
                className={`text-sm mt-1 font-semibold ${customerBalance > 0 ? 'text-yellow-400' : customerBalance < 0 ? 'text-orange-400' : 'text-ink/40'}`}
              >
                الرصيد:{' '}
                {customerBalance > 0
                  ? `${formatCurrency(customerBalance)} — العميل مدين`
                  : customerBalance < 0
                    ? `${formatCurrency(Math.abs(customerBalance))} — دائن للعميل`
                    : 'متسوّى'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsApp}
              title={customerPhone ? 'إرسال ملخص الكشف على واتساب' : 'لا يوجد رقم هاتف مسجل'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${customerPhone ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30' : 'bg-surface text-ink/20 border-line cursor-not-allowed'}`}
            >
              <MessageCircle className="w-4 h-4" /> واتساب
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-2 rounded-xl text-sm font-bold border border-blue-500/30 transition-all"
            >
              <Printer className="w-4 h-4" /> PDF / طباعة
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-surface hover:bg-raised transition-colors"
            >
              <X className="w-5 h-5 text-ink/70" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          <LedgerSummary
            totalSales={totalSales}
            sales={sales}
            totalPurchases={totalPurchases}
            purchases={purchases}
            totalReceipts={totalReceipts}
            receipts={receipts}
            totalPayments={totalPayments}
            payments={payments}
            totalReturns={totalReturns}
            returns_={returns_}
            totalSupplierPayments={totalSupplierPayments}
            supplierPayments={supplierPayments}
            totalPurchaseReturns={totalPurchaseReturns}
            purchaseReturns={purchaseReturns}
            customerBalance={customerBalance}
            isSupplier={isSupplier}
          />

          <LedgerFilters
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            rowsWithBalance={rowsWithBalance}
            isSupplier={isSupplier}
            customerBalance={customerBalance}
            reportFrom={reportFrom}
            setReportFrom={setReportFrom}
            reportTo={reportTo}
            setReportTo={setReportTo}
            reportData={reportData}
            reportLoading={reportLoading}
            reportStmt={reportStmt}
          />

          {activeTab === 'ledger' && (
            <LedgerTable
              ledgerData={ledgerData}
              ledgerLoading={ledgerLoading}
              isSupplier={isSupplier}
              safes={safes}
              showDirectPayment={showDirectPayment}
              setShowDirectPayment={setShowDirectPayment}
              directPayForm={directPayForm}
              setDirectPayForm={setDirectPayForm}
              onDirectPaySubmit={(form) => directPayMutation.mutate(form)}
              directPayPending={directPayMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}
