import { CheckCircle } from 'lucide-react';

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

const TYPE_ICONS: Record<string, string> = {
  low_stock: '📦',
  customer_debt: '👤',
  supplier_payable: '💳',
  cash_low: '💰',
  health: '🩺',
};

const TYPE_LINKS: Record<string, string> = {
  low_stock:        '/inventory',
  customer_debt:    '/customers',
  supplier_payable: '/purchases',
  cash_low:         '/finance',
};

interface AlertItemProps {
  alert: Alert;
  isDark: boolean;
  border: string;
  textMain: string;
  textSub: string;
  rowHover: string;
  onAlertClick: (alert: Alert) => void;
  onMarkRead: (id: number) => void;
  onResolve: (id: number) => void;
}

export function AlertItem({
  alert,
  isDark,
  border,
  textMain,
  textSub,
  rowHover,
  onAlertClick,
  onMarkRead,
  onResolve,
}: AlertItemProps) {
  return (
    <div
      onClick={() => onAlertClick(alert)}
      style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${border}`,
        background: alert.is_resolved
          ? isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.02)'
          : alert.is_read
            ? 'transparent'
            : isDark
              ? 'rgba(245,158,11,0.05)'
              : 'rgba(245,158,11,0.05)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: TYPE_LINKS[alert.type] ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = rowHover;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = alert.is_resolved
          ? isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.02)'
          : alert.is_read
            ? 'transparent'
            : isDark
              ? 'rgba(245,158,11,0.05)'
              : 'rgba(245,158,11,0.05)';
      }}
    >
      {/* Dot / resolved icon */}
      <div style={{ marginTop: 4, flexShrink: 0 }}>
        {alert.is_resolved ? (
          <CheckCircle style={{ width: 14, height: 14, color: '#22c55e' }} />
        ) : (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              marginTop: 3,
              background: alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Message */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.45,
            color: alert.is_resolved ? textSub : textMain,
            wordBreak: 'break-word',
            textDecoration: alert.is_resolved ? 'line-through' : 'none',
            opacity: alert.is_resolved ? 0.7 : 1,
          }}
        >
          {TYPE_ICONS[alert.type] ?? '⚠️'} {alert.message}
        </div>

        {/* Meta row */}
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            gap: 5,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 5,
              fontWeight: 600,
              background:
                alert.severity === 'CRITICAL'
                  ? 'rgba(239,68,68,0.14)'
                  : 'rgba(245,158,11,0.14)',
              color: alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
            }}
          >
            {alert.severity === 'CRITICAL' ? 'حرجي' : 'تحذير'}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 5,
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
              color: textSub,
            }}
          >
            {alert.trigger_mode === 'daily' ? 'يومي' : 'فوري'}
          </span>
          <span style={{ fontSize: 10, color: textSub }}>
            {new Date(alert.created_at).toLocaleString('ar-EG-u-nu-latn', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {!alert.is_read && !alert.is_resolved && (
            <span style={{ fontSize: 10, color: '#f59e0b', marginRight: 'auto' }}>
              ● جديد
            </span>
          )}
          {alert.is_resolved && (
            <span style={{ fontSize: 10, color: '#22c55e' }}>
              ✓ {alert.resolved_by ? 'محلول يدوياً' : 'محلول تلقائياً'}
            </span>
          )}
        </div>

        {/* Action buttons (only for active alerts) */}
        {!alert.is_resolved && (
          <div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
            {!alert.is_read && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkRead(alert.id); }}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 5,
                  border: `1px solid ${border}`,
                  background: 'transparent',
                  color: textSub,
                  cursor: 'pointer',
                }}
              >
                تعليم كمقروء
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(alert.id); }}
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 5,
                border: '1px solid rgba(34,197,94,0.35)',
                background: 'rgba(34,197,94,0.08)',
                color: '#22c55e',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✓ تم الحل
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
