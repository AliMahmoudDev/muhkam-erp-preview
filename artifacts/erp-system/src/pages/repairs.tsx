import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Plus, Search, Phone, Smartphone, CheckCircle2, XCircle,
  MinusCircle, Trash2, Save, ChevronLeft, Send, ClipboardList,
  Package, AlertCircle, Clock, CheckCheck, Truck, Ban,
  Star, Zap, Cpu, Wifi, Camera, Volume2, Mic, Battery,
  Fingerprint, Shield, Power, Globe, Bluetooth,
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
  status: "pass" | "fail" | "na" | null;
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

const CHECKLIST_ICONS: Record<string, React.FC<{ className?: string }>> = {
  screen: Smartphone, touch: Zap, battery: Battery, front_camera: Camera,
  rear_camera: Camera, speaker: Volume2, microphone: Mic, wifi: Wifi,
  bluetooth: Bluetooth, network: Globe, port: Power, buttons: Cpu,
  biometric: Fingerprint, body: Shield,
};

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme", "OnePlus", "Nokia", "أخرى"];
const STORAGE_OPTIONS = ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  pending:     { label: "انتظار",      color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",   icon: Clock },
  in_progress: { label: "جارٍ الإصلاح", color: "text-blue-400",    bg: "bg-blue-500/15 border-blue-500/30",     icon: Wrench },
  done:        { label: "تم الإصلاح",  color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCheck },
  delivered:   { label: "تم التسليم", color: "text-purple-400",  bg: "bg-purple-500/15 border-purple-500/30", icon: Truck },
  cancelled:   { label: "ملغي",        color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       icon: Ban },
};

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

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
    queryKey: ["/api/repair-jobs", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return apiFetch<RepairJob[]>(api(`/api/repair-jobs?${params}`));
    },
  });

  const { data: products = [] } = useQuery<{ id: number; name: string; sale_price: string }[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiFetch<{ id: number; name: string; sale_price: string }[]>(api("/api/products")),
  });

  const { data: users = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/repair-jobs/technicians"],
    queryFn: () => apiFetch<{ id: number; name: string }[]>(api("/api/repair-jobs/technicians")),
  });

  const { data: customers = [] } = useQuery<{ id: number; name: string; phone?: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiFetch<{ id: number; name: string; phone?: string }[]>(api("/api/customers")),
  });

  /* ── Detail query when job is selected ── */
  const { data: jobDetail } = useQuery<RepairJob>({
    queryKey: ["/api/repair-jobs", selectedJob?.id],
    queryFn: () => apiFetch<RepairJob>(api(`/api/repair-jobs/${selectedJob!.id}`)),
    enabled: !!selectedJob?.id,
  });

  const detail = jobDetail ?? selectedJob;
  const parsedChecklist = (() => {
    try {
      const v = detail?.checklist ? JSON.parse(detail.checklist) : null;
      return Array.isArray(v) ? v : DEFAULT_CHECKLIST;
    } catch { return DEFAULT_CHECKLIST; }
  })();
  const checklist: ChecklistItem[] = parsedChecklist;

  const score = useMemo(() => {
    const tested = checklist.filter((c) => c.status === "pass" || c.status === "fail");
    if (!tested.length) return 0;
    return Math.round((checklist.filter((c) => c.status === "pass").length / tested.length) * 100);
  }, [checklist]);

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

  const addPart = useMutation({
    mutationFn: ({ jobId, data }: { jobId: number; data: Record<string, unknown> }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/parts`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs", selectedJob?.id] });
      toast({ title: "✅ تم إضافة القطعة" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePart = useMutation({
    mutationFn: ({ jobId, partId }: { jobId: number; partId: number }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/parts/${partId}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/repair-jobs", selectedJob?.id] }),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Checklist update ── */
  const toggleCheck = (itemId: string, newStatus: "pass" | "fail" | "na") => {
    if (!detail) return;
    const updated = checklist.map((c) =>
      c.id === itemId ? { ...c, status: c.status === newStatus ? null : newStatus } : c
    );
    const newScore = (() => {
      const tested = updated.filter((c) => c.status === "pass" || c.status === "fail");
      if (!tested.length) return 0;
      return Math.round((updated.filter((c) => c.status === "pass").length / tested.length) * 100);
    })();
    patchJob.mutate({ id: detail.id, data: { checklist: updated, device_score: newScore } });
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
          <button
            onClick={() => { setShowNewForm(true); setSelectedJob(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-bold transition-all">
            <Plus className="w-3.5 h-3.5" /> بطاقة جديدة
          </button>
        </div>

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

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم / موديل / IMEI..."
            className="erp-input w-full pr-8 text-sm" />
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
                products={products}
                users={users}
                onClose={() => setSelectedJob(null)}
                onPatch={(data) => patchJob.mutate({ id: detail!.id, data })}
                onDelete={() => deleteJob.mutate(detail!.id)}
                onAddPart={(data) => addPart.mutate({ jobId: detail!.id, data })}
                onDeletePart={(partId) => deletePart.mutate({ jobId: detail!.id, partId })}
                onToggleCheck={toggleCheck}
                onWhatsApp={sendWhatsApp}
                whatsAppReady={whatsAppReady}
                whatsAppProgress={whatsAppProgress}
              />
            : <NewJobForm
                customers={customers}
                users={users}
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
   JOB DETAIL PANEL
══════════════════════════════════════════════════════════════ */
function JobDetail({
  job, checklist, score, products, users,
  onClose, onPatch, onDelete, onAddPart, onDeletePart, onToggleCheck,
  onWhatsApp, whatsAppReady, whatsAppProgress,
}: {
  job: RepairJob;
  checklist: ChecklistItem[];
  score: number;
  products: { id: number; name: string; sale_price: string }[];
  users: { id: number; name: string }[];
  onClose: () => void;
  onPatch: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddPart: (data: Record<string, unknown>) => void;
  onDeletePart: (partId: number) => void;
  onToggleCheck: (id: string, status: "pass" | "fail" | "na") => void;
  onWhatsApp: (job: RepairJob, msg: string) => void;
  whatsAppReady: (job: RepairJob) => string;
  whatsAppProgress: (job: RepairJob) => string;
}) {
  const { toast } = useToast();
  const [editNotes, setEditNotes] = useState(job.notes ?? "");
  const [editEst, setEditEst]   = useState(job.estimated_cost ?? "0");
  const [editFinal, setEditFinal] = useState(job.final_cost ?? "0");
  const [editDeposit, setEditDeposit] = useState(job.deposit_paid ?? "0");
  const [editDelivery, setEditDelivery] = useState(job.estimated_delivery ?? "");
  const [editTech, setEditTech] = useState(job.technician_id?.toString() ?? "");
  const [partSearch, setPartSearch] = useState("");
  const [partQty, setPartQty]   = useState("1");
  const [partPrice, setPartPrice] = useState("");
  const [partName, setPartName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const parts = job.parts ?? [];
  const partsTotal = parts.reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(partSearch.toLowerCase())
  ).slice(0, 8);

  const selectProduct = (p: { id: number; name: string; sale_price: string }) => {
    setPartName(p.name);
    setPartPrice(p.sale_price);
    setPartSearch(p.name);
  };

  const handleAddPart = () => {
    if (!partName.trim()) { toast({ title: "اسم القطعة مطلوب", variant: "destructive" }); return; }
    const matchProd = products.find((p) => p.name === partName);
    onAddPart({ product_id: matchProd?.id ?? null, product_name: partName, quantity: partQty, unit_price: partPrice || "0" });
    setPartSearch(""); setPartName(""); setPartQty("1"); setPartPrice("");
  };

  const handleSave = () => {
    onPatch({
      notes: editNotes,
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
              {job.imei     && <InfoRow label="IMEI" value={job.imei} mono />}
              {job.color    && <InfoRow label="اللون" value={job.color} />}
              {job.storage  && <InfoRow label="التخزين" value={job.storage} />}
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
            <div className="text-center">
              <div className="text-[10px] text-white/30">
                {checklist.filter((c) => c.status === "pass").length} تعمل /
                {" "}{checklist.filter((c) => c.status === "fail").length} لا تعمل
              </div>
              <div className="text-[10px] text-white/20 mt-0.5">
                {checklist.filter((c) => !c.status).length} لم يُفحص
              </div>
            </div>
          </div>
        </div>

        {/* Technician & Financials */}
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

        {/* Diagnostic Checklist */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <p className="text-[10px] text-white/40 font-bold mb-3 flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> تشخيص الجهاز — اضغط لتسجيل الحالة
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {checklist.map((item) => {
              const Icon = CHECKLIST_ICONS[item.id] ?? Cpu;
              return (
                <div key={item.id} className={`flex items-center justify-between rounded-xl p-2 border transition-all ${
                  item.status === "pass" ? "bg-emerald-500/10 border-emerald-500/25" :
                  item.status === "fail" ? "bg-red-500/10 border-red-500/25" :
                  item.status === "na"   ? "bg-white/5 border-white/10 opacity-50" :
                  "border-white/5 bg-white/2"
                }`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${item.status === "pass" ? "text-emerald-400" : item.status === "fail" ? "text-red-400" : "text-white/30"}`} />
                    <span className="text-xs text-white/70">{item.label}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onToggleCheck(item.id, "pass")}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${item.status === "pass" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/30 hover:bg-emerald-500/30 hover:text-emerald-400"}`}
                      title="يعمل">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onToggleCheck(item.id, "fail")}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${item.status === "fail" ? "bg-red-500 text-white" : "bg-white/5 text-white/30 hover:bg-red-500/30 hover:text-red-400"}`}
                      title="لا يعمل">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onToggleCheck(item.id, "na")}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${item.status === "na" ? "bg-white/20 text-white" : "bg-white/5 text-white/30 hover:bg-white/10"}`}
                      title="غير قابل للتطبيق">
                      <MinusCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Parts Section */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <p className="text-[10px] text-white/40 font-bold mb-3 flex items-center gap-1">
            <Package className="w-3 h-3" /> قطع الغيار المستخدمة
          </p>

          {/* Add Part */}
          <div className="flex gap-1.5 mb-3 relative">
            <div className="flex-1 relative">
              <input
                value={partSearch}
                onChange={(e) => { setPartSearch(e.target.value); setPartName(e.target.value); setPartPrice(""); }}
                placeholder="اسم القطعة أو ابحث في المنتجات..."
                className="erp-input w-full text-xs" />
              {partSearch && products.length > 0 && !products.find((p) => p.name === partName) && (
                <div className="absolute top-full mt-1 right-0 left-0 z-20 glass-panel rounded-xl border border-white/10 max-h-36 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full text-right px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-violet-300">{formatCurrency(Number(p.sale_price))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="number" value={partQty} onChange={(e) => setPartQty(e.target.value)}
              placeholder="كمية" className="erp-input w-14 text-xs text-center" min="0.1" />
            <input type="number" value={partPrice} onChange={(e) => setPartPrice(e.target.value)}
              placeholder="سعر" className="erp-input w-20 text-xs text-center" />
            <button onClick={handleAddPart} className="btn-icon text-violet-300 hover:bg-violet-500/20">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Parts List */}
          {parts.length === 0 ? (
            <p className="text-[11px] text-white/20 text-center py-2">لا توجد قطع مضافة</p>
          ) : (
            <div className="space-y-1">
              {parts.map((part) => (
                <div key={part.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="flex-1 text-xs text-white/70">{part.product_name}</span>
                  <span className="text-xs text-white/40 w-8 text-center">{Number(part.quantity).toFixed(0)}×</span>
                  <span className="text-xs text-violet-300 w-20 text-left">{formatCurrency(Number(part.unit_price))}</span>
                  <button onClick={() => onDeletePart(part.id)} className="btn-icon text-red-400/40 hover:text-red-400 w-5 h-5">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex justify-between pt-1.5 text-xs font-bold">
                <span className="text-white/40">إجمالي القطع</span>
                <span className="text-violet-300">{formatCurrency(partsTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <label className="text-[10px] text-white/40 mb-2 block">ملاحظات الفني</label>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            placeholder="ملاحظات إضافية، إرشادات الصيانة..."
            className="erp-input w-full text-xs resize-none" />
        </div>

        {/* Diagnostic Report Text */}
        <div className="glass-panel rounded-2xl p-3 border border-violet-500/10 bg-violet-500/3">
          <p className="text-[10px] text-violet-400/70 font-bold mb-2 flex items-center gap-1"><Star className="w-3 h-3" /> تقرير التشخيص النصي</p>
          <div className="text-[11px] text-white/50 leading-6 font-mono whitespace-pre-wrap bg-black/20 rounded-xl p-3">
{`بطاقة صيانة: ${job.job_no}
العميل: ${job.customer_name}${job.customer_phone ? " | " + job.customer_phone : ""}
الجهاز: ${job.device_brand} ${job.device_model}${job.imei ? " | IMEI: " + job.imei : ""}
تاريخ الاستلام: ${job.received_at}${job.estimated_delivery ? " | موعد التسليم: " + job.estimated_delivery : ""}
الفني: ${job.technician_name ?? "—"}
الحالة: ${STATUS_MAP[job.status]?.label ?? job.status}
درجة الجهاز: ${score}%

نتائج الفحص:
${checklist.filter((c) => c.status).map((c) => `  ${c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "—"} ${c.label}`).join("\n") || "  لم يُنجز الفحص بعد"}

المشكلة: ${job.problem_description ?? "—"}
الملاحظات: ${editNotes || "—"}

التكلفة التقديرية: ${formatCurrency(Number(editEst))}
التكلفة النهائية: ${formatCurrency(Number(editFinal))}
العربون: ${formatCurrency(Number(editDeposit))}
المتبقي: ${formatCurrency(Math.max(0, Number(editFinal || editEst) - Number(editDeposit)))}`}
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
  customers, users, onClose, onCreated,
}: {
  customers: { id: number; name: string; phone?: string }[];
  users: { id: number; name: string }[];
  onClose: () => void;
  onCreated: (job: RepairJob) => void;
}) {
  const { toast } = useToast();
  const [customerSearch, setCustomerSearch]     = useState("");
  const [customerId, setCustomerId]             = useState<number | null>(null);
  const [customerName, setCustomerName]         = useState("");
  const [customerPhone, setCustomerPhone]       = useState("");
  const [brand, setBrand]                       = useState("");
  const [model, setModel]                       = useState("");
  const [imei, setImei]                         = useState("");
  const [color, setColor]                       = useState("");
  const [storage, setStorage]                   = useState("");
  const [problem, setProblem]                   = useState("");
  const [techId, setTechId]                     = useState("");
  const [estimated, setEstimated]               = useState("");
  const [deposit, setDeposit]                   = useState("");
  const [receivedAt, setReceivedAt]             = useState(new Date().toISOString().split("T")[0]);
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [submitting, setSubmitting]             = useState(false);

  const filteredCust = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  ).slice(0, 6);

  const selectCustomer = (c: { id: number; name: string; phone?: string }) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone ?? "");
    setCustomerSearch(c.name);
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast({ title: "اسم العميل مطلوب", variant: "destructive" }); return; }
    if (!brand.trim()) { toast({ title: "الماركة مطلوبة", variant: "destructive" }); return; }
    if (!model.trim()) { toast({ title: "الموديل مطلوب", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const res = await authFetch(api("/api/repair-jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId, customer_name: customerName, customer_phone: customerPhone,
          device_brand: brand, device_model: model, imei, color, storage,
          problem_description: problem,
          technician_id: techId ? Number(techId) : null,
          technician_name: users.find((u) => u.id.toString() === techId)?.name ?? null,
          estimated_cost: estimated || "0",
          deposit_paid: deposit || "0",
          received_at: receivedAt,
          estimated_delivery: estimatedDelivery || null,
          checklist: DEFAULT_CHECKLIST,
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
        {/* Customer */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> بيانات العميل</p>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCustomerName(e.target.value); setCustomerId(null); }}
              placeholder="ابحث عن عميل أو أدخل اسماً جديداً..." className="erp-input w-full pr-8 text-sm" />
            {customerSearch && !customerId && filteredCust.length > 0 && (
              <div className="absolute top-full mt-1 right-0 left-0 z-20 glass-panel rounded-xl border border-white/10 max-h-36 overflow-y-auto">
                {filteredCust.map((c) => (
                  <button key={c.id} onClick={() => selectCustomer(c)}
                    className="w-full text-right px-3 py-2 text-sm text-white/70 hover:bg-white/5 flex justify-between">
                    <span>{c.name}</span>
                    {c.phone && <span className="text-white/30 text-xs">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="رقم الهاتف" className="erp-input w-full text-sm" />
        </div>

        {/* Device */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Smartphone className="w-3 h-3" /> بيانات الجهاز</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الماركة *</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— اختر —</option>
                {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الموديل *</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="مثال: iPhone 15 Pro" className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">رقم IMEI</label>
              <input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="15 رقم" className="erp-input w-full text-sm font-mono" maxLength={15} />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">اللون</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="مثال: أسود، أبيض..." className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">التخزين</label>
              <select value={storage} onChange={(e) => setStorage(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— اختر —</option>
                {STORAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الفني المسؤول</label>
              <select value={techId} onChange={(e) => setTechId(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— اختر الفني —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">وصف المشكلة</label>
            <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2}
              placeholder="ما الشكوى التي أبلغ عنها العميل؟" className="erp-input w-full text-sm resize-none" />
          </div>
        </div>

        {/* Financials & Dates */}
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

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold transition-all disabled:opacity-50">
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
