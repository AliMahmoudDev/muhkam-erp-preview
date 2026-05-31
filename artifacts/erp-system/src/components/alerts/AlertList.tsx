import { AlertItem } from './AlertItem';

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

interface AlertListProps {
  displayed: Alert[];
  tab: FilterTab;
  isDark: boolean;
  border: string;
  textMain: string;
  textSub: string;
  rowHover: string;
  onAlertClick: (alert: Alert) => void;
  onMarkRead: (id: number) => void;
  onResolve: (id: number) => void;
}

export function AlertList({
  displayed,
  tab,
  isDark,
  border,
  textMain,
  textSub,
  rowHover,
  onAlertClick,
  onMarkRead,
  onResolve,
}: AlertListProps) {
  if (displayed.length === 0) {
    return (
      <div
        style={{ padding: '36px 16px', textAlign: 'center', color: textSub, fontSize: 13 }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>
          {tab === 'resolved' ? '📋' : '✅'}
        </div>
        {tab === 'resolved' ? 'لا توجد تنبيهات محلولة' : 'لا توجد تنبيهات نشطة'}
      </div>
    );
  }

  return (
    <>
      {displayed.map((alert) => (
        <AlertItem
          key={alert.id}
          alert={alert}
          isDark={isDark}
          border={border}
          textMain={textMain}
          textSub={textSub}
          rowHover={rowHover}
          onAlertClick={onAlertClick}
          onMarkRead={onMarkRead}
          onResolve={onResolve}
        />
      ))}
    </>
  );
}
