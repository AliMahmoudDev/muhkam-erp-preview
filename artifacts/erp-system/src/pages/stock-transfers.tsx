/**
 * صفحة تحويل المخزون — نقل كميات بين المستودعات
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { ArrowRightLeft, Plus, CheckCircle, X, ArrowRight } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

interface Transfer {
  id: number;
  from_warehouse_name: string | null;
  to_warehouse_name: string | null;
  item_count: number;
  notes: string | null;
  created_at: string;
}
interface Warehouse { id: number; name: string; }
interface Product { id: number; name: string; quantity: number; }

interface TransferItem {
  product_id: number;
  product_name: string;
  max_qty: number;
  qty: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StockTransfers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItem[]>([]);

  const { data: transfers = [], isLoading } = useQuery<Transfer[]>({
    queryKey: ['/api/inventory/transfers-enriched'],
    queryFn: () => authFetch(api('/api/inventory/transfers-enriched')).then(r => { if (!r.ok) throw new Error('خطأ'); return r.json(); }),
    staleTime: 30_000,
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () => authFetch(api('/api/settings/warehouses')).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: () => authFetch(api('/api/products')).then(r => r.json()),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!fromWarehouse || !toWarehouse) throw new Error('اختر المستودع المصدر والوجهة');
      if (fromWarehouse === toWarehouse) throw new Error('المستودع المصدر والوجهة لا يمكن أن يكونا نفس المستودع');
      if (items.length === 0) throw new Error('أضف منتجاً واحداً على الأقل');
      const body = {
        from_warehouse_id: parseInt(fromWarehouse),
        to_warehouse_id: parseInt(toWarehouse),
        notes: notes || undefined,
        items: items.map(i => ({ product_id: i.product_id, qty: parseFloat(i.qty) || 0 })).filter(i => i.qty > 0),
      };
      const res = await authFetch(api('/api/inventory/transfers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'خطأ في إنشاء التحويل');
      return j;
    },
    onSuccess: () => {
      toast({ title: 'تم تنفيذ التحويل بنجاح' });
      qc.invalidateQueries({ queryKey: ['/api/inventory/transfers-enriched'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      setShowAdd(false); setItems([]); setNotes(''); setFromWarehouse(''); setToWarehouse('');
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const addProduct = (pid: number) => {
    const p = products.find(x => x.id === pid);
    if (!p || items.find(i => i.product_id === pid)) return;
    setItems(is => [...is, { product_id: p.id, product_name: p.name, max_qty: Number(p.quantity), qty: '1' }]);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-white">تحويل المخزون</h2>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          <Plus className="w-4 h-4" /> تحويل جديد
        </button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-purple-500/15">
          <p className="text-white/40 text-xs font-bold mb-1">إجمالي التحويلات</p>
          <p className="text-2xl font-black text-purple-400">{transfers.length}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <p className="text-white/40 text-xs font-bold mb-1">المستودعات</p>
          <p className="text-2xl font-black text-blue-400">{warehouses.length}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <p className="text-white/40 text-xs font-bold mb-1">آخر تحويل</p>
          <p className="text-sm font-bold text-white/60">{transfers[0] ? fmt(transfers[0].created_at) : '—'}</p>
        </div>
      </div>

      {/* قائمة التحويلات */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-semibold text-white/60">#</th>
                <th className="p-4 font-semibold text-white/60">من</th>
                <th className="p-4 font-semibold text-white/60"></th>
                <th className="p-4 font-semibold text-white/60">إلى</th>
                <th className="p-4 font-semibold text-white/60">الأصناف</th>
                <th className="p-4 font-semibold text-white/60">ملاحظات</th>
                <th className="p-4 font-semibold text-white/60">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton cols={7} rows={4} /> : transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <ArrowRightLeft className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40">لا توجد تحويلات — اضغط «تحويل جديد»</div>
                    <div className="text-white/25 text-sm mt-1">يلزم وجود مستودعَين على الأقل</div>
                  </td>
                </tr>
              ) : transfers.map(t => (
                <tr key={t.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-4 font-mono text-xs text-white/40">#{t.id}</td>
                  <td className="p-4">
                    <span className="font-bold text-blue-300">{t.from_warehouse_name || 'المستودع الرئيسي'}</span>
                  </td>
                  <td className="p-4">
                    <ArrowRight className="w-4 h-4 text-white/30 mx-auto" />
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-emerald-300">{t.to_warehouse_name || 'المستودع الرئيسي'}</span>
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-white/60">{t.item_count} صنف</span>
                    </span>
                  </td>
                  <td className="p-4 text-white/40 text-sm max-w-[150px] truncate">{t.notes || '—'}</td>
                  <td className="p-4 text-white/40 text-sm">{fmt(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال إنشاء تحويل */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl p-8 w-full max-w-2xl space-y-4 modal-panel max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-white/40" /></button>
              <h3 className="text-xl font-bold text-white">تحويل مخزون جديد</h3>
            </div>
            {warehouses.length < 2 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <ArrowRightLeft className="w-12 h-12 text-white/10 mx-auto" />
                  <p className="text-white/50">يلزم إنشاء مستودعَين على الأقل</p>
                  <p className="text-white/30 text-sm">اذهب إلى الإعدادات → المستودعات لإضافة مستودعات</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-3 items-center flex-shrink-0">
                  <div className="flex-1">
                    <label className="text-white/60 text-xs block mb-1">من المستودع *</label>
                    <select required className="glass-input w-full" value={fromWarehouse} onChange={e => setFromWarehouse(e.target.value)}>
                      <option value="">-- اختر --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/30 mt-5 shrink-0" />
                  <div className="flex-1">
                    <label className="text-white/60 text-xs block mb-1">إلى المستودع *</label>
                    <select required className="glass-input w-full" value={toWarehouse} onChange={e => setToWarehouse(e.target.value)}>
                      <option value="">-- اختر --</option>
                      {warehouses.filter(w => String(w.id) !== fromWarehouse).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <label className="text-white/60 text-xs block mb-1">ملاحظات</label>
                  <input className="glass-input w-full" placeholder="اختياري" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="flex-shrink-0">
                  <label className="text-white/60 text-xs block mb-1">أضف منتجاً</label>
                  <select className="glass-input w-full" onChange={e => { if (e.target.value) { addProduct(parseInt(e.target.value)); e.target.value = ''; } }}>
                    <option value="">-- اختر منتجاً --</option>
                    {products.filter(p => !items.find(i => i.product_id === p.id) && Number(p.quantity) > 0).map(p => (
                      <option key={p.id} value={p.id}>{p.name} (متاح: {p.quantity})</option>
                    ))}
                  </select>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">أضف منتجات من القائمة أعلاه</div>
                  ) : (
                    <table className="w-full text-sm text-right">
                      <thead><tr className="text-white/40 text-xs border-b border-white/10">
                        <th className="pb-2">المنتج</th>
                        <th className="pb-2 text-center">متاح</th>
                        <th className="pb-2 text-center">الكمية المُحوَّلة</th>
                        <th className="pb-2"></th>
                      </tr></thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.product_id} className="border-b border-white/5">
                            <td className="py-2 text-white/80">{item.product_name}</td>
                            <td className="py-2 text-center text-white/40">{item.max_qty}</td>
                            <td className="py-2 text-center">
                              <input type="number" min="1" max={item.max_qty} step="1"
                                className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-center text-white text-xs focus:outline-none focus:border-amber-400/50"
                                value={item.qty}
                                onChange={e => {
                                  const v = Math.min(parseFloat(e.target.value) || 1, item.max_qty);
                                  setItems(is => is.map(i => i.product_id === item.product_id ? { ...i, qty: String(v) } : i));
                                }}
                              />
                            </td>
                            <td className="py-2 text-center">
                              <button onClick={() => setItems(is => is.filter(i => i.product_id !== item.product_id))} className="text-white/30 hover:text-red-400">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <button
                    onClick={() => createMutation.mutate()}
                    disabled={items.length === 0 || !fromWarehouse || !toWarehouse || createMutation.isPending}
                    className="flex-1 btn-primary py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'جاري التحويل...' : `✓ تنفيذ التحويل (${items.length} صنف)`}
                  </button>
                  <button onClick={() => setShowAdd(false)} className="flex-1 bg-white/10 py-3 rounded-xl font-bold hover:bg-white/20">إلغاء</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
