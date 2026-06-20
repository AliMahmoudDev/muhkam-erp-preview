import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, XCircle, Trash2, Pencil, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';

interface AccessoryRow {
  id: number;
  key_: string;
  label_ar: string;
  emoji: string | null;
  sort_order: number;
  active: boolean;
  is_system: boolean;
}

export default function AccessoriesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery<AccessoryRow[]>({
    queryKey: ['/api/repair-accessories'],
    queryFn: () =>
      authFetch(api('/api/repair-accessories'))
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });

  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState({ label_ar: '', emoji: '' });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['/api/repair-accessories'] });

  const createOne = async () => {
    if (!newLabel.trim()) {
      toast({ title: 'أدخل الاسم', variant: 'destructive' });
      return;
    }
    const key =
      newKey.trim() ||
      newLabel
        .trim()
        .toLowerCase()
        .replace(/[^\w]+/g, '_')
        .slice(0, 30);
    setBusy(true);
    try {
      const r = await authFetch(api('/api/repair-accessories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_: key,
          label_ar: newLabel.trim(),
          emoji: newEmoji.trim() || null,
          sort_order: items.length,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || 'تعذّر الإضافة');
      }
      setNewLabel('');
      setNewKey('');
      setNewEmoji('');
      await invalidate();
      toast({ title: '✓ تمت الإضافة' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: number) => {
    setBusy(true);
    try {
      const r = await authFetch(api(`/api/repair-accessories/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label_ar: editBuf.label_ar.trim(),
          emoji: editBuf.emoji.trim() || null,
        }),
      });
      if (!r.ok) throw new Error('تعذّر الحفظ');
      setEditId(null);
      await invalidate();
      toast({ title: '✓ تم الحفظ' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (it: AccessoryRow) => {
    setBusy(true);
    try {
      await authFetch(api(`/api/repair-accessories/${it.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !it.active }),
      });
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (id: number) => {
    if (!confirm('حذف هذا الإكسسوار نهائياً؟')) return;
    setBusy(true);
    try {
      const r = await authFetch(api(`/api/repair-accessories/${id}`), { method: 'DELETE' });
      if (!r.ok) throw new Error('تعذّر الحذف');
      await invalidate();
      toast({ title: '✓ تم الحذف' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-line">
          <Package className="w-5 h-5 text-ink/40 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-ink/60 mb-1">
              الإكسسوارات المستلمة مع الجهاز
            </p>
            <p className="text-[12px] text-ink/35 leading-relaxed">
              يظهر اختيارها للموظف عند فتح بطاقة صيانة جديدة لتسجيل ما تسلّمه من العميل (شاحن، علبة،
              إلخ).
            </p>
          </div>
        </div>

        {/* Add new */}
        <div className="rounded-xl border border-line overflow-hidden">
          <div className="px-4 py-3 bg-surface border-b border-line">
            <span className="text-[12px] font-semibold text-ink/50">إضافة إكسسوار جديد</span>
          </div>
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                placeholder="🎁"
                maxLength={2}
                className="erp-input col-span-1 text-center text-base py-1.5"
              />
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="الاسم بالعربية (مثال: زجاج حماية)"
                onKeyDown={(e) => e.key === 'Enter' && createOne()}
                className="erp-input col-span-7 text-sm py-1.5"
              />
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="معرّف (اختياري)"
                className="erp-input col-span-3 text-[11px] py-1.5 font-mono"
              />
              <button
                onClick={createOne}
                disabled={busy || !newLabel.trim()}
                className="col-span-1 px-2 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-30 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl border border-line overflow-hidden">
          <div className="px-4 py-3 bg-surface border-b border-line flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink/50">الإكسسوارات الحالية</span>
            <span className="text-[11px] text-ink/25">{items.length}</span>
          </div>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-line border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
          {!isLoading && items.length === 0 && (
            <p className="text-center py-12 text-ink/30 text-sm">لا توجد إكسسوارات بعد</p>
          )}
          <div className="divide-y divide-white/5">
            {items.map((it) => (
              <div
                key={it.id}
                className={`flex items-center gap-2 px-3 py-2.5 hover:bg-surface transition-colors ${!it.active ? 'opacity-40' : ''}`}
              >
                <span className="text-lg w-7 text-center">{it.emoji ?? '✨'}</span>
                {editId === it.id ? (
                  <>
                    <input
                      value={editBuf.emoji}
                      onChange={(e) => setEditBuf((b) => ({ ...b, emoji: e.target.value }))}
                      maxLength={2}
                      className="erp-input w-12 text-center py-1 text-sm"
                      placeholder="🔧"
                    />
                    <input
                      value={editBuf.label_ar}
                      onChange={(e) => setEditBuf((b) => ({ ...b, label_ar: e.target.value }))}
                      className="erp-input flex-1 py-1 text-sm"
                    />
                    <button
                      onClick={() => saveEdit(it.id)}
                      disabled={busy}
                      className="text-emerald-400 hover:text-emerald-300 p-1 disabled:opacity-30"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="text-ink/30 hover:text-ink/60 p-1"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-ink/75">{it.label_ar}</span>
                    <code className="text-[10px] text-ink/20 font-mono">{it.key_}</code>
                    {it.is_system && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400/70">
                        افتراضي
                      </span>
                    )}
                    <button
                      onClick={() => toggleActive(it)}
                      disabled={busy}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${it.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface text-ink/30'}`}
                    >
                      {it.active ? 'مفعّل' : 'موقوف'}
                    </button>
                    <button
                      onClick={() => {
                        setEditId(it.id);
                        setEditBuf({ label_ar: it.label_ar, emoji: it.emoji ?? '' });
                      }}
                      className="text-ink/25 hover:text-ink/55 p-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!it.is_system && (
                      <button
                        onClick={() => removeOne(it.id)}
                        disabled={busy}
                        className="text-red-400/50 hover:text-red-400 p-1 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DEFAULTS TAB — warranty days
══════════════════════════════════════════════════════════════ */
