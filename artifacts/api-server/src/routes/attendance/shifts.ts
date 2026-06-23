/** attendance/shifts.ts */
import { Router, type IRouter } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db, shiftSchedulesTable } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { requireFeature } from '../../middleware/feature-guard';
import { getTenant } from '../../middleware/auth';
import { fmt, shiftSchema } from './_helpers';


const router: IRouter = Router();



router.use(
  ['/attendance', '/shifts', '/employee-shifts', '/public-holidays'],
  requireFeature('hr')
);

/* ═══════════════════════════════════════════════════════════════════
   SHIFT SCHEDULES
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/shifts',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const rows = await db
      .select()
      .from(shiftSchedulesTable)
      .where(eq(shiftSchedulesTable.company_id, companyId))
      .orderBy(shiftSchedulesTable.name_ar);
    res.json(
      rows.map((r) => ({
        ...r,
        weekly_hours: Number(r.weekly_hours),
        created_at: fmt(r.created_at),
      }))
    );
  })
);

router.post(
  '/shifts',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const parsed = shiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات الوردية غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const {
      name_ar,
      name_en,
      start_time,
      end_time,
      break_duration,
      grace_minutes,
      weekly_hours,
      working_days,
    } = parsed.data;
    const [row] = await db
      .insert(shiftSchedulesTable)
      .values({
        company_id: companyId,
        name_ar,
        name_en: name_en ?? name_ar,
        start_time,
        end_time,
        break_duration,
        grace_minutes,
        weekly_hours: String(weekly_hours),
        working_days,
      })
      .returning();
    res
      .status(201)
      .json({ ...row, weekly_hours: Number(row.weekly_hours), created_at: fmt(row.created_at) });
  })
);

router.put(
  '/shifts/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const id = parseInt(String(req.params['id']), 10);
    const parsed = shiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات الوردية غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const {
      name_ar,
      name_en,
      start_time,
      end_time,
      break_duration,
      grace_minutes,
      weekly_hours,
      working_days,
      is_active,
    } = parsed.data;
    const [row] = await db
      .update(shiftSchedulesTable)
      .set({
        name_ar,
        name_en: name_en ?? name_ar,
        start_time,
        end_time,
        break_duration,
        grace_minutes,
        weekly_hours: String(weekly_hours),
        working_days,
        is_active: is_active ?? true,
      })
      .where(and(eq(shiftSchedulesTable.id, id), eq(shiftSchedulesTable.company_id, companyId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: 'الوردية غير موجودة' });
      return;
    }
    res.json({ ...row, weekly_hours: Number(row.weekly_hours), created_at: fmt(row.created_at) });
  })
);

router.delete(
  '/shifts/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const id = parseInt(String(req.params['id']), 10);
    await db
      .delete(shiftSchedulesTable)
      .where(and(eq(shiftSchedulesTable.id, id), eq(shiftSchedulesTable.company_id, companyId)));
    res.json({ ok: true });
  })
);

/* ── Employee Shift Assignments ───────────────────────────────── */

export default router;
