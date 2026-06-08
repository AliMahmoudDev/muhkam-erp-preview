import { useState, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useWarehouses } from '@/hooks/useWarehouses';
import { safeArray } from '@/lib/safe-data';
import {
  ChevronLeft, Printer, Send, CheckCheck, Trash2, Smartphone, Phone,
  ClipboardList, Plus, Save, History, ChevronRight, Package,
} from 'lucide-react';
import { JobServicesSection } from './JobServicesSection';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import RepairPipeline from '@/components/RepairPipeline';
import {
  RepairJob, ChecklistItem,
  useAccessoriesList, useRepairSettings,
  STATUS_MAP,
} from './repairConstants';
import { ScoreRing, StatusBadge } from './repairComponents';
import { JobChecklist } from './ChecklistComponents';
import { REPAIR_SETTING_KEYS } from '@/components/RepairSettingsModal';

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-white/30 text-[10px]">{label}: </span>
      <span className={`text-white/80 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function JobDetail({
  job, checklist, score, users,
  onClose, onPatch, onDelete, onSaveCheckItem,
  onWhatsApp, whatsAppReady, whatsAppProgress,
}: {
  job: RepairJob;
  checklist: ChecklistItem[];
  score: number;
  users: { id: number; name: string }[];
  onClose: () => void;
  onPatch: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onSaveCheckItem: (id: string, status: ChecklistItem['status'], notes: string) => void;
  onWhatsApp: (job: RepairJob, msg: string) => void;
  whatsAppReady: (job: RepairJob) => string;
  whatsAppProgress: (job: RepairJob) => string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const accessoriesList = useAccessoriesList();
  const repairSettings  = useRepairSettings();
  const qrBaseUrlSetting = repairSettings[REPAIR_SETTING_KEYS.qrBaseUrl] ?? '';
  const [editEst, setEditEst]       = useState(job.estimated_cost ?? '0');
  const [editFinal, setEditFinal]   = useState(job.final_cost ?? '0');
  const [editDeposit] = useState(job.deposit_paid ?? '0');
  const [editDelivery, setEditDelivery] = useState(job.estimated_delivery ?? '');
  const [editTech, setEditTech]     = useState(job.technician_id?.toString() ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportOpen, setReportOpen]       = useState(true);
  const [historyOpen, setHistoryOpen]     = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newReportText, setNewReportText] = useState('');
  const [addingReport, setAddingReport]   = useState(false);

  /* ── إجمالي بنود الخدمة (للعرض في قسم التكاليف) ── */
  const { data: servicesForCost = [] } = useQuery<{ amount: string }[]>({
    queryKey: ["/api/repair-jobs", job.id, "services"],
    queryFn:  () => authFetch(api(`/api/repair-jobs/${job.id}/services`)).then(r => r.json()),
    staleTime: 10_000,
    select: (d) => (Array.isArray(d) ? d : []),
  });
  const servicesTotalCost = servicesForCost.reduce((s, sv) => s + (Number(sv.amount) || 0), 0);
  const partsTotalCost = (job.parts ?? []).filter(p => !p.is_returned)
    .reduce((s, p) => s + (Number(p.quantity) || 1) * (Number(p.unit_price) || 0), 0);

  /* ── قطع الغيار ── */
  const [partsOpen, setPartsOpen]               = useState(true);
  const [addingPart, setAddingPart]             = useState(false);
  const [partSearch, setPartSearch]             = useState('');
  const [partDropOpen, setPartDropOpen]         = useState(false);
  const [partSelectedProduct, setPartSelectedProduct] = useState<{ id: number; name: string; quantity: string | number; sell_price: string | number } | null>(null);
  const [partQty, setPartQty]                   = useState('1');
  const [partPrice, setPartPrice]               = useState('');
  const [partWarehouseId, setPartWarehouseId]   = useState<number | null>(null);

  const _safeHistory   = Array.isArray(job.history) ? job.history : [];
  const engineerReports = _safeHistory.filter(h => h.event_type === 'engineer_report');
  const otherHistory    = _safeHistory.filter(h => h.event_type !== 'engineer_report');

  const refreshJob = () => qc.invalidateQueries({ queryKey: ['/api/repair-jobs', job.id] });

  /* ── بيانات المخازن والمنتجات لقطع الغيار ── */
  const { warehouses: warehousesRaw } = useWarehouses();
  const warehouses = (warehousesRaw ?? []) as { id: number; name: string }[];

  type PartProduct = { id: number; name: string; quantity: string | number; sell_price: string | number };
  const { data: allProductsRaw } = useQuery<PartProduct[]>({
    queryKey: ['/api/products', partWarehouseId, 'repair-parts'],
    queryFn: () => {
      const url = partWarehouseId
        ? api(`/api/products?warehouse_id=${partWarehouseId}`)
        : api('/api/products');
      return authFetch(url).then(r => r.json());
    },
    enabled: addingPart,
  });
  const allProducts: PartProduct[] = safeArray(allProductsRaw) as PartProduct[];

  const filteredPartProducts = useMemo(() => {
    if (!partSearch.trim()) return allProducts.slice(0, 25);
    const q = partSearch.toLowerCase();
    return allProducts.filter(p => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [allProducts, partSearch]);

  const addPart = async () => {
    if (!partSelectedProduct) return;
    const qty   = Math.max(1, parseInt(partQty) || 1);
    const price = parseFloat(partPrice) || 0;
    const r = await authFetch(api(`/api/repair-jobs/${job.id}/parts`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id:   partSelectedProduct.id,
        product_name: partSelectedProduct.name,
        quantity:     qty,
        unit_price:   price,
        source:       'internal',
        warehouse_id: partWarehouseId,
      }),
    });
    if (!r.ok) { toast({ title: 'خطأ في إضافة القطعة', variant: 'destructive' }); return; }
    setPartSearch(''); setPartSelectedProduct(null); setPartQty('1'); setPartPrice('');
    setAddingPart(false);
    toast({ title: '✓ تمت إضافة القطعة' });
    refreshJob();
  };

  const deletePart = async (partId: number) => {
    const r = await authFetch(api(`/api/repair-jobs/${job.id}/parts/${partId}`), { method: 'DELETE' });
    if (!r.ok) { toast({ title: 'خطأ في حذف القطعة', variant: 'destructive' }); return; }
    refreshJob();
  };

  const addReport = async () => {
    const note = newReportText.trim();
    if (!note) return;
    const r = await authFetch(api(`/api/repair-jobs/${job.id}/engineer-reports`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (!r.ok) { toast({ title: 'خطأ في حفظ التقرير', variant: 'destructive' }); return; }
    setNewReportText(''); setAddingReport(false);
    toast({ title: '✓ تم حفظ التقرير' });
    refreshJob();
  };

  const deleteReport = async (rid: number) => {
    const r = await authFetch(api(`/api/repair-jobs/${job.id}/engineer-reports/${rid}`), { method: 'DELETE' });
    if (!r.ok) { toast({ title: 'خطأ في الحذف', variant: 'destructive' }); return; }
    refreshJob();
  };

  const handleSave = () => {
    const num = (v: string) => v.trim() === '' ? '0' : v.trim();
    onPatch({
      estimated_cost: num(editEst),
      final_cost: num(editFinal),
      deposit_paid: num(editDeposit),
      estimated_delivery: editDelivery || null,
      technician_id: editTech ? Number(editTech) : null,
      technician_name: users.find((u) => u.id.toString() === editTech)?.name ?? null,
    });
  };

  const printJobQR = () => {
    const escHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

    const effectiveBase = qrBaseUrlSetting || `${window.location.origin}/track`;
    const token = (job as { tracking_token?: string }).tracking_token ?? '';
    const trackingUrl = `${effectiveBase}/${job.company_id}/${encodeURIComponent(job.job_no)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    const svg = document.getElementById(`qr-job-${job.id}`)?.querySelector('svg');
    if (!svg) { toast({ title: 'تعذر تحميل الرمز', variant: 'destructive' }); return; }
    const svgStr = new XMLSerializer().serializeToString(svg);
    const _qrHtml = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>QR — ${escHtml(job.job_no)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", "Tahoma", sans-serif; background: #fff; color: #111;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .ticket { border: 2px dashed #999; border-radius: 16px; padding: 24px 28px; text-align: center; width: 320px; }
  .brand { font-size: 11px; color: #888; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 14px; }
  .title { font-size: 17px; font-weight: 800; margin-bottom: 4px; color: #111; }
  .sub { font-size: 12px; color: #555; margin-bottom: 18px; }
  .qr-box { background: #fff; padding: 8px; border: 1px solid #eee; border-radius: 12px; display: inline-block; margin-bottom: 18px; }
  .qr-box svg { display: block; width: 200px; height: 200px; }
  .job-no { font-family: ui-monospace, "SF Mono", monospace; font-size: 16px; font-weight: 700;
    background: #f3f4f6; padding: 8px 18px; border-radius: 999px; display: inline-block; margin-bottom: 14px; }
  .info { text-align: right; font-size: 12px; color: #333; line-height: 1.8; padding: 12px 16px;
    background: #fafafa; border-radius: 10px; margin-bottom: 12px; }
  .info b { color: #111; font-weight: 700; display: inline-block; min-width: 70px; }
  .url { font-family: ui-monospace, monospace; font-size: 9px; color: #888; word-break: break-all; padding: 0 6px; }
  .footer { margin-top: 14px; font-size: 11px; color: #666; line-height: 1.6; border-top: 1px solid #eee; padding-top: 12px; }
  @media print {
    .ticket { border: 1px solid #000; }
    @page { size: A6; margin: 0; }
  }
</style>
</head>
<body>
  <div class="ticket">
    <div class="brand">MUHKAM ERP — صيانة</div>
    <div class="title">إيصال متابعة الصيانة</div>
    <div class="sub">صوّر الرمز لمتابعة حالة جهازك</div>
    <div class="qr-box">${svgStr}</div>
    <div class="job-no">${escHtml(job.job_no)}</div>
    <div class="info">
      <div><b>العميل:</b> ${escHtml(job.customer_name ?? '')}</div>
      <div><b>الجهاز:</b> ${escHtml(`${job.device_brand ?? ''} ${job.device_model ?? ''}`.trim())}</div>
      ${job.problem_description ? `<div><b>العطل:</b> ${escHtml(job.problem_description)}</div>` : ''}
    </div>
    <div class="url">${escHtml(trackingUrl)}</div>
    <div class="footer">شكراً لاختياركم خدمتنا<br/>سيتم تحديثكم بكل مرحلة من الإصلاح</div>
  </div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 250); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`;
    const _qrBlob = new Blob([_qrHtml], { type: 'text/html' });
    const _qrUrl = URL.createObjectURL(_qrBlob);
    const win = window.open(_qrUrl, '_blank', 'width=420,height=720');
    if (!win) { URL.revokeObjectURL(_qrUrl); toast({ title: 'السماح بالنوافذ مطلوب للطباعة', variant: 'destructive' }); return; }
    setTimeout(() => URL.revokeObjectURL(_qrUrl), 2000);
  };

  const jobTrackingUrl = (() => {
    const token = (job as { tracking_token?: string }).tracking_token ?? '';
    const base = qrBaseUrlSetting || `${window.location.origin}/track`;
    return `${base}/${job.company_id}/${encodeURIComponent(job.job_no)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-[var(--erp-border)]" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-xl border border-[var(--erp-border)] flex items-center justify-center erp-label hover:text-white hover:border-white/25 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="min-w-0">
              <p className="font-black text-white text-[15px] leading-tight truncate">
                {job.device_brand} {job.device_model}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-white/25 font-mono">{job.job_no}</span>
                <span className="text-white/15 text-[10px]">·</span>
                <span className="text-[10px] erp-label">{job.customer_name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={printJobQR}
              title="طباعة إيصال استلام الجهاز للعميل (يحتوي على رمز QR للمتابعة)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-violet-500/25 text-violet-300 text-[10px] font-bold hover:bg-violet-500/10 transition-all">
              <Printer className="w-3 h-3" /> طباعة الإيصال
            </button>
            <button onClick={() => onWhatsApp(job, whatsAppProgress(job))}
              title="تحديث الحالة واتساب"
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#25D366]/25 text-[#25D366] text-[10px] font-bold hover:bg-[#25D366]/10 transition-all">
              <Send className="w-3 h-3" /> تحديث
            </button>
            {(job.status === 'done' || job.status === 'delivered' || job.status === 'ready_for_delivery') && (
              <button onClick={() => onWhatsApp(job, whatsAppReady(job))}
                title="إشعار جاهز للاستلام"
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#25D366]/25 text-[#25D366] text-[10px] font-bold hover:bg-[#25D366]/10 transition-all">
                <CheckCheck className="w-3 h-3" /> جاهز
              </button>
            )}
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-7 h-7 rounded-xl border border-red-500/15 flex items-center justify-center text-red-400/40 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/8 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div id={`qr-job-${job.id}`} className="absolute -left-[9999px] -top-[9999px]" aria-hidden>
            <QRCodeSVG value={jobTrackingUrl} size={200} level="M" includeMargin={false} />
          </div>
        </div>
        <div className="px-3 pb-2.5">
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* ── Pipeline ── */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--erp-border)]">
        <RepairPipeline
          currentStatus={job.status}
          jobId={job.id}
          jobData={job as unknown as { id: number; status: string; [key: string]: unknown }}
          onStatusChange={(s) => { onPatch({ status: s }); refreshJob(); }}
          technicians={users}
        />
      </div>

      {/* ── QC Rejection Banner ── */}
      {job.qa_notes && !job.qa_completed_at && (() => {
        let failedItems: Array<{ label?: string; status?: string }> = [];
        try {
          const parsed = typeof job.qa_checklist === 'string'
            ? JSON.parse(job.qa_checklist)
            : (Array.isArray(job.qa_checklist) ? job.qa_checklist : []);
          if (Array.isArray(parsed)) {
            failedItems = parsed.filter((i: { status?: string }) => i?.status === 'fail');
          }
        } catch { /* ignore */ }
        const noteLines = job.qa_notes.split('\n').map(l => l.trim()).filter(Boolean);
        const mainNote = noteLines.find(l => !l.startsWith('[رفض QC')) ?? noteLines[0] ?? '';
        const stamp = noteLines.find(l => l.startsWith('[رفض QC')) ?? '';
        return (
          <div className="shrink-0 mx-3 my-2 rounded-xl border border-red-500/40 overflow-hidden" dir="rtl">
            <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-400/30 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-red-300">تم رفض فحص الجودة — يجب إعادة الإصلاح</p>
                {stamp && <p className="text-[10px] text-red-300/60 mt-0.5">{stamp}</p>}
              </div>
            </div>
            <div className="px-3 pb-2.5 pt-1.5 space-y-1.5" style={{ background: 'rgba(239,68,68,0.05)' }}>
              {mainNote && (
                <div>
                  <p className="text-[10px] text-white/55 mb-0.5">سبب الرفض:</p>
                  <p className="text-[11px] text-red-200 leading-relaxed">{mainNote}</p>
                </div>
              )}
              {failedItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/55 mb-1">البنود الفاشلة ({failedItems.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {failedItems.map((item, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-red-200 border border-red-500/30"
                        style={{ background: 'rgba(239,68,68,0.15)' }}
                      >
                        {(item as { label?: string }).label ?? `بند #${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 glass-panel rounded-2xl p-3 border border-[var(--erp-border)] space-y-2">
            <p className="text-[10px] erp-label font-bold flex items-center gap-1"><Smartphone className="w-3 h-3" /> معلومات الجهاز</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="الماركة" value={job.device_brand} />
              <InfoRow label="الموديل" value={job.device_model} />
              {job.imei       && <InfoRow label="IMEI" value={job.imei} mono />}
              {job.device_pin && <InfoRow label="الرقم السري" value={job.device_pin} mono />}
              {job.color      && <InfoRow label="اللون" value={job.color} />}
              {job.storage    && <InfoRow label="التخزين" value={job.storage} />}
            </div>
            <div className="border-t border-[var(--erp-border)] pt-2">
              <p className="text-[10px] erp-label font-bold flex items-center gap-1"><Phone className="w-3 h-3" /> العميل</p>
              <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                <InfoRow label="الاسم" value={job.customer_name} />
                {job.customer_phone && <InfoRow label="الهاتف" value={job.customer_phone} />}
              </div>
            </div>
            {job.problem_description && (
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-2">
                <p className="text-[10px] text-amber-400/80 mb-0.5">المشكلة المُبلَّغ عنها</p>
                <p className="text-xs erp-text">{job.problem_description}</p>
              </div>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-3 border border-[var(--erp-border)] flex flex-col items-center justify-center gap-2">
            <ScoreRing score={score} />
            <div className="text-center space-y-0.5">
              <div className="text-[10px] text-emerald-400/70">{checklist.filter((c) => c.status === 'pass').length} تعمل</div>
              <div className="text-[10px] text-red-400/70">{checklist.filter((c) => c.status === 'fail').length} لا تعمل</div>
              <div className="text-[10px] text-amber-400/70">{checklist.filter((c) => c.status === 'partial').length} جزئي</div>
              <div className="text-[10px] text-white/25">{checklist.filter((c) => !c.status).length} لم يُفحص</div>
            </div>
          </div>
        </div>

        {/* Diagnostic Checklist */}
        <div className="glass-panel rounded-2xl border border-[var(--erp-border)] overflow-hidden">
          <button
            onClick={() => setChecklistOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-right hover:bg-white/3 transition-all"
          >
            <div className="flex items-center gap-2">
              <p className="text-[10px] erp-text-muted font-bold flex items-center gap-1.5">
                نتائج الفحص
              </p>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  {checklist.filter(c => c.status === 'pass').length} ✓
                </span>
                {checklist.filter(c => c.status === 'fail').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                    {checklist.filter(c => c.status === 'fail').length} ✗
                  </span>
                )}
                {checklist.filter(c => c.status === 'partial').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    {checklist.filter(c => c.status === 'partial').length} ~
                  </span>
                )}
                {checklist.filter(c => !c.status).length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold erp-card-soft erp-label border border-[var(--erp-border)]">
                    {checklist.filter(c => !c.status).length} ○
                  </span>
                )}
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 erp-label transition-transform duration-200 ${checklistOpen ? '-rotate-90' : 'rotate-90'}`}
            />
          </button>
          {checklistOpen && (
            <div className="border-t border-[var(--erp-border)]">
              <JobChecklist checklist={checklist} onSaveItem={onSaveCheckItem} readOnly />
            </div>
          )}
        </div>

        {/* Engineer Reports */}
        <div className="glass-panel rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] overflow-hidden">
          <button
            onClick={() => setReportOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
          >
            <p className="text-[11px] text-violet-300/80 font-bold flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> تقارير مهندس الصيانة
              {engineerReports.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300/70 font-medium tabular-nums">
                  {engineerReports.length}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {reportOpen && !addingReport && (
                <span
                  onClick={(e) => { e.stopPropagation(); setAddingReport(true); }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-violet-500/12 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20 transition-all"
                >
                  <Plus className="w-3 h-3" /> تقرير جديد
                </span>
              )}
              <ChevronRight
                className={`w-4 h-4 text-violet-400/50 transition-transform duration-200 ${reportOpen ? '-rotate-90' : 'rotate-90'}`}
              />
            </div>
          </button>
          {reportOpen && (
            <div className="px-4 pb-4 space-y-2.5">
              {addingReport && (
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 space-y-2">
                  <textarea
                    autoFocus
                    value={newReportText}
                    onChange={(e) => setNewReportText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setAddingReport(false); setNewReportText(''); }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addReport();
                    }}
                    placeholder="اكتب ملاحظات أو تشخيص أو خطوات الإصلاح..."
                    rows={4}
                    className="erp-input w-full text-sm leading-relaxed resize-y" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] erp-label">Ctrl+Enter للحفظ السريع</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setAddingReport(false); setNewReportText(''); }}
                        className="text-[11px] px-3 py-1 rounded-lg border border-[var(--erp-border)] erp-label hover:text-white/65 hover:border-white/20 transition-all">
                        إلغاء
                      </button>
                      <button
                        onClick={addReport}
                        disabled={!newReportText.trim()}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg bg-violet-500/20 border border-violet-500/35 text-violet-200 hover:bg-violet-500/30 disabled:opacity-30 transition-all">
                        <Save className="w-3 h-3" /> حفظ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {engineerReports.length === 0 && !addingReport && (
                <div className="text-center py-6 space-y-2">
                  <ClipboardList className="w-6 h-6 text-violet-400/30 mx-auto" />
                  <p className="text-[11px] text-white/35">لا توجد تقارير بعد</p>
                  <button
                    onClick={() => setAddingReport(true)}
                    className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors inline-flex items-center gap-1">
                    <Plus className="w-3 h-3" /> اكتب أول تقرير
                  </button>
                </div>
              )}

              {engineerReports.map((r) => {
                const dt = new Date(r.created_at);
                const dateStr = dt.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
                const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                const author  = r.technician_name || r.user_name || '—';
                return (
                  <div key={r.id} className="rounded-xl border border-[var(--erp-border)] bg-white/[0.02] p-3 group">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[10px] font-bold text-violet-300">
                          {author[0] ?? '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-violet-300/85">{author}</span>
                          <span className="text-[9px] erp-label">{dateStr} • {timeStr}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteReport(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all"
                        title="حذف التقرير">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[12px] text-white/75 leading-6 whitespace-pre-wrap pr-8">
                      {r.note}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Parts Used — Interactive */}
        <div className="glass-panel rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03] overflow-hidden">
          <button
            onClick={() => setPartsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
          >
            <p className="text-[11px] text-cyan-300/80 font-bold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> قطع الغيار المستخدمة
              {(job.parts?.filter(p => !p.is_returned).length ?? 0) > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300/70 font-medium tabular-nums">
                  {job.parts!.filter(p => !p.is_returned).length}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {partsOpen && !addingPart && (
                <span
                  onClick={(e) => { e.stopPropagation(); setAddingPart(true); }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> إضافة قطعة
                </span>
              )}
              <ChevronRight className={`w-4 h-4 text-cyan-400/50 transition-transform duration-200 ${partsOpen ? '-rotate-90' : 'rotate-90'}`} />
            </div>
          </button>

          {partsOpen && (
            <div className="px-4 pb-4 space-y-2.5">
              {/* نموذج الإضافة */}
              {addingPart && (
                <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 space-y-2.5">
                  {/* المخزن */}
                  <div>
                    <label className="text-[10px] erp-label mb-1 block">المخزن</label>
                    <select
                      value={partWarehouseId ?? ''}
                      onChange={e => {
                        setPartWarehouseId(e.target.value ? Number(e.target.value) : null);
                        setPartSearch(''); setPartSelectedProduct(null);
                      }}
                      className="erp-input w-full text-xs"
                    >
                      <option value="">— كل المخازن —</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  {/* البحث عن المنتج */}
                  <div className="relative">
                    <label className="text-[10px] erp-label mb-1 block">اسم القطعة / المنتج</label>
                    <input
                      type="text"
                      value={partSearch}
                      onChange={e => { setPartSearch(e.target.value); setPartDropOpen(true); setPartSelectedProduct(null); }}
                      onFocus={() => setPartDropOpen(true)}
                      onBlur={() => setTimeout(() => setPartDropOpen(false), 180)}
                      placeholder="ابحث في المخزن..."
                      className="erp-input w-full text-xs"
                      autoComplete="off"
                    />
                    {partDropOpen && partSearch.trim() && filteredPartProducts.length > 0 && (
                      <div className="absolute z-50 top-full right-0 left-0 mt-1 rounded-xl border border-white/10 bg-[#0f0c1e] shadow-2xl max-h-44 overflow-y-auto">
                        {filteredPartProducts.map(p => (
                          <button
                            key={p.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setPartSelectedProduct(p);
                              setPartSearch(p.name);
                              setPartPrice(String(Number(p.sell_price) || ''));
                              setPartDropOpen(false);
                            }}
                            className="w-full text-right px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between gap-2 border-b border-white/5 last:border-0"
                          >
                            <span className="text-white/80 truncate">{p.name}</span>
                            <span className="text-cyan-300/60 font-mono tabular-nums shrink-0">
                              {Number(p.sell_price) > 0 ? Number(p.sell_price).toLocaleString('ar-EG') : '—'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* الكمية والسعر */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] erp-label mb-1 block">الكمية</label>
                      <input type="number" min="1" value={partQty} onChange={e => setPartQty(e.target.value)} className="erp-input w-full text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] erp-label mb-1 block">سعر الوحدة</label>
                      <input type="number" min="0" step="0.01" value={partPrice} onChange={e => setPartPrice(e.target.value)} className="erp-input w-full text-xs" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] erp-label">
                      {partSelectedProduct
                        ? `متاح في المخزن: ${Number(partSelectedProduct.quantity).toLocaleString('ar-EG')}`
                        : 'اختر منتجاً من القائمة'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setAddingPart(false);
                          setPartSearch(''); setPartSelectedProduct(null);
                          setPartQty('1'); setPartPrice('');
                        }}
                        className="text-[11px] px-3 py-1 rounded-lg border border-[var(--erp-border)] erp-label hover:text-white/65 hover:border-white/20 transition-all"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={addPart}
                        disabled={!partSelectedProduct}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-30 transition-all"
                      >
                        <Plus className="w-3 h-3" /> إضافة
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* حالة فارغة */}
              {(!job.parts || job.parts.filter(p => !p.is_returned).length === 0) && !addingPart && (
                <div className="text-center py-6 space-y-2">
                  <Package className="w-6 h-6 text-cyan-400/30 mx-auto" />
                  <p className="text-[11px] text-white/35">لم تُضف قطع غيار بعد</p>
                  <button
                    onClick={() => setAddingPart(true)}
                    className="text-[11px] text-cyan-400/70 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> أضف أول قطعة
                  </button>
                </div>
              )}

              {/* قائمة القطع */}
              {job.parts && job.parts.filter(p => !p.is_returned).length > 0 && (
                <div className="space-y-1">
                  {job.parts.filter(p => !p.is_returned).map(p => {
                    const qty   = Number(p.quantity) || 1;
                    const price = Number(p.unit_price) || 0;
                    const line  = qty * price;
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border border-white/5 bg-white/[0.02] group">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-white/85 truncate block">{p.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[10px]">
                          <span className="text-white/35">×{qty}</span>
                          {price > 0 && (
                            <span className="text-cyan-300/70 font-mono tabular-nums">{line.toLocaleString('ar-EG')} ر.س</span>
                          )}
                          <button
                            onClick={() => deletePart(p.id)}
                            className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-0.5 transition-all"
                            title="حذف القطعة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const activeParts = job.parts.filter(p => !p.is_returned);
                    const total = activeParts.reduce((s, p) => s + (Number(p.quantity) || 1) * (Number(p.unit_price) || 0), 0);
                    return total > 0 ? (
                      <div className="flex items-center justify-between border-t border-cyan-500/10 pt-2 mt-1">
                        <span className="text-[10px] text-white/40">إجمالي القطع</span>
                        <span className="text-[11px] font-black text-cyan-300 font-mono tabular-nums">{total.toLocaleString('ar-EG')} ر.س</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Job Services — Phase 1.5 (with parts linking) */}
        <JobServicesSection
          jobId={job.id}
          users={users}
          locked={job.status === 'delivered' || job.status === 'done'}
        />

        {/* Technician & Costs */}
        <div className="glass-panel rounded-2xl p-3 border border-[var(--erp-border)] space-y-3">
          <p className="text-[10px] erp-label font-bold">الفني والتكاليف</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] erp-label mb-1 block">الفني المسؤول</label>
              <select value={editTech} onChange={(e) => setEditTech(e.target.value)} className="erp-input w-full text-xs">
                <option value="">— اختر الفني —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] erp-label mb-1 block">موعد التسليم</label>
              <input type="date" value={editDelivery} onChange={(e) => setEditDelivery(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] erp-label mb-1 block">تكلفة تقديرية</label>
              <input type="number" value={editEst} onChange={(e) => setEditEst(e.target.value)} className="erp-input w-full text-xs" />
            </div>
            <div>
              <label className="text-[10px] erp-label mb-1 block">التكلفة النهائية</label>
              <input type="number" value={editFinal} onChange={(e) => { setEditFinal(e.target.value); }} className="erp-input w-full text-xs" />
            </div>
          </div>
          {/* ملخص التكاليف — قطع + خدمات */}
          {(partsTotalCost > 0 || servicesTotalCost > 0) && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 space-y-1">
              {partsTotalCost > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/35">إجمالي القطع</span>
                  <span className="font-mono tabular-nums text-cyan-300/70">{partsTotalCost.toLocaleString('ar-EG')} ر.س</span>
                </div>
              )}
              {servicesTotalCost > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/35">إجمالي الخدمات</span>
                  <span className="font-mono tabular-nums text-emerald-300/70">{servicesTotalCost.toLocaleString('ar-EG')} ر.س</span>
                </div>
              )}
              {partsTotalCost > 0 && servicesTotalCost > 0 && (
                <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-1">
                  <span className="text-white/50 font-bold">الإجمالي معاً</span>
                  <span className="font-mono tabular-nums font-black text-white/70">
                    {(partsTotalCost + servicesTotalCost).toLocaleString('ar-EG')} ر.س
                  </span>
                </div>
              )}
            </div>
          )}
          <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-bold text-xs transition-all">
            <Save className="w-3.5 h-3.5" /> حفظ التغييرات
          </button>
        </div>

        {/* Accessories display */}
        {job.accessories && (
          <div className="glass-panel rounded-2xl p-3 border border-[var(--erp-border)]">
            <p className="text-[10px] erp-label font-bold flex items-center gap-1 mb-2">
              <Package className="w-3 h-3" /> الإكسسوارات المستلمة
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(typeof job.accessories === 'string' ? job.accessories.split(',') : []).map((key) => {
                const trimmed = key.trim();
                const acc = accessoriesList.find((a) => a.key === trimmed);
                return (
                  <span key={key} className="px-2.5 py-1 rounded-xl text-xs font-bold bg-violet-500/15 border border-violet-500/30 text-violet-300">
                    {acc?.emoji ? `${acc.emoji} ` : '✓ '}{acc?.label ?? trimmed}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Event Log */}
        {otherHistory.length > 0 && (
          <div className="glass-panel rounded-2xl border border-[var(--erp-border)] overflow-hidden">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
            >
              <p className="text-[10px] erp-label font-bold flex items-center gap-1.5">
                <History className="w-3 h-3" /> سجل الأحداث ({otherHistory.length})
              </p>
              <ChevronRight
                className={`w-4 h-4 erp-label transition-transform duration-200 ${historyOpen ? '-rotate-90' : 'rotate-90'}`}
              />
            </button>
            {historyOpen && (
              <div className="px-4 pb-4 space-y-2">
                {otherHistory.map((h) => {
                  const fromLabel = h.status_from ? (STATUS_MAP[h.status_from]?.label ?? h.status_from) : null;
                  const toLabel   = h.status_to   ? (STATUS_MAP[h.status_to]?.label   ?? h.status_to)   : null;
                  const dt = new Date(h.created_at);
                  const dateStr = dt.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
                  const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={h.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="w-2 h-2 rounded-full bg-violet-500/60 shrink-0" />
                        <div className="w-px flex-1 erp-card-soft mt-1" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] erp-text-muted font-medium">
                            {h.note ?? (fromLabel && toLabel ? `${fromLabel} ← ${toLabel}` : toLabel ?? fromLabel ?? h.event_type)}
                          </span>
                          <span className="text-[10px] text-white/25 shrink-0">{dateStr} {timeStr}</span>
                        </div>
                        {(h.user_name || h.technician_name) && (
                          <span className="text-[10px] erp-label">{h.user_name ?? h.technician_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="glass-panel rounded-2xl p-6 w-80 border border-[var(--erp-border)] space-y-4">
            <p className="font-bold text-white">حذف البطاقة {job.job_no}؟</p>
            <p className="text-sm erp-text-muted">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); onDelete(); }}
                className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold">حذف</button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-[var(--erp-border)] erp-text-muted text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

