/** attendance/_helpers.ts — shared utilities */
import { z } from 'zod';

export function fmt(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}

export const shiftSchema = z.object({
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

export const employeeShiftSchema = z.object({
  employee_id: z.number().int().positive('معرّف الموظف مطلوب'),
  shift_schedule_id: z.number().int().positive('معرّف الوردية مطلوب'),
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const checkInSchema = z.object({
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

export const checkOutSchema = z.object({
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

export const attendanceEditSchema = z.object({
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

export const overtimeSchema = z.object({
  employee_id: z.number().int().positive('معرّف الموظف مطلوب'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  hours: z.number().min(0.25).max(24, 'عدد الساعات لا يمكن أن يتجاوز 24'),
  reason: z.string().max(500).nullable().optional(),
});

export const holidaySchema = z.object({
  holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة'),
  name_ar: z.string().min(1, 'اسم الإجازة مطلوب').max(200),
  name_en: z.string().max(200).optional(),
});

