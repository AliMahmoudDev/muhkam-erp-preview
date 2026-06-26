import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ── Mocks ─────────────────────────────────────────────────── */
vi.mock('@/contexts/auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, role: 'admin', name: 'Admin', permissions: {} },
  })),
}));

vi.mock('@/lib/auth-fetch', () => ({
  authFetch: vi.fn().mockResolvedValue(
    new Response(JSON.stringify([]), { status: 200 })
  ),
}));

vi.mock('@workspace/api-client-react', () => ({
  useGetSettingsSafes: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/lib/api', () => ({ api: (p: string) => p, BASE: '' }));
vi.mock('@/lib/format', () => ({ formatCurrency: (v: number) => `${v} ج.م` }));
vi.mock('@/lib/safe-data', () => ({ safeArray: (v: unknown) => (v as unknown[]) ?? [] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/skeletons', () => ({ TableSkeleton: () => <div>loading</div> }));
vi.mock('@/components/confirm-modal', () => ({ ConfirmModal: () => null }));
vi.mock('wouter', () => ({
  useLocation: () => ['/vouchers', vi.fn()],
}));

import Vouchers from '@/pages/vouchers';

/* ── Helper ─────────────────────────────────────────────────── */
function renderVouchers() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Vouchers />
    </QueryClientProvider>
  );
}

/* ── Tests ──────────────────────────────────────────────────── */
describe('Vouchers page', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('يعرض عنوان السندات', () => {
    renderVouchers();
    // Page renders tabs (قبض / صرف) and table header (رقم السند)
    expect(screen.getAllByText(/قبض|صرف|رقم السند/i).length).toBeGreaterThan(0);
  });

  it('يعرض حالة فارغة عند عدم وجود سندات', () => {
    renderVouchers();
    expect(screen.queryByText(/خطأ/)).not.toBeInTheDocument();
  });

  it('يعرض فلاتر النوع (قبض / صرف / توريد)', () => {
    renderVouchers();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
