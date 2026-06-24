import { safeArray } from '@/lib/safe-data';
import { PageHeader } from '@/components/patterns';
import { useState, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { authFetch } from '@/lib/auth-fetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { Plus, ShieldOff, BarChart2, TrendingDown, Ban } from 'lucide-react';
import BadDebts from './bad-debts';
import { useToast } from '@/hooks/use-toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { api } from '@/lib/api';
import type { Expense, ExpenseCategory } from './expenses/types';
import { ExpenseDetailModal } from './expenses/components/ExpenseDetailModal';
import { ExpenseReportsModal } from './expenses/components/ExpenseReportsModal';
import { AddExpenseModal } from './expenses/components/AddExpenseModal';
import { ExpensesTable } from './expenses/components/ExpensesTable';
import { ExpensesFilterToolbar } from './expenses/components/ExpensesFilterToolbar';
import { ExpensesSummaryCards } from './expenses/components/ExpensesSummaryCards';
import { ExpenseCategoryPills } from './expenses/components/ExpenseCategoryPills';

function AccessDenied({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldOff className="w-14 h-14 text-red-400/40 mb-4" />
      <p className="text-ink/60 font-bold text-lg">غير مصرح</p>
      <p className="text-ink/30 text-sm mt-1">{msg}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function Expenses() {
  const { user } = useAuth();
  const canView = hasPermission(user, 'can_view_expenses') === true;
  const canAdd = hasPermission(user, 'can_add_expense') === true;
  const isCashier = user?.role === 'cashier';
  const companyName = (user as { company_name?: string })?.company_name ?? 'مُحكم - MUHKAM ERP';

  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ─── Queries ─── */
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: () =>
      authFetch(api('/api/expenses')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });
  const { data: categoriesRaw = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ['/api/expense-categories'],
    queryFn: () => authFetch(api('/api/expense-categories')).then((r) => (r.ok ? r.json() : [])),
    enabled: canView,
  });
  const categories: ExpenseCategory[] = safeArray(categoriesRaw);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/expenses/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في حذف المصروف');
      return j;
    },
  });

  /* ─── States ─── */
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTabExpenses = new URLSearchParams(searchStr).get('tab') as 'expenses' | 'debts' | null;
  const [activeTab, setActiveTab] = useState<'expenses' | 'debts'>(urlTabExpenses ?? 'expenses');

  const changeTab = (t: 'expenses' | 'debts') => {
    setActiveTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailItem, setDetailItem] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    safe_id: '',
  });

  const [newCatName, setNewCatName] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<number | null>(null);

  const [showReports, setShowReports] = useState(false);

  /* ─── Computed stats ─── */
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalAll = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const thisMonthExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.created_at).toISOString().slice(0, 7) === thisMonthKey),
    [expenses, thisMonthKey]
  );

  const totalMonth = useMemo(
    () => thisMonthExpenses.reduce((s, e) => s + e.amount, 0),
    [thisMonthExpenses]
  );

  /* Category breakdown for this month */
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthExpenses.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    });
    return Object.entries(map)
      .map(([cat, amt]) => ({ cat, amt }))
      .sort((a, b) => b.amt - a.amt);
  }, [thisMonthExpenses]);

  const topCategory = categoryBreakdown[0];

  /* ─── Filtered list ─── */
  const filtered = useMemo(() => {
    return safeArray(expenses).filter((e) => {
      const matchSearch =
        !search || e.category.includes(search) || (e.description ?? '').includes(search);
      const matchCat = !catFilter || e.category === catFilter;
      const d = new Date(e.created_at).toISOString().slice(0, 10);
      const matchFrom = !dateFrom || d >= dateFrom;
      const matchTo = !dateTo || d <= dateTo;
      return matchSearch && matchCat && matchFrom && matchTo;
    });
  }, [expenses, search, catFilter, dateFrom, dateTo]);

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const hasFilter = search || catFilter || dateFrom || dateTo;

  /* ─── Mutations ─── */
  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch(api('/api/expenses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'خطأ');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إضافة المصروف بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial-transactions'] });
      setShowAdd(false);
      setFormData({ category: '', amount: '', description: '', safe_id: '' });
    },
    onError: (e: Error) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  /* ─── Category handlers ─── */
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCatLoading(true);
    try {
      const r = await authFetch(api('/api/expense-categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: data.error ?? 'خطأ', variant: 'destructive' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['/api/expense-categories'] });
      setNewCatName('');
      setFormData((f) => ({ ...f, category: name }));
      toast({ title: `تم إضافة التصنيف "${name}"` });
    } finally {
      setCatLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await authFetch(api(`/api/expense-categories/${id}`), { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['/api/expense-categories'] });
      if (formData.category === categories.find((c) => c.id === id)?.name)
        setFormData((f) => ({ ...f, category: '' }));
      toast({ title: 'تم حذف التصنيف' });
    } catch {
      toast({ title: 'خطأ في الحذف', variant: 'destructive' });
    } finally {
      setConfirmDeleteCatId(null);
    }
  };

  /* ─── Expense handlers ─── */
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      toast({ title: 'اختر تصنيف المصروف', variant: 'destructive' });
      return;
    }
    const body: Record<string, unknown> = {
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description || undefined,
    };
    if (isCashier && user?.safe_id) body.safe_id = user.safe_id;
    else if (formData.safe_id) body.safe_id = parseInt(formData.safe_id);
    createMutation.mutate(body);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: 'تم حذف المصروف بنجاح' });
        queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
        setConfirmDeleteId(null);
      },
      onError: (e: Error) => {
        toast({ title: (e as Error).message, variant: 'destructive' });
        setConfirmDeleteId(null);
      },
    });
  };

  if (!canView)
    return (
      <AccessDenied msg="غير مصرح لك بالوصول إلى المصروفات — تواصل مع المدير لتفعيل الصلاحية" />
    );

  return (
    <div className="erp-page">
      {/* Modals */}
      {confirmDeleteId !== null && (
        <ConfirmModal
          title="حذف المصروف"
          description="هل أنت متأكد من حذف هذا المصروف؟ سيتم عكس الحركة من الخزينة."
          isPending={deleteMutation.isPending}
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {confirmDeleteCatId !== null && (
        <ConfirmModal
          title="حذف التصنيف"
          description="هل أنت متأكد من حذف هذا التصنيف؟ إذا كان هناك أي مصروف مسجل عليه فلن يمكن حذفه."
          isPending={false}
          onConfirm={() => handleDeleteCategory(confirmDeleteCatId)}
          onCancel={() => setConfirmDeleteCatId(null)}
        />
      )}
      {detailItem && <ExpenseDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}

      {/* ─── Header ─── */}
      <PageHeader
        title={activeTab === 'expenses' ? 'إدارة المصروفات' : 'الديون المعدومة / المتعثرة'}
        actionsSlot={
          <>
            {activeTab === 'expenses' && (
              <button
                onClick={() => setShowReports(true)}
                className="erp-btn erp-btn-secondary erp-btn-sm"
              >
                <BarChart2 className="w-4 h-4" /> تقارير المصروفات
              </button>
            )}
            {canAdd && activeTab === 'expenses' && (
              <button
                onClick={() => setShowAdd(true)}
                className="erp-btn erp-btn-primary erp-btn-sm"
              >
                <Plus className="w-4 h-4" /> إضافة مصروف
              </button>
            )}
            {canAdd && activeTab === 'debts' && (
              <button
                onClick={() => {
                  const fn = (window as unknown as { __openBadDebtForm?: () => void })
                    .__openBadDebtForm;
                  if (fn) fn();
                }}
                className="erp-btn erp-btn-primary erp-btn-sm"
              >
                <Plus className="w-4 h-4" /> إضافة دين
              </button>
            )}
          </>
        }
      />

      {/* ─── Tabs ─── */}
      <div className="erp-tab-bar erp-tab-bar--underline">
        <button
          onClick={() => changeTab('expenses')}
          className={`erp-tab${activeTab === 'expenses' ? ' erp-tab--active' : ''}`}
        >
          <TrendingDown className="w-4 h-4" /> المصروفات
        </button>
        <button
          onClick={() => changeTab('debts')}
          className={`erp-tab${activeTab === 'debts' ? ' erp-tab--active' : ''}`}
        >
          <Ban className="w-4 h-4" /> الديون المعدومة
        </button>
      </div>

      {activeTab === 'debts' && <BadDebts embedded />}
      {activeTab === 'expenses' && (
        <>
          <ExpensesSummaryCards
            totalAll={totalAll}
            totalMonth={totalMonth}
            topCategory={topCategory}
            totalRecords={expenses.length}
          />

          <ExpenseCategoryPills
            categoryBreakdown={categoryBreakdown}
            catFilter={catFilter}
            setCatFilter={setCatFilter}
          />

          <ExpensesFilterToolbar
            search={search}
            setSearch={setSearch}
            catFilter={catFilter}
            setCatFilter={setCatFilter}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            categories={categories}
            hasFilter={!!hasFilter}
            onClearAll={() => {
              setSearch('');
              setCatFilter('');
              setDateFrom('');
              setDateTo('');
            }}
          />

          <AddExpenseModal
            show={showAdd}
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            safes={safes}
            isCashier={isCashier}
            userSafeName={safes.find((s) => s.id === user?.safe_id)?.name ?? 'الخزينة الافتراضية'}
            newCatName={newCatName}
            setNewCatName={setNewCatName}
            catLoading={catLoading}
            createIsPending={createMutation.isPending}
            handleAdd={handleAdd}
            handleAddCategory={handleAddCategory}
            onDeleteCategory={(id) => setConfirmDeleteCatId(id)}
            onClose={() => setShowAdd(false)}
          />

          <ExpensesTable
            filtered={filtered}
            filteredTotal={filteredTotal}
            hasFilter={!!hasFilter}
            isLoading={isLoading}
            canDelete={canAdd}
            onViewDetail={(exp) => setDetailItem(exp)}
            onDelete={(id) => setConfirmDeleteId(id)}
          />

          <ExpenseReportsModal
            show={showReports}
            onClose={() => setShowReports(false)}
            categories={categories}
            companyName={companyName}
          />
        </>
      )}
    </div>
  );
}
