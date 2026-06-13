import React from 'react';
import { type Manager, C, FONT } from '../types';
import { Modal, DarkInput, ConfirmDeleteModal } from '../ui';

interface Props {
  showAddMgr: boolean;
  setShowAddMgr: (v: boolean) => void;
  editMgr: Manager | null;
  setEditMgr: (v: Manager | null) => void;
  deleteMgr: Manager | null;
  setDeleteMgr: (v: Manager | null) => void;
  deleteMgrErr: string;
  setDeleteMgrErr: (v: string) => void;
  mgName: string;
  setMgName: (v: string) => void;
  mgUser: string;
  setMgUser: (v: string) => void;
  mgPin: string;
  setMgPin: (v: string) => void;
  mgPin2: string;
  setMgPin2: (v: string) => void;
  mgErr: string;
  eName: string;
  setEName: (v: string) => void;
  eUser: string;
  setEUser: (v: string) => void;
  ePin: string;
  setEPin: (v: string) => void;
  ePin2: string;
  setEPin2: (v: string) => void;
  eErr: string;
  handleAddMgr: () => void;
  handleEditMgr: () => void;
  resetAddForm: () => void;
  resetEditForm: () => void;
  mgCreatePending: boolean;
  mgUpdatePending: boolean;
  mgDeleteMutate: (id: number) => void;
  mgDeletePending: boolean;
}

export function ManagerModals({
  showAddMgr,
  setShowAddMgr,
  editMgr,
  setEditMgr,
  deleteMgr,
  setDeleteMgr,
  deleteMgrErr,
  setDeleteMgrErr,
  mgName,
  setMgName,
  mgUser,
  setMgUser,
  mgPin,
  setMgPin,
  mgPin2,
  setMgPin2,
  mgErr,
  eName,
  setEName,
  eUser,
  setEUser,
  ePin,
  setEPin,
  ePin2,
  setEPin2,
  eErr,
  handleAddMgr,
  handleEditMgr,
  resetAddForm,
  resetEditForm,
  mgCreatePending,
  mgUpdatePending,
  mgDeleteMutate,
  mgDeletePending,
}: Props) {
  return (
    <>
      {deleteMgr && (
        <ConfirmDeleteModal
          title="حذف المدير"
          body={
            <>
              هل أنت متأكد من حذف المدير{' '}
              <strong style={{ color: C.text }}>"{deleteMgr.name}"</strong>؟<br />
              <span style={{ color: C.danger, fontSize: '13px' }}>
                لا يمكن التراجع عن هذا الإجراء.
              </span>
            </>
          }
          loading={mgDeletePending}
          error={deleteMgrErr}
          onConfirm={() => mgDeleteMutate(deleteMgr.id)}
          onCancel={() => {
            setDeleteMgr(null);
            setDeleteMgrErr('');
          }}
        />
      )}

      {showAddMgr && (
        <Modal
          title="➕ إضافة مدير عام جديد"
          onClose={() => {
            setShowAddMgr(false);
            resetAddForm();
          }}
        >
          <DarkInput
            label="الاسم الكامل"
            value={mgName}
            onChange={setMgName}
            placeholder="مثال: محمد العلي"
            required
          />
          <DarkInput
            label="اسم المستخدم"
            value={mgUser}
            onChange={setMgUser}
            placeholder="بدون مسافات"
            required
            hint="لا يحتوي على مسافات"
          />
          <DarkInput
            label="الرقم السري"
            value={mgPin}
            onChange={setMgPin}
            type="password"
            placeholder="4 أحرف على الأقل"
            required
          />
          <DarkInput
            label="تأكيد الرقم السري"
            value={mgPin2}
            onChange={setMgPin2}
            type="password"
            placeholder="أعد كتابة الرقم السري"
            required
          />
          {mgErr && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                fontSize: '13px',
                color: C.danger,
                marginBottom: '14px',
              }}
            >
              ⚠️ {mgErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleAddMgr}
              disabled={mgCreatePending}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: C.orange,
                color: 'var(--text-1)',
                fontSize: '14px',
                fontWeight: 800,
                cursor: mgCreatePending ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                opacity: mgCreatePending ? 0.7 : 1,
              }}
            >
              {mgCreatePending ? 'جاري الإضافة...' : 'إضافة المدير'}
            </button>
            <button
              onClick={() => {
                setShowAddMgr(false);
                resetAddForm();
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.muted,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {editMgr && (
        <Modal
          title="✏️ تعديل بيانات المدير"
          onClose={() => {
            setEditMgr(null);
            resetEditForm();
          }}
        >
          <DarkInput
            label="الاسم الكامل"
            value={eName}
            onChange={setEName}
            placeholder="الاسم الكامل"
            required
          />
          <DarkInput
            label="اسم المستخدم"
            value={eUser}
            onChange={setEUser}
            placeholder="بدون مسافات"
            required
          />
          <DarkInput
            label="الرقم السري الجديد"
            value={ePin}
            onChange={setEPin}
            type="password"
            placeholder="اتركه فارغاً إذا لم تريد تغييره"
            hint="اختياري — فارغ يعني عدم التغيير"
          />
          {ePin && (
            <DarkInput
              label="تأكيد الرقم السري الجديد"
              value={ePin2}
              onChange={setEPin2}
              type="password"
              placeholder="أعد كتابة الرقم السري الجديد"
            />
          )}
          {eErr && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                fontSize: '13px',
                color: C.danger,
                marginBottom: '14px',
              }}
            >
              ⚠️ {eErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleEditMgr}
              disabled={mgUpdatePending}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: C.orange,
                color: 'var(--text-1)',
                fontSize: '14px',
                fontWeight: 800,
                cursor: mgUpdatePending ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
                opacity: mgUpdatePending ? 0.7 : 1,
              }}
            >
              {mgUpdatePending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button
              onClick={() => {
                setEditMgr(null);
                resetEditForm();
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.muted,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
