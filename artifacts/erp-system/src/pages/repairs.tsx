import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Plus, Search, Phone, Smartphone, CheckCircle2, XCircle,
  MinusCircle, Trash2, Save, ChevronLeft, Send, ClipboardList,
  AlertCircle, Clock, CheckCheck, Truck, Ban,
  Star, Settings, MessageSquare, ChevronRight, RotateCcw,
  LayoutGrid, List, Package, GitBranch, History, Printer,
  ShieldCheck, Hammer, Cog, AlertTriangle, Box, Cpu, Zap,
  ChevronDown, Bell, Banknote, CreditCard, Wallet, TrendingUp,
  Users, BarChart3, DollarSign,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { formatCurrency } from "@/lib/format";
import { api } from '@/lib/api';
import RepairPipeline from "@/components/RepairPipeline";
import RepairParts from "@/components/RepairParts";
import RepairSettingsModal from "@/components/RepairSettingsModal";
import { deriveDeviceType } from "@/lib/repairConstants";


/* ── Types ──────────────────────────────────────────────────── */
interface HistoryEntry {
  id: number;
  status_from?: string;
  status_to?: string;
  user_name?: string;
  technician_name?: string;
  event_type?: string;
  note?: string;
  created_at: string;
}

interface RepairJob {
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
  qa_checklist?: unknown;
  qa_completed_at?: string | null;
}

interface RepairPart {
  id: number;
  product_id?: number;
  product_name: string;
  quantity: string;
  unit_price: string;
}

interface RepairPayment {
  id: number;
  amount: number;
  payment_method: string;
  notes?: string;
  received_by_name?: string;
  safe_name?: string;
  created_at: string;
}

interface Stats {
  total: number; pending: number; in_progress: number;
  done: number; delivered: number; cancelled: number;
}

/* ── Customizable dashboard cards ──────────────────────────── */
interface DashboardCardBreakdown { key: string; count: number }
interface DashboardCardLastUpdate {
  job_id: number;
  job_no: string;
  customer_name: string;
  status_to: string | null;
  at: string;
}
interface DashboardCard {
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
interface DashboardData { cards: DashboardCard[]; total_all: number }

/* Lucide icon registry — must match RepairSettingsModal.DASHBOARD_CARD_ICONS */
const CARD_ICON_REGISTRY: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  Clock, Wrench, CheckCheck, Truck, Ban, Package, Search, Star,
  ShieldCheck, Hammer, Cog, AlertTriangle, AlertCircle, Box, Cpu,
  CheckCircle2, XCircle, Zap, GitBranch, ClipboardList,
};

interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
  status: "pass" | "fail" | "partial" | "untestable" | null;
  notes?: string;
}


/* ── Constants ──────────────────────────────────────────────── */
const ACCESSORIES_LIST = [
  { key: "charger",   label: "شاحن" },
  { key: "box",       label: "علبة" },
  { key: "case",      label: "جراب" },
  { key: "sim_tray",  label: "درج SIM" },
  { key: "earphones", label: "سماعة" },
  { key: "cable",     label: "كابل" },
  { key: "other",     label: "أخرى" },
];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "screen",       label: "الشاشة والعرض",      status: null },
  { id: "touch",        label: "اللمس والاستجابة",    status: null },
  { id: "battery",      label: "البطارية والشحن",     status: null },
  { id: "front_camera", label: "الكاميرا الأمامية",   status: null },
  { id: "rear_camera",  label: "الكاميرا الخلفية",    status: null },
  { id: "speaker",      label: "المكبر والسماعة",     status: null },
  { id: "microphone",   label: "الميكروفون",          status: null },
  { id: "wifi",         label: "الواي فاي",           status: null },
  { id: "bluetooth",    label: "البلوتوث",            status: null },
  { id: "network",      label: "الشبكة والشريحة",    status: null },
  { id: "port",         label: "منفذ الشحن/البيانات", status: null },
  { id: "buttons",      label: "الأزرار والمفاتيح",   status: null },
  { id: "biometric",    label: "البصمة / Face ID",    status: null },
  { id: "body",         label: "الجسم الخارجي",       status: null },
];

/* ── Device Catalog: Brand → Category → Models ───────────────── */
const DEVICE_CATALOG: Record<string, Record<string, string[]>> = {
  "Apple": {
    "iPhone": [
      "iPhone 6","iPhone 6s","iPhone 6s Plus","iPhone SE (الجيل الأول)",
      "iPhone 7","iPhone 7 Plus","iPhone 8","iPhone 8 Plus","iPhone X",
      "iPhone XS","iPhone XS Max","iPhone XR",
      "iPhone 11","iPhone 11 Pro","iPhone 11 Pro Max",
      "iPhone SE (الجيل الثاني)","iPhone 12","iPhone 12 mini",
      "iPhone 12 Pro","iPhone 12 Pro Max",
      "iPhone 13","iPhone 13 mini","iPhone 13 Pro","iPhone 13 Pro Max",
      "iPhone SE (الجيل الثالث)","iPhone 14","iPhone 14 Plus","iPhone 14 Pro","iPhone 14 Pro Max",
      "iPhone 15","iPhone 15 Plus","iPhone 15 Pro","iPhone 15 Pro Max",
      "iPhone 16","iPhone 16 Plus","iPhone 16 Pro","iPhone 16 Pro Max",
    ],
    "iPad": [
      "iPad mini 4","iPad mini 5","iPad mini 6","iPad mini 7",
      "iPad Air 3","iPad Air 4","iPad Air 5","iPad Air M2",
      "iPad (الجيل السابع)","iPad (الجيل الثامن)","iPad (الجيل التاسع)","iPad (الجيل العاشر)",
      "iPad Pro 11\" (الجيل الأول)","iPad Pro 11\" (الجيل الثاني)","iPad Pro 11\" (الجيل الثالث)","iPad Pro 11\" M4",
      "iPad Pro 12.9\" (الجيل الثالث)","iPad Pro 12.9\" (الجيل الرابع)","iPad Pro 12.9\" (الجيل الخامس)","iPad Pro 12.9\" M2",
      "iPad Pro 13\" M4",
    ],
    "Apple Watch": [
      "Apple Watch Series 4","Apple Watch Series 5","Apple Watch SE (الجيل الأول)",
      "Apple Watch Series 6","Apple Watch Series 7","Apple Watch Series 8",
      "Apple Watch SE (الجيل الثاني)","Apple Watch Ultra","Apple Watch Series 9","Apple Watch Ultra 2",
    ],
    "AirPods": [
      "AirPods (الجيل الثاني)","AirPods (الجيل الثالث)",
      "AirPods Pro (الجيل الأول)","AirPods Pro (الجيل الثاني)","AirPods Max",
    ],
    "Mac": [
      "MacBook Air M1","MacBook Air M2","MacBook Air M3",
      "MacBook Pro 13\" M1","MacBook Pro 13\" M2",
      "MacBook Pro 14\" M1 Pro","MacBook Pro 14\" M2 Pro","MacBook Pro 14\" M3 Pro",
      "MacBook Pro 16\" M1 Pro","MacBook Pro 16\" M2 Pro","MacBook Pro 16\" M3 Pro",
      "iMac M1","iMac M3",
    ],
  },
  "Samsung": {
    "Galaxy S": [
      "Galaxy S20","Galaxy S20+","Galaxy S20 Ultra","Galaxy S20 FE",
      "Galaxy S21","Galaxy S21+","Galaxy S21 Ultra","Galaxy S21 FE",
      "Galaxy S22","Galaxy S22+","Galaxy S22 Ultra",
      "Galaxy S23","Galaxy S23+","Galaxy S23 Ultra","Galaxy S23 FE",
      "Galaxy S24","Galaxy S24+","Galaxy S24 Ultra","Galaxy S24 FE",
      "Galaxy S25","Galaxy S25+","Galaxy S25 Ultra",
    ],
    "Galaxy A": [
      "Galaxy A03s","Galaxy A04s","Galaxy A05s",
      "Galaxy A12","Galaxy A13","Galaxy A14","Galaxy A15","Galaxy A16",
      "Galaxy A22","Galaxy A23","Galaxy A24","Galaxy A25","Galaxy A26",
      "Galaxy A32","Galaxy A33","Galaxy A34","Galaxy A35","Galaxy A36",
      "Galaxy A52","Galaxy A52s","Galaxy A53","Galaxy A54","Galaxy A55","Galaxy A56",
      "Galaxy A72","Galaxy A73","Galaxy A74",
    ],
    "Galaxy M": [
      "Galaxy M12","Galaxy M13","Galaxy M14","Galaxy M15",
      "Galaxy M23","Galaxy M33","Galaxy M34","Galaxy M35",
      "Galaxy M53","Galaxy M54","Galaxy M55",
    ],
    "Galaxy Z": [
      "Galaxy Z Fold 3","Galaxy Z Fold 4","Galaxy Z Fold 5","Galaxy Z Fold 6",
      "Galaxy Z Flip 3","Galaxy Z Flip 4","Galaxy Z Flip 5","Galaxy Z Flip 6",
    ],
    "Galaxy Tab": [
      "Galaxy Tab A7","Galaxy Tab A7 Lite","Galaxy Tab A8",
      "Galaxy Tab S6 Lite","Galaxy Tab S7","Galaxy Tab S7+","Galaxy Tab S7 FE",
      "Galaxy Tab S8","Galaxy Tab S8+","Galaxy Tab S8 Ultra",
      "Galaxy Tab S9","Galaxy Tab S9+","Galaxy Tab S9 Ultra","Galaxy Tab S9 FE",
    ],
  },
  "Xiaomi": {
    "Redmi": [
      "Redmi 9","Redmi 9A","Redmi 9C","Redmi 10","Redmi 10A","Redmi 10C",
      "Redmi 12","Redmi 12C","Redmi 13","Redmi 13C",
      "Redmi Note 10","Redmi Note 10 Pro","Redmi Note 10S",
      "Redmi Note 11","Redmi Note 11 Pro","Redmi Note 11S",
      "Redmi Note 12","Redmi Note 12 Pro","Redmi Note 12S",
      "Redmi Note 13","Redmi Note 13 Pro","Redmi Note 13 Pro+",
    ],
    "Xiaomi": [
      "Xiaomi 12","Xiaomi 12 Pro","Xiaomi 12 Lite",
      "Xiaomi 13","Xiaomi 13 Pro","Xiaomi 13 Lite",
      "Xiaomi 14","Xiaomi 14 Pro","Xiaomi 14 Ultra",
    ],
    "POCO": [
      "POCO X3 NFC","POCO X3 Pro","POCO X4 Pro","POCO X5 Pro","POCO X6 Pro",
      "POCO M4 Pro","POCO M5","POCO M5s","POCO M6 Pro",
      "POCO F3","POCO F4","POCO F5","POCO F6",
    ],
    "Xiaomi Pad": [
      "Xiaomi Pad 5","Xiaomi Pad 5 Pro","Xiaomi Pad 6","Xiaomi Pad 6 Pro",
    ],
  },
  "Huawei": {
    "P Series": [
      "P30","P30 Pro","P40","P40 Pro","P40 Lite",
      "P50","P50 Pro","P50 Pocket","P60","P60 Pro","P60 Art",
    ],
    "Mate Series": [
      "Mate 20","Mate 20 Pro","Mate 30","Mate 30 Pro",
      "Mate 40","Mate 40 Pro","Mate 50","Mate 50 Pro","Mate 60 Pro",
    ],
    "Nova Series": [
      "Nova 7i","Nova 8","Nova 8i","Nova 9","Nova 9 Pro",
      "Nova 10","Nova 10 Pro","Nova 11","Nova 11 Pro",
    ],
    "Y Series": [
      "Y6p","Y7a","Y8p","Y8s","Y9a","Y90",
    ],
    "MatePad": [
      "MatePad 10.4","MatePad 11","MatePad Pro 11","MatePad Pro 12.6",
    ],
  },
  "Oppo": {
    "A Series": [
      "A15","A16","A17","A18","A54","A55","A57","A57s","A58","A74","A77","A78","A79","A96","A98",
    ],
    "Reno": [
      "Reno 6","Reno 6 Pro","Reno 7","Reno 7 Pro","Reno 8","Reno 8 Pro",
      "Reno 10","Reno 10 Pro","Reno 11","Reno 11 Pro","Reno 12 Pro",
    ],
    "Find X": [
      "Find X3 Pro","Find X5 Pro","Find X6 Pro","Find X7 Ultra",
    ],
    "F Series": [
      "F19","F19 Pro","F21 Pro","F23","F25 Pro",
    ],
  },
  "Vivo": {
    "Y Series": [
      "Y15s","Y16","Y17s","Y21","Y21s","Y22","Y22s","Y27","Y27s","Y28",
      "Y33s","Y35","Y36","Y55","Y55s","Y72","Y73","Y75","Y76","Y78",
    ],
    "V Series": [
      "V21","V21e","V23","V23e","V25","V25 Pro","V27","V27 Pro","V29","V29 Pro","V40",
    ],
    "X Series": [
      "X80","X80 Pro","X90","X90 Pro","X100","X100 Pro",
    ],
  },
  "Realme": {
    "C Series": [
      "C21","C21Y","C25","C25s","C25Y","C30","C31","C33","C35","C55","C67",
    ],
    "Number Series": [
      "Realme 9","Realme 9i","Realme 9 Pro","Realme 9 Pro+",
      "Realme 10","Realme 10 Pro","Realme 10 Pro+",
      "Realme 11","Realme 11 Pro","Realme 11 Pro+",
      "Realme 12 Pro","Realme 12 Pro+",
    ],
    "GT Series": [
      "Realme GT Neo 2","Realme GT Neo 3","Realme GT Neo 5","Realme GT 5",
    ],
    "Narzo": [
      "Narzo 50","Narzo 50A","Narzo 60","Narzo 70",
    ],
  },
  "Nokia": {
    "G Series": ["Nokia G10","Nokia G20","Nokia G21","Nokia G22","Nokia G42"],
    "C Series": ["Nokia C20","Nokia C21","Nokia C30","Nokia C31","Nokia C32"],
    "X Series": ["Nokia X10","Nokia X20","Nokia X30"],
  },
  "OnePlus": {
    "OnePlus": [
      "OnePlus 9","OnePlus 9 Pro","OnePlus 10 Pro","OnePlus 10T",
      "OnePlus 11","OnePlus 11R","OnePlus 12","OnePlus 12R",
    ],
    "Nord": [
      "Nord 2","Nord 2T","Nord 3","Nord CE 2","Nord CE 3","Nord CE 4",
    ],
  },
  "أخرى": {
    "جهاز آخر": [],
  },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  pending:                    { label: "انتظار",                color: "text-amber-400",    bg: "bg-amber-500/15 border-amber-500/30",    icon: Clock },
  diagnosing:                 { label: "قيد الفحص",             color: "text-blue-400",     bg: "bg-blue-500/15 border-blue-500/30",      icon: Search },
  in_progress:                { label: "جارٍ الإصلاح",          color: "text-blue-400",     bg: "bg-blue-500/15 border-blue-500/30",      icon: Wrench },
  waiting_parts:              { label: "بانتظار قطعة",          color: "text-pink-400",     bg: "bg-pink-500/15 border-pink-500/30",      icon: Package },
  qa:                         { label: "اختبار الجودة",          color: "text-cyan-400",     bg: "bg-cyan-500/15 border-cyan-500/30",      icon: ShieldCheck },
  done:                       { label: "تم الإصلاح",            color: "text-emerald-400",  bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCheck },
  delivered:                  { label: "تم التسليم",            color: "text-purple-400",   bg: "bg-purple-500/15 border-purple-500/30",  icon: Truck },
  cancelled:                  { label: "ملغي",                  color: "text-red-400",      bg: "bg-red-500/15 border-red-500/30",        icon: Ban },
  received:                   { label: "استلام الجهاز",          color: "text-violet-400",   bg: "bg-violet-500/15 border-violet-500/30",  icon: Package },
  initial_inspection:         { label: "الفحص الأولي",           color: "text-indigo-400",   bg: "bg-indigo-500/15 border-indigo-500/30",  icon: Search },
  diagnosis:                  { label: "التشخيص",               color: "text-blue-400",     bg: "bg-blue-500/15 border-blue-500/30",      icon: AlertCircle },
  waiting_customer_approval:  { label: "انتظار موافقة العميل",   color: "text-amber-400",    bg: "bg-amber-500/15 border-amber-500/30",    icon: Clock },
  approved:                   { label: "تمت الموافقة",           color: "text-emerald-400",  bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2 },
  in_repair:                  { label: "جاري الإصلاح",          color: "text-cyan-400",     bg: "bg-cyan-500/15 border-cyan-500/30",      icon: Wrench },
  repaired:                   { label: "تم الإصلاح",            color: "text-teal-400",     bg: "bg-teal-500/15 border-teal-500/30",      icon: CheckCheck },
  final_quality_check:        { label: "مراقبة الجودة",          color: "text-purple-400",   bg: "bg-purple-500/15 border-purple-500/30",  icon: Star },
  ready_for_delivery:         { label: "جاهز للتسليم",          color: "text-lime-400",     bg: "bg-lime-500/15 border-lime-500/30",      icon: Package },
  shipped:                    { label: "قيد الشحن",             color: "text-sky-400",      bg: "bg-sky-500/15 border-sky-500/30",        icon: Truck },
  rejected:                   { label: "مرفوض",                 color: "text-red-400",      bg: "bg-red-500/15 border-red-500/30",        icon: XCircle },
};

