import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { useGetProducts } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Package, CheckCircle2 } from 'lucide-react';
import { FieldLabel, SInput, PrimaryBtn } from '../../_shared';
import { useOBQuery } from '../hooks/useOBQuery';
import { OBEntryTable } from './OBEntryTable';
import type { ProductItem } from '../types';

export function OBProductsTab() {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useOBQuery('/opening-balance/product');
  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    cost_price: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const registeredProductIds = new Set(entries.map((e) => e.id));
  const filteredProducts = safeArray<ProductItem>(products).filter(
    (p) =>
      !registeredProductIds.has(p.id) && (p.name.includes(search) || (p.sku ?? '').includes(search))
  );

  const handleSelectProduct = (p: ProductItem) => {
    setForm((f) => ({ ...f, product_id: String(p.id), cost_price: String(Number(p.cost_price)) }));
    setSearch(p.name);
  };
  const selectedProduct = safeArray<ProductItem>(products).find((p) => String(p.id) === form.product_id);

  const handleSubmit = async () => {
    if (!form.product_id || !form.quantity || !form.cost_price) {
      toast({ title: 'المنتج والكمية والتكلفة مطلوبة', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const res = await authFetch(api('/api/inventory/opening-balance'), {
      method: 'POST',
      body: JSON.stringify({
        product_id: parseInt(form.product_id),
        quantity: parseFloat(form.quantity),
        cost_price: parseFloat(form.cost_price),
        date: form.date,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast({ title: data.error ?? 'فشل الحفظ', variant: 'destructive' });
      return;
    }
    toast({ title: `✅ تم تسجيل رصيد أول المدة لـ ${selectedProduct?.name ?? 'المنتج'}` });
    setForm((f) => ({ ...f, product_id: '', quantity: '', cost_price: '', notes: '' }));
    setSearch('');
    qc.invalidateQueries({ queryKey: ['ob/opening-balance/product'] });
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#1A2235] border border-amber-500/20 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
          <Package className="w-4 h-4" /> إضافة رصيد مخزن افتتاحي
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <FieldLabel>البحث عن منتج</FieldLabel>
            <SInput
              placeholder="ابحث بالاسم أو الكود..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setForm((f) => ({ ...f, product_id: '' }));
              }}
            />
            {search && !form.product_id && filteredProducts.length > 0 && (
              <div className="absolute top-full mt-1 right-0 left-0 z-20 bg-[#111827] border border-line rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                {filteredProducts.slice(0, 12).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-right px-3 py-2.5 text-sm text-ink/80 hover:bg-surface transition-colors border-b border-line last:border-0 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-ink/35 font-mono shrink-0">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <p className="mt-1 text-emerald-400 text-xs">
                ✓ {selectedProduct.name} — رصيد حالي: {Number(selectedProduct.quantity)} وحدة
              </p>
            )}
          </div>
          <div>
            <FieldLabel>الكمية الافتتاحية</FieldLabel>
            <SInput
              type="number"
              min="0.001"
              step="any"
              placeholder="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>تكلفة الوحدة (ج.م)</FieldLabel>
            <SInput
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.cost_price}
              onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>تاريخ أول المدة</FieldLabel>
            <SInput
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>ملاحظات (اختياري)</FieldLabel>
            <SInput
              placeholder="رصيد أول المدة"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <PrimaryBtn
              onClick={handleSubmit}
              disabled={saving || !form.product_id}
              className="w-full"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              تسجيل
            </PrimaryBtn>
          </div>
        </div>
        {form.product_id && form.quantity && form.cost_price && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-amber-300 text-xs">
              سيُضاف <strong>{parseFloat(form.quantity) || 0}</strong> وحدة بتكلفة{' '}
              <strong>{parseFloat(form.cost_price) || 0} ج.م</strong>
              {selectedProduct ? ` للمنتج "${selectedProduct.name}"` : ''}
            </p>
          </div>
        )}
      </div>

      <div className="bg-[#111827] rounded-2xl overflow-hidden border border-line">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h4 className="font-bold text-ink/60 text-sm">أرصدة المنتجات المسجلة</h4>
          <span className="text-ink/30 text-xs bg-surface px-2 py-0.5 rounded-lg">
            {entries.length}
          </span>
        </div>
        <OBEntryTable
          data={entries}
          isLoading={isLoading}
          columns={[
            {
              label: 'المنتج',
              render: (e) => <span className="font-bold text-ink">{e.product_name}</span>,
            },
            {
              label: 'الكمية',
              render: (e) => (
                <span className="text-blue-400 font-mono">
                  {Number(e.quantity).toLocaleString('ar-EG-u-nu-latn')}
                </span>
              ),
            },
            {
              label: 'تكلفة الوحدة',
              render: (e) => (
                <span className="text-amber-400 font-mono">
                  {Number(e.unit_cost).toLocaleString('ar-EG-u-nu-latn', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  ج.م
                </span>
              ),
            },
            {
              label: 'التاريخ',
              render: (e) => <span className="text-ink/40 text-xs">{e.date}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
