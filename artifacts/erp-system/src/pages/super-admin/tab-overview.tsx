import { C, FONT, type Stats } from './types';

interface HealthData {
  health: { status: string; db: boolean; memory_mb: number; uptime_hours: number; db_read_latency_ms: number; db_write_latency_ms: number };
  metrics: { total_requests: number; status_codes: Record<string, number>; latency_ms: { p50: number; p95: number; p99: number; samples: number } };
  pool: { total: number; idle: number; waiting: number };
  memory: { heap_used_mb: number; rss_mb: number };
  process: { uptime_hours: number; node_version: string; pid: number; env: string };
  timestamp: string;
}

interface AuditRow {
  id: number; action: string; record_type: string; record_id: number;
  user_id: number | null; username: string | null; note: string | null;
  company_id: number | null; created_at: string;
}

type ActiveTab = 'overview' | 'companies' | 'managers' | 'settings' | 'revenue' | 'alerts' | 'announcements' | 'health' | 'plans' | 'monitoring' | 'audit_log';
type SettingsCard = 'support' | 'backup' | 'security' | 'audit_log' | 'managers' | 'plans' | 'telegram';

interface Props {
  healthData?: HealthData;
  healthLoading: boolean;
  stats?: Stats;
  overviewAudit?: { count: number; rows: AuditRow[] };
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
  const ovMetrics = healthData?.metrics;
  const healthColor = ovHealth?.status === 'healthy' ? '#34D399' : ovHealth?.status === 'degraded' ? '#F59E0B' : '#EF4444';
  const healthLabel = ovHealth?.status === 'healthy' ? 'يعمل بشكل طبيعي' : ovHealth?.status === 'degraded' ? 'أداء منخفض' : 'مشكلة حرجة';
  const expiringSoon = (stats?.expiringSoonList ?? []).slice(0, 5);
  const totalR  = ovMetrics?.total_requests ?? 0;
  const ok2xx   = (ovMetrics?.status_codes?.['200'] ?? 0) + (ovMetrics?.status_codes?.['201'] ?? 0);
  const err5xx  = Object.entries(ovMetrics?.status_codes ?? {}).filter(([k]) => k.startsWith('5')).reduce((s, [, v]) => s + v, 0);

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { icon: '🏢', label: 'الشركات النشطة',    value: stats?.active ?? '—',       sub: `من إجمالي ${stats?.total ?? '—'} شركة`,                      color: '#34D399', action: () => { setActiveTab('companies'); setStatusFilter('active'); } },
          { icon: '⚠️', label: 'تنتهي خلال 7 أيام', value: stats?.expiringSoon ?? '—',  sub: 'تحتاج تجديد عاجل',                                           color: '#F59E0B', action: () => setActiveTab('alerts') },
          { icon: '👥', label: 'إجمالي المستخدمين',  value: stats?.totalUsers ?? '—',    sub: `${stats?.recentSignups ?? 0} انضموا هذا الشهر`,               color: '#60A5FA', action: () => { setActiveTab('settings'); setSettingsActiveCard('managers'); } },
          { icon: (stats?.expired ?? 0) > 0 ? '⛔' : '✅', label: 'اشتراكات منتهية', value: stats?.expired ?? '—', sub: `${stats?.suspended ?? 0} موقوفة إضافياً`, color: (stats?.expired ?? 0) > 0 ? '#EF4444' : '#34D399', action: () => { setActiveTab('companies'); setStatusFilter('expired'); } },
        ].map(kpi => (
          <div key={kpi.label} onClick={kpi.action} style={{
            background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, borderTop: `3px solid ${kpi.color}`,
            padding: '22px 20px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${kpi.color}20`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{kpi.icon}</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginTop: '8px' }}>{kpi.label}</div>
            <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 2 — Server Health + API metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>🌡️ صحة السيرفر</h3>
          {healthLoading ? (
            <div style={{ color: C.muted, fontSize: '13px' }}>⏳ جارٍ الفحص...</div>
          ) : ovHealth ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'قاعدة البيانات', value: ovHealth.db ? '✅ متصلة' : '❌ منقطعة', color: ovHealth.db ? '#34D399' : '#EF4444' },
                { label: 'استهلاك الذاكرة', value: `${ovHealth.memory_mb} MB`, color: ovHealth.memory_mb > 400 ? '#F59E0B' : '#34D399' },
                { label: 'وقت التشغيل', value: `${ovHealth.uptime_hours} ساعة`, color: '#60A5FA' },
                { label: 'استجابة DB', value: ovHealth.db_read_latency_ms >= 0 ? `${ovHealth.db_read_latency_ms} ms` : 'غير متاح', color: (ovHealth.db_read_latency_ms ?? 0) > 200 ? '#F59E0B' : '#34D399' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: C.muted }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
              <button onClick={() => setActiveTab('health')}
                style={{ marginTop: '8px', padding: '8px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}>
                عرض التفاصيل الكاملة ←
              </button>
            </div>
          ) : <div style={{ color: C.muted, fontSize: '13px' }}>البيانات غير متاحة</div>}
        </div>

        <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
          <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>📡 مؤشرات الـ API</h3>
          {ovMetrics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'إجمالي الطلبات',         value: totalR.toLocaleString('ar-EG'),                                           color: '#60A5FA' },
                { label: 'طلبات ناجحة (2xx)',       value: ok2xx.toLocaleString('ar-EG'),                                             color: '#34D399' },
                { label: 'أخطاء سيرفر (5xx)',       value: err5xx.toLocaleString('ar-EG'),                                            color: err5xx > 0 ? '#EF4444' : '#34D399' },
                { label: 'زمن الاستجابة p95',       value: `${ovMetrics.latency_ms?.p95 ?? 0} ms`,                                    color: (ovMetrics.latency_ms?.p95 ?? 0) > 500 ? '#F59E0B' : '#34D399' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: C.muted }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ color: C.muted, fontSize: '13px' }}>⏳ جارٍ التحميل...</div>}
        </div>
      </div>

      {/* Row 3 — Expiring soon + Recent audit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>⚠️ تنتهي قريباً</h3>
            <button onClick={() => setActiveTab('alerts')}
              style={{ fontSize: '12px', color: C.orange, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
              عرض الكل ←
            </button>
          </div>
          {expiringSoon.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>✅ لا توجد اشتراكات تنتهي قريباً</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expiringSoon.map(co => (
                <div key={co.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: '10px',
                  background: co.days_left <= 3 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                  border: `1px solid ${co.days_left <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{co.name}</div>
                    <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                      {new Date(co.end_date).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: co.days_left <= 3 ? '#EF4444' : '#F59E0B' }}>
                    {co.days_left} يوم
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>📋 آخر الإجراءات</h3>
            <button onClick={() => { setActiveTab('settings'); setSettingsActiveCard('audit_log'); }}
              style={{ fontSize: '12px', color: C.orange, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT }}>
              سجل التدقيق ←
            </button>
          </div>
          {!overviewAudit?.rows.length ? (
            <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>لا توجد سجلات</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {overviewAudit.rows.map(row => {
                const meta = OV_ACTION_AR[row.action] ?? { label: row.action, color: '#94A3B8' };
                const ts = new Date(row.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
                return (
                  <div key={row.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30`, padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>{meta.label}</span>
                    <span style={{ fontSize: '12px', color: C.text, flex: 1 }}>{row.username ?? '—'}</span>
                    <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{ts}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
