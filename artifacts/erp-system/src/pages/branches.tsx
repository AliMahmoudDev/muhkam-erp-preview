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
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';


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

const EMPTY_FORM = { name: '', address: '', phone: '', is_active: true };

export default function Branches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  /* ── Query ────────────────────────────────────────────────── */
  const { data: resp, isLoading } = useQuery<BranchesResponse>({
    queryKey: ['/api/branches'],
    queryFn: async () => {
      const r = await authFetch(api('/api/branches'));
      if (!r.ok) throw new Error('خطأ في جلب الفروع');
      const json = await r.json();
      /* backward compat: old API returns array */
      if (Array.isArray(json)) return { branches: json, unlinked_warehouses: 0, unlinked_safes: 0 };
      return json;
    },
  });

  const branches: Branch[] = safeArray(resp?.branches);
  const unlinkedW = resp?.unlinked_warehouses ?? 0;
  const unlinkedS = resp?.unlinked_safes ?? 0;

  /* ── Mutations ────────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: async (body: { name: string; address?: string; phone?: string; is_active: boolean }) => {
      const r = await authFetch(api('/api/branches'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    onSuccess: () => { toast({ title: 'تم حذف الفرع' }); qc.invalidateQueries({ queryKey: ['/api/branches'] }); setDeleteId(null); },
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
  const inactiveBranches = branches.length - activeBranches;
  const totalW = branches.reduce((s, b) => s + (b.warehouse_count ?? 0), 0) + unlinkedW;
  const totalS = branches.reduce((s, b) => s + (b.safe_count ?? 0), 0) + unlinkedS;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة الفروع</h1>
            <p className="text-xs text-white/40 mt-0.5">إنشاء وإدارة فروع الشركة مع مخازنها وخزائنها</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> فرع جديد
          </button>
        )}
      </div>

      {/* ── Stats cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'إجمالي الفروع',   value: branches.length,  icon: Building2,    color: '#F59E0B' },
          { label: 'فروع نشطة',       value: activeBranches,   icon: CheckCircle2, color: '#10B981' },
          { label: 'فروع موقوفة',     value: inactiveBranches, icon: XCircle,      color: '#EF4444' },
          { label: 'إجمالي المخازن',  value: totalW,           icon: Warehouse,    color: '#60A5FA' },
          { label: 'إجمالي الخزائن',  value: totalS,           icon: Vault,        color: '#A78BFA' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 flex items-center gap-3 bg-[var(--erp-bg-card)] border border-[var(--erp-border)]">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + '1A' }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--erp-text-1)]">{s.value}</p>
              <p className="text-[10px] text-[var(--erp-text-3)] leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* تحذير مخازن/خزائن غير مربوطة */}
      {(unlinkedW > 0 || unlinkedS > 0) && (
        <div className="flex items-start gap-3 rounded-xl p-4 bg-amber-500/8 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300/80">
            {unlinkedW > 0 && <span>{unlinkedW} مخزن</span>}
            {unlinkedW > 0 && unlinkedS > 0 && <span> و </span>}
            {unlinkedS > 0 && <span>{unlinkedS} خزينة</span>}
            {' '}غير مربوطة بأي فرع — يمكنك ربطها من إعدادات المخازن والخزائن.
          </p>
        </div>
      )}

      {/* ── Form ───────────────────────────────────────────── */}
      {showForm && isAdmin && (
        <div className="rounded-2xl p-5 bg-[var(--erp-bg-card)] border border-amber-500/25 shadow-[var(--erp-shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[var(--erp-text-1)]">{editId !== null ? 'تعديل الفرع' : 'فرع جديد'}</h2>
            <button onClick={resetForm} className="text-[var(--erp-text-3)] hover:text-[var(--erp-text-2)] transition-colors text-sm">إلغاء</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[var(--erp-text-3)] mb-1.5">اسم الفرع *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: الفرع الرئيسي" required className="glass-input w-full rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[var(--erp-text-3)] mb-1.5">العنوان</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="عنوان الفرع" className="glass-input w-full rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[var(--erp-text-3)] mb-1.5">رقم الهاتف * <span className="text-white/25">(11 رقم)</span></label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                  placeholder="01xxxxxxxxx"
                  className="glass-input w-full rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            {editId !== null && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-[var(--erp-text-2)]">حالة الفرع:</label>
                <button type="button" onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-amber-500' : 'bg-white/15'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_active ? '-translate-x-6' : '-translate-x-1'}`} />
                </button>
                <span className="text-sm text-[var(--erp-text-3)]">{form.is_active ? 'نشط' : 'موقوف'}</span>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-[var(--erp-text-3)] hover:text-[var(--erp-text-1)] transition-colors">إلغاء</button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : editId !== null ? 'حفظ التعديلات' : 'إنشاء الفرع'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Branches grid ──────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-[var(--erp-bg-card)] border border-[var(--erp-border)] text-center">
          <GitBranch className="w-12 h-12 text-[var(--erp-text-4)] mb-3" />
          <p className="text-[var(--erp-text-3)] font-medium">لا توجد فروع بعد</p>
          {isAdmin && (
            <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-amber-400 hover:text-amber-300 transition-colors">أضف أول فرع</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((b) => (
            <div key={b.id} className="rounded-2xl p-5 bg-[var(--erp-bg-card)] border border-[var(--erp-border)] hover:border-amber-500/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--erp-text-1)]">{b.name}</h3>
                    <p className="text-[10px] text-[var(--erp-text-4)] mt-0.5">
                      {new Date(b.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: b.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: b.is_active ? '#10B981' : '#EF4444',
                    border: `1px solid ${b.is_active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                  {b.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {b.is_active ? 'نشط' : 'موقوف'}
                </span>
              </div>

              {/* تفاصيل الفرع */}
              <div className="space-y-1.5 mb-4">
                {b.address && (
                  <div className="flex items-center gap-2 text-xs text-[var(--erp-text-3)]">
                    <MapPin className="w-3.5 h-3.5 text-[var(--erp-text-4)] flex-shrink-0" />
                    {b.address}
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-2 text-xs text-[var(--erp-text-3)]">
                    <Phone className="w-3.5 h-3.5 text-[var(--erp-text-4)] flex-shrink-0" />
                    {b.phone}
                  </div>
                )}
              </div>

              {/* المخازن والخزائن */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-blue-500/8 border border-blue-500/15">
                  <Warehouse className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-base font-bold text-blue-400">{b.warehouse_count ?? 0}</p>
                    <p className="text-[10px] text-blue-300/60">مخزن</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-purple-500/8 border border-purple-500/15">
                  <Vault className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-base font-bold text-purple-400">{b.safe_count ?? 0}</p>
                    <p className="text-[10px] text-purple-300/60">خزينة</p>
                  </div>
                </div>
              </div>

              {/* أزرار التعديل */}
              {isAdmin && (
                <div className="flex gap-2 border-t border-[var(--erp-border)] pt-3">
                  <button onClick={() => startEdit(b)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[var(--erp-text-3)] hover:text-amber-400 hover:bg-amber-500/8 py-1.5 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> تعديل
                  </button>
                  <button onClick={() => setDeleteId(b.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[var(--erp-text-3)] hover:text-red-400 hover:bg-red-500/8 py-1.5 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                  </button>
                </div>
              )}
            </div>
          ))}
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
