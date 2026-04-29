/**
 * migrate-safe.mjs
 *
 * سكريبت migration ضامن — يعمل مباشرة بـ Node.js بدون تجميع TypeScript.
 * يُضيف الأعمدة والجداول الجديدة بشكل آمن (IF NOT EXISTS).
 * يُشغَّل قبل drizzle-kit push في كل نشر على VPS.
 */

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL غير موجود — تأكد من تحميل ملف .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  {
    name: "repair_jobs — أعمدة نوع الجهاز والإكسسوارات والفرع",
    sql: `
      ALTER TABLE repair_jobs
        ADD COLUMN IF NOT EXISTS device_type              TEXT NOT NULL DEFAULT 'general',
        ADD COLUMN IF NOT EXISTS accessories              TEXT,
        ADD COLUMN IF NOT EXISTS branch_id                INTEGER;
    `,
  },
  {
    name: "repair_jobs — أعمدة التقنيين والجودة",
    sql: `
      ALTER TABLE repair_jobs
        ADD COLUMN IF NOT EXISTS technician_2_id          INTEGER,
        ADD COLUMN IF NOT EXISTS technician_2_name        TEXT,
        ADD COLUMN IF NOT EXISTS technician_2_section     TEXT,
        ADD COLUMN IF NOT EXISTS qa_checklist             TEXT,
        ADD COLUMN IF NOT EXISTS qa_completed_at          TIMESTAMP,
        ADD COLUMN IF NOT EXISTS qa_notes                 TEXT,
        ADD COLUMN IF NOT EXISTS device_score             INTEGER,
        ADD COLUMN IF NOT EXISTS alert_days_threshold     INTEGER;
    `,
  },
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
        // قد تفشل إن كان الجدول غير موجود أصلاً
        // drizzle-kit push-force ستُكمل الإنشاء بعدها
        console.warn(`⚠ ${m.name}: ${err.message}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log("✅ migrate-safe اكتمل");
}

runMigrations().catch((err) => {
  console.error("فشل migrate-safe:", err.message);
  // لا نوقف النشر — drizzle-kit push-force ستتولى الأمر
  process.exit(0);
});
