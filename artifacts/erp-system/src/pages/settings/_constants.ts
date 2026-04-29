export const ROLES: Record<string, { label: string; badge: string; avatarBg: string; avatarText: string }> = {
  super_admin:    { label: "المسؤول العام",  badge: "text-orange-400 bg-orange-500/15 border-orange-500/30",   avatarBg: "bg-orange-500/20",  avatarText: "text-orange-300"  },
  company_admin:  { label: "مدير الشركة",    badge: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",   avatarBg: "bg-yellow-500/20",  avatarText: "text-yellow-300"  },
  branch_manager: { label: "مدير الفرع",     badge: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",         avatarBg: "bg-cyan-500/20",    avatarText: "text-cyan-300"    },
  admin:          { label: "مدير النظام",    badge: "text-red-400 bg-red-500/15 border-red-500/30",            avatarBg: "bg-red-500/20",     avatarText: "text-red-300"     },
  manager:        { label: "مشرف",           badge: "text-purple-400 bg-purple-500/15 border-purple-500/30",   avatarBg: "bg-purple-500/20",  avatarText: "text-purple-300"  },
  cashier:        { label: "كاشير",          badge: "text-blue-400 bg-blue-500/15 border-blue-500/30",         avatarBg: "bg-blue-500/20",    avatarText: "text-blue-300"    },
  salesperson:    { label: "مندوب مبيعات",   badge: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", avatarBg: "bg-emerald-500/20", avatarText: "text-emerald-300" },
  agent:          { label: "موظف مبيعات",    badge: "text-teal-400 bg-teal-500/15 border-teal-500/30",         avatarBg: "bg-teal-500/20",    avatarText: "text-teal-300"    },
  client:         { label: "عميل",           badge: "text-slate-400 bg-slate-500/15 border-slate-500/30",      avatarBg: "bg-slate-500/20",   avatarText: "text-slate-300"   },
  employee:       { label: "موظف (بياناتي)", badge: "text-gray-400 bg-gray-500/15 border-gray-500/30",         avatarBg: "bg-gray-500/20",    avatarText: "text-gray-300"    },
};

export interface PermEntry { key: string; label: string; isPage?: boolean }
export interface PermGroup  { key: string; label: string; color: string; permissions: PermEntry[] }

export const PERMISSION_GROUPS: PermGroup[] = [

  /* ══ 1. المبيعات ══════════════════════════════════════════════════════ */
  {
    key: "sales", label: "المبيعات", color: "amber",
    permissions: [
      { key: "can_access_sales",   label: "دخول صفحة المبيعات",     isPage: true },
      { key: "can_access_pos",     label: "دخول نقطة البيع (POS)", isPage: true },
      { key: "can_access_returns", label: "دخول صفحة المرتجعات",    isPage: true },
      { key: "can_view_sales",     label: "عرض قائمة المبيعات" },
      { key: "can_create_sale",    label: "إنشاء فاتورة بيع" },
      { key: "can_cash_sale",      label: "بيع نقدي" },
      { key: "can_partial_sale",   label: "بيع جزئي" },
      { key: "can_credit_sale",    label: "بيع آجل" },
      { key: "can_return_sale",    label: "إرجاع مبيعات" },
      { key: "can_cancel_sale",    label: "إلغاء فاتورة بيع" },
      { key: "can_edit_price",     label: "تعديل الأسعار" },
      { key: "can_view_returns",   label: "عرض المرتجعات" },
      { key: "can_manage_returns", label: "إدارة المرتجعات" },
    ],
  },

  /* ══ 2. المخزون والمشتريات ════════════════════════════════════════════ */
  {
    key: "inventory", label: "المخزون والمشتريات", color: "blue",
    permissions: [
      { key: "can_access_products",   label: "دخول صفحة المنتجات",   isPage: true },
      { key: "can_access_inventory",  label: "دخول صفحة المخزون",    isPage: true },
      { key: "can_access_purchases",  label: "دخول صفحة المشتريات",  isPage: true },
      { key: "can_access_transfers",  label: "دخول صفحة التحويلات",  isPage: true },
      { key: "can_view_products",     label: "عرض الأصناف" },
      { key: "can_manage_products",   label: "إدارة الأصناف (إضافة/تعديل/حذف)" },
      { key: "can_view_inventory",    label: "عرض المخزون" },
      { key: "can_adjust_inventory",  label: "تسوية المخزون" },
      { key: "can_view_purchases",    label: "عرض قائمة المشتريات" },
      { key: "can_create_purchase",   label: "إنشاء فاتورة شراء" },
      { key: "can_cancel_purchase",   label: "إلغاء فاتورة شراء" },
      { key: "can_view_transfers",    label: "عرض التحويلات" },
      { key: "can_manage_transfers",  label: "إدارة التحويلات" },
    ],
  },

  /* ══ 3. العملاء والديون ═══════════════════════════════════════════════ */
  {
    key: "customers", label: "العملاء والديون", color: "emerald",
    permissions: [
      { key: "can_access_customers",   label: "دخول صفحة العملاء",       isPage: true },
      { key: "can_access_bad_debts",   label: "دخول صفحة الديون المعدومة", isPage: true },
      { key: "can_view_customers",     label: "عرض العملاء" },
      { key: "can_manage_customers",   label: "إدارة العملاء (إضافة/تعديل/حذف)" },
      { key: "can_view_bad_debts",     label: "عرض الديون المعدومة" },
      { key: "can_manage_bad_debts",   label: "إدارة الديون المعدومة" },
    ],
  },

  /* ══ 4. المالية والخزينة ══════════════════════════════════════════════ */
  {
    key: "finance", label: "المالية والخزينة", color: "violet",
    permissions: [
      { key: "can_access_treasury",  label: "دخول صفحة الخزينة",    isPage: true },
      { key: "can_access_expenses",  label: "دخول صفحة المصروفات",  isPage: true },
      { key: "can_access_income",    label: "دخول صفحة الإيرادات",  isPage: true },
      { key: "can_access_vouchers",  label: "دخول صفحة السندات",    isPage: true },
      { key: "can_view_treasury",           label: "عرض صفحة الخزينة" },
      { key: "can_view_expenses",           label: "عرض المصروفات" },
      { key: "can_add_expense",             label: "إضافة مصروف" },
      { key: "can_view_income",             label: "عرض الإيرادات" },
      { key: "can_add_income",              label: "إضافة إيراد" },
      { key: "can_view_vouchers",           label: "عرض السندات" },
      { key: "can_manage_vouchers",         label: "إدارة السندات" },
      { key: "can_add_receipt_voucher",     label: "سند قبض" },
      { key: "can_add_payment_voucher",     label: "سند دفع" },
      { key: "can_close_shift",             label: "إقفال الخزنة / إنهاء الوردية" },
    ],
  },

  /* ══ 5. التقارير ══════════════════════════════════════════════════════ */
  {
    key: "reports", label: "التقارير", color: "cyan",
    permissions: [
      { key: "can_access_reports", label: "دخول صفحة التقارير", isPage: true },
      { key: "can_view_reports",   label: "عرض التقارير" },
    ],
  },

  /* ══ 6. الصيانة والأجهزة ══════════════════════════════════════════════ */
  {
    key: "maintenance", label: "الصيانة والأجهزة", color: "orange",
    permissions: [
      { key: "can_access_repairs",        label: "دخول صفحة الصيانة",         isPage: true },
      { key: "can_access_devices",        label: "دخول صفحة الأجهزة",         isPage: true },
      { key: "can_access_warranty",       label: "دخول صفحة الضمانات",        isPage: true },
      { key: "can_access_scrap_inventory",label: "دخول مخزن التوالف",          isPage: true },
      { key: "can_view_repairs",          label: "عرض طلبات الصيانة" },
      { key: "can_manage_repairs",        label: "إدارة طلبات الصيانة" },
      { key: "can_view_devices",          label: "عرض الأجهزة" },
      { key: "can_manage_devices",        label: "إدارة الأجهزة" },
      { key: "can_view_warranty",         label: "عرض الضمانات" },
      { key: "can_manage_warranty",       label: "إدارة الضمانات" },
      { key: "can_view_scrap_inventory",  label: "عرض مخزن التوالف" },
      { key: "can_manage_scrap_inventory",label: "إدارة مخزن التوالف" },
    ],
  },

  /* ══ 7. الموارد البشرية ═══════════════════════════════════════════════ */
  {
    key: "hr", label: "الموارد البشرية", color: "pink",
    permissions: [
      { key: "can_access_employees",   label: "دخول صفحة الموظفين",          isPage: true },
      { key: "can_access_attendance",  label: "دخول صفحة الحضور والانصراف",  isPage: true },
      { key: "can_view_employees",         label: "عرض الموظفين" },
      { key: "can_manage_employees",       label: "إدارة الموظفين (إضافة/تعديل)" },
      { key: "can_view_employee_salary",   label: "عرض الرواتب" },
      { key: "can_view_payroll",           label: "عرض كشف الراتب" },
      { key: "can_manage_payroll",         label: "إدارة الرواتب" },
      { key: "can_approve_payroll",        label: "اعتماد الرواتب" },
      { key: "can_view_attendance",        label: "عرض الحضور والانصراف" },
      { key: "can_manage_attendance",      label: "إدارة الحضور والانصراف" },
    ],
  },

  /* ══ 8. المحاسبة ══════════════════════════════════════════════════════ */
  {
    key: "accounting", label: "المحاسبة", color: "indigo",
    permissions: [
      { key: "can_access_accounts",           label: "دخول شجرة الحسابات",         isPage: true },
      { key: "can_access_journal_entries",    label: "دخول القيود اليومية",         isPage: true },
      { key: "can_access_fixed_assets",       label: "دخول الأصول الثابتة",         isPage: true },
      { key: "can_access_accruals",           label: "دخول الاستحقاقات والمدفوعات", isPage: true },
      { key: "can_access_bank_reconciliation",label: "دخول المطابقة البنكية",       isPage: true },
      { key: "can_access_budgets",            label: "دخول الميزانية التقديرية",     isPage: true },
      { key: "can_access_cost_centers",       label: "دخول مراكز التكلفة",          isPage: true },
      { key: "can_access_fiscal_years",       label: "دخول السنوات المالية",        isPage: true },
      { key: "can_view_accounts",             label: "عرض شجرة الحسابات" },
      { key: "can_manage_accounts",           label: "إدارة الحسابات" },
      { key: "can_view_journal_entries",      label: "عرض القيود اليومية" },
      { key: "can_manage_journal_entries",    label: "إنشاء وتعديل القيود" },
      { key: "can_view_fixed_assets",         label: "عرض الأصول الثابتة" },
      { key: "can_manage_fixed_assets",       label: "إدارة الأصول الثابتة" },
      { key: "can_view_accruals",             label: "عرض الاستحقاقات" },
      { key: "can_manage_accruals",           label: "إدارة الاستحقاقات" },
      { key: "can_view_bank_reconciliation",  label: "عرض المطابقة البنكية" },
      { key: "can_manage_bank_reconciliation",label: "إجراء المطابقة البنكية" },
      { key: "can_view_budgets",              label: "عرض الميزانية التقديرية" },
      { key: "can_manage_budgets",            label: "إدارة الميزانية التقديرية" },
      { key: "can_view_cost_centers",         label: "عرض مراكز التكلفة" },
      { key: "can_manage_cost_centers",       label: "إدارة مراكز التكلفة" },
      { key: "can_view_fiscal_years",         label: "عرض السنوات المالية" },
      { key: "can_manage_fiscal_years",       label: "إدارة السنوات المالية" },
    ],
  },

  /* ══ 9. النظام والإدارة ═══════════════════════════════════════════════ */
  {
    key: "system", label: "النظام والإدارة", color: "red",
    permissions: [
      { key: "can_access_dashboard",  label: "دخول الرئيسية",          isPage: true },
      { key: "can_access_branches",   label: "دخول صفحة الفروع",       isPage: true },
      { key: "can_access_settings",   label: "دخول الإعدادات",         isPage: true },
      { key: "can_access_audit_log",  label: "دخول سجل التدقيق",       isPage: true },
      { key: "can_view_branches",     label: "عرض الفروع" },
      { key: "can_manage_branches",   label: "إدارة الفروع (إضافة/تعديل)" },
      { key: "can_manage_users",      label: "إدارة المستخدمين" },
      { key: "can_manage_settings",   label: "تعديل إعدادات النظام" },
      { key: "can_view_audit_log",    label: "عرض سجل التدقيق" },
    ],
  },
];

/* ══ قوالب الصلاحيات الجاهزة ══════════════════════════════════════════ */

const _ALL_TRUE: Record<string, boolean> = {};
PERMISSION_GROUPS.forEach(g => g.permissions.forEach(p => { _ALL_TRUE[p.key] = true; }));

export const PERMISSION_TEMPLATES: Record<string, Record<string, boolean>> = {

  /* ── مدير النظام: كل الصلاحيات ───────────────────────── */
  admin: { ..._ALL_TRUE },

  /* ── مشرف: كل شيء ما عدا المحاسبة العميقة والإعدادات ─── */
  manager: {
    // الوصول للصفحات
    can_access_dashboard: true,
    can_access_sales: true,    can_access_pos: true,       can_access_returns: true,
    can_access_products: true, can_access_inventory: true, can_access_purchases: true,
    can_access_transfers: true,can_access_customers: true, can_access_bad_debts: true,
    can_access_treasury: true, can_access_expenses: true,  can_access_income: true,
    can_access_vouchers: true, can_access_reports: true,   can_access_repairs: true,
    can_access_devices: true,  can_access_warranty: true,  can_access_scrap_inventory: true,
    can_access_employees: true,can_access_attendance: true,can_access_budgets: true,
    can_access_branches: true,
    can_access_accounts: false, can_access_journal_entries: false, can_access_fixed_assets: false,
    can_access_accruals: false, can_access_bank_reconciliation: false, can_access_cost_centers: false,
    can_access_fiscal_years: false, can_access_audit_log: false, can_access_settings: false,
    // المبيعات
    can_view_sales: true, can_create_sale: true, can_cash_sale: true,
    can_partial_sale: true, can_credit_sale: true, can_cancel_sale: true,
    can_return_sale: true, can_edit_price: true,
    can_view_returns: true, can_manage_returns: true,
    // المخزون
    can_view_products: true,   can_manage_products: true,
    can_view_inventory: true,  can_adjust_inventory: true,
    can_view_purchases: true,  can_create_purchase: true,  can_cancel_purchase: true,
    can_view_transfers: true,  can_manage_transfers: true,
    // العملاء
    can_view_customers: true,  can_manage_customers: true,
    can_view_bad_debts: true,  can_manage_bad_debts: true,
    // المالية
    can_view_treasury: true,       can_view_expenses: true,    can_add_expense: true,
    can_view_income: true,         can_add_income: true,
    can_view_vouchers: true,       can_manage_vouchers: true,
    can_add_receipt_voucher: true, can_add_payment_voucher: true, can_close_shift: true,
    // التقارير
    can_view_reports: true,
    // الصيانة
    can_view_repairs: true,   can_manage_repairs: true,
    can_view_devices: true,   can_manage_devices: true,
    can_view_warranty: true,  can_manage_warranty: true,
    can_view_scrap_inventory: true, can_manage_scrap_inventory: true,
    // الموارد البشرية
    can_view_employees: true,      can_manage_employees: true,  can_view_employee_salary: true,
    can_view_payroll: true,        can_manage_payroll: false,   can_approve_payroll: false,
    can_view_attendance: true,     can_manage_attendance: true,
    // الميزانية
    can_view_budgets: true,        can_manage_budgets: true,
    // الفروع (عرض فقط)
    can_view_branches: true,       can_manage_branches: false,
    // المحاسبة (لا شيء)
    can_view_accounts: false,          can_manage_accounts: false,
    can_view_journal_entries: false,   can_manage_journal_entries: false,
    can_view_fixed_assets: false,      can_manage_fixed_assets: false,
    can_view_accruals: false,          can_manage_accruals: false,
    can_view_bank_reconciliation: false, can_manage_bank_reconciliation: false,
    can_view_cost_centers: false,      can_manage_cost_centers: false,
    can_view_fiscal_years: false,      can_manage_fiscal_years: false,
    // النظام
    can_manage_users: false, can_manage_settings: false, can_view_audit_log: false,
  },

  /* ── مندوب مبيعات ───────────────────────────────────────── */
  salesperson: {
    can_access_dashboard: true, can_access_sales: true, can_access_pos: true,
    can_access_products: true,  can_access_customers: true, can_access_treasury: true,
    can_access_returns: false, can_access_inventory: false, can_access_purchases: false,
    can_access_transfers: false, can_access_bad_debts: false, can_access_expenses: false,
    can_access_income: false, can_access_vouchers: false, can_access_reports: false,
    can_access_repairs: false, can_access_devices: false, can_access_warranty: false,
    can_access_scrap_inventory: false, can_access_employees: false, can_access_attendance: false,
    can_access_budgets: false, can_access_branches: false, can_access_settings: false,
    can_access_audit_log: false, can_access_accounts: false, can_access_journal_entries: false,
    can_access_fixed_assets: false, can_access_accruals: false, can_access_bank_reconciliation: false,
    can_access_cost_centers: false, can_access_fiscal_years: false,
    can_view_sales: true,  can_create_sale: true, can_cash_sale: true,
    can_partial_sale: true, can_credit_sale: true,
    can_return_sale: false, can_cancel_sale: false, can_edit_price: false,
    can_view_returns: false, can_manage_returns: false,
    can_view_products: true,  can_manage_products: false,
    can_view_inventory: false, can_adjust_inventory: false,
    can_view_purchases: false, can_create_purchase: false, can_cancel_purchase: false,
    can_view_transfers: false, can_manage_transfers: false,
    can_view_customers: true,  can_manage_customers: false,
    can_view_bad_debts: false, can_manage_bad_debts: false,
    can_view_treasury: true,
    can_view_expenses: false, can_add_expense: false,
    can_view_income: false,   can_add_income: false,
    can_view_vouchers: false, can_manage_vouchers: false,
    can_add_receipt_voucher: false, can_add_payment_voucher: false, can_close_shift: false,
    can_view_reports: false,
    can_view_repairs: false, can_manage_repairs: false,
    can_view_devices: false, can_manage_devices: false,
    can_view_warranty: false, can_manage_warranty: false,
    can_view_scrap_inventory: false, can_manage_scrap_inventory: false,
    can_view_employees: false, can_manage_employees: false, can_view_employee_salary: false,
    can_view_payroll: false, can_manage_payroll: false, can_approve_payroll: false,
    can_view_attendance: false, can_manage_attendance: false,
    can_view_budgets: false, can_manage_budgets: false,
    can_view_branches: false, can_manage_branches: false,
    can_manage_users: false, can_manage_settings: false, can_view_audit_log: false,
    can_view_accounts: false, can_manage_accounts: false,
    can_view_journal_entries: false, can_manage_journal_entries: false,
    can_view_fixed_assets: false, can_manage_fixed_assets: false,
    can_view_accruals: false, can_manage_accruals: false,
    can_view_bank_reconciliation: false, can_manage_bank_reconciliation: false,
    can_view_cost_centers: false, can_manage_cost_centers: false,
    can_view_fiscal_years: false, can_manage_fiscal_years: false,
  },

  /* ── كاشير ──────────────────────────────────────────────── */
  cashier: {
    can_access_dashboard: true,  can_access_sales: true, can_access_pos: true,
    can_access_products: true,   can_access_customers: true, can_access_treasury: true,
    can_access_expenses: true,   can_access_repairs: true, can_access_devices: true,
    can_access_warranty: true,
    can_access_returns: false, can_access_inventory: false, can_access_purchases: false,
    can_access_transfers: false, can_access_bad_debts: false, can_access_income: false,
    can_access_vouchers: false,  can_access_reports: false, can_access_scrap_inventory: false,
    can_access_employees: false, can_access_attendance: false, can_access_budgets: false,
    can_access_branches: false, can_access_settings: false, can_access_audit_log: false,
    can_access_accounts: false, can_access_journal_entries: false, can_access_fixed_assets: false,
    can_access_accruals: false, can_access_bank_reconciliation: false,
    can_access_cost_centers: false, can_access_fiscal_years: false,
    can_view_sales: true, can_create_sale: true, can_cash_sale: true,
    can_partial_sale: false, can_credit_sale: false,
    can_return_sale: false, can_cancel_sale: false, can_edit_price: false,
    can_view_returns: false, can_manage_returns: false,
    can_view_products: true,   can_manage_products: false,
    can_view_inventory: false, can_adjust_inventory: false,
    can_view_purchases: false, can_create_purchase: false, can_cancel_purchase: false,
    can_view_transfers: false, can_manage_transfers: false,
    can_view_customers: true,  can_manage_customers: false,
    can_view_bad_debts: false, can_manage_bad_debts: false,
    can_view_treasury: true,
    can_view_expenses: true, can_add_expense: true,
    can_view_income: false,  can_add_income: false,
    can_view_vouchers: false, can_manage_vouchers: false,
    can_add_receipt_voucher: false, can_add_payment_voucher: false, can_close_shift: true,
    can_view_reports: false,
    can_view_repairs: true,   can_manage_repairs: false,
    can_view_devices: true,   can_manage_devices: false,
    can_view_warranty: true,  can_manage_warranty: false,
    can_view_scrap_inventory: false, can_manage_scrap_inventory: false,
    can_view_employees: false, can_manage_employees: false, can_view_employee_salary: false,
    can_view_payroll: false,   can_manage_payroll: false, can_approve_payroll: false,
    can_view_attendance: false, can_manage_attendance: false,
    can_view_budgets: false,  can_manage_budgets: false,
    can_view_branches: false, can_manage_branches: false,
    can_manage_users: false,  can_manage_settings: false, can_view_audit_log: false,
    can_view_accounts: false, can_manage_accounts: false,
    can_view_journal_entries: false, can_manage_journal_entries: false,
    can_view_fixed_assets: false, can_manage_fixed_assets: false,
    can_view_accruals: false, can_manage_accruals: false,
    can_view_bank_reconciliation: false, can_manage_bank_reconciliation: false,
    can_view_cost_centers: false, can_manage_cost_centers: false,
    can_view_fiscal_years: false, can_manage_fiscal_years: false,
  },
};

export const TEMPLATE_LABELS: { value: string; label: string }[] = [
  { value: "admin",       label: "مدير النظام — كل الصلاحيات" },
  { value: "manager",     label: "مشرف — صلاحيات موسّعة بدون محاسبة وإعدادات" },
  { value: "salesperson", label: "مندوب مبيعات — المبيعات والعملاء فقط" },
  { value: "cashier",     label: "كاشير — نقطة البيع والخزينة فقط" },
];

export const COLOR_MAP: Record<string, { header: string; badge: string; toggleOn: string }> = {
  amber:  { header: "border-amber-500/20",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",   toggleOn: "#f59e0b" },
  blue:   { header: "border-blue-500/20",    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",     toggleOn: "#3b82f6" },
  emerald:{ header: "border-emerald-500/20", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", toggleOn: "#10b981" },
  violet: { header: "border-violet-500/20",  badge: "bg-violet-500/15 text-violet-300 border-violet-500/30", toggleOn: "#8b5cf6" },
  cyan:   { header: "border-cyan-500/20",    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",     toggleOn: "#06b6d4" },
  red:    { header: "border-red-500/20",     badge: "bg-red-500/15 text-red-300 border-red-500/30",       toggleOn: "#ef4444" },
  orange: { header: "border-orange-500/20",  badge: "bg-orange-500/15 text-orange-300 border-orange-500/30", toggleOn: "#f97316" },
  pink:   { header: "border-pink-500/20",    badge: "bg-pink-500/15 text-pink-300 border-pink-500/30",    toggleOn: "#ec4899" },
  indigo: { header: "border-indigo-500/20",  badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", toggleOn: "#6366f1" },
};

export const BACKUP_MODULES_LIST = [
  { key: "sales",            label: "المبيعات",         sub: "الفواتير، العملاء، المرتجعات",      url: "/api/sales"                   },
  { key: "purchases",        label: "المشتريات",         sub: "فواتير المشتريات، المرتجعات",        url: "/api/purchases"               },
  { key: "products",         label: "المخزن",            sub: "الأصناف، الكميات، الحركات",         url: "/api/products"                },
  { key: "customers",        label: "العملاء",            sub: "الأرصدة والبيانات",                 url: "/api/customers"               },
  { key: "treasury",         label: "الخزينة",           sub: "الإيرادات، المصروفات، السندات",     url: "/api/financial-transactions"  },
  { key: "expenses",         label: "المصروفات",          sub: "جميع سجلات المصروفات",             url: "/api/expenses"                },
  { key: "income",           label: "الإيرادات",          sub: "جميع سجلات الإيرادات",             url: "/api/income"                  },
  { key: "employees",        label: "الموظفون",           sub: "بيانات الموظفين والرواتب",          url: "/api/employees"               },
  { key: "salary_advances",  label: "سلف الموظفين",      sub: "طلبات السلف والأقساط",              url: "/api/salary-advances"         },
  { key: "settings",         label: "الإعدادات",         sub: "العملة والتفضيلات",                 url: null                          },
] as const;

export const RESTORE_MODULE_GROUPS = [
  { key: "products",        label: "الأصناف والمخزون",    icon: "📦", note: "الأصناف وحركات المخزون"        },
  { key: "customers",       label: "العملاء",              icon: "👥", note: "بيانات العملاء وأرصدتهم"      },
  { key: "sales",           label: "المبيعات",             icon: "🛍️", note: "الفواتير والمرتجعات"           },
  { key: "purchases",       label: "المشتريات",            icon: "🛒", note: "فواتير الشراء والمرتجعات"     },
  { key: "finance",         label: "الخزينة والحسابات",    icon: "💰", note: "المصروفات والسندات والدفتر"   },
  { key: "infrastructure",  label: "الخزن والمستودعات",   icon: "🏦", note: "تعريفات الخزن والمخازن"       },
  { key: "alerts",          label: "التنبيهات",            icon: "🔔", note: "إعدادات التنبيهات"            },
] as const;

export const DATA_GROUPS = [
  { key: "sales",              label: "المبيعات",          sub: "فواتير البيع والمرتجعات",                type: "default" },
  { key: "purchases",          label: "المشتريات",          sub: "فواتير الشراء والمرتجعات",               type: "default" },
  { key: "expenses",           label: "المصروفات",          sub: "جميع سجلات المصروفات",                  type: "default" },
  { key: "income",             label: "الإيرادات",          sub: "جميع سجلات الإيرادات",                  type: "default" },
  { key: "vouchers_treasury",  label: "السندات والخزينة",   sub: "سندات القبض والدفع والتوريد والحركات",   type: "default" },
  { key: "products",           label: "الأصناف",            sub: "بيانات المنتجات والمخزون الكامل",        type: "default" },
  { key: "warehouse",          label: "تفريغ مخزن",         sub: "حركات المخزون لمخزن محدد",               type: "warehouse" },
  { key: "customers",          label: "العملاء",            sub: "بيانات العملاء وأرصدتهم",               type: "default" },
] as const;
