import { api } from '@/lib/api';
/**
 * AuditLog — سجل التدقيق والمراجعة الشامل
 * عرض كامل لجميع العمليات الحساسة بالنظام مع فلترة متقدمة.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { formatDate } from '@/lib/format';

interface AuditLogEntry {
  id: number;
  action: string;
  record_type: string;
  record_id: number;
  old_value: object | null;
  new_value: object | null;
  user_id: number | null;
  username: string | null;
  note: string | null;
  company_id: number | null;
  created_at: string;
}

/* ── Arabic labels ─────────────────────────────────────────────── */
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  /* عمليات أساسية */
  create: { label: 'إنشاء', color: 'text-emerald-400' },
  update: { label: 'تعديل', color: 'text-amber-400' },
  delete: { label: 'حذف', color: 'text-red-400' },
  cancel: { label: 'إلغاء', color: 'text-red-400' },
  view: { label: 'عرض', color: 'text-blue-400' },
  login: { label: 'دخول', color: 'text-violet-400' },
  logout: { label: 'خروج', color: 'text-ink/40' },
  approve: { label: 'موافقة', color: 'text-emerald-400' },
  reject: { label: 'رفض', color: 'text-red-400' },
  lock: { label: 'قفل', color: 'text-orange-400' },
  unlock: { label: 'فتح', color: 'text-emerald-400' },
  post: { label: 'ترحيل', color: 'text-blue-400' },
  restore: { label: 'استعادة', color: 'text-violet-400' },
  export: { label: 'تصدير', color: 'text-cyan-400' },
  reset: { label: 'إعادة تعيين', color: 'text-red-500' },
  close: { label: 'إقفال', color: 'text-orange-400' },
  reopen: { label: 'إعادة فتح', color: 'text-emerald-400' },
  /* عمليات مالية */
  price_override: { label: 'تجاوز سعر', color: 'text-yellow-400' },
  lock_period: { label: 'إغلاق فترة', color: 'text-red-400' },
  unlock_period: { label: 'فتح فترة', color: 'text-emerald-400' },
  lock_blocked: { label: 'محاولة إغلاق مرفوضة', color: 'text-orange-400' },
  reversal_created: { label: 'سند عكسي', color: 'text-blue-400' },
  correction_created: { label: 'سند تصحيحي', color: 'text-purple-400' },
  /* مخزون وتدقيق */
  INTEGRITY_REPAIR: { label: 'إصلاح محاسبي', color: 'text-rose-400' },
  INVENTORY_ADJUSTMENT: { label: 'تسوية مخزون', color: 'text-cyan-400' },
  INVENTORY_COUNT_APPLIED: { label: 'تطبيق جرد مخزون', color: 'text-cyan-400' },
  INVENTORY_TRANSFER: { label: 'تحويل مخزون', color: 'text-sky-400' },
  PERIOD_OVERRIDE: { label: 'تجاوز إغلاق مالي', color: 'text-orange-400' },
  /* إدارة الشركات (SaaS) */
  COMPANY_ACTIVATED: { label: 'تفعيل شركة', color: 'text-emerald-400' },
  COMPANY_SUSPENDED: { label: 'إيقاف شركة', color: 'text-amber-400' },
  COMPANY_EXTENDED: { label: 'تمديد اشتراك', color: 'text-sky-400' },
  COMPANY_DELETED: { label: 'حذف شركة', color: 'text-red-500' },
  ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: 'text-violet-400' },
  /* النسخ الاحتياطية والاستعادة */
  RESTORE_STARTED: { label: 'بدء استعادة', color: 'text-violet-400' },
  RESTORE_REJECTED: { label: 'رفض استعادة', color: 'text-red-400' },
  RESTORE_FAILED: { label: 'فشل استعادة', color: 'text-red-500' },
  RESTORE_COMPLETED: { label: 'اكتمال استعادة', color: 'text-emerald-400' },
  /* الصيانة */
  repair_status_change: { label: 'تغيير حالة الصيانة', color: 'text-cyan-400' },
  repair_assign: { label: 'تكليف فني', color: 'text-sky-400' },
  repair_complete: { label: 'إتمام الصيانة', color: 'text-emerald-400' },
  /* إدارة الشركات (SaaS) — إضافية */
  COMPANY_CREATED: { label: 'إنشاء شركة', color: 'text-emerald-400' },
  COMPANY_UPDATED: { label: 'تحديث شركة', color: 'text-amber-400' },
  COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك', color: 'text-blue-400' },
  MANAGER_UPDATED: { label: 'تحديث مدير', color: 'text-amber-400' },
  MANAGER_TOGGLED: { label: 'تغيير حالة مدير', color: 'text-orange-400' },
  MANAGER_DELETED: { label: 'حذف مدير', color: 'text-red-400' },
  PLAN_SETTINGS_UPDATED: { label: 'تحديث إعدادات الخطة', color: 'text-yellow-400' },
  TELEGRAM_SETTINGS_UPDATED: { label: 'تحديث تليجرام', color: 'text-cyan-400' },
  BACKUP_CREATED: { label: 'نسخة احتياطية', color: 'text-emerald-400' },
  TRIAL_MONITORING_WARNING: { label: 'تحذير فترة تجريبية', color: 'text-amber-400' },
  SAFE_TRANSFER_COMPLETED: { label: 'تحويل خزينة مكتمل', color: 'text-sky-400' },
  paid: { label: 'صرف رواتب', color: 'text-emerald-400' },
  transfer: { label: 'تحويل', color: 'text-sky-400' },
  /* وصول المدير العام */
  SUPER_ADMIN_ACCESS: { label: 'وصول مدير عام', color: 'text-indigo-400' },
  SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: 'text-indigo-400' },
  MANAGER_CREATED: { label: 'إنشاء مدير', color: 'text-violet-400' },
};

