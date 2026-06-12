import { X, Wallet } from 'lucide-react';

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

const TYPE_ICON: Record<string, string> = {
  advance_pending:   '⏳',
  advance_approved:  '✅',
  advance_rejected:  '❌',
  bonus_granted:     '🎁',
  deduction_added:   '➖',
  custody_settled:   '📦',
  custody_assigned:  '📤',
  transfer_request:  '🔄',
  transfer_approved: '✅',
  transfer_shipped:  '🚚',
  transfer_received: '📦',
  generic:           '🔔',
};

const TYPE_COLOR: Record<string, string> = {
  advance_pending:   'var(--status-warning)',
  advance_approved:  'var(--status-success)',
  advance_rejected:  'var(--status-danger)',
  bonus_granted:     'var(--status-success)',
  deduction_added:   'var(--status-danger)',
  custody_settled:   'var(--status-info)',
  custody_assigned:  'var(--status-info)',
  transfer_request:  'var(--status-info)',
  transfer_approved: 'var(--status-info)',
  transfer_shipped:  'var(--status-warning)',
  transfer_received: 'var(--status-success)',
  generic:           'var(--text-2)',
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

interface NotificationItemProps {
  n: AppNotification;
  isDark: boolean;
  border: string;
  textMain: string;
  textSub: string;
  rowHover: string;
  canApproveAdvances: boolean;
  actingId: number | null;
  rejectTarget: AppNotification | null;
  rejectReason: string;
  onSetRejectReason: (val: string) => void;
  onSetRejectTarget: (n: AppNotification | null) => void;
  onConfirmReject: () => void;
  onOpenAdvanceApproveModal: (n: AppNotification) => void;
  onClick: (n: AppNotification) => void;
}

export function NotificationItem({
  n,
  isDark,
  border,
  textMain,
  textSub,
  rowHover,
  canApproveAdvances,
  actingId,
  rejectTarget,
  rejectReason,
  onSetRejectReason,
  onSetRejectTarget,
  onConfirmReject,
  onOpenAdvanceApproveModal,
  onClick,
}: NotificationItemProps) {
  const color = TYPE_COLOR[n.type] ?? 'var(--text-2)';
  const isRejectOpen = rejectTarget?.id === n.id;

  return (
    <div
      onClick={() => !isRejectOpen && onClick(n)}
      style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${border}`,
        background: n.is_read ? 'transparent' : (isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.05)'),
        display: 'flex', gap: 10, alignItems: 'flex-start',
        cursor: isRejectOpen ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!isRejectOpen) (e.currentTarget as HTMLDivElement).style.background = rowHover; }}
      onMouseLeave={(e) => {
        if (!isRejectOpen) (e.currentTarget as HTMLDivElement).style.background = n.is_read ? 'transparent' : (isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.05)');
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
        {!n.is_read && !isRejectOpen && (
          <span style={{
            display: 'inline-block', marginTop: 4,
            fontSize: 9, color: 'var(--status-warning)', fontWeight: 700,
          }}>● جديد</span>
        )}

        {/* Inline approve/reject for advance_pending */}
        {n.type === 'advance_pending' && canApproveAdvances && n.reference_id && !isRejectOpen && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); void onOpenAdvanceApproveModal(n); }}
              disabled={actingId === n.id}
              style={{
                padding: '3px 8px', borderRadius: 5,
                border: 'none', cursor: 'pointer',
                background: 'var(--status-success)', color: 'var(--text-1)',
                fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                opacity: actingId === n.id ? 0.6 : 1,
              }}
            >
              <Wallet style={{ width: 10, height: 10 }} />
              اعتماد وصرف
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSetRejectTarget(n); onSetRejectReason(''); }}
              disabled={actingId === n.id}
              style={{
                padding: '3px 8px', borderRadius: 5,
                border: 'none', cursor: 'pointer',
                background: 'var(--status-danger)', color: 'var(--text-1)',
                fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                opacity: actingId === n.id ? 0.6 : 1,
              }}
            >
              <X style={{ width: 10, height: 10 }} />
              رفض
            </button>
          </div>
        )}

        {/* Inline reject reason form */}
        {isRejectOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 8 }}
          >
            <textarea
              autoFocus
              placeholder="سبب الرفض (اختياري)"
              value={rejectReason}
              onChange={(e) => onSetRejectReason(e.target.value)}
              rows={2}
              style={{
                width: '100%', borderRadius: 6, padding: '5px 8px',
                fontSize: 11, resize: 'none',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${border}`,
                color: textMain, outline: 'none', direction: 'rtl',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button
                onClick={onConfirmReject}
                disabled={actingId === n.id}
                style={{
                  flex: 1, padding: '3px 8px', borderRadius: 4,
                  border: 'none', cursor: 'pointer',
                  background: 'var(--status-danger)', color: 'var(--text-1)',
                  fontSize: 10, fontWeight: 700,
                  opacity: actingId === n.id ? 0.6 : 1,
                }}
              >
                {actingId === n.id ? 'جارٍ…' : 'تأكيد الرفض'}
              </button>
              <button
                onClick={() => { onSetRejectTarget(null); onSetRejectReason(''); }}
                style={{
                  padding: '3px 8px', borderRadius: 4,
                  border: `1px solid ${border}`, cursor: 'pointer',
                  background: 'transparent', color: textSub,
                  fontSize: 10,
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
