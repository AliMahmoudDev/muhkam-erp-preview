import { type Manager, C, FONT } from './types';
import { ManagersTable } from './managers/ManagersTable';

interface Props {
  managers: Manager[];
  mgLoading: boolean;
  mgError: boolean | unknown;
  mgRefetch: () => void;
  currentUserId: number | undefined;
  mgToggleMutate: (id: number) => void;
  openEdit: (m: Manager) => void;
  setDeleteMgrErr: (v: string) => void;
  setDeleteMgr: (m: Manager | null) => void;
  resetAddForm: () => void;
  setShowAddMgr: (v: boolean) => void;
}

export function TabManagers({
  managers,
  mgLoading,
  mgError,
  mgRefetch,
  currentUserId,
  mgToggleMutate,
  openEdit,
  setDeleteMgrErr,
  setDeleteMgr,
  resetAddForm,
  setShowAddMgr,
}: Props) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: '20px',
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>
            المديرون العامون
          </h2>
          <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>
            {managers.length} مدير عام مسجّل
          </p>
        </div>
        <button
          onClick={() => {
            resetAddForm();
            setShowAddMgr(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: C.orange,
            color: 'var(--text-1)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          <span>➕</span>
          <span>مدير عام جديد</span>
        </button>
      </div>

      <ManagersTable
        managers={managers}
        mgLoading={mgLoading}
        mgError={mgError}
        mgRefetch={mgRefetch}
        currentUserId={currentUserId}
        mgToggleMutate={mgToggleMutate}
        openEdit={openEdit}
        setDeleteMgrErr={setDeleteMgrErr}
        setDeleteMgr={setDeleteMgr}
      />
    </div>
  );
}
