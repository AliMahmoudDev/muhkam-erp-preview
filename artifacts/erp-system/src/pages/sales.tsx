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
    <div className="erp-page" dir="rtl">
      <div className="erp-page-header">
        <div className="erp-tab-bar">
          {canCreateSale && (
            <button
              onClick={() => changeTab('new')}
              className={`erp-tab${effectiveTab === 'new' ? ' erp-tab--active' : ''}`}
            >
              فاتورة بيع جديدة
            </button>
          )}
          <button
            onClick={() => changeTab('history')}
            className={`erp-tab${effectiveTab === 'history' ? ' erp-tab--active' : ''}`}
          >
            <ClipboardList />
            سجل الفواتير
          </button>
          {canReturnSale && (
            <button
              onClick={() => changeTab('returns')}
              className={`erp-tab${effectiveTab === 'returns' ? ' erp-tab--active' : ''}`}
            >
              المرتجعات
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
