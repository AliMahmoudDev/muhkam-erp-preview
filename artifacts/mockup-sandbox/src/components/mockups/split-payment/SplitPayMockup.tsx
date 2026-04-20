import { useState } from "react";
import "./tokens.css";

const TOTAL = 1000;

const SAFES = [
  { id: 1, name: "الخزينة الرئيسية" },
  { id: 2, name: "خزينة 2" },
  { id: 3, name: "خزينة 3" },
  { id: 4, name: "خزينة 4" },
];

type Row = {
  id: number;
  type: "cash" | "credit";
  safe_id: number;
  amount: string;
};

const initialRows: Row[] = [
  { id: 1, type: "cash",   safe_id: 1, amount: "400" },
  { id: 2, type: "cash",   safe_id: 2, amount: "200" },
  { id: 3, type: "cash",   safe_id: 3, amount: "100" },
  { id: 4, type: "cash",   safe_id: 4, amount: "100" },
  { id: 5, type: "credit", safe_id: 1, amount: "200" },
];

export function SplitPayMockup() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [nextId, setNextId] = useState(6);

  const totalPaid   = rows.filter(r => r.type === "cash").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalCredit = rows.filter(r => r.type === "credit").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalAll    = totalPaid + totalCredit;
  const remaining   = TOTAL - totalAll;
  const pct         = Math.min(100, Math.round((totalAll / TOTAL) * 100));
  const isValid     = Math.abs(remaining) < 0.05;

  const addRow = (type: "cash" | "credit") => {
    setRows(prev => [...prev, { id: nextId, type, safe_id: 1, amount: "" }]);
    setNextId(n => n + 1);
  };

  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (id: number, key: keyof Row, val: string | number) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));

  const fillRemaining = (id: number) => {
    const otherSum = rows.filter(r => r.id !== id).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const fill = Math.max(0, TOTAL - otherSum);
    updateRow(id, "amount", fill.toFixed(0));
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0a0a14 0%, #0d0d1f 50%, #0a0f1e 100%)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px)",
          borderColor: "rgba(245,158,11,0.25)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Amber top stripe */}
        <div style={{ height: 2, background: "linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)" }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            ✕
          </button>
          <div className="text-right">
            <h2 className="font-bold text-white text-lg" style={{ fontFamily: "Tajawal, Cairo, sans-serif" }}>
              تسوية الدفع
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF", fontFamily: "Tajawal, Cairo, sans-serif" }}>
              الإجمالي: <span className="text-amber-400 font-bold">{TOTAL.toLocaleString("ar-EG")} ج.م</span>
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: "rgba(245,158,11,0.12)" }}
          >
            🏦
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ fontFamily: "Tajawal, Cairo, sans-serif" }}>
            <span style={{ color: isValid ? "#10B981" : "#F59E0B" }} className="font-bold">
              {isValid ? "✓ مكتمل" : remaining > 0 ? `متبقي: ${remaining.toFixed(0)} ج.م` : `زيادة: ${Math.abs(remaining).toFixed(0)} ج.م`}
            </span>
            <span style={{ color: "#9CA3AF" }}>{pct}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: isValid
                  ? "linear-gradient(90deg, #10B981, #34D399)"
                  : pct > 100
                  ? "linear-gradient(90deg, #EF4444, #F87171)"
                  : "linear-gradient(90deg, #F59E0B, #FBBF24)",
              }}
            />
          </div>
          {/* Summary chips */}
          <div className="flex gap-2 mt-2 flex-wrap justify-end">
            {totalPaid > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399", fontFamily: "Tajawal, Cairo, sans-serif" }}>
                نقدي: {totalPaid.toLocaleString("ar-EG")} ج.م
              </span>
            )}
            {totalCredit > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#818CF8", fontFamily: "Tajawal, Cairo, sans-serif" }}>
                آجل: {totalCredit.toLocaleString("ar-EG")} ج.م
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 4 }} />

        {/* Rows */}
        <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="flex items-center gap-2 rounded-xl p-2.5"
              style={{
                background: row.type === "credit"
                  ? "rgba(99,102,241,0.08)"
                  : "rgba(16,185,129,0.06)",
                border: `1px solid ${row.type === "credit" ? "rgba(99,102,241,0.20)" : "rgba(16,185,129,0.15)"}`,
              }}
            >
              {/* Delete */}
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-red-400 hover:text-red-300 flex-shrink-0 text-sm w-6 h-6 flex items-center justify-center rounded-lg"
                  style={{ background: "rgba(239,68,68,0.08)" }}
                >
                  ×
                </button>
              )}

              {/* Amount input */}
              <div className="relative flex-shrink-0" style={{ width: 90 }}>
                <input
                  type="number"
                  min={0}
                  value={row.amount}
                  onChange={e => updateRow(row.id, "amount", e.target.value)}
                  className="w-full text-center rounded-lg text-sm font-bold outline-none transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#fff",
                    padding: "6px 4px",
                    fontFamily: "Tajawal, Cairo, sans-serif",
                  }}
                  placeholder="0"
                />
                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#9CA3AF" }}>ج.م</span>
              </div>

              {/* Fill remainder button */}
              <button
                onClick={() => fillRemaining(row.id)}
                className="text-xs px-1.5 py-1 rounded-lg flex-shrink-0 transition-colors"
                style={{ background: "rgba(245,158,11,0.10)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.20)", fontFamily: "Tajawal, Cairo, sans-serif" }}
                title="تعبئة المتبقي"
              >
                ⟳ باقي
              </button>

              {/* Safe selector (only for cash) */}
              {row.type === "cash" ? (
                <select
                  value={row.safe_id}
                  onChange={e => updateRow(row.id, "safe_id", Number(e.target.value))}
                  className="flex-1 rounded-lg text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#fff",
                    padding: "6px 8px",
                    fontFamily: "Tajawal, Cairo, sans-serif",
                    direction: "rtl",
                  }}
                >
                  {SAFES.map(s => (
                    <option key={s.id} value={s.id} style={{ background: "#1a1a2e", color: "#fff" }}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className="flex-1 text-sm font-bold text-right"
                  style={{ color: "#818CF8", fontFamily: "Tajawal, Cairo, sans-serif" }}
                >
                  آجل على العميل
                </span>
              )}

              {/* Type badge */}
              <span
                className="flex-shrink-0 text-xs px-2 py-1 rounded-lg font-bold"
                style={{
                  background: row.type === "credit" ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.12)",
                  color: row.type === "credit" ? "#818CF8" : "#34D399",
                  fontFamily: "Tajawal, Cairo, sans-serif",
                }}
              >
                {row.type === "cash" ? "💵 نقدي" : "⏳ آجل"}
              </span>
            </div>
          ))}
        </div>

        {/* Add row buttons */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => addRow("credit")}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "rgba(99,102,241,0.10)",
              border: "1px dashed rgba(99,102,241,0.30)",
              color: "#818CF8",
              fontFamily: "Tajawal, Cairo, sans-serif",
            }}
          >
            + آجل
          </button>
          <button
            onClick={() => addRow("cash")}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px dashed rgba(16,185,129,0.25)",
              color: "#34D399",
              fontFamily: "Tajawal, Cairo, sans-serif",
            }}
          >
            + نقدي
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Summary totals */}
        <div className="px-5 py-3 space-y-1.5">
          {[
            { label: "إجمالي الفاتورة", val: TOTAL, color: "#fff" },
            { label: "المدفوع نقداً", val: totalPaid, color: "#34D399" },
            { label: "مؤجل على العميل", val: totalCredit, color: "#818CF8" },
            { label: "المتبقي", val: remaining, color: remaining > 0 ? "#F59E0B" : remaining < 0 ? "#EF4444" : "#10B981" },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center">
              <span className="font-bold text-sm" style={{ color: item.color, fontFamily: "Tajawal, Cairo, sans-serif" }}>
                {Math.abs(item.val).toLocaleString("ar-EG")} ج.م
                {item.val < 0 && " ⚠"}
              </span>
              <span className="text-sm" style={{ color: "#9CA3AF", fontFamily: "Tajawal, Cairo, sans-serif" }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Confirm button */}
        <div className="px-5 pb-5 pt-1">
          <button
            disabled={!isValid}
            className="w-full py-3.5 rounded-xl font-black text-base transition-all"
            style={{
              fontFamily: "Tajawal, Cairo, sans-serif",
              background: isValid
                ? "linear-gradient(135deg, #F59E0B, #FBBF24)"
                : "rgba(255,255,255,0.06)",
              color: isValid ? "#0a0500" : "#6B7280",
              cursor: isValid ? "pointer" : "not-allowed",
              boxShadow: isValid ? "0 4px 20px rgba(245,158,11,0.35)" : "none",
              border: isValid ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {isValid ? "✓ تأكيد وإصدار الفاتورة" : `أدخل المبلغ المتبقي (${remaining.toFixed(0)} ج.م)`}
          </button>
          <p className="text-center text-xs mt-2" style={{ color: "#6B7280", fontFamily: "Tajawal, Cairo, sans-serif" }}>
            يمكنك الدفع على عدة خزن ودمج الآجل في فاتورة واحدة
          </p>
        </div>
      </div>
    </div>
  );
}
