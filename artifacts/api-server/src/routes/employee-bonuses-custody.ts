/**
 * /api/employee-bonuses  — simple per-employee bonuses (الحافز)
 * /api/employee-custody  — employee custody / imprest (عهدة)
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, employeeBonusesTable, employeeCustodyTable, employeeCustodyLinesTable,
  employeesTable, safesTable, transactionsTable, expensesTable,
} from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();
const fmtTs = (v: Date | null | undefined) => (v instanceof Date ? v.toISOString() : (v ?? null));
const n = (v: unknown) => (v != null ? Number(v) : 0);

/* ═══════════════════════════════════════════════════════════════
   BONUSES (الحافز)
══════════════════════════════════════════════════════════════════ */

router.get("/employee-bonuses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  const conditions = [eq(employeeBonusesTable.company_id, companyId)];
  if (empId) conditions.push(eq(employeeBonusesTable.employee_id, empId));
  const rows = await db.select().from(employeeBonusesTable)
    .where(and(...conditions))
    .orderBy(desc(employeeBonusesTable.granted_date), desc(employeeBonusesTable.id));
  res.json(rows.map(r => ({ ...r, amount: n(r.amount), created_at: fmtTs(r.created_at) })));
}));

router.post("/employee-bonuses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const { employee_id, amount, reason, granted_date, currency } = req.body as Record<string, unknown>;
  if (!employee_id || amount == null || Number(amount) <= 0) {
    res.status(400).json({ error: "بيانات الحافز غير مكتملة" }); return;
  }
  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, Number(employee_id)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }
  const [row] = await db.insert(employeeBonusesTable).values({
    company_id: companyId,
    employee_id: Number(employee_id),
    amount: String(Number(amount)),
    reason: (reason as string) ?? null,
    granted_date: String(granted_date ?? new Date().toISOString().split("T")[0]),
    granted_by: userId,
    currency: String(currency ?? emp.currency ?? "EGP"),
  }).returning();
  res.status(201).json({ ...row, amount: n(row.amount), created_at: fmtTs(row.created_at) });
}));

router.delete("/employee-bonuses/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(employeeBonusesTable)
    .where(and(eq(employeeBonusesTable.id, id), eq(employeeBonusesTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ═══════════════════════════════════════════════════════════════
   CUSTODY (عهدة)
══════════════════════════════════════════════════════════════════ */

router.get("/employee-custody", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const empId = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  const conditions = [eq(employeeCustodyTable.company_id, companyId)];
  if (empId) conditions.push(eq(employeeCustodyTable.employee_id, empId));
  const rows = await db.select().from(employeeCustodyTable)
    .where(and(...conditions))
    .orderBy(desc(employeeCustodyTable.granted_date), desc(employeeCustodyTable.id));
  res.json(rows.map(r => ({
    ...r,
    amount: n(r.amount),
    returned_amount: n(r.returned_amount),
    reimbursement_due: n(r.reimbursement_due),
    created_at: fmtTs(r.created_at),
    updated_at: fmtTs(r.updated_at),
  })));
}));

/* GET بنود تسوية عهدة معينة */
router.get("/employee-custody/:id/lines", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const [parent] = await db.select().from(employeeCustodyTable)
    .where(and(eq(employeeCustodyTable.id, id), eq(employeeCustodyTable.company_id, companyId)));
  if (!parent) { res.status(404).json({ error: "العهدة غير موجودة" }); return; }
  const lines = await db.select().from(employeeCustodyLinesTable)
    .where(and(
      eq(employeeCustodyLinesTable.custody_id, id),
      eq(employeeCustodyLinesTable.company_id, companyId),
    ))
    .orderBy(desc(employeeCustodyLinesTable.line_date), desc(employeeCustodyLinesTable.id));
  res.json(lines.map(l => ({ ...l, amount: n(l.amount), created_at: fmtTs(l.created_at) })));
}));

