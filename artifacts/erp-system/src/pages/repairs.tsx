import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Plus, Search, Phone, Smartphone, CheckCircle2, XCircle,
  MinusCircle, Trash2, Save, ChevronLeft, Send, ClipboardList,
  Package, AlertCircle, Clock, CheckCheck, Truck, Star,
  Settings, History, AlertTriangle, RotateCcw, Ban as BanIcon,
  HelpCircle, ArrowLeft, ArrowRight, Lock,
} from "lucide-react";
void Truck; void MinusCircle;
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { formatCurrency } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

async function apiFetch<T>(url: string): Promise<T> {
  const r = await authFetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

/* ── Types ──────────────────────────────────────────────────── */
interface RepairJob {
  id: number; job_no: string;
  customer_name: string; customer_phone?: string; customer_id?: number;
  device_brand: string; device_model: string;
  imei?: string; serial_no?: string; color?: string; storage?: string;
  problem_description?: string;
  technician_id?: number; technician_name?: string;
  technician_2_id?: number; technician_2_name?: string; technician_2_section?: string;
  status: string; checklist?: string; qa_checklist?: string; qa_completed_at?: string; qa_notes?: string;
  device_score?: number;
  estimated_cost: string; final_cost: string; deposit_paid: string;
  external_workshop?: boolean; external_workshop_name?: string; external_workshop_cost?: string;
  broker_name?: string; broker_commission?: string;
  alert_days_threshold?: number; locked?: boolean;
  received_at: string; estimated_delivery?: string; delivered_at?: string;
  notes?: string; created_at: string;
  parts?: RepairPart[]; history?: HistoryEntry[];
}

interface RepairPart {
  id: number; product_id?: number; product_name: string;
  quantity: string; unit_price: string;
  source?: string; warehouse_id?: number;
  is_returned?: boolean; return_destination?: string;
}

interface HistoryEntry {
  id: number; status_from?: string; status_to?: string;
  technician_name?: string; user_name?: string;
  event_type?: string; note?: string; created_at: string;
}

interface ChecklistItem {
  id: string; label: string;
  status: "pass" | "fail" | "untestable" | "partial" | null;
}

interface RepairStatusDef {
  id: number; key: string; label_ar: string; color: string; sort_order: number; is_system: boolean;
}

interface ChecklistTemplate { id: number; label_ar: string; sort_order: number; is_system: boolean }

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme", "OnePlus", "Nokia", "أخرى"];
const STORAGE_OPTIONS = ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];

const CHECK_STATES = [
  { key: "pass",       label: "يعمل",           Icon: CheckCircle2, color: "emerald" },
  { key: "fail",       label: "لا يعمل",        Icon: XCircle,      color: "red" },
  { key: "partial",    label: "لا يعمل بشكل جيد", Icon: AlertCircle,  color: "amber" },
  { key: "untestable", label: "لا يمكن تجربته",  Icon: HelpCircle,   color: "slate" },
] as const;

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

