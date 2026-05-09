# مُحكم ERP — Operations Runbook / دليل التشغيل

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Last Updated** | 2025-06-01 |
| **Audience** | DevOps / System Administrators |

---

## Table of Contents / فهرس المحتويات

1. [DB Failover Procedure / إجراء التعافي من فشل قاعدة البيانات](#1-db-failover-procedure)
2. [Secret Rotation Steps / خطوات تدوير الأسرار](#2-secret-rotation-steps)
3. [How to Clear a Trial Block / كيفية رفع حظر الفترة التجريبية](#3-how-to-clear-a-trial-block)
4. [Cache Invalidation Commands / أوامر إبطال الكاش](#4-cache-invalidation-commands)
5. [Redis Outage Response / الاستجابة لانقطاع Redis](#5-redis-outage-response)
6. [When /healthz Returns 503 / عندما يُرجع /healthz خطأ 503](#6-when-healthz-returns-503)
7. [How to Restore from Backup / كيفية الاستعادة من النسخة الاحتياطية](#7-how-to-restore-from-backup)

---

## 1. DB Failover Procedure

### English

**Symptoms**: API returns 500 errors, logs show `ECONNREFUSED` or `connection timeout` to PostgreSQL.

**Steps**:

1. **Confirm the failure**
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1;"
   # Should return "1 row" in < 1s. If it hangs or fails, DB is unreachable.
   ```

2. **Check primary health** (if using managed DB like Supabase/RDS):
   - Log into the cloud console and verify instance state.
   - Check the managed replica promotion status.

3. **Manual failover (self-hosted)**
   ```bash
   # On replica server — promote to primary:
   pg_ctl promote -D /var/lib/postgresql/data

   # Verify it accepted writes:
   psql -c "SELECT pg_is_in_recovery();"  # Should return 'f' (false)
   ```

4. **Update DATABASE_URL** in the environment secrets to point to the new primary:
   ```
   DATABASE_URL=postgres://user:pass@<new-primary-host>:5432/muhkam
   ```

5. **Restart the API server**:
   ```bash
   pm2 restart api-server
   # OR (Docker):
   docker restart muhkam-api
   ```

6. **Verify recovery**:
   ```bash
   curl -s https://<domain>/api/health | jq '.db'
   # Expected: { "status": "ok" }
   ```

7. **Post-mortem**: Document the incident in `docs/incidents/` with timeline, root cause, and corrective actions.

### العربية

**الأعراض**: ترجع الـ API أخطاء 500، والسجلات تُظهر `ECONNREFUSED` أو `connection timeout` مع PostgreSQL.

**الخطوات**:

1. **تأكيد الفشل**
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1;"
   # يجب أن يُرجع "1 row" في أقل من ثانية. إن تعلّق أو فشل، قاعدة البيانات غير متاحة.
   ```

2. **فحص حالة الخادم الرئيسي** (في حالة قواعد البيانات المُدارة كـ Supabase/RDS):
   - ادخل على لوحة التحكم السحابية وتحقق من حالة الـ instance.

3. **الترقية اليدوية (الاستضافة الذاتية)**
   ```bash
   # على خادم النسخة المتماثلة — ترقيته إلى خادم رئيسي:
   pg_ctl promote -D /var/lib/postgresql/data

   # تحقق من قبوله عمليات الكتابة:
   psql -c "SELECT pg_is_in_recovery();"  # يجب أن يُرجع 'f'
   ```

4. **تحديث DATABASE_URL** في متغيرات البيئة للإشارة إلى الخادم الرئيسي الجديد.

5. **إعادة تشغيل خادم الـ API** ثم **التحقق من التعافي** عبر نقطة `/api/health`.

---

## 2. Secret Rotation Steps

### English

Rotate secrets in this order to avoid downtime:

**A. JWT_SECRET / JWT_REFRESH_SECRET**

> These invalidate **all active sessions**. Warn users before rotating in business hours.

1. Generate new secrets:
   ```bash
   openssl rand -base64 64  # for JWT_SECRET
   openssl rand -base64 64  # for JWT_REFRESH_SECRET
   ```
2. Update environment secrets in your secrets manager (Replit Secrets / AWS Secrets Manager / Vault).
3. Do a rolling restart of the API pods/containers.
4. All users will be logged out and need to log in again.

**B. TOTP_ENCRYPTION_KEY**

> Changing this will make all existing TOTP secrets unreadable. Only rotate if the key is compromised.

1. Export all TOTP secrets before rotating (decrypt with old key, re-encrypt with new):
   ```bash
   # Run the migration helper script:
   node scripts/rotate-totp-key.js --old-key $OLD_KEY --new-key $NEW_KEY
   ```
2. Update the secret in the environment.
3. Restart the API.

**C. BACKUP_ENCRYPTION_KEY**

> Changing this makes old backups unrestorable with the new key. Keep the old key archived securely.

1. Archive the old key in a secure vault with a note of the date range of backups it covers.
2. Set new key in environment secrets.
3. Restart API — new backups will use the new key.

**D. DATABASE_URL**

1. Change the DB password at the PostgreSQL level:
   ```sql
   ALTER USER muhkam_user WITH PASSWORD 'new-secure-password';
   ```
2. Update `DATABASE_URL` in environment secrets.
3. Restart API servers.

**E. REDIS_URL** (if Redis auth is enabled)

1. Set new password on Redis: `CONFIG SET requirepass "new-password"`
2. Update `REDIS_URL` in environment secrets.
3. Restart API.

### العربية

**أ. JWT_SECRET / JWT_REFRESH_SECRET**

> تدوير هذه المفاتيح يُلغي **جميع الجلسات النشطة**. أبلغ المستخدمين قبل التدوير خلال ساعات العمل.

1. توليد مفاتيح جديدة:
   ```bash
   openssl rand -base64 64
   ```
2. تحديث الأسرار في مدير الأسرار (Replit Secrets / Vault).
3. إعادة تشغيل متدرجة لخوادم الـ API.
4. سيُطلب من جميع المستخدمين تسجيل الدخول مجدداً.

**ب. TOTP_ENCRYPTION_KEY**

> التغيير يجعل جميع أسرار TOTP الحالية غير قابلة للقراءة. تجنّب التدوير إلا في حالة الاختراق.

**ج. BACKUP_ENCRYPTION_KEY**

> احتفظ بالمفتاح القديم بشكل آمن مع توثيق نطاق تواريخ النسخ الاحتياطية التي يغطيها.

---

## 3. How to Clear a Trial Block

### English

Trial blocks occur when a company's free trial has expired. The system blocks write operations while allowing read-only access.

**Via API (super_admin only)**:
```bash
curl -X POST https://<domain>/api/super/extend-trial \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"company_id": 123, "days": 14}'
```

**Via Database (emergency)**:
```sql
-- Extend trial by 14 days:
UPDATE companies
SET
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trial'
WHERE id = 123;

-- Verify:
SELECT id, name, trial_ends_at, subscription_status FROM companies WHERE id = 123;
```

**Via Super Admin UI**:
1. Log in as `super_admin`.
2. Navigate to `/super/companies`.
3. Find the company and click "Extend Trial".

**After clearing**, verify the block is lifted:
```bash
curl -s https://<domain>/api/health/tenant/123 | jq '.trial'
```

### العربية

تحدث الحظر التجريبي عندما تنتهي الفترة التجريبية للشركة. يحظر النظام عمليات الكتابة مع السماح بالقراءة فقط.

**عبر API (للمسؤول العام فقط)**:
```bash
curl -X POST https://<domain>/api/super/extend-trial \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{"company_id": 123, "days": 14}'
```

**عبر قاعدة البيانات (طارئ)**:
```sql
UPDATE companies
SET trial_ends_at = NOW() + INTERVAL '14 days',
    subscription_status = 'trial'
WHERE id = 123;
```

---

## 4. Cache Invalidation Commands

### English

MUHKAM uses Redis (fail-open) for caching high-read routes. Cache keys follow the pattern `{resource}:{companyId}`.

**Connect to Redis**:
```bash
redis-cli -u "$REDIS_URL"
# OR if using a password:
redis-cli -h <host> -p <port> -a <password>
```

**Inspect all keys for a company**:
```bash
redis-cli KEYS "*:42*"          # All keys for company 42
redis-cli KEYS "products:42"    # Products cache for company 42
redis-cli KEYS "customers:42"   # Customers cache for company 42
```

**Delete specific cache entries**:
```bash
# Single key:
redis-cli DEL "products:42"
redis-cli DEL "customers:42"
redis-cli DEL "categories:42"
redis-cli DEL "price-lists:42"

# Exchange rates (pattern delete — has sub-keys per currency+date):
redis-cli --scan --pattern "exchange-rates:42:*" | xargs redis-cli DEL
```

**Flush ALL cache for a company** (use with caution):
```bash
redis-cli --scan --pattern "*:42" | xargs redis-cli DEL
redis-cli --scan --pattern "*:42:*" | xargs redis-cli DEL
```

**Flush the entire cache** (emergency only — affects all tenants):
```bash
redis-cli FLUSHDB
```

**Check cache hit rate**:
```bash
redis-cli INFO stats | grep keyspace
redis-cli INFO keyspace
```

**Cache TTLs by resource**:

| Resource | Key Pattern | TTL |
|----------|-------------|-----|
| Products | `products:{companyId}` | 120s |
| Customers | `customers:{companyId}` | 60s |
| Categories | `categories:{companyId}` | 300s |
| Price Lists | `price-lists:{companyId}` | 300s |
| Exchange Rates | `exchange-rates:{companyId}:{currency}:{date}` | 600s |

### العربية

يستخدم مُحكم Redis (يعمل حتى بدون Redis) لتخزين مؤقت للمسارات كثيرة القراءة. مفاتيح الكاش تتبع النمط `{مورد}:{معرّف_الشركة}`.

```bash
# حذف كاش المنتجات لشركة رقم 42:
redis-cli DEL "products:42"

# حذف كاش أسعار الصرف (بالنمط):
redis-cli --scan --pattern "exchange-rates:42:*" | xargs redis-cli DEL

# مسح جميع كاش شركة معينة:
redis-cli --scan --pattern "*:42" | xargs redis-cli DEL
redis-cli --scan --pattern "*:42:*" | xargs redis-cli DEL
```

---

## 5. Redis Outage Response

### English

MUHKAM's cache layer is **fail-open**: if Redis is unavailable, the application continues without caching. There is **no data loss** from a Redis outage — Redis only holds transient cache, not source-of-truth data.

**Detection**:
- Check logs for: `[cache] Redis error` or `connect ECONNREFUSED`
- `/api/health` will still return 200 (Redis is not a hard dependency)

**Immediate response**:

1. **Confirm Redis is down**:
   ```bash
   redis-cli -u "$REDIS_URL" PING
   # Expected: PONG. If timeout/refused — Redis is down.
   ```

2. **Nothing needs to be done for the application** — it falls back to direct DB queries automatically.

3. **Monitor DB load**: Cache misses increase DB query load. Check DB CPU/connection count:
   ```bash
   psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
   ```
   If connections spike above 80% of `max_connections`, consider:
   - Temporarily reducing API replica count
   - Enabling PgBouncer connection pooling

4. **Restart Redis**:
   ```bash
   # Docker:
   docker restart muhkam-redis

   # Systemd:
   sudo systemctl restart redis

   # Verify:
   redis-cli PING
   ```

5. **Cache warms automatically** — no manual warm-up needed. The next request to each cached route will populate the cache.

6. **Post-outage**: Review Redis memory settings and persistence config (`appendonly yes`, `save` directives) to prevent data loss on restart.

### العربية

طبقة الكاش في مُحكم **تعمل دون توقف** حتى بدون Redis: إذا كان Redis غير متاح، يستمر التطبيق في العمل دون تخزين مؤقت. **لا يوجد فقدان بيانات** من انقطاع Redis — لأن Redis يحتفظ فقط بالكاش المؤقت وليس ببيانات المصدر.

1. لا يحتاج التطبيق لأي تدخل فوري — يرجع تلقائياً للاستعلام المباشر من قاعدة البيانات.
2. راقب حمل قاعدة البيانات — فقدان الكاش يزيد عدد الاستعلامات.
3. أعد تشغيل Redis حين يتوفر، والكاش يُملأ تلقائياً مع الطلبات القادمة.

---

## 6. When /healthz Returns 503

### English

`GET /api/health` (or `/healthz` depending on your reverse proxy config) returns 503 when one or more critical subsystems fail their checks.

**Response body format**:
```json
{
  "status": "error",
  "db": { "status": "error", "error": "connection refused" },
  "redis": { "status": "ok" },
  "memory": { "heapUsedMB": 180, "status": "ok" }
}
```

**Diagnostic decision tree**:

```
503 received
│
├── db.status = "error"
│   ├── See Section 1 (DB Failover)
│   └── Check: psql "$DATABASE_URL" -c "SELECT 1;"
│
├── redis.status = "error"
│   ├── See Section 5 (Redis Outage)
│   └── Note: Redis errors downgrade to warning — should not cause 503 alone
│
├── memory.status = "error" (heap > 500 MB)
│   ├── Restart the API process: pm2 restart api-server
│   ├── Check for memory leaks: node --inspect flag + heap snapshot
│   └── Scale horizontally if load is genuine
│
└── All subsystems "ok" but still 503
    ├── Check reverse proxy (nginx/Caddy) health check timeout settings
    ├── Verify PORT env var matches what the app is listening on
    └── Check for uncaught exceptions in logs: pm2 logs | grep FATAL
```

**Quick commands**:
```bash
# Check live health:
curl -sf https://<domain>/api/health | jq .

# Check recent error logs:
pm2 logs api-server --lines 100 | grep -E "ERROR|FATAL|503"

# Check DB connectivity:
psql "$DATABASE_URL" -c "SELECT version();"

# Check process health:
pm2 status
```

### العربية

يُرجع `/api/health` الرمز 503 عند فشل أحد الأنظمة الفرعية الحرجة.

**شجرة تشخيص الأعراض**:

```
503 مُستلم
│
├── db.status = "error"
│   └── راجع القسم 1 (التعافي من فشل قاعدة البيانات)
│
├── redis.status = "error"
│   └── راجع القسم 5 (الاستجابة لانقطاع Redis)
│
├── memory.status = "error" (الذاكرة > 500 MB)
│   └── أعد تشغيل خادم الـ API: pm2 restart api-server
│
└── كل الأنظمة "ok" لكن لا يزال 503
    └── تحقق من إعدادات الـ reverse proxy وتطابق رقم PORT
```

```bash
# فحص الصحة المباشر:
curl -sf https://<domain>/api/health | jq .

# سجلات الأخطاء الأخيرة:
pm2 logs api-server --lines 100 | grep -E "ERROR|FATAL"
```

---

## 7. How to Restore from Backup

### English

MUHKAM automatically creates two types of backups:

**A. Automated DB Backups** (encrypted `.sql.enc` files stored locally or in S3)

1. **List available backups**:
   ```bash
   # Local:
   ls -la /var/backups/muhkam/

   # Or via API (super_admin):
   curl -H "Authorization: Bearer <token>" https://<domain>/api/backups | jq '.[] | {id, created_at, size}'
   ```

2. **Download a backup**:
   ```bash
   # Via API:
   curl -H "Authorization: Bearer <token>" \
     https://<domain>/api/backups/<backup-id>/download \
     -o backup.sql.enc
   ```

3. **Decrypt the backup**:
   ```bash
   # Using openssl AES-256-CBC:
   openssl enc -d -aes-256-cbc \
     -in backup.sql.enc \
     -out backup.sql \
     -pass env:BACKUP_ENCRYPTION_KEY
   ```

4. **Restore to PostgreSQL**:
   ```bash
   # WARNING: This will overwrite existing data!
   psql "$DATABASE_URL" < backup.sql

   # For large backups, use pg_restore:
   pg_restore -d "$DATABASE_URL" backup.sql
   ```

5. **Verify integrity**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM companies;"
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM sales;"
   curl https://<domain>/api/health | jq '.db'
   ```

6. **Restart the API**:
   ```bash
   pm2 restart api-server
   ```

**B. Point-in-Time Recovery (PITR)** — If using a managed DB with WAL archiving:

```bash
# AWS RDS example — restore to a point in time:
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier muhkam-prod \
  --target-db-instance-identifier muhkam-restored \
  --restore-time 2025-06-01T14:30:00Z

# Then update DATABASE_URL to point to muhkam-restored endpoint
```

**C. Via Admin UI**:
1. Log in as `super_admin`.
2. Go to `/api/system/restore` endpoint with a POST containing the backup file.
3. The server will decrypt, verify, and apply the backup.

> ⚠️ **WARNING**: A restore overwrites ALL current data. Always test on a staging environment first. Notify all users before performing a production restore.

### العربية

**أ. نسخ احتياطية تلقائية** (ملفات `.sql.enc` مشفرة):

1. **سرد النسخ الاحتياطية المتاحة**:
   ```bash
   ls -la /var/backups/muhkam/
   # أو عبر API:
   curl -H "Authorization: Bearer <token>" https://<domain>/api/backups | jq .
   ```

2. **فك تشفير النسخة الاحتياطية**:
   ```bash
   openssl enc -d -aes-256-cbc \
     -in backup.sql.enc \
     -out backup.sql \
     -pass env:BACKUP_ENCRYPTION_KEY
   ```

3. **الاستعادة إلى PostgreSQL**:
   ```bash
   # تحذير: سيُستبدل جميع البيانات الحالية!
   psql "$DATABASE_URL" < backup.sql
   ```

4. **التحقق**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM companies;"
   curl https://<domain>/api/health | jq '.db'
   ```

> ⚠️ **تحذير**: الاستعادة تستبدل جميع البيانات الحالية. اختبر دائماً على بيئة تجريبية أولاً. أبلغ جميع المستخدمين قبل الاستعادة في الإنتاج.

---

*Last reviewed: 2025-06-01 | Maintained by the MUHKAM ERP DevOps team*
