import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { authFetch } from '@/lib/auth-fetch';
import { LogOut, RefreshCw, Phone, Mail, Clock } from 'lucide-react';
import { api } from '@/lib/api';

const FONT = "'Cairo', 'Tajawal', sans-serif";

interface SubInfo {
  company_name?: string;
  end_date?: string;
  plan_type?: string;
}

interface SupportInfo {
  support_whatsapp?: string;
  support_email?: string;
}

function planLabel(p?: string) {
  if (p === 'trial') return 'تجريبية';
  if (p === 'paid') return 'مدفوعة';
  return p ?? '—';
}

/** Formats a date string as Arabic long date (day/month/year) without time — used for subscription expiry display. */
function formatExpiryDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function SubscriptionExpired() {
  const { logout, user } = useAuth();
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [support, setSupport] = useState<SupportInfo>({});

  useEffect(() => {
    authFetch(api('/api/auth/subscription'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SubInfo | null) => {
        if (d) setSub(d);
      })
      .catch(() => {});

    authFetch(api('/api/settings/system'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, string> | null) => {
        if (d)
          setSupport({
            support_whatsapp: d['support_whatsapp'],
            support_email: d['support_email'],
          });
      })
      .catch(() => {});
  }, []);

  const companyName = sub?.company_name ?? user?.name ?? 'شركتكم';
  const waLink = support.support_whatsapp
    ? `https://wa.me/${support.support_whatsapp.replace(/\D/g, '')}`
    : null;

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'rgba(249,115,22,0.12)',
            border: '2px solid rgba(249,115,22,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Clock size={40} color="rgba(249,115,22,0.85)" />
        </div>

        {/* Headline */}
        <div>
          <h1
            style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-1)', margin: '0 0 8px' }}
          >
            انتهت صلاحية الاشتراك
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>
            انتهت صلاحية اشتراك{' '}
            <strong style={{ color: 'var(--status-warning)' }}>{companyName}</strong>
            {sub?.end_date && (
              <>
                {' '}
                في{' '}
                <strong style={{ color: 'var(--text-2)' }}>{formatExpiryDate(sub.end_date)}</strong>
              </>
            )}
            {sub?.plan_type && <> (خطة {planLabel(sub.plan_type)})</>}.
            <br />
            يرجى التواصل معنا لتجديد الاشتراك والاستمرار في استخدام النظام.
          </p>
        </div>

        {/* Contact box */}
        <div
          style={{
            width: '100%',
            borderRadius: '16px',
            background: 'rgba(249,115,22,0.07)',
            border: '1.5px solid rgba(249,115,22,0.25)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <p
            style={{ fontSize: '13px', fontWeight: 700, color: 'var(--status-warning)', margin: 0 }}
          >
            للتجديد تواصل معنا
          </p>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '10px', -- WhatsApp brand green: intentional third-party brand color
                background: '#25D366',
                color: 'var(--text-1)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              <Phone size={16} />
              واتساب: {support.support_whatsapp}
            </a>
          )}

          {support.support_email && (
            <a
              href={`mailto:${support.support_email}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '10px',
                background: 'rgba(148,163,184,0.12)',
                border: '1px solid rgba(148,163,184,0.2)',
                color: 'var(--text-2)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <Mail size={16} />
              {support.support_email}
            </a>
          )}

          {!waLink && !support.support_email && (
            <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: 0 }}>
              بعد تجديد الاشتراك، أعد تسجيل الدخول للمتابعة
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1.5px solid #334155',
              color: 'var(--text-2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            <RefreshCw size={16} />
            إعادة المحاولة
          </button>
          <button
            onClick={logout}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--status-danger)',
              border: 'none',
              color: 'var(--text-1)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}
