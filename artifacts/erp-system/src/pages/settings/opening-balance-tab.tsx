import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { PageHeader } from './_shared';
import type { OBSubTab } from './opening-balance/types';
import { OB_TABS } from './opening-balance/constants';
import { OBTreasuryTab } from './opening-balance/components/OBTreasuryTab';
import { OBProductsTab } from './opening-balance/components/OBProductsTab';
import { OBCustomersTab } from './opening-balance/components/OBCustomersTab';
import { OBSuppliersTab } from './opening-balance/components/OBSuppliersTab';
import { FiscalYearStartCard } from './opening-balance/components/FiscalYearStartCard';

/* ─── Main Export ─── */
export default function OpeningBalanceTab() {
  const [subTab, setSubTab] = useState<OBSubTab>('treasury');

  return (
    <div className="space-y-5">
      <PageHeader title="أول المدة" sub="قيود الأرصدة الافتتاحية عند بدء استخدام النظام" />

      {/* ── Fiscal year start ── */}
      <FiscalYearStartCard />

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <BookOpen className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-400 font-bold text-sm">قيود أول المدة</p>
          <p className="text-amber-300/60 text-xs mt-0.5 leading-relaxed">
            سجّل هنا الأرصدة الافتتاحية عند بدء استخدام النظام لأول مرة. قيود الخزائن والعملاء تُضاف
            للأرصدة الحالية مباشرة. قيود المنتجات تُسجَّل مرة واحدة فقط لكل منتج وتُحسب التكلفة
            المرجّحة تلقائياً.
          </p>
        </div>
      </div>

      {/* Sub-tab pills — Lucide icons */}
      <div className="flex gap-2 flex-wrap">
        {OB_TABS.map((t) => {
          const active = subTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                active
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-[#1A2235] border-[#2D3748] text-ink/40 hover:text-ink hover:border-amber-500/20'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'treasury' && <OBTreasuryTab />}
      {subTab === 'products' && <OBProductsTab />}
      {subTab === 'customers' && <OBCustomersTab />}
      {subTab === 'suppliers' && <OBSuppliersTab />}
    </div>
  );
}
