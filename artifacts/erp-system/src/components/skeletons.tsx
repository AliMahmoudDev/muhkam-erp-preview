import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  cols?: number;
  rows?: number;
}

export function TableSkeleton({ cols = 5, rows = 6 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="erp-table-row">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="erp-table-td">
              <Skeleton
                className="erp-shimmer"
                style={{
                  height: 14,
                  borderRadius: 6,
                  width:
                    j === 0 ? '65%' : j === cols - 1 ? '36%' : `${52 + ((i * 7 + j * 13) % 28)}%`,
                  animationDelay: `${(i * cols + j) * 0.04}s`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-start">
            <Skeleton className="erp-shimmer" style={{ height: 18, width: 120, borderRadius: 6 }} />
            <Skeleton className="erp-shimmer" style={{ height: 32, width: 32, borderRadius: 10 }} />
          </div>
          <Skeleton className="erp-shimmer" style={{ height: 26, width: 96, borderRadius: 6 }} />
          <Skeleton className="erp-shimmer" style={{ height: 12, width: 180, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card">
          <Skeleton className="erp-shimmer" style={{ height: 14, width: 80, borderRadius: 4, marginBottom: 12 }} />
          <Skeleton className="erp-shimmer" style={{ height: 30, width: 110, borderRadius: 6, marginBottom: 8 }} />
          <Skeleton className="erp-shimmer" style={{ height: 11, width: 64, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}
