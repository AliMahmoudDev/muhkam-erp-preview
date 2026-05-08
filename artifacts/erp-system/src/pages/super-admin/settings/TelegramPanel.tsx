import React from 'react';
import { C, FONT } from '../types';

interface TgAlertRule { enabled: boolean; cooldownHours: number; label: string; }
interface TgConfig    { enabled: boolean; alerts: Record<string, TgAlertRule>; }
interface TgBotStatus {
  connected: boolean; token_set: boolean; chat_id_set: boolean;
  bot_username?: string; bot_name?: string; error?: string;
  token_masked: string | null; chat_id: string | null; source: 'db' | 'env' | 'none';
}

interface Props {
  tgConfig: TgConfig | null;
  setTgConfig: (fn: (c: TgConfig | null) => TgConfig | null) => void;
  tgSaving: boolean;
  tgBotStatus: TgBotStatus | null;
  tgBotLoading: boolean;
  tgBotRefetch: () => void;
  tgLoading: boolean;
  tgError: boolean;
  tgErrorObj: Error | null;
  tgRefetch: () => void;
  tgBotToken: string;
  setTgBotToken: (v: string) => void;
  tgChatId: string;
  setTgChatId: (v: string) => void;
  tgShowToken: boolean;
  setTgShowToken: (fn: (v: boolean) => boolean) => void;
  tgCredSaving: boolean;
  saveTgCredentials: () => void;
  tgTesting: boolean;
  testTelegramConnection: () => void;
  tgTestResult: { ok: boolean; msg: string } | null;
  saveTelegramSettings: () => void;
}

const TG_BLUE = '#38BDF8';
const TG_BG   = 'rgba(56,189,248,0.07)';

const ALERT_ICONS: Record<string, string> = {
  server_start: '🚀', server_slow: '🐢', server_high_memory: '🧠',
  db_slow: '🗄️', backup_failed: '⚠️', backup_success: '💾',
  brute_force: '🔐', subscription_expiring: '⏰', subscription_expired: '❌',
  new_company_registered: '🏢', ip_blocked: '🚫',
};
const ALERT_DESC: Record<string, string> = {
  server_start: 'عند بدء تشغيل الخادم', server_slow: 'عند تباطؤ استجابة الخادم',
  server_high_memory: 'عند ارتفاع استهلاك الذاكرة', db_slow: 'عند تباطؤ استعلامات قاعدة البيانات',
  backup_failed: 'عند فشل النسخ الاحتياطي', backup_success: 'عند اكتمال النسخ الاحتياطي بنجاح',
  brute_force: 'عند محاولات اختراق متكررة من IP',
  subscription_expiring: 'عند اقتراب انتهاء اشتراك شركة', subscription_expired: 'عند انتهاء اشتراك شركة',
  new_company_registered: 'عند تسجيل شركة جديدة في المنصة', ip_blocked: 'عند حجب عنوان IP بسبب الاختراق',
};

function TgToggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: on ? TG_BLUE : 'rgba(148,163,184,0.2)', position: 'relative', transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: '4px', right: on ? '4px' : '20px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'right 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  );
}

