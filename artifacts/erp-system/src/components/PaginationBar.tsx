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
  itemLabel = "عنصر",
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-line mt-1">
      <span className="text-xs text-ink/40">
        عرض {start}–{end} من {totalItems} {itemLabel}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface border border-line text-ink/50 hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ←
          </button>
          {pageNums.map((p) => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                p === page
                  ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                  : "bg-surface border-line text-ink/40 hover:bg-surface"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface border border-line text-ink/50 hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
