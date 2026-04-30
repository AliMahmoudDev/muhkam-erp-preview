/**
 * /api/attendance-deductions/*
 * إعدادات + شرائح + احتساب خصومات الحضور (تأخير / انصراف مبكر / غياب)
 */
import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  attendanceDeductionSettingsTable,
  attendanceDeductionTiersTable,
  attendanceRecordsTable,
  publicHolidaysTable,
  employeesTable,
  employeeDeductionsTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { requireFeature } from "../middleware/feature-guard";

const router: IRouter = Router();
router.use("/attendance-deductions", requireFeature("hr"));
const n = (v: unknown) => (v != null ? Number(v) : 0);
const fmtTs = (v: Date | null | undefined) => (v instanceof Date ? v.toISOString() : (v ?? null));

/* ═══════════════════════════════════════════════════════════════
   SETTINGS (إعدادات الخصومات)
══════════════════════════════════════════════════════════════════ */

async function getOrCreateSettings(companyId: number) {
  const [existing] = await db.select().from(attendanceDeductionSettingsTable)
    .where(eq(attendanceDeductionSettingsTable.company_id, companyId));
  if (existing) return existing;
  const [created] = await db.insert(attendanceDeductionSettingsTable)
    .values({ company_id: companyId })
    .returning();
  return created!;
}

router.get("/attendance-deductions/settings", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const s = await getOrCreateSettings(companyId);
  res.json({
    ...s,
    absence_full_day_amount: n(s.absence_full_day_amount),
    absence_half_day_amount: n(s.absence_half_day_amount),
    updated_at: fmtTs(s.updated_at),
  });
}));

router.put("/attendance-deductions/settings", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const b = req.body as Record<string, unknown>;

  await getOrCreateSettings(companyId);

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (b["grace_minutes"] != null) updates["grace_minutes"] = Math.max(0, parseInt(String(b["grace_minutes"]), 10) || 0);
  if (b["weekly_off_days"] != null) {
    const arr = String(b["weekly_off_days"]).split(",").map(s => s.trim()).filter(s => /^[0-6]$/.test(s));
    updates["weekly_off_days"] = arr.join(",");
  }
  if (b["absence_full_day_amount"] != null) updates["absence_full_day_amount"] = String(Math.max(0, Number(b["absence_full_day_amount"]) || 0));
  if (b["absence_half_day_amount"] != null) updates["absence_half_day_amount"] = String(Math.max(0, Number(b["absence_half_day_amount"]) || 0));
  if (b["apply_early_leave"] != null) updates["apply_early_leave"] = Boolean(b["apply_early_leave"]);

  const [row] = await db.update(attendanceDeductionSettingsTable)
    .set(updates)
    .where(eq(attendanceDeductionSettingsTable.company_id, companyId))
    .returning();

  res.json({
    ...row!,
    absence_full_day_amount: n(row!.absence_full_day_amount),
    absence_half_day_amount: n(row!.absence_half_day_amount),
    updated_at: fmtTs(row!.updated_at),
  });
}));

/* ═══════════════════════════════════════════════════════════════
   TIERS (الشرائح)
══════════════════════════════════════════════════════════════════ */

router.get("/attendance-deductions/tiers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const rows = await db.select().from(attendanceDeductionTiersTable)
    .where(eq(attendanceDeductionTiersTable.company_id, companyId))
    .orderBy(attendanceDeductionTiersTable.applies_to, attendanceDeductionTiersTable.sort_order, attendanceDeductionTiersTable.min_minutes);
  res.json(rows.map(r => ({ ...r, amount: n(r.amount), created_at: fmtTs(r.created_at) })));
}));

/**
 * استبدال شامل لكل الشرائح (bulk replace).
 * body: { tiers: [{ applies_to, min_minutes, max_minutes, amount, is_active, sort_order }] }
 */
