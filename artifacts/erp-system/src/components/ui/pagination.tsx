import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = false,
  className,
}: PaginationProps) {
  /* Hooks must run unconditionally — compute page range for all cases */
  const pageRange = React.useMemo(() => {
    const delta = 2;
    const start = Math.max(1, currentPage - delta);
    const end   = Math.min(totalPages, currentPage + delta);
    const range: number[] = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const first = pageRange[0];
  const last  = pageRange[pageRange.length - 1];

  return (
    <nav
      className={cn('erp-pagination', className)}
      aria-label="التنقل بين الصفحات"
      dir="rtl"
    >
      <p className="erp-pagination-info">
        صفحة {currentPage} من {totalPages}
      </p>

      <div className="erp-pagination-controls">
        {showFirstLast && (
          <button
            type="button"
            className="erp-pagination-btn"
            onClick={() => onPageChange(1)}
            disabled={!canGoPrev}
            aria-label="الصفحة الأولى"
          >
            <ChevronsRight aria-hidden="true" />
          </button>
        )}

        {/* In RTL layout, ChevronRight = visual "back" = previous page */}
        <button
          type="button"
          className="erp-pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight aria-hidden="true" />
        </button>

        {first > 1 && (
          <>
            <button
              type="button"
              className="erp-pagination-btn"
              onClick={() => onPageChange(1)}
              aria-label="الصفحة 1"
            >
              1
            </button>
            {first > 2 && (
              <span className="erp-pagination-ellipsis" aria-hidden="true">
                …
              </span>
            )}
          </>
        )}

        {pageRange.map((page) => (
          <button
            key={page}
            type="button"
            className={cn(
              'erp-pagination-btn',
              page === currentPage && 'erp-pagination-btn--active',
            )}
            onClick={() => onPageChange(page)}
            aria-label={`الصفحة ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        {last < totalPages && (
          <>
            {last < totalPages - 1 && (
              <span className="erp-pagination-ellipsis" aria-hidden="true">
                …
              </span>
            )}
            <button
              type="button"
              className="erp-pagination-btn"
              onClick={() => onPageChange(totalPages)}
              aria-label={`الصفحة ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* In RTL layout, ChevronLeft = visual "forward" = next page */}
        <button
          type="button"
          className="erp-pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        {showFirstLast && (
          <button
            type="button"
            className="erp-pagination-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext}
            aria-label="الصفحة الأخيرة"
          >
            <ChevronsLeft aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}
