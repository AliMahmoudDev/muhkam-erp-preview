import React from 'react';
import { C, FONT } from '../types';

interface AuditEntry { id: number; action: string; record_type: string | null; record_id: number | null; note: string | null; username: string | null; created_at: string; }
interface AuditLogResp { count: number; rows: AuditEntry[]; }

interface Props {
  auditData: AuditLogResp | undefined;
  auditLoading: boolean;
  refetchAudit: () => void;
  auditAction: string;
  setAuditAction: (v: string) => void;
  auditLimit: number;
  setAuditLimit: (v: number) => void;
}

const AUD_COLORS: Record<string, { label: string; color: string }> = {
  create: { label: 'إنشاء', color: 'var(--status-success)' }, update: { label: 'تعديل', color: 'var(--status-info)' },
  delete: { label: 'حذف', color: 'var(--status-danger)' }, view: { label: 'عرض', color: 'var(--status-info)' },
  login: { label: 'دخول', color: 'var(--status-info)' },
  COMPANY_CREATED: { label: 'إنشاء شركة', color: 'var(--status-success)' }, COMPANY_UPDATED: { label: 'تحديث شركة', color: 'var(--status-info)' },
  COMPANY_ACTIVATED: { label: 'تفعيل شركة', color: 'var(--status-success)' }, COMPANY_SUSPENDED: { label: 'إيقاف شركة', color: 'var(--status-warning)' },
  COMPANY_EXTENDED: { label: 'تمديد اشتراك', color: '#38BDF8' }, COMPANY_DELETED: { label: 'حذف شركة', color: 'var(--status-danger)' },
  COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك', color: 'var(--status-info)' },
  ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: 'var(--status-info)' },
  MANAGER_CREATED: { label: 'إنشاء مدير', color: 'var(--status-success)' }, MANAGER_UPDATED: { label: 'تحديث مدير', color: 'var(--status-info)' },
  MANAGER_TOGGLED: { label: 'تغيير حالة مدير', color: 'var(--status-warning)' }, MANAGER_DELETED: { label: 'حذف مدير', color: 'var(--status-danger)' },
  PLAN_SETTINGS_UPDATED: { label: 'تحديث إعدادات الخطة', color: 'var(--status-warning)' },
  TELEGRAM_SETTINGS_UPDATED: { label: 'تحديث تليجرام', color: '#38BDF8' },
  BACKUP_CREATED: { label: 'نسخة احتياطية', color: 'var(--status-success)' }, RESTORE_STARTED: { label: 'بدء استعادة', color: 'var(--status-info)' },
  RESTORE_COMPLETED: { label: 'اكتمال استعادة', color: 'var(--status-success)' },
  SUPER_ADMIN_ACCESS: { label: 'وصول مدير عام', color: 'var(--status-info)' }, SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: 'var(--status-info)' },
};

const REC_AR: Record<string, string> = {
  customer: 'عميل', supplier: 'مورد', sale: 'فاتورة بيع', purchase: 'فاتورة شراء',
  product: 'منتج / صنف', expense: 'مصروف', income: 'إيراد', user: 'مستخدم',
  erp_user: 'حساب مستخدم', employee: 'موظف', company: 'شركة', subscription: 'اشتراك',
  fiscal_year: 'سنة مالية', system: 'النظام', announcement: 'إعلان',
};

export function AuditLogPanel({ auditData, auditLoading, refetchAudit, auditAction, setAuditAction, auditLimit, setAuditLimit }: Props) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>سجل كامل لجميع الإجراءات التي نفّذها المديرون العامون على المنصة</p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
            <option value="">كل الإجراءات</option>
            <option value="create">إنشاء</option><option value="update">تعديل</option>
            <option value="delete">حذف</option><option value="login">دخول</option>
            <option value="COMPANY_CREATED">إنشاء شركة</option><option value="COMPANY_UPDATED">تحديث شركة</option>
            <option value="COMPANY_ACTIVATED">تفعيل شركة</option><option value="COMPANY_SUSPENDED">إيقاف شركة</option>
            <option value="COMPANY_EXTENDED">تمديد اشتراك</option><option value="ADMIN_PASSWORD_RESET">إعادة كلمة المرور</option>
            <option value="MANAGER_CREATED">إنشاء مدير</option><option value="MANAGER_UPDATED">تحديث مدير</option>
            <option value="MANAGER_TOGGLED">تغيير حالة مدير</option><option value="MANAGER_DELETED">حذف مدير</option>
            <option value="PLAN_SETTINGS_UPDATED">تحديث إعدادات الخطة</option>
            <option value="BACKUP_CREATED">نسخة احتياطية</option><option value="RESTORE_STARTED">استعادة</option>
            <option value="SUPER_ADMIN_LIST_VIEW">عرض الشركات</option>
          </select>
          <select value={auditLimit} onChange={e => setAuditLimit(Number(e.target.value))}
            style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
            {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} سجل</option>)}
          </select>
          <button onClick={() => void refetchAudit()}
            style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            🔄 تحديث
          </button>
        </div>
      </div>
      {auditLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>⏳ جارٍ التحميل...</div>
      ) : (
        <div style={{ background: 'rgba(15,23,42,0.4)', borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px', padding: '10px 20px', background: 'rgba(96,165,250,0.08)', borderBottom: `1px solid ${C.border}`, fontSize: '11px', fontWeight: 800, color: 'var(--status-info)', gap: '12px' }}>
            <span>الإجراء</span><span>النوع</span><span>رقم</span><span>الملاحظة</span><span>التاريخ</span>
          </div>
          {!auditData?.rows.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>لا توجد سجلات</div>
          ) : (
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {auditData.rows.map(row => {
                const am = AUD_COLORS[row.action] ?? { label: row.action, color: 'var(--text-2)' };
                return (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px', padding: '11px 20px', gap: '12px', borderBottom: 'border-bottom: 1px solid rgba(255,255,255,0.04)', fontSize: '12px', alignItems: 'center' }}>
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
  );
}
