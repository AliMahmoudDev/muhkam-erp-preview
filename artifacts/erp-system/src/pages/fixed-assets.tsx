import { useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';
import {
  Plus,
  X,
  Building2,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ArrowDownCircle,
  BarChart3,
  Clock,
  DollarSign,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import { ConfirmModal } from '@/components/confirm-modal';
import { api } from '@/lib/api';
import type { FixedAsset, AssetDetail } from './fixed-assets/types';
import { CATEGORIES, METHODS } from './fixed-assets/constants';
import { StatusBadge } from './fixed-assets/components/StatusBadge';
import { AddAssetModal } from './fixed-assets/components/AddAssetModal';

/* ─── Asset Detail Modal ─── */
function AssetDetailModal({ assetId, onClose }: { assetId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showSchedule, setShowSchedule] = useState(false);
  const [depPeriod, setDepPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [disposeForm, setDisposeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    proceeds: '',
  });
  const [showDispose, setShowDispose] = useState(false);
  const [confirmDispose, setConfirmDispose] = useState(false);

  const { data: asset, isLoading } = useQuery<AssetDetail>({
    queryKey: ['/api/fixed-assets', assetId],
    queryFn: () => authFetch(api(`/api/fixed-assets/${assetId}`)).then((r) => r.json()),
  });

  const depMutation = useMutation({
    mutationFn: () =>
      authFetch(api(`/api/fixed-assets/${assetId}/depreciate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: depPeriod }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/fixed-assets', assetId] });
      qc.invalidateQueries({ queryKey: ['/api/fixed-assets'] });
      toast({ title: `✅ تم تسجيل إهلاك ${depPeriod} بنجاح` });
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const disposeMutation = useMutation({
    mutationFn: () =>
      authFetch(api(`/api/fixed-assets/${assetId}/dispose`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposal_date: disposeForm.date,
          disposal_proceeds: Number(disposeForm.proceeds || 0),
        }),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/fixed-assets', assetId] });
      qc.invalidateQueries({ queryKey: ['/api/fixed-assets'] });
      const gl = data.gain_loss;
      toast({
        title: `✅ تم استبعاد الأصل — ${gl >= 0 ? `ربح ${formatCurrency(gl)}` : `خسارة ${formatCurrency(Math.abs(gl))}`}`,
      });
      setConfirmDispose(false);
    },
    onError: (e: Error) => {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
      setConfirmDispose(false);
    },
  });

  const completedPeriods = new Set(asset?.runs.map((r) => r.period) ?? []);

  return (
    <>
      {confirmDispose && (
        <ConfirmModal
          title="استبعاد الأصل"
          description={`سيتم استبعاد هذا الأصل وتسجيل قيد محاسبي بأرباح/خسائر الاستبعاد. لا يمكن التراجع.`}
          isPending={disposeMutation.isPending}
          onConfirm={() => disposeMutation.mutate()}
          onCancel={() => setConfirmDispose(false)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="glass-panel rounded-3xl w-full max-w-4xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{asset?.name ?? '...'}</h3>
                {asset && <p className="text-xs text-violet-400 font-mono">{asset.code}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {asset && <StatusBadge status={asset.status} />}
              <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-6 space-y-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl" style={{ background: 'var(--erp-bg-hover)', animation: `pulse ${1.2 + i * 0.1}s infinite` }} />
                ))}
              </div>
            ) : !asset ? null : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs text-white/40 mb-1">تكلفة الشراء</p>
                    <p className="text-white font-bold">{formatCurrency(asset.purchase_cost)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs text-orange-300/60 mb-1">مجمع الإهلاك</p>
                    <p className="text-orange-300 font-bold">
                      {formatCurrency(asset.accumulated_depreciation)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-emerald-300/60 mb-1">القيمة الدفترية</p>
                    <p className="text-emerald-300 font-bold">{formatCurrency(asset.book_value)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs text-white/40 mb-1">القيمة الباقية</p>
                    <p className="text-white font-bold">{formatCurrency(asset.residual_value)}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div>
                    <p className="text-xs text-white/40">التصنيف</p>
                    <p className="text-white/80 text-sm mt-0.5">
                      {CATEGORIES[asset.category] ?? asset.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">طريقة الإهلاك</p>
                    <p className="text-white/80 text-sm mt-0.5">
                      {METHODS[asset.depreciation_method] ?? asset.depreciation_method}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">تاريخ الشراء</p>
                    <p className="text-white/80 text-sm mt-0.5">{asset.purchase_date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">العمر الإنتاجي</p>
                    <p className="text-white/80 text-sm mt-0.5">
                      {asset.useful_life_months} شهر ({(asset.useful_life_months / 12).toFixed(1)}{' '}
                      سنة)
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                {asset.status === 'active' && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex justify-between text-xs text-white/50 mb-2">
                      <span>نسبة الإهلاك المتراكم</span>
                      <span>
                        {(
                          (asset.accumulated_depreciation /
                            Math.max(asset.purchase_cost - asset.residual_value, 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-orange-500 transition-all"
                        style={{
                          width: `${Math.min(100, (asset.accumulated_depreciation / Math.max(asset.purchase_cost - asset.residual_value, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Run depreciation */}
                {asset.status === 'active' && (
                  <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                    <p className="text-sm font-bold text-violet-300 mb-3 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" /> تسجيل إهلاك شهري
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="month"
                        value={depPeriod}
                        onChange={(e) => setDepPeriod(e.target.value)}
                        className="glass-input px-4 py-2 rounded-xl text-white text-sm flex-1"
                      />
                      <button
                        onClick={() => depMutation.mutate()}
                        disabled={depMutation.isPending}
                        className="px-5 py-2 rounded-xl bg-violet-500/30 text-violet-300 hover:bg-violet-500/40 text-sm font-bold border border-violet-500/30 transition-colors disabled:opacity-50"
                      >
                        {depMutation.isPending ? '...' : 'تسجيل الإهلاك'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Runs history */}
                {asset.runs.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-white/70 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> سجل الإهلاك المسجل ({asset.runs.length} فترة)
                    </p>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                      {asset.runs.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                        >
                          <span className="text-xs text-white/50 font-mono">{r.period}</span>
                          <span className="text-xs text-orange-300 font-bold">
                            {formatCurrency(r.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Depreciation Schedule */}
                <div>
                  <button
                    onClick={() => setShowSchedule((p) => !p)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                  >
                    <span className="text-sm font-bold text-white/70 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> جدول الإهلاك الكامل ({asset.schedule.length}{' '}
                      فترة)
                    </span>
                    {showSchedule ? (
                      <ChevronUp className="w-4 h-4 text-white/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40" />
                    )}
                  </button>
                  {showSchedule && (
                    <div className="mt-2 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-black/60 backdrop-blur-sm">
                            <tr>
                              <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">
                                الفترة
                              </th>
                              <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">
                                الإهلاك
                              </th>
                              <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">
                                مجمع الإهلاك
                              </th>
                              <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">
                                القيمة الدفترية
                              </th>
                              <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">
                                الحالة
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {asset.schedule.map((row) => {
                              const done = completedPeriods.has(row.period);
                              return (
                                <tr
                                  key={row.period}
                                  className={`border-t border-white/5 ${done ? 'bg-emerald-500/5' : ''}`}
                                >
                                  <td className="px-4 py-2 text-white/70 font-mono text-xs">
                                    {row.period}
                                  </td>
                                  <td className="px-4 py-2 text-orange-300">
                                    {formatCurrency(row.depreciation)}
                                  </td>
                                  <td className="px-4 py-2 text-white/60">
                                    {formatCurrency(row.accumulated)}
                                  </td>
                                  <td className="px-4 py-2 text-emerald-300">
                                    {formatCurrency(row.book_value)}
                                  </td>
                                  <td className="px-4 py-2">
                                    {done ? (
                                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> مسجل
                                      </span>
                                    ) : (
                                      <span className="text-xs text-white/30">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Disposal */}
                {asset.status === 'active' && (
                  <div>
                    {!showDispose ? (
                      <button
                        onClick={() => setShowDispose(true)}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                      >
                        <ArrowDownCircle className="w-4 h-4" /> استبعاد الأصل
                      </button>
                    ) : (
                      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
                        <p className="text-sm font-bold text-red-400">استبعاد الأصل الثابت</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-white/50 mb-1">
                              تاريخ الاستبعاد
                            </label>
                            <input
                              type="date"
                              value={disposeForm.date}
                              onChange={(e) =>
                                setDisposeForm((p) => ({ ...p, date: e.target.value }))
                              }
                              className="w-full glass-input px-4 py-2 rounded-xl text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-white/50 mb-1">
                              عائد البيع (ج.م) — اختياري
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={disposeForm.proceeds}
                              onChange={(e) =>
                                setDisposeForm((p) => ({ ...p, proceeds: e.target.value }))
                              }
                              placeholder="0"
                              className="w-full glass-input px-4 py-2 rounded-xl text-white text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setConfirmDispose(true)}
                            className="flex-1 py-2 rounded-xl bg-red-500/30 text-red-300 hover:bg-red-500/40 text-sm font-bold border border-red-500/30 transition-colors"
                          >
                            تأكيد الاستبعاد
                          </button>
                          <button
                            onClick={() => setShowDispose(false)}
                            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-white/70"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {asset.status === 'disposed' && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <p className="text-sm font-bold text-red-400 mb-2">تم استبعاد هذا الأصل</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-white/40">تاريخ الاستبعاد</p>
                        <p className="text-white/80">{asset.disposal_date}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40">عائد البيع</p>
                        <p className="text-white/80">
                          {formatCurrency(asset.disposal_proceeds ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main Page ─── */
export default function FixedAssetsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disposed'>('active');

  const { data: assets = [], isLoading } = useQuery<FixedAsset[]>({
    queryKey: ['/api/fixed-assets'],
    queryFn: () => authFetch(api('/api/fixed-assets')).then((r) => r.json()),
  });

  const filtered = assets.filter((a) => filterStatus === 'all' || a.status === filterStatus);

  const totalCost = filtered
    .filter((a) => a.status === 'active')
    .reduce((s, a) => s + a.purchase_cost, 0);
  const totalAccDep = filtered
    .filter((a) => a.status === 'active')
    .reduce((s, a) => s + a.accumulated_depreciation, 0);
  const totalBookValue = totalCost - totalAccDep;

  return (
    <div className="space-y-6 p-6">
      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} />}
      {selectedId !== null && (
        <AssetDetailModal assetId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">الأصول الثابتة</h1>
            <p className="text-white/40 text-sm mt-0.5">إدارة الأصول وحساب الإهلاك</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary px-5 py-2.5 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> إضافة أصل
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-white/40">إجمالي التكلفة</p>
              <p className="text-white font-bold text-lg">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-white/40">مجمع الإهلاك</p>
              <p className="text-orange-300 font-bold text-lg">{formatCurrency(totalAccDep)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-white/40">إجمالي القيمة الدفترية</p>
              <p className="text-emerald-300 font-bold text-lg">{formatCurrency(totalBookValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'disposed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterStatus === s ? 'bg-violet-500/30 text-violet-300 border border-violet-500/40' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
          >
            {s === 'all' ? 'الكل' : s === 'active' ? 'نشطة' : 'مستبعدة'}
            <span className="mr-2 text-xs opacity-60">
              ({assets.filter((a) => s === 'all' || a.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><tbody><TableSkeleton /></tbody></table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-14 h-14 text-white/10 mb-4" />
            <p className="text-white/40">لا توجد أصول ثابتة</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 btn-primary px-5 py-2 text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> إضافة أول أصل
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">الأصل</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">
                    التصنيف
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">
                    تاريخ الشراء
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">
                    التكلفة
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">
                    مجمع الإهلاك
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">
                    القيمة الدفترية
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">
                    طريقة الإهلاك
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{asset.name}</p>
                          <p className="text-white/40 text-xs font-mono">{asset.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {CATEGORIES[asset.category] ?? asset.category}
                    </td>
                    <td className="px-5 py-3 text-white/60">{asset.purchase_date}</td>
                    <td className="px-5 py-3 text-white">{formatCurrency(asset.purchase_cost)}</td>
                    <td className="px-5 py-3 text-orange-300">
                      {formatCurrency(asset.accumulated_depreciation)}
                    </td>
                    <td className="px-5 py-3 text-emerald-300 font-bold">
                      {formatCurrency(asset.book_value)}
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {METHODS[asset.depreciation_method] ?? asset.depreciation_method}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={asset.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
