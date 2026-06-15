/* ── Shared audit-log display constants ──────────────────────────────
 * Single source of truth for translating audit action codes and record
 * types into Arabic labels/colors. Used by the audit-log tab and the
 * overview dashboard's recent-activity list. Pure data — no behavior.
 * ──────────────────────────────────────────────────────────────────── */

export interface ActionMeta {
  label: string;
  color: string;
}

export const ACTION_AR: Record<string, ActionMeta> = {
  /* عمليات أساسية */
  create: { label: 'إنشاء', color: '#34D399' },
  update: { label: 'تعديل', color: '#60A5FA' },
  delete: { label: 'حذف', color: '#EF4444' },
  cancel: { label: 'إلغاء', color: '#EF4444' },
  view: { label: 'عرض', color: '#60A5FA' },
  login: { label: 'دخول', color: '#A78BFA' },
  logout: { label: 'خروج', color: '#94A3B8' },
  approve: { label: 'موافقة', color: '#34D399' },
  reject: { label: 'رفض', color: '#EF4444' },
  lock: { label: 'قفل', color: '#FB923C' },
  unlock: { label: 'فتح', color: '#34D399' },
  post: { label: 'ترحيل', color: '#60A5FA' },
  restore: { label: 'استعادة', color: '#A78BFA' },
  export: { label: 'تصدير', color: '#22D3EE' },
  reset: { label: 'إعادة تعيين', color: '#F87171' },
  close: { label: 'إقفال', color: '#FB923C' },
  reopen: { label: 'إعادة فتح', color: '#34D399' },
  paid: { label: 'صرف رواتب', color: '#34D399' },
  transfer: { label: 'تحويل', color: '#38BDF8' },
  /* عمليات مالية */
  price_override: { label: 'تجاوز سعر', color: '#FBBF24' },
  lock_period: { label: 'إغلاق فترة', color: '#F87171' },
  unlock_period: { label: 'فتح فترة', color: '#34D399' },
  lock_blocked: { label: 'محاولة إغلاق مرفوضة', color: '#FB923C' },
  reversal_created: { label: 'سند عكسي', color: '#60A5FA' },
  correction_created: { label: 'سند تصحيحي', color: '#A78BFA' },
  /* مخزون وتدقيق */
  INTEGRITY_REPAIR: { label: 'إصلاح محاسبي', color: '#FB7185' },
  INVENTORY_ADJUSTMENT: { label: 'تسوية مخزون', color: '#22D3EE' },
  INVENTORY_COUNT_APPLIED: { label: 'تطبيق جرد مخزون', color: '#22D3EE' },
  INVENTORY_TRANSFER: { label: 'تحويل مخزون', color: '#38BDF8' },
  PERIOD_OVERRIDE: { label: 'تجاوز إغلاق مالي', color: '#FB923C' },
  SAFE_TRANSFER_COMPLETED: { label: 'تحويل خزينة', color: '#38BDF8' },
  /* الصيانة */
  repair_status_change: { label: 'تغيير حالة الصيانة', color: '#22D3EE' },
  repair_assign: { label: 'تكليف فني', color: '#38BDF8' },
  repair_complete: { label: 'إتمام الصيانة', color: '#34D399' },
  /* إدارة الشركات (SaaS) */
  COMPANY_CREATED: { label: 'إنشاء شركة', color: '#34D399' },
  COMPANY_UPDATED: { label: 'تحديث شركة', color: '#60A5FA' },
  COMPANY_ACTIVATED: { label: 'تفعيل شركة', color: '#34D399' },
  COMPANY_SUSPENDED: { label: 'إيقاف شركة', color: '#F59E0B' },
  COMPANY_EXTENDED: { label: 'تمديد اشتراك', color: '#38BDF8' },
  COMPANY_DELETED: { label: 'حذف شركة', color: '#EF4444' },
  COMPANY_SUBSCRIPTION_UPDATED: { label: 'تحديث اشتراك', color: '#60A5FA' },
  ADMIN_PASSWORD_RESET: { label: 'إعادة كلمة المرور', color: '#A78BFA' },
  MANAGER_CREATED: { label: 'إنشاء مدير', color: '#34D399' },
  MANAGER_UPDATED: { label: 'تحديث مدير', color: '#60A5FA' },
  MANAGER_TOGGLED: { label: 'تغيير حالة مدير', color: '#F59E0B' },
  MANAGER_DELETED: { label: 'حذف مدير', color: '#EF4444' },
  PLAN_SETTINGS_UPDATED: { label: 'تحديث إعدادات الخطة', color: '#FBBF24' },
  TELEGRAM_SETTINGS_UPDATED: { label: 'تحديث تليجرام', color: '#38BDF8' },
  BACKUP_CREATED: { label: 'نسخة احتياطية', color: '#34D399' },
  TRIAL_MONITORING_WARNING: { label: 'تحذير فترة تجريبية', color: '#F59E0B' },
  /* النسخ الاحتياطية والاستعادة */
  RESTORE_STARTED: { label: 'بدء استعادة', color: '#A78BFA' },
  RESTORE_REJECTED: { label: 'رفض استعادة', color: '#EF4444' },
  RESTORE_FAILED: { label: 'فشل استعادة', color: '#EF4444' },
  RESTORE_COMPLETED: { label: 'اكتمال استعادة', color: '#34D399' },
  /* وصول المدير العام */
  SUPER_ADMIN_ACCESS: { label: 'وصول مدير عام', color: '#818CF8' },
  SUPER_ADMIN_LIST_VIEW: { label: 'عرض قائمة الشركات', color: '#818CF8' },
};

