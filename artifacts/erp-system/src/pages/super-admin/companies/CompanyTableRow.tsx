/* eslint-disable erp/no-hardcoded-colors -- Legacy super-admin panel palette (C.* constants + inline rgba). Intentional fixed dark-theme colors outside the ERP token system; to be migrated to tokens in a future design pass. */
import { Trash2, ChevronRight } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { C, STATUS, translatePlan, FONT } from '../types';
import type { Company, CompanyFeatures } from '../types';
import { ActionBtn } from '../ui';
import type { CoMutate, ResetPasswordMutate, SubForm } from './types';

export function CompanyTableRow({
  co,
  idx,
  isExpanded,
  setExpandedId,
  expiryInfo,
  coMutate,
  resetPassword,
  setPanelTab,
  setSubModal,
  setSubForm,
  setDeleteTarget,
  setDeleteCoErr,
  DEFAULT_FEATS_ULTIMATE,
  DEFAULT_FEATS_ADVANCED,
}: {
  co: Company;
  idx: number;
  isExpanded: boolean;
  setExpandedId: (v: number | null) => void;
  expiryInfo: (co: Company) => { text: string; color: string };
  coMutate: CoMutate;
  resetPassword: ResetPasswordMutate;
  setPanelTab: (v: 0 | 1 | 2 | 3) => void;
  setSubModal: (v: Company | null) => void;
  setSubForm: React.Dispatch<React.SetStateAction<SubForm>>;
  setDeleteTarget: (v: Company | null) => void;
  setDeleteCoErr: (v: string) => void;
  DEFAULT_FEATS_ULTIMATE: CompanyFeatures;
  DEFAULT_FEATS_ADVANCED: CompanyFeatures;
}) {
  const st = STATUS[co.status] ?? STATUS.active;
  const isOdd = idx % 2 === 1;
  const expiry = expiryInfo(co);

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        onClick={() => setExpandedId(isExpanded ? null : co.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr 100px 150px 60px 60px 24px',
          gap: '8px',
          padding: '14px 24px',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'background 0.15s',
          background: isOdd ? 'var(--surface-raised)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(249,115,22,0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isOdd ? 'var(--surface-raised)' : 'transparent';
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: C.orangeDim,
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 900,
            color: C.orange,
            flexShrink: 0,
          }}
        >
          #{co.id}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: C.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {co.name}
          </div>
          <div style={{ fontSize: '11px', color: C.muted, direction: 'ltr', textAlign: 'right' }}>
            {co.admin_email ?? '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              background: st.bg,
              color: st.text,
              border: `1px solid ${st.border}`,
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-block',
            }}
          >
            {st.label}
          </span>
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
          <span
            style={{
              display: 'inline-block',
              marginTop: '3px',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 700,
              background:
                co.edition === 'advanced' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
              color: co.edition === 'advanced' ? '#fcd34d' : '#a5b4fc',
              border: `1px solid ${co.edition === 'advanced' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
            }}
          >
            {co.edition === 'advanced' ? 'محكم المتقدم' : 'محكم برو'}
          </span>
        </div>
        <div
          style={{
            color: C.muted,
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronRight size={14} />
        </div>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '16px 24px 20px',
            background: 'var(--surface)',
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {!co.is_active && (
              <ActionBtn
                label="تفعيل الشركة"
                icon=""
                color={C.success}
                onClick={() => coMutate.mutate({ url: `/api/super/companies/${co.id}/activate` })}
              />
            )}
            {co.is_active && (
              <ActionBtn
                label="إيقاف الشركة"
                icon=""
                color={C.danger}
                onClick={() => coMutate.mutate({ url: `/api/super/companies/${co.id}/suspend` })}
              />
            )}
            <ActionBtn
              label="إدارة الاشتراك"
              icon=""
              color={C.orange}
              onClick={() => {
                const ed = (co.edition ?? 'ultimate') as 'advanced' | 'ultimate';
                const defaultFeats =
                  ed === 'advanced' ? DEFAULT_FEATS_ADVANCED : DEFAULT_FEATS_ULTIMATE;
                const feats: CompanyFeatures = co.features
                  ? { ...defaultFeats, ...co.features }
                  : { ...defaultFeats };
                setPanelTab(0);
                setSubModal(co);
                setSubForm({
                  plan_type: co.plan_type,
                  edition: ed,
                  extend_mode: 'days',
                  extend_days: 30,
                  end_date: co.end_date?.slice(0, 10) ?? '',
                  is_active: co.is_active,
                  features: feats,
                });
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface)',
                border: `1px solid ${C.border}`,
                borderRadius: '10px',
                padding: '6px 12px',
              }}
            >
              <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>النسخة:</span>
              <Combobox
                options={[
                  { value: 'ultimate', label: 'محكم برو' },
                  { value: 'advanced', label: 'محكم المتقدم' },
                ]}
                value={co.edition ?? 'ultimate'}
                onChange={(v) => {
                  coMutate.mutate({
                    url: `/api/super/companies/${co.id}`,
                    method: 'PUT',
                    body: { edition: v },
                  });
                }}
                searchable={false}
              />
            </div>
            <ActionBtn
              label="إعادة تعيين كلمة المرور"
              icon=""
              color="var(--status-info)"
              onClick={() => resetPassword.mutate({ id: co.id, company_name: co.name })}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteCoErr('');
                setDeleteTarget(co);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1.5px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.1)',
                color: C.danger,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: FONT,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              }}
            >
              <Trash2 size={13} />
              <span>حذف الشركة</span>
            </button>
            <div style={{ fontSize: '12px', color: C.muted, marginRight: 'auto' }}>
              تسجيل: {new Date(co.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
