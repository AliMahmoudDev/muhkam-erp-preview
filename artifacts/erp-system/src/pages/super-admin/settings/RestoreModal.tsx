import React from 'react';
import { C, FONT } from '../types';

interface Props {
  restoreModal: boolean;
  setRestoreModal: (v: boolean) => void;
  pendingRestoreFile: File | null;
  setPendingRestoreFile: (v: File | null) => void;
  restoreCode: string;
  setRestoreCode: (v: string) => void;
  confirmRestore: () => void;
}

export function RestoreModal({
  restoreModal, setRestoreModal,
  pendingRestoreFile, setPendingRestoreFile,
  restoreCode, setRestoreCode, confirmRestore,
}: Props) {
  if (!restoreModal) return null;
  return (
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
        <h3 style={{ color: 'var(--status-danger)', fontWeight: 800, marginBottom: '8px' }}>تأكيد الاستعادة</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>
          سيتم حذف البيانات الحالية لجميع الشركات واستبدالها بمحتوى الملف.<br />
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
            width: '100%', padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-1)', fontSize: '14px', marginBottom: '16px',
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
              background: restoreCode === 'RESTORE' ? 'var(--status-danger)' : 'rgba(239,68,68,0.2)',
              color: restoreCode === 'RESTORE' ? 'var(--text-1)' : 'rgba(255,255,255,0.3)',
              cursor: restoreCode === 'RESTORE' ? 'pointer' : 'not-allowed',
              fontWeight: 800, fontFamily: FONT,
            }}
          >تأكيد الاستعادة</button>
        </div>
      </div>
    </div>
  );
}
