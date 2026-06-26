import { PageHeader } from '@/components/patterns';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Upload,
  AlertTriangle,
  CheckCheck,
  Landmark,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';

interface BankAccount {
  id: number;
  name: string;
  bank_name: string;
  account_number?: string;
  opening_balance: number;
  currency: string;
}
interface StatementLine {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  reference?: string;
  status: 'matched' | 'unmatched';
  matched_entry_id?: number;
}
interface Reconciliation {
  bank_account: BankAccount;
  bank_balance: number;
  safe_balance: number | null;
  difference: number | null;
  total_lines: number;
  matched_count: number;
  unmatched_count: number;
  unmatched_credits: number;
  unmatched_debits: number;
  is_reconciled: boolean;
}

export default function BankReconciliationPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState<number | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: '',
    bank_name: '',
    account_number: '',
    currency: 'EGP',
    opening_balance: '',
  });
  const [importText, setImportText] = useState('');

  const { data: banks = [] } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: () =>
      authFetch(api('/api/bank-accounts')).then(async (r) => {
        if (!r.ok) throw new Error('خطأ في جلب الحسابات');
        return r.json();
      }),
  });

  const { data: lines = [], isLoading: linesLoading } = useQuery<StatementLine[]>({
    queryKey: ['bank-lines', selectedBank],
    queryFn: () => {
      if (!selectedBank) return Promise.resolve([]);
      return authFetch(api(`/api/bank-accounts/${selectedBank}/lines`)).then(async (r) => {
        if (!r.ok) throw new Error('خطأ في جلب السطور');
        return r.json();
      });
    },
    enabled: !!selectedBank,
  });

  const { data: reconciliation } = useQuery<Reconciliation>({
    queryKey: ['bank-reconciliation', selectedBank],
    queryFn: () => {
      if (!selectedBank) return Promise.resolve(null as unknown as Reconciliation);
      return authFetch(api(`/api/bank-accounts/${selectedBank}/reconciliation`)).then(async (r) => {
        if (!r.ok) throw new Error('خطأ في جلب المطابقة');
        return r.json();
      });
    },
    enabled: !!selectedBank,
  });

  const addBankMutation = useMutation({
    mutationFn: (data: typeof bankForm) =>
      authFetch(api('/api/bank-accounts'), { method: 'POST', body: JSON.stringify(data) }).then(
        async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? 'فشل الإضافة');
          return d;
        }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setShowAddBank(false);
      toast({ title: 'تم إضافة الحساب البنكي' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const importMutation = useMutation({
    mutationFn: (rows: object[]) =>
      authFetch(api(`/api/bank-accounts/${selectedBank}/lines`), {
        method: 'POST',
        body: JSON.stringify(rows),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'فشل الاستيراد');
        return d;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bank-lines', selectedBank] });
      void qc.invalidateQueries({ queryKey: ['bank-reconciliation', selectedBank] });
      setShowImport(false);
      setImportText('');
      toast({ title: 'تم استيراد كشف الحساب' });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const matchMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/bank-statement-lines/${id}/match`), {
        method: 'PATCH',
        body: JSON.stringify({}),
      }).then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          throw new Error(d.error ?? 'فشلت المطابقة');
        }
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bank-lines', selectedBank] });
      void qc.invalidateQueries({ queryKey: ['bank-reconciliation', selectedBank] });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const unmatchMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/bank-statement-lines/${id}/unmatch`), {
        method: 'PATCH',
        body: JSON.stringify({}),
      }).then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          throw new Error(d.error ?? 'فشل إلغاء المطابقة');
        }
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bank-lines', selectedBank] });
      void qc.invalidateQueries({ queryKey: ['bank-reconciliation', selectedBank] });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  function handleImport() {
    const rows = importText
      .trim()
      .split('\n')
      .map((line) => {
        const [date, description, amount, type] = line.split('\t').map((s) => s.trim());
        return {
          date,
          description,
          amount: parseFloat(amount),
          type: type || (parseFloat(amount) > 0 ? 'credit' : 'debit'),
        };
      })
      .filter((r) => r.date && r.description && !isNaN(r.amount));
    if (rows.length === 0) {
      toast({ title: 'لا توجد بيانات صحيحة', variant: 'destructive' });
      return;
    }
    importMutation.mutate(rows);
  }

  return (
    <div className="erp-page">
      <PageHeader
        title="المطابقة البنكية"
        subtitle="مطابقة كشف الحساب البنكي مع القيود المحاسبية"
        actionsSlot={
          <Button onClick={() => setShowAddBank(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" /> إضافة حساب بنكي
          </Button>
        }
      />

      {/* Banks List */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {banks.map((bank) => (
          <button
            key={bank.id}
            onClick={() => setSelectedBank(bank.id)}
            className={`p-4 rounded-xl border text-right transition-all ${selectedBank === bank.id ? 'border-blue-500 bg-blue-500/10' : 'border-line bg-surface hover:bg-surface'}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-ink/50">{bank.currency}</span>
            </div>
            <p className="font-medium text-ink text-sm">{bank.name}</p>
            <p className="text-xs text-ink/50">{bank.bank_name}</p>
            <p className="text-sm font-mono text-green-400 mt-1">
              {formatCurrency(bank.opening_balance)}
            </p>
          </button>
        ))}
        {banks.length === 0 && (
          <div className="col-span-4 text-center text-ink/50 py-8">
            لا توجد حسابات بنكية، أضف حساباً أولاً
          </div>
        )}
      </div>

      {selectedBank && reconciliation && (
        <>
          {/* Reconciliation Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'الرصيد البنكي',
                value: formatCurrency(reconciliation.bank_balance),
                color: 'text-blue-400',
              },
              {
                label: 'رصيد الخزينة',
                value:
                  reconciliation.safe_balance !== null
                    ? formatCurrency(reconciliation.safe_balance)
                    : 'غير مرتبط',
                color: 'text-ink/50',
              },
              {
                label: 'الفرق',
                value:
                  reconciliation.difference !== null
                    ? formatCurrency(Math.abs(reconciliation.difference))
                    : '—',
                color:
                  Math.abs(reconciliation.difference ?? 1) < 0.01
                    ? 'text-green-400'
                    : 'text-red-400',
              },
              {
                label: 'نسبة المطابقة',
                value:
                  reconciliation.total_lines > 0
                    ? `${Math.round((reconciliation.matched_count / reconciliation.total_lines) * 100)}%`
                    : '0%',
                color: 'text-amber-400',
              },
            ].map((card) => (
              <div key={card.label} className="erp-card p-4">
                <p className="erp-kpi-label">{card.label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {reconciliation.is_reconciled && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-green-400">
              <CheckCheck className="h-5 w-5" />
              <span className="font-medium">الحساب متطابق بالكامل</span>
            </div>
          )}

          {reconciliation.unmatched_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <span>
                {reconciliation.unmatched_count} سطر غير مطابق — إيداعات{' '}
                {formatCurrency(reconciliation.unmatched_credits)} | سحوبات{' '}
                {formatCurrency(reconciliation.unmatched_debits)}
              </span>
            </div>
          )}

          {/* Statement Lines */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">كشف الحساب البنكي</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-line text-ink/70 hover:text-ink"
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-4 w-4" /> استيراد كشف حساب
            </Button>
          </div>

          {linesLoading ? (
            <div className="text-center text-ink/50 py-10">جاري التحميل...</div>
          ) : lines.length === 0 ? (
            <div className="text-center text-ink/50 py-10">لا توجد سطور، استورد كشف الحساب</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-ink/60 text-right">
                    {['التاريخ', 'البيان', 'النوع', 'المبلغ', 'المرجع', 'الحالة', 'إجراء'].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 font-medium">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lines.map((line) => (
                    <tr
                      key={line.id}
                      className={`hover:bg-surface ${line.status === 'matched' ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 text-ink/70 font-mono text-xs">{line.date}</td>
                      <td className="px-4 py-3 text-ink max-w-[200px] truncate">
                        {line.description}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            line.type === 'credit'
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-red-500/15 text-red-400'
                          }
                        >
                          {line.type === 'credit' ? 'إيداع' : 'سحب'}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 font-mono font-medium ${line.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {line.type === 'credit' ? '+' : '-'}
                        {formatCurrency(line.amount)}
                      </td>
                      <td className="px-4 py-3 text-ink/50 text-xs">{line.reference || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            line.status === 'matched'
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }
                        >
                          {line.status === 'matched' ? 'مطابق' : 'غير مطابق'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {line.status === 'unmatched' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-green-400 hover:bg-green-500/10"
                            onClick={() => matchMutation.mutate(line.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 ml-1" /> مطابقة
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-ink/40 hover:text-ink/70"
                            onClick={() => unmatchMutation.mutate(line.id)}
                          >
                            <XCircle className="h-3 w-3 ml-1" /> إلغاء
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add Bank Dialog */}
      <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة حساب بنكي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[
              { label: 'اسم الحساب', key: 'name', placeholder: 'مثال: الحساب الجاري — CIB' },
              { label: 'اسم البنك', key: 'bank_name', placeholder: 'مثال: CIB, البنك الأهلي' },
              { label: 'رقم الحساب (اختياري)', key: 'account_number', placeholder: '1234567890' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  className="bg-surface border-line"
                  placeholder={placeholder}
                  value={(bankForm as Record<string, string>)[key]}
                  onChange={(e) => setBankForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>العملة</Label>
                <Select
                  value={bankForm.currency}
                  onValueChange={(v) => setBankForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger className="bg-surface border-line">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['EGP', 'USD', 'CNY'].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الرصيد الافتتاحي</Label>
                <Input
                  type="number"
                  className="bg-surface border-line"
                  value={bankForm.opening_balance}
                  onChange={(e) => setBankForm((f) => ({ ...f, opening_balance: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={addBankMutation.isPending}
              onClick={() => addBankMutation.mutate(bankForm)}
            >
              {addBankMutation.isPending ? 'جاري الإضافة...' : 'إضافة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="bg-card border-border text-card-foreground max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>استيراد كشف الحساب البنكي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 text-xs text-ink/60 space-y-1">
              <p className="font-medium text-ink/80">
                تنسيق البيانات (كل سطر: تاريخ TAB بيان TAB مبلغ TAB نوع)
              </p>
              <p>مثال:</p>
              <code className="block bg-black/30 p-2 rounded text-green-300 mt-1 font-mono">
                {'2024-01-15\tتحصيل فاتورة\t5000\tcredit'}
                <br />
                {'2024-01-16\tدفع مستلزمات\t1200\tdebit'}
              </code>
            </div>
            <div className="space-y-2">
              <Label>البيانات</Label>
              <textarea
                className="w-full h-40 bg-surface border border-line rounded-lg p-3 text-sm text-ink placeholder-white/30 resize-none focus:outline-none focus:border-blue-500"
                placeholder="الصق بيانات كشف الحساب هنا..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={importMutation.isPending || !importText.trim()}
              onClick={handleImport}
            >
              {importMutation.isPending ? 'جاري الاستيراد...' : 'استيراد'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
