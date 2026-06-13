import React from 'react';
import { type BackupFile, C, FONT } from './types';
import { SupportPanel } from './settings/SupportPanel';
import { BackupPanel } from './settings/BackupPanel';
import { SecurityPanel } from './settings/SecurityPanel';
import { AuditLogPanel } from './settings/AuditLogPanel';
import { TelegramPanel } from './settings/TelegramPanel';

interface TgAlertRule {
  enabled: boolean;
  cooldownHours: number;
  label: string;
}
interface TgConfig {
  enabled: boolean;
  alerts: Record<string, TgAlertRule>;
}
interface TgBotStatus {
  connected: boolean;
  token_set: boolean;
  chat_id_set: boolean;
  bot_username?: string;
  bot_name?: string;
  error?: string;
  token_masked: string | null;
  chat_id: string | null;
  source: 'db' | 'env' | 'none';
}
interface AuditEntry {
  id: number;
  action: string;
  record_type: string | null;
  record_id: number | null;
  note: string | null;
  username: string | null;
  created_at: string;
}
interface AuditLogResp {
  count: number;
  rows: AuditEntry[];
}

interface Props {
  settingsActiveCard:
    | 'support'
    | 'backup'
    | 'security'
    | 'audit_log'
    | 'managers'
    | 'plans'
    | 'telegram'
    | null;
  setSettingsActiveCard: (
    v: 'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram' | null
  ) => void;
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
  downloadEncKey: () => void;
  emailEncKey: () => void;
  /* Security */
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
  settingsActiveCard,
  setSettingsActiveCard,
  supportWa,
  setSupportWa,
  supportEmail,
  setSupportEmail,
  settingSaving,
  saveSupportSettings,
  backupData,
  creatingBackup,
  downloadingFile,
  restoring,
  restoreOk,
  restoreErr,
  triggerBackup,
  downloadBackup,
  openRestorePicker,
  restoreInputRef,
  handleRestoreFileChange,
  restoreModal,
  setRestoreModal,
  pendingRestoreFile,
  setPendingRestoreFile,
  restoreCode,
  setRestoreCode,
  confirmRestore,
  encEnabled,
  encKey,
  encKeyLoading,
  encKeyVisible,
  encKeyCopied,
  loadEncKey,
  copyEncKey,
  downloadEncKey,
  emailEncKey,
  totpStatus,
  totpSetupData,
  totpInput,
  setTotpInput,
  disableTotpInput,
  setDisableTotpInput,
  secLoading,
  secMsg,
  setSecMsg,
  showDisable,
  setShowDisable,
  startTotpSetup,
  confirmTotpSetup,
  confirmDisableTotp,
  auditData,
  auditLoading,
  refetchAudit,
  auditAction,
  setAuditAction,
  auditLimit,
  setAuditLimit,
  tgConfig,
  setTgConfig,
  tgSaving,
  tgBotStatus,
  tgBotLoading,
  tgBotRefetch,
  tgLoading,
  tgError,
  tgErrorObj,
  tgRefetch,
  tgBotToken,
  setTgBotToken,
  tgChatId,
  setTgChatId,
  tgShowToken,
  setTgShowToken,
  tgCredSaving,
  saveTgCredentials,
  tgTesting,
  testTelegramConnection,
  tgTestResult,
  saveTelegramSettings,
}: Props) {
  const CARD_COLOR: Record<string, string> = {
    support: 'var(--status-warning)',
    backup: 'var(--status-success)',
    security: 'var(--status-info)',
    audit_log: 'var(--status-info)',
    telegram: '#38BDF8',
  };
  const hc = settingsActiveCard ? (CARD_COLOR[settingsActiveCard] ?? C.border) : C.border;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hidden restore file input */}
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,.json.enc"
        style={{ display: 'none' }}
        onChange={(e) => {
          void handleRestoreFileChange(e);
        }}
      />

      {/* Restore modal */}
      {restoreModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: C.card,
              borderRadius: '20px',
              border: '1px solid rgba(239,68,68,0.4)',
              padding: '28px',
              width: '100%',
              maxWidth: '440px',
              direction: 'rtl',
              fontFamily: FONT,
            }}
          >
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ color: 'var(--status-danger)', fontWeight: 800, marginBottom: '8px' }}>
              تأكيد الاستعادة
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>
              سيتم حذف البيانات الحالية لجميع الشركات واستبدالها بمحتوى الملف.
              <br />
              <strong style={{ color: 'var(--status-warning)' }}>{pendingRestoreFile?.name}</strong>
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>
              اكتب <strong style={{ color: 'var(--status-danger)' }}>RESTORE</strong> للتأكيد:
            </p>
            <input
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              placeholder="RESTORE"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-1)',
                fontSize: '14px',
                marginBottom: '16px',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setRestoreModal(false);
                  setPendingRestoreFile(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  void confirmRestore();
                }}
                disabled={restoreCode !== 'RESTORE'}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background:
                    restoreCode === 'RESTORE' ? 'var(--status-danger)' : 'rgba(239,68,68,0.2)',
                  color: restoreCode === 'RESTORE' ? 'var(--text-1)' : 'rgba(255,255,255,0.3)',
                  cursor: restoreCode === 'RESTORE' ? 'pointer' : 'not-allowed',
                  fontWeight: 800,
                  fontFamily: FONT,
                }}
              >
                تأكيد الاستعادة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        {[
          {
            key: 'support' as const,
            icon: '⚙️',
            label: 'معلومات التواصل',
            desc: 'واتساب وبريد الدعم الفني',
            color: 'var(--status-warning)',
          },
          {
            key: 'backup' as const,
            icon: '💾',
            label: 'النسخ الاحتياطية',
            desc: 'إنشاء / استعادة / تشفير',
            color: 'var(--status-success)',
          },
          {
            key: 'security' as const,
            icon: '🔐',
            label: 'الأمان',
            desc: 'المصادقة الثنائية وقيود IP',
            color: 'var(--status-info)',
          },
          {
            key: 'audit_log' as const,
            icon: '📋',
            label: 'سجل العمليات',
            desc: 'مراقبة جميع إجراءات النظام',
            color: 'var(--status-info)',
          },
          {
            key: 'telegram' as const,
            icon: '📨',
            label: 'إشعارات تليجرام',
            desc: 'تحكم في التنبيهات والـ Cooldown',
            color: '#38BDF8',
          },
        ].map((card) => {
          const isActive = settingsActiveCard === card.key;
          return (
            <div
              key={card.key}
              onClick={() => setSettingsActiveCard(isActive ? null : card.key)}
              style={{
                background: isActive ? `${card.color}1A` : C.card,
                border: `1.5px solid ${isActive ? card.color : C.border}`,
                borderRadius: '16px',
                padding: '22px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: isActive
                  ? `0 0 0 3px ${card.color}30, 0 8px 32px ${card.color}25`
                  : 'none',
                transform: isActive ? 'translateY(-2px)' : '',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = card.color;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = `0 4px 20px ${card.color}20`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: '28px' }}>{card.icon}</span>
                {isActive && (
                  <span style={{ color: card.color, fontSize: '18px', fontWeight: 900 }}>✕</span>
                )}
              </div>
              <div
                style={{ fontSize: '14px', fontWeight: 800, color: isActive ? card.color : C.text }}
              >
                {card.label}
              </div>
              <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.5 }}>{card.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Content panel */}
      {settingsActiveCard && (
        <div
          style={{
            background: C.card,
            borderRadius: '18px',
            border: `1.5px solid ${hc}50`,
            overflow: 'hidden',
            animation: 'sa-panel-in 0.25s ease-out both',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderBottom: `1px solid ${C.border}`,
              background: `${hc}12`,
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: hc }}>
              {settingsActiveCard === 'support' && '⚙️ معلومات التواصل للدعم'}
              {settingsActiveCard === 'backup' && '💾 النسخ الاحتياطية'}
              {settingsActiveCard === 'security' && '🔐 الأمان'}
              {settingsActiveCard === 'audit_log' && '📋 سجل العمليات'}
              {settingsActiveCard === 'telegram' && '📨 إشعارات تليجرام'}
            </h3>
            <button
              onClick={() => setSettingsActiveCard(null)}
              style={{
                background: 'transparent',
                border: `1px solid ${hc}50`,
                borderRadius: '8px',
                color: hc,
                fontSize: '16px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px 10px',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>

          {settingsActiveCard === 'support' && (
            <SupportPanel
              supportWa={supportWa}
              setSupportWa={setSupportWa}
              supportEmail={supportEmail}
              setSupportEmail={setSupportEmail}
              settingSaving={settingSaving}
              saveSupportSettings={saveSupportSettings}
            />
          )}
          {settingsActiveCard === 'backup' && (
            <BackupPanel
              backupData={backupData}
              creatingBackup={creatingBackup}
              downloadingFile={downloadingFile}
              restoring={restoring}
              restoreOk={restoreOk}
              restoreErr={restoreErr}
              triggerBackup={triggerBackup}
              downloadBackup={downloadBackup}
              openRestorePicker={openRestorePicker}
              encEnabled={encEnabled}
              encKey={encKey}
              encKeyLoading={encKeyLoading}
              encKeyVisible={encKeyVisible}
              encKeyCopied={encKeyCopied}
              loadEncKey={loadEncKey}
              copyEncKey={copyEncKey}
              downloadEncKey={downloadEncKey}
              emailEncKey={emailEncKey}
            />
          )}
          {settingsActiveCard === 'security' && (
            <SecurityPanel
              totpStatus={totpStatus}
              totpSetupData={totpSetupData}
              totpInput={totpInput}
              setTotpInput={setTotpInput}
              disableTotpInput={disableTotpInput}
              setDisableTotpInput={setDisableTotpInput}
              secLoading={secLoading}
              secMsg={secMsg}
              setSecMsg={setSecMsg}
              showDisable={showDisable}
              setShowDisable={setShowDisable}
              startTotpSetup={startTotpSetup}
              confirmTotpSetup={confirmTotpSetup}
              confirmDisableTotp={confirmDisableTotp}
            />
          )}
          {settingsActiveCard === 'audit_log' && (
            <AuditLogPanel
              auditData={auditData}
              auditLoading={auditLoading}
              refetchAudit={refetchAudit}
              auditAction={auditAction}
              setAuditAction={setAuditAction}
              auditLimit={auditLimit}
              setAuditLimit={setAuditLimit}
            />
          )}
          {settingsActiveCard === 'telegram' && (
            <TelegramPanel
              tgConfig={tgConfig}
              setTgConfig={setTgConfig}
              tgSaving={tgSaving}
              tgBotStatus={tgBotStatus}
              tgBotLoading={tgBotLoading}
              tgBotRefetch={tgBotRefetch}
              tgLoading={tgLoading}
              tgError={tgError}
              tgErrorObj={tgErrorObj}
              tgRefetch={tgRefetch}
              tgBotToken={tgBotToken}
              setTgBotToken={setTgBotToken}
              tgChatId={tgChatId}
              setTgChatId={setTgChatId}
              tgShowToken={tgShowToken}
              setTgShowToken={setTgShowToken}
              tgCredSaving={tgCredSaving}
              saveTgCredentials={saveTgCredentials}
              tgTesting={tgTesting}
              testTelegramConnection={testTelegramConnection}
              tgTestResult={tgTestResult}
              saveTelegramSettings={saveTelegramSettings}
            />
          )}
        </div>
      )}
    </div>
  );
}
