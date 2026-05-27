/**
 * Landing page static data — types + constants.
 * Extracted from LandingPage.tsx for maintainability.
 */
import type { ReactNode } from 'react';

export interface BentoItem {
  title: string;
  desc: string;
  cls: string;
  mockup: ReactNode;
}

export type StatItem =
  | { kind: 'text'; text: string; label: string }
  | { kind: 'num'; end: number; suffix: string; label: string };

export const STATS: StatItem[] = [
  { kind: 'text', text: 'نظام متكامل',  label: 'حلّ موحّد لكل أقسام شركتك' },
  { kind: 'text', text: 'دعم عربي كامل', label: 'واجهة عربية أصيلة من البداية' },
  { kind: 'num',  end: 7,  suffix: '',   label: 'أيام تجريبية مجانية' },
  { kind: 'num',  end: 24, suffix: '/7', label: 'دعم متواصل' },
];

export const TICKER = [
  'محاسبة كاملة', '·', 'مبيعات', '·', 'مخزون', '·',
  'موارد بشرية', '·', 'صيانة', '·', 'تقارير', '·',
  'تطبيق موبايل', '·', 'مطابقة بنكية', '·', 'نقطة البيع', '·',
];

export const NAV_LINKS = [['features', 'الميزات'], ['pricing', 'الأسعار']];
