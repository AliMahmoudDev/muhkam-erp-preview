import { type CreateResult, FONT } from '../../types';

interface Props {
  createResult: CreateResult | null;
  setCreateResult: (v: CreateResult | null) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

/* Presentational — created-company credentials result (display only) */
export function CreateCompanyResultModal({ createResult, setCreateResult, showToast }: Props) {
  if (!createResult) return null;
  return (
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
  );
}
