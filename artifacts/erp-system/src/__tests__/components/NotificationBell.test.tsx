import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell } from '@/components/notification-bell';
import { authFetch } from '@/lib/auth-fetch';

vi.mock('@/lib/auth-fetch', () => ({
  authFetch: vi.fn(),
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

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderBell(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <NotificationBell />
    </QueryClientProvider>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
  });

  it('يظهر أيقونة الجرس بدون أخطاء', () => {
    renderBell();
    expect(screen.getByTitle('الإشعارات')).toBeTruthy();
  });

  it('يظهر شارة العدد عند وجود إشعارات غير مقروءة', async () => {
    vi.mocked(authFetch).mockResolvedValue(
      new Response(JSON.stringify([unreadNotification]), { status: 200 })
    );
    renderBell();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  it('لا تظهر شارة العدد عندما لا توجد إشعارات غير مقروءة', async () => {
    vi.mocked(authFetch).mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    );
    renderBell();
    await waitFor(() => {
      expect(screen.getByTitle('الإشعارات')).toBeTruthy();
    });
    expect(screen.queryByText('1')).toBeNull();
  });

  it('النقر على زر "تحديد الكل كمقروء" يستدعي API التحديد الجماعي', async () => {
    vi.mocked(authFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([unreadNotification]), { status: 200 })
      )
      .mockResolvedValue(new Response('{}', { status: 200 }));

    renderBell();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle('الإشعارات'));

    fireEvent.click(screen.getByText('تحديد الكل كمقروء'));

    await waitFor(() => {
      expect(vi.mocked(authFetch)).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/read-all'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });
});
