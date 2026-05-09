/**
 * prom-metrics.ts — Official prom-client metrics registry.
 *
 * Standard metrics (user-requested names):
 *   • http_requests_total      Counter  — labels: method, route, status_code
 *   • http_request_duration_seconds  Histogram — labels: method, route
 *   • active_connections       Gauge
 *   • memory_usage_bytes       Gauge
 *   • nodejs_uptime_seconds    Gauge
 *
 * Legacy aliases (backward-compatible names kept for dashboards & tests):
 *   • request_count_total      Counter
 *   • response_time_ms         Summary  (quantiles 0.5 / 0.95 / 0.99)
 *   • error_count_total        Counter
 *   • uptime_seconds           Gauge
 */
import { Counter, Gauge, Histogram, Registry, Summary } from 'prom-client';

export const registry = new Registry();

/* ── Standard metrics ────────────────────────────────────────────────── */

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const activeConnectionsGauge = new Gauge({
  name: 'active_connections',
  help: 'Current number of active HTTP connections',
  registers: [registry],
});

export const memoryUsageBytesGauge = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Current heap memory usage in bytes',
  registers: [registry],
});

export const nodejsUptimeSecondsGauge = new Gauge({
  name: 'nodejs_uptime_seconds',
  help: 'Server uptime in seconds',
  registers: [registry],
});

/* ── Legacy aliases (backward-compatible with existing dashboards & tests) ── */

export const requestCountTotal = new Counter({
  name: 'request_count_total',
  help: 'Total number of HTTP requests received',
  registers: [registry],
});

export const responseTimeSummary = new Summary({
  name: 'response_time_ms',
  help: 'Response time in milliseconds (summary)',
  percentiles: [0.5, 0.95, 0.99],
  registers: [registry],
});

export const errorCountTotal = new Counter({
  name: 'error_count_total',
  help: 'Total number of HTTP errors (status >= 400)',
  registers: [registry],
});

export const uptimeSecondsGauge = new Gauge({
  name: 'uptime_seconds',
  help: 'Server uptime in seconds',
  registers: [registry],
});

/* ── Live gauge updater ─────────────────────────────────────────────── */

const _startTime = Date.now();

/**
 * Refresh memory and uptime gauges.
 * Call on every request (and before scraping the Prometheus endpoint).
 */
export function updateLiveGauges(): void {
  const heapUsed = process.memoryUsage().heapUsed;
  memoryUsageBytesGauge.set(heapUsed);

  const uptimeSec = (Date.now() - _startTime) / 1000;
  nodejsUptimeSecondsGauge.set(uptimeSec);
  uptimeSecondsGauge.set(uptimeSec);
}
