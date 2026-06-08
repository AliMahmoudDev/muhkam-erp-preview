/**
 * TechnicianSections.tsx — Phase 3
 *
 * الأقسام الخاصة بلوحة الفني، تُحقن داخل /my-portal عندما role = 'technician'.
 *
 * الأقسام:
 *  1. KPI Cards (4): أرباح اليوم / أرباح الشهر / خدمات نشطة / أرباح معلقة
 *  2. خدماتي النشطة  — from GET /api/technicians/:id/services
 *  3. الخدمات المكتملة — from GET /api/technicians/:id/earnings
 *  4. الأداء          — derived metrics
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, ChevronUp,
  Wrench, CheckCircle2, TrendingUp, AlertCircle, Loader2,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { fmtCurrency, fmtDate } from './helpers';

/* ── Types ─────────────────────────────────────────────── */
interface EarningsSummary {
  technician_id:       number;
  total_earned:        number;
  today:               number;
  this_month:          number;
  delivered_count:     number;
  active_count:        number;
  outstanding_earnings: number;
}
interface ActiveService {
  id:                         number;
  job_id:                     number;
  job_no:                     string;
  customer_name:              string;
  job_status:                 string;
  service_type_name_snapshot: string | null;
  amount:                     string;
  status:                     string;
  commission_source_snapshot: string | null;
  created_at:                 string;
}
interface EarningsRow {
  id:                         number;
  job_no:                     string;
  delivered_at:               string | null;
  service_type_name_snapshot: string | null;
  amount:                     string;
  commission_computed:        string;
}

/* ── Status label maps ─────────────────────────────────── */
const JOB_STATUS: Record<string, { label: string; color: string }> = {
  pending:              { label: 'في الانتظار',       color: '#f59e0b' },
  diagnosing:           { label: 'قيد الفحص',         color: '#3b82f6' },
  in_progress:          { label: 'قيد الإصلاح',       color: '#8b5cf6' },
  in_repair:            { label: 'قيد الإصلاح',       color: '#8b5cf6' },
  waiting_parts:        { label: 'بانتظار قطعة',      color: '#ec4899' },
  qa:                   { label: 'اختبار الجودة',     color: '#06b6d4' },
  final_quality_check:  { label: 'فحص نهائي',         color: '#06b6d4' },
  done:                 { label: 'تم الإصلاح',         color: '#10b981' },
  shipped:              { label: 'قيد الشحن',          color: '#0ea5e9' },
};
const SVC_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'في الانتظار', color: '#f59e0b' },
  in_progress: { label: 'قيد التنفيذ', color: '#8b5cf6' },
  completed:   { label: 'مكتمل',       color: '#10b981' },
};

