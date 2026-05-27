import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import type { FC, CSSProperties } from 'react';
import {
  Clock, Wrench, CheckCheck, Truck, Ban, Package, Search, Star,
  ShieldCheck, Hammer, Cog, AlertTriangle, AlertCircle, Box, Cpu,
  CheckCircle2, XCircle, Zap, GitBranch, ClipboardList,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────── */
export interface HistoryEntry {
  id: number;
  status_from?: string;
  status_to?: string;
  user_name?: string;
  technician_name?: string;
  event_type?: string;
  note?: string;
  created_at: string;
}

export interface RepairJob {
  id: number;
  company_id: number;
  job_no: string;
  customer_name: string;
  customer_phone?: string;
  customer_id?: number;
  device_brand: string;
  device_model: string;
  device_type?: string;
  imei?: string;
  device_pin?: string;
  color?: string;
  storage?: string;
  problem_description?: string;
  technician_id?: number;
  technician_name?: string;
  responsible_technician_id?: number;
  status: string;
  checklist?: string;
  device_score?: number;
  estimated_cost: string;
  final_cost: string;
  deposit_paid: string;
  received_at: string;
  estimated_delivery?: string;
  delivered_at?: string;
  accessories?: string;
  branch_id?: number;
  notes?: string;
  created_at: string;
  parts?: RepairPart[];
  history?: HistoryEntry[];
  qa_notes?: string | null;
  qa_report?: string | null;
  qa_inspector_name?: string | null;
  qa_checklist?: unknown;
  qa_completed_at?: string | null;
  delivery_payment_type?: string | null;
  delivery_safe_id?: number | null;
}

export interface RepairPart {
  id: number;
  product_id?: number;
  product_name: string;
  quantity: string;
  unit_price: string;
}

export interface Stats {
  total: number; pending: number; in_progress: number;
  done: number; delivered: number; cancelled: number;
}

export interface DashboardCardBreakdown { key: string; count: number }
export interface DashboardCardLastUpdate {
  job_id: number;
  job_no: string;
  customer_name: string;
  status_to: string | null;
  at: string;
}
export interface DashboardCard {
  id: number;
  name: string;
  statuses: string[];
  color: string;
  icon: string;
  sort_order: number;
  alert_threshold: number | null;
  is_system: boolean;
  count: number;
  breakdown: DashboardCardBreakdown[];
  last_update: DashboardCardLastUpdate | null;
}
export interface DashboardData { cards: DashboardCard[]; total_all: number }

export interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
  status: 'pass' | 'fail' | 'partial' | 'untestable' | null;
  notes?: string;
}

export interface AccessoryOption { key: string; label: string; emoji?: string | null }

/* ── Lucide icon registry ── */
export const CARD_ICON_REGISTRY: Record<string, FC<{ className?: string; style?: CSSProperties }>> = {
  Clock, Wrench, CheckCheck, Truck, Ban, Package, Search, Star,
  ShieldCheck, Hammer, Cog, AlertTriangle, AlertCircle, Box, Cpu,
  CheckCircle2, XCircle, Zap, GitBranch, ClipboardList,
};

