/** attendance/holidays.ts */
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


export default router;