const RECORD_LABELS: Record<string, string> = {
  customer: 'عميل',
  supplier: 'مورد',
  sale: 'فاتورة بيع',
  sale_return: 'مرتجع مبيعات',
  purchase: 'فاتورة شراء',
  purchase_return: 'مرتجع مشتريات',
  product: 'منتج / صنف',
  financial_lock: 'قفل مالي',
  expense: 'مصروف',
  safe_transfer: 'تحويل خزينة',
  receipt_voucher: 'سند قبض',
  payment_voucher: 'سند صرف',
  deposit_voucher: 'سند إيداع',
  treasury_voucher: 'سند خزينة',
  user: 'مستخدم',
  erp_user: 'حساب مستخدم',
  account_balances: 'أرصدة الحسابات',
  customer_balances: 'أرصدة العملاء',
  employee: 'موظف',
  company: 'شركة',
  subscription: 'اشتراك',
  payroll_period: 'دورة رواتب',
  salary_advance: 'سلفة راتب',
  fiscal_year: 'سنة مالية',
  system: 'النظام',
  announcement: 'إعلان',
  warranty: 'ضمان',
  repair_job: 'بطاقة صيانة',
  trial_monitoring: 'مراقبة الفترة التجريبية',
  branch: 'فرع',
  device: 'جهاز',
  income: 'إيراد',
  journal_entry: 'قيد يومية',
  warehouse: 'مستودع',
  stock_transfer: 'تحويل مخزون',
  inventory_count: 'جرد مخزون',
};

const ALL_RECORD_TYPES = Object.keys(RECORD_LABELS);

/* ── ترجمة أسماء الحقول ──────────────────────────────────────────── */
const FIELD_LABELS: Record<string, string> = {
  /* هوية وتعريف */
  id: 'المعرف',
  record_id: 'رقم السجل',
  company_id: 'الشركة',
  branch_id: 'الفرع',
  warehouse_id: 'المستودع',
  user_id: 'المستخدم',
  customer_id: 'العميل',
  supplier_id: 'المورد',
  product_id: 'المنتج',
  category_id: 'الفئة',
  technician_id: 'الفني',
  job_no: 'رقم الطلب',
  invoice_no: 'رقم الفاتورة',
  reference: 'المرجع',
  serial_number: 'الرقم التسلسلي',
  imei: 'IMEI',
  barcode: 'باركود',
  /* بيانات أساسية */
  name: 'الاسم',
  full_name: 'الاسم الكامل',
  username: 'اسم المستخدم',
  email: 'البريد الإلكتروني',
  phone: 'الهاتف',
  address: 'العنوان',
  description: 'الوصف',
  notes: 'الملاحظات',
  diagnosis: 'التشخيص',
  /* مالي */
  amount: 'المبلغ',
  price: 'السعر',
  cost: 'التكلفة',
  total: 'الإجمالي',
  subtotal: 'المجموع الجزئي',
  tax: 'الضريبة',
  discount: 'الخصم',
  paid_amount: 'المدفوع',
  remaining: 'المتبقي',
  balance: 'الرصيد',
  credit_limit: 'حد الائتمان',
  repair_cost: 'تكلفة الإصلاح',
  advance_payment: 'الدفعة المقدمة',
  exchange_rate: 'سعر الصرف',
  currency: 'العملة',
  method: 'طريقة الدفع',
  /* حالة */
  status: 'الحالة',
  type: 'النوع',
  role: 'الدور',
  is_active: 'نشط',
  is_deleted: 'محذوف',
  active: 'نشط',
  /* مخزون */
  quantity: 'الكمية',
  min_stock: 'حد أدنى',
  max_stock: 'حد أقصى',
  unit: 'الوحدة',
  stock: 'المخزون',
  available: 'المتاح',
  /* أجهزة */
  device_model: 'موديل الجهاز',
  device_brand: 'العلامة التجارية',
  device_color: 'اللون',
  device_type: 'نوع الجهاز',
  /* أوقات */
  date: 'التاريخ',
  created_at: 'تاريخ الإنشاء',
  updated_at: 'آخر تعديل',
  estimated_days: 'أيام التسليم المتوقعة',
  expiry_date: 'تاريخ الانتهاء',
  /* موظف / رواتب */
  national_id: 'الرقم الوطني',
  basic_salary: 'الراتب الأساسي',
  allowances: 'البدلات',
  deductions: 'الخصومات',
  net_salary: 'صافي الراتب',
  job_title: 'المسمى الوظيفي',
  department: 'القسم',
  /* متفرقة */
  technician_name: 'اسم الفني',
  customer_name: 'اسم العميل',
  assigned_to: 'مكلف إلى',
  category: 'الفئة',
  color: 'اللون',
  size: 'الحجم',
  weight: 'الوزن',
  dimensions: 'الأبعاد',
  warranty_period: 'فترة الضمان',
  warranty_type: 'نوع الضمان',
  password: 'كلمة المرور',
  token: 'الرمز',
};

