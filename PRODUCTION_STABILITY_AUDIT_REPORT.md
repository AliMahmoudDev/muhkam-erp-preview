# MUHKAM ERP — Production Stability Audit Report

**Date:** 2026-06-11
**Auditor:** Replit Agent (main branch)
**Baseline commit:** `5deb3613` (fix(security): scope ledger and integrity checks by tenant)
**Branch:** `main` — unpushed

---

## 1. Scope

Six focus areas were reviewed against the production codebase:

| Area | Files Reviewed |
|---|---|
| Health checks | `routes/health.ts`, `lib/monitor.ts`, `routes/super/monitoring.ts` |
| Backup / restore | `lib/backup-service.ts`, `routes/backups.ts`, `routes/system.ts` |
| Logging / error handling | `lib/async-handler.ts`, `lib/email.ts`, `app.ts` (error handler) |
| Runtime configuration | `lib/load-env.ts`, `index.ts` (startup validation) |
| Monitoring readiness | `routes/metrics.ts`, `lib/prom-metrics.ts`, `lib/request-counter.ts` |
| Tenant safety scan | `routes/zkteco.ts`, `routes/repair-tracking.ts`, `routes/debug.ts` |

---

## 2. Changes Made

Three low-risk, focused fixes were applied. No schema changes. No business logic changes. No authentication changes.

---

### Change 1 — `artifacts/api-server/src/lib/async-handler.ts`

**Problem:** Every route handler error at HTTP 500+ was logged with `console.error()`, bypassing the Pino structured-logging pipeline. In production this produces unformatted plain-text stderr lines mixed among JSON log lines, which breaks log aggregation and alerting tools.

**Fix:** Replace `console.error(...)` with `logger.error({ method, url, err }, "[route-error]")`. Import `logger` from `./logger`.

**Risk:** None. The HTTP response behavior is unchanged. The global error handler in `app.ts` still fires after `next(err)` — the only difference is the intermediate log is now structured JSON.

---

### Change 2 — `artifacts/api-server/src/lib/email.ts`

**Problem:** `console.warn` (missing API key) and `console.error` (send failure) both bypass Pino structured logging. Email send failures in production are invisible to log-based alerting.

**Fix:** Replace both with `logger.warn(...)` and `logger.error({ err }, ...)`. Import `logger` from `./logger`.

**Risk:** None. External email behavior is unchanged.

---

### Change 3 — `artifacts/api-server/src/lib/backup-service.ts`

**Problem:** `isBackupTriggerEnabled()` queried `system_settings` without a `company_id` filter:

```typescript
// BEFORE (buggy):
const [row] = await db.select().from(systemSettingsTable)
  .where(eq(systemSettingsTable.key, key));
```

This is inconsistent with `getBackupSetting()` in `routes/backups.ts` which always scopes by `BACKUP_COMPANY_ID = 1`. If any other tenant's system_settings row happened to have the key `backup_on_login = true`, `maybeBackupAsync("login")` could trigger a global backup for every user login across all tenants — a denial-of-service risk on the backup pipeline.

**Fix:** Add `eq(systemSettingsTable.company_id, BACKUP_SETTINGS_COMPANY_ID)` via `and()`. Added `and` to the drizzle-orm import and defined `const BACKUP_SETTINGS_COMPANY_ID = 1`.

**Risk:** None. The query returns the same row as before in all normal configurations. The fix tightens the WHERE clause to match the write side.

---

## 3. What Was Checked and Found Clean

### Health Checks

- `/healthz` — unauthenticated by design (load-balancer compatible). Returns `{status, db, memory_mb, uptime_hours, last_check}`. **No secrets. No internal paths. No stack traces.** Status 503 on `unhealthy`. ✅
- `/healthz/deep` — unauthenticated. Returns DB read/write latency, `node_version`, `environment`. The `node_version` and `environment` fields are minor information disclosure but acceptable for an infrastructure health endpoint. They cannot be used to reconstruct credentials or session state. Authenticated equivalent (`GET /super/health`) provides the full picture to operators. ✅
- `POST /health/client-error` — unauthenticated, intentional (frontend error boundary). All user-controlled fields are sliced (`message: 500 chars`, `stack: 1000 chars`, `ua: 200 chars`). Falls under the general rate limiter (100 req/min/IP). No response body returned (`204`). ✅

### Backup Safety

- **Server-side backup** (`POST /api/backups`) — super_admin only, in-progress guard, MAX_BACKUPS=20 rotation, streaming write (not all-in-memory), AES-256-GCM fail-closed on encryption. ✅
- **Tenant backup** (`POST /api/system/backup`) — admin + requireTenant, all queries scoped by `company_id`. Super-admin users excluded from backup. ✅
- **Restore** (`POST /api/system/restore`) — 7-layer hardening contract enforced:
  1. `file.company_id` MUST match caller's `company_id` — hard block with audit log ✅
  2. `_meta.truncated === true` — hard block ✅
  3. Idempotency token (5-min window, DB-persisted) ✅
  4. Pre-restore snapshot written before any DELETE ✅
  5. All DELETEs scoped to `tenantOnly(table.company_id)` ✅
  6. `pg_advisory_xact_lock` serializes concurrent restores ✅
  7. `statement_timeout = 300s`, `lock_timeout = 60s` ✅
  8. Audit log written before (intent) and after (outcome) ✅
