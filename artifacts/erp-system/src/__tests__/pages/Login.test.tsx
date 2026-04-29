import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '@/pages/login';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';

vi.mock('@/contexts/auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/app-settings', () => ({
  useAppSettings: vi.fn(),
}));

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderLogin(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <Login />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    subscriptionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
    clearSubscriptionExpired: vi.fn(),
  });

  vi.mocked(useAppSettings).mockReturnValue({
    settings: {
      currency: 'EGP',
      numberFormat: 'western',
      fontFamily: 'Tajawal',
      fontSize: 'md',
      accentColor: 'amber',
      companyName: 'شركة الاختبار',
      companySlogan: 'سلوجان تجريبي',
      customLogo: '',
      loginBg: 'default',
      loginBgImage: '',
      customAccentHex: '',
      borderWidth: 1,
      fontWeightNormal: 400,
      iconSize: 24,
      theme: 'dark',
      darkThemeVariant: 'default',
      decimalPlaces: 2,
      thousandsSeparator: 'comma',
    },
    update: vi.fn(),
    reset: vi.fn(),
  });
});

describe('Login', () => {
  it('يعرض حقلَي اسم المستخدم والرقم السري', () => {
    renderLogin();
    expect(
      screen.getByRole('textbox', { name: 'اسم المستخدم أو البريد الإلكتروني' })
    ).toBeTruthy();
    expect(
      screen.getByLabelText('الرقم السري')
    ).toBeTruthy();
  });

  it('يظهر رسالة خطأ عربية عند الإرسال بدون بيانات', () => {
    renderLogin();
    fireEvent.submit(screen.getByRole('form', { name: 'نموذج تسجيل الدخول' }));
    expect(screen.getByText('أدخل اسم المستخدم')).toBeTruthy();
  });

  it('حقل اسم المستخدم يحمل الـ aria-label الصحيح بالعربية', () => {
    renderLogin();
    const usernameInput = screen.getByLabelText('اسم المستخدم أو البريد الإلكتروني');
    expect(usernameInput).toBeTruthy();
    expect((usernameInput as HTMLInputElement).getAttribute('aria-label')).toBe(
      'اسم المستخدم أو البريد الإلكتروني'
    );
  });

  it('حقل الرقم السري يحمل الـ aria-label الصحيح بالعربية', () => {
    renderLogin();
    const pinInput = screen.getByLabelText('الرقم السري');
    expect(pinInput).toBeTruthy();
    expect((pinInput as HTMLInputElement).getAttribute('aria-label')).toBe('الرقم السري');
  });

  it('الصفحة تستخدم اتجاه النص من اليمين إلى اليسار', () => {
    const { container } = renderLogin();
    const rtlRoot = container.querySelector('[dir="rtl"]');
    expect(rtlRoot).toBeTruthy();
  });
});
