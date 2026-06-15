import { Users } from 'lucide-react';
import { type Manager, C } from '../types';
import { SASkeleton, SAEmptyState, SAErrorState } from '../sa-primitives';
import { ManagerRow } from './ManagerRow';

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
}

/* Presentational — column headers, load/error/empty states, and the row list.
   All data and handlers are owned by the parent (TabManagers). */
export function ManagersTable({
  managers,
  mgLoading,
  mgError,
  mgRefetch,
  currentUserId,
  mgToggleMutate,
  openEdit,
  setDeleteMgrErr,
  setDeleteMgr,
}: Props) {
  return (
    <>
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 140px 160px 90px 1fr',
          gap: '8px',
          padding: '10px 24px',
          background: 'rgba(249,115,22,0.08)',
          borderBottom: `1px solid ${C.border}`,
          fontSize: '11px',
          fontWeight: 700,
          color: C.orange,
          alignItems: 'center',
        }}
      >
        <div>#</div>
        <div>الاسم</div>
        <div>اسم المستخدم</div>
        <div>آخر دخول</div>
        <div style={{ textAlign: 'center' }}>الحالة</div>
        <div style={{ textAlign: 'center' }}>الإجراءات</div>
      </div>

      {mgLoading ? (
        <SASkeleton rows={4} rowHeight={52} />
      ) : mgError ? (
        <SAErrorState
          title="تعذّر جلب بيانات المديرين"
          description="تحقق من الاتصال بالخادم أو أعد تسجيل الدخول"
          onRetry={() => void mgRefetch()}
        />
      ) : managers.length === 0 ? (
        <SAEmptyState
          icon={<Users size={40} strokeWidth={1} />}
          title="لا يوجد مديرون عامون مسجّلون"
        />
      ) : (
        managers.map((m, idx) => (
          <ManagerRow
            key={m.id}
            m={m}
            idx={idx}
            currentUserId={currentUserId}
            mgToggleMutate={mgToggleMutate}
            openEdit={openEdit}
            setDeleteMgrErr={setDeleteMgrErr}
            setDeleteMgr={setDeleteMgr}
          />
        ))
      )}
    </>
  );
}
