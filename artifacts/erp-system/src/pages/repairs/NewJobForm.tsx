import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  XCircle,
  Phone,
  Smartphone,
  Package,
  GitBranch,
  CheckCircle2,
  Smartphone as SmartphoneIcon,
  Ban,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { deriveDeviceType } from '@/lib/repairConstants';
import { REPAIR_CATALOG as DEVICE_CATALOG } from '@/lib/device-catalog';
import { RepairJob, ChecklistItem, DEFAULT_CHECKLIST, useAccessoriesList } from './repairConstants';
import { ChecklistWizard } from './ChecklistComponents';
import { Combobox } from '@/components/ui/combobox';

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-ink/30 text-[10px]">{label}: </span>
      <span className={`text-ink/80 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function NewJobForm({
  customers,
  users,
  branches,
  onClose,
  onCreated,
}: {
  customers: { id: number; name: string; phone?: string }[];
  users: { id: number; name: string }[];
  branches: { id: number; name: string }[];
  onClose: () => void;
  onCreated: (job: RepairJob) => void;
}) {
  const { toast } = useToast();
  const accessoriesList = useAccessoriesList();

  const [phone, setPhone] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [showAddCust, setShowAddCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');

  const [branchId, setBranchId] = useState('');
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);

  const toggleAccessory = (key: string) => {
    setSelectedAccessories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [imei, setImei] = useState('');

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState('');
  const [savingQuickAdd, setSavingQuickAdd] = useState(false);
  const [devicePin, setDevicePin] = useState('');
  const [problem, setProblem] = useState('');
  const [techId, setTechId] = useState('');

  const [estimated, setEstimated] = useState('');
  const [deposit, setDeposit] = useState('');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [devicePowers, setDevicePowers] = useState<null | 'on' | 'off'>(null);
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);

  const intakeDeviceType = useMemo(() => deriveDeviceType(brand, category), [brand, category]);

  const qc = useQueryClient();
  const { data: customDeviceModels = [] } = useQuery<
    { id: number; brand: string; category: string; model: string }[]
  >({
    queryKey: ['/api/repair-device-models'],
    queryFn: () => authFetch(api('/api/repair-device-models')).then((r) => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const handleQuickAddModel = async () => {
    if (!quickAddValue.trim() || !brand || !category) return;
    setSavingQuickAdd(true);
    try {
      const r = await authFetch(api('/api/repair-device-models'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, category, model: quickAddValue.trim() }),
      });
      if (!r.ok) throw new Error('فشل الحفظ');
      await qc.invalidateQueries({ queryKey: ['/api/repair-device-models'] });
      setModel(quickAddValue.trim());
      setQuickAddValue('');
      setShowQuickAdd(false);
      toast({ title: 'تم حفظ الموديل وتحديد الاختيار' });
    } catch {
      toast({ title: 'تعذّر حفظ الموديل', variant: 'destructive' });
    } finally {
      setSavingQuickAdd(false);
    }
  };

  const { data: intakeTemplate = [] } = useQuery<
    { id: number; label_ar: string; sort_order: number; category: string }[]
  >({
    queryKey: ['/api/repair-checklist-items', intakeDeviceType],
    queryFn: async () => {
      const r = await authFetch(
        api(`/api/repair-checklist-items?device_type=${encodeURIComponent(intakeDeviceType)}`)
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<
        { id: number; label_ar: string; sort_order: number; category: string }[]
      >;
    },
    enabled: !!brand && !!category,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const intakeTemplateLen = intakeTemplate.length;
  useEffect(() => {
    if (!brand || !category) {
      setLocalChecklist([]);
      setDevicePowers(null);
      return;
    }
    const items: ChecklistItem[] = intakeTemplateLen
      ? intakeTemplate.map((t) => ({
          id: String(t.id),
          label: t.label_ar,
          category: t.category ?? 'عام',
          status: null,
        }))
      : DEFAULT_CHECKLIST.map((c) => ({ ...c, status: null, notes: undefined }));
    setLocalChecklist(items);
    setDevicePowers(null);
  }, [intakeDeviceType, intakeTemplateLen, brand, category]);

  const checklistComplete =
    localChecklist.length > 0 && localChecklist.every((c) => c.status !== null);

  const brandNames = Object.keys(DEVICE_CATALOG);
  const categories = brand && DEVICE_CATALOG[brand] ? Object.keys(DEVICE_CATALOG[brand]) : [];
  const models = useMemo(() => {
    const base =
      brand && category && DEVICE_CATALOG[brand]?.[category] ? DEVICE_CATALOG[brand][category] : [];
    const custom = customDeviceModels
      .filter((m) => m.brand === brand && m.category === category)
      .map((m) => m.model)
      .filter((m) => !base.includes(m));
    return [...base, ...custom];
  }, [brand, category, customDeviceModels]);
  const isOtherBrand = brand === 'أخرى';
  const isOtherCat = brand !== 'أخرى' && categories.length > 0 && category === 'جهاز آخر';

  const phoneDigits = phone.replace(/\D/g, '');
  const isComplete = phoneDigits.length === 11;

  useEffect(() => {
    if (!isComplete) {
      setCustomerId(null);
      setCustomerName('');
      setShowAddCust(false);
      return;
    }
    const found = customers.find((c) => (c.phone ?? '').replace(/\D/g, '') === phoneDigits);
    if (found) {
      setCustomerId(found.id);
      setCustomerName(found.name);
      setShowAddCust(false);
    } else {
      setCustomerId(null);
      setCustomerName('');
      setShowAddCust(true);
    }
  }, [phoneDigits, isComplete, customers]);

  const handleConfirmGuestCustomer = () => {
    if (!newCustName.trim()) {
      toast({ title: 'أدخل اسم العميل', variant: 'destructive' });
      return;
    }
    setCustomerId(null);
    setCustomerName(newCustName.trim());
    setShowAddCust(false);
  };

  const finalModel = isOtherBrand || isOtherCat ? customModel : model;

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast({ title: 'يرجى تحديد العميل أولاً', variant: 'destructive' });
      return;
    }
    if (!brand.trim()) {
      toast({ title: 'الماركة مطلوبة', variant: 'destructive' });
      return;
    }
    if (!finalModel.trim()) {
      toast({ title: 'الموديل مطلوب', variant: 'destructive' });
      return;
    }
    if (devicePowers === null) {
      toast({ title: 'حدد هل الجهاز يعمل أم لا', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const deviceBrand = isOtherBrand ? customModel : brand;
      const deviceModel = isOtherBrand
        ? customModel
        : isOtherCat
          ? customModel
          : `${category} ${model}`.trim();

      const sentChecklist =
        devicePowers === 'off'
          ? [{ id: '__power_off__', label: 'الجهاز لا يفتح ولا يشتغل', status: 'fail' as const }]
          : localChecklist;

      const res = await authFetch(api('/api/repair-jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: phoneDigits,
          device_brand: deviceBrand,
          device_model: deviceModel,
          device_type: deriveDeviceType(deviceBrand, category),
          imei,
          device_pin: devicePin || null,
          problem_description: problem,
          technician_id: techId ? Number(techId) : null,
          technician_name: users.find((u) => u.id.toString() === techId)?.name ?? null,
          estimated_cost: Number(estimated) || 0,
          deposit_paid: Number(deposit) || 0,
          received_at: receivedAt,
          estimated_delivery: estimatedDelivery || null,
          checklist: sentChecklist,
          accessories: selectedAccessories.length ? selectedAccessories.join(',') : null,
          branch_id: branchId ? Number(branchId) : null,
        }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error ?? 'خطأ في الإنشاء');
      onCreated(job);
    } catch (e: unknown) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <h2 className="font-black text-ink flex items-center gap-2">
          <Plus className="w-4 h-4 text-ink/50" /> بطاقة صيانة جديدة
        </h2>
        <button onClick={onClose} className="btn-icon text-ink/40 hover:text-ink">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── 1. Customer by Phone ── */}
        <div className="glass-panel rounded-2xl p-3 border border-line space-y-2">
          <p className="text-[10px] text-ink/40 font-bold flex items-center gap-1">
            <Phone className="w-3 h-3" /> بيانات العميل
          </p>

          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/30" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="رقم الهاتف (11 رقم) *"
              className="erp-input w-full icon-pr text-sm font-mono tracking-widest"
              inputMode="numeric"
              maxLength={11}
            />
            {phoneDigits.length > 0 && phoneDigits.length < 11 && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-ink/30">
                {11 - phoneDigits.length} رقم متبقي
              </span>
            )}
          </div>

          {isComplete && customerId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-300 text-sm font-bold">{customerName}</p>
                <p className="text-[10px] text-emerald-400/60">عميل دائم</p>
              </div>
            </div>
          )}

          {isComplete && !customerId && !showAddCust && customerName && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-300 text-sm font-bold">{customerName}</p>
                  <p className="text-[10px] text-emerald-400/60">
                    عميل صيانة — سيُضاف لقائمة العملاء عند الحفظ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerName('');
                  setShowAddCust(true);
                  setNewCustName(customerName);
                }}
                className="text-[10px] text-emerald-400/60 hover:text-emerald-300 underline"
              >
                تعديل
              </button>
            </div>
          )}

          {isComplete && showAddCust && (
            <div className="space-y-2 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> الرقم غير موجود — سيُضاف كعميل دائم بتصنيف
                "عميل صيانة"
              </p>
              <input
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmGuestCustomer()}
                placeholder="اسم العميل *"
                className="erp-input w-full text-sm"
              />
              <button
                onClick={handleConfirmGuestCustomer}
                className="w-full py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all"
              >
                ✓ متابعة — حفظ كعميل صيانة
              </button>
            </div>
          )}
        </div>

        {/* ── 1b. Branch ── */}
        {branches.length > 0 && (
          <div className="glass-panel rounded-2xl p-3 border border-line space-y-2">
            <p className="text-[10px] text-ink/40 font-bold flex items-center gap-1">
              <GitBranch className="w-3 h-3" /> الفرع
            </p>
            <Combobox
              options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
              value={branchId}
              onChange={(v) => setBranchId(v)}
              placeholder="— بدون تحديد فرع —"
              className="w-full text-sm"
              clearable
              searchable={false}
            />
          </div>
        )}

        {/* ── 2. Device Data ── */}
        <div className="glass-panel rounded-2xl p-3 border border-line space-y-2">
          <p className="text-[10px] text-ink/40 font-bold flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> بيانات الجهاز
          </p>

          <div>
            <label className="text-[10px] text-ink/40 mb-1 block">الماركة *</label>
            <Combobox
              options={brandNames.map((b) => ({ value: b, label: b }))}
              value={brand}
              onChange={(v) => {
                setBrand(v);
                setCategory('');
                setModel('');
                setCustomModel('');
              }}
              placeholder="— اختر الماركة —"
              className="w-full text-sm"
              searchable={false}
            />
          </div>

          {brand && !isOtherBrand && categories.length > 0 && (
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">التصنيف *</label>
              <Combobox
                options={categories.map((c) => ({ value: c, label: c }))}
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  setModel('');
                  setCustomModel('');
                }}
                placeholder="— اختر التصنيف —"
                className="w-full text-sm"
                searchable={false}
              />
            </div>
          )}

          {brand && !isOtherBrand && category && !isOtherCat && models.length > 0 && (
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">الموديل *</label>
              {showQuickAdd ? (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={quickAddValue}
                    onChange={(e) => setQuickAddValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAddModel();
                      if (e.key === 'Escape') setShowQuickAdd(false);
                    }}
                    placeholder="مثال: iPhone 17 Pro Max"
                    className="erp-input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddModel}
                    disabled={savingQuickAdd || !quickAddValue.trim()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-black text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    {savingQuickAdd ? '…' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickAddValue('');
                    }}
                    className="px-2 py-1.5 rounded-lg bg-surface hover:bg-surface text-ink/50 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Combobox
                    options={models.map((m) => ({ value: m, label: m }))}
                    value={model}
                    onChange={(v) => setModel(v)}
                    placeholder="— اختر الموديل —"
                    className="flex-1 text-sm"
                    searchable={false}
                  />
                  <button
                    type="button"
                    title="إضافة موديل جديد"
                    onClick={() => {
                      setShowQuickAdd(true);
                      setQuickAddValue('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-amber-500/15 hover:border-amber-500/40 text-ink/50 hover:text-amber-300 text-sm transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}

          {(isOtherBrand || isOtherCat || (brand && category && models.length === 0)) && (
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">
                {isOtherBrand ? 'الماركة والموديل *' : 'الموديل *'}
              </label>
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={isOtherBrand ? 'مثال: Tecno Spark 20' : 'أدخل الموديل'}
                className="erp-input w-full text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">رقم IMEI</label>
              <input
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="15 رقم"
                className="erp-input w-full text-sm font-mono"
                maxLength={15}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">الرقم السري للجهاز</label>
              <input
                value={devicePin}
                onChange={(e) => setDevicePin(e.target.value)}
                placeholder="PIN / كلمة المرور"
                className="erp-input w-full text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-ink/40 mb-1 block">الفني المسؤول</label>
            <Combobox
              options={users.map((u) => ({ value: String(u.id), label: u.name }))}
              value={techId}
              onChange={(v) => setTechId(v)}
              placeholder="— اختر الفني —"
              className="w-full text-sm"
              clearable
            />
          </div>

          <div>
            <label className="text-[10px] text-ink/40 mb-1 block">وصف المشكلة</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              placeholder="ما الشكوى التي أبلغ عنها العميل؟"
              className="erp-input w-full text-sm resize-none"
            />
          </div>
        </div>

        {/* ── 2b. Accessories ── */}
        <div className="glass-panel rounded-2xl p-3 border border-line space-y-2">
          <p className="text-[10px] text-ink/40 font-bold flex items-center gap-1">
            <Package className="w-3 h-3" /> الإكسسوارات المستلمة مع الجهاز
          </p>
          <div className="flex flex-wrap gap-2">
            {accessoriesList.map((acc) => (
              <button
                key={acc.key}
                type="button"
                onClick={() => toggleAccessory(acc.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  selectedAccessories.includes(acc.key)
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'border-line text-ink/40 hover:border-line hover:text-ink/60'
                }`}
              >
                {selectedAccessories.includes(acc.key) ? '✓ ' : acc.emoji ? `${acc.emoji} ` : ''}
                {acc.label}
              </button>
            ))}
          </div>
          {selectedAccessories.length === 0 && (
            <p className="text-[10px] text-ink/25">لا إكسسوارات — اضغط لتحديد ما تم استلامه</p>
          )}
        </div>

        {/* ── 3. Device Power Check ── */}
        <div
          className={`glass-panel rounded-2xl p-4 border transition-all ${
            devicePowers === 'on'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : devicePowers === 'off'
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-line'
          }`}
        >
          <p className="text-[10px] text-ink/40 font-bold mb-3 flex items-center gap-1">
            <SmartphoneIcon className="w-3 h-3" /> هل الجهاز يفتح ويشتغل؟
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDevicePowers('on');
              }}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                devicePowers === 'on'
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                  : 'border-line text-ink/40 hover:border-emerald-500/30 hover:text-emerald-400/70'
              }`}
            >
              <CheckCircle2 className="w-8 h-8" />
              <span className="text-sm font-bold">يعمل</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDevicePowers('off');
              }}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                devicePowers === 'off'
                  ? 'border-red-500/60 bg-red-500/15 text-red-300'
                  : 'border-line text-ink/40 hover:border-red-500/30 hover:text-red-400/70'
              }`}
            >
              <XCircle className="w-8 h-8" />
              <span className="text-sm font-bold">لا يعمل</span>
            </button>
          </div>

          {devicePowers === 'off' && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <Ban className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">سيتم حفظ الطلب مباشرةً بدون فحص</p>
            </div>
          )}

          {devicePowers === 'on' && (
            <div className="mt-4">
              <p className="text-[10px] text-emerald-400/70 mb-2 font-bold">
                أكمل فحص الجهاز قبل الحفظ — {localChecklist.filter((c) => c.status).length} /{' '}
                {localChecklist.length}
              </p>
              <ChecklistWizard
                checklist={localChecklist}
                onSaveItem={(id, status, notes) =>
                  setLocalChecklist((prev) =>
                    prev.map((c) => (c.id === id ? { ...c, status, notes: notes || c.notes } : c))
                  )
                }
              />
            </div>
          )}
        </div>

        {/* ── 4. Financials & Dates ── */}
        <div className="glass-panel rounded-2xl p-3 border border-line space-y-2">
          <p className="text-[10px] text-ink/40 font-bold">التكلفة والتواريخ</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">تكلفة تقديرية</label>
              <input
                type="number"
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                placeholder="0"
                className="erp-input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">عربون مدفوع</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="0"
                className="erp-input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">تاريخ الاستلام *</label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="erp-input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink/40 mb-1 block">موعد التسليم</label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="erp-input w-full text-sm"
              />
            </div>
          </div>
        </div>

        {devicePowers === 'on' && !checklistComplete && (
          <p className="text-center text-[11px] text-amber-400/70 -mt-2">
            أكمل جميع بنود الفحص لتتمكن من الحفظ ({localChecklist.filter((c) => !c.status).length}{' '}
            متبقي)
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !customerName.trim() ||
            phoneDigits.length !== 11 ||
            devicePowers === null ||
            (devicePowers === 'on' && !checklistComplete)
          }
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 border border-amber-500/30 text-black font-bold transition-all disabled:opacity-50"
        >
          {submitting ? (
            'جاري الإنشاء...'
          ) : (
            <>
              <Plus className="w-4 h-4" /> إنشاء البطاقة
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export { InfoRow };
