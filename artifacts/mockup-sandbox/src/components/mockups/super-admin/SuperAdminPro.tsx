import { useState } from 'react';

const C = {
  bg: '#0F172A',
  card: '#1E293B',
  card2: '#162032',
  border: '#334155',
  orange: '#F97316',
  text: '#F8FAFC',
  muted: '#94A3B8',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  blue: '#3B82F6',
  purple: '#7C3AED',
  indigo: '#6366F1',
};

const FONT = "'Tajawal','Cairo',sans-serif";

const companies = [
  { id: 1, name: 'مجموعة النور التجارية', edition: 'advanced', plan: 'paid', status: 'active', users: 12, days: 45, email: 'admin@noor.sa' },
  { id: 2, name: 'شركة الأفق للاستيراد', edition: 'pro', plan: 'trial', status: 'trial', users: 3, days: 8, email: 'info@ufq.sa' },
  { id: 3, name: 'مؤسسة البناء الحديث', edition: 'advanced', plan: 'paid', status: 'active', users: 27, days: 120, email: 'ceo@bena.sa' },
  { id: 4, name: 'متاجر الريادة', edition: 'pro', plan: 'paid', status: 'active', users: 6, days: 3, email: 'ops@riada.sa' },
  { id: 5, name: 'شركة الوطن للخدمات', edition: 'pro', plan: 'trial', status: 'expired', users: 2, days: -5, email: 'hr@watan.sa' },
];

const stats = [
  { label: 'إجمالي الشركات', value: '48', sub: '+3 هذا الشهر', icon: '🏢', color: C.blue },
  { label: 'الشركات النشطة', value: '41', sub: '85% من الإجمالي', icon: '✅', color: C.success },
  { label: 'نسخة Advanced', value: '29', sub: '60% من النشطين', icon: '🚀', color: C.warning },
  { label: 'تجريبي (Trial)', value: '7', sub: 'تنتهي خلال 14 يوم', icon: '⏳', color: C.orange },
  { label: 'إجمالي المستخدمين', value: '347', sub: '+18 هذا الأسبوع', icon: '👥', color: C.purple },
  { label: 'ستنتهي قريباً', value: '5', sub: 'خلال 7 أيام', icon: '⚠️', color: C.danger },
];

function StatCard({ stat }: { stat: typeof stats[0] }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px',
      padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start',
      flex: '1 1 150px', minWidth: '150px',
      boxShadow: `0 0 0 1px rgba(255,255,255,0.03)`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '60px', height: '60px',
        background: `radial-gradient(circle at top right, ${stat.color}22, transparent 70%)`,
      }} />
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', fontSize: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${stat.color}18`, border: `1px solid ${stat.color}33`,
      }}>{stat.icon}</div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, lineHeight: 1 }}>{stat.value}</div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: C.muted, marginTop: '4px' }}>{stat.label}</div>
        <div style={{ fontSize: '10px', color: stat.color, marginTop: '3px', fontWeight: 600 }}>{stat.sub}</div>
      </div>
    </div>
  );
}

function EditionBadge({ edition }: { edition: string }) {
  const isAdv = edition === 'advanced';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '20px',
      background: isAdv ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
      border: `1px solid ${isAdv ? 'rgba(245,158,11,0.35)' : 'rgba(99,102,241,0.35)'}`,
      fontSize: '11px', fontWeight: 700,
      color: isAdv ? '#FCD34D' : '#A5B4FC',
    }}>
      <span style={{ fontSize: '12px' }}>{isAdv ? '🚀' : '⭐'}</span>
      {isAdv ? 'MuhKam Advanced' : 'MuhKam Pro'}
    </div>
  );
}

function StatusBadge({ status, days }: { status: string; days: number }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    active: { color: '#22C55E', bg: 'rgba(34,197,94,0.1)', label: 'نشط' },
    trial: { color: '#F97316', bg: 'rgba(249,115,22,0.1)', label: 'تجريبي' },
    expired: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: 'منتهي' },
    suspended: { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', label: 'موقوف' },
  };
  const s = cfg[status] ?? cfg.active;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
      <span style={{
        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
        color: s.color, background: s.bg, border: `1px solid ${s.color}44`,
      }}>{s.label}</span>
      {days > 0
        ? <span style={{ fontSize: '10px', color: days < 7 ? C.danger : C.muted }}>{days} يوم متبقي</span>
        : <span style={{ fontSize: '10px', color: C.danger }}>انتهى منذ {Math.abs(days)} يوم</span>
      }
    </div>
  );
}

