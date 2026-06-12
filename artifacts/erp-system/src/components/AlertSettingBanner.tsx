/**
 * AlertSettingBanner — شريط إعداد تنبيه مدمج داخل الصفحة
 * يُستخدم في: المخزون (انخفاض المخزون) · الضمان (انتهاء الضمان) · العملاء (الديون)
 */
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { Save, CheckCircle2, Loader2 } from 'lucide-react';

interface AlertSettingBannerProps {
  enabledKey: string;
  thresholdKey?: string;
  thresholdLabel?: string;
  thresholdUnit?: string;
  title: string;
  icon: string;
  color?: 'amber' | 'orange' | 'blue' | 'red';
  defaultThreshold?: string;
}

const COLOR_MAP = {
  amber:  { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  text: 'var(--status-warning)', toggle: 'var(--status-warning)' },
  orange: { bg: 'rgba(249,115,22,0.07)',  border: 'rgba(249,115,22,0.22)',  text: '#fb923c', toggle: 'var(--status-warning)' },
  blue:   { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.22)',  text: 'var(--status-info)', toggle: 'var(--status-info)' },
  red:    { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.22)',   text: 'var(--status-danger)', toggle: 'var(--status-danger)' },
};

export function AlertSettingBanner({
  enabledKey,
  thresholdKey,
  thresholdLabel,
  thresholdUnit,
  title,
  icon,
  color = 'amber',
  defaultThreshold = '5',
}: AlertSettingBannerProps) {
  const { toast } = useToast();
  const [enabled,   setEnabled]   = useState(true);
  const [threshold, setThreshold] = useState(defaultThreshold);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [dirty,     setDirty]     = useState(false);

  useEffect(() => {
    authFetch(api('/api/settings/system'))
      .then(async r => {
        if (!r.ok) return {};
        const text = await r.text();
        if (!text) return {};
        try { return JSON.parse(text) as Record<string, string>; } catch { return {}; }
      })
      .then((data: Record<string, string>) => {
        setEnabled(data[enabledKey] !== '0');
        if (thresholdKey && data[thresholdKey]) setThreshold(data[thresholdKey]);
      })
      .catch(() => { /* ignore — banner stays at defaults */ })
      .finally(() => setLoading(false));
  }, [enabledKey, thresholdKey]);

  async function handleSave() {
    setSaving(true);
    try {
      const calls: Promise<Response>[] = [
        authFetch(api('/api/settings/system'), {
          method: 'POST',
          body: JSON.stringify({ key: enabledKey, value: enabled ? '1' : '0' }),
        }),
      ];
      if (thresholdKey && threshold) {
        calls.push(
          authFetch(api('/api/settings/system'), {
            method: 'POST',
            body: JSON.stringify({ key: thresholdKey, value: threshold }),
          })
        );
      }
      await Promise.all(calls);
      setSaved(true);
      setDirty(false);
      toast({ title: `✅ تم حفظ إعداد ${title}` });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'فشل الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const c = COLOR_MAP[color];

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '9px 14px', borderRadius: 12,
        background: c.bg, border: `1px solid ${c.border}`,
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontWeight: 700, color: c.text, fontSize: 12.5, whiteSpace: 'nowrap' }}>
        {title}
      </span>

      <button
        type="button"
        onClick={() => { setEnabled(e => !e); setDirty(true); setSaved(false); }}
        title={enabled ? 'انقر لتعطيل التنبيه' : 'انقر لتفعيل التنبيه'}
        style={{
          position: 'relative', width: 38, height: 20, borderRadius: 10,
          background: enabled ? c.toggle : 'rgba(255,255,255,0.12)',
          border: 'none', cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2,
          right: enabled ? 2 : undefined,
          left: enabled ? undefined : 2,
          width: 16, height: 16, borderRadius: 8,
          background: 'var(--text-1)', transition: 'all 0.2s',
          display: 'block',
        }} />
      </button>
      <span style={{ color: 'var(--erp-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
        {enabled ? 'مفعّل' : 'معطّل'}
      </span>

      {thresholdKey && enabled && (
        <>
          <span style={{ color: 'var(--erp-text-4)', fontSize: 11 }}>|</span>
          {thresholdLabel && (
            <span style={{ color: 'var(--erp-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
              {thresholdLabel}:
            </span>
          )}
          <input
            type="number"
            min="1"
            value={threshold}
            onChange={e => { setThreshold(e.target.value); setDirty(true); setSaved(false); }}
            style={{
              width: 56, padding: '2px 6px', borderRadius: 6,
              background: 'var(--erp-bg-hover)',
              border: '1px solid var(--erp-border)',
              color: 'var(--erp-text-1)', fontSize: 12, textAlign: 'center', outline: 'none',
            }}
          />
          {thresholdUnit && (
            <span style={{ color: 'var(--erp-text-3)', fontSize: 11 }}>{thresholdUnit}</span>
          )}
        </>
      )}

      {dirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginRight: 'auto', padding: '3px 10px', borderRadius: 7,
            background: c.toggle, border: 'none', color: 'var(--text-1)',
            fontWeight: 700, fontSize: 11, cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving   ? <Loader2      style={{ width: 10, height: 10 }} className="animate-spin" />
          : saved   ? <CheckCircle2 style={{ width: 10, height: 10 }} />
          :           <Save         style={{ width: 10, height: 10 }} />}
          {saving ? 'جارٍ…' : saved ? 'محفوظ' : 'حفظ'}
        </button>
      )}
    </div>
  );
}
