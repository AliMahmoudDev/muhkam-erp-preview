import { ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { MobileNav } from '@/components/MobileNav';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { useSubscription } from '@/contexts/subscription';
import { useAppSettings } from '@/contexts/app-settings';
import { useWarehouse } from '@/contexts/warehouse';
import { authFetch } from '@/lib/auth-fetch';
import { ThemeToggle } from '@/components/theme-toggle';
import { NAV_ITEMS, canAccess, ROUTE_PERMISSION, type UserRole } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { translateRole, Role } from '@/lib/roles';
import { useWarehouses } from '@/hooks/useWarehouses';
import { LogOut, Warehouse, Search, X, ChevronDown, UserCircle } from 'lucide-react';
import { PageTransition } from '@/components/page-transition';
import { AlertBell } from '@/components/alert-bell';
import { NotificationBell } from '@/components/notification-bell';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import LogoutCheckoutModal from '@/components/logout-checkout-modal';
import IdleCheckoutModal from '@/components/idle-checkout-modal';

import { resolveUploadedFileUrl } from '@/lib/file-upload';
/* ── Nav sections ───────────────────────────────── */
const NAV_SECTIONS = [
  { label: 'القائمة', hrefs: ['/'] },
  {
    label: 'التجارة',
    hrefs: [
      '/pos',
      '/sales',
      '/purchases',
      '/products',
      '/price-lists',
      '/inventory',
      '/customers',
      '/returns',
      '/devices',
      '/repairs',
    ],
  },
  { label: 'المالية', hrefs: ['/treasury', '/expenses', '/income', '/reports'] },
  { label: 'الموارد البشرية', hrefs: ['/employees', '/attendance', '/payroll'] },
  {
    label: 'المحاسبة',
    hrefs: [
      '/accounts',
      '/journal-entries',
      '/fiscal-years',
      '/audit-log',
      '/fixed-assets',
      '/accruals',
      '/bank-reconciliation',
      '/budgets',
      '/cost-centers',
    ],
  },
  { label: 'النظام', hrefs: ['/settings', '/branches'] },
];

interface LayoutProps {
  children: ReactNode;
}

const ROLE_DOT: Record<string, string> = {
  super_admin: 'var(--status-warning)',
  admin: 'var(--status-warning)',
  manager: 'var(--status-info)',
  cashier: 'var(--status-success)',
  salesperson: 'var(--status-info)',
};

function getInitials(name: string) {
  const p = name.trim().split(' ');
  return p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2);
}

