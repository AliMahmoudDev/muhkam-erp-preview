import { C, FONT, type ActiveTab, type Stats } from './types';
import type { HealthData, OverviewAuditRow, SettingsCard } from './overview/overview-types';
import { OverviewKpiCards } from './overview/OverviewKpiCards';
import { OverviewHealthCards } from './overview/OverviewHealthCards';
import { OverviewActivity } from './overview/OverviewActivity';

interface Props {
  healthData?: HealthData;
  healthLoading: boolean;
  stats?: Stats;
  overviewAudit?: { count: number; rows: OverviewAuditRow[] };
  setActiveTab: (t: ActiveTab) => void;
  setStatusFilter: (v: string) => void;
  setSettingsActiveCard: (v: SettingsCard | null) => void;
}

const OV_ACTION_AR: Record<string, { label: string; color: string }> = {
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
  /* مخزون */
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
  /* إدارة الشركات */
  COMPANY_CREATED:              { label: 'إنشاء شركة',           color: '#34D399' },
  COMPANY_UPDATED:              { label: 'تحديث شركة',           color: '#60A5FA' },
  COMPANY_ACTIVATED:            { label: 'تفعيل شركة',           color: '#34D399' },
  COMPANY_SUSPENDED:            { label: 'إيقاف شركة',           color: '#F59E0B' },
  COMPANY_EXTENDED:             { label: 'تمديد اشتراك',         color: '#38BDF8' },
  COMPANY_DELETED:              { label: 'حذف شركة',             color: '#EF4444' },
  COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك',         color: '#60A5FA' },
  ADMIN_PASSWORD_RESET:         { label: 'إعادة كلمة المرور',    color: '#A78BFA' },
  MANAGER_CREATED:              { label: 'إنشاء مدير',           color: '#34D399' },
  MANAGER_UPDATED:              { label: 'تحديث مدير',           color: '#60A5FA' },
  MANAGER_TOGGLED:              { label: 'تغيير حالة مدير',      color: '#F59E0B' },
  MANAGER_DELETED:              { label: 'حذف مدير',             color: '#EF4444' },
  PLAN_SETTINGS_UPDATED:        { label: 'تحديث إعدادات الخطة', color: '#FBBF24' },
  TELEGRAM_SETTINGS_UPDATED:    { label: 'تحديث تليجرام',        color: '#38BDF8' },
  BACKUP_CREATED:               { label: 'نسخة احتياطية',        color: '#34D399' },
  TRIAL_MONITORING_WARNING:     { label: 'تحذير فترة تجريبية',   color: '#F59E0B' },
  /* الاستعادة */
  RESTORE_STARTED:   { label: 'بدء استعادة',      color: '#A78BFA' },
  RESTORE_REJECTED:  { label: 'رفض استعادة',      color: '#EF4444' },
  RESTORE_FAILED:    { label: 'فشل استعادة',      color: '#EF4444' },
  RESTORE_COMPLETED: { label: 'اكتمال استعادة',   color: '#34D399' },
  /* وصول مدير عام */
  SUPER_ADMIN_ACCESS:    { label: 'وصول مدير عام',      color: '#818CF8' },
  SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
};

export function TabOverview({ healthData, healthLoading, stats, overviewAudit, setActiveTab, setStatusFilter, setSettingsActiveCard }: Props) {
  const ovHealth  = healthData?.health;
  const healthColor = ovHealth?.status === 'healthy' ? '#34D399' : ovHealth?.status === 'degraded' ? '#F59E0B' : '#EF4444';
  const healthLabel = ovHealth?.status === 'healthy' ? 'يعمل بشكل طبيعي' : ovHealth?.status === 'degraded' ? 'أداء منخفض' : 'مشكلة حرجة';
  const expiringSoon = (stats?.expiringSoonList ?? []).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>🏠 نظرة عامة على النظام</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {ovHealth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: `${healthColor}15`, border: `1px solid ${healthColor}40` }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, display: 'inline-block', boxShadow: `0 0 8px ${healthColor}` }} />
            <span style={{ color: healthColor, fontWeight: 800, fontSize: '13px' }}>{healthLabel}</span>
          </div>
        )}
      </div>

      {/* Row 1 — 4 big KPI cards */}
      <OverviewKpiCards
        stats={stats}
        setActiveTab={setActiveTab}
        setStatusFilter={setStatusFilter}
        setSettingsActiveCard={setSettingsActiveCard}
      />

      {/* Row 2 — Server Health + API metrics */}
      <OverviewHealthCards
        healthData={healthData}
        healthLoading={healthLoading}
        setActiveTab={setActiveTab}
      />

      {/* Row 3 — Expiring soon + Recent audit */}
      <OverviewActivity
        expiringSoon={expiringSoon}
        overviewAudit={overviewAudit}
        actionMap={OV_ACTION_AR}
        setActiveTab={setActiveTab}
        setSettingsActiveCard={setSettingsActiveCard}
      />

      {/* Row 4 — Quick-access shortcuts */}
      <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
        <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>⚡ وصول سريع</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: '🏢 إدارة الشركات',       tab: 'companies' as const },
            { label: '📊 لوحة الإيرادات',       tab: 'revenue'   as const },
            { label: '🔔 مركز التنبيهات',       tab: 'alerts'    as const },
            { label: '⚙️ الإعدادات والأمان',    tab: 'settings'  as const },
          ].map(s => (
            <button key={s.tab} onClick={() => setActiveTab(s.tab)} style={{
              padding: '10px 18px', borderRadius: '10px', border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text, fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.orange; (e.currentTarget as HTMLButtonElement).style.color = C.orange; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
            >{s.label}</button>
          ))}
        </div>
      </div>

    </div>
  );
}
