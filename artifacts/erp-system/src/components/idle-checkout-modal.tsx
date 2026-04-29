/**
 * IdleCheckoutModal — يظهر بعد ساعة خمول.
 * يمنح الموظف 5 دقائق للرد، ثم يُسجّل انصرافه تلقائياً ويخرجه من النظام.
 */
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface Props {
  employeeId: number | null | undefined;
  todayRecordId: number | null | undefined;
  alreadyCheckedOut: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

const COUNTDOWN_SECS = 5 * 60; // 5 دقائق

export default function IdleCheckoutModal({
  employeeId: _employeeId,
  todayRecordId,
  alreadyCheckedOut,
  onStayLoggedIn,
  onLogout,
}: Props) {
  const [secs, setSecs] = useState(COUNTDOWN_SECS);
  const [autoingOut, setAutoingOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* countdown */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  /* auto checkout when countdown hits 0 */
  useEffect(() => {
    if (secs > 0 || autoingOut) return;
    setAutoingOut(true);
    (async () => {
      if (!alreadyCheckedOut && todayRecordId) {
        await authFetch('/api/attendance/check-out', {
          method: 'POST',
          body: JSON.stringify({
            record_id: todayRecordId,
            notes: 'تسجيل انصراف تلقائي — ترك الموظف الحساب مفتوحاً دون تسجيل انصراف',
          }),
        }).catch(() => null);
      }
      onLogout();
    })();
  }, [secs, autoingOut, alreadyCheckedOut, todayRecordId, onLogout]);

  const mins = Math.floor(secs / 60);
  const ss   = secs % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, direction: 'rtl', padding: 24,
      }}
    >
      <div style={{
        background: '#0f1729', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 24, padding: '36px 40px', maxWidth: 420, width: '100%',
        textAlign: 'center', boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Clock style={{ width: 32, height: 32, color: '#f59e0b' }} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
          انتبه! لا يوجد نشاط منذ ساعة
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', margin: '0 0 24px', lineHeight: 1.6 }}>
          سيتم تسجيل انصرافك تلقائياً وتسجيل الخروج خلال:
        </p>

        {/* Countdown */}
        <div style={{
          fontSize: 48, fontWeight: 900, color: secs <= 60 ? '#ef4444' : '#f59e0b',
          fontVariantNumeric: 'tabular-nums', marginBottom: 28,
          transition: 'color 0.5s',
        }}>
          {timeStr}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={onStayLoggedIn}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff', fontSize: 15, fontWeight: 700,
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            أنا لا أزال أعمل — ابقَ متصلاً
          </button>
          <button
            onClick={async () => {
              if (!alreadyCheckedOut && todayRecordId) {
                await authFetch('/api/attendance/check-out', {
                  method: 'POST',
                  body: JSON.stringify({ record_id: todayRecordId }),
                }).catch(() => null);
              }
              onLogout();
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '13px 24px', borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.30)', cursor: 'pointer',
              background: 'rgba(239,68,68,0.08)',
              color: '#ef4444', fontSize: 14, fontWeight: 600,
            }}
          >
            <LogOut style={{ width: 15, height: 15 }} />
            سجّل انصرافي واخرج الآن
          </button>
        </div>
      </div>
    </div>
  );
}
