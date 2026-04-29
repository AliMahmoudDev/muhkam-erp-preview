/**
 * EmployeeGateway — شاشة الترحيب التي تظهر لكل موظف عند بدء الجلسة.
 * تعرض: التحية، الوقت، حالة الحضور، وزر "دخول النظام".
 * تُخزَّن في sessionStorage حتى لا تظهر مجدداً في نفس الجلسة.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';
import { useToast } from '@/hooks/use-toast';
import {
  LogIn, LogOut, Sun, Moon, Coffee, Clock, Calendar,
  Shield, ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Fingerprint, Smartphone,
} from 'lucide-react';

type AnyRec = Record<string, unknown>;

function getOrCreateDeviceId(): string {
  const KEY = 'erp_device_fingerprint';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${navigator.userAgent.length}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function fmtTime(val: unknown): string {
  if (!val) return '—';
  const s = String(val);
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function greetingInfo(): { text: string; Icon: typeof Sun; color: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'صباح الخير', Icon: Sun, color: '#f59e0b' };
  if (h < 17) return { text: 'مساء الخير', Icon: Coffee, color: '#8b5cf6' };
  return { text: 'مساء النور', Icon: Moon, color: '#6366f1' };
}

function translateRole(role: string): string {
  const map: Record<string, string> = {
    admin: 'مدير النظام', manager: 'مشرف', cashier: 'كاشير',
    salesperson: 'مندوب مبيعات', employee: 'موظف', super_admin: 'مدير عام',
  };
  return map[role] ?? role;
}

interface Props {
  onEnter: () => void;
}

export default function EmployeeGateway({ onEnter }: Props) {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const { toast } = useToast();
  const isDark = (settings.theme ?? 'dark') === 'dark';
  const empId = user?.employee_id;
  const today = todayStr();

  /* ── Live clock ── */
  const [nowTime, setNowTime] = useState(() =>
    new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setNowTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const nowDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  /* ── Fetch today's attendance ── */
  const { data: todayRecRaw, isLoading: attendLoading, refetch: refetchToday } = useQuery<AnyRec[]>({
    queryKey: ['gateway-attendance-today', empId, today],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/attendance/records?employee_id=${empId}&from=${today}&to=${today}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* ── Fetch employee info ── */
  const { data: empRaw } = useQuery<AnyRec>({
    queryKey: ['gateway-employee', empId],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/employees/${empId}`);
      return r.ok ? r.json() : {};
    },
    enabled: !!empId,
  });

  const todayRec = Array.isArray(todayRecRaw) && todayRecRaw.length > 0
    ? (todayRecRaw[0] as AnyRec)
    : null;
  const checkedIn  = !!todayRec?.check_in_time;
  const checkedOut = !!todayRec?.check_out_time;
  const emp = (empRaw ?? {}) as AnyRec;

  /* ── Device fingerprint check ── */
  const [deviceStatus, setDeviceStatus] = useState<'checking' | 'known' | 'unknown'>('checking');
  const [deviceWarning, setDeviceWarning] = useState(false);
  useEffect(() => {
    const deviceId = getOrCreateDeviceId();
    authFetch('/api/auth/device-check', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    }).then(async r => {
      if (!r.ok) { setDeviceStatus('known'); return; }
      const data = await r.json() as { known: boolean; first_time?: boolean };
      if (data.known) {
        setDeviceStatus('known');
      } else {
        setDeviceStatus('unknown');
        setDeviceWarning(true);
      }
    }).catch(() => setDeviceStatus('known'));
  }, []);

  /* ── Check-in ── */
  const [checkingIn, setCheckingIn] = useState(false);
  const doCheckIn = useCallback(async () => {
    if (!empId || checkingIn) return;
    setCheckingIn(true);
    try {
      const r = await authFetch('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ employee_id: empId }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: 'تم تسجيل الحضور ✓', description: `حضرت الساعة ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` });
      refetchToday();
    } catch (e) {
      toast({ title: 'فشل تسجيل الحضور', description: e instanceof Error ? e.message : 'خطأ', variant: 'destructive' });
    } finally {
      setCheckingIn(false);
    }
  }, [empId, checkingIn, toast, refetchToday]);

  const { text: greeting, Icon: GreetIcon, color: greetColor } = greetingInfo();
  const logoSrc = settings.customLogo || `${import.meta.env.BASE_URL}logo.png`;

  /* ── Colors ── */
  const bg    = isDark ? '#070d1a' : '#f0f4ff';
  const card  = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const bord  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const text  = isDark ? '#f1f5f9' : '#0f172a';
  const muted = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.45)';

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed', inset: 0, background: bg, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 9999, overflow: 'auto',
        padding: '24px 16px',
      }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          background: isDark ? 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: 400, height: 400, borderRadius: '50%',
          background: isDark ? 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
        }} />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Logo + company name */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <img src={logoSrc} alt="logo" style={{ height: 48, objectFit: 'contain', marginBottom: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>

        {/* Greeting card */}
        <div style={{
          background: card, border: `1px solid ${bord}`, borderRadius: 20,
          padding: '24px 28px', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <GreetIcon style={{ width: 22, height: 22, color: greetColor }} />
            <span style={{ fontSize: 15, color: muted, fontWeight: 600 }}>{greeting}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: text, margin: 0, lineHeight: 1.3 }}>
            {user?.name}
          </h1>
          {Boolean(emp.job_title_ar || emp.department_name_ar) && (
            <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
              {String(emp.job_title_ar ?? '')} {emp.department_name_ar ? `· ${String(emp.department_name_ar)}` : ''}
            </p>
          )}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 10, padding: '4px 14px', borderRadius: 100,
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }}>
            <Shield style={{ width: 12, height: 12, color: muted }} />
            <span style={{ fontSize: 12, color: muted, fontWeight: 600 }}>{translateRole(user?.role ?? '')}</span>
          </div>
        </div>

        {/* Clock + date */}
        <div style={{
          background: card, border: `1px solid ${bord}`, borderRadius: 16,
          padding: '18px 24px', textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
            <Clock style={{ width: 16, height: 16, color: muted }} />
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: text, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>
            {nowTime}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
            <Calendar style={{ width: 13, height: 13, color: muted }} />
            <span style={{ fontSize: 13, color: muted }}>{nowDate}</span>
          </div>
        </div>

        {/* Attendance status */}
        {empId && (
          <div style={{
            background: card, border: `1px solid ${bord}`, borderRadius: 16, padding: '18px 24px',
          }}>
            <p style={{ fontSize: 12, color: muted, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>حالة الحضور اليوم</p>
            {attendLoading ? (
              <div style={{ textAlign: 'center', color: muted }}>
                <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite', display: 'inline-block' }} />
              </div>
            ) : !checkedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
                  <AlertCircle style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>لم تسجّل حضورك بعد</span>
                </div>
                <button
                  onClick={doCheckIn}
                  disabled={checkingIn}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                    borderRadius: 12, border: 'none', cursor: checkingIn ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    opacity: checkingIn ? 0.6 : 1,
                  }}
                >
                  {checkingIn ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <LogIn style={{ width: 16, height: 16 }} />}
                  سجّل حضورك الآن
                </button>
              </div>
            ) : !checkedOut ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#34d399' }}>
                <CheckCircle2 style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  سجّلت حضورك الساعة {fmtTime(todayRec!.check_in_time)}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#818cf8' }}>
                <LogOut style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  انصرفت الساعة {fmtTime(todayRec!.check_out_time)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Unknown device warning */}
        {deviceWarning && (
          <div style={{
            background: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: 14, padding: '14px 18px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Smartphone style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>تنبيه: جهاز غير معروف</p>
              <p style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>
                هذا الجهاز مختلف عن جهازك المعتاد. تم إرسال إشعار للمدير.
              </p>
            </div>
          </div>
        )}

        {/* Device check status */}
        {deviceStatus === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: muted, fontSize: 12 }}>
            <Fingerprint style={{ width: 14, height: 14 }} />
            <span>جارٍ التحقق من هوية الجهاز...</span>
          </div>
        )}
        {deviceStatus === 'known' && !deviceWarning && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#34d399', fontSize: 12 }}>
            <Fingerprint style={{ width: 14, height: 14 }} />
            <span>جهاز موثوق ✓</span>
          </div>
        )}

        {/* Enter system button */}
        <button
          onClick={onEnter}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '16px 32px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff', fontSize: 16, fontWeight: 800,
            boxShadow: '0 8px 32px rgba(99,102,241,0.35)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.45)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.35)'; }}
        >
          <span>دخول النظام</span>
          <ArrowLeft style={{ width: 20, height: 20 }} />
        </button>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: muted, marginTop: -8 }}>
          مرحباً بك في نظام محكم ERP
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
