import { safeArray } from '@/lib/safe-data';
import { useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/format';
import {
  HandCoins,
  ArrowUpFromLine,
  ArrowLeftRight,
  Lock,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronLeft,
  Landmark,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import ReceiptModal from '@/components/modals/ReceiptModal';
import PaymentModal from '@/components/modals/PaymentModal';
import TransferModal from '@/components/modals/TransferModal';
import CloseSafeModal from '@/components/modals/CloseSafeModal';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import SafeModals from '@/pages/treasury/SafeModals';

type ModalType = 'receipt' | 'payment' | 'transfer' | 'safe-closing' | null;

export default function Treasury() {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [showAddSafe, setShowAddSafe] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', balance: '', branch_id: '' });
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    balance: number;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    id: number;
    name: string;
    branch_id: number | null;
  } | null>(null);
  const [editForm, setEditForm] = useState({ name: '', branch_id: '' });
  const [editSaving, setEditSaving] = useState(false);

  const queryClient = useQueryClient();
  const createSafe = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const r = await authFetch(api('/api/settings/safes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const deleteSafe = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/settings/safes/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const canAddReceipt = hasPermission(user, 'can_add_receipt_voucher');
  const canAddPayment = hasPermission(user, 'can_add_payment_voucher');
  const canTransfer = user?.role === 'admin' || user?.role === 'manager';
  const canCloseSafe = hasPermission(user, 'can_close_shift');

  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw) as {
    id: number;
    name: string;
    balance: string;
    branch_id: number | null;
  }[];

  /* branches for safe assignment */
  const { data: branchesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/branches'],
    queryFn: async () => {
      const r = await authFetch(api('/api/branches'));
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : (j.branches ?? []);
    },
    staleTime: 120_000,
  });
  const branches = safeArray(branchesRaw) as { id: number; name: string }[];
  const isAdmin = user?.role === 'admin';

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/dashboard/stats'],
    queryFn: () =>
      authFetch(api('/api/dashboard/stats')).then((r) => {
        if (!r.ok) throw new Error('خطأ');
        return r.json();
      }),
  });

  const totalSafeBalance = safes.reduce((s, safe) => s + Number(safe.balance), 0);

  const invalidateSafes = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
  };

  /* ── KPI cards ── */
  const kpis = [
    {
      label: 'رصيد الخزائن الإجمالي',
      value: formatCurrency(totalSafeBalance),
      sub: `${safes.length} خزينة`,
      icon: Wallet,
      color: 'amber',
    },
    {
      label: 'مبيعات اليوم',
      value: formatCurrency(Number(stats?.total_sales_today ?? 0)),
      sub: 'إجمالي القبض',
      icon: TrendingUp,
      color: 'emerald',
    },
    {
      label: 'مصروفات اليوم',
      value: formatCurrency(Number(stats?.total_expenses_today ?? 0)),
      sub: 'إجمالي الصرف',
      icon: TrendingDown,
      color: 'red',
    },
  ];

  /* ── Action buttons ── */
  const allActions: {
    id: ModalType;
    label: string;
    sub: string;
    icon: React.ElementType;
    border: string;
    bg: string;
    text: string;
    glow: string;
    permitted: boolean;
  }[] = [
    {
      id: 'receipt',
      label: 'سند قبض',
      sub: 'استلام مبلغ وإضافته للخزينة',
      icon: HandCoins,
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/8 hover:bg-emerald-500/15',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/10',
      permitted: canAddReceipt,
    },
    {
      id: 'payment',
      label: 'سند صرف',
      sub: 'صرف مبلغ من الخزينة',
      icon: ArrowUpFromLine,
      border: 'border-orange-500/30',
      bg: 'bg-orange-500/8 hover:bg-orange-500/15',
      text: 'text-orange-400',
      glow: 'shadow-orange-500/10',
      permitted: canAddPayment,
    },
    {
      id: 'transfer',
      label: 'تحويل خزائن',
      sub: 'نقل رصيد من خزينة إلى أخرى',
      icon: ArrowLeftRight,
      border: 'border-amber-500/25',
      bg: 'bg-amber-500/8 hover:bg-amber-500/15',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/10',
      permitted: canTransfer,
    },
    {
      id: 'safe-closing',
      label: 'إقفال الخزينة',
      sub: 'جرد ومطابقة الرصيد اليومي',
      icon: Lock,
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/8 hover:bg-amber-500/15',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/10',
      permitted: canCloseSafe,
    },
  ];
  const actions = allActions.filter((a) => a.permitted);

  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    amber: { border: 'border-amber-500/25', bg: 'bg-amber-500/8', text: 'text-amber-400' },
    emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/8', text: 'text-emerald-400' },
    red: { border: 'border-red-500/25', bg: 'bg-red-500/8', text: 'text-red-400' },
  };

  return (
    <div className="erp-page" dir="rtl">
      {/* ── Modals ── */}
      {openModal === 'receipt' && <ReceiptModal onClose={() => setOpenModal(null)} />}
      {openModal === 'payment' && <PaymentModal onClose={() => setOpenModal(null)} />}
      {openModal === 'transfer' && <TransferModal onClose={() => setOpenModal(null)} />}
      {openModal === 'safe-closing' && <CloseSafeModal onClose={() => setOpenModal(null)} />}

      {/* ── Safe Management Modals ── */}
      <SafeModals
        showAddSafe={showAddSafe}
        setShowAddSafe={setShowAddSafe}
        addForm={addForm}
        setAddForm={setAddForm}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        editTarget={editTarget}
        setEditTarget={setEditTarget}
        editForm={editForm}
        setEditForm={setEditForm}
        editSaving={editSaving}
        setEditSaving={setEditSaving}
        branches={branches}
        createSafe={createSafe}
        deleteSafe={deleteSafe}
        invalidateSafes={invalidateSafes}
        queryClient={queryClient}
        toast={toast}
      />

      {/* ── Page title ── */}
      <div className="erp-page-header">
        <div>
          <h1 className="erp-page-title flex items-center gap-3">
            <Wallet className="w-7 h-7 text-amber-400" />
            السندات والخزينة
          </h1>
          <p className="erp-page-subtitle">
            {new Date().toLocaleDateString('ar-EG-u-nu-latn', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const cls = colorMap[k.color];
          return (
            <div
              key={k.label}
              className={`rounded-2xl border ${cls.border} ${cls.bg} p-5 transition-all`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${cls.border} bg-surface`}
                >
                  <Icon className={`w-5 h-5 ${cls.text}`} />
                </div>
                <span className="text-ink/30 text-xs">{k.sub}</span>
              </div>
              <p className="text-ink/50 text-xs mb-1">{k.label}</p>
              <p className={`text-2xl font-black ${cls.text}`}>{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Safe balances — enhanced cards ── */}
      {safes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-ink/40 text-xs font-bold uppercase tracking-widest">أرصدة الخزائن</p>
            <p className="text-ink/25 text-xs">
              {safes.length} خزينة · إجمالي {formatCurrency(totalSafeBalance)}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {safes.map((s) => {
              const balance = Number(s.balance);
              const pct = totalSafeBalance > 0 ? (balance / totalSafeBalance) * 100 : 0;
              const canDelete = balance === 0;

              return (
                <div
                  key={s.id}
                  className="group bg-canvas border border-line hover:border-amber-500/20 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-amber-400" />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {/* Edit button */}
                      <button
                        onClick={() => {
                          setEditTarget({
                            id: s.id as number,
                            name: s.name,
                            branch_id: s.branch_id,
                          });
                          setEditForm({
                            name: s.name,
                            branch_id: s.branch_id != null ? String(s.branch_id) : '',
                          });
                        }}
                        title="تعديل الخزينة"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => {
                          if (canDelete) {
                            setDeleteTarget({ id: s.id as number, name: s.name, balance });
                          }
                        }}
                        disabled={!canDelete}
                        title={
                          canDelete ? 'حذف الخزينة' : 'لا يمكن حذف خزينة تحتوي على رصيد أو حركات'
                        }
                        className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all
                          ${
                            canDelete
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer'
                              : 'bg-surface text-ink/20 cursor-not-allowed'
                          }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Name & balance */}
                  <p className="text-ink font-bold text-sm mb-1 truncate">{s.name}</p>
                  {/* الفرع */}
                  {isAdmin && branches.length > 0 ? (
                    <select
                      className="mb-2 w-full text-[10px] rounded-lg px-2 py-1 bg-surface border border-line text-ink/50 hover:border-amber-500/30 transition-colors outline-none cursor-pointer"
                      value={s.branch_id ?? ''}
                      onChange={async (e) => {
                        const bid = e.target.value;
                        await authFetch(api(`/api/settings/safes/${s.id}`), {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ branch_id: bid ? Number(bid) : null }),
                        });
                        invalidateSafes();
                        queryClient.invalidateQueries({ queryKey: ['/api/branches'] });
                      }}
                    >
                      <option value="">— بدون فرع —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : s.branch_id ? (
                    <p className="text-amber-400/60 text-[10px] mb-2">
                      {branches.find((b) => b.id === s.branch_id)?.name ?? ''}
                    </p>
                  ) : (
                    <div className="mb-1" />
                  )}
                  <p className="text-amber-400 font-black text-xl mb-3">
                    {formatCurrency(balance)}
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-ink/30">
                      <span>نسبة من الإجمالي</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Zero-balance badge */}
                  {canDelete && (
                    <div className="mt-3 pt-3 border-t border-line">
                      <span className="text-[10px] text-ink/25 font-medium">
                        رصيد صفر · قابلة للحذف
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div>
        <p className="text-ink/40 text-xs font-bold uppercase tracking-widest mb-3">العمليات</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => setOpenModal(a.id)}
                className={`rounded-2xl border ${a.border} ${a.bg} p-5 text-right transition-all hover:-translate-y-1 active:scale-95 group shadow-lg ${a.glow}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border ${a.border} bg-surface`}
                  >
                    <Icon className={`w-5 h-5 ${a.text}`} />
                  </div>
                  <ChevronLeft
                    className={`w-4 h-4 ${a.text} opacity-40 group-hover:opacity-80 transition-opacity`}
                  />
                </div>
                <p className={`font-black text-base leading-tight ${a.text}`}>{a.label}</p>
                <p className="text-ink/40 text-xs mt-1 leading-tight">{a.sub}</p>
                <div className={`mt-4 pt-3 border-t ${a.border}`}>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${a.text}`}>
                    <span>فتح النموذج</span>
                  </div>
                </div>
              </button>
            );
          })}

          {/* إضافة خزينة */}
          <button
            onClick={() => setShowAddSafe(true)}
            className="rounded-2xl border border-sky-500/30 bg-sky-500/8 hover:bg-sky-500/15 p-5 text-right transition-all hover:-translate-y-1 active:scale-95 group shadow-lg shadow-sky-500/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-sky-500/30 bg-surface">
                <Landmark className="w-5 h-5 text-sky-400" />
              </div>
              <ChevronLeft className="w-4 h-4 text-sky-400 opacity-40 group-hover:opacity-80 transition-opacity" />
            </div>
            <p className="font-black text-base leading-tight text-sky-400">إضافة خزينة</p>
            <p className="text-ink/40 text-xs mt-1 leading-tight">إنشاء خزينة جديدة</p>
            <div className="mt-4 pt-3 border-t border-sky-500/30">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <Plus className="w-3.5 h-3.5" />
                <span>فتح النموذج</span>
              </div>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
}
