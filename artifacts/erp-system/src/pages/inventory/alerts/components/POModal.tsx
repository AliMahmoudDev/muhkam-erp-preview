import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { openPrintWindow } from '@/lib/print-utils';
import { formatCurrency } from '@/lib/format';
import { exportToExcel } from '@/lib/inventory-export';
import { ClipboardList, X, Printer, FileSpreadsheet } from 'lucide-react';
import { api } from '../../_shared';
import type { ReorderSuggestion, Supplier } from '../types';

interface POModalProps {
  selected: Set<number>;
  suggestions: ReorderSuggestion[];
  onClose: () => void;
}

export function POModal({ selected, suggestions, onClose }: POModalProps) {
  const { data: suppliersRaw = [] } = useQuery<Supplier[]>({
    queryKey: ['customers-suppliers'],
    queryFn: () =>
      authFetch(api('/api/customers'))
        .then((r) => r.json())
        .then((d) => {
          const arr: Supplier[] = Array.isArray(d) ? d : (d.customers ?? []);
          return arr.filter((c) => c.is_supplier);
        }),
    staleTime: 60_000,
  });

  const items = suggestions.filter((s) => selected.has(s.product_id));
  const totalCost = items.reduce((a, s) => a + s.suggested_cost, 0);

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [poDate] = useState(() =>
    new Date().toLocaleDateString('ar-EG-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  const selectedSupplier = suppliersRaw.find((s) => String(s.id) === supplierId);

  function printPO() {
    const rows = items
      .map(
        (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:right">${s.product_name}${s.sku ? `<br><small style="color:#6b7280">${s.sku}</small>` : ''}</td>
          <td>${s.current_qty.toFixed(2)}</td>
          <td style="font-weight:bold;color:#6d28d9">${s.suggested_qty}</td>
          <td>${s.cost_price.toLocaleString('ar-EG')}</td>
          <td style="font-weight:bold;color:#059669">${s.suggested_cost.toLocaleString('ar-EG')}</td>
          <td style="color:#6b7280;font-size:11px">${s.reason ?? ''}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html><html dir="rtl" lang="ar">
<head><meta charset="utf-8"><title>أمر شراء ${poNumber}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo','Segoe UI',Arial,sans-serif; direction: rtl; color: #111827; margin: 0; }
  .header { background: linear-gradient(135deg,#4c1d95,#6d28d9); color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 900; }
  .header .meta { font-size: 12px; opacity: 0.8; margin-top: 6px; }
  .header .po-no { font-size: 14px; font-weight: 700; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .info-box label { color: #6b7280; font-size: 11px; display: block; margin-bottom: 4px; }
  .info-box .val { font-weight: 700; font-size: 14px; color: #111827; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th { background: #4c1d95; color: white; padding: 8px 6px; text-align: center; font-weight: 700; }
  td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; text-align: center; }
  tr:nth-child(even) td { background: #f9f7ff; }
  .total-row td { background: #ede9fe; font-weight: 900; font-size: 13px; border-top: 2px solid #6d28d9; }
  .footer { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
  .sign-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 16px; min-width: 160px; text-align: center; }
  .sign-box label { display: block; color: #6b7280; margin-bottom: 24px; }
  .notes-box { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #92400e; }
</style></head>
<body>
<div class="header">
  <div>
    <h1>🛒 أمر شراء</h1>
    <div class="meta">MUHKAM ERP · ${poDate}</div>
  </div>
  <div class="po-no">${poNumber}</div>
</div>

<div class="info-grid">
  <div class="info-box">
    <label>المورد</label>
    <div class="val">${selectedSupplier?.name ?? 'غير محدد'}</div>
    ${selectedSupplier?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${selectedSupplier.phone}</div>` : ''}
  </div>
  <div class="info-box">
    <label>تاريخ الأمر</label>
    <div class="val">${poDate}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">رقم: ${poNumber}</div>
  </div>
</div>

${notes ? `<div class="notes-box">📝 ${notes}</div>` : ''}

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>الصنف</th>
      <th>الكمية الحالية</th>
      <th>الكمية المطلوبة</th>
      <th>سعر الوحدة (ج.م)</th>
      <th>الإجمالي (ج.م)</th>
      <th>السبب</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="3">الإجمالي الكلي المقدّر</td>
      <td>${items.reduce((a, s) => a + s.suggested_qty, 0)}</td>
      <td>—</td>
      <td>${totalCost.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <div class="sign-box"><label>توقيع المعتمد</label></div>
  <div class="sign-box"><label>توقيع المستلم</label></div>
  <div style="align-self:flex-end;font-size:10px">طُبع بواسطة MUHKAM ERP · ${new Date().toLocaleString('ar-EG-u-nu-latn')}</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;

    openPrintWindow(html, { width: 1024, height: 768 });
  }

  function exportPOExcel() {
    void exportToExcel({
      filename: `purchase-order-${poNumber}`,
      sheetName: 'أمر شراء',
      title: `أمر شراء ${poNumber} — ${selectedSupplier?.name ?? ''} — ${poDate}`,
      columns: [
        {
          header: '#',
          key: '_idx',
          width: 6,
          format: (_r: ReorderSuggestion, i?: number) => (i ?? 0) + 1,
        },
        { header: 'الصنف', key: 'product_name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        {
          header: 'الكمية الحالية',
          key: 'current_qty',
          width: 14,
          format: (r) => r.current_qty.toFixed(2),
        },
        { header: 'الكمية المطلوبة', key: 'suggested_qty', width: 14 },
        { header: 'سعر الوحدة', key: 'cost_price', width: 14 },
        {
          header: 'الإجمالي',
          key: 'suggested_cost',
          width: 14,
          format: (r) => r.suggested_cost.toFixed(2),
        },
        { header: 'السبب', key: 'reason', width: 30 },
      ],
      rows: items,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] border border-violet-500/30 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <h2 className="text-ink font-bold text-lg">إنشاء أمر شراء</h2>
              <p className="text-ink/40 text-xs">
                {items.length} صنف · إجمالي مقدّر: {formatCurrency(totalCost)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-ink/50 text-xs mb-1.5">المورد</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            >
              <option value="" className="bg-[#1a1a2e]">
                — اختر المورد (اختياري) —
              </option>
              {suppliersRaw.map((s) => (
                <option key={s.id} value={String(s.id)} className="bg-[#1a1a2e]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-ink/50 text-xs mb-1.5">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: توريد عاجل / مواصفات خاصة..."
              className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            />
          </div>

          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface">
                  <th className="p-2.5 text-right text-ink/60 font-medium text-xs">الصنف</th>
                  <th className="p-2.5 text-center text-ink/60 font-medium text-xs">
                    الكمية المطلوبة
                  </th>
                  <th className="p-2.5 text-center text-ink/60 font-medium text-xs">
                    التكلفة المقدّرة
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.product_id} className="border-b border-line">
                    <td className="p-2.5">
                      <div className="text-ink text-sm font-medium">{s.product_name}</div>
                      {s.sku && <div className="text-ink/40 text-xs font-mono">{s.sku}</div>}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-1 rounded-lg bg-violet-500/10 text-violet-300 font-bold font-mono text-sm">
                        {s.suggested_qty}
                      </span>
                    </td>
                    <td className="p-2.5 text-center text-emerald-300 font-mono text-sm">
                      {formatCurrency(s.suggested_cost)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-violet-500/30 bg-violet-500/5">
                  <td className="p-2.5 text-ink/60 text-xs font-bold" colSpan={1}>
                    الإجمالي
                  </td>
                  <td className="p-2.5 text-center font-bold text-ink font-mono">
                    {items.reduce((a, s) => a + s.suggested_qty, 0)} وحدة
                  </td>
                  <td className="p-2.5 text-center font-bold text-emerald-300 font-mono">
                    {formatCurrency(totalCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={printPO}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-500 hover:bg-violet-400 text-ink rounded-xl font-bold text-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> طباعة / PDF
            </button>
            <button
              onClick={exportPOExcel}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl font-bold text-sm border border-emerald-500/30 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-surface hover:bg-raised text-ink rounded-xl text-sm transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
