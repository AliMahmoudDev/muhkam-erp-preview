import { useState } from 'react';
import {
  X,
  ShoppingCart,
  ReceiptText,
  Wrench,
  ShoppingBag,
  Users,
  Package,
  CreditCard,
  FileText,
  Landmark,
  DollarSign,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';

export interface ShortcutDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  path: string;
  color: string;
}

export const ALL_SHORTCUTS: ShortcutDef[] = [
  { id: 'new-sale',        label: 'فاتورة مبيعات جديدة',  icon: ShoppingCart, path: '/sales/new',        color: '#f59e0b' },
  { id: 'new-receipt',     label: 'سند قبض',               icon: ReceiptText,  path: '/receipts/new',     color: '#34d399' },
  { id: 'new-repair',      label: 'بطاقة صيانة جديدة',    icon: Wrench,       path: '/repairs/new',      color: '#818cf8' },
  { id: 'new-purchase',    label: 'فاتورة مشتريات',        icon: ShoppingBag,  path: '/purchases/new',    color: '#60a5fa' },
  { id: 'new-customer',    label: 'إضافة عميل',            icon: Users,        path: '/customers/new',    color: '#fb923c' },
  { id: 'inventory',       label: 'المخزون',               icon: Package,      path: '/inventory',        color: '#a78bfa' },
  { id: 'payment-voucher', label: 'سند صرف',               icon: CreditCard,   path: '/payments/new',     color: '#f87171' },
  { id: 'expense',         label: 'تسجيل مصروف',           icon: DollarSign,   path: '/expenses/new',     color: '#f9a8d4' },
  { id: 'journal',         label: 'قيد يومية',             icon: Landmark,     path: '/accounting/new',   color: '#67e8f9' },
  { id: 'reports',         label: 'التقارير',              icon: FileText,     path: '/reports',          color: '#86efac' },
  { id: 'new-supplier',    label: 'إضافة مورد',            icon: PlusCircle,   path: '/suppliers/new',    color: '#fcd34d' },
];

interface Props {
  current: string[];
  onSave: (ids: string[]) => Promise<unknown>;
  onClose: () => void;
  saving?: boolean;
}

export default function ShortcutsCustomizer({ current, onSave, onClose, saving }: Props) {
  const [selected, setSelected] = useState<string[]>(current);

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 8 ? [...prev, id] : prev,
    );
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...selected];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSelected(next);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          width: '90%',
          maxWidth: 620,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, margin: 0 }}>تخصيص الاختصارات</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '4px 0 0' }}>اختر حتى 8 اختصارات وارتّبها</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left — all shortcuts */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>الاختصارات المتاحة</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALL_SHORTCUTS.map(s => {
                const Icon = s.icon;
                const active = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: `1px solid ${active ? s.color + '55' : 'rgba(255,255,255,0.06)'}`,
                      background: active ? s.color + '18' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      textAlign: 'right',
                      transition: 'all 0.15s',
                      opacity: !active && selected.length >= 8 ? 0.4 : 1,
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: s.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 16, height: 16, color: s.color }} />
                    </div>
                    <span style={{ color: active ? '#f1f5f9' : 'rgba(255,255,255,0.65)', fontSize: 14, flex: 1 }}>{s.label}</span>
                    {active && <Check style={{ width: 15, height: 15, color: s.color, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — selected order */}
          <div style={{ width: 220, flexShrink: 0, overflowY: 'auto', padding: 20 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              الترتيب ({selected.length}/8)
            </p>
            {selected.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>لم يتم اختيار أي اختصار بعد</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.map((id, idx) => {
                const def = ALL_SHORTCUTS.find(s => s.id === id);
                if (!def) return null;
                const Icon = def.icon;
                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Icon style={{ width: 14, height: 14, color: def.color, flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: 2, opacity: idx === 0 ? 0.2 : 0.7 }}>
                        <ArrowUp style={{ width: 12, height: 12, color: '#94a3b8' }} />
                      </button>
                      <button onClick={() => move(idx, 1)} disabled={idx === selected.length - 1} style={{ background: 'none', border: 'none', cursor: idx === selected.length - 1 ? 'default' : 'pointer', padding: 2, opacity: idx === selected.length - 1 ? 0.2 : 0.7 }}>
                        <ArrowDown style={{ width: 12, height: 12, color: '#94a3b8' }} />
                      </button>
                    </div>
                    <button
                      onClick={() => setSelected(prev => prev.filter(x => x !== id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.5 }}
                    >
                      <X style={{ width: 12, height: 12, color: '#f87171' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer' }}
          >
            إلغاء
          </button>
          <button
            onClick={() => onSave(selected)}
            disabled={saving}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: saving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