function StatusBadge({ status, statuses }: { status: string; statuses: RepairStatusDef[] }) {
  const s = statuses.find(x => x.key === status);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border"
      style={{ color: s?.color ?? "#64748b", borderColor: (s?.color ?? "#64748b") + "55", background: (s?.color ?? "#64748b") + "20" }}>
      <Clock className="w-2.5 h-2.5" />{s?.label_ar ?? status}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function Repairs() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  /* ── Queries ── */
  const { data: stats } = useQuery<{ total: number; today_count: number; by_status: { key: string; label: string; color: string; count: number }[] }>({
    queryKey: ["/api/repair-jobs/stats"],
    queryFn: () => apiFetch(api("/api/repair-jobs/stats")),
    refetchInterval: 30000,
  });

  const { data: statuses = [] } = useQuery<RepairStatusDef[]>({
    queryKey: ["/api/repair-statuses"],
    queryFn: () => apiFetch(api("/api/repair-statuses")),
  });

  const { data: checklistTemplate = [] } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/repair-checklist-items"],
    queryFn: () => apiFetch(api("/api/repair-checklist-items")),
  });

  const { data: alerts = [] } = useQuery<RepairJob[]>({
    queryKey: ["/api/repair-jobs/alerts"],
    queryFn: () => apiFetch(api("/api/repair-jobs/alerts?days=7")),
    refetchInterval: 60000,
  });

  const { data: jobs = [], isLoading } = useQuery<RepairJob[]>({
    queryKey: ["/api/repair-jobs", statusFilter, techFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (techFilter !== "all") p.set("technician_id", techFilter);
      if (search) p.set("search", search);
      return apiFetch(api(`/api/repair-jobs?${p}`));
    },
  });

  const { data: products = [] } = useQuery<{ id: number; name: string; sale_price: string }[]>({
    queryKey: ["/api/products"],
    queryFn: () => apiFetch(api("/api/products")),
  });

  const { data: users = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/repair-jobs/technicians"],
    queryFn: () => apiFetch(api("/api/repair-jobs/technicians")),
  });

  const { data: customers = [] } = useQuery<{ id: number; name: string; phone?: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: () => apiFetch(api("/api/customers")),
  });

  const { data: jobDetail } = useQuery<RepairJob>({
    queryKey: ["/api/repair-jobs", selectedJob?.id],
    queryFn: () => apiFetch(api(`/api/repair-jobs/${selectedJob!.id}`)),
    enabled: !!selectedJob?.id,
  });

  const detail = jobDetail ?? selectedJob;

  /* ── Build live checklist from template + saved state ── */
  const checklist: ChecklistItem[] = useMemo(() => {
    const saved: Record<string, ChecklistItem["status"]> = {};
    if (detail?.checklist) {
      try {
        const parsed = JSON.parse(detail.checklist);
        if (Array.isArray(parsed)) parsed.forEach((c: ChecklistItem) => { saved[c.id] = c.status; });
      } catch { /* ignore */ }
    }
    return checklistTemplate.map(t => ({
      id: String(t.id),
      label: t.label_ar,
      status: saved[String(t.id)] ?? null,
    }));
  }, [detail?.checklist, checklistTemplate]);

  const qaChecklist: ChecklistItem[] = useMemo(() => {
    const saved: Record<string, ChecklistItem["status"]> = {};
    if (detail?.qa_checklist) {
      try {
        const parsed = JSON.parse(detail.qa_checklist);
        if (Array.isArray(parsed)) parsed.forEach((c: ChecklistItem) => { saved[c.id] = c.status; });
      } catch { /* ignore */ }
    }
    return checklistTemplate.map(t => ({
      id: String(t.id),
      label: t.label_ar,
      status: saved[String(t.id)] ?? null,
    }));
  }, [detail?.qa_checklist, checklistTemplate]);

  const score = useMemo(() => {
    const tested = checklist.filter(c => c.status === "pass" || c.status === "fail" || c.status === "partial");
    if (!tested.length) return 0;
    const pass = checklist.filter(c => c.status === "pass").length;
    const partial = checklist.filter(c => c.status === "partial").length;
    return Math.round(((pass + partial * 0.5) / tested.length) * 100);
  }, [checklist]);

  /* ── Mutations ── */
  const patchJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      authFetch(api(`/api/repair-jobs/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "خطأ"); return j; }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs", selectedJob?.id] });
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs/stats"] });
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
      authFetch(api(`/api/repair-jobs/${jobId}/parts`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/repair-jobs", selectedJob?.id] }); toast({ title: "✅ تم إضافة القطعة" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePart = useMutation({
    mutationFn: ({ jobId, partId }: { jobId: number; partId: number }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/parts/${partId}`), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/repair-jobs", selectedJob?.id] }),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const returnPart = useMutation({
    mutationFn: ({ jobId, partId, destination }: { jobId: number; partId: number; destination: "stock" | "scrap" }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/parts/${partId}/return`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/repair-jobs", selectedJob?.id] });
      toast({ title: vars.destination === "stock" ? "↩️ أُرجعت للمخزن" : "🗑️ أُضيفت للتوالف" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleCheck = (itemId: string, newStatus: ChecklistItem["status"], isQA = false) => {
    if (!detail) return;
    const list = isQA ? qaChecklist : checklist;
    const updated = list.map(c => c.id === itemId ? { ...c, status: c.status === newStatus ? null : newStatus } : c);
    if (isQA) {
      patchJob.mutate({ id: detail.id, data: { qa_checklist: updated } });
    } else {
      const tested = updated.filter(c => c.status === "pass" || c.status === "fail" || c.status === "partial");
      const pass = updated.filter(c => c.status === "pass").length;
      const partial = updated.filter(c => c.status === "partial").length;
      const newScore = tested.length ? Math.round(((pass + partial * 0.5) / tested.length) * 100) : 0;
      patchJob.mutate({ id: detail.id, data: { checklist: updated, device_score: newScore } });
    }
  };

  const sendWhatsApp = (job: RepairJob, msg: string) => {
    if (!job.customer_phone) { toast({ title: "لا يوجد رقم هاتف", variant: "destructive" }); return; }
    const phone = job.customer_phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("0") ? "2" + phone : phone;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const whatsAppReady = (job: RepairJob) => {
    const total = Number(job.final_cost ?? job.estimated_cost) + Number(job.broker_commission ?? 0);
    return `✅ عزيزنا ${job.customer_name}،\nجهازك ${job.device_brand} ${job.device_model} جاهز للاستلام.\nبطاقة: ${job.job_no}\nالتكلفة الإجمالية: ${formatCurrency(total)}\n\nشكراً لثقتكم 🙏`;
  };

  const whatsAppProgress = (job: RepairJob) => {
    const s = statuses.find(x => x.key === job.status);
    return `🔧 تحديث صيانة جهازك\nالموديل: ${job.device_brand} ${job.device_model}\nالرقم: ${job.job_no}\nالحالة: ${s?.label_ar ?? job.status}\n\nللاستفسار تواصل معنا 📱`;
  };

  return (
    <div className="flex h-full gap-0" dir="rtl">
      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — List
      ══════════════════════════════════════════════════════ */}
      <div className={`flex flex-col gap-3 p-4 overflow-y-auto transition-all ${selectedJob || showSettings ? "hidden md:flex md:w-[340px] shrink-0" : "flex flex-1"}`}
        style={{ borderLeft: (selectedJob || showSettings) ? "1px solid rgba(255,255,255,0.06)" : undefined }}>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-violet-400" />بطاقات الصيانة
          </h1>
          <div className="flex gap-1.5">
            <button onClick={() => { setShowSettings(true); setSelectedJob(null); setShowNewForm(false); }}
              className="btn-icon text-white/50 hover:text-violet-300 hover:bg-violet-500/10" title="إعدادات">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowNewForm(true); setSelectedJob(null); setShowSettings(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> جديدة
            </button>
          </div>
        </div>

        {/* Long-stay alerts banner */}
        {alerts.length > 0 && (
          <div className="glass-panel rounded-xl p-2.5 border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{alerts.length} جهاز في المركز أكثر من 7 أيام</span>
            </div>
          </div>
        )}

        {/* Stats - top 4 statuses */}
        <div className="grid grid-cols-4 gap-1.5">
          {(stats?.by_status ?? []).slice(0, 4).map(s => (
            <div key={s.key} className="glass-panel rounded-xl p-2 border border-white/5 text-center cursor-pointer hover:border-violet-500/30"
              onClick={() => setStatusFilter(s.key)}>
              <div className="text-base font-black" style={{ color: s.color }}>{s.count}</div>
              <div className="text-[9px] text-white/40 truncate">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث: اسم، موبايل، IMEI، سيريال، رقم بطاقة، فني..."
            className="erp-input w-full pr-8 text-sm" />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${statusFilter === "all" ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/10 text-white/40"}`}>
            الكل
          </button>
          {statuses.map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${statusFilter === s.key ? "" : "border-white/10 text-white/40"}`}
              style={statusFilter === s.key ? { color: s.color, borderColor: s.color + "55", background: s.color + "20" } : {}}>
              {s.label_ar}
            </button>
          ))}
        </div>

        {/* Tech filter */}
        <div>
          <select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="erp-input w-full text-xs">
            <option value="all">— كل الفنيين —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Job List */}
        <div className="flex flex-col gap-1.5">
          {isLoading && <div className="text-center text-white/30 text-sm py-8">جاري التحميل...</div>}
          {!isLoading && jobs.length === 0 && (
            <div className="text-center text-white/30 text-sm py-8 flex flex-col items-center gap-2">
              <Wrench className="w-8 h-8 opacity-20" />لا توجد بطاقات
            </div>
          )}
          {jobs.map(job => {
            const isActive = selectedJob?.id === job.id;
            return (
              <div key={job.id} onClick={() => { setSelectedJob(job); setShowNewForm(false); setShowSettings(false); }}
                className={`glass-panel rounded-2xl p-3 border cursor-pointer transition-all hover:border-violet-500/30 ${isActive ? "border-violet-500/40 bg-violet-500/5" : "border-white/5"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-white/30 font-mono">{job.job_no}</span>
                      <StatusBadge status={job.status} statuses={statuses} />
                      {job.locked && <Lock className="w-2.5 h-2.5 text-white/30" />}
                    </div>
                    <div className="font-bold text-white text-sm truncate">{job.customer_name}</div>
                    <div className="text-white/50 text-xs">{job.device_brand} {job.device_model}</div>
                    {job.technician_name && (
                      <div className="text-white/30 text-[10px] mt-0.5">
                        👤 {job.technician_name}{job.technician_2_name ? ` + ${job.technician_2_name}` : ""}
                      </div>
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

      {/* ══════════════════════════════════════════════════════ */}
      {(selectedJob || showNewForm || showSettings) && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {showSettings ? (
            <RepairSettings statuses={statuses} checklistTemplate={checklistTemplate} onClose={() => setShowSettings(false)} />
          ) : selectedJob ? (
            <JobDetail
              job={detail!}
              checklist={checklist}
              qaChecklist={qaChecklist}
              score={score}
              statuses={statuses}
              products={products}
              users={users}
              onClose={() => setSelectedJob(null)}
              onPatch={(data) => patchJob.mutate({ id: detail!.id, data })}
              onDelete={() => deleteJob.mutate(detail!.id)}
              onAddPart={(data) => addPart.mutate({ jobId: detail!.id, data })}
              onDeletePart={(partId) => deletePart.mutate({ jobId: detail!.id, partId })}
              onReturnPart={(partId, destination) => returnPart.mutate({ jobId: detail!.id, partId, destination })}
              onToggleCheck={toggleCheck}
              onWhatsApp={sendWhatsApp}
              whatsAppReady={whatsAppReady}
              whatsAppProgress={whatsAppProgress}
            />
          ) : (
            <NewJobForm
              customers={customers}
              users={users}
              onClose={() => setShowNewForm(false)}
              onCreated={(job) => {
                qc.invalidateQueries({ queryKey: ["/api/repair-jobs"] });
                qc.invalidateQueries({ queryKey: ["/api/repair-jobs/stats"] });
                setShowNewForm(false);
                setSelectedJob(job);
                toast({ title: `✅ بطاقة ${job.job_no}` });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   JOB DETAIL PANEL
   ══════════════════════════════════════════════════════════════ */
function JobDetail({
  job, checklist, qaChecklist, score, statuses, products, users,
  onClose, onPatch, onDelete, onAddPart, onDeletePart, onReturnPart, onToggleCheck,
  onWhatsApp, whatsAppReady, whatsAppProgress,
}: {
  job: RepairJob;
  checklist: ChecklistItem[]; qaChecklist: ChecklistItem[];
  score: number;
  statuses: RepairStatusDef[];
  products: { id: number; name: string; sale_price: string }[];
  users: { id: number; name: string }[];
  onClose: () => void;
  onPatch: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddPart: (data: Record<string, unknown>) => void;
  onDeletePart: (partId: number) => void;
  onReturnPart: (partId: number, destination: "stock" | "scrap") => void;
  onToggleCheck: (id: string, status: ChecklistItem["status"], isQA?: boolean) => void;
  onWhatsApp: (job: RepairJob, msg: string) => void;
  whatsAppReady: (job: RepairJob) => string;
  whatsAppProgress: (job: RepairJob) => string;
}) {
  const { toast } = useToast();
  const locked = !!job.locked;
  const [editNotes, setEditNotes] = useState(job.notes ?? "");
  const [editEst, setEditEst] = useState(job.estimated_cost ?? "0");
  const [editFinal, setEditFinal] = useState(job.final_cost ?? "0");
  const [editDeposit, setEditDeposit] = useState(job.deposit_paid ?? "0");
  const [editDelivery, setEditDelivery] = useState(job.estimated_delivery ?? "");
  const [editTech, setEditTech] = useState(job.technician_id?.toString() ?? "");
  const [editTech2, setEditTech2] = useState(job.technician_2_id?.toString() ?? "");
  const [editTech2Section, setEditTech2Section] = useState(job.technician_2_section ?? "");
  const [editExternalWS, setEditExternalWS] = useState(!!job.external_workshop);
  const [editExternalWSName, setEditExternalWSName] = useState(job.external_workshop_name ?? "");
  const [editExternalWSCost, setEditExternalWSCost] = useState(job.external_workshop_cost ?? "0");
  const [editBrokerName, setEditBrokerName] = useState(job.broker_name ?? "");
  const [editBrokerCom, setEditBrokerCom] = useState(job.broker_commission ?? "0");
  const [editAlertDays, setEditAlertDays] = useState(job.alert_days_threshold?.toString() ?? "");
  const [partSearch, setPartSearch] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partPrice, setPartPrice] = useState("");
  const [partName, setPartName] = useState("");
  const [partSource, setPartSource] = useState<"internal" | "external_workshop">("internal");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQA, setShowQA] = useState(false);
  /* Sequential checklist mode */
  const [seqMode, setSeqMode] = useState(false);
  const [seqIndex, setSeqIndex] = useState(0);

  useEffect(() => { setSeqIndex(0); }, [job.id]);

  const parts = job.parts ?? [];
  const history = job.history ?? [];
  const partsTotal = parts.filter(p => !p.is_returned).reduce((s, p) => s + Number(p.quantity) * Number(p.unit_price), 0);
  const grandTotal = Number(editFinal || editEst) + Number(editExternalWSCost || 0) + Number(editBrokerCom || 0);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(partSearch.toLowerCase())).slice(0, 8);

  const selectProduct = (p: { id: number; name: string; sale_price: string }) => {
    setPartName(p.name); setPartPrice(p.sale_price); setPartSearch(p.name);
  };

  const handleAddPart = () => {
    if (!partName.trim()) { toast({ title: "اسم القطعة مطلوب", variant: "destructive" }); return; }
    const matchProd = products.find(p => p.name === partName);
    onAddPart({
      product_id: matchProd?.id ?? null,
      product_name: partName,
      quantity: partQty, unit_price: partPrice || "0",
      source: partSource,
    });
    setPartSearch(""); setPartName(""); setPartQty("1"); setPartPrice("");
  };

  const handleSave = () => {
    onPatch({
      notes: editNotes,
      estimated_cost: editEst, final_cost: editFinal, deposit_paid: editDeposit,
      estimated_delivery: editDelivery || null,
      technician_id: editTech ? Number(editTech) : null,
      technician_name: users.find(u => u.id.toString() === editTech)?.name ?? null,
      technician_2_id: editTech2 ? Number(editTech2) : null,
      technician_2_name: users.find(u => u.id.toString() === editTech2)?.name ?? null,
      technician_2_section: editTech2Section || null,
      external_workshop: editExternalWS,
      external_workshop_name: editExternalWSName || null,
      external_workshop_cost: editExternalWSCost,
      broker_name: editBrokerName || null,
      broker_commission: editBrokerCom,
      alert_days_threshold: editAlertDays ? Number(editAlertDays) : null,
    });
  };

  /* QA comparison stats */
  const qaCompare = useMemo(() => {
    const initialMap = Object.fromEntries(checklist.map(c => [c.id, c.status]));
    const improved: string[] = [];
    const stillBroken: string[] = [];
    const newIssues: string[] = [];
    qaChecklist.forEach(qa => {
      const init = initialMap[qa.id];
      if ((init === "fail" || init === "partial") && qa.status === "pass") improved.push(qa.label);
      else if ((init === "fail" || init === "partial") && (qa.status === "fail" || qa.status === "partial")) stillBroken.push(qa.label);
      else if (init === "pass" && (qa.status === "fail" || qa.status === "partial")) newIssues.push(qa.label);
    });
    return { improved, stillBroken, newIssues };
  }, [checklist, qaChecklist]);

  const seqUntested = checklist.findIndex(c => c.status === null);
  const currentChecklist = showQA ? qaChecklist : checklist;
  const currentItem = seqMode ? currentChecklist[seqIndex] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="btn-icon text-white/40 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
          <div>
            <div className="font-black text-white text-sm flex items-center gap-2">
              {job.device_brand} {job.device_model}
              {locked && <Lock className="w-3 h-3 text-white/40" />}
            </div>
            <div className="text-[10px] text-white/40 font-mono">{job.job_no}</div>
          </div>
          <StatusBadge status={job.status} statuses={statuses} />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowHistory(true)} className="btn-icon text-white/50 hover:text-violet-300" title="السجل">
            <History className="w-4 h-4" />
          </button>
          <button onClick={() => onWhatsApp(job, whatsAppProgress(job))}
            className="btn-icon text-[#25D366] hover:bg-[#25D366]/10 text-[10px] gap-1 px-2 py-1 rounded-lg border border-[#25D366]/20 flex items-center">
            <Send className="w-3 h-3" /> تحديث
          </button>
          {(job.status === "done" || job.status === "delivered") && (
            <button onClick={() => onWhatsApp(job, whatsAppReady(job))}
              className="btn-icon text-[#25D366] hover:bg-[#25D366]/10 text-[10px] gap-1 px-2 py-1 rounded-lg border border-[#25D366]/20 flex items-center">
              <CheckCheck className="w-3 h-3" /> جاهز
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-icon text-red-400/50 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {locked && (
          <div className="glass-panel rounded-xl p-2.5 border border-white/10 bg-white/3 flex items-center gap-2 text-white/60 text-xs">
            <Lock className="w-3.5 h-3.5" />هذه البطاقة مغلقة بعد التسليم. يمكن فقط استعراضها.
          </div>
        )}

        {/* Status quick-change */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <p className="text-[10px] text-white/40 mb-2">تغيير حالة الطلب</p>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map(s => (
              <button key={s.key} onClick={() => !locked && onPatch({ status: s.key })}
                disabled={locked}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all disabled:opacity-50"
                style={job.status === s.key
                  ? { color: s.color, borderColor: s.color + "55", background: s.color + "20" }
                  : { color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }}>
                {s.label_ar}
              </button>
            ))}
          </div>
        </div>

        {/* Device + Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
            <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Smartphone className="w-3 h-3" /> الجهاز</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="الماركة" value={job.device_brand} />
              <InfoRow label="الموديل" value={job.device_model} />
              {job.imei      && <InfoRow label="IMEI" value={job.imei} mono />}
              {job.serial_no && <InfoRow label="السيريال" value={job.serial_no} mono />}
              {job.color     && <InfoRow label="اللون" value={job.color} />}
              {job.storage   && <InfoRow label="التخزين" value={job.storage} />}
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
                <p className="text-[10px] text-amber-400/80 mb-0.5">المشكلة</p>
                <p className="text-xs text-white/70">{job.problem_description}</p>
              </div>
            )}
          </div>
          <div className="glass-panel rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center gap-2">
            <ScoreRing score={score} />
            <div className="text-center text-[10px] text-white/40">
              {checklist.filter(c => c.status === "pass").length} ✓ /
              {" "}{checklist.filter(c => c.status === "fail").length} ✗ /
              {" "}{checklist.filter(c => c.status === "partial").length} ⚠
            </div>
          </div>
        </div>

        {/* Technicians, Workshop, Broker */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-3">
          <p className="text-[10px] text-white/40 font-bold">الفنيون والتكاليف</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الفني الأساسي</label>
              <select value={editTech} onChange={(e) => setEditTech(e.target.value)} disabled={locked} className="erp-input w-full text-xs">
                <option value="">— اختر —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الفني الثاني</label>
              <select value={editTech2} onChange={(e) => setEditTech2(e.target.value)} disabled={locked} className="erp-input w-full text-xs">
                <option value="">— لا يوجد —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">قسم الفني الثاني</label>
              <input value={editTech2Section} onChange={(e) => setEditTech2Section(e.target.value)} disabled={locked}
                placeholder="مثل: شاشة، لوحة، برمجة..." className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">موعد التسليم</label>
              <input type="date" value={editDelivery} onChange={(e) => setEditDelivery(e.target.value)} disabled={locked} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">تنبيه بعد (يوم)</label>
              <input type="number" value={editAlertDays} onChange={(e) => setEditAlertDays(e.target.value)} disabled={locked}
                placeholder="افتراضي: 7" className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">تكلفة تقديرية</label>
              <input type="number" value={editEst} onChange={(e) => setEditEst(e.target.value)} disabled={locked} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">التكلفة النهائية</label>
              <input type="number" value={editFinal} onChange={(e) => setEditFinal(e.target.value)} disabled={locked} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">عربون</label>
              <input type="number" value={editDeposit} onChange={(e) => setEditDeposit(e.target.value)} disabled={locked} className="erp-input w-full text-xs" />
            </div>
          </div>

          {/* External workshop */}
          <div className="border-t border-white/5 pt-3">
            <label className="flex items-center gap-2 text-xs text-white/70 mb-2">
              <input type="checkbox" checked={editExternalWS} onChange={(e) => setEditExternalWS(e.target.checked)} disabled={locked}
                className="accent-violet-500" />
              تم الإصلاح في ورشة خارجية
            </label>
            {editExternalWS && (
              <div className="grid grid-cols-2 gap-2">
                <input value={editExternalWSName} onChange={(e) => setEditExternalWSName(e.target.value)} disabled={locked}
                  placeholder="اسم الورشة الخارجية" className="erp-input w-full text-xs" />
                <input type="number" value={editExternalWSCost} onChange={(e) => setEditExternalWSCost(e.target.value)} disabled={locked}
                  placeholder="تكلفة الإصلاح الخارجي" className="erp-input w-full text-xs" />
              </div>
            )}
          </div>

          {/* Broker */}
          <div className="border-t border-white/5 pt-3">
            <p className="text-[10px] text-white/40 mb-2">عمولة الوسيط (اختياري)</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={editBrokerName} onChange={(e) => setEditBrokerName(e.target.value)} disabled={locked}
                placeholder="اسم الوسيط" className="erp-input w-full text-xs" />
              <input type="number" value={editBrokerCom} onChange={(e) => setEditBrokerCom(e.target.value)} disabled={locked}
                placeholder="قيمة العمولة" className="erp-input w-full text-xs" />
            </div>
          </div>

          {/* Total summary */}
          <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="text-white/60">إجمالي القطع: <span className="font-black text-violet-300">{formatCurrency(partsTotal)}</span></div>
            <div className="text-white/60">المتبقي: <span className="font-black text-amber-400">{formatCurrency(Math.max(0, grandTotal - Number(editDeposit)))}</span></div>
            <div className="text-white/60 col-span-2">الإجمالي للعميل: <span className="font-black text-emerald-400">{formatCurrency(grandTotal)}</span></div>
          </div>
        </div>

        {/* Initial Diagnostic Checklist */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-white/40 font-bold flex items-center gap-1">
              <ClipboardList className="w-3 h-3" /> الفحص الأولي
            </p>
            <div className="flex gap-1">
              <button onClick={() => { setSeqMode(!seqMode); setShowQA(false); setSeqIndex(Math.max(0, seqUntested)); }}
                className={`text-[10px] px-2 py-0.5 rounded-lg border ${seqMode && !showQA ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/10 text-white/50"}`}>
                {seqMode && !showQA ? "تتابع: مفعل" : "وضع التتابع"}
              </button>
              <button onClick={() => { setShowQA(!showQA); setSeqMode(false); }}
                className={`text-[10px] px-2 py-0.5 rounded-lg border ${showQA ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300" : "border-white/10 text-white/50"}`}>
                اختبار الجودة
              </button>
            </div>
          </div>

          {/* Sequential mode */}
          {seqMode && !showQA && currentItem && (
            <div className="space-y-3">
              <div className="text-center text-xs text-white/40">{seqIndex + 1} من {currentChecklist.length}</div>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-center">
                <div className="text-lg font-bold text-white mb-3">{currentItem.label}</div>
                <div className="flex justify-center gap-2 mb-3">
                  {CHECK_STATES.map(st => (
                    <CheckBtn key={st.key} state={st} active={currentItem.status === st.key}
                      onClick={() => onToggleCheck(currentItem.id, st.key, false)} disabled={locked} />
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setSeqIndex(Math.max(0, seqIndex - 1))} disabled={seqIndex === 0}
                  className="btn-icon flex items-center gap-1 text-xs text-white/60 disabled:opacity-30">
                  <ArrowRight className="w-3 h-3" /> السابق
                </button>
                <button onClick={() => setSeqIndex(Math.min(currentChecklist.length - 1, seqIndex + 1))}
                  disabled={seqIndex >= currentChecklist.length - 1}
                  className="btn-icon flex items-center gap-1 text-xs text-violet-300 disabled:opacity-30">
                  التالي <ArrowLeft className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* List mode */}
          {!seqMode && !showQA && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {checklist.map(item => (
                <ChecklistRow key={item.id} item={item} onToggle={(s) => onToggleCheck(item.id, s, false)} disabled={locked} />
              ))}
            </div>
          )}

          {/* QA mode */}
          {showQA && (
            <div className="space-y-3">
              <div className="text-[11px] text-cyan-400/80 bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-2">
                ✨ اختبار الجودة النهائي: أعد فحص كل البنود وقارن بالفحص الأولي
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {qaChecklist.map(item => (
                  <ChecklistRow key={item.id} item={item}
                    onToggle={(s) => onToggleCheck(item.id, s, true)}
                    initialStatus={checklist.find(c => c.id === item.id)?.status ?? null}
                    disabled={locked} />
                ))}
              </div>
              {(qaCompare.improved.length + qaCompare.stillBroken.length + qaCompare.newIssues.length) > 0 && (
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-2">
                    <div className="font-bold text-emerald-400 mb-1">✓ تم الإصلاح ({qaCompare.improved.length})</div>
                    {qaCompare.improved.map((l, i) => <div key={i} className="text-white/60">{l}</div>)}
                  </div>
                  <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-2">
                    <div className="font-bold text-red-400 mb-1">✗ لم يُصلَح ({qaCompare.stillBroken.length})</div>
                    {qaCompare.stillBroken.map((l, i) => <div key={i} className="text-white/60">{l}</div>)}
                  </div>
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-2">
                    <div className="font-bold text-amber-400 mb-1">⚠ مشاكل جديدة ({qaCompare.newIssues.length})</div>
                    {qaCompare.newIssues.map((l, i) => <div key={i} className="text-white/60">{l}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parts Section */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <p className="text-[10px] text-white/40 font-bold mb-3 flex items-center gap-1">
            <Package className="w-3 h-3" /> قطع الغيار
          </p>
          {!locked && (
            <div className="space-y-1.5 mb-3">
              <div className="flex gap-1.5 relative">
                <div className="flex-1 relative">
                  <input value={partSearch}
                    onChange={(e) => { setPartSearch(e.target.value); setPartName(e.target.value); setPartPrice(""); }}
                    placeholder="ابحث في المخزن أو اكتب اسم القطعة..."
                    className="erp-input w-full text-xs" />
                  {partSearch && filteredProducts.length > 0 && !products.find(p => p.name === partName) && (
                    <div className="absolute top-full mt-1 right-0 left-0 z-20 glass-panel rounded-xl border border-white/10 max-h-36 overflow-y-auto">
                      {filteredProducts.map(p => (
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
                <button onClick={handleAddPart} className="btn-icon text-violet-300 hover:bg-violet-500/20"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-1 text-[11px] text-white/60">
                  <input type="radio" checked={partSource === "internal"} onChange={() => setPartSource("internal")} className="accent-violet-500" />
                  من المخزن
                </label>
                <label className="flex items-center gap-1 text-[11px] text-white/60">
                  <input type="radio" checked={partSource === "external_workshop"} onChange={() => setPartSource("external_workshop")} className="accent-violet-500" />
                  من الورشة الخارجية
                </label>
              </div>
            </div>
          )}

          {parts.length === 0 ? (
            <p className="text-[11px] text-white/20 text-center py-2">لا توجد قطع</p>
          ) : (
            <div className="space-y-1">
              {parts.map(part => (
                <div key={part.id}
                  className={`flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 ${part.is_returned ? "opacity-50" : ""}`}>
                  <span className="flex-1 text-xs text-white/70">
                    {part.product_name}
                    {part.source === "external_workshop" && <span className="text-[9px] text-blue-300 mr-1">(خارجي)</span>}
                    {part.is_returned && <span className="text-[9px] text-amber-300 mr-1">(مُرجَع: {part.return_destination === "scrap" ? "توالف" : "مخزن"})</span>}
                  </span>
                  <span className="text-xs text-white/40 w-8 text-center">{Number(part.quantity).toFixed(0)}×</span>
                  <span className="text-xs text-violet-300 w-20 text-left">{formatCurrency(Number(part.unit_price))}</span>
                  {!part.is_returned && !locked && (
                    <>
                      <button onClick={() => onReturnPart(part.id, "stock")} className="btn-icon text-emerald-400/60 hover:text-emerald-400 w-5 h-5" title="إرجاع للمخزن">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button onClick={() => onReturnPart(part.id, "scrap")} className="btn-icon text-amber-400/60 hover:text-amber-400 w-5 h-5" title="نقل للتوالف">
                        <BanIcon className="w-3 h-3" />
                      </button>
                      <button onClick={() => onDeletePart(part.id)} className="btn-icon text-red-400/40 hover:text-red-400 w-5 h-5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-1.5 text-xs font-bold">
                <span className="text-white/40">إجمالي</span>
                <span className="text-violet-300">{formatCurrency(partsTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="glass-panel rounded-2xl p-3 border border-white/5">
          <label className="text-[10px] text-white/40 mb-2 block">ملاحظات الفني</label>
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} disabled={locked} rows={3}
            placeholder="ملاحظات إضافية..."
            className="erp-input w-full text-xs resize-none" />
        </div>

        {!locked && (
          <button onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold text-sm">
            <Save className="w-4 h-4" /> حفظ التغييرات
          </button>
        )}
      </div>

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl" onClick={() => setShowHistory(false)}>
          <div className="glass-panel rounded-2xl p-5 w-full max-w-md max-h-[70vh] overflow-y-auto border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-white flex items-center gap-2"><History className="w-4 h-4" /> سجل التغييرات</h3>
              <button onClick={() => setShowHistory(false)} className="btn-icon text-white/40"><XCircle className="w-4 h-4" /></button>
            </div>
            {history.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-6">لا يوجد سجل</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="border-r-2 border-violet-500/30 pr-3 py-1">
                    <div className="text-xs text-white/80 font-bold">
                      {h.event_type === "status_change" && `حالة: ${h.status_from ?? "—"} → ${h.status_to}`}
                      {h.event_type === "technician_change" && (h.note ?? "تغيير فني")}
                      {h.event_type === "created" && "إنشاء البطاقة"}
                      {h.event_type === "report" && "تقرير الفني"}
                    </div>
                    {h.note && h.event_type !== "technician_change" && (
                      <div className="text-[11px] text-white/50 mt-0.5">{h.note}</div>
                    )}
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {h.user_name ?? "—"} • {new Date(h.created_at).toLocaleString("ar-EG")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="glass-panel rounded-2xl p-6 w-80 border border-white/10 space-y-4">
            <p className="font-bold text-white">حذف البطاقة {job.job_no}؟</p>
            <p className="text-sm text-white/50">لا يمكن التراجع.</p>
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

/* ── ChecklistRow ── */
function ChecklistRow({
  item, onToggle, initialStatus, disabled,
}: {
  item: ChecklistItem;
  onToggle: (status: ChecklistItem["status"]) => void;
  initialStatus?: ChecklistItem["status"];
  disabled?: boolean;
}) {
  const bg =
    item.status === "pass"       ? "bg-emerald-500/10 border-emerald-500/25" :
    item.status === "fail"       ? "bg-red-500/10 border-red-500/25" :
    item.status === "partial"    ? "bg-amber-500/10 border-amber-500/25" :
    item.status === "untestable" ? "bg-slate-500/10 border-slate-500/25 opacity-60" :
    "border-white/5 bg-white/2";
  const changed = initialStatus !== undefined && initialStatus !== item.status;
  return (
    <div className={`flex items-center justify-between rounded-xl p-2 border ${bg}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/70">{item.label}</span>
        {changed && <span className="text-[9px] text-cyan-300">تغيّر</span>}
      </div>
      <div className="flex gap-1">
        {CHECK_STATES.map(st => (
          <CheckBtn key={st.key} state={st} active={item.status === st.key} onClick={() => onToggle(st.key)} disabled={disabled} small />
        ))}
      </div>
    </div>
  );
}

function CheckBtn({
  state, active, onClick, disabled, small,
}: {
  state: typeof CHECK_STATES[number];
  active: boolean; onClick: () => void; disabled?: boolean; small?: boolean;
}) {
  const Icon = state.Icon;
  const sz = small ? "w-6 h-6" : "w-10 h-10";
  const ic = small ? "w-3.5 h-3.5" : "w-5 h-5";
  const cls = active
    ? state.color === "emerald" ? "bg-emerald-500 text-white" :
      state.color === "red"     ? "bg-red-500 text-white" :
      state.color === "amber"   ? "bg-amber-500 text-white" :
                                   "bg-slate-500 text-white"
    : "bg-white/5 text-white/30 hover:bg-white/10";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${sz} rounded-lg flex items-center justify-center transition-all ${cls} disabled:opacity-30`}
      title={state.label}>
      <Icon className={ic} />
    </button>
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
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [serial, setSerial] = useState("");
  const [color, setColor] = useState("");
  const [storage, setStorage] = useState("");
  const [problem, setProblem] = useState("");
  const [techId, setTechId] = useState("");
  const [tech2Id, setTech2Id] = useState("");
  const [tech2Section, setTech2Section] = useState("");
  const [estimated, setEstimated] = useState("");
  const [deposit, setDeposit] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split("T")[0]);
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredCust = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  ).slice(0, 6);

  const selectCustomer = (c: { id: number; name: string; phone?: string }) => {
    setCustomerId(c.id); setCustomerName(c.name); setCustomerPhone(c.phone ?? ""); setCustomerSearch(c.name);
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
          device_brand: brand, device_model: model, imei, serial_no: serial, color, storage,
          problem_description: problem,
          technician_id: techId ? Number(techId) : null,
          technician_name: users.find(u => u.id.toString() === techId)?.name ?? null,
          technician_2_id: tech2Id ? Number(tech2Id) : null,
          technician_2_name: users.find(u => u.id.toString() === tech2Id)?.name ?? null,
          technician_2_section: tech2Section || null,
          estimated_cost: estimated || "0",
          deposit_paid: deposit || "0",
          received_at: receivedAt,
          estimated_delivery: estimatedDelivery || null,
        }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error ?? "خطأ");
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
          <Plus className="w-4 h-4 text-violet-400" /> بطاقة جديدة
        </h2>
        <button onClick={onClose} className="btn-icon text-white/40 hover:text-white"><XCircle className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> العميل</p>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setCustomerName(e.target.value); setCustomerId(null); }}
              placeholder="ابحث أو أدخل اسماً جديداً..." className="erp-input w-full pr-8 text-sm" />
            {customerSearch && !customerId && filteredCust.length > 0 && (
              <div className="absolute top-full mt-1 right-0 left-0 z-20 glass-panel rounded-xl border border-white/10 max-h-36 overflow-y-auto">
                {filteredCust.map(c => (
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

        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold flex items-center gap-1"><Smartphone className="w-3 h-3" /> الجهاز</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الماركة *</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— اختر —</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الموديل *</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="iPhone 15 Pro" className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">IMEI</label>
              <input value={imei} onChange={(e) => setImei(e.target.value)} className="erp-input w-full text-sm font-mono" maxLength={15} />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">السيريال</label>
              <input value={serial} onChange={(e) => setSerial(e.target.value)} className="erp-input w-full text-sm font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">اللون</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">التخزين</label>
              <select value={storage} onChange={(e) => setStorage(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— اختر —</option>
                {STORAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">وصف المشكلة</label>
            <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2}
              placeholder="ما الشكوى من العميل؟" className="erp-input w-full text-sm resize-none" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold">الفنيون</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الفني الأساسي</label>
              <select value={techId} onChange={(e) => setTechId(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— اختر —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الفني الثاني</label>
              <select value={tech2Id} onChange={(e) => setTech2Id(e.target.value)} className="erp-input w-full text-sm">
                <option value="">— لا يوجد —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {tech2Id && (
              <div className="col-span-2">
                <label className="text-[10px] text-white/40 mb-1 block">قسم الفني الثاني</label>
                <input value={tech2Section} onChange={(e) => setTech2Section(e.target.value)}
                  placeholder="مثل: شاشات، لوحة..." className="erp-input w-full text-sm" />
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
          <p className="text-[10px] text-white/40 font-bold">التكلفة والتواريخ</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">تكلفة تقديرية</label>
              <input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">عربون</label>
              <input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="erp-input w-full text-sm" />
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold disabled:opacity-50">
          {submitting ? "جاري الإنشاء..." : <><Plus className="w-4 h-4" /> إنشاء البطاقة</>}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS — Manage statuses + checklist items
   ══════════════════════════════════════════════════════════════ */
function RepairSettings({
  statuses, checklistTemplate, onClose,
}: {
  statuses: RepairStatusDef[];
  checklistTemplate: ChecklistTemplate[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"statuses" | "checklist">("statuses");

  const mut = (verb: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) =>
    authFetch(api(url), {
      method: verb,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "خطأ"); return j; });

  const addStatus = useMutation({
    mutationFn: (data: { label_ar: string; color: string }) => mut("POST", "/api/repair-statuses", { ...data, key: `c${Date.now()}`, sort_order: 99 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/repair-statuses"] }); toast({ title: "✅ أُضيفت الحالة" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const editStatus = useMutation({
    mutationFn: ({ id, ...data }: { id: number; label_ar?: string; color?: string }) => mut("PATCH", `/api/repair-statuses/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/repair-statuses"] }),
  });
  const delStatus = useMutation({
    mutationFn: (id: number) => mut("DELETE", `/api/repair-statuses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/repair-statuses"] }); toast({ title: "✅ حُذفت" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const addItem = useMutation({
    mutationFn: (label: string) => mut("POST", "/api/repair-checklist-items", { label_ar: label, sort_order: 99 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/repair-checklist-items"] }); toast({ title: "✅ أُضيف البند" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });
  const editItem = useMutation({
    mutationFn: ({ id, label_ar }: { id: number; label_ar: string }) => mut("PATCH", `/api/repair-checklist-items/${id}`, { label_ar }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/repair-checklist-items"] }),
  });
  const delItem = useMutation({
    mutationFn: (id: number) => mut("DELETE", `/api/repair-checklist-items/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/repair-checklist-items"] }); toast({ title: "✅ حُذف" }); },
  });

  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("#a855f7");
  const [newItemLabel, setNewItemLabel] = useState("");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <h2 className="font-black text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-violet-400" /> إعدادات الصيانة
        </h2>
        <button onClick={onClose} className="btn-icon text-white/40"><XCircle className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-2 px-4 py-2 border-b border-white/5">
        <button onClick={() => setTab("statuses")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === "statuses" ? "bg-violet-500/20 text-violet-300" : "text-white/50"}`}>
          حالات الطلب ({statuses.length})
        </button>
        <button onClick={() => setTab("checklist")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === "checklist" ? "bg-violet-500/20 text-violet-300" : "text-white/50"}`}>
          بنود الفحص ({checklistTemplate.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === "statuses" && (
          <>
            <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
              <p className="text-[10px] text-white/40 font-bold">إضافة حالة جديدة</p>
              <div className="flex gap-2">
                <input value={newStatusLabel} onChange={(e) => setNewStatusLabel(e.target.value)}
                  placeholder="اسم الحالة" className="erp-input flex-1 text-sm" />
                <input type="color" value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-10 h-10 rounded-xl bg-transparent border border-white/10" />
                <button onClick={() => { if (newStatusLabel.trim()) { addStatus.mutate({ label_ar: newStatusLabel, color: newStatusColor }); setNewStatusLabel(""); }}}
                  className="btn-icon text-violet-300 hover:bg-violet-500/20"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            {statuses.map(s => (
              <div key={s.id} className="glass-panel rounded-xl p-2.5 border border-white/5 flex items-center gap-2">
                <input type="color" value={s.color} onChange={(e) => editStatus.mutate({ id: s.id, color: e.target.value })}
                  disabled={s.is_system} className="w-8 h-8 rounded-lg bg-transparent border border-white/10" />
                <input defaultValue={s.label_ar} onBlur={(e) => e.target.value !== s.label_ar && editStatus.mutate({ id: s.id, label_ar: e.target.value })}
                  disabled={s.is_system} className="erp-input flex-1 text-sm" />
                {s.is_system && <span className="text-[10px] text-white/30">نظام</span>}
                {!s.is_system && (
                  <button onClick={() => delStatus.mutate(s.id)} className="btn-icon text-red-400/60 hover:text-red-400 w-7 h-7">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "checklist" && (
          <>
            <div className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2">
              <p className="text-[10px] text-white/40 font-bold">إضافة بند فحص جديد</p>
              <div className="flex gap-2">
                <input value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)}
                  placeholder="مثل: مستشعر القرب" className="erp-input flex-1 text-sm" />
                <button onClick={() => { if (newItemLabel.trim()) { addItem.mutate(newItemLabel); setNewItemLabel(""); }}}
                  className="btn-icon text-violet-300 hover:bg-violet-500/20"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            {checklistTemplate.map(item => (
              <div key={item.id} className="glass-panel rounded-xl p-2.5 border border-white/5 flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-white/30" />
                <input defaultValue={item.label_ar} onBlur={(e) => e.target.value !== item.label_ar && editItem.mutate({ id: item.id, label_ar: e.target.value })}
                  className="erp-input flex-1 text-sm" />
                {item.is_system && <span className="text-[10px] text-white/30">نظام</span>}
                <button onClick={() => delItem.mutate(item.id)} className="btn-icon text-red-400/60 hover:text-red-400 w-7 h-7">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-white/30 text-[10px]">{label}: </span>
      <span className={`text-white/80 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

