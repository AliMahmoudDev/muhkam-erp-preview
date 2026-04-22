/**
 * تقرير أعمار الديون — Customer & Supplier Aging Report
 * صنّف الديون المتأخرة حسب الفترة الزمنية
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, authFetch, formatCurrency } from "./shared";

interface AgingItem {
  id: number;
  name: string;
  date: string;
  invoice_no: string;
  remaining: number;
  days: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
}

interface AgingResponse {
  type: string;
  as_of: string;
  total: number;
  buckets: { "0-30": number; "31-60": number; "61-90": number; "90+": number };
  items: AgingItem[];
}

const BUCKET_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  "0-30":  { bg: "rgba(5,150,105,0.08)",  text: "#10b981", badge: "rgba(5,150,105,0.15)" },
  "31-60": { bg: "rgba(234,179,8,0.08)",  text: "#eab308", badge: "rgba(234,179,8,0.15)" },
  "61-90": { bg: "rgba(249,115,22,0.08)", text: "#f97316", badge: "rgba(249,115,22,0.15)" },
  "90+":   { bg: "rgba(239,68,68,0.08)",  text: "#ef4444", badge: "rgba(239,68,68,0.15)" },
};

const BUCKET_LABELS: Record<string, string> = {
  "0-30":  "أقل من 30 يوم",
  "31-60": "31 - 60 يوم",
  "61-90": "61 - 90 يوم",
  "90+":   "أكثر من 90 يوم",
};

export default function AgingReport() {
  const [type,   setType]  = useState<"customers" | "suppliers">("customers");
  const [asOf,   setAsOf]  = useState(() => new Date().toISOString().split("T")[0]);
  const [bucket, setBucket] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AgingResponse>({
    queryKey: ["aging", type, asOf],
    queryFn: () =>
      authFetch(api(`/api/reports/aging?type=${type}&as_of=${asOf}`)).then(async r => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 60_000,
  });

  const filtered = bucket
    ? (data?.items ?? []).filter(i => i.bucket === bucket)
    : (data?.items ?? []);

  function exportCsv() {
    if (!data) return;
    const bom  = "\uFEFF";
    const head = "الاسم,رقم الفاتورة,تاريخ الفاتورة,الأيام,المبلغ المتبقي,الفئة\n";
    const body = (data.items ?? []).map(r =>
      `"${r.name}","${r.invoice_no}","${r.date}",${r.days},${r.remaining},"${BUCKET_LABELS[r.bucket]}"`
    ).join("\n");
    const blob = new Blob([bom + head + body], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `aging-${type}-${asOf}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "1rem 1.25rem",
  };

  const th: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    textAlign: "right",
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: 700,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };

  const td: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontSize: 13,
    color: "rgba(255,255,255,0.80)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal','Cairo',sans-serif", color: "#fff" }} className="space-y-4">

      {/* ── Header ── */}
      <div style={cardStyle} className="flex flex-wrap items-center gap-3">
        <h2 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>📅 تقرير أعمار الديون</h2>

        {/* Type toggle */}
        <div className="flex gap-1 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
          {(["customers","suppliers"] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setBucket(null); }}
              style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 700,
                background: type === t ? "#d97706" : "transparent",
                color: type === t ? "#000" : "rgba(255,255,255,0.5)",
                border: "none", cursor: "pointer", transition: "all 0.15s",
              }}>
              {t === "customers" ? "🧑‍💼 العملاء" : "🏭 الموردون"}
            </button>
          ))}
        </div>

        {/* As of date */}
        <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>حتى تاريخ:</label>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 12,
          }} />

        <div className="flex-1" />

        <button onClick={exportCsv}
          style={{
            background: "rgba(5,150,105,0.15)", border: "1px solid rgba(5,150,105,0.30)",
            borderRadius: 8, padding: "5px 14px", color: "#10b981", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
          ⬇ تصدير CSV
        </button>
      </div>

      {/* ── Bucket Summary Cards ── */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["0-30","31-60","61-90","90+"] as const).map(b => {
            const col = BUCKET_COLORS[b];
            const val = data.buckets[b];
            const pct = data.total > 0 ? Math.round(val / data.total * 100) : 0;
            const active = bucket === b;
            return (
              <button key={b} onClick={() => setBucket(active ? null : b)}
                style={{
                  background: active ? col.bg : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${active ? col.text : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 14, padding: "0.85rem 1rem", textAlign: "right",
                  cursor: "pointer", transition: "all 0.15s", color: "#fff",
                }}>
                <div style={{ fontSize: 11, color: col.text, fontWeight: 700, marginBottom: 4 }}>
                  {BUCKET_LABELS[b]}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(val)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  {pct}% من الإجمالي
                </div>
                {/* mini progress */}
                <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: col.text, borderRadius: 4, transition: "width 0.6s" }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Total ── */}
      {data && (
        <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            إجمالي الديون المتأخرة {bucket ? `(${BUCKET_LABELS[bucket]})` : ""}
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(bucket ? (data.buckets[bucket as keyof typeof data.buckets] ?? 0) : data.total)}
          </span>
        </div>
      )}

      {/* ── Items Table ── */}
      <div style={cardStyle}>
        {isLoading && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2rem 0" }}>جاري التحميل…</p>}
        {error && <p style={{ textAlign: "center", color: "#ef4444" }}>{String(error)}</p>}
        {data && !isLoading && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>الاسم</th>
                <th style={th}>رقم الفاتورة</th>
                <th style={th}>تاريخ الفاتورة</th>
                <th style={th}>الأيام</th>
                <th style={{ ...th, textAlign: "left" }}>المبلغ المتبقي</th>
                <th style={th}>الفئة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: "center", color: "rgba(255,255,255,0.25)", padding: "2rem 0" }}>
                    لا توجد بيانات
                  </td>
                </tr>
              )}
              {filtered.map(item => {
                const col = BUCKET_COLORS[item.bucket];
                return (
                  <tr key={`${item.id}-${item.invoice_no}`} style={{ background: col.bg }}>
                    <td style={td}>{item.name || "—"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{item.invoice_no}</td>
                    <td style={td}>{item.date}</td>
                    <td style={{ ...td, color: col.text, fontWeight: 700 }}>{item.days}</td>
                    <td style={{ ...td, textAlign: "left", fontWeight: 700, color: "#f59e0b", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(item.remaining)}
                    </td>
                    <td style={td}>
                      <span style={{
                        background: col.badge, color: col.text, fontWeight: 700,
                        borderRadius: 6, padding: "2px 8px", fontSize: 11,
                      }}>
                        {BUCKET_LABELS[item.bucket]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
