/**
 * FinalInvoiceModal — بوّابة "جاهز للتسليم" → "التسليم"
 *
 * يجمع بين:
 *  - عرض الفاتورة النهائية للعميل (بنود الخدمة فقط — لا تكاليف مخزن داخلية)
 *  - حقل تكلفة الشحن + اختيار الخزنة
 *  - حقل خصم نهائي على الإجمالي
 *  - زرّا طباعة وإرسال واتساب
 *  - زر تأكيد: يحفظ الشحن + الخصم ثم ينقل البطاقة لـ "التسليم"
 *
 * ملاحظة: تكلفة المخزن وتكلفة القطع الداخلية مخفية عن العميل —
 * المبالغ المعروضة مأخوذة من repair_job_services.amount فقط.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/format';
import {
  FileText,
  Printer,
  MessageCircle,
  Loader2,
  X,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Save,
  Package,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { safeArray } from '@/lib/safe-data';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';

interface ServiceLine {
  id: number;
  service_type_name_snapshot: string;
  amount: string | number;
  linked_parts?: Array<{ id: number; product_name: string }>;
}

interface ReceiptData {
  job_no: string;
  customer_name: string | null;
  customer_phone: string | null;
  device_brand: string | null;
  device_model: string | null;
  imei: string | null;
  serial_no: string | null;
  color: string | null;
  storage: string | null;
  received_at: string | null;
  problem_description: string | null;
  technician_name: string | null;
  deposit_paid: number;
  shipping_cost: number;
  final_discount: number;
}

interface JobLite {
  id: number;
  job_no: string;
  shipping_cost?: string | number | null;
}
interface SafeRow {
  id: number;
  name: string;
  balance: string | number;
}

interface Props {
  job: JobLite;
  onClose: () => void;
  onSaved: () => void;
}

const fmt = (n: number) => formatCurrency(Number(n ?? 0));

export default function FinalInvoiceModal({ job, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: safesRaw } = useGetSettingsSafes();
  const allSafes: SafeRow[] = safeArray(safesRaw) as SafeRow[];

  const isScopedRole = user?.role === 'cashier' || user?.role === 'salesperson';
  const safes =
    isScopedRole && user?.safe_id ? allSafes.filter((s) => s.id === user.safe_id) : allSafes;

  const [data, setData] = useState<ReceiptData | null>(null);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState('');

  const [cost, setCost] = useState<string>(String(job.shipping_cost ?? '0'));
  const [safeId, setSafeId] = useState<string>('');
  const [discount, setDiscount] = useState<string>('0');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (safes.length === 1 && !safeId) setSafeId(String(safes[0].id));
  }, [safes.length]);

  /* جلب بيانات الإيصال + بنود الخدمة معاً */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authFetch(api(`/api/repair-jobs/${job.id}/receipt-data`)).then(async (r) => {
        if (!r.ok)
          throw new Error(
            ((await r.json()) as { error?: string }).error ?? 'تعذّر تحميل بيانات الإيصال'
          );
        return r.json() as Promise<ReceiptData>;
      }),
      authFetch(api(`/api/repair-jobs/${job.id}/services`)).then((r) =>
        r.ok ? (r.json() as Promise<ServiceLine[]>) : Promise.resolve([] as ServiceLine[])
      ),
    ])
      .then(([d, svs]) => {
        if (cancelled) return;
        setData(d);
        setServiceLines(Array.isArray(svs) ? svs : []);
        if (d.final_discount > 0) setDiscount(String(d.final_discount));
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setFetchErr(e instanceof Error ? e.message : 'خطأ');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  /* حسابات الإجمالي — المبلغ المعروض للعميل من repair_job_services.amount فقط */
  function computeTotals() {
    const svTotal = serviceLines.reduce((s, sv) => s + Number(sv.amount ?? 0), 0);
    const sc = Math.max(Number(cost) || 0, 0);
    const disc = Math.max(Number(discount) || 0, 0);
    const dep = data?.deposit_paid ?? 0;
    const sub = svTotal + sc;
    const total = Math.max(sub - disc, 0);
    const remaining = Math.max(total - dep, 0);
    return { svTotal, sc, disc, dep, sub, total, remaining };
  }

  const numericCost = Number(cost);
  const needsSafe = Number.isFinite(numericCost) && numericCost > 0;

  /* ── طباعة ── */
  function handlePrint() {
    if (!data) return;
    const { svTotal, sc, disc, dep, total, remaining } = computeTotals();
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const deviceLine =
      [data.device_brand, data.device_model].filter(Boolean).map(esc).join(' ') || '—';

    const serviceRowsHtml = serviceLines
      .map((sv, idx) => {
        const parts = (sv.linked_parts ?? []).map((p) => esc(p.product_name)).join(' • ');
        const partCell = parts
          ? `<div style="font-size:9px;color:#666;margin-top:1px;">${parts}</div>`
          : '';
        return `<tr>
        <td>${idx + 1}</td>
        <td>${esc(sv.service_type_name_snapshot || 'خدمة')}${partCell}</td>
        <td style="text-align:center;font-weight:bold;">${esc(fmt(Number(sv.amount ?? 0)))}</td>
      </tr>`;
      })
      .join('');

    const html = `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>فاتورة تسليم ${esc(data.job_no)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  body{font-family:'Cairo','Tahoma','Segoe UI',sans-serif;padding:8px;font-size:11px;color:#000;max-width:80mm;margin:0 auto;}
  h1{text-align:center;font-size:13px;margin:6px 0;border-bottom:1px dashed #000;padding-bottom:4px;}
  .row{display:flex;justify-content:space-between;margin:2px 0;}
  .label{color:#555;}
  table{width:100%;border-collapse:collapse;margin:6px 0;}
  th,td{padding:3px 4px;border-bottom:1px dotted #ccc;text-align:right;font-size:10px;}
  th{background:#f5f5f5;font-weight:bold;}
  .totals{margin-top:6px;padding-top:4px;border-top:1px dashed #000;}
  .grand{font-weight:bold;font-size:12px;}
  .discount{color:#c00;}
  .footer{text-align:center;margin-top:8px;color:#666;font-size:10px;border-top:1px dashed #000;padding-top:4px;}
  @media print{@page{size:80mm auto;margin:4mm;}body{padding:0;}}
</style></head><body>
<h1>فاتورة تسليم بطاقة صيانة</h1>
<div class="row"><span class="label">رقم البطاقة:</span><strong>${esc(data.job_no)}</strong></div>
<div class="row"><span class="label">العميل:</span><span>${esc(data.customer_name ?? '—')}</span></div>
<div class="row"><span class="label">الهاتف:</span><span>${esc(data.customer_phone ?? '—')}</span></div>
<div class="row"><span class="label">الجهاز:</span><span>${deviceLine}</span></div>
${data.imei ? `<div class="row"><span class="label">IMEI:</span><span>${esc(data.imei)}</span></div>` : ''}
${data.received_at ? `<div class="row"><span class="label">تاريخ الاستلام:</span><span>${esc(data.received_at)}</span></div>` : ''}
<div class="row"><span class="label">تاريخ التسليم:</span><span>${esc(new Date().toLocaleDateString('ar-EG'))}</span></div>
${data.technician_name ? `<div class="row"><span class="label">الفني:</span><span>${esc(data.technician_name)}</span></div>` : ''}
${data.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(data.problem_description)}</div>` : ''}
${
  serviceLines.length > 0
    ? `
<table>
  <thead><tr><th>#</th><th>الخدمة</th><th>المبلغ</th></tr></thead>
  <tbody>${serviceRowsHtml}</tbody>
</table>`
    : ''
}
<div class="totals">
  ${svTotal > 0 ? `<div class="row"><span class="label">مجموع الخدمات:</span><span>${esc(fmt(svTotal))}</span></div>` : ''}
  ${sc > 0 ? `<div class="row"><span class="label">الشحن:</span><span>${esc(fmt(sc))}</span></div>` : ''}
  ${disc > 0 ? `<div class="row discount"><span>خصم:</span><span>- ${esc(fmt(disc))}</span></div>` : ''}
  <div class="row grand"><span>الإجمالي:</span><span>${esc(fmt(total))}</span></div>
  <div class="row"><span class="label">المدفوع مقدماً:</span><span>${esc(fmt(dep))}</span></div>
  <div class="row grand"><span>المتبقي:</span><span>${esc(fmt(remaining))}</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — مع تحيات إدارة الصيانة</div>
<script>window.addEventListener('load',()=>{window.print();setTimeout(()=>window.close(),1000);});</script>
</body></html>`;
    const _blob = new Blob([html], { type: 'text/html' });
    const _url = URL.createObjectURL(_blob);
    const w = window.open(_url, '_blank', 'width=400,height=700');
    if (!w) {
      URL.revokeObjectURL(_url);
      toast({
        title: 'تعذّر فتح نافذة الطباعة',
        description: 'تأكد من السماح للنوافذ المنبثقة',
        variant: 'destructive',
      });
      return;
    }
    setTimeout(() => URL.revokeObjectURL(_url), 2000);
    toast({ title: 'جارٍ تجهيز الطباعة...' });
  }

  /* ── واتساب ── */
  function handleWhatsapp() {
    if (!data?.customer_phone) {
      toast({ title: 'لا يوجد رقم هاتف للعميل', variant: 'destructive' });
      return;
    }
    const { svTotal, sc, disc, dep, total, remaining } = computeTotals();
    const serviceText = serviceLines
      .map((sv) => {
        const parts = (sv.linked_parts ?? []).map((p) => p.product_name).join(', ');
        const partsNote = parts ? ` (${parts})` : '';
        return `• ${sv.service_type_name_snapshot || 'خدمة'}${partsNote}: ${fmt(Number(sv.amount ?? 0))}`;
      })
      .join('\n');
    const lines = [
      `*فاتورة تسليم بطاقة صيانة*`,
      `رقم البطاقة: ${data.job_no}`,
      `العميل: ${data.customer_name ?? '—'}`,
      `الجهاز: ${[data.device_brand, data.device_model].filter(Boolean).join(' ') || '—'}`,
      data.problem_description ? `المشكلة: ${data.problem_description}` : '',
      ``,
      serviceLines.length > 0 ? `*بنود الخدمة:*\n${serviceText}` : '',
      ``,
      svTotal > 0 ? `مجموع الخدمات: ${fmt(svTotal)}` : '',
      sc > 0 ? `الشحن: ${fmt(sc)}` : '',
      disc > 0 ? `خصم: - ${fmt(disc)}` : '',
      `الإجمالي: ${fmt(total)}`,
      `المدفوع مقدماً: ${fmt(dep)}`,
      `*المتبقي: ${fmt(remaining)} ج.م*`,
      ``,
      `شكراً لتعاملكم معنا 🙏`,
    ]
      .filter(Boolean)
      .join('\n');
    const cleanPhone = String(data.customer_phone).replace(/[^\d]/g, '');
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`,
      '_blank',
      'noopener,noreferrer'
    );
    toast({ title: 'تم فتح واتساب' });
  }

  /* ── حفظ الفاتورة بدون تأكيد تسليم ── */
  async function handleSave() {
    const numCost = Number(cost);
    const numDisc = Number(discount);
    if (!Number.isFinite(numCost) || numCost < 0) {
      setErrors(['تكلفة الشحن غير صحيحة']);
      return;
    }
    if (!Number.isFinite(numDisc) || numDisc < 0) {
      setErrors(['قيمة الخصم غير صحيحة']);
      return;
    }
    if (numCost > 0 && !safeId) {
      setErrors(['يجب اختيار خزنة لخصم تكلفة الشحن منها']);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/shipping`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_cost: numCost,
          safe_id: numCost > 0 ? Number(safeId) : null,
          final_discount: numDisc,
          save_only: true,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrors([body.error ?? 'تعذّر حفظ البيانات']);
        setSaving(false);
        return;
      }
      toast({ title: '✓ تم حفظ الفاتورة' });
      setSaving(false);
    } catch {
      setErrors(['تعذّر الاتصال بالخادم']);
      setSaving(false);
    }
  }

  /* ── تأكيد التسليم ── */
  async function handleConfirm() {
    const numCost = Number(cost);
    const numDisc = Number(discount);

    if (!Number.isFinite(numCost) || numCost < 0) {
      setErrors(['تكلفة الشحن غير صحيحة']);
      return;
    }
    if (!Number.isFinite(numDisc) || numDisc < 0) {
      setErrors(['قيمة الخصم غير صحيحة']);
      return;
    }
    if (numCost > 0 && !safeId) {
      setErrors(['يجب اختيار خزنة لخصم تكلفة الشحن منها']);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/shipping`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_cost: numCost,
          safe_id: numCost > 0 ? Number(safeId) : null,
          final_discount: numDisc,
          notes: `تسليم بطاقة صيانة ${job.job_no}`,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrors([body.error ?? 'تعذّر حفظ البيانات']);
        setSaving(false);
        return;
      }
      toast({ title: 'تم تسجيل الفاتورة', description: 'جارٍ الانتقال إلى مرحلة التسليم...' });
      onSaved();
    } catch {
      setErrors(['تعذّر الاتصال بالخادم']);
      setSaving(false);
    }
  }

  const { svTotal, sc, disc, dep, total, remaining } = computeTotals();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="my-4 rounded-2xl border border-line w-full max-w-lg shadow-2xl"
        style={{ background: 'rgba(15,12,30,0.97)', backdropFilter: 'blur(20px)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">الفاتورة النهائية</h3>
              <p className="text-[11px] text-ink/50">
                البطاقة <span className="text-ink font-bold">{job.job_no}</span> — طباعة + إرسال +
                تأكيد التسليم
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── Loading / Error ── */}
          {loading && (
            <div className="flex items-center gap-2 text-ink/60 text-xs justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل بيانات الفاتورة...
            </div>
          )}
          {fetchErr && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300">{fetchErr}</p>
            </div>
          )}

          {/* ── Invoice preview ── */}
          {data && (
            <div
              className="rounded-xl border border-line p-4 text-[11px] space-y-1.5"
              style={{ background: 'var(--surface)' }}
            >
              {/* بيانات العميل والجهاز */}
              <div className="flex justify-between">
                <span className="text-ink/50">رقم البطاقة:</span>
                <span className="font-bold text-ink">{data.job_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">العميل:</span>
                <span className="text-ink">{data.customer_name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">الهاتف:</span>
                <span className="text-ink">{data.customer_phone ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/50">الجهاز:</span>
                <span className="text-ink">
                  {[data.device_brand, data.device_model].filter(Boolean).join(' ') || '—'}
                </span>
              </div>
              {data.imei && (
                <div className="flex justify-between">
                  <span className="text-ink/50">IMEI:</span>
                  <span className="text-ink font-mono">{data.imei}</span>
                </div>
              )}

              {/* ── بنود الخدمة للعميل (amount من repair_job_services) ── */}
              {serviceLines.length > 0 && (
                <div className="mt-2 pt-2 border-t border-line space-y-1.5">
                  <p className="text-[10px] font-bold text-emerald-300/70 mb-1">بنود الخدمة:</p>
                  {serviceLines.map((sv, idx) => {
                    const parts = sv.linked_parts ?? [];
                    return (
                      <div
                        key={sv.id}
                        className="rounded-lg p-2"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--edge)',
                        }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-ink/85 font-medium">
                              {idx + 1}. {sv.service_type_name_snapshot || 'خدمة'}
                            </span>
                            {parts.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {parts.map((p) => (
                                  <span
                                    key={p.id}
                                    className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/70"
                                  >
                                    <Package className="w-2 h-2 shrink-0" />
                                    {p.product_name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 font-bold text-emerald-300 tabular-nums">
                            {fmt(Number(sv.amount ?? 0))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── إجماليات (تحديث فوري) ── */}
              <div className="mt-2 pt-2 border-t border-line space-y-1">
                {svTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink/50">مجموع الخدمات:</span>
                    <span className="text-ink">{fmt(svTotal)}</span>
                  </div>
                )}
                {sc > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink/50">الشحن:</span>
                    <span className="text-ink">{fmt(sc)}</span>
                  </div>
                )}
                {disc > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>خصم نهائي:</span>
                    <span>- {fmt(disc)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-ink pt-1 border-t border-line">
                  <span>الإجمالي:</span>
                  <span>{fmt(total)}</span>
                </div>
                <div className="flex justify-between text-emerald-300">
                  <span>المدفوع:</span>
                  <span>{fmt(dep)}</span>
                </div>
                <div className="flex justify-between font-black text-amber-300 text-[12px]">
                  <span>المتبقي:</span>
                  <span>{fmt(remaining)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Shipping cost ── */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-ink/55 mb-1">
                <Truck className="w-3 h-3 inline ml-1" />
                تكلفة الشحن (ج.م) — اترك 0 إن لم يكن هناك شحن
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-sm text-ink focus:outline-none focus:border-sky-400/40"
                placeholder="0.00"
              />
            </div>

            {needsSafe && (
              <div>
                <label className="block text-[10px] font-bold text-ink/55 mb-1">
                  الخزنة (لخصم تكلفة الشحن)
                </label>
                <Combobox
                  options={[
                    { value: '', label: '— اختر الخزنة —' },
                    ...safes.map((s) => ({ value: String(s.id), label: `${s.name} — رصيد: ${Number(s.balance).toFixed(2)}` })),
                  ]}
                  value={safeId}
                  onChange={(v) => setSafeId(v)}
                  className="w-full text-[11px]"
                  searchable={false}
                />
              </div>
            )}

            {/* ── Discount ── */}
            <div>
              <label className="block text-[10px] font-bold text-ink/55 mb-1">
                خصم نهائي على الإجمالي (ج.م) — اترك 0 إن لم يكن هناك خصم
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-red-400/20 text-sm text-ink focus:outline-none focus:border-red-400/40"
                placeholder="0.00"
              />
              {disc > 0 && (
                <p className="text-[10px] text-red-400/80 mt-1">
                  سيتم تطبيق خصم {fmt(disc)} ج.م على إجمالي الفاتورة
                </p>
              )}
            </div>
          </div>

          {/* ── Errors ── */}
          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <p className="text-[11px] font-bold text-red-400">خطأ:</p>
              </div>
              <ul className="list-disc list-inside">
                {errors.map((e, i) => (
                  <li key={i} className="text-[11px] text-red-300">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-line">
          <div className="flex items-center gap-2">
            {/* حفظ */}
            <button
              onClick={handleSave}
              disabled={saving || !data}
              className="flex-1 py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(59,130,246,0.7)',
                border: '1px solid rgba(96,165,250,0.4)',
              }}
            >
              <Save className="w-3.5 h-3.5" /> حفظ
            </button>
            {/* طباعة */}
            <button
              onClick={handlePrint}
              disabled={!data}
              className="flex-1 py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(59,130,246,0.7)',
                border: '1px solid rgba(96,165,250,0.4)',
              }}
            >
              <Printer className="w-3.5 h-3.5" /> طباعة
            </button>
            {/* واتساب */}
            <button
              onClick={handleWhatsapp}
              disabled={!data || !data.customer_phone}
              className="flex-1 py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(34,197,94,0.7)',
                border: '1px solid rgba(74,222,128,0.4)',
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" /> واتساب
            </button>
            {/* تأكيد التسليم */}
            <button
              onClick={handleConfirm}
              disabled={saving || !data}
              className="flex-1 py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(16,185,129,0.75)',
                border: '1px solid rgba(52,211,153,0.45)',
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> تسليم
                </>
              )}
            </button>
            {/* إلغاء — نص فقط */}
            <button
              onClick={onClose}
              className="px-3 py-2.5 text-ink/50 hover:text-ink text-xs transition-colors shrink-0"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
