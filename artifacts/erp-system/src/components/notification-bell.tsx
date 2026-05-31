import { api } from '@/lib/api';
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
import { useToast } from '@/hooks/use-toast';
import { NotificationList } from './notifications/NotificationList';

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

interface SafeOption {
  id: number;
  name: string;
  balance: string | number | null;
}

const POLL_MS = 60_000;

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { settings } = useAppSettings();
  const { user } = useAuth();
  const { toast } = useToast();
  const isDark = (settings.theme ?? 'dark') === 'dark';
  const canApproveAdvances = hasPermission(user, 'can_manage_payroll');
  const [actingId, setActingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AppNotification | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  /* ── Advance Approval Modal (treasury picker) ── */
  const [advApproveNotif, setAdvApproveNotif] = useState<AppNotification | null>(null);
  const [advSafes, setAdvSafes] = useState<SafeOption[]>([]);
  const [advSafesLoading, setAdvSafesLoading] = useState(false);
  const [advSelectedSafeId, setAdvSelectedSafeId] = useState<number | null>(null);
  const [advApproving, setAdvApproving] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const r = await authFetch(api('/api/notifications/unread-count'));
      if (r.ok) {
        const j = await r.json();
        setUnreadCount(Number(j?.count ?? 0));
      }
    } catch { /* silent */ }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(api('/api/notifications'));
      if (r.ok) {
        const j = await r.json();
        const list = Array.isArray(j) ? j : [];
        setItems(list);
        setUnreadCount(list.filter((n: AppNotification) => !n.is_read).length);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(t);
  }, [fetchCount]);

  useEffect(() => { if (open) fetchList(); }, [open, fetchList]);

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
    try { await authFetch(api(`/api/notifications/${id}/read`), { method: 'POST' }); } catch { /* silent */ }
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try { await authFetch(api('/api/notifications/mark-all-read'), { method: 'POST' }); } catch { /* silent */ }
  }

  function handleClick(n: AppNotification) {
    if (!n.is_read) markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  function removeNotification(n: AppNotification) {
    setItems(prev => prev.filter(x => x.id !== n.id));
    if (!n.is_read) setUnreadCount(c => Math.max(0, c - 1));
    authFetch(api(`/api/notifications/${n.id}`), { method: 'DELETE' }).catch(() => {});
  }

  /* ── فتح نافذة اختيار الخزينة ── */
  async function openAdvanceApproveModal(n: AppNotification) {
    setAdvApproveNotif(n);
    setAdvSelectedSafeId(null);
    setAdvSafes([]);
    setAdvSafesLoading(true);
    try {
      const r = await authFetch(api('/api/settings/safes'));
      if (r.ok) {
        const j = await r.json() as SafeOption[] | { data?: SafeOption[] };
        const list: SafeOption[] = Array.isArray(j) ? j : (j as { data?: SafeOption[] }).data ?? [];
        setAdvSafes(list.filter(s => Number(s.balance ?? 0) > 0));
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذّر تحميل الخزائن', variant: 'destructive' });
      setAdvApproveNotif(null);
    } finally {
      setAdvSafesLoading(false);
    }
  }

  /* ── تأكيد اعتماد السلفة مع الخزينة ── */
  async function confirmAdvanceApprove() {
    const n = advApproveNotif;
    if (!n || !n.reference_id) return;
    if (!advSelectedSafeId) {
      toast({ title: 'اختر الخزينة', description: 'يجب اختيار خزينة لصرف مبلغ السلفة منها', variant: 'destructive' });
      return;
    }
    setAdvApproving(true);
    try {
      const r = await authFetch(api(`/api/salary-advances/${n.reference_id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safe_id: advSelectedSafeId }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string; safe_name?: string };
      if (r.ok) {
        removeNotification(n);
        setAdvApproveNotif(null);
        toast({
          title: '✅ تم اعتماد السلفة',
          description: `تم صرف المبلغ من ${j.safe_name ?? 'الخزينة المختارة'} بنجاح`,
        });
      } else {
        toast({ title: 'خطأ في الاعتماد', description: j?.error || 'تعذّر اعتماد السلفة', variant: 'destructive' });
      }
    } finally {
      setAdvApproving(false);
    }
  }

  async function confirmReject() {
    const n = rejectTarget;
    if (!n || !n.reference_id) return;
    setActingId(n.id);
    try {
      const r = await authFetch(api(`/api/salary-advances/${n.reference_id}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: rejectReason }),
      });
      if (r.ok) {
        removeNotification(n);
        toast({ title: 'تم الرفض', description: 'تم رفض طلب السلفة' });
      } else {
        const j = await r.json().catch(() => ({}));
        toast({ title: 'خطأ', description: j?.error || 'تعذر رفض الطلب', variant: 'destructive' });
      }
    } finally {
      setActingId(null);
      setRejectTarget(null);
      setRejectReason('');
    }
  }

  /* ── Styles ── */
  const bgPanel  = isDark ? '#161f30' : '#ffffff';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const textMain = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.85)';
  const textSub  = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.45)';
  const rowHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="رسائلي"
        aria-label="رسائلي"
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
            <NotificationList
              items={items}
              isDark={isDark}
              border={border}
              textMain={textMain}
              textSub={textSub}
              rowHover={rowHover}
              canApproveAdvances={canApproveAdvances}
              actingId={actingId}
              rejectTarget={rejectTarget}
              rejectReason={rejectReason}
              onSetRejectReason={setRejectReason}
              onSetRejectTarget={setRejectTarget}
              onConfirmReject={confirmReject}
              onOpenAdvanceApproveModal={openAdvanceApproveModal}
              onClick={handleClick}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          نافذة اختيار الخزينة لاعتماد السلفة
      ══════════════════════════════════════════════════════════ */}
      {advApproveNotif && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', direction: 'rtl',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !advApproving) setAdvApproveNotif(null); }}
        >
          <div style={{
            background: isDark ? '#1a2540' : '#ffffff',
            borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            width: '100%', maxWidth: 440,
            border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              background: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22 }}>💰</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: isDark ? '#fff' : '#111' }}>
                    اعتماد وصرف السلفة
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', marginTop: 2 }}>
                    {advApproveNotif.message}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { if (!advApproving) setAdvApproveNotif(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 6 }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
                اختر الخزينة التي سيُصرف منها المبلغ:
              </div>

              {/* Loading safes */}
              {advSafesLoading && (
                <div style={{ textAlign: 'center', padding: '24px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 13 }}>
                  ⏳ جاري تحميل الخزائن...
                </div>
              )}

              {/* No safes */}
              {!advSafesLoading && advSafes.length === 0 && (
                <div style={{
                  padding: '16px', borderRadius: 10, textAlign: 'center',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  fontSize: 12, color: '#ef4444',
                }}>
                  ⚠️ لا توجد خزائن بها رصيد كافٍ للصرف
                </div>
              )}

              {/* Safes list */}
              {!advSafesLoading && advSafes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {advSafes.map(s => {
                    const bal = Number(s.balance ?? 0);
                    const isSelected = advSelectedSafeId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setAdvSelectedSafeId(s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                          border: `2px solid ${isSelected ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                          background: isSelected
                            ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
                            : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                          transition: 'all 0.15s', textAlign: 'right',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: isSelected ? 'rgba(34,197,94,0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                          }}>🏦</div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fff' : '#111' }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', marginTop: 2 }}>
                              الرصيد المتاح
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.85)' : '#111'), fontVariantNumeric: 'tabular-nums' }}>
                            {bal.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {isSelected && (
                            <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2, textAlign: 'left' }}>✓ محدد</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Warning */}
              {!advSelectedSafeId && !advSafesLoading && advSafes.length > 0 && (
                <div style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                  ⚠️ اختيار الخزينة إلزامي — سيُخصم المبلغ فور الاعتماد
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 20px', display: 'flex', gap: 10,
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            }}>
              <button
                onClick={() => { void confirmAdvanceApprove(); }}
                disabled={advApproving || !advSelectedSafeId || advSafesLoading}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                  background: (advApproving || !advSelectedSafeId || advSafesLoading)
                    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
                    : '#22c55e',
                  color: (advApproving || !advSelectedSafeId || advSafesLoading)
                    ? (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')
                    : '#fff',
                  fontSize: 13, fontWeight: 800,
                  cursor: (advApproving || !advSelectedSafeId || advSafesLoading) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {advApproving
                  ? <><RefreshCw style={{ width: 13, height: 13 }} /> جاري الاعتماد...</>
                  : <><Check style={{ width: 13, height: 13 }} /> اعتماد وصرف السلفة</>
                }
              </button>
              <button
                onClick={() => { if (!advApproving) setAdvApproveNotif(null); }}
                disabled={advApproving}
                style={{
                  padding: '11px 18px', borderRadius: 10,
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                  background: 'transparent',
                  color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
