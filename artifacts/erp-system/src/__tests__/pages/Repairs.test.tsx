import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ── Mocks ─────────────────────────────────────────────────── */
const mockNavigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/repairs', mockNavigate],
  useSearch: () => '',
  useRoute: () => [false, {}],
  Link: ({ children }: { children: React.ReactNode }) => children,
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

vi.mock('@/pages/repairs/DashboardCardsSection', () => ({
  DashboardCardsSection: () => <div data-testid="dashboard-cards">كروت الداشبورد</div>,
}));

vi.mock('@/pages/repairs/NewJobForm', () => ({
  default: () => <div data-testid="new-job-form">نموذج بطاقة جديدة</div>,
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
  beforeEach(() => { mockPermission = true; mockNavigate.mockReset(); vi.clearAllMocks(); });

  it('يعرض عنوان الصيانة', () => {
    renderRepairs();
    expect(screen.getByText(/الصيانة|بطاقات الصيانة/i)).toBeInTheDocument();
  });

  it('يعرض tab البطاقات الجديدة افتراضياً', () => {
    renderRepairs();
    expect(screen.getByTestId('new-job-form')).toBeInTheDocument();
  });

  it('لا يعرض محتوى بدون صلاحية can_view_repairs', () => {
    mockPermission = false;
    renderRepairs();
    expect(screen.queryByTestId('new-job-form')).not.toBeInTheDocument();
  });
});
