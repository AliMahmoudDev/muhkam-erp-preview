import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { PaginationBar } from '@/components/PaginationBar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Plus,
  Search,
  AlertCircle,
  Settings,
  LayoutGrid,
  List,
  ScanLine,
} from 'lucide-react';
const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner'));
const RepairSettingsModal = lazy(() => import('@/components/RepairSettingsModal'));
const JobDetail = lazy(() => import('./repairs/JobDetail').then((m) => ({ default: m.JobDetail })));
const NewJobForm = lazy(() =>
  import('./repairs/NewJobForm').then((m) => ({ default: m.NewJobForm }))
);
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';
import { REPAIR_SETTING_KEYS, REPAIR_WA_DEFAULTS } from '@/components/repair-settings/constants';
import {
  RepairJob,
  ChecklistItem,
  Stats,
  DashboardData,
  DashboardCard,
  DEFAULT_CHECKLIST,
  STATUS_MAP,
  STATUS_BORDER,
  STATUS_BAR_COLOR,
  CARD_ICON_REGISTRY,
  computeScore,
  applyTemplate,
  useRepairSettings,
} from './repairs/repairConstants';
import { StatusBadge } from './repairs/repairComponents';
import DashboardCardsSection from './repairs/DashboardCardsSection';

/* ── Main Page ──────────────────────────────────────────────── */
export default function Repairs() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [repairPage, setRepairPage] = useState(1);
  const REPAIR_PAGE_SIZE = 30;
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showScanner, setShowScanner] = useState(false);

  const handleQrDetected = useCallback((code: string) => {
    let jobRef = code.trim();
    try {
      const url = new URL(code);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) jobRef = parts[parts.length - 1];
    } catch {
      /* not a URL — use raw value */
    }
    setSearch(jobRef);
    setShowScanner(false);
  }, []);

  /* ── helper ── */
  async function apiFetch<T>(url: string): Promise<T> {
    const r = await authFetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  }

  /* ── Queries ── */
  useQuery<Stats>({
    queryKey: ['/api/repair-jobs/stats'],
    queryFn: () => apiFetch<Stats>(api('/api/repair-jobs/stats')),
    refetchInterval: 30000,
  });

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['/api/repair-dashboard'],
    queryFn: () => apiFetch<DashboardData>(api('/api/repair-dashboard')),
    refetchInterval: 30000,
  });

  const { data: jobs = [], isLoading } = useQuery<RepairJob[]>({
    queryKey: ['/api/repair-jobs', statusFilter, search, techFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (techFilter) params.set('technician_id', techFilter);
      return apiFetch<RepairJob[]>(api(`/api/repair-jobs?${params}`));
    },
    select: (d) => (Array.isArray(d) ? d : []),
  });

  useEffect(() => {
    setRepairPage(1);
  }, [search, techFilter, statusFilter]);

  const paginatedJobs = useMemo(
    () => jobs.slice((repairPage - 1) * REPAIR_PAGE_SIZE, repairPage * REPAIR_PAGE_SIZE),
    [jobs, repairPage, REPAIR_PAGE_SIZE]
  );

  const { data: users = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/repair-jobs/technicians'],
    queryFn: () => apiFetch<{ id: number; name: string }[]>(api('/api/repair-jobs/technicians')),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: customers = [] } = useQuery<{ id: number; name: string; phone?: string }[]>({
    queryKey: ['/api/customers'],
    queryFn: () => apiFetch<{ id: number; name: string; phone?: string }[]>(api('/api/customers')),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: branches = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/branches'],
    queryFn: () => apiFetch<{ id: number; name: string }[]>(api('/api/branches')),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: jobDetail } = useQuery<RepairJob>({
    queryKey: ['/api/repair-jobs', selectedJob?.id],
    queryFn: () => apiFetch<RepairJob>(api(`/api/repair-jobs/${selectedJob!.id}`)),
    enabled: !!selectedJob?.id,
  });

  const detail = jobDetail ?? selectedJob;

  const detailDeviceType = detail?.device_type || 'general';
  const { data: checklistTemplate = [] } = useQuery<
    { id: number; label_ar: string; sort_order: number; category: string }[]
  >({
    queryKey: ['/api/repair-checklist-items', detailDeviceType],
    queryFn: () =>
      apiFetch<{ id: number; label_ar: string; sort_order: number; category: string }[]>(
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
      category: t.category ?? 'عام',
      status: null,
    }));
  }, [checklistTemplate]);

  const parsedChecklist = useMemo(() => {
    try {
      const v = detail?.checklist ? JSON.parse(detail.checklist) : null;
      if (!Array.isArray(v)) return templateChecklist;
      if (v.length === 1 && v[0].id === '__power_off__') {
        return [
          { id: '__power_off__', label: 'الجهاز لا يفتح ولا يشتغل', status: 'fail' as const },
        ];
      }
      const templateMap: Record<string, ChecklistItem> = {};
      templateChecklist.forEach((t) => {
        templateMap[t.id] = t;
      });
      const items: ChecklistItem[] = v
        .map(
          (c: {
            id?: string | number;
            item_id?: string | number;
            label?: string;
            category?: string;
            status: string;
            notes?: string;
          }) => {
            const id = String(c.id ?? c.item_id ?? '');
            if (!id) return null;
            const t = templateMap[id];
            const status = c.status === 'na' ? 'untestable' : (c.status as ChecklistItem['status']);
            return {
              id,
              label: c.label ?? t?.label ?? `بند ${id}`,
              category: c.category ?? t?.category ?? 'عام',
              status,
              notes: c.notes,
            } as ChecklistItem;
          }
        )
        .filter((x): x is ChecklistItem => x !== null);
      return items.length ? items : templateChecklist;
    } catch {
      return templateChecklist;
    }
  }, [detail?.checklist, templateChecklist]);

  const checklist: ChecklistItem[] = parsedChecklist;
  const score = useMemo(() => computeScore(checklist), [checklist]);

  /* ── Mutations ── */
  const patchJob = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      authFetch(api(`/api/repair-jobs/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['/api/repair-jobs'] });
      qc.invalidateQueries({ queryKey: ['/api/repair-jobs', updated.id] });
      setSelectedJob(updated);
      toast({ title: '✅ تم الحفظ' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteJob = useMutation({
    mutationFn: (id: number) => authFetch(api(`/api/repair-jobs/${id}`), { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/repair-jobs'] });
      qc.invalidateQueries({ queryKey: ['/api/repair-jobs/stats'] });
      setSelectedJob(null);
      toast({ title: '✅ تم الحذف' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const toggleCheck = (itemId: string, newStatus: ChecklistItem['status'], notes = '') => {
    if (!detail) return;
    const updated = checklist.map((c) =>
      c.id === itemId ? { ...c, status: newStatus, notes: notes || c.notes } : c
    );
    patchJob.mutate({
      id: detail.id,
      data: { checklist: updated, device_score: computeScore(updated) },
    });
  };

  const sendWhatsApp = (job: RepairJob, msg: string) => {
    if (!job.customer_phone) {
      toast({ title: 'لا يوجد رقم هاتف', variant: 'destructive' });
      return;
    }
    const phone = job.customer_phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('0') ? '2' + phone : phone;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const repairSettings = useRepairSettings();

  const buildWaVars = (job: RepairJob) => ({
    اسم_العميل: job.customer_name,
    رقم_البطاقة: job.job_no,
    الماركة: job.device_brand,
    الموديل: job.device_model,
    الحالة: STATUS_MAP[job.status]?.label ?? job.status,
    التكلفة: formatCurrency(Number(job.final_cost ?? job.estimated_cost ?? 0)),
  });

  const whatsAppReady = (job: RepairJob) =>
    applyTemplate(
      repairSettings[REPAIR_SETTING_KEYS.waReady] || REPAIR_WA_DEFAULTS.ready,
      buildWaVars(job)
    );

  const whatsAppProgress = (job: RepairJob) =>
    applyTemplate(
      repairSettings[REPAIR_SETTING_KEYS.waProgress] || REPAIR_WA_DEFAULTS.progress,
      buildWaVars(job)
    );

  return (
    <div className="flex h-full gap-0" dir="rtl">
      {/* ══ RIGHT PANEL — List ══ */}
      <div
        className={`flex flex-col gap-3 p-4 overflow-y-auto transition-all ${selectedJob ? 'hidden md:flex md:w-[340px] shrink-0' : 'flex flex-1'}`}
        style={{ borderLeft: selectedJob ? '1px solid var(--erp-border)' : undefined }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-ink flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            بطاقات الصيانة
          </h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSettings(true)}
              title="إعدادات بنود الفحص"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface border border-line text-ink/40 hover:text-ink/70 text-xs transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowNewForm(true);
                setSelectedJob(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300 text-xs font-bold transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> بطاقة جديدة
            </button>
          </div>
        </div>

        {showSettings && (
          <Suspense fallback={null}>
            <RepairSettingsModal onClose={() => setShowSettings(false)} />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <BarcodeScanner
            open={showScanner}
            onClose={() => setShowScanner(false)}
            onDetected={handleQrDetected}
          />
        </Suspense>

        {/* Dashboard cards */}
        <DashboardCardsSection
          dashboard={dashboard}
          activeStatusFilter={statusFilter}
          onCardClick={(card: DashboardCard) => {
            const next = card.statuses.join(',');
            setStatusFilter((prev) => (prev === next ? 'all' : next));
          }}
          onStatusClick={(s: string) => setStatusFilter((prev) => (prev === s ? 'all' : s))}
        />

        {/* Search row */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="رقم / اسم / هاتف / IMEI..."
              className="erp-input w-full icon-pr icon-pl text-sm"
            />
            <button
              onClick={() => setShowScanner(true)}
              title="مسح QR"
              className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/30 hover:text-amber-400 transition-colors"
            >
              <ScanLine className="w-3.5 h-3.5" />
            </button>
          </div>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="erp-input text-sm flex-1"
          >
            <option value="">— كل الفنيين —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {!selectedJob && (
            <div className="flex gap-0.5 bg-surface rounded-xl border border-line p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                title="عرض قائمة"
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-amber-500/20 text-amber-300' : 'text-ink/30 hover:text-ink/60'}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="عرض شبكة"
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-amber-500/20 text-amber-300' : 'text-ink/30 hover:text-ink/60'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-150 ${
              statusFilter === 'all'
                ? 'bg-surface border-line text-ink shadow-sm'
                : 'border-line text-ink/35 hover:text-ink/60 hover:border-line'
            }`}
          >
            الكل
            {dashboard?.total_all != null && (
              <span className="text-[10px] font-mono opacity-60">{dashboard.total_all}</span>
            )}
          </button>
          {(Array.isArray(dashboard?.cards) ? dashboard!.cards : []).map((card) => {
            const Icon = CARD_ICON_REGISTRY[card.icon] ?? Wrench;
            const value = (Array.isArray(card.statuses) ? card.statuses : []).join(',');
            const isActive = statusFilter === value;
            return (
              <button
                key={card.id}
                onClick={() => setStatusFilter((prev) => (prev === value ? 'all' : value))}
                title={card.name}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-150"
                style={{
                  background: isActive ? `${card.color}26` : 'transparent',
                  borderColor: isActive ? `${card.color}88` : `${card.color}33`,
                  color: isActive ? 'var(--text-1)' : `${card.color}cc`,
                  boxShadow: isActive ? `0 0 0 1px ${card.color}55` : undefined,
                }}
              >
                <Icon className="w-3 h-3 shrink-0" style={{ color: card.color }} />
                <span className="truncate max-w-[120px]">{card.name}</span>
                <span className="text-[10px] font-mono opacity-70">{card.count}</span>
              </button>
            );
          })}
        </div>

        {/* Loading / empty states */}
        {isLoading && <div className="text-center text-ink/30 text-sm py-8">جاري التحميل...</div>}
        {!isLoading && jobs.length === 0 && (
          <div className="text-center text-ink/30 text-sm py-8 flex flex-col items-center gap-2">
            <Wrench className="w-8 h-8 opacity-20" />
            لا توجد بطاقات صيانة
          </div>
        )}

        {/* LIST VIEW — compact when a job is selected (narrow panel) */}
        {!isLoading && jobs.length > 0 && viewMode === 'list' && selectedJob && (
          <div className="flex flex-col gap-1">
            {jobs.map((job) => {
              const isActive = selectedJob?.id === job.id;
              const s = STATUS_MAP[job.status] ?? {
                label: job.status,
                color: 'text-ink/50',
                bg: '',
                icon: AlertCircle,
              };
              const barColor = STATUS_BAR_COLOR[job.status] ?? 'bg-surface';
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job);
                    setShowNewForm(false);
                  }}
                  className={`relative rounded-2xl border cursor-pointer transition-all duration-150 overflow-hidden group ${
                    isActive
                      ? `${STATUS_BORDER[job.status] ?? 'border-line'} bg-surface shadow-lg`
                      : 'border-line hover:border-line hover:bg-surface'
                  }`}
                >
                  <div className={`absolute top-0 right-0 bottom-0 w-[3px] ${barColor}`} />
                  <div className="pr-3 pl-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border leading-none ${s.color} ${s.bg}`}
                          >
                            {s.label}
                          </span>
                          <span className="text-[9px] text-ink/20 font-mono">{job.job_no}</span>
                        </div>
                        <p className="font-black text-ink text-[13px] leading-tight truncate">
                          {job.customer_name}
                        </p>
                        <p className="text-ink/40 text-[11px] mt-0.5 truncate">
                          {job.device_brand} {job.device_model}
                        </p>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-sm font-black text-ink">
                          {formatCurrency(Number(job.final_cost ?? job.estimated_cost))}
                        </p>
                        {job.device_score != null && (
                          <p
                            className={`text-[10px] font-bold text-right ${job.device_score >= 80 ? 'text-emerald-400' : job.device_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}
                          >
                            {job.device_score}%
                          </p>
                        )}
                      </div>
                    </div>
                    {job.technician_name && (
                      <p className="text-[9px] text-ink/25 mt-1 truncate">
                        {job.technician_name} · {job.received_at}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW — full table when no job selected */}
        {!isLoading && jobs.length > 0 && viewMode === 'list' && !selectedJob && (
          <div
            className="rounded-2xl border border-line overflow-hidden"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div className="overflow-x-auto">
              <table dir="rtl" className="w-full text-right">
                <thead>
                  <tr
                    className="border-b border-line"
                    style={{ background: 'var(--erp-bg-hover)' }}
                  >
                    {[
                      'رقم الطلب',
                      'التاريخ',
                      'الحالة',
                      'العميل',
                      'الهاتف',
                      'الجهاز',
                      'العطل',
                      'الفني',
                      'التكلفة',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-[10px] font-bold text-ink/35 whitespace-nowrap tracking-wider uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {paginatedJobs.map((job) => {
                    const barColor = STATUS_BAR_COLOR[job.status] ?? 'bg-surface';
                    return (
                      <tr
                        key={job.id}
                        onClick={() => {
                          setSelectedJob(job);
                          setShowNewForm(false);
                        }}
                        className="cursor-pointer transition-all duration-100 hover:bg-surface group"
                      >
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-0.5 h-5 rounded-full ${barColor}`} />
                            <span className="text-[11px] font-mono text-ink/50 group-hover:text-ink/80 transition-colors">
                              {job.job_no}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-ink/30 whitespace-nowrap">
                          {job.received_at}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-3 py-3 max-w-[160px]">
                          <p className="text-[13px] font-black text-ink truncate group-hover:text-ink transition-colors">
                            {job.customer_name}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-ink/40 font-mono whitespace-nowrap">
                          {job.customer_phone || '—'}
                        </td>
                        <td className="px-3 py-3 max-w-[150px]">
                          <p className="text-[11px] text-ink/60 truncate">
                            {[job.device_brand, job.device_model].filter(Boolean).join(' ') || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-3 max-w-[180px]">
                          <p className="text-[11px] text-ink/35 truncate italic">
                            {job.problem_description || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-ink/45 whitespace-nowrap truncate max-w-[120px]">
                          {job.technician_name || '—'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="text-[13px] font-black text-ink">
                            {formatCurrency(Number(job.final_cost ?? job.estimated_cost))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GRID VIEW */}
        {!isLoading && jobs.length > 0 && viewMode === 'grid' && !selectedJob && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {paginatedJobs.map((job) => {
              const s = STATUS_MAP[job.status] ?? {
                label: job.status,
                color: 'text-ink/60',
                bg: 'bg-surface border-line',
                icon: AlertCircle,
              };
              const StatusIcon = s.icon;
              const barColor = STATUS_BAR_COLOR[job.status] ?? 'bg-surface';
              const borderColor = STATUS_BORDER[job.status] ?? 'border-line';
              const cost = Number(job.final_cost ?? job.estimated_cost);
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job);
                    setShowNewForm(false);
                  }}
                  className={`relative rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden flex flex-col group hover:-translate-y-0.5 hover:shadow-xl ${borderColor}`}
                  style={{ background: 'var(--bg-elevated)', backdropFilter: 'blur(10px)' }}
                >
                  <div className={`h-[3px] w-full ${barColor}`} />
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border text-[9px] font-bold leading-none ${s.color} ${s.bg}`}
                      >
                        <StatusIcon className="w-2 h-2" />
                        {s.label}
                      </span>
                      {job.device_score != null && (
                        <span
                          className={`text-[10px] font-black tabular-nums ${job.device_score >= 80 ? 'text-emerald-400' : job.device_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}
                        >
                          {job.device_score}%
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-black text-ink text-sm leading-tight truncate group-hover:text-ink transition-colors">
                        {job.customer_name}
                      </p>
                      <p className="text-[10px] text-ink/40 truncate mt-0.5">
                        {[job.device_brand, job.device_model].filter(Boolean).join(' ') || '—'}
                      </p>
                    </div>
                    {job.problem_description && (
                      <p
                        className="text-[10px] text-ink/30 truncate italic leading-tight"
                        title={job.problem_description}
                      >
                        {job.problem_description}
                      </p>
                    )}
                    <div className="flex-1" />
                    <div className="pt-2 border-t border-line flex items-end justify-between gap-1">
                      <div>
                        <p className="text-base font-black text-ink leading-none tabular-nums">
                          {formatCurrency(cost)}
                        </p>
                        {job.technician_name && (
                          <p className="text-[9px] text-ink/25 mt-1 truncate max-w-[100px]">
                            {job.technician_name}
                          </p>
                        )}
                      </div>
                      <p className="text-[9px] text-ink/20 font-mono shrink-0">
                        {job.received_at?.slice(5)}
                      </p>
                    </div>
                    <p className="text-[9px] text-ink/15 font-mono leading-none tracking-wider">
                      {job.job_no}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && jobs.length > 0 && !selectedJob && (
          <PaginationBar
            page={repairPage}
            totalItems={jobs.length}
            pageSize={REPAIR_PAGE_SIZE}
            onPageChange={setRepairPage}
            itemLabel="بطاقة إصلاح"
          />
        )}
      </div>

      {/* ══ LEFT PANEL — Detail / New Form ══ */}
      {(selectedJob || showNewForm) && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <Suspense
            fallback={
              <div className="p-6 text-center text-ink/40 text-sm">جاري تحميل التفاصيل...</div>
            }
          >
            {selectedJob ? (
              <JobDetail
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
            ) : (
              <NewJobForm
                customers={customers}
                users={users}
                branches={branches}
                onClose={() => setShowNewForm(false)}
                onCreated={(job) => {
                  qc.invalidateQueries({ queryKey: ['/api/repair-jobs'] });
                  qc.invalidateQueries({ queryKey: ['/api/repair-jobs/stats'] });
                  setShowNewForm(false);
                  setSelectedJob(job);
                  toast({ title: `✅ تم إنشاء بطاقة ${job.job_no}` });
                }}
              />
            )}
          </Suspense>
        </div>
      )}
    </div>
  );
}
