import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Banknote } from 'lucide-react';
import { FieldLabel, SInput, SSelect, PrimaryBtn } from '../../_shared';
import { useOBQuery } from '../hooks/useOBQuery';
import { OBEntryTable } from './OBEntryTable';
import type { SafeItem } from '../types';

export function OBTreasuryTab() {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useOBQuery('/opening-balance/treasury');
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const { toast } = useToast();
  const [form, setForm] = useState({
    safe_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.safe_id || !form.amount) {
      toast({ title: 'الخزينة والمبلغ مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const res = await authFetch(api('/api/opening-balance/treasury'), {
      method: 'POST',
      body: JSON.stringify({
        safe_id: parseInt(form.safe_id),
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
    toast({ title: '✅ تم تسجيل الرصيد الافتتاحي للخزينة' });
    setForm((f) => ({ ...f, safe_id: '', amount: '', notes: '' }));
    qc.invalidateQueries({ queryKey: ['ob/opening-balance/treasury'] });
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#1A2235] border border-amber-500/20 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
          <Banknote className="w-4 h-4" /> إضافة رصيد افتتاحي للخزينة
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <FieldLabel>الخزينة</FieldLabel>
            <SSelect
              value={form.safe_id}
              onChange={(e) => setForm((f) => ({ ...f, safe_id: e.target.value }))}
            >
              <option value="">— اختر الخزينة —</option>
              {safeArray<SafeItem>(safes).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (رصيد: {Number(s.balance).toLocaleString('ar-EG-u-nu-latn')} ج.م)
                </option>
              ))}
            </SSelect>
          </div>
          <div>
            <FieldLabel>المبلغ الافتتاحي (ج.م)</FieldLabel>
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
        <PrimaryBtn onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          تسجيل الرصيد الافتتاحي
        </PrimaryBtn>
      </div>

      <div className="bg-[#111827] rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h4 className="font-bold text-white/60 text-sm">القيود المسجلة</h4>
          <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-lg">
            {entries.length}
          </span>
        </div>
        <OBEntryTable
          data={entries}
          isLoading={isLoading}
          columns={[
            {
              label: 'الخزينة',
              render: (e) => <span className="font-bold text-amber-400">{e.safe_name}</span>,
            },
            {
              label: 'المبلغ',
              render: (e) => (
                <span className="text-emerald-400 font-mono">
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
