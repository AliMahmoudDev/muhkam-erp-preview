import { useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';
import { Plus, Building2, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons';
import { api } from '@/lib/api';
import type { FixedAsset } from './fixed-assets/types';
import { CATEGORIES, METHODS } from './fixed-assets/constants';
import { StatusBadge } from './fixed-assets/components/StatusBadge';
import { AddAssetModal } from './fixed-assets/components/AddAssetModal';
import { AssetDetailModal } from './fixed-assets/components/AssetDetailModal';

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
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">الأصول الثابتة</h1>
            <p className="text-ink/40 text-sm mt-0.5">إدارة الأصول وحساب الإهلاك</p>
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
        <div className="glass-panel rounded-2xl p-4 border border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-ink/40">إجمالي التكلفة</p>
              <p className="text-ink font-bold text-lg">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-ink/40">مجمع الإهلاك</p>
              <p className="text-orange-300 font-bold text-lg">{formatCurrency(totalAccDep)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-4 border border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-ink/40">إجمالي القيمة الدفترية</p>
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
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterStatus === s ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-surface text-ink/50 hover:bg-surface'}`}
          >
            {s === 'all' ? 'الكل' : s === 'active' ? 'نشطة' : 'مستبعدة'}
            <span className="mr-2 text-xs opacity-60">
              ({assets.filter((a) => s === 'all' || a.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl border border-line overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <TableSkeleton />
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-14 h-14 text-ink/10 mb-4" />
            <p className="text-ink/40">لا توجد أصول ثابتة</p>
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
                <tr className="border-b border-line bg-surface">
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">الأصل</th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">التصنيف</th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">
                    تاريخ الشراء
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">التكلفة</th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">
                    مجمع الإهلاك
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">
                    القيمة الدفترية
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">
                    طريقة الإهلاك
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-ink/40 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                    className="border-b border-line hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-ink font-semibold">{asset.name}</p>
                          <p className="text-ink/40 text-xs font-mono">{asset.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink/60">
                      {CATEGORIES[asset.category] ?? asset.category}
                    </td>
                    <td className="px-5 py-3 text-ink/60">{asset.purchase_date}</td>
                    <td className="px-5 py-3 text-ink">{formatCurrency(asset.purchase_cost)}</td>
                    <td className="px-5 py-3 text-orange-300">
                      {formatCurrency(asset.accumulated_depreciation)}
                    </td>
                    <td className="px-5 py-3 text-emerald-300 font-bold">
                      {formatCurrency(asset.book_value)}
                    </td>
                    <td className="px-5 py-3 text-ink/60">
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
