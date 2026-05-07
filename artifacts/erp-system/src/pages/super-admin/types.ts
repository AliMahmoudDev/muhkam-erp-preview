/* ── Types ──────────────────────────────────────── */
export interface BackupFile {
  filename: string;
  size_mb: string;
  created_at: string;
}

export interface CompanyFeatures {
  accounting: boolean;
  hr: boolean;
  pos: boolean;
  warranty: boolean;
  consignment: boolean;
  fixed_assets: boolean;
  maintenance: boolean;
  budgets: boolean;
  bank_reconciliation: boolean;
}

export interface Company {
  id: number;
  name: string;
  plan_type: string;
  edition?: 'advanced' | 'ultimate' | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  admin_email: string | null;
  daysRemaining: number;
  status: 'active' | 'trial' | 'expired' | 'suspended';
  userCount: number;
  created_at: string;
  features?: CompanyFeatures | null;
}

export interface Stats {
  total: number;
  active: number;
  trial: number;
  paid: number;
  expired: number;
  suspended: number;
  totalUsers: number;
  expiringSoon: number;
  expiringSoonList: { id: number; name: string; end_date: string; plan_type: string; days_left: number }[];
  recentSignups: number;
  monthlySignups: { month: string; count: number }[];
  userCountByCompany: Record<number, number>;
}

export interface Manager {
  id: number;
  name: string;
  username: string;
  email: string | null;
  active: boolean | null;
  last_login: string | null;
  created_at: string;
}

/* ── Shared form / result types ─────────────────── */

export interface SubForm {
  plan_type: string;
  edition: 'advanced' | 'ultimate';
  extend_mode: 'days' | 'date';
  extend_days: number;
  end_date: string;
  is_active: boolean;
  features: CompanyFeatures;
}

export interface CreateResult {
  company_name: string;
  username: string;
  admin_name: string;
  temp_password: string;
}

export interface ResetPassResult {
  company_name: string;
  username: string;
  name: string;
  temp_password: string;
}

/* ── Company panel detail types ─────────────────── */

export interface PanelUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: string;
  active: boolean;
}

export interface PanelCompanyDetail extends Company {
  users: PanelUser[];
}

export interface AuditEntry {
  id: number;
  action: string;
  record_type: string | null;
  record_id: number | null;
  note: string | null;
  username: string | null;
  created_at: string;
}

export interface AuditLogResp {
  count: number;
  rows: AuditEntry[];
}

export interface AuditRow {
  id: number;
  action: string;
  record_type: string;
  record_id: number;
  user_id: number | null;
  username: string | null;
  note: string | null;
  company_id: number | null;
  created_at: string;
}

/* ── Company snapshot types ─────────────────────── */

export interface SnapshotData {
  company: Company;
  admins: { id: number; name: string; username: string; role: string; active: boolean; last_login: string | null }[];
  recentAudit: { id: number; action: string; note: string | null; username: string | null; created_at: string }[];
  stats: { salesCount: number; salesRevenue: number; purchasesCount: number };
}

/* ── Telegram types ─────────────────────────────── */

export interface TgAlertRule { enabled: boolean; cooldownHours: number; label: string; }
export interface TgConfig    { enabled: boolean; alerts: Record<string, TgAlertRule>; }
export interface TgBotStatus {
  connected: boolean; token_set: boolean; chat_id_set: boolean;
  bot_username?: string; bot_name?: string; error?: string;
  token_masked: string | null; chat_id: string | null; source: 'db' | 'env' | 'none';
}

/* ── Plan settings type ─────────────────────────── */

export interface PlanSetting {
  id: number; key: string; name_ar: string; description: string | null;
  price: number; includes_mobile: boolean; is_active: boolean;
  created_at: string; updated_at: string;
}

/* ── ActiveTab union ─────────────────────────────── */

export type ActiveTab =
  | 'overview' | 'companies' | 'managers' | 'settings'
  | 'revenue' | 'alerts' | 'announcements' | 'health' | 'plans'
  | 'monitoring' | 'audit_log';

/* ── Constants ───────────────────────────────────── */
export const STATUS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active:    { bg: 'rgba(34,197,94,0.12)',   text: '#22C55E', border: 'rgba(34,197,94,0.3)',   label: 'نشط' },
  trial:     { bg: 'rgba(249,115,22,0.12)',  text: '#F97316', border: 'rgba(249,115,22,0.3)',  label: 'تجريبي' },
  expired:   { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444', border: 'rgba(239,68,68,0.3)',   label: 'منتهي' },
  suspended: { bg: 'rgba(148,163,184,0.1)',  text: '#94A3B8', border: 'rgba(148,163,184,0.2)', label: 'موقوف' },
};

export const PLAN_LABELS: Record<string, string> = {
  trial: 'تجريبي',
  basic: 'أساسي',
  professional: 'احترافي',
  pro: 'احترافي',
  paid: 'مدفوع',
};

export const translatePlan = (p: string) => PLAN_LABELS[p] ?? p;

/*
 * C — colour tokens wired to CSS custom properties.
 * Works in both dark and light mode automatically.
 * Semantic accent colours (orange, success, danger…) stay fixed
 * because they carry meaning regardless of theme.
 */
export const C = {
  /* ── surfaces ──────────────────────────────── */
  bg:        'var(--erp-bg-app)',    // outermost background
  card:      'var(--erp-bg-card)',   // card / panel surface
  surface:   'var(--erp-bg-app)',    // input well (slightly recessed from card)
  border:    'var(--erp-border)',    // generic border

  /* ── typography ─────────────────────────────── */
  text:      'var(--erp-text-1)',    // primary text
  muted:     'var(--erp-text-3)',    // secondary / helper text

  /* ── brand & semantic (fixed regardless of theme) ─ */
  orange:    '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  success:   '#22C55E',
  danger:    '#EF4444',
  warning:   '#F59E0B',
  blue:      '#3B82F6',
};

export const PER_PAGE = 10;
export const FONT = "'Tajawal','Cairo',sans-serif";

export const DEFAULT_FEATS_ULTIMATE: CompanyFeatures = {
  accounting: false, hr: true, pos: true, warranty: true,
  consignment: true, fixed_assets: false, maintenance: false,
  budgets: false, bank_reconciliation: false,
};

export const DEFAULT_FEATS_ADVANCED: CompanyFeatures = {
  accounting: true, hr: true, pos: true, warranty: true,
  consignment: true, fixed_assets: true, maintenance: false,
  budgets: true, bank_reconciliation: true,
};

export function authHeaders(_ignored?: string) {
  return { 'Content-Type': 'application/json' };
}
