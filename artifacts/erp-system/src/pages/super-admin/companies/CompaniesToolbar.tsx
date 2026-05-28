import { C, FONT } from '../types';

export function CompaniesToolbar({
  search, setSearch, statusFilter, setStatusFilter,
  STATUS_FILTERS, perPage, setPerPage,
  viewMode, setViewMode,
}: {
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  STATUS_FILTERS: { key: string; label: string }[];
  perPage: number; setPerPage: (v: number) => void;
  viewMode: 'table' | 'cards'; setViewMode: (v: 'table' | 'cards') => void;
}) {
  return (
    <div style={{
      padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
    }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
        <span style={{ position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن شركة…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 36px 8px 12px', borderRadius: '10px',
            border: `1.5px solid ${C.border}`, background: C.bg,
            color: C.text, fontSize: '13px', fontFamily: FONT,
            outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = C.orange; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
        />
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                transition: 'all 0.15s',
                border: active ? 'none' : `1px solid ${C.border}`,
                background: active ? C.orange : 'transparent',
                color: active ? '#fff' : C.muted,
              }}
            >{f.label}</button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' }}>عدد الصفوف:</span>
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          style={{
            padding: '6px 10px', borderRadius: '8px', border: `1px solid ${C.border}`,
            background: C.bg, color: C.text, fontSize: '12px',
            fontFamily: FONT, cursor: 'pointer', outline: 'none',
          }}
        >
          {[10, 25, 50, 100].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '4px', background: C.bg, borderRadius: '10px', border: `1px solid ${C.border}`, padding: '3px' }}>
        {(['table', 'cards'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            title={m === 'table' ? 'عرض جدول' : 'عرض بطاقات'}
            style={{
              padding: '5px 10px', borderRadius: '7px', border: 'none',
              background: viewMode === m ? C.orange : 'transparent',
              color: viewMode === m ? '#fff' : C.muted,
              fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1,
            }}
          >
            {m === 'table' ? '☰' : '⊞'}
          </button>
        ))}
      </div>
    </div>
  );
}
