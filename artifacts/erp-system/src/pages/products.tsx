import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Package, Tag } from 'lucide-react';
import { ProductsTab } from './products/ProductsTab';
import { CategoriesTab } from './products/CategoriesTab';

export default function Products() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as 'products' | 'categories' | null;
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>(urlTab ?? 'products');

  const changeTab = (t: 'products' | 'categories') => {
    setActiveTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  return (
    <div className="erp-page" dir="rtl">
      {/* ══ Page Header ═══════════════════════════════════════════════════════ */}
      <div className="erp-page-header">
        <div>
          <h1 className="erp-page-title">المنتجات</h1>
          <p className="erp-page-subtitle">إدارة المنتجات والتصنيفات</p>
        </div>
      </div>

      <div className="erp-tab-bar erp-tab-bar--underline">
        <button
          onClick={() => changeTab('products')}
          className={`erp-tab${activeTab === 'products' ? ' erp-tab--active' : ''}`}
        >
          <Package className="w-4 h-4" /> المنتجات
        </button>
        <button
          onClick={() => changeTab('categories')}
          className={`erp-tab${activeTab === 'categories' ? ' erp-tab--active' : ''}`}
        >
          <Tag className="w-4 h-4" /> التصنيفات
        </button>
      </div>

      {activeTab === 'products' ? <ProductsTab /> : <CategoriesTab />}
    </div>
  );
}
