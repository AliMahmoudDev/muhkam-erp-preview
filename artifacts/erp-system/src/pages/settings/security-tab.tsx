import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ShieldCheck, ShieldOff, QrCode, KeyRound } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth';

export default function SecurityTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrData, setQrData] = useState<{ qr_code: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: totpStatus, refetch } = useQuery<{ totp_enabled: boolean }>({
    queryKey: ['2fa-status'],
    queryFn: () => authFetch(api('/api/auth/2fa/status')).then(r => r.json()),
  });

  const allowedRoles = ['super_admin', 'admin', 'manager'];
  const canEnable2FA = user?.role && allowedRoles.includes(user.role);

  async function handleSetup() {
    setLoading(true);
    try {
      const res = await authFetch(api('/api/auth/2fa/setup'));
      if (!res.ok) { toast({ title: 'خطأ', description: 'فشل الحصول على بيانات الإعداد', variant: 'destructive' }); return; }
      setQrData(await res.json());
    } finally { setLoading(false); }
  }

  async function handleVerify() {
    if (!verifyCode || verifyCode.length !== 6) {
      toast({ title: 'خطأ', description: 'أدخل رمز من 6 أرقام', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(api('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp_code: verifyCode }),
      });
      if (!res.ok) { toast({ title: 'خطأ', description: 'الرمز غير صحيح', variant: 'destructive' }); return; }
      toast({ title: '✅ تم تفعيل المصادقة الثنائية', description: 'حسابك محمي الآن بطبقة أمان إضافية' });
      setQrData(null);
      setVerifyCode('');
      refetch();
    } finally { setLoading(false); }
  }

  async function handleDisable() {
    if (!confirm('هل أنت متأكد من إلغاء تفعيل المصادقة الثنائية؟')) return;
    setLoading(true);
    try {
      const res = await authFetch(api('/api/auth/2fa/disable'), { method: 'POST' });
      if (!res.ok) { toast({ title: 'خطأ', description: 'فشل الإلغاء', variant: 'destructive' }); return; }
      toast({ title: 'تم إلغاء المصادقة الثنائية' });
      refetch();
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-bold text-ink">أمان الحساب</h2>
        <p className="text-sm text-ink/50 mt-1">إدارة طبقات الحماية الإضافية لحسابك</p>
      </div>

      {/* 2FA Section */}
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <div className="flex items-start gap-3">
          {totpStatus?.totp_enabled
            ? <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            : <Shield className="w-5 h-5 text-ink/40 mt-0.5 shrink-0" />
          }
          <div>
            <p className="font-semibold text-ink text-sm">المصادقة الثنائية (2FA)</p>
            <p className="text-xs text-ink/50 mt-0.5">
              {totpStatus?.totp_enabled
                ? 'مفعّلة — حسابك محمي بطبقة أمان إضافية'
                : 'غير مفعّلة — ننصح بتفعيلها لحماية حسابك'
              }
            </p>
          </div>
          <span className={`mr-auto text-xs font-bold px-2 py-1 rounded-full ${
            totpStatus?.totp_enabled
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'bg-amber-500/10 text-amber-600'
          }`}>
            {totpStatus?.totp_enabled ? 'مفعّلة' : 'معطّلة'}
          </span>
        </div>

        {!canEnable2FA && (
          <p className="text-xs text-ink/40 bg-canvas rounded-xl p-3">
            المصادقة الثنائية متاحة للمسؤولين والمديرين فقط
          </p>
        )}

        {canEnable2FA && !totpStatus?.totp_enabled && !qrData && (
          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-ink text-sm font-semibold disabled:opacity-50"
          >
            <QrCode className="w-4 h-4" />
            {loading ? 'جاري التحضير...' : 'تفعيل المصادقة الثنائية'}
          </button>
        )}

        {qrData && (
          <div className="space-y-4">
            <p className="text-sm text-ink/70">
              افتح تطبيق Google Authenticator أو أي تطبيق TOTP وامسح الكود:
            </p>
            <div className="flex justify-center bg-white rounded-2xl p-4">
              <img src={qrData.qr_code} alt="QR Code" className="w-48 h-48" />
            </div>
            <div className="bg-canvas rounded-xl p-3">
              <p className="text-xs text-ink/50 mb-1">أو أدخل المفتاح يدوياً:</p>
              <code className="text-xs font-mono text-ink break-all">{qrData.secret}</code>
            </div>
            <div className="space-y-2">
              <label className="erp-label">أدخل رمز التحقق من التطبيق</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full border border-line rounded-xl px-4 py-2.5 text-center text-xl font-mono tracking-widest bg-canvas focus:outline-none focus:border-brand"
              />
              <button
                onClick={handleVerify}
                disabled={loading || verifyCode.length !== 6}
                className="w-full py-2.5 rounded-xl bg-brand text-ink text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'جاري التحقق...' : 'تأكيد وتفعيل'}
              </button>
              <button
                onClick={() => { setQrData(null); setVerifyCode(''); }}
                className="w-full py-2 text-sm text-ink/50"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {canEnable2FA && totpStatus?.totp_enabled && (
          <button
            onClick={handleDisable}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 hover:bg-red-50"
          >
            <ShieldOff className="w-4 h-4" />
            {loading ? 'جاري الإلغاء...' : 'إلغاء تفعيل المصادقة الثنائية'}
          </button>
        )}
      </div>

      {/* Password Change hint */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-ink/40 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-ink text-sm">كلمة المرور</p>
            <p className="text-xs text-ink/50 mt-0.5">لتغيير كلمة المرور تواصل مع المسؤول العام</p>
          </div>
        </div>
      </div>
    </div>
  );
}