export function TelegramPanel({
  tgConfig, setTgConfig, tgSaving,
  tgBotStatus, tgBotLoading, tgBotRefetch,
  tgLoading, tgError, tgRefetch,
  tgBotToken, setTgBotToken, tgChatId, setTgChatId,
  tgShowToken, setTgShowToken, tgCredSaving, saveTgCredentials,
  tgTesting, testTelegramConnection, tgTestResult,
  saveTelegramSettings,
}: Props) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Connection Status */}
      <div style={{ borderRadius: '14px', border: `1.5px solid ${tgBotStatus?.connected ? 'rgba(52,211,153,0.4)' : tgBotStatus && !tgBotStatus.connected ? 'rgba(239,68,68,0.35)' : `${TG_BLUE}30`}`, background: tgBotStatus?.connected ? 'rgba(52,211,153,0.07)' : tgBotStatus && !tgBotStatus.connected ? 'rgba(239,68,68,0.06)' : TG_BG, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {tgBotLoading && !tgBotStatus ? <div style={{ fontSize: '24px' }}>⏳</div> : tgBotStatus?.connected ? <div style={{ fontSize: '28px' }}>✅</div> : <div style={{ fontSize: '28px' }}>❌</div>}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: C.text }}>
              {tgBotLoading && !tgBotStatus ? 'جاري التحقق من الاتصال...' : tgBotStatus?.connected ? `متصل — @${tgBotStatus.bot_username ?? 'البوت'}` : 'غير متصل'}
            </div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
              {tgBotStatus?.connected ? `اسم البوت: ${tgBotStatus.bot_name ?? '—'}  |  المصدر: ${tgBotStatus.source === 'db' ? 'قاعدة البيانات' : 'متغير البيئة'}` : tgBotStatus?.error ?? 'أدخل بيانات البوت في القسم أدناه'}
            </div>
            {tgBotStatus?.connected && tgBotStatus.token_masked && (
              <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', fontFamily: 'monospace' }}>الرمز: {tgBotStatus.token_masked}  |  المعرّف: {tgBotStatus.chat_id}</div>
            )}
          </div>
        </div>
        <button onClick={() => tgBotRefetch()} style={{ padding: '7px 14px', borderRadius: '10px', border: `1px solid ${TG_BLUE}40`, background: TG_BG, color: TG_BLUE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>🔄 تحديث</button>
      </div>

      {/* Bot Credentials */}
      <div style={{ borderRadius: '14px', border: `1.5px solid ${C.border}`, background: C.card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: C.text }}>بيانات البوت</div>
            <div style={{ fontSize: '11px', color: C.muted }}>أنشئ بوتاً عبر @BotFather في تيليجرام واحفظ بياناته هنا</div>
          </div>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>رمز البوت</label>
            <div style={{ position: 'relative' }}>
              <input type={tgShowToken ? 'text' : 'password'} placeholder={tgBotStatus?.token_masked ?? '123456789:ABCDEF-ghijklmnopqrstuvwxyz...'}
                value={tgBotToken} onChange={e => setTgBotToken(e.target.value)}
                style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: 'rgba(15,23,42,0.5)', color: C.text, fontSize: '13px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
              <button onClick={() => setTgShowToken(v => !v)} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: C.muted }}>
                {tgShowToken ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>معرّف المحادثة</label>
            <input type="text" placeholder={tgBotStatus?.chat_id ?? '-1001234567890 أو معرّف القناة'} value={tgChatId} onChange={e => setTgChatId(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: 'rgba(15,23,42,0.5)', color: C.text, fontSize: '13px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '5px' }}>📌 للحصول على المعرّف: أضف @userinfobot إلى المحادثة أو القناة</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { void saveTgCredentials(); }} disabled={tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? 'rgba(148,163,184,0.12)' : TG_BLUE, color: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? C.muted : '#0F172A', fontSize: '13px', fontWeight: 800, cursor: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
              {tgCredSaving ? '⏳ جاري الحفظ...' : '💾 حفظ بيانات البوت'}
            </button>
            <button onClick={() => { void testTelegramConnection(); }} disabled={tgTesting || !tgBotStatus?.connected}
              style={{ padding: '11px 18px', borderRadius: '10px', border: `1.5px solid ${tgBotStatus?.connected ? 'rgba(52,211,153,0.45)' : C.border}`, background: tgBotStatus?.connected ? 'rgba(52,211,153,0.1)' : 'transparent', color: tgBotStatus?.connected ? '#34D399' : C.muted, fontSize: '13px', fontWeight: 800, fontFamily: FONT, cursor: (tgTesting || !tgBotStatus?.connected) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {tgTesting ? '⏳...' : '🧪 اختبار'}
            </button>
          </div>
          {tgTestResult && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: tgTestResult.ok ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tgTestResult.ok ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: '12px', fontWeight: 700, color: tgTestResult.ok ? '#34D399' : '#EF4444' }}>
              {tgTestResult.ok ? '✅' : '❌'} {tgTestResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Alert Settings */}
      {tgLoading && !tgConfig && <div style={{ textAlign: 'center', padding: '24px', color: C.muted, fontSize: '13px' }}>⏳ جاري تحميل إعدادات التنبيهات...</div>}
      {tgError && !tgConfig && (
        <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: '#EF4444' }}>❌ تعذّر تحميل إعدادات التنبيهات</div>
          <button onClick={() => void tgRefetch()} style={{ padding: '8px 18px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>إعادة المحاولة</button>
        </div>
      )}
      {tgConfig && (
        <div style={{ borderRadius: '14px', border: `1.5px solid ${C.border}`, background: C.card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: C.text }}>التنبيهات</div>
                <div style={{ fontSize: '11px', color: C.muted }}>تحكم في أنواع التنبيهات وفترة الانتظار بين كل تنبيه</div>
              </div>
            </div>
            <TgToggle on={tgConfig.enabled} onClick={() => setTgConfig(c => c ? { ...c, enabled: !c.enabled } : c)} />
          </div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(tgConfig.alerts).map(([key, rule]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '10px', background: rule.enabled ? `${TG_BLUE}08` : 'transparent', border: `1px solid ${rule.enabled ? `${TG_BLUE}25` : 'transparent'}`, transition: 'all 0.15s', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{ALERT_ICONS[key] ?? '📢'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: rule.enabled ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.label}</div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{ALERT_DESC[key] ?? ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>كل</span>
                    <input type="number" min={0} max={168} value={rule.cooldownHours} disabled={!rule.enabled}
                      onChange={e => setTgConfig(c => { if (!c) return c; return { ...c, alerts: { ...c.alerts, [key]: { ...rule, cooldownHours: Math.max(0, Math.min(168, Number(e.target.value))) } } }; })}
                      style={{ width: '54px', padding: '4px 8px', borderRadius: '8px', border: `1px solid ${rule.enabled ? `${TG_BLUE}40` : C.border}`, background: rule.enabled ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.2)', color: rule.enabled ? C.text : C.muted, fontSize: '13px', outline: 'none', textAlign: 'center', fontFamily: 'monospace' }} />
                    <span style={{ fontSize: '11px', color: C.muted }}>س</span>
                  </div>
                  <TgToggle on={rule.enabled} onClick={() => setTgConfig(c => { if (!c) return c; return { ...c, alerts: { ...c.alerts, [key]: { ...rule, enabled: !rule.enabled } } }; })} disabled={!tgConfig.enabled} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => { void saveTelegramSettings(); }} disabled={tgSaving}
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: tgSaving ? C.border : TG_BLUE, color: tgSaving ? C.muted : '#0F172A', fontSize: '13px', fontWeight: 800, cursor: tgSaving ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
              {tgSaving ? '⏳ جاري الحفظ...' : '💾 حفظ إعدادات التنبيهات'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
