import { useState, useMemo } from 'react';
import { useGetProducts } from '@workspace/api-client-react';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency, useCountUp } from './shared';
import { useAppSettings } from '@/contexts/app-settings';
import FilterPanel from './inventory/FilterPanel';
import ReportTable from './inventory/ReportTable';

function AnimStatCard({
  label,
  value,
  fmt,
  color,
  delay,
}: {
  label: string;
  value: number;
  fmt: (v: number) => string;
  color: string;
  delay: number;
}) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3 }}
      className="glass-panel rounded-2xl p-5 border border-white/5"
      style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}
    >
      <p className="text-white/40 text-xs mb-2">{label}</p>
      <p className={`text-xl font-black ${color}`}>{fmt(animated)}</p>
    </motion.div>
  );
}

type SortMode = 'value' | 'profit' | 'lowStock' | 'default';

export default function InventoryReport() {
  const { data: products = [], isLoading } = useGetProducts();
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const { settings: rSettings } = useAppSettings();
  const isInventoryDark = rSettings.theme !== 'light';


  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))),
    [products]
  );
  const filtered = useMemo(() => {
    let list = products;
    if (catFilter) list = list.filter((p) => p.category === catFilter);
    if (search)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
      );
    if (lowStockOnly)
      list = list.filter(
        (p) => p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold
      );
    return [...list].sort((a, b) => {
      if (sortMode === 'value') return b.quantity * b.cost_price - a.quantity * a.cost_price;
      if (sortMode === 'profit') {
        const mA = a.sale_price > 0 ? (a.sale_price - a.cost_price) / a.sale_price : 0;
        const mB = b.sale_price > 0 ? (b.sale_price - b.cost_price) / b.sale_price : 0;
        return mB - mA;
      }
      if (sortMode === 'lowStock') return a.quantity - b.quantity;
      return 0;
    });
  }, [products, catFilter, search, lowStockOnly, sortMode]);

  const totalStockValue = filtered.reduce((s, p) => s + p.quantity * p.cost_price, 0);
  const totalSaleValue = filtered.reduce((s, p) => s + p.quantity * p.sale_price, 0);
  const lowStockItems = products.filter(
    (p) => p.quantity > 0 && p.quantity <= (p.low_stock_threshold ?? 5)
  );
  const outOfStock = products.filter((p) => p.quantity === 0);

  return (
    <div className="space-y-4" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {(lowStockItems.length > 0 || outOfStock.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3"
        >
          {outOfStock.length > 0 && (
            <div className="glass-panel rounded-2xl px-4 py-3 border border-red-500/30 bg-red-500/5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-400 text-sm font-bold">{outOfStock.length} منتج نافذ</span>
            </div>
          )}
          {lowStockItems.length > 0 && (
            <div className="glass-panel rounded-2xl px-4 py-3 border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-400 text-sm font-bold">
                {lowStockItems.length} منتج وصل للحد الأدنى
              </span>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimStatCard
          label="إجمالي الأصناف"
          value={filtered.length}
          fmt={(v) => String(Math.round(v))}
          color="text-white"
          delay={0}
        />
        <AnimStatCard
          label="قيمة المخزون (التكلفة)"
          value={totalStockValue}
          fmt={formatCurrency}
          color="text-blue-400"
          delay={0.08}
        />
        <AnimStatCard
          label="قيمة المخزون (البيع)"
          value={totalSaleValue}
          fmt={formatCurrency}
          color="text-emerald-400"
          delay={0.16}
        />
        <AnimStatCard
          label="الربح المتوقع من المخزن"
          value={totalSaleValue - totalStockValue}
          fmt={formatCurrency}
          color="text-amber-400"
          delay={0.24}
        />
      </div>

      <FilterPanel
        search={search} setSearch={setSearch}
        lowStockOnly={lowStockOnly} setLowStockOnly={setLowStockOnly}
        sortMode={sortMode} setSortMode={setSortMode}
        catFilter={catFilter} setCatFilter={setCatFilter}
        categories={categories}
        products={products}
        filtered={filtered}
        companyName={rSettings.companyName}
      />

      <ReportTable
        products={products}
        filtered={filtered}
        isLoading={isLoading}
        search={search}
        totalStockValue={totalStockValue}
        isInventoryDark={isInventoryDark}
      />
    </div>
  );
}
