import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ── Mocks ─────────────────────────────────────────────────── */
const mockNavigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/purchases', mockNavigate],
  useSearch: () => '',
}));

vi.mock('@/components/patterns', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock('@/pages/purchases/PurchaseFormModal', () => ({
  default: () => <div data-testid="purchase-form">نموذج الشراء</div>,
}));

vi.mock('@/pages/purchases/PurchaseList', () => ({
  default: () => <div data-testid="purchase-list">سجل الفواتير</div>,
}));

vi.mock('@/pages/purchases/PurchaseReturnsPanel', () => ({
  default: () => <div data-testid="purchase-returns">مرتجعات المشتريات</div>,
}));

import Purchases from '@/pages/purchases/index';

/* ── Helper ─────────────────────────────────────────────────── */
function renderPurchases() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Purchases />
    </QueryClientProvider>
  );
}

/* ── Tests ──────────────────────────────────────────────────── */
describe('Purchases page — tabs', () => {
  beforeEach(() => { mockNavigate.mockReset(); });

  it('يعرض عنوان المشتريات', () => {
    renderPurchases();
    expect(screen.getByText('المشتريات')).toBeInTheDocument();
  });

  it('يعرض 3 tabs: فاتورة شراء / سجل الفواتير / المرتجعات', () => {
    renderPurchases();
    expect(screen.getByText('فاتورة شراء')).toBeInTheDocument();
    expect(screen.getByText('سجل الفواتير')).toBeInTheDocument();
    expect(screen.getByText('المرتجعات')).toBeInTheDocument();
  });

  it('يعرض نموذج الشراء افتراضياً (tab=new)', () => {
    renderPurchases();
    expect(screen.getByTestId('purchase-form')).toBeInTheDocument();
  });

  it('ينتقل إلى سجل الفواتير عند الضغط', () => {
    renderPurchases();
    fireEvent.click(screen.getByText('سجل الفواتير'));
    expect(screen.getByTestId('purchase-list')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('?tab=history', { replace: true });
  });

  it('ينتقل إلى المرتجعات عند الضغط', () => {
    renderPurchases();
    fireEvent.click(screen.getByText('المرتجعات'));
    expect(screen.getByTestId('purchase-returns')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('?tab=returns', { replace: true });
  });

  it('يعود إلى tab فاتورة شراء عند الضغط مجدداً', () => {
    renderPurchases();
    fireEvent.click(screen.getByText('سجل الفواتير'));
    fireEvent.click(screen.getByText('فاتورة شراء'));
    expect(screen.getByTestId('purchase-form')).toBeInTheDocument();
  });
});
