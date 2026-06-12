import { C, STATUS, translatePlan } from '../types';
import type { Company, CompanyFeatures } from '../types';
import { ActionBtn } from '../ui';
import type { SubForm } from './types';

export function CompanyCard({
  co,
  expiryInfo,
  setPanelTab,
  setSubModal,
  setSubForm,
  setSnapshotCompany,
  setDeleteTarget,
  setDeleteCoErr,
  DEFAULT_FEATS_ULTIMATE,
}: {
  co: Company;
  expiryInfo: (co: Company) => { text: string; color: string };
  setPanelTab: (v: 0 | 1 | 2 | 3) => void;
  setSubModal: (v: Company | null) => void;
  setSubForm: React.Dispatch<React.SetStateAction<SubForm>>;
  setSnapshotCompany: (v: number | null) => void;
  setDeleteTarget: (v: Company | null) => void;
  setDeleteCoErr: (v: string) => void;
  DEFAULT_FEATS_ULTIMATE: CompanyFeatures;
}) {
  const st = STATUS[co.status] ?? STATUS.active;
  const expiry = expiryInfo(co);

  return (
    <div
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
          label="لقطة" icon="📊" color="var(--status-info)"
          onClick={() => setSnapshotCompany(co.id)}
        />
        <ActionBtn
          label="حذف" icon="🗑" color={C.danger}
          onClick={() => { setDeleteTarget(co); setDeleteCoErr(''); }}
        />
      </div>
    </div>
  );
}