const STATUS_BORDER: Record<string, string> = {
  received: "border-violet-500/30", initial_inspection: "border-indigo-500/30",
  diagnosis: "border-blue-500/30", waiting_customer_approval: "border-amber-500/30",
  approved: "border-emerald-500/30", in_repair: "border-cyan-500/30",
  repaired: "border-teal-500/30", final_quality_check: "border-purple-500/30",
  ready_for_delivery: "border-lime-500/30", shipped: "border-sky-500/30", delivered: "border-emerald-600/30",
  rejected: "border-red-600/30", cancelled: "border-red-500/20",
  pending: "border-amber-500/30", in_progress: "border-blue-500/30", done: "border-emerald-500/30",
  waiting_parts: "border-pink-500/30", diagnosing: "border-blue-500/30", qa: "border-cyan-500/30",
};

const STATUS_BAR_COLOR: Record<string, string> = {
  pending:                   "bg-amber-500/60",
  in_progress:               "bg-blue-500/60",
  done:                      "bg-emerald-500/60",
  delivered:                 "bg-violet-500/60",
  cancelled:                 "bg-red-500/60",
  received:                  "bg-violet-400/60",
  initial_inspection:        "bg-indigo-500/60",
  diagnosis:                 "bg-blue-400/60",
  waiting_customer_approval: "bg-amber-400/60",
  approved:                  "bg-emerald-400/60",
  in_repair:                 "bg-cyan-500/60",
  repaired:                  "bg-teal-500/60",
  final_quality_check:       "bg-purple-500/60",
  ready_for_delivery:        "bg-lime-500/60",
  shipped:                   "bg-sky-500/60",
  rejected:                  "bg-red-600/60",
  waiting_parts:             "bg-pink-500/60",
  diagnosing:                "bg-blue-400/60",
  qa:                        "bg-cyan-500/60",
};

/* ── Score Helpers ──────────────────────────────────────────── */
function computeScore(items: ChecklistItem[]): number {
  const relevant = items.filter((c) => c.status === "pass" || c.status === "fail" || c.status === "partial");
  if (!relevant.length) return 0;
  const points = relevant.reduce((acc, c) => acc + (c.status === "pass" ? 1 : c.status === "partial" ? 0.5 : 0), 0);
  return Math.round((points / relevant.length) * 100);
}

/* ── Score Component ────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray 0.5s" }} />
        <text x="36" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">{score}%</text>
      </svg>
      <span className="text-[10px] text-white/40">حالة الجهاز</span>
    </div>
  );
}

/* ── Status Badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "text-white/60", bg: "bg-white/5 border-white/10", icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${s.color} ${s.bg}`}>
      <Icon className="w-2.5 h-2.5" />
      {s.label}
    </span>
  );
}

/* ── Dashboard cards section (hybrid: bar + flex cards + drawer) ─ */
function relativeTimeAr(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1)    return "الآن";
  if (diffMin < 60)   return `منذ ${diffMin} د`;
  const h = Math.floor(diffMin / 60);
  if (h < 24)         return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  if (d < 7)          return `منذ ${d} ي`;
  return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

interface DashboardCardsSectionProps {
  dashboard: DashboardData | undefined;
  activeStatusFilter: string;
  onCardClick: (card: DashboardCard) => void;
  onStatusClick: (status: string) => void;
}

