/**
 * MobileNav.tsx
 * Customisable fixed bottom navigation bar — visible only on mobile (lg:hidden).
 * Reads the user's saved tab order from GET /api/dashboard/mobile-nav and
 * filters against visibleNav for permission/feature-flag correctness.
 * A gear icon opens MobileNavCustomizer where the user picks up to 5 tabs.
 */
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import {
  MOBILE_NAV_PAGES,
  DEFAULT_MOBILE_TABS,
  MobileNavCustomizer,
  type MobileNavPage,
} from './MobileNavCustomizer';

interface NavItem {
  href: string;
}

interface MobileNavProps {
  visibleNav: NavItem[];
}

export function MobileNav({ visibleNav }: MobileNavProps) {
  const [location] = useLocation();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const queryClient = useQueryClient();

  const visibleHrefs = new Set(visibleNav.map((i) => i.href));

  /* ── Hide nav when the on-screen keyboard is open ── */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => {
      setNavVisible(vv.height > window.innerHeight * 0.75);
    };
    vv.addEventListener('resize', check);
    return () => vv.removeEventListener('resize', check);
  }, []);

  /* ── Fetch saved tab order from the server ── */
  const { data } = useQuery<{ tabs: string[] }>({
    queryKey: ['mobile-nav-tabs'],
    queryFn: async () => {
      const r = await authFetch(api('/api/dashboard/mobile-nav'));
      if (!r.ok) return { tabs: DEFAULT_MOBILE_TABS };
      return r.json() as Promise<{ tabs: string[] }>;
    },
    staleTime: 5 * 60_000,
  });

  /* ── Persist tab order to the server ── */
  const saveMutation = useMutation({
    mutationFn: async (tabs: string[]) => {
      const r = await authFetch(api('/api/dashboard/mobile-nav'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs }),
      });
      if (!r.ok) throw new Error('save failed');
      return r.json() as Promise<{ tabs: string[] }>;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['mobile-nav-tabs'], result);
    },
  });

  const savedTabs = data?.tabs ?? DEFAULT_MOBILE_TABS;

  /* Map saved IDs → page objects, drop any the user can't access */
  const tabs: MobileNavPage[] = savedTabs
    .map((id) => MOBILE_NAV_PAGES.find((p) => p.id === id))
    .filter((p): p is MobileNavPage => !!p && visibleHrefs.has(p.id));

  if (!navVisible) return null;

  return (
    <>
      <nav
        role="navigation"
        aria-label="قائمة التنقل السريع"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center"
        style={{
          height: 56,
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 4,
          paddingRight: 4,
          background: 'var(--bg-topbar)',
          borderTop: '1px solid var(--edge)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {tabs.map((item) => {
          const active = location === item.id;
          const Icon = item.icon;
          return (
            <Link key={item.id} href={item.id}>
              <div
                className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-all"
                style={{
                  color: active ? 'var(--brand)' : 'var(--text-hint)',
                  background: active ? 'var(--brand-muted)' : 'transparent',
                  minWidth: 44,
                }}
              >
                <Icon style={{ width: 20, height: 20 }} />
                <span
                  style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}

        {/* ── Customizer trigger ── */}
        <button
          onClick={() => setShowCustomizer(true)}
          aria-label="تخصيص القائمة"
          className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-all"
          style={{
            color: 'var(--text-hint)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            minWidth: 44,
          }}
        >
          <Settings style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
            تخصيص
          </span>
        </button>
      </nav>

      {showCustomizer && (
        <MobileNavCustomizer
          currentTabs={savedTabs}
          visibleHrefs={visibleHrefs}
          onClose={() => setShowCustomizer(false)}
          onSave={(tabs) => {
            saveMutation.mutate(tabs);
            setShowCustomizer(false);
          }}
        />
      )}
    </>
  );
}
