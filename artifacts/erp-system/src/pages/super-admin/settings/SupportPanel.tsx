import React from 'react';
import { C, FONT } from '../types';
import { DarkInput } from '../ui';

interface Props {
  supportWa: string;
  setSupportWa: (v: string) => void;
  supportEmail: string;
  setSupportEmail: (v: string) => void;
  settingSaving: boolean;
  saveSupportSettings: () => void;
}

export function SupportPanel({
  supportWa,
  setSupportWa,
  supportEmail,
  setSupportEmail,
  settingSaving,
  saveSupportSettings,
}: Props) {
  return (
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
        onClick={() => {
          void saveSupportSettings();
        }}
        disabled={settingSaving}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '10px',
          border: 'none',
          background: settingSaving ? C.border : C.orange,
          color: 'var(--text-1)',
          fontSize: '14px',
          fontWeight: 800,
          cursor: settingSaving ? 'not-allowed' : 'pointer',
          fontFamily: FONT,
          transition: 'filter 0.15s',
          marginTop: '4px',
        }}
      >
        {settingSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
      </button>
    </div>
  );
}
