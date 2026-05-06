import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { api } from '@/lib/api';
import { formatCurrency } from "@/lib/format";
import { Eye, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import PurchaseDetails from "./PurchaseDetails";

interface PurchaseRecord {
  id: number; invoice_no: string; date: string | null;
  supplier_name: string | null; payment_type: string;
  total_amount: number; paid_amount: number; remaining_amount: number;
  posting_status: string; status: string;
  currency?: string; exchange_rate?: number;
}

function PostingBadge({ status }: { status: string }) {
  if (status === "posted")    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">مرحَّل</span>;
  if (status === "cancelled") return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">ملغى</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-medium">مسودة</span>;
}

export default function PurchaseList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canCancel = hasPermission(user, "can_cancel_purchase");
  const qc = useQueryClient();
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  const { data: purchases = [], isLoading } = useQuery<PurchaseRecord[]>({
    queryKey: ["/api/purchases"],
    queryFn: () => authFetch(api("/api/purchases")).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/purchases"] });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/purchases/${id}/post`), { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الترحيل"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "✅ تم ترحيل الفاتورة وإنشاء القيد المحاسبي" }); invalidate(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/purchases/${id}/cancel`), { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الإلغاء"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم إلغاء الفاتورة وإنشاء قيد عكسي" }); invalidate(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <>
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-3 font-medium">رقم الفاتورة</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">نوع الدفع</th>
                <th className="p-3 font-medium">حالة الترحيل</th>
                <th className="p-3 font-medium">التاريخ</th>
                <th className="p-3 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton cols={7} rows={5} />
                : purchases.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-white/40">لا توجد فواتير بعد</td></tr>
                : purchases.map(p => (
                  <tr key={p.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-3 font-mono text-amber-400">{p.invoice_no}</td>
                    <td className="p-3 font-bold text-white">{p.supplier_name || '—'}</td>
                    <td className="p-3 font-bold text-blue-400">
                      {formatCurrency(p.total_amount)}
                      {p.currency && p.currency !== "EGP" && (
                        <span className="mr-1 text-xs text-blue-300/60 font-normal">({p.currency} × {p.exchange_rate?.toFixed(2)})</span>
                      )}
                    </td>
                    <td className="p-3 text-white/60">{p.payment_type === "cash" ? "نقدي" : p.payment_type === "credit" ? "آجل" : "جزئي"}</td>
                    <td className="p-3"><PostingBadge status={p.posting_status} /></td>
                    <td className="p-3 text-white/50">{p.date || '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedPurchaseId(p.id)} title="عرض التفاصيل"
                          className="btn-icon text-white/50 hover:text-white hover:bg-white/10">
                          <Eye className="w-4 h-4" />
                        </button>
                        {p.posting_status === "draft" && (
                          <button onClick={() => postMutation.mutate(p.id)} disabled={postMutation.isPending} title="ترحيل"
                            className="btn-icon text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {p.posting_status === "posted" && canCancel && (
                          <button onClick={() => cancelMutation.mutate(p.id)} disabled={cancelMutation.isPending} title="إلغاء"
                            className="btn-icon text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/returns?q=${encodeURIComponent(p.invoice_no)}`)}
                          title="عرض مرتجعات هذه الفاتورة"
                          className="btn-icon text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPurchaseId && (
        <PurchaseDetails purchaseId={selectedPurchaseId} onClose={() => setSelectedPurchaseId(null)} />
      )}
    </>
  );
}
