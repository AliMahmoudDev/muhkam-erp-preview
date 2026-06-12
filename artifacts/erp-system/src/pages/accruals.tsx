import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';


interface Accrual {
  id: number;
  type: 'prepayment' | 'accrual';
  category: 'expense' | 'revenue';
  description: string;
  total_amount: number;
  amount_recognized: number;
  monthly_amount: number;
  months_total: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed';
}

const typeLabel = { prepayment: 'مدفوع مقدماً', accrual: 'مستحق' };
const categoryLabel = { expense: 'مصروف', revenue: 'إيراد' };
const statusColor = { active: 'bg-blue-500/15 text-blue-400', completed: 'bg-green-500/15 text-green-400' };
const statusLabel = { active: 'نشط', completed: 'مكتمل' };

export default function AccrualsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showRecognize, setShowRecognize] = useState<Accrual | null>(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    type: 'prepayment', category: 'expense', description: '', total_amount: '',
    months_total: '12', start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
  });

  const { data: accruals = [], isLoading } = useQuery<Accrual[]>({
    queryKey: ['accruals'],
    queryFn: () => authFetch(api('/api/accruals')).then(async r => {
      if (!r.ok) throw new Error('خطأ في جلب البيانات');
      return r.json();
    }),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof form) =>
      authFetch(api('/api/accruals'), { method: 'POST', body: JSON.stringify(data) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'فشل الإنشاء'); return d; }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accruals'] });
      setShowAdd(false);
      toast({ title: 'تم إنشاء السجل بنجاح' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const recognizeMutation = useMutation({
    mutationFn: ({ id, period }: { id: number; period: string }) =>
      authFetch(api(`/api/accruals/${id}/recognize`), { method: 'POST', body: JSON.stringify({ period }) })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'فشل التسجيل'); return d; }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accruals'] });
      setShowRecognize(null);
      toast({ title: 'تم تسجيل الاستحقاق وإنشاء القيد المحاسبي' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/accruals/${id}`), { method: 'DELETE' })
        .then(async r => { if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'فشل الحذف'); } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['accruals'] }); toast({ title: 'تم الحذف' }); },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">الاستحقاقات والمدفوعات المقدمة</h1>
          <p className="text-ink/50 text-sm mt-1">إدارة المصروفات/الإيرادات المؤجلة والمستحقة مع القيود التلقائية</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" /> إضافة جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-ink/50 py-20">جاري التحميل...</div>
      ) : accruals.length === 0 ? (
        <div className="text-center text-ink/50 py-20">لا توجد سجلات بعد</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-ink/60 text-right">
                {['النوع', 'التصنيف', 'البيان', 'الإجمالي', 'المُعترف به', 'المتبقي', 'التقدم', 'الحالة', 'إجراءات'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {accruals.map(a => {
                const pct = Math.round((a.amount_recognized / a.total_amount) * 100);
                const remaining = a.total_amount - a.amount_recognized;
                return (
                  <tr key={a.id} className="hover:bg-surface text-ink/85">
                    <td className="px-4 py-3 font-medium">{typeLabel[a.type]}</td>
                    <td className="px-4 py-3">{categoryLabel[a.category]}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{a.description}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(a.total_amount)}</td>
                    <td className="px-4 py-3 font-mono text-green-400">{formatCurrency(a.amount_recognized)}</td>
                    <td className="px-4 py-3 font-mono text-amber-400">{formatCurrency(remaining)}</td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-ink/50">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColor[a.status]}>{statusLabel[a.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {a.status === 'active' && (
                          <Button size="sm" variant="outline"
                            className="h-7 px-2 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                            onClick={() => setShowRecognize(a)}>
                            <CheckCircle2 className="h-3 w-3 ml-1" /> تسجيل
                          </Button>
                        )}
                        <Button size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => { if (confirm('تأكيد الحذف؟')) deleteMutation.mutate(a.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>إضافة استحقاق / مدفوع مقدماً</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-surface border-line"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepayment">مدفوع مقدماً</SelectItem>
                    <SelectItem value="accrual">مستحق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-surface border-line"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">مصروف</SelectItem>
                    <SelectItem value="revenue">إيراد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>البيان</Label>
              <Input className="bg-surface border-line" placeholder="وصف الاستحقاق..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المبلغ الإجمالي</Label>
                <Input type="number" className="bg-surface border-line" placeholder="0.00"
                  value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>عدد الأشهر</Label>
                <Input type="number" className="bg-surface border-line" min="1" max="60"
                  value={form.months_total} onChange={e => setForm(f => ({ ...f, months_total: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" className="bg-surface border-line"
                  value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية</Label>
                <Input type="date" className="bg-surface border-line"
                  value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            {form.total_amount && form.months_total && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-sm text-blue-300">
                القسط الشهري: {formatCurrency(parseFloat(form.total_amount) / parseInt(form.months_total))}
              </div>
            )}
            <Button className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={addMutation.isPending}
              onClick={() => addMutation.mutate(form)}>
              {addMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recognize Dialog */}
      <Dialog open={!!showRecognize} onOpenChange={() => setShowRecognize(null)}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل الاستحقاق الشهري</DialogTitle></DialogHeader>
          {showRecognize && (
            <div className="space-y-4">
              <div className="rounded-lg bg-surface p-3 space-y-1 text-sm">
                <p className="text-ink/60">البيان: <span className="text-ink">{showRecognize.description}</span></p>
                <p className="text-ink/60">القسط الشهري: <span className="text-green-400 font-mono">{formatCurrency(showRecognize.monthly_amount)}</span></p>
                <p className="text-ink/60">المتبقي: <span className="text-amber-400 font-mono">{formatCurrency(showRecognize.total_amount - showRecognize.amount_recognized)}</span></p>
              </div>
              <div className="space-y-2">
                <Label>الفترة (YYYY-MM)</Label>
                <Input type="month" className="bg-surface border-line"
                  value={period} onChange={e => setPeriod(e.target.value)} />
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700"
                disabled={recognizeMutation.isPending}
                onClick={() => recognizeMutation.mutate({ id: showRecognize.id, period })}>
                <RefreshCw className="h-4 w-4 ml-2" />
                {recognizeMutation.isPending ? 'جاري التسجيل...' : 'تسجيل وإنشاء قيد'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
