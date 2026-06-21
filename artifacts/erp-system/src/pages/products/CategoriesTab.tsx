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

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';

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
      {/* ── New category input ─────────────────────────────── */}
      {canManage && (
        <Card padding="md" className="flex gap-3 items-center">
          <Tag className="w-5 h-5 shrink-0 opacity-60" aria-hidden="true" />
          <Input
            type="text"
            placeholder="اسم التصنيف الجديد..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            className="flex-1"
          />
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
            loading={createMutation.isPending}
          >
            <Plus /> إضافة
          </Button>
        </Card>
      )}

      {/* ── Categories list ────────────────────────────────── */}
      <Card>
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={4} cols={3} />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            variant="no-data"
            title="لا توجد تصنيفات"
            description="أضف أول تصنيف من الحقل أعلاه"
            icon={<Tag />}
          />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface)]"
              >
                <Tag className="w-4 h-4 opacity-40 shrink-0" aria-hidden="true" />

                {editingId === cat.id ? (
                  <Input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(cat.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="flex-1 h-8"
                  />
                ) : (
                  <span className="flex-1 font-semibold text-sm">{cat.name}</span>
                )}

                <Badge variant={(cat.product_count ?? 0) > 0 ? 'neutral' : 'neutral'}>
                  {cat.product_count ?? 0} منتج
                </Badge>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === cat.id ? (
                      <>
                        <IconButton
                          aria-label="حفظ"
                          title="حفظ"
                          variant="ghost"
                          size="sm"
                          onClick={() => saveEdit(cat.id)}
                          disabled={updateMutation.isPending}
                        >
                          <Check />
                        </IconButton>
                        <IconButton
                          aria-label="إلغاء"
                          title="إلغاء"
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          <X />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton
                          aria-label="تعديل الاسم"
                          title="تعديل الاسم"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(cat.id, cat.name)}
                        >
                          <Pencil />
                        </IconButton>
                        <IconButton
                          aria-label={
                            (cat.product_count ?? 0) > 0
                              ? 'لا يمكن الحذف — مرتبط بمنتجات'
                              : 'حذف التصنيف'
                          }
                          title={
                            (cat.product_count ?? 0) > 0
                              ? 'لا يمكن الحذف — مرتبط بمنتجات'
                              : 'حذف التصنيف'
                          }
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmDeleteId(cat.id)}
                          disabled={(cat.product_count ?? 0) > 0}
                        >
                          <Trash2 />
                        </IconButton>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

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
