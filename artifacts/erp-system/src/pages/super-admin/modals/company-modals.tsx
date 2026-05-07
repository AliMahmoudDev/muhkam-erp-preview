import React from 'react';
import { type Company, type CreateResult, type ResetPassResult, C, FONT } from '../types';
import { ConfirmDeleteModal } from '../ui';

interface CoDeleteMutate {
  mutate: (args: { id: number; force?: boolean; confirm_code?: string; expected_code?: string }) => void;
  isPending: boolean;
}

interface Props {
  createResult: CreateResult | null;
  setCreateResult: (v: CreateResult | null) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  resetPassResult: ResetPassResult | null;
  setResetPassResult: (v: ResetPassResult | null) => void;
  resetPassCopied: boolean;
  setResetPassCopied: (v: boolean) => void;
  deleteTarget: Company | null;
  setDeleteTarget: (v: Company | null) => void;
  deleteStep: 'confirm' | 'code';
  setDeleteStep: (v: 'confirm' | 'code') => void;
  deleteCoErr: string;
  setDeleteCoErr: (v: string) => void;
  generatedCode: string;
  setGeneratedCode: (v: string) => void;
  enteredCode: string;
  setEnteredCode: (v: string) => void;
  coDelete: CoDeleteMutate;
}

export function CompanyModals({
  createResult, setCreateResult, showToast,
  resetPassResult, setResetPassResult, resetPassCopied, setResetPassCopied,
  deleteTarget, setDeleteTarget, deleteStep, setDeleteStep,
  deleteCoErr, setDeleteCoErr, generatedCode, setGeneratedCode,
  enteredCode, setEnteredCode, coDelete,
}: Props) {
  const cancelDelete = () => {
    setDeleteTarget(null); setDeleteCoErr('');
    setDeleteStep('confirm'); setGeneratedCode(''); setEnteredCode('');
  };

  return (
    <>
      {/* ── Password Reset Result Modal ─── */}
      {resetPassResult && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
          onClick={() => setResetPassResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px', padding: '36px', maxWidth: '460px', width: '100%', direction: 'rtl', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', border: '2px solid #7c3aed22' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '52px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', fontFamily: FONT }}>تم إعادة تعيين كلمة المرور</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', fontFamily: FONT }}>{resetPassResult.company_name}</div>
            </div>
            <div style={{ background: '#f9f5ff', border: '1.5px solid #7c3aed44', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#7c3aed', fontFamily: FONT, marginBottom: '8px', fontWeight: 700 }}>بيانات الدخول المؤقتة:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: FONT }}>اسم المستخدم:</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111', fontFamily: FONT }}>{resetPassResult.username}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: FONT }}>الاسم:</span>
                  <span style={{ fontSize: '13px', color: '#374151', fontFamily: FONT }}>{resetPassResult.name}</span>
                </div>
                <div style={{ height: '1px', background: '#7c3aed22' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: FONT }}>كلمة المرور المؤقتة:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ fontSize: '18px', fontWeight: 800, color: '#7c3aed', background: '#ede9fe', padding: '6px 14px', borderRadius: '8px', letterSpacing: '2px', fontFamily: 'monospace' }}>
                      {resetPassResult.temp_password}
                    </code>
                    <button
                      onClick={() => { void navigator.clipboard.writeText(resetPassResult.temp_password); setResetPassCopied(true); setTimeout(() => setResetPassCopied(false), 2000); }}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #7c3aed44', background: resetPassCopied ? '#7c3aed' : '#f9f5ff', color: resetPassCopied ? '#fff' : '#7c3aed', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', fontFamily: FONT }}
                    >
                      {resetPassCopied ? '✓ نُسخ' : '📋 نسخ'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#92400e', fontFamily: FONT, lineHeight: '1.6' }}>
              ⚠️ أرسل كلمة المرور المؤقتة هذه للعميل بشكل آمن. ستُفقد عند إغلاق هذه النافذة.
            </div>
            <button
              onClick={() => setResetPassResult(null)}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: '#7c3aed', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#6d28d9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#7c3aed'; }}
            >
              تم — إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── Create Company Result Modal ── */}
      {createResult && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
          onClick={() => setCreateResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px', padding: '40px', maxWidth: '500px', width: '100%', direction: 'rtl', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', border: '2px solid #f97316' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '28px' }}>🏢</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', fontFamily: FONT }}>تم إنشاء الشركة بنجاح!</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', fontFamily: FONT }}>{createResult.company_name}</div>
            </div>
            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 700, fontFamily: FONT, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔐</span> بيانات دخول المدير — أرسلها للعميل
              </div>
              {[
                { label: 'اسم المدير',              value: createResult.admin_name,    mono: false, secret: false },
                { label: 'اسم المستخدم',             value: createResult.username,       mono: true,  secret: false },
                { label: 'كلمة المرور المؤقتة',     value: createResult.temp_password,  mono: true,  secret: true },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #fed7aa' }}>
                  <span style={{ fontSize: '12px', color: '#92400e', fontFamily: FONT }}>{row.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {row.mono ? (
                      <code style={{ fontSize: row.secret ? '18px' : '14px', fontWeight: 800, color: row.secret ? '#ea580c' : '#1e293b', background: row.secret ? '#fff7ed' : '#f8fafc', padding: '4px 10px', borderRadius: '8px', letterSpacing: row.secret ? '2px' : '0.5px', fontFamily: 'monospace' }}>
                        {row.value}
                      </code>
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', fontFamily: FONT }}>{row.value}</span>
                    )}
                    <button onClick={() => void navigator.clipboard.writeText(row.value)} title="نسخ" style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fed7aa', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>📋</button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const text = `بيانات دخول نظام مُحكم ERP\nالشركة: ${createResult.company_name}\nاسم المستخدم: ${createResult.username}\nكلمة المرور المؤقتة: ${createResult.temp_password}\n\nيرجى تغيير كلمة المرور فور تسجيل الدخول.`;
                void navigator.clipboard.writeText(text);
                showToast('تم نسخ بيانات الدخول!');
              }}
              style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, marginBottom: '10px' }}
            >
              📋 نسخ كل بيانات الدخول
            </button>
            <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#92400e', fontFamily: FONT, lineHeight: '1.6', marginBottom: '16px' }}>
              ⚠️ احفظ كلمة المرور الآن — لن تظهر مجدداً.
            </div>
            <button onClick={() => setCreateResult(null)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              تم — إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Company: Confirm Step ── */}
      {deleteTarget && deleteStep === 'confirm' && (
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
      {deleteTarget && deleteStep === 'code' && (
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
