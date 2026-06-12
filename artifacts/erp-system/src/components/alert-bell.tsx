import { api } from '@/lib/api';
import { getTenantScopedStorageKey } from '@/lib/tenant-storage';
/**
 * AlertBell — smart, role-filtered notification center.
 *
 * Fetch strategy (NO polling):
 *   • Fetch list on mount + run daily check once per calendar day.
 *   • Manual refresh button re-fetches the list only.
 *   • Manual "فحص" forces a full run-checks (admin).
 *
 * Filters: Active | Unread | Resolved
 * Per-alert: mark read, resolve (تم الحل)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Bell, RefreshCw } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useAppSettings } from '@/contexts/app-settings';
import { AlertList } from './alerts/AlertList';

interface Alert {
  id: number;
  type: string;
  severity: string;
  message: string;
  reference_id: string | null;
  trigger_mode: string;
  role_target: string | null;
  last_triggered_date: string | null;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: number | null;
  created_at: string;
}

type FilterTab = 'active' | 'unread' | 'resolved';

const DAILY_CHECK_KEY = 'erp_daily_alert_check';

const TYPE_LINKS: Record<string, string> = {
  low_stock: '/inventory',
  customer_debt: '/customers',
  supplier_payable: '/purchases',
  cash_low: '/finance',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function AlertBell() {
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<FilterTab>('active');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { settings } = useAppSettings();
  const isDark = (settings.theme ?? 'dark') === 'dark';
  const [, navigate] = useLocation();

  function handleAlertClick(alert: Alert) {
    if (!alert.is_read) markRead(alert.id);
    const link = TYPE_LINKS[alert.type];
    if (link) {
      setOpen(false);
      navigate(link);
    }
  }

  /* ── derived counts ─────────────────────────────────────── */
  const active = allAlerts.filter((a) => !a.is_resolved);
  const unread = active.filter((a) => !a.is_read);
  const resolved = allAlerts.filter((a) => a.is_resolved);
  const critical = active.filter((a) => a.severity === 'CRITICAL');

  const badgeCount = unread.length;
  const hasCritical = critical.length > 0;

  /* ── filtered list for the current tab ─────────────────── */
  const displayed: Alert[] = tab === 'active' ? active : tab === 'unread' ? unread : resolved;

  /* ── Fetch list (includes resolved when on resolved tab) ─ */
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await authFetch(api('/api/alerts?include_resolved=true'));
      if (res.ok) setAllAlerts(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  /* ── Daily check: once per calendar day ────────────────── */
  const runDailyCheckIfNeeded = useCallback(async () => {
    if (localStorage.getItem(getTenantScopedStorageKey(DAILY_CHECK_KEY)) === todayStr()) return;
    try {
      const res = await authFetch(api('/api/alerts/daily-check'), { method: 'POST' });
      if (res.ok) {
        localStorage.setItem(getTenantScopedStorageKey(DAILY_CHECK_KEY), todayStr());
        await fetchAlerts();
      }
    } catch {
      /* silent */
    }
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
    runDailyCheckIfNeeded();
  }, [fetchAlerts, runDailyCheckIfNeeded]);

  /* ── Close on outside click ─────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Actions ────────────────────────────────────────────── */
  async function markRead(id: number) {
    await authFetch(api(`/api/alerts/mark-read/${id}`), { method: 'POST' });
    setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await authFetch(api('/api/alerts/mark-all-read'), { method: 'POST' });
      setAllAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } finally {
      setLoading(false);
    }
  }

  async function resolveAlert(id: number) {
    await authFetch(api(`/api/alerts/resolve/${id}`), { method: 'POST' });
    setAllAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, is_resolved: true, resolved_at: new Date().toISOString() } : a
      )
    );
  }

  async function manualRefresh() {
    setLoading(true);
    try {
      await fetchAlerts();
    } finally {
      setLoading(false);
    }
  }

  async function forceRunChecks() {
    setLoading(true);
    try {
      await authFetch(api('/api/alerts/run-checks'), { method: 'POST' });
      await fetchAlerts();
    } finally {
      setLoading(false);
    }
  }

  /* ── Styles ─────────────────────────────────────────────── */
  const bgPanel = isDark ? '#161f30' : 'var(--text-1)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const textMain = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.85)';
  const textSub = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.42)';
  const rowHover = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  function tabStyle(t: FilterTab) {
    const isActive = tab === t;
    return {
      fontSize: 11,
      fontWeight: 600,
      padding: '4px 10px',
      borderRadius: 7,
      cursor: 'pointer',
      border: 'none',
      background: isActive
        ? isDark
          ? 'rgba(245,158,11,0.18)'
          : 'rgba(245,158,11,0.14)'
        : 'transparent',
      color: isActive ? 'var(--status-warning)' : textSub,
      transition: 'all 0.15s',
    } as React.CSSProperties;
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* ── Bell Button ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          padding: '7px',
          borderRadius: '10px',
          border: `1px solid ${border}`,
          background: open
            ? isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)'
            : 'transparent',
          cursor: 'pointer',
          color: textMain,
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
        }}
        title="التنبيهات"
        aria-label="التنبيهات"
      >
        <Bell style={{ width: 16, height: 16 }} />
        {badgeCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              minWidth: 17,
              height: 17,
              borderRadius: 9,
              background: hasCritical ? 'var(--status-danger)' : 'var(--status-warning)',
              color: 'var(--text-1)',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ──────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 360,
            maxHeight: 520,
            borderRadius: 14,
            background: bgPanel,
            border: `1px solid ${border}`,
            boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.65)' : '0 8px 32px rgba(0,0,0,0.13)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            direction: 'rtl',
          }}
        >
          {/* Header row */}
          <div
            style={{
              padding: '10px 14px 0',
              borderBottom: `1px solid ${border}`,
            }}
          >
            {/* Title + action buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>التنبيهات</span>
                {/* Badges */}
                {active.length > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 8,
                      fontWeight: 600,
                      background: 'rgba(245,158,11,0.14)',
                      color: 'var(--status-warning)',
                    }}
                  >
                    {active.length} نشطة
                  </span>
                )}
                {hasCritical && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 8,
                      fontWeight: 600,
                      background: 'rgba(239,68,68,0.15)',
                      color: 'var(--status-danger)',
                    }}
                  >
                    {critical.length} حرجية
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={manualRefresh}
                  disabled={loading}
                  title="تحديث القائمة"
                  style={{
                    padding: '3px 7px',
                    borderRadius: 6,
                    border: `1px solid ${border}`,
                    background: 'transparent',
                    color: textSub,
                    cursor: 'pointer',
                    fontSize: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <RefreshCw style={{ width: 10, height: 10 }} /> تحديث
                </button>
                <button
                  onClick={forceRunChecks}
                  disabled={loading}
                  title="فحص كامل"
                  style={{
                    padding: '3px 7px',
                    borderRadius: 6,
                    border: `1px solid ${border}`,
                    background: 'transparent',
                    color: textSub,
                    cursor: 'pointer',
                    fontSize: 10,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  🔍 فحص
                </button>
                {unread.length > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 6,
                      border: `1px solid ${border}`,
                      background: 'transparent',
                      color: textSub,
                      cursor: 'pointer',
                      fontSize: 10,
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    قراءة الكل
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4, paddingBottom: 8 }}>
              <button style={tabStyle('active')} onClick={() => setTab('active')}>
                نشطة ({active.length})
              </button>
              <button style={tabStyle('unread')} onClick={() => setTab('unread')}>
                غير مقروءة ({unread.length})
              </button>
              <button style={tabStyle('resolved')} onClick={() => setTab('resolved')}>
                محلولة ({resolved.length})
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <AlertList
              displayed={displayed}
              tab={tab}
              isDark={isDark}
              border={border}
              textMain={textMain}
              textSub={textSub}
              rowHover={rowHover}
              onAlertClick={handleAlertClick}
              onMarkRead={markRead}
              onResolve={resolveAlert}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '7px 14px',
              borderTop: `1px solid ${border}`,
              fontSize: 10,
              color: textSub,
              textAlign: 'center',
            }}
          >
            الفحص اليومي يعمل تلقائياً عند تسجيل الدخول
          </div>
        </div>
      )}
    </div>
  );
}
