/**
 * Departments and Job Titles — organisational structure
 */
import { Router } from 'express';
import { eq, and, isNull, sql } from 'drizzle-orm';
import {
  db,
  employeesTable,
  departmentsTable,
  jobTitlesTable,
} from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { fmtTs, requireHrAccess } from './helpers';

const router = Router();

/* ═══ DEPARTMENTS ═══════════════════════════════════════════════════ */

router.get('/departments', wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const rows = await db.select().from(departmentsTable)
    .where(eq(departmentsTable.company_id, companyId))
    .orderBy(departmentsTable.name_ar);
  res.json(rows.map((d) => ({ ...d, created_at: fmtTs(d.created_at) })));
}));

router.post('/departments', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = req.user!.company_id!;
  const { name_en, name_ar, description_en, description_ar } = req.body as Record<string, string>;
  if (!name_ar?.trim()) { res.status(400).json({ error: 'اسم القسم (عربي) مطلوب' }); return; }
  const [dep] = await db.insert(departmentsTable).values({
    company_id: companyId,
    name_en: name_en?.trim() ?? name_ar.trim(),
    name_ar: name_ar.trim(),
    description_en: description_en ?? null,
    description_ar: description_ar ?? null,
  }).returning();
  res.status(201).json({ ...dep, created_at: fmtTs(dep.created_at) });
}));

router.put('/departments/:id', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params['id']), 10);
  const { name_en, name_ar, description_en, description_ar } = req.body as Record<string, string>;
  if (!name_ar?.trim()) { res.status(400).json({ error: 'اسم القسم (عربي) مطلوب' }); return; }
  const [dep] = await db.update(departmentsTable)
    .set({ name_en: name_en?.trim() ?? name_ar.trim(), name_ar: name_ar.trim(), description_en: description_en ?? null, description_ar: description_ar ?? null })
    .where(and(eq(departmentsTable.id, id), eq(departmentsTable.company_id, companyId)))
    .returning();
  if (!dep) { res.status(404).json({ error: 'القسم غير موجود' }); return; }
  res.json({ ...dep, created_at: fmtTs(dep.created_at) });
}));

router.delete('/departments/:id', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params['id']), 10);
  const active = await db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable)
    .where(and(eq(employeesTable.department_id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at), eq(employeesTable.employment_status, 'active')));
  if ((active[0]?.count ?? 0) > 0) { res.status(422).json({ error: 'لا يمكن حذف قسم يحتوي على موظفين نشطين' }); return; }
  await db.delete(departmentsTable).where(and(eq(departmentsTable.id, id), eq(departmentsTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ═══ JOB TITLES ════════════════════════════════════════════════════ */

router.get('/job-titles', wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const rows = await db.select().from(jobTitlesTable)
    .where(eq(jobTitlesTable.company_id, companyId))
    .orderBy(jobTitlesTable.name_ar);
  res.json(rows.map((j) => ({ ...j, created_at: fmtTs(j.created_at) })));
}));

router.post('/job-titles', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = req.user!.company_id!;
  const { name_en, name_ar } = req.body as Record<string, string>;
  if (!name_ar?.trim()) { res.status(400).json({ error: 'المسمى الوظيفي (عربي) مطلوب' }); return; }
  const [jt] = await db.insert(jobTitlesTable).values({
    company_id: companyId,
    name_en: name_en?.trim() ?? name_ar.trim(),
    name_ar: name_ar.trim(),
  }).returning();
  res.status(201).json({ ...jt, created_at: fmtTs(jt.created_at) });
}));

router.put('/job-titles/:id', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params['id']), 10);
  const { name_en, name_ar } = req.body as Record<string, string>;
  if (!name_ar?.trim()) { res.status(400).json({ error: 'المسمى الوظيفي (عربي) مطلوب' }); return; }
  const [jt] = await db.update(jobTitlesTable)
    .set({ name_en: name_en?.trim() ?? name_ar.trim(), name_ar: name_ar.trim() })
    .where(and(eq(jobTitlesTable.id, id), eq(jobTitlesTable.company_id, companyId)))
    .returning();
  if (!jt) { res.status(404).json({ error: 'المسمى الوظيفي غير موجود' }); return; }
  res.json({ ...jt, created_at: fmtTs(jt.created_at) });
}));

router.delete('/job-titles/:id', wrap(async (req, res) => {
  if (!requireHrAccess(req, res)) return;
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params['id']), 10);
  const active = await db.select({ count: sql<number>`COUNT(*)::int` }).from(employeesTable)
    .where(and(eq(employeesTable.job_title_id, id), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if ((active[0]?.count ?? 0) > 0) { res.status(422).json({ error: 'لا يمكن حذف مسمى وظيفي مرتبط بموظفين' }); return; }
  await db.delete(jobTitlesTable).where(and(eq(jobTitlesTable.id, id), eq(jobTitlesTable.company_id, companyId)));
  res.json({ ok: true });
}));

export default router;
