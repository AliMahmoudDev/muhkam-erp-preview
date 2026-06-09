/**
 * RepairExtensions.tsx — New UI components for Repairs Module Phase 4
 *
 * Components:
 *  - DeliveryPaymentSection    (delivery modal payment fields)
 *  - TechnicianSelector        (reusable technician picker)
 *  - QAReportFields            (qa_report + qa_inspector_name inputs)
 *  - DevicePhotosSection       (photo upload + thumbnail preview)
 *  - TechnicianReceiptLine     (technician dropdown per receipt line)
 *  - RepairLabelSettings       (invoice size + show/hide toggles)
 */
import { type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, User, DollarSign, CreditCard, Banknote } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';

/* ═══════════════════════════════════════════════════════════
   DeliveryPaymentSection — radio (نقدي | آجل | تحويل فوري) + safe selector
   ═══════════════════════════════════════════════════════════ */
interface DeliveryPaymentProps {
  value: { payment_type: string; safe_id: number | null };
  onChange: (v: { payment_type: string; safe_id: number | null }) => void;
  safes: Array<{ id: number; name: string }>;
}

export function DeliveryPaymentSection({ value, onChange, safes }: DeliveryPaymentProps) {
  const options = [
    { key: 'cash', label: 'نقدي', icon: Banknote },
    { key: 'deferred', label: 'آجل', icon: CreditCard },
    { key: 'instant_transfer', label: 'تحويل فوري', icon: DollarSign },
  ];

  const showSafe = value.payment_type === 'cash' || value.payment_type === 'instant_transfer';

  return (
    <div className="space-y-3">
      <label className="text-xs text-white/50 font-bold">طريقة الدفع عند التسليم</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = value.payment_type === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange({ ...value, payment_type: opt.key })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition-all ${
                active
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-white/[0.03] border-white/10 text-white/40 hover:text-white/60'
              }`}
            >
              <Icon size={16} />
              {opt.label}
            </button>
          );
        })}
      </div>
      {showSafe && (
        <div>
          <label className="text-[11px] text-white/40 mb-1 block">الخزنة</label>
          <select
            value={value.safe_id ?? ''}
            onChange={(e) =>
              onChange({ ...value, safe_id: e.target.value ? Number(e.target.value) : null })
            }
            className="erp-input w-full text-sm"
          >
            <option value="">— اختر خزنة —</option>
            {safes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TechnicianSelector — reusable employee dropdown for technician
   ═══════════════════════════════════════════════════════════ */
interface TechnicianSelectorProps {
  label?: string;
  value: number | null;
  onChange: (id: number | null) => void;
  technicians: Array<{ id: number; name: string }>;
  className?: string;
}

export function TechnicianSelector({
  label,
  value,
  onChange,
  technicians,
  className,
}: TechnicianSelectorProps) {
  return (
    <div className={className}>
      {label && <label className="text-[11px] text-white/40 mb-1 block">{label}</label>}
      <div className="relative">
        <User
          size={12}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
        />
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="erp-input w-full pr-8 text-sm"
        >
          <option value="">— بدون تعيين —</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QAReportFields — qa_report textarea + qa_inspector_name input
   ═══════════════════════════════════════════════════════════ */
interface QAReportFieldsProps {
  qaReport: string;
  inspectorName: string;
  onChangeReport: (v: string) => void;
  onChangeInspector: (v: string) => void;
}

export function QAReportFields({
  qaReport,
  inspectorName,
  onChangeReport,
  onChangeInspector,
}: QAReportFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] text-white/40 mb-1 block">تقرير مراقبة الجودة</label>
        <textarea
          value={qaReport}
          onChange={(e) => onChangeReport(e.target.value)}
          placeholder="اكتب ملاحظات الجودة والفحص هنا..."
          rows={3}
          className="erp-input w-full text-sm resize-none"
        />
      </div>
      <div>
        <label className="text-[11px] text-white/40 mb-1 block">اسم فاحص الجودة</label>
        <input
          type="text"
          value={inspectorName}
          onChange={(e) => onChangeInspector(e.target.value)}
          placeholder="اسم المسؤول عن الفحص"
          className="erp-input w-full text-sm"
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DevicePhotosSection — upload + thumbnail grid
   ═══════════════════════════════════════════════════════════ */
interface DevicePhoto {
  id: number;
  photo_url: string;
  photo_type: string;
  uploaded_at: string;
}

interface DevicePhotosSectionProps {
  jobId: number;
  photoType?: 'intake' | 'delivery';
}

export function DevicePhotosSection({ jobId, photoType = 'intake' }: DevicePhotosSectionProps) {
  const qc = useQueryClient();

  const { data: photos = [] } = useQuery<DevicePhoto[]>({
    queryKey: ['/api/repair-jobs', jobId, 'photos'],
    queryFn: async () => {
      const r = await authFetch(api(`/api/repair-jobs/${jobId}/photos`));
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!jobId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('category', 'repairs');

      const uploadRes = await authFetch(api('/api/uploads'), {
        method: 'POST',
        body: form,
      });

      if (!uploadRes.ok) {
        let message = 'فشل رفع الصورة';
        try {
          const body = await uploadRes.json();
          if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      const uploaded = (await uploadRes.json()) as { url: string };

      const r = await authFetch(api(`/api/repair-jobs/${jobId}/photos`), {
        method: 'POST',
        body: JSON.stringify({ photo_url: uploaded.url, photo_type: photoType }),
      });

      if (!r.ok) {
        let message = 'فشل حفظ الصورة في بطاقة الصيانة';
        try {
          const body = await r.json();
          if (body?.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/repair-jobs', jobId, 'photos'] });
    },
  });

  const filtered = photos.filter((p) => p.photo_type === photoType);
  const inputId = `repair-photo-${jobId}-${photoType}`;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadMutation.mutate(file);
  };

  const resolvePhotoSrc = (photoUrl: string) =>
    photoUrl.startsWith('/api/') ? api(photoUrl) : photoUrl;

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-white/40 font-bold flex items-center gap-1">
        <Camera size={11} />
        صور الجهاز ({photoType === 'intake' ? 'الاستلام' : 'التسليم'})
      </label>

      {/* Thumbnail grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((p) => (
            <img
              key={p.id}
              src={resolvePhotoSrc(p.photo_url)}
              alt=""
              className="w-full h-16 object-cover rounded-lg border border-white/10"
            />
          ))}
        </div>
      )}

      {/* Upload photo */}
      <div className="flex gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
        />
        <label
          htmlFor={inputId}
          className={`erp-btn erp-btn-primary text-xs px-3 flex items-center gap-1 cursor-pointer ${uploadMutation.isPending ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <Upload size={11} />
          {uploadMutation.isPending ? 'جاري الرفع...' : 'رفع صورة'}
        </label>
      </div>

      {uploadMutation.isError && (
        <p className="text-[11px] text-red-300">
          {(uploadMutation.error as Error)?.message || 'فشل رفع الصورة'}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TechnicianReceiptLine — small technician dropdown for receipt items
   ═══════════════════════════════════════════════════════════ */
interface TechReceiptLineProps {
  technicianId: number | null;
  onChange: (id: number | null) => void;
  technicians: Array<{ id: number; name: string }>;
}

export function TechnicianReceiptLine({
  technicianId,
  onChange,
  technicians,
}: TechReceiptLineProps) {
  return (
    <select
      value={technicianId ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="erp-input text-[10px] py-0.5 px-1.5 w-24"
    >
      <option value="">— فني —</option>
      {technicians.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/* ═══════════════════════════════════════════════════════════
   RepairLabelSettings — invoice size + show/hide toggles
   ═══════════════════════════════════════════════════════════ */
interface LabelSettingsProps {
  settings: Record<string, string>;
  onSave: (key: string, value: string) => void;
}

export function RepairLabelSettings({ settings, onSave }: LabelSettingsProps) {
  const invoiceSize = settings['repair_invoice_size'] ?? 'A4';
  const showQA = settings['repair_show_qa'] !== 'false';
  const showPhotos = settings['repair_show_photos'] !== 'false';
  const showTechnician = settings['repair_show_technician'] !== 'false';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white/80">إعدادات طباعة الصيانة</h3>

      <div>
        <label className="text-[11px] text-white/40 mb-1 block">حجم الفاتورة</label>
        <select
          value={invoiceSize}
          onChange={(e) => onSave('repair_invoice_size', e.target.value)}
          className="erp-input text-sm w-full"
        >
          <option value="A4">A4</option>
          <option value="A5">A5</option>
          <option value="thermal">حراري (80mm)</option>
          <option value="thermal_58">حراري (58mm)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] text-white/40">إظهار / إخفاء الحقول</label>
        {[
          { key: 'repair_show_qa', label: 'تقرير الجودة', checked: showQA },
          { key: 'repair_show_photos', label: 'صور الجهاز', checked: showPhotos },
          { key: 'repair_show_technician', label: 'اسم الفني', checked: showTechnician },
        ].map((toggle) => (
          <label key={toggle.key} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={toggle.checked}
              onChange={(e) => onSave(toggle.key, e.target.checked ? 'true' : 'false')}
              className="accent-amber-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
              {toggle.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
