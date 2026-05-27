import { useEffect, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { CheckCircle2, Clock, AlertCircle, Wrench, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

interface StatusInfo { key: string; label: string; color: string }
interface TrackHistory { from: StatusInfo | null; to: StatusInfo | null; at: string }
interface TrackData {
  job_no: string;
  customer_name_masked: string;
  device: string;
  status: StatusInfo | null;
  received_at: string | null;
  estimated_delivery: string | null;
  delivered_at: string | null;
  qa_report: string | null;
  qa_inspector_name: string | null;
  photos: Array<{ photo_url: string; photo_type: string; uploaded_at: string }>;
  history: TrackHistory[];
}

export default function RepairTrack() {
  /* /track/:companyId/:jobNo?token=<hmac> */
  const [matchedFull, paramsFull] = useRoute<{ companyId: string; jobNo: string }>(
    "/track/:companyId/:jobNo",
  );

  /* SEC: read the HMAC token from the URL search string */
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const companyId = matchedFull ? paramsFull?.companyId : undefined;
  const rawJobNo  = matchedFull ? paramsFull?.jobNo : undefined;
  const jobNo     = rawJobNo ? decodeURIComponent(rawJobNo) : "";

  const [data, setData]       = useState<TrackData | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobNo || !companyId) { setError("رابط غير صالح"); setLoading(false); return; }
    if (!token) { setError("رابط التتبع غير صالح — أعد مسح رمز QR"); setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const url = api(
          `/api/public/repair-tracking/${encodeURIComponent(companyId)}/${encodeURIComponent(jobNo)}?token=${encodeURIComponent(token)}`
        );
        const r = await fetch(url);
        if (!alive) return;
        if (r.status === 401) { setError("رابط التتبع غير صالح أو منتهي الصلاحية — أعد مسح رمز QR"); }
        else if (r.status === 404) { setError("لم يتم العثور على طلب بهذا الرقم"); }
        else if (r.status === 429) { setError("محاولات كثيرة — انتظر دقيقة وحاول مجدداً"); }
        else if (!r.ok)            { setError("تعذر تحميل بيانات التتبع"); }
        else { const j = await r.json() as TrackData; setData(j); }
      } catch { if (alive) setError("خطأ في الاتصال — حاول لاحقاً"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [companyId, jobNo, token]);

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return String(iso); }
  };
  const fmtDateOnly = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("ar-EG", { dateStyle: "medium" }); }
    catch { return String(iso); }
  };

  return (
    <div dir="rtl" lang="ar"
      className="min-h-screen w-full flex items-start justify-center px-4 py-8 sm:py-12"
      style={{ background: "linear-gradient(180deg, #0b1020 0%, #131a35 100%)" }}>
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3
            bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/25">
            <Wrench className="w-6 h-6 text-violet-300" />
          </div>
          <h1 className="text-white text-xl font-black tracking-tight">متابعة طلب الصيانة</h1>
          <p className="text-white/40 text-[12px] mt-1">MUHKAM ERP — نظام إدارة الصيانة</p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 text-violet-300 animate-spin" />
            <p className="text-white/50 text-sm">جارٍ تحميل بيانات الطلب...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400/70 mx-auto mb-3" />
            <p className="text-red-300 font-bold mb-1">{error}</p>
            <p className="text-white/40 text-[12px]">تأكد من صحة الرابط أو راجع المتجر</p>
            {jobNo && <p className="text-white/30 text-[11px] font-mono mt-3">رقم الطلب: {jobNo}</p>}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            {/* Job info card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <span className="text-[11px] text-white/40 uppercase tracking-wider">رقم الطلب</span>
                <code className="text-[14px] text-white/85 font-mono font-bold">{data.job_no}</code>
              </div>
              <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
                <span className="text-[12px] text-white/40">العميل</span>
                <span className="text-[13px] text-white/75">{data.customer_name_masked || "—"}</span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-[12px] text-white/40">الجهاز</span>
                <span className="text-[13px] text-white/75 font-medium">{data.device || "—"}</span>
              </div>
            </div>

            {/* Current status */}
            {data.status && (
              <div className="rounded-2xl border bg-white/[0.04] p-5"
                style={{ borderColor: `${data.status.color}40` }}>
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">الحالة الحالية</p>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full animate-pulse"
                    style={{ background: data.status.color, boxShadow: `0 0 12px ${data.status.color}` }} />
                  <span className="text-white text-[18px] font-black">{data.status.label}</span>
                </div>
                {data.estimated_delivery && data.status.key !== "delivered" && (
                  <p className="text-[11px] text-white/40 mt-3 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> التسليم المتوقع: {fmtDateOnly(data.estimated_delivery)}
                  </p>
                )}
                {data.delivered_at && (
                  <p className="text-[11px] text-emerald-400/80 mt-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> تم التسليم: {fmtDate(data.delivered_at)}
                  </p>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-5 py-3 bg-white/[0.02] border-b border-white/8">
                <span className="text-[12px] text-white/50 font-semibold">سجل تحديثات الحالة</span>
              </div>
              <div className="px-5 py-4">
                {(() => {
                  const history: TrackHistory[] = Array.isArray(data.history) ? data.history : [];
                  if (history.length === 0) {
                    return (
                      <div className="flex items-center gap-2 text-white/35 text-[12px] py-3">
                        <AlertCircle className="w-3.5 h-3.5" />
                        لا توجد تحديثات بعد
                      </div>
                    );
                  }
                  return (
                  <ol className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-white/30 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-white/70">تم استلام الجهاز في المتجر</p>
                        <p className="text-[10px] text-white/35 mt-0.5">{fmtDate(data.received_at)}</p>
                      </div>
                    </li>
                    {history.map((h, i) => (
                      <li key={h.at ?? `history-${i}`} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: h.to?.color ?? "#888" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-white/70">
                            تحوّلت الحالة إلى <span className="font-bold text-white/90">{h.to?.label ?? "—"}</span>
                          </p>
                          <p className="text-[10px] text-white/35 mt-0.5">{fmtDate(h.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  );
                })()}
              </div>
            </div>

            {/* QA Report */}
            {data.qa_report && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-3 bg-white/[0.02] border-b border-white/8">
                  <span className="text-[12px] text-white/50 font-semibold">تقرير مراقبة الجودة</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                  <p className="text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed">{data.qa_report}</p>
                  {data.qa_inspector_name && (
                    <p className="text-[11px] text-white/40 border-t border-white/6 pt-2 mt-2">
                      الفاحص: <span className="text-white/60 font-medium">{data.qa_inspector_name}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Device Photos */}
            {data.photos && data.photos.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-3 bg-white/[0.02] border-b border-white/8">
                  <span className="text-[12px] text-white/50 font-semibold">صور الجهاز</span>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-2">
                  {data.photos.map((photo, idx) => (
                    <div key={`photo-${idx}`} className="relative">
                      <img
                        src={photo.photo_url}
                        alt={photo.photo_type === 'intake' ? 'صورة الاستلام' : 'صورة التسليم'}
                        className="w-full h-24 object-cover rounded-lg border border-white/10"
                      />
                      <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white/80 px-1.5 py-0.5 rounded">
                        {photo.photo_type === 'intake' ? 'استلام' : 'تسليم'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-[11px] text-white/30 pt-2">
              للاستفسار، تواصل مع المتجر مباشرةً
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
