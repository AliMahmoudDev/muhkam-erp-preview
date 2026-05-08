import { useState, useRef } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  PurchaseRow,
  ActivityEntry,
  pushActivity,
  readSheetRows,
  writeXlsxBlob,
  downloadBlob,
} from '../data-utils';

export function useProductsImport(onRefreshLog: () => void) {
  const { toast } = useToast();
  const [prodImporting, setProdImporting] = useState(false);
  const [prodExporting, setProdExporting] = useState(false);
  const [prodResult, setProdResult] = useState<{ success: number; failed: number } | null>(null);
  const prodRef = useRef<HTMLInputElement>(null);

  const handleProductsExport = async () => {
    setProdExporting(true);
    try {
      const prods = (await authFetch(api('/api/products')).then((r) => r.json())) as {
        id: number; name: string; sku?: string; category?: string;
        quantity?: number | string; cost_price?: number | string;
        sale_price?: number | string; low_stock_threshold?: number | string;
      }[];
      const columns = [
        { header: 'اسم الصنف', key: 'name', width: 25 },
        { header: 'كود الصنف (SKU)', key: 'sku', width: 15 },
        { header: 'التصنيف', key: 'category', width: 15 },
        { header: 'الكمية', key: 'quantity', width: 10 },
        { header: 'سعر التكلفة', key: 'cost_price', width: 14 },
        { header: 'سعر البيع', key: 'sale_price', width: 14 },
        { header: 'حد التنبيه', key: 'low_stock_threshold', width: 12 },
      ];
      const rows = prods.map((p) => ({
        name: p.name,
        sku: p.sku || '',
        category: p.category || '',
        quantity: Number(p.quantity),
        cost_price: Number(p.cost_price),
        sale_price: Number(p.sale_price),
        low_stock_threshold: p.low_stock_threshold || '',
      }));
      const blob = await writeXlsxBlob(columns, rows, 'الأصناف');
      downloadBlob(blob, `products-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: `تم تصدير ${prods.length} صنف` });
    } catch {
      toast({ title: 'فشل التصدير', variant: 'destructive' });
    } finally {
      setProdExporting(false);
    }
  };

  const handleProductsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProdImporting(true);
    setProdResult(null);
    try {
      const rows = await readSheetRows(await file.arrayBuffer());
      let ok = 0, fail = 0;
      for (const row of rows) {
        const name = row['اسم الصنف'] || row['name'] || row['Name'];
        if (!name) { fail++; continue; }
        try {
          const r = await authFetch(api('/api/products'), {
            method: 'POST',
            body: JSON.stringify({
              name: String(name),
              sku: String(row['كود الصنف (SKU)'] || row['sku'] || ''),
              category: String(row['التصنيف'] || ''),
              quantity: Number(row['الكمية'] || 0),
              cost_price: Number(row['سعر التكلفة'] || 0),
              sale_price: Number(row['سعر البيع'] || 0),
              low_stock_threshold: row['حد التنبيه'] ? Number(row['حد التنبيه']) : undefined,
            }),
          });
          if (r.ok) ok++; else fail++;
        } catch {
          fail++;
        }
      }
      setProdResult({ success: ok, failed: fail });
      pushActivity({
        date: new Date().toISOString(),
        type: 'import-products',
        file: file.name,
        status: `✅ ${ok} صنف${fail > 0 ? ` — ⚠️ ${fail} خطأ` : ''}`,
      });
      onRefreshLog();
      toast({ title: `تم استيراد ${ok} صنف${fail > 0 ? ` — ${fail} فشل` : ''}` });
    } catch {
      toast({ title: 'فشل قراءة الملف', variant: 'destructive' });
    } finally {
      setProdImporting(false);
      if (prodRef.current) prodRef.current.value = '';
    }
  };

  const downloadProductsTemplate = async () => {
    const columns = [
      { header: 'اسم الصنف', key: 'name', width: 25 },
      { header: 'كود الصنف (SKU)', key: 'sku', width: 15 },
      { header: 'التصنيف', key: 'category', width: 15 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'سعر التكلفة', key: 'cost_price', width: 14 },
      { header: 'سعر البيع', key: 'sale_price', width: 14 },
      { header: 'حد التنبيه', key: 'low_stock_threshold', width: 12 },
    ];
    const rows = [
      { name: 'شاشة LCD', sku: 'SCR001', category: 'قطع غيار', quantity: 10, cost_price: 150, sale_price: 200, low_stock_threshold: 5 },
      { name: 'بطارية أيفون', sku: 'BAT002', category: 'بطاريات', quantity: 20, cost_price: 80, sale_price: 120, low_stock_threshold: 3 },
    ];
    const blob = await writeXlsxBlob(columns, rows, 'الأصناف');
    downloadBlob(blob, 'template-products.xlsx');
  };

  return {
    prodImporting, prodExporting, prodResult, prodRef,
    handleProductsExport, handleProductsImport, downloadProductsTemplate,
  };
}

export function usePurchasesImport(onRefreshLog: () => void) {
  const { toast } = useToast();
  const [purRows, setPurRows] = useState<PurchaseRow[]>([]);
  const [purParsed, setPurParsed] = useState(false);
  const [purLoading, setPurLoading] = useState(false);
  const [purConfirming, setPurConfirming] = useState(false);
  const [purResult, setPurResult] = useState<string | null>(null);
  const [purSupplier, setPurSupplier] = useState('');
  const [purPayType, setPurPayType] = useState<'cash' | 'credit'>('cash');
  const purRef = useRef<HTMLInputElement>(null);

  const validRows = purRows.filter((r) => r.errors.length === 0);

  const handlePurchaseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPurLoading(true);
    setPurParsed(false);
    setPurRows([]);
    setPurResult(null);
    try {
      const products: { id: number; name: string; sku?: string }[] = await authFetch(
        api('/api/products')
      ).then((r) => (r.ok ? r.json() : []));
      const skuMap = new Map<string, { id: number; name: string }>();
      for (const p of products)
        if (p.sku) skuMap.set(String(p.sku).trim().toUpperCase(), { id: p.id, name: p.name });

      const raw = await readSheetRows(await file.arrayBuffer());
      const rows: PurchaseRow[] = raw.map((r, idx) => {
        const sku  = String(r['كود الصنف (SKU)'] || r['sku'] || '').trim();
        const name = String(r['اسم الصنف'] || r['name'] || '');
        const qty  = String(r['الكمية'] || r['quantity'] || '');
        const up   = String(r['سعر الشراء'] || r['unit_price'] || '');
        const errors: string[] = [];
        if (!sku) errors.push('كود مفقود');
        else if (!skuMap.has(sku.toUpperCase())) errors.push(`كود غير موجود: ${sku}`);
        if (!qty || isNaN(+qty) || +qty <= 0) errors.push('كمية غير صالحة');
        if (!up  || isNaN(+up)  || +up  <= 0) errors.push('سعر غير صالح');
        const res = skuMap.get(sku.toUpperCase());
        return {
          idx, sku,
          name: name || res?.name || '',
          quantity: qty, unitPrice: up,
          supplier:  String(r['المورد'] || ''),
          invoiceNo: String(r['رقم الفاتورة'] || ''),
          date:      String(r['تاريخ الفاتورة'] || ''),
          tax:       String(r['الضريبة%'] || '0'),
          discount:  String(r['الخصم%'] || '0'),
          productId: res?.id ?? null,
          errors,
        };
      });
      setPurRows(rows);
      setPurParsed(true);
      if (rows.length > 0 && rows[0].supplier) setPurSupplier(rows[0].supplier);
    } catch {
      toast({ title: 'فشل قراءة الملف', variant: 'destructive' });
    } finally {
      setPurLoading(false);
      if (purRef.current) purRef.current.value = '';
    }
  };

  const updatePurRow = (idx: number, field: 'quantity' | 'unitPrice', val: string) => {
    setPurRows((prev) =>
      prev.map((r) => {
        if (r.idx !== idx) return r;
        const u = { ...r, [field]: val };
        const errors: string[] = [];
        if (!u.sku) errors.push('كود مفقود');
        else if (!u.productId) errors.push('كود غير موجود');
        if (!u.quantity || isNaN(+u.quantity) || +u.quantity <= 0) errors.push('كمية غير صالحة');
        if (!u.unitPrice || isNaN(+u.unitPrice) || +u.unitPrice <= 0) errors.push('سعر غير صالح');
        return { ...u, errors };
      })
    );
  };

  const handlePurchaseConfirm = async () => {
    if (!validRows.length) return;
    setPurConfirming(true);
    try {
      const items = validRows.map((r) => {
        const qty = +r.quantity, price = +r.unitPrice;
        const net = price * (1 - +r.discount / 100);
        return {
          product_id:   r.productId!,
          product_name: r.name,
          quantity:     qty,
          unit_price:   net,
          total_price:  qty * net * (1 + +r.tax / 100),
        };
      });
      const total = items.reduce((s, i) => s + i.total_price, 0);
      const r = await authFetch(api('/api/purchases'), {
        method: 'POST',
        body: JSON.stringify({
          payment_type: purPayType,
          total_amount: total,
          paid_amount:  purPayType === 'credit' ? 0 : total,
          items,
          supplier_name: purSupplier || undefined,
          notes: `استيراد Excel — ${validRows.length} صنف`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'فشل');
      const msg = `تم إنشاء فاتورة ${d.invoice_no} — ${validRows.length} صنف`;
      setPurResult(msg);
      pushActivity({
        date: new Date().toISOString(),
        type: 'import-purchases',
        file: 'Excel',
        status: `✅ ${validRows.length} صنف — ${d.invoice_no}`,
      });
      onRefreshLog();
      toast({ title: msg });
    } catch (err: unknown) {
      toast({ title: (err as Error)?.message || 'فشل', variant: 'destructive' });
    } finally {
      setPurConfirming(false);
    }
  };

  const downloadPurchaseTemplate = async () => {
    const columns = [
      { header: 'كود الصنف (SKU)', key: 'sku', width: 16 },
      { header: 'اسم الصنف', key: 'name', width: 22 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'سعر الشراء', key: 'unit_price', width: 13 },
      { header: 'المورد', key: 'supplier', width: 18 },
      { header: 'تاريخ الفاتورة', key: 'date', width: 15 },
      { header: 'رقم الفاتورة', key: 'invoice_no', width: 14 },
      { header: 'الضريبة%', key: 'tax', width: 10 },
      { header: 'الخصم%', key: 'discount', width: 10 },
    ];
    const rows = [{
      sku: 'SCR001', name: 'شاشة LCD', quantity: 10, unit_price: 150,
      supplier: 'مورد الشاشات', date: '2024-01-15', invoice_no: 'INV-001', tax: 14, discount: 0,
    }];
    const blob = await writeXlsxBlob(columns, rows, 'المشتريات');
    downloadBlob(blob, 'template-purchases.xlsx');
  };

  const resetPurchases = () => {
    setPurParsed(false);
    setPurRows([]);
    setPurResult(null);
  };

  return {
    purRows, purParsed, setPurParsed, setPurRows,
    purLoading, purConfirming, purResult, setPurResult,
    purSupplier, setPurSupplier, purPayType, setPurPayType,
    purRef, validRows,
    handlePurchaseFile, updatePurRow, handlePurchaseConfirm,
    downloadPurchaseTemplate, resetPurchases,
  };
}

export type { ActivityEntry };
