/* eslint-disable erp/no-hardcoded-colors -- Landing mockups are purely presentational marketing visuals with intentional fixed colors; tokens do not apply here. */
/**
 * Mini mockup components for the Landing Page bento grid.
 * Extracted from LandingPage.tsx for maintainability.
 * These are purely presentational — no state, no API calls.
 */

export function MiniAccounting() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {([['إيرادات', '١٢٤٫٨ك', '#10B981'], ['مصروفات', '٤٨٫٢ك', '#EF4444'], ['أرباح', '٧٦٫٦ك', '#3B82F6']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, background: '#0F172A', borderRadius: 6, padding: '7px 8px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: 9, color: '#64748B', marginBottom: 3 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 44 }}>
        {[55, 75, 48, 90, 62, 82, 70].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.3)' }} />
        ))}
      </div>
    </div>
  );
}

export function MiniSales() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ fontSize: 9, color: '#64748B', marginBottom: 7 }}>فاتورة #٢٤١٩</div>
      {([['iPhone 15 Pro', '٢٥٫٥٠٠ ج'], ['Apple Watch', '٨٫٩٠٠ ج'], ['AirPods Pro', '٣٫٢٠٠ ج']] as [string, string][]).map(([name, price]) => (
        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1E293B', fontSize: 10 }}>
          <span style={{ color: '#94A3B8' }}>{name}</span>
          <span style={{ color: '#60A5FA', fontWeight: 600 }}>{price}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: '#64748B' }}>الإجمالي</span>
        <span style={{ color: '#3B82F6' }}>٣٧٫٦٠٠ ج</span>
      </div>
    </div>
  );
}

export function MiniInventory() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      {([['iPhone 15', '٤٨', 88], ['Samsung S24', '١٢', 22], ['Xiaomi 14', '٨٩', 95]] as [string, string, number][]).map(([name, qty, pct]) => (
        <div key={name} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: '#94A3B8' }}>{name}</span>
            <span style={{ color: '#10B981', fontWeight: 600 }}>{qty} وحدة</span>
          </div>
          <div style={{ height: 4, background: '#1E293B', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct < 30 ? '#EF4444' : '#10B981', borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniHR() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      {([['أحمد محمد', 'مدير مبيعات', [1, 1, 1, 1, 0]], ['سارة خالد', 'محاسبة', [1, 1, 1, 1, 1]], ['محمود علي', 'فني', [1, 1, 0, 1, 1]], ['نور حسن', 'كاشير', [1, 1, 1, 0, 1]]] as [string, string, number[]][]).map(([name, role, days]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, color: '#60A5FA', fontWeight: 700 }}>{name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.2 }}>{name}</div>
            <div style={{ fontSize: 9, color: '#64748B' }}>{role}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {days.map((d, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: d ? '#3B82F6' : '#1E293B' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniRepair() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: '#64748B' }}>#١٠٤٢ — iPhone 15</span>
        <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60A5FA', fontSize: 9, fontWeight: 600 }}>قيد الإصلاح</span>
      </div>
      {([['الفني', 'أحمد حسن'], ['العطل', 'شاشة مكسورة'], ['التكلفة', '٨٥٠ ج']] as [string, string][]).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10 }}>
          <span style={{ color: '#64748B' }}>{k}</span>
          <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, height: 4, background: '#1E293B', borderRadius: 2 }}>
        <div style={{ height: '100%', width: '65%', background: '#3B82F6', borderRadius: 2 }} />
      </div>
    </div>
  );
}

export function MiniReports() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ fontSize: 9, color: '#64748B', marginBottom: 8 }}>أداء المبيعات — هذا الشهر</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52, marginBottom: 6 }}>
        {[38, 55, 42, 70, 58, 88, 72].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.25)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {(['س', 'أح', 'إث', 'ث', 'خ', 'ج', 'سب']).map(d => (
          <span key={d} style={{ fontSize: 8, color: '#475569', flex: 1, textAlign: 'center' }}>{d}</span>
        ))}
      </div>
    </div>
  );
}

export function MiniBank() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      {([['دفع مورد', '-٨٫٥٠٠', '#EF4444'], ['تحصيل عميل', '+٢٢٫٠٠٠', '#10B981'], ['مصاريف إدارية', '-١٫٢٠٠', '#EF4444']] as [string, string, string][]).map(([desc, amount, color]) => (
        <div key={desc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{desc}</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color }}>{amount} ج</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: '#64748B' }}>صافي</span>
        <span style={{ color: '#3B82F6' }}>+١٢٫٣٠٠ ج</span>
      </div>
    </div>
  );
}

export function MiniMobile() {
  const phone = (content: React.ReactNode) => (
    <div style={{ width: 92, background: '#0B1220', borderRadius: 14, border: '1px solid #1E293B', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 22, height: 2, background: 'rgba(59, 130, 246, 0.5)', borderRadius: 1 }} />
      </div>
      <div style={{ padding: '7px 8px' }}>{content}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 14, display: 'flex', gap: 12, justifyContent: 'center' }}>
      {phone(
        <>
          <div style={{ fontSize: 8, color: '#64748B', marginBottom: 5 }}>الحضور GPS</div>
          <div style={{ width: '100%', height: 38, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 6, position: 'relative', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ position: 'absolute', bottom: 4, right: 4, width: 4, height: 4, borderRadius: '50%', background: '#3B82F6' }} />
          </div>
          <div style={{ marginTop: 4, fontSize: 8, color: '#3B82F6', fontWeight: 700, textAlign: 'center' }}>حضر ✓</div>
        </>
      )}
      {phone(
        <>
          <div style={{ fontSize: 8, color: '#64748B', marginBottom: 5 }}>فاتورة سريعة</div>
          {['منتج ١', 'منتج ٢'].map(p => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '2px 0', borderBottom: '1px solid #1E293B' }}>
              <span style={{ color: '#94A3B8' }}>{p}</span>
              <span style={{ color: '#60A5FA', fontWeight: 600 }}>٢٥٠ ج</span>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: '3px 6px', borderRadius: 4, background: '#2563EB', textAlign: 'center', fontSize: 8, color: '#fff', fontWeight: 600 }}>إصدار</div>
        </>
      )}
      {phone(
        <>
          <div style={{ fontSize: 8, color: '#64748B', marginBottom: 5 }}>أداء اليوم</div>
          {[['مبيعات', '١٢'], ['مرتجع', '٢'], ['تحصيل', '٨٫٥ك']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '2px 0' }}>
              <span style={{ color: '#94A3B8' }}>{l}</span>
              <span style={{ color: '#60A5FA', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
