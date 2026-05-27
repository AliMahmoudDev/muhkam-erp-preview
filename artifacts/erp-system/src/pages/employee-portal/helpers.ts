import { Sun, Moon, Coffee } from 'lucide-react';

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */

export function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function fmtTime(val: unknown): string {
  if (!val) return '—';
  const s = String(val);
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function fmtDate(val: unknown, showWeekday = true): string {
  if (!val) return '—';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, day] = s.split('-').map(Number);
    return new Date(y, mo - 1, day).toLocaleDateString('ar-EG', {
      ...(showWeekday ? { weekday: 'short' } : {}),
      day: 'numeric', month: 'short', year: showWeekday ? undefined : 'numeric',
    });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('ar-EG', { ...(showWeekday ? { weekday: 'short' } : {}), day: 'numeric', month: 'short' });
}

export function fmtCurrency(val: unknown, currency = 'EGP'): string {
  const n = parseFloat(String(val ?? '0'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + currency;
}

export function todayStr() { return new Date().toISOString().split('T')[0]; }

export function nDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function greetingText(): { text: string; Icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'صباح الخير', Icon: Sun };
  if (h < 17) return { text: 'مساء الخير', Icon: Coffee };
  return { text: 'مساء النور', Icon: Moon };
}

export function calcDuration(checkIn: unknown, checkOut: unknown): string {
  if (!checkIn) return '—';
  const parse = (v: unknown) => {
    const s = String(v ?? '');
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const [h, m, sec = 0] = s.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, sec, 0); return d;
    }
    return new Date(s);
  };
  const inD = parse(checkIn);
  const outD = checkOut ? parse(checkOut) : new Date();
  const mins = Math.max(0, Math.round((outD.getTime() - inD.getTime()) / 60000));
  return `${Math.floor(mins / 60)}س ${mins % 60}د`;
}
