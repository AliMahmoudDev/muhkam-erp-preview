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
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-line pb-0">
        <button
          onClick={() => changeTab('products')}
          className={`px-5 py-2.5 text-sm font-bold rounded-t-xl transition-all ${
            activeTab === 'products'
              ? 'bg-surface text-ink border border-line border-b-transparent'
              : 'text-ink/40 hover:text-ink/70'
          }`}
        >
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4" /> المنتجات
          </span>
        </button>
        <button
          onClick={() => changeTab('categories')}
          className={`px-5 py-2.5 text-sm font-bold rounded-t-xl transition-all ${
            activeTab === 'categories'
              ? 'bg-surface text-ink border border-line border-b-transparent'
              : 'text-ink/40 hover:text-ink/70'
          }`}
        >
          <span className="flex items-center gap-2">
            <Tag className="w-4 h-4" /> التصنيفات
          </span>
        </button>
      </div>

      {activeTab === 'products' ? <ProductsTab /> : <CategoriesTab />}
    </div>
  );
}
