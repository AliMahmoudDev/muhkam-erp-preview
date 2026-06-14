import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Settings2, ClipboardList } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import type { SettingsTab, ChecklistRow } from './repair-settings/shared';
import { TABS } from './repair-settings/shared';
import ChecklistTab from './repair-settings/ChecklistTab';
import TechniciansTab from './repair-settings/TechniciansTab';
import AccessoriesTab from './repair-settings/AccessoriesTab';
import DefaultsTab from './repair-settings/DefaultsTab';
import WhatsAppTemplatesTab from './repair-settings/WhatsAppTemplatesTab';
import DashboardCardsTab from './repair-settings/DashboardCardsTab';
import DeviceModelsTab from './repair-settings/DeviceModelsTab';
import ServiceTypesTab from './repair-settings/ServiceTypesTab';
import TechPerformanceTab from './repair-settings/TechPerformanceTab';

/* ══════════════════════════════════════════════════════════════
   MAIN MODAL
══════════════════════════════════════════════════════════════ */
interface RepairSettingsModalProps {
  onClose: () => void;
  initialTab?: SettingsTab;
}

export default function RepairSettingsModal({
  onClose,
  initialTab = 'checklist',
}: RepairSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* عدّ إجمالي بنود الفحص عبر كل أنواع الأجهزة (لإظهاره في الرأس) */
  const { data: allItems = [] } = useQuery<ChecklistRow[]>({
    queryKey: ['/api/repair-checklist-items', 'all'],
    queryFn: async () => {
      const r = await authFetch(api('/api/repair-checklist-items'));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 30_000,
  });
  const totalItemsCount = Array.isArray(allItems) ? allItems.length : 0;

  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(14px) saturate(140%)',
      }}
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rs-modal-enter rs-mesh-bg relative w-full overflow-hidden flex flex-col rounded-[20px]"
        style={{
          maxWidth: 1240,
          maxHeight: '95vh',
          border: '1px solid var(--edge)',
          boxShadow: 'var(--shadow-modal)',
          background: 'var(--bg-card)',
        }}
      >
        {/* ── Ambient corner glows (لمسة ضوئية) ── */}
        <div
          className="rs-glow rs-glow--amber"
          style={{ top: -120, right: -120, width: 360, height: 360 }}
        />
        <div
          className="rs-glow rs-glow--violet"
          style={{ bottom: -160, left: -140, width: 380, height: 380, animationDelay: '1.5s' }}
        />

        {/* ═══ TOP BAR — أسلوب Command Bar ═══ */}
        <div
          className="relative flex items-center gap-3 px-5 py-3.5 shrink-0"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--edge)',
          }}
        >
          {/* علامة التطبيق — مربع أمبر متوهّج */}
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow:
                  '0 6px 20px -4px rgba(245,158,11,0.55),' +
                  'inset 0 1px 0 rgba(255,255,255,0.30),' +
                  'inset 0 -1px 0 rgba(0,0,0,0.20)',
              }}
            >
              <Settings2 className="w-5 h-5 text-ink drop-shadow" strokeWidth={2.4} />
            </div>
            <span
              className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-emerald-400"
              style={{ boxShadow: '0 0 10px rgba(52,211,153,0.7), 0 0 0 2px var(--bg-card)' }}
            />
          </div>

          {/* العنوان */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[16px] font-black text-ink tracking-[-0.01em]">
                إعدادات وحدة الصيانة
              </h2>
              <span className="text-[10px] font-bold text-amber-300/80 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 tabular-nums">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-ink/40 mt-0.5 font-medium">
              {activeMeta.label} — {activeMeta.sublabel}
            </p>
          </div>

          {/* إحصائية مدمجة — عدد البنود الكلي */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl shrink-0"
            style={{ background: 'var(--surface)', border: '1px solid var(--edge)' }}
            title="إجمالي بنود الفحص عبر كل أنواع الأجهزة"
          >
            <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-ink/55">إجمالي البنود</span>
            <span className="text-[12px] font-black tabular-nums text-ink">{totalItemsCount}</span>
          </div>

          {/* تلميح Esc */}
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-semibold shrink-0 text-ink/35">
            <span>للإغلاق</span>
            <kbd className="rs-kbd">Esc</kbd>
          </div>

          {/* زر الإغلاق */}
          <button
            onClick={onClose}
            title="إغلاق (Esc)"
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-ink/45 hover:text-ink transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--edge)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ BODY: sidebar + content ═══ */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* ── Sidebar — Linear-style nav ── */}
          <aside
            className="w-[244px] shrink-0 overflow-y-auto rs-scroll flex flex-col"
            style={{
              background: 'var(--surface)',
              borderLeft: '1px solid var(--edge)',
            }}
          >
            {/* رأس الـ sidebar */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-[9px] font-black tracking-[0.22em] uppercase text-ink/30">
                الأقسام
              </p>
            </div>

            <nav className="flex-1 px-2 pb-2 space-y-0.5">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="rs-nav-item w-full flex items-center gap-3 px-2.5 py-2.5 text-right rounded-xl group"
                    style={
                      active
                        ? {
                            background:
                              'linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 70%, transparent 100%)',
                            border: '1px solid rgba(245,158,11,0.25)',
                            boxShadow:
                              '0 4px 14px -4px rgba(245,158,11,0.30),' +
                              'inset 0 1px 0 rgba(255,255,255,0.05)',
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    {active && (
                      <span
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full"
                        style={{
                          background: 'linear-gradient(180deg, #fcd34d, #f59e0b)',
                          boxShadow: '0 0 12px rgba(245,158,11,0.6)',
                        }}
                      />
                    )}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, rgba(245,158,11,0.30), rgba(217,119,6,0.12))'
                          : 'var(--surface)',
                        border: active ? '1px solid rgba(245,158,11,0.40)' : '1px solid var(--edge)',
                        boxShadow: active ? '0 2px 8px rgba(245,158,11,0.25)' : 'none',
                      }}
                    >
                      <Icon
                        className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-ink/50 group-hover:text-amber-300'} transition-colors`}
                        strokeWidth={active ? 2.4 : 2}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[13px] font-bold leading-tight ${active ? 'text-ink' : 'text-ink/70 group-hover:text-ink/95'} transition-colors`}
                      >
                        {tab.label}
                      </p>
                      <p
                        className={`text-[10.5px] leading-tight mt-1 truncate ${active ? 'text-amber-500' : 'text-ink/50'}`}
                      >
                        {tab.sublabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* sidebar footer — حالة + اختصار */}
            <div
              className="px-3 py-3 mx-2 mb-2 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--edge)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-black tracking-wider uppercase text-ink/55">
                  الحالة
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  متصل
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-ink/35">
                مُحكم ERP — وحدة الصيانة المتكاملة
              </p>
            </div>
          </aside>

          {/* ── Content ── */}
          <main
            key={activeTab}
            className="rs-content-enter flex-1 overflow-hidden flex flex-col relative"
            style={{
              background:
                'radial-gradient(1200px 600px at 50% -200px, rgba(245,158,11,0.025), transparent 60%)',
            }}
          >
            {activeTab === 'checklist' && <ChecklistTab />}
            {activeTab === 'dashboard-cards' && <DashboardCardsTab />}
            {activeTab === 'technicians' && <TechniciansTab />}
            {activeTab === 'tech-performance' && <TechPerformanceTab />}
            {activeTab === 'service-types' && <ServiceTypesTab />}
            {activeTab === 'accessories' && <AccessoriesTab />}
            {activeTab === 'defaults' && <DefaultsTab />}
            {activeTab === 'wa-templates' && <WhatsAppTemplatesTab />}
            {activeTab === 'models' && <DeviceModelsTab />}
          </main>
        </div>
      </div>
    </div>,
    document.body
  );
}