/* ── ترجمة قيم الحقول ────────────────────────────────────────────── */
const VALUE_LABELS: Record<string, string> = {
  /* حالات الصيانة */
  received: 'مستلم',
  in_progress: 'قيد التنفيذ',
  waiting_parts: 'انتظار قطع غيار',
  ready: 'جاهز للاستلام',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  final_quality_check: 'فحص الجودة النهائي',
  diagnosed: 'تم التشخيص',
  /* حالات عامة */
  active: 'نشط',
  inactive: 'غير نشط',
  suspended: 'موقوف',
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  posted: 'مرحّل',
  draft: 'مسودة',
  closed: 'مغلق',
  open: 'مفتوح',
  paid: 'مدفوع',
  unpaid: 'غير مدفوع',
  partial: 'جزئي',
  refunded: 'مسترد',
  voided: 'ملغي',
  /* أدوار */
  admin: 'مدير',
  cashier: 'كاشير',
  technician: 'فني',
  super_admin: 'مدير عام',
  accountant: 'محاسب',
  viewer: 'مراقب',
  /* بوليان */
  true: 'نعم',
  false: 'لا',
  /* طرق الدفع */
  cash: 'نقدي',
  card: 'بطاقة',
  transfer: 'تحويل بنكي',
  cheque: 'شيك',
  /* أنواع */
  sale: 'بيع',
  purchase: 'شراء',
  return: 'مرتجع',
  expense: 'مصروف',
  income: 'إيراد',
  adjustment: 'تسوية',
  /* متفرقة */
  male: 'ذكر',
  female: 'أنثى',
  kg: 'كيلوجرام',
  g: 'جرام',
  l: 'لتر',
  ml: 'مليلتر',
  piece: 'قطعة',
  box: 'صندوق',
  meter: 'متر',
};

/* ── ترجمة قيمة واحدة ───────────────────────────────────────────── */
function translateValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  const s = String(v);
  return VALUE_LABELS[s] ?? s;
}

/* ── ترجمة مفتاح (حقل) ──────────────────────────────────────────── */
function translateKey(k: string): string {
  return FIELD_LABELS[k] ?? k.replace(/_/g, ' ');
}

