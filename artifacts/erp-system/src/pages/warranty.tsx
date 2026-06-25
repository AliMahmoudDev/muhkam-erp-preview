import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { Plus, Shield, ShieldCheck, ShieldX, Clock, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { AlertSettingBanner } from '@/components/AlertSettingBanner';
import { Combobox } from '@/components/ui/combobox';
import { PageToolbar } from '@/components/patterns';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyTable } from '@/components/ui/empty-table';

/* ── Types ──────────────────────────────────────────────────────────────── */
interface WarrantyRecord {
  id: number;
  product_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  serial_number: string | null;
  device_model: string | null;
  warranty_months: number;
  warranty_start: string;
  warranty_end: string;
  status: string;
  notes: string | null;
  days_remaining: number;
  sale_id: number | null;
}

interface WarrantyStats {
  total: number;
  active: number;
  expired: number;
  expiring_soon: number;
}

/* ── Form ────────────────────────────────────────────────────────────────── */
function NewWarrantyForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    product_name: '',
    customer_name: '',
    customer_phone: '',
    serial_number: '',
    device_model: '',
    warranty_months: '3',
    warranty_start: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(api('/api/warranty'), {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'فشل الإنشاء');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ تم إنشاء سجل الضمان' });
      qc.invalidateQueries({ queryKey: ['/api/warranty'] });
      qc.invalidateQueries({ queryKey: ['/api/warranty/stats'] });
      onClose();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const field = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <div className="glass-panel rounded-3xl p-6 w-full max-w-lg border border-line space-y-4">
        <h2 className="text-lg font-black text-ink flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          سجل ضمان جديد
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-ink/50 text-xs mb-1 block">المنتج / الخدمة *</label>
            <input
              className="erp-input w-full text-sm"
              placeholder="اسم المنتج أو الخدمة"
              value={form.product_name}
              onChange={(e) => field('product_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-ink/50 text-xs mb-1 block">اسم العميل</label>
            <input
              className="erp-input w-full text-sm"
              placeholder="العميل"
              value={form.customer_name}
              onChange={(e) => field('customer_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-ink/50 text-xs mb-1 block">
              رقم الهاتف * <span className="text-ink/30">(11 رقم)</span>
            </label>
            <input
              required
              type="text"
              inputMode="numeric"
              maxLength={11}
              className="erp-input w-full text-sm"
              placeholder="01xxxxxxxxx"
              value={form.customer_phone}
              onChange={(e) =>
                field('customer_phone', e.target.value.replace(/\D/g, '').slice(0, 11))
              }
            />
          </div>
          <div>
            <label className="text-ink/50 text-xs mb-1 block">الرقم التسلسلي</label>
            <input
              className="erp-input w-full text-sm"
              placeholder="S/N أو IMEI"
              value={form.serial_number}
              onChange={(e) => field('serial_number', e.target.value)}
            />
          </div>
          <div>
            <label className="text-ink/50 text-xs mb-1 block">الموديل</label>
            <input
              className="erp-input w-full text-sm"
              placeholder="iPhone 14 / Samsung S23..."
              value={form.device_model}
              onChange={(e) => field('device_model', e.target.value)}
            />
          </div>
          <div>
            <label className="text-ink/50 text-xs mb-1 block">مدة الضمان (شهر) *</label>
            <Combobox
              options={[
                { value: '1', label: 'شهر' },
                { value: '3', label: '3 أشهر' },
                { value: '6', label: '6 أشهر' },
                { value: '12', label: 'سنة' },
                { value: '24', label: 'سنتان' },
              ]}
              value={form.warranty_months}
              onChange={(v) => field('warranty_months', v)}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-ink/50 text-xs mb-1 block">تاريخ البدء *</label>
            <input
              type="date"
              className="erp-input w-full text-sm"
              value={form.warranty_start}
              onChange={(e) => field('warranty_start', e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="text-ink/50 text-xs mb-1 block">ملاحظات</label>
            <textarea
              className="erp-input w-full text-sm resize-none"
              rows={2}
              placeholder="ملاحظات إضافية..."
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.product_name || !form.warranty_start}
            className="flex-1 btn-primary py-2.5 text-sm font-bold"
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ السجل'}
          </button>
          <button onClick={onClose} className="px-5 btn-secondary py-2.5 text-sm">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */
function WarrantyBadge({ record }: { record: WarrantyRecord }) {
  const today = new Date().toISOString().split('T')[0];
  if (record.status !== 'active' || record.warranty_end < today)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
        منتهي
      </span>
    );
  if (record.days_remaining <= 30)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
        ينتهي قريباً
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
      نشط
    </span>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function Warranty({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [showForm, setShowForm] = useState(false);

  const { data: stats } = useQuery<WarrantyStats>({
    queryKey: ['/api/warranty/stats'],
    queryFn: async () => {
      const r = await authFetch(api('/api/warranty/stats'));
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: rawRecords, isLoading } = useQuery({
    queryKey: ['/api/warranty'],
    queryFn: async () => {
      const r = await authFetch(api('/api/warranty'));
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
  });
  const records: WarrantyRecord[] = safeArray(rawRecords);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/warranty/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل الحذف');
    },
    onSuccess: () => {
      toast({ title: 'تم حذف سجل الضمان' });
      qc.invalidateQueries({ queryKey: ['/api/warranty'] });
      qc.invalidateQueries({ queryKey: ['/api/warranty/stats'] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const today = new Date().toISOString().split('T')[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().split('T')[0];

  const filtered = records.filter((r) => {
    const matchSearch =
      !search ||
      r.product_name.includes(search) ||
      (r.customer_name ?? '').includes(search) ||
      (r.serial_number ?? '').includes(search) ||
      (r.device_model ?? '').includes(search);
    const matchFilter =
      filter === 'all'
        ? true
        : filter === 'active'
          ? r.status === 'active' && r.warranty_end >= today
          : filter === 'expiring'
            ? r.status === 'active' && r.warranty_end >= today && r.warranty_end <= soonStr
            : r.status !== 'active' || r.warranty_end < today;
    return matchSearch && matchFilter;
  });

  const STAT_CARDS = [
    {
      label: 'إجمالي سجلات الضمان',
      value: stats?.total ?? 0,
      icon: Shield,
      color: 'text-amber-400',
    },
    {
      label: 'ضمانات نشطة',
      value: stats?.active ?? 0,
      icon: ShieldCheck,
      color: 'text-emerald-400',
    },
    {
      label: 'تنتهي خلال 30 يوم',
      value: stats?.expiring_soon ?? 0,
      icon: Clock,
      color: 'text-orange-400',
    },
    { label: 'منتهية الصلاحية', value: stats?.expired ?? 0, icon: ShieldX, color: 'text-red-400' },
  ];

  const sendWhatsApp = (r: WarrantyRecord) => {
    const phone = r.customer_phone?.replace(/\D/g, '') ?? '';
    const phoneFormatted = phone.startsWith('0')
      ? '2' + phone
      : phone.startsWith('2')
        ? phone
        : phone
          ? '2' + phone
          : '';
    const lines = [
      `🛡️ *تذكير ضمان - مُحكم - MUHKAM*`,
      `المنتج: ${r.product_name}`,
      r.device_model ? `الموديل: ${r.device_model}` : '',
      r.serial_number ? `الرقم التسلسلي: ${r.serial_number}` : '',
      `تاريخ انتهاء الضمان: ${r.warranty_end}`,
      r.days_remaining > 0 ? `الأيام المتبقية: ${r.days_remaining} يوم` : '⚠️ انتهى الضمان',
      ``,
      `للاستفسار يرجى التواصل معنا 🙏`,
    ].filter(Boolean);
    const url = phoneFormatted
      ? `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(lines.join('\n'))}`
      : `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank');
  };

  return (
    <div className="erp-page" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }} dir="rtl">
      {showForm && <NewWarrantyForm onClose={() => setShowForm(false)} />}

      {/* ── Header (hidden when embedded) ── */}
      {!embedded && (
        <div className="erp-page-header">
          <div className="erp-page-actions">
            <button
              onClick={() => setShowForm(true)}
              className="erp-btn erp-btn-primary erp-btn-sm"
            >
              <Plus className="w-4 h-4" />
              سجل ضمان جديد
            </button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((c) => (
          <div key={c.label} className="glass-panel rounded-2xl p-4 border border-line">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-ink/40 text-xs">{c.label}</span>
            </div>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <AlertSettingBanner
        enabledKey="alert_warranty_enabled"
        thresholdKey="alert_warranty_days"
        title="تنبيه انتهاء الضمان"
        thresholdLabel="التنبيه قبل"
        thresholdUnit="يوم"
        icon="🛡️"
        color="amber"
        defaultThreshold="30"
      />

      {/* ── Filters ── */}
      <PageToolbar
        searchSlot={
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="بحث بالمنتج / العميل / الرقم التسلسلي..."
            aria-label="بحث في سجلات الضمان"
          />
        }
        filtersSlot={
          <div className="flex gap-1">
            {(['all', 'active', 'expiring', 'expired'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filter === f
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'glass-panel border-line text-ink/50 hover:text-ink'
                }`}
              >
                {f === 'all'
                  ? 'الكل'
                  : f === 'active'
                    ? 'نشط'
                    : f === 'expiring'
                      ? 'ينتهي قريباً'
                      : 'منتهي'}
              </button>
            ))}
          </div>
        }
        actionsSlot={
          embedded ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> ضمان جديد
            </button>
          ) : undefined
        }
      />

      {/* ── Table ── */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-sm erp-table" dir="rtl">
            <thead>
              <tr className="border-b border-line text-ink/40 text-right">
                <th className="p-3 font-medium">المنتج / الخدمة</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">الموديل / S/N</th>
                <th className="p-3 font-medium">المدة</th>
                <th className="p-3 font-medium">تاريخ الانتهاء</th>
                <th className="p-3 font-medium">الأيام المتبقية</th>
                <th className="p-3 font-medium">الحالة</th>
                <th className="p-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr className="erp-table-row">
                  <td colSpan={8} className="erp-table-loading-cell">
                    <div className="erp-loading">
                      <Loader2 />
                      جاري التحميل...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr className="erp-table-row">
                  <td colSpan={8}>
                    <EmptyTable
                      variant={search ? 'no-results' : 'no-data'}
                      headline="لا توجد سجلات ضمان"
                      description="ابدأ بإضافة أول سجل ضمان."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-line erp-table-row">
                    <td className="p-3 font-bold text-ink">{r.product_name}</td>
                    <td className="p-3">
                      <div className="text-ink/80">{r.customer_name || '—'}</div>
                      {r.customer_phone && (
                        <div className="text-ink/40 text-xs">{r.customer_phone}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-ink/70 text-xs">{r.device_model || '—'}</div>
                      {r.serial_number && (
                        <div className="text-ink/40 text-xs font-mono">{r.serial_number}</div>
                      )}
                    </td>
                    <td className="p-3 text-ink/60">{r.warranty_months} شهر</td>
                    <td className="p-3 text-ink/60">{r.warranty_end}</td>
                    <td className="p-3">
                      <span
                        className={`font-bold ${r.days_remaining <= 0 ? 'text-red-400' : r.days_remaining <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}
                      >
                        {r.days_remaining <= 0 ? 'منتهي' : `${r.days_remaining} يوم`}
                      </span>
                    </td>
                    <td className="p-3">
                      <WarrantyBadge record={r} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => sendWhatsApp(r)}
                          title="إرسال تذكير واتساب"
                          className="btn-icon text-[#25D366] hover:text-[#20ba58] hover:bg-[#25D366]/10"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(r.id)}
                          title="حذف"
                          className="btn-icon text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