/* ── Constants ──────────────────────────────────────────────── */
const ACCESSORIES_FALLBACK: Array<{ key: string; label: string; emoji?: string }> = [
  { key: 'charger',   label: 'شاحن',     emoji: '🔌' },
  { key: 'box',       label: 'علبة',     emoji: '📦' },
  { key: 'case',      label: 'جراب',     emoji: '🛡️' },
  { key: 'sim_tray',  label: 'درج SIM',  emoji: '📇' },
  { key: 'earphones', label: 'سماعة',    emoji: '🎧' },
  { key: 'cable',     label: 'كابل',     emoji: '🔗' },
  { key: 'other',     label: 'أخرى',     emoji: '✨' },
];

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'screen',       label: 'الشاشة والعرض',      status: null },
  { id: 'touch',        label: 'اللمس والاستجابة',    status: null },
  { id: 'battery',      label: 'البطارية والشحن',     status: null },
  { id: 'front_camera', label: 'الكاميرا الأمامية',   status: null },
  { id: 'rear_camera',  label: 'الكاميرا الخلفية',    status: null },
  { id: 'speaker',      label: 'المكبر والسماعة',     status: null },
  { id: 'microphone',   label: 'الميكروفون',          status: null },
  { id: 'wifi',         label: 'الواي فاي',           status: null },
  { id: 'bluetooth',    label: 'البلوتوث',            status: null },
  { id: 'network',      label: 'الشبكة والشريحة',    status: null },
  { id: 'port',         label: 'منفذ الشحن/البيانات', status: null },
  { id: 'buttons',      label: 'الأزرار والمفاتيح',   status: null },
  { id: 'biometric',    label: 'البصمة / Face ID',    status: null },
  { id: 'body',         label: 'الجسم الخارجي',       status: null },
];

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  pending:                    { label: 'انتظار',                color: 'text-amber-400',    bg: 'bg-amber-500/15 border-amber-500/30',    icon: Clock },
  diagnosing:                 { label: 'قيد الفحص',             color: 'text-blue-400',     bg: 'bg-blue-500/15 border-blue-500/30',      icon: Search },
  in_progress:                { label: 'جارٍ الإصلاح',          color: 'text-blue-400',     bg: 'bg-blue-500/15 border-blue-500/30',      icon: Wrench },
  waiting_parts:              { label: 'بانتظار قطعة',          color: 'text-pink-400',     bg: 'bg-pink-500/15 border-pink-500/30',      icon: Package },
  qa:                         { label: 'اختبار الجودة',          color: 'text-cyan-400',     bg: 'bg-cyan-500/15 border-cyan-500/30',      icon: ShieldCheck },
  done:                       { label: 'تم الإصلاح',            color: 'text-emerald-400',  bg: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCheck },
  delivered:                  { label: 'تم التسليم',            color: 'text-purple-400',   bg: 'bg-purple-500/15 border-purple-500/30',  icon: Truck },
  cancelled:                  { label: 'ملغي',                  color: 'text-red-400',      bg: 'bg-red-500/15 border-red-500/30',        icon: Ban },
  received:                   { label: 'استلام الجهاز',          color: 'text-violet-400',   bg: 'bg-violet-500/15 border-violet-500/30',  icon: Package },
  initial_inspection:         { label: 'الفحص الأولي',           color: 'text-indigo-400',   bg: 'bg-indigo-500/15 border-indigo-500/30',  icon: Search },
  diagnosis:                  { label: 'التشخيص',               color: 'text-blue-400',     bg: 'bg-blue-500/15 border-blue-500/30',      icon: AlertCircle },
  waiting_customer_approval:  { label: 'انتظار موافقة العميل',   color: 'text-amber-400',    bg: 'bg-amber-500/15 border-amber-500/30',    icon: Clock },
  approved:                   { label: 'تمت الموافقة',           color: 'text-emerald-400',  bg: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle2 },
  in_repair:                  { label: 'جاري الإصلاح',          color: 'text-cyan-400',     bg: 'bg-cyan-500/15 border-cyan-500/30',      icon: Wrench },
  repaired:                   { label: 'تم الإصلاح',            color: 'text-teal-400',     bg: 'bg-teal-500/15 border-teal-500/30',      icon: CheckCheck },
  final_quality_check:        { label: 'مراقبة الجودة',          color: 'text-purple-400',   bg: 'bg-purple-500/15 border-purple-500/30',  icon: Star },
  ready_for_delivery:         { label: 'جاهز للتسليم',          color: 'text-lime-400',     bg: 'bg-lime-500/15 border-lime-500/30',      icon: Package },
  shipped:                    { label: 'قيد الشحن',             color: 'text-sky-400',      bg: 'bg-sky-500/15 border-sky-500/30',        icon: Truck },
  rejected:                   { label: 'مرفوض',                 color: 'text-red-400',      bg: 'bg-red-500/15 border-red-500/30',        icon: XCircle },
};

