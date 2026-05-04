import React from 'react';
import {
  type Company, type Stats, type CompanyFeatures,
  STATUS, translatePlan, C, FONT,
} from './types';
import { AnimatedNumber, ActionBtn, PageBtn } from './ui';

type ActiveTab =
  | 'overview' | 'companies' | 'managers' | 'settings'
  | 'revenue' | 'alerts' | 'announcements' | 'health' | 'plans' | 'monitoring' | 'audit_log';

interface StatCard {
  label: string;
  value: number;
  icon: string;
  color: string;
  sub: string;
  filter: string | null;
  tab: ActiveTab;
}

interface SubForm {
  plan_type: string;
  edition: 'advanced' | 'ultimate';
  extend_mode: 'days' | 'date';
  extend_days: number;
  end_date: string;
  is_active: boolean;
  features: CompanyFeatures;
}

interface CreateResult {
  company_name: string;
  username: string;
  admin_name: string;
  temp_password: string;
}

interface CoMutate {
  mutate: (
    args: { url: string; method?: string; body?: object },
    options?: { onSuccess?: (data: unknown) => void }
  ) => void;
  isPending: boolean;
}

interface ResetPasswordMutate {
  mutate: (args: { id: number; company_name: string }) => void;
}

interface Props {
  stats: Stats | undefined;
  companies: Company[];
  filtered: Company[];
  paged: Company[];
  coLoading: boolean;
  statCards: StatCard[];
  STATUS_FILTERS: { key: string; label: string }[];
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  setActiveTab: (t: ActiveTab) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  perPage: number;
  setPerPage: (v: number) => void;
  totalPages: number;
  safePage: number;
  viewMode: 'table' | 'cards';
  setViewMode: (v: 'table' | 'cards') => void;
  expandedId: number | null;
  setExpandedId: (v: number | null) => void;
  showCreate: boolean;
  setShowCreate: React.Dispatch<React.SetStateAction<boolean>>;
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
  setCreateResult: (v: CreateResult | null) => void;
  setSubModal: (v: Company | null) => void;
  setSubForm: React.Dispatch<React.SetStateAction<SubForm>>;
  setPanelTab: (v: 0 | 1 | 2 | 3) => void;
  setSnapshotCompany: (v: number | null) => void;
  setDeleteTarget: (v: Company | null) => void;
  setDeleteCoErr: (v: string) => void;
  DEFAULT_FEATS_ULTIMATE: CompanyFeatures;
  DEFAULT_FEATS_ADVANCED: CompanyFeatures;
  coMutate: CoMutate;
  resetPassword: ResetPasswordMutate;
  expiryInfo: (co: Company) => { text: string; color: string };
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function TabCompanies({
  stats,
  companies,
  filtered,
  paged,
  coLoading,
  statCards,
  STATUS_FILTERS,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  setActiveTab,
  page: _page,
  setPage,
  perPage,
  setPerPage,
  totalPages,
  safePage,
  viewMode,
  setViewMode,
  expandedId,
  setExpandedId,
  showCreate,
  setShowCreate,
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
  setCreateResult,
  setSubModal,
  setSubForm,
  setPanelTab,
  setSnapshotCompany,
  setDeleteTarget,
  setDeleteCoErr,
  DEFAULT_FEATS_ULTIMATE,
  DEFAULT_FEATS_ADVANCED,
  coMutate,
  resetPassword,
  expiryInfo,
}: Props) {
  return (
    <>
      {/* Stats cards — 8 in one row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={() => {
              setActiveTab(s.tab);
              if (s.filter !== null && s.tab === 'companies') setStatusFilter(s.filter);
              setTimeout(() => {
                document.getElementById('companies-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
            style={{
              background: C.card,
              borderRadius: '14px',
              border: `1px solid ${C.border}`,
              borderTop: `3px solid ${s.color}`,
              padding: '16px 10px 14px',
              textAlign: 'center',
              transition: 'all 0.2s',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              position: 'absolute', top: '-10px', right: '-10px',
              width: '50px', height: '50px', borderRadius: '50%',
              background: `${s.color}18`, pointerEvents: 'none',
            }} />
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>
              <AnimatedNumber target={s.value} />
            </div>
            <div style={{ fontSize: '11px', color: C.text, marginTop: '6px', fontWeight: 700, lineHeight: 1.3 }}>
              {s.label}
            </div>
            <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>{s.sub}</div>
            <div style={{
              position: 'absolute', bottom: '6px', left: '8px',
              fontSize: '10px', color: s.color, opacity: 0.6,
            }}>↗</div>
          </div>
        ))}
      </div>

      {/* Expiring Soon Alert */}
      {stats && stats.expiringSoon > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1.5px solid rgba(239,68,68,0.3)',
          borderRadius: '16px',
          padding: '18px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span style={{ fontWeight: 800, color: C.danger, fontSize: '15px' }}>
              {stats.expiringSoon} شركة اشتراكها ينتهي خلال 7 أيام
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats.expiringSoonList.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: C.card, borderRadius: '10px', padding: '10px 16px',
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: c.days_left <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)',
                    color: c.days_left <= 2 ? C.danger : C.warning,
                    borderRadius: '8px', padding: '3px 10px',
                    fontSize: '13px', fontWeight: 700,
                  }}>
                    {c.days_left === 0 ? 'ينتهي اليوم' : `${c.days_left} يوم`}
                  </span>
                  <span style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>{c.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: C.muted }}>{c.end_date}</span>
                  <button
                    onClick={() => coMutate.mutate({
                      url: `/api/super/companies/${c.id}/extend`,
                      body: { days: 30, plan_type: c.plan_type },
                    })}
                    style={{
                      padding: '5px 12px', borderRadius: '8px',
                      border: '1px solid rgba(249,115,22,0.4)',
                      background: 'rgba(249,115,22,0.1)',
                      color: C.warning, fontSize: '12px',
                      fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    ⏳ تمديد 30 يوم
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Signups — Compact Strip */}
      {stats && stats.monthlySignups && stats.monthlySignups.some(m => m.count > 0) && (() => {
        const raw = stats.monthlySignups;
        const total = raw.reduce((s, m) => s + m.count, 0);
        const last = raw[raw.length - 1]?.count ?? 0;
        const prev = raw[raw.length - 2]?.count ?? 0;
        const growthPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
        const growing = growthPct >= 0;
        const maxVal = Math.max(...raw.map(m => m.count), 1);
        return (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '16px', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '20px',
          }}>
            <div style={{ flexShrink: 0, borderLeft: `3px solid ${C.orange}`, paddingLeft: '14px' }}>
              <div style={{ fontSize: '11px', color: C.muted, marginBottom: '4px', whiteSpace: 'nowrap' }}>
                التسجيلات — آخر 6 أشهر
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 900, color: C.orange, lineHeight: 1 }}>
                  {total}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  padding: '2px 8px', borderRadius: '20px',
                  background: growing ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: growing ? C.success : C.danger,
                  border: `1px solid ${growing ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  {growing ? '↑' : '↓'}{Math.abs(growthPct)}%
                </span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              {raw.map((m, i) => {
                const pct = maxVal > 0 ? m.count / maxVal : 0;
                const isLast = i === raw.length - 1;
                const barH = Math.max(pct * 36, m.count > 0 ? 4 : 2);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      fontSize: '13px', fontWeight: isLast ? 900 : 600,
                      color: isLast ? C.orange : m.count > 0 ? C.text : C.muted,
                    }}>{m.count || '—'}</div>
                    <div style={{
                      width: '100%', height: `${barH}px`, borderRadius: '4px',
                      background: isLast
                        ? `linear-gradient(to top, ${C.orange}, ${C.warning})`
                        : m.count > 0 ? `rgba(249,115,22,${0.2 + pct * 0.5})` : C.border,
                    }} />
                    <div style={{
                      fontSize: '10px', color: isLast ? C.orange : C.muted,
                      fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap',
                    }}>{m.month}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Companies table card */}
      <div
        id="companies-table"
        style={{
          background: C.card, borderRadius: '20px',
          border: `1px solid ${C.border}`, overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>
              الشركات المسجّلة
            </h2>
            <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>
              عرض {filtered.length} من {companies.length} شركة
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px',
              background: showCreate ? 'transparent' : C.orange,
              color: showCreate ? C.muted : '#fff',
              border: showCreate ? `1px solid ${C.border}` : 'none',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              transition: 'all 0.18s', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '15px' }}>{showCreate ? '✕' : '+'}</span>
            <span>{showCreate ? 'إلغاء' : 'شركة جديدة'}</span>
          </button>
        </div>

        {/* Search + filter + per-page + view mode */}
        <div
          style={{
            padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
            <span style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن شركة…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 36px 8px 12px', borderRadius: '10px',
                border: `1.5px solid ${C.border}`, background: C.bg,
                color: C.text, fontSize: '13px', fontFamily: FONT,
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                    fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    transition: 'all 0.15s',
                    border: active ? 'none' : `1px solid ${C.border}`,
                    background: active ? C.orange : 'transparent',
                    color: active ? '#fff' : C.muted,
                  }}
                >{f.label}</button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' }}>عدد الصفوف:</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              style={{
                padding: '6px 10px', borderRadius: '8px', border: `1px solid ${C.border}`,
                background: C.bg, color: C.text, fontSize: '12px',
                fontFamily: FONT, cursor: 'pointer', outline: 'none',
              }}
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: C.bg, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '3px' }}>
            {(['table', 'cards'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                title={m === 'table' ? 'عرض جدول' : 'عرض بطاقات'}
                style={{
                  padding: '5px 10px', borderRadius: '7px', border: 'none',
                  background: viewMode === m ? C.orange : 'transparent',
                  color: viewMode === m ? '#fff' : C.muted,
                  fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1,
                }}
              >
                {m === 'table' ? '☰' : '⊞'}
              </button>
            ))}
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{
            padding: '20px 24px', background: 'rgba(249,115,22,0.06)',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 200px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  اسم الشركة *
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: شركة الأمل التجارية"
                  style={{
                    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: '10px',
                    padding: '10px 14px', fontSize: '14px', outline: 'none',
                    fontFamily: FONT, boxSizing: 'border-box', background: C.bg, color: C.text,
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                />
              </div>
              <div style={{ flex: '1 1 130px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  نوع الاشتراك
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  style={{
                    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: '10px',
                    padding: '10px 12px', fontSize: '14px', background: C.bg,
                    color: C.text, fontFamily: FONT,
                  }}
                >
                  <option value="trial">تجريبي</option>
                  <option value="basic">أساسي</option>
                  <option value="professional">احترافي</option>
                  <option value="paid">مدفوع</option>
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  🏷️ نسخة النظام
                </label>
                <select
                  value={newEdition}
                  onChange={(e) => setNewEdition(e.target.value as 'advanced' | 'ultimate')}
                  style={{
                    width: '100%',
                    border: `1.5px solid ${newEdition === 'ultimate' ? '#6366f1' : '#f59e0b'}`,
                    borderRadius: '10px', padding: '10px 12px', fontSize: '14px',
                    background: C.bg,
                    color: newEdition === 'ultimate' ? '#a5b4fc' : '#fcd34d',
                    fontFamily: FONT, fontWeight: 700,
                  }}
                >
                  <option value="ultimate">⭐ MUHKAM ULTIMATE (كاملة)</option>
                  <option value="advanced">🚀 MUHKAM ADVANCED (متوسطة)</option>
                </select>
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  المدة (أيام)
                </label>
                <select
                  value={newDays}
                  onChange={(e) => setNewDays(Number(e.target.value))}
                  style={{
                    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: '10px',
                    padding: '10px 12px', fontSize: '14px', background: C.bg,
                    color: C.text, fontFamily: FONT,
                  }}
                >
                  {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                    <option key={d} value={d}>{d} يوم</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  اسم المدير *
                </label>
                <input
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  style={{
                    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: '10px',
                    padding: '10px 14px', fontSize: '14px', outline: 'none',
                    fontFamily: FONT, boxSizing: 'border-box', background: C.bg, color: C.text,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
                />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: C.muted, display: 'block', marginBottom: '6px' }}>
                  اسم مستخدم المدير
                  <span style={{ fontWeight: 400, color: C.muted, marginRight: '4px' }}>(اختياري)</span>
                </label>
                <input
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  placeholder="مثال: ahmed_mgr"
                  dir="ltr"
                  style={{
                    width: '100%', border: `1.5px solid ${C.border}`, borderRadius: '10px',
                    padding: '10px 14px', fontSize: '14px', outline: 'none',
                    fontFamily: 'monospace', boxSizing: 'border-box', background: C.bg, color: C.text,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
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
                        setNewName(''); setNewPlan('trial'); setNewEdition('ultimate'); setNewDays(14);
                        setNewAdminName(''); setNewAdminUsername('');
                        const d = data as { company?: { name?: string }; admin?: { username?: string; name?: string; temp_password?: string } } | null;
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
                  padding: '10px 22px', borderRadius: '10px', border: 'none',
                  background: (newName.trim() && newAdminName.trim()) ? C.orange : C.border,
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                  cursor: (newName.trim() && newAdminName.trim()) ? 'pointer' : 'default',
                  fontFamily: FONT, flexShrink: 0, transition: 'filter 0.15s',
                  alignSelf: 'flex-end', marginBottom: '20px',
                }}
              >
                {coMutate.isPending ? 'جاري الإنشاء...' : '🏢 إنشاء الشركة'}
              </button>
            </div>
          </div>
        )}

        {/* Table / Cards body */}
        {coLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
            جاري التحميل...
          </div>
        ) : paged.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: C.muted }}>
            {search || statusFilter !== 'all'
              ? 'لا توجد نتائج مطابقة للبحث'
              : 'لا توجد شركات مسجّلة بعد'}
          </div>
        ) : viewMode === 'cards' ? (
          <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {paged.map((co) => {
              const st = STATUS[co.status] ?? STATUS.active;
              const expiry = expiryInfo(co);
              return (
                <div
                  key={co.id}
                  style={{
                    background: C.bg, borderRadius: '14px',
                    border: `1.5px solid ${C.border}`, padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    transition: 'border-color 0.18s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.orange; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: C.orangeDim, border: '1px solid rgba(249,115,22,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', flexShrink: 0,
                    }}>🏢</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{co.name}</div>
                      <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{co.admin_email ?? '—'}</div>
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 8px',
                      borderRadius: '20px', background: st.bg, color: st.text, whiteSpace: 'nowrap',
                    }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: C.muted }}>الخطة</span>
                      <span style={{ color: C.text, fontWeight: 700 }}>{translatePlan(co.plan_type)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: C.muted }}>الانتهاء</span>
                      <span style={{ color: expiry.color, fontWeight: 600, fontSize: '11px' }}>{expiry.text}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: C.muted }}>المستخدمون</span>
                      <span style={{ color: C.text, fontWeight: 700 }}>{co.userCount ?? 0}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', paddingTop: '4px', flexWrap: 'wrap' }}>
                    <ActionBtn
                      label="الاشتراك" icon="💳" color={C.orange}
                      onClick={() => {
                        setPanelTab(0);
                        setSubModal(co);
                        setSubForm({
                          plan_type: co.plan_type ?? 'trial',
                          edition: (co.edition as 'advanced' | 'ultimate') ?? 'ultimate',
                          extend_mode: 'days', extend_days: 30,
                          end_date: co.end_date?.slice(0, 10) ?? '',
                          is_active: co.status === 'active',
                          features: (co.features as CompanyFeatures) ?? DEFAULT_FEATS_ULTIMATE,
                        });
                      }}
                    />
                    <ActionBtn
                      label="لقطة" icon="📊" color="#60A5FA"
                      onClick={() => setSnapshotCompany(co.id)}
                    />
                    <ActionBtn
                      label="حذف" icon="🗑" color={C.danger}
                      onClick={() => { setDeleteTarget(co); setDeleteCoErr(''); }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
                gap: '8px', padding: '10px 24px',
                background: 'rgba(249,115,22,0.08)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: '11px', fontWeight: 700, color: C.orange, alignItems: 'center',
              }}
            >
              <div>#</div>
              <div>الشركة</div>
              <div style={{ textAlign: 'center' }}>الحالة</div>
              <div>تاريخ الانتهاء</div>
              <div style={{ textAlign: 'center' }}>مستخدمين</div>
              <div style={{ textAlign: 'center' }}>الخطة</div>
              <div />
            </div>

            {paged.map((co, idx) => {
              const isExpanded = expandedId === co.id;
              const st = STATUS[co.status] ?? STATUS.active;
              const isOdd = idx % 2 === 1;
              const expiry = expiryInfo(co);
              return (
                <div key={co.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : co.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
                      gap: '8px', padding: '14px 24px', alignItems: 'center',
                      cursor: 'pointer', transition: 'background 0.15s',
                      background: isOdd ? 'rgba(15,23,42,0.4)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(249,115,22,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isOdd ? 'rgba(15,23,42,0.4)' : 'transparent'; }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: C.orangeDim, border: '1px solid rgba(249,115,22,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 900, color: C.orange, flexShrink: 0,
                    }}>#{co.id}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px', fontWeight: 700, color: C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{co.name}</div>
                      <div style={{ fontSize: '11px', color: C.muted, direction: 'ltr', textAlign: 'right' }}>
                        {co.admin_email ?? '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{
                        background: st.bg, color: st.text, border: `1px solid ${st.border}`,
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: 700, display: 'inline-block',
                      }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: expiry.color, lineHeight: 1.5 }}>
                      {expiry.text}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: C.orange }}>{co.userCount}</div>
                      <div style={{ fontSize: '10px', color: C.muted }}>مستخدم</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted }}>
                        {translatePlan(co.plan_type)}
                      </div>
                      <span style={{
                        display: 'inline-block', marginTop: '3px', padding: '2px 8px',
                        borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                        background: co.edition === 'advanced' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                        color: co.edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
                        border: `1px solid ${co.edition === 'advanced' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                      }}>
                        {co.edition === 'advanced' ? '🚀 MuhKam Advanced' : '⭐ MuhKam Pro'}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '11px', color: C.muted, transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', textAlign: 'center',
                    }}>▶</div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: '16px 24px 20px', background: 'rgba(15,23,42,0.6)',
                      borderTop: `1px solid ${C.border}`,
                    }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                        {!co.is_active && (
                          <ActionBtn
                            label="تفعيل الشركة" icon="✅" color={C.success}
                            onClick={() => coMutate.mutate({ url: `/api/super/companies/${co.id}/activate` })}
                          />
                        )}
                        {co.is_active && (
                          <ActionBtn
                            label="إيقاف الشركة" icon="⛔" color={C.danger}
                            onClick={() => coMutate.mutate({ url: `/api/super/companies/${co.id}/suspend` })}
                          />
                        )}
                        <ActionBtn
                          label="إدارة الاشتراك" icon="📋" color={C.orange}
                          onClick={() => {
                            const ed = (co.edition ?? 'ultimate') as 'advanced' | 'ultimate';
                            const defaultFeats = ed === 'advanced' ? DEFAULT_FEATS_ADVANCED : DEFAULT_FEATS_ULTIMATE;
                            const feats: CompanyFeatures = co.features
                              ? { ...defaultFeats, ...co.features }
                              : { ...defaultFeats };
                            setPanelTab(0);
                            setSubModal(co);
                            setSubForm({
                              plan_type: co.plan_type, edition: ed,
                              extend_mode: 'days', extend_days: 30,
                              end_date: co.end_date?.slice(0, 10) ?? '',
                              is_active: co.is_active, features: feats,
                            });
                          }}
                        />

                        {/* Edition switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '6px 12px' }}>
                          <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>🏷️ النسخة:</span>
                          <select
                            value={co.edition ?? 'ultimate'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              coMutate.mutate({
                                url: `/api/super/companies/${co.id}`,
                                method: 'PUT',
                                body: { edition: e.target.value },
                              });
                            }}
                            style={{
                              border: `1.5px solid ${co.edition === 'advanced' ? '#f59e0b' : '#6366f1'}`,
                              borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700,
                              background: C.bg,
                              color: co.edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
                              fontFamily: FONT, cursor: 'pointer',
                            }}
                          >
                            <option value="ultimate">⭐ MuhKam Pro</option>
                            <option value="advanced">🚀 MuhKam Advanced</option>
                          </select>
                        </div>

                        <ActionBtn
                          label="🔑 إعادة تعيين كلمة المرور" icon="" color="#7c3aed"
                          onClick={() => resetPassword.mutate({ id: co.id, company_name: co.name })}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCoErr('');
                            setDeleteTarget(co);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: '10px',
                            border: '1.5px solid rgba(239,68,68,0.4)',
                            background: 'rgba(239,68,68,0.1)',
                            color: C.danger, fontSize: '13px', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: FONT,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                        >
                          🗑️ <span>حذف الشركة</span>
                        </button>
                        <div style={{ fontSize: '12px', color: C.muted, marginRight: 'auto' }}>
                          تسجيل:{' '}
                          {new Date(co.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!coLoading && filtered.length > 0 && (
          <div
            style={{
              padding: '12px 24px', borderTop: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '10px', background: 'rgba(249,115,22,0.03)',
            }}
          >
            <span style={{ fontSize: '12px', color: C.muted }}>
              عرض {filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)} من {filtered.length} شركة
              {' · '}الصفحة {safePage} من {totalPages}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <PageBtn label="السابق" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} />
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const start = Math.max(1, safePage - 3);
                  return start + i;
                }).filter(p => p <= totalPages).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                      fontFamily: FONT, transition: 'all 0.15s',
                      border: p === safePage ? 'none' : `1px solid ${C.border}`,
                      background: p === safePage ? C.orange : 'transparent',
                      color: p === safePage ? '#fff' : C.muted,
                    }}
                  >{p}</button>
                ))}
                <PageBtn label="التالي" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
