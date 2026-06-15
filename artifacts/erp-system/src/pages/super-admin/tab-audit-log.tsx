import { C, FONT } from './types';
import { SAErrorState, SARefreshHint } from './sa-primitives';
import { ACTION_AR, RECORD_AR } from './audit-actions';

interface AuditRow {
  id: number;
  action: string;
  record_type: string;
  record_id: number;
  user_id: number | null;
  username: string | null;
  note: string | null;
  company_id: number | null;
  created_at: string;
}

interface Props {
  auditData?: { count: number; rows: AuditRow[] };
  auditLoading: boolean;
  auditError: boolean;
  onRefetch: () => void;
  auditAction: string;
  setAuditAction: (v: string) => void;
  auditLimit: number;
  setAuditLimit: (v: number) => void;
}

export function TabAuditLog({
  auditData,
  auditLoading,
  auditError,
  onRefetch,
  auditAction,
  setAuditAction,
  auditLimit,
  setAuditLimit,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header + controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>
            📋 سجل التدقيق الجنائي
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            كل إجراء قام به المدير العام مُسجَّل هنا
            {auditError && auditData && (
              <span style={{ color: C.danger, fontWeight: 700 }}> · تعذّر التحديث الأخير</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (!auditData?.rows.length) return;
              const rows = auditData.rows
                .map(
                  (r) =>
                    `${r.action},${r.record_type},${r.record_id},${r.note ?? ''},${r.created_at}`
                )
                .join('\n');
              const blob = new Blob([`الإجراء,نوع السجل,رقم السجل,الملاحظة,التاريخ\n${rows}`], {
                type: 'text/csv',
              });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'audit-log.csv';
              a.click();
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(34,197,94,0.3)',
              background: 'rgba(34,197,94,0.08)',
              color: 'var(--status-success)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            📥 CSV
          </button>
          <select
            value={auditAction}
            onChange={(e) => setAuditAction(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: `1px solid ${C.border}`,
              background: C.card,
              color: C.text,
              fontSize: '13px',
              fontFamily: FONT,
              cursor: 'pointer',
            }}
          >
            <option value="">كل الإجراءات</option>
            <option value="SUPER_ADMIN_LIST_VIEW">عرض الشركات</option>
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
          </select>
          <select
            value={auditLimit}
            onChange={(e) => setAuditLimit(Number(e.target.value))}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: `1px solid ${C.border}`,
              background: C.card,
              color: C.text,
              fontSize: '13px',
              fontFamily: FONT,
              cursor: 'pointer',
            }}
          >
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n} سجل
              </option>
            ))}
          </select>
          <button
            onClick={() => void onRefetch()}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.muted,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            🔄 تحديث
          </button>
        </div>
      </div>

      {auditError && auditData && <SARefreshHint onRetry={onRefetch} />}

      {/* Table */}
      {auditLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
          ⏳ جارٍ التحميل...
        </div>
      ) : auditError && !auditData ? (
        <SAErrorState
          title="تعذّر تحميل سجل التدقيق"
          description="تحقق من الاتصال بالخادم وأعد المحاولة"
          onRetry={() => void onRefetch()}
        />
      ) : (
        <div
          style={{
            background: C.card,
            borderRadius: '18px',
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
              padding: '12px 20px',
              background: 'var(--surface)',
              borderBottom: `1px solid ${C.border}`,
              fontSize: '11px',
              fontWeight: 800,
              color: C.muted,
              gap: '12px',
            }}
          >
            <span>الإجراء</span>
            <span>النوع</span>
            <span>رقم السجل</span>
            <span>الملاحظة</span>
            <span>التاريخ</span>
          </div>
          {!auditData?.rows.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
              لا توجد سجلات
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {auditData!.rows.map((row) => {
                const actionMeta = ACTION_AR[row.action] ?? {
                  label: row.action,
                  color: 'var(--text-2)',
                };
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
                      padding: '12px 20px',
                      gap: '12px',
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: actionMeta.color, fontWeight: 700 }}>
                      {actionMeta.label}
                    </span>
                    <span style={{ color: C.muted }}>
                      {RECORD_AR[row.record_type] ?? row.record_type}
                    </span>
                    <span style={{ color: C.muted, textAlign: 'center' }}>#{row.record_id}</span>
                    <span style={{ color: C.text, fontSize: '11px', lineHeight: 1.4 }}>
                      {row.note ?? '—'}
                    </span>
                    <span
                      style={{
                        color: C.muted,
                        fontSize: '11px',
                        direction: 'ltr',
                        textAlign: 'right',
                      }}
                    >
                      {new Date(row.created_at).toLocaleString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {auditData && (
            <div
              style={{
                padding: '12px 20px',
                borderTop: `1px solid ${C.border}`,
                fontSize: '12px',
                color: C.muted,
              }}
            >
              إجمالي السجلات المعروضة: {auditData!.count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
