/**
 * LogoutCheckoutModal — يظهر عند النقر على زر الخروج.
 * يتيح للموظف تسجيل الانصراف قبل الخروج، أو البقاء، أو الخروج بدون انصراف.
 */
import { useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { LogOut, LogIn, X, Loader2 } from 'lucide-react';

interface Props {
  employeeId: number | null | undefined;
  todayRecordId: number | null | undefined;
  alreadyCheckedIn: boolean;
  alreadyCheckedOut: boolean;
  onLogout: () => void;
  onCancel: () => void;
}

export default function LogoutCheckoutModal({
  employeeId,
  todayRecordId,
  alreadyCheckedIn,
  alreadyCheckedOut,
  onLogout,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);

  const needsCheckout = alreadyCheckedIn && !alreadyCheckedOut;

  const doCheckoutAndLogout = async () => {
    if (!todayRecordId) { onLogout(); return; }
    setLoading(true);
    try {
      await authFetch('/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ record_id: todayRecordId }),
      });
    } catch {
      // continue even if checkout fails
    } finally {
      setLoading(false);
      onLogout();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99998, direction: 'rtl', padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: '#0f1729', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 24, padding: '32px 36px', maxWidth: 400, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LogOut style={{ width: 18, height: 18, color: '#ef4444' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
              تسجيل الخروج
            </h2>
          </div>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.40)', cursor: 'pointer', padding: 4 }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {needsCheckout ? (
          <>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
              لم تُسجّل انصرافك بعد. هل تريد تسجيل الانصراف قبل الخروج من النظام؟
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={doCheckoutAndLogout}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <LogIn style={{ width: 15, height: 15 }} />}
                سجّل الانصراف واخرج
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: '12px 20px', borderRadius: 12,
                  border: '1px solid rgba(99,102,241,0.30)', cursor: 'pointer',
                  background: 'rgba(99,102,241,0.08)',
                  color: '#818cf8', fontSize: 14, fontWeight: 600,
                }}
              >
                لا أزال في العمل — ابقَ متصلاً
              </button>
              <button
                onClick={onLogout}
                style={{
                  padding: '10px 20px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.35)', fontSize: 13,
                }}
              >
                خروج بدون تسجيل انصراف
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
              هل أنت متأكد من تسجيل الخروج من النظام؟
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onLogout}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)',
                  color: '#ef4444', fontSize: 14, fontWeight: 700,
                }}
              >
                <LogOut style={{ width: 15, height: 15 }} />
                تأكيد الخروج
              </button>
              <button
                onClick={onCancel}
                style={{
                  flex: 1, padding: '12px 20px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.60)', fontSize: 14, fontWeight: 600,
                }}
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
