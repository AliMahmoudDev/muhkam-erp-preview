import { lazy, Suspense, useEffect, useState } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppLayout } from '@/components/layout';
import { SubscriptionBanner } from '@/components/subscription-banner';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AuthProvider, useAuth } from '@/contexts/auth';
import {
  SubscriptionProvider,
  useSubscription,
  type CompanyFeatures,
} from '@/contexts/subscription';
import { AppSettingsProvider } from '@/contexts/app-settings';
import { WarehouseProvider } from '@/contexts/warehouse';
import { canAccess, ROUTE_PERMISSION, type UserRole } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { Role } from '@/lib/roles';
import { Spinner } from '@/components/ui/spinner';
import NotFound from '@/pages/not-found';
import AccessDenied from '@/pages/access-denied';
import SubscriptionExpired from '@/pages/subscription-expired';
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingPage } from '@/components/loading-page';
import { OfflineBanner } from '@/components/offline-banner';
import EmployeeGateway from '@/components/employee-gateway';

/* ── Feature → route mapping ─────────────────────────────
   Defines which feature flag must be enabled for each route.
   Routes NOT listed here require no feature flag.           */
const ROUTE_FEATURES: Partial<Record<string, keyof CompanyFeatures>> = {
  '/accounts': 'accounting',
  '/journal-entries': 'accounting',
  '/fiscal-years': 'accounting',
  '/audit-log': 'accounting',
  '/cost-centers': 'accounting',
  '/accruals': 'accounting',
  '/fixed-assets': 'fixed_assets',
  '/bank-reconciliation': 'bank_reconciliation',
  '/budgets': 'budgets',
  '/employees': 'hr',
  '/attendance': 'hr',
  '/payroll': 'hr',
  '/pos': 'pos',
  '/repairs': 'maintenance',
  '/devices': 'maintenance',
};

