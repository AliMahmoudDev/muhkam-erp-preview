/**
 * ProfitLoss — SummaryCards (extracted from ProfitLossReport)
 * KPI strip: net profit, total revenue, total expenses — with change pills.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, useCountUp, ProfitsData } from '../shared';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function pctChange(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function ChangePill({ curr, prev }: { curr: number; prev: number }) {
  const chg = pctChange(curr, prev);
  if (chg === null) return null;
  const up = chg >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${up ? 'bg-emerald-500/12 text-emerald-400' : 'bg-red-500/12 text-red-400'}`}
    >
      {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {up ? '+' : ''}
      {chg.toFixed(1)}%
    </span>
  );
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KPICard({
  label,
  value,
  prevVal,
  accent,
  sub,
  icon,
  index,
}: {
  label: string;
  value: number;
  prevVal: number;
  accent: string;
  sub?: string;
  icon: React.ReactNode;
  index: number;
}) {
  const animated = useCountUp(value);
  const numColor =
    accent === 'var(--status-success)' && value < 0 ? 'var(--status-danger)' : 'var(--text-1)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="rpt-panel rounded-xl px-4 py-3.5"
      style={{ borderRight: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div style={{ color: accent }}>{icon}</div>
          <span className="rpt-label text-xs">{label}</span>
        </div>
        <ChangePill curr={value} prev={prevVal} />
      </div>
      <p
        className="font-black tabular-nums leading-none"
        style={{ fontSize: '1.45rem', color: numColor }}
      >
        {formatCurrency(animated)}
      </p>
      {sub && <p className="rpt-muted text-xs mt-1.5">{sub}</p>}
    </motion.div>
  );
}

/* ── SummaryCards (KPIStrip) ───────────────────────────────────────────────── */
export interface SummaryCardsProps {
  pl: ProfitsData;
  prev: ProfitsData;
}

export default function SummaryCards({ pl, prev }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <KPICard
        label="صافي الربح"
        value={pl.net_profit}
        prevVal={prev.net_profit}
        accent={pl.net_profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)'}
        sub={`هامش ${pl.profit_margin.toFixed(1)}%`}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        index={0}
      />
      <KPICard
        label="إجمالي المبيعات"
        value={pl.total_revenue}
        prevVal={prev.total_revenue}
        accent="var(--status-warning)"
        sub={`${pl.invoice_count} فاتورة`}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        index={1}
      />
      <KPICard
        label="إجمالي المصروفات"
        value={pl.total_expenses}
        prevVal={prev.total_expenses}
        accent="var(--status-warning)"
        sub={pl.by_expense_category[0]?.category}
        icon={<DollarSign className="w-3.5 h-3.5" />}
        index={2}
      />
    </div>
  );
}
