/**
 * monitor.ts — lightweight health monitoring with state-change logging.
 * Runs a DB ping every 60 seconds; logs on status transitions.
 * /healthz         → quick check (DB ping + memory)
 * /healthz/deep    → full check (DB read+write round-trip + latency)
 */
import { logger } from "./logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface HealthStatus {
  status:       "healthy" | "degraded" | "unhealthy";
  db:           boolean;
  memory_mb:    number;
  uptime_hours: number;
  last_check:   string;
}

export interface DeepHealthStatus extends HealthStatus {
  db_write_ok:       boolean;
  db_read_latency_ms: number;
  db_write_latency_ms: number;
  pool_ok:           boolean;
  node_version:      string;
  environment:       string;
}

let lastStatus: HealthStatus | null = null;

export async function checkHealth(): Promise<HealthStatus> {
  const mem         = process.memoryUsage();
  const memUsed     = Math.round(mem.heapUsed / 1024 / 1024);
  const uptimeHours = Math.round(process.uptime() / 3600 * 10) / 10;

  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const overallStatus: HealthStatus["status"] =
    !dbOk         ? "unhealthy" :
    memUsed > 500 ? "degraded"  :
                    "healthy";

  const status: HealthStatus = {
    status:       overallStatus,
    db:           dbOk,
    memory_mb:    memUsed,
    uptime_hours: uptimeHours,
    last_check:   new Date().toISOString(),
  };

  if (!lastStatus || lastStatus.status !== status.status) {
    if (status.status !== "healthy") {
      logger.error({ status }, "HEALTH CHECK DEGRADED/UNHEALTHY");
    } else if (lastStatus?.status && lastStatus.status !== "healthy") {
      logger.info({ status }, "Service recovered to healthy state");
    }
  }

  lastStatus = status;
  return status;
}

export async function checkDeepHealth(): Promise<DeepHealthStatus> {
  const base = await checkHealth();
  const mem  = process.memoryUsage();

  /* DB read latency */
  let dbReadOk      = false;
  let dbReadLatency = -1;
  try {
    const t0 = Date.now();
    await db.execute(sql`SELECT 1`);
    dbReadLatency = Date.now() - t0;
    dbReadOk = true;
  } catch { /* already false */ }

  /* DB write round-trip — write to a temp table and delete */
  let dbWriteOk      = false;
  let dbWriteLatency = -1;
  try {
    const t0 = Date.now();
    await db.execute(sql`
      CREATE TEMP TABLE IF NOT EXISTS _health_probe (ts timestamptz DEFAULT now());
      INSERT INTO _health_probe DEFAULT VALUES;
      DELETE FROM _health_probe WHERE ts < now() - interval '10 seconds';
    `);
    dbWriteLatency = Date.now() - t0;
    dbWriteOk = true;
  } catch { /* DB write failed */ }

  const overallStatus: DeepHealthStatus["status"] =
    !dbReadOk || !dbWriteOk ? "unhealthy" :
    dbReadLatency > 1000    ? "degraded"  :
    (mem.heapUsed / 1024 / 1024) > 500 ? "degraded" :
                              "healthy";

  return {
    ...base,
    status:              overallStatus,
    db_write_ok:         dbWriteOk,
    db_read_latency_ms:  dbReadLatency,
    db_write_latency_ms: dbWriteLatency,
    pool_ok:             dbReadOk && dbWriteOk,
    node_version:        process.version,
    environment:         process.env.NODE_ENV ?? "development",
  };
}

export function startMonitoring(): void {
  setInterval(async () => {
    try {
      await checkHealth();
    } catch (err) {
      logger.error({ err }, "Monitor check error");
    }
  }, 60_000);

  logger.info("Health monitoring started (every 60s)");
}
