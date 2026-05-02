# Threat Model

## Project Overview

MUHKAM ERP is a multi-tenant Arabic ERP platform with a React web frontend, an Express 5 API server, PostgreSQL via Drizzle ORM, and an Expo mobile client. It handles operational and financial workflows for multiple tenant companies, including POS, inventory, accounting, HR, payroll, repairs, warranties, alerts, backups, and super-admin SaaS management.

Production traffic primarily reaches the Express API in `artifacts/api-server/src/app.ts`, which also serves the built React SPA from `artifacts/erp-system/dist/public`. Authentication is JWT-based with httpOnly cookies for the web client and token support for mobile clients. The system relies heavily on per-tenant `company_id` filtering in application queries, with PostgreSQL RLS used as defense in depth.

Production-scope assumption for repeated scans:
- `artifacts/mockup-sandbox` is dev-only and should be ignored unless a production route or build step imports it.
- `NODE_ENV` is `production` in deployed environments.
- TLS is platform-managed and not a primary scan target here.

## Assets

- **User accounts and sessions** — JWT access tokens, refresh tokens, super-admin sessions, tenant admin sessions, trusted device identifiers, and 2FA state. Compromise allows impersonation and privileged access.
- **Tenant business data** — sales, purchases, customers, suppliers, inventory, repairs, warranties, reports, payroll, attendance, and accounting records. Exposure would leak commercially sensitive and personal data across tenants.
- **Cross-tenant platform control plane** — company records, subscription state, feature flags, trial-abuse controls, backup controls, and super-admin actions. Abuse could impact all tenants, not just one company.
- **Backups and restore artifacts** — tenant JSON exports, server-side backups, encrypted backup files, and restore inputs. These may contain nearly complete tenant datasets and must be protected as highly sensitive assets.
- **Application secrets** — JWT signing keys, refresh-token signing keys, TOTP encryption keys, backup encryption keys, admin bootstrap credentials, database credentials, and third-party integration tokens. Compromise would enable account forgery, backup decryption, or administrative takeover.
- **Audit and alerting records** — audit logs, alerts, notifications, and trial-monitoring signals. These support forensic integrity and abuse detection.

## Trust Boundaries

- **Browser/mobile client to API server** — all request parameters, bodies, cookies, and headers are untrusted until validated. Public endpoints need separate scrutiny because they intentionally bypass authentication.
- **API server to PostgreSQL** — the API has broad database access. Query-level tenant scoping is the primary isolation boundary; failures here can become cross-tenant exposure or tampering.
- **Authenticated tenant user to tenant data** — authenticated users must still be restricted by role, feature entitlement, and `company_id` scope.
- **Super-admin to platform-wide data** — super-admin routes intentionally cross tenant boundaries and therefore require especially strong authentication, authorization, auditing, and operator safeguards.
- **API server to filesystem** — backup creation, backup download, and restore logic cross into local file storage and must prevent path traversal, plaintext leakage, and tenant mix-ups.
- **API server to external services** — Telegram alerting, email-verification flows, and any third-party integrations require protection of secrets and validation of outbound/inbound data handling.
- **Public device integrations to API server** — inbound attendance/device traffic on `/iclock` and `/api/attendance/zkteco` is unauthenticated at the app-session layer and must bind each request to the correct tenant/device. Deployment-wide shared secrets are not sufficient when one tenant or installer can observe them.
- **Public tracking to tenant repair data** — repair-tracking endpoints intentionally expose limited tenant data without authentication; they need careful minimization and resistance to enumeration.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts`, `artifacts/erp-system/src/main.tsx`
- **Highest-risk backend areas**: `artifacts/api-server/src/middleware/auth.ts`, `routes/auth.ts`, `routes/zkteco.ts`, `routes/super.ts`, `routes/debug.ts`, `routes/trial-monitoring.ts`, `routes/system.ts`, `routes/backups.ts`, `routes/reports.ts`, `routes/devices.ts`, `routes/repairs.ts`
- **Public surfaces**: `/api/auth/*`, `/api/health*`, `/iclock`, `/api/attendance/zkteco`, `/api/public/repair-tracking/*`, `/api/public/repair-track/*`
- **Admin/super-admin surfaces**: `routes/super.ts`, `routes/debug.ts`, `routes/trial-monitoring.ts`, backup management, restore flows, company management
- **Dev-only areas normally ignored**: `artifacts/mockup-sandbox/**`, local scripts unless wired into production runtime

## Threat Categories

### Spoofing

The application depends on JWT access tokens, refresh tokens, and super-admin 2FA to establish identity. All protected endpoints must validate tokens server-side, re-load the user from the database, and reject inactive or malformed accounts. Secret signing material and bootstrap admin credentials must never be committed to source control or exposed to clients because that would allow attackers to mint valid tokens or log in as privileged users.

### Tampering

Tenant users can create and modify financial, inventory, HR, and repair records with significant business impact. Server-side handlers must enforce role checks, feature entitlements, state-transition rules, and tenant scoping independent of the client. Backup and restore paths must ensure a tenant can only restore or overwrite its own data, and user-controlled restore inputs must never influence writes outside the intended tenant scope.

### Information Disclosure

This system stores sensitive business and personal information across many tenants, including customer identities, financial ledgers, payroll data, attendance, repair histories, and audit logs. Public endpoints must return only the minimum required fields and must not rely on predictable identifiers alone for secrecy. Public login helpers must not expose tenant staff directories, privileged roles, or internal user identifiers. Error responses, logs, docs, backups, backup decryption material, and client bundles must not expose secrets, internal state, or cross-tenant data.

### Denial of Service

Public auth routes, public tracking routes, backup/restore flows, and heavy reporting endpoints can be abused for resource exhaustion. Rate limits, body-size limits, request timeouts, and bounded backup logic are required to keep unauthenticated or low-privilege users from degrading service. Long-running restore or backup operations must remain serialized and bounded so they cannot starve the database or filesystem.

### Elevation of Privilege

The most important privilege boundary is tenant user vs. tenant admin vs. super-admin, followed by company-to-company separation. Every data-access path must enforce `company_id` server-side and must not rely solely on pooled-connection RLS state. Super-admin-only functions, feature-gated modules, and sensitive maintenance or accounting operations must fail closed on authorization decisions; otherwise ordinary tenant users or expired tenants may gain access to workflows they should not be able to use. Network-level safeguards intended for super-admin routes, such as IP allowlists, must apply consistently to every production super-admin mount point rather than only the main router subtree.
