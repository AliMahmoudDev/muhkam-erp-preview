import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginationBarProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function PaginationBar({
  page,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'عنصر',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pageNums = (() => {
    const count = Math.min(5, totalPages);
    const startPg = Math.max(1, Math.min(page - 2, totalPages - count + 1));
    return Array.from({ length: count }, (_, i) => startPg + i);
  })();

  if (totalItems === 0) return null;

  return (
    <div className="erp-pagination">
      <span className="erp-pagination-info">
        عرض {start}–{end} من {totalItems} {itemLabel}
      </span>

      {totalPages > 1 && (
        <div className="erp-pagination-controls">
          <button
            aria-label="الصفحة السابقة"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="erp-pagination-btn"
          >
            <ChevronRight size={16} />
          </button>

          {pageNums.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`erp-pagination-btn${p === page ? ' erp-pagination-btn--active' : ''}`}
            >
              {p}
            </button>
          ))}

          <button
            aria-label="الصفحة التالية"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="erp-pagination-btn"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
