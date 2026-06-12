import React from 'react';
import { C, FONT } from '../types';

interface Props {
  totpStatus: { totp_enabled: boolean } | undefined;
  totpSetupData: { qr_code: string; secret: string } | null;
  totpInput: string;
  setTotpInput: (v: string) => void;
  disableTotpInput: string;
  setDisableTotpInput: (v: string) => void;
  secLoading: boolean;
  secMsg: { text: string; ok: boolean } | null;
  setSecMsg: (v: { text: string; ok: boolean } | null) => void;
  showDisable: boolean;
  setShowDisable: (v: boolean) => void;
  startTotpSetup: () => void;
  confirmTotpSetup: () => void;
  confirmDisableTotp: () => void;
}

export function SecurityPanel({
  totpStatus, totpSetupData, totpInput, setTotpInput,
  disableTotpInput, setDisableTotpInput, secLoading, secMsg, setSecMsg,
  showDisable, setShowDisable, startTotpSetup, confirmTotpSetup, confirmDisableTotp,
}: Props) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 2FA */}
      <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>المصادقة الثنائية (2FA)</div>
            <div style={{ fontSize: '12px', color: C.muted }}>تضيف طبقة أمان إضافية — يتطلب Google Authenticator أو Authy</div>
          </div>
          {totpStatus?.totp_enabled ? (
            <span style={{ padding: '6px 14px', borderRadius: '999px', background: 'rgba(34,197,94,0.15)', color: C.success, fontSize: '12px', fontWeight: 700, border: '1px solid rgba(34,197,94,0.3)' }}>✅ مفعلة</span>
          ) : (
            <span style={{ padding: '6px 14px', borderRadius: '999px', background: 'rgba(148,163,184,0.1)', color: C.muted, fontSize: '12px', fontWeight: 700, border: `1px solid ${C.border}` }}>غير مفعلة</span>
          )}
        </div>
        <div style={{ padding: '24px' }}>
          {secMsg && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: secMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${secMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: secMsg.ok ? C.success : C.danger, fontSize: '13px', fontWeight: 700 }}>{secMsg.text}</div>
          )}
          {!totpStatus?.totp_enabled && !totpSetupData && (
            <button onClick={() => { void startTotpSetup(); }} disabled={secLoading} style={{ padding: '11px 22px', borderRadius: '10px', border: 'none', background: secLoading ? C.border : C.orange, color: 'var(--text-1)', fontSize: '14px', fontWeight: 800, cursor: secLoading ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
              {secLoading ? 'جاري الإعداد...' : '🔐 تفعيل المصادقة الثنائية'}
            </button>
          )}
          {!totpStatus?.totp_enabled && totpSetupData && (
            <div>
              <p style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>امسح الكود بتطبيق <strong style={{ color: C.text }}>Google Authenticator</strong> أو <strong style={{ color: C.text }}>Authy</strong>، ثم أدخل الرمز:</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <img src={totpSetupData.qr_code} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: '12px', border: `2px solid ${C.border}` }} />
              </div>
              <div style={{ background: 'rgba(15,23,42,0.6)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '11px', color: C.muted, wordBreak: 'break-all' }}>
                <span style={{ color: C.orange, fontWeight: 700 }}>إدخال يدوي: </span>{totpSetupData.secret}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input value={totpInput} onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="أدخل الرمز (6 أرقام)"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.5)', color: C.text, fontSize: '18px', letterSpacing: '6px', textAlign: 'center', fontFamily: 'monospace', outline: 'none' }} maxLength={6} />
                <button onClick={() => { void confirmTotpSetup(); }} disabled={secLoading || totpInput.length !== 6}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: totpInput.length === 6 ? C.orange : C.border, color: 'var(--text-1)', fontSize: '14px', fontWeight: 800, cursor: totpInput.length !== 6 ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
                  {secLoading ? '...' : 'تأكيد'}
                </button>
              </div>
            </div>
          )}
          {totpStatus?.totp_enabled && (
            <div>
              {!showDisable ? (
                <button onClick={() => { setShowDisable(true); setSecMsg(null); }}
                  style={{ padding: '11px 22px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: 'var(--status-danger)', fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>
                  🚫 إيقاف المصادقة الثنائية
                </button>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: C.muted, marginBottom: '12px' }}>أدخل رمز التحقق من التطبيق للتأكيد:</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input value={disableTotpInput} onChange={(e) => setDisableTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 أرقام"
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)', color: C.text, fontSize: '18px', letterSpacing: '6px', textAlign: 'center', fontFamily: 'monospace', outline: 'none' }} maxLength={6} />
                    <button onClick={() => { void confirmDisableTotp(); }} disabled={secLoading || disableTotpInput.length !== 6}
                      style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: disableTotpInput.length === 6 ? 'var(--status-danger)' : C.border, color: 'var(--text-1)', fontSize: '14px', fontWeight: 800, cursor: disableTotpInput.length !== 6 ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
                      {secLoading ? '...' : 'إيقاف'}
                    </button>
                    <button onClick={() => { setShowDisable(false); setDisableTotpInput(''); setSecMsg(null); }}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '14px', cursor: 'pointer', fontFamily: FONT }}>إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* IP Restriction */}
      <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: `1px solid ${C.border}`, padding: '20px 24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>قيود عنوان IP</div>
        <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.8 }}>
          لتقييد الوصول لعناوين IP محددة، أضف المتغير التالي في ملف <code style={{ color: C.orange }}>.env</code> على السيرفر:<br />
          <code style={{ color: C.success, fontSize: '12px' }}>SUPER_ADMIN_IPS=197.60.235.65,89.167.85.156</code><br />
          <span style={{ color: C.warning }}>⚠️ اتركه فارغاً للسماح لجميع الـ IPs (وضع التطوير)</span>
        </div>
      </div>
    </div>
  );
}
