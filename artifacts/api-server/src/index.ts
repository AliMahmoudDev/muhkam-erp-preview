import net from "net";
import app from "./app";
import { logger } from "./lib/logger";
import { startBackupScheduler, stopBackupScheduler } from "./lib/backup-scheduler";
import { startDbBackupScheduler } from "./lib/db-backup";
import { startMonitoring } from "./lib/monitor";
import { seedDefaults } from "./lib/seed-defaults";
import { purgeExpiredRefreshTokens } from "./lib/refresh-token-store";
import { pool } from "@workspace/db";

/* ── Startup: validate required environment variables ──────── */
const REQUIRED_ENV_VARS = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.error({ key }, `[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    tester.once("listening", () => {
      tester.close(() => resolve(false));
    });
    tester.listen(port, "0.0.0.0");
  });
}

async function main() {
  const inUse = await isPortInUse(PORT);
  if (inUse) {
    logger.warn({ port: PORT }, "Duplicate start prevented — port already in use");
    process.exit(0);
  }

  await seedDefaults();

  const server = app.listen(PORT, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info(`Backend started on port ${PORT}`);
    startBackupScheduler();
    startDbBackupScheduler();
    startMonitoring();
    /* Purge expired refresh tokens daily */
    void purgeExpiredRefreshTokens();
    setInterval(() => void purgeExpiredRefreshTokens(), 24 * 60 * 60 * 1000);
  });

  async function cleanup(signal: string) {
    logger.info({ signal }, "Shutdown signal received — closing server");
    stopBackupScheduler();
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

void main();
