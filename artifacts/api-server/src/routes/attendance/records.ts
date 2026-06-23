/** attendance/records.ts */
import { Router, type IRouter } from 'express';
import { eq, and, or, desc, gte, lte, sql, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, attendanceRecordsTable, employeesTable, employeeShiftAssignmentsTable, shiftSchedulesTable } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';

/* ── Zod schemas ── */
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


const router: IRouter = Router();



router.post(
  '/employee-shifts',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_employees')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const parsed = employeeShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات تعيين الوردية غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const { employee_id, shift_schedule_id, assigned_date, end_date } = parsed.data;
    const [row] = await db
      .insert(employeeShiftAssignmentsTable)
      .values({
        employee_id,
        shift_schedule_id,
        assigned_date,
        end_date: end_date ?? null,
      })
      .returning();
    res.status(201).json({ ...row, created_at: fmt(row.created_at) });
  })
);

router.get(
  '/employee-shifts/:employeeId',
  wrap(async (req, res) => {
    const empId = parseInt(String(req.params['employeeId']), 10);
    const rows = await db
      .select({
        id: employeeShiftAssignmentsTable.id,
        employee_id: employeeShiftAssignmentsTable.employee_id,
        shift_schedule_id: employeeShiftAssignmentsTable.shift_schedule_id,
        assigned_date: employeeShiftAssignmentsTable.assigned_date,
        end_date: employeeShiftAssignmentsTable.end_date,
        shift_name_ar: shiftSchedulesTable.name_ar,
        start_time: shiftSchedulesTable.start_time,
        end_time: shiftSchedulesTable.end_time,
      })
      .from(employeeShiftAssignmentsTable)
      .leftJoin(
        shiftSchedulesTable,
        eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id)
      )
      .where(eq(employeeShiftAssignmentsTable.employee_id, empId))
      .orderBy(desc(employeeShiftAssignmentsTable.assigned_date));
    res.json(rows);
  })
);

/* ═══════════════════════════════════════════════════════════════════
   ATTENDANCE RECORDS
══════════════════════════════════════════════════════════════════════ */

router.get(
  '/attendance/records',
  wrap(async (req, res) => {
    const selfEmpId = req.user?.employee_id ?? null;
    const canViewAll = hasPermission(req.user, 'can_view_employees');
    const requestedEmpId = req.query['employee_id']
      ? parseInt(String(req.query['employee_id']), 10)
      : null;
    const isSelf = selfEmpId !== null && requestedEmpId !== null && selfEmpId === requestedEmpId;
    if (!canViewAll && !isSelf) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }

    const companyId = getTenant(req);
    const from = String(req.query['from'] ?? '');
    const to = String(req.query['to'] ?? '');
    const status = String(req.query['status'] ?? '');

    const conditions = [sql`${employeesTable.company_id} = ${companyId}`];
    if (from) conditions.push(gte(attendanceRecordsTable.attendance_date, from));
    if (to) conditions.push(lte(attendanceRecordsTable.attendance_date, to));
    // Self-service: always restrict to own records; admins use provided filter or none
    if (!canViewAll && selfEmpId) {
      conditions.push(eq(attendanceRecordsTable.employee_id, selfEmpId));
    } else if (requestedEmpId) {
      conditions.push(eq(attendanceRecordsTable.employee_id, requestedEmpId));
    }
    if (status) conditions.push(eq(attendanceRecordsTable.status, status));

    const rows = await db
      .select({
        id: attendanceRecordsTable.id,
        employee_id: attendanceRecordsTable.employee_id,
        attendance_date: attendanceRecordsTable.attendance_date,
        check_in_time: attendanceRecordsTable.check_in_time,
        check_out_time: attendanceRecordsTable.check_out_time,
        status: attendanceRecordsTable.status,
        working_hours: attendanceRecordsTable.working_hours,
        late_minutes: attendanceRecordsTable.late_minutes,
        overtime_hours: attendanceRecordsTable.overtime_hours,
        notes: attendanceRecordsTable.notes,
        created_at: attendanceRecordsTable.created_at,
        first_name_ar: employeesTable.first_name_ar,
        last_name_ar: employeesTable.last_name_ar,
        employee_code: employeesTable.employee_code,
      })
      .from(attendanceRecordsTable)
      .leftJoin(employeesTable, eq(attendanceRecordsTable.employee_id, employeesTable.id))
      .where(and(...conditions))
      .orderBy(desc(attendanceRecordsTable.attendance_date))
      .limit(200);

    res.json(
      rows.map((r) => ({
        ...r,
        working_hours: r.working_hours != null ? Number(r.working_hours) : null,
        overtime_hours: r.overtime_hours != null ? Number(r.overtime_hours) : null,
        created_at: fmt(r.created_at),
      }))
    );
  })
);

