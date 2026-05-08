/**
 * request-counter.ts — in-process request metrics collector.
 *
 * Tracks (all in-memory, no DB):
 *   • total requests, status-code distribution
 *   • p50 / p95 / p99 latency over a 10 000-sample sliding window
 *   • per-route latency + error stats (for slowest-endpoint reporting)
 *   • active connections gauge
 *   • sliding 60-second request timestamps (for req/min)
 *   • total error count (status ≥ 400)
 */

interface Bucket {
  count: number;
  latencies: number[];
  errors: number;
}

interface RouteStats {
  count: number;
  totalMs: number;
  errors: number;
  latencies: number[]; // capped at ROUTE_SAMPLE per route
}

const WINDOW_MAX = 10_000; // global latency window
const ROUTE_SAMPLE = 500; // latency samples kept per route
const MINUTE_MS = 60_000;

const bucket: Bucket = { count: 0, latencies: [], errors: 0 };
const statusCodes: Record<string, number> = {};
const routeMap = new Map<string, RouteStats>();
const recentTs: number[] = []; // timestamps for req/min sliding window

let activeConnections = 0;
let startedAt = Date.now();

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Collapse UUID / numeric path segments so routes don't explode cardinality. */
export function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/\d+/g, '/:id');
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}

/* ── Active-connection gauge ────────────────────────────────────────── */

export function incrementActiveConnections(): void {
  activeConnections++;
}
export function decrementActiveConnections(): void {
  if (activeConnections > 0) activeConnections--;
}
export function getActiveConnections(): number {
  return activeConnections;
}

/* ── Core recorder (called per response) ───────────────────────────── */

/**
 * Record one completed HTTP request.
 *
 * @param statusCode  HTTP response status
 * @param durationMs  Total response time in milliseconds
 * @param routeKey    Optional normalised "METHOD /path" string for per-route stats
 */
export function recordRequest(statusCode: number, durationMs: number, routeKey?: string): void {
  const isError = statusCode >= 400;

  bucket.count++;
  if (isError) bucket.errors++;
  statusCodes[String(statusCode)] = (statusCodes[String(statusCode)] ?? 0) + 1;

  bucket.latencies.push(durationMs);
  if (bucket.latencies.length > WINDOW_MAX)
    bucket.latencies.splice(0, bucket.latencies.length - WINDOW_MAX);

  /* sliding-minute window */
  const now = Date.now();
  const cutoff = now - MINUTE_MS;
  recentTs.push(now);
  while (recentTs.length && recentTs[0] < cutoff) recentTs.shift();

  /* per-route stats */
  if (routeKey) {
    const r = routeMap.get(routeKey) ?? { count: 0, totalMs: 0, errors: 0, latencies: [] };
    r.count++;
    r.totalMs += durationMs;
    if (isError) r.errors++;
    r.latencies.push(durationMs);
    if (r.latencies.length > ROUTE_SAMPLE) r.latencies.splice(0, r.latencies.length - ROUTE_SAMPLE);
    routeMap.set(routeKey, r);
  }
}

/* ── Read-only accessors ─────────────────────────────────────────────── */

export function getMetrics() {
  const sorted = [...bucket.latencies].sort((a, b) => a - b);
  return {
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    total_requests: bucket.count,
    status_codes: statusCodes,
    latency_ms: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      samples: sorted.length,
    },
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };
}

/** Requests in the last 60 seconds. */
export function getRequestsPerMinute(): number {
  const cutoff = Date.now() - MINUTE_MS;
  return recentTs.filter((t) => t >= cutoff).length;
}

/** Error rate as a percentage (0-100, 2 decimal places). */
export function getErrorRate(): number {
  if (!bucket.count) return 0;
  return Math.round((bucket.errors / bucket.count) * 10_000) / 100;
}

/** Raw total error count (status ≥ 400). */
export function getTotalErrors(): number {
  return bucket.errors;
}

/**
 * Top `limit` slowest routes by average response time.
 * Returns route key, avg latency, p95 latency, request count, and error count.
 */
export function getSlowestEndpoints(limit = 5): Array<{
  route: string;
  avg_ms: number;
  p95_ms: number;
  count: number;
  errors: number;
}> {
  return Array.from(routeMap.entries())
    .map(([route, s]) => {
      const sorted = [...s.latencies].sort((a, b) => a - b);
      return {
        route,
        avg_ms: s.count ? Math.round(s.totalMs / s.count) : 0,
        p95_ms: percentile(sorted, 95),
        count: s.count,
        errors: s.errors,
      };
    })
    .sort((a, b) => b.avg_ms - a.avg_ms)
    .slice(0, limit);
}

/**
 * Raw stats needed to render the Prometheus text format in the route handler.
 * Keeps the heavy sort out of the route file.
 */
export function getPrometheusSnapshot() {
  const sorted = [...bucket.latencies].sort((a, b) => a - b);
  const sum = bucket.latencies.reduce((acc, v) => acc + v, 0);
  return {
    total_requests: bucket.count,
    error_count: bucket.errors,
    active_connections: activeConnections,
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    memory_bytes: process.memoryUsage().heapUsed,
    latency: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      count: sorted.length,
      sum: Math.round(sum),
    },
  };
}

/** Reset all counters — used in tests. */
export function resetMetrics(): void {
  bucket.count = 0;
  bucket.latencies.length = 0;
  bucket.errors = 0;
  // eslint-disable-next-line security/detect-object-injection
  Object.keys(statusCodes).forEach((k) => delete statusCodes[k]);
  routeMap.clear();
  recentTs.length = 0;
  activeConnections = 0;
  startedAt = Date.now();
}
