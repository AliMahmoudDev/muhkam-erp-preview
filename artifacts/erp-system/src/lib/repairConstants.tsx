import type React from "react";
import {
  Clock, Wrench, CheckCheck, Truck, Ban, Package, Search, Star,
  ShieldCheck, Hammer, Cog, AlertTriangle, AlertCircle, Box, Cpu,
  CheckCircle2, XCircle, Zap, GitBranch, ClipboardList,
} from "lucide-react";

export const DEVICE_TYPES: Array<{ key: string; label: string; emoji: string }> = [
  { key: "iphone",          label: "آيفون",            emoji: "📱" },
  { key: "ipad",            label: "آيباد",            emoji: "📱" },
  { key: "watch",           label: "أبل ووتش",         emoji: "⌚" },
  { key: "airpods",         label: "إيربودز",          emoji: "🎧" },
  { key: "mac",             label: "ماك",              emoji: "💻" },
  { key: "samsung_phone",   label: "سامسونج موبايل",   emoji: "📱" },
  { key: "samsung_tablet",  label: "سامسونج تابلت",    emoji: "📱" },
  { key: "android_phone",   label: "أندرويد موبايل",   emoji: "🤖" },
  { key: "android_tablet",  label: "أندرويد تابلت",    emoji: "🤖" },
  { key: "other",           label: "أخرى",             emoji: "🔧" },
];

export function deriveDeviceType(brand: string, category: string): string {
  const b = (brand || "").toLowerCase();
  const c = (category || "").toLowerCase();
  if (b.includes("apple")) {
    if (c.includes("iphone"))  return "iphone";
    if (c.includes("ipad"))    return "ipad";
    if (c.includes("watch"))   return "watch";
    if (c.includes("airpods")) return "airpods";
    if (c.includes("mac"))     return "mac";
  }
  if (b.includes("samsung")) {
    if (c.includes("tab")) return "samsung_tablet";
    return "samsung_phone";
  }
  if (["xiaomi","huawei","oppo","vivo","realme","nokia","oneplus"].some(x => b.includes(x))) {
    if (c.includes("pad") || c.includes("matepad")) return "android_tablet";
    return "android_phone";
  }
  return "other";
}

export const DASHBOARD_CARD_ICONS: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  Clock, Wrench, CheckCheck, Truck, Ban, Package, Search, Star,
  ShieldCheck, Hammer, Cog, AlertTriangle, AlertCircle, Box, Cpu,
  CheckCircle2, XCircle, Zap, GitBranch, ClipboardList,
};

export const DASHBOARD_CARD_COLORS = [
  "var(--status-warning)", "var(--status-info)", "var(--status-success)", "var(--status-info)", "var(--status-info)",
  "#ec4899", "#14b8a6", "#a855f7", "#84cc16", "var(--status-danger)",
  "var(--status-warning)", "var(--status-info)",
];
