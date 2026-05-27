/**
 * Salary structures, components, tax brackets, statutory contributions, and salary history.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  salaryStructuresTable, salaryComponentsTable,
  taxBracketsTable, statutoryContributionsTable,
  salaryHistoryTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { getTenant } from "../../middleware/auth";

const router: IRouter = Router();

function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }
function numOrNull(v: string | null | undefined) { return v != null ? Number(v) : null; }

/* ── Zod schemas ── */
const salaryStructureSchema = z.object({
  name_ar:     z.string().min(1, "اسم الهيكل مطلوب").max(200),
  name_en:     z.string().max(200).optional(),
  base_salary: z.number().min(0, "الراتب الأساسي لا يمكن أن يكون سالباً").optional().default(0),
  description: z.string().max(1000).nullable().optional(),
  is_active:   z.boolean().optional().default(true),
});

const salaryComponentSchema = z.object({
  component_type:      z.enum(["allowance","deduction","overtime","bonus","commission","other"]),
  name_ar:             z.string().min(1, "اسم العنصر مطلوب").max(200),
  name_en:             z.string().max(200).optional(),
  amount:              z.number().min(0).nullable().optional(),
  percentage_of_base:  z.number().min(0).max(100).nullable().optional(),
  is_mandatory:        z.boolean().optional().default(false),
  is_taxable:          z.boolean().optional().default(true),
  sequence:            z.number().int().min(0).optional().default(0),
});

const taxBracketSchema = z.object({
  fiscal_year: z.string().regex(/^\d{4}$/, "السنة المالية يجب أن تكون 4 أرقام"),
  min_salary:  z.number().min(0, "الحد الأدنى لا يمكن أن يكون سالباً"),
  max_salary:  z.number().positive().nullable().optional(),
  tax_rate:    z.number().min(0).max(100, "نسبة الضريبة يجب أن تكون بين 0 و100"),
});

const statutoryContributionSchema = z.object({
  contribution_type:    z.string().min(1, "نوع الاشتراك مطلوب"),
  name_ar:              z.string().min(1, "اسم الاشتراك مطلوب").max(200),
  name_en:              z.string().max(200).optional(),
  employee_percentage:  z.number().min(0).max(100).optional().default(0),
  employer_percentage:  z.number().min(0).max(100).optional().default(0),
  is_mandatory:         z.boolean().optional().default(true),
  is_active:            z.boolean().optional().default(true),
});

/* ═══════════════════════════════════════════════════════════════════
   SALARY STRUCTURES
══════════════════════════════════════════════════════════════════════ */

router.get("/salary-structures", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db.select().from(salaryStructuresTable)
    .where(eq(salaryStructuresTable.company_id, companyId))
    .orderBy(salaryStructuresTable.name_ar);
  res.json(rows.map(r => ({ ...r, base_salary: Number(r.base_salary), created_at: fmt(r.created_at), updated_at: fmt(r.updated_at) })));
}));

router.post("/salary-structures", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const parsed = salaryStructureSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الهيكل غير صحيحة", details: parsed.error.errors }); return; }
  const { name_ar, name_en, base_salary, description } = parsed.data;
  const [row] = await db.insert(salaryStructuresTable).values({
    company_id: companyId, name_ar: name_ar.trim(), name_en: (name_en?.trim() ?? name_ar.trim()),
    base_salary: String(base_salary ?? 0), description: description ?? null,
  }).returning();
  res.status(201).json({ ...row, base_salary: Number(row.base_salary), created_at: fmt(row.created_at), updated_at: fmt(row.updated_at) });
}));

router.put("/salary-structures/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const parsed = salaryStructureSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الهيكل غير صحيحة", details: parsed.error.errors }); return; }
  const { name_ar, name_en, base_salary, description, is_active } = parsed.data;
  const [row] = await db.update(salaryStructuresTable)
    .set({ name_ar: name_ar.trim(), name_en: (name_en?.trim() ?? name_ar.trim()), base_salary: String(base_salary ?? 0), description: description ?? null, is_active: is_active ?? true, updated_at: new Date() })
    .where(and(eq(salaryStructuresTable.id, id), eq(salaryStructuresTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "الهيكل غير موجود" }); return; }
  res.json({ ...row, base_salary: Number(row.base_salary), created_at: fmt(row.created_at), updated_at: fmt(row.updated_at) });
}));

