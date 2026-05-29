import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { useGetCustomers } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Users } from 'lucide-react';
import { FieldLabel, SInput, PrimaryBtn } from '../../_shared';
import { useOBQuery } from '../hooks/useOBQuery';
import { OBEntryTable } from './OBEntryTable';
import type { CustomerItem } from '../types';

export function OBCustomersTab() {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useOBQuery('/opening-balance/customer');
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    customer_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const registeredIds = new Set(entries.map((e) => e.id));
  const filteredCustomers = safeArray<CustomerItem>(customers).filter(
    (c) => !registeredIds.has(c.id) && c.name.includes(search)
  );
  const selectedCustomer = safeArray<CustomerItem>(customers).find((c) => String(c.id) === form.customer_id);
  const handleSelect = (c: CustomerItem) => {
    setForm((f) => ({ ...f, customer_id: String(c.id) }));
    setSearch(c.name);
  };

  const handleSubmit = async () => {
    if (!form.customer_id || !form.amount) {
      toast({ title: 'العميل والمبلغ مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const res = await authFetch(api('/api/opening-balance/customer'), {
      method: 'POST',
      body: JSON.stringify({
        customer_id: parseInt(form.customer_id),
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
    toast({ title: `✅ تم تسجيل رصيد أول المدة لـ ${selectedCustomer?.name ?? 'العميل'}` });
    setForm((f) => ({ ...f, customer_id: '', amount: '', notes: '' }));
    setSearch('');
    qc.invalidateQueries({ queryKey: ['ob/opening-balance/customer'] });
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#1A2235] border border-amber-500/20 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
          <Users className="w-4 h-4" /> إضافة رصيد افتتاحي لعميل
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <FieldLabel>العميل</FieldLabel>
            <SInput
              placeholder="ابحث عن عميل..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setForm((f) => ({ ...f, customer_id: '' }));
              }}
            />
            {search && !form.customer_id && filteredCustomers.length > 0 && (
              <div className="absolute top-full mt-1 right-0 left-0 z-20 bg-[#111827] border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                {filteredCustomers.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className="w-full text-right px-3 py-2.5 text-sm text-white/80 hover:bg-white/8 transition-colors border-b border-white/5 last:border-0"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <p className="mt-1 text-emerald-400 text-xs">✓ {selectedCustomer.name}</p>
            )}
          </div>
          <div>
            <FieldLabel>مبلغ الدين الافتتاحي (ج.م)</FieldLabel>
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
        <PrimaryBtn onClick={handleSubmit} disabled={saving || !form.customer_id}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          تسجيل الرصيد الافتتاحي
        </PrimaryBtn>
      </div>

      <div className="bg-[#111827] rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h4 className="font-bold text-white/60 text-sm">أرصدة العملاء المسجلة</h4>
          <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-lg">
            {entries.length}
          </span>
        </div>
        <OBEntryTable
          data={entries}
          isLoading={isLoading}
          columns={[
            {
              label: 'العميل',
              render: (e) => <span className="font-bold text-white">{e.customer_name}</span>,
            },
            {
              label: 'المبلغ',
              render: (e) => (
                <span className="text-red-400 font-mono">
                  {Number(e.amount).toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })}{' '}
                  ج.م
                </span>
              ),
            },
            {
              label: 'التاريخ',
              render: (e) => <span className="text-white/40 text-xs">{e.date}</span>,
            },
            {
              label: 'البيان',
              render: (e) => <span className="text-white/30 text-xs">{e.description}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
