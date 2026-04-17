# دليل الـ Deployment

## GitHub Secrets المطلوبة

في GitHub → Settings → Secrets and variables → Actions، يجب أن تكون هذه الـ secrets موجودة:

| Secret | الوصف | الحالة |
|--------|-------|--------|
| `VPS_HOST` | عنوان IP الخاص بالسيرفر | ✅ مضاف |
| `VPS_USER` | اسم المستخدم على السيرفر (مثال: `root`) | ✅ مضاف |
| `VPS_PASSWORD` | كلمة مرور SSH للسيرفر | ✅ مضاف |
| `VPS_DATABASE_URL` | رابط PostgreSQL على السيرفر، مثال: `postgresql://user:pass@localhost:5432/erp` | ✅ مضاف |
| `VPS_REDIS_URL` | رابط Redis على السيرفر، مثال: `redis://localhost:6379` | ✅ مضاف |
| `VPS_JWT_SECRET` | مفتاح JWT الأساسي (32+ حرف عشوائي) | ✅ مضاف |
| `VPS_JWT_REFRESH_SECRET` | مفتاح JWT للـ refresh tokens | ✅ مضاف |
| `INTEGRATION_JWT_SECRET` | مفتاح JWT لتشغيل الـ integration tests في CI (32+ حرف) | ✅ مضاف |
| `INTEGRATION_JWT_REFRESH_SECRET` | مفتاح JWT refresh للـ integration tests في CI (32+ حرف) | ✅ مضاف |

> **ملاحظة:** `VPS_DATABASE_URL` و `VPS_REDIS_URL` مطلوبان لتشغيل `db-repair.sql`
> وخطوة `drizzle-kit push` في pipeline الـ deploy، وكذلك لتوليد ملف `ecosystem.config.cjs`
> الخاص بـ pm2 في كل deploy.

## كيف يستخدم الـ deploy.yml هذه الـ Secrets

يمرر الـ workflow هذه المتغيرات إلى الـ SSH session عبر `envs:` ثم يستخدمها:

```bash
# خطوة 4 — إصلاح قاعدة البيانات
psql "$DATABASE_URL" -f /root/Schema-Sync/scripts/db-repair.sql

# خطوة 5 — push schema migrations
cd /root/Schema-Sync/lib/db && pnpm run push

# خطوة 8 — توليد ecosystem.config.cjs لـ pm2
cat > /root/Schema-Sync/ecosystem.config.cjs << ECOSYSTEM
  DATABASE_URL: '${DATABASE_URL}',
  REDIS_URL: '${REDIS_URL}',
  ...
ECOSYSTEM
```

## تشغيل Docker محلياً

```bash
cp .env.example .env
# عدّل .env بالقيم الصحيحة

docker-compose up -d

docker-compose logs -f api

docker-compose down
```

## CI/CD Pipeline

يوجد workflow-ان في `.github/workflows/`:

### `ci.yml` — يشتغل عند كل push أو PR
- `test-backend` — يشغّل 38 test للـ backend
- `test-frontend` — يشغّل 4 tests للـ frontend
- `lint` — ESLint + TypeScript type-check للـ packages الاثنين
- `build` — يبني frontend + backend ويرفع الـ artifacts

### `deploy.yml` — يشتغل عند push على `main` أو PR على `main`

#### job: `integration-test` (يشتغل أولاً على كل push و PR)
- يرفع service container لـ PostgreSQL 16
- يثبت الـ dependencies ويطبق schema بـ `drizzle-kit push --force`
- يشغّل 20 integration test للتحقق من عزل البيانات بين الـ tenants
- يستخدم `INTEGRATION_JWT_SECRET` و `INTEGRATION_JWT_REFRESH_SECRET` من repository secrets
- إذا غابت الـ secrets (مثلاً في فورك)، يرجع `setup.ts` لقيم test افتراضية بشرط `NODE_ENV=test`

#### job: `deploy` (يشتغل فقط بعد نجاح `integration-test`، وعلى push لـ `main` فقط)
- يتصل بالـ VPS عبر SSH
- يسحب آخر كود من `main`
- يبني frontend + backend
- يعيد تشغيل `pm2` للـ API
- يتحقق من health check

## هيكل الـ Docker

