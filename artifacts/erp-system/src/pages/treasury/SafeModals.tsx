import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { Landmark, Plus, Loader2, X, Trash2, AlertTriangle, Pencil } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

interface SafeModalsProps {
  showAddSafe: boolean;
  setShowAddSafe: (v: boolean) => void;
  addForm: { name: string; balance: string; branch_id: string };
  setAddForm: React.Dispatch<
    React.SetStateAction<{ name: string; balance: string; branch_id: string }>
  >;
  deleteTarget: { id: number; name: string; balance: number } | null;
  setDeleteTarget: (v: { id: number; name: string; balance: number } | null) => void;
  editTarget: { id: number; name: string; branch_id: number | null } | null;
  setEditTarget: (v: { id: number; name: string; branch_id: number | null } | null) => void;
  editForm: { name: string; branch_id: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; branch_id: string }>>;
  editSaving: boolean;
  setEditSaving: (v: boolean) => void;
  branches: { id: number; name: string }[];
  createSafe: UseMutationResult<unknown, Error, Record<string, unknown>>;
  deleteSafe: UseMutationResult<unknown, Error, number>;
  invalidateSafes: () => void;
  queryClient: QueryClient;
  toast: (opts: {
    title: string;
    variant?: 'default' | 'destructive' | 'warning' | 'info' | null;
  }) => void;
}

export default function SafeModals({
  showAddSafe,
  setShowAddSafe,
  addForm,
  setAddForm,
  deleteTarget,
  setDeleteTarget,
  editTarget,
  setEditTarget,
  editForm,
  setEditForm,
  editSaving,
  setEditSaving,
  branches,
  createSafe,
  deleteSafe,
  invalidateSafes,
  queryClient,
  toast,
}: SafeModalsProps) {
  return (
    <>
      {/* ── Add Safe Modal ── */}
      {showAddSafe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-canvas border border-line rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-sky-400" />
                </div>
                <p className="font-black text-ink text-sm">إضافة خزينة جديدة</p>
              </div>
              <button
                onClick={() => {
                  setShowAddSafe(false);
                  setAddForm({ name: '', balance: '', branch_id: '' });
                }}
                className="p-1.5 rounded-lg text-ink/30 hover:text-ink/70 hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-ink/50 text-xs font-bold mb-1.5">اسم الخزينة</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: الخزينة الرئيسية"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm placeholder-white/20 outline-none focus:border-sky-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-ink/50 text-xs font-bold mb-1.5">
                  الرصيد الابتدائي
                </label>
                <input
                  type="number"
                  value={addForm.balance}
                  onChange={(e) => setAddForm((f) => ({ ...f, balance: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm placeholder-white/20 outline-none focus:border-sky-500/50 transition-colors"
                />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="block text-ink/50 text-xs font-bold mb-1.5">
                    الفرع (اختياري)
                  </label>
                  <select
                    value={addForm.branch_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, branch_id: e.target.value }))}
                    className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm outline-none focus:border-sky-500/50 transition-colors"
                  >
                    <option value="">— بدون فرع —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-line">
              <button
                disabled={createSafe.isPending}
                onClick={async () => {
                  if (!addForm.name.trim()) {
                    toast({ title: 'اسم الخزينة مطلوب', variant: 'destructive' });
                    return;
                  }
                  try {
                    const r = await authFetch(api('/api/settings/safes'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: addForm.name.trim(),
                        balance: Number(addForm.balance) || 0,
                        branch_id: addForm.branch_id ? Number(addForm.branch_id) : undefined,
                      }),
                    });
                    if (!r.ok) throw new Error((await r.json()).error ?? 'فشل الإضافة');
                    invalidateSafes();
                    queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
                    toast({ title: 'تم إضافة الخزينة بنجاح' });
                    setAddForm({ name: '', balance: '', branch_id: '' });
                    setShowAddSafe(false);
                  } catch (e: unknown) {
                    toast({
                      title: (e as Error)?.message ?? 'فشل إضافة الخزينة',
                      variant: 'destructive',
                    });
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-ink font-bold text-sm rounded-xl py-2.5 transition-colors"
              >
                {createSafe.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة
              </button>
              <button
                onClick={() => {
                  setShowAddSafe(false);
                  setAddForm({ name: '', balance: '', branch_id: '' });
                }}
                className="flex-1 bg-surface hover:bg-surface text-ink/60 font-bold text-sm rounded-xl py-2.5 transition-colors border border-line"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-canvas border border-red-500/20 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <p className="text-ink font-black text-base">حذف الخزينة</p>
                <p className="text-ink/50 text-sm mt-1.5 leading-relaxed">
                  سيتم حذف <span className="text-ink font-semibold">"{deleteTarget.name}"</span>{' '}
                  نهائياً.
                  <br />
                  هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-line">
              <button
                disabled={deleteSafe.isPending}
                onClick={() => {
                  deleteSafe.mutate(deleteTarget.id, {
                    onSuccess: () => {
                      invalidateSafes();
                      toast({ title: 'تم حذف الخزينة بنجاح' });
                      setDeleteTarget(null);
                    },
                    onError: (e: unknown) => {
                      const msg =
                        (e as { response?: { data?: { error?: string } } })?.response?.data
                          ?.error ||
                        (e as Error)?.message ||
                        'فشل حذف الخزينة';
                      toast({ title: msg, variant: 'destructive' });
                      setDeleteTarget(null);
                    },
                  });
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-ink font-bold text-sm rounded-xl py-2.5 transition-colors"
              >
                {deleteSafe.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                حذف نهائي
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-surface hover:bg-surface text-ink/60 font-bold text-sm rounded-xl py-2.5 transition-colors border border-line"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Safe Modal ── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-canvas border border-line rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-amber-400" />
                </div>
                <p className="font-black text-ink text-sm">تعديل الخزينة</p>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                className="p-1.5 rounded-lg text-ink/30 hover:text-ink/70 hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-ink/50 text-xs font-bold mb-1.5">اسم الخزينة</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="اسم الخزينة"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm placeholder-white/20 outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="block text-ink/50 text-xs font-bold mb-1.5">الفرع</label>
                  <select
                    value={editForm.branch_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, branch_id: e.target.value }))}
                    className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-ink text-sm outline-none focus:border-amber-500/50 transition-colors"
                  >
                    <option value="">— بدون فرع —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-line">
              <button
                disabled={editSaving}
                onClick={async () => {
                  if (!editForm.name.trim()) {
                    toast({ title: 'اسم الخزينة مطلوب', variant: 'destructive' });
                    return;
                  }
                  setEditSaving(true);
                  try {
                    const r = await authFetch(api(`/api/settings/safes/${editTarget.id}`), {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: editForm.name.trim(),
                        branch_id: editForm.branch_id ? Number(editForm.branch_id) : null,
                      }),
                    });
                    if (!r.ok) throw new Error((await r.json()).error ?? 'فشل التعديل');
                    invalidateSafes();
                    queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
                    toast({ title: 'تم تعديل الخزينة بنجاح' });
                    setEditTarget(null);
                  } catch (e: unknown) {
                    toast({
                      title: (e as Error)?.message ?? 'فشل تعديل الخزينة',
                      variant: 'destructive',
                    });
                  } finally {
                    setEditSaving(false);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-ink font-bold text-sm rounded-xl py-2.5 transition-colors"
              >
                {editSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
                حفظ
              </button>
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 bg-surface hover:bg-surface text-ink/60 font-bold text-sm rounded-xl py-2.5 transition-colors border border-line"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
