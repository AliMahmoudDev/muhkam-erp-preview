/**
 * MobileNavCustomizer.tsx
 * Modal that lets the user pick and reorder up to 5 bottom-nav tabs.
 * Also exports the shared MOBILE_NAV_PAGES catalogue and DEFAULT_MOBILE_TABS
 * so MobileNav.tsx can import them without a circular dependency.
 */
import { useState } from 'react';
import { type LucideIcon, ChevronUp, ChevronDown, Plus, X } from 'lucide-react';
import {
  Home, ShoppingCart, Package, Monitor, FileText,
  Warehouse, Users, Wrench, UserCheck, BarChart2,
  CreditCard, Smartphone,
} from 'lucide-react';

export type MobileNavPage = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const MOBILE_NAV_PAGES: MobileNavPage[] = [
  { id: '/',          label: 'الرئيسية',   icon: Home },
  { id: '/sales',     label: 'المبيعات',   icon: ShoppingCart },
  { id: '/purchases', label: 'المشتريات',  icon: Package },
  { id: '/pos',       label: 'نقطة البيع', icon: Monitor },
  { id: '/treasury',  label: 'السندات',    icon: FileText },
  { id: '/inventory', label: 'المخزون',    icon: Warehouse },
  { id: '/customers', label: 'العملاء',    icon: Users },
  { id: '/repairs',   label: 'الصيانة',    icon: Wrench },
  { id: '/employees', label: 'الموظفين',   icon: UserCheck },
  { id: '/reports',   label: 'التقارير',   icon: BarChart2 },
  { id: '/expenses',  label: 'المصروفات',  icon: CreditCard },
  { id: '/devices',   label: 'الأجهزة',    icon: Smartphone },
];

export const DEFAULT_MOBILE_TABS: string[] = [
  '/', '/sales', '/purchases', '/pos', '/treasury',
];

interface MobileNavCustomizerProps {
  currentTabs: string[];
  visibleHrefs: Set<string>;
  isDark: boolean;
  onClose: () => void;
  onSave: (tabs: string[]) => void;
}

