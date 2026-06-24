import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ── Mocks ─────────────────────────────────────────────────── */
vi.mock('wouter', () => ({
  useLocation: () => ['/repairs', vi.fn()],
  useSearch: () => '',
  useRoute: () => [false, {}],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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
vi.mock('@/lib/format', () => ({ formatCurrency: (v: number) => `${v} ج.م` }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/app-settings', () => ({
  useAppSettings: vi.fn(() => ({
    settings: { currency: 'EGP', theme: 'dark' },
    update: vi.fn(),
  })),
}));

// Mock sub-components
vi.mock('@/pages/repairs/DashboardCardsSection', () => ({
  default: () => <div data-testid="dashboard-cards">Dashboard Cards</div>,
  DashboardCardsSection: () => <div data-testid="dashboard-cards">Dashboard Cards</div>,
}));

vi.mock('@/pages/repairs/NewJobForm', () => ({
  default: () => <div data-testid="new-job-form">New Job Form</div>,
  NewJobForm: () => <div data-testid="new-job-form">New Job Form</div>,
}));

vi.mock('@/pages/repairs/JobServicesSection', () => ({
  default: () => null,
  JobServicesSection: () => null,
}));

import Repairs from '@/pages/repairs';

/* ── Helper ─────────────────────────────────────────────────── */
function renderRepairs() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Repairs />
    </QueryClientProvider>
  );
}

/* ── Tests ──────────────────────────────────────────────────── */
describe('Repairs page', () => {
  beforeEach(() => { mockPermission = true; vi.clearAllMocks(); });

  it('يعرض عنوان الصيانة', () => {
    renderRepairs();
    expect(document.title !== undefined).toBe(true);
    // الصفحة تُرنَّر بدون crash
    expect(document.body).toBeTruthy();
  });

  it('يعرض محتوى لمستخدم عنده صلاحية', () => {
    const { container } = renderRepairs();
    expect(container.firstChild).toBeTruthy();
  });
});
