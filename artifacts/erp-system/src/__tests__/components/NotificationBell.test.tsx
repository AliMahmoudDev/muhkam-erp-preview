import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationBell } from '@/components/notification-bell';
import { authFetch } from '@/lib/auth-fetch';

vi.mock('@/lib/auth-fetch', () => ({
  authFetch: vi.fn(),
}));

vi.mock('@/contexts/app-settings', () => ({
  useAppSettings: () => ({ settings: { theme: 'dark' }, update: vi.fn() }),
}));

vi.mock('@/contexts/auth', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Admin', username: 'admin', role: 'admin', permissions: {} } }),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: () => false,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/api', () => ({
  api: (path: string) => path,
  BASE: '',
}));

interface TestNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const unreadNotification: TestNotification = {
  id: 1,
  type: 'info',
  title: 'إشعار تجريبي',
  message: 'رسالة اختبار',
  is_read: false,
  created_at: new Date().toISOString(),
};

function makeCountResponse(count: number): Response {
  return new Response(JSON.stringify({ count }), { status: 200 });
}

function makeListResponse(items: TestNotification[]): Response {
  return new Response(JSON.stringify(items), { status: 200 });
}

function renderBell(): ReturnType<typeof render> {
  return render(<NotificationBell />);
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockResolvedValue(makeCountResponse(0));
  });

  it('يظهر أيقونة الجرس بدون أخطاء', () => {
    renderBell();
    expect(screen.getByTitle('رسائلي')).toBeTruthy();
  });

  it('يظهر شارة العدد عند وجود إشعارات غير مقروءة', async () => {
    vi.mocked(authFetch).mockResolvedValue(makeCountResponse(1));
    renderBell();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  it('لا تظهر شارة العدد عندما لا توجد إشعارات غير مقروءة', async () => {
    vi.mocked(authFetch).mockResolvedValue(makeCountResponse(0));
    renderBell();
    await waitFor(() => {
      expect(screen.getByTitle('رسائلي')).toBeTruthy();
    });
    expect(screen.queryByText('1')).toBeNull();
  });

  it('النقر على زر "قراءة الكل" يستدعي API التحديد الجماعي', async () => {
    vi.mocked(authFetch)
      .mockResolvedValueOnce(makeCountResponse(1))
      .mockResolvedValueOnce(makeListResponse([unreadNotification]))
      .mockResolvedValue(new Response('{}', { status: 200 }));

    renderBell();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle('رسائلي'));

    await waitFor(() => {
      expect(screen.getByText('قراءة الكل')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('قراءة الكل'));

    await waitFor(() => {
      expect(vi.mocked(authFetch)).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/mark-all-read'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
