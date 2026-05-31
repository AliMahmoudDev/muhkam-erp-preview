import { type Company, C, FONT } from '../../types';
import { ConfirmDeleteModal } from '../../ui';

interface CoDeleteMutate {
  mutate: (args: { id: number; force?: boolean; confirm_code?: string; expected_code?: string }) => void;
  isPending: boolean;
}

interface Props {
  deleteTarget: Company | null;
  deleteStep: 'confirm' | 'code';
  deleteCoErr: string;
  generatedCode: string;
  enteredCode: string;
  setEnteredCode: (v: string) => void;
  coDelete: CoDeleteMutate;
  cancelDelete: () => void;
}

/* Presentational — company delete flow (confirm + code steps).
   The delete mutation lives in the parent hook; only mutate() is invoked here. */
export function DeleteCompanyModal({
  deleteTarget, deleteStep, deleteCoErr, generatedCode, enteredCode, setEnteredCode, coDelete, cancelDelete,
}: Props) {
  if (!deleteTarget) return null;

  return (
    <>
      {/* ── Delete Company: Confirm Step ── */}
      {deleteStep === 'confirm' && (
        <ConfirmDeleteModal
          title="حذف الشركة"
          body={
            <>
              هل أنت متأكد من حذف شركة{' '}
              <strong style={{ color: C.text }}>"{deleteTarget.name}"</strong>؟<br />
              <span style={{ color: C.danger, fontSize: '13px' }}>سيتم حذف جميع البيانات المرتبطة بها نهائياً.</span>
            </>
          }
          loading={coDelete.isPending}
          error={deleteCoErr}
          onConfirm={() => coDelete.mutate({ id: deleteTarget.id })}
          onCancel={cancelDelete}
        />
      )}

      {/* ── Delete Company: Code Step ── */}
      {deleteStep === 'code' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div dir="rtl" style={{ background: C.card, borderRadius: '20px', border: '1px solid rgba(239,68,68,0.4)', padding: '32px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>⚠️</div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: C.danger, margin: 0 }}>تأكيد الحذف النهائي</h3>
            </div>
            <p style={{ fontSize: '13px', color: C.muted, lineHeight: 1.8, marginBottom: '8px' }}>
              الشركة <strong style={{ color: C.text }}>"{deleteTarget.name}"</strong> تحتوي على مستخدمين مرتبطين. سيتم حذف الشركة وجميع مستخدميها نهائياً.
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: C.muted, marginBottom: '6px' }}>كود التأكيد — اكتبه في الحقل أدناه</div>
              <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '10px', color: C.danger, fontFamily: 'monospace' }}>{generatedCode}</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: C.muted, display: 'block', marginBottom: '6px' }}>أدخل الكود للتأكيد:</label>
              <input
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                style={{ width: '100%', padding: '14px', borderRadius: '10px', textAlign: 'center', border: `2px solid ${enteredCode.length === 6 && enteredCode === generatedCode ? C.success : 'rgba(239,68,68,0.4)'}`, background: 'rgba(15,23,42,0.6)', color: C.text, fontSize: '24px', fontWeight: 900, letterSpacing: '8px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {deleteCoErr && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px', color: C.danger }}>
                ⚠️ {deleteCoErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                disabled={enteredCode !== generatedCode || coDelete.isPending}
                onClick={() => coDelete.mutate({ id: deleteTarget.id, force: true, confirm_code: enteredCode, expected_code: generatedCode })}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: enteredCode === generatedCode ? C.danger : '#4a1a1a', color: '#fff', fontSize: '14px', fontWeight: 800, cursor: enteredCode === generatedCode ? 'pointer' : 'not-allowed', fontFamily: FONT, opacity: enteredCode === generatedCode ? 1 : 0.5 }}
              >
                {coDelete.isPending ? 'جاري الحذف...' : 'احذف نهائياً'}
              </button>
              <button
                onClick={cancelDelete}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
