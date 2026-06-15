import {
  Building2,
  AlertTriangle,
  Users,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { C, type ActiveTab, type Stats } from '../types';
import type { SettingsCard } from './overview-types';

interface KpiItem {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  iconBorderColor: string;
  borderTopColor: string;
  hoverShadow: string;
  label: string;
  value: number | string;
  sub: string;
  action: () => void;
}

interface Props {
  stats?: Stats;
  setActiveTab: (t: ActiveTab) => void;
  setStatusFilter: (v: string) => void;
  setSettingsActiveCard: (v: SettingsCard | null) => void;
}

/* Row 1 — 4 big KPI cards (presentational; navigation handlers come from parent) */
export function OverviewKpiCards({
  stats,
  setActiveTab,
  setStatusFilter,
  setSettingsActiveCard,
}: Props) {
  const hasExpired = (stats?.expired ?? 0) > 0;

  const items: KpiItem[] = [
    {
      Icon: Building2,
      iconColor: '#22C55E',
      iconBg: 'rgba(34,197,94,0.12)',
      iconBorderColor: 'rgba(34,197,94,0.25)',
      borderTopColor: '#22C55E',
      hoverShadow: 'rgba(34,197,94,0.15)',
      label: 'الشركات النشطة',
      value: stats?.active ?? '—',
      sub: `من إجمالي ${stats?.total ?? '—'} شركة`,
      action: () => {
        setActiveTab('companies');
        setStatusFilter('active');
      },
    },
    {
      Icon: AlertTriangle,
      iconColor: '#F59E0B',
      iconBg: 'rgba(245,158,11,0.12)',
      iconBorderColor: 'rgba(245,158,11,0.25)',
      borderTopColor: '#F59E0B',
      hoverShadow: 'rgba(245,158,11,0.15)',
      label: 'تنتهي خلال 7 أيام',
      value: stats?.expiringSoon ?? '—',
      sub: 'تحتاج تجديد عاجل',
      action: () => setActiveTab('alerts'),
    },
    {
      Icon: Users,
      iconColor: '#3B82F6',
      iconBg: 'rgba(59,130,246,0.12)',
      iconBorderColor: 'rgba(59,130,246,0.25)',
      borderTopColor: '#3B82F6',
      hoverShadow: 'rgba(59,130,246,0.15)',
      label: 'إجمالي المستخدمين',
      value: stats?.totalUsers ?? '—',
      sub: `${stats?.recentSignups ?? 0} انضموا هذا الشهر`,
      action: () => {
        setActiveTab('settings');
        setSettingsActiveCard('managers');
      },
    },
    {
      Icon: hasExpired ? XCircle : CheckCircle,
      iconColor: hasExpired ? '#EF4444' : '#22C55E',
      iconBg: hasExpired ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      iconBorderColor: hasExpired ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
      borderTopColor: hasExpired ? '#EF4444' : '#22C55E',
      hoverShadow: hasExpired ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
      label: 'اشتراكات منتهية',
      value: stats?.expired ?? '—',
      sub: `${stats?.suspended ?? 0} موقوفة إضافياً`,
      action: () => {
        setActiveTab('companies');
        setStatusFilter('expired');
      },
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
      {items.map((kpi) => (
        <div
          key={kpi.label}
          onClick={kpi.action}
          style={{
            background: C.card,
            borderRadius: '16px',
            border: `1px solid ${C.border}`,
            borderTop: `3px solid ${kpi.borderTopColor}`,
            padding: '24px',
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${kpi.hoverShadow}`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = '';
            (e.currentTarget as HTMLDivElement).style.boxShadow = '';
          }}
        >
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: kpi.iconBg,
                border: `1px solid ${kpi.iconBorderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <kpi.Icon size={20} color={kpi.iconColor} strokeWidth={1.8} />
            </div>
          </div>
          <div
            style={{ fontSize: '34px', fontWeight: 900, color: kpi.borderTopColor, lineHeight: 1 }}
          >
            {kpi.value}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginTop: '10px' }}>
            {kpi.label}
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}
