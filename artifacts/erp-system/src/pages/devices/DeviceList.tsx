import { PaginationBar } from '@/components/PaginationBar';
import { Smartphone, Battery, LayoutGrid, List } from 'lucide-react';
import { PageToolbar } from '@/components/patterns';
import { SearchInput } from '@/components/ui/search-input';
import {
  type Device,
  type DeviceStatus,
  GradeBadge,
  StatusBadge,
  maskImei,
  RowMenu,
} from './index';

type Props = {
  isLoading: boolean;
  allDevices: Device[];
  paginatedDevices: Device[];
  statusFilter: 'all' | DeviceStatus;
  setStatusFilter: (v: 'all' | DeviceStatus) => void;
  search: string;
  setSearch: (v: string) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (v: 'list' | 'grid') => void;
  filters: { v: 'all' | DeviceStatus; l: string; count: number }[];
  devicePage: number;
  setDevicePage: (n: number) => void;
  pageSize: number;
  setSelected: (d: Device) => void;
  refresh: () => void;
};

export function DeviceList({
  isLoading,
  allDevices,
  paginatedDevices,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  viewMode,
  setViewMode,
  filters,
  devicePage,
  setDevicePage,
  pageSize,
  setSelected,
  refresh,
}: Props) {
  return (
    <>
      {/* ── Filters + Search + View toggle ── */}
      <PageToolbar
        searchSlot={
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="ابحث بالموديل / IMEI / العميل..."
            aria-label="بحث في الأجهزة"
          />
        }
        filtersSlot={
          <div className="flex gap-1">
            {filters.map(({ v, l, count }) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  statusFilter === v
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'border-line text-ink/40 hover:text-ink/70 hover:border-line'
                }`}
              >
                {l}
                <span
                  className={`text-[10px] px-1.5 rounded-full ${
                    statusFilter === v ? 'bg-amber-500/25 text-amber-300' : 'bg-surface text-ink/25'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        }
        actionsSlot={
          <div className="flex gap-0.5 bg-surface rounded-xl border border-line p-0.5">
            <button
              onClick={() => setViewMode('list')}
              title="عرض قائمة"
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-amber-500/20 text-amber-400' : 'text-ink/30 hover:text-ink/60'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="عرض شبكة"
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-amber-500/20 text-amber-400' : 'text-ink/30 hover:text-ink/60'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* ── Device List / Grid ── */}
      {isLoading ? (
        <div className="glass-panel rounded-xl border border-line flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-line border-t-ink/40 rounded-full animate-spin" />
        </div>
      ) : allDevices.length === 0 ? (
        <div className="glass-panel rounded-xl border border-line text-center py-16 space-y-2">
          <Smartphone className="w-10 h-10 text-ink/10 mx-auto" />
          <p className="text-ink/30 text-sm">لا توجد أجهزة</p>
          <p className="text-ink/15 text-xs">اضغط "إضافة جهاز" لتسجيل أول جهاز</p>
        </div>
      ) : viewMode === 'list' ? (
        /* ── LIST VIEW ── */
        <div className="glass-panel rounded-xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-right text-[11px] font-bold text-ink/25 px-4 py-2.5">الجهاز</th>
                <th className="text-right text-[11px] font-bold text-ink/25 px-3 py-2.5 hidden sm:table-cell">
                  المواصفات
                </th>
                <th className="text-right text-[11px] font-bold text-ink/25 px-3 py-2.5 hidden sm:table-cell">
                  IMEI
                </th>
                <th className="text-right text-[11px] font-bold text-ink/25 px-3 py-2.5">
                  الأسعار
                </th>
                <th className="text-center text-[11px] font-bold text-ink/25 px-3 py-2.5">
                  الحالة
                </th>
                <th className="text-right text-[11px] font-bold text-ink/25 px-3 py-2.5 hidden md:table-cell">
                  المورد / العميل
                </th>
                <th className="text-center text-[11px] font-bold text-ink/25 px-3 py-2.5 w-16">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.map((d, idx) => (
                <tr
                  key={d.id}
                  className={`border-b border-line hover:bg-surface transition-colors group ${idx % 2 === 0 ? '' : 'bg-surface'}`}
                >
                  {/* Device */}
                  <td className="px-4 py-3 cursor-pointer" onClick={() => setSelected(d)}>
                    <p className="font-semibold text-ink/90 text-sm">
                      {d.brand} {d.model}
                    </p>
                    <p className="text-[11px] text-ink/30 font-mono">{d.device_no}</p>
                  </td>
                  {/* Specs */}
                  <td
                    className="px-3 py-3 hidden sm:table-cell cursor-pointer"
                    onClick={() => setSelected(d)}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {d.storage && (
                        <span className="text-[11px] text-ink/50 bg-surface px-1.5 py-0.5 rounded">
                          {d.storage}
                        </span>
                      )}
                      {d.color && <span className="text-[11px] text-ink/40">{d.color}</span>}
                      {d.battery_health && (
                        <span
                          className={`text-[11px] flex items-center gap-0.5 ${d.battery_health < 80 ? 'text-amber-400/70' : 'text-ink/35'}`}
                        >
                          <Battery className="w-2.5 h-2.5" />
                          {d.battery_health}%
                        </span>
                      )}
                    </div>
                    <GradeBadge grade={d.grade} />
                  </td>
                  {/* IMEI masked */}
                  <td
                    className="px-3 py-3 hidden sm:table-cell cursor-pointer"
                    onClick={() => setSelected(d)}
                  >
                    {d.imei ? (
                      <span className="text-[11px] text-ink/35 font-mono tracking-wide">
                        {maskImei(d.imei)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink/15">—</span>
                    )}
                  </td>
                  {/* Prices + Profit */}
                  <td className="px-3 py-3 cursor-pointer" onClick={() => setSelected(d)}>
                    <p className="text-ink/80 font-semibold">
                      {parseFloat(
                        d.status === 'sold' && d.sold_price ? d.sold_price : d.sale_price
                      ).toLocaleString()}
                      <span className="text-[10px] text-ink/25 mr-0.5">ج.م</span>
                    </p>
                    {(() => {
                      const sellP = parseFloat(
                        d.status === 'sold' && d.sold_price ? d.sold_price : d.sale_price
                      );
                      const buyP = parseFloat(d.purchase_price);
                      const prof = sellP - buyP;
                      const pct = buyP > 0 ? Math.round((prof / buyP) * 100) : 0;
                      return (
                        <span
                          className={`text-[10px] font-bold ${prof >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}
                        >
                          {prof >= 0 ? '+' : ''}
                          {prof.toLocaleString()} ({pct}%)
                        </span>
                      );
                    })()}
                  </td>
                  {/* Status */}
                  <td
                    className="px-3 py-3 text-center cursor-pointer"
                    onClick={() => setSelected(d)}
                  >
                    <StatusBadge status={d.status} />
                  </td>
                  {/* Source/customer */}
                  <td
                    className="px-3 py-3 hidden md:table-cell cursor-pointer"
                    onClick={() => setSelected(d)}
                  >
                    <p className="text-[11px] text-ink/40">
                      {d.status === 'sold' ? d.sold_to_customer_name : (d.supplier_name ?? '—')}
                    </p>
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <RowMenu device={d} onDetail={() => setSelected(d)} onRefresh={refresh} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {paginatedDevices.map((d) => {
            const sellP = parseFloat(
              d.status === 'sold' && d.sold_price ? d.sold_price : d.sale_price
            );
            const buyP = parseFloat(d.purchase_price);
            const prof = sellP - buyP;
            return (
              <div
                key={d.id}
                className="glass-panel rounded-xl border border-line hover:border-amber-500/25 transition-all group overflow-hidden"
              >
                {/* Card top */}
                <div className="p-3 cursor-pointer" onClick={() => setSelected(d)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-amber-400" />
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="font-bold text-ink text-sm leading-tight">
                    {d.brand} {d.model}
                  </p>
                  <p className="text-[10px] text-ink/25 font-mono mt-0.5">{d.device_no}</p>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {d.storage && (
                      <span className="text-[10px] text-ink/45 bg-surface px-1.5 py-0.5 rounded">
                        {d.storage}
                      </span>
                    )}
                    {d.color && <span className="text-[10px] text-ink/35">{d.color}</span>}
                    {d.battery_health && (
                      <span
                        className={`text-[10px] flex items-center gap-0.5 ${d.battery_health < 80 ? 'text-amber-400/70' : 'text-ink/30'}`}
                      >
                        <Battery className="w-2.5 h-2.5" />
                        {d.battery_health}%
                      </span>
                    )}
                  </div>

                  {d.imei && (
                    <p className="text-[10px] text-ink/25 font-mono mt-1.5 tracking-wide">
                      {maskImei(d.imei)}
                    </p>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-line flex items-end justify-between">
                    <div>
                      <p className="text-emerald-300 font-bold text-sm">
                        {sellP.toLocaleString()} ج.م
                      </p>
                      <p
                        className={`text-[10px] font-semibold ${prof >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}
                      >
                        {prof >= 0 ? '+' : ''}
                        {prof.toLocaleString()} ج.م
                      </p>
                    </div>
                    {d.grade && <GradeBadge grade={d.grade} />}
                  </div>
                </div>

                {/* Card bottom — actions */}
                <div className="px-3 pb-3 flex items-center justify-between">
                  <p className="text-[10px] text-ink/25 truncate flex-1">
                    {d.status === 'sold' ? d.sold_to_customer_name : (d.supplier_name ?? '')}
                  </p>
                  <RowMenu device={d} onDetail={() => setSelected(d)} onRefresh={refresh} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && allDevices.length > 0 && (
        <PaginationBar
          page={devicePage}
          totalItems={allDevices.length}
          pageSize={pageSize}
          onPageChange={setDevicePage}
          itemLabel="جهاز"
        />
      )}
    </>
  );
}
