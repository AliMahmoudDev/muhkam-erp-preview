import { TrendingUp, TrendingDown, RotateCcw, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface LedgerSummaryProps {
  totalSales: number; sales: unknown[];
  totalPurchases: number; purchases: unknown[];
  totalReceipts: number; receipts: unknown[];
  totalPayments: number; payments: unknown[];
  totalReturns: number; returns_: unknown[];
  totalSupplierPayments: number; supplierPayments: unknown[];
  totalPurchaseReturns: number; purchaseReturns: unknown[];
  customerBalance: number;
  isSupplier: boolean;
}

export function LedgerSummary({
  totalSales, sales, totalPurchases, purchases, totalReceipts, receipts,
  totalPayments, payments, totalReturns, returns_, totalSupplierPayments, supplierPayments,
  totalPurchaseReturns, purchaseReturns, customerBalance, isSupplier,
}: LedgerSummaryProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
        <p className="text-amber-400 text-xs mb-1 flex items-center justify-center gap-1">
          <TrendingUp className="w-3 h-3" /> إجمالي المبيعات
        </p>
        <p className="text-ink font-black">{formatCurrency(totalSales)}</p>
        <p className="text-ink/40 text-xs">{sales.length} فاتورة</p>
      </div>
      {totalPurchases > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 text-center">
          <p className="text-purple-400 text-xs mb-1 flex items-center justify-center gap-1">
            <TrendingDown className="w-3 h-3" /> مشترياتنا منه
          </p>
          <p className="text-ink font-black">{formatCurrency(totalPurchases)}</p>
          <p className="text-ink/40 text-xs">{purchases.length} فاتورة</p>
        </div>
      )}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
        <p className="text-emerald-400 text-xs mb-1 flex items-center justify-center gap-1">
          <ArrowDownToLine className="w-3 h-3" /> إجمالي القبض
        </p>
        <p className="text-ink font-black">{formatCurrency(totalReceipts)}</p>
        <p className="text-ink/40 text-xs">{receipts.length} سند</p>
      </div>
      {totalPayments > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 text-center">
          <p className="text-orange-400 text-xs mb-1 flex items-center justify-center gap-1">
            <ArrowUpFromLine className="w-3 h-3" /> إجمالي التوريد
          </p>
          <p className="text-ink font-black">{formatCurrency(totalPayments)}</p>
          <p className="text-ink/40 text-xs">{payments.length} سند</p>
        </div>
      )}
      {totalSupplierPayments > 0 && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-3 text-center">
          <p className="text-cyan-400 text-xs mb-1">تسديد دفعة</p>
          <p className="text-ink font-black">{formatCurrency(totalSupplierPayments)}</p>
          <p className="text-ink/40 text-xs">{supplierPayments.length} حركة</p>
        </div>
      )}
      {totalPurchaseReturns > 0 && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-3 text-center">
          <p className="text-violet-400 text-xs mb-1">مرتجع مشتريات</p>
          <p className="text-ink font-black">{formatCurrency(totalPurchaseReturns)}</p>
          <p className="text-ink/40 text-xs">{purchaseReturns.length} مرتجع</p>
        </div>
      )}
      {totalReturns > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
          <p className="text-blue-400 text-xs mb-1 flex items-center justify-center gap-1">
            <RotateCcw className="w-3 h-3" /> إجمالي المرتجعات
          </p>
          <p className="text-ink font-black">{formatCurrency(totalReturns)}</p>
          <p className="text-ink/40 text-xs">{returns_.length} مرتجع</p>
        </div>
      )}
      {isSupplier ? (
        <div className={`${customerBalance > 0 ? 'bg-green-500/10 border-green-500/20' : customerBalance < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-surface border-line'} border rounded-2xl p-3 text-center`}>
          <p className={`text-xs mb-1 ${customerBalance > 0 ? 'text-green-400' : customerBalance < 0 ? 'text-red-400' : 'text-ink/40'}`}>الرصيد الصافي</p>
          <p className={`font-black ${customerBalance > 0 ? 'text-green-400' : customerBalance < 0 ? 'text-red-400' : 'text-ink/40'}`}>{formatCurrency(Math.abs(customerBalance))}</p>
          <p className="text-ink/40 text-xs">{customerBalance > 0 ? 'عليه لنا' : customerBalance < 0 ? 'له علينا' : 'متسوّى'}</p>
        </div>
      ) : (
        <div className={`${customerBalance > 0 ? 'bg-amber-500/10 border-amber-500/20' : customerBalance < 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-surface border-line'} border rounded-2xl p-3 text-center`}>
          <p className={`text-xs mb-1 ${customerBalance > 0 ? 'text-amber-400' : customerBalance < 0 ? 'text-blue-400' : 'text-ink/40'}`}>الرصيد الصافي</p>
          <p className={`font-black ${customerBalance > 0 ? 'text-amber-400' : customerBalance < 0 ? 'text-blue-400' : 'text-ink/40'}`}>{formatCurrency(Math.abs(customerBalance))}</p>
          <p className="text-ink/40 text-xs">{customerBalance > 0 ? 'عليه' : customerBalance < 0 ? 'دائن له' : 'متسوّى'}</p>
        </div>
      )}
    </div>
  );
}
