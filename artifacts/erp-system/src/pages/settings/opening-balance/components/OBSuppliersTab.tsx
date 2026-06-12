import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { useGetCustomers } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Truck } from 'lucide-react';
import { FieldLabel, SInput, PrimaryBtn } from '../../_shared';
import { useOBQuery } from '../hooks/useOBQuery';
import { OBEntryTable } from './OBEntryTable';
import type { CustomerItem } from '../types';

export function OBSuppliersTab() {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useOBQuery('/opening-balance/supplier');
  const { data: allCustomersRaw } = useGetCustomers();
  const allCustomers = safeArray(allCustomersRaw);
  const suppliers = allCustomers.filter((c) => c.is_supplier);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    supplier_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const registeredIds = new Set(entries.map((e) => Number(e.customer_id ?? e.reference_id)).filter(Number.isFinite));
  const filteredSuppliers = suppliers.filter(
    (s) => !registeredIds.has(s.id) && s.name.includes(search)
  );
  const selectedSupplier = suppliers.find((s) => String(s.id) === form.supplier_id);
  const handleSelect = (s: CustomerItem) => {
    setForm((f) => ({ ...f, supplier_id: String(s.id) }));
    setSearch(s.name);
  };

  const handleSubmit = async () => {
    if (!form.supplier_id || !form.amount) {
      toast({ title: 'المورد والمبلغ مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const res = await authFetch(api('/api/opening-balance/supplier'), {
      method: 'POST',
      body: JSON.stringify({
        supplier_id: parseInt(form.supplier_id),
        amount: parseFloat(form.amount),
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
    toast({
      title: `✅ تم تسجيل رصيد أول المدة لـ ${selectedSupplier?.name ?? 'المورد'}`,
    });
    setForm((f) => ({ ...f, supplier_id: '', amount: '', notes: '' }));
    setSearch('');
    qc.invalidateQueries({ queryKey: ['ob/opening-balance/supplier'] });
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#1A2235] border border-amber-500/20 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
          <Truck className="w-4 h-4" /> إضافة رصيد افتتاحي لمورد
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <FieldLabel>المورد</FieldLabel>
            <SInput
              placeholder="ابحث عن مورد..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setForm((f) => ({ ...f, supplier_id: '' }));
              }}
            />
            {search && !form.supplier_id && filteredSuppliers.length > 0 && (
              <div className="absolute top-full mt-1 right-0 left-0 z-20 bg-[#111827] border border-line rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                {filteredSuppliers.slice(0, 10).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className="w-full text-right px-3 py-2.5 text-sm text-ink/80 hover:bg-surface transition-colors border-b border-line last:border-0"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {selectedSupplier && (
              <p className="mt-1 text-emerald-400 text-xs">✓ {selectedSupplier?.name}</p>
            )}
          </div>
          <div>
            <FieldLabel>مبلغ الرصيد المستحق (ج.م)</FieldLabel>
            <SInput
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
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
        </div>
        <PrimaryBtn onClick={handleSubmit} disabled={saving || !form.supplier_id}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          تسجيل الرصيد الافتتاحي
        </PrimaryBtn>
      </div>

      <div className="bg-[#111827] rounded-2xl overflow-hidden border border-line">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h4 className="font-bold text-ink/60 text-sm">أرصدة الموردين المسجلة</h4>
          <span className="text-ink/30 text-xs bg-surface px-2 py-0.5 rounded-lg">
            {entries.length}
          </span>
        </div>
        <OBEntryTable
          data={entries}
          isLoading={isLoading}
          columns={[
            {
              label: 'المورد',
              render: (e) => (
                <span className="font-bold text-ink">
                  {e.customer_name ?? e.description?.split('—')[1]?.trim() ?? `مورد #${e.customer_id ?? e.reference_id ?? e.id}`}
                </span>
              ),
            },
            {
              label: 'المبلغ',
              render: (e) => (
                <span className="text-orange-400 font-mono">
                  {Number(e.amount).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })}{' '}
                  ج.م
                </span>
              ),
            },
            {
              label: 'التاريخ',
              render: (e) => <span className="text-ink/40 text-xs">{e.date}</span>,
            },
            {
              label: 'البيان',
              render: (e) => <span className="text-ink/30 text-xs">{e.description}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
