/**
 * BalanceSheetReport — الميزانية العمومية
 * الحالة: ✔ STABLE — النظام المالي جاهز للإنتاج، عربي بالكامل، ومجمَّد.
 * Financial system is production-ready, fully Arabic, and frozen.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale, Printer, AlertTriangle, CheckCircle, Users, Truck, Package } from 'lucide-react';
import { api, authFetch, formatCurrency, useCountUp, todayStr } from './shared';
import type { BalanceSheetPrintData } from '@/lib/export-pdf';
import {
  useTheme, EMPTY_BS, type BalanceSheetData,
  SectionHd, SubSectionHd, ChildRow, TotalRow, NetRow, Spacer, DrillRow,
  CustomerDrill, InventoryDrill,
} from './balance-sheet';

/* ── KPI Card ──────────────────────────────────────────────────────────── */
function BsKPICard({
  label,
  hint,
  value,
  variant,
}: {
  label: string;
  hint: string;
  value: number;
  variant: 'green' | 'red' | 'amber';
}) {
  const { isLight } = useTheme();
  const animated = useCountUp(value);
  const colors = {
    green: {
      clr: '#059669',
      bg: isLight ? '#f0fdf4' : 'rgba(5,150,105,0.08)',
      bdr: isLight ? '#bbf7d0' : 'rgba(5,150,105,0.20)',
    },
    red: {
      clr: '#dc2626',
      bg: isLight ? '#fef2f2' : 'rgba(220,38,38,0.08)',
      bdr: isLight ? '#fecaca' : 'rgba(220,38,38,0.20)',
    },
    amber: {
      clr: '#d97706',
      bg: isLight ? '#fffbeb' : 'rgba(245,158,11,0.08)',
      bdr: isLight ? '#fde68a' : 'rgba(245,158,11,0.20)',
    },
  }[variant];
  const txtHint = isLight ? '#9ca3af' : 'rgba(255,255,255,0.35)';
  return (
    <div
      className="rpt-panel rounded-2xl p-4"
      style={{ border: `1px solid ${colors.bdr}`, background: colors.bg }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, color: colors.clr, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 10, color: txtHint, marginBottom: 8 }}>{hint}</p>
      <p
        style={{
          fontSize: 19,
          fontWeight: 900,
          color: colors.clr,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatCurrency(animated)}
      </p>
    </div>
  );
}

/* ── Balance badge ─────────────────────────────────────────────────────── */
function BalanceBadge({ balanced, diff }: { balanced: boolean; diff: number }) {
  if (balanced)
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-1.5"
        style={{ background: 'rgba(5,150,105,0.10)', border: '1px solid rgba(5,150,105,0.25)' }}
      >
        <CheckCircle className="w-3.5 h-3.5" style={{ color: '#059669' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>الميزانية متوازنة ✓</span>
      </div>
    );
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)' }}
    >
      <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
        ⚠️ يوجد فرق: {formatCurrency(Math.abs(diff))}
      </span>
    </div>
  );
}

