import { C, FONT } from '../types';
import { PageBtn } from '../ui';

export function CompaniesPagination({
  filtered,
  safePage,
  perPage,
  totalPages,
  setPage,
}: {
  filtered: { length: number };
  safePage: number;
  perPage: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        padding: '12px 24px',
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        background: 'rgba(249,115,22,0.03)',
      }}
    >
      <span style={{ fontSize: '12px', color: C.muted }}>
        عرض {filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1}–
        {Math.min(safePage * perPage, filtered.length)} من {filtered.length} شركة
        {' · '}الصفحة {safePage} من {totalPages}
      </span>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PageBtn label="السابق" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} />
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const start = Math.max(1, safePage - 3);
            return start + i;
          })
            .filter((p) => p <= totalPages)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.15s',
                  border: p === safePage ? 'none' : `1px solid ${C.border}`,
                  background: p === safePage ? C.orange : 'transparent',
                  color: p === safePage ? 'var(--text-1)' : C.muted,
                }}
              >
                {p}
              </button>
            ))}
          <PageBtn
            label="التالي"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          />
        </div>
      )}
    </div>
  );
}
