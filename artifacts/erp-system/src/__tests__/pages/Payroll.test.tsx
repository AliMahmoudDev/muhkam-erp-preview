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

let mockPermission = true;
vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn(() => mockPermission),
}));

vi.mock('@/lib/auth-fetch', () => ({
  authFetch: vi.fn().mockResolvedValue(
    new Response(JSON.stringify([]), { status: 200 })
  ),
}));

vi.mock('@/lib/api', () => ({ api: (p: string) => p, BASE: '' }));
vi.mock('@/lib/safe-data', () => ({ safeArray: (v: unknown) => (v as unknown[]) ?? [] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/app-settings', () => ({
  useAppSettings: vi.fn(() => ({
    settings: { currency: 'EGP', theme: 'dark' },
    update: vi.fn(),
  })),
}));
vi.mock('wouter', () => ({
  useLocation: () => ['/payroll', vi.fn()],
  useSearch: () => '',
}));

import Payroll from '@/pages/payroll';

/* ── Helper ─────────────────────────────────────────────────── */
function renderPayroll() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Payroll />
    </QueryClientProvider>
  );
}

/* ── Tests ──────────────────────────────────────────────────── */
describe('Payroll page', () => {
  beforeEach(() => { mockPermission = true; vi.clearAllMocks(); });

  it('يعرض عنوان الرواتب', () => {
    renderPayroll();
    expect(screen.getAllByText(/الرواتب|كشف الرواتب/i).length).toBeGreaterThan(0);
  });

  it('يعرض رسالة عدم الصلاحية عند غياب can_view_payroll', () => {
    mockPermission = false;
    renderPayroll();
    expect(screen.queryByText(/فترة جديدة|إنشاء فترة/i)).not.toBeInTheDocument();
  });
});
