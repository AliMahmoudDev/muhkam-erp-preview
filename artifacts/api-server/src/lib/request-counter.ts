/**
 * request-counter.ts — in-process request metrics collector.
 * Tracks: total requests, status code distribution, p50/p95/p99 latency (sliding window).
 */

interface Bucket { count: number; latencies: number[] }
const window: Bucket = { count: 0, latencies: [] };
const statusCodes: Record<string, number> = {};
let startedAt = Date.now();

export function recordRequest(statusCode: number, durationMs: number): void {
  window.count++;
  statusCodes[String(statusCode)] = (statusCodes[String(statusCode)] ?? 0) + 1;
  // Keep last 10 000 latency samples
  window.latencies.push(durationMs);
  if (window.latencies.length > 10_000) window.latencies.splice(0, window.latencies.length - 10_000);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(idx, sorted.length - 1)];
}

export function getMetrics() {
  const sorted = [...window.latencies].sort((a, b) => a - b);
  return {
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    total_requests: window.count,
    status_codes:   statusCodes,
    latency_ms: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      samples: sorted.length,
    },
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };
}

export function resetMetrics(): void {
  window.count = 0;
  window.latencies.length = 0;
  Object.keys(statusCodes).forEach((k) => delete statusCodes[k]);
  startedAt = Date.now();
}