router.post("/attendance-deductions/tiers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const tiers = Array.isArray((req.body as Record<string, unknown>)["tiers"])
    ? ((req.body as Record<string, unknown>)["tiers"] as Array<Record<string, unknown>>)
    : [];

  const valid = tiers
    .map((t, i) => {
      const applies_to = String(t["applies_to"] ?? "late");
      if (!["late", "early"].includes(applies_to)) throw new Error(`شريحة #${i + 1}: نوع غير صحيح`);
      const min_minutes = Math.max(0, parseInt(String(t["min_minutes"] ?? 0), 10) || 0);
      const max_raw = t["max_minutes"];
      const max_minutes = max_raw == null || max_raw === "" || max_raw === "—" ? null
        : Math.max(0, parseInt(String(max_raw), 10) || 0);
      const amount = Math.max(0, Number(t["amount"] ?? 0) || 0);
      if (amount <= 0) throw new Error(`شريحة #${i + 1}: قيمة الخصم يجب أن تكون أكبر من صفر`);
      if (max_minutes != null && max_minutes < min_minutes) throw new Error(`شريحة #${i + 1}: الحد الأعلى أقل من الأدنى`);
      return {
        company_id: companyId,
        applies_to,
        min_minutes,
        max_minutes,
        amount: String(amount),
        is_active: t["is_active"] !== false,
        sort_order: parseInt(String(t["sort_order"] ?? i), 10) || i,
      };
    });

  await db.transaction(async (tx) => {
    await tx.delete(attendanceDeductionTiersTable)
      .where(eq(attendanceDeductionTiersTable.company_id, companyId));
    if (valid.length > 0) {
      await tx.insert(attendanceDeductionTiersTable).values(valid);
    }
  });

  const rows = await db.select().from(attendanceDeductionTiersTable)
    .where(eq(attendanceDeductionTiersTable.company_id, companyId))
    .orderBy(attendanceDeductionTiersTable.applies_to, attendanceDeductionTiersTable.sort_order);
  res.json(rows.map(r => ({ ...r, amount: n(r.amount), created_at: fmtTs(r.created_at) })));
}));

/* ═══════════════════════════════════════════════════════════════
   PREVIEW (معاينة الاحتساب الشهري)
══════════════════════════════════════════════════════════════════ */

interface PreviewItem {
  employee_id: number;
  employee_name: string;
  employee_code: string | null;
  attendance_record_id: number | null;
  date: string;
  type: "late" | "early" | "absence";
  source: "auto_late" | "auto_early" | "auto_absence";
  minutes: number;
  amount: number;
  reason: string;
  already_applied: boolean;
}

function pickTier(
  tiers: Array<{ min_minutes: number; max_minutes: number | null; amount: number }>,
  minutes: number,
): { amount: number; min: number; max: number | null } | null {
  for (const t of tiers) {
    if (minutes >= t.min_minutes && (t.max_minutes == null || minutes <= t.max_minutes)) {
      return { amount: t.amount, min: t.min_minutes, max: t.max_minutes };
    }
  }
  return null;
}

