/**
 * NotificationBell — per-user in-app notifications.
 * Polls every 60s for unread count, fetches full list when opened.
 * Distinct from AlertBell (which shows system-wide alerts to admins/managers).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Inbox, RefreshCw, Check, X } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useAppSettings } from '@/contexts/app-settings';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';

interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  reference_id: number | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const POLL_MS = 60_000;

const TYPE_ICON: Record<string, string> = {
  advance_pending: '⏳',
  advance_approved: '✅',
  advance_rejected: '❌',
  bonus_granted: '🎁',
  deduction_added: '➖',
  custody_settled: '📦',
  custody_assigned: '📤',
  generic: '🔔',
};

const TYPE_COLOR: Record<string, string> = {
  advance_pending: '#f59e0b',
  advance_approved: '#22c55e',
  advance_rejected: '#ef4444',
  bonus_granted: '#22c55e',
  deduction_added: '#ef4444',
  custody_settled: '#3b82f6',
  custody_assigned: '#a78bfa',
  generic: '#94a3b8',
};

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

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { settings } = useAppSettings();
  const { user } = useAuth();
  const isDark = (settings.theme ?? 'dark') === 'dark';
  const canApproveAdvances = hasPermission(user, 'can_manage_payroll');
  const [actingId, setActingId] = useState<number | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const r = await authFetch(`${BASE}/api/notifications/unread-count`);
      if (r.ok) {
        const j = await r.json();
        setUnreadCount(Number(j?.count ?? 0));
      }
    } catch { /* silent */ }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${BASE}/api/notifications`);
      if (r.ok) {
        const j = await r.json();
        const list = Array.isArray(j) ? j : [];
        setItems(list);
        setUnreadCount(list.filter((n: AppNotification) => !n.is_read).length);
      }
    } finally { setLoading(false); }
  }, []);

  // Initial fetch + poll for unread count
  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(t);
  }, [fetchCount]);

  // Refetch full list whenever dropdown opens
  useEffect(() => { if (open) fetchList(); }, [open, fetchList]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function markRead(id: number) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await authFetch(`${BASE}/api/notifications/${id}/read`, { method: 'POST' }); } catch { /* silent */ }
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try { await authFetch(`${BASE}/api/notifications/mark-all-read`, { method: 'POST' }); } catch { /* silent */ }
  }

  function handleClick(n: AppNotification) {
    if (!n.is_read) markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  async function approveAdvance(n: AppNotification) {
    if (!n.reference_id || actingId) return;
    setActingId(n.id);
    try {
      const r = await authFetch(`${BASE}/api/salary-advances/${n.reference_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (r.ok) {
        setItems(prev => prev.filter(x => x.id !== n.id));
        if (!n.is_read) setUnreadCount(c => Math.max(0, c - 1));
        try { await authFetch(`${BASE}/api/notifications/${n.id}`, { method: 'DELETE' }); } catch { /* silent */ }
      } else {
        const j = await r.json().catch(() => ({}));
        alert(j?.error || 'تعذر اعتماد الطلب');
      }
    } finally { setActingId(null); }
  }

  async function rejectAdvance(n: AppNotification) {
    if (!n.reference_id || actingId) return;
    const reason = window.prompt('سبب الرفض (اختياري):', '') ?? '';
    setActingId(n.id);
    try {
      const r = await authFetch(`${BASE}/api/salary-advances/${n.reference_id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason }),
      });
      if (r.ok) {
        setItems(prev => prev.filter(x => x.id !== n.id));
        if (!n.is_read) setUnreadCount(c => Math.max(0, c - 1));
        try { await authFetch(`${BASE}/api/notifications/${n.id}`, { method: 'DELETE' }); } catch { /* silent */ }
      } else {
        const j = await r.json().catch(() => ({}));
        alert(j?.error || 'تعذر رفض الطلب');
      }
    } finally { setActingId(null); }
  }

  /* ── Styles ── */
  const bgPanel = isDark ? '#161f30' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const textMain = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.85)';
  const textSub = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.45)';
  const rowHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="رسائلي"
        style={{
          position: 'relative',
          padding: '7px',
          borderRadius: 10,
          border: `1px solid ${border}`,
          background: open ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'transparent',
          cursor: 'pointer',
          color: textMain,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.15s',
        }}
      >
        <Inbox style={{ width: 16, height: 16 }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, left: -4,
            minWidth: 17, height: 17, borderRadius: 9,
            background: '#f59e0b', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)',
          left: '50%', transform: 'translateX(-50%)',
          width: 360, maxHeight: 520, borderRadius: 14,
          background: bgPanel, border: `1px solid ${border}`,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.65)' : '0 8px 32px rgba(0,0,0,0.13)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', direction: 'rtl',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>رسائلي</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                  background: 'rgba(245,158,11,0.14)', color: '#f59e0b',
                }}>{unreadCount} جديد</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={fetchList}
                disabled={loading}
                title="تحديث"
                style={{
                  padding: '3px 7px', borderRadius: 6,
                  border: `1px solid ${border}`, background: 'transparent',
                  color: textSub, cursor: 'pointer', fontSize: 10,
                  display: 'flex', alignItems: 'center', gap: 3,
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <RefreshCw style={{ width: 10, height: 10 }} /> تحديث
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    padding: '3px 7px', borderRadius: 6,
                    border: `1px solid ${border}`, background: 'transparent',
                    color: textSub, cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  <Check style={{ width: 10, height: 10 }} /> قراءة الكل
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: textSub, fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                لا توجد رسائل
              </div>
            ) : items.map(n => {
              const color = TYPE_COLOR[n.type] ?? '#94a3b8';
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: `1px solid ${border}`,
                    background: n.is_read ? 'transparent' : (isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.05)'),
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = rowHover; }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = n.is_read ? 'transparent' : (isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.05)');
                  }}
                >
                  <div style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${color}22`, fontSize: 14,
                  }}>{TYPE_ICON[n.type] ?? '🔔'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                      <div style={{
                        fontSize: 12.5, fontWeight: 700,
                        color: n.is_read ? textSub : textMain,
                      }}>{n.title}</div>
                      <span style={{ fontSize: 10, color: textSub, flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
                    </div>
                    <div style={{
                      fontSize: 11.5, color: textSub, marginTop: 2, lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}>{n.message}</div>
                    {!n.is_read && (
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        fontSize: 9, color: '#f59e0b', fontWeight: 700,
                      }}>● جديد</span>
                    )}
                    {n.type === 'advance_pending' && canApproveAdvances && n.reference_id && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); approveAdvance(n); }}
                          disabled={actingId === n.id}
                          style={{
                            padding: '2px 6px', borderRadius: 4,
                            border: 'none', cursor: 'pointer',
                            background: '#22c55e', color: '#fff',
                            fontSize: 9, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 2,
                            opacity: actingId === n.id ? 0.6 : 1,
                          }}
                        >
                          <Check style={{ width: 9, height: 9 }} />
                          {actingId === n.id ? 'جارٍ…' : 'اعتماد'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); rejectAdvance(n); }}
                          disabled={actingId === n.id}
                          style={{
                            padding: '2px 6px', borderRadius: 4,
                            border: 'none', cursor: 'pointer',
                            background: '#ef4444', color: '#fff',
                            fontSize: 9, fontWeight: 700,
                            display: 'inline-flex', alignItems: 'center', gap: 2,
                            opacity: actingId === n.id ? 0.6 : 1,
                          }}
                        >
                          <X style={{ width: 9, height: 9 }} />
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
