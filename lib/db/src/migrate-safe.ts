/**
 * migrate-safe.ts
 *
 * سكريبت migration ضامن يُطبَّق قبل drizzle-kit push في كل نشر.
 * يستخدم IF NOT EXISTS / IF NOT EXISTS للتأكد من وجود كل الأعمدة والجداول
 * الجديدة على قاعدة بيانات VPS، حتى في حالة فشل drizzle-kit push.
 *
 * يعمل مباشرة على الـ DATABASE_URL دون أي اعتماد على drizzle-kit.
 */

import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL غير موجود — تأكد من تحميل ملف .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations: { name: string; sql: string }[] = [
  {
    name: "repair_jobs — أعمدة مرحلة ما قبل التسليم والشحن",
    sql: `
      ALTER TABLE repair_jobs
        ADD COLUMN IF NOT EXISTS pre_delivery_reviewed_at  TIMESTAMP,
        ADD COLUMN IF NOT EXISTS shipping_cost             NUMERIC(12,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS shipping_expense_id       INTEGER,
        ADD COLUMN IF NOT EXISTS shipping_settled_at       TIMESTAMP,
        ADD COLUMN IF NOT EXISTS delivery_receipt_sent_at  TIMESTAMP,
        ADD COLUMN IF NOT EXISTS delivery_receipt_method   TEXT;
    `,
  },
  {
    name: "إنشاء جدول repair_pipeline_config",
    sql: `
      CREATE TABLE IF NOT EXISTS repair_pipeline_config (
        id          SERIAL PRIMARY KEY,
        company_id  INTEGER NOT NULL,
        status_key  TEXT    NOT NULL,
        label_ar    TEXT    NOT NULL,
        color       TEXT    NOT NULL,
        icon        TEXT    NOT NULL,
        sort_order  INTEGER NOT NULL,
        requirements TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS repair_pipeline_config_company_idx
        ON repair_pipeline_config (company_id);
    `,
  },
  {
    name: "إنشاء جدول repair_dashboard_cards",
    sql: `
      CREATE TABLE IF NOT EXISTS repair_dashboard_cards (
        id              SERIAL PRIMARY KEY,
        company_id      INTEGER  NOT NULL,
        name            TEXT     NOT NULL,
        statuses        TEXT     NOT NULL,
        color           TEXT     NOT NULL DEFAULT '#8b5cf6',
        icon            TEXT     NOT NULL DEFAULT 'Wrench',
        sort_order      INTEGER  NOT NULL DEFAULT 0,
        alert_threshold INTEGER,
        is_system       BOOLEAN  NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS repair_dashboard_cards_company_idx
        ON repair_dashboard_cards (company_id, sort_order);
    `,
  },
  {
    name: "trial_abuse_log — أعمدة بصمة الجهاز",
    sql: `
      ALTER TABLE trial_abuse_log
        ADD COLUMN IF NOT EXISTS fingerprint_data    TEXT,
        ADD COLUMN IF NOT EXISTS device_score        INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS registration_count  INTEGER DEFAULT 0;
    `,
  },
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const m of migrations) {
      try {
        await client.query(m.sql);
        console.log(`✓ ${m.name}`);
      } catch (err) {
        console.error(`✗ ${m.name}:`, (err as Error).message);
        throw err;
      }
    }
    console.log("✅ جميع migrations نُفِّذت بنجاح");
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("فشل migration:", err);
  process.exit(1);
});
