import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type { PoolClient } from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString:        process.env.DATABASE_URL,
  max:                     Number(process.env.DB_POOL_MAX ?? 10),
  min:                     Number(process.env.DB_POOL_MIN ?? 5),
  idleTimeoutMillis:       60_000,
  connectionTimeoutMillis: 3_000,
  statement_timeout:       30_000,
  query_timeout:           30_000,
  keepAlive:               true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on("error", (err) => {
  console.error("[db pool] idle client error:", err);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
