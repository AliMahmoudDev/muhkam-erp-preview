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
  encKey: string | null;
  encKeyLoading: boolean;
  encKeyVisible: boolean;
  encKeyCopied: boolean;
  loadEncKey: () => void;
  copyEncKey: () => void;
  downloadEncKey: () => void;
  emailEncKey: () => void;
}

export function BackupPanel({
  backupData, creatingBackup, downloadingFile, restoring, restoreOk, restoreErr,
  triggerBackup, downloadBackup, openRestorePicker,
  encEnabled, encKey, encKeyLoading, encKeyVisible, encKeyCopied,
  loadEncKey, copyEncKey, downloadEncKey, emailEncKey,
}: Props) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>
          النسخ التلقائي يعمل يومياً الساعة 3:00 صباحاً •{' '}
          {backupData ? `${backupData.total} نسخة متوفرة` : 'جاري التحميل...'}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => { void triggerBackup(); }} disabled={creatingBackup}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: 'none', background: creatingBackup ? C.border : C.orange, color: 'var(--text-1)', fontSize: '13px', fontWeight: 800, cursor: creatingBackup ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
            💾 {creatingBackup ? 'جاري الإنشاء...' : 'إنشاء نسخة الآن'}
          </button>
          <button onClick={openRestorePicker} disabled={restoring}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.1)', color: 'var(--status-info)', fontSize: '13px', fontWeight: 800, cursor: restoring ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
            {restoring ? '⏳ جاري الاستعادة...' : '📥 استعادة من ملف'}
          </button>
        </div>
      </div>

      {restoreOk && <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--status-success)', fontSize: '13px', fontWeight: 700 }}>✅ {restoreOk}</div>}
      {restoreErr && <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-danger)', fontSize: '13px' }}>❌ {restoreErr}</div>}

      <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px', gap: '8px', padding: '10px 20px', background: 'rgba(249,115,22,0.08)', borderBottom: `1px solid ${C.border}`, fontSize: '11px', fontWeight: 700, color: C.orange }}>
          <div>اسم الملف</div><div style={{ textAlign: 'center' }}>الحجم</div><div style={{ textAlign: 'center' }}>التاريخ</div><div style={{ textAlign: 'center' }}>تنزيل</div>
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
              <div key={b.filename} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 160px 110px', gap: '8px', padding: '12px 20px', alignItems: 'center', borderBottom: idx < backupData.backups.length - 1 ? `1px solid ${C.border}` : 'none', background: idx % 2 === 1 ? 'rgba(15,23,42,0.4)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '14px' }}>{isEnc ? '🔒' : '📄'}</span>
                  <span style={{ fontSize: '12px', color: C.text, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.filename}</span>
                  {isEnc && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(139,92,246,0.2)', color: 'var(--status-info)', border: '1px solid rgba(139,92,246,0.3)', whiteSpace: 'nowrap' }}>مشفّر</span>}
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted }}>{b.size_mb} MB</div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: C.muted, direction: 'ltr' }}>
                  {new Date(b.created_at).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => { void downloadBackup(b.filename); }} disabled={isDownloading}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: 'var(--status-success)', fontSize: '12px', fontWeight: 700, cursor: isDownloading ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
                    {isDownloading ? '⏳' : '⬇️ تنزيل'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Encryption Key */}
      <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '14px', border: `1px solid ${C.border}`, padding: '20px 24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: C.text, marginBottom: '8px' }}>🔑 مفتاح تشفير النسخ</div>
        <div style={{ fontSize: '12px', color: C.muted, marginBottom: '14px', lineHeight: 1.6 }}>
          {encEnabled ? 'النسخ الاحتياطية مشفّرة — احتفظ بهذا المفتاح في مكان آمن.' : 'التشفير غير مفعّل — عيّن متغير BACKUP_ENCRYPTION_KEY في ملف .env لتفعيله.'}
        </div>
        {encEnabled && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => void loadEncKey()} disabled={encKeyLoading}
              style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              {encKeyLoading ? '⏳ ...' : encKeyVisible ? '🙈 إخفاء' : '👁 عرض المفتاح'}
            </button>
            {encKeyVisible && encKey && (
              <>
                <button onClick={copyEncKey} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: 'var(--status-success)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  {encKeyCopied ? '✅ تم النسخ' : '📋 نسخ'}
                </button>
                <button onClick={downloadEncKey} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: 'var(--status-warning)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  💾 حفظ كملف .key
                </button>
                <button onClick={emailEncKey} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: 'var(--status-info)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  📧 إرسال بالبريد
                </button>
              </>
            )}
          </div>
        )}
        {encKeyVisible && encKey && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(15,23,42,0.6)', border: `1px solid ${C.border}`, fontSize: '12px', color: 'var(--status-info)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {encKey}
          </div>
        )}
      </div>
    </div>
  );
}
