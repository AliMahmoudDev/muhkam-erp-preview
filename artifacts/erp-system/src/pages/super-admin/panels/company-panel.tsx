import React from 'react';
import {
  type Company,
  type CompanyFeatures,
  type SubForm,
  type PanelCompanyDetail,
  type AuditLogResp,
  C,
  FONT,
  STATUS,
  translatePlan,
  DEFAULT_FEATS_ADVANCED,
  DEFAULT_FEATS_ULTIMATE,
} from '../types';
import { formatAuditNote, getAuditActionMeta } from '../audit-actions';

interface CoMutate {
  mutate: (
    args: { url: string; method?: string; body?: object },
    options?: { onSuccess?: (d: unknown) => void }
  ) => void;
  isPending: boolean;
}
interface ResetPasswordMutate {
  mutate: (args: { id: number; company_name: string }) => void;
}

interface Props {
  subModal: Company | null;
  setSubModal: (v: Company | null) => void;
  panelTab: 0 | 1 | 2 | 3;
  setPanelTab: (v: 0 | 1 | 2 | 3) => void;
  subForm: SubForm;
  setSubForm: React.Dispatch<React.SetStateAction<SubForm>>;
  subSaving: boolean;
  saveSubscription: () => void;
  panelCompanyDetail: PanelCompanyDetail | undefined;
  panelDetailLoading: boolean;
  panelAuditResp: AuditLogResp | undefined;
  panelAuditLoading: boolean;
  coMutate: CoMutate;
  resetPassword: ResetPasswordMutate;
  setSnapshotCompany: (v: number | null) => void;
  setDeleteTarget: (v: Company | null) => void;
  setDeleteCoErr: (v: string) => void;
}

const FEAT_LABELS: Record<keyof CompanyFeatures, string> = {
  accounting: 'المحاسبة',
  hr: 'الموارد البشرية',
  pos: 'نقطة البيع',
  warranty: 'الضمان',
  consignment: 'الأمانات',
  fixed_assets: 'الأصول الثابتة',
  maintenance: 'الصيانة',
  budgets: 'الميزانيات',
  bank_reconciliation: 'مطابقة البنوك',
};

