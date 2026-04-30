import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Target, BarChart3, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';


interface CostCenter { id: number; code: string; name: string; description?: string; is_active: boolean; }
interface CCReport {
  cost_center: CostCenter;
  lines: Array<{ account_code: string; account_name: string; account_type: string; total_debit: number; total_credit: number; net: number }>;
  summary: { total_revenue: number; total_expense: number; net_income: number };
}

export default function CostCentersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<CostCenter | null>(null);
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const { data: centers = [], isLoading } = useQuery<CostCenter[]>({
    queryKey: ['cost-centers'],
    queryFn: () => authFetch(api('/api/cost-centers')).then(async r => {
      if (!r.ok) throw new Error('خطأ في جلب البيانات');
      return r.json();
    }),
  });

  const { data: report, isLoading: reportLoading } = useQuery<CCReport>({
    queryKey: ['cc-report', selected?.id, dateFrom, dateTo],
    queryFn: () => {
      if (!selected) return Promise.resolve(null as unknown as CCReport);
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      return authFetch(api(`/api/cost-centers/${selected.id}/report?${params}`)).then(async r => {
        if (!r.ok) throw new Error('خطأ في تحميل التقرير');
        return r.json();
      });
    },
    enabled: !!selected,
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) =>
      authFetch(api('/api/cost-centers'), { method: 'POST', body: JSON.stringify(data) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'فشل الإنشاء'); return d; }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cost-centers'] });
      setShowAdd(false);
      toast({ title: 'تم إنشاء مركز التكلفة' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/cost-centers/${id}`), { method: 'DELETE' })
        .then(async r => { if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'فشل الحذف'); } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cost-centers'] });
      setSelected(null);
      toast({ title: 'تم الحذف' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">مراكز التكلفة</h1>
          <p className="text-white/50 text-sm mt-1">تقسيم الإيرادات والمصروفات على مراكز التكلفة وتقارير الربحية</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" /> إضافة مركز تكلفة
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Centers List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider">مراكز التكلفة</h2>
          {isLoading ? (
            <div className="text-center text-white/50 py-8">جاري التحميل...</div>
          ) : centers.length === 0 ? (
            <div className="text-center text-white/50 py-8">لا توجد مراكز تكلفة بعد</div>
          ) : centers.map(cc => (
            <button key={cc.id} onClick={() => setSelected(cc)}
              className={`w-full text-right p-4 rounded-xl border transition-all ${selected?.id === cc.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-mono text-white/50">{cc.code}</span>
                </div>
                <Badge className={cc.is_active ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-white/40'}>
                  {cc.is_active ? 'نشط' : 'غير نشط'}
                </Badge>
              </div>
              <p className="font-medium text-white">{cc.name}</p>
              {cc.description && <p className="text-xs text-white/40 mt-1">{cc.description}</p>}
            </button>
          ))}
        </div>

        {/* Report Panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-white/40">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>اختر مركز تكلفة لعرض التقرير</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-white flex-1">تقرير: {selected.name}</h2>
                <div className="flex gap-2 items-center">
                  <Input type="date" className="bg-white/5 border-white/10 text-white h-8 text-xs w-36"
                    value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  <span className="text-white/40">—</span>
                  <Input type="date" className="bg-white/5 border-white/10 text-white h-8 text-xs w-36"
                    value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                    onClick={() => { if (confirm('حذف مركز التكلفة؟')) deleteMutation.mutate(selected.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {reportLoading ? (
                <div className="text-center text-white/50 py-10">جاري تحميل التقرير...</div>
              ) : report ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'إجمالي الإيرادات', value: report.summary.total_revenue, color: 'text-green-400', icon: TrendingUp },
                      { label: 'إجمالي المصروفات', value: report.summary.total_expense, color: 'text-red-400', icon: TrendingDown },
                      { label: 'صافي الربح', value: report.summary.net_income, color: report.summary.net_income >= 0 ? 'text-blue-400' : 'text-red-400', icon: BarChart3 },
                    ].map(card => (
                      <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <card.icon className={`h-4 w-4 ${card.color}`} />
                          <span className="text-xs text-white/50">{card.label}</span>
                        </div>
                        <p className={`text-lg font-bold font-mono ${card.color}`}>{formatCurrency(card.value)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Detail Table */}
                  {report.lines.length === 0 ? (
                    <div className="text-center text-white/50 py-6">لا توجد حركات في هذه الفترة</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5 text-white/60 text-right">
                            {['الحساب', 'النوع', 'مدين', 'دائن', 'الصافي'].map(h => (
                              <th key={h} className="px-4 py-3 font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {report.lines.map(line => (
                            <tr key={line.account_code} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5">
                                <p className="text-white font-medium">{line.account_name}</p>
                                <p className="text-xs text-white/40 font-mono">{line.account_code}</p>
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge className={line.account_type === 'revenue' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}>
                                  {line.account_type === 'revenue' ? 'إيراد' : 'مصروف'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-white/70">{formatCurrency(line.total_debit)}</td>
                              <td className="px-4 py-2.5 font-mono text-white/70">{formatCurrency(line.total_credit)}</td>
                              <td className={`px-4 py-2.5 font-mono font-semibold ${line.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(Math.abs(line.net))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إضافة مركز تكلفة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الكود</Label>
                <Input className="bg-white/5 border-white/10" placeholder="مثال: CC-001"
                  value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input className="bg-white/5 border-white/10" placeholder="مثال: ورشة الإصلاح"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الوصف (اختياري)</Label>
              <Input className="bg-white/5 border-white/10" placeholder="وصف مختصر..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={addMutation.isPending}
              onClick={() => addMutation.mutate(form)}>
              {addMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
