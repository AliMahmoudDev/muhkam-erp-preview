import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ShoppingBag, ClipboardList, RotateCcw } from 'lucide-react';
import PurchaseFormModal from './PurchaseFormModal';
import PurchaseList from './PurchaseList';
import PurchaseReturnsPanel from './PurchaseReturnsPanel';
import { PageHeader } from '@/components/patterns';

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
    <div className="space-y-6">
      <PageHeader
        title="المشتريات"
        subtitle="تسجيل فواتير الشراء ومتابعة المرتجعات"
      />

      <div className="erp-tab-bar erp-tab-bar--underline">
        <button
          onClick={() => changeTab('new')}
          className={`erp-tab${tab === 'new' ? ' erp-tab--active' : ''}`}
        >
          <ShoppingBag className="w-4 h-4" />
          فاتورة شراء
        </button>
        <button
          onClick={() => changeTab('history')}
          className={`erp-tab${tab === 'history' ? ' erp-tab--active' : ''}`}
        >
          <ClipboardList className="w-4 h-4" />
          سجل الفواتير
        </button>
        <button
          onClick={() => changeTab('returns')}
          className={`erp-tab${tab === 'returns' ? ' erp-tab--active' : ''}`}
        >
          <RotateCcw className="w-4 h-4" />
          المرتجعات
        </button>
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
