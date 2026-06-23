import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Package, AlertTriangle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';

interface ScrapItem {
  id: number;
  product_id?: number;
  product_name: string;
  quantity: string;
  unit_cost: string;
  reason?: string;
  source_repair_job_id?: number;
  notes?: string;
  created_at: string;
}

export default function ScrapInventory({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newCost, setNewCost] = useState('0');
  const [newReason, setNewReason] = useState('');

  const { data: items = [], isLoading } = useQuery<ScrapItem[]>({
    queryKey: ['/api/scrap-items'],
    queryFn: async () => {
      const r = await authFetch(api('/api/scrap-items'));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const addM = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authFetch(api('/api/scrap-items'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/scrap-items'] });
      setShowNew(false);
      setNewName('');
      setNewQty('1');
      setNewCost('0');
      setNewReason('');
      toast({ title: '✅ أُضيفت' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const delM = useMutation({
    mutationFn: (id: number) => authFetch(api(`/api/scrap-items/${id}`), { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/scrap-items'] });
      toast({ title: '✅ حُذفت' });
    },
  });

  const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0);

  return (
    <div className={embedded ? 'erp-page' : 'erp-page h-full overflow-y-auto'} dir="rtl">
      <div className="erp-page-header">
        {!embedded && (
          <h1 className="erp-page-title flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-amber-400" /> مخزن التوالف
          </h1>
        )}
        <div className="erp-page-actions">
          <button
            onClick={() => setShowNew(true)}
            className="erp-btn erp-btn-sm"
            style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--color-amber-300, #fcd34d)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel rounded-xl p-3 border border-line">
          <p className="text-[11px] text-ink/40">عدد القطع التالفة</p>
          <p className="text-2xl font-black text-amber-400">{items.length}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 border border-line">
          <p className="text-[11px] text-ink/40">إجمالي الخسارة</p>
          <p className="text-2xl font-black text-red-400">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-line overflow-hidden">
        {isLoading && <div className="text-center text-ink/40 py-8">جاري التحميل...</div>}
        {!isLoading && items.length === 0 && (
          <div className="text-center text-ink/40 py-12 flex flex-col items-center gap-2">
            <Package className="w-10 h-10 opacity-20" />
            لا توجد قطع تالفة
          </div>
        )}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface">
              <tr className="text-right text-[11px] text-ink/50">
                <th className="px-3 py-2">اسم القطعة</th>
                <th className="px-3 py-2">الكمية</th>
                <th className="px-3 py-2">السعر</th>
                <th className="px-3 py-2">الإجمالي</th>
                <th className="px-3 py-2">السبب</th>
                <th className="px-3 py-2">المصدر</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-line text-ink/80">
                  <td className="px-3 py-2">{it.product_name}</td>
                  <td className="px-3 py-2 text-ink/60">{Number(it.quantity).toFixed(2)}</td>
                  <td className="px-3 py-2 text-ink/60">{formatCurrency(Number(it.unit_cost))}</td>
                  <td className="px-3 py-2 font-bold text-amber-400">
                    {formatCurrency(Number(it.quantity) * Number(it.unit_cost))}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink/50">{it.reason ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-ink/50">
                    {it.source_repair_job_id ? (
                      <span className="text-ink/60">صيانة #{it.source_repair_job_id}</span>
                    ) : (
                      'يدوي'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => delM.mutate(it.id)}
                      className="btn-icon text-red-400/40 hover:text-red-400 w-7 h-7"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowNew(false)}
        >
          <div
            className="glass-panel rounded-2xl p-5 w-96 border border-line space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-ink flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> إضافة توالف
              </h3>
              <button onClick={() => setShowNew(false)} className="btn-icon text-ink/40">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم القطعة *"
              className="erp-input w-full text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="الكمية"
                className="erp-input w-full text-sm"
              />
              <input
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="سعر القطعة"
                className="erp-input w-full text-sm"
              />
            </div>
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="السبب (مثل: تلف، كسر...)"
              className="erp-input w-full text-sm"
            />
            <button
              onClick={() => {
                if (!newName.trim()) {
                  toast({ title: 'اسم القطعة مطلوب', variant: 'destructive' });
                  return;
                }
                addM.mutate({
                  product_name: newName,
                  quantity: newQty,
                  unit_cost: newCost,
                  reason: newReason,
                });
              }}
              className="w-full py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-sm"
            >
              حفظ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
