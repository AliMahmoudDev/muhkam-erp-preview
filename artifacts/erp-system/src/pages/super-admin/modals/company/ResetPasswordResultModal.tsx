import { type ResetPassResult, FONT } from '../../types';

interface Props {
  resetPassResult: ResetPassResult | null;
  setResetPassResult: (v: ResetPassResult | null) => void;
  resetPassCopied: boolean;
  setResetPassCopied: (v: boolean) => void;
}

/* Presentational — admin password-reset result (display only) */
export function ResetPasswordResultModal({ resetPassResult, setResetPassResult, resetPassCopied, setResetPassCopied }: Props) {
  if (!resetPassResult) return null;
  return (
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
  );
}
