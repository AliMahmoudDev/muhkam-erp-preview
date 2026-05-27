/**
 * Balance Sheet drill-down panels — customer & inventory detail tables.
 * Extracted from BalanceSheetReport.tsx for maintainability.
 */
import { useQuery } from '@tanstack/react-query';
import { api, authFetch, formatCurrency } from '../shared';
import { useTheme, type DrillCustomer, type DrillProduct } from './types';

export function CustomerDrill({ isSupplier }: { isSupplier: boolean }) {
  const { isLight, txtSub, bdColor } = useTheme();
  const { data, isLoading } = useQuery<DrillCustomer[]>({
    queryKey: ['drill-customers', isSupplier],
    queryFn: () =>
      authFetch(api('/api/customers')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 60_000,
  });

  const filtered = (data ?? [])
    .filter((c) => {
      const bal = Number(c.balance);
      if (isSupplier) return c.is_supplier && bal < -0.001;
      else return !c.is_supplier && bal > 0.001;
    })
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)));

  if (isLoading)
    return <p style={{ fontSize: 11, color: txtSub, padding: '8px 4px' }}>جاري التحميل…</p>;
  if (!filtered.length)
    return <p style={{ fontSize: 11, color: txtSub, padding: '8px 4px' }}>لا توجد أرصدة مفتوحة</p>;

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${bdColor}`, marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, fontFamily: "'Tajawal','Cairo',sans-serif" }}>
        <thead>
          <tr style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)' }}>
            <th style={{ textAlign: 'right', padding: '5px 10px', color: txtSub, fontWeight: 700 }}>الاسم</th>
            <th style={{ textAlign: 'left', padding: '5px 10px', color: txtSub, fontWeight: 700 }}>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} style={{ borderTop: `1px solid ${bdColor}` }}>
              <td style={{ padding: '5px 10px', color: isLight ? '#374151' : 'rgba(255,255,255,0.75)' }}>
                {c.name}
                {c.is_supplier && !isSupplier && (
                  <span style={{ fontSize: 9, marginRight: 4, color: '#6366f1', fontWeight: 700 }}>مورد</span>
                )}
              </td>
              <td style={{ padding: '5px 10px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: isSupplier ? '#ef4444' : '#d97706' }}>
                {formatCurrency(Math.abs(Number(c.balance)))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.04)', borderTop: `2px solid ${bdColor}` }}>
            <td style={{ padding: '5px 10px', fontWeight: 700, fontSize: 11, color: txtSub }}>
              {isSupplier ? 'إجمالي ذمم دائنة' : 'إجمالي ذمم مدينة'} ({filtered.length} {isSupplier ? 'مورد' : 'عميل'})
            </td>
            <td style={{ padding: '5px 10px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: isSupplier ? '#ef4444' : '#d97706' }}>
              {formatCurrency(filtered.reduce((s, c) => s + Math.abs(Number(c.balance)), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function InventoryDrill() {
  const { isLight, txtSub, bdColor } = useTheme();
  const { data, isLoading } = useQuery<DrillProduct[]>({
    queryKey: ['drill-products'],
    queryFn: () =>
      authFetch(api('/api/products')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 60_000,
  });

  const filtered = (data ?? [])
    .filter((p) => Number(p.quantity) > 0)
    .map((p) => ({ ...p, value: Number(p.quantity) * Number(p.cost_price) }))
    .sort((a, b) => b.value - a.value);

  if (isLoading)
    return <p style={{ fontSize: 11, color: txtSub, padding: '8px 4px' }}>جاري التحميل…</p>;
  if (!filtered.length)
    return <p style={{ fontSize: 11, color: txtSub, padding: '8px 4px' }}>لا يوجد مخزون حالياً</p>;

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${bdColor}`, marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, fontFamily: "'Tajawal','Cairo',sans-serif" }}>
        <thead>
          <tr style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)' }}>
            <th style={{ textAlign: 'right', padding: '5px 10px', color: txtSub, fontWeight: 700 }}>المنتج</th>
            <th style={{ textAlign: 'center', padding: '5px 10px', color: txtSub, fontWeight: 700 }}>الكمية</th>
            <th style={{ textAlign: 'center', padding: '5px 10px', color: txtSub, fontWeight: 700 }}>سعر التكلفة</th>
            <th style={{ textAlign: 'left', padding: '5px 10px', color: txtSub, fontWeight: 700 }}>القيمة</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} style={{ borderTop: `1px solid ${bdColor}` }}>
              <td style={{ padding: '5px 10px', color: isLight ? '#374151' : 'rgba(255,255,255,0.75)' }}>{p.name}</td>
              <td style={{ padding: '5px 10px', textAlign: 'center', color: isLight ? '#374151' : 'rgba(255,255,255,0.75)' }}>{Math.round(Number(p.quantity))}</td>
              <td style={{ padding: '5px 10px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: isLight ? '#374151' : 'rgba(255,255,255,0.75)' }}>{formatCurrency(Number(p.cost_price))}</td>
              <td style={{ padding: '5px 10px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#059669' }}>{formatCurrency(p.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.04)', borderTop: `2px solid ${bdColor}` }}>
            <td colSpan={3} style={{ padding: '5px 10px', fontWeight: 700, fontSize: 11, color: txtSub }}>
              إجمالي قيمة المخزون ({filtered.length} منتج)
            </td>
            <td style={{ padding: '5px 10px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#059669' }}>
              {formatCurrency(filtered.reduce((s, p) => s + p.value, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
