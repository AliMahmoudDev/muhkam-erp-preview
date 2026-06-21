import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Package, Tag } from 'lucide-react';
import { ProductsTab } from './products/ProductsTab';
import { CategoriesTab } from './products/CategoriesTab';
import { PageHeader } from '@/components/patterns';

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
    <div className="space-y-6">
      <PageHeader
        title="المنتجات"
        subtitle="إدارة المنتجات والتصنيفات"
      />

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
