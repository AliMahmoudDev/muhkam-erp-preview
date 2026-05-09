import app from "./app";
import { logger } from "./lib/logger";
import { startBackupScheduler, stopBackupScheduler } from "./lib/backup-scheduler";
import { startTrialScheduler, stopTrialScheduler } from "./lib/trial-scheduler";
import { startDbBackupScheduler } from "./lib/db-backup";
import { startMonitoring } from "./lib/monitor";

import { seedDefaults } from "./lib/seed-defaults";
import { initRLS } from "./lib/rls-init";
import { purgeExpiredRefreshTokens } from "./lib/refresh-token-store";
import { pool } from "@workspace/db";
import { alertManager, ALERT_TYPES } from "./lib/telegram-alert-manager";
import { instrumentSlowQueryLogging } from "./lib/slow-query";

/* ── Slow query logging — instrument pool before any queries run ── */
instrumentSlowQueryLogging(pool);

/* ── Startup: validate required environment variables ──────── */
const REQUIRED_ENV_VARS = ["JWT_SECRET", "JWT_REFRESH_SECRET", "TOTP_ENCRYPTION_KEY", "BACKUP_ENCRYPTION_KEY", "DATABASE_URL"] as const;
for (const key of REQUIRED_ENV_VARS) {
  // eslint-disable-next-line security/detect-object-injection
  if (!process.env[key]) {
    logger.error({ key }, `[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

async function main() {
  try {
    await seedDefaults();
  } catch (err) {
    logger.error({ err }, "[startup] seedDefaults failed — continuing without seeding");
  }

  /* Defense-in-depth: enable PostgreSQL RLS on tenant tables.
     Failure here is non-fatal — application-level filtering is still in effect. */
  try {
    await initRLS();
  } catch (err) {
    logger.error({ err }, "[startup] RLS init failed — continuing without RLS");
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Backend started on port ${PORT} (0.0.0.0)`);
    void alertManager.send({
      type:    ALERT_TYPES.SERVER_START,
      message: `🚀 *مُحكم ERP* بدأ التشغيل\nالبورت: ${PORT}\nالوقت: ${new Date().toLocaleString("ar-EG")}`,
    });
    startBackupScheduler();
    startDbBackupScheduler();
    startTrialScheduler();
    startMonitoring();

    /* مراقبة الذاكرة كل 30 دقيقة — تنبيه لو تجاوزت 400MB، حل لو عادت لطبيعتها */
    setInterval(async () => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      if (used > 400) {
        await alertManager.send({
          type:          ALERT_TYPES.SERVER_HIGH_MEMORY,
          message:       `🔴 *ذاكرة عالية*\nالاستخدام: ${Math.round(used)}MB\nالحد: 400MB`,
          cooldownHours: 4,
        });
      } else {
        await alertManager.markResolved(
          ALERT_TYPES.SERVER_HIGH_MEMORY,
          `الذاكرة عادت لطبيعتها: ${Math.round(used)}MB`
        );
      }
    }, 30 * 60 * 1000);

    /* Purge expired refresh tokens daily */
    void purgeExpiredRefreshTokens();
    setInterval(() => void purgeExpiredRefreshTokens(), 24 * 60 * 60 * 1000);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.error({ port: PORT }, `[FATAL] Port ${PORT} is already in use — cannot start server`);
    } else {
      logger.error({ err }, "[FATAL] Server error");
    }
    process.exit(1);
  });

  async function cleanup(signal: string) {
    logger.info({ signal }, "Shutdown signal received — closing server");
    stopBackupScheduler();
    stopTrialScheduler();
    server.close(async () => {
      try {
        await pool.end();
        logger.info("Database pool closed");
      } catch (err) {
        logger.error({ err }, "Error closing database pool");
      }
      logger.info("Server closed cleanly");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("SIGINT",  () => cleanup("SIGINT"));
}

process.on("uncaughtException", (err) => {
  logger.error({ err }, "[FATAL] Uncaught exception — exiting");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err }, "[FATAL] Unhandled promise rejection — exiting");
  process.exit(1);
});

main().catch((err) => {
  logger.error({ err }, "[FATAL] Unhandled error in main() — process exiting");
  process.exit(1);
});
