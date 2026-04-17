/**
 * backup-scheduler.ts
 * Reads backup_schedule from system_settings and runs scheduled backups.
 * Checks every minute whether a scheduled backup is due.
 */

import { db, systemSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { triggerBackup } from "./backup-service";
import { logger } from "./logger";

const SCHEDULE_KEY     = "backup_schedule";
const LAST_RUN_KEY     = "backup_last_scheduled";
const TICK_MS          = 60 * 1000; // check every minute
/* Backup config lives under the dedicated meta-tenant row so that tenant
   admins cannot pollute the scheduler's view via their own system_settings. */
const BACKUP_COMPANY_ID = 1;

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettingsTable)
    .where(and(eq(systemSettingsTable.key, key), eq(systemSettingsTable.company_id, BACKUP_COMPANY_ID)));
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await db.insert(systemSettingsTable)
    .values({ key, value, company_id: BACKUP_COMPANY_ID })
    .onConflictDoUpdate({
      target: [systemSettingsTable.key, systemSettingsTable.company_id],
      set: { value, updated_at: new Date() },
    });
}

function isDue(schedule: string, lastRun: Date | null): boolean {
  const now = new Date();
  if (!lastRun) return true; // never run → run now

  const diffMs = now.getTime() - lastRun.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  switch (schedule) {
    case "daily":   return diffHours >= 24;
    case "weekly":  return diffHours >= 24 * 7;
    case "monthly": return diffHours >= 24 * 30;
    default:        return false;
  }
}

async function tick() {
  try {
    const schedule = await getSetting(SCHEDULE_KEY);
    if (!schedule || schedule === "none") return;

    const lastRunStr = await getSetting(LAST_RUN_KEY);
    const lastRun = lastRunStr ? new Date(lastRunStr) : null;

    if (isDue(schedule, lastRun)) {
      logger.info({ schedule }, "Scheduled backup triggered");
      const result = await triggerBackup("scheduled");
      if (result) {
        await setSetting(LAST_RUN_KEY, new Date().toISOString());
      }
    }
  } catch (err) {
    logger.error({ err }, "Scheduler tick error");
  }
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler() {
  if (interval) return; // already started
  interval = setInterval(() => { void tick(); }, TICK_MS);
  // Run once shortly after startup to catch any overdue schedules
  setTimeout(() => { void tick(); }, 5000);
  logger.info("Backup scheduler started");
}

export function stopBackupScheduler() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
