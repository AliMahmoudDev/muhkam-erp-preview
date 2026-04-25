import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart3, Trash2, TrendingUp, TrendingDown, ChevronLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';


interface Budget { id: number; name: string; fiscal_year: number; date_from: string; date_to: string; status: string; notes?: string; }
interface ComparisonRow { account_code: string; account_name: string; account_type: string; period: string; budgeted_amount: number; actual_amount: number; variance: number; variance_pct: number | null; }
interface BudgetDetail { budget: Budget; comparison: ComparisonRow[]; summary: { total_budgeted: number; total_actual: number; total_variance: number }; }

export default function BudgetsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Budget | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', fiscal_year: new Date().getFullYear().toString(),
    date_from: `${new Date().getFullYear()}-01-01`,
    date_to: `${new Date().getFullYear()}-12-31`,
    notes: '',
  });

  const { data: budgets = [], isLoading } = useQuery<Budget[]>({
    queryKey: ['budgets'],
    queryFn: () => authFetch(api('/api/budgets')).then(async r => {
      if (!r.ok) throw new Error('خطأ في جلب الميزانيات');
      return r.json();
    }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<BudgetDetail>({
    queryKey: ['budget-detail', selected?.id],
    queryFn: () => {
      if (!selected) return Promise.resolve(null as unknown as BudgetDetail);
      return authFetch(api(`/api/budgets/${selected.id}/actual-vs-budget`)).then(async r => {
        if (!r.ok) throw new Error('خطأ في تحميل تفاصيل الميزانية');
        return r.json();
      });
    },
    enabled: !!selected,
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) =>
      authFetch(api('/api/budgets'), { method: 'POST', body: JSON.stringify(data) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'فشل الإنشاء'); return d; }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['budgets'] });
      setShowAdd(false);
      toast({ title: 'تم إنشاء الميزانية' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/budgets/${id}`), { method: 'DELETE' })
        .then(async r => { if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'فشل الحذف'); } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['budgets'] });
      setSelected(null);
      toast({ title: 'تم الحذف' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  /* ── Detail View ─────────────────────────────────────────────── */
  if (selected) {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-white/50">
          <div className="text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30 animate-pulse" />
            <p>جاري تحميل الميزانية...</p>
          </div>
        </div>
      );
    }

    const comp = detail?.comparison ?? [];
    const revenues = comp.filter(r => r.account_type === 'revenue');
    const expenses = comp.filter(r => r.account_type === 'expense');

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" className="gap-1 text-white/60 hover:text-white" onClick={() => setSelected(null)}>
            <ChevronLeft className="h-4 w-4" /> عودة
          </Button>
          <h1 className="text-xl font-bold text-white">{detail?.budget.name ?? selected.name}</h1>
          <span className="text-white/50 text-sm">{selected.date_from} — {selected.date_to}</span>
          <Button size="sm" variant="ghost" className="mr-auto text-red-400 hover:bg-red-500/10"
            onClick={() => { if (confirm('حذف الميزانية؟')) deleteMutation.mutate(selected.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary */}
        {detail && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'إجمالي الميزانية', value: detail.summary.total_budgeted, color: 'text-blue-400' },
              { label: 'إجمالي الفعلي', value: detail.summary.total_actual, color: 'text-green-400' },
              { label: 'الانحراف الإجمالي', value: detail.summary.total_variance, color: detail.summary.total_variance >= 0 ? 'text-green-400' : 'text-red-400' },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-white/50 text-sm">{c.label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${c.color}`}>{formatCurrency(c.value)}</p>
              </div>
            ))}
          </div>
        )}

        {comp.length === 0 ? (
          <div className="text-center text-white/50 py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد سطور ميزانية بعد</p>
            <p className="text-xs mt-1 text-white/30">استخدم الـ API لإضافة أرقام الميزانية للحسابات</p>
          </div>
        ) : (
          <>
            {[
              { title: 'الإيرادات', rows: revenues, icon: TrendingUp },
              { title: 'المصروفات', rows: expenses, icon: TrendingDown },
            ].map(({ title, rows, icon: Icon }) => rows.length > 0 && (
              <div key={title}>
                <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4" /> {title}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 text-white/60 text-right">
                        {['الحساب', 'الفترة', 'الميزانية', 'الفعلي', 'الانحراف', '%'].map(h => (
                          <th key={h} className="px-4 py-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rows.map((r, i) => {
                        const good = r.account_type === 'revenue' ? r.variance >= 0 : r.variance <= 0;
                        return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5">
                              <p className="text-white font-medium">{r.account_name}</p>
                              <p className="text-xs text-white/40 font-mono">{r.account_code}</p>
                            </td>
                            <td className="px-4 py-2.5 text-white/60 font-mono text-xs">{r.period}</td>
                            <td className="px-4 py-2.5 font-mono text-white/80">{formatCurrency(r.budgeted_amount)}</td>
                            <td className="px-4 py-2.5 font-mono text-white">{formatCurrency(r.actual_amount)}</td>
                            <td className={`px-4 py-2.5 font-mono font-medium ${good ? 'text-green-400' : 'text-red-400'}`}>
                              {r.variance >= 0 ? '+' : ''}{formatCurrency(r.variance)}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge className={good ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}>
                                {r.variance_pct !== null ? `${r.variance_pct > 0 ? '+' : ''}${r.variance_pct}%` : '—'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  /* ── List View ───────────────────────────────────────────────── */
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">الميزانية التقديرية</h1>
          <p className="text-white/50 text-sm mt-1">مقارنة الميزانية بالأرقام الفعلية من القيود المحاسبية</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" /> إنشاء ميزانية
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-white/50 py-20">جاري التحميل...</div>
      ) : budgets.length === 0 ? (
        <div className="text-center text-white/50 py-20">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">لا توجد ميزانيات بعد</p>
          <p className="text-sm text-white/30 mt-1">أنشئ ميزانية جديدة للبدء في متابعة الأداء</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(budget => (
            <button key={budget.id} onClick={() => setSelected(budget)}
              className="p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-blue-500/30 text-right transition-all group">
              <div className="flex items-center justify-between mb-3">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                <Badge className="bg-blue-500/15 text-blue-400 text-xs">سنة {budget.fiscal_year}</Badge>
              </div>
              <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">{budget.name}</h3>
              <p className="text-xs text-white/50 mt-1 font-mono">{budget.date_from} — {budget.date_to}</p>
              {budget.notes && <p className="text-xs text-white/40 mt-2 line-clamp-2">{budget.notes}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-blue-400">عرض التقرير ←</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#0f1729] border-white/10 text-white max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إنشاء ميزانية تقديرية</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>اسم الميزانية</Label>
                <Input className="bg-white/5 border-white/10" placeholder="مثال: ميزانية 2025"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>السنة المالية</Label>
                <Input type="number" className="bg-white/5 border-white/10"
                  value={form.fiscal_year} onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input className="bg-white/5 border-white/10" placeholder="اختياري"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input type="date" className="bg-white/5 border-white/10"
                  value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input type="date" className="bg-white/5 border-white/10"
                  value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
              </div>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300">
              بعد إنشاء الميزانية، يمكنك تحديث أرقام الميزانية لكل حساب وفترة عبر الـ API
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
