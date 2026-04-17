import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, erpUsersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isTokenBlacklisted } from "../lib/session-blacklist";
import { sanitizeObject } from "../lib/sanitize";

if (!process.env.JWT_SECRET) {
  throw new Error("[FATAL] JWT_SECRET environment variable is not set. Server cannot start securely.");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: string;
  permissions: string;
  active: boolean | null;
  warehouse_id: number | null;
  safe_id: number | null;
  company_id: number | null;
}

/* Extend Express Request */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      role?: string;
      companyId?: number | null;
    }
  }
}

/* ── Sign a short-lived access token (4 h) ──────────────── */
export function signToken(userId: number, role: string, companyId: number | null = null): string {
  return jwt.sign({ userId, role, companyId }, JWT_SECRET, { expiresIn: "4h" });
}

/* ── Sign a long-lived refresh token (7 d) ──────────────── */
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    "[FATAL] JWT_REFRESH_SECRET environment variable is not set. " +
    "Server cannot start securely. Set a strong independent JWT_REFRESH_SECRET.",
  );
}
const REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;

export function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as { userId: number; type: string };
    if (decoded.type !== "refresh") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

/* ── Verify JWT and attach user from DB ─────────────────── */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول أولاً" });
    return;
  }

  const token = auth.slice(7);

  /* Check token blacklist (logout / revocation) */
  if (await isTokenBlacklisted(token)) {
    res.status(401).json({ error: "انتهت الجلسة، يرجى تسجيل الدخول مجدداً" });
    return;
  }

  let payload: { userId: number; role: string };

  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
    return;
  }

  /* Always re-read from DB — never trust the token's role alone */
  const [user] = await db
    .select()
    .from(erpUsersTable)
    .where(eq(erpUsersTable.id, payload.userId));

  if (!user || user.active === false) {
    res.status(401).json({ error: "الحساب غير نشط" });
    return;
  }

  /* cashier/salesperson must have warehouse_id AND safe_id configured */
  if (user.role === "cashier" || user.role === "salesperson") {
    if (!user.warehouse_id || !user.safe_id) {
      res.status(400).json({ error: "يجب تحديد المخزن والخزنة لهذا المستخدم — يرجى مراجعة المدير" });
      return;
    }
  }

  /* Non-super_admin must belong to a company */
  if (user.role !== "super_admin" && !user.company_id) {
    res.status(403).json({ error: "حساب غير مرتبط بشركة — تواصل مع المدير" });
    return;
  }

  if (user.company_id) {
    const [co] = await db
      .select({ is_active: companiesTable.is_active, end_date: companiesTable.end_date })
      .from(companiesTable)
      .where(eq(companiesTable.id, user.company_id));
    if (co) {
      if (!co.is_active) {
        res.status(403).json({ error: "الاشتراك موقوف — يرجى التواصل مع المدير" });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (co.end_date < today) {
        res.status(403).json({ error: "انتهت صلاحية الاشتراك — يرجى تجديد الاشتراك" });
        return;
      }
    }
  }

  req.user = user as AuthUser;
  next();
}

/* ── Role guard factory ─────────────────────────────────── */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول أولاً" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `ليس لديك صلاحية — يتطلب: ${roles.join(" أو ")}`,
        required: roles,
        yourRole: req.user.role,
      });
      return;
    }
    next();
  };
}

/* ── XSS body sanitizer ─────────────────────────────────── */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
}

/* ─────────────────────────────────────────────────────────
   requireTenant — MANDATORY tenant resolution guard.
   Must run AFTER `authenticate`. Rejects any non-super_admin
   request that has no company_id. Eliminates `?? 1` fallbacks
   completely — every route can safely use req.user!.company_id!
   after this middleware passes.
   ───────────────────────────────────────────────────────── */
/* Stricter than requireTenant — REJECTS super_admin too. Use on routes
   that mutate tenant-scoped resources by id and have no business
   running cross-tenant. */
export function requireTenantStrict(req: any, res: any, next: any): void {
  const cid = req.user?.company_id;
  if (typeof cid !== "number" || cid <= 0) {
    res.status(403).json({
      error: "هذه العملية تتطلب سياق شركة (tenant) — استخدم حساب مستخدم تابع للشركة",
    });
    return;
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول أولاً" });
    return;
  }
  // super_admin operates across tenants — must explicitly pass company_id when needed
  if (req.user.role === "super_admin") {
    next();
    return;
  }
  if (!req.user.company_id || typeof req.user.company_id !== "number") {
    res.status(403).json({ error: "Tenant not resolved — حساب غير مرتبط بشركة" });
    return;
  }
  req.companyId = req.user.company_id;
  next();
}

/* ─────────────────────────────────────────────────────────
   getTenant(req) — strict tenant accessor for route handlers.
   Throws (caught by error handler → 403) if company_id missing.
   For super_admin, requires explicit ?company_id= query param.
   ───────────────────────────────────────────────────────── */
export function getTenant(req: Request): number {
  const cid = req.user?.company_id;
  if (typeof cid === "number" && cid > 0) return cid;
  if (req.user?.role === "super_admin") {
    const q = Number(req.query?.company_id ?? req.body?.company_id);
    if (Number.isFinite(q) && q > 0) return q;
    const err: any = new Error("super_admin must provide company_id");
    err.status = 400;
    throw err;
  }
  const err: any = new Error("Tenant not resolved");
  err.status = 403;
  throw err;
}

/* ── Convenience combos ─────────────────────────────────── */
export const adminOnly    = [authenticate, requireRole("admin"), requireTenant] as const;
export const managerUp    = [authenticate, requireRole("admin", "manager"), requireTenant] as const;
export const anyAuth      = [authenticate, requireTenant] as const;

/* ── IP Allowlist guard for super_admin routes ──────────── */
export function superAdminIPGuard(req: Request, res: Response, next: NextFunction): void {
  const allowedIPs = process.env.SUPER_ADMIN_IPS?.split(",").map((ip) => ip.trim()).filter(Boolean);

  /* If no IP list configured — allow all (development default) */
  if (!allowedIPs || allowedIPs.length === 0) {
    next();
    return;
  }

  /*
   * Use req.ip only — Express resolves it correctly via "trust proxy"
   * setting in app.ts (trust proxy = 1), so it reads the real client IP
   * from X-Forwarded-For safely without allowing header spoofing.
   * Never read X-Forwarded-For manually here — it can be forged.
   */
  const clientIP = req.ip || req.socket.remoteAddress;

  if (!clientIP || !allowedIPs.includes(clientIP)) {
    res.status(403).json({ error: "الوصول مرفوض — عنوان IP غير مصرح به" });
    return;
  }

  next();
}