```
Dockerfile (multi-stage):
  Stage 1 (builder) — تثبيت deps + بناء dist/
  Stage 2 (production) — node:22-alpine، non-root user، HEALTHCHECK

docker-compose.yml:
  postgres  — PostgreSQL 16 Alpine + healthcheck
  api       — Backend API على port 8080
  nginx     — Reverse proxy + SSL termination
```

## متغيرات البيئة

انظر `.env.example` للقائمة الكاملة.

| متغير | الوصف | مطلوب |
|-------|-------|--------|
| `DATABASE_URL` | رابط قاعدة البيانات PostgreSQL | نعم |
| `JWT_SECRET` | مفتاح التشفير للـ JWT (32+ حرف) | نعم |
| `JWT_REFRESH_SECRET` | مفتاح refresh tokens | لا (يُستنتج من JWT_SECRET) |
| `TOTP_ENCRYPTION_KEY` | مفتاح AES-256 للـ TOTP (32 حرف بالضبط) | نعم |
| `PORT` | منفذ الـ API (افتراضي: 8080) | لا |
| `NODE_ENV` | `production` أو `development` | لا |
| `BACKUP_DIR` | مسار حفظ الـ backups | لا |
| `SUPER_ADMIN_IPS` | IPs مسموح لها بالـ super admin (فارغ = الكل) | لا |

---

## تدوير أسرار JWT للـ Integration Tests

هذا الدليل يوضح كيفية تغيير (rotation) لـ `INTEGRATION_JWT_SECRET`
و `INTEGRATION_JWT_REFRESH_SECRET` بدون انقطاع الـ CI.

### الأسرار المعنية

| Secret في GitHub | الاستخدام |
|------------------|-----------|
| `INTEGRATION_JWT_SECRET` | يُوقَّع به JWT في الـ integration tests (يُمرَّر كـ `JWT_SECRET` داخل الـ workflow) |
| `INTEGRATION_JWT_REFRESH_SECRET` | يُوقَّع به refresh JWT في الـ integration tests |

> هذه القيم **خاصة بالـ tests فقط** ولا تُستخدم في production.
> أسرار الـ production تبدأ بـ `VPS_` وتُدار بشكل منفصل.

### خطوات التدوير

**1. توليد قيم جديدة (32+ حرف)**

```bash
# مثال — يمكن استخدام أي طريقة لتوليد string عشوائي بطول كافٍ
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**2. تحديث الـ secrets في GitHub**

```
GitHub Repository → Settings → Secrets and variables → Actions → Repository secrets
```

- اختر `INTEGRATION_JWT_SECRET` ← اضغط **Update** ← الصق القيمة الجديدة ← **Save**
- كرر نفس الخطوة لـ `INTEGRATION_JWT_REFRESH_SECRET`

**3. التحقق من نجاح التدوير**

شغّل workflow يدوياً أو انتظر أي push:

```
GitHub → Actions → Deploy to Production → اختر آخر run
```

تحقق من الـ job المسمى **Multi-Tenant Integration Tests**:

- يجب أن تجد سطر مشابه لـ: `20 passed` في نهاية الـ logs
- لا يجب أن يظهر `[integration setup] ... Refusing to fall back` في الـ logs
  (هذا الخطأ يعني أن السر غائب تماماً في بيئة غير test)

### ماذا يحدث إذا غاب السر مؤقتاً؟

إذا حُذف السر قبل إضافة القيمة الجديدة (نافذة التدوير):

- `integration/setup.ts` يكتشف أن `process.env.JWT_SECRET` فارغ
- نظراً لأن `NODE_ENV=test` داخل الـ CI، يرجع لقيمة افتراضية آمنة ومسماة
- الـ 20 integration test تكمل بنجاح بالقيمة الافتراضية
- لا يُوجَد خطر تسريب لـ production لأن هذه القيم test-only

> **ملاحظة:** حتى في حالة الرجوع للقيمة الافتراضية، لن يتأثر الـ production
> لأن tokens الـ integration tests لا تُستخدم خارج بيئة الـ CI.

### للتطوير المحلي

انسخ `artifacts/api-server/.env.test.example` إلى `artifacts/api-server/.env.test`
واملأ القيم المناسبة. انظر الملف للتفاصيل.