router.delete("/salary-structures/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(salaryComponentsTable).where(eq(salaryComponentsTable.salary_structure_id, id));
  await db.delete(salaryStructuresTable).where(and(eq(salaryStructuresTable.id, id), eq(salaryStructuresTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ── Salary Components ────────────────────────────────────────── */
router.get("/salary-structures/:id/components", wrap(async (req, res) => {
  const id = parseInt(String(req.params["id"]), 10);
  const rows = await db.select().from(salaryComponentsTable)
    .where(eq(salaryComponentsTable.salary_structure_id, id))
    .orderBy(salaryComponentsTable.sequence);
  res.json(rows.map(r => ({ ...r, amount: numOrNull(r.amount), percentage_of_base: numOrNull(r.percentage_of_base), created_at: fmt(r.created_at) })));
}));

router.post("/salary-structures/:id/components", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  const parsed = salaryComponentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات العنصر غير صحيحة", details: parsed.error.errors }); return; }
  const { component_type, name_ar, name_en, amount, percentage_of_base, is_mandatory, is_taxable, sequence } = parsed.data;
  const [row] = await db.insert(salaryComponentsTable).values({
    salary_structure_id: id, component_type, name_ar,
    name_en: name_en ?? name_ar, amount: amount != null ? String(amount) : null,
    percentage_of_base: percentage_of_base != null ? String(percentage_of_base) : null,
    is_mandatory, is_taxable, sequence,
  }).returning();
  res.status(201).json({ ...row, amount: numOrNull(row.amount), percentage_of_base: numOrNull(row.percentage_of_base), created_at: fmt(row.created_at) });
}));

router.delete("/salary-structures/:structId/components/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(salaryComponentsTable).where(eq(salaryComponentsTable.id, id));
  res.json({ ok: true });
}));

/* ═══════════════════════════════════════════════════════════════════
   TAX BRACKETS
══════════════════════════════════════════════════════════════════════ */

router.get("/tax-brackets", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const year = String(req.query["year"] ?? new Date().getFullYear());
  const rows = await db.select().from(taxBracketsTable)
    .where(and(eq(taxBracketsTable.company_id, companyId), eq(taxBracketsTable.fiscal_year, year)))
    .orderBy(taxBracketsTable.min_salary);
  res.json(rows.map(r => ({ ...r, min_salary: Number(r.min_salary), max_salary: numOrNull(r.max_salary), tax_rate: Number(r.tax_rate), created_at: fmt(r.created_at) })));
}));

router.post("/tax-brackets", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const parsed = taxBracketSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الشريحة الضريبية غير صحيحة", details: parsed.error.errors }); return; }
  const { fiscal_year, min_salary, max_salary, tax_rate } = parsed.data;
  const [row] = await db.insert(taxBracketsTable).values({
    company_id: companyId, fiscal_year,
    min_salary: String(min_salary), max_salary: max_salary != null ? String(max_salary) : null,
    tax_rate: String(tax_rate),
  }).returning();
  res.status(201).json({ ...row, min_salary: Number(row.min_salary), max_salary: numOrNull(row.max_salary), tax_rate: Number(row.tax_rate), created_at: fmt(row.created_at) });
}));

router.put("/tax-brackets/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const parsed = taxBracketSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الشريحة الضريبية غير صحيحة", details: parsed.error.errors }); return; }
  const { fiscal_year, min_salary, max_salary, tax_rate } = parsed.data;
  const [row] = await db.update(taxBracketsTable)
    .set({ fiscal_year, min_salary: String(min_salary), max_salary: max_salary != null ? String(max_salary) : null, tax_rate: String(tax_rate) })
    .where(and(eq(taxBracketsTable.id, id), eq(taxBracketsTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "الشريحة الضريبية غير موجودة" }); return; }
  res.json({ ...row, min_salary: Number(row.min_salary), max_salary: numOrNull(row.max_salary), tax_rate: Number(row.tax_rate), created_at: fmt(row.created_at) });
}));

