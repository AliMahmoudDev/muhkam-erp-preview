import { NotificationItem } from './NotificationItem';

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

interface NotificationListProps {
  items: AppNotification[];
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

export function NotificationList({
  items,
  canApproveAdvances,
  actingId,
  rejectTarget,
  rejectReason,
  onSetRejectReason,
  onSetRejectTarget,
  onConfirmReject,
  onOpenAdvanceApproveModal,
  onClick,
}: NotificationListProps) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-hint)', fontSize: 13 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
        لا توجد رسائل
      </div>
    );
  }

  return (
    <>
      {items.map(n => (
        <NotificationItem
          key={n.id}
          n={n}
          canApproveAdvances={canApproveAdvances}
          actingId={actingId}
          rejectTarget={rejectTarget}
          rejectReason={rejectReason}
          onSetRejectReason={onSetRejectReason}
          onSetRejectTarget={onSetRejectTarget}
          onConfirmReject={onConfirmReject}
          onOpenAdvanceApproveModal={onOpenAdvanceApproveModal}
          onClick={onClick}
        />
      ))}
    </>
  );
}
