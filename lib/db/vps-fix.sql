-- =====================================================================
-- VPS Emergency Fix — halaltec.com / Hetzner
-- تُشغَّل مرة واحدة عبر: psql $DATABASE_URL -f vps-fix.sql
-- كل جملة مؤمَّنة بـ IF NOT EXISTS — آمنة للتشغيل أكثر من مرة.
-- =====================================================================

-- =====================================================================
-- القسم الأول: جداول المصلّحات (الإصلاحات السابقة)
-- =====================================================================

-- 1. أعمدة repair_jobs — نوع الجهاز والإكسسوارات والفرع والتقنيين والجودة والشحن
ALTER TABLE repair_jobs
  ADD COLUMN IF NOT EXISTS device_type              TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS accessories              TEXT,
  ADD COLUMN IF NOT EXISTS branch_id                INTEGER,
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

-- =====================================================================
-- القسم الثاني: إصلاح تسجيل الدخول — أعمدة erp_users الجديدة
-- *** هذا هو سبب "فشل تسجيل الدخول" على VPS ***
-- Drizzle يحاول SELECT كل الأعمدة المعرّفة في الـ schema —
-- إذا كان أي عمود غير موجود في DB يظهر خطأ 500.
-- =====================================================================

-- 5. أعمدة جديدة في erp_users (مطلوبة لعمل تسجيل الدخول)
ALTER TABLE erp_users
  ADD COLUMN IF NOT EXISTS email                   TEXT,
  ADD COLUMN IF NOT EXISTS permissions             TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS employee_id             INTEGER,
  ADD COLUMN IF NOT EXISTS warehouse_id            INTEGER,
  ADD COLUMN IF NOT EXISTS safe_id                 INTEGER,
  ADD COLUMN IF NOT EXISTS login_attempts          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login              TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS totp_secret             TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_verified           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trusted_device_id       TEXT,
  ADD COLUMN IF NOT EXISTS repair_commission_pct   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repair_specialty        TEXT,
  ADD COLUMN IF NOT EXISTS repair_notifications    BOOLEAN NOT NULL DEFAULT TRUE;

-- =====================================================================
-- القسم الثالث: إصلاح فحص الاشتراك — أعمدة companies الجديدة
-- =====================================================================

-- 6. أعمدة جديدة في companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS edition           TEXT NOT NULL DEFAULT 'ultimate',
  ADD COLUMN IF NOT EXISTS features          JSONB,
  ADD COLUMN IF NOT EXISTS admin_email       TEXT,
  ADD COLUMN IF NOT EXISTS signup_ip         TEXT,
  ADD COLUMN IF NOT EXISTS signup_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS has_used_trial    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_verification_token       TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_status            TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS trial_score       INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_suspicious     BOOLEAN NOT NULL DEFAULT FALSE;

-- تصحيح الشركات الموجودة مسبقاً: اعتبارها موثّقة (لا تحجبها من الدخول)
UPDATE companies
  SET email_verified    = TRUE,
      verification_status = 'verified'
  WHERE email_verified IS FALSE
     OR verification_status = 'pending';

-- =====================================================================
-- القسم الرابع: جدول refresh_tokens (إذا لم يكن موجوداً)
-- =====================================================================

-- 7. جدول refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  token_hash TEXT    NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES erp_users(id) ON DELETE CASCADE,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  used_at    TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx  ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_hash_idx     ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx  ON refresh_tokens (expires_at);

-- =====================================================================
-- القسم الخامس: جداول HR والرواتب (قد تكون مفقودة)
-- =====================================================================

-- 8. salary_advances — عمود safe_id إذا كان ناقصاً
ALTER TABLE salary_advances
  ADD COLUMN IF NOT EXISTS safe_id INTEGER;

-- =====================================================================
-- القسم السادس: جداول المصلّحات الجديدة (v3 — تحديث مايو 2026)
-- =====================================================================

-- 9. عمود event_type في repair_status_history (أُضيف حديثاً)
ALTER TABLE repair_status_history
  ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'status_change';

-- 10. أعمدة reference في transactions (مطلوبة لربط دفعات الصيانة بالحركات المالية)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id   INTEGER;
CREATE INDEX IF NOT EXISTS transactions_reference_type_idx
  ON transactions (reference_type);

-- 11. جدول repair_payments (دفعات الصيانة)
CREATE TABLE IF NOT EXISTS repair_payments (
  id               SERIAL PRIMARY KEY,
  company_id       INTEGER NOT NULL,
  job_id           INTEGER NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  amount           NUMERIC(12,2) NOT NULL,
  payment_method   TEXT NOT NULL DEFAULT 'cash',
  notes            TEXT,
  received_by      INTEGER,
  received_by_name TEXT,
  safe_id          INTEGER,
  safe_name        TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS repair_payments_job_idx     ON repair_payments (job_id);
CREATE INDEX IF NOT EXISTS repair_payments_company_idx ON repair_payments (company_id);

-- 12. جدول repair_device_models (موديلات الأجهزة)
CREATE TABLE IF NOT EXISTS repair_device_models (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL,
  brand      TEXT    NOT NULL,
  category   TEXT    NOT NULL,
  model      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS repair_device_models_company_idx ON repair_device_models (company_id);

-- تأكيد
SELECT 'VPS Migration v3 applied successfully ✓' AS status;