function EditionSwitcher({ company, onSwitch }: { company: typeof companies[0]; onSwitch: (id: number, edition: string) => void }) {
  const isAdv = company.edition === 'advanced';
  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ fontSize: '11px', color: C.muted, fontWeight: 600, marginBottom: '8px' }}>
        🏷️ تغيير نسخة المنتج
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { key: 'pro', label: 'MuhKam Pro', icon: '⭐', sub: 'نسخة أساسية — للمشاريع الصغيرة', color: C.indigo },
          { key: 'advanced', label: 'MuhKam Advanced', icon: '🚀', sub: 'نسخة متكاملة — للمؤسسات', color: C.warning },
        ].map((opt) => {
          const active = company.edition === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onSwitch(company.id, opt.key)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
                border: `2px solid ${active ? opt.color : C.border}`,
                background: active ? `${opt.color}18` : C.bg,
                display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start',
                transition: 'all 0.2s', fontFamily: FONT, textAlign: 'right',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: active ? opt.color : C.text }}>{opt.label}</span>
                {active && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
                    color: opt.color, background: `${opt.color}22`,
                    padding: '1px 7px', borderRadius: '8px',
                  }}>✓ الحالي</span>
                )}
              </div>
              <span style={{ fontSize: '10px', color: C.muted }}>{opt.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompanyRow({ company }: { company: typeof companies[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [edition, setEdition] = useState(company.edition);
  const [toast, setToast] = useState('');

  const handleSwitch = (id: number, ed: string) => {
    setEdition(ed);
    setToast(`✅ تم تغيير النسخة إلى ${ed === 'advanced' ? 'MuhKam Advanced' : 'MuhKam Pro'}`);
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden',
      background: C.card, marginBottom: '8px',
      boxShadow: expanded ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {toast && (
        <div style={{
          background: '#1a2e1a', border: '1px solid rgba(34,197,94,0.4)',
          padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: C.success,
          textAlign: 'center',
        }}>{toast}</div>
      )}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
          gap: '12px', padding: '14px 20px', alignItems: 'center', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{company.name}</div>
          <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{company.email}</div>
        </div>
        <EditionBadge edition={edition} />
        <StatusBadge status={company.status} days={company.days} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: C.orange }}>{company.users}</div>
          <div style={{ fontSize: '10px', color: C.muted }}>مستخدم</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '18px', color: C.muted, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px 20px', borderTop: `1px solid ${C.border}`, background: 'rgba(15,23,42,0.5)' }}>
          <EditionSwitcher company={{ ...company, edition }} onSwitch={handleSwitch} />

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            {[
              { label: 'تمديد 30 يوم', icon: '⏳', color: C.warning },
              { label: 'ترقية إلى مدفوع', icon: '⭐', color: C.orange },
              { label: 'إعادة كلمة المرور', icon: '🔑', color: C.purple },
              { label: company.status === 'active' ? 'إيقاف الشركة' : 'تفعيل الشركة', icon: company.status === 'active' ? '⛔' : '✅', color: company.status === 'active' ? C.danger : C.success },
            ].map((btn) => (
              <button key={btn.label} style={{
                padding: '8px 14px', borderRadius: '10px', border: `1px solid ${btn.color}44`,
                background: `${btn.color}12`, color: btn.color, fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SuperAdminPro() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pro' | 'advanced'>('all');

  const filtered = companies.filter(c => {
    const matchSearch = c.name.includes(search) || c.email.includes(search);
    const matchFilter = filter === 'all' || c.edition === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: FONT, padding: '24px', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: C.text, margin: 0 }}>
            🛡️ لوحة المدير العام
          </h1>
          <p style={{ fontSize: '12px', color: C.muted, margin: '4px 0 0' }}>
            MUHKAM SaaS — إدارة الشركات والاشتراكات
          </p>
        </div>
        <button style={{
          padding: '10px 18px', borderRadius: '12px', border: 'none',
          background: `linear-gradient(135deg, ${C.orange}, #ea580c)`,
          color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 4px 12px rgba(249,115,22,0.35)',
        }}>
          ＋ إضافة شركة جديدة
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
        {stats.map(s => <StatCard key={s.label} stat={s} />)}
      </div>

      {/* Search & Filter */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 بحث بالاسم أو البريد..."
          style={{
            flex: 1, minWidth: '220px', padding: '10px 14px', borderRadius: '12px',
            border: `1.5px solid ${C.border}`, background: C.card, color: C.text,
            fontSize: '13px', fontFamily: FONT, outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'all', label: 'الكل' },
            { key: 'pro', label: '⭐ MuhKam Pro' },
            { key: 'advanced', label: '🚀 Advanced' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              style={{
                padding: '8px 14px', borderRadius: '10px', cursor: 'pointer',
                border: `1.5px solid ${filter === f.key ? C.orange : C.border}`,
                background: filter === f.key ? `${C.orange}18` : C.card,
                color: filter === f.key ? C.orange : C.muted,
                fontSize: '12px', fontWeight: 700, fontFamily: FONT,
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Companies List */}
      <div>
        {filtered.map(c => <CompanyRow key={c.id} company={c} />)}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
            لا توجد شركات تطابق البحث
          </div>
        )}
      </div>
    </div>
  );
}
