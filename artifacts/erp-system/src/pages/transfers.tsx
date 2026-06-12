/**
 * /transfers — صفحة تحويل المخزون بين الفروع
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import {
  ArrowRightLeft, Plus, X, Loader2, CheckCircle2,
  Clock, Truck, Package, XCircle,
  LayoutDashboard, ClipboardList, Bell, BarChart3, Archive, Trash2,
} from 'lucide-react';

// ─── أنواع ────────────────────────────────────────────────────────────────────
interface Transfer {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  from_branch_id: number | null;
  to_branch_id: number | null;
  status: 'pending' | 'approved' | 'shipped' | 'received' | 'cancelled';
  verification_code: string | null;
  created_by: number | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
}

interface Branch { id: number; name: string; }
interface Product { id: number; name: string; }

// ─── مساعدات ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending:   'انتظار',
  approved:  'معتمد',
  shipped:   'مشحون',
  received:  'مستلَم',
  cancelled: 'ملغى',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-3 h-3" />,
  approved:  <CheckCircle2 className="w-3 h-3" />,
  shipped:   <Truck className="w-3 h-3" />,
  received:  <Package className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-300 border-amber-500/25',
  approved:  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  shipped:   'bg-violet-500/15 text-violet-300 border-violet-500/25',
  received:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/25',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── رمز التحقق المُظهَر (فقط للمُنشئ عند الشحن) ────────────────────────────
function VerifCode({ code }: { code: string | null }) {
  const [show, setShow] = useState(false);
  if (!code) return null;
  return (
    <button
      onClick={() => setShow(s => !s)}
      className="text-xs px-2 py-0.5 rounded bg-surface border border-line text-ink/40 hover:text-ink/70 transition-colors font-mono"
    >
      {show ? code : '••••••'}
    </button>
  );
}

// ─── شارة الحالة ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${STATUS_COLOR[status] ?? 'bg-surface text-ink/50 border-line'}`}>
      {STATUS_ICON[status]}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── مودال طلب تحويل جديد ────────────────────────────────────────────────────
function RequestModal({
  branches, products, onClose, onSuccess,
}: {
  branches: Branch[];
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    product_id: '',
    from_branch_id: '',
    to_branch_id: '',
    quantity: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api('/api/transfers/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:     Number(form.product_id),
          from_branch_id: Number(form.from_branch_id),
          to_branch_id:   Number(form.to_branch_id),
          quantity:       Number(form.quantity),
          notes:          form.notes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'خطأ في الإنشاء');
      return d;
    },
    onSuccess: () => {
      toast({ title: '✅ تم إنشاء طلب التحويل' });
      onSuccess();
      onClose();
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  const valid =
    form.product_id &&
    form.from_branch_id &&
    form.to_branch_id &&
    Number(form.quantity) > 0 &&
    form.from_branch_id !== form.to_branch_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1623] border border-line rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <span className="font-bold text-ink flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-violet-400" /> طلب تحويل جديد
          </span>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* المنتج */}
          <div>
            <label className="text-ink/50 text-xs mb-1.5 block">المنتج <span className="text-red-400">*</span></label>
            <select
              value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            >
              <option value="">— اختر منتجاً —</option>
              {products.map(p => (
                <option key={p.id} value={p.id} className="bg-[#1a1a2e]">{p.name}</option>
              ))}
            </select>
          </div>

          {/* الفروع */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-ink/50 text-xs mb-1.5 block">من فرع <span className="text-red-400">*</span></label>
              <select
                value={form.from_branch_id}
                onChange={e => setForm(f => ({ ...f, from_branch_id: e.target.value }))}
                className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
              >
                <option value="">— اختر —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-[#1a1a2e]">{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-ink/50 text-xs mb-1.5 block">إلى فرع <span className="text-red-400">*</span></label>
              <select
                value={form.to_branch_id}
                onChange={e => setForm(f => ({ ...f, to_branch_id: e.target.value }))}
                className={`w-full bg-surface border rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 ${
                  form.from_branch_id && form.to_branch_id && form.from_branch_id === form.to_branch_id
                    ? 'border-red-500/40' : 'border-line'
                }`}
              >
                <option value="">— اختر —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-[#1a1a2e]">{b.name}</option>
                ))}
              </select>
              {form.from_branch_id && form.to_branch_id && form.from_branch_id === form.to_branch_id && (
                <p className="text-red-400 text-xs mt-1">فرعان مختلفان مطلوبان</p>
              )}
            </div>
          </div>

          {/* الكمية */}
          <div>
            <label className="text-ink/50 text-xs mb-1.5 block">الكمية <span className="text-red-400">*</span></label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="0"
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-ink text-sm placeholder:text-ink/25 focus:outline-none focus:ring-2 focus:ring-violet-400/50 font-mono"
            />
          </div>

          {/* ملاحظات */}
          <div>
            <label className="text-ink/50 text-xs mb-1.5 block">ملاحظات</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="سبب التحويل..."
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-ink text-sm placeholder:text-ink/25 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
              : <><ArrowRightLeft className="w-4 h-4" /> إرسال الطلب</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── مودال رمز التحقق (استلام) ───────────────────────────────────────────────
