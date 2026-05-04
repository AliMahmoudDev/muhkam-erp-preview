import React from 'react';
import { type BackupFile, C, FONT } from './types';
import { DarkInput } from './ui';

interface TgAlertRule { enabled: boolean; cooldownHours: number; label: string; }
interface TgConfig    { enabled: boolean; alerts: Record<string, TgAlertRule>; }
interface TgBotStatus {
  connected: boolean; token_set: boolean; chat_id_set: boolean;
  bot_username?: string; bot_name?: string; error?: string;
  token_masked: string | null; chat_id: string | null; source: 'db' | 'env' | 'none';
}
interface AuditEntry { id: number; action: string; record_type: string | null; record_id: number | null; note: string | null; username: string | null; created_at: string; }
interface AuditLogResp { count: number; rows: AuditEntry[]; }

interface Props {
  /* Active card */
  settingsActiveCard: 'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram' | null;
  setSettingsActiveCard: (v: 'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram' | null) => void;

  /* Support */
  supportWa: string;
  setSupportWa: (v: string) => void;
  supportEmail: string;
  setSupportEmail: (v: string) => void;
  settingSaving: boolean;
  saveSupportSettings: () => void;

  /* Backup */
  backupData: { backups: BackupFile[]; total: number } | undefined;
  creatingBackup: boolean;
  downloadingFile: string | null;
  restoring: boolean;
  restoreOk: string | null;
  restoreErr: string | null;
  triggerBackup: () => void;
  downloadBackup: (filename: string) => void;
  openRestorePicker: () => void;
  restoreInputRef: React.RefObject<HTMLInputElement | null>;
  handleRestoreFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  /* Restore modal */
  restoreModal: boolean;
  setRestoreModal: (v: boolean) => void;
  pendingRestoreFile: File | null;
  setPendingRestoreFile: (v: File | null) => void;
  restoreCode: string;
  setRestoreCode: (v: string) => void;
  confirmRestore: () => void;

  /* Encryption key */
  encEnabled: boolean;
  encKey: string | null;
  encKeyLoading: boolean;
  encKeyVisible: boolean;
  encKeyCopied: boolean;
  loadEncKey: () => void;
  copyEncKey: () => void;
  emailEncKey: () => void;

  /* Security / 2FA */
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

  /* Audit log */
  auditData: AuditLogResp | undefined;
  auditLoading: boolean;
  refetchAudit: () => void;
  auditAction: string;
  setAuditAction: (v: string) => void;
  auditLimit: number;
  setAuditLimit: (v: number) => void;