export function CompanyPanel({
  subModal,
  setSubModal,
  panelTab,
  setPanelTab,
  subForm,
  setSubForm,
  subSaving,
  saveSubscription,
  panelCompanyDetail,
  panelDetailLoading,
  panelAuditResp,
  panelAuditLoading,
  coMutate,
  resetPassword,
  setSnapshotCompany,
  setDeleteTarget,
  setDeleteCoErr,
}: Props) {
  if (!subModal) return null;

  const co = subModal;
  const statusStyle = STATUS[co.status] ?? STATUS['suspended'];

  const tabBtn = (idx: 0 | 1 | 2 | 3, label: string) => (
    <button
      key={idx}
      onClick={() => setPanelTab(idx)}
      style={{
        padding: '9px 16px',
        fontSize: '12px',
        fontWeight: 700,
        borderRadius: '10px',
        border: panelTab === idx ? `1.5px solid ${C.orange}` : '1.5px solid transparent',
        background: panelTab === idx ? C.orangeDim : 'transparent',
        color: panelTab === idx ? C.orange : C.muted,
        cursor: 'pointer',
        fontFamily: FONT,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setSubModal(null)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 800,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '520px',
          maxWidth: '95vw',
          background: C.card,
          borderLeft: `1.5px solid ${C.border}`,
          boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
          zIndex: 801,
          overflowY: 'auto',
          fontFamily: FONT,
          padding: '0 0 40px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '22px 24px 16px',
            borderBottom: `1px solid ${C.border}`,
            position: 'sticky',
            top: 0,
            background: C.card,
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '14px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: '17px',
                  color: C.text,
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                🏢 {co.name}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: statusStyle.bg,
                    color: statusStyle.text,
                    border: `1px solid ${statusStyle.border}`,
                  }}
                >
                  {statusStyle.label}
                </span>
                <span style={{ fontSize: '11px', color: C.muted }}>
                  {translatePlan(co.plan_type)}
                </span>
                {co.edition && (
                  <span style={{ fontSize: '11px', color: 'var(--status-info)' }}>
                    ({co.edition})
                  </span>
                )}
                <span style={{ fontSize: '11px', color: C.muted }}>👥 {co.userCount}</span>
              </div>
            </div>
            <button
              onClick={() => setSubModal(null)}
              style={{
                background: 'none',
                border: 'none',
                color: C.muted,
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Quick actions row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button
              onClick={() =>
                coMutate.mutate({
                  url: `/api/super/companies/${co.id}/${co.is_active ? 'suspend' : 'activate'}`,
                  method: 'POST',
                })
              }
              disabled={coMutate.isPending}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${co.is_active ? C.warning + '66' : C.success + '66'}`,
                background: co.is_active ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                color: co.is_active ? C.warning : C.success,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {co.is_active ? '⏸ تعليق' : '▶ تفعيل'}
            </button>
            <button
              onClick={() => {
                setSnapshotCompany(co.id);
              }}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1.5px solid rgba(167,139,250,0.4)',
                background: 'rgba(167,139,250,0.1)',
                color: 'var(--status-info)',
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              📸 لقطة
            </button>
            <button
              onClick={() => {
                resetPassword.mutate({ id: co.id, company_name: co.name });
              }}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1.5px solid rgba(249,115,22,0.4)',
                background: 'rgba(249,115,22,0.1)',
                color: C.orange,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              🔑 إعادة تعيين كلمة المرور
            </button>
            <button
              onClick={() => {
                setDeleteCoErr('');
                setDeleteTarget(co);
                setSubModal(null);
              }}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${C.danger}66`,
                background: 'rgba(239,68,68,0.1)',
                color: C.danger,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              🗑 حذف
            </button>
          </div>

          {/* Tab nav */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tabBtn(0, '📋 الاشتراك')}
            {tabBtn(1, '⚡ إجراءات')}
            {tabBtn(2, '👥 التفاصيل')}
            {tabBtn(3, '📜 سجل العمليات')}
          </div>
        </div>

        {/* Panel Body */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {/* ── Tab 0: Subscription ── */}
          {panelTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Plan type */}
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: C.muted,
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  نوع الخطة
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {['trial', 'basic', 'pro', 'paid'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setSubForm((f) => ({ ...f, plan_type: p }))}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: `1.5px solid ${subForm.plan_type === p ? C.orange : C.border}`,
                        background: subForm.plan_type === p ? C.orangeDim : 'transparent',
                        color: subForm.plan_type === p ? C.orange : C.muted,
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: FONT,
                        transition: 'all 0.15s',
                      }}
                    >
                      {translatePlan(p)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edition */}
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: C.muted,
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  الإصدار
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(['ultimate', 'advanced'] as const).map((ed) => (
                    <button
                      key={ed}
                      onClick={() =>
                        setSubForm((f) => ({
                          ...f,
                          edition: ed,
                          features:
                            ed === 'ultimate' ? DEFAULT_FEATS_ULTIMATE : DEFAULT_FEATS_ADVANCED,
                        }))
                      }
                      style={{
                        padding: '9px',
                        borderRadius: '8px',
                        border: `1.5px solid ${subForm.edition === ed ? (ed === 'ultimate' ? 'var(--status-info)' : 'var(--status-info)') : C.border}`,
                        background:
                          subForm.edition === ed
                            ? ed === 'ultimate'
                              ? 'rgba(167,139,250,0.15)'
                              : 'rgba(96,165,250,0.15)'
                            : 'transparent',
                        color:
                          subForm.edition === ed
                            ? ed === 'ultimate'
                              ? 'var(--status-info)'
                              : 'var(--status-info)'
                            : C.muted,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      {ed === 'ultimate' ? '✨ Ultimate' : '🚀 Advanced'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extend mode */}
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: C.muted,
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  طريقة التمديد
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {(['days', 'date'] as const).map((mode) => {
                    const label = mode === 'days' ? '📅 عدد الأيام' : '🗓 تحديد التاريخ';
                    return (
                      <button
                        key={mode}
                        onClick={() => setSubForm((f) => ({ ...f, extend_mode: mode }))}
                        style={{
                          padding: '9px',
                          borderRadius: '8px',
                          border: `1.5px solid ${subForm.extend_mode === mode ? C.orange : C.border}`,
                          background: subForm.extend_mode === mode ? C.orangeDim : 'transparent',
                          color: subForm.extend_mode === mode ? C.orange : C.muted,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: FONT,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {subForm.extend_mode === 'days' ? (
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: C.muted,
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    عدد الأيام
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '6px',
                      marginBottom: '8px',
                    }}
                  >
                    {[7, 14, 30, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSubForm((f) => ({ ...f, extend_days: d }))}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: `1.5px solid ${subForm.extend_days === d ? C.orange : C.border}`,
                          background: subForm.extend_days === d ? C.orangeDim : 'transparent',
                          color: subForm.extend_days === d ? C.orange : C.muted,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: FONT,
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={subForm.extend_days}
                    onChange={(e) =>
                      setSubForm((f) => ({ ...f, extend_days: Number(e.target.value) }))
                    }
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '9px',
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.text,
                      fontSize: '14px',
                      fontFamily: FONT,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: C.muted,
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    تاريخ الانتهاء
                  </label>
                  <input
                    type="date"
                    value={subForm.end_date}
                    onChange={(e) => setSubForm((f) => ({ ...f, end_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '9px',
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.text,
                      fontSize: '14px',
                      fontFamily: FONT,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Active toggle */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'var(--surface)',
                  border: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                  حالة الاشتراك
                </span>
                <button
                  onClick={() => setSubForm((f) => ({ ...f, is_active: !f.is_active }))}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '20px',
                    border: `1.5px solid ${subForm.is_active ? C.success + '55' : C.danger + '55'}`,
                    background: subForm.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: subForm.is_active ? C.success : C.danger,
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  {subForm.is_active ? '✅ نشط' : '❌ موقوف'}
                </button>
              </div>

              {/* Features */}
              <div>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: C.muted,
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  الميزات المفعّلة
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                  {(Object.keys(FEAT_LABELS) as (keyof CompanyFeatures)[]).map((k) => {
                    const on = subForm.features[k];
                    return (
                      <button
                        key={k}
                        onClick={() =>
                          setSubForm((f) => ({
                            ...f,
                            features: { ...f.features, [k]: !f.features[k] },
                          }))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: `1.5px solid ${on ? C.success + '55' : C.border}`,
                          background: on ? 'rgba(34,197,94,0.08)' : 'transparent',
                          color: on ? C.success : C.muted,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: FONT,
                          textAlign: 'right',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>{on ? '✅' : '⬜'}</span>
                        {FEAT_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button
                    onClick={() => setSubForm((f) => ({ ...f, features: DEFAULT_FEATS_ULTIMATE }))}
                    style={{
                      flex: 1,
                      padding: '7px',
                      borderRadius: '8px',
                      border: '1.5px solid rgba(167,139,250,0.4)',
                      background: 'rgba(167,139,250,0.08)',
                      color: 'var(--status-info)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    Ultimate افتراضي
                  </button>
                  <button
                    onClick={() => setSubForm((f) => ({ ...f, features: DEFAULT_FEATS_ADVANCED }))}
                    style={{
                      flex: 1,
                      padding: '7px',
                      borderRadius: '8px',
                      border: '1.5px solid rgba(96,165,250,0.4)',
                      background: 'rgba(96,165,250,0.08)',
                      color: 'var(--status-info)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: FONT,
                    }}
                  >
                    Advanced افتراضي
                  </button>
                </div>
              </div>

              {/* Save */}
              <button
                onClick={saveSubscription}
                disabled={subSaving}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  border: 'none',
                  background: subSaving ? C.orangeDim : C.orange,
                  color: 'var(--text-1)',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: subSaving ? 'not-allowed' : 'pointer',
                  fontFamily: FONT,
                  opacity: subSaving ? 0.7 : 1,
                }}
              >
                {subSaving ? '⏳ جاري الحفظ...' : '💾 حفظ التغييرات'}
              </button>
            </div>
          )}

          {/* ── Tab 1: Actions ── */}
          {panelTab === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  icon: co.is_active ? '⏸' : '▶',
                  label: co.is_active ? 'تعليق الاشتراك' : 'تفعيل الاشتراك',
                  desc: co.is_active ? 'سيُوقف وصول الشركة إلى النظام' : 'سيُعيد تفعيل وصول الشركة',
                  color: co.is_active ? C.warning : C.success,
                  action: () =>
                    coMutate.mutate({
                      url: `/api/super/companies/${co.id}/${co.is_active ? 'suspend' : 'activate'}`,
                      method: 'POST',
                    }),
                },
                {
                  icon: '🔑',
                  label: 'إعادة تعيين كلمة المرور',
                  desc: 'إنشاء كلمة مرور مؤقتة جديدة للمدير',
                  color: C.orange,
                  action: () => resetPassword.mutate({ id: co.id, company_name: co.name }),
                },
                {
                  icon: '📸',
                  label: 'عرض لقطة سريعة',
                  desc: 'إحصاءات وآخر العمليات بنظرة واحدة',
                  color: 'var(--status-info)',
                  action: () => setSnapshotCompany(co.id),
                },
                {
                  icon: '🗑',
                  label: 'حذف الشركة نهائياً',
                  desc: 'تحذير: لا يمكن التراجع عن الحذف',
                  color: C.danger,
                  action: () => {
                    setDeleteCoErr('');
                    setDeleteTarget(co);
                    setSubModal(null);
                  },
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${item.color}33`,
                    background: `${item.color}10`,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    textAlign: 'right',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${item.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${item.color}10`;
                  }}
                >
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '13px',
                        color: item.color,
                        marginBottom: '2px',
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: C.muted }}>{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Tab 2: Details ── */}
          {panelTab === 2 && (
            <div>
              {panelDetailLoading && (
                <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
                  ⏳ جاري التحميل...
                </div>
              )}
              {panelCompanyDetail && (
                <>
                  <h4
                    style={{
                      margin: '0 0 14px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: C.muted,
                    }}
                  >
                    👥 مستخدمو الشركة ({panelCompanyDetail.users?.length ?? 0})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(panelCompanyDetail.users ?? []).map((u) => (
                      <div
                        key={u.id}
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
                          <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: '11px', color: C.muted }}>
                            @{u.username} · {u.role}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            background: u.active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                            color: u.active ? C.success : C.danger,
                            border: `1px solid ${u.active ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}
                        >
                          {u.active ? 'نشط' : 'موقوف'}
                        </span>
                      </div>
                    ))}
                    {(panelCompanyDetail.users?.length ?? 0) === 0 && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '32px',
                          color: C.muted,
                          fontSize: '13px',
                        }}
                      >
                        لا يوجد مستخدمون
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab 3: Audit Log ── */}
          {panelTab === 3 && (
            <div>
              {panelAuditLoading && (
                <div style={{ textAlign: 'center', padding: '40px', color: C.muted }}>
                  ⏳ جاري التحميل...
                </div>
              )}
              {panelAuditResp && (
                <>
                  <h4
                    style={{
                      margin: '0 0 14px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: C.muted,
                    }}
                  >
                    📜 آخر العمليات ({panelAuditResp.count})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(panelAuditResp.rows ?? [])
                      .filter((r) => !co || r.record_id === co.id || r.note?.includes(co.name))
                      .slice(0, 50)
                      .map((r) => (
                        <div
                          key={r.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '9px',
                            background: 'var(--surface)',
                            border: `1px solid ${C.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '4px',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '12px',
                                color: 'var(--status-info)',
                              }}
                            >
                              {getAuditActionMeta(r.action).label}
                            </span>
                            <span style={{ fontSize: '11px', color: C.muted, direction: 'ltr' }}>
                              {new Date(r.created_at).toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                          {r.note && (
                            <div style={{ fontSize: '11px', color: C.muted, lineHeight: 1.5 }}>
                              {formatAuditNote(r.note)}
                            </div>
                          )}
                          {r.username && (
                            <div style={{ fontSize: '10px', color: C.muted, marginTop: '3px' }}>
                              بواسطة: {r.username}
                            </div>
                          )}
                        </div>
                      ))}
                    {(panelAuditResp.rows ?? []).length === 0 && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '32px',
                          color: C.muted,
                          fontSize: '13px',
                        }}
                      >
                        لا توجد عمليات مسجّلة
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
