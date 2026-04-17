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

### `deploy.yml` — يشتغل عند push على `main` فقط
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