export const STATUS_BORDER: Record<string, string> = {
  received: 'border-violet-500/30', initial_inspection: 'border-indigo-500/30',
  diagnosis: 'border-blue-500/30', waiting_customer_approval: 'border-amber-500/30',
  approved: 'border-emerald-500/30', in_repair: 'border-cyan-500/30',
  repaired: 'border-teal-500/30', final_quality_check: 'border-purple-500/30',
  ready_for_delivery: 'border-lime-500/30', shipped: 'border-sky-500/30', delivered: 'border-emerald-600/30',
  rejected: 'border-red-600/30', cancelled: 'border-red-500/20',
  pending: 'border-amber-500/30', in_progress: 'border-blue-500/30', done: 'border-emerald-500/30',
  waiting_parts: 'border-pink-500/30', diagnosing: 'border-blue-500/30', qa: 'border-cyan-500/30',
};

export const STATUS_BAR_COLOR: Record<string, string> = {
  pending:                   'bg-amber-500/60',
  in_progress:               'bg-blue-500/60',
  done:                      'bg-emerald-500/60',
  delivered:                 'bg-violet-500/60',
  cancelled:                 'bg-red-500/60',
  received:                  'bg-violet-400/60',
  initial_inspection:        'bg-indigo-500/60',
  diagnosis:                 'bg-blue-400/60',
  waiting_customer_approval: 'bg-amber-400/60',
  approved:                  'bg-emerald-400/60',
  in_repair:                 'bg-cyan-500/60',
  repaired:                  'bg-teal-500/60',
  final_quality_check:       'bg-purple-500/60',
  ready_for_delivery:        'bg-lime-500/60',
  shipped:                   'bg-sky-500/60',
  rejected:                  'bg-red-600/60',
  waiting_parts:             'bg-pink-500/60',
  diagnosing:                'bg-blue-400/60',
  qa:                        'bg-cyan-500/60',
};

/* ── Score helper ── */
export function computeScore(items: ChecklistItem[]): number {
  const relevant = items.filter((c) => c.status === 'pass' || c.status === 'fail' || c.status === 'partial');
  if (!relevant.length) return 0;
  const points = relevant.reduce((acc, c) => acc + (c.status === 'pass' ? 1 : c.status === 'partial' ? 0.5 : 0), 0);
  return Math.round((points / relevant.length) * 100);
}

/* ── Template helper ── */
export function applyTemplate(tpl: string, vars: Record<string, string | number | undefined | null>): string {
  return tpl.replace(/\{\{\s*([^}\s]+?)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

/* ── Relative time (Arabic) ── */
export function relativeTimeAr(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1)    return 'الآن';
  if (diffMin < 60)   return `منذ ${diffMin} د`;
  const h = Math.floor(diffMin / 60);
  if (h < 24)         return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 7)          return `منذ ${d} ي`;
  return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

/* ── Hooks ── */
export function useAccessoriesList(): AccessoryOption[] {
  const { data } = useQuery<Array<{ key_: string; label_ar: string; emoji: string | null; active: boolean }>>({
    queryKey: ['/api/repair-accessories'],
    queryFn: () => authFetch(api('/api/repair-accessories')).then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return ACCESSORIES_FALLBACK;
  return data.filter(d => d.active).map(d => ({ key: d.key_, label: d.label_ar, emoji: d.emoji }));
}

export function useRepairSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['/api/settings/system'],
    queryFn: () => authFetch(api('/api/settings/system')).then(r => r.json()),
    staleTime: 60_000,
  }).data ?? {};
}

/* ScoreRing and StatusBadge live in repairComponents.tsx (JSX requires .tsx extension) */
