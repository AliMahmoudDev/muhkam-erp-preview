# MUHKAM ERP — Disaster Recovery Plan

Last updated: 2026-06-10

This document defines the disaster recovery plan for the live muhkampro.com production environment.
Do not store real secrets in this document.

## 1. Recovery Objectives

| Item | Target |
|---|---|
| RTO | Restore critical API + frontend within 4 hours |
| RPO | Maximum acceptable data loss: latest verified backup window |
| Priority 1 | Supabase PostgreSQL recovery |
| Priority 2 | API availability on VPS |
| Priority 3 | R2 persistent files and backups |
| Priority 4 | Redis/cache recovery |

RTO = maximum acceptable downtime.
RPO = maximum acceptable data loss.

## 2. Production Source of Truth

| Component | Source of truth |
|---|---|
| Database | Supabase PostgreSQL |
| Uploaded files/images | Cloudflare R2 |
| Remote backups | Cloudflare R2 |
| Local backup copy | /root/db-backups on VPS |
| Application code | GitHub main branch |
| Runtime env | /var/www/muhkam-erp/.env on VPS |

## 3. Disaster Scenarios

### A. Bad code release

Symptoms:
- API health fails after deploy.
- PM2 logs show runtime errors.
- Frontend loads but critical flows fail.

Action:
1. Prefer Git revert and push to main.
2. Let CI/deploy pipeline publish rollback.
3. If GitHub deploy is unavailable, use emergency VPS rollback from the operations runbook.

### B. VPS failure

Symptoms:
- VPS unreachable by SSH.
- Nginx/API down.
- IP unreachable.

Action:
1. Provision new VPS.
2. Install Node/pnpm/PM2/Nginx/Redis.
3. Clone GitHub repo to /var/www/muhkam-erp.
4. Restore .env from secure password manager.
5. Build API/frontend.
6. Start PM2 process muhkam-api.
7. Point DNS records to new VPS IP.
8. Issue or renew SSL certificates.
9. Verify health endpoints.

### C. Supabase database failure or data corruption

Symptoms:
- Database unreachable.
- Tenant data missing/corrupted.
- API logs show PostgreSQL errors.

Action:
1. Stop writes or put app in maintenance mode.
2. Take a fresh backup if possible.
3. Identify latest clean backup.
4. Restore into a temporary database first.
5. Verify tables, row counts, and tenant isolation.
6. Restore production only after confirming the backup is clean.
7. Run post-restore checks.

### D. R2 file storage failure

Symptoms:
- Images/files fail to upload or load.
- R2 errors in API logs.
- Backups cannot upload to R2.

Action:
1. Confirm Cloudflare R2 service status.
2. Verify R2 env keys are SET, not printed.
3. Check bucket and access policy.
4. Temporarily rely on local backups only if R2 backup upload is unavailable.
5. Do not delete local backups until R2 is healthy again.

### E. Redis failure

Symptoms:
- Redis ping fails.
- Cache/rate-limit logs show Redis errors.

Action:
1. Restart Redis container/service.
2. Verify PONG.
3. Confirm API health.
4. Redis does not hold source-of-truth data, so no data restore is needed.

## 4. Backup Verification Schedule

Recommended schedule:

- Daily: confirm latest local backup exists.
- Daily: confirm R2 backup upload exists.
- Weekly: restore drill into temporary PostgreSQL.
- Before major launch: full R2 restore drill.
- Before deleting old server: final backup and restore verification.

## 5. Restore Drill Rules

Never run a restore drill against production.

Safe drill:
1. Create temporary PostgreSQL target.
2. Restore backup into the temporary target.
3. Verify schema and representative row counts.
4. Verify tenant scoped tables.
5. Destroy the temporary target.

## 6. Production Restore Rules

Production restore is destructive.

Before restore:
1. Confirm incident owner.
2. Confirm exact backup timestamp.
3. Confirm BACKUP_ENCRYPTION_KEY availability.
4. Take fresh backup if production DB is reachable.
5. Stop writes or enable maintenance mode.

After restore:
1. Run /api/healthz.
2. Run /api/healthz/deep.
3. Verify login.
4. Verify tenant isolation.
5. Verify uploads/files.
6. Verify backup scheduler resumes.
7. Document incident timeline and root cause.

## 7. Minimum Secrets Needed for Recovery

Required to recover onto a new VPS:

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

Never print these values in logs, screenshots, tickets, or chat.

## 8. Post-Recovery Validation

Run:

    curl -fsS https://api.muhkampro.com/api/healthz
    curl -fsS https://api.muhkampro.com/api/healthz/deep
    curl -I https://muhkampro.com

Then verify manually:

- Super admin access from allowed IP only.
- Normal tenant login.
- Product list.
- Sales invoice creation.
- Repair job creation.
- File upload to R2.
- Backup job logs.
- No cross-tenant data visibility.

## 9. Incident Record

For each disaster event, create a dated note under:

    docs/operations/incidents/

Include:

- Incident start/end time.
- Impact.
- Root cause.
- Recovery steps used.
- Data loss assessment.
- Follow-up fixes.
