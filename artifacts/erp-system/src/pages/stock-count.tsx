/**
 * صفحة جرد المخزون — إنشاء جلسات جرد وتطبيق التسويات
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Plus, CheckCircle, Clock, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

interface CountSession {
  id: number;
  warehouse_name: string | null;
  status: 'draft' | 'applied';
  notes: string | null;
  applied_at: string | null;
  created_at: string;
  item_count: number;
  total_system_qty: number;
  total_physical_qty: number;
  total_difference: number;
}

interface CountItem {
  product_id: number;
  product_name: string;
  system_qty: number;
  physical_qty: number;
  difference: number;
}

interface Product { id: number; name: string; quantity: number; }
interface Warehouse { id: number; name: string; }

function fmt(d: string) {
  return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StockCount() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newItems, setNewItems] = useState<Array<{ product_id: number; product_name: string; system_qty: number; physical_qty: string }>>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [notes, setNotes] = useState('');

  const { data: sessions = [], isLoading } = useQuery<CountSession[]>({
    queryKey: ['/api/inventory/count-sessions-enriched'],
    queryFn: () => authFetch(api('/api/inventory/count-sessions-enriched')).then(r => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    staleTime: 30_000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: () => authFetch(api('/api/products')).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () => authFetch(api('/api/settings/warehouses')).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: sessionDetail } = useQuery<{ items: CountItem[] }>({
    queryKey: ['/api/inventory/count-sessions', expandedId],
    queryFn: () => authFetch(api(`/api/inventory/count-sessions/${expandedId}`)).then(r => r.json()),
    enabled: !!expandedId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        warehouse_id: selectedWarehouse ? parseInt(selectedWarehouse) : undefined,
        notes: notes || undefined,
        items: newItems.map(i => ({ product_id: i.product_id, physical_qty: parseFloat(i.physical_qty) || 0 })),
      };
      const res = await authFetch(api('/api/inventory/count-sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'خطأ في إنشاء الجرد');
      return j;
    },
    onSuccess: () => {
      toast({ title: 'تم إنشاء جلسة الجرد بنجاح' });
      qc.invalidateQueries({ queryKey: ['/api/inventory/count-sessions-enriched'] });
      setShowAdd(false); setNewItems([]); setNotes(''); setSelectedWarehouse('');
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const applyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/inventory/count-sessions/${id}/apply`), { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'خطأ في تطبيق الجرد');
      return j;
    },
    onSuccess: () => {
      toast({ title: 'تم تطبيق الجرد وتحديث المخزون' });
      qc.invalidateQueries({ queryKey: ['/api/inventory/count-sessions-enriched'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const addProductToCount = (productId: number) => {
    const p = products.find(x => x.id === productId);
    if (!p || newItems.find(i => i.product_id === productId)) return;
    setNewItems(items => [...items, { product_id: p.id, product_name: p.name, system_qty: Number(p.quantity), physical_qty: String(p.quantity) }]);
  };

  const totalDiff = sessions.filter(s => s.status === 'draft').reduce((s, ss) => s + ss.total_difference, 0);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-teal-400" />
          <h2 className="text-xl font-bold text-white">جرد المخزون</h2>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          <Plus className="w-4 h-4" /> جلسة جرد جديدة
        </button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-teal-500/15">
          <p className="text-white/40 text-xs font-bold mb-1">جلسات معلقة</p>
          <p className="text-2xl font-black text-teal-400">{sessions.filter(s => s.status === 'draft').length}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/15">
          <p className="text-white/40 text-xs font-bold mb-1">جلسات مُطبَّقة</p>
          <p className="text-2xl font-black text-emerald-400">{sessions.filter(s => s.status === 'applied').length}</p>
        </div>
        <div className={`glass-panel rounded-2xl p-4 border ${totalDiff !== 0 ? 'border-orange-500/20' : 'border-white/5'}`}>
          <p className="text-white/40 text-xs font-bold mb-1">فروق معلقة</p>
          <p className={`text-2xl font-black ${totalDiff < 0 ? 'text-red-400' : totalDiff > 0 ? 'text-orange-400' : 'text-white/40'}`}>{totalDiff > 0 ? '+' : ''}{totalDiff}</p>
        </div>
      </div>

      {/* القائمة */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-semibold text-white/60">#</th>
                <th className="p-4 font-semibold text-white/60">المستودع</th>
                <th className="p-4 font-semibold text-white/60">الأصناف</th>
                <th className="p-4 font-semibold text-white/60">فرق الكمية</th>
                <th className="p-4 font-semibold text-white/60">الحالة</th>
                <th className="p-4 font-semibold text-white/60">التاريخ</th>
                <th className="p-4 font-semibold text-white/60">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton cols={7} rows={4} /> : sessions.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-white/40">لا توجد جلسات جرد — اضغط «جلسة جرد جديدة»</td></tr>
              ) : sessions.map(s => (
                <>
                  <tr key={s.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-4 font-mono text-xs text-white/40">#{s.id}</td>
                    <td className="p-4 font-bold">{s.warehouse_name || 'المستودع الرئيسي'}</td>
                    <td className="p-4 text-white/60">{s.item_count} صنف</td>
                    <td className="p-4 font-bold">
                      <span className={s.total_difference === 0 ? 'text-white/40' : s.total_difference > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {s.total_difference > 0 ? '+' : ''}{s.total_difference}
                      </span>
                    </td>
                    <td className="p-4">
                      {s.status === 'applied' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> مُطبَّق</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-400"><Clock className="w-3.5 h-3.5" /> معلق</span>
                      )}
                    </td>
                    <td className="p-4 text-white/40 text-sm">{fmt(s.created_at)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="text-white/40 hover:text-white/70 p-1">
                          {expandedId === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {s.status === 'draft' && (
                          <button
                            onClick={() => { if (confirm(`تطبيق الجرد سيُعدِّل كميات ${s.item_count} منتج. متأكد؟`)) applyMutation.mutate(s.id); }}
                            disabled={applyMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 font-bold disabled:opacity-50"
                          >
                            تطبيق الجرد
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && sessionDetail && (
                    <tr key={`detail-${s.id}`}>
                      <td colSpan={7} className="p-0">
                        <div className="bg-white/2 border-b border-white/10 p-4">
                          <table className="w-full text-sm text-right">
                            <thead>
                              <tr className="text-white/40 text-xs">
                                <th className="pb-2 font-semibold">المنتج</th>
                                <th className="pb-2 font-semibold text-center">كمية النظام</th>
                                <th className="pb-2 font-semibold text-center">الكمية الفعلية</th>
                                <th className="pb-2 font-semibold text-center">الفرق</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionDetail.items.map((item: CountItem) => (
                                <tr key={item.product_id} className="border-t border-white/5">
                                  <td className="py-2 text-white/80">{item.product_name}</td>
                                  <td className="py-2 text-center text-white/50">{item.system_qty}</td>
                                  <td className="py-2 text-center text-white/80 font-bold">{item.physical_qty}</td>
                                  <td className={`py-2 text-center font-black ${item.difference === 0 ? 'text-white/30' : item.difference > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {item.difference > 0 ? '+' : ''}{item.difference}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال إنشاء جلسة */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl p-8 w-full max-w-2xl space-y-4 modal-panel max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-white/40" /></button>
              <h3 className="text-xl font-bold text-white">جلسة جرد جديدة</h3>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <div className="flex-1">
                <label className="text-white/60 text-xs block mb-1">المستودع</label>
                <select className="glass-input w-full" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                  <option value="">الكل</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-white/60 text-xs block mb-1">ملاحظات</label>
                <input className="glass-input w-full" placeholder="اختياري" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex-shrink-0">
              <label className="text-white/60 text-xs block mb-1">أضف منتجاً للجرد</label>
              <select className="glass-input w-full" onChange={e => { if (e.target.value) { addProductToCount(parseInt(e.target.value)); e.target.value = ''; } }}>
                <option value="">-- اختر منتجاً --</option>
                {products.filter(p => !newItems.find(i => i.product_id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (مخزون: {p.quantity})</option>
                ))}
              </select>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {newItems.length === 0 ? (
                <div className="text-center py-8 text-white/30 text-sm">أضف منتجات للجرد من القائمة أعلاه</div>
              ) : (
                <table className="w-full text-sm text-right">
                  <thead><tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="pb-2">المنتج</th>
                    <th className="pb-2 text-center">كمية النظام</th>
                    <th className="pb-2 text-center">الكمية الفعلية</th>
                    <th className="pb-2 text-center">الفرق</th>
                    <th className="pb-2"></th>
                  </tr></thead>
                  <tbody>
                    {newItems.map(item => {
                      const physical = parseFloat(item.physical_qty) || 0;
                      const diff = physical - item.system_qty;
                      return (
                        <tr key={item.product_id} className="border-b border-white/5">
                          <td className="py-2 text-white/80">{item.product_name}</td>
                          <td className="py-2 text-center text-white/40">{item.system_qty}</td>
                          <td className="py-2 text-center">
                            <input type="number" min="0" step="1"
                              className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-center text-white text-xs focus:outline-none focus:border-amber-400/50"
                              value={item.physical_qty}
                              onChange={e => setNewItems(items => items.map(i => i.product_id === item.product_id ? { ...i, physical_qty: e.target.value } : i))}
                            />
                          </td>
                          <td className={`py-2 text-center font-bold text-xs ${diff === 0 ? 'text-white/30' : diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{diff || 0}
                          </td>
                          <td className="py-2 text-center">
                            <button onClick={() => setNewItems(items => items.filter(i => i.product_id !== item.product_id))} className="text-white/30 hover:text-red-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {newItems.length > 0 && newItems.some(i => parseFloat(i.physical_qty) !== i.system_qty) && (
              <div className="flex-shrink-0 flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-amber-400 text-xs">تطبيق الجرد سيُحدِّث كميات المنتجات فورياً — تأكد من دقة الأرقام</p>
              </div>
            )}
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={() => createMutation.mutate()}
                disabled={newItems.length === 0 || createMutation.isPending}
                className="flex-1 btn-primary py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {createMutation.isPending ? 'جاري الحفظ...' : `✓ حفظ جلسة الجرد (${newItems.length} صنف)`}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-white/10 py-3 rounded-xl font-bold hover:bg-white/20">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
