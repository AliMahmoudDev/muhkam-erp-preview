/**
 * Frontend RBAC utilities.
 * These are UI-level guards only — real security is enforced on the backend.
 */
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Package,
  Users,
  TrendingUp,
  FileText,
  Settings,
  Zap,
  BookOpen,
  ReceiptText,
  Wallet,
  ClipboardList,
  GitBranch,
  UserCheck,
  Clock,
  Shield,
  ShieldCheck,
  RotateCcw,
  Building2,
  Landmark,
  Scale,
  Target,
  PiggyBank,
  Wrench,
  Smartphone,
  ArrowLeftRight,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

export type AppRole = 'admin' | 'manager' | 'cashier' | 'salesperson' | 'employee';
export type UserRole = AppRole;

/* ── Route → permission key mapping ────────────────────────
   Every guarded route maps to its can_access_* permission.   */
export const ROUTE_PERMISSION: Record<string, string> = {
  '/':                    'can_access_dashboard',
  '/pos':                 'can_access_pos',
  '/sales':               'can_access_sales',
  '/purchases':           'can_access_purchases',
  '/products':            'can_access_products',
  '/inventory':           'can_access_inventory',
  '/customers':           'can_access_customers',
  '/returns':             'can_access_returns',
  '/devices':             'can_access_devices',
  '/repairs':             'can_access_repairs',
  '/warranty':            'can_access_warranty',
  '/income':              'can_access_income',
  '/expenses':            'can_access_expenses',
  '/treasury':            'can_access_treasury',
  '/vouchers':            'can_access_vouchers',
  '/reports':             'can_access_reports',
  '/accounts':            'can_access_accounts',
  '/journal-entries':     'can_access_journal_entries',
  '/fixed-assets':        'can_access_fixed_assets',
  '/accruals':            'can_access_accruals',
  '/bank-reconciliation': 'can_access_bank_reconciliation',
  '/budgets':             'can_access_budgets',
  '/cost-centers':        'can_access_cost_centers',
  '/fiscal-years':        'can_access_fiscal_years',
  '/audit-log':           'can_access_audit_log',
  '/branches':            'can_access_branches',
  '/employees':           'can_access_employees',
  '/attendance':          'can_access_attendance',
  '/payroll':             'can_access_payroll',
  '/settings':            'can_access_settings',
  '/transfers':           'can_access_transfers',
};

/* ── Nav items with role visibility + icons ─────────────── */
export const NAV_ITEMS: { name: string; href: string; icon: LucideIcon; roles: AppRole[] }[] = [
  { name: 'الرئيسية',              href: '/',                    icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier', 'salesperson'] },
  { name: 'السندات والخزينة',      href: '/treasury',            icon: Wallet,          roles: ['admin', 'manager', 'cashier', 'salesperson'] },
  { name: 'نقطة البيع',            href: '/pos',                 icon: Zap,             roles: ['admin', 'manager', 'cashier', 'salesperson'] },
  { name: 'المبيعات',              href: '/sales',               icon: Receipt,         roles: ['admin', 'manager', 'cashier', 'salesperson'] },
  { name: 'المشتريات',             href: '/purchases',           icon: CreditCard,      roles: ['admin', 'manager'] },
  { name: 'المنتجات',              href: '/products',            icon: Package,         roles: ['admin', 'manager', 'cashier', 'salesperson'] },
  { name: 'المخزون',               href: '/inventory',           icon: ClipboardList,   roles: ['admin', 'manager'] },
  { name: 'التحويلات',             href: '/transfers',           icon: ArrowLeftRight,  roles: ['admin', 'manager'] },
  { name: 'العملاء والموردون',     href: '/customers',           icon: Users,           roles: ['admin', 'manager', 'cashier', 'salesperson'] },
  { name: 'المرتجعات',             href: '/returns',             icon: RotateCcw,       roles: ['admin', 'manager'] },
  { name: 'الأجهزة',               href: '/devices',             icon: Smartphone,      roles: ['admin', 'manager', 'cashier'] },
  { name: 'الصيانة',               href: '/repairs',             icon: Wrench,          roles: ['admin', 'manager', 'cashier'] },
  { name: 'الضمانات',              href: '/warranty',            icon: ShieldCheck,     roles: ['admin', 'manager', 'cashier'] },
  { name: 'الإيرادات',             href: '/income',              icon: TrendingUp,      roles: ['admin', 'manager'] },
  { name: 'المصروفات',             href: '/expenses',            icon: ReceiptText,     roles: ['admin', 'manager'] },
  { name: 'التقارير',              href: '/reports',             icon: FileText,        roles: ['admin', 'manager'] },
  { name: 'شجرة الحسابات',         href: '/accounts',            icon: BookOpen,        roles: ['admin'] },
  { name: 'القيود اليومية',        href: '/journal-entries',     icon: FileText,        roles: ['admin'] },
  { name: 'الأصول الثابتة',        href: '/fixed-assets',        icon: Building2,       roles: ['admin'] },
  { name: 'الاستحقاقات والمدفوعات',href: '/accruals',            icon: Scale,           roles: ['admin'] },
  { name: 'المطابقة البنكية',      href: '/bank-reconciliation', icon: Landmark,        roles: ['admin'] },
  { name: 'الميزانية التقديرية',   href: '/budgets',             icon: PiggyBank,       roles: ['admin', 'manager'] },
  { name: 'مراكز التكلفة',         href: '/cost-centers',        icon: Target,          roles: ['admin'] },
  { name: 'السنوات المالية',       href: '/fiscal-years',        icon: BookOpen,        roles: ['admin'] },
  { name: 'سجل التدقيق',           href: '/audit-log',           icon: Shield,          roles: ['admin'] },
  { name: 'الفروع',                href: '/branches',            icon: GitBranch,       roles: ['admin', 'manager'] },
  { name: 'الإعدادات',             href: '/settings',            icon: Settings,        roles: ['admin'] },
  { name: 'الموظفون',              href: '/employees',           icon: UserCheck,       roles: ['admin', 'manager', 'employee'] },
  { name: 'الحضور والانصراف',      href: '/attendance',          icon: Clock,           roles: ['admin', 'manager'] },
  { name: 'الرواتب',               href: '/payroll',             icon: Wallet,          roles: ['admin', 'manager'] },
  { name: 'بوابتي الشخصية',        href: '/my-portal',           icon: UserCircle,      roles: ['admin', 'manager', 'cashier', 'salesperson', 'employee'] },
];

/* ── Helpers ────────────────────────────────────────────── */
export function canAccess(role: string | undefined, route: string): boolean {
  if (!role) return false;
  const allowed = (NAV_ITEMS.find(i => i.href === route))?.roles;
  if (!allowed) return true;
  return allowed.includes(role as AppRole);
}

export function isAdmin(role?: string) {
  return role === 'admin';
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin:    'المسؤول العام',
  company_admin:  'مدير الشركة',
  branch_manager: 'مدير الفرع',
  admin:          'مدير النظام',
  manager:        'مشرف',
  cashier:        'كاشير',
  salesperson:    'مندوب مبيعات',
  agent:          'موظف مبيعات',
  client:         'عميل',
  employee:       'موظف (بياناتي)',
};