  /* Telegram */
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

export function TabSettings({
  settingsActiveCard, setSettingsActiveCard,
  supportWa, setSupportWa, supportEmail, setSupportEmail, settingSaving, saveSupportSettings,
  backupData, creatingBackup, downloadingFile, restoring, restoreOk, restoreErr,
  triggerBackup, downloadBackup, openRestorePicker,
  restoreInputRef, handleRestoreFileChange,
  restoreModal, setRestoreModal, pendingRestoreFile, setPendingRestoreFile,
  restoreCode, setRestoreCode, confirmRestore,
  encEnabled, encKey, encKeyLoading, encKeyVisible, encKeyCopied,
  loadEncKey, copyEncKey, emailEncKey,
  totpStatus, totpSetupData, totpInput, setTotpInput,
  disableTotpInput, setDisableTotpInput, secLoading, secMsg, setSecMsg,
  showDisable, setShowDisable, startTotpSetup, confirmTotpSetup, confirmDisableTotp,
  auditData, auditLoading, refetchAudit, auditAction, setAuditAction, auditLimit, setAuditLimit,
  tgConfig, setTgConfig, tgSaving,
  tgBotStatus, tgBotLoading, tgBotRefetch,
  tgLoading, tgError, tgErrorObj, tgRefetch,
  tgBotToken, setTgBotToken, tgChatId, setTgChatId,
  tgShowToken, setTgShowToken, tgCredSaving, saveTgCredentials,
  tgTesting, testTelegramConnection, tgTestResult,
  saveTelegramSettings,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Hidden restore file input */}
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,.json.enc"
        style={{ display: 'none' }}
        onChange={(e) => { void handleRestoreFileChange(e); }}
      />

      {/* Restore confirmation modal */}
      {restoreModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: C.card, borderRadius: '20px',
            border: '1px solid rgba(239,68,68,0.4)', padding: '28px',
            width: '100%', maxWidth: '440px', direction: 'rtl', fontFamily: FONT,
          }}>
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ color: '#EF4444', fontWeight: 800, marginBottom: '8px' }}>تأكيد الاستعادة</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>
              سيتم حذف البيانات الحالية لجميع الشركات واستبدالها بمحتوى الملف.<br />
              <strong style={{ color: '#F97316' }}>{pendingRestoreFile?.name}</strong>
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>
              اكتب <strong style={{ color: '#EF4444' }}>RESTORE</strong> للتأكيد:
            </p>
            <input
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              placeholder="RESTORE"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '14px', marginBottom: '16px',
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setRestoreModal(false); setPendingRestoreFile(null); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: FONT,
                }}
              >إلغاء</button>
              <button
                onClick={() => { void confirmRestore(); }}
                disabled={restoreCode !== 'RESTORE'}
                style={{
                  flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                  background: restoreCode === 'RESTORE' ? '#EF4444' : 'rgba(239,68,68,0.2)',
                  color: restoreCode === 'RESTORE' ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: restoreCode === 'RESTORE' ? 'pointer' : 'not-allowed',
                  fontWeight: 800, fontFamily: FONT,
                }}
              >تأكيد الاستعادة</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        {([
          { key: 'support'   as const, icon: '⚙️', label: 'معلومات التواصل', desc: 'واتساب وبريد الدعم الفني',    color: '#F97316' },
          { key: 'backup'    as const, icon: '💾', label: 'النسخ الاحتياطية', desc: 'إنشاء / استعادة / تشفير',     color: '#34D399' },
          { key: 'security'  as const, icon: '🔐', label: 'الأمان',            desc: 'المصادقة الثنائية وقيود IP', color: '#A78BFA' },
          { key: 'audit_log' as const, icon: '📋', label: 'سجل العمليات',      desc: 'مراقبة جميع إجراءات النظام', color: '#60A5FA' },
          { key: 'telegram'  as const, icon: '📨', label: 'إشعارات تليجرام',   desc: 'تحكم في التنبيهات والـ Cooldown', color: '#38BDF8' },
        ]).map(card => {
          const isActive = settingsActiveCard === card.key;
          return (
            <div
              key={card.key}
              onClick={() => setSettingsActiveCard(isActive ? null : card.key)}
              style={{
                background: isActive ? `${card.color}1A` : C.card,
                border: `1.5px solid ${isActive ? card.color : C.border}`,
                borderRadius: '16px', padding: '22px 20px',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', gap: '10px',
                boxShadow: isActive ? `0 0 0 3px ${card.color}30, 0 8px 32px ${card.color}25` : 'none',
                transform: isActive ? 'translateY(-2px)' : '',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = card.color; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 4px 20px ${card.color}20`; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '28px' }}>{card.icon}</span>
                {isActive && <span style={{ color: card.color, fontSize: '18px', fontWeight: 900 }}>✕</span>}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: isActive ? card.color : C.text }}>{card.label}</div>
              <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.5 }}>{card.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Content panel */}
      {settingsActiveCard && (
        <div style={{
          background: C.card, borderRadius: '18px',
          border: `1.5px solid ${
            settingsActiveCard === 'support' ? '#F97316' :
            settingsActiveCard === 'backup' ? '#34D399' :
            settingsActiveCard === 'security' ? '#A78BFA' :
            settingsActiveCard === 'audit_log' ? '#60A5FA' :
            settingsActiveCard === 'telegram' ? '#38BDF8' : C.border
          }50`,
          overflow: 'hidden', animation: 'sa-panel-in 0.25s ease-out both',
        }}>
          {/* Panel header */}
          {(() => {
            const CARD_COLOR: Record<string, string> = {
              support: '#F97316', backup: '#34D399', security: '#A78BFA',
              audit_log: '#60A5FA', telegram: '#38BDF8',
            };
            const hc = settingsActiveCard ? (CARD_COLOR[settingsActiveCard] ?? C.border) : C.border;
            return (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: `${hc}12`,
              }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: hc }}>
                  {settingsActiveCard === 'support'   && '⚙️ معلومات التواصل للدعم'}
                  {settingsActiveCard === 'backup'    && '💾 النسخ الاحتياطية'}
                  {settingsActiveCard === 'security'  && '🔐 الأمان'}
                  {settingsActiveCard === 'audit_log' && '📋 سجل العمليات'}
                  {settingsActiveCard === 'telegram'  && '📨 إشعارات تليجرام'}
                </h3>
                <button
                  onClick={() => setSettingsActiveCard(null)}
                  style={{
                    background: 'transparent', border: `1px solid ${hc}50`,
                    borderRadius: '8px', color: hc, fontSize: '16px',
                    cursor: 'pointer', lineHeight: 1, padding: '4px 10px', fontWeight: 700,
                  }}
                >✕</button>
              </div>
            );
          })()}

          {/* Support */}
          {settingsActiveCard === 'support' && (
            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '12px', color: C.muted, margin: '0 0 20px' }}>
                تُستخدم هذه المعلومات في صفحة انتهاء الاشتراك وفي شريط التنبيه للمستخدمين
              </p>
              <DarkInput
                label="رقم واتساب للدعم"
                value={supportWa}
                onChange={setSupportWa}
                placeholder="مثال: 966501234567"
                hint="أدخل الرقم كاملاً مع رمز الدولة بدون + أو مسافات"
              />
              <DarkInput
                label="البريد الإلكتروني للدعم"
                value={supportEmail}
                onChange={setSupportEmail}
                placeholder="support@example.com"
                type="email"
              />
              <button
                onClick={() => { void saveSupportSettings(); }}
                disabled={settingSaving}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: settingSaving ? C.border : C.orange,
                  color: '#fff', fontSize: '14px', fontWeight: 800,
                  cursor: settingSaving ? 'not-allowed' : 'pointer',
                  fontFamily: FONT, transition: 'filter 0.15s', marginTop: '4px',
                }}
              >
                {settingSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
            </div>
          )}

          {/* Backup */}
          {settingsActiveCard === 'backup' && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
              }}>
                <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>
                  النسخ التلقائي يعمل يومياً الساعة 3:00 صباحاً •{' '}
                  {backupData ? `${backupData.total} نسخة متوفرة` : 'جاري التحميل...'}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { void triggerBackup(); }}
                    disabled={creatingBackup}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 18px', borderRadius: '10px', border: 'none',
                      background: creatingBackup ? C.border : C.orange,
                      color: '#fff', fontSize: '13px', fontWeight: 800,
                      cursor: creatingBackup ? 'not-allowed' : 'pointer', fontFamily: FONT,
                    }}
                  >
                    💾 {creatingBackup ? 'جاري الإنشاء...' : 'إنشاء نسخة الآن'}
                  </button>
                  <button
                    onClick={openRestorePicker}
                    disabled={restoring}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 18px', borderRadius: '10px',
                      border: '1px solid rgba(139,92,246,0.4)',
                      background: 'rgba(139,92,246,0.1)',
                      color: '#A78BFA', fontSize: '13px', fontWeight: 800,
                      cursor: restoring ? 'not-allowed' : 'pointer', fontFamily: FONT,
                    }}
                  >
                    {restoring ? '⏳ جاري الاستعادة...' : '📥 استعادة من ملف'}
                  </button>
                </div>
              </div>
              {restoreOk && (
                <div style={{
                  padding: '14px 18px', borderRadius: '12px',
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                  color: '#22C55E', fontSize: '13px', fontWeight: 700,
                }}>✅ {restoreOk}</div>
              )}
              {restoreErr && (
                <div style={{
                  padding: '14px 18px', borderRadius: '12px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#EF4444', fontSize: '13px',
                }}>❌ {restoreErr}</div>
              )}
              <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px',
                  gap: '8px', padding: '10px 20px',
                  background: 'rgba(249,115,22,0.08)',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: '11px', fontWeight: 700, color: C.orange,
                }}>
                  <div>اسم الملف</div>
                  <div style={{ textAlign: 'center' }}>الحجم</div>
                  <div style={{ textAlign: 'center' }}>التاريخ</div>
                  <div style={{ textAlign: 'center' }}>تنزيل</div>
                </div>
                {!backupData ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>جاري التحميل...</div>
                ) : backupData.backups.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>💾</div>
                    <div>لا توجد نسخ احتياطية بعد</div>
                    <div style={{ fontSize: '12px', marginTop: '6px' }}>اضغط "إنشاء نسخة الآن" للبدء</div>
                  </div>
                ) : (
                  backupData.backups.map((b, idx) => {
                    const isEnc = b.filename.endsWith('.enc');
                    const isDownloading = downloadingFile === b.filename;
                    return (
                      <div
                        key={b.filename}
                        style={{
                          display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px',
                          gap: '8px', padding: '12px 20px', alignItems: 'center',
                          borderBottom: idx < backupData.backups.length - 1 ? `1px solid ${C.border}` : 'none',
                          background: idx % 2 === 1 ? 'rgba(15,23,42,0.4)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '14px' }}>{isEnc ? '🔒' : '📄'}</span>
                          <span style={{
                            fontSize: '12px', color: C.text, fontFamily: 'monospace',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{b.filename}</span>
                          {isEnc && (
                            <span style={{
                              fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                              background: 'rgba(139,92,246,0.2)', color: '#A78BFA',
                              border: '1px solid rgba(139,92,246,0.3)', whiteSpace: 'nowrap',
                            }}>مشفّر</span>
                          )}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted }}>{b.size_mb} MB</div>
                        <div style={{ textAlign: 'center', fontSize: '11px', color: C.muted, direction: 'ltr' }}>
                          {new Date(b.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => { void downloadBackup(b.filename); }}
                            disabled={isDownloading}
                            style={{
                              padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid rgba(34,197,94,0.3)',
                              background: 'rgba(34,197,94,0.1)',
                              color: '#22C55E', fontSize: '12px', fontWeight: 700,
                              cursor: isDownloading ? 'not-allowed' : 'pointer', fontFamily: FONT,
                            }}
                          >
                            {isDownloading ? '⏳' : '⬇️ تنزيل'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* Encryption Key */}
              <div style={{
                background: 'rgba(15,23,42,0.4)', borderRadius: '14px',
                border: `1px solid ${C.border}`, padding: '20px 24px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>
                  🔑 مفتاح تشفير النسخ
                </div>
                <div style={{ fontSize: '12px', color: C.muted, marginBottom: '14px', lineHeight: 1.6 }}>
                  {encEnabled
                    ? 'النسخ الاحتياطية مشفّرة — احتفظ بهذا المفتاح في مكان آمن.'
                    : 'التشفير غير مفعّل — عيّن متغير BACKUP_ENCRYPTION_KEY في ملف .env لتفعيله.'}
                </div>
                {encEnabled && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => void loadEncKey()}
                      disabled={encKeyLoading}
                      style={{
                        padding: '8px 16px', borderRadius: '10px',
                        border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.muted, fontSize: '13px',
                        fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                      }}
                    >
                      {encKeyLoading ? '⏳ ...' : encKeyVisible ? '🙈 إخفاء' : '👁 عرض المفتاح'}
                    </button>
                    {encKeyVisible && encKey && (
                      <>
                        <button onClick={copyEncKey} style={{
                          padding: '8px 16px', borderRadius: '10px',
                          border: '1px solid rgba(34,197,94,0.3)',
                          background: 'rgba(34,197,94,0.1)',
                          color: '#22C55E', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: FONT,
                        }}>
                          {encKeyCopied ? '✅ تم النسخ' : '📋 نسخ'}
                        </button>
                        <button onClick={emailEncKey} style={{
                          padding: '8px 16px', borderRadius: '10px',
                          border: '1px solid rgba(59,130,246,0.3)',
                          background: 'rgba(59,130,246,0.1)',
                          color: '#60A5FA', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: FONT,
                        }}>
                          📧 إرسال بالبريد
                        </button>
                      </>
                    )}
                  </div>
                )}
                {encKeyVisible && encKey && (
                  <div style={{
                    marginTop: '12px', padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}`,
                    fontSize: '12px', color: '#A78BFA', fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}>{encKey}</div>
                )}
              </div>
            </div>
          )}

          {/* Security */}
          {settingsActiveCard === 'security' && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 2FA */}
              <div style={{
                background: 'rgba(15,23,42,0.4)', borderRadius: '14px',
                border: `1px solid ${C.border}`, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '12px', flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>
                      المصادقة الثنائية (2FA)
                    </div>
                    <div style={{ fontSize: '12px', color: C.muted }}>
                      تضيف طبقة أمان إضافية — يتطلب Google Authenticator أو Authy
                    </div>
                  </div>
                  {totpStatus?.totp_enabled ? (
                    <span style={{
                      padding: '6px 14px', borderRadius: '999px',
                      background: 'rgba(34,197,94,0.15)', color: C.success,
                      fontSize: '12px', fontWeight: 700, border: '1px solid rgba(34,197,94,0.3)',
                    }}>✅ مفعلة</span>
                  ) : (
                    <span style={{
                      padding: '6px 14px', borderRadius: '999px',
                      background: 'rgba(148,163,184,0.1)', color: C.muted,
                      fontSize: '12px', fontWeight: 700, border: `1px solid ${C.border}`,
                    }}>غير مفعلة</span>
                  )}
                </div>
                <div style={{ padding: '24px' }}>
                  {secMsg && (
                    <div style={{
                      marginBottom: '16px', padding: '12px 16px', borderRadius: '10px',
                      background: secMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${secMsg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      color: secMsg.ok ? C.success : C.danger, fontSize: '13px', fontWeight: 700,
                    }}>{secMsg.text}</div>
                  )}
                  {!totpStatus?.totp_enabled && !totpSetupData && (
                    <button
                      onClick={() => { void startTotpSetup(); }}
                      disabled={secLoading}
                      style={{
                        padding: '11px 22px', borderRadius: '10px', border: 'none',
                        background: secLoading ? C.border : C.orange,
                        color: '#fff', fontSize: '14px', fontWeight: 800,
                        cursor: secLoading ? 'not-allowed' : 'pointer', fontFamily: FONT,
                      }}
                    >
                      {secLoading ? 'جاري الإعداد...' : '🔐 تفعيل المصادقة الثنائية'}
                    </button>
                  )}
                  {!totpStatus?.totp_enabled && totpSetupData && (
                    <div>
                      <p style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>
                        امسح الكود بتطبيق <strong style={{ color: C.text }}>Google Authenticator</strong> أو{' '}
                        <strong style={{ color: C.text }}>Authy</strong>، ثم أدخل الرمز:
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <img src={totpSetupData.qr_code} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: '12px', border: `2px solid ${C.border}` }} />
                      </div>
                      <div style={{ background: 'rgba(15,23,42,0.6)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '11px', color: C.muted, wordBreak: 'break-all' }}>
                        <span style={{ color: C.orange, fontWeight: 700 }}>إدخال يدوي: </span>{totpSetupData.secret}
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          value={totpInput}
                          onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="أدخل الرمز (6 أرقام)"
                          style={{
                            flex: 1, padding: '10px 14px', borderRadius: '10px',
                            border: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                            color: C.text, fontSize: '18px', letterSpacing: '6px',
                            textAlign: 'center', fontFamily: 'monospace', outline: 'none',
                          }}
                          maxLength={6}
                        />
                        <button
                          onClick={() => { void confirmTotpSetup(); }}
                          disabled={secLoading || totpInput.length !== 6}
                          style={{
                            padding: '10px 18px', borderRadius: '10px', border: 'none',
                            background: totpInput.length === 6 ? C.orange : C.border,
                            color: '#fff', fontSize: '14px', fontWeight: 800,
                            cursor: totpInput.length !== 6 ? 'not-allowed' : 'pointer', fontFamily: FONT,
                          }}
                        >{secLoading ? '...' : 'تأكيد'}</button>
                      </div>
                    </div>
                  )}
                  {totpStatus?.totp_enabled && (
                    <div>
                      {!showDisable ? (
                        <button
                          onClick={() => { setShowDisable(true); setSecMsg(null); }}
                          style={{
                            padding: '11px 22px', borderRadius: '10px',
                            border: '1px solid rgba(239,68,68,0.4)',
                            background: 'rgba(239,68,68,0.1)',
                            color: '#EF4444', fontSize: '14px', fontWeight: 800,
                            cursor: 'pointer', fontFamily: FONT,
                          }}
                        >🚫 إيقاف المصادقة الثنائية</button>
                      ) : (
                        <div>
                          <p style={{ fontSize: '13px', color: C.muted, marginBottom: '12px' }}>أدخل رمز التحقق من التطبيق للتأكيد:</p>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                              value={disableTotpInput}
                              onChange={(e) => setDisableTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6 أرقام"
                              style={{
                                flex: 1, padding: '10px 14px', borderRadius: '10px',
                                border: '1px solid rgba(239,68,68,0.4)',
                                background: 'rgba(239,68,68,0.05)',
                                color: C.text, fontSize: '18px', letterSpacing: '6px',
                                textAlign: 'center', fontFamily: 'monospace', outline: 'none',
                              }}
                              maxLength={6}
                            />
                            <button
                              onClick={() => { void confirmDisableTotp(); }}
                              disabled={secLoading || disableTotpInput.length !== 6}
                              style={{
                                padding: '10px 18px', borderRadius: '10px', border: 'none',
                                background: disableTotpInput.length === 6 ? '#EF4444' : C.border,
                                color: '#fff', fontSize: '14px', fontWeight: 800,
                                cursor: disableTotpInput.length !== 6 ? 'not-allowed' : 'pointer', fontFamily: FONT,
                              }}
                            >{secLoading ? '...' : 'إيقاف'}</button>
                            <button
                              onClick={() => { setShowDisable(false); setDisableTotpInput(''); setSecMsg(null); }}
                              style={{
                                padding: '10px 14px', borderRadius: '10px',
                                border: `1px solid ${C.border}`, background: 'transparent',
                                color: C.muted, fontSize: '14px', cursor: 'pointer', fontFamily: FONT,
                              }}
                            >إلغاء</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {/* IP Restriction */}
              <div style={{
                background: 'rgba(15,23,42,0.4)', borderRadius: '14px',
                border: `1px solid ${C.border}`, padding: '20px 24px',
              }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>
                  قيود عنوان IP
                </div>
                <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.8 }}>
                  لتقييد الوصول لعناوين IP محددة، أضف المتغير التالي في ملف{' '}
                  <code style={{ color: C.orange }}>.env</code> على السيرفر:
                  <br />
                  <code style={{ color: C.success, fontSize: '12px' }}>
                    SUPER_ADMIN_IPS=197.60.235.65,89.167.85.156
                  </code>
                  <br />
                  <span style={{ color: C.warning }}>
                    ⚠️ اتركه فارغاً للسماح لجميع الـ IPs (وضع التطوير)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Telegram */}
          {settingsActiveCard === 'telegram' && (() => {
            const TG_BLUE = '#38BDF8';
            const TG_BG   = 'rgba(56,189,248,0.07)';
            const ALERT_ICONS: Record<string, string> = {
              server_start: '🚀', server_slow: '🐢', server_high_memory: '🧠',
              db_slow: '🗄️', backup_failed: '⚠️', backup_success: '💾',
              brute_force: '🔐', subscription_expiring: '⏰', subscription_expired: '❌',
              new_company_registered: '🏢', ip_blocked: '🚫',
            };
            const ALERT_DESC: Record<string, string> = {
              server_start: 'عند بدء تشغيل الخادم',
              server_slow: 'عند تباطؤ استجابة الخادم',
              server_high_memory: 'عند ارتفاع استهلاك الذاكرة',
              db_slow: 'عند تباطؤ استعلامات قاعدة البيانات',
              backup_failed: 'عند فشل النسخ الاحتياطي',
              backup_success: 'عند اكتمال النسخ الاحتياطي بنجاح',
              brute_force: 'عند محاولات اختراق متكررة من IP',
              subscription_expiring: 'عند اقتراب انتهاء اشتراك شركة',
              subscription_expired: 'عند انتهاء اشتراك شركة',
              new_company_registered: 'عند تسجيل شركة جديدة في المنصة',
              ip_blocked: 'عند حجب عنوان IP بسبب الاختراق',
            };
            const TgToggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
              <button
                onClick={onClick}
                disabled={disabled}
                style={{
                  flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px',
                  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                  background: on ? TG_BLUE : 'rgba(148,163,184,0.2)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: '4px',
                  right: on ? '4px' : '20px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: '#fff', transition: 'right 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            );

            return (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Connection Status */}
                <div style={{
                  borderRadius: '14px',
                  border: `1.5px solid ${tgBotStatus?.connected ? 'rgba(52,211,153,0.4)' : tgBotStatus && !tgBotStatus.connected ? 'rgba(239,68,68,0.35)' : `${TG_BLUE}30`}`,
                  background: tgBotStatus?.connected ? 'rgba(52,211,153,0.07)' : tgBotStatus && !tgBotStatus.connected ? 'rgba(239,68,68,0.06)' : TG_BG,
                  padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {tgBotLoading && !tgBotStatus ? <div style={{ fontSize: '24px' }}>⏳</div>
                      : tgBotStatus?.connected ? <div style={{ fontSize: '28px' }}>✅</div>
                      : <div style={{ fontSize: '28px' }}>❌</div>}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: C.text }}>
                        {tgBotLoading && !tgBotStatus ? 'جاري التحقق من الاتصال...'
                          : tgBotStatus?.connected ? `متصل — @${tgBotStatus.bot_username ?? 'البوت'}`
                          : 'غير متصل'}
                      </div>
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                        {tgBotStatus?.connected
                          ? `اسم البوت: ${tgBotStatus.bot_name ?? '—'}  |  المصدر: ${tgBotStatus.source === 'db' ? 'قاعدة البيانات' : 'متغير البيئة'}`
                          : tgBotStatus?.error ?? 'أدخل بيانات البوت في القسم أدناه'}
                      </div>
                      {tgBotStatus?.connected && tgBotStatus.token_masked && (
                        <div style={{ fontSize: '10px', color: C.muted, marginTop: '4px', fontFamily: 'monospace' }}>
                          الرمز: {tgBotStatus.token_masked}  |  المعرّف: {tgBotStatus.chat_id}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => tgBotRefetch()}
                    style={{ padding: '7px 14px', borderRadius: '10px', border: `1px solid ${TG_BLUE}40`, background: TG_BG, color: TG_BLUE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}
                  >🔄 تحديث</button>
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
                        <input
                          type={tgShowToken ? 'text' : 'password'}
                          placeholder={tgBotStatus?.token_masked ?? '123456789:ABCDEF-ghijklmnopqrstuvwxyz...'}
                          value={tgBotToken}
                          onChange={e => setTgBotToken(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px',
                            border: `1.5px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                            color: C.text, fontSize: '13px', outline: 'none',
                            fontFamily: 'monospace', boxSizing: 'border-box',
                          }}
                        />
                        <button
                          onClick={() => setTgShowToken(v => !v)}
                          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: C.muted }}
                        >{tgShowToken ? '🙈' : '👁️'}</button>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>معرّف المحادثة</label>
                      <input
                        type="text"
                        placeholder={tgBotStatus?.chat_id ?? '-1001234567890 أو معرّف القناة'}
                        value={tgChatId}
                        onChange={e => setTgChatId(e.target.value)}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: '10px',
                          border: `1.5px solid ${C.border}`, background: 'rgba(15,23,42,0.5)',
                          color: C.text, fontSize: '13px', outline: 'none',
                          fontFamily: 'monospace', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '5px' }}>
                        📌 للحصول على المعرّف: أضف @userinfobot إلى المحادثة أو القناة
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => { void saveTgCredentials(); }}
                        disabled={tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()}
                        style={{
                          flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
                          background: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? 'rgba(148,163,184,0.12)' : TG_BLUE,
                          color: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? C.muted : '#0F172A',
                          fontSize: '13px', fontWeight: 800,
                          cursor: (tgCredSaving || !tgBotToken.trim() || !tgChatId.trim()) ? 'not-allowed' : 'pointer',
                          fontFamily: FONT, transition: 'all 0.15s',
                        }}
                      >{tgCredSaving ? '⏳ جاري الحفظ...' : '💾 حفظ بيانات البوت'}</button>
                      <button
                        onClick={() => { void testTelegramConnection(); }}
                        disabled={tgTesting || !tgBotStatus?.connected}
                        style={{
                          padding: '11px 18px', borderRadius: '10px',
                          border: `1.5px solid ${tgBotStatus?.connected ? 'rgba(52,211,153,0.45)' : C.border}`,
                          background: tgBotStatus?.connected ? 'rgba(52,211,153,0.1)' : 'transparent',
                          color: tgBotStatus?.connected ? '#34D399' : C.muted,
                          fontSize: '13px', fontWeight: 800, fontFamily: FONT,
                          cursor: (tgTesting || !tgBotStatus?.connected) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}
                      >{tgTesting ? '⏳...' : '🧪 اختبار'}</button>
                    </div>
                    {tgTestResult && (
                      <div style={{
                        padding: '10px 14px', borderRadius: '10px',
                        background: tgTestResult.ok ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${tgTestResult.ok ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        fontSize: '12px', fontWeight: 700,
                        color: tgTestResult.ok ? '#34D399' : '#EF4444',
                      }}>
                        {tgTestResult.ok ? '✅' : '❌'} {tgTestResult.msg}
                      </div>
                    )}
                  </div>
                </div>

                {/* Alert settings loading/error */}
                {tgLoading && !tgConfig && (
                  <div style={{ textAlign: 'center', padding: '24px', color: C.muted, fontSize: '13px' }}>⏳ جاري تحميل إعدادات التنبيهات...</div>
                )}
                {tgError && !tgConfig && (
                  <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '13px', color: '#EF4444' }}>❌ تعذّر تحميل إعدادات التنبيهات</div>
                    {tgErrorObj?.message && <div style={{ fontSize: '11px', color: C.muted }}>{tgErrorObj.message}</div>}
                    <button onClick={() => tgRefetch()} style={{ padding: '7px 18px', borderRadius: '10px', border: `1px solid ${TG_BLUE}40`, background: TG_BG, color: TG_BLUE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>🔄 إعادة المحاولة</button>
                  </div>
                )}

                {/* Alert rules */}
                {tgConfig && (<>
                  <div style={{
                    borderRadius: '14px', padding: '16px 20px',
                    background: tgConfig.enabled ? 'rgba(56,189,248,0.09)' : 'rgba(239,68,68,0.06)',
                    border: `1.5px solid ${tgConfig.enabled ? 'rgba(56,189,248,0.4)' : 'rgba(239,68,68,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: C.text, marginBottom: '4px' }}>
                        📨 تفعيل إشعارات تيليجرام
                      </div>
                      <div style={{ fontSize: '12px', color: C.muted }}>
                        {tgConfig.enabled ? '✅ البوت يرسل التنبيهات المفعّلة أدناه' : '⛔ جميع الإشعارات موقوفة حالياً'}
                      </div>
                    </div>
                    <TgToggle
                      on={tgConfig.enabled}
                      onClick={() => setTgConfig(c => c ? { ...c, enabled: !c.enabled } : c)}
                    />
                  </div>

                  <div style={{ borderRadius: '14px', border: `1.5px solid ${C.border}`, overflow: 'hidden', opacity: tgConfig.enabled ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, background: 'rgba(56,189,248,0.05)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: TG_BLUE }}>⚙️ إدارة التنبيهات</div>
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>فعّل أو أوقف كل نوع تنبيه بشكل مستقل</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {Object.entries(tgConfig.alerts).map(([key, rule], i, arr) => (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 18px',
                          borderBottom: i < arr.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none',
                          background: rule.enabled ? 'rgba(56,189,248,0.03)' : 'transparent',
                          transition: 'background 0.15s',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <span style={{ fontSize: '18px', flexShrink: 0 }}>{ALERT_ICONS[key] ?? '🔔'}</span>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: rule.enabled ? C.text : C.muted }}>{rule.label}</div>
                              <div style={{ fontSize: '11px', color: C.muted, marginTop: '1px' }}>{ALERT_DESC[key] ?? ''}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <select
                              value={rule.cooldownHours}
                              disabled={!tgConfig.enabled}
                              onChange={(e) => setTgConfig(c => c ? {
                                ...c, alerts: { ...c.alerts, [key]: { ...rule, cooldownHours: Number(e.target.value) } },
                              } : c)}
                              style={{
                                padding: '4px 8px', borderRadius: '8px',
                                border: `1px solid ${C.border}`, background: C.card,
                                color: C.muted, fontSize: '11px', fontFamily: FONT, cursor: 'pointer',
                              }}
                              title="مدة الانتظار قبل إعادة إرسال نفس النوع"
                            >
                              {[0, 1, 2, 4, 6, 8, 12, 24, 48].map(h => (
                                <option key={h} value={h}>{h === 0 ? 'بدون انتظار' : `${h}س`}</option>
                              ))}
                            </select>
                            <TgToggle
                              on={rule.enabled}
                              onClick={() => setTgConfig(c => c ? { ...c, alerts: { ...c.alerts, [key]: { ...rule, enabled: !rule.enabled } } } : c)}
                              disabled={!tgConfig.enabled}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => { void saveTelegramSettings(); }}
                    disabled={tgSaving}
                    style={{
                      width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                      background: tgSaving ? 'rgba(148,163,184,0.15)' : TG_BLUE,
                      color: tgSaving ? C.muted : '#0F172A',
                      fontSize: '14px', fontWeight: 900,
                      cursor: tgSaving ? 'not-allowed' : 'pointer',
                      fontFamily: FONT, transition: 'all 0.15s',
                    }}
                  >
                    {tgSaving ? '⏳ جاري الحفظ...' : '💾 حفظ إعدادات التنبيهات'}
                  </button>
                </>)}
              </div>
            );
          })()}

          {/* Audit Log */}
          {settingsActiveCard === 'audit_log' && (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: C.muted }}>كل إجراء قام به المدير العام مُسجَّل هنا</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      if (!auditData?.rows.length) return;
                      const rows = auditData.rows.map(r => `${r.action},${r.record_type},${r.record_id},${r.note ?? ''},${r.created_at}`).join('\n');
                      const blob = new Blob([`الإجراء,نوع السجل,رقم السجل,الملاحظة,التاريخ\n${rows}`], { type: 'text/csv' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = 'audit-log.csv';
                      a.click();
                    }}
                    style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#86EFAC', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
                  >📥 CSV</button>
                  <select value={auditAction} onChange={e => setAuditAction(e.target.value)} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                    <option value="">كل الإجراءات</option>
                    <option value="COMPANY_CREATED">إنشاء شركة</option>
                    <option value="COMPANY_UPDATED">تحديث شركة</option>
                    <option value="COMPANY_ACTIVATED">تفعيل شركة</option>
                    <option value="COMPANY_SUSPENDED">إيقاف شركة</option>
                    <option value="COMPANY_EXTENDED">تمديد اشتراك</option>
                    <option value="COMPANY_DELETED">حذف شركة</option>
                    <option value="COMPANY_SUBSCRIPTION_UPDATED">تحديث اشتراك</option>
                    <option value="ADMIN_PASSWORD_RESET">إعادة كلمة المرور</option>
                    <option value="MANAGER_CREATED">إنشاء مدير</option>
                    <option value="MANAGER_UPDATED">تحديث مدير</option>
                    <option value="MANAGER_TOGGLED">تغيير حالة مدير</option>
                    <option value="MANAGER_DELETED">حذف مدير</option>
                    <option value="PLAN_SETTINGS_UPDATED">تحديث إعدادات الخطة</option>
                    <option value="BACKUP_CREATED">نسخة احتياطية</option>
                    <option value="RESTORE_STARTED">استعادة</option>
                    <option value="SUPER_ADMIN_LIST_VIEW">عرض الشركات</option>
                  </select>
                  <select value={auditLimit} onChange={e => setAuditLimit(Number(e.target.value))} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
                    {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} سجل</option>)}
                  </select>
                  <button onClick={() => void refetchAudit()} style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>🔄 تحديث</button>
                </div>
              </div>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ جارٍ التحميل...</div>
              ) : (
                <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px', padding: '10px 20px', background: 'rgba(96,165,250,0.08)', borderBottom: `1px solid ${C.border}`, fontSize: '11px', fontWeight: 800, color: '#60A5FA', gap: '12px' }}>
                    <span>الإجراء</span><span>النوع</span><span>رقم</span><span>الملاحظة</span><span>التاريخ</span>
                  </div>
                  {!auditData?.rows.length ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>لا توجد سجلات</div>
                  ) : (
                    <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                      {auditData.rows.map(row => {
                        const AUD_COLORS: Record<string, { label: string; color: string }> = {
                          create: { label: 'إنشاء', color: '#34D399' },
                          update: { label: 'تعديل', color: '#60A5FA' },
                          delete: { label: 'حذف', color: '#EF4444' },
                          view: { label: 'عرض', color: '#60A5FA' },
                          login: { label: 'دخول', color: '#A78BFA' },
                          COMPANY_CREATED: { label: 'إنشاء شركة', color: '#34D399' },
                          COMPANY_UPDATED: { label: 'تحديث شركة', color: '#60A5FA' },
                          COMPANY_ACTIVATED: { label: 'تفعيل شركة', color: '#34D399' },
                          COMPANY_SUSPENDED: { label: 'إيقاف شركة', color: '#F59E0B' },
                          COMPANY_EXTENDED: { label: 'تمديد اشتراك', color: '#38BDF8' },
                          COMPANY_DELETED: { label: 'حذف شركة', color: '#EF4444' },
                          COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك', color: '#60A5FA' },
                          ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: '#A78BFA' },
                          MANAGER_CREATED: { label: 'إنشاء مدير', color: '#34D399' },
                          MANAGER_UPDATED: { label: 'تحديث مدير', color: '#60A5FA' },
                          MANAGER_TOGGLED: { label: 'تغيير حالة مدير', color: '#F59E0B' },
                          MANAGER_DELETED: { label: 'حذف مدير', color: '#EF4444' },
                          PLAN_SETTINGS_UPDATED: { label: 'تحديث إعدادات الخطة', color: '#FBBF24' },
                          TELEGRAM_SETTINGS_UPDATED: { label: 'تحديث تليجرام', color: '#38BDF8' },
                          BACKUP_CREATED: { label: 'نسخة احتياطية', color: '#34D399' },
                          RESTORE_STARTED: { label: 'بدء استعادة', color: '#A78BFA' },
                          RESTORE_COMPLETED: { label: 'اكتمال استعادة', color: '#34D399' },
                          SUPER_ADMIN_ACCESS: { label: 'وصول مدير عام', color: '#818CF8' },
                          SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
                        };
                        const REC_AR: Record<string, string> = {
                          customer: 'عميل', supplier: 'مورد', sale: 'فاتورة بيع',
                          purchase: 'فاتورة شراء', product: 'منتج / صنف',
                          expense: 'مصروف', income: 'إيراد',
                          user: 'مستخدم', erp_user: 'حساب مستخدم',
                          employee: 'موظف', company: 'شركة', subscription: 'اشتراك',
                          fiscal_year: 'سنة مالية', system: 'النظام',
                          announcement: 'إعلان',
                        };
                        const am = AUD_COLORS[row.action] ?? { label: row.action, color: '#94A3B8' };
                        return (
                          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px', padding: '11px 20px', gap: '12px', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: '12px', alignItems: 'center' }}>
                            <span style={{ color: am.color, fontWeight: 700 }}>{am.label}</span>
                            <span style={{ color: C.muted }}>{REC_AR[row.record_type ?? ''] ?? row.record_type}</span>
                            <span style={{ color: C.muted, textAlign: 'center' }}>#{row.record_id}</span>
                            <span style={{ color: C.text, fontSize: '11px', lineHeight: 1.4 }}>{row.note ?? '—'}</span>
                            <span style={{ color: C.muted, fontSize: '11px', direction: 'ltr', textAlign: 'right' }}>
                              {new Date(row.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {auditData && <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.border}`, fontSize: '12px', color: C.muted }}>إجمالي السجلات: {auditData.count}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
