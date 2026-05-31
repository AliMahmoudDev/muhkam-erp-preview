/**
 * /api/super — Stats and snapshot routes for companies.
 */
import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, companiesTable, erpUsersTable } from "@workspace/db";
import { authenticate, requireRole } from "../../../middleware/auth";
import { wrap } from "../../../lib/async-handler";
import { writeAuditLog } from "../../../lib/audit-log";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ── GET /super/companies/:id/snapshot — rich view of company data ── */
router.get("/super/companies/:id/snapshot", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const [admins, recentAudit] = await Promise.all([
    db.select({ id: erpUsersTable.id, name: erpUsersTable.name, username: erpUsersTable.username,
                role: erpUsersTable.role, active: erpUsersTable.active, last_login: erpUsersTable.last_login })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.company_id, id))
      .limit(20),
    (async () => {
      const { auditLogsTable: al } = await import("@workspace/db");
      return db.select().from(al)
        .where(eq(al.company_id, id))
        .orderBy(desc(al.created_at))
        .limit(15);
    })(),
  ]);

  const [salesRow, purchasesRow] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0)::numeric AS total FROM sales WHERE company_id=${id}`),
    db.execute(sql`SELECT COUNT(*) AS cnt FROM purchases WHERE company_id=${id}`),
  ]);

  const salesCount     = Number((salesRow.rows[0] as Record<string, unknown>)?.cnt ?? 0);
  const salesRevenue   = Number((salesRow.rows[0] as Record<string, unknown>)?.total ?? 0);
  const purchasesCount = Number((purchasesRow.rows[0] as Record<string, unknown>)?.cnt ?? 0);

  void writeAuditLog({
    action: "SUPER_ADMIN_ACCESS", record_type: "company", record_id: id,
    user: req.user, company_id: null,
    note: `عرض لقطة شركة: ${company.name}`,
  });

  res.json({ company, admins, recentAudit, stats: { salesCount, salesRevenue, purchasesCount } });
}));

/* ── GET /super/stats — overall stats (enhanced) ── */
router.get("/super/stats", ...superOnly, wrap(async (_req, res) => {
  const companies = await db.select().from(companiesTable);
  const users = await db
    .select({ id: erpUsersTable.id, company_id: erpUsersTable.company_id })
    .from(erpUsersTable)
    .where(sql`${erpUsersTable.role} != 'super_admin'`);

  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const ago30 = new Date(now);
  ago30.setDate(ago30.getDate() - 30);

  const expiringSoon = companies.filter(c =>
    c.is_active && c.end_date >= nowStr && c.end_date <= in7Str
  );

  const userCountByCompany: Record<number, number> = {};
  for (const u of users) {
    if (u.company_id) userCountByCompany[u.company_id] = (userCountByCompany[u.company_id] ?? 0) + 1;
  }

  const monthlySignups: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    const count = companies.filter(c => {
      const cd = new Date(c.created_at);
      return cd.getFullYear() === y && cd.getMonth() === m;
    }).length;
    monthlySignups.push({ month: label, count });
  }

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.is_active && c.end_date >= nowStr).length,
    trial: companies.filter(c => c.plan_type === "trial" && c.is_active && c.end_date >= nowStr).length,
    paid: companies.filter(c => c.plan_type === "paid" && c.is_active && c.end_date >= nowStr).length,
    expired: companies.filter(c => c.end_date < nowStr).length,
    suspended: companies.filter(c => !c.is_active).length,
    totalUsers: users.length,
    expiringSoon: expiringSoon.length,
    expiringSoonList: expiringSoon.map(c => ({
      id: c.id, name: c.name,
      end_date: c.end_date, plan_type: c.plan_type,
      days_left: Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000),
    })),
    recentSignups: companies.filter(c => new Date(c.created_at) >= ago30).length,
    monthlySignups,
    userCountByCompany,
  };

  res.json(stats);
}));

export default router;
