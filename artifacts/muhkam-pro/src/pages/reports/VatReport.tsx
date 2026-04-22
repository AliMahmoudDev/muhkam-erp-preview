/**
 * VatReport — تقرير ضريبة القيمة المضافة (VAT)
 * ضريبة المخرجات (المبيعات) — ضريبة المدخلات (المشتريات) — الصافي المستحق
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, ArrowUpCircle, ArrowDownCircle, Scale, RefreshCw, Download } from "lucide-react";
import { api, authFetch, formatCurrency } from "./shared";

interface VatData {
  output_vat: { total_sales: number; tax_amount: number; invoice_count: number };
  input_vat:  { total_purchases: number; tax_amount: number; invoice_count: number };
  net_vat_payable: number;
  vat_status: string;
  period: { date_from: string | null; date_to: string | null };
  generated_at: string;
}

export default function VatReport({ warehouseId }: { warehouseId?: number | null }) {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo]   = useState(today);
  const [enabled, setEnabled] = useState(false);

  const whParam = warehouseId ? `&warehouse_id=${warehouseId}` : "";

  const { data, isLoading, refetch } = useQuery<VatData>({
    queryKey: ["vat-report", dateFrom, dateTo, warehouseId],
    queryFn: () =>
      authFetch(api(`/api/reports/vat-report?date_from=${dateFrom}&date_to=${dateTo}${whParam}`))
        .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    enabled,
    staleTime: 30_000,
  });

  const handleGenerate = () => { setEnabled(true); void refetch(); };

  const handleCsvExport = () => {
    if (!data) return;
    const rows = [
      ["البيان", "القيمة"],
      ["إجمالي المبيعات", Number(data.output_vat.total_sales).toFixed(2)],
      ["عدد فواتير المبيعات", String(data.output_vat.invoice_count)],
      ["ضريبة المخرجات (مبيعات)", Number(data.output_vat.tax_amount).toFixed(2)],
      [],
      ["إجمالي المشتريات", Number(data.input_vat.total_purchases).toFixed(2)],
      ["عدد فواتير المشتريات", String(data.input_vat.invoice_count)],
      ["ضريبة المدخلات (مشتريات)", Number(data.input_vat.tax_amount).toFixed(2)],
      [],
      ["صافي الضريبة المستحقة", Number(data.net_vat_payable).toFixed(2)],
      ["الحالة", data.vat_status === "payable" ? "مستحقة للسداد" : data.vat_status === "refundable" ? "مستحقة الاسترداد" : "متوازنة"],
      [],
      ["من تاريخ", data.period.date_from ?? ""],
      ["إلى تاريخ", data.period.date_to ?? ""],
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vat-report-${dateFrom}-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const netPositive = (data?.net_vat_payable ?? 0) >= 0;

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 bg-white/5 rounded-2xl p-4 border border-white/10 no-print">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">من تاريخ</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">إلى تاريخ</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50" />
        </div>
        <button onClick={handleGenerate} disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all text-sm disabled:opacity-50">
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          توليد تقرير الضريبة
        </button>
        {data && (
          <button onClick={handleCsvExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 rounded-xl text-sm transition-all font-bold">
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
        )}
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Output VAT */}
          <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-400">ضريبة المخرجات (مبيعات)</span>
              <ArrowUpCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-300 mb-1">{formatCurrency(data.output_vat.tax_amount)}</div>
            <div className="text-xs text-white/40">
              إجمالي المبيعات: {formatCurrency(data.output_vat.total_sales)}
            </div>
            <div className="text-xs text-white/30 mt-1">{data.output_vat.invoice_count} فاتورة</div>
          </div>

          {/* Input VAT */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-400">ضريبة المدخلات (مشتريات)</span>
              <ArrowDownCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 mb-1">{formatCurrency(data.input_vat.tax_amount)}</div>
            <div className="text-xs text-white/40">
              إجمالي المشتريات: {formatCurrency(data.input_vat.total_purchases)}
            </div>
            <div className="text-xs text-white/30 mt-1">{data.input_vat.invoice_count} فاتورة</div>
          </div>

          {/* Net VAT */}
          <div className={`border rounded-2xl p-5 ${netPositive ? "bg-red-500/8 border-red-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold ${netPositive ? "text-red-400" : "text-emerald-400"}`}>
                الضريبة الصافية
              </span>
              <Scale className={`w-5 h-5 ${netPositive ? "text-red-400" : "text-emerald-400"}`} />
            </div>
            <div className={`text-2xl font-bold mb-1 ${netPositive ? "text-red-300" : "text-emerald-300"}`}>
              {formatCurrency(Math.abs(data.net_vat_payable))}
            </div>
            <div className={`text-xs font-bold ${netPositive ? "text-red-400" : "text-emerald-400"}`}>
              {data.vat_status}
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      {data && (
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5 text-sm">
          <h3 className="font-bold text-white/80 mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            تفاصيل احتساب ضريبة القيمة المضافة
          </h3>
          <div className="space-y-2 text-white/60">
            <div className="flex justify-between">
              <span>ضريبة المخرجات (على المبيعات)</span>
              <span className="font-mono text-blue-300">{formatCurrency(data.output_vat.tax_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>ضريبة المدخلات (على المشتريات) — تُخصم</span>
              <span className="font-mono text-amber-300">({formatCurrency(data.input_vat.tax_amount)})</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 font-bold text-white/90">
              <span>{data.vat_status}</span>
              <span className={`font-mono ${netPositive ? "text-red-300" : "text-emerald-300"}`}>
                {formatCurrency(Math.abs(data.net_vat_payable))}
              </span>
            </div>
          </div>
          <p className="text-xs text-white/30 mt-3">
            * يُحتسب على أساس الفواتير المُرحَّلة فقط (posting_status = posted) خلال الفترة المحددة.
          </p>
        </div>
      )}

      {!data && !isLoading && (
        <div className="text-center py-16 text-white/30">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-bold mb-1">اختر فترة وانقر «توليد تقرير الضريبة»</p>
          <p className="text-sm">سيُعرض تقرير ضريبة القيمة المضافة مع تفاصيل المخرجات والمدخلات</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-32 rounded-2xl" />)}
        </div>
      )}
    </div>
  );
}