export function MobileNavCustomizer({
  currentTabs,
  visibleHrefs,
  isDark,
  onClose,
  onSave,
}: MobileNavCustomizerProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    currentTabs.filter(
      (id) => MOBILE_NAV_PAGES.some((p) => p.id === id) && visibleHrefs.has(id),
    ),
  );

  const available = MOBILE_NAV_PAGES.filter((p) => visibleHrefs.has(p.id));
  const selectedPages = selected
    .map((id) => MOBILE_NAV_PAGES.find((p) => p.id === id))
    .filter((p): p is MobileNavPage => !!p);
  const unselectedPages = available.filter((p) => !selected.includes(p.id));

  const add = (id: string) => {
    if (selected.length < 5) setSelected((prev) => [...prev, id]);
  };

  const remove = (id: string) =>
    setSelected((prev) => prev.filter((t) => t !== id));

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === selected.length - 1) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  };

  const bg        = isDark ? 'hsla(225,25%,8%,0.98)' : 'rgba(255,255,255,0.99)';
  const hdrBdr    = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)';
  const itemBg    = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const itemBdr   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const txtPrim   = isDark ? 'rgba(255,255,255,0.90)' : 'var(--bg-app)';
  const txtMuted  = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)';
  const atLimit   = selected.length >= 5;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl lg:rounded-2xl overflow-hidden"
        style={{ background: bg, border: hdrBdr }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: hdrBdr }}
        >
          <button
            onClick={onClose}
            style={{ color: txtMuted, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
          <span style={{ fontWeight: 800, fontSize: 15, color: txtPrim }}>
            تخصيص قائمة الجوال
          </span>
          <span
            style={{
              fontSize: 11, fontWeight: 800,
              color: atLimit ? 'var(--status-danger)' : 'var(--status-warning)',
              background: atLimit ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)',
              border: `1px solid ${atLimit ? 'rgba(239,68,68,0.20)' : 'rgba(245,158,11,0.20)'}`,
              borderRadius: 8, padding: '2px 8px',
            }}
          >
            {selected.length}/5
          </span>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '62vh', padding: '16px 16px 0' }}>
          {/* ── Selected ── */}
          <p style={{ fontSize: 10, fontWeight: 800, color: txtMuted, letterSpacing: '0.05em', marginBottom: 8 }}>
            التبويبات المحددة
          </p>
          <div className="space-y-1.5" style={{ marginBottom: 20 }}>
            {selectedPages.length === 0 ? (
              <p style={{ fontSize: 12, color: txtMuted, textAlign: 'center', padding: '14px 0' }}>
                لم تُحدِّد أي تبويبة بعد
              </p>
            ) : (
              selectedPages.map((page, idx) => {
                const Icon = page.icon;
                return (
                  <div
                    key={page.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{
                      background: 'rgba(245,158,11,0.07)',
                      border: '1px solid rgba(245,158,11,0.20)',
                    }}
                  >
                    <Icon style={{ width: 15, height: 15, color: 'var(--status-warning)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: txtPrim }}>
                      {page.label}
                    </span>
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      style={{
                        color: idx === 0 ? txtMuted : 'rgba(245,158,11,0.70)',
                        opacity: idx === 0 ? 0.35 : 1,
                        background: 'none', border: 'none',
                        cursor: idx === 0 ? 'default' : 'pointer',
                        padding: '2px 3px', lineHeight: 1,
                      }}
                    >
                      <ChevronUp style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === selectedPages.length - 1}
                      style={{
                        color: idx === selectedPages.length - 1 ? txtMuted : 'rgba(245,158,11,0.70)',
                        opacity: idx === selectedPages.length - 1 ? 0.35 : 1,
                        background: 'none', border: 'none',
                        cursor: idx === selectedPages.length - 1 ? 'default' : 'pointer',
                        padding: '2px 3px', lineHeight: 1,
                      }}
                    >
                      <ChevronDown style={{ width: 14, height: 14 }} />
                    </button>
                    <button
                      onClick={() => remove(page.id)}
                      style={{
                        color: 'rgba(239,68,68,0.55)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', padding: '2px 3px', lineHeight: 1,
                      }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Available ── */}
          <p style={{ fontSize: 10, fontWeight: 800, color: txtMuted, letterSpacing: '0.05em', marginBottom: 8 }}>
            المتاحة للإضافة
            {atLimit && (
              <span style={{ color: 'var(--status-danger)', fontWeight: 700, marginRight: 4 }}>
                — وصلت الحد الأقصى (5)
              </span>
            )}
          </p>
          <div className="space-y-1.5" style={{ marginBottom: 20 }}>
            {unselectedPages.map((page) => {
              const Icon = page.icon;
              return (
                <div
                  key={page.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{
                    background: itemBg,
                    border: `1px solid ${itemBdr}`,
                    opacity: atLimit ? 0.45 : 1,
                  }}
                >
                  <Icon style={{ width: 15, height: 15, color: txtMuted, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: txtPrim }}>
                    {page.label}
                  </span>
                  <button
                    onClick={() => !atLimit && add(page.id)}
                    disabled={atLimit}
                    style={{
                      width: 26, height: 26, borderRadius: 8,
                      background: atLimit ? 'transparent' : 'rgba(245,158,11,0.12)',
                      border: `1px solid ${atLimit ? itemBdr : 'rgba(245,158,11,0.28)'}`,
                      color: atLimit ? txtMuted : 'var(--status-warning)',
                      cursor: atLimit ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Plus style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4" style={{ borderTop: hdrBdr }}>
          <button
            onClick={() => onSave(selected)}
            disabled={selected.length === 0}
            className="w-full rounded-xl py-3 font-black text-sm transition-all"
            style={{
              background: selected.length > 0
                ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
                : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
              color: selected.length > 0 ? 'var(--text-1)' : txtMuted,
              border: 'none',
              cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selected.length > 0 ? '0 4px 18px rgba(245,158,11,0.32)' : 'none',
            }}
          >
            حفظ التخصيص
          </button>
        </div>
      </div>
    </div>
  );
}