/* ── Props ─────────────────────────────────────────────── */
interface Props {
  empId:     number;
  isDark:    boolean;
  textMain:  string;
  textMuted: string;
  cardBg:    string;
  border:    string;
  currency:  string;
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export function TechnicianSections({ empId, isDark, textMain, textMuted, cardBg, border, currency }: Props) {
  const [activeOpen,    setActiveOpen]    = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [perfOpen,      setPerfOpen]      = useState(true);

  /* ── Queries ── */
  const { data: summary, isLoading: sumLoading } = useQuery<EarningsSummary | null>({
    queryKey: ['tech-earnings-summary', empId],
    queryFn: async () => {
      const r = await authFetch(`/api/technicians/${empId}/earnings/summary`);
      return r.ok ? r.json() : null;
    },
    enabled: !!empId,
    refetchInterval: 60_000,
  });

  const { data: activeRaw, isLoading: activeLoading } = useQuery<ActiveService[]>({
    queryKey: ['tech-active-services', empId],
    queryFn: async () => {
      const r = await authFetch(`/api/technicians/${empId}/services`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
    refetchInterval: 60_000,
  });

  const { data: earningsRaw, isLoading: earningsLoading } = useQuery<EarningsRow[]>({
    queryKey: ['tech-earnings', empId],
    queryFn: async () => {
      const r = await authFetch(`/api/technicians/${empId}/earnings`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  const activeServices  = activeRaw    ?? [];
  const earnings        = earningsRaw  ?? [];
  const recentCompleted = [...earnings].reverse().slice(0, 20);

  /* ── Derived ── */
  const deliveredCount  = summary?.delivered_count ?? earnings.length;
  const activeCount     = summary?.active_count    ?? activeServices.length;
  const avgCommission   = deliveredCount > 0 ? (summary?.total_earned ?? 0) / deliveredCount : 0;

  /* ── Shared style helpers ── */
  const S = {
    section: {
      borderRadius: 16, border: `1px solid ${border}`,
      background: cardBg, overflow: 'hidden', marginBottom: 18,
    } as React.CSSProperties,
    head: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
    } as React.CSSProperties,
    headBtn: {
      display: 'flex', alignItems: 'center', gap: 12, flex: 1,
      background: 'transparent', border: 'none', cursor: 'pointer',
      textAlign: 'right' as const, padding: 0,
    } as React.CSSProperties,
    body: {
      borderTop: `1px solid ${border}`, padding: '14px 18px',
    } as React.CSSProperties,
    th: {
      padding: '7px 10px', textAlign: 'right' as const,
      fontWeight: 700, color: textMuted, whiteSpace: 'nowrap' as const, fontSize: 11,
    } as React.CSSProperties,
    td: {
      padding: '7px 10px', whiteSpace: 'nowrap' as const, fontSize: 12,
    } as React.CSSProperties,
    iconBox: (c: string) => ({
      width: 34, height: 34, borderRadius: 9,
      background: `${c}22`, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color: c,
    } as React.CSSProperties),
    title: {
      fontSize: 14, fontWeight: 800, color: textMain, flex: 1,
    } as React.CSSProperties,
    chevron: {
      color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)',
      flexShrink: 0, marginRight: 'auto',
    } as React.CSSProperties,
    badge: (c: string) => ({
      fontSize: 11, fontWeight: 700, padding: '3px 10px',
      borderRadius: 20, background: `${c}18`, color: c, flexShrink: 0,
    } as React.CSSProperties),
    rowStripe: (i: number) => ({
      borderTop: `1px solid ${border}`,
      background: i % 2 === 0 ? 'transparent' : isDark ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.012)',
    } as React.CSSProperties),
    theadRow: {
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    } as React.CSSProperties,
    empty: {
      display: 'flex', alignItems: 'center', gap: 8,
      color: textMuted, fontSize: 13, padding: '12px 0',
    } as React.CSSProperties,
  };

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <>
      {/* ─── Section divider ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 4 }}>
        <div style={{ width: 4, height: 20, borderRadius: 4, background: '#8b5cf6' }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#8b5cf6', letterSpacing: 0.3 }}>لوحة الفني</span>
        <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.14)' }} />
      </div>

      {/* ─── KPI Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 18 }}>
        <KpiCard
          label="أرباح اليوم"
          value={sumLoading ? '…' : fmtCurrency(summary?.today ?? 0, currency)}
          emoji="💰" color="#f59e0b" isDark={isDark}
        />
        <KpiCard
          label="أرباح الشهر"
          value={sumLoading ? '…' : fmtCurrency(summary?.this_month ?? 0, currency)}
          emoji="📅" color="#3b82f6" isDark={isDark}
        />
        <KpiCard
          label="خدمات نشطة"
          value={sumLoading ? '…' : String(summary?.active_count ?? activeServices.length)}
          emoji="🔧" color="#10b981" isDark={isDark}
          unit="خدمة"
        />
        <KpiCard
          label="أرباح معلقة"
          value={sumLoading ? '…' : fmtCurrency(summary?.outstanding_earnings ?? 0, currency)}
          emoji="⏳" color="#8b5cf6" isDark={isDark}
          note="إجمالي المكتسب"
        />
      </div>

      {/* ─── Active Services ─── */}
      <div style={S.section}>
        <div style={S.head}>
          <button onClick={() => setActiveOpen(o => !o)} style={S.headBtn}>
            <span style={S.iconBox('#10b981')}><Wrench size={16} /></span>
            <span style={S.title}>خدماتي النشطة</span>
            {activeLoading && <Loader2 size={13} className="animate-spin" style={{ color: textMuted }} />}
            <span style={S.chevron}>{activeOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </button>
          <span style={S.badge('#10b981')}>{activeServices.length} خدمة</span>
        </div>

        {activeOpen && (
          <div style={S.body}>
            {activeServices.length === 0 ? (
              <div style={S.empty}>
                <CheckCircle2 size={16} />
                <span>لا توجد خدمات نشطة حالياً</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={S.theadRow}>
                      {['اسم الخدمة', 'رقم البطاقة', 'اسم العميل', 'حالة الخدمة', 'حالة البطاقة', 'المبلغ', 'تاريخ الإضافة'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeServices.map((s, i) => {
                      const svcSt = SVC_STATUS[s.status] ?? { label: s.status, color: textMuted };
                      const jobSt = JOB_STATUS[s.job_status] ?? { label: s.job_status, color: textMuted };
                      return (
                        <tr key={s.id} style={S.rowStripe(i)}>
                          <td style={{ ...S.td, fontWeight: 700, color: textMain }}>
                            {s.service_type_name_snapshot ?? '—'}
                          </td>
                          <td style={{ ...S.td, fontFamily: 'monospace', color: '#8b5cf6', fontWeight: 700 }}>
                            {s.job_no}
                          </td>
                          <td style={S.td}>{s.customer_name}</td>
                          <td style={S.td}>
                            <StatusPill label={svcSt.label} color={svcSt.color} />
                          </td>
                          <td style={S.td}>
                            <StatusPill label={jobSt.label} color={jobSt.color} />
                          </td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtCurrency(s.amount, currency)}
                          </td>
                          <td style={{ ...S.td, color: textMuted }}>
                            {fmtDate(s.created_at, false)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Completed Services / Earned Commissions ─── */}
      <div style={S.section}>
        <div style={S.head}>
          <button onClick={() => setCompletedOpen(o => !o)} style={S.headBtn}>
            <span style={S.iconBox('#f59e0b')}><CheckCircle2 size={16} /></span>
            <span style={S.title}>الخدمات المكتملة والأرباح المحققة</span>
            {earningsLoading && <Loader2 size={13} className="animate-spin" style={{ color: textMuted }} />}
            <span style={S.chevron}>{completedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </button>
          <span style={S.badge('#f59e0b')}>{earnings.length} إجمالاً</span>
        </div>

        {completedOpen && (
          <div style={S.body}>
            {recentCompleted.length === 0 ? (
              <div style={S.empty}>
                <AlertCircle size={16} />
                <span>لم يتم تسليم أي خدمة بعد</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={S.theadRow}>
                      {['اسم الخدمة', 'رقم البطاقة', 'تاريخ التسليم', 'مبلغ الخدمة', 'الكوميشن المحقق'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentCompleted.map((e, i) => (
                      <tr key={e.id} style={S.rowStripe(i)}>
                        <td style={{ ...S.td, fontWeight: 700, color: textMain }}>
                          {e.service_type_name_snapshot ?? '—'}
                        </td>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#8b5cf6', fontWeight: 700 }}>
                          {e.job_no}
                        </td>
                        <td style={{ ...S.td, color: textMuted }}>
                          {fmtDate(e.delivered_at, false)}
                        </td>
                        <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtCurrency(e.amount, currency)}
                        </td>
                        <td style={{ ...S.td, fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                          {fmtCurrency(e.commission_computed, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Performance Widget ─── */}
      <div style={S.section}>
        <div style={S.head}>
          <button onClick={() => setPerfOpen(o => !o)} style={S.headBtn}>
            <span style={S.iconBox('#8b5cf6')}><TrendingUp size={16} /></span>
            <span style={S.title}>أدائي</span>
            <span style={S.chevron}>{perfOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </button>
        </div>
        {perfOpen && (
          <div style={S.body}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <PerfStat
                label="خدمات مكتملة"
                value={String(deliveredCount)}
                color="#10b981" isDark={isDark}
              />
              <PerfStat
                label="خدمات نشطة"
                value={String(activeCount)}
                color="#3b82f6" isDark={isDark}
              />
              <PerfStat
                label="متوسط الكوميشن"
                value={fmtCurrency(avgCommission.toFixed(2), currency)}
                color="#8b5cf6" isDark={isDark}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function KpiCard({ label, value, emoji, color, isDark, note, unit }: {
  label:   string;
  value:   string;
  emoji:   string;
  color:   string;
  isDark:  boolean;
  note?:   string;
  unit?:   string;
}) {
  return (
    <div style={{
      borderRadius: 14, padding: '16px 18px',
      background: isDark ? `${color}14` : `${color}0d`,
      border: `1px solid ${color}28`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 11, color, opacity: 0.7, fontWeight: 600 }}>{unit}</span>}
      </div>
      {note && <span style={{ fontSize: 10, color, opacity: 0.6 }}>{note}</span>}
    </div>
  );
}

function PerfStat({ label, value, color, isDark }: {
  label:  string;
  value:  string;
  color:  string;
  isDark: boolean;
}) {
  void isDark;
  return (
    <div style={{
      borderRadius: 12, padding: '16px', textAlign: 'center',
      background: `${color}10`, border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color, opacity: 0.8, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 20, background: `${color}18`, color,
      display: 'inline-block',
    }}>
      {label}
    </span>
  );
}
