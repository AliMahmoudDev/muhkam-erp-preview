/**
 * CashFlowIndirectReport — قائمة التدفقات النقدية (الطريقة غير المباشرة)
 * Indirect Method: Net Income → Adjustments → Working Capital Changes
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { api, authFetch, formatCurrency, thisMonthStart, todayStr } from './shared';

interface IndirectCFData {
  period: { date_from: string; date_to: string };
  operating_activities: {
    net_income: number;
    add_depreciation: number;
    change_in_ar: number;
    change_in_inventory: number;
    change_in_ap: number;
    net_cash_from_operations: number;
  };
  investing_activities: {
    asset_purchases: number;
    net_cash_from_investing: number;
  };
  financing_activities: {
    net_loans_and_equity: number;
    net_cash_from_financing: number;
  };
  net_change_in_cash: number;
}

function Row({
  label,
  value,
  indent = false,
  bold = false,
  sub = false,
}: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  sub?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <div className={`flex items-center justify-between py-2.5 px-4 ${sub ? 'opacity-60' : ''}`}>
      <span
        className={`text-sm ${bold ? 'font-bold text-ink' : 'text-ink/75'} ${indent ? 'pr-5' : ''}`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-sm ${bold ? 'font-bold' : ''} ${isNeg ? 'text-red-400' : value > 0 ? 'text-green-400' : 'text-ink/40'}`}
      >
        {isNeg ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 bg-surface border-b border-t border-line">
      <span className="text-sm font-bold text-amber-400">{title}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-line mx-4" />;
}

export default function CashFlowIndirectReport() {
  const [dateFrom, setDateFrom] = useState(thisMonthStart);
  const [dateTo, setDateTo] = useState(todayStr);

  const { data, isLoading, error } = useQuery<IndirectCFData>({
    queryKey: ['cash-flow-indirect', dateFrom, dateTo],
    queryFn: () =>
      authFetch(
        api(`/api/reports/cash-flow-indirect?date_from=${dateFrom}&date_to=${dateTo}`)
      ).then((r) => r.json()),
    enabled: !!dateFrom && !!dateTo,
  });

  const netCash = data?.net_change_in_cash ?? 0;

  return (
    <div className="space-y-4" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {/* Date Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-surface rounded-xl px-4 py-2 border border-line">
          <span className="text-sm text-ink/60">من:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-ink text-sm outline-none"
          />
          <span className="text-ink/30">—</span>
          <span className="text-sm text-ink/60">إلى:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-ink text-sm outline-none"
          />
        </div>
        <div
          className={`rounded-xl px-5 py-2 font-bold font-mono text-base border ${
            netCash >= 0
              ? 'bg-green-500/15 border-green-500/30 text-green-400'
              : 'bg-red-500/15 border-red-500/30 text-red-400'
          }`}
        >
          {netCash >= 0 ? (
            <ArrowUp className="inline h-4 w-4 ml-1" />
          ) : (
            <ArrowDown className="inline h-4 w-4 ml-1" />
          )}
          صافي التدفق: {netCash >= 0 ? '+' : ''}
          {formatCurrency(netCash)}
        </div>
      </div>

      {isLoading && <div className="text-center text-ink/50 py-16">جاري الحساب...</div>}

      {error && <div className="text-center text-red-400 py-10">حدث خطأ في التحميل</div>}

      {data && (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-line bg-surface">
            <h2 className="text-lg font-bold text-ink">
              قائمة التدفق النقدي — الطريقة غير المباشرة
            </h2>
            <p className="text-sm text-ink/50 mt-0.5">
              الفترة: {data.period.date_from} — {data.period.date_to}
            </p>
          </div>

          {/* Section 1: Operating Activities */}
          <SectionHeader title="أولاً: التدفق من الأنشطة التشغيلية" />
          <Row label="صافي الربح للفترة" value={data.operating_activities.net_income} bold />
          <Divider />
          <div className="px-4 pt-2 pb-1">
            <span className="text-xs text-ink/40 font-medium">تسويات البنود غير النقدية:</span>
          </div>
          <Row
            label="+ مصروف الاستهلاك (بند غير نقدي)"
            value={data.operating_activities.add_depreciation}
            indent
          />
          <Divider />
          <div className="px-4 pt-2 pb-1">
            <span className="text-xs text-ink/40 font-medium">التغيرات في رأس المال العامل:</span>
          </div>
          <Row
            label="التغير في المدينون التجاريون"
            value={data.operating_activities.change_in_ar}
            indent
          />
          <Row
            label="التغير في المخزون"
            value={data.operating_activities.change_in_inventory}
            indent
          />
          <Row
            label="التغير في الدائنون التجاريون"
            value={data.operating_activities.change_in_ap}
            indent
          />
          <Divider />
          <div className="bg-blue-500/10 border-t border-blue-500/20">
            <Row
              label="صافي التدفق النقدي من الأنشطة التشغيلية"
              value={data.operating_activities.net_cash_from_operations}
              bold
            />
          </div>

          {/* Section 2: Investing Activities */}
          <SectionHeader title="ثانياً: التدفق من الأنشطة الاستثمارية" />
          <Row
            label="اقتناء الأصول الثابتة"
            value={data.investing_activities.asset_purchases}
            indent
          />
          <Divider />
          <div className="bg-surface border-t border-line">
            <Row
              label="صافي التدفق النقدي من الأنشطة الاستثمارية"
              value={data.investing_activities.net_cash_from_investing}
              bold
            />
          </div>

          {/* Section 3: Financing Activities */}
          <SectionHeader title="ثالثاً: التدفق من الأنشطة التمويلية" />
          <Row
            label="القروض والتمويل"
            value={data.financing_activities.net_loans_and_equity}
            indent
          />
          <Divider />
          <div className="bg-amber-500/10 border-t border-amber-500/20">
            <Row
              label="صافي التدفق النقدي من الأنشطة التمويلية"
              value={data.financing_activities.net_cash_from_financing}
              bold
            />
          </div>

          {/* Net Change */}
          <div
            className={`border-t-2 ${netCash >= 0 ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'}`}
          >
            <Row
              label="صافي الزيادة / (النقص) في النقدية خلال الفترة"
              value={data.net_change_in_cash}
              bold
            />
          </div>

          {/* Note */}
          <div className="px-4 py-3 border-t border-line bg-black/20">
            <p className="text-xs text-ink/30">
              * الطريقة غير المباشرة: تبدأ بصافي الربح وتسوّي للبنود غير النقدية والتغيرات في رأس
              المال العامل. المبالغ بين قوسين () تمثل تدفقات خارجة (استخدام للنقدية).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
