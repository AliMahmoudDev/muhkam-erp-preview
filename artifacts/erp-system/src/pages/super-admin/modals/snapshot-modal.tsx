import React from 'react';
import { type SnapshotData, C, FONT } from '../types';
import { formatAuditNote, getAuditActionMeta } from '../audit-actions';

interface Props {
  snapshotCompany: number | null;
  setSnapshotCompany: (v: number | null) => void;
  snapshotData: SnapshotData | undefined;
  snapshotLoading: boolean;
}

export function SnapshotModal({
  snapshotCompany,
  setSnapshotCompany,
  snapshotData,
  snapshotLoading,
}: Props) {
  if (snapshotCompany === null) return null;

  const mkBadge = (label: string, color: string, bg: string) => (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        color,
        background: bg,
        padding: '3px 10px',
        borderRadius: '20px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setSnapshotCompany(null);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: C.card,
          borderRadius: '24px',
          border: `1.5px solid ${C.border}`,
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '18px', color: C.text }}>
              🏢 {snapshotData?.company?.name ?? 'جارٍ التحميل...'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: C.muted }}>
              لقطة سريعة — آخر تحديث الآن
            </p>
          </div>
          <button
            onClick={() => setSnapshotCompany(null)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: C.muted,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {snapshotLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
              ⏳ جارٍ التحميل...
            </div>
          )}

          {snapshotData?.company &&
            (() => {
              const c = snapshotData.company;
              const planColors: Record<string, string> = {
                trial: 'var(--text-2)',
                basic: 'var(--status-info)',
                pro: 'var(--status-info)',
                paid: 'var(--status-success)',
                professional: 'var(--status-warning)',
              };
              const planNames: Record<string, string> = {
                trial: 'تجريبية',
                basic: 'أساسية',
                pro: 'احترافية',
                paid: 'مدفوعة',
                professional: 'مميزة',
              };
              const planCol = planColors[c.plan_type] ?? 'var(--text-2)';
              const statusColor =
                c.status === 'active'
                  ? 'var(--status-success)'
                  : c.status === 'trial'
                    ? 'var(--status-info)'
                    : c.status === 'suspended'
                      ? 'var(--text-2)'
                      : 'var(--status-danger)';
              const statusBg =
                c.status === 'active'
                  ? 'rgba(52,211,153,0.1)'
                  : c.status === 'trial'
                    ? 'rgba(96,165,250,0.1)'
                    : c.status === 'suspended'
                      ? 'rgba(148,163,184,0.1)'
                      : 'rgba(239,68,68,0.1)';
              const statusAr =
                c.status === 'active'
                  ? 'نشط'
                  : c.status === 'trial'
                    ? 'تجريبي'
                    : c.status === 'suspended'
                      ? 'موقوف'
                      : 'منتهي';
              return (
                <>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}
                  >
                    {[
                      {
                        icon: '🛒',
                        label: 'المبيعات',
                        value: snapshotData.stats.salesCount.toLocaleString('ar-EG'),
                        sub: `${snapshotData.stats.salesRevenue.toLocaleString('ar-EG')} ج.م.`,
                      },
                      {
                        icon: '📦',
                        label: 'المشتريات',
                        value: snapshotData.stats.purchasesCount.toLocaleString('ar-EG'),
                        sub: '—',
                      },
                      {
                        icon: '👥',
                        label: 'المديرون',
                        value: String(snapshotData.admins.length),
                        sub: `${snapshotData.admins.filter((a) => a.active).length} نشط`,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: '14px',
                          padding: '16px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '28px', marginBottom: '6px' }}>{s.icon}</div>
                        <div style={{ fontWeight: 900, fontSize: '20px', color: C.text }}>
                          {s.value}
                        </div>
                        <div style={{ fontSize: '12px', color: C.muted }}>{s.label}</div>
                        <div style={{ fontSize: '11px', color: C.muted, opacity: 0.7 }}>
                          {s.sub}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      background: 'var(--surface)',
                      borderRadius: '14px',
                      border: `1px solid ${C.border}`,
                      padding: '16px 20px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        fontSize: '13px',
                      }}
                    >
                      {(
                        [
                          {
                            k: '📋 الخطة',
                            v: (
                              <span style={{ color: planCol, fontWeight: 700 }}>
                                {planNames[c.plan_type] ?? c.plan_type}
                              </span>
                            ),
                          },
                          { k: '📊 الحالة', v: mkBadge(statusAr, statusColor, statusBg) },
                          {
                            k: '📅 ينتهي',
                            v: c.end_date ? new Date(c.end_date).toLocaleDateString('ar-EG') : '—',
                          },
                          { k: '📅 أُنشئت', v: new Date(c.created_at).toLocaleDateString('ar-EG') },
                          { k: '⏳ متبقي', v: `${c.daysRemaining} يوم` },
                          { k: '👥 المستخدمون', v: `${c.userCount} مستخدم` },
                        ] as { k: string; v: React.ReactNode }[]
                      ).map(({ k, v }) => (
                        <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: C.muted, minWidth: '90px' }}>{k}</span>
                          <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {snapshotData.admins.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontWeight: 800,
                          fontSize: '13px',
                          color: C.muted,
                        }}
                      >
                        👤 المديرون
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {snapshotData.admins.map((a) => (
                          <div
                            key={a.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: 'var(--surface)',
                              border: `1px solid ${C.border}`,
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>
                                {a.name}
                              </span>
                              <span
                                style={{ fontSize: '11px', color: C.muted, marginRight: '10px' }}
                              >
                                @{a.username}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {mkBadge(a.role, 'var(--status-info)', 'rgba(167,139,250,0.1)')}
                              {mkBadge(
                                a.active ? 'نشط' : 'موقوف',
                                a.active ? 'var(--status-success)' : 'var(--status-danger)',
                                a.active ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)'
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {snapshotData.recentAudit.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontWeight: 800,
                          fontSize: '13px',
                          color: C.muted,
                        }}
                      >
                        📋 آخر العمليات
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {snapshotData.recentAudit.slice(0, 8).map((r) => (
                          <div
                            key={r.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              background: 'var(--surface)',
                              fontSize: '12px',
                            }}
                          >
                            <span style={{ color: 'var(--status-info)', fontWeight: 700 }}>
                              {getAuditActionMeta(r.action).label}
                            </span>
                            <span
                              style={{
                                color: C.muted,
                                flex: 1,
                                padding: '0 12px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatAuditNote(r.note)}
                            </span>
                            <span style={{ color: C.muted, direction: 'ltr', flexShrink: 0 }}>
                              {new Date(r.created_at).toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => window.print()}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(167,139,250,0.3)',
              background: 'rgba(167,139,250,0.08)',
              color: 'var(--status-info)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            🖨️ طباعة
          </button>
          <button
            onClick={() => setSnapshotCompany(null)}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.muted,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
