import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Target, Loader2, Save, ChevronRight, ChevronLeft, Trophy, Users } from 'lucide-react';
import { PageHeader } from './_shared';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api  = (p: string) => `${BASE}${p}`;

interface TargetRow {
  user_id:         number;
  user_name:       string;
  role:            string;
  target_id:       number | null;
  target_amount:   number;
  achieved_amount: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin:       'مدير',
  manager:     'مشرف',
  cashier:     'كاشير',
  salesperson: 'مندوب',
  accountant:  'محاسب',
};

function monthLabel(ym: string) {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function currentYM() {
  return new Date().toISOString().slice(0, 7);
}

export default function SalesTargetsTab() {
  const { toast } = useToast();
  const [month,   setMonth]   = useState(currentYM());
  const [rows,    setRows]    = useState<TargetRow[]>([]);
  const [drafts,  setDrafts]  = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState<number | null>(null);

  const load = useCallback(async (ym: string) => {
    setLoading(true);
    try {
      const r = await authFetch(api(`/api/sales-targets?month=${ym}`));
      if (r.ok) {
        const d = await r.json() as { month: string; items: TargetRow[] };
        setRows(d.items);
        const init: Record<number, string> = {};
        d.items.forEach(row => {
          init[row.user_id] = row.target_amount > 0 ? String(row.target_amount) : '';
        });
        setDrafts(init);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(month); }, [month, load]);

  const handleSave = async (userId: number) => {
    const val = parseFloat(drafts[userId] || '0') || 0;
    setSaving(userId);
    try {
      const r = await authFetch(api('/api/sales-targets'), {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, year_month: month, target_amount: val }),
      });
      if (!r.ok) throw new Error('فشل الحفظ');
      toast({ title: val > 0 ? '✅ تم حفظ الهدف' : 'تم حذف الهدف' });
      await load(month);
    } catch {
      toast({ title: 'فشل الحفظ', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="أهداف المبيعات"
        sub="تحديد هدف شهري لكل مستخدم ومتابعة تقدمه في لوحة التحكم"
      />

      {/* Month navigator */}
      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/8" style={{ background: 'var(--erp-bg-card)' }}>
        <button
          onClick={() => setMonth(prevMonth(month))}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
        >
          <ChevronRight className="w-4 h-4 text-white/60" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-sm">{monthLabel(month)}</p>
            {month === currentYM() && (
              <p className="text-amber-400/70 text-[10px] font-semibold">الشهر الحالي</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setMonth(nextMonth(month))}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
        >
          <ChevronLeft className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-white/30 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-white/25">
          <Users className="w-10 h-10" />
          <p className="text-sm">لا يوجد مستخدمون في هذه الشركة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const targetVal = parseFloat(drafts[row.user_id] || '0') || 0;
            const pct = targetVal > 0 ? Math.min(100, (row.achieved_amount / targetVal) * 100) : 0;
            const isDirty = targetVal !== row.target_amount;
            const color = pct >= 100 ? '#34d399' : pct >= 60 ? '#f59e0b' : '#f87171';

            return (
              <div
                key={row.user_id}
                className="rounded-2xl border border-white/8 p-4 space-y-3"
                style={{ background: 'var(--erp-bg-card)' }}
              >
                {/* User info row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{row.user_name}</p>
                      <p className="text-white/35 text-xs">{ROLE_LABELS[row.role] ?? row.role}</p>
                    </div>
                  </div>

                  {/* Target input + save */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="0"
                        value={drafts[row.user_id] ?? ''}
                        onChange={e => setDrafts(p => ({ ...p, [row.user_id]: e.target.value }))}
                        className="w-32 px-3 py-2 pl-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50 text-right"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none">ج.م</span>
                    </div>
                    <button
                      onClick={() => void handleSave(row.user_id)}
                      disabled={saving === row.user_id || !isDirty}
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-30"
                      style={{
                        background: isDirty ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isDirty ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                      title="حفظ"
                    >
                      {saving === row.user_id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        : <Save className="w-3.5 h-3.5 text-amber-400" />
                      }
                    </button>
                  </div>
                </div>

                {/* Progress bar — only show when target is set */}
                {row.target_amount > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/40">
                        تحقق: <span className="font-bold" style={{ color }}>{row.achieved_amount.toLocaleString('ar-EG-u-nu-latn')} ج.م</span>
                      </span>
                      <span className="font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                    <p className="text-white/25 text-[10px] text-left">
                      الهدف: {row.target_amount.toLocaleString('ar-EG-u-nu-latn')} ج.م
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
        <Target className="w-4 h-4 text-white/25 mt-0.5 shrink-0" />
        <p className="text-white/30 text-xs leading-relaxed">
          اضبط الهدف بـ 0 لحذفه. الأهداف تظهر في لوحة التحكم الرئيسية مع شريط تقدم لكل مستخدم.
        </p>
      </div>
    </div>
  );
}
