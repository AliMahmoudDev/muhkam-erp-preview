import React from 'react';
import { Combobox } from '@/components/ui/combobox';
import { C, FONT } from '../types';
import { formatAuditNote, getAuditActionMeta, getRecordLabel } from '../audit-actions';

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
  auditData: AuditLogResp | undefined;
  auditLoading: boolean;
  refetchAudit: () => void;
  auditAction: string;
  setAuditAction: (v: string) => void;
  auditLimit: number;
  setAuditLimit: (v: number) => void;
}

export function AuditLogPanel({
  auditData,
  auditLoading,
  refetchAudit,
  auditAction,
  setAuditAction,
  auditLimit,
  setAuditLimit,
}: Props) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          سجل كامل لجميع الإجراءات التي نفّذها المديرون العامون على المنصة
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Combobox
            options={[
              { value: '', label: 'كل الإجراءات' },
              { value: 'create', label: 'إنشاء' },
              { value: 'update', label: 'تعديل' },
              { value: 'delete', label: 'حذف' },
              { value: 'login', label: 'دخول' },
              { value: 'COMPANY_CREATED', label: 'إنشاء شركة' },
              { value: 'COMPANY_UPDATED', label: 'تحديث شركة' },
              { value: 'COMPANY_ACTIVATED', label: 'تفعيل شركة' },
              { value: 'COMPANY_SUSPENDED', label: 'إيقاف شركة' },
              { value: 'COMPANY_EXTENDED', label: 'تمديد اشتراك' },
              { value: 'ADMIN_PASSWORD_RESET', label: 'إعادة كلمة المرور' },
              { value: 'MANAGER_CREATED', label: 'إنشاء مدير' },
              { value: 'MANAGER_UPDATED', label: 'تحديث مدير' },
              { value: 'MANAGER_TOGGLED', label: 'تغيير حالة مدير' },
              { value: 'MANAGER_DELETED', label: 'حذف مدير' },
              { value: 'PLAN_SETTINGS_UPDATED', label: 'تحديث إعدادات الخطة' },
              { value: 'BACKUP_CREATED', label: 'نسخة احتياطية' },
              { value: 'RESTORE_STARTED', label: 'استعادة' },
              { value: 'SUPER_ADMIN_LIST_VIEW', label: 'عرض الشركات' },
            ]}
            value={auditAction}
            onChange={(v) => setAuditAction(v)}
            searchable={false}
          />
          <Combobox
            options={[25, 50, 100, 200, 500].map((n) => ({
              value: String(n),
              label: `${n} سجل`,
            }))}
            value={String(auditLimit)}
            onChange={(v) => setAuditLimit(Number(v))}
            searchable={false}
          />
          <button
            onClick={() => void refetchAudit()}
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
      {auditLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
          ⏳ جارٍ التحميل...
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: '12px',
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
              padding: '10px 20px',
              background: 'rgba(96,165,250,0.08)',
              borderBottom: `1px solid ${C.border}`,
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--status-info)',
              gap: '12px',
            }}
          >
            <span>الإجراء</span>
            <span>النوع</span>
            <span>رقم</span>
            <span>الملاحظة</span>
            <span>التاريخ</span>
          </div>
          {!auditData?.rows.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
              لا توجد سجلات
            </div>
          ) : (
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {auditData.rows.map((row) => {
                const am = getAuditActionMeta(row.action);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
                      padding: '11px 20px',
                      gap: '12px',
                      borderBottom: 'border-bottom: 1px solid var(--edge)',
                      fontSize: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: am.color, fontWeight: 700 }}>{am.label}</span>
                    <span style={{ color: C.muted }}>{getRecordLabel(row.record_type)}</span>
                    <span style={{ color: C.muted, textAlign: 'center' }}>#{row.record_id}</span>
                    <span style={{ color: C.text, fontSize: '11px', lineHeight: 1.4 }}>
                      {formatAuditNote(row.note)}
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
                padding: '10px 20px',
                borderTop: `1px solid ${C.border}`,
                fontSize: '12px',
                color: C.muted,
              }}
            >
              إجمالي السجلات: {auditData.count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
