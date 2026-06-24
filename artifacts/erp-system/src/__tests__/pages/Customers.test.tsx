import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* ── Mocks ─────────────────────────────────────────────────── */
vi.mock('@workspace/api-client-react', () => ({
  useGetCustomers: vi.fn(() => ({ data: [], isLoading: false })),
  useGetSettingsSafes: vi.fn(() => ({ data: [] })),
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

vi.mock('@/contexts/app-settings', () => ({
  useAppSettings: vi.fn(() => ({
    settings: { currency: 'EGP', theme: 'dark' },
    update: vi.fn(),
  })),
}));

vi.mock('@/lib/auth-fetch', () => ({
  authFetch: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
}));

vi.mock('@/lib/api', () => ({ api: (p: string) => p, BASE: '' }));
vi.mock('@/lib/format', () => ({ formatCurrency: (v: number) => `${v} ج.م` }));
vi.mock('@/lib/export-excel', () => ({ exportCustomersExcel: vi.fn() }));
vi.mock('@/components/AlertSettingBanner', () => ({ AlertSettingBanner: () => null }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('wouter', () => ({
  useLocation: () => ['/customers', vi.fn()],
  useSearch: () => '',
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/pages/bad-debts', () => ({ default: () => null }));
vi.mock('./CustomerList', () => ({
  CustomerList: () => <div data-testid="customer-list">قائمة العملاء</div>,
}));
vi.mock('./CustomerFormModal', () => ({
  AddCustomerModal: () => null,
  EditCustomerModal: () => null,
  ReceiptModal: () => null,
  SupplierPaymentModal: () => null,
  DeleteCustomerConfirm: () => null,
}));
vi.mock('./CustomerClassifications', () => ({
  CustomerReportsModal: () => null,
  DeleteClassificationConfirm: () => null,
}));
vi.mock('./CustomerLedger', () => ({ CustomerStatementModal: () => null }));

import Customers from '@/pages/customers/index';

function renderCustomers() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Customers />
    </QueryClientProvider>
  );
}

describe('Customers page', () => {
  beforeEach(() => { mockPermission = true; });

  it('يُرنَّر بدون crash', () => {
    const { container } = renderCustomers();
    expect(container.firstChild).toBeTruthy();
  });

  it('يعرض تاب العملاء والموردون', () => {
    renderCustomers();
    expect(screen.getAllByText(/العملاء والموردون/i).length).toBeGreaterThan(0);
  });

  it('يعرض زر إضافة عميل عند وجود صلاحية', () => {
    renderCustomers();
    expect(screen.getByText('إضافة عميل')).toBeInTheDocument();
  });

  it('يخفي زر الإضافة عند غياب الصلاحية', () => {
    mockPermission = false;
    renderCustomers();
    expect(screen.queryByText('إضافة عميل')).not.toBeInTheDocument();
  });
});
