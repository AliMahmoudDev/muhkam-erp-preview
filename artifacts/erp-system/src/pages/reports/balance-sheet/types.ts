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
    txtMain:  'var(--text-1)',
    txtSub:   'var(--text-2)',
    txtBody:  'var(--text-1)',
    txtDim:   'var(--text-hint)',
    bdColor:  'var(--edge-row)',
    panelBg:  'var(--bg-row-section)',
    panelBdr: 'var(--edge-row)',
    hdrBg:    'var(--bg-elevated)',
  };
}