/* ── Check In ─────────────────────────────────────────────────── */
router.post(
  '/attendance/check-in',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const userId = req.user?.id ?? null;
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات الحضور غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const { employee_id, attendance_date, check_in_time, notes } = parsed.data;

    // Resolve employee: explicit id → linked employee_id on user → error
    const empId = employee_id ?? req.user?.employee_id ?? null;
    if (!empId) {
      res
        .status(400)
        .json({ error: 'الحساب غير مرتبط بموظف — يرجى مراجعة المدير لربط حسابك بسجل الموظف' });
      return;
    }

    // Verify employee belongs to company
    const [emp] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.id, empId),
          eq(employeesTable.company_id, companyId),
          isNull(employeesTable.deleted_at)
        )
      );
    if (!emp) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const date = attendance_date ?? new Date().toISOString().split('T')[0];
    const time = check_in_time ?? new Date().toTimeString().substring(0, 5);

    const existing = await db
      .select({ id: attendanceRecordsTable.id })
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.employee_id, empId),
          eq(attendanceRecordsTable.attendance_date, date)
        )
      );
    if (existing.length > 0) {
      res.status(409).json({ error: 'تم تسجيل الحضور لهذا اليوم مسبقاً' });
      return;
    }

    // Get shift to calculate late minutes
    const [assignment] = await db
      .select({
        shift_schedule_id: employeeShiftAssignmentsTable.shift_schedule_id,
        start_time: shiftSchedulesTable.start_time,
        grace_minutes: shiftSchedulesTable.grace_minutes,
      })
      .from(employeeShiftAssignmentsTable)
      .leftJoin(
        shiftSchedulesTable,
        eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id)
      )
      .where(
        and(
          eq(employeeShiftAssignmentsTable.employee_id, empId),
          lte(employeeShiftAssignmentsTable.assigned_date, date)
        )
      )
      .orderBy(desc(employeeShiftAssignmentsTable.assigned_date))
      .limit(1);

    let lateMinutes = 0;
    let status = 'present';
    if (assignment?.start_time) {
      const [sh, sm] = assignment.start_time.split(':').map(Number);
      const [ch, cm] = time.split(':').map(Number);
      const shiftStart = sh * 60 + sm;
      const checkIn = ch * 60 + cm;
      const grace = assignment.grace_minutes ?? 5;
      if (checkIn > shiftStart + grace) {
        lateMinutes = checkIn - shiftStart;
        status = 'late';
      }
    }

    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        employee_id: empId,
        attendance_date: date,
        check_in_time: time,
        status,
        late_minutes: lateMinutes,
        notes: notes ?? null,
        submitted_by: userId,
      })
      .returning();

    res
      .status(201)
      .json({
        ...record,
        working_hours: null,
        overtime_hours: null,
        created_at: fmt(record.created_at),
        updated_at: fmt(record.updated_at),
      });
  })
);

/* ── Check Out ────────────────────────────────────────────────── */
router.post(
  '/attendance/check-out',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const userId = req.user?.id ?? null;
    const parsed = checkOutSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: parsed.error.errors[0]?.message ?? 'بيانات الانصراف غير صحيحة',
          details: parsed.error.errors,
        });
      return;
    }
    const { employee_id, attendance_date, check_out_time, notes } = parsed.data;
    const empId = employee_id ?? req.user?.employee_id ?? null;
    if (!empId) {
      res.status(400).json({ error: 'الحساب غير مرتبط بموظف — يرجى مراجعة المدير' });
      return;
    }
    const date = attendance_date ?? new Date().toISOString().split('T')[0];
    const time = check_out_time ?? new Date().toTimeString().substring(0, 5);

    const [emp] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, empId), eq(employeesTable.company_id, companyId)));
    if (!emp) {
      res.status(404).json({ error: 'الموظف غير موجود' });
      return;
    }

    const [existing] = await db
      .select()
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.employee_id, empId),
          eq(attendanceRecordsTable.attendance_date, date)
        )
      );
    if (!existing) {
      res.status(404).json({ error: 'لا يوجد تسجيل حضور لهذا اليوم' });
      return;
    }
    if (existing.check_out_time) {
      res.status(409).json({ error: 'تم تسجيل الانصراف مسبقاً' });
      return;
    }

    // Calculate working hours
    let workingHours: number | null = null;
    let overtimeHours = 0;
    if (existing.check_in_time) {
      const [ih, im] = existing.check_in_time.split(':').map(Number);
      const [oh, om] = time.split(':').map(Number);
      workingHours = Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60);

      // Fetch shift to calculate overtime (assume 8h standard)
      const [assignment] = await db
        .select({ end_time: shiftSchedulesTable.end_time })
        .from(employeeShiftAssignmentsTable)
        .leftJoin(
          shiftSchedulesTable,
          eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id)
        )
        .where(
          and(
            eq(employeeShiftAssignmentsTable.employee_id, empId),
            lte(employeeShiftAssignmentsTable.assigned_date, date)
          )
        )
        .orderBy(desc(employeeShiftAssignmentsTable.assigned_date))
        .limit(1);

      if (assignment?.end_time) {
        const [eh, em] = assignment.end_time.split(':').map(Number);
        const [och, ocm] = time.split(':').map(Number);
        const shiftEnd = eh * 60 + em;
        const checkOut = och * 60 + ocm;
        if (checkOut > shiftEnd) {
          overtimeHours = (checkOut - shiftEnd) / 60;
        }
      }
    }

    const [record] = await db
      .update(attendanceRecordsTable)
      .set({
        check_out_time: time,
        working_hours: workingHours != null ? String(workingHours) : null,
        overtime_hours: String(overtimeHours),
        submitted_by: userId,
        updated_at: new Date(),
        ...(notes !== undefined ? { notes: String(notes) } : {}),
      })
      .where(eq(attendanceRecordsTable.id, existing.id))
      .returning();

    res.json({
      ...record,
      working_hours: workingHours,
      overtime_hours: overtimeHours,
      created_at: fmt(record.created_at),
      updated_at: fmt(record.updated_at),
    });
  })
);

/* ── Manager Edit Attendance ──────────────────────────────────── */

export default router;
