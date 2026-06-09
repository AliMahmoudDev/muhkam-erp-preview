# MUHKAM ERP — Production Operations Runbook

Last updated: 2026-06-10

This is the canonical production operations guide for muhkampro.com.
Do not store real secrets in this document.

## 1. Production Architecture

| Layer | Current value |
|---|---|
| Main domain | https://muhkampro.com |
| API domain | https://api.muhkampro.com |
| VPS IP | 167.233.51.117 |
| App path | /var/www/muhkam-erp |
| API process | PM2: muhkam-api |
| API port behind Nginx | 8080 |
| Database | Supabase PostgreSQL |
| Persistent file storage | Cloudflare R2 |
| Backups | R2 + local encrypted backups |
| Cache / rate limit | Redis on VPS |
| Reverse proxy | Nginx |
| SSL | Let's Encrypt |

Supabase is the production database source of truth.
Cloudflare R2 stores persistent files/images and remote backups.
The VPS runs the app/API only.

## 2. Critical Paths

- /var/www/muhkam-erp
- /var/www/muhkam-erp/.env
- /etc/nginx/sites-available/muhkampro
- /etc/letsencrypt/live/muhkampro.com/
- /root/db-backups

Never delete the VPS .env file.

## 3. Health Checks

Fast API health:

    curl -fsS https://api.muhkampro.com/api/healthz

Deep API health:

    curl -fsS https://api.muhkampro.com/api/healthz/deep

Frontend:

    curl -I https://muhkampro.com

Expected result: HTTP 200.

## 4. PM2 Operations

    pm2 status
    pm2 logs muhkam-api --lines 100 --nostream
    pm2 restart muhkam-api
    pm2 save

After restart, verify:

    curl -fsS https://api.muhkampro.com/api/healthz

## 5. Nginx Operations

Validate config:

    sudo nginx -t

Reload safely:

    sudo systemctl reload nginx

Inspect config:

    sudo sed -n '1,220p' /etc/nginx/sites-available/muhkampro

## 6. Redis Operations

Check Redis container:

    docker ps --filter name=muhkam-redis

Ping Redis without printing secrets:

    redis-cli -u "$REDIS_URL" ping

Expected result:

    PONG

If Redis is down, cache/rate-limit behavior may degrade. Restart Redis before assuming the API is broken.

## 7. Required Environment Variables

Do not print values. Only check whether keys are SET or EMPTY.

Required:

- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- TOTP_ENCRYPTION_KEY
- BACKUP_ENCRYPTION_KEY
- REPAIR_TRACKING_SECRET
- ALLOWED_ORIGINS
- REDIS_URL
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET
- R2_PUBLIC_BASE_URL
- SUPER_ADMIN_IPS

Recommended:

- SENTRY_DSN
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- RESEND_API_KEY
- ZKTECO_API_KEY

Important:
- SUPER_ADMIN_IPS empty in production blocks super-admin by design.
- BACKUP_ENCRYPTION_KEY must be saved permanently.
- Old encrypted backups cannot be restored without the key used to create them.

## 8. Deployment Flow

Production deployment is handled by GitHub Actions over SSH to the VPS.

Workflow:

    .github/workflows/deploy.yml

Normal release flow:

1. Validate locally.
2. Commit changes.
3. Push to main.
4. GitHub Actions runs CI.
5. Deploy runs only after checks succeed.
6. Verify health endpoints.

Post-deploy verification:

    curl -fsS https://api.muhkampro.com/api/healthz
    curl -fsS https://api.muhkampro.com/api/healthz/deep
    curl -I https://muhkampro.com

## 9. Backup Verification

Local backup directory:

    /root/db-backups

Check local backups:

    sudo ls -lh /root/db-backups | tail -30

Check backup logs:

    pm2 logs muhkam-api --lines 300 --nostream | grep -i backup

R2 database backup retention is enforced by the app backup logic.
Default maximum is 30 database backup files unless configured by DB_BACKUP_MAX_FILES or BACKUP_MAX_FILES.

## 10. Restore Policy

Never restore directly into production for a drill.

Safe restore drill:

1. Generate or download a backup.
2. Restore into a temporary PostgreSQL database.
3. Verify tables and row counts.
4. Destroy the temporary restore target.

Production restore is destructive and requires:
- fresh backup before restore
- confirmed backup timestamp
- correct BACKUP_ENCRYPTION_KEY
- post-restore health checks
- tenant isolation verification

## 11. Rollback

Preferred rollback:

1. Revert the bad commit.
2. Push to main.
3. Let CI and deploy pipeline publish the rollback.

Emergency VPS rollback:

    cd /var/www/muhkam-erp
    git fetch origin main
    git checkout <STABLE_COMMIT_SHA>
    pnpm install --frozen-lockfile
    pnpm --filter @workspace/api-server run build
    PORT=5000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/erp-system run build
    pm2 restart muhkam-api
    curl -fsS https://api.muhkampro.com/api/healthz

Use emergency rollback only if GitHub deployment is unavailable.

## 12. Incident Checklist

When production is unhealthy:

1. Check external API health.
2. Check PM2 status and logs.
3. Check Nginx config/status.
4. Check Redis ping.
5. Check Supabase provider status.
6. Check last GitHub Actions deploy.
7. Roll back only if a bad release or broken config is identified.

## 13. Load Smoke Test

Run low traffic only:

    LOAD_TEST_BASE_URL=https://api.muhkampro.com LOAD_TEST_REQUESTS=20 LOAD_TEST_CONCURRENCY=2 LOAD_TEST_MAX_P95_MS=3000 pnpm run load:test

Do not run high traffic tests against production during business hours.

## 14. Launch TODOs

- Set SUPER_ADMIN_IPS to trusted static IPs or VPN egress IP.
- Configure Sentry DSN.
- Configure Telegram alerts.
- Verify R2 restore drill after final deploy.
- Keep BACKUP_ENCRYPTION_KEY in a secure password manager.
- Retire old server only after final validation and backup.
