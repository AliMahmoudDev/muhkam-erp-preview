import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  cols?: number;
  rows?: number;
}

export function TableSkeleton({ cols = 5, rows = 6 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-line">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-4">
              <Skeleton
                className="h-4 rounded-lg skeleton-layer"
                style={{
                  width: j === 0 ? "70%" : j === cols - 1 ? "40%" : `${55 + (i * 7 + j * 13) % 30}%`,
                  animationDuration: `${1.2 + i * 0.1}s`,
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
            <Skeleton className="h-5 w-32 rounded-lg skeleton-layer" />
            <Skeleton className="h-8 w-8 rounded-xl skeleton-layer" />
          </div>
          <Skeleton className="h-7 w-24 rounded-lg skeleton-layer" />
          <Skeleton className="h-3 w-48 rounded-lg skeleton-layer-dim" />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card stat-card-skeleton">
          <Skeleton className="h-4 w-20 rounded-lg mb-3 skeleton-layer" />
          <Skeleton className="h-8 w-28 rounded-xl mb-2 skeleton-layer" />
          <Skeleton className="h-3 w-16 rounded-lg skeleton-layer-dim" />
        </div>
      ))}
    </div>
  );
}
