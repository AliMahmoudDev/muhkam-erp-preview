import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ClipboardList, RotateCcw } from 'lucide-react';
import PurchaseFormModal from './PurchaseFormModal';
import PurchaseList from './PurchaseList';
import PurchaseReturnsPanel from './PurchaseReturnsPanel';

export default function Purchases() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as 'new' | 'history' | 'returns' | null;
  const [tab, setTab] = useState<'new' | 'history' | 'returns'>(urlTab ?? 'new');

  const changeTab = (t: 'new' | 'history' | 'returns') => {
    setTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  return (
    <div className="erp-page" dir="rtl">
      <div className="erp-page-header">
        <div className="erp-tab-bar">
          <button
            onClick={() => changeTab('new')}
            className={`erp-tab${tab === 'new' ? ' erp-tab--active' : ''}`}
          >
            فاتورة شراء
          </button>
          <button
            onClick={() => changeTab('history')}
            className={`erp-tab${tab === 'history' ? ' erp-tab--active' : ''}`}
          >
            <ClipboardList />
            سجل الفواتير
          </button>
          <button
            onClick={() => changeTab('returns')}
            className={`erp-tab${tab === 'returns' ? ' erp-tab--active' : ''}`}
          >
            <RotateCcw />
            المرتجعات
          </button>
        </div>
      </div>

      {tab === 'new' ? (
        <PurchaseFormModal onDone={() => {}} />
      ) : tab === 'history' ? (
        <PurchaseList />
      ) : (
        <PurchaseReturnsPanel />
      )}
    </div>
  );
}
