/**
 * Balance Sheet types and constants.
 * Extracted from BalanceSheetReport.tsx for maintainability.
 */
import { useAppSettings } from '@/contexts/app-settings';

/* ── Types ─────────────────────────────────────────────────────────────── */
export interface BalanceSheetData {
  assets: { cash: number; receivables: number; inventory: number; total: number };
  liabilities: { payables: number; total: number };
  equity: { opening_capital: number; retained_earnings: number; total: number };
  total_liabilities_equity: number;
  pl_detail: { total_revenue: number; total_cogs: number; total_expenses: number };
  balanced: boolean;
  as_of: string;
  validation: { status: 'OK' | 'WARNING'; validation_message?: string };
}

export interface DrillCustomer {
  id: number;
  name: string;
  balance: string;
  is_supplier: boolean;
}

export interface DrillProduct {
  id: number;
  name: string;
  quantity: string;
  cost_price: string;
}

export const EMPTY_BS: BalanceSheetData = {
  assets: { cash: 0, receivables: 0, inventory: 0, total: 0 },
  liabilities: { payables: 0, total: 0 },
  equity: { opening_capital: 0, retained_earnings: 0, total: 0 },
  total_liabilities_equity: 0,
  pl_detail: { total_revenue: 0, total_cogs: 0, total_expenses: 0 },
  balanced: true,
  as_of: new Date().toISOString().split('T')[0],
  validation: { status: 'OK' },
};

/* ── Theme helper hook ──────────────────────────────────────────────────── */
export function useTheme() {
  const { settings } = useAppSettings();
  const isLight = (settings.theme ?? 'dark') === 'light';
  return {
    isLight,
    txtMain: isLight ? 'var(--bg-card)' : '#f8fafc',
    txtSub: isLight ? '#6b7280' : 'rgba(255,255,255,0.40)',
    txtBody: isLight ? '#374151' : 'rgba(255,255,255,0.80)',
    txtDim: isLight ? '#9ca3af' : 'rgba(255,255,255,0.35)',
    bdColor: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)',
    panelBg: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
    panelBdr: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)',
    hdrBg: 'var(--bg-elevated)',
  };
}
