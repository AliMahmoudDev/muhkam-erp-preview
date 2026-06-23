/** attendance/summary.ts */
import { Router, type IRouter } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, attendanceRecordsTable, overtimeRecordsTable, attendanceSummaryTable, employeesTable } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';

/* ── Zod schemas ── */
const overtimeSchema = z.object({
  employee_id: z.number().int().positive('معرّف الموظف مطلوب'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  hours: z.number().min(0.25).max(24, 'عدد الساعات لا يمكن أن يتجاوز 24'),
  reason: z.string().max(500).nullable().optional(),
});

const router: IRouter = Router();



router.put(
  '/attendance/records/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const id = parseInt(String(req.params['id']), 10);

    /* Verify attendance record belongs to this company (via employee FK) */
    const [owned] = await db
      .select({ id: attendanceRecordsTable.id })
      .from(attendanceRecordsTable)
      .innerJoin(
        employeesTable,
        and(
          eq(employeesTable.id, attendanceRecordsTable.employee_id),
          eq(employeesTable.company_id, companyId)
        )
      )
      .where(eq(attendanceRecordsTable.id, id))
      .limit(1);
    if (!owned) {
      res.status(404).json({ error: 'السجل غير موجود' });
      return;
    }

    const parsed = attendanceEditSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات التعديل غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const {
      check_in_time,
      check_out_time,
      status,
      notes,
      working_hours,
      late_minutes,
      overtime_hours,
    } = parsed.data;
    const updates: Record<string, unknown> = { updated_at: new Date(), verified_by: req.user?.id };
    if (check_in_time !== undefined) updates['check_in_time'] = check_in_time;
    if (check_out_time !== undefined) updates['check_out_time'] = check_out_time;
    if (status !== undefined) updates['status'] = status;
    if (notes !== undefined) updates['notes'] = notes;
    if (working_hours !== undefined) updates['working_hours'] = String(working_hours);
    if (late_minutes !== undefined) updates['late_minutes'] = late_minutes;
    if (overtime_hours !== undefined) updates['overtime_hours'] = String(overtime_hours);
    const [record] = await db
      .update(attendanceRecordsTable)
      .set(updates as Partial<typeof attendanceRecordsTable.$inferInsert>)
      .where(eq(attendanceRecordsTable.id, id))
      .returning();
    if (!record) {
      res.status(404).json({ error: 'السجل غير موجود' });
      return;
    }
    res.json({
      ...record,
      working_hours: record.working_hours != null ? Number(record.working_hours) : null,
      overtime_hours: record.overtime_hours != null ? Number(record.overtime_hours) : null,
      created_at: fmt(record.created_at),
      updated_at: fmt(record.updated_at),
    });
  })
);

/* ── Attendance Summary ───────────────────────────────────────── */
router.get(
  '/attendance/summary/:employeeId',
  wrap(async (req, res) => {
    const selfEmpId = req.user?.employee_id ?? null;
    const canViewAll = hasPermission(req.user, 'can_view_employees');
    const empId = parseInt(String(req.params['employeeId']), 10);
    const isSelf = selfEmpId !== null && selfEmpId === empId;
    if (!canViewAll && !isSelf) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const month = String(req.query['month'] ?? new Date().toISOString().substring(0, 7));
    const [summary] = await db
      .select()
      .from(attendanceSummaryTable)
      .where(
        and(eq(attendanceSummaryTable.employee_id, empId), eq(attendanceSummaryTable.month, month))
      );
    if (summary) {
      res.json({
        ...summary,
        total_overtime_hours: Number(summary.total_overtime_hours),
        total_working_hours: Number(summary.total_working_hours),
        created_at: fmt(summary.created_at),
        updated_at: fmt(summary.updated_at),
      });
      return;
    }
    // Compute on-the-fly if no cached summary
    const records = await db
      .select()
      .from(attendanceRecordsTable)
      .where(
        and(eq(attendanceRecordsTable.employee_id, empId), sql`LEFT(attendance_date, 7) = ${month}`)
      );
    const computed = {
      employee_id: empId,
      month,
      total_present_days: records.filter((r) => ['present', 'late'].includes(r.status)).length,
      total_absent_days: records.filter((r) => r.status === 'absent').length,
      total_late_days: records.filter((r) => r.status === 'late').length,
      total_early_departures: records.filter((r) => (r.early_departure_minutes ?? 0) > 0).length,
      total_overtime_hours: records.reduce((s, r) => s + Number(r.overtime_hours ?? 0), 0),
      total_working_hours: records.reduce((s, r) => s + Number(r.working_hours ?? 0), 0),
    };
    res.json(computed);
  })
);

/* ═══════════════════════════════════════════════════════════════════
   OVERTIME
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/attendance/overtime',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const rows = await db
      .select({
        id: overtimeRecordsTable.id,
        employee_id: overtimeRecordsTable.employee_id,
        date: overtimeRecordsTable.date,
        hours: overtimeRecordsTable.hours,
        reason: overtimeRecordsTable.reason,
        status: overtimeRecordsTable.status,
        created_at: overtimeRecordsTable.created_at,
        first_name_ar: employeesTable.first_name_ar,
        last_name_ar: employeesTable.last_name_ar,
      })
      .from(overtimeRecordsTable)
      .leftJoin(employeesTable, eq(overtimeRecordsTable.employee_id, employeesTable.id))
      .where(eq(employeesTable.company_id, companyId))
      .orderBy(desc(overtimeRecordsTable.date))
      .limit(100);
    res.json(rows.map((r) => ({ ...r, hours: Number(r.hours), created_at: fmt(r.created_at) })));
  })
);

router.post(
  '/attendance/overtime',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const userId = req.user?.id ?? null;
    const parsed = overtimeSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات العمل الإضافي غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const { employee_id, date, hours, reason } = parsed.data;
    const [row] = await db
      .insert(overtimeRecordsTable)
      .values({
        employee_id,
        date,
        hours: String(hours),
        reason: reason ?? null,
        approved_by: userId,
        status: 'approved',
      })
      .returning();
    res.status(201).json({ ...row, hours: Number(row.hours), created_at: fmt(row.created_at) });
  })
);

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC HOLIDAYS
══════════════════════════════════════════════════════════════════════ */


export default router;
