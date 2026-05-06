/**
 * ZKTeco Integration
 *
 * Supports two integration methods:
 *
 * 1. ADMS Protocol (ZKTeco native push):
 *    - GET  /iclock/getrequest?SN=<serial>  → keep-alive handshake
 *    - POST /iclock/cdata?SN=<serial>&table=ATTLOG  → receive fingerprint punch
 *    Body line format (tab-delimited): PIN\tDateTime\tStatus\tVerify\tWorkCode\n
 *    Status: 0 = check-in, 1 = check-out
 *
 * 2. Simple JSON API (custom scripts / integrations):
 *    POST /api/attendance/zkteco
 *    Body: { api_key, company_id, employee_code, punch_time, punch_type }
 *    punch_type: "in" | "out"
 *
 * Security:
 *   Per-company keys are required: set ZKTECO_API_KEY_<company_id> for each
 *   tenant.  The global ZKTECO_API_KEY is only accepted when
 *   ZKTECO_ALLOW_GLOBAL_KEY=true is explicitly set — DO NOT enable this flag
 *   in production multi-tenant deployments as it allows cross-tenant forgery.
 *
 * On the ZKTeco device, configure:
 *   Server address: https://halaltec.com/iclock
 *   (or your domain)
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, employeesTable, attendanceRecordsTable, employeeShiftAssignmentsTable, shiftSchedulesTable } from "@workspace/db";
import { desc, lte } from "drizzle-orm";
import { wrap } from "../lib/async-handler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ZKTECO_KEY = process.env["ZKTECO_API_KEY"] ?? "";

if (!ZKTECO_KEY) {
  logger.warn(
    "[zkteco] WARNING: ZKTECO_API_KEY is not set. " +
    "All ZKTeco attendance endpoints will reject requests until the key is configured."
  );
}

/**
 * Return the API key required for a given company, or null if none is
 * configured.  Per-company keys (ZKTECO_API_KEY_<company_id>) are
 * required in production.  The global ZKTECO_API_KEY is only accepted
 * when ZKTECO_ALLOW_GLOBAL_KEY=true is explicitly set (for single-tenant
 * dev/staging environments).  If neither a per-company key nor the
 * global fallback is available the caller MUST reject the request.
 *
 * This prevents a key leaked from one tenant being reused to forge
 * attendance records for any other tenant.
 */
function getCompanyKey(companyId: number): string | null {
  const companySpecific = process.env[`ZKTECO_API_KEY_${companyId}`];
  if (companySpecific) return companySpecific;
  if (process.env["ZKTECO_ALLOW_GLOBAL_KEY"] === "true" && ZKTECO_KEY) return ZKTECO_KEY;
  return null;
}

/* ── helpers ────────────────────────────────────────────────── */
function nowDate() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const n = new Date();
  return `${n.getHours().toString().padStart(2, "0")}:${n.getMinutes().toString().padStart(2, "0")}`;
}

async function processAttendancePunch(
  companyId: number,
  employeeCode: string,
  punchDate: string,
  punchTime: string,
  punchType: "in" | "out",
  deviceSN?: string
): Promise<{ ok: boolean; message: string }> {
  // Find employee by code
  const [emp] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.company_id, companyId),
      eq(employeesTable.employee_code, employeeCode)
    ));

  if (!emp) {
    return { ok: false, message: `موظف برقم ${employeeCode} غير موجود` };
  }

  const empId = emp.id;
  const notePrefix = deviceSN ? `ZKTeco[${deviceSN}]` : "ZKTeco";

  if (punchType === "in") {
    const existing = await db
      .select({ id: attendanceRecordsTable.id })
      .from(attendanceRecordsTable)
      .where(and(
        eq(attendanceRecordsTable.employee_id, empId),
        eq(attendanceRecordsTable.attendance_date, punchDate)
      ));

    if (existing.length > 0) {
      return { ok: true, message: "تسجيل الحضور موجود مسبقاً" };
    }

    // Get shift for late calculation
    const [assignment] = await db
      .select({ start_time: shiftSchedulesTable.start_time, grace_minutes: shiftSchedulesTable.grace_minutes })
      .from(employeeShiftAssignmentsTable)
      .leftJoin(shiftSchedulesTable, eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id))
      .where(and(
        eq(employeeShiftAssignmentsTable.employee_id, empId),
        lte(employeeShiftAssignmentsTable.assigned_date, punchDate)
      ))
      .orderBy(desc(employeeShiftAssignmentsTable.assigned_date))
      .limit(1);

    let lateMinutes = 0;
    let status = "present";
    if (assignment?.start_time) {
      const [sh, sm] = assignment.start_time.split(":").map(Number);
      const [ch, cm] = punchTime.split(":").map(Number);
      const grace = assignment.grace_minutes ?? 5;
      if ((ch * 60 + cm) > (sh * 60 + sm + grace)) {
        lateMinutes = (ch * 60 + cm) - (sh * 60 + sm);
        status = "late";
      }
    }

    await db.insert(attendanceRecordsTable).values({
      employee_id: empId,
      attendance_date: punchDate,
      check_in_time: punchTime,
      status,
      late_minutes: lateMinutes,
      notes: `${notePrefix} — بصمة حضور`,
    });

    return { ok: true, message: `تم تسجيل حضور ${employeeCode} — ${punchTime}` };

  } else {
    // Check-out
    const [existing] = await db
      .select()
      .from(attendanceRecordsTable)
      .where(and(
        eq(attendanceRecordsTable.employee_id, empId),
        eq(attendanceRecordsTable.attendance_date, punchDate)
      ));

    if (!existing) {
      // Auto create check-in if missing
      await db.insert(attendanceRecordsTable).values({
        employee_id: empId,
        attendance_date: punchDate,
        check_in_time: punchTime,
        status: "present",
        late_minutes: 0,
        notes: `${notePrefix} — تسجيل تلقائي`,
      });
      return { ok: true, message: `لا يوجد حضور — تم الإنشاء تلقائياً` };
    }

    if (existing.check_out_time) {
      return { ok: true, message: "تسجيل الانصراف موجود مسبقاً" };
    }

    const [ih, im] = (existing.check_in_time ?? "00:00").split(":").map(Number);
    const [oh, om] = punchTime.split(":").map(Number);
    const workingHours = Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60);

    await db
      .update(attendanceRecordsTable)
      .set({
        check_out_time: punchTime,
        working_hours: String(workingHours.toFixed(2)),
        notes: `${notePrefix} — بصمة انصراف`,
        updated_at: new Date(),
      })
      .where(eq(attendanceRecordsTable.id, existing.id));

    return { ok: true, message: `تم تسجيل انصراف ${employeeCode} — ${punchTime}` };
  }
}