/* ── مكوّن عرض التفاصيل بشكل بشري مقروء ────────────────────────── */
function HumanDiff({
  label,
  data,
  accent,
}: {
  label: string;
  data: object | null;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  if (!data || typeof data !== 'object') return null;

  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 text-xs ${accent} hover:opacity-80 transition-opacity`}
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {label}
      </button>
      {open && (
        <div className="mt-1 bg-surface border border-line rounded-xl p-2 space-y-1 max-h-52 overflow-y-auto">
          {entries.map(([k, v]) => {
            const displayVal = typeof v === 'object' ? JSON.stringify(v) : translateValue(v);
            const isPassword = k === 'password' || k === 'token';
            return (
              <div key={k} className="flex items-start gap-2 text-xs">
                <span className="text-ink/35 shrink-0 min-w-[6rem] text-left font-medium">
                  {translateKey(k)}
                </span>
                <span className="text-ink/70 break-all">
                  {isPassword ? '••••••••' : displayVal}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AuditLog() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [limit, setLimit] = useState(200);

  const {
    data: logs = [],
    isLoading,
    refetch,
  } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit-logs', limit],
    queryFn: () =>
      authFetch(api(`/api/settings/audit-logs?limit=${limit}`)).then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    refetchInterval: 30_000,
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-14 h-14 text-red-400/40 mb-4" />
        <p className="text-ink/60 font-bold text-lg">غير مصرح</p>
        <p className="text-ink/30 text-sm mt-1">هذه الصفحة للمديرين فقط</p>
      </div>
    );
  }

  const filtered = logs.filter((log) => {
    if (filterType && log.record_type !== filterType) return false;
    if (filterAction && log.action !== filterAction) return false;
    if (filterUser && !log.username?.toLowerCase().includes(filterUser.toLowerCase())) return false;
    if (search) {
      const s = search.toLowerCase();
      const recordLabel = RECORD_LABELS[log.record_type] ?? log.record_type;
      const actionLabel = ACTION_LABELS[log.action]?.label ?? log.action;
      if (
        !log.username?.toLowerCase().includes(s) &&
        !recordLabel.toLowerCase().includes(s) &&
        !actionLabel.includes(s) &&
        !String(log.record_id).includes(s) &&
        !log.action.includes(s) &&
        !log.note?.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();
  const uniqueUsers = [...new Set(logs.map((l) => l.username).filter(Boolean))].sort();

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            سجل التدقيق والمراجعة
          </h1>
          <p className="text-sm text-ink/40 mt-0.5">
            سجل شامل لجميع العمليات الحساسة — {filtered.length} من {logs.length} سجل
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-surface rounded-xl text-sm text-ink/60 border border-line transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 bg-surface border border-line rounded-2xl p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في السجل..."
            className="w-full bg-surface border border-line rounded-xl icon-pr pl-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        {/* Record Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink/70 focus:outline-none"
        >
          <option value="">كل السجلات</option>
          {ALL_RECORD_TYPES.map((t) => (
            <option key={t} value={t}>
              {RECORD_LABELS[t] ?? t}
            </option>
          ))}
        </select>

        {/* Action Filter */}
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink/70 focus:outline-none"
        >
          <option value="">كل الإجراءات</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]?.label ?? a}
            </option>
          ))}
        </select>

        {/* User Filter */}
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink/70 focus:outline-none"
        >
          <option value="">كل المستخدمين</option>
          {uniqueUsers.map((u) => (
            <option key={u!} value={u!}>
              {u}
            </option>
          ))}
        </select>

        {/* Limit */}
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink/70 focus:outline-none"
        >
          <option value={100}>آخر 100</option>
          <option value={200}>آخر 200</option>
          <option value={500}>آخر 500</option>
        </select>

        <div className="flex items-center gap-1 text-xs text-ink/30">
          <Filter className="w-3 h-3" />
          {filtered.length} نتيجة
        </div>
      </div>

      {/* Log Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ink/30">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-bold">لا توجد سجلات تطابق البحث</p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-ink/40 text-xs">
                <th className="p-3 text-right font-semibold w-32">الوقت</th>
                <th className="p-3 text-right font-semibold">الإجراء</th>
                <th className="p-3 text-right font-semibold">النوع</th>
                <th className="p-3 text-right font-semibold w-16">المعرف</th>
                <th className="p-3 text-right font-semibold">المستخدم</th>
                <th className="p-3 text-right font-semibold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, idx) => {
                const actionMeta = ACTION_LABELS[log.action] ?? {
                  label: translateKey(log.action),
                  color: 'text-ink/50',
                };
                const recordLabel = RECORD_LABELS[log.record_type] ?? translateKey(log.record_type);
                return (
                  <tr
                    key={log.id}
                    className={`border-t border-line hover:bg-surface transition-colors ${idx % 2 === 0 ? '' : 'bg-surface'}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-ink/40 text-xs">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="font-mono">{formatDate(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-bold ${actionMeta.color}`}>
                        {actionMeta.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs bg-surface text-ink/70 px-2 py-0.5 rounded-lg">
                        {recordLabel}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-ink/40">#{log.record_id}</td>
                    <td className="p-3">
                      {log.username ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-ink/30 shrink-0" />
                          <span className="text-xs text-ink/70">{log.username}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink/25">نظام</span>
                      )}
                    </td>
                    <td className="p-3">
                      {log.note && <div className="text-xs text-ink/60 mb-1">{log.note}</div>}
                      <HumanDiff
                        label="قبل التعديل"
                        data={log.old_value}
                        accent="text-red-400/60"
                      />
                      <HumanDiff
                        label="بعد التعديل"
                        data={log.new_value}
                        accent="text-emerald-400/70"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(
            logs.reduce<Record<string, number>>((acc, l) => {
              acc[l.action] = (acc[l.action] ?? 0) + 1;
              return acc;
            }, {})
          )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([action, count]) => {
              const meta = ACTION_LABELS[action] ?? {
                label: translateKey(action),
                color: 'text-ink/50',
              };
              return (
                <div
                  key={action}
                  className="bg-surface border border-line rounded-2xl p-4 text-center"
                >
                  <div className={`text-2xl font-bold ${meta.color}`}>{count}</div>
                  <div className="text-xs text-ink/40 mt-1">{meta.label}</div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
