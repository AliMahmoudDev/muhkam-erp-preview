# Muhkam ERP - Production Deployment Status

> ⚠️ Production note: the current canonical production operations guide is
> `docs/operations/PRODUCTION_OPERATIONS.md`.
> Use that file as the source of truth for the live muhkampro.com environment.
>

Last Updated: 2026-06-08

## Production Server

- Domain: muhkampro.com
- Public IP: 167.233.51.117
- Environment: Production

---

## Infrastructure

### Nginx

Status: ACTIVE

Reverse Proxy:

- localhost:8080 -> muhkampro.com

Production config path:

- /etc/nginx/sites-available/muhkampro

### PM2

Application:

- muhkam-api

Status:

- Online

### SSL

Provider:

- Let's Encrypt

Active Domains:

- muhkampro.com
- www.muhkampro.com
- app.muhkampro.com
- api.muhkampro.com

Certificate Location:

- /etc/letsencrypt/live/muhkampro.com/

Auto Renewal:

- Enabled

---

## Database

Engine:

- PostgreSQL

Status:

- Running

DATABASE_URL:

- Configured

Migrations:

- Applied Successfully

RLS:

- Enabled and Initialized

Role:

- erp_app_role

Status:

- Successfully created and assigned

---

## Validation Results

- Local Backend: 200 OK
- Domain HTTP: 200 OK
- Domain HTTPS: 200 OK
- Health Endpoint: 200 OK

Health endpoint:

- https://api.muhkampro.com/api/healthz

---

## Remaining Warnings

### Redis

Current Status:

- Not Configured

Warnings:

- Cache disabled
- Rate limiting uses memory
- Session blacklist uses memory

Missing variable:

- REDIS_URL

### ZKTeco

Current Status:

- Not Configured

Missing variable:

- ZKTECO_API_KEY

Impact:

- Attendance device integrations disabled until configured.

---

## Old Server

Current Status:

- Still Running

Plan:

1. Keep online for 48 hours minimum.
2. Verify production stability.
3. Verify all user operations.
4. Take final backup.
5. Shutdown old server.
6. Keep snapshot/archive before deletion.

---

## Deployment Pipeline Decision

Replit deploymentTarget is Autoscale and does not deploy directly to the VPS.

Production VPS deploy is handled by:

- .github/workflows/deploy.yml

Required GitHub Secrets:

- VPS_HOST must point to 167.233.51.117
- VPS_USER
- VPS_PASSWORD
- DEPLOY_TOKEN
- SUPER_ADMIN_PIN

---

## Critical Production Paths

Application:

- /var/www/muhkam-erp

Nginx:

- /etc/nginx/sites-available/muhkampro

PM2:

- muhkam-api

SSL:

- /etc/letsencrypt/live/muhkampro.com/

---

## Final Status

Production Deployment:

- SUCCESSFUL

Backend:

- WORKING

Database:

- WORKING

Nginx:

- WORKING

SSL:

- WORKING

Domain:

- WORKING

Health Checks:

- PASSING

Remaining Work:

- Verify GitHub secret VPS_HOST points to 167.233.51.117
- Configure Redis
- Configure ZKTeco integration if required
- Retire old server after validation and final backup
