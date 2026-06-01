import { type Manager, C, FONT } from '../types';
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
        <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
          جاري التحميل...
        </div>
      ) : mgError ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ color: C.danger, fontWeight: 700, marginBottom: '8px' }}>
            تعذّر جلب بيانات المديرين
          </div>
          <div style={{ color: C.muted, fontSize: '13px', marginBottom: '16px' }}>
            تحقق من الاتصال بالخادم أو أعد تسجيل الدخول
          </div>
          <button
            onClick={() => void mgRefetch()}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              background: C.orange,
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : managers.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
          لا يوجد مديرون عامون مسجّلون
        </div>
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
