import { api } from '@/lib/api';
/**
 * AnnouncementBanner — shows active system announcements from super admin.
 * • Appears between topbar and page content for all tenant users
 * • Color-coded by type: info (blue) / success (green) / warning (amber) / danger (red)
 * • If multiple: shows one at a time with ‹ › navigation
 * • Each announcement dismissed individually, stored in sessionStorage
 * • Super admins never see it (they manage announcements)
 */
import { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { authFetch } from '@/lib/auth-fetch';

const FONT = "'Cairo', 'Tajawal', sans-serif";
const STORAGE_KEY = 'erp_dismissed_announcements';

interface Announcement {
  id: number;
  title: string;
  body: string;
  type: string; // info | success | warning | danger
  target: string;
  created_at: string;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: 'ℹ️' },
  success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', icon: '✅' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: 'var(--status-warning)', icon: '⚠️' },
  danger: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '🚨' },
};

function getDismissed(): Set<number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return new Set(JSON.parse(raw ?? '[]') as number[]);
  } catch {
    return new Set();
  }
}

function addDismissed(id: number) {
  const set = getDismissed();
  set.add(id);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function AnnouncementBanner() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState<Set<number>>(getDismissed);

  /* Fetch once on mount */
  useEffect(() => {
    if (!user || user.role === 'super_admin') return;
    authFetch(api('/api/announcements'))
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((data: { announcements: Announcement[] }) => {
        setAnnouncements(data.announcements ?? []);
      })
      .catch(() => {
        /* silent */
      });
  }, [user]);

  if (!user || user.role === 'super_admin') return null;

  /* Filter out dismissed */
  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  /* Clamp index */
  const safeIdx = Math.min(idx, visible.length - 1);
  const ann = visible[safeIdx];
  const style = TYPE_STYLES[ann.type] ?? TYPE_STYLES.info;
  const hasMultiple = visible.length > 1;

  function dismiss(id: number) {
    addDismissed(id);
    setDismissed(getDismissed());
    setIdx((prev) => Math.min(prev, visible.length - 2));
  }

  function prev() {
    setIdx((i) => (i - 1 + visible.length) % visible.length);
  }
  function next() {
    setIdx((i) => (i + 1) % visible.length);
  }

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 18px',
        background: style.bg,
        borderBottom: `1.5px solid ${style.border}`,
        color: style.text,
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: FONT,
        flexWrap: 'wrap',
        animationName: 'ann-slide-in',
        animationDuration: '0.3s',
        animationFillMode: 'both',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{style.icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 800 }}>{ann.title}</span>
        {ann.body && (
          <span style={{ fontWeight: 500, marginRight: '8px', opacity: 0.85 }}>
            {' — '}
            {ann.body}
          </span>
        )}
      </div>

      {/* Counter + navigation */}
      {hasMultiple && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={next}
            title="الإشعار السابق"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: style.text,
              opacity: 0.7,
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={16} />
          </button>
          <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: 700 }}>
            {safeIdx + 1}/{visible.length}
          </span>
          <button
            onClick={prev}
            title="الإشعار التالي"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: style.text,
              opacity: 0.7,
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Dismiss button */}
      <button
        onClick={() => dismiss(ann.id)}
        aria-label="إغلاق"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: style.text,
          opacity: 0.6,
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>

      <style>{`
        @keyframes ann-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
