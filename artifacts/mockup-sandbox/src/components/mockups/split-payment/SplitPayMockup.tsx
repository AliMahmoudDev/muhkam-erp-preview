import { useState, useRef, useEffect } from "react";
import "./tokens.css";

const TOTAL = 1000;

const SAFES = [
  { id: 1, name: "الخزينة الرئيسية" },
  { id: 2, name: "خزينة 2" },
  { id: 3, name: "خزينة 3" },
  { id: 4, name: "خزينة 4" },
];

type ConfirmedRow = {
  id: number;
  type: "cash" | "credit";
  safe_id: number;
  amount: number;
};

const fmt = (n: number) =>
  n.toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function SplitPayMockup() {
  const [confirmed, setConfirmed] = useState<ConfirmedRow[]>([]);
  const [nextId, setNextId] = useState(1);

  // Active row state
  const [activeType, setActiveType] = useState<"cash" | "credit">("cash");
  const [activeSafe, setActiveSafe] = useState(1);
  const [activeAmount, setActiveAmount] = useState("");
  const [shake, setShake] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  const paidSoFar = confirmed.reduce((s, r) => s + r.amount, 0);
  const remaining = TOTAL - paidSoFar;
  const pct = Math.min(100, Math.round((paidSoFar / TOTAL) * 100));
  const done = Math.abs(remaining) < 0.05;

  useEffect(() => {
    amountRef.current?.focus();
  }, [confirmed.length]);

  const confirmRow = () => {
    const amt = parseFloat(activeAmount);
    if (!amt || amt <= 0) {
      triggerShake();
      return;
    }
    if (amt > remaining + 0.05) {
      triggerShake();
      return;
    }

    const row: ConfirmedRow = {
      id: nextId,
      type: activeType,
      safe_id: activeSafe,
      amount: amt,
    };
    setConfirmed(prev => [...prev, row]);
    setNextId(n => n + 1);
    setActiveAmount("");
    setActiveType("cash");
    setActiveSafe(1);
  };

  const fillAll = () => {
    if (remaining > 0) setActiveAmount(remaining.toFixed(0));
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const removeRow = (id: number) => {
    setConfirmed(prev => prev.filter(r => r.id !== id));
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") confirmRow();
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0a0a14 0%, #0d0d1f 50%, #0a0f1e 100%)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border overflow-hidden"
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
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}
          >✕</button>
          <div className="text-right">
            <h2 className="font-bold text-white text-base" style={{ fontFamily: "Tajawal, Cairo, sans-serif" }}>
              تسوية الدفع
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#9CA3AF", fontFamily: "Tajawal, Cairo, sans-serif" }}>
              إجمالي الفاتورة:&nbsp;
              <span className="text-amber-400 font-bold">{fmt(TOTAL)} ج.م</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: "rgba(245,158,11,0.12)" }}>
            🏦
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="flex justify-between text-xs mb-1" style={{ fontFamily: "Tajawal, Cairo, sans-serif" }}>
            <span style={{ color: done ? "#10B981" : "#F59E0B" }} className="font-bold">
              {done ? "✓ مكتمل" : `متبقي: ${fmt(remaining)} ج.م`}
            </span>
            <span style={{ color: "#9CA3AF" }}>{pct}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: done
                  ? "linear-gradient(90deg, #10B981, #34D399)"
                  : "linear-gradient(90deg, #F59E0B, #FBBF24)",
              }}
            />
          </div>
        </div>

        {/* Confirmed rows */}
        {confirmed.length > 0 && (
          <div className="px-4 pb-2 space-y-1.5">
            {confirmed.map((row, i) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{
                  background: row.type === "credit"
                    ? "rgba(99,102,241,0.10)"
                    : "rgba(16,185,129,0.08)",
                  border: `1px solid ${row.type === "credit" ? "rgba(99,102,241,0.22)" : "rgba(16,185,129,0.18)"}`,
                }}
              >
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-xs w-5 h-5 rounded flex items-center justify-center"
                  style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)" }}
                >✕</button>

                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="text-sm font-bold" style={{ color: "#fff", fontFamily: "Tajawal, Cairo, sans-serif" }}>
                    {fmt(row.amount)} ج.م
                  </span>
                  <span className="text-xs" style={{ color: "#9CA3AF", fontFamily: "Tajawal, Cairo, sans-serif" }}>
                    {row.type === "credit" ? "آجل على العميل" : SAFES.find(s => s.id === row.safe_id)?.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{
                      background: row.type === "credit" ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.12)",
                      color: row.type === "credit" ? "#818CF8" : "#34D399",
                      fontFamily: "Tajawal, Cairo, sans-serif",
                    }}
                  >
                    {row.type === "cash" ? "💵" : "⏳"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Active entry row ── */}
        {!done && (
          <div className="px-4 pb-4">
            <div
              className={`rounded-2xl p-3 transition-all ${shake ? "animate-shake" : ""}`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(245,158,11,0.30)",
                boxShadow: "0 0 0 1px rgba(245,158,11,0.08)",
              }}
            >
              {/* Type toggle */}
              <div className="flex gap-1.5 mb-3">
                {(["cash", "credit"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveType(t)}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      fontFamily: "Tajawal, Cairo, sans-serif",
                      background: activeType === t
                        ? t === "cash" ? "rgba(16,185,129,0.18)" : "rgba(99,102,241,0.18)"
                        : "rgba(255,255,255,0.04)",
                      color: activeType === t
                        ? t === "cash" ? "#34D399" : "#818CF8"
                        : "#6B7280",
                      border: `1px solid ${activeType === t
                        ? t === "cash" ? "rgba(16,185,129,0.35)" : "rgba(99,102,241,0.35)"
                        : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {t === "cash" ? "💵 نقدي" : "⏳ آجل"}
                  </button>
                ))}
              </div>

              {/* Dropdown + Amount row */}
              <div className="flex gap-2 items-center">
                {/* Safe dropdown (only for cash) */}
                {activeType === "cash" ? (
                  <select
                    value={activeSafe}
                    onChange={e => setActiveSafe(Number(e.target.value))}
                    className="flex-1 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                      padding: "10px 10px",
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
                  <div
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm text-right"
                    style={{
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.20)",
                      color: "#818CF8",
                      fontFamily: "Tajawal, Cairo, sans-serif",
                    }}
                  >
                    آجل على العميل
                  </div>
                )}

                {/* Amount input */}
                <div className="relative" style={{ width: 110 }}>
                  <input
                    ref={amountRef}
                    type="number"
                    min={0}
                    step="any"
                    value={activeAmount}
                    onChange={e => setActiveAmount(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={fmt(remaining)}
                    className="w-full rounded-xl text-center text-sm font-bold outline-none"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(245,158,11,0.30)",
                      color: "#fff",
                      padding: "10px 6px",
                      fontFamily: "Tajawal, Cairo, sans-serif",
                    }}
                  />
                  <span
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: "#6B7280" }}
                  >ج.م</span>
                </div>
              </div>

              {/* Helper row */}
              <div className="flex items-center justify-between mt-2.5">
                <button
                  onClick={confirmRow}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: "linear-gradient(135deg,#F59E0B,#FBBF24)",
                    color: "#0a0500",
                    fontFamily: "Tajawal, Cairo, sans-serif",
                    boxShadow: "0 2px 8px rgba(245,158,11,0.30)",
                  }}
                >
                  Enter ↵ تأكيد
                </button>
                <button
                  onClick={fillAll}
                  className="text-xs px-3 py-1.5 rounded-xl"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.20)",
                    color: "#F59E0B",
                    fontFamily: "Tajawal, Cairo, sans-serif",
                  }}
                >
                  كل المتبقي ({fmt(remaining)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
        <div className="px-5 py-3 space-y-1">
          {[
            { label: "إجمالي الفاتورة", val: TOTAL, color: "#E5E7EB" },
            {
              label: "نقدي",
              val: confirmed.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0),
              color: "#34D399",
            },
            {
              label: "آجل",
              val: confirmed.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0),
              color: "#818CF8",
            },
            { label: "متبقي", val: remaining, color: done ? "#10B981" : "#F59E0B" },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center">
              <span className="text-sm font-bold" style={{ color: item.color, fontFamily: "Tajawal, Cairo, sans-serif" }}>
                {fmt(item.val)} ج.م
              </span>
              <span className="text-xs" style={{ color: "#9CA3AF", fontFamily: "Tajawal, Cairo, sans-serif" }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Confirm button — only when done */}
        <div className="px-5 pb-5 pt-1">
          <button
            disabled={!done}
            className="w-full py-3.5 rounded-xl font-black text-base transition-all"
            style={{
              fontFamily: "Tajawal, Cairo, sans-serif",
              background: done
                ? "linear-gradient(135deg, #F59E0B, #FBBF24)"
                : "rgba(255,255,255,0.05)",
              color: done ? "#0a0500" : "#4B5563",
              cursor: done ? "pointer" : "not-allowed",
              boxShadow: done ? "0 4px 20px rgba(245,158,11,0.35)" : "none",
              border: done ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {done ? "✓ تأكيد وإصدار الفاتورة" : `أكمل إدخال باقي المبلغ (${fmt(remaining)} ج.م)`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          40%{transform:translateX(6px)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
        .animate-shake { animation: shake 0.4s ease; }
      `}</style>
    </div>
  );
}