- **Path traversal** — both download and delete use `path.basename()` + prefix check against `BACKUP_DIR`. ✅

### Error Handling (global)

- Global `errorHandler` in `app.ts` correctly hides internals in production (`isDev = NODE_ENV !== 'production'`). Stack traces never reach responses in production. ✅
- Zod errors → 400 with field messages (no internal paths) ✅
- JWT errors → 401 ✅
- PG constraint errors → 409 ✅
- 500 errors → generic Arabic message in production ✅
- `captureException` called for 500+ (Sentry integration) ✅

### Runtime Configuration

- `index.ts` startup validates 5 required secrets at boot and calls `process.exit(1)` if any are missing: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TOTP_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `DATABASE_URL`. ✅
- `load-env.ts` loads `.env` without overwriting existing env vars (safe). ✅
- `NODE_ENV` is not in required vars — if unset, `isDev` defaults to `true` and error details could leak in responses. Mitigated by Replit's production env var management.

### Monitoring Readiness

- `GET /api/metrics` — admin+super_admin only, JSON dashboard with request rates, error rates, slowest endpoints, memory, job queue stats. ✅
- `GET /api/metrics/prometheus` — super_admin only, Prometheus text format. ✅
- `GET /super/health` — super_admin only, deep health + DB pool stats + memory. ✅
- `GET /super/health/redis` — super_admin only, Redis ping + latency. ✅
- `GET /super/alerts` — super_admin only, smart business + system alerts (expiring subscriptions, high memory). ✅
- Memory alert at 400MB fired every 30 min via Telegram if threshold exceeded. ✅
- Backup failure alert sent via Telegram with 4-hour cooldown. ✅
- `startMonitoring()` polls DB every 60s and logs status changes. ✅
- Slow query logging instrumented on PG pool at startup. ✅

### Tenant Safety Scan (new/touched routes)

- **ZKTeco** (`routes/zkteco.ts`) — per-company API keys (`ZKTECO_API_KEY_<id>`); global key blocked in production unless `ZKTECO_ALLOW_GLOBAL_KEY=true`. All DB writes scoped by `companyId`. ✅
- **Repair tracking** (`routes/repair-tracking.ts`) — public endpoint protected by HMAC token (`REPAIR_TRACKING_SECRET`), rate limited, all queries include `eq(repairJobsTable.company_id, companyId)`. ✅
- **Debug** (`routes/debug.ts`) — super_admin only. Read-only trial eligibility check. Fingerprint truncated in response. ✅
- **Commission reversal** (new code from recent sprint) — `isBackupTriggerEnabled` fix prevents any cross-tenant trigger. Reversal inserted inside the same `db.transaction()`. ✅

---

## 4. Risks Found (not changed)

| Risk | Severity | Rationale for not changing |
|---|---|---|
| `NODE_ENV` not in `REQUIRED_ENV_VARS` | Low | Replit's deployment sets this. Changing startup validation is a separate config task. |
| `/healthz/deep` exposes `node_version` + `environment` without auth | Info | Common infrastructure pattern; removing breaks existing monitoring. Move to super-admin-only endpoint in a future sprint. |
| `POST /system/backup` loads all tenant data in one `Promise.all` | Low | Bounded by tenant's own data; already has `MAX_TOTAL_ROWS` check in server-side service. Acceptable for tenant-scoped download. |
| `buildBackupPayload()` in `backup-service.ts` has `@deprecated` comment but is still callable | Info | Callers already noted; no immediate risk. Remove in a cleanup sprint. |

---

## 5. Validation Results

```
pnpm --filter @workspace/api-server run typecheck
→ tsc -p tsconfig.json --noEmit
→ EXIT 0 ✅

pnpm --filter @workspace/api-server test
→ Test Files  55 passed (55)
→ Tests  720 passed (720)
→ EXIT 0 ✅

API server restart
→ Backend started on port 8080 ✅
→ RLS init: 85 tables enabled ✅
→ No errors in startup logs ✅
```

---

## 6. Git Status

```
Modified (unstaged):
  artifacts/api-server/src/lib/async-handler.ts   (8 lines changed)
  artifacts/api-server/src/lib/backup-service.ts  (14 lines changed)
  artifacts/api-server/src/lib/email.ts           (5 lines changed)

Not pushed to remote. ✅
```

**Baseline commit before this work:** `5deb3613`

---

## 7. Recommended Next Steps (not done — future sprints)

1. **Add `NODE_ENV` to `REQUIRED_ENV_VARS`** — prevents accidental production-like deployments without proper configuration.
2. **Move `node_version` / `environment` fields out of `/healthz/deep`** — keep in `super/health` only.
3. **Remove `buildBackupPayload()`** — deprecated, memory-unsafe for large tenants; only the streaming `triggerBackup()` path should remain.
4. **Rate-limit `POST /health/client-error`** with a tighter per-IP limit (e.g. 20/min) to reduce log-flooding risk from malicious browsers.
5. **Redis for session blacklist + cache** — currently both fall back to in-memory store. In multi-instance deployments, revoked tokens would not be honored by other instances.
