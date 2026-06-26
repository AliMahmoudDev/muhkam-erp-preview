/**
 * ProfitLoss — FilterPanel (extracted from ProfitLossReport)
 * Top toolbar: date mode pills, custom date inputs, branch selector, export buttons.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ChevronDown, FileDown, Printer } from 'lucide-react';
import { DATE_MODES, DateMode, ProfitsData } from '../shared';

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Warehouse {
  id: number;
  name: string;
}

export interface FilterPanelProps {
  mode: DateMode;
  setMode: (m: DateMode) => void;
  customFrom: string;
  setCustomFrom: (s: string) => void;
  customTo: string;
  setCustomTo: (s: string) => void;
  warehouses: Warehouse[];
  branches: number[];
  setBranches: (ids: number[]) => void;
  pl: ProfitsData;
  dateFrom: string;
  dateTo: string;
  branchLabel: string;
}

/* ── CSV export ───────────────────────────────────────────────────────────── */
function exportCSV(pl: ProfitsData, dateFrom: string, dateTo: string, branchLabel: string) {
  const rows: string[][] = [
    ['تقرير الأرباح والخسائر'],
    [`الفترة: ${dateFrom} — ${dateTo}`],
    [`الفرع: ${branchLabel}`],
    [],
    ['البند', 'القيمة'],
    ['إجمالي المبيعات', String(pl.total_revenue)],
    ['مبيعات نقدية', String(pl.cash_sales)],
    ['مبيعات آجلة', String(pl.credit_sales)],
    ['مبيعات جزئية', String(pl.partial_sales)],
    ['المرتجعات', String(pl.return_amount)],
    ['تكلفة البضاعة', String(pl.total_cost)],
    ['مجمل الربح', String(pl.gross_profit)],
    ['المصروفات', String(pl.total_expenses)],
    ['صافي الربح', String(pl.net_profit)],
    ['هامش الربح %', String(pl.profit_margin)],
    [],
    ['الفرع', 'المبيعات', 'التكلفة', 'مجمل الربح', 'الفواتير'],
    ...pl.by_warehouse.map((w) => [
      w.warehouse_name,
      String(w.revenue),
      String(w.cost),
      String(w.gross_profit),
      String(w.invoice_count),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `PL_${dateFrom}_${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Branch Selector ──────────────────────────────────────────────────────── */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-amber-500 border-amber-500' : 'border-line'}`}
    >
      {checked && <span className="text-black text-[9px] font-black leading-none">✓</span>}
    </div>
  );
}

function BranchSelector({
  warehouses,
  selected,
  onChange,
}: {
  warehouses: Warehouse[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0;
  const label = allSelected
    ? 'جميع الفروع'
    : selected.length === 1
      ? (warehouses.find((w) => w.id === selected[0])?.name ?? 'فرع')
      : `${selected.length} فروع محددة`;
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rpt-section flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line text-sm font-semibold hover:border-line transition-all"
      >
        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="rpt-strong text-sm">{label}</span>
        <ChevronDown
          className={`w-3 h-3 text-ink/30 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="rpt-dropdown absolute top-full mt-2 right-0 z-40 min-w-[200px] rounded-xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-right transition-colors ${allSelected ? 'text-amber-400 bg-amber-500/10' : 'text-ink/60 hover:text-ink hover:bg-surface'}`}
            >
              <CheckBox checked={allSelected} /> جميع الفروع
            </button>
            {warehouses.length > 0 && <div className="h-px bg-surface mx-3" />}
            {warehouses.map((w) => {
              const checked = selected.includes(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggle(w.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-right transition-colors ${checked ? 'text-ink bg-surface' : 'text-ink/60 hover:text-ink hover:bg-surface'}`}
                >
                  <CheckBox checked={checked} /> {w.name}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
    </div>
  );
}

/* ── FilterPanel ──────────────────────────────────────────────────────────── */
export default function FilterPanel({
  mode,
  setMode,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  warehouses,
  branches,
  setBranches,
  pl,
  dateFrom,
  dateTo,
  branchLabel,
}: FilterPanelProps) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {/* Date mode pills */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${mode === m.id ? 'text-amber-300 border-amber-500/40' : 'text-ink/40 border-line hover:text-ink/70 hover:border-line'}`}
            style={
              mode === m.id
                ? { background: 'rgba(245,158,11,0.12)' }
                : { background: 'var(--surface)' }
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="erp-input rounded-xl px-3 py-1.5 text-sm text-ink"
          />
          <span className="rpt-muted">←</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="erp-input rounded-xl px-3 py-1.5 text-sm text-ink"
          />
        </div>
      )}
      {/* Branch selector */}
      <BranchSelector warehouses={warehouses} selected={branches} onChange={setBranches} />
      {/* Export */}
      <div className="flex gap-2 mr-auto">
        <button
          onClick={() => exportCSV(pl, dateFrom, dateTo, branchLabel)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/25 text-emerald-400 hover:border-emerald-500/40 transition-all"
          style={{ background: 'rgba(16,185,129,0.08)' }}
        >
          <FileDown className="w-3.5 h-3.5" /> Excel
        </button>
        <button
          onClick={async () => {
            const { printPLReport } = await import('@/lib/export-pdf');
            printPLReport({ dateFrom, dateTo, ...pl });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-500/25 text-blue-400 hover:border-blue-500/40 transition-all"
          style={{ background: 'rgba(59,130,246,0.08)' }}
        >
          <Printer className="w-3.5 h-3.5" /> PDF
        </button>
      </div>
    </div>
  );
}
