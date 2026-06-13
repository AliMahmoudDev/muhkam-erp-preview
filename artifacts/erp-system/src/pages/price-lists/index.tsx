import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { PriceListCard } from './PriceListCard';
import { PriceListFormModal } from './PriceListFormModal';
import type { PriceList, PriceListDetail, Product, PriceListFormData } from './types';

/* ──────────────────────────────── Main Page ─────────────────────────────── */

export default function PriceLists() {
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingList, setEditingList] = useState<PriceListDetail | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: lists = [], isLoading: loadingLists } = useQuery<PriceList[]>({
    queryKey: ['/api/price-lists'],
    queryFn: () => authFetch(api('/api/price-lists')).then((r) => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: () => authFetch(api('/api/products')).then((r) => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const createMutation = useMutation({
    mutationFn: (data: PriceListFormData) =>
      authFetch(api('/api/price-lists'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/price-lists'] });
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PriceListFormData }) =>
      authFetch(api(`/api/price-lists/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/price-lists'] });
      setEditingList(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/price-lists/${id}`), { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/price-lists'] });
      setDeletingId(null);
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleEdit = async (id: number) => {
    const r = await authFetch(api(`/api/price-lists/${id}`));
    const raw = await r.json().catch(() => null);
    const detail: PriceListDetail = {
      ...(raw ?? {}),
      id: raw?.id ?? id,
      name: raw?.name ?? '',
      description: raw?.description ?? null,
      is_active: raw?.is_active ?? true,
      created_at: raw?.created_at ?? new Date().toISOString(),
      items: Array.isArray(raw?.items) ? raw.items : [],
    };
    setEditingList(detail);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Tags className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-black text-ink">قوائم الأسعار</h1>
            <p className="text-xs text-ink/40">قوائم مخصصة لتسعير المنتجات للعملاء</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
        >
          <Plus className="w-4 h-4" />
          قائمة جديدة
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingLists ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl animate-pulse bg-surface border border-line"
              />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <Tags className="w-8 h-8 text-ink/20" />
            </div>
            <p className="text-ink/40 font-semibold">لا توجد قوائم أسعار بعد</p>
            <p className="text-ink/25 text-sm mt-1">أنشئ قائمة أسعار وخصصها للعملاء</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition"
            >
              <Plus className="w-4 h-4" />
              إنشاء أول قائمة
            </button>
          </div>
        ) : (
          lists.map((list) => (
            <PriceListCard
              key={list.id}
              list={list}
              products={products}
              onEdit={() => handleEdit(list.id)}
              onDelete={() => {
                setDeletingId(list.id);
                setDeleteError(null);
              }}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <PriceListFormModal
          products={products}
          onSave={(data) => createMutation.mutate(data)}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Edit Modal */}
      {editingList && (
        <PriceListFormModal
          initial={editingList}
          products={products}
          onSave={(data) => updateMutation.mutate({ id: editingList.id, data })}
          onClose={() => setEditingList(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingId != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: 'var(--erp-bg-card)', border: '1px solid var(--erp-border-md)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-bold text-ink">حذف قائمة الأسعار</p>
                <p className="text-ink/50 text-sm">سيتم إلغاء ربطها من جميع العملاء</p>
              </div>
            </div>
            {deleteError && (
              <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-xl">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-xl border border-line text-ink/50 hover:text-ink text-sm transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-ink font-bold text-sm transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
