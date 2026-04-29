-- =====================================================================
-- VPS Emergency Fix — halaltec.com / Hetzner
-- تُشغَّل مرة واحدة عبر: psql $DATABASE_URL -f vps-fix.sql
-- كل جملة مؤمَّنة بـ IF NOT EXISTS — آمنة للتشغيل أكثر من مرة.
-- =====================================================================

-- 1. أعمدة repair_jobs — مرحلة الجودة والتقنيين والشحن والتسليم
ALTER TABLE repair_jobs
  ADD COLUMN IF NOT EXISTS technician_2_id          INTEGER,
  ADD COLUMN IF NOT EXISTS technician_2_name        TEXT,
  ADD COLUMN IF NOT EXISTS technician_2_section     TEXT,
  ADD COLUMN IF NOT EXISTS qa_checklist             TEXT,
  ADD COLUMN IF NOT EXISTS qa_completed_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS qa_notes                 TEXT,
  ADD COLUMN IF NOT EXISTS device_score             INTEGER,
  ADD COLUMN IF NOT EXISTS alert_days_threshold     INTEGER,
  ADD COLUMN IF NOT EXISTS pre_delivery_reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS shipping_cost            NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_expense_id      INTEGER,
  ADD COLUMN IF NOT EXISTS shipping_settled_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivery_receipt_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivery_receipt_method  TEXT;

-- 2. جدول repair_pipeline_config
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

-- 3. جدول repair_dashboard_cards
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

-- 4. أعمدة جديدة في trial_abuse_log
ALTER TABLE trial_abuse_log
  ADD COLUMN IF NOT EXISTS fingerprint_data    TEXT,
  ADD COLUMN IF NOT EXISTS device_score        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_count  INTEGER DEFAULT 0;

-- تأكيد
SELECT 'Migration applied successfully ✓' AS status;
