/**
 * Salary Modal shared helpers and constants.
 * Extracted from EmployeeSalaryModal.tsx for maintainability.
 */
import type { SettleLine } from '../types';

export function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '0';
}

export const DEDUCTION_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  late:    { label: 'تأخير',      color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  absence: { label: 'غياب',      color: 'text-red-300',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
  damage:  { label: 'تلف/خسائر', color: 'text-rose-300',  bg: 'bg-rose-500/10',  border: 'border-rose-500/20' },
  other:   { label: 'أخرى',      color: 'text-ink/70',  bg: 'bg-surface',      border: 'border-line' },
};

export function dedLabel(t: string) { return DEDUCTION_LABELS[t] ?? DEDUCTION_LABELS['other']; }

export function blankSettleLine(): SettleLine {
  return { amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0] };
}