function ConfirmModal({
  transfer,
  onClose,
  onSuccess,
}: {
  transfer: Transfer;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await authFetch(api(`/api/transfers/confirm/${transfer.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_code: code.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'خطأ في التأكيد');
      return d;
    },
    onSuccess: () => {
      toast({ title: '✅ تم استلام التحويل بنجاح' });
      onSuccess();
      onClose();
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1623] border border-line rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <span className="font-bold text-ink flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" /> تأكيد الاستلام
          </span>
          <button onClick={onClose} className="text-ink/40 hover:text-ink transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-surface border border-line rounded-xl p-3 text-sm">
            <p className="text-ink/60">منتج: <span className="text-ink font-bold">{transfer.product_name}</span></p>
            <p className="text-ink/60 mt-1">الكمية: <span className="text-ink font-bold font-mono">{transfer.quantity}</span></p>
          </div>

          <div>
            <label className="text-ink/50 text-xs mb-1.5 block">رمز التحقق (6 أرقام) <span className="text-red-400">*</span></label>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-surface border border-line rounded-xl px-3 py-3 text-ink text-xl text-center tracking-widest font-mono placeholder:text-ink/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={code.length !== 6 || mutation.isPending}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التأكيد...</>
              : <><CheckCircle2 className="w-4 h-4" /> تأكيد الاستلام</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function Transfers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const canManage = hasPermission(user, 'can_view_inventory');

  const [showRequest, setShowRequest] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Transfer | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  // ── جلب البيانات ──
  const { data: _transfersRaw, isLoading } = useQuery<Transfer[]>({
    queryKey: ['branch-transfers', filterStatus],
    queryFn: async () => {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const r = await authFetch(api(`/api/transfers${qs}`));
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    refetchInterval: 15_000,
  });
  const transfers: Transfer[] = Array.isArray(_transfersRaw) ? _transfersRaw : [];

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches-list'],
    queryFn: async () => {
      const d = await authFetch(api('/api/branches')).then(r => r.json());
      const arr = Array.isArray(d) ? d : (Array.isArray(d?.branches) ? d.branches : []);
      return arr;
    },
  });

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['products-simple'],
    queryFn: () => authFetch(api('/api/products?limit=500')).then(r => r.json()),
  });
  const products = productsData?.products ?? [];

  const branchName = (id: number | null) =>
    id ? (branches.find(b => b.id === id)?.name ?? `#${id}`) : '—';

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['branch-transfers'] });
  }

  // ── mutations للإجراءات ──
  const approveMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/transfers/approve/${id}`), { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'خطأ');
      return d;
    },
    onSuccess: () => { toast({ title: '✅ تم الاعتماد' }); invalidate(); },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  const shipMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/transfers/ship/${id}`), { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'خطأ');
      return d;
    },
    onSuccess: () => { toast({ title: '✅ تم الشحن' }); invalidate(); },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/transfers/cancel/${id}`), { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'خطأ');
      return d;
    },
    onSuccess: () => { toast({ title: '✅ تم الإلغاء' }); invalidate(); },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-ink" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ══ شريط تبويبات المخزون — نفس تبويبات صفحة /inventory ══ */}
        <div className="flex border-b border-line overflow-x-auto" style={{scrollbarWidth:'none'}}>
          {/* نظرة عامة */}
          <button
            onClick={() => navigate('/inventory?tab=overview')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
          >
            <LayoutDashboard className="w-4 h-4" />
            نظرة عامة
          </button>
          {/* الحركات */}
          <button
            onClick={() => navigate('/inventory?tab=movements')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
          >
            <Package className="w-4 h-4" />
            الحركات
          </button>
          {/* الجرد */}
          {canManage && (
            <button
              onClick={() => navigate('/inventory?tab=count')}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
            >
              <ClipboardList className="w-4 h-4" />
              الجرد
            </button>
          )}
          {/* التحويلات — التبويب النشط حالياً */}
          {canManage && (
            <button
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-violet-400 text-violet-300 whitespace-nowrap"
            >
              <Truck className="w-4 h-4" />
              التحويلات بين الفروع
            </button>
          )}
          {/* الائتمان */}
          {canManage && (
            <button
              onClick={() => navigate('/inventory?tab=consignment')}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
            >
              <Archive className="w-4 h-4" />
              الائتمان
            </button>
          )}
          {/* تنبيهات */}
          <button
            onClick={() => navigate('/inventory?tab=alerts')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
          >
            <Bell className="w-4 h-4" />
            تنبيهات المخزون
          </button>
          {/* تقارير */}
          <button
            onClick={() => navigate('/inventory?tab=reports')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" />
            تقارير المخزون
          </button>
          {/* مخزن التوالف */}
          <button
            onClick={() => navigate('/inventory?tab=scrap')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px border-transparent text-ink/50 hover:text-ink/80 whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4" />
            مخزن التوالف
          </button>
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-violet-400" />
              تحويل المخزون بين الفروع
            </h1>
            <p className="text-ink/40 text-xs mt-1">
              {transfers.length} طلب {filterStatus ? `— ${STATUS_LABEL[filterStatus]}` : 'إجمالاً'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowRequest(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-400 rounded-xl text-sm font-bold transition-colors"
            >
              <Plus className="w-4 h-4" /> طلب تحويل جديد
            </button>
          )}
        </div>

        {/* ── فلتر الحالة ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {['', 'pending', 'approved', 'shipped', 'received', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                filterStatus === s
                  ? 'bg-violet-500 text-ink border-violet-500'
                  : 'bg-surface text-ink/50 border-line hover:text-ink hover:border-line'
              }`}
            >
              {s === '' ? 'الكل' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* ── القائمة ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-line rounded-2xl">
            <ArrowRightLeft className="w-10 h-10 text-ink/10 mb-3" />
            <p className="text-ink/40 font-bold">لا توجد طلبات تحويل</p>
            {canManage && (
              <button
                onClick={() => setShowRequest(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
              >
                <Plus className="w-4 h-4" /> إنشاء أول طلب
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map(t => {
              const acting = approveMut.isPending || shipMut.isPending || cancelMut.isPending;
              return (
                <div
                  key={t.id}
                  className="bg-[#111827] border border-line rounded-2xl p-4 hover:border-line transition-colors"
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    {/* معلومات */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-ink font-bold text-sm">{t.product_name}</span>
                        <StatusBadge status={t.status} />
                        <span className="text-xs text-ink/30 font-mono">#{t.id}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-ink/60 flex-wrap">
                        <span className="text-amber-300">{branchName(t.from_branch_id)}</span>
                        <ArrowRightLeft className="w-3 h-3 text-ink/25" />
                        <span className="text-emerald-300">{branchName(t.to_branch_id)}</span>
                        <span className="text-ink/30">·</span>
                        <span className="font-mono text-ink">{t.quantity} وحدة</span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-ink/30 text-xs">{fmtDate(t.created_at)}</span>
                        {t.status === 'shipped' && <VerifCode code={t.verification_code} />}
                        {t.notes && (
                          <span className="text-ink/30 text-xs truncate max-w-xs">{t.notes}</span>
                        )}
                      </div>
                    </div>

                    {/* أزرار الإجراءات */}
                    {canManage && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveMut.mutate(t.id)}
                              disabled={acting}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 disabled:opacity-40 transition-colors"
                            >
                              {approveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'اعتماد'}
                            </button>
                            <button
                              onClick={() => cancelMut.mutate(t.id)}
                              disabled={acting}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                            >
                              إلغاء
                            </button>
                          </>
                        )}

                        {t.status === 'approved' && (
                          <>
                            <button
                              onClick={() => shipMut.mutate(t.id)}
                              disabled={acting}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                            >
                              {shipMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Truck className="w-3 h-3" /> شحن</>}
                            </button>
                            <button
                              onClick={() => cancelMut.mutate(t.id)}
                              disabled={acting}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                            >
                              إلغاء
                            </button>
                          </>
                        )}

                        {t.status === 'shipped' && (
                          <button
                            onClick={() => setConfirmTarget(t)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3" /> تأكيد الاستلام
                          </button>
                        )}

                        {t.status === 'received' && (
                          <span className="text-xs text-emerald-400/70 font-bold">✓ مكتمل</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── المودالات ── */}
      {showRequest && (
        <RequestModal
          branches={branches}
          products={products}
          onClose={() => setShowRequest(false)}
          onSuccess={invalidate}
        />
      )}
      {confirmTarget && (
        <ConfirmModal
          transfer={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
