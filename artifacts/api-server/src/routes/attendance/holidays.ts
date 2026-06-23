/** attendance/holidays.ts */
import { Router, type IRouter } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db, publicHolidaysTable } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { fmt, holidaySchema } from './_helpers';


const router: IRouter = Router();



router.get(
  '/public-holidays',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const rows = await db
      .select()
      .from(publicHolidaysTable)
      .where(eq(publicHolidaysTable.company_id, companyId))
      .orderBy(publicHolidaysTable.holiday_date);
    res.json(rows.map((r) => ({ ...r, created_at: fmt(r.created_at) })));
  })
);

router.post(
  '/public-holidays',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات الإجازة غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const { holiday_date, name_ar, name_en } = parsed.data;
    const [row] = await db
      .insert(publicHolidaysTable)
      .values({
        company_id: companyId,
        holiday_date,
        name_ar: name_ar.trim(),
        name_en: name_en?.trim() ?? name_ar.trim(),
      })
      .returning();
    res.status(201).json({ ...row, created_at: fmt(row.created_at) });
  })
);

router.delete(
  '/public-holidays/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const id = parseInt(String(req.params['id']), 10);
    await db
      .delete(publicHolidaysTable)
      .where(and(eq(publicHolidaysTable.id, id), eq(publicHolidaysTable.company_id, companyId)));
    res.json({ ok: true });
  })
);



export default router;
