import {
  ShoppingCart,
  Landmark,
  TrendingDown,
  TrendingUp,
  ReceiptText,
  DollarSign,
} from 'lucide-react';

/* ── Transaction meta ─────────────────────────────────────── */
export const TX_LABELS: Record<string, string> = {
  sale: 'مبيعة',
  sale_cash: 'بيع نقدي',
  sale_credit: 'بيع آجل',
  sale_partial: 'بيع جزئي',
  sale_cancel: 'إلغاء بيع',
  sale_return: 'مرتجع مبيعات',
  sales_return: 'مرتجع مبيعات',
  sale_return_cancel: 'إلغاء مرتجع مبيعات',
  purchase: 'فاتورة شراء',
  purchase_cash: 'شراء نقدي',
  purchase_credit: 'شراء آجل',
  purchase_partial: 'شراء جزئي',
  purchase_return: 'مرتجع مشتريات',
  purchase_cancel: 'إلغاء شراء',
  expense: 'مصروف',
  income: 'إيراد',
  receipt: 'سند قبض',
  receipt_voucher: 'سند قبض',
  payment: 'سند صرف',
  payment_voucher: 'سند صرف',
  deposit: 'سند توريد',
  transfer: 'تحويل خزينة',
  customer_payment: 'سداد عميل',
  supplier_payment: 'تسديد دفعة',
  customer_opening: 'رصيد أول مدة عميل',
  supplier_opening: 'رصيد أول مدة مورد',
};

export const TX_ICONS: Record<string, typeof ShoppingCart> = {
  sale: ShoppingCart,
  purchase: Landmark,
  expense: TrendingDown,
  income: TrendingUp,
  receipt: ReceiptText,
  deposit: DollarSign,
};

export const TX_IS_INCOME = new Set([
  'sale',
  'receipt',
  'income',
  'deposit',
  'sale_cash',
  'sale_credit',
  'sale_partial',
  'receipt_voucher',
]);

export const DEFAULT_SHORTCUTS = ['new-sale', 'new-receipt', 'new-repair', 'new-purchase'];