/* ─────────────────────────────────────────────────
   TOPBAR SEARCH
   Keyboard: ↑↓ navigate, Enter confirm, Esc close
───────────────────────────────────────────────── */
function TopbarSearch({ navItems, isDark }: { navItems: typeof NAV_ITEMS; isDark: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? navItems
        .filter((i) => i.name.includes(query.trim()) || i.href.includes(query.toLowerCase()))
        .slice(0, 7)
    : navItems.slice(0, 7);

  const go = useCallback(
    (href: string) => {
      navigate(href);
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    },
    [navigate]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[idx]) go(results[idx].href);
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => setIdx(0), [query]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const iconColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';
  const inputColor = isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.75)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
      <div className="erp-topbar-search">
        <Search style={{ width: 14, height: 14, color: iconColor, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="ابحث في الصفحات..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '12.5px',
            fontFamily: 'inherit',
            color: inputColor,
            caretColor: 'var(--erp-caret)',
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              color: iconColor,
              display: 'flex',
            }}
          >
            <X style={{ width: 12, height: 12 }} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="erp-search-dropdown">
          {results.map((item, i) => (
            <div
              key={item.href}
              className={`erp-search-item ${i === idx ? 'active' : ''}`}
              onMouseDown={() => go(item.href)}
              onMouseEnter={() => setIdx(i)}
            >
              <item.icon style={{ width: 14, height: 14, opacity: 0.55, flexShrink: 0 }} />
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MAIN LAYOUT
───────────────────────────────────────────────── */
export function AppLayout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { hasFeature } = useSubscription();
  const { settings } = useAppSettings();
  const isDark = (settings.theme ?? 'dark') === 'dark';

  const { currentWarehouseId, setWarehouseId } = useWarehouse();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* ── Logout + check-out interception ── */
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  /* ── Idle timeout modal ── */
  const [showIdleModal, setShowIdleModal] = useState(false);

  /* ── Today's attendance record (for employees with employee_id) ── */
  const empId = user?.employee_id;
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todayRecRaw } = useQuery<Record<string, unknown>[]>({
    queryKey: ['layout-attendance-today', empId, todayStr],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(
        `/api/attendance/records?employee_id=${empId}&from=${todayStr}&to=${todayStr}`
      );
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
    refetchInterval: 2 * 60_000,
  });
  const todayRec =
    Array.isArray(todayRecRaw) && todayRecRaw.length > 0
      ? (todayRecRaw[0] as Record<string, unknown>)
      : null;
  const todayRecordId = todayRec?.id as number | undefined;
  const alreadyCheckedIn = !!todayRec?.check_in_time;
  const alreadyCheckedOut = !!todayRec?.check_out_time;

  /* ── Idle timeout: 1 hour ── */
  useIdleTimeout({
    timeoutMs: 60 * 60 * 1000,
    onIdle: () => {
      if (!showLogoutModal) setShowIdleModal(true);
    },
  });

  const { warehouses } = useWarehouses();

  const role = (user?.role ?? Role.Cashier) as UserRole;
  const canSelectWarehouse = role === Role.Admin || role === Role.Manager;

  useEffect(() => {
    if (!canSelectWarehouse && warehouses.length > 0) {
      const firstId = String(warehouses[0].id);
      if (currentWarehouseId !== firstId) setWarehouseId(firstId);
    }
  }, [warehouses, canSelectWarehouse, currentWarehouseId, setWarehouseId]);

  const ACCOUNTING_CORE = new Set([
    '/accounts',
    '/journal-entries',
    '/fiscal-years',
    '/audit-log',
    '/cost-centers',
    '/accruals',
  ]);
  const FIXED_ASSETS = new Set(['/fixed-assets']);
  const BANK_RECON = new Set(['/bank-reconciliation']);
  const BUDGETS = new Set(['/budgets']);
  const HR_PATHS = new Set(['/employees', '/attendance']);
  const POS_PATHS = new Set(['/pos']);
  const MAINTENANCE_PATHS = new Set(['/repairs', '/devices']);
  const visibleNav = NAV_ITEMS.filter((item) => {
    /* My portal: only for users who are linked to an employee */
    if (item.href === '/my-portal' && !user?.employee_id) return false;
    /* 1. Permission-based page access (can_access_*) */
    const permKey = ROUTE_PERMISSION[item.href];
    if (permKey) {
      if (!hasPermission(user, permKey)) return false;
    } else {
      /* Legacy role-based fallback for routes not in ROUTE_PERMISSION */
      if (!canAccess(role, item.href)) return false;
    }
    /* 2. Feature-flag checks (subscription plan) */
    if (ACCOUNTING_CORE.has(item.href) && !hasFeature('accounting')) return false;
    if (FIXED_ASSETS.has(item.href) && !hasFeature('fixed_assets')) return false;
    if (BANK_RECON.has(item.href) && !hasFeature('bank_reconciliation')) return false;
    if (BUDGETS.has(item.href) && !hasFeature('budgets')) return false;
    if (HR_PATHS.has(item.href) && !hasFeature('hr')) return false;
    if (POS_PATHS.has(item.href) && !hasFeature('pos')) return false;
    if (MAINTENANCE_PATHS.has(item.href) && !hasFeature('maintenance')) return false;
    return true;
  });

  const logoSrc =
    resolveUploadedFileUrl(settings.customLogo) || `${import.meta.env.BASE_URL}logo.png`;

  const pageTitle =
    NAV_ITEMS.find((i) => i.href === location)?.name ||
    (location === '/inventory'
      ? 'المخزون'
      : location === '/expenses'
        ? 'المصروفات'
        : location === '/income'
          ? 'الإيرادات'
          : location === '/receipt-vouchers'
            ? 'سندات القبض'
            : location === '/deposit-vouchers'
              ? 'سندات التوريد'
              : location === '/payment-vouchers'
                ? 'سندات الصرف'
                : location === '/safe-transfers'
                  ? 'تحويل الخزائن'
                  : location === '/accounts'
                    ? 'شجرة الحسابات'
                    : location === '/journal-entries'
                      ? 'القيود اليومية'
                      : location === '/fixed-assets'
                        ? 'الأصول الثابتة'
                        : location === '/accruals'
                          ? 'الاستحقاقات والمدفوعات المقدمة'
                          : location === '/bank-reconciliation'
                            ? 'المطابقة البنكية'
                            : location === '/budgets'
                              ? 'الميزانية التقديرية'
                              : location === '/cost-centers'
                                ? 'مراكز التكلفة'
                                : location === '/transfers'
                                  ? 'تحويل المخزون بين الفروع'
                                  : 'مرحباً بك');

  /* ── Colors — use CSS tokens so they auto-switch with html.light/dark ── */
  const sidebarBg  = 'var(--erp-bg-sidebar)';
  const sidebarBdr = '1px solid var(--erp-border-sidebar)';
  const topbarBg   = 'var(--erp-bg-topbar)';
  const topbarBdr  = '1px solid var(--erp-border-sidebar)';
  const textPrimary = 'var(--erp-text-1)';
  const textMuted   = 'var(--erp-text-4)';
  const chipBg  = 'var(--erp-chip-bg)';
  const chipBdr = '1px solid var(--erp-chip-border)';

  return (
    <div className="min-h-screen flex" dir="rtl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-black focus:p-2 focus:rounded"
      >
        تخطي إلى المحتوى الرئيسي
      </a>
      {/* ══════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col shrink-0 z-20"
        style={{
          width: sidebarCollapsed ? '60px' : '228px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: sidebarBg,
          borderLeft: sidebarBdr,
          backdropFilter: 'blur(24px)',
          transition: 'width 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Logo strip + toggle */}
        <div
          className="flex items-center"
          style={{
            height: '64px',
            borderBottom: sidebarBdr,
            flexShrink: 0,
            padding: sidebarCollapsed ? '0 12px' : '0 14px',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 11,
            position: 'relative',
            background: 'linear-gradient(135deg, var(--erp-brand-muted) 0%, transparent 60%)',
          }}
        >
          {/* Logo — square, no frame */}
          <div
            style={{
              width: sidebarCollapsed ? 44 : 48,
              height: sidebarCollapsed ? 44 : 48,
              borderRadius: 12,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}
          >
            <img
              src={logoSrc}
              alt={settings.companyName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = 'none';
              }}
            />
          </div>
          {!sidebarCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 13.5,
                  fontWeight: 900,
                  color: 'var(--erp-brand)',
                  lineHeight: 1.25,
                  letterSpacing: '0.01em',
                }}
                className="truncate"
              >
                {settings.companyName}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: 'var(--erp-text-4)',
                  lineHeight: 1.3,
                  marginTop: 2,
                }}
                className="truncate"
              >
                {settings.companySlogan}
              </p>
            </div>
          )}
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            aria-label={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            style={{
              position: sidebarCollapsed ? 'static' : 'absolute',
              left: sidebarCollapsed ? 'auto' : 8,
              top: sidebarCollapsed ? 'auto' : '50%',
              transform: sidebarCollapsed ? 'none' : 'translateY(-50%)',
              width: 22,
              height: 22,
              borderRadius: 6,
              border: '1px solid var(--erp-border-md)',
              background: 'var(--erp-bg-surface)',
              color: textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'opacity 0.2s',
            }}
          >
            <ChevronDown
              style={{
                width: 13,
                height: 13,
                transform: sidebarCollapsed ? 'rotate(90deg)' : 'rotate(-90deg)',
                transition: 'transform 0.25s ease',
              }}
            />
          </button>
        </div>

        {/* Warehouse selector */}
        {warehouses.length > 0 && canSelectWarehouse && !sidebarCollapsed && (
          <div
            className="mx-3 mt-2 rounded-lg px-3"
            style={{
              flexShrink: 0,
              paddingTop: 8,
              paddingBottom: 8,
              background: 'var(--erp-brand-muted)',
              border: '1px solid var(--erp-brand-border)',
            }}
          >
            <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
              <Warehouse
                style={{
                  width: 11,
                  height: 11,
                  color: 'var(--erp-brand-dim)',
                }}
              />
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: textMuted,
                }}
              >
                المخزن
              </span>
            </div>
            <select
              value={currentWarehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12.5,
                fontWeight: 600,
                color: textPrimary,
                cursor: 'pointer',
                fontFamily: 'inherit',
                appearance: 'none',
              }}
            >
              <option value="" style={{ background: isDark ? 'var(--bg-card)' : 'var(--text-1)' }}>
                كل المخازن
              </option>
              {warehouses.map((w) => (
                <option
                  key={w.id}
                  value={String(w.id)}
                  style={{ background: isDark ? 'var(--bg-card)' : 'var(--text-1)' }}
                >
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav
          role="navigation"
          aria-label="القائمة الرئيسية"
          className="flex-1 overflow-y-auto pb-4 mt-1"
          style={{ scrollbarWidth: 'none', padding: sidebarCollapsed ? '4px 8px' : '0 12px' }}
        >
          {NAV_SECTIONS.map((section, si) => {
            const items = visibleNav.filter((i) => section.hrefs.includes(i.href));
            if (!items.length) return null;
            const sectionActive =
              items.some((i) => i.href === location) ||
              (section.hrefs.includes('/inventory') && location === '/transfers');
            const isAccounting = section.label === 'المحاسبة';
            /* Accounting: toggle-able; all others: always open */
            const isOpen = isAccounting ? (openSections[section.label] ?? sectionActive) : true;
            return (
              <div key={section.label}>
                {/* Section label — hidden when collapsed */}
                {!sidebarCollapsed &&
                  (isAccounting ? (
                    /* Accounting: clickable with arrow */
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSections((prev) => ({
                          ...prev,
                          [section.label]: !(prev[section.label] ?? sectionActive),
                        }))
                      }
                      className="erp-divider-label"
                      style={{
                        paddingTop: si === 0 ? 10 : 16,
                        paddingBottom: 4,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'right',
                      }}
                    >
                      <span>{section.label}</span>
                      <ChevronDown
                        style={{
                          width: 12,
                          height: 12,
                          opacity: 0.55,
                          transition: 'transform 0.2s ease',
                          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        }}
                      />
                    </button>
                  ) : (
                    /* Other sections: plain label, no arrow, always open */
                    <div
                      className="erp-divider-label"
                      style={{ paddingTop: si === 0 ? 10 : 16, paddingBottom: 4 }}
                    >
                      <span>{section.label}</span>
                    </div>
                  ))}
                {/* Divider line when collapsed */}
                {sidebarCollapsed && si > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: 'var(--erp-border)',
                      margin: '8px 0',
                    }}
                  />
                )}
                {/* Nav items */}
                {(sidebarCollapsed || isOpen) &&
                  items.map((item) => {
                    const active =
                      location === item.href ||
                      (item.href === '/inventory' && location === '/transfers');
                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`nav-item ${active ? 'active' : ''}`}
                          title={sidebarCollapsed ? item.name : undefined}
                          style={
                            sidebarCollapsed
                              ? { justifyContent: 'center', paddingRight: 0, paddingLeft: 0 }
                              : {}
                          }
                        >
                          <item.icon
                            style={{
                              width: 16,
                              height: 16,
                              flexShrink: 0,
                              opacity: active ? 1 : 0.55,
                              color: active ? 'var(--erp-brand)' : 'inherit',
                            }}
                          />
                          {!sidebarCollapsed && <span style={{ flex: 1 }}>{item.name}</span>}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* ── My Portal pinned bottom link ── */}
        {user?.employee_id && (
          <div
            style={{
              flexShrink: 0,
              borderTop: sidebarBdr,
              padding: sidebarCollapsed ? '8px' : '8px 12px',
            }}
          >
            <Link href="/my-portal">
              <div
                className={`nav-item ${location === '/my-portal' ? 'active' : ''}`}
                title={sidebarCollapsed ? 'بوابتي الشخصية' : undefined}
                style={{
                  ...(sidebarCollapsed
                    ? { justifyContent: 'center', paddingRight: 0, paddingLeft: 0 }
                    : {}),
                  background: location === '/my-portal'
                    ? 'var(--erp-bg-active)'
                    : 'var(--erp-brand-muted)',
                  border: `1px solid ${location === '/my-portal' ? 'var(--erp-brand-border)' : 'var(--erp-brand-muted)'}`,
                  borderRadius: 10,
                  marginBottom: 0,
                }}
              >
                <UserCircle
                  style={{
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                    color: 'var(--erp-brand)',
                    opacity: location === '/my-portal' ? 1 : 0.75,
                  }}
                />
                {!sidebarCollapsed && (
                  <span
                    style={{
                      flex: 1,
                      color: 'var(--erp-brand)',
                      fontWeight: location === '/my-portal' ? 800 : 600,
                      fontSize: 13,
                    }}
                  >
                    بوابتي الشخصية
                  </span>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* Sidebar footer */}
        <div
          className="flex items-center justify-between px-4"
          style={{ height: 40, borderTop: sidebarBdr, flexShrink: 0 }}
        >
          {!sidebarCollapsed && (
            <span style={{ fontSize: 10, color: textMuted }}>MuhKam Advanced</span>
          )}
          <div className="glow-dot" style={sidebarCollapsed ? { margin: '0 auto' } : {}} />
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAV (customisable)
      ══════════════════════════════════════════ */}
      <MobileNav visibleNav={visibleNav} isDark={isDark} />

      {/* ══════════════════════════════════════════
          MAIN CONTENT COLUMN
      ══════════════════════════════════════════ */}
      <main
        id="main-content"
        role="main"
        aria-label="المحتوى الرئيسي"
        className="flex-1 flex flex-col min-h-screen overflow-hidden pb-14 lg:pb-0"
        style={{ minWidth: 0 }}
      >
        {/* ── Topbar ── */}
        <header
          role="banner"
          aria-label="شريط العنوان"
          className="flex items-center gap-3 shrink-0"
          style={{
            height: '56px',
            padding: '0 20px',
            background: topbarBg,
            borderBottom: topbarBdr,
            backdropFilter: 'blur(20px)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Left: Page info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              style={{
                width: 3,
                height: 18,
                borderRadius: 99,
                flexShrink: 0,
                background: 'linear-gradient(to bottom, #f59e0b, #d97706)',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <h2
                style={{ fontSize: 14.5, fontWeight: 800, color: textPrimary, lineHeight: 1.2 }}
                className="truncate"
              >
                {pageTitle}
              </h2>
            </div>
          </div>

          {/* Center: Search */}
          <div className="hidden md:flex justify-center" style={{ flexShrink: 0 }}>
            <TopbarSearch navItems={visibleNav} isDark={isDark} />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            <NotificationBell />
            <AlertBell />
            <ThemeToggle />
            {user && (
              <div
                className="hidden md:flex items-center gap-2 rounded-xl px-2.5 py-1.5"
                style={{ background: chipBg, border: chipBdr, flexShrink: 0 }}
              >
                <div
                  className="flex items-center justify-center shrink-0 font-black"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--erp-brand), var(--erp-brand-hover))',
                    color: 'var(--text-1)',
                    fontSize: 10,
                  }}
                >
                  {getInitials(user.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: textPrimary,
                      lineHeight: 1.2,
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.name}
                  </p>
                  <div className="flex items-center gap-1" style={{ marginTop: 1 }}>
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: ROLE_DOT[user.role] ?? 'var(--text-2)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 10, color: textMuted, fontWeight: 600 }}>
                      {translateRole(user.role)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    width: 1,
                    height: 22,
                    background: 'var(--erp-border-md)',
                    flexShrink: 0,
                    margin: '0 2px',
                  }}
                />
                <button
                  onClick={() => setShowLogoutModal(true)}
                  title="تسجيل الخروج"
                  aria-label="تسجيل الخروج"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    border: 'none',
                    background: 'transparent',
                    color: textMuted,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <LogOut style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* ── Logout check-out modal ── */}
      {showLogoutModal && (
        <LogoutCheckoutModal
          employeeId={empId}
          todayRecordId={todayRecordId}
          alreadyCheckedIn={alreadyCheckedIn}
          alreadyCheckedOut={alreadyCheckedOut}
          onLogout={() => {
            setShowLogoutModal(false);
            logout();
          }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      {/* ── Idle timeout modal ── */}
      {showIdleModal && (
        <IdleCheckoutModal
          employeeId={empId}
          todayRecordId={todayRecordId}
          alreadyCheckedOut={alreadyCheckedOut}
          onStayLoggedIn={() => setShowIdleModal(false)}
          onLogout={() => {
            setShowIdleModal(false);
            logout();
          }}
        />
      )}
    </div>
  );
}
