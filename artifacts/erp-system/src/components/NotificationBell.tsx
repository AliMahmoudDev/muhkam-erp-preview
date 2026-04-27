/**
 * NotificationBell — جرس الإشعارات الداخلية للمستخدم الحالي.
 * يعرض شارة حمراء بعدد الإشعارات غير المقروءة، وعند النقر يظهر
 * قائمة منسدلة بآخر 5 إشعارات غير مقروءة مع زر "تحديد الكل كمقروء".
 */
import { useRef, useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';

interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/**
 * تنسيق الوقت النسبي بالعربية (مثال: "قبل 5 د"، "قبل 2 س").
 * @param {string} iso - تاريخ ISO string
 * @returns {string} - نص الوقت النسبي بالعربية
 */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 7) return `قبل ${d} ي`;
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', day: 'numeric' });
}

/**
 * NotificationBell — مكوّن جرس الإشعارات.
 * يستخدم React Query لجلب الإشعارات من GET /api/notifications.
 * يعرض شارة حمراء عند وجود إشعارات غير مقروءة.
 * يتضمن زر "تحديد الكل كمقروء" يستدعي PATCH /api/notifications/read-all.
 * @returns {JSX.Element} - عنصر زر الجرس مع القائمة المنسدلة
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: allNotifications = [] } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () =>
      authFetch(api('/api/notifications')).then(r => r.ok ? r.json() : []),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unread = allNotifications.filter(n => !n.is_read);
  const unreadCount = unread.length;
  const displayItems = unread.slice(0, 5);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /**
   * تحديد إشعار واحد كمقروء — يحدّث الحالة المحلية فوراً ثم يرسل الطلب.
   * @param {number} id - معرف الإشعار
   */
  async function markOneRead(id: number) {
    queryClient.setQueryData<AppNotification[]>(['notifications'], prev =>
      (prev ?? []).map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    await authFetch(api(`/api/notifications/${id}/read`), { method: 'PATCH' }).catch(() => {});
  }

  /**
   * تحديد جميع الإشعارات كمقروءة — يحدّث الحالة المحلية فوراً ثم يرسل PATCH /read-all.
   */
  async function markAllRead() {
    queryClient.setQueryData<AppNotification[]>(['notifications'], prev =>
      (prev ?? []).map(n => ({ ...n, is_read: true }))
    );
    await authFetch(api('/api/notifications/read-all'), { method: 'PATCH' }).catch(() => {});
  }

  const border = 'rgba(255,255,255,0.08)';
  const bgPanel = '#161f30';
  const textMain = 'rgba(255,255,255,0.88)';
  const textSub = 'rgba(255,255,255,0.42)';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="الإشعارات"
        style={{
          position: 'relative',
          padding: '7px',
          borderRadius: 10,
          border: `1px solid ${border}`,
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
          cursor: 'pointer',
          color: textMain,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.15s',
        }}
      >
        <Bell style={{ width: 16, height: 16 }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            left: -4,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 340,
          maxHeight: 420,
          borderRadius: 14,
          background: bgPanel,
          border: `1px solid ${border}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          direction: 'rtl',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: `1px solid ${border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>الإشعارات</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 8,
                  fontWeight: 600,
                  background: 'rgba(239,68,68,0.14)',
                  color: '#ef4444',
                }}>
                  {unreadCount} جديد
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: `1px solid ${border}`,
                  background: 'transparent',
                  color: textSub,
                  cursor: 'pointer',
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                }}
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {displayItems.length === 0 ? (
              <div style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: textSub,
                fontSize: 13,
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                لا توجد إشعارات جديدة
              </div>
            ) : displayItems.map(n => (
              <div
                key={n.id}
                onClick={() => markOneRead(n.id)}
                style={{
                  padding: '10px 14px',
                  borderBottom: `1px solid ${border}`,
                  background: 'rgba(239,68,68,0.04)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.04)';
                }}
              >
                <div style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(239,68,68,0.14)',
                  fontSize: 14,
                }}>
                  🔔
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 6,
                    alignItems: 'baseline',
                  }}>
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: textMain,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {n.title}
                    </div>
                    <span style={{ fontSize: 10, color: textSub, flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11.5,
                    color: textSub,
                    marginTop: 2,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>
                    {n.message}
                  </div>
                  <span style={{
                    display: 'inline-block',
                    marginTop: 4,
                    fontSize: 9,
                    color: '#ef4444',
                    fontWeight: 700,
                  }}>
                    ● جديد
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
