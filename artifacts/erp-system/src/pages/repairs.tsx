import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Plus, Search, Phone, Smartphone, CheckCircle2, XCircle,
  MinusCircle, Trash2, Save, ChevronLeft, Send, ClipboardList,
  AlertCircle, Clock, CheckCheck, Truck, Ban,
  Star, Settings, MessageSquare, ChevronRight, ChevronUp, ChevronDown, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { formatCurrency } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

/* ── Types ──────────────────────────────────────────────────── */
interface RepairJob {
  id: number;
  job_no: string;
  customer_name: string;
  customer_phone?: string;
  customer_id?: number;
  device_brand: string;
  device_model: string;
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
  notes?: string;
  created_at: string;
  parts?: RepairPart[];
}

interface RepairPart {
  id: number;
  product_id?: number;
  product_name: string;
  quantity: string;
  unit_price: string;
}

interface Stats {
  total: number; pending: number; in_progress: number;
  done: number; delivered: number; cancelled: number;
}

interface ChecklistItem {
  id: string;
  label: string;
  category?: string;
  status: "pass" | "fail" | "partial" | "untestable" | null;
  notes?: string;
}

/* ── Constants ──────────────────────────────────────────────── */
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
  pending:     { label: "انتظار",      color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",   icon: Clock },
  in_progress: { label: "جارٍ الإصلاح", color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30",     icon: Wrench },
  done:        { label: "تم الإصلاح",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCheck },
  delivered:   { label: "تم التسليم", color: "text-purple-400",  bg: "bg-purple-500/15 border-purple-500/30", icon: Truck },
  cancelled:   { label: "ملغي",        color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       icon: Ban },
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

  /* ── helper ── */
  async function apiFetch<T>(url: string): Promise<T> {
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  }

  /* ── Queries ── */
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/repair-jobs/stats"],
    queryFn: () => apiFetch<Stats>(api("/api/repair-jobs/stats")),
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
  });

  const { data: users = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/repair-jobs/technicians"],
    queryFn: () => apiFetch<{ id: number; name: string }[]>(api("/api/repair-jobs/technicians")),
  });

  const { data: customers = [] } = useQuery<{ id: number; name: string; phone?: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiFetch<{ id: number; name: string; phone?: string }[]>(api("/api/customers")),
  });

  /* ── Configurable checklist items from server (fallback to built-in) ── */
  const { data: checklistTemplate = [] } = useQuery<{ id: number; label_ar: string; sort_order: number; category: string }[]>({
    queryKey: ["/api/repair-checklist-items"],
    queryFn: () => apiFetch<{ id: number; label_ar: string; sort_order: number; category: string }[]>(api("/api/repair-checklist-items")),
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

  /* ── Detail query when job is selected ── */
  const { data: jobDetail } = useQuery<RepairJob>({
    queryKey: ["/api/repair-jobs", selectedJob?.id],
    queryFn: () => apiFetch<RepairJob>(api(`/api/repair-jobs/${selectedJob!.id}`)),
    enabled: !!selectedJob?.id,
  });

  const detail = jobDetail ?? selectedJob;
  const parsedChecklist = useMemo(() => {
    try {
      const v = detail?.checklist ? JSON.parse(detail.checklist) : null;
      if (!Array.isArray(v)) return templateChecklist;
      // Power-off sentinel: return as-is without merging with template
      if (v.length === 1 && v[0].id === "__power_off__") {
        return [{ id: "__power_off__", label: "الجهاز لا يفتح ولا يشتغل", status: "fail" as const }];
      }
      // Merge saved statuses + notes with current template
      const savedMap: Record<string, { status: ChecklistItem["status"]; notes?: string }> = {};
      v.forEach((c: { id?: string | number; item_id?: string | number; status: string; notes?: string }) => {
        const k = String(c.id ?? c.item_id ?? "");
        if (!k) return;
        // Migrate old "na" → "untestable"
        const status = c.status === "na" ? "untestable" : c.status as ChecklistItem["status"];
        savedMap[k] = { status, notes: c.notes };
      });
      return templateChecklist.map((t) => ({
        ...t,
        status: savedMap[t.id]?.status ?? null,
        notes: savedMap[t.id]?.notes,
      }));
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
        {showSettings && <RepairSettings onClose={() => setShowSettings(false)} />}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "pending",     label: "انتظار",      color: "text-amber-400" },
            { key: "in_progress", label: "جارية",       color: "text-blue-400" },
            { key: "done",        label: "منتهية",      color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.key} className="glass-panel rounded-xl p-2 border border-white/5 text-center">
              <div className={`text-xl font-black ${s.color}`}>{(stats as unknown as Record<string, number>)?.[s.key] ?? 0}</div>
              <div className="text-[10px] text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="رقم الطلب / اسم / هاتف / IMEI / موديل..."
              className="erp-input w-full pr-8 text-xs" />
          </div>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="erp-input text-xs w-32 shrink-0">
            <option value="">كل الفنيين</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Status Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { v: "all", l: "الكل" },
            { v: "pending", l: "انتظار" },
            { v: "in_progress", l: "جارٍ" },
            { v: "done", l: "تم" },
            { v: "delivered", l: "تسليم" },
          ].map((f) => (
            <button key={f.v} onClick={() => setStatusFilter(f.v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${statusFilter === f.v ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"}`}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Job List */}
        <div className="flex flex-col gap-1.5">
          {isLoading && <div className="text-center text-white/30 text-sm py-8">جاري التحميل...</div>}
          {!isLoading && jobs.length === 0 && (
            <div className="text-center text-white/30 text-sm py-8 flex flex-col items-center gap-2">
              <Wrench className="w-8 h-8 opacity-20" />
              لا توجد بطاقات صيانة
            </div>
          )}
          {jobs.map((job) => {
            const isActive = selectedJob?.id === job.id;
            return (
              <div key={job.id} onClick={() => { setSelectedJob(job); setShowNewForm(false); }}
                className={`glass-panel rounded-2xl p-3 border cursor-pointer transition-all hover:border-violet-500/30 ${isActive ? "border-violet-500/40 bg-violet-500/5" : "border-white/5"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-white/30 font-mono">{job.job_no}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="font-bold text-white text-sm truncate">{job.customer_name}</div>
                    <div className="text-white/50 text-xs">{job.device_brand} {job.device_model}</div>
                    {job.problem_description && (
                      <div className="text-white/30 text-[11px] truncate mt-0.5">{job.problem_description}</div>
                    )}
                  </div>
                  {job.device_score != null && (
                    <div className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${job.device_score >= 80 ? "text-emerald-400 bg-emerald-500/10" : job.device_score >= 50 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"}`}>
                      {job.device_score}%
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-white/30">{job.received_at}</span>
                  <span className="text-xs font-bold text-violet-300">{formatCurrency(Number(job.estimated_cost))}</span>
                </div>
              </div>
            );
          })}
        </div>
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
                checklistTemplate={templateChecklist}
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

      {/* Summary of answered items */}
      {doneCount > 0 && (
        <div className="mt-3 space-y-0.5 border-t border-white/5 pt-3">
          <p className="text-[10px] text-white/25 mb-1.5">النتائج المسجلة — اضغط لتعديل</p>
          {checklist.filter((c) => c.status).map((item) => {
            const { label, cls } = statusBadge(item.status);
            const realIdx = checklist.indexOf(item);
            return (
              <button key={item.id}
                onClick={() => { setWizardIdx(realIdx); setAwaitingNotes(false); }}
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
  );
}

/* ══════════════════════════════════════════════════════════════
   JOB CHECKLIST — inline editable (used in JobDetail)
══════════════════════════════════════════════════════════════ */
function JobChecklist({
  checklist,
  onSaveItem,
}: {
  checklist: ChecklistItem[];
  onSaveItem: (id: string, status: ChecklistItem["status"], notes: string) => void;
}) {
  const [editingNotes, setEditingNotes]     = useState<string | null>(null);
  const [pendingStatus, setPendingStatus]   = useState<ChecklistItem["status"]>(null);
  const [notesText, setNotesText]           = useState("");

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

  const pass        = checklist.filter(c => c.status === "pass").length;
  const fail        = checklist.filter(c => c.status === "fail").length;
  const partial     = checklist.filter(c => c.status === "partial").length;
  const untestable  = checklist.filter(c => c.status === "untestable").length;
  const unanswered  = checklist.filter(c => !c.status).length;
  const total       = checklist.length;
  const doneCount   = total - unanswered;

  const STATUS_OPTS: { key: ChecklistItem["status"]; label: string; cls: string; activeCls: string }[] = [
    { key: "pass",       label: "✓",         cls: "border-white/10 text-white/30 hover:border-emerald-500/40 hover:text-emerald-400", activeCls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
    { key: "fail",       label: "✗",         cls: "border-white/10 text-white/30 hover:border-red-500/40 hover:text-red-400",          activeCls: "border-red-500/50 bg-red-500/15 text-red-300" },
    { key: "partial",    label: "~",         cls: "border-white/10 text-white/30 hover:border-amber-500/40 hover:text-amber-400",      activeCls: "border-amber-500/50 bg-amber-500/15 text-amber-300" },
    { key: "untestable", label: "—",         cls: "border-white/10 text-white/20 hover:border-white/20 hover:text-white/50",           activeCls: "border-white/20 bg-white/5 text-white/50" },
  ];

  const handleClick = (item: ChecklistItem, key: ChecklistItem["status"]) => {
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

  return (
    <div className="glass-panel rounded-2xl p-3 border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
          <ClipboardList className="w-3 h-3" /> فحص الجهاز
        </p>
        <div className="flex items-center gap-2 text-[10px]">
          {pass > 0        && <span className="text-emerald-400">{pass} يعمل</span>}
          {fail > 0        && <span className="text-red-400">{fail} لا يعمل</span>}
          {partial > 0     && <span className="text-amber-400">{partial} جزئي</span>}
          {unanswered > 0  && <span className="text-white/30">{unanswered} لم يُفحص</span>}
        </div>
      </div>
      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1 mb-3">
        <div className="h-1 rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} />
      </div>
      {/* Items */}
      <div className="space-y-1">
        {checklist.map((item) => (
          <div key={item.id}>
            <div className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-white/3 transition-all group">
              {/* Status indicator */}
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                item.status === "pass"       ? "bg-emerald-400" :
                item.status === "fail"       ? "bg-red-400" :
                item.status === "partial"    ? "bg-amber-400" :
                item.status === "untestable" ? "bg-white/20" : "bg-white/10"
              }`} />
              {/* Label */}
              <span className={`flex-1 text-xs transition-colors ${item.status ? "text-white/70" : "text-white/50"}`}>
                {item.label}
              </span>
              {/* Status buttons */}
              <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
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
            </div>
            {/* Notes inline for partial/untestable */}
            {editingNotes === item.id && (
              <div className="flex gap-2 mt-1 mb-2 px-4">
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
            {item.notes && editingNotes !== item.id && (
              <p className="text-[10px] text-white/30 px-5 pb-0.5 italic">{item.notes}</p>
            )}
          </div>
        ))}
      </div>
      {unanswered === 0 && (
        <p className="text-center text-[10px] text-emerald-400/60 mt-3">✓ اكتمل الفحص</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REPAIR SETTINGS — manage checklist items with categories
══════════════════════════════════════════════════════════════ */
type ChecklistRow = { id: number; label_ar: string; sort_order: number; category: string };

function RepairSettings({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newLabel, setNewLabel]           = useState("");
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [editLabel, setEditLabel]         = useState("");
  const [activeCat, setActiveCat]         = useState("عام");
  const [addingCat, setAddingCat]         = useState(false);
  const [newCatName, setNewCatName]       = useState("");
  const [reordering, setReordering]       = useState(false);
  const [dragOver, setDragOver]           = useState<number | null>(null);
  const dragIdx                           = useRef<number | null>(null);

  const { data: items = [], isLoading } = useQuery<ChecklistRow[]>({
    queryKey: ["/api/repair-checklist-items"],
    queryFn: () => authFetch(api("/api/repair-checklist-items")).then((r) => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/repair-checklist-items"] });

  /* Derived categories (preserve order of first appearance) */
  const allCategories = useMemo(() => {
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const item of items) {
      const c = item.category ?? "عام";
      if (!seen.has(c)) { seen.add(c); cats.push(c); }
    }
    if (!seen.has("عام")) cats.unshift("عام");
    return cats;
  }, [items]);

  /* Ensure activeCat is always valid */
  useEffect(() => {
    if (allCategories.length && !allCategories.includes(activeCat)) {
      setActiveCat(allCategories[0]);
    }
  }, [allCategories, activeCat]);

  const catItems = useMemo(
    () => items.filter(i => (i.category ?? "عام") === activeCat)
              .sort((a, b) => a.sort_order - b.sort_order),
    [items, activeCat],
  );

  const addItem = async () => {
    if (!newLabel.trim()) return;
    const r = await authFetch(api("/api/repair-checklist-items"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label_ar: newLabel.trim(), category: activeCat }),
    });
    if (!r.ok) { toast({ title: "خطأ في الإضافة", variant: "destructive" }); return; }
    setNewLabel("");
    invalidate();
    toast({ title: "✅ تم إضافة البند" });
  };

  const saveEdit = async (id: number) => {
    if (!editLabel.trim()) return;
    const r = await authFetch(api(`/api/repair-checklist-items/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label_ar: editLabel.trim() }),
    });
    if (!r.ok) { toast({ title: "خطأ في التعديل", variant: "destructive" }); return; }
    setEditingId(null);
    invalidate();
  };

  const deleteItem = async (id: number) => {
    const r = await authFetch(api(`/api/repair-checklist-items/${id}`), { method: "DELETE" });
    if (!r.ok) { toast({ title: "خطأ في الحذف", variant: "destructive" }); return; }
    invalidate();
    toast({ title: "تم الحذف" });
  };

  const moveItem = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= catItems.length) return;
    const a = catItems[idx];
    const b = catItems[newIdx];
    setReordering(true);
    await authFetch(api("/api/repair-checklist-items/reorder"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ]),
    });
    setReordering(false);
    invalidate();
  };

  const dropItem = async (toIdx: number) => {
    const fromIdx = dragIdx.current;
    setDragOver(null);
    dragIdx.current = null;
    if (fromIdx === null || fromIdx === toIdx) return;
    const reordered = [...catItems];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const payload = reordered.map((item, i) => ({ id: item.id, sort_order: i + 1 }));
    setReordering(true);
    await authFetch(api("/api/repair-checklist-items/reorder"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setReordering(false);
    invalidate();
  };

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || allCategories.includes(name)) { setAddingCat(false); return; }
    setActiveCat(name);
    setAddingCat(false);
    setNewCatName("");
    toast({ title: `تم إنشاء تصنيف "${name}" — أضف بنوداً له` });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-2xl border border-white/10 w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[80vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-violet-400" />
            <span className="font-bold text-white text-sm">إعدادات بنود الفحص</span>
          </div>
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5 shrink-0 flex-wrap">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCat(cat); setEditingId(null); setNewLabel(""); }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeCat === cat
                  ? "bg-violet-500/30 border border-violet-500/50 text-violet-300"
                  : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
              }`}>
              {cat}
            </button>
          ))}
          {addingCat ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); } }}
                placeholder="اسم التصنيف..."
                className="erp-input text-xs py-0.5 w-28"
              />
              <button onClick={addCategory} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setAddingCat(false); setNewCatName(""); }} className="text-white/30 p-0.5">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingCat(true)}
              className="px-2 py-1 rounded-full text-xs border border-dashed border-white/20 text-white/30 hover:text-white/60 hover:border-white/40 transition-all flex items-center gap-1">
              <Plus className="w-3 h-3" /> تصنيف
            </button>
          )}
        </div>

        {/* ── Items list (scrollable, drag-to-reorder) ── */}
        <div className="overflow-y-auto flex-1 p-4 space-y-1">
          {isLoading && <p className="text-center text-white/30 text-sm py-4">جاري التحميل...</p>}
          {catItems.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => dropItem(idx)}
              onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
              className={`flex items-center gap-1.5 py-1.5 px-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                dragOver === idx ? "border-violet-500/40 bg-violet-500/5" : "border-white/5 hover:border-white/10"
              }`}>
              {/* Drag handle + arrows */}
              <div className="flex flex-col shrink-0 items-center">
                <div className="text-white/15 hover:text-violet-400/60 cursor-grab px-0.5 pb-0.5 transition-colors">
                  <div className="w-2 flex flex-col gap-0.5">
                    <div className="h-[1.5px] bg-current rounded" />
                    <div className="h-[1.5px] bg-current rounded" />
                    <div className="h-[1.5px] bg-current rounded" />
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); moveItem(idx, -1); }}
                  disabled={idx === 0 || reordering}
                  className="text-white/15 hover:text-violet-400 disabled:opacity-10 transition-colors leading-none">
                  <ChevronUp className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveItem(idx, 1); }}
                  disabled={idx === catItems.length - 1 || reordering}
                  className="text-white/15 hover:text-violet-400 disabled:opacity-10 transition-colors leading-none">
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>
              {/* Label / edit */}
              {editingId === item.id ? (
                <>
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditingId(null); }}
                    className="erp-input flex-1 text-xs py-0.5"
                  />
                  <button onClick={() => saveEdit(item.id)} className="text-emerald-400 hover:text-emerald-300 p-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-white/30 hover:text-white/60 p-1">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs text-white/75">{item.label_ar}</span>
                  <button
                    onClick={() => { setEditingId(item.id); setEditLabel(item.label_ar); }}
                    className="text-white/25 hover:text-violet-400 p-1 transition-colors">
                    <MessageSquare className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-white/15 hover:text-red-400 p-1 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
          {!isLoading && catItems.length === 0 && (
            <p className="text-center text-white/25 text-xs py-6">لا توجد بنود في هذا التصنيف — أضف البند الأول أدناه</p>
          )}
        </div>

        {/* ── Add item footer ── */}
        <div className="px-4 pb-4 pt-2 border-t border-white/5 shrink-0">
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder={`بند جديد في "${activeCat}"...`}
              className="erp-input flex-1 text-xs"
            />
            <button
              onClick={addItem}
              disabled={!newLabel.trim()}
              className="px-3 py-1.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold hover:bg-violet-500/30 transition-all disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
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
  const [editEst, setEditEst]       = useState(job.estimated_cost ?? "0");
  const [editFinal, setEditFinal]   = useState(job.final_cost ?? "0");
  const [editDeposit, setEditDeposit] = useState(job.deposit_paid ?? "0");
  const [editDelivery, setEditDelivery] = useState(job.estimated_delivery ?? "");
  const [editTech, setEditTech]     = useState(job.technician_id?.toString() ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handleSave = () => {
    onPatch({
      estimated_cost: editEst,
      final_cost: editFinal,
      deposit_paid: editDeposit,
      estimated_delivery: editDelivery || null,
      technician_id: editTech ? Number(editTech) : null,
      technician_name: users.find((u) => u.id.toString() === editTech)?.name ?? null,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="font-black text-white text-sm">{job.device_brand} {job.device_model}</div>
            <div className="text-[10px] text-white/40 font-mono">{job.job_no}</div>
          </div>
          <StatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-1.5">
          {/* WhatsApp buttons */}
          <button onClick={() => onWhatsApp(job, whatsAppProgress(job))}
            title="تحديث الحالة"
            className="btn-icon text-[#25D366] hover:bg-[#25D366]/10 text-[10px] gap-1 px-2 py-1 rounded-lg border border-[#25D366]/20 flex items-center">
            <Send className="w-3 h-3" /> تحديث
          </button>
          {(job.status === "done" || job.status === "delivered") && (
            <button onClick={() => onWhatsApp(job, whatsAppReady(job))}
              title="إشعار الاستلام"
              className="btn-icon text-[#25D366] hover:bg-[#25D366]/10 text-[10px] gap-1 px-2 py-1 rounded-lg border border-[#25D366]/20 flex items-center">
              <CheckCheck className="w-3 h-3" /> جاهز
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-icon text-red-400/50 hover:text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Status Actions */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <p className="text-[10px] text-white/40 mb-2">تغيير حالة البطاقة</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <button key={k} onClick={() => onPatch({ status: k })}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${job.status === k ? `${v.color} ${v.bg}` : "border-white/10 text-white/40 hover:border-white/20"}`}>
                <v.icon className="w-2.5 h-2.5" /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two columns: device info + score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Device Info */}
          <div className="md:col-span-2 glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
            <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Smartphone className="w-3 h-3" /> معلومات الجهاز</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="الماركة" value={job.device_brand} />
              <InfoRow label="الموديل" value={job.device_model} />
              {job.imei       && <InfoRow label="IMEI" value={job.imei} mono />}
              {job.device_pin && <InfoRow label="الرقم السري" value={job.device_pin} mono />}
              {job.color      && <InfoRow label="اللون" value={job.color} />}
              {job.storage    && <InfoRow label="التخزين" value={job.storage} />}
            </div>
            <div className="border-t border-white/5 pt-2">
              <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> العميل</p>
              <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                <InfoRow label="الاسم" value={job.customer_name} />
                {job.customer_phone && <InfoRow label="الهاتف" value={job.customer_phone} />}
              </div>
            </div>
            {job.problem_description && (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-2">
                <p className="text-[10px] text-amber-400/80 mb-0.5">المشكلة المُبلَّغ عنها</p>
                <p className="text-xs text-white/70">{job.problem_description}</p>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="glass-panel rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center gap-2">
            <ScoreRing score={score} />
            <div className="text-center space-y-0.5">
              <div className="text-[10px] text-emerald-400/70">{checklist.filter((c) => c.status === "pass").length} تعمل</div>
              <div className="text-[10px] text-red-400/70">{checklist.filter((c) => c.status === "fail").length} لا تعمل</div>
              <div className="text-[10px] text-amber-400/70">{checklist.filter((c) => c.status === "partial").length} جزئي</div>
              <div className="text-[10px] text-white/25">{checklist.filter((c) => !c.status).length} لم يُفحص</div>
            </div>
          </div>
        </div>

        {/* Diagnostic Checklist — Inline editable */}
        <JobChecklist checklist={checklist} onSaveItem={onSaveCheckItem} />

        {/* Diagnostic Report Text — collapsible */}
        <div className="glass-panel rounded-2xl border border-violet-500/10 bg-violet-500/3 overflow-hidden">
          <button
            onClick={() => setReportOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
          >
            <p className="text-[10px] text-violet-400/70 font-bold flex items-center gap-1.5">
              <Star className="w-3 h-3" /> تقرير التشخيص النصي
            </p>
            <ChevronRight
              className={`w-4 h-4 text-violet-400/50 transition-transform duration-200 ${reportOpen ? "-rotate-90" : "rotate-90"}`}
            />
          </button>
          {reportOpen && (
            <div className="px-4 pb-4">
              <div className="text-[11px] text-white/50 leading-6 font-mono whitespace-pre-wrap bg-black/20 rounded-xl p-3">
{`بطاقة صيانة: ${job.job_no}
العميل: ${job.customer_name}${job.customer_phone ? " | " + job.customer_phone : ""}
الجهاز: ${job.device_brand} ${job.device_model}${job.imei ? " | IMEI: " + job.imei : ""}
تاريخ الاستلام: ${job.received_at}${job.estimated_delivery ? " | موعد التسليم: " + job.estimated_delivery : ""}
الفني: ${job.technician_name ?? "—"}
الحالة: ${STATUS_MAP[job.status]?.label ?? job.status}
درجة الجهاز: ${score}%

نتائج الفحص:
${checklist.filter((c) => c.status && c.id !== "__power_off__").map((c) => {
  const sym = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : c.status === "partial" ? "~" : "○";
  return `  ${sym} ${c.label}${c.notes ? ` (${c.notes})` : ""}`;
}).join("\n") || "  الجهاز لا يفتح — لم يُجرَ الفحص"}

المشكلة: ${job.problem_description ?? "—"}
التكلفة التقديرية: ${formatCurrency(Number(editEst))}
التكلفة النهائية: ${formatCurrency(Number(editFinal))}
العربون: ${formatCurrency(Number(editDeposit))}
المتبقي: ${formatCurrency(Math.max(0, Number(editFinal || editEst) - Number(editDeposit)))}`}
              </div>
            </div>
          )}
        </div>

        {/* Technician & Financials — moved to bottom */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-3">
          <p className="text-[10px] text-white/40 font-bold">الفني والتكلفة</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الفني المسؤول</label>
              <select value={editTech} onChange={(e) => setEditTech(e.target.value)} className="erp-input w-full text-xs">
                <option value="">— اختر الفني —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">موعد التسليم</label>
              <input type="date" value={editDelivery} onChange={(e) => setEditDelivery(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">تكلفة تقديرية</label>
              <input type="number" value={editEst} onChange={(e) => setEditEst(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">التكلفة النهائية</label>
              <input type="number" value={editFinal} onChange={(e) => setEditFinal(e.target.value)} className="erp-input w-full text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">عربون مدفوع</label>
              <input type="number" value={editDeposit} onChange={(e) => setEditDeposit(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-white/60">
                المتبقي: <span className="font-black text-amber-400">{formatCurrency(Math.max(0, Number(editFinal || editEst) - Number(editDeposit)))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold text-sm transition-all">
          <Save className="w-4 h-4" /> حفظ التغييرات
        </button>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="glass-panel rounded-2xl p-6 w-80 border border-white/10 space-y-4">
            <p className="font-bold text-white">حذف البطاقة {job.job_no}؟</p>
            <p className="text-sm text-white/50">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); onDelete(); }}
                className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold">حذف</button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-sm">إلغاء</button>
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
  customers, users, checklistTemplate, onClose, onCreated,
}: {
  customers: { id: number; name: string; phone?: string }[];
  users: { id: number; name: string }[];
  checklistTemplate: ChecklistItem[];
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

  /* ── Device state ── */
  const [brand, setBrand]       = useState("");
  const [category, setCategory] = useState("");
  const [model, setModel]       = useState("");
  const [customModel, setCustomModel] = useState("");
  const [imei, setImei]         = useState("");
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
  const [localChecklist, setLocalChecklist]   = useState<ChecklistItem[]>(checklistTemplate);

  /* Re-filter checklist when device category changes */
  useEffect(() => {
    if (!checklistTemplate.length) return;
    const cats = [...new Set(checklistTemplate.map(c => c.category ?? "عام"))];
    const hasMatch = category && cats.includes(category);
    const filtered = hasMatch
      ? checklistTemplate.filter(c => {
          const cat = c.category ?? "عام";
          return cat === category || cat === "عام";
        })
      : checklistTemplate;
    setLocalChecklist(filtered.map(c => ({ ...c, status: null, notes: undefined })));
    setDevicePowers(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const checklistComplete = localChecklist.every((c) => c.status !== null);

  /* ── Derived device options ── */
  const brandNames   = Object.keys(DEVICE_CATALOG);
  const categories   = brand && DEVICE_CATALOG[brand] ? Object.keys(DEVICE_CATALOG[brand]) : [];
  const models       = brand && category && DEVICE_CATALOG[brand]?.[category] ? DEVICE_CATALOG[brand][category] : [];
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
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="erp-input w-full text-sm"
              >
                <option value="">— اختر الموديل —</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
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