/* ══════════════════════════════════════════════════════════════════
   ADMS PROTOCOL — ZKTeco native push
   Route prefix: /iclock  (mounted without /api prefix in app.ts)
══════════════════════════════════════════════════════════════════ */

/** Handshake — ZKTeco keeps connection alive */
router.get("/iclock/getrequest", (_req, res) => {
  res.set("Content-Type", "text/plain");
  res.send("OK");
});

/** Receive attendance punch data from ZKTeco device */
router.post("/iclock/cdata", wrap(async (req, res) => {
  const table  = String(req.query["table"] ?? "");
  const sn     = String(req.query["SN"] ?? req.query["sn"] ?? "");
  const apiKey = String(req.query["key"] ?? req.query["api_key"] ?? "");
  const companyIdQ = Number(req.query["company_id"] ?? 0);

  if (!companyIdQ) {
    res.status(400).send("MISSING_COMPANY");
    return;
  }

  // SEC: fail-closed — validate against per-company key first, then global key
  const expectedKey = getCompanyKey(companyIdQ);
  if (!expectedKey || apiKey !== expectedKey) {
    res.status(401).send("UNAUTHORIZED");
    return;
  }

  // Only process attendance log table
  if (table !== "ATTLOG") {
    res.set("Content-Type", "text/plain");
    res.send("OK");
    return;
  }

  const body   = String(req.body ?? "");
  const lines  = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: string[] = [];

  for (const line of lines) {
    // Format: PIN\tTime\tStatus\tVerify\tWorkCode\tReserved
    const parts = line.split("\t");
    if (parts.length < 3) continue;

    const pin        = parts[0]!.trim();
    const dtStr      = parts[1]!.trim();   // "2025-01-15 08:30:00"
    const statusCode = parseInt(parts[2]!.trim(), 10); // 0=in,1=out,4=overtime

    const punchType: "in" | "out" = statusCode === 1 ? "out" : "in";
    const [datePart, timePart]    = dtStr.split(" ");
    const punchDate = datePart ?? nowDate();
    const punchTime = (timePart ?? nowTime()).substring(0, 5);

    const result = await processAttendancePunch(companyIdQ, pin, punchDate, punchTime, punchType, sn);
    results.push(result.message);
  }

  res.set("Content-Type", "text/plain");
  res.send(results.length ? results.join("\n") : "OK");
}));

/* ══════════════════════════════════════════════════════════════════
   JSON API — custom / manual integration
   POST /api/attendance/zkteco
══════════════════════════════════════════════════════════════════ */
router.post("/api/attendance/zkteco", wrap(async (req, res) => {
  const { api_key, company_id, employee_code, punch_time, punch_type, punch_date } =
    req.body as Record<string, unknown>;

  if (!company_id || !employee_code || !punch_type) {
    res.status(400).json({ error: "بيانات ناقصة: company_id, employee_code, punch_type مطلوبة" });
    return;
  }

  // SEC: fail-closed — validate against per-company key first, then global key
  const companyKey = getCompanyKey(Number(company_id));
  if (!companyKey || String(api_key ?? "") !== companyKey) {
    res.status(401).json({ error: "مفتاح API مطلوب أو غير صحيح" });
    return;
  }

  const punchType = String(punch_type) === "out" ? "out" : "in";
  const punchDate = String(punch_date ?? nowDate());
  const punchTime = String(punch_time ?? nowTime()).substring(0, 5);

  const result = await processAttendancePunch(
    Number(company_id),
    String(employee_code),
    punchDate,
    punchTime,
    punchType
  );

  if (!result.ok) {
    res.status(404).json({ error: result.message });
    return;
  }

  res.json({ success: true, message: result.message });
}));

/* ── ZKTeco config info endpoint ────────────────────────────── */
router.get("/api/attendance/zkteco/info", (_req, res) => {
  res.json({
    adms_url: "POST /iclock/cdata?SN=<SERIAL>&table=ATTLOG&company_id=<ID>&key=<API_KEY>",
    handshake_url: "GET /iclock/getrequest?SN=<SERIAL>",
    json_url: "POST /api/attendance/zkteco",
    json_body: {
      api_key: "<ZKTECO_API_KEY env>",
      company_id: "<number>",
      employee_code: "<string — matches employee_code in system>",
      punch_time: "HH:MM (optional, defaults to now)",
      punch_date: "YYYY-MM-DD (optional, defaults to today)",
      punch_type: "in | out",
    },
    note: "ZKTECO_API_KEY environment variable must be set on the server. Authentication is always required.",
  });
});

export default router;
