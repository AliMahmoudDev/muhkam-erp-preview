import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/hooks/use-toast';
import { ConfirmModal } from '@/components/confirm-modal';
import {
  Plus, Pencil, Trash2, GitBranch, MapPin, Phone,
  CheckCircle2, XCircle, Building2, Warehouse, Vault,
  AlertCircle, ChevronRight, Users, ShoppingCart,
  Wrench, TrendingDown, TrendingUp, ArrowRight, UserCheck,
  UserX, BadgeDollarSign, Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';

/* ── Types ─────────────────────────────────────────────────────── */
interface Branch {
  id: number;
  company_id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  warehouse_count: number;
  safe_count: number;
}

interface BranchesResponse {
  branches: Branch[];
  unlinked_warehouses: number;
  unlinked_safes: number;
}

interface EmployeeRow {
  id: number;
  name: string;
  employee_code: string;
  employment_status: string;
  salary: string;
  currency: string;
  salary_type: string;
  hire_date: string;
  phone: string | null;
}

interface WarehouseRow {
  id: number;
  name: string;
  address: string | null;
}

interface SafeRow {
  id: number;
  name: string;
  balance: string;
}

interface BranchOverview {
  branch: Branch;
  employees: EmployeeRow[];
  warehouses: WarehouseRow[];
  safes: SafeRow[];
  stats_30d: {
    sales_count: number;
    sales_total: number;
    repairs_count: number;
    expenses_total: number;
    income_total: number;
  };
}

const EMPTY_FORM = { name: '', address: '', phone: '', is_active: true };

const fmt = (n: number, currency = 'EGP') =>
  n.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + currency;

/* ── Main Page ─────────────────────────────────────────────────── */
export default function Branches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const [deleteId, setDeleteId]       = useState<number | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  /* ── Query ────────────────────────────────────────────────── */
  const { data: resp, isLoading } = useQuery<BranchesResponse>({
    queryKey: ['/api/branches'],
    queryFn: async () => {
      const r = await authFetch(api('/api/branches'));
      if (!r.ok) throw new Error('خطأ في جلب الفروع');
      const json = await r.json();
      if (Array.isArray(json)) return { branches: json, unlinked_warehouses: 0, unlinked_safes: 0 };
      return json;
    },
  });

  const branches: Branch[]  = safeArray(resp?.branches);
  const unlinkedW           = resp?.unlinked_warehouses ?? 0;
  const unlinkedS           = resp?.unlinked_safes      ?? 0;
  const selectedBranch      = branches.find((b) => b.id === selectedId) ?? null;

  /* ── Mutations ────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: async (body: { name: string; address?: string; phone?: string; is_active: boolean }) => {
      const r = await authFetch(api('/api/branches'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'خطأ'); }
      return r.json();
    },
    onSuccess: () => { toast({ title: 'تم إنشاء الفرع بنجاح' }); qc.invalidateQueries({ queryKey: ['/api/branches'] }); resetForm(); },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<typeof EMPTY_FORM> }) => {
      const r = await authFetch(api(`/api/branches/${id}`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'خطأ'); }
      return r.json();
    },
    onSuccess: () => { toast({ title: 'تم تحديث الفرع بنجاح' }); qc.invalidateQueries({ queryKey: ['/api/branches'] }); resetForm(); },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/branches/${id}`), { method: 'DELETE' });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'خطأ'); }
    },
    onSuccess: () => {
      toast({ title: 'تم حذف الفرع' });
      qc.invalidateQueries({ queryKey: ['/api/branches'] });
      setDeleteId(null);
      if (selectedId === deleteId) setSelectedId(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  /* ── Helpers ──────────────────────────────────────────────── */
  function resetForm() { setForm(EMPTY_FORM); setShowForm(false); setEditId(null); }

  function startEdit(b: Branch) {
    setForm({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', is_active: b.is_active });
    setEditId(b.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: 'اسم الفرع مطلوب', variant: 'destructive' }); return; }
    const body = { name: form.name.trim(), address: form.address.trim() || undefined, phone: form.phone.trim() || undefined, is_active: form.is_active };
    if (editId !== null) updateMutation.mutate({ id: editId, body });
    else createMutation.mutate({ ...body, is_active: true });
  }

  const activeBranches   = branches.filter((b) => b.is_active).length;
  const totalW = branches.reduce((s, b) => s + (b.warehouse_count ?? 0), 0) + unlinkedW;
  const totalS = branches.reduce((s, b) => s + (b.safe_count ?? 0), 0)     + unlinkedS;

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="flex h-full overflow-hidden" dir="rtl">

      {/* ══ Sidebar: Branch List ══════════════════════════════ */}
      <div className={`flex flex-col border-l border-[var(--erp-border)] transition-all duration-200 ${selectedId ? 'w-72 shrink-0' : 'flex-1'}`}>

        {/* Header */}
        <div className="shrink-0 px-4 pt-5 pb-4 border-b border-[var(--erp-border)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h1 className="text-base font-bold text-ink">إدارة الفروع</h1>
                <p className="text-[10px] text-ink/40">إنشاء وإدارة فروع الشركة</p>
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => { resetForm(); setShowForm(true); }}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-xl transition-colors">
                <Plus className="w-3.5 h-3.5" /> جديد
              </button>
            )}
          </div>

          {/* Stats mini-row */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'الكل',   value: branches.length,  color: '#F59E0B' },
              { label: 'نشط',    value: activeBranches,   color: '#10B981' },
              { label: 'مخازن',  value: totalW,           color: '#60A5FA' },
              { label: 'خزائن',  value: totalS,           color: '#A78BFA' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg p-2 text-center border border-[var(--erp-border)]" style={{ background: s.color + '10' }}>
                <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-ink/40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Unlinked warning */}
        {(unlinkedW > 0 || unlinkedS > 0) && (
          <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl p-2.5 bg-amber-500/8 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-amber-300/80 leading-relaxed">
              {unlinkedW > 0 && `${unlinkedW} مخزن`}{unlinkedW > 0 && unlinkedS > 0 && ' و'}{unlinkedS > 0 && ` ${unlinkedS} خزينة`} غير مربوطة بفرع
            </p>
          </div>
        )}

        {/* Form */}
        {showForm && isAdmin && (
          <div className="mx-3 mt-3 rounded-xl p-3.5 border border-amber-500/25" style={{ background: 'rgba(245,158,11,0.05)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-ink">{editId !== null ? 'تعديل الفرع' : 'فرع جديد'}</p>
              <button onClick={resetForm} className="text-[10px] text-ink/40 hover:text-ink/60">إلغاء</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="اسم الفرع *" required className="erp-input w-full text-xs" />
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="العنوان" className="erp-input w-full text-xs" />
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                placeholder="01xxxxxxxxx" inputMode="numeric" className="erp-input w-full text-xs" />
              {editId !== null && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-amber-500' : 'bg-raised'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_active ? '-translate-x-5' : '-translate-x-1'}`} />
                  </button>
                  <span className="text-[10px] text-ink/50">{form.is_active ? 'نشط' : 'موقوف'}</span>
                </div>
              )}
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors disabled:opacity-50">
                {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : editId !== null ? 'حفظ' : 'إنشاء'}
              </button>
            </form>
          </div>
        )}

        {/* Branch List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : branches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch className="w-10 h-10 text-ink/10 mb-3" />
              <p className="text-xs text-ink/30">لا توجد فروع</p>
              {isAdmin && (
                <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-amber-400 hover:text-amber-300">أضف أول فرع</button>
              )}
            </div>
          ) : (
            branches.map((b) => (
              <button key={b.id} onClick={() => setSelectedId(b.id === selectedId ? null : b.id)}
                className={`w-full text-right rounded-xl p-3 border transition-all ${b.id === selectedId ? 'border-amber-500/40 bg-amber-500/8' : 'border-[var(--erp-border)] hover:border-amber-500/20 bg-[var(--erp-bg-card)]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${b.is_active ? 'bg-amber-500/15' : 'bg-surface'}`}>
                      <Building2 className={`w-4 h-4 ${b.is_active ? 'text-amber-400' : 'text-ink/20'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-ink text-sm truncate">{b.name}</p>
                      {b.address && <p className="text-[10px] text-ink/40 truncate">{b.address}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${b.is_active ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                      {b.is_active ? 'نشط' : 'موقوف'}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-ink/20 transition-transform ${b.id === selectedId ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-line">
                  <span className="flex items-center gap-1 text-[10px] text-blue-400/70">
                    <Warehouse className="w-3 h-3" /> {b.warehouse_count ?? 0} مخزن
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-purple-400/70">
                    <Vault className="w-3 h-3" /> {b.safe_count ?? 0} خزينة
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ══ Detail Panel ═════════════════════════════════════ */}
      {selectedBranch ? (
        <div className="flex-1 overflow-hidden flex flex-col border-r border-[var(--erp-border)]">
          <BranchDetail
            branch={selectedBranch}
            isAdmin={isAdmin}
            onEdit={() => startEdit(selectedBranch)}
            onDelete={() => setDeleteId(selectedBranch.id)}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center mb-4">
            <ArrowRight className="w-7 h-7 text-amber-500/40" />
          </div>
          <p className="text-ink/30 font-medium text-sm">اختر فرعاً من القائمة</p>
          <p className="text-ink/20 text-xs mt-1">لعرض التفاصيل الكاملة — الموظفون، المخازن، الخزائن، والإحصاءات</p>
        </div>
      )}

      {deleteId !== null && (
        <ConfirmModal
          title="حذف الفرع"
          description="هل أنت متأكد من حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء."
          confirmLabel="حذف"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

/* ══ BranchDetail component ══════════════════════════════════════ */
type Tab = 'overview' | 'employees' | 'warehouses' | 'safes';

function BranchDetail({
  branch, isAdmin, onEdit, onDelete,
}: {
  branch: Branch;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');

  const { data, isLoading } = useQuery<BranchOverview>({
    queryKey: [`/api/branches/${branch.id}/overview`],
    queryFn: async () => {
      const r = await authFetch(api(`/api/branches/${branch.id}/overview`));
      if (!r.ok) throw new Error('خطأ في جلب التفاصيل');
      return r.json();
    },
  });

  const TABS: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview',   label: 'نظرة عامة', icon: Building2 },
    { key: 'employees',  label: 'الموظفون',  icon: Users,     count: data?.employees.length },
    { key: 'warehouses', label: 'المخازن',   icon: Warehouse, count: data?.warehouses.length },
    { key: 'safes',      label: 'الخزائن',   icon: Vault,     count: data?.safes.length },
  ];

  return (
    <>
      {/* Top bar */}
      <div className="shrink-0 px-5 pt-4 pb-0 border-b border-[var(--erp-border)]">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${branch.is_active ? 'bg-amber-500/15' : 'bg-surface'}`}>
              <Building2 className={`w-5 h-5 ${branch.is_active ? 'text-amber-400' : 'text-ink/30'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">{branch.name}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${branch.is_active ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
                  {branch.is_active ? <><CheckCircle2 className="w-2.5 h-2.5 inline ml-0.5" />نشط</> : <><XCircle className="w-2.5 h-2.5 inline ml-0.5" />موقوف</>}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {branch.address && <span className="flex items-center gap-1 text-[11px] text-ink/40"><MapPin className="w-3 h-3" />{branch.address}</span>}
                {branch.phone && <span className="flex items-center gap-1 text-[11px] text-ink/40"><Phone className="w-3 h-3" />{branch.phone}</span>}
                <span className="flex items-center gap-1 text-[11px] text-ink/30"><Calendar className="w-3 h-3" />{new Date(branch.created_at).toLocaleDateString('ar-EG-u-nu-latn')}</span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={onEdit}
                className="flex items-center gap-1.5 text-xs text-ink/50 hover:text-amber-400 hover:bg-amber-500/8 px-3 py-1.5 rounded-xl border border-[var(--erp-border)] hover:border-amber-500/25 transition-all">
                <Pencil className="w-3.5 h-3.5" /> تعديل
              </button>
              <button onClick={onDelete}
                className="flex items-center gap-1.5 text-xs text-ink/30 hover:text-red-400 hover:bg-red-500/8 px-3 py-1.5 rounded-xl border border-[var(--erp-border)] hover:border-red-500/25 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${tab === t.key ? 'text-amber-400 border-amber-400 bg-amber-500/8' : 'text-ink/40 border-transparent hover:text-ink/60 hover:bg-surface'}`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${tab === t.key ? 'bg-amber-500/20 text-amber-300' : 'bg-surface text-ink/30'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-xs text-ink/30">خطأ في تحميل البيانات</p>
          </div>
        ) : (
          <div className="p-5">
            {tab === 'overview'   && <OverviewTab data={data} />}
            {tab === 'employees'  && <EmployeesTab employees={data.employees} />}
            {tab === 'warehouses' && <WarehousesTab warehouses={data.warehouses} />}
            {tab === 'safes'      && <SafesTab safes={data.safes} />}
          </div>
        )}
      </div>
    </>
  );
}

/* ══ Tab: Overview ═══════════════════════════════════════════════ */
function OverviewTab({ data }: { data: BranchOverview }) {
  const s = data.stats_30d;
  const activeEmp = data.employees.filter(e => e.employment_status === 'active').length;
  const totalSalaries = data.employees
    .filter(e => e.employment_status === 'active')
    .reduce((sum, e) => sum + Number(e.salary), 0);

  const kpis = [
    { label: 'الموظفون النشطون', value: activeEmp,           sub: `من ${data.employees.length} إجمالي`,   color: '#F59E0B', icon: UserCheck  },
    { label: 'المخازن',          value: data.warehouses.length, sub: 'مخزن مرتبط',                         color: '#60A5FA', icon: Warehouse  },
    { label: 'الخزائن',          value: data.safes.length,    sub: 'خزينة مرتبطة',                         color: '#A78BFA', icon: Vault     },
    { label: 'إجمالي الرواتب',   value: fmt(totalSalaries),  sub: 'للموظفين النشطين',                      color: '#34D399', icon: BadgeDollarSign },
  ];

  const stats30 = [
    { label: 'مبيعات (30 يوم)', value: fmt(s.sales_total),   sub: `${s.sales_count} فاتورة`,  color: '#10B981', icon: ShoppingCart, trend: 'up'   },
    { label: 'صيانة (30 يوم)',   value: s.repairs_count,      sub: 'بطاقة صيانة',              color: '#60A5FA', icon: Wrench,        trend: 'neutral' },
    { label: 'مصروفات (30 يوم)', value: fmt(s.expenses_total),sub: 'إجمالي المصروفات',         color: '#EF4444', icon: TrendingDown,  trend: 'down' },
    { label: 'إيرادات أخرى',     value: fmt(s.income_total),  sub: 'غير المبيعات',             color: '#8B5CF6', icon: TrendingUp,    trend: 'up'   },
  ];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div>
        <p className="text-[10px] text-ink/30 font-bold mb-2.5">ملخص الفرع</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl p-3.5 border border-[var(--erp-border)]" style={{ background: k.color + '0D' }}>
              <div className="flex items-center justify-between mb-2">
                <k.icon className="w-4 h-4" style={{ color: k.color }} />
              </div>
              <p className="text-xl font-black text-ink">{k.value}</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: k.color }}>{k.label}</p>
              <p className="text-[10px] text-ink/30 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day stats */}
      <div>
        <p className="text-[10px] text-ink/30 font-bold mb-2.5">آخر 30 يوم</p>
        <div className="grid grid-cols-2 gap-3">
          {stats30.map((s) => (
            <div key={s.label} className="rounded-xl p-3.5 border border-[var(--erp-border)] bg-[var(--erp-bg-card)]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.color + '1A' }}>
                  <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
                <p className="text-[10px] text-ink/40 font-medium">{s.label}</p>
              </div>
              <p className="text-lg font-black text-ink">{s.value}</p>
              <p className="text-[10px] text-ink/30 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick lists */}
      {data.safes.length > 0 && (
        <div>
          <p className="text-[10px] text-ink/30 font-bold mb-2.5">أرصدة الخزائن</p>
          <div className="rounded-xl border border-[var(--erp-border)] overflow-hidden">
            {data.safes.map((s, i) => (
              <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-[var(--erp-border)]' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <Vault className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-sm text-ink font-medium">{s.name}</span>
                </div>
                <span className="font-black text-emerald-400 tabular-nums">{fmt(Number(s.balance))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ Tab: Employees ══════════════════════════════════════════════ */
function EmployeesTab({ employees }: { employees: EmployeeRow[] }) {
  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    active:      { label: 'نشط',      color: '#10B981' },
    inactive:    { label: 'غير نشط', color: '#EF4444' },
    on_leave:    { label: 'إجازة',    color: '#F59E0B' },
    terminated:  { label: 'منتهي',   color: '#6B7280' },
  };

  if (employees.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <UserX className="w-10 h-10 text-ink/10 mb-3" />
      <p className="text-sm text-ink/30">لا يوجد موظفون مرتبطون بهذا الفرع</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {employees.map((e) => {
        const st = STATUS_LABEL[e.employment_status] ?? { label: e.employment_status, color: '#6B7280' };
        return (
          <div key={e.id} className="rounded-xl border border-[var(--erp-border)] bg-[var(--erp-bg-card)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm" style={{ background: '#F59E0B1A', color: '#F59E0B' }}>
                  {e.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-ink text-sm truncate">{e.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-ink/30 font-mono">{e.employee_code}</span>
                    {e.phone && <span className="text-[10px] text-ink/30">{e.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.color + '18', color: st.color }}>
                  {st.label}
                </span>
                <span className="text-xs font-black text-emerald-400 tabular-nums">
                  {fmt(Number(e.salary), e.currency)}{e.salary_type === 'daily' ? '/يوم' : e.salary_type === 'hourly' ? '/ساعة' : '/شهر'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-line">
              <span className="flex items-center gap-1 text-[10px] text-ink/30">
                <Calendar className="w-3 h-3" /> تعيين: {e.hire_date}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══ Tab: Warehouses ═════════════════════════════════════════════ */
function WarehousesTab({ warehouses }: { warehouses: WarehouseRow[] }) {
  if (warehouses.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Warehouse className="w-10 h-10 text-ink/10 mb-3" />
      <p className="text-sm text-ink/30">لا توجد مخازن مرتبطة بهذا الفرع</p>
      <p className="text-xs text-ink/20 mt-1">يمكنك ربط المخازن من صفحة إعدادات المخازن</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {warehouses.map((w) => (
        <div key={w.id} className="rounded-xl border border-[var(--erp-border)] bg-[var(--erp-bg-card)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-ink text-sm">{w.name}</p>
              {w.address && (
                <p className="text-[10px] text-ink/40 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" /> {w.address}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══ Tab: Safes ══════════════════════════════════════════════════ */
function SafesTab({ safes }: { safes: SafeRow[] }) {
  const total = safes.reduce((s, x) => s + Number(x.balance), 0);

  if (safes.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Vault className="w-10 h-10 text-ink/10 mb-3" />
      <p className="text-sm text-ink/30">لا توجد خزائن مرتبطة بهذا الفرع</p>
      <p className="text-xs text-ink/20 mt-1">يمكنك ربط الخزائن من صفحة إعدادات الخزائن</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Total balance */}
      <div className="rounded-xl p-4 border border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.07)' }}>
        <p className="text-[10px] text-emerald-400/70 mb-1">إجمالي أرصدة الخزائن</p>
        <p className="text-2xl font-black text-emerald-400">{fmt(total)}</p>
      </div>

      {/* Safes list */}
      <div className="space-y-2">
        {safes.map((s) => (
          <div key={s.id} className="rounded-xl border border-[var(--erp-border)] bg-[var(--erp-bg-card)] px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <Vault className="w-4 h-4 text-purple-400" />
              </div>
              <p className="font-bold text-ink text-sm truncate">{s.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-black text-emerald-400 tabular-nums">{fmt(Number(s.balance))}</p>
              <p className="text-[9px] text-ink/30">EGP</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
