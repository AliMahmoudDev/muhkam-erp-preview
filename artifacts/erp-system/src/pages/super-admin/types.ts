/* ── Types ──────────────────────────────────────── */
export interface BackupFile {
  filename: string;
  size_mb: string;
  created_at: string;
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

export const C = {
  bg:        '#0F172A',
  card:      '#1E293B',
  surface:   '#172033',
  border:    '#334155',
  orange:    '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  text:      '#F8FAFC',
  muted:     '#94A3B8',
  success:   '#22C55E',
  danger:    '#EF4444',
  warning:   '#F59E0B',
  blue:      '#3B82F6',
};

export const PER_PAGE = 10;
export const FONT = "'Tajawal','Cairo',sans-serif";

export function authHeaders(_ignored?: string) {
  return { 'Content-Type': 'application/json' };
}
