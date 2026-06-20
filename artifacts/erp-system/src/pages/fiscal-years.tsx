import { api } from '@/lib/api';
/**
 * FiscalYears — إدارة السنوات المالية
 * إنشاء وتعيين وإقفال السنوات المالية للشركة.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Lock, Unlock, CheckCircle, Plus, X, BookMarked } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';

interface FiscalYear {
  id: number;
  year_label: string;
  start_date: string;
  end_date: string;
  is_open: boolean;
  is_current: boolean;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
}

function toast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl font-bold text-sm shadow-xl transition-all ${
    type === 'success' ? 'bg-emerald-600 text-ink' : 'bg-red-600 text-ink'
  }`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export default function FiscalYears() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ year_label: '', start_date: '', end_date: '', notes: '' });

  const { data: years = [], isLoading } = useQuery<FiscalYear[]>({
    queryKey: ['fiscal-years'],
    queryFn: () =>
      authFetch(api('/api/fiscal-years')).then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
  });

  const createMut = useMutation({
    mutationFn: (body: object) =>
      authFetch(api('/api/fiscal-years'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'خطأ');
        return d;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      setShowAdd(false);
      setForm({ year_label: '', start_date: '', end_date: '', notes: '' });
      toast('تم إنشاء السنة المالية');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const closeMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/fiscal-years/${id}/close`), { method: 'PATCH' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'خطأ');
        return d;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      toast('تم إقفال السنة المالية');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const reopenMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/fiscal-years/${id}/reopen`), { method: 'PATCH' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'خطأ');
        return d;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      toast('تم إعادة فتح السنة المالية');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const closingEntriesMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/fiscal-years/${id}/closing-entries`), { method: 'POST' }).then(
        async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? 'خطأ');
          return d;
        }
      ),
    onSuccess: (d) =>
      toast(
        `تم إنشاء قيود الإقفال — إيرادات: ${d.total_revenue} | مصروفات: ${d.total_expense} | صافي ربح: ${d.net_income}`
      ),
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const setCurrent = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/fiscal-years/${id}/set-current`), { method: 'PATCH' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'خطأ');
        return d;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      toast('تم تعيين السنة الحالية');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/fiscal-years/${id}`), { method: 'DELETE' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'خطأ');
        return d;
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      toast('تم حذف السنة المالية');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const handleCreate = () => {
    if (!form.year_label || !form.start_date || !form.end_date) {
      toast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    createMut.mutate(form);
  };

  return (
    <div className="erp-page" dir="rtl" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {/* Header */}
      <div className="erp-page-header">
        <div>
          <h1 className="erp-page-title flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            إدارة السنوات المالية
          </h1>
          <p className="erp-page-subtitle">
            تحكم في السنوات المالية للشركة، فتح وإقفال الفترات المحاسبية
          </p>
        </div>
        {isAdmin && (
          <div className="erp-page-actions">
            <button
              onClick={() => setShowAdd(true)}
              className="erp-btn erp-btn-primary erp-btn-sm"
            >
              <Plus className="w-4 h-4" />
              سنة مالية جديدة
            </button>
          </div>
        )}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">إضافة سنة مالية جديدة</h3>
            <button onClick={() => setShowAdd(false)}>
              <X className="w-4 h-4 text-ink/40 hover:text-ink" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-ink/50 block mb-1">اسم السنة *</label>
              <input
                type="text"
                value={form.year_label}
                onChange={(e) => setForm((f) => ({ ...f, year_label: e.target.value }))}
                placeholder="مثال: السنة المالية 2026"
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-xs text-ink/50 block mb-1">تاريخ البداية *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-xs text-ink/50 block mb-1">تاريخ النهاية *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/50 block mb-1">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={createMut.isPending}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm disabled:opacity-50"
            >
              {createMut.isPending ? 'جارِ الحفظ...' : 'حفظ'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-surface hover:bg-raised text-ink rounded-xl text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer h-20 rounded-2xl" />
          ))}
        </div>
      ) : years.length === 0 ? (
        <div className="text-center py-16 text-ink/30">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-bold">لا توجد سنوات مالية</p>
          <p className="text-sm mt-1">انقر «سنة مالية جديدة» لإنشاء أول سنة مالية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {years.map((fy) => (
            <div
              key={fy.id}
              className={`rounded-2xl p-4 border transition-all ${
                fy.is_current
                  ? 'bg-amber-500/8 border-amber-500/30'
                  : fy.is_open
                    ? 'bg-emerald-500/5 border-emerald-500/15'
                    : 'bg-surface border-line opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      fy.is_current
                        ? 'bg-amber-500/20'
                        : fy.is_open
                          ? 'bg-emerald-500/15'
                          : 'bg-surface'
                    }`}
                  >
                    {fy.is_open ? (
                      <Unlock
                        className={`w-5 h-5 ${fy.is_current ? 'text-amber-400' : 'text-emerald-400'}`}
                      />
                    ) : (
                      <Lock className="w-5 h-5 text-ink/40" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{fy.year_label}</span>
                      {fy.is_current && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                          الحالية
                        </span>
                      )}
                      {!fy.is_open && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-ink/40 font-bold">
                          مقفلة
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink/40 mt-0.5">
                      {fy.start_date} ← {fy.end_date}
                    </div>
                    {fy.notes && <div className="text-xs text-ink/30 mt-0.5">{fy.notes}</div>}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    {fy.is_open && !fy.is_current && (
                      <button
                        onClick={() => setCurrent.mutate(fy.id)}
                        disabled={setCurrent.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl font-bold transition-colors border border-amber-500/20"
                      >
                        <CheckCircle className="w-3 h-3" />
                        تعيين كالحالية
                      </button>
                    )}
                    {fy.is_open && (
                      <>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `إنشاء قيود الإقفال لـ "${fy.year_label}"؟\n\nسيتم تصفير حسابات الإيرادات والمصروفات وترحيل الصافي للأرباح المحتجزة.`
                              )
                            )
                              closingEntriesMut.mutate(fy.id);
                          }}
                          disabled={closingEntriesMut.isPending}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-surface hover:bg-raised text-ink/50 rounded-xl font-bold transition-colors border border-line"
                        >
                          <BookMarked className="w-3 h-3" />
                          {closingEntriesMut.isPending ? '...' : 'قيود الإقفال'}
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `هل تريد إقفال "${fy.year_label}"؟ لن يمكن الترحيل عليها بعد الإقفال.`
                              )
                            )
                              closeMut.mutate(fy.id);
                          }}
                          disabled={closeMut.isPending}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl font-bold transition-colors border border-red-500/20"
                        >
                          <Lock className="w-3 h-3" />
                          إقفال
                        </button>
                      </>
                    )}
                    {!fy.is_open && (
                      <button
                        onClick={() => reopenMut.mutate(fy.id)}
                        disabled={reopenMut.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl font-bold transition-colors border border-emerald-500/20"
                      >
                        <Unlock className="w-3 h-3" />
                        إعادة فتح
                      </button>
                    )}
                    {fy.is_open && !fy.is_current && (
                      <button
                        onClick={() => {
                          if (confirm('حذف هذه السنة المالية؟')) deleteMut.mutate(fy.id);
                        }}
                        disabled={deleteMut.isPending}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-surface hover:bg-raised text-ink/40 hover:text-red-400 rounded-xl font-bold transition-colors border border-line"
                      >
                        <X className="w-3 h-3" />
                        حذف
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
