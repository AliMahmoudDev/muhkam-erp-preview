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
  HandCoins,
  ReceiptText,
  Wallet,
  ClipboardList,
  GitBranch,
  UserCheck,
  Clock,
  Shield,
  ShieldCheck,
  RotateCcw,
  Archive,
  Building2,
  Landmark,
  Scale,
  Target,
  PiggyBank,
  Wrench,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

export type AppRole = 'admin' | 'manager' | 'cashier' | 'salesperson' | 'employee';
export type UserRole = AppRole;

/* ── Which roles can access each route ─────────────────── */
export const ROUTE_ROLES: Record<string, AppRole[]> = {
  '/': ['admin', 'manager', 'cashier', 'salesperson'],
  '/treasury': ['admin', 'manager', 'cashier', 'salesperson'],
  '/pos': ['admin', 'manager', 'cashier', 'salesperson'],
  '/sales': ['admin', 'manager', 'cashier', 'salesperson'],
  '/purchases': ['admin', 'manager'],
  '/products': ['admin', 'manager', 'cashier', 'salesperson'],
  '/inventory': ['admin', 'manager'],
  '/customers': ['admin', 'manager', 'cashier', 'salesperson'],
  '/returns': ['admin', 'manager'],
  '/warranty': ['admin', 'manager', 'cashier'],
  '/devices': ['admin', 'manager', 'cashier'],
  '/repairs': ['admin', 'manager', 'cashier'],
  '/scrap-inventory': ['admin', 'manager'],
  '/bad-debts': ['admin', 'manager'],
  '/consignment': ['admin', 'manager'],
  '/accounts': ['admin'],
  '/journal-entries': ['admin'],
  '/fiscal-years': ['admin'],
  '/audit-log': ['admin'],
  '/fixed-assets': ['admin'],
  '/accruals': ['admin'],
  '/bank-reconciliation': ['admin'],
  '/budgets': ['admin', 'manager'],
  '/cost-centers': ['admin'],
  '/reports': ['admin', 'manager'],
  '/expenses': ['admin', 'manager'],
  '/income': ['admin', 'manager'],
  '/vouchers': ['admin', 'manager'],
  '/branches': ['admin', 'manager'],
  '/settings': ['admin'],
  '/employees': ['admin', 'manager', 'employee'],
  '/attendance': ['admin', 'manager'],
};

/* ── Nav items with role visibility + icons ─────────────── */
export const NAV_ITEMS: { name: string; href: string; icon: LucideIcon; roles: AppRole[] }[] = [
  {
    name: 'الرئيسية',
    href: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'cashier', 'salesperson'],
  },
  {
    name: 'السندات والخزينة',
    href: '/treasury',
    icon: Wallet,
    roles: ['admin', 'manager', 'cashier', 'salesperson'],
  },
  {
    name: 'نقطة البيع',
    href: '/pos',
    icon: Zap,
    roles: ['admin', 'manager', 'cashier', 'salesperson'],
  },
  {
    name: 'المبيعات',
    href: '/sales',
    icon: Receipt,
    roles: ['admin', 'manager', 'cashier', 'salesperson'],
  },
  { name: 'المشتريات', href: '/purchases', icon: CreditCard, roles: ['admin', 'manager'] },
  {
    name: 'المنتجات',
    href: '/products',
    icon: Package,
    roles: ['admin', 'manager', 'cashier', 'salesperson'],
  },
  { name: 'المخزون', href: '/inventory', icon: ClipboardList, roles: ['admin', 'manager'] },
  {
    name: 'العملاء والموردون',
    href: '/customers',
    icon: Users,
    roles: ['admin', 'manager', 'cashier', 'salesperson'],
  },
  { name: 'المرتجعات', href: '/returns', icon: RotateCcw, roles: ['admin', 'manager'] },
  { name: 'الموبايلات', href: '/devices', icon: Smartphone, roles: ['admin', 'manager', 'cashier'] },
  { name: 'الصيانة', href: '/repairs', icon: Wrench, roles: ['admin', 'manager', 'cashier'] },
  { name: 'مخزن التوالف', href: '/scrap-inventory', icon: Wrench, roles: ['admin', 'manager'] },
  { name: 'الضمانات', href: '/warranty', icon: ShieldCheck, roles: ['admin', 'manager', 'cashier'] },
  { name: 'الائتمان', href: '/consignment', icon: Archive, roles: ['admin', 'manager'] },
  { name: 'الإيرادات', href: '/income', icon: TrendingUp, roles: ['admin', 'manager'] },
  { name: 'المصروفات', href: '/expenses', icon: ReceiptText, roles: ['admin', 'manager'] },
  { name: 'التقارير', href: '/reports', icon: FileText, roles: ['admin', 'manager'] },
  { name: 'شجرة الحسابات', href: '/accounts', icon: BookOpen, roles: ['admin'] },
  { name: 'القيود اليومية', href: '/journal-entries', icon: FileText, roles: ['admin'] },
  { name: 'الأصول الثابتة', href: '/fixed-assets', icon: Building2, roles: ['admin'] },
  { name: 'الاستحقاقات والمدفوعات', href: '/accruals', icon: Scale, roles: ['admin'] },
  { name: 'المطابقة البنكية', href: '/bank-reconciliation', icon: Landmark, roles: ['admin'] },
  { name: 'الميزانية التقديرية', href: '/budgets', icon: PiggyBank, roles: ['admin', 'manager'] },
  { name: 'مراكز التكلفة', href: '/cost-centers', icon: Target, roles: ['admin'] },
  { name: 'السنوات المالية', href: '/fiscal-years', icon: BookOpen, roles: ['admin'] },
  { name: 'سجل التدقيق', href: '/audit-log', icon: Shield, roles: ['admin'] },
  { name: 'السندات', href: '/vouchers', icon: HandCoins, roles: ['admin', 'manager'] },
  { name: 'الفروع', href: '/branches', icon: GitBranch, roles: ['admin', 'manager'] },
  { name: 'الإعدادات', href: '/settings', icon: Settings, roles: ['admin'] },
  { name: 'الموظفون', href: '/employees', icon: UserCheck, roles: ['admin', 'manager', 'employee'] },
  { name: 'الحضور والانصراف', href: '/attendance', icon: Clock, roles: ['admin', 'manager'] },
];

/* ── Helpers ────────────────────────────────────────────── */
export function canAccess(role: string | undefined, route: string): boolean {
  if (!role) return false;
  const allowed = ROUTE_ROLES[route];
  if (!allowed) return true;
  return allowed.includes(role as AppRole);
}

export function isAdmin(role?: string) {
  return role === 'admin';
}
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'المسؤول العام',
  company_admin: 'مدير الشركة',
  branch_manager: 'مدير الفرع',
  admin: 'مدير النظام',
  manager: 'مشرف',
  cashier: 'كاشير',
  salesperson: 'مندوب مبيعات',
  agent: 'موظف مبيعات',
  client: 'عميل',
  employee: 'موظف (بياناتي)',
};
