import { getTenantScopedStorageKey } from '@/lib/tenant-storage';
// Shared types, constants, and utilities for RepairSettingsModal tabs
import {
  ClipboardList,
  Users,
  Package,
  Shield,
  MessageCircle,
  LayoutDashboard,
  Smartphone,
  Wrench,
  BarChart2,
} from 'lucide-react';
import type { ComponentType } from 'react';

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
export type DeviceType =
  | 'iphone'
  | 'ipad'
  | 'watch'
  | 'airpods'
  | 'mac'
  | 'samsung_phone'
  | 'samsung_tablet'
  | 'android_phone'
  | 'android_tablet'
  | 'other';
export type SettingsTab =
  | 'checklist'
  | 'dashboard-cards'
  | 'technicians'
  | 'tech-performance'
  | 'models'
  | 'defaults'
  | 'wa-templates'
  | 'accessories'
  | 'service-types';

export { REPAIR_SETTING_KEYS, REPAIR_WA_DEFAULTS } from './constants';

export interface ChecklistRow {
  id: number;
  label_ar: string;
  category: string;
  device_type: string;
  sort_order: number;
}

export interface ERP_User {
  id: number;
  name: string;
  role?: string;
  active?: boolean;
  repair_commission_pct?: number | null;
  repair_specialty?: string | null;
  repair_notifications?: boolean | null;
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
export const DEVICE_TYPE_META: Array<{ key: DeviceType; label: string; emoji: string }> = [
  { key: 'iphone', label: 'آيفون', emoji: '📱' },
  { key: 'ipad', label: 'آيباد', emoji: '📱' },
  { key: 'watch', label: 'أبل ووتش', emoji: '⌚' },
  { key: 'airpods', label: 'إيربودز', emoji: '🎧' },
  { key: 'mac', label: 'ماك', emoji: '💻' },
  { key: 'samsung_phone', label: 'سامسونج موبايل', emoji: '📱' },
  { key: 'samsung_tablet', label: 'سامسونج تابلت', emoji: '📱' },
  { key: 'android_phone', label: 'أندرويد موبايل', emoji: '🤖' },
  { key: 'android_tablet', label: 'أندرويد تابلت', emoji: '🤖' },
  { key: 'other', label: 'أخرى', emoji: '🔧' },
];

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = Object.fromEntries(
  DEVICE_TYPE_META.map((d) => [d.key, d.label])
) as Record<DeviceType, string>;

/* ══════════════════════════════════════════════════════════════
   MANUFACTURER HIERARCHY — 2-level selector
══════════════════════════════════════════════════════════════ */
export const MFR_STORAGE_KEY = 'muhkam_repair_mfrs_v1';

export interface DeviceCategory {
  key: string;
  label: string;
  emoji: string;
}
export interface Manufacturer {
  key: string;
  label: string;
  emoji: string;
  categories: DeviceCategory[];
}

export const DEFAULT_MANUFACTURERS: Manufacturer[] = [
  {
    key: 'apple',
    label: 'Apple',
    emoji: '🍎',
    categories: [
      { key: 'iphone', label: 'آيفون', emoji: '📱' },
      { key: 'ipad', label: 'آيباد', emoji: '📱' },
      { key: 'watch', label: 'أبل ووتش', emoji: '⌚' },
      { key: 'airpods', label: 'إيربودز', emoji: '🎧' },
      { key: 'mac', label: 'ماك', emoji: '💻' },
    ],
  },
  {
    key: 'android',
    label: 'Android',
    emoji: '🤖',
    categories: [
      { key: 'android_phone', label: 'موبايل', emoji: '📱' },
      { key: 'android_tablet', label: 'تابلت', emoji: '📱' },
    ],
  },
  {
    key: 'samsung',
    label: 'Samsung',
    emoji: '📱',
    categories: [
      { key: 'samsung_phone', label: 'سامسونج موبايل', emoji: '📱' },
      { key: 'samsung_tablet', label: 'سامسونج تابلت', emoji: '📱' },
    ],
  },
  {
    key: 'other',
    label: 'أخرى',
    emoji: '🔧',
    categories: [{ key: 'other', label: 'أخرى', emoji: '🔧' }],
  },
];

export function loadManufacturers(): Manufacturer[] {
  try {
    const s = localStorage.getItem(getTenantScopedStorageKey(MFR_STORAGE_KEY));
    if (!s) return DEFAULT_MANUFACTURERS;
    const parsed = JSON.parse(s) as Manufacturer[];
    return parsed.length > 0 ? parsed : DEFAULT_MANUFACTURERS;
  } catch {
    return DEFAULT_MANUFACTURERS;
  }
}
export function saveManufacturers(mfrs: Manufacturer[]) {
  localStorage.setItem(getTenantScopedStorageKey(MFR_STORAGE_KEY), JSON.stringify(mfrs));
}

export const TABS: Array<{
  id: SettingsTab;
  label: string;
  sublabel: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  adminOnly?: boolean;
}> = [
  {
    id: 'checklist',
    label: 'بنود الفحص',
    sublabel: 'قوالب الفحص و QC حسب نوع الجهاز',
    icon: ClipboardList,
  },
  {
    id: 'dashboard-cards',
    label: 'كروت اللوحة',
    sublabel: 'تخصيص ملخّص الصفحة',
    icon: LayoutDashboard,
    adminOnly: true,
  },
  { id: 'technicians', label: 'الفنيين', sublabel: 'إعدادات الموظفين', icon: Users },
  {
    id: 'tech-performance',
    label: 'أداء الفنيين',
    sublabel: 'إنجاز وإحصائيات الفنيين',
    icon: BarChart2,
  },
  {
    id: 'service-types',
    label: 'أنواع الخدمات',
    sublabel: 'الخدمات وقواعد الكوميشن',
    icon: Wrench,
    adminOnly: true,
  },
  { id: 'accessories', label: 'الإكسسوارات', sublabel: 'ما يستلم مع الجهاز', icon: Package },
  {
    id: 'defaults',
    label: 'الافتراضيات',
    sublabel: 'مدة الضمان الافتراضية',
    icon: Shield,
    adminOnly: true,
  },
  {
    id: 'wa-templates',
    label: 'قوالب الواتس',
    sublabel: 'نص رسائل العميل',
    icon: MessageCircle,
    adminOnly: true,
  },
  { id: 'models', label: 'الموديلات', sublabel: 'إضافة موديلات مخصّصة', icon: Smartphone },
];

/* Curated Lucide icon set available for dashboard cards */

/* ══════════════════════════════════════════════════════════════
   CHECKLIST TAB — per device type (inspection + QC use same items)
══════════════════════════════════════════════════════════════ */