function DashboardCardsSection({
  dashboard, activeStatusFilter, onCardClick, onStatusClick,
}: DashboardCardsSectionProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!dashboard) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] h-24 flex items-center justify-center text-white/30 text-xs">
        جارٍ تحميل لوحة الصيانة...
      </div>
    );
  }

  const cards = dashboard.cards ?? [];
  const totalAll = dashboard.total_all || 0;

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center text-white/40 text-xs">
        لم يتم إعداد أي كارت بعد. افتح الإعدادات ← كروت اللوحة لإضافة كارت.
      </div>
    );
  }

  /* Compute relative widths for the segmented bar (min 6% so empties stay visible) */
  const barSegments = cards.map(c => ({
    id: c.id,
    color: c.color,
    pct: totalAll > 0 ? Math.max((c.count / totalAll) * 100, 6) : 100 / cards.length,
  }));

  return (
    <div className="space-y-2">
      {/* ── Top segmented proportion bar ── */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/35 font-bold tracking-widest uppercase">توزيع المهام</span>
          <span className="text-[10px] text-white/45 font-mono">{totalAll} إجمالي</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/5 flex" dir="ltr">
          {barSegments.map((seg, i) => (
            <div key={seg.id}
              className="h-full transition-all duration-500"
              style={{
                width: `${seg.pct}%`,
                background: seg.color,
                marginInlineStart: i === 0 ? 0 : 1,
                opacity: totalAll === 0 ? 0.25 : 0.85,
              }}
              title={cards[i]?.name} />
          ))}
        </div>
      </div>

      {/* ── Flex cards row (proportional, min width 120) ── */}
      <div className="flex gap-2 flex-wrap">
        {cards.map(card => {
          const Icon = CARD_ICON_REGISTRY[card.icon] ?? Wrench;
          const pct = totalAll > 0 ? (card.count / totalAll) * 100 : 0;
          const isActive = activeStatusFilter === card.statuses.join(",");
          const isExpanded = expandedId === card.id;
          const isAlerting = card.alert_threshold != null && card.count >= card.alert_threshold;

          /* Flex grow proportional to count, but with sensible bounds */
          const grow = Math.max(card.count, 1);

          return (
            <button
              key={card.id}
              onClick={() => {
                setExpandedId(prev => (prev === card.id ? null : card.id));
                onCardClick(card);
              }}
              className={`group relative rounded-2xl border bg-gradient-to-br to-transparent p-3 flex flex-col gap-1 text-right transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                isActive ? "ring-2 ring-offset-2 ring-offset-black/40" : ""
              } ${isAlerting ? "animate-pulse-slow" : ""}`}
              style={{
                flex: `${grow} 1 120px`,
                minWidth: 120,
                background: `linear-gradient(135deg, ${card.color}1F, transparent)`,
                borderColor: isActive ? card.color : `${card.color}33`,
                ...(isActive ? { boxShadow: `0 0 0 2px ${card.color}66` } : {}),
              } as React.CSSProperties}
            >
              {/* Top row: icon + name + alert */}
              <div className="flex items-center justify-between gap-2">
                <Icon className="w-4 h-4 shrink-0" style={{ color: card.color }} />
                {isAlerting && (
                  <Bell className="w-3 h-3 text-amber-400 animate-pulse" />
                )}
                <span className="text-[9px] font-bold uppercase tracking-widest truncate flex-1"
                  style={{ color: `${card.color}cc` }}>
                  {card.name}
                </span>
              </div>

              {/* Big count */}
              <div className="text-3xl font-black leading-none tracking-tight" style={{ color: card.color }}>
                {card.count}
              </div>

              {/* Mini progress bar (this card vs total) */}
              <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: `${card.color}26` }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: card.color }} />
              </div>

              {/* Last update line (small + truncated) */}
              <div className="flex items-center gap-1 text-[10px] text-white/45 mt-0.5 min-h-[14px]">
                {card.last_update ? (
                  <>
                    <Clock className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {card.last_update.job_no} · {relativeTimeAr(card.last_update.at)}
                    </span>
                  </>
                ) : (
                  <span className="text-white/25">لا تحديثات</span>
                )}
                <ChevronDown className={`w-3 h-3 mr-auto shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  style={{ color: `${card.color}aa` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Expanded breakdown drawer ── */}
      {expandedId != null && (() => {
        const card = cards.find(c => c.id === expandedId);
        if (!card) return null;
        const Icon = CARD_ICON_REGISTRY[card.icon] ?? Wrench;
        return (
          <div className="rounded-2xl border p-3 transition-all"
            style={{
              background: `linear-gradient(135deg, ${card.color}14, transparent)`,
              borderColor: `${card.color}40`,
            }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
              <span className="text-[12px] font-bold" style={{ color: card.color }}>
                {card.name} — تفصيل
              </span>
              <span className="text-[10px] text-white/45 font-mono">({card.count})</span>
              <button onClick={() => setExpandedId(null)}
                className="mr-auto text-white/30 hover:text-white/70 text-[11px] font-bold">
                إخفاء
              </button>
            </div>

            {/* Breakdown chips */}
            {card.breakdown.length === 0 ? (
              <div className="text-white/35 text-[11px] py-2">لا توجد مهام في هذه الحالات</div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {card.breakdown.map(b => {
                  const meta = STATUS_MAP[b.key] ?? { label: b.key, color: "text-white/60", bg: "bg-white/5 border-white/10", icon: AlertCircle };
                  return (
                    <button key={b.key} onClick={() => onStatusClick(b.key)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:scale-[1.03] ${meta.bg} ${meta.color} ${
                        activeStatusFilter === b.key ? "ring-1 ring-white/40" : ""
                      }`}>
                      {meta.label}
                      <span className="text-[10px] opacity-70 font-mono">{b.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Last update full line */}
            {card.last_update && (
              <div className="flex items-center gap-2 text-[11px] text-white/55 pt-2 border-t border-white/8">
                <History className="w-3 h-3 shrink-0" style={{ color: card.color }} />
                <span className="font-mono text-white/70">{card.last_update.job_no}</span>
                <span className="text-white/30">·</span>
                <span className="truncate">{card.last_update.customer_name}</span>
                {card.last_update.status_to && (
                  <>
                    <span className="text-white/30">←</span>
                    <span className="text-white/70">
                      {STATUS_MAP[card.last_update.status_to]?.label ?? card.last_update.status_to}
                    </span>
                  </>
                )}
                <span className="mr-auto text-white/35">{relativeTimeAr(card.last_update.at)}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function Repairs() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  /* ── helper ── */
  async function apiFetch<T>(url: string): Promise<T> {
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  }

  /* ── Queries ── */
  /* Kept warm for cache-invalidation triggers in JobDetail/ChecklistWizard */
  useQuery<Stats>({
    queryKey: ["/api/repair-jobs/stats"],
    queryFn: () => apiFetch<Stats>(api("/api/repair-jobs/stats")),
    refetchInterval: 30000,
  });

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ["/api/repair-dashboard"],
    queryFn: () => apiFetch<DashboardData>(api("/api/repair-dashboard")),
    refetchInterval: 30000,
  });

  const { data: jobs = [], isLoading } = useQuery<RepairJob[]>({
    queryKey: ["/api/repair-jobs", statusFilter, search, techFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (techFilter) params.set("technician_id", techFilter);
      return apiFetch<RepairJob[]>(api(`/api/repair-jobs?${params}`));
    },
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: users = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/repair-jobs/technicians"],
    queryFn: () => apiFetch<{ id: number; name: string }[]>(api("/api/repair-jobs/technicians")),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: customers = [] } = useQuery<{ id: number; name: string; phone?: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiFetch<{ id: number; name: string; phone?: string }[]>(api("/api/customers")),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: branches = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/branches"],
    queryFn: () => apiFetch<{ id: number; name: string }[]>(api("/api/branches")),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  /* ── إحصاء أداء الفنيين — يُعرض في لوحة جانبية قابلة للطيّ ── */
  interface TechnicianStat {
    technician_id: number;
    technician_name: string;
    total_jobs: number;
    delivered: number;
    active_jobs: number;
    avg_duration_days: number | null;
  }
  const [showTechStats, setShowTechStats] = useState(false);
  const { data: techStats = [] } = useQuery<TechnicianStat[]>({
    queryKey: ["/api/repair-jobs/technician-stats"],
    queryFn: () => apiFetch<TechnicianStat[]>(api("/api/repair-jobs/technician-stats")),
    enabled: showTechStats, // لا تجلب إلّا عند فتح اللوحة
    refetchInterval: 60_000,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  /* ── Detail query when job is selected ── */
  const { data: jobDetail } = useQuery<RepairJob>({
    queryKey: ["/api/repair-jobs", selectedJob?.id],
    queryFn: () => apiFetch<RepairJob>(api(`/api/repair-jobs/${selectedJob!.id}`)),
    enabled: !!selectedJob?.id,
  });

  const detail = jobDetail ?? selectedJob;

  /* ── Configurable checklist items from server, filtered by the job's device_type ──
     Falls back to general items, then to DEFAULT_CHECKLIST. */
  const detailDeviceType = detail?.device_type || "general";
  const { data: checklistTemplate = [] } = useQuery<{ id: number; label_ar: string; sort_order: number; category: string }[]>({
    queryKey: ["/api/repair-checklist-items", detailDeviceType],
    queryFn: () => apiFetch<{ id: number; label_ar: string; sort_order: number; category: string }[]>(
      api(`/api/repair-checklist-items?device_type=${encodeURIComponent(detailDeviceType)}`)
    ),
    enabled: !!detail,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const templateChecklist: ChecklistItem[] = useMemo(() => {
    if (!checklistTemplate.length) return DEFAULT_CHECKLIST;
    return checklistTemplate.map((t) => ({
      id: String(t.id),
      label: t.label_ar,
      category: t.category ?? "عام",
      status: null,
    }));
  }, [checklistTemplate]);
  const parsedChecklist = useMemo(() => {
    try {
      const v = detail?.checklist ? JSON.parse(detail.checklist) : null;
      if (!Array.isArray(v)) return templateChecklist;
      // Power-off sentinel: return as-is without merging with template
      if (v.length === 1 && v[0].id === "__power_off__") {
        return [{ id: "__power_off__", label: "الجهاز لا يفتح ولا يشتغل", status: "fail" as const }];
      }
      // Use the saved checklist as the source of truth — show ONLY the items
      // that were actually inspected at intake (not the full current template),
      // so later edits to the template don't pollute existing job records.
      // Look up labels/categories from the template when the saved row is missing them.
      const templateMap: Record<string, ChecklistItem> = {};
      templateChecklist.forEach(t => { templateMap[t.id] = t; });
      const items: ChecklistItem[] = v
        .map((c: { id?: string | number; item_id?: string | number; label?: string; category?: string; status: string; notes?: string }) => {
          const id = String(c.id ?? c.item_id ?? "");
          if (!id) return null;
          const t = templateMap[id];
          // Migrate old "na" → "untestable"
          const status = c.status === "na" ? "untestable" : c.status as ChecklistItem["status"];
          return {
            id,
            label:    c.label    ?? t?.label    ?? `بند ${id}`,
            category: c.category ?? t?.category ?? "عام",
            status,
            notes:    c.notes,
          } as ChecklistItem;
        })
        .filter((x): x is ChecklistItem => x !== null);
      return items.length ? items : templateChecklist;
    } catch { return templateChecklist; }
  }, [detail?.checklist, templateChecklist]);
  const checklist: ChecklistItem[] = parsedChecklist;

  const score = useMemo(() => computeScore(checklist), [checklist]);

  /* ── Mutations ── */
  const patchJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      authFetch(api(`/api/repair-jobs/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs"] });
      /* نُبطل أيضاً query التفاصيل حتى يُعاد جلب كل الحقول (qa_notes, qa_checklist, …) */
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs", updated.id] });
      setSelectedJob(updated);
      toast({ title: "✅ تم الحفظ" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteJob = useMutation({
    mutationFn: (id: number) => authFetch(api(`/api/repair-jobs/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs/stats"] });
      setSelectedJob(null);
      toast({ title: "✅ تم الحذف" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Checklist update ── */
  const toggleCheck = (itemId: string, newStatus: ChecklistItem["status"], notes = "") => {
    if (!detail) return;
    const updated = checklist.map((c) =>
      c.id === itemId ? { ...c, status: newStatus, notes: notes || c.notes } : c
    );
    patchJob.mutate({ id: detail.id, data: { checklist: updated, device_score: computeScore(updated) } });
  };

  /* ── WhatsApp ── */
  const sendWhatsApp = (job: RepairJob, msg: string) => {
    if (!job.customer_phone) { toast({ title: "لا يوجد رقم هاتف", variant: "destructive" }); return; }
    const phone = job.customer_phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("0") ? "2" + phone : phone;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const whatsAppReady = (job: RepairJob) =>
    `✅ عزيزنا ${job.customer_name}،\nجهازك ${job.device_brand} ${job.device_model} جاهز للاستلام.\nبطاقة الصيانة: ${job.job_no}\nالتكلفة الإجمالية: ${formatCurrency(Number(job.final_cost ?? job.estimated_cost))}\n\nشكراً لثقتكم 🙏`;

  const whatsAppProgress = (job: RepairJob) =>
    `🔧 تحديث صيانة جهازك\nالموديل: ${job.device_brand} ${job.device_model}\nالرقم: ${job.job_no}\nالحالة: ${STATUS_MAP[job.status]?.label ?? job.status}\n\nللاستفسار تواصل معنا 📱`;

  return (
    <div className="flex h-full gap-0" dir="rtl">
      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — List
      ══════════════════════════════════════════════════════ */}
      <div className={`flex flex-col gap-3 p-4 overflow-y-auto transition-all ${selectedJob ? "hidden md:flex md:w-[340px] shrink-0" : "flex flex-1"}`}
        style={{ borderLeft: selectedJob ? "1px solid rgba(255,255,255,0.06)" : undefined }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-violet-400" />
            بطاقات الصيانة
          </h1>
          <div className="flex items-center gap-1.5">
            {/* View toggle — only when no job selected */}
            {!selectedJob && (
              <div className="flex gap-0.5 bg-white/4 rounded-xl border border-white/8 p-0.5">
                <button onClick={() => setViewMode("list")}
                  title="عرض قائمة"
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-violet-500/25 text-violet-300" : "text-white/30 hover:text-white/60"}`}>
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewMode("grid")}
                  title="عرض شبكة"
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-violet-500/25 text-violet-300" : "text-white/30 hover:text-white/60"}`}>
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              title="إعدادات بنود الفحص"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 text-xs transition-all">
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setShowNewForm(true); setSelectedJob(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-bold transition-all">
              <Plus className="w-3.5 h-3.5" /> بطاقة جديدة
            </button>
          </div>
        </div>
        {/* Settings modal */}
        {showSettings && <RepairSettingsModal onClose={() => setShowSettings(false)} />}

        {/* Customizable dashboard cards (admin-tunable) */}
        <DashboardCardsSection
          dashboard={dashboard}
          activeStatusFilter={statusFilter}
          onCardClick={(card) => {
            /* Toggle: clicking the same card again clears the filter */
            const next = card.statuses.join(",");
            setStatusFilter(prev => (prev === next ? "all" : next));
          }}
          onStatusClick={(s) => setStatusFilter(prev => (prev === s ? "all" : s))}
        />

        {/* Search row — two equal columns */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="رقم / اسم / هاتف / IMEI..."
              className="erp-input w-full pr-8 text-sm" />
          </div>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="erp-input text-sm w-full">
            <option value="">— كل الفنيين —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Technician performance — collapsible panel, shown only when no job selected */}
        {!selectedJob && (
          <div className="rounded-2xl border border-[var(--erp-border)] bg-white/[0.025] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechStats((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-right hover:bg-white/3 transition-all"
            >
              <span className="text-[11px] text-cyan-300/85 font-bold flex items-center gap-1.5">
                📊 أداء الفنيين
                {showTechStats && techStats.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/12 border border-cyan-500/25 text-cyan-300/80 font-medium tabular-nums">
                    {techStats.length}
                  </span>
                )}
              </span>
              <ChevronRight
                className={`w-4 h-4 erp-label transition-transform duration-200 ${showTechStats ? "-rotate-90" : "rotate-90"}`}
              />
            </button>
            {showTechStats && (
              <div className="border-t border-[var(--erp-border)] px-3 py-2">
                {techStats.length === 0 ? (
                  <p className="text-center text-[11px] erp-label py-4">لا توجد بيانات أداء حالياً</p>
                ) : (
                  <div className="space-y-1">
                    {/* رأس الأعمدة */}
                    <div className="grid grid-cols-12 gap-2 text-[9px] erp-label font-bold uppercase tracking-wider px-2 pb-1 border-b border-[var(--erp-border)]">
                      <div className="col-span-5">الفني</div>
                      <div className="col-span-2 text-center">المُسنَدة</div>
                      <div className="col-span-2 text-center">المُسلَّمة</div>
                      <div className="col-span-3 text-end">متوسط المدة</div>
                    </div>
                    {techStats.map((t) => (
                      <div
                        key={t.technician_id}
                        className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg text-xs bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                      >
                        <div className="col-span-5 truncate erp-text font-medium" title={t.technician_name}>
                          {t.technician_name}
                        </div>
                        <div className="col-span-2 text-center tabular-nums text-white/85 font-bold">
                          {t.total_jobs}
                        </div>
                        <div className="col-span-2 text-center tabular-nums text-emerald-300/85">
                          {t.delivered}
                        </div>
                        <div className="col-span-3 text-end tabular-nums text-cyan-300/80">
                          {t.avg_duration_days != null ? `${t.avg_duration_days} يوم` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status Filters — generated from dashboard cards so they match the cards above */}
        <div className="flex gap-1 flex-wrap">
          {/* "All" chip — always first */}
          <button
            onClick={() => setStatusFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-150 ${
              statusFilter === "all"
                ? "bg-white/10 border-white/20 text-white shadow-sm"
                : "border-white/6 text-white/35 hover:text-white/60 hover:border-white/12"
            }`}
          >
            الكل
            {dashboard?.total_all != null && (
              <span className="text-[10px] font-mono opacity-60">{dashboard.total_all}</span>
            )}
          </button>

          {/* One chip per dashboard card — matches the cards displayed above */}
          {(Array.isArray(dashboard?.cards) ? dashboard!.cards : []).map((card) => {
            const Icon  = CARD_ICON_REGISTRY[card.icon] ?? Wrench;
            const value = (Array.isArray(card.statuses) ? card.statuses : []).join(",");
            const isActive = statusFilter === value;
            return (
              <button
                key={card.id}
                onClick={() => setStatusFilter(prev => (prev === value ? "all" : value))}
                title={card.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-150"
                style={{
                  background:  isActive ? `${card.color}26` : "transparent",
                  borderColor: isActive ? `${card.color}88` : `${card.color}33`,
                  color:       isActive ? "#fff" : `${card.color}cc`,
                  boxShadow:   isActive ? `0 0 0 1px ${card.color}55` : undefined,
                }}
              >
                <Icon className="w-3 h-3 shrink-0" style={{ color: card.color }} />
                <span className="truncate max-w-[120px]">{card.name}</span>
                <span className="text-[10px] font-mono opacity-70">{card.count}</span>
              </button>
            );
          })}
        </div>

        {/* Job List / Grid */}
        {isLoading && <div className="text-center text-white/30 text-sm py-8">جاري التحميل...</div>}
        {!isLoading && jobs.length === 0 && (
          <div className="text-center text-white/30 text-sm py-8 flex flex-col items-center gap-2">
            <Wrench className="w-8 h-8 opacity-20" />
            لا توجد بطاقات صيانة
          </div>
        )}

        {/* LIST VIEW — compact card when a job is selected (narrow panel) */}
        {!isLoading && jobs.length > 0 && viewMode === "list" && selectedJob && (
          <div className="flex flex-col gap-1">
            {jobs.map((job) => {
              const isActive = selectedJob?.id === job.id;
              const s = STATUS_MAP[job.status] ?? { label: job.status, color: "text-white/50", bg: "", icon: AlertCircle };
              const barColor = STATUS_BAR_COLOR[job.status] ?? "bg-white/10";
              return (
                <div key={job.id} onClick={() => { setSelectedJob(job); setShowNewForm(false); }}
                  className={`relative rounded-2xl border cursor-pointer transition-all duration-150 overflow-hidden group ${
                    isActive
                      ? `${STATUS_BORDER[job.status] ?? "border-violet-500/40"} bg-white/5 shadow-lg`
                      : "border-white/6 hover:border-white/15 hover:bg-white/3"
                  }`}>
                  <div className={`absolute top-0 right-0 bottom-0 w-[3px] ${barColor}`} />
                  <div className="pr-3 pl-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border leading-none ${s.color} ${s.bg}`}>{s.label}</span>
                          <span className="text-[9px] text-white/20 font-mono">{job.job_no}</span>
                        </div>
                        <p className="font-black text-white text-[13px] leading-tight truncate">{job.customer_name}</p>
                        <p className="text-white/40 text-[11px] mt-0.5 truncate">{job.device_brand} {job.device_model}</p>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-sm font-black text-white">{formatCurrency(Number(job.final_cost ?? job.estimated_cost))}</p>
                        {job.device_score != null && (
                          <p className={`text-[10px] font-bold text-right ${job.device_score >= 80 ? "text-emerald-400" : job.device_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {job.device_score}%
                          </p>
                        )}
                      </div>
                    </div>
                    {job.technician_name && (
                      <p className="text-[9px] text-white/25 mt-1 truncate">{job.technician_name} · {job.received_at}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW — full table when no job selected (wide layout) */}
        {!isLoading && jobs.length > 0 && viewMode === "list" && !selectedJob && (
          <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(255,255,255,0.025)" }}>
            <div className="overflow-x-auto">
              <table dir="rtl" className="w-full text-right">
                <thead>
                  <tr className="border-b border-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {["رقم الطلب","التاريخ","الحالة","العميل","الهاتف","الجهاز","العطل","الفني","التكلفة"].map(h => (
                      <th key={h} className="px-3 py-3 text-[10px] font-bold text-white/35 whitespace-nowrap tracking-wider uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {jobs.map((job) => {
                    const barColor = STATUS_BAR_COLOR[job.status] ?? "bg-white/10";
                    return (
                      <tr key={job.id}
                        onClick={() => { setSelectedJob(job); setShowNewForm(false); }}
                        className="cursor-pointer transition-all duration-100 hover:bg-white/4 group">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-0.5 h-5 rounded-full ${barColor}`} />
                            <span className="text-[11px] font-mono text-white/50 group-hover:text-white/80 transition-colors">{job.job_no}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-white/30 whitespace-nowrap">{job.received_at}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={job.status} /></td>
                        <td className="px-3 py-3 max-w-[160px]">
                          <p className="text-[13px] font-black text-white truncate group-hover:text-white transition-colors">{job.customer_name}</p>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-white/40 font-mono whitespace-nowrap">{job.customer_phone || "—"}</td>
                        <td className="px-3 py-3 max-w-[150px]">
                          <p className="text-[11px] text-white/60 truncate">{[job.device_brand, job.device_model].filter(Boolean).join(" ") || "—"}</p>
                        </td>
                        <td className="px-3 py-3 max-w-[180px]">
                          <p className="text-[11px] text-white/35 truncate italic">{job.problem_description || "—"}</p>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-white/45 whitespace-nowrap truncate max-w-[120px]">{job.technician_name || "—"}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-[13px] font-black text-white">{formatCurrency(Number(job.final_cost ?? job.estimated_cost))}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GRID VIEW — 3-4 cols, premium cards */}
        {!isLoading && jobs.length > 0 && viewMode === "grid" && !selectedJob && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {jobs.map((job) => {
              const s = STATUS_MAP[job.status] ?? { label: job.status, color: "text-white/60", bg: "bg-white/5 border-white/10", icon: AlertCircle };
              const StatusIcon = s.icon;
              const barColor = STATUS_BAR_COLOR[job.status] ?? "bg-white/10";
              const borderColor = STATUS_BORDER[job.status] ?? "border-white/8";
              const cost = Number(job.final_cost ?? job.estimated_cost);
              return (
                <div key={job.id}
                  onClick={() => { setSelectedJob(job); setShowNewForm(false); }}
                  className={`relative rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden flex flex-col group hover:-translate-y-0.5 hover:shadow-xl ${borderColor}`}
                  style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)" }}>

                  {/* Top gradient accent */}
                  <div className={`h-[3px] w-full ${barColor}`} />

                  <div className="p-3 flex flex-col gap-2 flex-1">
                    {/* Status + score row */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border text-[9px] font-bold leading-none ${s.color} ${s.bg}`}>
                        <StatusIcon className="w-2 h-2" />
                        {s.label}
                      </span>
                      {job.device_score != null && (
                        <span className={`text-[10px] font-black tabular-nums ${job.device_score >= 80 ? "text-emerald-400" : job.device_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {job.device_score}%
                        </span>
                      )}
                    </div>

                    {/* Customer — hero text */}
                    <div>
                      <p className="font-black text-white text-sm leading-tight truncate group-hover:text-white transition-colors">{job.customer_name}</p>
                      <p className="text-[10px] text-white/40 truncate mt-0.5">{[job.device_brand, job.device_model].filter(Boolean).join(" ") || "—"}</p>
                    </div>

                    {/* Problem */}
                    {job.problem_description && (
                      <p className="text-[10px] text-white/30 truncate italic leading-tight" title={job.problem_description}>{job.problem_description}</p>
                    )}

                    <div className="flex-1" />

                    {/* Footer */}
                    <div className="pt-2 border-t border-white/6 flex items-end justify-between gap-1">
                      <div>
                        <p className="text-base font-black text-white leading-none tabular-nums">{formatCurrency(cost)}</p>
                        {job.technician_name && (
                          <p className="text-[9px] text-white/25 mt-1 truncate max-w-[100px]">{job.technician_name}</p>
                        )}
                      </div>
                      <p className="text-[9px] text-white/20 font-mono shrink-0">{job.received_at?.slice(5)}</p>
                    </div>

                    {/* Job number — watermark style */}
                    <p className="text-[9px] text-white/15 font-mono leading-none tracking-wider">{job.job_no}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — Detail / New Form
      ══════════════════════════════════════════════════════ */}
      {(selectedJob || showNewForm) && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedJob
            ? <JobDetail
                job={detail!}
                checklist={checklist}
                score={score}
                users={users}
                onClose={() => setSelectedJob(null)}
                onPatch={(data) => patchJob.mutate({ id: detail!.id, data })}
                onDelete={() => deleteJob.mutate(detail!.id)}
                onSaveCheckItem={toggleCheck}
                onWhatsApp={sendWhatsApp}
                whatsAppReady={whatsAppReady}
                whatsAppProgress={whatsAppProgress}
              />
            : <NewJobForm
                customers={customers}
                users={users}
                branches={branches}
                onClose={() => setShowNewForm(false)}
                onCreated={(job) => {
                  qc.invalidateQueries({ queryKey: ["/api/repair-jobs"] });
                  qc.invalidateQueries({ queryKey: ["/api/repair-jobs/stats"] });
                  setShowNewForm(false);
                  setSelectedJob(job);
                  toast({ title: `✅ تم إنشاء بطاقة ${job.job_no}` });
                }}
              />
          }
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CHECKLIST WIZARD — one item at a time
══════════════════════════════════════════════════════════════ */
function ChecklistWizard({
  checklist,
  onSaveItem,
}: {
  checklist: ChecklistItem[];
  onSaveItem: (id: string, status: ChecklistItem["status"], notes: string) => void;
}) {
  const total = checklist.length;
  const doneCount = checklist.filter((c) => c.status).length;

  const [wizardIdx, setWizardIdx] = useState<number>(() => {
    const first = checklist.findIndex((c) => !c.status);
    return first === -1 ? total : first;
  });
  const [awaitingNotes, setAwaitingNotes] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ChecklistItem["status"]>(null);
  const [pendingNotes, setPendingNotes] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  const allDone = wizardIdx >= total;
  const currentItem = allDone ? null : checklist[wizardIdx];

  const advance = (fromIdx: number) => {
    const next = checklist.findIndex((c, i) => i > fromIdx && !c.status);
    setWizardIdx(next === -1 ? total : next);
  };

  const handleStatus = (status: ChecklistItem["status"]) => {
    if (!currentItem) return;
    if (status === "partial" || status === "untestable") {
      setPendingStatus(status);
      setAwaitingNotes(true);
      setPendingNotes("");
    } else {
      onSaveItem(currentItem.id, status, "");
      advance(wizardIdx);
    }
  };

  const handleSaveWithNotes = () => {
    if (!currentItem || !pendingStatus) return;
    onSaveItem(currentItem.id, pendingStatus, pendingNotes);
    setAwaitingNotes(false);
    setPendingStatus(null);
    setPendingNotes("");
    advance(wizardIdx);
  };

  const statusBadge = (s: ChecklistItem["status"]) => {
    switch (s) {
      case "pass":        return { label: "يعمل",             cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
      case "fail":        return { label: "لا يعمل",          cls: "text-red-400 bg-red-500/10 border-red-500/20" };
      case "partial":     return { label: "يعمل جزئياً",       cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      case "untestable":  return { label: "لا يمكن تجربته",   cls: "text-white/50 bg-white/5 border-white/10" };
      default:            return { label: "—",                cls: "text-white/20" };
    }
  };

  /* ── Power-off sentinel ── */
  const isPoweredOff = checklist.length === 1 && checklist[0].id === "__power_off__";
  if (isPoweredOff) {
    return (
      <div className="glass-panel rounded-2xl p-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
        <XCircle className="w-7 h-7 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-300">الجهاز لا يفتح</p>
          <p className="text-[11px] text-red-400/60 mt-0.5">تم تسجيل الطلب بدون فحص — الجهاز لا يشتغل</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-3 border border-white/5">
      {/* Header + progress */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
          <ClipboardList className="w-3 h-3" /> فحص الجهاز
        </p>
        <span className="text-[10px] text-white/30">{doneCount} / {total}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1 mb-4">
        <div className="h-1 rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} />
      </div>

      {allDone ? (
        /* ── Completion ── */
        <div className="text-center py-3 space-y-2">
          <div className="text-3xl">✅</div>
          <p className="text-sm font-bold text-emerald-400">اكتمل الفحص</p>
          <p className="text-[11px] text-white/40">جميع بنود التشخيص مسجلة</p>
          <button
            onClick={() => { setWizardIdx(0); setAwaitingNotes(false); }}
            className="flex items-center gap-1 mx-auto text-[11px] text-white/40 hover:text-white/60 border border-white/10 rounded-lg px-3 py-1.5 transition-all">
            <RotateCcw className="w-3 h-3" /> إعادة المراجعة
          </button>
        </div>
      ) : currentItem ? (
        /* ── Active wizard ── */
        <div className="space-y-3">
          {/* Current item card */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <p className="text-white font-bold text-base">{currentItem.label}</p>
            <p className="text-[10px] text-white/30 mt-1">البند {wizardIdx + 1} من {total}</p>
          </div>

          {awaitingNotes ? (
            /* Notes input */
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-amber-400/80">
                  {pendingStatus === "partial" ? "يعمل جزئياً — أضف ملاحظة (اختياري):" : "لا يمكن تجربته — أضف سبباً (اختياري):"}
                </p>
              </div>
              <textarea
                value={pendingNotes}
                onChange={(e) => setPendingNotes(e.target.value)}
                rows={2}
                placeholder="ملاحظة اختيارية..."
                className="erp-input w-full text-xs resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveWithNotes}
                  className="flex-1 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold hover:bg-violet-500/30 transition-all flex items-center justify-center gap-1">
                  حفظ والتالي <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setAwaitingNotes(false)}
                  className="px-3 py-2 rounded-xl border border-white/10 text-white/40 text-xs hover:text-white/60 transition-all">
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            /* 4 action buttons */
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleStatus("pass")}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all">
                <CheckCircle2 className="w-6 h-6" />
                <span className="text-xs font-bold">يعمل</span>
              </button>
              <button onClick={() => handleStatus("fail")}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all">
                <XCircle className="w-6 h-6" />
                <span className="text-xs font-bold">لا يعمل</span>
              </button>
              <button onClick={() => handleStatus("partial")}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all">
                <AlertCircle className="w-6 h-6" />
                <span className="text-xs font-bold">لا يعمل بشكل جيد</span>
              </button>
              <button onClick={() => handleStatus("untestable")}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/8 hover:text-white/60 active:scale-95 transition-all">
                <MinusCircle className="w-6 h-6" />
                <span className="text-xs font-bold">لا يمكن تجربته</span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Summary of answered items — collapsible */}
      {doneCount > 0 && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <button
            onClick={() => setSummaryOpen(v => !v)}
            className="w-full flex items-center justify-between px-1 py-1 rounded-lg hover:bg-white/3 transition-all"
          >
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-3 h-3 text-white/25 transition-transform duration-200 ${summaryOpen ? "rotate-90" : ""}`} />
              <span className="text-[10px] text-white/30 font-semibold">النتائج المسجلة — اضغط لتعديل</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px]">
              {checklist.filter(c => c.status === "pass").length > 0 && (
                <span className="text-emerald-400 font-bold">{checklist.filter(c => c.status === "pass").length}✓</span>
              )}
              {checklist.filter(c => c.status === "fail").length > 0 && (
                <span className="text-red-400 font-bold">{checklist.filter(c => c.status === "fail").length}✗</span>
              )}
              {checklist.filter(c => c.status === "partial").length > 0 && (
                <span className="text-amber-400 font-bold">{checklist.filter(c => c.status === "partial").length}~</span>
              )}
            </div>
          </button>
          {summaryOpen && (
            <div className="mt-1 space-y-0.5">
              {checklist.filter((c) => c.status).map((item) => {
                const { label, cls } = statusBadge(item.status);
                const realIdx = checklist.indexOf(item);
                return (
                  <button key={item.id}
                    onClick={() => { setWizardIdx(realIdx); setAwaitingNotes(false); setSummaryOpen(false); }}
                    className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/3 transition-all text-right">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-white/25 w-4 shrink-0 text-center">{realIdx + 1}</span>
                      <span className="text-xs text-white/60 truncate">{item.label}</span>
                      {item.notes && <span className="text-[10px] text-white/30 truncate max-w-[80px]">({item.notes})</span>}
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 mr-2 ${cls}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   JOB CHECKLIST — inline editable (used in JobDetail)
══════════════════════════════════════════════════════════════ */
function JobChecklist({
  checklist,
  onSaveItem,
  readOnly = false,
}: {
  checklist: ChecklistItem[];
  onSaveItem: (id: string, status: ChecklistItem["status"], notes: string) => void;
  readOnly?: boolean;
}) {
  const [editingNotes, setEditingNotes]   = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ChecklistItem["status"]>(null);
  const [notesText, setNotesText]         = useState("");
  const [expandedCats, setExpandedCats]   = useState<Set<string>>(new Set());

  /* Group items by category — must be before any early return */
  const categoryMap = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of checklist) {
      const cat = item.category ?? "عام";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [checklist]);

  /* Power-off sentinel */
  if (checklist.length === 1 && checklist[0].id === "__power_off__") {
    return (
      <div className="glass-panel rounded-2xl p-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
        <XCircle className="w-7 h-7 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-300">الجهاز لا يفتح</p>
          <p className="text-[11px] text-red-400/60 mt-0.5">تم تسجيل الطلب بدون فحص — الجهاز لا يشتغل</p>
        </div>
      </div>
    );
  }

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  const pass       = checklist.filter(c => c.status === "pass").length;
  const fail       = checklist.filter(c => c.status === "fail").length;
  const partial    = checklist.filter(c => c.status === "partial").length;
  const unanswered = checklist.filter(c => !c.status).length;
  const total      = checklist.length;
  const doneCount  = total - unanswered;

  const STATUS_OPTS: { key: ChecklistItem["status"]; label: string; cls: string; activeCls: string }[] = [
    { key: "pass",       label: "✓", cls: "border-white/10 text-white/30 hover:border-emerald-500/40 hover:text-emerald-400", activeCls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
    { key: "fail",       label: "✗", cls: "border-white/10 text-white/30 hover:border-red-500/40 hover:text-red-400",          activeCls: "border-red-500/50 bg-red-500/15 text-red-300" },
    { key: "partial",    label: "~", cls: "border-white/10 text-white/30 hover:border-amber-500/40 hover:text-amber-400",      activeCls: "border-amber-500/50 bg-amber-500/15 text-amber-300" },
    { key: "untestable", label: "—", cls: "border-white/10 text-white/20 hover:border-white/20 hover:text-white/50",           activeCls: "border-white/20 bg-white/5 text-white/50" },
  ];

  const handleClick = (item: ChecklistItem, key: ChecklistItem["status"]) => {
    if (readOnly) return;
    if (key === "partial" || key === "untestable") {
      setEditingNotes(item.id);
      setPendingStatus(key);
      setNotesText(item.notes ?? "");
    } else {
      onSaveItem(item.id, key, "");
      if (editingNotes === item.id) setEditingNotes(null);
    }
  };

  const confirmNotes = (itemId: string) => {
    onSaveItem(itemId, pendingStatus, notesText);
    setEditingNotes(null);
    setPendingStatus(null);
    setNotesText("");
  };

  const statusLabel = (s: ChecklistItem["status"]) =>
    s === "pass" ? "يعمل" : s === "fail" ? "لا يعمل" : s === "partial" ? "جزئي" : "—";

  const statusBadgeCls = (s: ChecklistItem["status"]) =>
    s === "pass"       ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    s === "fail"       ? "text-red-400 bg-red-500/10 border-red-500/20" :
    s === "partial"    ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    s === "untestable" ? "text-white/30 bg-white/5 border-white/10" : "";

  return (
    <div className="glass-panel rounded-2xl p-3 border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-white/40 font-bold flex items-center gap-1.5">
          <ClipboardList className="w-3 h-3" /> فحص الجهاز
          {readOnly && <span className="text-[9px] text-white/25 border border-white/10 rounded px-1 py-0.5">مقفل</span>}
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          {pass > 0       && <span className="text-emerald-400">{pass} يعمل</span>}
          {fail > 0       && <span className="text-red-400">{fail} لا يعمل</span>}
          {partial > 0    && <span className="text-amber-400">{partial} جزئي</span>}
          {unanswered > 0 && <span className="text-white/30">{unanswered} لم يُفحص</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1 mb-3">
        <div className="h-1 rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} />
      </div>

      {/* Categories accordion */}
      <div className="space-y-1">
        {Array.from(categoryMap.entries()).map(([cat, items]) => {
          const isOpen     = expandedCats.has(cat);
          const catPass    = items.filter(i => i.status === "pass").length;
          const catFail    = items.filter(i => i.status === "fail").length;
          const catPartial = items.filter(i => i.status === "partial").length;
          const catPending = items.filter(i => !i.status).length;

          return (
            <div key={cat} className="rounded-xl border border-white/6 overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/4 transition-all text-right">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-3 h-3 text-white/35 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                  <span className="text-[11px] text-white/65 font-bold">{cat}</span>
                  <span className="text-[9px] text-white/25">({items.length})</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px]">
                  {catPass    > 0 && <span className="text-emerald-400 font-bold">{catPass}✓</span>}
                  {catFail    > 0 && <span className="text-red-400 font-bold">{catFail}✗</span>}
                  {catPartial > 0 && <span className="text-amber-400 font-bold">{catPartial}~</span>}
                  {catPending > 0 && <span className="text-white/25">{catPending}؟</span>}
                </div>
              </button>

              {/* Items — shown when expanded */}
              {isOpen && (
                <div className="border-t border-white/5 divide-y divide-white/4">
                  {items.map((item) => (
                    <div key={item.id} className={`px-3 ${!readOnly ? "hover:bg-white/3" : ""} transition-all group`}>
                      <div className="flex items-center gap-2 py-1.5">
                        {/* Status dot */}
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          item.status === "pass"       ? "bg-emerald-400" :
                          item.status === "fail"       ? "bg-red-400" :
                          item.status === "partial"    ? "bg-amber-400" :
                          item.status === "untestable" ? "bg-white/20" : "bg-white/8"
                        }`} />
                        {/* Label */}
                        <span className={`flex-1 text-xs ${item.status ? "text-white/70" : "text-white/45"}`}>
                          {item.label}
                        </span>
                        {/* Result badge (always visible) */}
                        {item.status && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${statusBadgeCls(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        )}
                        {/* Edit buttons — only when not readOnly */}
                        {!readOnly && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {STATUS_OPTS.map(({ key, label, cls, activeCls }) => (
                              <button
                                key={key}
                                onClick={() => handleClick(item, key)}
                                className={`w-6 h-6 rounded-md border text-[11px] font-bold transition-all ${
                                  item.status === key ? activeCls : cls
                                }`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Notes editing */}
                      {!readOnly && editingNotes === item.id && (
                        <div className="flex gap-2 mb-2 px-4">
                          <input
                            autoFocus
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmNotes(item.id);
                              if (e.key === "Escape") { setEditingNotes(null); setPendingStatus(null); }
                            }}
                            placeholder="ملاحظة (اختياري)..."
                            className="erp-input flex-1 text-xs py-0.5"
                          />
                          <button onClick={() => confirmNotes(item.id)} className="text-emerald-400 p-1 hover:text-emerald-300">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Existing notes */}
                      {item.notes && (!editingNotes || editingNotes !== item.id) && (
                        <p className="text-[10px] text-white/30 px-5 pb-1.5 italic">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {unanswered === 0 && (
        <p className="text-center text-[10px] text-emerald-400/60 mt-3">✓ اكتمل الفحص</p>
      )}
    </div>
  );
}
/* ══════════════════════════════════════════════════════════════
   JOB DETAIL PANEL
══════════════════════════════════════════════════════════════ */
function JobDetail({
  job, checklist, score, users,
  onClose, onPatch, onDelete, onSaveCheckItem,
  onWhatsApp, whatsAppReady, whatsAppProgress,
}: {
  job: RepairJob;
  checklist: ChecklistItem[];
  score: number;
  users: { id: number; name: string }[];
  onClose: () => void;
  onPatch: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onSaveCheckItem: (id: string, status: ChecklistItem["status"], notes: string) => void;
  onWhatsApp: (job: RepairJob, msg: string) => void;
  whatsAppReady: (job: RepairJob) => string;
  whatsAppProgress: (job: RepairJob) => string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editEst, setEditEst]       = useState(job.estimated_cost ?? "0");
  const [editFinal, setEditFinal]   = useState(job.final_cost ?? "0");
  const [editDeposit] = useState(job.deposit_paid ?? "0");
  const [editDelivery, setEditDelivery] = useState(job.estimated_delivery ?? "");
  const [editTech, setEditTech]     = useState(job.technician_id?.toString() ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportOpen, setReportOpen]       = useState(true);
  const [historyOpen, setHistoryOpen]     = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [financeOpen, setFinanceOpen]     = useState(true);
  const [newReportText, setNewReportText] = useState("");
  const [addingReport, setAddingReport]   = useState(false);

  /* ── Payments ─────────────────────────────────────────────── */
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payAmount, setPayAmount]   = useState("");
  const [payMethod, setPayMethod]   = useState("cash");
  const [payNotes, setPayNotes]     = useState("");
  const [paySafeId, setPaySafeId]   = useState("");

  const paymentsQ = useQuery<RepairPayment[]>({
    queryKey: [`/api/repair-jobs/${job.id}/payments`],
    queryFn:  () => authFetch(api(`/api/repair-jobs/${job.id}/payments`)).then(r => r.json()),
  });
  const payments = Array.isArray(paymentsQ.data) ? paymentsQ.data : [];
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const finalCostNum = Number(editFinal || editEst || 0);
  const remaining = Math.max(0, finalCostNum - totalPaid);

  const safesQ = useQuery<{id:number;name:string;balance:string}[]>({
    queryKey: ["/api/settings/safes"],
    queryFn:  () => authFetch(api("/api/settings/safes")).then(r => r.json()),
  });
  const safesList = Array.isArray(safesQ.data) ? safesQ.data : [];

  const addPayment = useMutation({
    mutationFn: () => authFetch(api(`/api/repair-jobs/${job.id}/payments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmount), payment_method: payMethod, notes: payNotes, safe_id: paySafeId || undefined }),
    }).then(async r => { if (!r.ok) { const e = await r.json(); throw new Error(e.error); } return r.json(); }),
    onSuccess: () => {
      toast({ title: "✓ تم تسجيل الدفعة" });
      setShowAddPayment(false); setPayAmount(""); setPayNotes("");
      qc.invalidateQueries({ queryKey: [`/api/repair-jobs/${job.id}/payments`] });
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs", job.id] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePayment = useMutation({
    mutationFn: (pid: number) => authFetch(api(`/api/repair-jobs/${job.id}/payments/${pid}`), { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "✓ تم حذف الدفعة" });
      qc.invalidateQueries({ queryKey: [`/api/repair-jobs/${job.id}/payments`] });
    },
  });

  /* engineer reports = filter from history with event_type="engineer_report" */
  const _safeHistory   = Array.isArray(job.history) ? job.history : [];
  const engineerReports = _safeHistory.filter(h => h.event_type === "engineer_report");
  const otherHistory    = _safeHistory.filter(h => h.event_type !== "engineer_report");

  const refreshJob = () => qc.invalidateQueries({ queryKey: ["/api/repair-jobs", job.id] });

  const addReport = async () => {
    const note = newReportText.trim();
    if (!note) return;
    const r = await authFetch(api(`/api/repair-jobs/${job.id}/engineer-reports`), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (!r.ok) { toast({ title: "خطأ في حفظ التقرير", variant: "destructive" }); return; }
    setNewReportText(""); setAddingReport(false);
    toast({ title: "✓ تم حفظ التقرير" });
    refreshJob();
  };

  const deleteReport = async (rid: number) => {
    const r = await authFetch(api(`/api/repair-jobs/${job.id}/engineer-reports/${rid}`), { method: "DELETE" });
    if (!r.ok) { toast({ title: "خطأ في الحذف", variant: "destructive" }); return; }
    refreshJob();
  };

  const handleSave = () => {
    /* normalize empty/blank numbers → "0" so backend never sees "" */
    const num = (v: string) => v.trim() === "" ? "0" : v.trim();
    onPatch({
      estimated_cost: num(editEst),
      final_cost: num(editFinal),
      deposit_paid: num(editDeposit),
      estimated_delivery: editDelivery || null,
      technician_id: editTech ? Number(editTech) : null,
      technician_name: users.find((u) => u.id.toString() === editTech)?.name ?? null,
    });
  };

  /* ── Print QR ticket for THIS job — customer scans to track ───── */
  const printJobQR = () => {
    /* SEC: escape HTML entities to prevent XSS in print window */
    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

    /* Read saved baseUrl from localStorage (set in RepairSettingsModal QR tab) */
    let baseUrl = "";
    try {
      const saved = JSON.parse(localStorage.getItem("repair_qr_settings") ?? "{}") as { baseUrl?: string };
      baseUrl = saved.baseUrl ?? "";
    } catch { /* ignore */ }
    const effectiveBase = baseUrl || `${window.location.origin}/track`;
    const trackingUrl   = `${effectiveBase}/${job.company_id}/${encodeURIComponent(job.job_no)}`;

    const svg = document.getElementById(`qr-job-${job.id}`)?.querySelector("svg");
    if (!svg) { toast({ title: "تعذر تحميل الرمز", variant: "destructive" }); return; }
    const svgStr = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) { toast({ title: "السماح بالنوافذ مطلوب للطباعة", variant: "destructive" }); return; }
    win.document.write(`<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>QR — ${escHtml(job.job_no)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", "Tahoma", sans-serif; background: #fff; color: #111;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .ticket { border: 2px dashed #999; border-radius: 16px; padding: 24px 28px; text-align: center; width: 320px; }
  .brand { font-size: 11px; color: #888; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 14px; }
  .title { font-size: 17px; font-weight: 800; margin-bottom: 4px; color: #111; }
  .sub { font-size: 12px; color: #555; margin-bottom: 18px; }
  .qr-box { background: #fff; padding: 8px; border: 1px solid #eee; border-radius: 12px; display: inline-block; margin-bottom: 18px; }
  .qr-box svg { display: block; width: 200px; height: 200px; }
  .job-no { font-family: ui-monospace, "SF Mono", monospace; font-size: 16px; font-weight: 700;
    background: #f3f4f6; padding: 8px 18px; border-radius: 999px; display: inline-block; margin-bottom: 14px; }
  .info { text-align: right; font-size: 12px; color: #333; line-height: 1.8; padding: 12px 16px;
    background: #fafafa; border-radius: 10px; margin-bottom: 12px; }
  .info b { color: #111; font-weight: 700; display: inline-block; min-width: 70px; }
  .url { font-family: ui-monospace, monospace; font-size: 9px; color: #888; word-break: break-all; padding: 0 6px; }
  .footer { margin-top: 14px; font-size: 11px; color: #666; line-height: 1.6; border-top: 1px solid #eee; padding-top: 12px; }
  @media print {
    .ticket { border: 1px solid #000; }
    @page { size: A6; margin: 0; }
  }
</style>
</head>
<body>
  <div class="ticket">
    <div class="brand">MUHKAM ERP — صيانة</div>
    <div class="title">إيصال متابعة الصيانة</div>
    <div class="sub">صوّر الرمز لمتابعة حالة جهازك</div>
    <div class="qr-box">${svgStr}</div>
    <div class="job-no">${escHtml(job.job_no)}</div>
    <div class="info">
      <div><b>العميل:</b> ${escHtml(job.customer_name ?? "")}</div>
      <div><b>الجهاز:</b> ${escHtml(`${job.device_brand ?? ""} ${job.device_model ?? ""}`.trim())}</div>
      ${job.problem_description ? `<div><b>العطل:</b> ${escHtml(job.problem_description)}</div>` : ""}
    </div>
    <div class="url">${escHtml(trackingUrl)}</div>
    <div class="footer">شكراً لاختياركم خدمتنا<br/>سيتم تحديثكم بكل مرحلة من الإصلاح</div>
  </div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 250); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`);
    win.document.close();
  };

  /* compose tracking URL for the hidden QR SVG */
  const jobTrackingUrl = (() => {
    let baseUrl = "";
    try {
      const saved = JSON.parse(localStorage.getItem("repair_qr_settings") ?? "{}") as { baseUrl?: string };
      baseUrl = saved.baseUrl ?? "";
    } catch { /* ignore */ }
    return `${baseUrl || `${window.location.origin}/track`}/${job.company_id}/${encodeURIComponent(job.job_no)}`;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-[var(--erp-border)]" style={{ background: "rgba(255,255,255,0.02)" }}>
        {/* Row 1: back + device + actions */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-xl border border-[var(--erp-border)] flex items-center justify-center erp-label hover:text-white hover:border-white/25 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="min-w-0">
              <p className="font-black text-white text-[15px] leading-tight truncate">
                {job.device_brand} {job.device_model}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/25 font-mono">{job.job_no}</span>
                <span className="text-white/15 text-[10px]">·</span>
                <span className="text-[10px] erp-label">{job.customer_name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={printJobQR}
              title="طباعة إيصال QR لمتابعة العميل"
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-violet-500/25 text-violet-300 text-[10px] font-bold hover:bg-violet-500/10 transition-all">
              <Printer className="w-3 h-3" /> طباعة QR
            </button>
            <button onClick={() => onWhatsApp(job, whatsAppProgress(job))}
              title="تحديث الحالة واتساب"
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#25D366]/25 text-[#25D366] text-[10px] font-bold hover:bg-[#25D366]/10 transition-all">
              <Send className="w-3 h-3" /> تحديث
            </button>
            {(job.status === "done" || job.status === "delivered" || job.status === "ready_for_delivery") && (
              <button onClick={() => onWhatsApp(job, whatsAppReady(job))}
                title="إشعار جاهز للاستلام"
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#25D366]/25 text-[#25D366] text-[10px] font-bold hover:bg-[#25D366]/10 transition-all">
                <CheckCheck className="w-3 h-3" /> جاهز
              </button>
            )}
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-7 h-7 rounded-xl border border-red-500/15 flex items-center justify-center text-red-400/40 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/8 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* hidden QR — provides the SVG that printJobQR serializes */}
          <div id={`qr-job-${job.id}`} className="absolute -left-[9999px] -top-[9999px]" aria-hidden>
            <QRCodeSVG value={jobTrackingUrl} size={200} level="M" includeMargin={false} />
          </div>
        </div>
        {/* Row 2: status badge */}
        <div className="px-3 pb-2.5">
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* ── Pipeline — pinned, not scrollable ── */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--erp-border)]">
        <RepairPipeline
          currentStatus={job.status}
          jobId={job.id}
          jobData={job as unknown as { id: number; status: string; [key: string]: unknown }}
          onStatusChange={(s) => { onPatch({ status: s }); refreshJob(); }}
        />
      </div>

      {/* ── بانر رفض QC — يظهر للفني عند رجوع البطاقة لـ "جارٍ الإصلاح" بعد رفض الفحص ── */}
      {job.qa_notes && !job.qa_completed_at && (() => {
        /* استخراج البنود الفاشلة من qa_checklist */
        let failedItems: Array<{ label?: string; status?: string }> = [];
        try {
          const parsed = typeof job.qa_checklist === "string"
            ? JSON.parse(job.qa_checklist)
            : (Array.isArray(job.qa_checklist) ? job.qa_checklist : []);
          if (Array.isArray(parsed)) {
            failedItems = parsed.filter((i: { status?: string }) => i?.status === "fail");
          }
        } catch { /* ignore */ }
        /* استخراج أول سطر من qa_notes كرسالة الرفض (قبل timestamp) */
        const noteLines = job.qa_notes.split("\n").map(l => l.trim()).filter(Boolean);
        const mainNote = noteLines.find(l => !l.startsWith("[رفض QC")) ?? noteLines[0] ?? "";
        const stamp = noteLines.find(l => l.startsWith("[رفض QC")) ?? "";
        return (
          <div className="shrink-0 mx-3 my-2 rounded-xl border border-red-500/40 overflow-hidden" dir="rtl">
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.12)" }}>
              <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-400/30 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-red-300">تم رفض فحص الجودة — يجب إعادة الإصلاح</p>
                {stamp && <p className="text-[10px] text-red-300/60 mt-0.5">{stamp}</p>}
              </div>
            </div>
            <div className="px-3 pb-2.5 pt-1.5 space-y-1.5" style={{ background: "rgba(239,68,68,0.05)" }}>
              {mainNote && (
                <div>
                  <p className="text-[10px] text-white/55 mb-0.5">سبب الرفض:</p>
                  <p className="text-[11px] text-red-200 leading-relaxed">{mainNote}</p>
                </div>
              )}
              {failedItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/55 mb-1">البنود الفاشلة ({failedItems.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {failedItems.map((item, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-red-200 border border-red-500/30"
                        style={{ background: "rgba(239,68,68,0.15)" }}
                      >
                        {(item as { label?: string }).label ?? `بند #${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* Two columns: device info + score */}
        <div className="grid grid-cols-3 gap-3">
          {/* Device Info */}
          <div className="col-span-2 glass-panel rounded-2xl p-3 border border-[var(--erp-border)] space-y-2">
            <p className="text-[10px] erp-label font-bold flex items-center gap-1"><Smartphone className="w-3 h-3" /> معلومات الجهاز</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="الماركة" value={job.device_brand} />
              <InfoRow label="الموديل" value={job.device_model} />
              {job.imei       && <InfoRow label="IMEI" value={job.imei} mono />}
              {job.device_pin && <InfoRow label="الرقم السري" value={job.device_pin} mono />}
              {job.color      && <InfoRow label="اللون" value={job.color} />}
              {job.storage    && <InfoRow label="التخزين" value={job.storage} />}
            </div>
            <div className="border-t border-[var(--erp-border)] pt-2">
              <p className="text-[10px] erp-label font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> العميل</p>
              <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                <InfoRow label="الاسم" value={job.customer_name} />
                {job.customer_phone && <InfoRow label="الهاتف" value={job.customer_phone} />}
              </div>
            </div>
            {job.problem_description && (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-2">
                <p className="text-[10px] text-amber-400/80 mb-0.5">المشكلة المُبلَّغ عنها</p>
                <p className="text-xs erp-text">{job.problem_description}</p>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="glass-panel rounded-2xl p-3 border border-[var(--erp-border)] flex flex-col items-center justify-center gap-2">
            <ScoreRing score={score} />
            <div className="text-center space-y-0.5">
              <div className="text-[10px] text-emerald-400/70">{checklist.filter((c) => c.status === "pass").length} تعمل</div>
              <div className="text-[10px] text-red-400/70">{checklist.filter((c) => c.status === "fail").length} لا تعمل</div>
              <div className="text-[10px] text-amber-400/70">{checklist.filter((c) => c.status === "partial").length} جزئي</div>
              <div className="text-[10px] text-white/25">{checklist.filter((c) => !c.status).length} لم يُفحص</div>
            </div>
          </div>
        </div>

        {/* Diagnostic Checklist — collapsible */}
        <div className="glass-panel rounded-2xl border border-[var(--erp-border)] overflow-hidden">
          <button
            onClick={() => setChecklistOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-right hover:bg-white/3 transition-all"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] erp-text-muted font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                نتائج الفحص
              </p>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  {checklist.filter(c => c.status === "pass").length} ✓
                </span>
                {checklist.filter(c => c.status === "fail").length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                    {checklist.filter(c => c.status === "fail").length} ✗
                  </span>
                )}
                {checklist.filter(c => c.status === "partial").length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    {checklist.filter(c => c.status === "partial").length} ~
                  </span>
                )}
                {checklist.filter(c => !c.status).length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold erp-card-soft erp-label border border-[var(--erp-border)]">
                    {checklist.filter(c => !c.status).length} ○
                  </span>
                )}
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 erp-label transition-transform duration-200 ${checklistOpen ? "-rotate-90" : "rotate-90"}`}
            />
          </button>
          {checklistOpen && (
            <div className="border-t border-[var(--erp-border)]">
              <JobChecklist checklist={checklist} onSaveItem={onSaveCheckItem} readOnly />
            </div>
          )}
        </div>

        {/* Engineer Reports — collapsible (multiple reports) */}
        <div className="glass-panel rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] overflow-hidden">
          <button
            onClick={() => setReportOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
          >
            <p className="text-[11px] text-violet-300/80 font-bold flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> تقارير مهندس الصيانة
              {engineerReports.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300/70 font-medium tabular-nums">
                  {engineerReports.length}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {reportOpen && !addingReport && (
                <span
                  onClick={(e) => { e.stopPropagation(); setAddingReport(true); }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-violet-500/12 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20 transition-all"
                >
                  <Plus className="w-3 h-3" /> تقرير جديد
                </span>
              )}
              <ChevronRight
                className={`w-4 h-4 text-violet-400/50 transition-transform duration-200 ${reportOpen ? "-rotate-90" : "rotate-90"}`}
              />
            </div>
          </button>
          {reportOpen && (
            <div className="px-4 pb-4 space-y-2.5">

              {/* Inline new-report form */}
              {addingReport && (
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
                  <textarea
                    autoFocus
                    value={newReportText}
                    onChange={(e) => setNewReportText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setAddingReport(false); setNewReportText(""); }
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addReport();
                    }}
                    placeholder="اكتب ملاحظات أو تشخيص أو خطوات الإصلاح..."
                    rows={4}
                    className="erp-input w-full text-sm leading-relaxed resize-y" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] erp-label">Ctrl+Enter للحفظ السريع</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setAddingReport(false); setNewReportText(""); }}
                        className="text-[11px] px-3 py-1 rounded-lg border border-[var(--erp-border)] erp-label hover:text-white/65 hover:border-white/20 transition-all">
                        إلغاء
                      </button>
                      <button
                        onClick={addReport}
                        disabled={!newReportText.trim()}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg bg-violet-500/20 border border-violet-500/35 text-violet-200 hover:bg-violet-500/30 disabled:opacity-30 transition-all">
                        <Save className="w-3 h-3" /> حفظ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reports list */}
              {engineerReports.length === 0 && !addingReport && (
                <div className="text-center py-6 space-y-2">
                  <ClipboardList className="w-6 h-6 text-violet-400/30 mx-auto" />
                  <p className="text-[11px] text-white/35">لا توجد تقارير بعد</p>
                  <button
                    onClick={() => setAddingReport(true)}
                    className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> اكتب أول تقرير
                  </button>
                </div>
              )}

              {engineerReports.map((r) => {
                const dt = new Date(r.created_at);
                const dateStr = dt.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
                const timeStr = dt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                const author  = r.technician_name || r.user_name || "—";
                return (
                  <div key={r.id} className="rounded-xl border border-[var(--erp-border)] bg-white/[0.02] p-3 group">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[10px] font-bold text-violet-300">
                          {author[0] ?? "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-violet-300/85">{author}</span>
                          <span className="text-[9px] erp-label">{dateStr} • {timeStr}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteReport(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all"
                        title="حذف التقرير">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[12px] text-white/75 leading-6 whitespace-pre-wrap pr-8">
                      {r.note}
                    </p>
                  </div>
                );
              })}

            </div>
          )}
        </div>

        {/* ── Technician & Costs ───────────────────────────────── */}
        <div className="glass-panel rounded-2xl p-3 border border-[var(--erp-border)] space-y-3">
          <p className="text-[10px] erp-label font-bold">الفني والتكاليف</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] erp-label mb-1 block">الفني المسؤول</label>
              <select value={editTech} onChange={(e) => setEditTech(e.target.value)} className="erp-input w-full text-xs">
                <option value="">— اختر الفني —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] erp-label mb-1 block">موعد التسليم</label>
              <input type="date" value={editDelivery} onChange={(e) => setEditDelivery(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] erp-label mb-1 block">تكلفة تقديرية</label>
              <input type="number" value={editEst} onChange={(e) => setEditEst(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] erp-label mb-1 block">التكلفة النهائية</label>
              <input type="number" value={editFinal} onChange={(e) => { setEditFinal(e.target.value); }} className="erp-input w-full text-xs" />
            </div>
          </div>
          <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold text-xs transition-all">
            <Save className="w-3.5 h-3.5" /> حفظ التغييرات
          </button>
        </div>

        {/* Accessories display */}
        {job.accessories && (
          <div className="glass-panel rounded-2xl p-3 border border-[var(--erp-border)]">
            <p className="text-[10px] erp-label font-bold flex items-center gap-1 mb-2">
              <Package className="w-3 h-3" /> الإكسسوارات المستلمة
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(typeof job.accessories === "string" ? job.accessories.split(",") : []).map((key) => {
                const acc = ACCESSORIES_LIST.find((a) => a.key === key.trim());
                return (
                  <span key={key} className="px-2.5 py-1 rounded-xl text-xs font-bold bg-violet-500/15 border border-violet-500/30 text-violet-300">
                    ✓ {acc?.label ?? key}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Event Log — سجل الأحداث (آخر الصفحة) ─────────────── */}
        {otherHistory.length > 0 && (
          <div className="glass-panel rounded-2xl border border-[var(--erp-border)] overflow-hidden">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
            >
              <p className="text-[10px] erp-label font-bold flex items-center gap-1.5">
                <History className="w-3 h-3" /> سجل الأحداث ({otherHistory.length})
              </p>
              <ChevronRight
                className={`w-4 h-4 erp-label transition-transform duration-200 ${historyOpen ? "-rotate-90" : "rotate-90"}`}
              />
            </button>
            {historyOpen && (
              <div className="px-4 pb-4 space-y-2">
                {otherHistory.map((h) => {
                  const fromLabel = h.status_from ? (STATUS_MAP[h.status_from]?.label ?? h.status_from) : null;
                  const toLabel   = h.status_to   ? (STATUS_MAP[h.status_to]?.label   ?? h.status_to)   : null;
                  const dt = new Date(h.created_at);
                  const dateStr = dt.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
                  const timeStr = dt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={h.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="w-2 h-2 rounded-full bg-violet-500/60 shrink-0" />
                        <div className="w-px flex-1 erp-card-soft mt-1" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] erp-text-muted font-medium">
                            {h.note ?? (fromLabel && toLabel ? `${fromLabel} ← ${toLabel}` : toLabel ?? fromLabel ?? h.event_type)}
                          </span>
                          <span className="text-[10px] text-white/25 shrink-0">{dateStr} {timeStr}</span>
                        </div>
                        {(h.user_name || h.technician_name) && (
                          <span className="text-[10px] erp-label">{h.user_name ?? h.technician_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>


      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="glass-panel rounded-2xl p-6 w-80 border border-[var(--erp-border)] space-y-4">
            <p className="font-bold text-white">حذف البطاقة {job.job_no}؟</p>
            <p className="text-sm erp-text-muted">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); onDelete(); }}
                className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold">حذف</button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-[var(--erp-border)] erp-text-muted text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NEW JOB FORM
══════════════════════════════════════════════════════════════ */
function NewJobForm({
  customers, users, branches, onClose, onCreated,
}: {
  customers: { id: number; name: string; phone?: string }[];
  users: { id: number; name: string }[];
  branches: { id: number; name: string }[];
  onClose: () => void;
  onCreated: (job: RepairJob) => void;
}) {
  const { toast } = useToast();

  /* ── Customer state ── */
  const [phone, setPhone]               = useState("");
  const [customerId, setCustomerId]     = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [showAddCust, setShowAddCust]   = useState(false);
  const [newCustName, setNewCustName]   = useState("");
  const [addingCust, setAddingCust]     = useState(false);

  /* ── Branch & Accessories state ── */
  const [branchId, setBranchId]         = useState("");
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);

  const toggleAccessory = (key: string) => {
    setSelectedAccessories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  /* ── Device state ── */
  const [brand, setBrand]       = useState("");
  const [category, setCategory] = useState("");
  const [model, setModel]       = useState("");
  const [customModel, setCustomModel] = useState("");
  const [imei, setImei]         = useState("");

  /* ── Quick-add model state ── */
  const [showQuickAdd, setShowQuickAdd]     = useState(false);
  const [quickAddValue, setQuickAddValue]   = useState("");
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);
  const [devicePin, setDevicePin] = useState("");
  const [problem, setProblem]   = useState("");
  const [techId, setTechId]     = useState("");

  /* ── Financial/Date state ── */
  const [estimated, setEstimated]               = useState("");
  const [deposit, setDeposit]                   = useState("");
  const [receivedAt, setReceivedAt]             = useState(new Date().toISOString().split("T")[0]);
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [submitting, setSubmitting]             = useState(false);

  /* ── Power check + local checklist ── */
  const [devicePowers, setDevicePowers]       = useState<null | "on" | "off">(null);
  const [localChecklist, setLocalChecklist]   = useState<ChecklistItem[]>([]);

  /* Derive device_type live from current intake selection so the checklist
     reflects the chosen device (iPhone vs Mac vs Samsung Tablet, etc.). */
  const intakeDeviceType = useMemo(
    () => deriveDeviceType(brand, category),
    [brand, category],
  );

  /* ── Custom device models (company-specific additions) ── */
  const qc = useQueryClient();
  const { data: customDeviceModels = [] } = useQuery<{ id: number; brand: string; category: string; model: string }[]>({
    queryKey: ["/api/repair-device-models"],
    queryFn: () => authFetch(api("/api/repair-device-models")).then(r => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const handleQuickAddModel = async () => {
    if (!quickAddValue.trim() || !brand || !category) return;
    setSavingQuickAdd(true);
    try {
      const r = await authFetch(api("/api/repair-device-models"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, category, model: quickAddValue.trim() }),
      });
      if (!r.ok) throw new Error("فشل الحفظ");
      await qc.invalidateQueries({ queryKey: ["/api/repair-device-models"] });
      setModel(quickAddValue.trim());
      setQuickAddValue("");
      setShowQuickAdd(false);
      toast({ title: "تم حفظ الموديل وتحديد الاختيار" });
    } catch {
      toast({ title: "تعذّر حفظ الموديل", variant: "destructive" });
    } finally {
      setSavingQuickAdd(false);
    }
  };

  /* Load the configured checklist template for this device type. */
  const { data: intakeTemplate = [] } = useQuery<{ id: number; label_ar: string; sort_order: number; category: string }[]>({
    queryKey: ["/api/repair-checklist-items", intakeDeviceType],
    queryFn: async () => {
      const r = await authFetch(api(`/api/repair-checklist-items?device_type=${encodeURIComponent(intakeDeviceType)}`));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ id: number; label_ar: string; sort_order: number; category: string }[]>;
    },
    enabled: !!brand && !!category,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  /* Reset local checklist whenever the device type changes or its template
     finishes loading. Depending on `intakeTemplate.length` (a primitive)
     instead of the array reference avoids an infinite render loop caused
     by the `= []` default creating a fresh reference each render. */
  const intakeTemplateLen = intakeTemplate.length;
  useEffect(() => {
    if (!brand || !category) {
      setLocalChecklist([]);
      setDevicePowers(null);
      return;
    }
    const items: ChecklistItem[] = intakeTemplateLen
      ? intakeTemplate.map(t => ({
          id: String(t.id),
          label: t.label_ar,
          category: t.category ?? "عام",
          status: null,
        }))
      : DEFAULT_CHECKLIST.map(c => ({ ...c, status: null, notes: undefined }));
    setLocalChecklist(items);
    setDevicePowers(null);
  }, [intakeDeviceType, intakeTemplateLen, brand, category]);

  const checklistComplete = localChecklist.length > 0 && localChecklist.every((c) => c.status !== null);

  /* ── Derived device options ── */
  const brandNames   = Object.keys(DEVICE_CATALOG);
  const categories   = brand && DEVICE_CATALOG[brand] ? Object.keys(DEVICE_CATALOG[brand]) : [];
  const models       = useMemo(() => {
    const base = (brand && category && DEVICE_CATALOG[brand]?.[category]) ? DEVICE_CATALOG[brand][category] : [];
    const custom = customDeviceModels
      .filter(m => m.brand === brand && m.category === category)
      .map(m => m.model)
      .filter(m => !base.includes(m));
    return [...base, ...custom];
  }, [brand, category, customDeviceModels]);
  const isOtherBrand = brand === "أخرى";
  const isOtherCat   = brand !== "أخرى" && categories.length > 0 && category === "جهاز آخر";

  /* ── Phone lookup ── */
  const phoneDigits = phone.replace(/\D/g, "");
  const isComplete  = phoneDigits.length === 11;

  // Auto-match from already-loaded customers list
  useEffect(() => {
    if (!isComplete) { setCustomerId(null); setCustomerName(""); setShowAddCust(false); return; }
    const found = customers.find((c) => (c.phone ?? "").replace(/\D/g, "") === phoneDigits);
    if (found) {
      setCustomerId(found.id);
      setCustomerName(found.name);
      setShowAddCust(false);
    } else {
      setCustomerId(null);
      setCustomerName("");
      setShowAddCust(true);
    }
  }, [phoneDigits, isComplete, customers]);

  const handleAddCustomer = async () => {
    if (!newCustName.trim()) { toast({ title: "أدخل اسم العميل", variant: "destructive" }); return; }
    setAddingCust(true);
    try {
      const res = await authFetch(api("/api/repair-customers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustName.trim(), phone: phoneDigits }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(text); } catch {
        throw new Error(res.ok ? "استجابة غير صحيحة من الخادم" : `خطأ في الخادم (${res.status})`);
      }
      if (!res.ok) {
        // If phone already exists with another name, use that customer
        if (data.existing) {
          setCustomerId(Number((data.existing as Record<string, unknown>).id));
          setCustomerName(String((data.existing as Record<string, unknown>).name));
          setShowAddCust(false);
          toast({ title: `تم تحديد العميل الموجود: ${(data.existing as Record<string, unknown>).name}` });
          return;
        }
        throw new Error(String(data.error ?? "خطأ في إضافة العميل"));
      }
      setCustomerId(Number(data.id));
      setCustomerName(String(data.name));
      setShowAddCust(false);
      toast({ title: `✅ تمت إضافة العميل: ${data.name}` });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setAddingCust(false);
    }
  };

  /* ── Submit ── */
  const finalModel = isOtherBrand || isOtherCat ? customModel : model;

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast({ title: "يرجى تحديد العميل أولاً", variant: "destructive" }); return; }
    if (!brand.trim())        { toast({ title: "الماركة مطلوبة", variant: "destructive" }); return; }
    if (!finalModel.trim())   { toast({ title: "الموديل مطلوب", variant: "destructive" }); return; }
    if (devicePowers === null) { toast({ title: "حدد هل الجهاز يعمل أم لا", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const deviceBrand = isOtherBrand ? customModel : brand;
      const deviceModel = isOtherBrand ? customModel : (isOtherCat ? customModel : `${category} ${model}`.trim());

      const sentChecklist = devicePowers === "off"
        ? [{ id: "__power_off__", label: "الجهاز لا يفتح ولا يشتغل", status: "fail" as const }]
        : localChecklist;

      const res = await authFetch(api("/api/repair-jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: phoneDigits,
          device_brand: deviceBrand,
          device_model: deviceModel,
          device_type: deriveDeviceType(deviceBrand, category),
          imei,
          device_pin: devicePin || null,
          problem_description: problem,
          technician_id: techId ? Number(techId) : null,
          technician_name: users.find((u) => u.id.toString() === techId)?.name ?? null,
          estimated_cost: estimated || "0",
          deposit_paid: deposit || "0",
          received_at: receivedAt,
          estimated_delivery: estimatedDelivery || null,
          checklist: sentChecklist,
          accessories: selectedAccessories.length ? selectedAccessories.join(",") : null,
          branch_id: branchId ? Number(branchId) : null,
        }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error ?? "خطأ في الإنشاء");
      onCreated(job);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <h2 className="font-black text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-violet-400" /> بطاقة صيانة جديدة
        </h2>
        <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── 1. Customer by Phone ── */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
            <Phone className="w-3 h-3" /> بيانات العميل
          </p>

          {/* Phone input — always first */}
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="رقم الهاتف (11 رقم) *"
              className="erp-input w-full pr-8 text-sm font-mono tracking-widest"
              inputMode="numeric"
              maxLength={11}
            />
            {phoneDigits.length > 0 && phoneDigits.length < 11 && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">
                {11 - phoneDigits.length} رقم متبقي
              </span>
            )}
          </div>

          {/* Found customer */}
          {isComplete && customerId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-300 text-sm font-bold">{customerName}</p>
                <p className="text-[10px] text-emerald-400/60">عميل موجود</p>
              </div>
            </div>
          )}

          {/* Not found — add new */}
          {isComplete && showAddCust && (
            <div className="space-y-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> الرقم غير موجود — أضف عميل جديد لقسم الصيانة
              </p>
              <input
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="اسم العميل *"
                className="erp-input w-full text-sm"
              />
              <button
                onClick={handleAddCustomer}
                disabled={addingCust}
                className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all disabled:opacity-50"
              >
                {addingCust ? "جاري الإضافة..." : "➕ إضافة العميل"}
              </button>
            </div>
          )}
        </div>

        {/* ── 1b. Branch ── */}
        {branches.length > 0 && (
          <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
            <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
              <GitBranch className="w-3 h-3" /> الفرع
            </p>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="erp-input w-full text-sm">
              <option value="">— بدون تحديد فرع —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {/* ── 2. Device Data ── */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> بيانات الجهاز
          </p>

          {/* Row 1: Brand */}
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">الماركة *</label>
            <select
              value={brand}
              onChange={(e) => { setBrand(e.target.value); setCategory(""); setModel(""); setCustomModel(""); }}
              className="erp-input w-full text-sm"
            >
              <option value="">— اختر الماركة —</option>
              {brandNames.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Row 2: Category (only when brand selected and not "أخرى") */}
          {brand && !isOtherBrand && categories.length > 0 && (
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">التصنيف *</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setModel(""); setCustomModel(""); }}
                className="erp-input w-full text-sm"
              >
                <option value="">— اختر التصنيف —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Row 3: Model dropdown (when category has models) or text input */}
          {brand && !isOtherBrand && category && !isOtherCat && models.length > 0 && (
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الموديل *</label>
              {showQuickAdd ? (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleQuickAddModel(); if (e.key === "Escape") setShowQuickAdd(false); }}
                    placeholder="مثال: iPhone 17 Pro Max"
                    className="erp-input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddModel}
                    disabled={savingQuickAdd || !quickAddValue.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-black text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    {savingQuickAdd ? "…" : "حفظ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowQuickAdd(false); setQuickAddValue(""); }}
                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="erp-input flex-1 text-sm"
                  >
                    <option value="">— اختر الموديل —</option>
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button
                    type="button"
                    title="إضافة موديل جديد"
                    onClick={() => { setShowQuickAdd(true); setQuickAddValue(""); }}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-amber-500/15 hover:border-amber-500/40 text-white/50 hover:text-amber-300 text-sm transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Free text model for: "أخرى" brand / "جهاز آخر" category / empty models list */}
          {(isOtherBrand || isOtherCat || (brand && category && models.length === 0)) && (
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">
                {isOtherBrand ? "الماركة والموديل *" : "الموديل *"}
              </label>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={isOtherBrand ? "مثال: Tecno Spark 20" : "أدخل الموديل"}
                className="erp-input w-full text-sm"
              />
            </div>
          )}

          {/* Row 4: IMEI + Device PIN side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">رقم IMEI</label>
              <input
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="15 رقم"
                className="erp-input w-full text-sm font-mono"
                maxLength={15}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الرقم السري للجهاز</label>
              <input
                value={devicePin}
                onChange={(e) => setDevicePin(e.target.value)}
                placeholder="PIN / كلمة المرور"
                className="erp-input w-full text-sm font-mono"
              />
            </div>
          </div>

          {/* Technician */}
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">الفني المسؤول</label>
            <select value={techId} onChange={(e) => setTechId(e.target.value)} className="erp-input w-full text-sm">
              <option value="">— اختر الفني —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Problem */}
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">وصف المشكلة</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              placeholder="ما الشكوى التي أبلغ عنها العميل؟"
              className="erp-input w-full text-sm resize-none"
            />
          </div>
        </div>

        {/* ── 2b. Accessories ── */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
            <Package className="w-3 h-3" /> الإكسسوارات المستلمة مع الجهاز
          </p>
          <div className="flex flex-wrap gap-2">
            {ACCESSORIES_LIST.map((acc) => (
              <button
                key={acc.key}
                type="button"
                onClick={() => toggleAccessory(acc.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  selectedAccessories.includes(acc.key)
                    ? "bg-violet-500/25 border-violet-500/50 text-violet-300"
                    : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
                }`}
              >
                {selectedAccessories.includes(acc.key) ? "✓ " : ""}{acc.label}
              </button>
            ))}
          </div>
          {selectedAccessories.length === 0 && (
            <p className="text-[10px] text-white/25">لا إكسسوارات — اضغط لتحديد ما تم استلامه</p>
          )}
        </div>

        {/* ── 3. Device Power Check ── */}
        <div className={`glass-panel rounded-2xl p-4 border transition-all ${
          devicePowers === "on"  ? "border-emerald-500/30 bg-emerald-500/5" :
          devicePowers === "off" ? "border-red-500/30 bg-red-500/5" :
          "border-white/5"
        }`}>
          <p className="text-[10px] text-white/40 font-bold mb-3 flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> هل الجهاز يفتح ويشتغل؟
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setDevicePowers("on"); }}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                devicePowers === "on"
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 text-white/40 hover:border-emerald-500/30 hover:text-emerald-400/70"
              }`}
            >
              <CheckCircle2 className="w-8 h-8" />
              <span className="text-sm font-bold">يعمل</span>
            </button>
            <button
              type="button"
              onClick={() => { setDevicePowers("off"); }}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                devicePowers === "off"
                  ? "border-red-500/60 bg-red-500/15 text-red-300"
                  : "border-white/10 text-white/40 hover:border-red-500/30 hover:text-red-400/70"
              }`}
            >
              <XCircle className="w-8 h-8" />
              <span className="text-sm font-bold">لا يعمل</span>
            </button>
          </div>

          {devicePowers === "off" && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <Ban className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">سيتم حفظ الطلب مباشرةً بدون فحص</p>
            </div>
          )}

          {devicePowers === "on" && (
            <div className="mt-4">
              <p className="text-[10px] text-emerald-400/70 mb-2 font-bold">
                أكمل فحص الجهاز قبل الحفظ — {localChecklist.filter(c => c.status).length} / {localChecklist.length}
              </p>
              <ChecklistWizard
                checklist={localChecklist}
                onSaveItem={(id, status, notes) =>
                  setLocalChecklist((prev) =>
                    prev.map((c) => c.id === id ? { ...c, status, notes: notes || c.notes } : c)
                  )
                }
              />
            </div>
          )}
        </div>

        {/* ── 4. Financials & Dates ── */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold">التكلفة والتواريخ</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">تكلفة تقديرية</label>
              <input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="0" className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">عربون مدفوع</label>
              <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">تاريخ الاستلام *</label>
              <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">موعد التسليم</label>
              <input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="erp-input w-full text-sm" />
            </div>
          </div>
        </div>

        {/* Submit — disabled until power check done; if "on" also requires complete checklist */}
        {devicePowers === "on" && !checklistComplete && (
          <p className="text-center text-[11px] text-amber-400/70 -mt-2">
            أكمل جميع بنود الفحص لتتمكن من الحفظ ({localChecklist.filter(c => !c.status).length} متبقي)
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !customerId ||
            devicePowers === null ||
            (devicePowers === "on" && !checklistComplete)
          }
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold transition-all disabled:opacity-50"
        >
          {submitting ? "جاري الإنشاء..." : <><Plus className="w-4 h-4" /> إنشاء البطاقة</>}
        </button>
      </div>
    </div>
  );
}

/* ── Helper ── */
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-white/30 text-[10px]">{label}: </span>
      <span className={`text-white/80 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
