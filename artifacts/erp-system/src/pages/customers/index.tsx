import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ArrowDownToLine,
  FileDown,
  BarChart2,
} from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useGetCustomers, useGetSettingsSafes } from '@workspace/api-client-react';

import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { safeArray } from '@/lib/safe-data';
import { formatCurrency } from '@/lib/format';
import { exportCustomersExcel } from '@/lib/export-excel';
import { AlertSettingBanner } from '@/components/AlertSettingBanner';
import { cn } from '@/lib/utils';

import { ListPagePattern, PageHeader, PageToolbar } from '@/components/patterns';
import type { ListPageState } from '@/components/patterns';
import { SearchInput } from '@/components/ui/search-input';
import { FilterBar } from '@/components/ui/filter-bar';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

import { CustomerList } from './CustomerList';
import { CustomerStatementModal } from './CustomerLedger';
import {
  AddCustomerModal,
  EditCustomerModal,
  ReceiptModal,
  SupplierPaymentModal,
  DeleteCustomerConfirm,
} from './CustomerFormModal';
import {
  CustomerReportsModal,
  DeleteClassificationConfirm,
  type CustomerReportRow,
  type ReportFilters,
} from './CustomerClassifications';

export default function Customers() {
  const { data: customers = [], isLoading } = useGetCustomers();
  const { user } = useAuth();
  const canViewCustomers = hasPermission(user, 'can_view_customers') === true;
  const canManageCustomers = hasPermission(user, 'can_manage_customers') === true;

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      phone: string;
      balance: number;
      is_customer: boolean;
      is_supplier: boolean;
      classification_id: number | null;
    }) => {
      const r = await authFetch(api('/api/customers'), {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في إضافة العميل');
      return j;
    },
  });

  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'customers' | 'suppliers' | 'debtors' | 'creditors' | 'maintenance'
  >('all');
  const [custPage, setCustPage] = useState(1);
  const CUST_PAGE_SIZE = 50;
  const [showAdd, setShowAdd] = useState(false);
  const [showReceipt, setShowReceipt] = useState<{
    id: number;
    name: string;
    balance: number;
  } | null>(null);
  const [showStatement, setShowStatement] = useState<{
    id: number;
    name: string;
    phone: string;
    balance: number;
    isSupplier: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    balance: 0,
    is_customer: true,
    is_supplier: false,
    classification_id: null as number | null,
  });
  const [receiptData, setReceiptData] = useState({ amount: '', notes: '', safe_id: '' });

  const [showSupplierPayment, setShowSupplierPayment] = useState<{
    id: number;
    name: string;
    balance: number;
  } | null>(null);
  const [supplierPaymentData, setSupplierPaymentData] = useState({
    amount: '',
    notes: '',
    safe_id: '',
  });

  const [showEdit, setShowEdit] = useState<{
    id: number;
    name: string;
    phone: string;
    is_customer: boolean;
    is_supplier: boolean;
    classification_id?: number | null;
  } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    is_customer: true,
    is_supplier: false,
    classification_id: null as number | null,
    price_list_id: null as number | null,
    price_list_markup: '' as string,
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [showNewClassification, setShowNewClassification] = useState(false);
  const [newClassificationName, setNewClassificationName] = useState('');
  const [confirmDeleteClassificationId, setConfirmDeleteClassificationId] = useState<number | null>(
    null
  );

  const [showReports, setShowReports] = useState(false);
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    customerId: '',
    classificationId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [reportData, setReportData] = useState<CustomerReportRow[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const { data: classificationsRaw, refetch: refetchClassifications } = useQuery({
    queryKey: ['/api/customer-classifications'],
    queryFn: async () => {
      const r = await authFetch(api('/api/customer-classifications'));
      return (await r.json()) as Array<{ id: number; name: string }>;
    },
  });
  const classifications = safeArray(classificationsRaw);

  const { data: priceListsRaw } = useQuery({
    queryKey: ['/api/price-lists'],
    queryFn: async () => {
      const r = await authFetch(api('/api/price-lists'));
      return (await r.json()) as Array<{ id: number; name: string; is_active: boolean }>;
    },
  });
  const priceLists = safeArray(priceListsRaw).filter((p) => p.is_active);

  const handleAddClassification = async () => {
    if (!newClassificationName.trim()) return;
    try {
      const r = await authFetch(api('/api/customer-classifications'), {
        method: 'POST',
        body: JSON.stringify({ name: newClassificationName.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في الإضافة');
      await refetchClassifications();
      setFormData((f) => ({ ...f, classification_id: j.id }));
      setEditFormData((f) => ({ ...f, classification_id: j.id }));
      setNewClassificationName('');
      setShowNewClassification(false);
      toast({ title: '✅ تم إضافة التصنيف' });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteClassification = async (id: number) => {
    try {
      const r = await authFetch(api(`/api/customer-classifications/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في الحذف');
      await refetchClassifications();
      if (formData.classification_id === id)
        setFormData((f) => ({ ...f, classification_id: null }));
      if (editFormData.classification_id === id)
        setEditFormData((f) => ({ ...f, classification_id: null }));
      toast({ title: '✅ تم حذف التصنيف' });
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleFetchReport = async () => {
    setReportLoading(true);
    setReportData(null);
    try {
      const params = new URLSearchParams();
      if (reportFilters.customerId) params.set('customer_id', reportFilters.customerId);
      if (reportFilters.classificationId)
        params.set('classification_id', reportFilters.classificationId);
      if (reportFilters.dateFrom) params.set('date_from', reportFilters.dateFrom);
      if (reportFilters.dateTo) params.set('date_to', reportFilters.dateTo);
      const r = await authFetch(api(`/api/customer-reports?${params}`));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      setReportData(j);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setReportLoading(false);
    }
  };

  const maintenanceClassificationIds = new Set(
    classifications
      .filter(
        (cl: { id: number; name: string }) =>
          cl.name && cl.name.trim().toLowerCase() === 'عميل صيانة'.toLowerCase()
      )
      .map((cl: { id: number }) => cl.id)
  );
  const isMaintenanceCustomer = (c: object) => {
    const x = c as { classification_id?: number | null; source?: string | null };
    return (
      (x.classification_id != null && maintenanceClassificationIds.has(x.classification_id)) ||
      x.source === 'repair'
    );
  };

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const matchSearch =
          c.name.includes(search) ||
          (c.phone && c.phone.includes(search)) ||
          (c.customer_code && String(c.customer_code).includes(search));
        if (!matchSearch) return false;
        const bal = Number(c.balance);
        if (typeFilter === 'maintenance') return isMaintenanceCustomer(c);
        if (isMaintenanceCustomer(c)) return false;
        if (typeFilter === 'customers') return !c.is_supplier;
        if (typeFilter === 'suppliers') return !!c.is_supplier;
        if (typeFilter === 'debtors') return bal > 0.001;
        if (typeFilter === 'creditors') return bal < -0.001;
        return true;
      }),
    [customers, search, typeFilter]
  );

  useEffect(() => {
    setCustPage(1);
  }, [search, typeFilter]);

  const paginatedCustomers = useMemo(
    () => filtered.slice((custPage - 1) * CUST_PAGE_SIZE, custPage * CUST_PAGE_SIZE),
    [filtered, custPage, CUST_PAGE_SIZE]
  );

  const totalAR = customers
    .filter((c) => Number(c.balance) > 0.001)
    .reduce((s, c) => s + Number(c.balance), 0);
  const totalAP = customers
    .filter((c) => Number(c.balance) < -0.001)
    .reduce((s, c) => s + Math.abs(Number(c.balance)), 0);
  const totalSuppliers = customers.filter((c) => c.is_supplier).length;
  const debtorCount = customers.filter((c) => Number(c.balance) > 0.001).length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'أدخل اسم العميل', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData, {
      onSuccess: () => {
        toast({ title: '✅ تم إضافة العميل بنجاح' });
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        setShowAdd(false);
        setFormData({
          name: '',
          phone: '',
          balance: 0,
          is_customer: true,
          is_supplier: false,
          classification_id: null,
        });
        setShowNewClassification(false);
        setNewClassificationName('');
      },
      onError: (e: Error) => {
        const raw = e.message;
        const msg = raw.replace(/^HTTP \d+ [^:]+:\s*/, '');
        toast({ title: msg || 'خطأ في إضافة العميل', variant: 'destructive' });
      },
    });
  };

  const receiptMutation = useMutation({
    mutationFn: async (data: {
      customer_id: number;
      customer_name: string;
      safe_id: string;
      amount: string;
      notes: string;
    }) => {
      const r = await authFetch(api('/api/receipt-vouchers'), {
        method: 'POST',
        body: JSON.stringify({
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          safe_id: parseInt(data.safe_id),
          amount: parseFloat(data.amount),
          notes: data.notes || null,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في سند القبض');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تسجيل سند القبض بنجاح' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/receipt-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowReceipt(null);
      setReceiptData({ amount: '', notes: '', safe_id: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceipt) return;
    if (!receiptData.safe_id) {
      toast({ title: 'اختر الخزينة', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(receiptData.amount);
    if (!amt || amt <= 0) {
      toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' });
      return;
    }
    receiptMutation.mutate({
      customer_id: showReceipt.id,
      customer_name: showReceipt.name,
      safe_id: receiptData.safe_id,
      amount: receiptData.amount,
      notes: receiptData.notes,
    });
  };

  const supplierPaymentMutation = useMutation({
    mutationFn: async (data: {
      customer_id: number;
      safe_id: string;
      amount: string;
      notes: string;
    }) => {
      const r = await authFetch(api(`/api/customers/${data.customer_id}/supplier-payment`), {
        method: 'POST',
        body: JSON.stringify({
          safe_id: parseInt(data.safe_id),
          amount: parseFloat(data.amount),
          notes: data.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في تسديد الدفعة');
      return j;
    },
    onSuccess: () => {
      toast({ title: 'تم تسديد الدفعة بنجاح ✓' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowSupplierPayment(null);
      setSupplierPaymentData({ amount: '', notes: '', safe_id: '' });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSupplierPayment) return;
    if (!supplierPaymentData.safe_id) {
      toast({ title: 'اختر الخزينة', variant: 'destructive' });
      return;
    }
    const amt = parseFloat(supplierPaymentData.amount);
    if (!amt || amt <= 0) {
      toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' });
      return;
    }
    supplierPaymentMutation.mutate({
      customer_id: showSupplierPayment.id,
      safe_id: supplierPaymentData.safe_id,
      amount: supplierPaymentData.amount,
      notes: supplierPaymentData.notes,
    });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      phone: string;
      is_customer: boolean;
      is_supplier: boolean;
      classification_id: number | null;
    }) => {
      const r = await authFetch(api(`/api/customers/${data.id}`), {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name,
          phone: data.phone || null,
          is_customer: data.is_customer,
          is_supplier: data.is_supplier,
          classification_id: data.classification_id,
          price_list_id: (data as { price_list_id?: number | null }).price_list_id ?? null,
          price_list_markup: (data as { price_list_markup?: string }).price_list_markup
            ? parseFloat((data as { price_list_markup?: string }).price_list_markup!)
            : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في التعديل');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم تعديل بيانات العميل' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setShowEdit(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    if (!editFormData.name.trim()) {
      toast({ title: 'أدخل اسم العميل', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({
      id: showEdit.id,
      name: editFormData.name,
      phone: editFormData.phone,
      is_customer: editFormData.is_customer,
      is_supplier: editFormData.is_supplier,
      classification_id: editFormData.classification_id,
      price_list_id: editFormData.price_list_id,
      price_list_markup: editFormData.price_list_markup,
    } as {
      id: number;
      name: string;
      phone: string;
      is_customer: boolean;
      is_supplier: boolean;
      classification_id: number | null;
      price_list_id: number | null;
      price_list_markup: string;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/customers/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ في الحذف');
      return j;
    },
    onSuccess: () => {
      toast({ title: '✅ تم حذف العميل' });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setDeleteConfirmId(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleDelete = () => {
    if (deleteConfirmId === null) return;
    const customer = customers.find((c) => c.id === deleteConfirmId);
    if (!customer) return;
    if (Number(customer.balance) !== 0) {
      toast({ title: 'لا يمكن الحذف، يوجد رصيد غير مسوّى', variant: 'destructive' });
      setDeleteConfirmId(null);
      return;
    }
    deleteMutation.mutate(deleteConfirmId);
  };

  /* ── Permission gate ──────────────────────────────────────── */
  if (!canViewCustomers)
    return (
      <EmptyState
        variant="no-data"
        title="غير مصرح"
        description="غير مصرح لك بالوصول إلى العملاء — تواصل مع المدير لتفعيل الصلاحية"
      />
    );

  /* ── Derived state for ListPagePattern ───────────────────── */
  const pageState: ListPageState = isLoading
    ? 'loading'
    : filtered.length === 0
      ? 'empty'
      : 'idle';

  const hasActiveFilter = typeFilter !== 'all' || search !== '';
  const totalPages = Math.ceil(filtered.length / CUST_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <>
          <ListPagePattern
            state={pageState}
            /* 1. Header */
            headerSlot={
              <PageHeader
                title="العملاء والموردون"
                subtitle={
                  customers.length > 0 ? `${customers.length} عميل / مورد مسجّل` : undefined
                }
                actionsSlot={
                  <div className="flex items-center gap-2 flex-wrap">
                    {canManageCustomers && (
                      <Button size="sm" onClick={() => setShowAdd(true)}>
                        <Plus /> إضافة عميل
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowReports(true);
                        setReportData(null);
                      }}
                    >
                      <BarChart2 /> تقارير العملاء
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportCustomersExcel(customers)}
                    >
                      <FileDown /> Excel
                    </Button>
                  </div>
                }
              />
            }
            /* 2. Toolbar — search + filter chips */
            toolbarSlot={
              <PageToolbar
                searchSlot={
                  <SearchInput
                    placeholder="بحث بالاسم أو الهاتف أو الكود..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClear={() => setSearch('')}
                  />
                }
                filtersSlot={
                  <FilterBar>
                    {(
                      [
                        { key: 'all', label: 'الكل' },
                        { key: 'customers', label: 'عملاء فقط' },
                        { key: 'suppliers', label: 'موردون فقط' },
                        { key: 'debtors', label: 'عليهم رصيد (AR)' },
                        { key: 'creditors', label: 'لهم رصيد (AP)' },
                        { key: 'maintenance', label: 'عملاء صيانة' },
                      ] as const
                    ).map((f) => (
                      <Button
                        key={f.key}
                        size="sm"
                        variant={typeFilter === f.key ? 'default' : 'outline'}
                        onClick={() => setTypeFilter((v) => (v === f.key ? 'all' : f.key))}
                      >
                        {f.label}
                        {typeFilter === f.key && filtered.length > 0 && (
                          <span className="opacity-70">({filtered.length})</span>
                        )}
                      </Button>
                    ))}
                    {hasActiveFilter && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setTypeFilter('all');
                          setSearch('');
                        }}
                      >
                        <X /> مسح الفلتر
                      </Button>
                    )}
                  </FilterBar>
                }
              />
            }
            /* 3. KPI — clickable stat cards + debt alert */
            kpiSlot={
              customers.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* AR — click to filter debtors */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setTypeFilter((f) => (f === 'debtors' ? 'all' : 'debtors'))
                      }
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        setTypeFilter((f) => (f === 'debtors' ? 'all' : 'debtors'))
                      }
                      className={cn(
                        'cursor-pointer rounded-xl transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                        typeFilter === 'debtors' && 'ring-2 ring-[var(--brand)]'
                      )}
                    >
                      <StatCard
                        label="ذمم مدينة (AR)"
                        value={formatCurrency(totalAR)}
                        icon={<TrendingUp />}
                      >
                        <p className="text-xs opacity-50 mt-1">{debtorCount} عميل عليه رصيد</p>
                      </StatCard>
                    </div>

                    {/* AP — click to filter creditors */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setTypeFilter((f) => (f === 'creditors' ? 'all' : 'creditors'))
                      }
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        setTypeFilter((f) => (f === 'creditors' ? 'all' : 'creditors'))
                      }
                      className={cn(
                        'cursor-pointer rounded-xl transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                        typeFilter === 'creditors' && 'ring-2 ring-[var(--brand)]'
                      )}
                    >
                      <StatCard
                        label="ذمم دائنة (AP)"
                        value={formatCurrency(totalAP)}
                        icon={<TrendingDown />}
                      >
                        <p className="text-xs opacity-50 mt-1">
                          {customers.filter((c) => Number(c.balance) < -0.001).length} له رصيد عليك
                        </p>
                      </StatCard>
                    </div>

                    {/* Net — display only */}
                    <StatCard
                      label="الصافي"
                      value={formatCurrency(Math.abs(totalAR - totalAP))}
                      icon={<RotateCcw />}
                    >
                      <p className="text-xs opacity-50 mt-1">
                        {totalAR - totalAP >= 0 ? 'لصالحك' : 'عليك صافياً'}
                      </p>
                    </StatCard>

                    {/* Suppliers — click to filter suppliers */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setTypeFilter((f) => (f === 'suppliers' ? 'all' : 'suppliers'))
                      }
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        setTypeFilter((f) => (f === 'suppliers' ? 'all' : 'suppliers'))
                      }
                      className={cn(
                        'cursor-pointer rounded-xl transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                        typeFilter === 'suppliers' && 'ring-2 ring-[var(--brand)]'
                      )}
                    >
                      <StatCard
                        label="موردون"
                        value={totalSuppliers}
                        icon={<ArrowDownToLine />}
                      >
                        <p className="text-xs opacity-50 mt-1">جهة يتم الشراء منها</p>
                      </StatCard>
                    </div>
                  </div>

                  <AlertSettingBanner
                    enabledKey="alert_debt_enabled"
                    thresholdKey="alert_debt_days"
                    title="تنبيه الديون المتأخرة"
                    thresholdLabel="التنبيه بعد"
                    thresholdUnit="يوم"
                    icon="💰"
                    color="amber"
                    defaultThreshold="30"
                  />
                </div>
              ) : null
            }
            /* 4. Table */
            tableSlot={
              <CustomerList
                paginatedCustomers={paginatedCustomers}
                canManageCustomers={canManageCustomers}
                isMaintenanceCustomer={isMaintenanceCustomer}
                setShowStatement={setShowStatement}
                setReceiptData={setReceiptData}
                setShowReceipt={setShowReceipt}
                setSupplierPaymentData={setSupplierPaymentData}
                setShowSupplierPayment={setShowSupplierPayment}
                setShowEdit={setShowEdit}
                setEditFormData={setEditFormData}
                setDeleteConfirmId={setDeleteConfirmId}
              />
            }
            /* 5. Pagination */
            paginationSlot={
              <Pagination
                currentPage={custPage}
                totalPages={totalPages}
                onPageChange={setCustPage}
                showFirstLast
              />
            }
            /* 6. Loading skeleton */
            loadingSlot={<SkeletonTable rows={8} cols={5} />}
            /* 7. Empty state */
            emptySlot={
              <EmptyState
                variant={hasActiveFilter ? 'no-results' : 'no-data'}
                query={search || undefined}
                title={hasActiveFilter ? undefined : 'لا يوجد عملاء بعد'}
                description={
                  hasActiveFilter
                    ? undefined
                    : 'ابدأ بإضافة أول عميل أو مورد للقائمة.'
                }
                action={
                  hasActiveFilter ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTypeFilter('all');
                        setSearch('');
                      }}
                    >
                      <X /> مسح الفلتر
                    </Button>
                  ) : canManageCustomers ? (
                    <Button size="sm" onClick={() => setShowAdd(true)}>
                      <Plus /> إضافة عميل
                    </Button>
                  ) : undefined
                }
              />
            }
          />

          {/* ── Modals — all functionally unchanged ─────────── */}
          {showStatement && (
            <CustomerStatementModal
              customerId={showStatement.id}
              customerName={showStatement.name}
              customerPhone={showStatement.phone}
              customerBalance={showStatement.balance}
              isSupplier={showStatement.isSupplier}
              onClose={() => setShowStatement(null)}
              safes={safes}
            />
          )}

          <AddCustomerModal
            showAdd={showAdd}
            formData={formData}
            setFormData={setFormData}
            classifications={classifications}
            canManageCustomers={canManageCustomers}
            showNewClassification={showNewClassification}
            setShowNewClassification={setShowNewClassification}
            newClassificationName={newClassificationName}
            setNewClassificationName={setNewClassificationName}
            handleAdd={handleAdd}
            handleAddClassification={handleAddClassification}
            setConfirmDeleteClassificationId={setConfirmDeleteClassificationId}
            createMutationIsPending={createMutation.isPending}
            onClose={() => setShowAdd(false)}
          />

          <ReceiptModal
            showReceipt={showReceipt}
            receiptData={receiptData}
            setReceiptData={setReceiptData}
            safes={safes}
            isPending={receiptMutation.isPending}
            handleReceipt={handleReceipt}
            onClose={() => setShowReceipt(null)}
          />

          <SupplierPaymentModal
            showSupplierPayment={showSupplierPayment}
            supplierPaymentData={supplierPaymentData}
            setSupplierPaymentData={setSupplierPaymentData}
            safes={safes}
            isPending={supplierPaymentMutation.isPending}
            handleSupplierPayment={handleSupplierPayment}
            onClose={() => setShowSupplierPayment(null)}
          />

          <EditCustomerModal
            showEdit={showEdit}
            editFormData={editFormData}
            setEditFormData={setEditFormData}
            classifications={classifications}
            priceLists={priceLists}
            canManageCustomers={canManageCustomers}
            showNewClassification={showNewClassification}
            setShowNewClassification={setShowNewClassification}
            newClassificationName={newClassificationName}
            setNewClassificationName={setNewClassificationName}
            handleEdit={handleEdit}
            handleAddClassification={handleAddClassification}
            setConfirmDeleteClassificationId={setConfirmDeleteClassificationId}
            updateMutationIsPending={updateMutation.isPending}
            onClose={() => setShowEdit(null)}
          />

          <DeleteClassificationConfirm
            confirmDeleteClassificationId={confirmDeleteClassificationId}
            classifications={classifications}
            setConfirmDeleteClassificationId={setConfirmDeleteClassificationId}
            handleDeleteClassification={handleDeleteClassification}
          />

          <DeleteCustomerConfirm
            deleteConfirmId={deleteConfirmId}
            customers={customers}
            isPending={deleteMutation.isPending}
            handleDelete={handleDelete}
            onClose={() => setDeleteConfirmId(null)}
          />

          <CustomerReportsModal
            showReports={showReports}
            setShowReports={setShowReports}
            customers={customers}
            classifications={classifications}
            reportFilters={reportFilters}
            setReportFilters={setReportFilters}
            reportData={reportData}
            setReportData={setReportData}
            reportLoading={reportLoading}
            handleFetchReport={handleFetchReport}
            companyName={
              (user as { company_name?: string } | null)?.company_name ?? 'مُحكم - MUHKAM ERP'
            }
          />
        </>
    </div>
  );
}