router.post("/attendance-deductions/preview", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const b = req.body as Record<string, unknown>;
  const month = String(b["month"] ?? "").trim(); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) { res.status(400).json({ error: "صيغة الشهر يجب أن تكون YYYY-MM" }); return; }
  const empIdFilter = b["employee_id"] ? parseInt(String(b["employee_id"]), 10) : null;

  const [year, mon] = month.split("-").map(Number) as [number, number];
  const start = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  // Settings & tiers
  const settings = await getOrCreateSettings(companyId);
  const grace = Number(settings.grace_minutes ?? 0);
  const weeklyOff = String(settings.weekly_off_days ?? "")
    .split(",").map(s => parseInt(s, 10)).filter(d => d >= 0 && d <= 6);
  const absFull = Number(settings.absence_full_day_amount ?? 0);
  const absHalf = Number(settings.absence_half_day_amount ?? 0);
  const applyEarly = Boolean(settings.apply_early_leave);

  const tiersRaw = await db.select().from(attendanceDeductionTiersTable)
    .where(and(
      eq(attendanceDeductionTiersTable.company_id, companyId),
      eq(attendanceDeductionTiersTable.is_active, true),
    ))
    .orderBy(attendanceDeductionTiersTable.sort_order, attendanceDeductionTiersTable.min_minutes);

  const lateTiers = tiersRaw.filter(t => t.applies_to === "late")
    .map(t => ({ min_minutes: t.min_minutes, max_minutes: t.max_minutes, amount: Number(t.amount) }));
  const earlyTiers = tiersRaw.filter(t => t.applies_to === "early")
    .map(t => ({ min_minutes: t.min_minutes, max_minutes: t.max_minutes, amount: Number(t.amount) }));

  // Holidays in range
  const hols = await db.select().from(publicHolidaysTable)
    .where(and(
      eq(publicHolidaysTable.company_id, companyId),
      gte(publicHolidaysTable.holiday_date, start),
      lte(publicHolidaysTable.holiday_date, end),
    ));
  const holSet = new Set(hols.map(h => h.holiday_date));

  // Attendance records in range
  const recCond = [
    gte(attendanceRecordsTable.attendance_date, start),
    lte(attendanceRecordsTable.attendance_date, end),
  ];
  if (empIdFilter) recCond.push(eq(attendanceRecordsTable.employee_id, empIdFilter));

  const records = await db.select({
    id: attendanceRecordsTable.id,
    employee_id: attendanceRecordsTable.employee_id,
    attendance_date: attendanceRecordsTable.attendance_date,
    status: attendanceRecordsTable.status,
    late_minutes: attendanceRecordsTable.late_minutes,
    early_departure_minutes: attendanceRecordsTable.early_departure_minutes,
  }).from(attendanceRecordsTable).where(and(...recCond));

  // Restrict to this company's employees
  const empIds = Array.from(new Set(records.map(r => r.employee_id)));
  const empRows = empIds.length === 0 ? [] : await db.select().from(employeesTable)
    .where(and(
      eq(employeesTable.company_id, companyId),
      inArray(employeesTable.id, empIds),
    ));
  const empMap = new Map(empRows.map(e => [e.id, e]));

  // Existing auto-deductions in range (for dedup detection)
  const existing = await db.select({
    attendance_record_id: employeeDeductionsTable.attendance_record_id,
    source: employeeDeductionsTable.source,
  }).from(employeeDeductionsTable)
    .where(and(
      eq(employeeDeductionsTable.company_id, companyId),
      isNull(employeeDeductionsTable.deleted_at),
      gte(employeeDeductionsTable.deduction_date, start),
      lte(employeeDeductionsTable.deduction_date, end),
      sql`${employeeDeductionsTable.attendance_record_id} IS NOT NULL`,
    ));
  const appliedKey = new Set(existing.map(e => `${e.attendance_record_id}|${e.source}`));

  const items: PreviewItem[] = [];

  for (const r of records) {
    const emp = empMap.get(r.employee_id);
    if (!emp) continue;
    const empName = `${emp.first_name_ar ?? ""} ${emp.last_name_ar ?? ""}`.trim();
    const empCode = emp.employee_code ?? null;

    // Skip weekly off
    const dow = new Date(r.attendance_date + "T00:00:00").getDay();
    if (weeklyOff.includes(dow)) continue;
    // Skip official holidays
    if (holSet.has(r.attendance_date)) continue;
    // Skip excused (استأذن) — no deduction applied
    if (r.status === "excused") continue;

    // ── Absence ──
    if (r.status === "absent") {
      const amt = absFull;
      if (amt > 0) {
        items.push({
          employee_id: r.employee_id,
          employee_name: empName,
          employee_code: empCode,
          attendance_record_id: r.id,
          date: r.attendance_date,
          type: "absence",
          source: "auto_absence",
          minutes: 0,
          amount: amt,
          reason: `غياب يوم ${r.attendance_date}`,
          already_applied: appliedKey.has(`${r.id}|auto_absence`),
        });
      }
      continue;
    }
    if (r.status === "half_day") {
      const amt = absHalf;
      if (amt > 0) {
        items.push({
          employee_id: r.employee_id,
          employee_name: empName,
          employee_code: empCode,
          attendance_record_id: r.id,
          date: r.attendance_date,
          type: "absence",
          source: "auto_absence",
          minutes: 0,
          amount: amt,
          reason: `غياب نصف يوم ${r.attendance_date}`,
          already_applied: appliedKey.has(`${r.id}|auto_absence`),
        });
      }
      continue;
    }

    // ── Late ──
    const lateMin = Math.max(0, (r.late_minutes ?? 0) - grace);
    if (lateMin > 0 && lateTiers.length > 0) {
      const t = pickTier(lateTiers, lateMin);
      if (t) {
        items.push({
          employee_id: r.employee_id,
          employee_name: empName,
          employee_code: empCode,
          attendance_record_id: r.id,
          date: r.attendance_date,
          type: "late",
          source: "auto_late",
          minutes: lateMin,
          amount: t.amount,
          reason: `تأخير ${lateMin} د (${t.min}${t.max != null ? `–${t.max}` : "+"} د) — ${r.attendance_date}`,
          already_applied: appliedKey.has(`${r.id}|auto_late`),
        });
      }
    }

    // ── Early leave ──
    if (applyEarly) {
      const earlyMin = Math.max(0, (r.early_departure_minutes ?? 0) - grace);
      if (earlyMin > 0 && earlyTiers.length > 0) {
        const t = pickTier(earlyTiers, earlyMin);
        if (t) {
          items.push({
            employee_id: r.employee_id,
            employee_name: empName,
            employee_code: empCode,
            attendance_record_id: r.id,
            date: r.attendance_date,
            type: "early",
            source: "auto_early",
            minutes: earlyMin,
            amount: t.amount,
            reason: `انصراف مبكر ${earlyMin} د — ${r.attendance_date}`,
            already_applied: appliedKey.has(`${r.id}|auto_early`),
          });
        }
      }
    }
  }

  // sort by employee then date
  items.sort((a, b) => a.employee_name.localeCompare(b.employee_name, "ar") || a.date.localeCompare(b.date));

  const totalNew = items.filter(i => !i.already_applied).reduce((s, i) => s + i.amount, 0);

  res.json({
    month,
    grace_minutes: grace,
    weekly_off_days: weeklyOff,
    items,
    summary: {
      total_items: items.length,
      new_items: items.filter(i => !i.already_applied).length,
      already_applied: items.filter(i => i.already_applied).length,
      total_new_amount: totalNew,
    },
  });
}));