router.post("/employee-custody", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const { employee_id, amount, purpose, granted_date, currency, notes, safe_id } = req.body as Record<string, unknown>;
  if (!employee_id || amount == null || Number(amount) <= 0) {
    res.status(400).json({ error: "بيانات العهدة غير مكتملة" }); return;
  }
  const amt = Number(amount);
  const safeIdNum = safe_id != null && safe_id !== "" ? Number(safe_id) : null;
  const dateStr = String(granted_date ?? new Date().toISOString().split("T")[0]);

  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, Number(employee_id)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const row = await db.transaction(async (tx) => {
    let safe: typeof safesTable.$inferSelect | null = null;
    if (safeIdNum) {
      const [s] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, safeIdNum), eq(safesTable.company_id, companyId)));
      if (!s) throw httpError(400, "الخزينة غير موجودة");
      if (Number(s.balance) < amt) throw httpError(400, `رصيد الخزينة غير كافٍ (${Number(s.balance).toFixed(2)})`);
      await tx.update(safesTable).set({ balance: String(Number(s.balance) - amt) }).where(eq(safesTable.id, s.id));
      safe = s;
    }
    const [created] = await tx.insert(employeeCustodyTable).values({
      company_id: companyId,
      employee_id: Number(employee_id),
      safe_id: safe?.id ?? null,
      amount: String(amt),
      purpose: (purpose as string) ?? null,
      granted_date: dateStr,
      granted_by: userId,
      currency: String(currency ?? emp.currency ?? "EGP"),
      notes: (notes as string) ?? null,
    }).returning();

    if (safe) {
      await tx.insert(transactionsTable).values({
        type: "custody_grant", reference_type: "employee_custody", reference_id: created.id,
        safe_id: safe.id, safe_name: safe.name,
        amount: String(amt), direction: "out",
        description: `صرف عهدة للموظف ${emp.first_name_ar} ${emp.last_name_ar}${purpose ? ` — ${String(purpose)}` : ""}`,
        date: dateStr,
        company_id: companyId,
      });
    }
    return created;
  });

  res.status(201).json({
    ...row, amount: n(row.amount), returned_amount: n(row.returned_amount),
    reimbursement_due: n(row.reimbursement_due),
    created_at: fmtTs(row.created_at), updated_at: fmtTs(row.updated_at),
  });
}));

/**
 * تسوية العهدة بالتفاصيل:
 * body: {
 *   settled_date?, notes?,
 *   returned_amount?: number,                       // المبلغ الفعلي المرتد للخزينة
 *   lines: Array<{ amount, category, description?, date? }>  // بنود المصروف
 * }
 * قواعد:
 *  - sum(lines) + returned_amount يجب أن يساوي amount (تسوية كاملة بدون فرق)
 *  - أو sum(lines) > amount → عجز (overspend) فيُسجَّل reimbursement_due = sum-amount، ويُجبَر returned=0
 *  - كل بند يُولِّد سجل مصروف (expenses) دون خصم إضافي من الخزينة (المال خرج عند الصرف)
 *  - returned_amount يضاف للخزينة (إن وُجدت) مع حركة in
 */