router.delete("/tax-brackets/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(taxBracketsTable).where(and(eq(taxBracketsTable.id, id), eq(taxBracketsTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ═══════════════════════════════════════════════════════════════════
   STATUTORY CONTRIBUTIONS
══════════════════════════════════════════════════════════════════════ */

router.get("/statutory-contributions", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db.select().from(statutoryContributionsTable)
    .where(eq(statutoryContributionsTable.company_id, companyId))
    .orderBy(statutoryContributionsTable.name_ar);
  res.json(rows.map(r => ({ ...r, employee_percentage: Number(r.employee_percentage), employer_percentage: Number(r.employer_percentage), created_at: fmt(r.created_at) })));
}));

router.post("/statutory-contributions", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const parsed = statutoryContributionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الاشتراك غير صحيحة", details: parsed.error.errors }); return; }
  const { contribution_type, name_ar, name_en, employee_percentage, employer_percentage, is_mandatory } = parsed.data;
  const [row] = await db.insert(statutoryContributionsTable).values({
    company_id: companyId, contribution_type,
    name_ar, name_en: name_en ?? name_ar,
    employee_percentage: String(employee_percentage ?? 0),
    employer_percentage: String(employer_percentage ?? 0),
    is_mandatory: is_mandatory ?? true,
  }).returning();
  res.status(201).json({ ...row, employee_percentage: Number(row.employee_percentage), employer_percentage: Number(row.employer_percentage), created_at: fmt(row.created_at) });
}));

router.put("/statutory-contributions/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  const parsed = statutoryContributionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات الاشتراك غير صحيحة", details: parsed.error.errors }); return; }
  const { name_ar, name_en, employee_percentage, employer_percentage, is_mandatory, is_active } = parsed.data;
  const [row] = await db.update(statutoryContributionsTable)
    .set({ name_ar, name_en: name_en ?? name_ar, employee_percentage: String(employee_percentage ?? 0), employer_percentage: String(employer_percentage ?? 0), is_mandatory: is_mandatory ?? true, is_active: is_active ?? true })
    .where(and(eq(statutoryContributionsTable.id, id), eq(statutoryContributionsTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "الاشتراك غير موجود" }); return; }
  res.json({ ...row, employee_percentage: Number(row.employee_percentage), employer_percentage: Number(row.employer_percentage), created_at: fmt(row.created_at) });
}));

router.delete("/statutory-contributions/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = getTenant(req);
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(statutoryContributionsTable).where(and(eq(statutoryContributionsTable.id, id), eq(statutoryContributionsTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ═══════════════════════════════════════════════════════════════════
   SALARY HISTORY
══════════════════════════════════════════════════════════════════════ */

router.get("/salary-history/:employeeId", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const empId = parseInt(String(req.params["employeeId"]), 10);
  const rows = await db.select().from(salaryHistoryTable)
    .where(eq(salaryHistoryTable.employee_id, empId))
    .orderBy(desc(salaryHistoryTable.effective_date));
  res.json(rows.map(r => ({ ...r, salary_amount: Number(r.salary_amount), created_at: fmt(r.created_at) })));
}));

router.post("/salary-history", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const userId = req.user?.id ?? null;
  const { employee_id, salary_amount, currency, effective_date, reason } = req.body as Record<string, unknown>;
  if (!employee_id || !salary_amount || !effective_date) { res.status(400).json({ error: "بيانات التاريخ الوظيفي غير مكتملة" }); return; }
  const [row] = await db.insert(salaryHistoryTable).values({
    employee_id: Number(employee_id), salary_amount: String(Number(salary_amount)),
    currency: String(currency ?? "EGP"), effective_date: String(effective_date),
    reason: (reason as string) ?? null, created_by: userId,
  }).returning();
  res.status(201).json({ ...row, salary_amount: Number(row.salary_amount), created_at: fmt(row.created_at) });
}));

export default router;
