/**
 * queryKeys.ts — مصنع مركزي لمفاتيح استعلامات React Query
 *
 * الهدف: توحيد مفاتيح الاستعلام ومنع الأخطاء المطبعية التي تكسر
 * `invalidateQueries`. كل مفتاح يُبنى من دالة هنا بدلاً من كتابة مصفوفات حرفية.
 *
 * ⚠️ ملاحظة توافق: القيم المُرجَعة هنا **مطابقة تماماً** للمفاتيح الحرفية
 * المستخدمة سابقاً (مثل `'/api/super/companies'`) كي يبقى الإبطال (invalidation)
 * واستمرارية الكاش يعملان مع أي كود لم يُحوَّل بعد. لا تُغيّر سلسلة المفتاح
 * الأساسية عند التحويل — غيّر فقط مصدر بنائها.
 *
 * التحويل تدريجي وآمن لكل module على حدة (انظر docs/FRONTEND_PATTERNS.md §4).
 */

export const queryKeys = {
  /* ── Super-admin (SaaS control plane) ──────────────────────────────────── */
  super: {
    companies: {
      all: ['/api/super/companies'] as const,
      detail: (id: number | undefined) =>
        ['/api/super/companies', id, 'panel-detail'] as const,
      snapshot: (id: number | undefined) =>
        ['/api/super/companies', id, 'snapshot'] as const,
    },
    managers: {
      all: ['/api/super/managers'] as const,
    },
    auditLog: {
      all: ['/api/super/audit-log'] as const,
      list: (limit: number, action: string) =>
        ['/api/super/audit-log', limit, action] as const,
      forCompany: (companyId: number | undefined) =>
        ['/api/super/audit-log', 'company-type', companyId] as const,
    },
    stats: ['/api/super/stats'] as const,
    revenue: ['/api/super/revenue'] as const,
    alerts: ['/api/super/alerts'] as const,
    trialMonitoring: ['/api/super/trial-monitoring'] as const,
    health: ['/api/super/health'] as const,
    healthRedis: ['/api/super/health/redis'] as const,
    planSettings: ['/api/super/plan-settings'] as const,
    announcements: ['/api/super/announcements'] as const,
    encryptionStatus: ['/api/super/encryption-status'] as const,
    supportSettings: ['/api/super/support-settings'] as const,
    telegramSettings: ['/api/super/telegram-settings'] as const,
    telegramConfig: ['/api/super/telegram-config'] as const,
    backupList: ['/api/super/backup/list'] as const,
  },

  /* ── Auth ──────────────────────────────────────────────────────────────── */
  auth: {
    twoFaStatus: ['/api/auth/2fa/status'] as const,
  },
} as const;
