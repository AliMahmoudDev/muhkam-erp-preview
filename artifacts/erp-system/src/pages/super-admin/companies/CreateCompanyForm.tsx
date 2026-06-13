/* eslint-disable erp/no-hardcoded-colors */
import { C, FONT } from '../types';
import type { CoMutate, CreateResult } from './types';

export function CreateCompanyForm({
  newName,
  setNewName,
  newPlan,
  setNewPlan,
  newEdition,
  setNewEdition,
  newDays,
  setNewDays,
  newAdminName,
  setNewAdminName,
  newAdminUsername,
  setNewAdminUsername,
  setShowCreate,
  setCreateResult,
  coMutate,
}: {
  newName: string;
  setNewName: (v: string) => void;
  newPlan: string;
  setNewPlan: (v: string) => void;
  newEdition: 'advanced' | 'ultimate';
  setNewEdition: (v: 'advanced' | 'ultimate') => void;
  newDays: number;
  setNewDays: (v: number) => void;
  newAdminName: string;
  setNewAdminName: (v: string) => void;
  newAdminUsername: string;
  setNewAdminUsername: (v: string) => void;
  setShowCreate: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateResult: (v: CreateResult | null) => void;
  coMutate: CoMutate;
}) {
  return (
    <div
      style={{
        padding: '20px 24px',
        background: 'rgba(249,115,22,0.06)',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 200px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: C.muted,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            اسم الشركة *
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: شركة الأمل التجارية"
            style={{
              width: '100%',
              border: `1.5px solid ${C.border}`,
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              fontFamily: FONT,
              boxSizing: 'border-box',
              background: C.bg,
              color: C.text,
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = C.orange;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = C.border;
            }}
          />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: C.muted,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            نوع الاشتراك
          </label>
          <select
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value)}
            style={{
              width: '100%',
              border: `1.5px solid ${C.border}`,
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '14px',
              background: C.bg,
              color: C.text,
              fontFamily: FONT,
            }}
          >
            <option value="trial">تجريبي</option>
            <option value="basic">أساسي</option>
            <option value="professional">احترافي</option>
            <option value="paid">مدفوع</option>
          </select>
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: C.muted,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            🏷️ نسخة النظام
          </label>
          <select
            value={newEdition}
            onChange={(e) => setNewEdition(e.target.value as 'advanced' | 'ultimate')}
            style={{
              width: '100%',
              border: `1.5px solid ${newEdition === 'ultimate' ? 'var(--status-info)' : 'var(--status-warning)'}`,
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '14px',
              background: C.bg,
              color: newEdition === 'ultimate' ? '#a5b4fc' : '#fcd34d',
              fontFamily: FONT,
              fontWeight: 700,
            }}
          >
            <option value="ultimate">⭐ MUHKAM ULTIMATE (كاملة)</option>
            <option value="advanced">🚀 MUHKAM ADVANCED (متوسطة)</option>
          </select>
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: C.muted,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            المدة (أيام)
          </label>
          <select
            value={newDays}
            onChange={(e) => setNewDays(Number(e.target.value))}
            style={{
              width: '100%',
              border: `1.5px solid ${C.border}`,
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '14px',
              background: C.bg,
              color: C.text,
              fontFamily: FONT,
            }}
          >
            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {d} يوم
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: C.muted,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            اسم المدير *
          </label>
          <input
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            placeholder="مثال: أحمد محمد"
            style={{
              width: '100%',
              border: `1.5px solid ${C.border}`,
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              fontFamily: FONT,
              boxSizing: 'border-box',
              background: C.bg,
              color: C.text,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = C.orange;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = C.border;
            }}
          />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: C.muted,
              display: 'block',
              marginBottom: '6px',
            }}
          >
            اسم مستخدم المدير
            <span style={{ fontWeight: 400, color: C.muted, marginRight: '4px' }}>(اختياري)</span>
          </label>
          <input
            value={newAdminUsername}
            onChange={(e) =>
              setNewAdminUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
            }
            placeholder="مثال: ahmed_mgr"
            dir="ltr"
            style={{
              width: '100%',
              border: `1.5px solid ${C.border}`,
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              background: C.bg,
              color: C.text,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = C.orange;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = C.border;
            }}
          />
          <div style={{ fontSize: '10px', color: C.muted, marginTop: '3px' }}>
            يُكمَّل تلقائياً لو تُركت فارغة
          </div>
        </div>
        <button
          onClick={() => {
            if (!newName.trim() || !newAdminName.trim()) return;
            coMutate.mutate(
              {
                url: '/api/super/companies',
                method: 'POST',
                body: {
                  name: newName.trim(),
                  plan_type: newPlan,
                  edition: newEdition,
                  duration_days: newDays,
                  admin_name: newAdminName.trim(),
                  admin_username: newAdminUsername.trim() || undefined,
                },
              },
              {
                onSuccess: (data: unknown) => {
                  setShowCreate(false);
                  setNewName('');
                  setNewPlan('trial');
                  setNewEdition('ultimate');
                  setNewDays(14);
                  setNewAdminName('');
                  setNewAdminUsername('');
                  const d = data as {
                    company?: { name?: string };
                    admin?: { username?: string; name?: string; temp_password?: string };
                  } | null;
                  setCreateResult({
                    company_name: d?.company?.name ?? newName,
                    username: d?.admin?.username ?? '',
                    admin_name: d?.admin?.name ?? newAdminName,
                    temp_password: d?.admin?.temp_password ?? '',
                  });
                },
              }
            );
          }}
          disabled={!newName.trim() || !newAdminName.trim() || coMutate.isPending}
          style={{
            padding: '10px 22px',
            borderRadius: '10px',
            border: 'none',
            background: newName.trim() && newAdminName.trim() ? C.orange : C.border,
            color: 'var(--text-1)',
            fontSize: '14px',
            fontWeight: 700,
            cursor: newName.trim() && newAdminName.trim() ? 'pointer' : 'default',
            fontFamily: FONT,
            flexShrink: 0,
            transition: 'filter 0.15s',
            alignSelf: 'flex-end',
            marginBottom: '20px',
          }}
        >
          {coMutate.isPending ? 'جاري الإنشاء...' : '🏢 إنشاء الشركة'}
        </button>
      </div>
    </div>
  );
}