/* ═══════════════════════════════════════════════════════════════
   APPLY (تأكيد وحفظ الخصومات)
══════════════════════════════════════════════════════════════════ */

router.post("/attendance-deductions/apply", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId = req.user?.id ?? null;
  const itemsIn = Array.isArray((req.body as Record<string, unknown>)["items"])
    ? ((req.body as Record<string, unknown>)["items"] as Array<Record<string, unknown>>)
    : [];

  if (itemsIn.length === 0) {
    res.status(400).json({ error: "لا توجد بنود للحفظ" }); return;
  }

  let inserted = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    for (const it of itemsIn) {
      const employee_id = parseInt(String(it["employee_id"]), 10);
      const attendance_record_id = parseInt(String(it["attendance_record_id"]), 10);
      const source = String(it["source"] ?? "");
      const amount = Number(it["amount"] ?? 0);
      const date = String(it["date"] ?? "");
      const type = String(it["type"] ?? "");
      const reason = String(it["reason"] ?? "");
      if (!employee_id || !attendance_record_id || !["auto_late", "auto_early", "auto_absence"].includes(source) || amount <= 0) {
        skipped++; continue;
      }
      const dedType = type === "absence" ? "absence" : type === "early" ? "late" : "late";

      // Verify employee belongs to company
      const [emp] = await tx.select().from(employeesTable)
        .where(and(eq(employeesTable.id, employee_id), eq(employeesTable.company_id, companyId)));
      if (!emp) { skipped++; continue; }

      // Dedup check
      const dup = await tx.select({ id: employeeDeductionsTable.id }).from(employeeDeductionsTable)
        .where(and(
          eq(employeeDeductionsTable.company_id, companyId),
          eq(employeeDeductionsTable.attendance_record_id, attendance_record_id),
          eq(employeeDeductionsTable.source, source),
          isNull(employeeDeductionsTable.deleted_at),
        ));
      if (dup.length > 0) { skipped++; continue; }

      await tx.insert(employeeDeductionsTable).values({
        company_id: companyId,
        employee_id,
        deduction_type: dedType,
        amount: String(amount),
        reason,
        deduction_date: date,
        currency: emp.currency ?? "EGP",
        created_by: userId,
        attendance_record_id,
        source,
      });
      inserted++;
    }
  });

  res.json({ ok: true, inserted, skipped });
}));

export default router;
