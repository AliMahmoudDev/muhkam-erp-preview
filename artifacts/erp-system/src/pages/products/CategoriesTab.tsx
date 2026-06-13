import { useState, useRef, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useGetCategories } from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { safeArray } from '@/lib/safe-data';
import { api } from '@/lib/api';

export function CategoriesTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'can_manage_products') === true;
  const { data: categoriesRaw, isLoading } = useGetCategories();
  const categories = safeArray(categoriesRaw);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const r = await authFetch(api(`/api/categories/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const r = await authFetch(api(`/api/categories/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const createMutation = useMutation({
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      const r = await authFetch(api('/api/categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null) inputRef.current?.focus();
  }, [editingId]);

  const startEdit = (id: number, name: string) => {
    setEditingId(id);
    setEditName(name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const extractErr = (e: unknown, fallback: string) => {
    const anyE = e as { data?: { error?: string }; message?: string } | null;
    return anyE?.data?.error ?? anyE?.message ?? fallback;
  };

  const saveEdit = (id: number) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    updateMutation.mutate(
      { id, data: { name: trimmed } },
      {
        onSuccess: () => {
          toast({ title: '✅ تم تعديل اسم التصنيف' });
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          cancelEdit();
        },
        onError: (e: unknown) => {
          toast({ title: extractErr(e, 'خطأ في التعديل'), variant: 'destructive' });
          cancelEdit();
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: '✅ تم حذف التصنيف' });
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          setConfirmDeleteId(null);
        },
        onError: (e: unknown) => {
          toast({ title: extractErr(e, 'خطأ في الحذف'), variant: 'destructive' });
          setConfirmDeleteId(null);
        },
      }
    );
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(
      { data: { name: trimmed } },
      {
        onSuccess: () => {
          toast({ title: '✅ تم إنشاء التصنيف' });
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          setNewName('');
        },
        onError: (e: unknown) => {
          toast({ title: extractErr(e, 'خطأ في الإنشاء'), variant: 'destructive' });
        },
      }
    );
  };

  const confirmTarget =
    confirmDeleteId !== null ? categories.find((c) => c.id === confirmDeleteId) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {canManage && (
        <div className="glass-panel rounded-2xl p-4 border border-line flex gap-3 items-center">
          <Tag className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            type="text"
            placeholder="اسم التصنيف الجديد..."
            className="glass-input flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
            className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden border border-line">
        {isLoading ? (
          <div className="p-8 text-center text-ink/40">جاري التحميل...</div>
        ) : categories.length === 0 ? (
          <div className="p-14 text-center">
            <Tag className="w-10 h-10 text-ink/20 mx-auto mb-3" />
            <p className="text-ink/40 font-bold">لا توجد تصنيفات</p>
            <p className="text-ink/20 text-sm mt-1">أضف أول تصنيف من الحقل أعلاه</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 px-5 py-4 hover:bg-surface transition-colors"
              >
                <Tag className="w-4 h-4 text-amber-400/60 shrink-0" />
                {editingId === cat.id ? (
                  <input
                    ref={inputRef}
                    className="flex-1 bg-surface border border-line rounded-lg px-3 py-1.5 text-sm text-ink outline-none focus:border-amber-400/60"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(cat.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                ) : (
                  <span className="flex-1 text-ink font-semibold text-sm">{cat.name}</span>
                )}
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${(cat.product_count ?? 0) > 0 ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-surface text-ink/30 border-line'}`}
                >
                  {cat.product_count ?? 0} منتج
                </span>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === cat.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(cat.id)}
                          disabled={updateMutation.isPending}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                          title="حفظ"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg text-ink/40 hover:bg-surface transition-colors"
                          title="إلغاء"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(cat.id, cat.name)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-400/10 transition-colors"
                          title="تعديل الاسم"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(cat.id)}
                          disabled={(cat.product_count ?? 0) > 0}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            (cat.product_count ?? 0) > 0
                              ? 'لا يمكن الحذف — مرتبط بمنتجات'
                              : 'حذف التصنيف'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmTarget && (
        <ConfirmModal
          title="حذف التصنيف"
          description={`هل أنت متأكد من حذف «${confirmTarget.name}»؟ لا يمكن التراجع.`}
          isPending={deleteMutation.isPending}
          onConfirm={() => handleDelete(confirmTarget.id)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
