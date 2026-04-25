# MUHKAM ERP — Security Documentation

This document describes the authentication, authorization, and data isolation mechanisms built into the system.

---

## Table of Contents

1. [Authentication (JWT)](#authentication-jwt)
2. [Token Management](#token-management)
3. [Authorization (Roles & Permissions)](#authorization-roles--permissions)
4. [Data Isolation (Multi-Tenancy)](#data-isolation-multi-tenancy)
5. [Super Admin Protections](#super-admin-protections)
6. [Subscription Guard](#subscription-guard)
7. [Input Validation & XSS Protection](#input-validation--xss-protection)
8. [Brute-Force Protection](#brute-force-protection)
9. [Audit Logging](#audit-logging)
10. [Backup Security](#backup-security)
11. [Security Configuration Checklist](#security-configuration-checklist)

---

## Authentication (JWT)

Authentication is implemented in `artifacts/api-server/src/middleware/auth.ts`.

### How it works

1. User submits `username` + `PIN` to `POST /api/auth/login`
2. The PIN is verified against a **bcrypt hash** stored in `erp_users.pin`
3. On success, the server issues two tokens:
   - **Access token** — short-lived (4 hours), signed with `JWT_SECRET`
   - **Refresh token** — long-lived (7 days), signed with `JWT_REFRESH_SECRET`

4. Tokens are delivered as **httpOnly cookies** (primary) to prevent JavaScript from reading them (XSS mitigation). A `Bearer` header fallback is also supported for programmatic clients.

### Token Verification Flow

Every protected request goes through this sequence:
```
1. Extract token from cookie (primary) or Authorization header (fallback)
2. Check token against in-memory/Redis blacklist
3. Verify JWT signature and expiry with jwt.verify()
4. Re-fetch user from DB — NEVER trust cached role in the token alone
5. Verify user.active === true
6. Verify company subscription status
7. Attach user to req.user
```

**Why re-fetch from DB?** The JWT payload contains `userId` and `role`. However, if a user is deactivated or their role is changed, the old token would still be valid until expiry. By re-fetching from the database on every request, the system ensures immediate enforcement of role/status changes.

### Required Environment Variables

```
JWT_SECRET=<minimum 64 random characters>
JWT_REFRESH_SECRET=<different from JWT_SECRET, also minimum 64 chars>
```

Both secrets must be set or the server will refuse to start with a `[FATAL]` error.

---

## Token Management

### Refresh Token Rotation

Refresh tokens are stored in the `refresh_tokens` table. On each refresh:
1. The old refresh token is invalidated (deleted from DB)
2. A new refresh token is issued
3. A new access token is issued

This is **one-time use** rotation — a stolen refresh token can only be used once before it becomes invalid.

### Session Blacklist (Logout / Revocation)

On logout, the access token is added to a blacklist. Two backends are supported:

- **Redis** (production): `REDIS_URL` environment variable configures this. Tokens are stored with TTL matching their remaining expiry.
- **In-memory** (development): Single-instance only. Tokens are lost on server restart.

The following log message means Redis is not configured:
```
[SessionBlacklist] REDIS_URL not set — using in-memory store (single-instance only)
```
This is acceptable for development but Redis is strongly recommended for production.

### 2FA (TOTP)

Super admin accounts can enable TOTP-based two-factor authentication:

1. `GET /api/auth/2fa/setup` — generates a QR code and TOTP secret
2. The secret is encrypted with `TOTP_ENCRYPTION_KEY` (AES) before storage in `erp_users.totp_secret`
3. `POST /api/auth/2fa/verify` — verifies the first 6-digit token and enables 2FA
4. Subsequent logins require the current 6-digit code from the authenticator app

---

## Authorization (Roles & Permissions)

### Role Hierarchy

| Role | Level | Scope |
|------|-------|-------|
| `super_admin` | Platform | All companies — no company_id |
| `admin` | Company | Full access to their company |
| `manager` | Company | Broad access; admin-only actions blocked |
| `accountant` | Company | Financial modules access |
| `cashier` | Company | POS only; must have warehouse + safe assigned |
| `salesperson` | Company | Sales only; must have warehouse + safe assigned |
| `viewer` | Company | Read-only access |

### Role Guard Middleware

```typescript
// Applied to routes via middleware composition:
router.get("/example", authenticate, requireRole("admin", "manager"), handler);
```

Convenience composites defined in `auth.ts`:
```typescript
adminOnly   = [authenticate, requireRole("admin"), requireTenant]
managerUp   = [authenticate, requireRole("admin", "manager"), requireTenant]
anyAuth     = [authenticate, requireTenant]
superOnly   = [authenticate, requireRole("super_admin")]
```

### Granular Permissions

Beyond role-level access, individual users can have specific permissions enabled or disabled via the `permissions` JSONB column in `erp_users`. These are checked via `hasPermission(user, "can_view_treasury")` in route handlers.

Examples of granular permissions:
- `can_view_treasury` — access safe transfer and voucher pages
- `can_approve_sales` — approve sales invoices
- `can_view_reports` — access financial reports
- `can_manage_employees` — HR module access

---

## Data Isolation (Multi-Tenancy)

### Application Layer (Primary Guard)

Every route handler that touches business data uses the `getTenant(req)` helper, which returns the authenticated user's `company_id`. This is appended to **every** database query:

```typescript
const companyId = getTenant(req);
const items = await db
  .select()
  .from(salesTable)
  .where(eq(salesTable.company_id, companyId));  // ← mandatory isolation
```

There is no fallback to `company_id = 1` or similar. `getTenant()` throws a `403` if `company_id` is missing.

### Database Layer (Defense-in-Depth)

PostgreSQL Row Level Security provides a second layer of protection. On each authenticated request:

```sql
-- Backend executes these before any query:
SET ROLE erp_app_role;
SELECT set_config('app.current_company_id', '42', false);
SELECT set_config('app.is_super_admin', 'false', false);
```

RLS policies on each table evaluate these session variables. Super admins set `app.is_super_admin = 'true'` which bypasses tenant policies.

**Important caveat:** The connection pool may route different queries in the same request to different connections. The session variable set above applies only to the connection it was set on. Application-layer filtering is therefore the definitive mechanism. RLS adds an extra barrier but cannot be fully relied upon in a pooled connection environment without connection pinning.

### Tenant Resolution Middleware

`requireTenant` (in `auth.ts`) runs after `authenticate` on all business routes:
- Super admins: allowed to proceed without a company_id (they operate cross-tenant)
- All others: must have a valid `company_id` in their user record, or the request is rejected with `403`

---

## Super Admin Protections

Super admin routes (`/api/super/*`) have multiple overlapping protections:

### 1. IP Allowlist
```
# .replit / server env var
SUPER_ADMIN_IPS=203.0.113.10,198.51.100.5
```

The `superAdminIPGuard` middleware reads `req.ip` (resolved from `X-Forwarded-For` via Express's trust-proxy setting, preventing header forgery) and rejects non-listed IPs with `403`. If unset, all IPs are allowed — development default only.

### 2. Role Guard
Every super admin route uses `requireRole("super_admin")`. A user with any other role receives `403`.

### 3. Audit Trail
Every super admin action is recorded in `audit_logs` with `company_id = NULL`:
- Viewing company list (`SUPER_ADMIN_LIST_VIEW`)
- Accessing a company's details (`SUPER_ADMIN_ACCESS`)
- Extending a subscription (`COMPANY_EXTENDED`)
- Suspending/activating (`COMPANY_SUSPENDED` / `COMPANY_ACTIVATED`)
- Deleting a company (`COMPANY_DELETED`)
- Resetting an admin password (`ADMIN_PASSWORD_RESET`)

### 4. Self-Protection Guards
- A super admin cannot delete or deactivate their own account
- The system ensures at least one super admin always exists (delete is blocked if only one remains)

### 5. Company Delete Confirmation Code
Deleting a company with active users requires a 6-digit confirmation code generated client-side and sent back to the server for matching. This prevents accidental mass deletions.

---

## Subscription Guard

`tenantGuard` middleware (in `tenant-guard.ts`) runs on all tenant routes after authentication:

1. Fetches company status from DB (cached for 60 seconds per company)
2. **Inactive company** (`is_active = false`) → `403` for all requests
3. **Expired subscription:**
   - Write requests (POST/PUT/DELETE) → `402 Payment Required` immediately
   - Read requests (GET) → `402` after a **7-day grace period**
   - During grace period: adds `X-Subscription-Warning: expired:Xd` response header

On cache invalidation (after extending a subscription), call `invalidateTenantCache(companyId)` to clear the 60-second cache immediately.

---

## Input Validation & XSS Protection

### Body Sanitization
`sanitizeBody` middleware runs on all write requests. It recursively sanitizes all string fields in `req.body` using the `xss` library, stripping HTML tags and script injections.

### Schema Validation
Critical write endpoints use Zod schemas for input validation:
```typescript
const v = validate(createCompanySchema, req.body);
if (!v.success) { res.status(400).json({ error: "...", details: v.errors }); return; }
```

### HTTP Security Headers
`helmet` is configured on the Express app to set:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (in production)
- `Referrer-Policy`

### HPP (HTTP Parameter Pollution)
`hpp` middleware prevents parameter pollution attacks (e.g., `?role=admin&role=super_admin`).

---

## Brute-Force Protection

### Login Rate Limiting
`express-rate-limit` applies a strict rate limit on the login endpoint:
- Max 10 requests per 15 minutes per IP
- Returns `429 Too Many Requests` when exceeded

### Account Lockout
Failed login attempts are tracked in `erp_users.login_attempts`. After a threshold:
- `locked_until` is set to a future timestamp
- The account is temporarily locked until the timestamp passes
- A successful login resets the counter

---

## Audit Logging

The `writeAuditLog()` function in `lib/audit-log.ts` is a fire-and-forget helper used throughout the codebase. It:

- **Never throws** — a logging failure does not affect the main request
- Records `old_value` and `new_value` as JSONB for full change history
- Uses `company_id = NULL` for platform-level events to avoid polluting any tenant's forensic trail

Audited events include:
- All CRUD operations on critical records (sales, customers, employees, accounts)
- Safe transfers and fee applications
- Inventory adjustments and transfers
- Fiscal year locks/unlocks
- Payroll period lifecycle
- All super admin actions
- Backup and restore operations

---

## Backup Security

Database backups created via `POST /api/super/backup/create` can be encrypted:

- If `BACKUP_ENCRYPTION_KEY` is set, backups are encrypted with **AES-256-GCM**
- Encrypted files have the `.json.enc` extension
- The encryption key can be retrieved for secure storage via `GET /api/super/encryption-key`
- Restore accepts both plaintext `.json` and encrypted `.enc` files

**Warning:** Without the encryption key, encrypted backups cannot be restored. Store the key in a secure location separate from the backup files.

---

## Security Configuration Checklist

Use this before going to production:

- [ ] `JWT_SECRET` set to a random 64+ character string
- [ ] `JWT_REFRESH_SECRET` set to a **different** random 64+ character string
- [ ] `TOTP_ENCRYPTION_KEY` set to a 32-character AES key
- [ ] `REDIS_URL` configured for session blacklist and brute-force tracking
- [ ] `SUPER_ADMIN_IPS` configured to restrict super-admin access by IP
- [ ] `BACKUP_ENCRYPTION_KEY` set to enable encrypted backups
- [ ] Nginx configured with HTTPS/TLS — see `deploy/nginx.conf`
- [ ] 2FA enabled on the super admin account
- [ ] Default PINs changed (never use `693014` or `202576` in production)
- [ ] `NODE_ENV=production` set on the server
