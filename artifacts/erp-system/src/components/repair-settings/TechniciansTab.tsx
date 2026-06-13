import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, CheckCircle2, Pencil, Bell, BellOff, Percent, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import type { ERP_User } from './shared';

interface TechSettings {
  commission: number;
  notifications: boolean;
  specialty: string;
}

export default function TechniciansTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery<ERP_User[]>({
    queryKey: ['/api/settings/users'],
    queryFn: async () => {
      const r = await authFetch(api('/api/settings/users'));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    },
    staleTime: 60_000,
    select: (d) => (Array.isArray(d) ? d : []),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<TechSettings>({
    commission: 0,
    notifications: true,
    specialty: '',
  });
  const [saving, setSaving] = useState(false);

  const getSettings = (u: ERP_User): TechSettings => ({
    commission: Number(u.repair_commission_pct ?? 0),
    notifications: u.repair_notifications ?? true,
    specialty: u.repair_specialty ?? '',
  });

  const startEdit = (u: ERP_User) => {
    setEditingId(u.id);
    setEditBuf(getSettings(u));
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const r = await authFetch(api(`/api/settings/users/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repair_commission_pct: Math.max(0, Math.min(100, Math.round(editBuf.commission))),
          repair_specialty: editBuf.specialty.trim() || null,
          repair_notifications: editBuf.notifications,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || 'تعذّر حفظ الإعدادات');
      }
      await qc.invalidateQueries({ queryKey: ['/api/settings/users'] });
      setEditingId(null);
      toast({ title: '✓ تم حفظ إعدادات الفني' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      toast({ title: msg || 'تعذّر حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const techUsers = (Array.isArray(users) ? users : []).filter((u) => u.active !== false);

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
        <div className="flex items-center gap-2 text-ink/30 text-[12px]">
          <Info className="w-3.5 h-3.5" />
          <span>تُحفظ الإعدادات في قاعدة البيانات لكل المستخدمين</span>
        </div>
        <span className="text-[11px] text-ink/20">{techUsers.length} فني</span>
      </div>

      <div className="overflow-y-auto flex-1">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-line border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && techUsers.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-ink/30 text-sm">
            <Users className="w-8 h-8 opacity-40" />
            لا يوجد مستخدمون نشطون
          </div>
        )}

        {!isLoading &&
          techUsers.map((u) => {
            const s = getSettings(u);
            const isEdit = editingId === u.id;
            return (
              <div
                key={u.id}
                className="border-b border-line last:border-b-0 px-4 py-3.5 hover:bg-surface transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* avatar */}
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 text-sm font-bold text-amber-300">
                    {u.name[0] ?? '؟'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-ink/85">{u.name}</span>
                      {u.role && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-ink/35">
                          {u.role}
                        </span>
                      )}
                    </div>

                    {!isEdit ? (
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[12px] text-ink/35">
                          <Percent className="w-3 h-3" /> {s.commission}%
                        </span>
                        <span className="text-ink/15">·</span>
                        {s.specialty && (
                          <span className="text-[12px] text-ink/35">{s.specialty}</span>
                        )}
                        {s.specialty && <span className="text-ink/15">·</span>}
                        <span
                          className={`flex items-center gap-1 text-[12px] ${s.notifications ? 'text-emerald-400/60' : 'text-ink/25'}`}
                        >
                          {s.notifications ? (
                            <Bell className="w-3 h-3" />
                          ) : (
                            <BellOff className="w-3 h-3" />
                          )}
                          {s.notifications ? 'إشعارات مفعّلة' : 'إشعارات مُعطّلة'}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-ink/35 w-24 shrink-0">التخصص</label>
                          <input
                            value={editBuf.specialty}
                            onChange={(e) =>
                              setEditBuf((b) => ({ ...b, specialty: e.target.value }))
                            }
                            placeholder="مثال: هواتف — شاشات"
                            className="erp-input flex-1 text-sm py-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-ink/35 w-24 shrink-0">
                            نسبة العمولة
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={editBuf.commission}
                              onChange={(e) =>
                                setEditBuf((b) => ({ ...b, commission: Number(e.target.value) }))
                              }
                              className="erp-input w-20 text-sm py-1 text-center"
                            />
                            <span className="text-ink/35 text-sm">%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-ink/35 w-24 shrink-0">الإشعارات</label>
                          <button
                            onClick={() =>
                              setEditBuf((b) => ({ ...b, notifications: !b.notifications }))
                            }
                            className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[12px] transition-all ${
                              editBuf.notifications
                                ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400'
                                : 'bg-surface border-line text-ink/35'
                            }`}
                          >
                            {editBuf.notifications ? (
                              <Bell className="w-3.5 h-3.5" />
                            ) : (
                              <BellOff className="w-3.5 h-3.5" />
                            )}
                            {editBuf.notifications ? 'مفعّلة' : 'مُعطّلة'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(u.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                            {saving ? 'جاري الحفظ...' : 'حفظ'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg border border-line text-ink/30 text-[12px] hover:border-line hover:text-ink/50 transition-colors disabled:opacity-40"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isEdit && (
                    <button
                      onClick={() => startEdit(u)}
                      className="text-ink/20 hover:text-ink/55 p-1.5 transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
