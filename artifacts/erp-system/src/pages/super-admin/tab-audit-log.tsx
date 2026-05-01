import { C, FONT } from './types';

interface AuditRow {
  id: number; action: string; record_type: string; record_id: number;
  user_id: number | null; username: string | null; note: string | null;
  company_id: number | null; created_at: string;
}

interface Props {
  auditData?: { count: number; rows: AuditRow[] };
  auditLoading: boolean;
  onRefetch: () => void;
  auditAction: string;
  setAuditAction: (v: string) => void;
  auditLimit: number;
  setAuditLimit: (v: number) => void;
}

const ACTION_AR: Record<string, { label: string; color: string }> = {
  /* عمليات أساسية */
  create:             { label: 'إنشاء',                color: '#34D399' },
  update:             { label: 'تعديل',                color: '#60A5FA' },
  delete:             { label: 'حذف',                  color: '#EF4444' },
  cancel:             { label: 'إلغاء',                color: '#EF4444' },
  view:               { label: 'عرض',                  color: '#60A5FA' },
  login:              { label: 'دخول',                 color: '#A78BFA' },
  logout:             { label: 'خروج',                 color: '#94A3B8' },
  approve:            { label: 'موافقة',               color: '#34D399' },
  reject:             { label: 'رفض',                  color: '#EF4444' },
  lock:               { label: 'قفل',                  color: '#FB923C' },
  unlock:             { label: 'فتح',                  color: '#34D399' },
  post:               { label: 'ترحيل',                color: '#60A5FA' },
  restore:            { label: 'استعادة',              color: '#A78BFA' },
  export:             { label: 'تصدير',                color: '#22D3EE' },
  reset:              { label: 'إعادة تعيين',          color: '#F87171' },
  close:              { label: 'إقفال',                color: '#FB923C' },
  reopen:             { label: 'إعادة فتح',            color: '#34D399' },
  paid:               { label: 'صرف رواتب',            color: '#34D399' },
  transfer:           { label: 'تحويل',                color: '#38BDF8' },
  /* عمليات مالية */
  price_override:     { label: 'تجاوز سعر',           color: '#FBBF24' },
  lock_period:        { label: 'إغلاق فترة',           color: '#F87171' },
  unlock_period:      { label: 'فتح فترة',             color: '#34D399' },
  lock_blocked:       { label: 'محاولة إغلاق مرفوضة', color: '#FB923C' },
  reversal_created:   { label: 'سند عكسي',             color: '#60A5FA' },
  correction_created: { label: 'سند تصحيحي',           color: '#A78BFA' },
  /* مخزون وتدقيق */
  INTEGRITY_REPAIR:        { label: 'إصلاح محاسبي',      color: '#FB7185' },
  INVENTORY_ADJUSTMENT:    { label: 'تسوية مخزون',       color: '#22D3EE' },
  INVENTORY_COUNT_APPLIED: { label: 'تطبيق جرد مخزون',  color: '#22D3EE' },
  INVENTORY_TRANSFER:      { label: 'تحويل مخزون',       color: '#38BDF8' },
  PERIOD_OVERRIDE:         { label: 'تجاوز إغلاق مالي', color: '#FB923C' },
  SAFE_TRANSFER_COMPLETED: { label: 'تحويل خزينة',       color: '#38BDF8' },
  /* الصيانة */
  repair_status_change: { label: 'تغيير حالة الصيانة', color: '#22D3EE' },
  repair_assign:        { label: 'تكليف فني',           color: '#38BDF8' },
  repair_complete:      { label: 'إتمام الصيانة',       color: '#34D399' },
  /* إدارة الشركات (SaaS) */
  COMPANY_CREATED:              { label: 'إنشاء شركة',             color: '#34D399' },
  COMPANY_UPDATED:              { label: 'تحديث شركة',             color: '#60A5FA' },
  COMPANY_ACTIVATED:            { label: 'تفعيل شركة',             color: '#34D399' },
  COMPANY_SUSPENDED:            { label: 'إيقاف شركة',             color: '#F59E0B' },
  COMPANY_EXTENDED:             { label: 'تمديد اشتراك',           color: '#38BDF8' },
  COMPANY_DELETED:              { label: 'حذف شركة',               color: '#EF4444' },
  COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك',           color: '#60A5FA' },
  ADMIN_PASSWORD_RESET:         { label: 'إعادة كلمة المرور',      color: '#A78BFA' },
  MANAGER_CREATED:              { label: 'إنشاء مدير',             color: '#34D399' },
  MANAGER_UPDATED:              { label: 'تحديث مدير',             color: '#60A5FA' },
  MANAGER_TOGGLED:              { label: 'تغيير حالة مدير',        color: '#F59E0B' },
  MANAGER_DELETED:              { label: 'حذف مدير',               color: '#EF4444' },
  PLAN_SETTINGS_UPDATED:        { label: 'تحديث إعدادات الخطة',   color: '#FBBF24' },
  TELEGRAM_SETTINGS_UPDATED:    { label: 'تحديث تليجرام',          color: '#38BDF8' },
  BACKUP_CREATED:               { label: 'نسخة احتياطية',          color: '#34D399' },
  TRIAL_MONITORING_WARNING:     { label: 'تحذير فترة تجريبية',     color: '#F59E0B' },
  /* النسخ الاحتياطية والاستعادة */
  RESTORE_STARTED:   { label: 'بدء استعادة',       color: '#A78BFA' },
  RESTORE_REJECTED:  { label: 'رفض استعادة',       color: '#EF4444' },
  RESTORE_FAILED:    { label: 'فشل استعادة',       color: '#EF4444' },
  RESTORE_COMPLETED: { label: 'اكتمال استعادة',    color: '#34D399' },
  /* وصول المدير العام */
  SUPER_ADMIN_ACCESS:    { label: 'وصول مدير عام',      color: '#818CF8' },
  SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
};