router.post("/employee-custody/:id/settle", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const body = req.body as Record<string, unknown>;
  const settledDate = String(body["settled_date"] ?? new Date().toISOString().split("T")[0]);
  const linesIn = Array.isArray(body["lines"]) ? (body["lines"] as Array<Record<string, unknown>>) : [];

  if (linesIn.length === 0) {
    res.status(400).json({ error: "أدخل بنود المصروف على الأقل بنداً واحداً" }); return;
  }

  // تنظيف وفحص البنود
  const lines = linesIn.map((l, idx) => {
    const amt = Number(l["amount"]);
    const cat = String(l["category"] ?? "").trim();
    if (!isFinite(amt) || amt <= 0) throw httpError(400, `بند رقم ${idx + 1}: المبلغ غير صالح`);
    if (!cat) throw httpError(400, `بند رقم ${idx + 1}: نوع المصروف مطلوب`);
    return {
      amount: amt,
      category: cat,
      description: l["description"] != null ? String(l["description"]) : null,
      line_date: String(l["date"] ?? settledDate),
    };
  });

  const sumLines = lines.reduce((s, l) => s + l.amount, 0);

  const [existing] = await db.select().from(employeeCustodyTable)
    .where(and(eq(employeeCustodyTable.id, id), eq(employeeCustodyTable.company_id, companyId)));
  if (!existing) { res.status(404).json({ error: "العهدة غير موجودة" }); return; }
  if (existing.status === "settled") { res.status(409).json({ error: "العهدة مغلقة بالفعل" }); return; }

  const original = Number(existing.amount);
  let returned = body["returned_amount"] != null ? Number(body["returned_amount"]) : Math.max(0, original - sumLines);
  if (!isFinite(returned) || returned < 0) { res.status(400).json({ error: "المبلغ المرتجع غير صالح" }); return; }

  let reimbursement = 0;
  if (sumLines > original) {
    // عجز — الموظف صرف أكثر من العهدة
    reimbursement = +(sumLines - original).toFixed(2);
    if (returned > 0) {
      res.status(400).json({ error: "لا يمكن إرجاع مبلغ في حالة العجز (المصروفات تجاوزت العهدة)" }); return;
    }
  } else {
    // كامل — يجب أن يطابق المجموع قيمة العهدة
    const diff = +(original - sumLines - returned).toFixed(2);
    if (Math.abs(diff) > 0.01) {
      res.status(400).json({
        error: `إجمالي البنود (${sumLines.toFixed(2)}) + المرتجع (${returned.toFixed(2)}) لا يساوي العهدة (${original.toFixed(2)})`,
      });
      return;
    }
  }

  const [emp] = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.id, existing.employee_id), eq(employeesTable.company_id, companyId)));

  const result = await db.transaction(async (tx) => {
    let safe: typeof safesTable.$inferSelect | null = null;
    if (existing.safe_id) {
      const [s] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, existing.safe_id), eq(safesTable.company_id, companyId)));
      if (s) safe = s;
    }

    // إنشاء سجلات المصروفات + بنود التسوية
    for (const ln of lines) {
      const [exp] = await tx.insert(expensesTable).values({
        category: ln.category,
        amount: String(ln.amount),
        description: `[عهدة #${id}] ${ln.description ?? ""}`.trim(),
        safe_id: safe?.id ?? null,
        safe_name: safe?.name ?? null,
        company_id: companyId,
        branch_id: emp?.branch_id ?? null,
      }).returning();

      await tx.insert(employeeCustodyLinesTable).values({
        company_id: companyId,
        custody_id: id,
        category: ln.category,
        amount: String(ln.amount),
        description: ln.description,
        line_date: ln.line_date,
        expense_id: exp.id,
      });

      // حركة مالية للمصروف بدون اتجاه (none) لأن المال خرج فعلاً عند صرف العهدة
      await tx.insert(transactionsTable).values({
        type: "expense", reference_type: "expense", reference_id: exp.id,
        safe_id: safe?.id ?? null, safe_name: safe?.name ?? null,
        amount: String(ln.amount), direction: "none",
        description: `مصروف من عهدة #${id}: ${ln.category}${ln.description ? ` — ${ln.description}` : ""}`,
        date: ln.line_date,
        company_id: companyId,
      });
    }

    // إعادة المبلغ المتبقي للخزينة
    if (safe && returned > 0) {
      await tx.update(safesTable)
        .set({ balance: String(Number(safe.balance) + returned) })
        .where(eq(safesTable.id, safe.id));
      await tx.insert(transactionsTable).values({
        type: "custody_return", reference_type: "employee_custody", reference_id: id,
        safe_id: safe.id, safe_name: safe.name,
        amount: String(returned), direction: "in",
        description: `إرجاع باقي عهدة #${id}${emp ? ` — ${emp.first_name_ar} ${emp.last_name_ar}` : ""}`,
        date: settledDate,
        company_id: companyId,
      });
    }

    const [updated] = await tx.update(employeeCustodyTable)
      .set({
        returned_amount: String(returned),
        reimbursement_due: String(reimbursement),
        settled_date: settledDate,
        status: "settled",
        notes: (body["notes"] as string) ?? existing.notes,
        updated_at: new Date(),
      })
      .where(eq(employeeCustodyTable.id, id))
      .returning();
    return updated;
  });

  res.json({
    ...result,
    amount: n(result.amount),
    returned_amount: n(result.returned_amount),
    reimbursement_due: n(result.reimbursement_due),
    created_at: fmtTs(result.created_at),
    updated_at: fmtTs(result.updated_at),
  });
}));

router.delete("/employee-custody/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);

  const [existing] = await db.select().from(employeeCustodyTable)
    .where(and(eq(employeeCustodyTable.id, id), eq(employeeCustodyTable.company_id, companyId)));
  if (!existing) { res.json({ ok: true }); return; }
  if (existing.status === "settled") {
    res.status(409).json({ error: "لا يمكن حذف عهدة مغلقة. أنشئ تسوية عكسية بدلاً من ذلك." }); return;
  }

  await db.transaction(async (tx) => {
    // إعادة المال للخزينة (لو خُصم منها وقت الصرف)
    if (existing.safe_id) {
      const [s] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, existing.safe_id), eq(safesTable.company_id, companyId)));
      if (s) {
        await tx.update(safesTable)
          .set({ balance: String(Number(s.balance) + Number(existing.amount)) })
          .where(eq(safesTable.id, s.id));
        await tx.insert(transactionsTable).values({
          type: "custody_cancel", reference_type: "employee_custody", reference_id: id,
          safe_id: s.id, safe_name: s.name,
          amount: String(existing.amount), direction: "in",
          description: `إلغاء عهدة #${id}`,
          date: new Date().toISOString().split("T")[0],
          company_id: companyId,
        });
      }
    }
    await tx.delete(employeeCustodyTable).where(eq(employeeCustodyTable.id, id));
  });
  res.json({ ok: true });
}));

export default router;
