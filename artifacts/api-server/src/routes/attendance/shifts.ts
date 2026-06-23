/** attendance/shifts.ts */
import { Router, type IRouter } from 'express';
import { eq, and, desc, gte, lte, sql, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  db,
  attendanceRecordsTable,
  shiftSchedulesTable,
  employeeShiftAssignmentsTable,
  overtimeRecordsTable,
  publicHolidaysTable,
  attendanceSummaryTable,
  employeesTable,
} from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { requireFeature } from '../../middleware/feature-guard';
import { getTenant } from '../../middleware/auth';


/* ── Zod schemas for mutation bodies ── */
const shiftSchema = z.object({
  name_ar: z.string().min(1, 'اسم الوردية مطلوب'),
  name_en: z.string().optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت غير صحيحة'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت غير صحيحة'),
  break_duration: z.number().int().min(0).optional().default(60),
  grace_minutes: z.number().int().min(0).optional().default(5),
  weekly_hours: z.number().min(0).max(168).optional().default(40),
  working_days: z.string().optional().default('0,1,2,3,4'),
  is_active: z.boolean().optional().default(true),
});

const employeeShiftSchema = z.object({
  employee_id: z.number().int().positive('معرّف الموظف مطلوب'),
  shift_schedule_id: z.number().int().positive('معرّف الوردية مطلوب'),
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

const checkInSchema = z.object({
  employee_id: z.number().int().positive().optional(),
  attendance_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  check_in_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});

const checkOutSchema = z.object({
  employee_id: z.number().int().positive().optional(),
  attendance_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  check_out_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  notes: z.string().max(500).nullable().optional(),
});

const attendanceEditSchema = z.object({
  check_in_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  check_out_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  status: z.enum(['present', 'absent', 'late', 'half_day', 'leave', 'holiday']).optional(),
  notes: z.string().max(500).nullable().optional(),
  working_hours: z.number().min(0).max(24).optional(),
  late_minutes: z.number().int().min(0).optional(),
  overtime_hours: z.number().min(0).max(24).optional(),
});

const overtimeSchema = z.object({
  employee_id: z.number().int().positive('معرّف الموظف مطلوب'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  hours: z.number().min(0.25).max(24, 'عدد الساعات لا يمكن أن يتجاوز 24'),
  reason: z.string().max(500).nullable().optional(),
});

const holidaySchema = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  name_ar: z.string().min(1, 'اسم الإجازة مطلوب').max(200),
  name_en: z.string().max(200).optional(),
});

const router: IRouter = Router();

const router: IRouter = Router();

router.use(
  ['/attendance', '/shifts', '/employee-shifts', '/public-holidays'],
  requireFeature('hr')
);
function fmt(v: Date | null | undefined) {
  return v instanceof Date ? v.toISOString() : (v ?? null);
}

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
