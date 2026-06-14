import { type Manager, C, FONT } from '../types';

interface Props {
  m: Manager;
  idx: number;
  currentUserId: number | undefined;
  mgToggleMutate: (id: number) => void;
  openEdit: (m: Manager) => void;
  setDeleteMgrErr: (v: string) => void;
  setDeleteMgr: (m: Manager | null) => void;
}

/* Presentational — a single manager row. All actions are parent-owned handlers. */
export function ManagerRow({
  m,
  idx,
  currentUserId,
  mgToggleMutate,
  openEdit,
  setDeleteMgrErr,
  setDeleteMgr,
}: Props) {
  const isMe = m.id === currentUserId;
  const isOdd = idx % 2 === 1;
  const isActive = m.active !== false;
  const lastLogin = m.last_login
    ? new Date(m.last_login).toLocaleDateString('ar-EG-u-nu-latn', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'لم يسجل بعد';

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: isOdd ? 'var(--surface-raised)' : 'transparent',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 140px 160px 90px 1fr',
          gap: '8px',
          padding: '14px 24px',
          alignItems: 'center',
        }}
      >
        {/* ID badge */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: C.orangeDim,
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 900,
            color: C.orange,
            flexShrink: 0,
          }}
        >
          #{m.id}
        </div>

        {/* Name */}
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
            {m.name}
            {isMe && (
              <span
                style={{
                  marginRight: '8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: C.orange,
                  background: C.orangeDim,
                  border: `1px solid rgba(249,115,22,0.3)`,
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                أنت
              </span>
            )}
          </div>
          {m.email && (
            <div style={{ fontSize: '11px', color: C.muted }}>{m.email}</div>
          )}
        </div>

        {/* Username */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: C.muted,
            direction: 'ltr',
          }}
        >
          @{m.username}
        </div>

        {/* Last login */}
        <div style={{ fontSize: '12px', color: m.last_login ? C.success : C.muted }}>
          {lastLogin}
        </div>

        {/* Status */}
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-block',
              background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)',
              color: isActive ? C.success : C.muted,
              border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.2)'}`,
            }}
          >
            {isActive ? 'نشط' : 'موقوف'}
          </span>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Edit */}
          <button
            onClick={() => openEdit(m)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${C.orange}44`,
              background: `${C.orange}18`,
              color: C.orange,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${C.orange}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${C.orange}18`;
            }}
          >
            ✏️ تعديل
          </button>

          {/* Toggle */}
          {!isMe && (
            <button
              onClick={() => mgToggleMutate(m.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${isActive ? C.danger : C.success}44`,
                background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: isActive ? C.danger : C.success,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {isActive ? '⛔ إيقاف' : '✅ تفعيل'}
            </button>
          )}

          {/* Delete */}
          {!isMe && (
            <button
              onClick={() => {
                setDeleteMgrErr('');
                setDeleteMgr(m);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1.5px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.1)',
                color: C.danger,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              }}
            >
              🗑️ حذف
            </button>
          )}

          {isMe && (
            <span style={{ fontSize: '11px', color: C.muted, alignSelf: 'center' }}>
              لا يمكن تعديل الحساب الحالي هنا
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
