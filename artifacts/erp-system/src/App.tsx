import { lazy, Suspense } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppLayout } from '@/components/layout';
import { SubscriptionBanner } from '@/components/subscription-banner';
import { AnnouncementBanner } from '@/components/announcement-banner';
import { AuthProvider, useAuth } from '@/contexts/auth';
import { SubscriptionProvider } from '@/contexts/subscription';
import { AppSettingsProvider } from '@/contexts/app-settings';
import { WarehouseProvider } from '@/contexts/warehouse';
import { canAccess, type UserRole } from '@/lib/rbac';
import { Spinner } from '@/components/ui/spinner';
import NotFound from '@/pages/not-found';
import AccessDenied from '@/pages/access-denied';
import SubscriptionExpired from '@/pages/subscription-expired';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/offline-banner';

/* ── Lazy-loaded pages ─────────────────────────────────── */
const Login = lazy(() => import('@/pages/login'));
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
const Inventory = lazy(() => import('@/pages/inventory'));
const Vouchers = lazy(() => import('@/pages/vouchers'));
const POS = lazy(() => import('@/pages/pos'));
const SuperAdmin = lazy(() => import('@/pages/super-admin'));
const Branches = lazy(() => import('@/pages/branches'));
const Employees = lazy(() => import('@/pages/employees'));
const Attendance = lazy(() => import('@/pages/attendance'));
const Returns = lazy(() => import('@/pages/returns'));
const Warranty = lazy(() => import('@/pages/warranty'));
const Repairs  = lazy(() => import('@/pages/repairs'));
const Devices  = lazy(() => import('@/pages/devices'));
const ScrapInventory = lazy(() => import('@/pages/scrap-inventory'));
const BadDebts = lazy(() => import('@/pages/bad-debts'));
const Consignment = lazy(() => import('@/pages/consignment'));
const FixedAssets = lazy(() => import('@/pages/fixed-assets'));
const Accruals = lazy(() => import('@/pages/accruals'));
const BankReconciliation = lazy(() => import('@/pages/bank-reconciliation'));
const Budgets = lazy(() => import('@/pages/budgets'));
const CostCenters = lazy(() => import('@/pages/cost-centers'));

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
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner className="w-8 h-8 text-amber-500" />
    </div>
  );
}

function Guard({ path, component: Component }: { path: string; component: React.ComponentType }) {
  const { user } = useAuth();
  const role = (user?.role ?? 'cashier') as UserRole;
  if (!canAccess(role, path)) return <AccessDenied />;
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

function Router() {
  const { user, subscriptionExpired } = useAuth();
  const [location] = useLocation();

  if (!user) {
    return location === '/login' ? (
      <Suspense fallback={<PageFallback />}>
        <Login />
      </Suspense>
    ) : (
      <Redirect to="/login" />
    );
  }
  if (location === '/login') {
    return user.role === 'super_admin' ? <Redirect to="/super-admin" /> : <Redirect to="/" />;
  }

  /* ── Subscription expired: full-screen block ─────────── */
  if (subscriptionExpired) {
    return <SubscriptionExpired />;
  }

  /* ── Super admin: isolated full-screen panel ─────────── */
  if (user.role === 'super_admin') {
    return (
      <Suspense fallback={<PageFallback />}>
        <SuperAdmin />
      </Suspense>
    );
  }

  /* ── POS: full-screen standalone (no sidebar / layout) ── */
  if (location === '/pos') {
    const posRole = (user?.role ?? 'cashier') as UserRole;
    if (!canAccess(posRole, '/pos')) return <AccessDenied />;
    return (
      <Suspense
        fallback={
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ background: 'hsl(225,28%,4%)' }}
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
        <Route path="/consignment">{() => <Guard path="/consignment" component={Consignment} />}</Route>
        <Route path="/suppliers">{() => <Redirect to="/customers" />}</Route>
        <Route path="/returns">{() => <Guard path="/returns" component={Returns} />}</Route>
        <Route path="/warranty">{() => <Guard path="/warranty" component={Warranty} />}</Route>
        <Route path="/devices">{() => <Guard path="/devices" component={Devices} />}</Route>
        <Route path="/repairs">{() => <Guard path="/repairs" component={Repairs} />}</Route>
        <Route path="/scrap-inventory">{() => <Guard path="/scrap-inventory" component={ScrapInventory} />}</Route>
        <Route path="/bad-debts">{() => <Guard path="/bad-debts" component={BadDebts} />}</Route>
        <Route path="/products">{() => <Guard path="/products" component={Products} />}</Route>
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
        <Route path="/audit-log">
          {() => <Guard path="/audit-log" component={AuditLog} />}
        </Route>
        <Route path="/branches">{() => <Guard path="/branches" component={Branches} />}</Route>
        <Route path="/employees">{() => <Guard path="/employees" component={Employees} />}</Route>
        <Route path="/payroll">{() => <Redirect to="/employees" />}</Route>
        <Route path="/attendance">
          {() => <Guard path="/attendance" component={Attendance} />}
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
        <Route path="/fixed-assets">{() => <Guard path="/fixed-assets" component={FixedAssets} />}</Route>
        <Route path="/accruals">{() => <Guard path="/accruals" component={Accruals} />}</Route>
        <Route path="/bank-reconciliation">{() => <Guard path="/bank-reconciliation" component={BankReconciliation} />}</Route>
        <Route path="/budgets">{() => <Guard path="/budgets" component={Budgets} />}</Route>
        <Route path="/cost-centers">{() => <Guard path="/cost-centers" component={CostCenters} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
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