export const RECORD_AR: Record<string, string> = {
  customer: 'عميل',
  supplier: 'مورد',
  sale: 'فاتورة بيع',
  sale_return: 'مرتجع مبيعات',
  purchase: 'فاتورة شراء',
  purchase_return: 'مرتجع مشتريات',
  product: 'منتج / صنف',
  financial_lock: 'قفل مالي',
  expense: 'مصروف',
  income: 'إيراد',
  safe_transfer: 'تحويل خزينة',
  receipt_voucher: 'سند قبض',
  payment_voucher: 'سند صرف',
  deposit_voucher: 'سند إيداع',
  treasury_voucher: 'سند خزينة',
  journal_entry: 'قيد يومية',
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
  warehouse: 'مستودع',
  stock_transfer: 'تحويل مخزون',
  inventory_count: 'جرد مخزون',
};

/**
 * Safe Arabic display helpers.
 * Never show raw system action/type/note codes directly to Arabic users.
 */
export function getAuditActionMeta(action?: string | null) {
  const raw = (action ?? '').trim();
  const known = raw ? ACTION_AR[raw as keyof typeof ACTION_AR] : undefined;
  if (known) return known;

  if (raw.includes('TRIAL_GUARD') && raw.includes('UNBLOCK')) {
    return { label: 'إلغاء حظر مراقبة الفترة التجريبية', color: 'var(--status-success)' };
  }
  if (raw.includes('TRIAL_GUARD') && raw.includes('BLOCK')) {
    return { label: 'حظر ضمن مراقبة الفترة التجريبية', color: 'var(--status-danger)' };
  }
  if (raw.includes('ENCRYPTION') && raw.includes('GENERATE')) {
    return { label: 'إنشاء مفتاح تشفير النسخ الاحتياطي', color: 'var(--status-success)' };
  }
  if (raw.includes('ENCRYPTION') && raw.includes('ROTATE')) {
    return { label: 'تدوير مفتاح تشفير النسخ الاحتياطي', color: 'var(--status-warning)' };
  }
  if (raw.includes('BACKUP')) {
    return { label: 'إجراء متعلق بالنسخ الاحتياطي', color: 'var(--status-info)' };
  }
  if (raw.includes('RESTORE')) {
    return { label: 'إجراء متعلق بالاستعادة', color: 'var(--status-warning)' };
  }

  return { label: 'إجراء نظامي غير مصنّف', color: 'var(--text-2)' };
}

export function getRecordLabel(recordType?: string | null): string {
  const raw = (recordType ?? '').trim();
  if (!raw) return 'سجل نظامي';

  const known = RECORD_AR[raw as keyof typeof RECORD_AR];
  if (known) return known;

  const extra: Record<string, string> = {
    trial_monitoring: 'مراقبة الفترة التجريبية',
    trial_abuse: 'مراقبة إساءة استخدام التجربة',
    backup: 'النسخ الاحتياطي',
    encryption: 'التشفير',
    settings: 'الإعدادات',
    redis: 'خدمة التخزين المؤقت',
    system: 'النظام',
  };

  return extra[raw] ?? 'سجل نظامي';
}

function extractToken(text: string, key: string): string | null {
  const match = text.match(new RegExp(`${key}=([^\\s,]+)`, 'i'));
  return match?.[1] ?? null;
}

function hasLatinLetters(text: string): boolean {
  return /[A-Za-z]{3,}/.test(text);
}

export function formatAuditNote(note?: string | null): string {
  const text = (note ?? '').trim();
  if (!text) return '—';

  if (!hasLatinLetters(text)) return text;

  const ip = extractToken(text, 'ip');
  const email = extractToken(text, 'email');

  if (/Super admin cleared Redis\/monitoring blocks/i.test(text)) {
    const parts: string[] = [];
    if (ip) parts.push(`عنوان IP: ${ip}`);
    if (email) parts.push(`البريد: ${email}`);
    return parts.length
      ? `تم رفع الحظر يدويًا من مراقبة الفترة التجريبية عن ${parts.join(' و ')}`
      : 'تم رفع الحظر يدويًا من مراقبة الفترة التجريبية';
  }

  if (/encryption key/i.test(text) && /generated|created/i.test(text)) {
    return 'تم إنشاء مفتاح تشفير جديد للنسخ الاحتياطي';
  }

  if (/encryption key/i.test(text) && /rotated|updated/i.test(text)) {
    return 'تم تدوير مفتاح تشفير النسخ الاحتياطي';
  }

  if (/export/i.test(text) && /key/i.test(text)) {
    return 'تم منع محاولة عرض مفتاح التشفير المخزّن';
  }

  if (/backup/i.test(text) && /created/i.test(text)) {
    return 'تم إنشاء نسخة احتياطية';
  }

  if (/restore/i.test(text)) {
    return 'تم بدء عملية استعادة من نسخة احتياطية';
  }

  if (/Redis/i.test(text)) {
    return 'تم تنفيذ إجراء متعلق بخدمة التخزين المؤقت';
  }

  return 'تم تسجيل تفاصيل هذا الإجراء في النظام';
}
