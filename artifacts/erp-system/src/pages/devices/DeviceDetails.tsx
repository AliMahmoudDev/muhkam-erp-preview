import { useState, type ElementType } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/contexts/app-settings";
import { authFetch } from "@/lib/auth-fetch";
import { api } from '@/lib/api';
import {
  AlertTriangle, BadgeCheck, Banknote, Battery, Calendar, CheckCircle2,
  Copy, FileText, Info, Package, Printer, RotateCcw, ShoppingCart,
  Smartphone, Tag, Trash2, User, Wrench, XCircle,
} from "lucide-react";
import {
  type Device, GradeBadge, StatusBadge, SellModal, ReturnModal,
  printSaleReceipt, apiPost,
} from './index';

export function DeviceDetails({ device, onClose, onRefresh }: { device: Device; onClose: () => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [tab, setTab] = useState<1 | 2 | 3 | 4>(1);
  const [showSell, setShowSell] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "maintenance" | "available" | null>(null);

  const doAction = async (action: "delete" | "maintenance" | "available") => {
    try {
      if (action === "delete") {
        const r = await authFetch(api(`/api/devices/${device.id}`), { method: "DELETE" });
        if (!r.ok) throw new Error();
        toast({ title: "تم حذف الجهاز" });
      } else {
        await apiPost(`/api/devices/${device.id}/${action}`, {});
        toast({ title: action === "maintenance" ? "تم إرسال الجهاز للصيانة" : "تم إرجاع الجهاز كمتاح" });
      }
      onRefresh(); onClose();
    } catch {
      toast({ title: "خطأ في العملية", variant: "destructive" });
    }
    setConfirming(null);
  };

  const InfoCard = ({ icon: Icon, label, value, color = "text-ink/70", copyable = false }: {
    icon: ElementType; label: string; value: string | number | undefined; color?: string; copyable?: boolean;
  }) => {
    const { toast: t } = useToast();
    return (
      <div className="bg-surface rounded-xl border border-line p-2.5 flex flex-col gap-0.5 group">
        <div className="flex items-center justify-between text-ink/30 text-[10px]">
          <div className="flex items-center gap-1.5"><Icon className="w-3 h-3" /> {label}</div>
          {copyable && value && (
            <button onClick={() => { navigator.clipboard.writeText(String(value)); t({ title: "تم النسخ" }); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Copy className="w-3 h-3 hover:text-ink/60" />
            </button>
          )}
        </div>
        <span className={`font-bold text-sm ${color}`}>{value ?? "—"}</span>
      </div>
    );
  };

  const FlagChip = ({ label, val, warn = false }: { label: string; val: boolean; warn?: boolean }) => (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
      val
        ? warn
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
        : "border-line bg-surface text-ink/25"
    }`}>
      {val ? warn ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </div>
  );

  const profit = device.sold_price
    ? parseFloat(device.sold_price) - parseFloat(device.purchase_price)
    : parseFloat(device.sale_price) - parseFloat(device.purchase_price);

  const TABS = [
    { id: 1 as const, label: "بيانات الجهاز" },
    { id: 2 as const, label: "المصدر" },
    { id: 3 as const, label: "السجل" },
    { id: 4 as const, label: "سجل المبيعات" },
  ];

  const PAY_LABELS: Record<string, string> = { cash: "نقداً", card: "بطاقة", instapay: "InstaPay", transfer: "تحويل بنكي" };
  const STATUS_LABELS: Record<string, string> = { paid: "مدفوع بالكامل", partial: "دفع جزئي", unpaid: "غير مدفوع" };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 bg-black/70 backdrop-blur-sm" dir="rtl">
        <div className="glass-panel rounded-2xl border border-line w-full max-w-lg mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "94vh" }}>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Smartphone className="w-4.5 h-4.5 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-ink text-sm">{device.brand} {device.model}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-ink/30 font-mono">{device.device_no}</span>
                  <button onClick={() => { navigator.clipboard.writeText(device.device_no); }}
                    className="text-ink/20 hover:text-ink/50 transition-colors">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={device.status} />
              <button onClick={onClose} className="btn-icon text-ink/40 hover:text-ink">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-line shrink-0 px-1">
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
                  tab === id
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-ink/30 hover:text-ink/60"
                }`}>
                <span>{id}</span>
                <span className="mr-1">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab Body ── */}
          <div className="overflow-y-auto flex-1 p-4 space-y-4">

            {/* ══ TAB 1: Device Data ══ */}
            {tab === 1 && (
              <>
                {/* Specs grid 3-col */}
                <div className="grid grid-cols-3 gap-2">
                  <InfoCard icon={Package}   label="السعة"     value={device.storage} />
                  <InfoCard icon={Battery}   label="البطارية"  value={device.battery_health ? `${device.battery_health}%` : undefined}
                    color={device.battery_health && device.battery_health < 80 ? "text-amber-300" : "text-ink/70"} />
                  <div className="bg-surface rounded-xl border border-line p-2.5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-ink/30 text-[10px]"><BadgeCheck className="w-3 h-3" /> الدرجة</div>
                    <GradeBadge grade={device.grade} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {device.color && <InfoCard icon={Tag}  label="اللون"  value={device.color} />}
                  {device.imei  && <InfoCard icon={Info} label="IMEI / SN" value={device.imei} copyable />}
                </div>

                {/* Flags */}
                <div className="bg-surface rounded-xl border border-line p-3">
                  <p className="text-[10px] font-bold text-ink/25 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                    <BadgeCheck className="w-3 h-3" /> حالة الجهاز
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <FlagChip label="شريحتين"       val={device.dual_sim} />
                    <FlagChip label="بالعلبة"        val={device.with_box} />
                    <FlagChip label="الضريبة مدفوعة" val={true} />
                    <FlagChip label="مفتوح من قبل"   val={device.previously_opened} warn />
                    <FlagChip label="مقفول iCloud"   val={device.icloud_locked} warn />
                    <FlagChip label="مقفول شبكة"     val={device.network_locked} warn />
                    <FlagChip label="مقفول MDM"      val={device.mdm_locked} warn />
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-surface rounded-xl border border-line p-3">
                  <p className="text-[10px] font-bold text-ink/25 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Banknote className="w-3 h-3" /> التسعير
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-surface rounded-lg p-2">
                      <p className="text-[10px] text-ink/30 mb-1">سعر الشراء</p>
                      <p className="font-bold text-ink/60 text-sm">{parseFloat(device.purchase_price).toLocaleString()}</p>
                      <p className="text-[10px] text-ink/20">ج.م</p>
                    </div>
                    <div className="bg-surface rounded-lg p-2">
                      <p className="text-[10px] text-ink/30 mb-1">{device.status === "sold" ? "بيع بـ" : "سعر البيع"}</p>
                      <p className="font-bold text-ink text-sm">
                        {parseFloat(device.status === "sold" ? (device.sold_price ?? device.sale_price) : device.sale_price).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-ink/20">ج.م</p>
                    </div>
                    <div className="bg-surface rounded-lg p-2">
                      <p className="text-[10px] text-ink/30 mb-1">الربح</p>
                      <p className={`font-bold text-sm ${profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {profit >= 0 ? "+" : ""}{profit.toLocaleString()}
                      </p>
                      <p className={`text-[10px] ${profit > 0 ? "text-emerald-400/40" : "text-red-400/40"}`}>
                        {parseFloat(device.purchase_price) > 0
                          ? `${Math.round((profit / parseFloat(device.purchase_price)) * 100)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ══ TAB 2: Source & Notes ══ */}
            {tab === 2 && (
              <div className="space-y-3">
                <div className="bg-surface rounded-xl border border-line p-3 space-y-3">
                  <p className="text-[10px] font-bold text-ink/25 uppercase tracking-widest flex items-center gap-1.5">
                    <User className="w-3 h-3" /> بيانات المصدر
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-ink/30 mb-0.5">المورد / البائع</p>
                      <p className="text-ink/80 font-medium">{device.supplier_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink/30 mb-0.5">فاتورة الشراء</p>
                      <p className="text-ink/80 font-mono text-xs">{device.purchase_invoice_no || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink/30 mb-0.5">الفاحص</p>
                      <p className="text-ink/80 font-medium">{device.inspector_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink/30 mb-0.5">مسجل بواسطة</p>
                      <p className="text-ink/80 font-medium">{device.added_by_user_name || "—"}</p>
                    </div>
                  </div>
                  <div className="border-t border-line pt-2.5 flex items-center gap-1.5 text-xs text-ink/30">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>تاريخ الإضافة:</span>
                    <span className="text-ink/50">{new Date(device.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</span>
                  </div>
                </div>

                {device.condition_notes && (
                  <div className="bg-surface rounded-xl border border-line p-3">
                    <p className="text-[10px] font-bold text-ink/25 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> ملاحظات الحالة
                    </p>
                    <p className="text-sm text-ink/60 leading-relaxed">{device.condition_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB 3: Maintenance Log ══ */}
            {tab === 3 && (
              <div>
                {device.status === "maintenance" || (device.condition_notes && device.condition_notes.includes("صيانة")) ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-ink/25 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Wrench className="w-3 h-3" /> سجل الصيانة
                    </p>
                    {device.status === "maintenance" && (
                      <div className="flex items-start gap-3 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm text-amber-300 font-semibold">الجهاز حالياً في الصيانة</p>
                          <p className="text-[11px] text-ink/30 mt-0.5">{new Date(device.created_at).toLocaleDateString("ar-EG")}</p>
                        </div>
                      </div>
                    )}
                    {device.condition_notes && (
                      <div className="flex items-start gap-3 p-3 bg-surface border border-line rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-raised mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm text-ink/70">{device.condition_notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3">
                      <Wrench className="w-5 h-5 text-ink/20" />
                    </div>
                    <p className="text-ink/40 font-medium">لا يوجد سجل صيانة</p>
                    <p className="text-ink/20 text-xs mt-1">هذا الجهاز لم يتم إرساله للصيانة من قبل</p>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB 4: Sales Log ══ */}
            {tab === 4 && (
              <div>
                {device.status === "sold" && device.sold_to_customer_name ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-ink/25 uppercase tracking-widest flex items-center gap-1.5">
                      <ShoppingCart className="w-3 h-3" /> بيانات البيع
                    </p>

                    {/* Customer card */}
                    <div className="flex items-center gap-3 p-3 bg-blue-500/8 border border-blue-500/15 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-ink text-sm">{device.sold_to_customer_name}</p>
                        <p className="text-[11px] text-ink/30">العميل</p>
                      </div>
                    </div>

                    {/* Sale details grid */}
                    <div className="bg-surface rounded-xl border border-line p-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-ink/30 mb-0.5">تاريخ البيع</p>
                        <p className="text-ink/80">{device.sold_at ? new Date(device.sold_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink/30 mb-0.5">البائع</p>
                        <p className="text-ink/80">{device.sold_by_user_name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink/30 mb-0.5">سعر البيع</p>
                        <p className="text-emerald-400 font-bold">{parseFloat(device.sold_price ?? "0").toLocaleString()} ج.م</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink/30 mb-0.5">صافي الربح</p>
                        <p className={`font-bold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {profit >= 0 ? "+" : ""}{profit.toLocaleString()} ج.م
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink/30 mb-0.5">طريقة الدفع</p>
                        <p className="text-ink/70">{PAY_LABELS[device.payment_method ?? ""] ?? device.payment_method ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-ink/30 mb-0.5">حالة الدفع</p>
                        <p className={`font-medium text-xs ${device.payment_status === "paid" ? "text-emerald-400" : device.payment_status === "partial" ? "text-amber-400" : "text-red-400"}`}>
                          {STATUS_LABELS[device.payment_status ?? ""] ?? device.payment_status ?? "—"}
                        </p>
                      </div>
                      {device.warranty_months && (
                        <div className="col-span-2">
                          <p className="text-[10px] text-ink/30 mb-0.5">فترة الضمان</p>
                          <p className="text-blue-300 font-medium">{device.warranty_months} شهر</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3">
                      <ShoppingCart className="w-5 h-5 text-ink/20" />
                    </div>
                    <p className="text-ink/40 font-medium">لم يُباع بعد</p>
                    <p className="text-ink/20 text-xs mt-1">هذا الجهاز لم يتم بيعه بعد</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Actions footer ── */}
          <div className="px-4 py-3.5 border-t border-line shrink-0">
            {confirming ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink/60">
                  {confirming === "delete" ? "تأكيد الحذف؟" : confirming === "maintenance" ? "إرسال للصيانة؟" : "إرجاع كمتاح؟"}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirming(null)} className="px-3 py-1.5 rounded-xl border border-line text-ink/50 text-xs">إلغاء</button>
                  <button onClick={() => doAction(confirming)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      confirming === "delete" ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    }`}>تأكيد</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {device.status === "available" && (
                  <>
                    <button onClick={() => setShowSell(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 transition-all">
                      <ShoppingCart className="w-3.5 h-3.5" /> بيع الجهاز
                    </button>
                    <button onClick={() => setConfirming("maintenance")} title="إرسال للصيانة"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm hover:bg-amber-500/20 transition-all">
                      <Wrench className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {device.status === "sold" && (
                  <>
                    <button onClick={() => printSaleReceipt(device, settings.companyName)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm font-bold hover:bg-violet-500/25 transition-all">
                      <Printer className="w-3.5 h-3.5" /> طباعة الفاتورة
                    </button>
                    <button onClick={() => setShowReturn(true)} title="إرجاع من العميل"
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-500/20 transition-all">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {device.status === "maintenance" && (
                  <button onClick={() => setConfirming("available")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-all">
                    <RotateCcw className="w-3.5 h-3.5" /> إرجاع كمتاح
                  </button>
                )}
                <button onClick={() => setConfirming("delete")} title="حذف الجهاز"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSell && (
        <SellModal device={device} onClose={() => setShowSell(false)} onDone={onRefresh} />
      )}
      {showReturn && (
        <ReturnModal device={device} onClose={() => setShowReturn(false)} onDone={() => { onRefresh(); onClose(); }} />
      )}
    </>
  );
}
