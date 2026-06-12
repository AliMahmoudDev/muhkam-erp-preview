import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import SalesReturnsPanel from './sales/SalesReturnsPanel';
import SaleDetailModal from './sales/SaleDetailModal';
import { NewSalePanel } from './sales/NewSalePanel';
import { SalesHistoryPanel } from './sales/SalesHistoryPanel';

export default function Sales() {
  const { user: currentUser } = useAuth();
  const canCreateSale = hasPermission(currentUser, 'can_create_sale') === true;
  const canReturnSale = hasPermission(currentUser, 'can_return_sale') === true;

  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as 'new' | 'history' | 'returns' | null;
  const defaultTab = canCreateSale ? 'new' : 'history';
  const [tab, setTab] = useState<'new' | 'history' | 'returns'>(urlTab ?? defaultTab);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  const changeTab = (t: 'new' | 'history' | 'returns') => {
    setTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  const effectiveTab =
    tab === 'new' && !canCreateSale
      ? 'history'
      : tab === 'returns' && !canReturnSale
        ? 'history'
        : tab;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="flex bg-surface rounded-2xl p-1 border border-line">
          {canCreateSale && (
            <button
              onClick={() => changeTab('new')}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${effectiveTab === 'new' ? 'bg-amber-500 text-black shadow' : 'text-ink/50 hover:text-ink'}`}
            >
              ➕ فاتورة بيع جديدة
            </button>
          )}
          <button
            onClick={() => changeTab('history')}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${effectiveTab === 'history' ? 'bg-amber-500 text-black shadow' : 'text-ink/50 hover:text-ink'}`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> سجل الفواتير
          </button>
          {canReturnSale && (
            <button
              onClick={() => changeTab('returns')}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${effectiveTab === 'returns' ? 'bg-orange-500 text-ink shadow' : 'text-ink/50 hover:text-ink'}`}
            >
              ↩ المرتجعات
            </button>
          )}
        </div>
      </div>

      {selectedSaleId && (
        <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      )}

      {effectiveTab === 'history' ? (
        <SalesHistoryPanel />
      ) : effectiveTab === 'returns' ? (
        <SalesReturnsPanel />
      ) : (
        <NewSalePanel onDone={() => {}} />
      )}
    </div>
  );
}
