import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { C, FONT } from './types';
import { SAErrorState, SARefreshHint } from './sa-primitives';

interface RevenueData {
  mrr: number;
  arr: number;
  arpu: number;
  conversionRate: number;
  activeCompanies: number;
  trialCompanies: number;
  paidCompanies: number;
  planBreakdown: { plan: string; price: number; count: number; revenue: number }[];
  monthlyRevenue: { month: string; revenue: number; count: number }[];
  totalPaidEver: number;
  totalTrialEver: number;
}

interface Props {
  revenueData?: RevenueData;
  revenueLoading: boolean;
  revenueError: boolean;
  onRefetch: () => void;
  onExportCSV: () => void;
}

export function TabRevenue({
  revenueData,
  revenueLoading,
  revenueError,
  onRefetch,
  onExportCSV,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>
            📊 لوحة الإيرادات
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            تتبع الإيرادات الشهرية والنمو ومعدلات التحويل
            {revenueError && revenueData && (
              <span style={{ color: C.danger, fontWeight: 700 }}> · تعذّر التحديث الأخير</span>
            )}
          </p>
        </div>
        <button
          onClick={() => onExportCSV()}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(34,197,94,0.3)',
            background: 'rgba(34,197,94,0.1)',
            color: 'var(--status-success)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          📤 تصدير CSV
        </button>
      </div>

      {revenueError && revenueData && <SARefreshHint onRetry={onRefetch} />}

      {revenueLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
          ⏳ جارٍ التحميل...
        </div>
      ) : revenueError && !revenueData ? (
        <SAErrorState
          title="تعذّر تحميل بيانات الإيرادات"
          description="تحقق من اتصال السيرفر وأعد المحاولة"
          onRetry={onRefetch}
        />
      ) : revenueData ? (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {[
              {
                label: 'MRR',
                value: `${revenueData.mrr.toLocaleString('ar-EG')} ج.م.`,
                sub: 'الإيراد الشهري المتكرر',
                color: 'var(--status-info)',
                icon: '💰',
              },
              {
                label: 'ARR',
                value: `${revenueData.arr.toLocaleString('ar-EG')} ج.م.`,
                sub: 'الإيراد السنوي المتوقع',
                color: 'var(--status-success)',
                icon: '📈',
              },
              {
                label: 'ARPU',
                value: `${revenueData.arpu.toLocaleString('ar-EG')} ج.م.`,
                sub: 'متوسط إيراد العميل',
                color: 'var(--status-info)',
                icon: '👤',
              },
              {
                label: 'معدل التحويل',
                value: `${revenueData.conversionRate}%`,
                sub: 'من تجريبي إلى مدفوع',
                color: 'var(--status-warning)',
                icon: '🔄',
              },
              {
                label: 'شركات نشطة',
                value: String(revenueData.activeCompanies),
                sub: `${revenueData.paidCompanies} مدفوعة • ${revenueData.trialCompanies} تجريبية`,
                color: '#FB923C',
                icon: '🏢',
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  background: C.card,
                  borderRadius: '16px',
                  border: `1px solid ${kpi.color}22`,
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: '22px' }}>{kpi.icon}</span>
                  <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>
                    {kpi.label}
                  </span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: kpi.color }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '11px', color: C.muted }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly Revenue Chart */}
          <div
            style={{
              background: C.card,
              borderRadius: '18px',
              border: `1px solid ${C.border}`,
              padding: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>
                📅 الإيراد الشهري (آخر 12 شهراً)
              </h3>
              <button
                onClick={() => {
                  const rows = revenueData.monthlyRevenue
                    .map((m) => `${m.month},${m.revenue},${m.count}`)
                    .join('\n');
                  const blob = new Blob([`الشهر,الإيراد,عدد الشركات\n${rows}`], {
                    type: 'text/csv',
                  });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'revenue.csv';
                  a.click();
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(34,197,94,0.3)',
                  background: 'rgba(34,197,94,0.08)',
                  color: 'var(--status-success)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                📥 CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={revenueData.monthlyRevenue}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--status-info)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--status-info)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--text-2)', fontSize: 10, fontFamily: FONT }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-2)', fontSize: 10, fontFamily: FONT }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <ReTooltip
                  contentStyle={{
                    background: 'var(--erp-bg-card)',
                    border: `1px solid ${C.border}`,
                    borderRadius: '10px',
                    fontFamily: FONT,
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [`${v.toLocaleString('ar-EG')} ج.م.`, 'الإيراد']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--status-info)"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={{ r: 3, fill: 'var(--status-info)', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Plan Breakdown */}
          <div
            style={{
              background: C.card,
              borderRadius: '18px',
              border: `1px solid ${C.border}`,
              padding: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: '15px', color: C.text }}>
              💳 توزيع الخطط
            </h3>
            {(() => {
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
              const pieData = revenueData.planBreakdown
                .filter((p) => p.count > 0)
                .map((p) => ({
                  name: planNames[p.plan] ?? p.plan,
                  value: p.count,
                  revenue: p.revenue,
                  color: planColors[p.plan] ?? 'var(--text-2)',
                }));
              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr',
                    gap: '24px',
                    alignItems: 'center',
                  }}
                >
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((e, idx) => (
                          <Cell key={idx} fill={e.color} />
                        ))}
                      </Pie>
                      <ReTooltip
                        contentStyle={{
                          background: 'var(--erp-bg-card)',
                          border: `1px solid ${C.border}`,
                          borderRadius: '10px',
                          fontFamily: FONT,
                          fontSize: '12px',
                        }}
                        formatter={(v: number, _n, p) => [
                          `${v} شركة — ${p.payload.revenue.toLocaleString('ar-EG')} ج.م./شهر`,
                          p.payload.name,
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', fontFamily: FONT }}
                        formatter={(v) => v}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {revenueData.planBreakdown
                      .filter((p) => p.count > 0 || p.plan === 'trial')
                      .map((p) => {
                        const col = planColors[p.plan] ?? 'var(--text-2)';
                        return (
                          <div
                            key={p.plan}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: `${col}11`,
                              border: `1px solid ${col}22`,
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 700, color: col }}>
                              {planNames[p.plan] ?? p.plan}
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                gap: '16px',
                                fontSize: '12px',
                                color: C.muted,
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                              }}
                            >
                              <span>{p.count} شركة</span>
                              <span style={{ color: col, fontWeight: 700 }}>
                                {p.revenue.toLocaleString('ar-EG')} ج.م./شهر
                              </span>
                              <span>{p.price} ج.م./شركة</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      ) : revenueError ? (
        <SAErrorState
          title="تعذّر تحميل بيانات الإيرادات"
          description="تحقق من الاتصال بالخادم وأعد المحاولة"
          onRetry={() => void onRefetch()}
        />
      ) : null}
    </div>
  );
}
