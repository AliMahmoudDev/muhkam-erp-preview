import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, AlertTriangle, Wrench, TrendingUp, Smartphone } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

interface RepairJob {
  id: number; job_no: string; customer_name: string;
  device_brand: string; device_model: string;
  status: string; technician_name?: string;
  estimated_cost: string; final_cost: string; deposit_paid: string;
  device_score?: number; received_at: string;
}

interface RepairStatus { id: number; key: string; label_ar: string; color: string; sort_order: number }
interface ByBrand { brand: string; count: number }
interface Stats {
  total: number; today_count: number;
  by_status: { key: string; label: string; color: string; count: number }[];
  by_brand: ByBrand[];
  total_revenue: number;
  avg_repair_days: number;
  active_technicians: number;
}

export default function RepairBoard() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/repair-jobs/stats"],
    queryFn: async () => { const r = await authFetch(api("/api/repair-jobs/stats")); return r.json(); },
    refetchInterval: 30000,
  });

  const { data: statuses = [] } = useQuery<RepairStatus[]>({
    queryKey: ["/api/repair-statuses"],
    queryFn: async () => { const r = await authFetch(api("/api/repair-statuses")); return r.json(); },
  });

  const { data: jobs = [] } = useQuery<RepairJob[]>({
    queryKey: ["/api/repair-jobs"],
    queryFn: async () => { const r = await authFetch(api("/api/repair-jobs")); return r.json(); },
    refetchInterval: 30000,
  });

  const { data: alerts = [] } = useQuery<RepairJob[]>({
    queryKey: ["/api/repair-jobs/alerts"],
    queryFn: async () => { const r = await authFetch(api("/api/repair-jobs/alerts?days=7")); return r.json(); },
  });

  const maxBrandCount = Math.max(1, ...(stats?.by_brand ?? []).map(b => b.count));

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-violet-400" />لوحة الصيانة
        </h1>
        <Link href="/repairs"
          className="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-bold">
          فتح بطاقات الصيانة
        </Link>
      </div>

      {alerts.length > 0 && (
        <div className="glass-panel rounded-xl p-3 border border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div className="flex-1">
            <div className="text-amber-300 font-bold text-sm">{alerts.length} جهاز في المركز أكثر من 7 أيام</div>
            <div className="text-amber-300/70 text-xs">يحتاج متابعة عاجلة</div>
          </div>
        </div>
      )}

      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-white/40">إجمالي البطاقات</p>
          <p className="text-2xl font-black text-white">{stats?.total ?? 0}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-white/40">اليوم</p>
          <p className="text-2xl font-black text-violet-400">{stats?.today_count ?? 0}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-white/40">إجمالي الإيرادات</p>
          <p className="text-2xl font-black text-emerald-400">{formatCurrency(stats?.total_revenue ?? 0)}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-white/40">متوسط مدة الإصلاح</p>
          <p className="text-2xl font-black text-amber-400">{stats?.avg_repair_days ?? 0} يوم</p>
        </div>
      </div>

      {/* Status counts */}
      <div className="glass-panel rounded-2xl p-4 border border-white/5">
        <h2 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Wrench className="w-4 h-4 text-violet-400" />البطاقات حسب الحالة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {(stats?.by_status ?? []).map(s => (
            <div key={s.key} className="rounded-xl p-3 border-2 text-center transition-all hover:scale-105"
              style={{ borderColor: s.color + "40", background: s.color + "10" }}>
              <div className="text-3xl font-black" style={{ color: s.color }}>{s.count}</div>
              <div className="text-[11px] text-white/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand demographics chart */}
      <div className="glass-panel rounded-2xl p-4 border border-white/5">
        <h2 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><Smartphone className="w-4 h-4 text-violet-400" />ديموغرافية الأجهزة (الماركات الأكثر)</h2>
        {(stats?.by_brand ?? []).length === 0 ? (
          <p className="text-center text-white/30 text-sm py-4">لا توجد بيانات</p>
        ) : (
          <div className="space-y-2">
            {(stats?.by_brand ?? []).slice(0, 8).map(b => (
              <div key={b.brand} className="flex items-center gap-3">
                <div className="w-20 text-xs text-white/70 text-left font-bold">{b.brand}</div>
                <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-l from-violet-500 to-violet-300 rounded-full transition-all flex items-center justify-end px-2"
                    style={{ width: `${(b.count / maxBrandCount) * 100}%` }}>
                    <span className="text-[10px] font-bold text-white">{b.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kanban columns by status (compact) */}
      <div className="glass-panel rounded-2xl p-4 border border-white/5">
        <h2 className="font-bold text-white text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-400" />سير العمل</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {statuses.slice(0, 5).map(s => {
            const list = jobs.filter(j => j.status === s.key);
            return (
              <div key={s.key} className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
                <div className="px-2 py-1.5 border-b border-white/10 font-bold text-[11px] flex items-center justify-between"
                  style={{ color: s.color, background: s.color + "15" }}>
                  <span>{s.label_ar}</span><span>{list.length}</span>
                </div>
                <div className="p-1.5 space-y-1 max-h-64 overflow-y-auto">
                  {list.slice(0, 6).map(j => (
                    <Link key={j.id} href="/repairs"
                      className="block rounded-lg p-1.5 bg-white/5 hover:bg-white/10 cursor-pointer">
                      <div className="text-[10px] font-mono text-white/40">{j.job_no}</div>
                      <div className="text-xs text-white truncate">{j.customer_name}</div>
                      <div className="text-[10px] text-white/50 truncate">{j.device_brand} {j.device_model}</div>
                    </Link>
                  ))}
                  {list.length === 0 && <p className="text-[10px] text-white/20 text-center py-2">لا يوجد</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