/* ── Lazy-loaded pages ─────────────────────────────────── */
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const Login = lazy(() => import('@/pages/login'));
const RepairTrack = lazy(() => import('@/pages/repair-track'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Sales = lazy(() => import('@/pages/sales'));
const Purchases = lazy(() => import('@/pages/purchases'));
const Customers = lazy(() => import('@/pages/customers'));
const Expenses = lazy(() => import('@/pages/expenses'));
const Income = lazy(() => import('@/pages/income'));
const Reports = lazy(() => import('@/pages/reports'));
const Settings = lazy(() => import('@/pages/settings'));
const Accounts = lazy(() => import('@/pages/accounts'));
const JournalEntries = lazy(() => import('@/pages/journal-entries'));
const FiscalYears = lazy(() => import('@/pages/fiscal-years'));
const AuditLog = lazy(() => import('@/pages/audit-log'));
const Treasury = lazy(() => import('@/pages/treasury'));
const Products = lazy(() => import('@/pages/products'));
const PriceLists = lazy(() => import('@/pages/price-lists'));
const Inventory = lazy(() => import('@/pages/inventory'));
const Vouchers = lazy(() => import('@/pages/vouchers'));
const POS = lazy(() => import('@/pages/pos'));
const SuperAdmin = lazy(() => import('@/pages/super-admin'));
const Branches = lazy(() => import('@/pages/branches'));
const Employees = lazy(() => import('@/pages/employees'));
const Attendance = lazy(() => import('@/pages/attendance'));
const Payroll = lazy(() => import('@/pages/payroll'));
const Returns = lazy(() => import('@/pages/returns'));
const Repairs = lazy(() => import('@/pages/repairs'));
const Devices = lazy(() => import('@/pages/devices'));
const FixedAssets = lazy(() => import('@/pages/fixed-assets'));
const Accruals = lazy(() => import('@/pages/accruals'));
const BankReconciliation = lazy(() => import('@/pages/bank-reconciliation'));
const Budgets = lazy(() => import('@/pages/budgets'));
const CostCenters = lazy(() => import('@/pages/cost-centers'));
const Transfers = lazy(() => import('@/pages/transfers'));
const EmployeePortal = lazy(() => import('@/pages/employee-portal'));

/* ── QueryClient with staleTime for performance ─────────── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30 seconds
    },
  },
});

/* ── Page suspense wrapper ───────────────────────────────── */
function PageFallback() {
  return <LoadingPage />;
}

function Guard({ path, component: Component }: { path: string; component: React.ComponentType }) {
  const { user } = useAuth();
  const { hasFeature } = useSubscription();

  /* Permission-based page access (can_access_*) has priority */
  const permKey = ROUTE_PERMISSION[path];
  if (permKey) {
    if (!hasPermission(user, permKey)) return <AccessDenied />;
  } else {
    /* Fallback to legacy role check for routes not yet in ROUTE_PERMISSION */
    const role = (user?.role ?? 'cashier') as UserRole;
    if (!canAccess(role, path)) return <AccessDenied />;
  }

  const requiredFeature = ROUTE_FEATURES[path];
  if (requiredFeature && !hasFeature(requiredFeature)) return <Redirect to="/" />;
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

function Router() {
  const { user, subscriptionExpired } = useAuth();
  const { hasFeature } = useSubscription();
  const [location] = useLocation();
  const [gatewayPassed, setGatewayPassed] = useState(() => {
    const uid = (() => {
      try {
        const s = localStorage.getItem('erp_current_user');
        if (!s) return 0;
        return (JSON.parse(s) as { id?: number }).id ?? 0;
      } catch {
        return 0;
      }
    })();
    return !!sessionStorage.getItem(`erp_gateway_${uid}`);
  });

  /* ── PUBLIC: customer repair tracking via QR — no auth required ── */
  if (location.startsWith('/track/')) {
    return (
      <Suspense fallback={<PageFallback />}>
        <RepairTrack />
      </Suspense>
    );
  }

  if (!user) {
    if (location === '/login') {
      return (
        <Suspense fallback={<PageFallback />}>
          <Login />
        </Suspense>
      );
    }
    if (location === '/') {
      return (
        <Suspense fallback={<PageFallback />}>
          <LandingPage />
        </Suspense>
      );
    }
    return <Redirect to="/" />;
  }
  if (location === '/login') {
    return user.role === Role.SuperAdmin ? <Redirect to="/super-admin" /> : <Redirect to="/" />;
  }

  /* ── Subscription expired: full-screen block ─────────── */
  if (subscriptionExpired) {
    return <SubscriptionExpired />;
  }

  /* ── Super admin: isolated full-screen panel ─────────── */
  if (user.role === Role.SuperAdmin) {
    return (
      <Suspense fallback={<PageFallback />}>
        <SuperAdmin />
      </Suspense>
    );
  }

  /* ── Gateway: shown once per session for all non-super_admin ── */
  if (!gatewayPassed) {
    return (
      <EmployeeGateway
        onEnter={() => {
          sessionStorage.setItem(`erp_gateway_${user.id}`, '1');
          setGatewayPassed(true);
        }}
      />
    );
  }

  /* ── Employee / Technician role: redirect root to personal portal ── */
  if ((user.role === Role.Employee || user.role === Role.Technician) && location === '/') {
    return <Redirect to="/my-portal" />;
  }

  /* ── POS: full-screen standalone (no sidebar / layout) ── */
  if (location === '/pos') {
    if (!hasPermission(user, 'can_access_pos')) return <AccessDenied />;
    if (!hasFeature('pos')) return <Redirect to="/" />;
    return (
      <Suspense
        fallback={
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ background: 'hsl(var(--background))' }}
          >
            <Spinner className="w-8 h-8 text-amber-500" />
          </div>
        }
      >
        <POS />
      </Suspense>
    );
  }

  return (
    <AppLayout>
      <SubscriptionBanner />
      <AnnouncementBanner />
      <Switch>
        <Route path="/">
          {() => (
            <Suspense fallback={<PageFallback />}>
              <Dashboard />
            </Suspense>
          )}
        </Route>
        <Route path="/sales">{() => <Guard path="/sales" component={Sales} />}</Route>
        <Route path="/purchases">{() => <Guard path="/purchases" component={Purchases} />}</Route>
        <Route path="/suppliers">{() => <Redirect to="/customers" />}</Route>
        <Route path="/returns">{() => <Guard path="/returns" component={Returns} />}</Route>
        <Route path="/warranty">{() => <Redirect to="/devices" />}</Route>
        <Route path="/devices">{() => <Guard path="/devices" component={Devices} />}</Route>
        <Route path="/repairs">{() => <Guard path="/repairs" component={Repairs} />}</Route>
        <Route path="/scrap-inventory">{() => <Redirect to="/inventory" />}</Route>
        <Route path="/bad-debts">{() => <Redirect to="/customers" />}</Route>
        <Route path="/products">{() => <Guard path="/products" component={Products} />}</Route>
        <Route path="/price-lists">
          {() => <Guard path="/price-lists" component={PriceLists} />}
        </Route>
        <Route path="/inventory">{() => <Guard path="/inventory" component={Inventory} />}</Route>
        <Route path="/customers">{() => <Guard path="/customers" component={Customers} />}</Route>
        <Route path="/expenses">{() => <Guard path="/expenses" component={Expenses} />}</Route>
        <Route path="/income">{() => <Guard path="/income" component={Income} />}</Route>
        <Route path="/treasury">{() => <Guard path="/treasury" component={Treasury} />}</Route>
        <Route path="/tasks">{() => <Redirect to="/treasury" />}</Route>
        <Route path="/profits">{() => <Redirect to="/reports" />}</Route>
        <Route path="/reports">{() => <Guard path="/reports" component={Reports} />}</Route>
        <Route path="/settings">{() => <Guard path="/settings" component={Settings} />}</Route>
        <Route path="/accounts">{() => <Guard path="/accounts" component={Accounts} />}</Route>
        <Route path="/journal-entries">
          {() => <Guard path="/journal-entries" component={JournalEntries} />}
        </Route>
        <Route path="/fiscal-years">
          {() => <Guard path="/fiscal-years" component={FiscalYears} />}
        </Route>
        <Route path="/audit-log">{() => <Guard path="/audit-log" component={AuditLog} />}</Route>
        <Route path="/branches">{() => <Guard path="/branches" component={Branches} />}</Route>
        <Route path="/employees">{() => <Guard path="/employees" component={Employees} />}</Route>
        <Route path="/payroll">{() => <Guard path="/payroll" component={Payroll} />}</Route>
        <Route path="/attendance">
          {() => <Guard path="/attendance" component={Attendance} />}
        </Route>
        <Route path="/my-portal">
          {() => (
            <Suspense fallback={<PageFallback />}>
              <EmployeePortal />
            </Suspense>
          )}
        </Route>
        <Route path="/leaves">{() => <Redirect to="/employees" />}</Route>
        <Route path="/salary-advances">{() => <Redirect to="/employees" />}</Route>
        <Route path="/incentives">{() => <Redirect to="/employees" />}</Route>
        <Route path="/vouchers">{() => <Guard path="/vouchers" component={Vouchers} />}</Route>
        <Route path="/receipt-vouchers">{() => <Redirect to="/vouchers" />}</Route>
        <Route path="/deposit-vouchers">{() => <Redirect to="/vouchers" />}</Route>
        <Route path="/payment-vouchers">{() => <Redirect to="/vouchers" />}</Route>
        <Route path="/safe-transfers">{() => <Redirect to="/vouchers" />}</Route>
        <Route path="/financial-transactions">{() => <Redirect to="/reports" />}</Route>
        <Route path="/fixed-assets">
          {() => <Guard path="/fixed-assets" component={FixedAssets} />}
        </Route>
        <Route path="/accruals">{() => <Guard path="/accruals" component={Accruals} />}</Route>
        <Route path="/bank-reconciliation">
          {() => <Guard path="/bank-reconciliation" component={BankReconciliation} />}
        </Route>
        <Route path="/budgets">{() => <Guard path="/budgets" component={Budgets} />}</Route>
        <Route path="/cost-centers">
          {() => <Guard path="/cost-centers" component={CostCenters} />}
        </Route>
        <Route path="/transfers">{() => <Guard path="/transfers" component={Transfers} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  useEffect(() => {
    const clearTenantCache = () => {
      queryClient.clear();
    };

    window.addEventListener('auth:user-changed', clearTenantCache);
    return () => {
      window.removeEventListener('auth:user-changed', clearTenantCache);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppSettingsProvider>
            <WarehouseProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                    <Router />
                  </WouterRouter>
                  <Toaster />
                  <OfflineBanner />
                </SubscriptionProvider>
              </AuthProvider>
            </WarehouseProvider>
          </AppSettingsProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
