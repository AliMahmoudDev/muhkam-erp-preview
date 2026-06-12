import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubscriptionProvider, useSubscription } from '@/contexts/subscription';
import { AuthProvider, type AuthUser } from '@/contexts/auth';

/* ─── helpers ──────────────────────────────────────────────────── */

const mockAdmin: AuthUser = {
  id: 1,
  name: 'Admin',
  username: 'admin',
  company_id: 1,
  role: 'admin',
  permissions: {},
};

function TestConsumer() {
  const { edition, isAdvanced, hasFeature } = useSubscription();
  return (
    <div>
      <span data-testid="edition">{edition}</span>
      <span data-testid="is-advanced">{String(isAdvanced)}</span>
      <span data-testid="has-hr">{String(hasFeature('hr'))}</span>
      <span data-testid="has-pos">{String(hasFeature('pos'))}</span>
      <span data-testid="has-accounting">{String(hasFeature('accounting'))}</span>
      <span data-testid="has-maintenance">{String(hasFeature('maintenance'))}</span>
      <span data-testid="has-fixed-assets">{String(hasFeature('fixed_assets'))}</span>
    </div>
  );
}

function renderWithProviders(storageData?: string) {
  vi.mocked(localStorage.getItem).mockImplementation((key) => {
    if (key === 'erp_current_user') return JSON.stringify(mockAdmin);
    if (key === 'erp_subscription:company:1') return storageData ?? null;
    return null;
  });

  // Mock fetch for subscription refresh (returns 401 since no real backend)
  vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 401 }));

  return render(
    <AuthProvider>
      <SubscriptionProvider>
        <TestConsumer />
      </SubscriptionProvider>
    </AuthProvider>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Default behavior (no stored subscription)                        */
/* ─────────────────────────────────────────────────────────────── */
describe('SubscriptionProvider — defaults', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('defaults to ultimate edition', () => {
    renderWithProviders();
    expect(screen.getByTestId('edition').textContent).toBe('ultimate');
  });

  it('isAdvanced is false by default', () => {
    renderWithProviders();
    expect(screen.getByTestId('is-advanced').textContent).toBe('false');
  });

  it('ultimate has hr and pos features enabled', () => {
    renderWithProviders();
    expect(screen.getByTestId('has-hr').textContent).toBe('true');
    expect(screen.getByTestId('has-pos').textContent).toBe('true');
  });

  it('ultimate does NOT have accounting by default', () => {
    renderWithProviders();
    expect(screen.getByTestId('has-accounting').textContent).toBe('false');
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* Restored from localStorage (advanced)                            */
/* ─────────────────────────────────────────────────────────────── */
describe('SubscriptionProvider — restore from storage', () => {
  it('restores advanced edition from localStorage', () => {
    const stored = JSON.stringify({
      edition: 'advanced',
      features: {
        accounting: true,
        hr: true,
        pos: true,
        warranty: true,
        consignment: true,
        fixed_assets: true,
        maintenance: false,
        budgets: true,
        bank_reconciliation: true,
      },
    });
    renderWithProviders(stored);
    expect(screen.getByTestId('edition').textContent).toBe('advanced');
    expect(screen.getByTestId('is-advanced').textContent).toBe('true');
    expect(screen.getByTestId('has-accounting').textContent).toBe('true');
    expect(screen.getByTestId('has-fixed-assets').textContent).toBe('true');
  });

  it('handles corrupted storage gracefully (falls back to defaults)', () => {
    renderWithProviders('INVALID JSON{{{');
    expect(screen.getByTestId('edition').textContent).toBe('ultimate');
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* hasFeature                                                        */
/* ─────────────────────────────────────────────────────────────── */
describe('SubscriptionProvider — hasFeature', () => {
  it('returns false for disabled features', () => {
    renderWithProviders();
    expect(screen.getByTestId('has-maintenance').textContent).toBe('false');
  });

  it('returns true for enabled features', () => {
    renderWithProviders();
    expect(screen.getByTestId('has-hr').textContent).toBe('true');
    expect(screen.getByTestId('has-pos').textContent).toBe('true');
  });
});
