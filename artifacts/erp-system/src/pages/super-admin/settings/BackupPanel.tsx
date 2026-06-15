import React from 'react';
import { C, FONT, type BackupFile } from '../types';

interface Props {
  backupData: { backups: BackupFile[]; total: number } | undefined;
  creatingBackup: boolean;
  downloadingFile: string | null;
  restoring: boolean;
  restoreOk: string | null;
  restoreErr: string | null;
  triggerBackup: () => void;
  downloadBackup: (filename: string) => void;
  openRestorePicker: () => void;
  encEnabled: boolean;
  showKeyGen: boolean;
  setShowKeyGen: (v: boolean) => void;
  keyGenPin: string;
  setKeyGenPin: (v: string) => void;
  keyGenLoading: boolean;
  keyGenError: string | null;
  generatedKey: string | null;
  keyGenAlreadyConfigured: boolean;
  keyGenCopied: boolean;
  setKeyGenCopied: (v: boolean) => void;
  generateEncryptionKey: () => void;
  dismissGeneratedKey: () => void;
}

export function BackupPanel({
  backupData,
  creatingBackup,
  downloadingFile,
  restoring,
  restoreOk,
  restoreErr,
  triggerBackup,
  downloadBackup,
  openRestorePicker,
  encEnabled,
  showKeyGen,
  setShowKeyGen,
  keyGenPin,
  setKeyGenPin,
  keyGenLoading,
  keyGenError,
  generatedKey,
  keyGenAlreadyConfigured,
  keyGenCopied,
  setKeyGenCopied,
  generateEncryptionKey,
  dismissGeneratedKey,
}: Props) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>
          النسخ التلقائي يعمل يومياً الساعة 3:00 صباحاً •{' '}
          {backupData ? `${backupData.total} نسخة متوفرة` : 'جاري التحميل...'}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              void triggerBackup();
            }}
            disabled={creatingBackup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: creatingBackup ? C.border : C.orange,
              color: 'var(--text-1)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: creatingBackup ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
            }}
          >
            💾 {creatingBackup ? 'جاري الإنشاء...' : 'إنشاء نسخة الآن'}
          </button>
          <button
            onClick={openRestorePicker}
            disabled={restoring}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(139,92,246,0.4)',
              background: 'rgba(139,92,246,0.1)',
              color: 'var(--status-info)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: restoring ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
            }}
          >
            {restoring ? '⏳ جاري الاستعادة...' : '📥 استعادة من ملف'}
          </button>
        </div>
      </div>

      {restoreOk && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            color: 'var(--status-success)',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          ✅ {restoreOk}
        </div>
      )}
      {restoreErr && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--status-danger)',
            fontSize: '13px',
          }}
        >
          ❌ {restoreErr}
        </div>
      )}

      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: '14px',
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 160px 110px',
            gap: '8px',
            padding: '10px 20px',
            background: 'rgba(249,115,22,0.08)',
            borderBottom: `1px solid ${C.border}`,
            fontSize: '11px',
            fontWeight: 700,
            color: C.orange,
          }}
        >
          <div>اسم الملف</div>
          <div style={{ textAlign: 'center' }}>الحجم</div>
          <div style={{ textAlign: 'center' }}>التاريخ</div>
          <div style={{ textAlign: 'center' }}>تنزيل</div>
        </div>
        {!backupData ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.muted }}>
            جاري التحميل...
          </div>
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
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 160px 110px',
                  gap: '8px',
                  padding: '12px 20px',
                  alignItems: 'center',
                  borderBottom:
                    idx < backupData.backups.length - 1 ? `1px solid ${C.border}` : 'none',
                  background: idx % 2 === 1 ? 'var(--surface-raised)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '14px' }}>{isEnc ? '🔒' : '📄'}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: C.text,
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.filename}
                  </span>
                  {isEnc && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'rgba(139,92,246,0.2)',
                        color: 'var(--status-info)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      مشفّر
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted }}>
                  {b.size_mb} MB
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: C.muted,
                    direction: 'ltr',
                  }}
                >
                  {new Date(b.created_at).toLocaleString('ar-EG', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      void downloadBackup(b.filename);
                    }}
                    disabled={isDownloading}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(34,197,94,0.3)',
                      background: 'rgba(34,197,94,0.1)',
                      color: 'var(--status-success)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isDownloading ? 'not-allowed' : 'pointer',
                      fontFamily: FONT,
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

      {/* Encryption Status */}
      <div
        style={{
          background: 'var(--surface-raised)',
          borderRadius: '14px',
          border: `1px solid ${C.border}`,
          padding: '20px 24px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>
          🔑 تشفير النسخ الاحتياطية
        </div>
        <div style={{ fontSize: '12px', color: C.muted, marginBottom: '14px', lineHeight: 1.6 }}>
          {encEnabled
            ? 'التشفير مفعّل — المفتاح محفوظ كسِرّ على السيرفر ولا يتم عرضه أو نسخه من الواجهة.'
            : 'التشفير غير مفعّل — عيّن متغير BACKUP_ENCRYPTION_KEY في ملف .env لتفعيله.'}
        </div>
        {encEnabled && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: 'var(--status-success)',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1.6,
            }}
          >
            ✅ المفتاح لا يظهر في المتصفح. احفظه فقط في مدير الأسرار أو على السيرفر بشكل آمن.
          </div>
        )}

        {/* ── Generate / Rotate key (PIN-protected, shown once) ── */}
        <div style={{ marginTop: '16px', borderTop: `1px solid ${C.border}`, paddingTop: '16px' }}>
          {generatedKey ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.35)',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: C.orange,
                  marginBottom: '8px',
                }}
              >
                ⚠️ مفتاح جديد — يُعرض مرة واحدة فقط
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: C.muted,
                  marginBottom: '12px',
                  lineHeight: 1.7,
                }}
              >
                انسخ المفتاح الآن واحفظه في مدير الأسرار باسم{' '}
                <code style={{ color: C.text, fontFamily: 'monospace' }}>
                  BACKUP_ENCRYPTION_KEY
                </code>{' '}
                ثم أعد تشغيل الخادم لتفعيله. لن يظهر هذا المفتاح مرة أخرى ولا يُحفظ في أي مكان.
                {keyGenAlreadyConfigured && (
                  <>
                    <br />
                    <strong style={{ color: 'var(--status-warning)' }}>
                      تنبيه: يوجد مفتاح مُفعّل حالياً — استبداله سيجعل النسخ المشفّرة القديمة غير
                      قابلة للاستعادة.
                    </strong>
                  </>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: '12px',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--surface)',
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    direction: 'ltr',
                    textAlign: 'left',
                  }}
                >
                  {generatedKey}
                </code>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(generatedKey).then(
                      () => setKeyGenCopied(true),
                      () => setKeyGenCopied(false)
                    );
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(34,197,94,0.3)',
                    background: 'rgba(34,197,94,0.1)',
                    color: 'var(--status-success)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {keyGenCopied ? '✅ تم النسخ' : '📋 نسخ'}
                </button>
              </div>
              <button
                onClick={dismissGeneratedKey}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${C.border}`,
                  background: 'transparent',
                  color: C.muted,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                حفظتُه — إخفاء المفتاح
              </button>
            </div>
          ) : showKeyGen ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'var(--surface)',
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: C.muted,
                  marginBottom: '10px',
                  lineHeight: 1.6,
                }}
              >
                أدخل الرمز السري للسوبر أدمن (PIN) لتوليد مفتاح تشفير جديد.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="password"
                  value={keyGenPin}
                  onChange={(e) => setKeyGenPin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') generateEncryptionKey();
                  }}
                  placeholder="••••••"
                  autoComplete="off"
                  style={{
                    flex: 1,
                    minWidth: '160px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--surface-raised)',
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={generateEncryptionKey}
                  disabled={keyGenLoading || !keyGenPin.trim()}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: keyGenLoading || !keyGenPin.trim() ? C.border : C.orange,
                    color: 'var(--text-1)',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: keyGenLoading || !keyGenPin.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: FONT,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {keyGenLoading ? '⏳ جارٍ التوليد...' : '🔑 توليد المفتاح'}
                </button>
                <button
                  onClick={dismissGeneratedKey}
                  disabled={keyGenLoading}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: C.muted,
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: keyGenLoading ? 'not-allowed' : 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  إلغاء
                </button>
              </div>
              {keyGenError && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--status-danger)',
                  }}
                >
                  ❌ {keyGenError}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowKeyGen(true)}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(249,115,22,0.4)',
                background: 'rgba(249,115,22,0.1)',
                color: C.orange,
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {encEnabled ? '🔄 توليد مفتاح جديد (تدوير)' : '🔑 توليد مفتاح تشفير'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