/* ── Accounting Statement ───────────────────────────────────────────────── */
function BalanceSheetStatement({ data }: { data: BalanceSheetData }) {
  const { panelBg, panelBdr, txtSub } = useTheme();

  const [expandReceivables, setExpandReceivables] = useState(false);
  const [expandInventory, setExpandInventory] = useState(false);
  const [expandPayables, setExpandPayables] = useState(false);

  return (
    <div
      className="rpt-panel rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${panelBdr}`, background: panelBg }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: "'Tajawal','Cairo',sans-serif",
        }}
      >
        <colgroup>
          <col style={{ width: '68%' }} />
          <col style={{ width: '32%' }} />
        </colgroup>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'right',
                padding: '10px 16px',
                fontSize: 10,
                fontWeight: 700,
                color: txtSub,
                letterSpacing: '0.06em',
                borderBottom: `1px solid ${panelBdr}`,
              }}
            >
              البيان
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px 16px',
                fontSize: 10,
                fontWeight: 700,
                color: txtSub,
                letterSpacing: '0.06em',
                borderBottom: `1px solid ${panelBdr}`,
              }}
            >
              المبلغ
            </th>
          </tr>
        </thead>
        <tbody>
          {/* ══════ الأصول ══════ */}
          <SectionHd label="الأصول" />

          {/* الأصول المتداولة */}
          <SubSectionHd label="الأصول المتداولة" />
          <ChildRow label="النقدية — أرصدة الخزن الحالية" value={data.assets.cash} />
          <ChildRow
            label="ذمم العملاء المدينة"
            value={data.assets.receivables}
            clickable
            expanded={expandReceivables}
            onToggle={() => setExpandReceivables((v) => !v)}
            Icon={Users}
          />
          {expandReceivables && (
            <DrillRow>
              <CustomerDrill isSupplier={false} />
            </DrillRow>
          )}
          <ChildRow
            label="المخزون — الكمية × سعر التكلفة"
            value={data.assets.inventory}
            clickable
            expanded={expandInventory}
            onToggle={() => setExpandInventory((v) => !v)}
            Icon={Package}
          />
          {expandInventory && (
            <DrillRow>
              <InventoryDrill />
            </DrillRow>
          )}
          <TotalRow label="= إجمالي الأصول المتداولة" value={data.assets.total} accent="#d97706" />

          {/* الأصول غير المتداولة — فارغة في هذا النظام */}
          <SubSectionHd label="الأصول غير المتداولة" />
          <ChildRow label="أصول ثابتة — لا توجد في هذا النظام حالياً" value={0} dim />
          <TotalRow label="= إجمالي الأصول غير المتداولة" value={0} accent="#6b7280" />

          <TotalRow label="= إجمالي الأصول" value={data.assets.total} accent="#1e293b" />

          <Spacer />

          {/* ══════ الخصوم ══════ */}
          <SectionHd label="الخصوم" />

          {/* الخصوم المتداولة */}
          <SubSectionHd label="الخصوم المتداولة" />
          <ChildRow
            label="ذمم الموردين الدائنة"
            value={data.liabilities.payables}
            clickable
            expanded={expandPayables}
            onToggle={() => setExpandPayables((v) => !v)}
            Icon={Truck}
          />
          {expandPayables && (
            <DrillRow>
              <CustomerDrill isSupplier={true} />
            </DrillRow>
          )}
          {data.liabilities.payables === 0 && (
            <ChildRow label="لا توجد ذمم موردين مستحقة" value={0} dim />
          )}
          <TotalRow
            label="= إجمالي الخصوم المتداولة"
            value={data.liabilities.payables}
            accent="#6b7280"
          />

          {/* الخصوم طويلة الأجل */}
          <SubSectionHd label="الخصوم طويلة الأجل" />
          <ChildRow label="التزامات طويلة الأجل — لا توجد حالياً" value={0} dim />
          <TotalRow label="= إجمالي الخصوم طويلة الأجل" value={0} accent="#6b7280" />

          <TotalRow label="= إجمالي الخصوم" value={data.liabilities.total} accent="#4b5563" />

          <Spacer />

          {/* ══════ حقوق الملكية ══════ */}
          <SectionHd label="حقوق الملكية" />
          <ChildRow
            label="رأس المال المفتوح — الأرصدة الافتتاحية"
            value={data.equity.opening_capital}
          />
          <ChildRow
            label="الأرباح المحتجزة — صافي الربح الكلي (الإيراد − التكلفة − المصروفات)"
            value={data.equity.retained_earnings}
          />
          <TotalRow
            label="= إجمالي حقوق الملكية"
            value={data.equity.total}
            accent={data.equity.total >= 0 ? '#059669' : '#dc2626'}
          />

          <Spacer />

          {/* ══════ معادلة التوازن ══════ */}
          <NetRow
            label={`= إجمالي الخصوم + حقوق الملكية ${data.balanced ? '✓' : '⚠'}`}
            value={data.total_liabilities_equity}
            balanced={data.balanced}
          />
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export default function BalanceSheetReport() {
  const { isLight, txtMain, txtSub, panelBdr } = useTheme();
  const [asOfDate, setAsOfDate] = useState(todayStr());

  const {
    data: raw,
    isLoading,
    error,
  } = useQuery<BalanceSheetData>({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: () =>
      authFetch(api('/api/reports/balance-sheet')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 60_000,
  });

  const data: BalanceSheetData = { ...EMPTY_BS, ...raw };
  const diff = useMemo(
    () => data.assets.total - data.total_liabilities_equity,
    [data.assets.total, data.total_liabilities_equity]
  );

  async function handlePrint() {
    const printData: BalanceSheetPrintData = {
      assets: data.assets,
      liabilities: data.liabilities,
      equity: data.equity,
      total_liabilities_equity: data.total_liabilities_equity,
      balanced: data.balanced,
      as_of: asOfDate,
    };
    const { printBalanceSheet } = await import('@/lib/export-pdf');
    printBalanceSheet(printData);
  }

  const asOfFormatted = new Date(asOfDate + 'T00:00:00').toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (isLoading)
    return (
      <div
        className="flex items-center justify-center py-20"
        style={{ color: txtSub, fontFamily: "'Tajawal','Cairo',sans-serif" }}
      >
        <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full ml-3" />
        جاري تحميل الميزانية العمومية…
      </div>
    );

  if (error)
    return (
      <div
        className="flex items-center justify-center py-20 text-red-400 gap-2"
        style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}
      >
        <AlertTriangle className="w-5 h-5" />
        فشل تحميل البيانات — تحقق من الاتصال
      </div>
    );

  return (
    <div className="space-y-5" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 shrink-0" style={{ color: '#d97706' }} />
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: txtMain }}>الميزانية العمومية</h2>
            <p style={{ fontSize: 11, color: txtSub, marginTop: 2 }}>
              كما في تاريخ:&nbsp;
              <strong style={{ color: isLight ? '#374151' : 'rgba(255,255,255,0.75)' }}>
                {asOfFormatted}
              </strong>
            </p>
          </div>
        </div>

        <div className="no-print flex items-center gap-2 flex-wrap">
          {/* Date picker */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{
              background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${panelBdr}`,
            }}
          >
            <span style={{ fontSize: 10, color: txtSub, fontWeight: 700 }}>كما في</span>
            <input
              type="date"
              value={asOfDate}
              max={todayStr()}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: txtMain,
                fontSize: 12,
                fontFamily: "'Tajawal','Cairo',sans-serif",
                direction: 'ltr',
              }}
            />
          </div>

          <BalanceBadge balanced={data.balanced} diff={diff} />

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all hover:opacity-90"
            style={{ background: '#d97706', color: '#fff' }}
          >
            <Printer className="w-4 h-4" />
            طباعة PDF
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BsKPICard
          label="إجمالي الأصول"
          hint="النقدية + الذمم + المخزون"
          value={data.assets.total}
          variant="amber"
        />
        <BsKPICard
          label="إجمالي الخصوم"
          hint="ذمم الموردين الدائنة"
          value={data.liabilities.total}
          variant="red"
        />
        <BsKPICard
          label="حقوق الملكية"
          hint="رأس المال + الأرباح المحتجزة"
          value={data.equity.total}
          variant={data.equity.total >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* ── Unbalanced alert with exact difference ── */}
      {!data.balanced && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>
              الميزانية غير متوازنة — يوجد فرق: {formatCurrency(Math.abs(diff))}
            </p>
            <p style={{ fontSize: 11, color: '#dc2626', opacity: 0.75, marginTop: 3 }}>
              إجمالي الأصول ({formatCurrency(data.assets.total)}) ≠ الخصوم + حقوق الملكية (
              {formatCurrency(data.total_liabilities_equity)})
            </p>
          </div>
        </div>
      )}

      {/* ── Accounting Statement ── */}
      <BalanceSheetStatement data={data} />

      {/* ── P&L detail strip ── */}
      <div className="rpt-panel rounded-2xl p-4" style={{ border: `1px solid ${panelBdr}` }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: txtSub,
            marginBottom: 10,
            letterSpacing: '0.06em',
          }}
        >
          تفاصيل احتساب الأرباح المحتجزة
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {(
            [
              { label: 'إجمالي الإيراد', val: data.pl_detail.total_revenue, clr: '#059669' },
              { label: '(−) تكلفة البضاعة', val: data.pl_detail.total_cogs, clr: '#dc2626' },
              { label: '(−) المصروفات', val: data.pl_detail.total_expenses, clr: '#dc2626' },
            ] as const
          ).map(({ label, val, clr }) => (
            <div key={label}>
              <p style={{ fontSize: 10, color: txtSub, marginBottom: 3 }}>{label}</p>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: clr,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(val)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Accounting validation warning ── */}
      {data.validation.status === 'WARNING' && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#d97706' }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>تنبيه محاسبي</p>
            <p style={{ fontSize: 11, color: '#d97706', opacity: 0.8, marginTop: 2 }}>
              {data.validation.validation_message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
