import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { uploadFileToR2, resolveUploadedFileUrl } from '@/lib/file-upload';
import {
  CATALOG,
  BRANDS,
  DEFAULT_STORAGES,
  DEFAULT_COLORS,
  OTHER,
  type ModelSpec,
} from '@/lib/device-catalog';
import {
  Smartphone,
  X,
  XCircle,
  CheckCircle2,
  ShoppingCart,
  Info,
  FileText,
  User,
} from 'lucide-react';
import { apiPost, GRADES, maskImei } from './index';

export function DeviceFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  /* ── wizard step 1 | 2 ── */
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  /* ── cascade selectors ── */
  const [brandSel, setBrandSel] = useState('');
  const [catSel, setCatSel] = useState('');
  const [modelSel, setModelSel] = useState('');
  const [colorSel, setColorSel] = useState('');
  const [brandCustom, setBrandCustom] = useState('');
  const [modelCustom, setModelCustom] = useState('');
  const [colorCustom, setColorCustom] = useState('');
  const [storageCustom, setStorageCustom] = useState('');
  const [storageModeOther, setStorageModeOther] = useState(false);

  /* ── device form fields ── */
  const [form, setForm] = useState({ storage: '128GB', imei: '', battery_health: '', grade: 'B' });
  const f = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  /* ── supplier / customer ── */
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierName, setSupplierName] = useState(''); // for new (not in DB)
  const [foundCustomer, setFoundCustomer] = useState<{
    id: number;
    name: string;
    balance?: string;
  } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  /* ── ID card ── */
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string>('');

  /* ── financial (step 2) ── */
  const [fin, setFin] = useState({
    purchase_price: '',
    sale_price: '',
    payment_type: 'cash' as 'cash' | 'credit' | 'partial',
    paid_amount: '',
    safe_id: '',
    warehouse_id: '',
  });
  const fp = (k: string, v: string) => setFin((p) => ({ ...p, [k]: v }));

  const [safes, setSafes] = useState<{ id: number; name: string; balance: string }[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  /* ── documents / condition notes ── */
  const [conditionNotes, setConditionNotes] = useState('');

  /* cascade derived */
  const isOtherBrand = brandSel === OTHER;
  const isOtherModel = modelSel === OTHER;
  const isOtherColor = colorSel === OTHER;
  const isOtherStorage = storageModeOther;
  const categories = brandSel && !isOtherBrand ? Object.keys(CATALOG[brandSel] ?? {}) : [];
  const modelSpecs = catSel && !isOtherBrand ? (CATALOG[brandSel]?.[catSel] ?? {}) : {};
  const modelNames = Object.keys(modelSpecs);
  const currentSpec: ModelSpec | null =
    modelSel && !isOtherModel ? (modelSpecs[modelSel] ?? null) : null;
  const availColors = currentSpec?.colors.length
    ? [...currentSpec.colors, OTHER]
    : [...DEFAULT_COLORS, OTHER];
  const availStorages = currentSpec?.storages.length
    ? [...currentSpec.storages, OTHER]
    : [...DEFAULT_STORAGES, OTHER];
  const effectiveBrand = isOtherBrand ? brandCustom : brandSel;
  const effectiveModel = isOtherModel ? modelCustom : modelSel;
  const effectiveColor = isOtherColor ? colorCustom : colorSel;
  const finalStorage = storageCustom.trim() || form.storage;

  /* new customer (phone entered but not found in DB) */
  const isNewSupplier = supplierPhone.trim().length > 0 && !lookingUp && !foundCustomer;

  /* if new supplier and currently credit/partial → reset to cash */
  useEffect(() => {
    if (isNewSupplier && fin.payment_type !== 'cash') fp('payment_type', 'cash');
  }, [isNewSupplier]);

  /* cascade resets */
  const resetStorageOther = () => {
    setStorageModeOther(false);
    setStorageCustom('');
  };
  const handleBrandChange = (v: string) => {
    setBrandSel(v);
    setCatSel('');
    setModelSel('');
    setColorSel('');
    setColorCustom('');
    setBrandCustom('');
    setModelCustom('');
    resetStorageOther();
    setForm((p) => ({ ...p, storage: '' }));
  };
  const handleCatChange = (v: string) => {
    setCatSel(v);
    setModelSel('');
    setColorSel('');
    setColorCustom('');
    setModelCustom('');
    resetStorageOther();
    setForm((p) => ({ ...p, storage: '' }));
  };
  const handleModelChange = (v: string) => {
    setModelSel(v);
    setColorSel('');
    setColorCustom('');
    setModelCustom('');
    resetStorageOther();
    const spec = catSel && brandSel ? CATALOG[brandSel]?.[catSel]?.[v] : undefined;
    setForm((p) => ({ ...p, storage: spec?.storages.length ? spec.storages[0] : '128GB' }));
    if (spec?.colors.length === 1) setColorSel(spec.colors[0]);
  };
  const handleStorageChange = (v: string) => {
    if (v === OTHER) {
      setStorageModeOther(true);
      setStorageCustom('');
    } else {
      setStorageModeOther(false);
      setStorageCustom('');
      setForm((p) => ({ ...p, storage: v }));
    }
  };

  /* phone lookup with debounce */
  useEffect(() => {
    if (supplierPhone.length < 7) {
      setFoundCustomer(null);
      return;
    }
    const t = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await authFetch(
          api(`/api/devices/customer-lookup?phone=${encodeURIComponent(supplierPhone)}`)
        );
        const data = (await res.json()) as {
          found: boolean;
          customer?: { id: number; name: string; balance?: string };
        };
        setFoundCustomer(data.found && data.customer ? data.customer : null);
      } catch {
        setFoundCustomer(null);
      } finally {
        setLookingUp(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [supplierPhone]);

  /* Load safes + warehouses when entering step 2 */
  useEffect(() => {
    if (step !== 2) return;
    authFetch(api('/api/devices/safes'))
      .then((r) => r.json() as Promise<{ id: number; name: string; balance: string }[]>)
      .then(setSafes)
      .catch(() => setSafes([]));
    authFetch(api('/api/devices/warehouses'))
      .then((r) => r.json() as Promise<{ id: number; name: string }[]>)
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  }, [step]);

  /* ID card file handler */
  const handleIdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'حجم الملف يتجاوز 2MB', variant: 'destructive' });
      e.target.value = '';
      return;
    }

    try {
      const uploaded = await uploadFileToR2(file, 'attachments');
      setIdCardFile(file);
      setIdCardPreview(uploaded.url);
      toast({ title: 'تم رفع بطاقة المورد بنجاح' });
    } catch (err) {
      setIdCardFile(null);
      setIdCardPreview('');
      toast({
        title: err instanceof Error ? err.message : 'فشل رفع بطاقة المورد',
        variant: 'destructive',
      });
    } finally {
      e.currentTarget.value = '';
    }
  };

  /* Step 1 validation → go to step 2 */
  const handleNext = () => {
    const e: Record<string, boolean> = {};
    if (!effectiveBrand.trim()) e.brand = true;
    if (!catSel.trim() && !isOtherBrand) e.cat = true;
    if (!effectiveModel.trim()) e.model = true;
    if (!effectiveColor.trim()) e.color = true;
    if (!finalStorage.trim()) e.storage = true;
    if (!form.imei.trim()) e.imei = true;
    if (!form.battery_health) e.battery = true;
    const cleanPhone = supplierPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) e.phone = true;
    if (isNewSupplier && !supplierName.trim()) e.supplierName = true;
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({ title: 'يرجى تعبئة الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  /* Final save — calls POST /api/devices/purchase */
  const handleSave = async () => {
    const e: Record<string, boolean> = {};
    const pp = parseFloat(fin.purchase_price);
    if (!pp || pp <= 0) e.purchase_price = true;
    if (!fin.warehouse_id) e.warehouse_id = true;
    if (fin.payment_type !== 'credit' && !fin.safe_id) e.safe_id = true;
    if (fin.payment_type === 'partial') {
      const pa = parseFloat(fin.paid_amount);
      if (!pa || pa <= 0 || pa >= pp) e.paid_amount = true;
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({ title: 'يرجى تعبئة الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const idCardData = idCardPreview || undefined;

      await apiPost('/api/devices/purchase', {
        /* device */
        brand: effectiveBrand,
        model: effectiveModel,
        color: effectiveColor || undefined,
        storage: finalStorage || undefined,
        grade: form.grade,
        imei: form.imei || undefined,
        battery_health: form.battery_health ? Math.min(100, parseInt(form.battery_health)) : null,
        supplier_phone: supplierPhone.trim() || undefined,
        id_card_data: idCardData,
        condition_notes: conditionNotes.trim() || undefined,
        /* supplier / customer */
        customer_id: foundCustomer ? foundCustomer.id : undefined,
        new_customer_name: isNewSupplier && supplierName.trim() ? supplierName.trim() : undefined,
        /* financial */
        purchase_price: pp,
        sale_price: fin.sale_price ? parseFloat(fin.sale_price) : 0,
        payment_type: fin.payment_type,
        safe_id: fin.safe_id ? parseInt(fin.safe_id) : undefined,
        warehouse_id: fin.warehouse_id ? parseInt(fin.warehouse_id) : undefined,
        paid_amount: fin.payment_type === 'partial' ? parseFloat(fin.paid_amount) : undefined,
      });

      toast({ title: '✅ تم إضافة الجهاز وتسجيل فاتورة الشراء' });
      onSaved();
      onClose();
    } catch (err: unknown) {
      let msg = 'خطأ في الحفظ';
      if (err instanceof Error) {
        try {
          const j = JSON.parse(err.message);
          msg = j.error || err.message;
        } catch {
          msg = err.message;
        }
      }
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  /* helper classes */
  const errCls = (k: string) => (errors[k] ? 'border-red-500/60 bg-red-500/5' : '');
  const iCls = (k = '') => `erp-input w-full text-sm ${errCls(k)}`;
  const sCls = (k = '') => `erp-input w-full text-sm ${errCls(k)}`;
  const dCls = 'erp-input w-full text-sm opacity-40 cursor-not-allowed';
  const lCls = 'text-[11px] text-ink/40 mb-1.5 block text-right';
  const lReq = 'text-[11px] mb-1.5 block text-right text-ink/40';

  const PAYMENT_LABELS = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 bg-black/70 backdrop-blur-sm"
      dir="rtl"
    >
      <div
        className="glass-panel rounded-2xl border border-line w-full max-w-xl mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '94vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-ink text-sm">إضافة جهاز مستعمل</span>
              <p className="text-[10px] text-ink/30 mt-0.5">
                الخطوة {step} من 2 — {step === 1 ? 'بيانات الجهاز والمورد' : 'التسعير وطريقة الدفع'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${s <= step ? 'bg-amber-500 w-8' : 'bg-surface w-4'}`}
                />
              ))}
            </div>
            <button onClick={onClose} className="btn-icon text-ink/40 hover:text-ink">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* ══════════ STEP 1: Device + Supplier ══════════ */}
          {step === 1 && (
            <>
              {/* ─ Brand / Category / Model ─ */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lReq}>الشركة المصنعة *</label>
                  <select
                    value={brandSel}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    className={sCls('brand')}
                  >
                    <option value="">— اختر —</option>
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {isOtherBrand && (
                    <input
                      value={brandCustom}
                      onChange={(e) => setBrandCustom(e.target.value)}
                      placeholder="اسم الشركة"
                      className={`${iCls('brand')} mt-1.5`}
                    />
                  )}
                </div>
                <div>
                  <label className={lReq}>الفئة *</label>
                  {isOtherBrand ? (
                    <input
                      value={catSel}
                      onChange={(e) => setCatSel(e.target.value)}
                      placeholder="مثال: iPhone"
                      className={iCls('cat')}
                    />
                  ) : (
                    <select
                      value={catSel}
                      onChange={(e) => handleCatChange(e.target.value)}
                      className={brandSel ? sCls('cat') : dCls}
                      disabled={!brandSel}
                    >
                      <option value="">— اختر —</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={lReq}>الموديل *</label>
                  {isOtherBrand || (catSel && modelNames.length === 0) ? (
                    <input
                      value={modelCustom}
                      onChange={(e) => setModelCustom(e.target.value)}
                      placeholder="اكتب الموديل"
                      className={iCls('model')}
                    />
                  ) : (
                    <>
                      <select
                        value={modelSel}
                        onChange={(e) => handleModelChange(e.target.value)}
                        className={catSel ? sCls('model') : dCls}
                        disabled={!catSel}
                      >
                        <option value="">— اختر —</option>
                        {modelNames.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      {isOtherModel && (
                        <input
                          value={modelCustom}
                          onChange={(e) => setModelCustom(e.target.value)}
                          placeholder="اكتب الموديل"
                          className={`${iCls('model')} mt-1.5`}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ─ Color / Storage / Grade ─ */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lReq}>اللون *</label>
                  <select
                    value={colorSel}
                    onChange={(e) => setColorSel(e.target.value)}
                    className={modelSel || isOtherBrand ? sCls('color') : dCls}
                    disabled={!modelSel && !isOtherBrand}
                  >
                    <option value="">— اللون —</option>
                    {availColors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {isOtherColor && (
                    <input
                      value={colorCustom}
                      onChange={(e) => setColorCustom(e.target.value)}
                      placeholder="اكتب اللون"
                      className={`${iCls('color')} mt-1.5`}
                    />
                  )}
                </div>
                <div>
                  <label className={lReq}>السعة *</label>
                  <select
                    value={isOtherStorage ? OTHER : form.storage}
                    onChange={(e) => handleStorageChange(e.target.value)}
                    className={modelSel || isOtherBrand ? sCls('storage') : dCls}
                    disabled={!modelSel && !isOtherBrand}
                  >
                    <option value="">— السعة —</option>
                    {availStorages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {isOtherStorage && (
                    <input
                      value={storageCustom}
                      onChange={(e) => setStorageCustom(e.target.value)}
                      placeholder="مثال: 256GB"
                      className={`${iCls('storage')} mt-1.5`}
                    />
                  )}
                </div>
                <div>
                  <label className={lCls}>الدرجة</label>
                  <select
                    value={form.grade}
                    onChange={(e) => f('grade', e.target.value)}
                    className={iCls()}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ─ IMEI / Battery ─ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lReq}>IMEI *</label>
                  <input
                    value={form.imei}
                    onChange={(e) => f('imei', e.target.value)}
                    placeholder="123456789012345"
                    className={iCls('imei')}
                    inputMode="numeric"
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className={lReq}>نسبة البطارية % *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.battery_health}
                    onChange={(e) =>
                      f(
                        'battery_health',
                        String(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))
                      )
                    }
                    placeholder="85"
                    className={iCls('battery')}
                  />
                  {form.battery_health && (
                    <div className="mt-1.5 h-1 rounded-full bg-surface overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          parseInt(form.battery_health) >= 85
                            ? 'bg-emerald-400'
                            : parseInt(form.battery_health) >= 70
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                        }`}
                        style={{ width: `${form.battery_health}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ─ Divider ─ */}
              <div className="flex items-center gap-3 py-0.5">
                <div className="flex-1 h-px bg-surface" />
                <span className="text-[10px] text-ink/20">بيانات المورد</span>
                <div className="flex-1 h-px bg-surface" />
              </div>

              {/* ─ Supplier Phone lookup ─ */}
              <div>
                <label className={lReq}>
                  رقم هاتف المورد * <span className="text-ink/25">(11 رقم)</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={supplierPhone}
                    onChange={(e) =>
                      setSupplierPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
                    }
                    placeholder="01xxxxxxxxx"
                    className={`${iCls('phone')} pl-10`}
                    inputMode="numeric"
                    maxLength={11}
                    dir="ltr"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {lookingUp ? (
                      <div className="w-3.5 h-3.5 border-2 border-line border-t-ink/50 rounded-full animate-spin" />
                    ) : foundCustomer ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : supplierPhone.length > 0 ? (
                      <XCircle className="w-3.5 h-3.5 text-amber-400/60" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-ink/20" />
                    )}
                  </div>
                </div>

                {/* Found: existing customer card */}
                {foundCustomer && (
                  <div className="mt-2 flex items-center gap-2.5 px-3 py-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-emerald-300 text-sm font-bold">{foundCustomer.name}</p>
                      <p className="text-emerald-400/50 text-[10px]">
                        مسجّل في قاعدة البيانات — سيظهر في كشف حسابه
                      </p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                )}

                {/* New supplier: name field — temporary, not added to customers list */}
                {isNewSupplier && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
                      <Info className="w-3 h-3" /> مورد مؤقت — لن يُضاف لقائمة العملاء (نقدي فقط)
                    </div>
                    <input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="اسم المورد *"
                      className={iCls('supplierName')}
                    />
                  </div>
                )}
              </div>

              {/* ─ ID card upload ─ */}
              <div>
                <label className={lCls}>
                  البطاقة الشخصية <span className="text-ink/20">(اختياري — حتى 2MB)</span>
                </label>
                {!idCardPreview ? (
                  <label className="flex items-center gap-3 p-3 border border-dashed border-line rounded-xl cursor-pointer hover:border-amber-500/25 hover:bg-amber-500/4 transition-all group">
                    <div className="w-8 h-8 rounded-full bg-surface group-hover:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-ink/25 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div>
                      <p className="text-ink/35 text-sm">انقر لرفع صورة البطاقة</p>
                      <p className="text-ink/20 text-[10px]">JPG, PNG, PDF</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleIdFile}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-line bg-surface">
                    {idCardFile?.type.startsWith('image/') ? (
                      <img
                        src={resolveUploadedFileUrl(idCardPreview)}
                        alt="بطاقة شخصية"
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        <FileText className="w-7 h-7 text-ink/40" />
                        <div>
                          <p className="text-ink/70 text-sm font-medium">{idCardFile?.name}</p>
                          <p className="text-ink/30 text-xs">
                            {((idCardFile?.size ?? 0) / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setIdCardPreview('');
                        setIdCardFile(null);
                      }}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500/60 transition-colors"
                    >
                      <X className="w-3 h-3 text-ink" />
                    </button>
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-[10px] text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> تم الرفع
                    </div>
                  </div>
                )}
              </div>

              {/* ─ Documents / Condition Notes ─ */}
              <div>
                <label className={lCls}>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-ink/30" />
                    المستندات وحالة الجهاز
                    <span className="text-ink/20">(اختياري — يُحفظ كمرجع دائم)</span>
                  </span>
                </label>
                <textarea
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                  placeholder={
                    'مثال: الجهاز يعمل بشكل طبيعي، شاشة سليمة، بدون كسور\nرقم بطاقة البائع: 123456789\nالجهاز مفتوح من البائع ولم يُعاد تهيئته...'
                  }
                  rows={4}
                  className="erp-input w-full text-sm resize-none leading-relaxed"
                />
                <p className="text-[10px] text-ink/20 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  يظهر في تبويب "المصدر" بصفحة الجهاز — مرجع دائم في حالة وجود نزاع لاحقاً
                </p>
              </div>
            </>
          )}

          {/* ══════════ STEP 2: Pricing + Payment ══════════ */}
          {step === 2 && (
            <>
              {/* Device summary pill */}
              <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-line">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink text-sm">
                    {effectiveBrand} {effectiveModel}
                  </p>
                  <p className="text-[11px] text-ink/30">
                    {finalStorage && <span>{finalStorage}</span>}
                    {effectiveColor && <span> · {effectiveColor}</span>}
                    {form.imei && <span className="font-mono"> · {maskImei(form.imei)}</span>}
                    {foundCustomer && (
                      <span className="text-emerald-400/70"> · {foundCustomer.name}</span>
                    )}
                    {isNewSupplier && supplierName && (
                      <span className="text-amber-400/70"> · {supplierName}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-[10px] text-ink/40 hover:text-ink flex items-center gap-1 px-2 py-1 rounded-lg border border-line hover:border-line/60 transition-all shrink-0"
                >
                  تعديل
                </button>
              </div>

              {/* Prices row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lReq}>سعر الشراء *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={fin.purchase_price}
                      onChange={(e) => fp('purchase_price', e.target.value)}
                      placeholder="0"
                      className={`${iCls('purchase_price')} pl-12`}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-ink/30 font-mono">
                      EGP
                    </span>
                  </div>
                </div>
                <div>
                  <label className={lCls}>سعر البيع المقترح</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={fin.sale_price}
                      onChange={(e) => fp('sale_price', e.target.value)}
                      placeholder="0"
                      className={`${iCls()} pl-12`}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-ink/30 font-mono">
                      EGP
                    </span>
                  </div>
                  {fin.purchase_price &&
                    fin.sale_price &&
                    parseFloat(fin.sale_price) > parseFloat(fin.purchase_price) && (
                      <p className="text-[10px] text-emerald-400/70 mt-1">
                        هامش ربح:{' '}
                        {(
                          parseFloat(fin.sale_price) - parseFloat(fin.purchase_price)
                        ).toLocaleString('ar-EG')}{' '}
                        ج
                      </p>
                    )}
                </div>
              </div>

              {/* Warehouse */}
              <div>
                <label className={lReq}>المخزن *</label>
                <select
                  value={fin.warehouse_id}
                  onChange={(e) => fp('warehouse_id', e.target.value)}
                  className={sCls('warehouse_id')}
                >
                  <option value="">— اختر المخزن —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {warehouses.length === 0 && (
                  <p className="text-[10px] text-amber-400/60 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" /> لا يوجد مخزن — أضف مخزناً من إعدادات النظام
                  </p>
                )}
              </div>

              {/* Payment type */}
              <div>
                <label className={lCls}>طريقة الدفع</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'credit', 'partial'] as const).map((pt) => {
                    const disabled = isNewSupplier && pt !== 'cash';
                    return (
                      <button
                        key={pt}
                        onClick={() => !disabled && fp('payment_type', pt)}
                        disabled={disabled}
                        className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                          fin.payment_type === pt
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : disabled
                              ? 'border-line text-ink/15 cursor-not-allowed'
                              : 'border-line text-ink/40 hover:border-amber-500/25 hover:text-ink/70'
                        }`}
                      >
                        {PAYMENT_LABELS[pt]}
                      </button>
                    );
                  })}
                </div>
                {isNewSupplier && (
                  <p className="text-[10px] text-amber-400/50 mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" /> مورد مؤقت غير مسجّل — نقدي فقط
                  </p>
                )}
              </div>

              {/* Safe selector (not for full credit) */}
              {fin.payment_type !== 'credit' && (
                <div>
                  <label className={lReq}>الخزينة *</label>
                  <select
                    value={fin.safe_id}
                    onChange={(e) => fp('safe_id', e.target.value)}
                    className={sCls('safe_id')}
                  >
                    <option value="">— اختر الخزينة —</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {parseFloat(s.balance).toLocaleString('ar-EG')} ج
                      </option>
                    ))}
                  </select>
                  {safes.length === 0 && (
                    <p className="text-[10px] text-amber-400/60 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" /> لا يوجد خزينة — أضف خزينة من إعدادات النظام
                    </p>
                  )}
                </div>
              )}

              {/* Partial: paid amount */}
              {fin.payment_type === 'partial' && (
                <div>
                  <label className={lReq}>المبلغ المدفوع الآن *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={fin.paid_amount}
                      onChange={(e) => fp('paid_amount', e.target.value)}
                      placeholder="0"
                      className={`${iCls('paid_amount')} pl-12`}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-ink/30 font-mono">
                      EGP
                    </span>
                  </div>
                  {fin.purchase_price && fin.paid_amount && (
                    <p className="text-[10px] text-amber-400/70 mt-1">
                      المتبقي:{' '}
                      {(
                        parseFloat(fin.purchase_price) - parseFloat(fin.paid_amount)
                      ).toLocaleString('ar-EG')}{' '}
                      ج{foundCustomer && ' — سيُضاف لكشف حساب المورد'}
                    </p>
                  )}
                </div>
              )}

              {/* Credit summary */}
              {fin.payment_type === 'credit' && foundCustomer && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-500/6 border border-amber-500/20 rounded-xl">
                  <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-amber-300/70 leading-relaxed">
                    سيُضاف المبلغ كاملاً (
                    {fin.purchase_price ? Number(fin.purchase_price).toLocaleString('ar-EG') : 0} ج)
                    إلى ذمة <span className="text-amber-300 font-bold">{foundCustomer.name}</span>{' '}
                    في كشف الحساب
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-line shrink-0 flex gap-2 justify-between">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl border border-line text-ink/50 text-sm hover:text-ink/80 transition-all flex items-center gap-1.5"
            >
              ← السابق
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-line text-ink/50 text-sm hover:text-ink/80 transition-all"
            >
              إلغاء
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={handleNext}
              disabled={lookingUp}
              className="px-6 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {lookingUp ? (
                <div className="w-3.5 h-3.5 border-2 border-line border-t-ink/60 rounded-full animate-spin" />
              ) : null}
              التالي ←
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="erp-btn erp-btn-secondary flex items-center gap-2"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-line border-t-ink/60 rounded-full animate-spin" />
              ) : (
                <ShoppingCart className="w-3.5 h-3.5" />
              )}
              حفظ وشراء
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