const RECORD_AR: Record<string, string> = {
  customer:          'عميل',
  supplier:          'مورد',
  sale:              'فاتورة بيع',
  sale_return:       'مرتجع مبيعات',
  purchase:          'فاتورة شراء',
  purchase_return:   'مرتجع مشتريات',
  product:           'منتج / صنف',
  financial_lock:    'قفل مالي',
  expense:           'مصروف',
  income:            'إيراد',
  safe_transfer:     'تحويل خزينة',
  receipt_voucher:   'سند قبض',
  payment_voucher:   'سند صرف',
  deposit_voucher:   'سند إيداع',
  treasury_voucher:  'سند خزينة',
  journal_entry:     'قيد يومية',
  user:              'مستخدم',
  erp_user:          'حساب مستخدم',
  account_balances:  'أرصدة الحسابات',
  customer_balances: 'أرصدة العملاء',
  employee:          'موظف',
  company:           'شركة',
  subscription:      'اشتراك',
  payroll_period:    'دورة رواتب',
  salary_advance:    'سلفة راتب',
  fiscal_year:       'سنة مالية',
  system:            'النظام',
  announcement:      'إعلان',
  warranty:          'ضمان',
  repair_job:        'بطاقة صيانة',
  trial_monitoring:  'مراقبة الفترة التجريبية',
  branch:            'فرع',
  device:            'جهاز',
  warehouse:         'مستودع',
  stock_transfer:    'تحويل مخزون',
  inventory_count:   'جرد مخزون',
};

export function TabAuditLog({ auditData, auditLoading, onRefetch, auditAction, setAuditAction, auditLimit, setAuditLimit }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header + controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>📋 سجل التدقيق الجنائي</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>كل إجراء قام به المدير العام مُسجَّل هنا</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (!auditData?.rows.length) return;
              const rows = auditData.rows.map(r =>
                `${r.action},${r.record_type},${r.record_id},${r.note ?? ''},${r.created_at}`
              ).join('\n');
              const blob = new Blob([`الإجراء,نوع السجل,رقم السجل,الملاحظة,التاريخ\n${rows}`], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'audit-log.csv'; a.click();
            }}
            style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#86EFAC', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}
          >📥 CSV</button>
          <select
            value={auditAction}
            onChange={e => setAuditAction(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}
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
            onChange={e => setAuditLimit(Number(e.target.value))}
            style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}
          >
            {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} سجل</option>)}
          </select>
          <button onClick={() => void onRefetch()} style={{
            padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.border}`,
            background: 'transparent', color: C.muted, fontSize: '13px',
            fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          }}>🔄 تحديث</button>
        </div>
      </div>

      {/* Table */}
      {auditLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>⏳ جارٍ التحميل...</div>
      ) : (
        <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
            padding: '12px 20px', background: 'rgba(255,255,255,0.03)',
            borderBottom: `1px solid ${C.border}`,
            fontSize: '11px', fontWeight: 800, color: C.muted, gap: '12px',
          }}>
            <span>الإجراء</span><span>النوع</span><span>رقم السجل</span><span>الملاحظة</span><span>التاريخ</span>
          </div>
          {!auditData?.rows.length ? (
            <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>لا توجد سجلات</div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {auditData!.rows.map(row => {
                const actionMeta = ACTION_AR[row.action] ?? { label: row.action, color: '#94A3B8' };
                return (
                  <div key={row.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 80px 2fr 140px',
                    padding: '12px 20px', gap: '12px',
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: '12px', alignItems: 'center',
                  }}>
                    <span style={{ color: actionMeta.color, fontWeight: 700 }}>{actionMeta.label}</span>
                    <span style={{ color: C.muted }}>{RECORD_AR[row.record_type] ?? row.record_type}</span>
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
          {auditData && (
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, fontSize: '12px', color: C.muted }}>
              إجمالي السجلات المعروضة: {auditData!.count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
