/**
 * Payroll processing — process/approve/pay periods, async jobs, records, and employee payslips.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql, isNull, gte, lte, ilike, inArray } from "drizzle-orm";
import {
  db,
  payrollPeriodsTable, payrollRecordsTable, payrollLineItemsTable,
  employeesTable,
  monthlyIncentiveSummaryTable,
  salaryAdvancesTable,
  employeeDeductionsTable,
  journalEntriesTable, journalEntryLinesTable, accountsTable,
  safesTable, transactionsTable,
  salesTable, saleItemsTable,
  repairJobsTable, repairJobPartsTable,
  departmentsTable,
  taxBracketsTable, statutoryContributionsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { writeAuditLog } from "../../lib/audit-log";
import { enqueueJob, getJobStatus } from "../../lib/job-queue";

const router: IRouter = Router();

function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }

/* ── Process Payroll ──────────────────────────────────────────── */
router.post("/payroll/periods/:id/process", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const id        = parseInt(String(req.params["id"]), 10);

  const [period] = await db.select().from(payrollPeriodsTable)
    .where(and(eq(payrollPeriodsTable.id, id), eq(payrollPeriodsTable.company_id, companyId)));
  if (!period) { res.status(404).json({ error: "الفترة غير موجودة" }); return; }
  if (period.status !== "draft") { res.status(409).json({ error: "تمت معالجة هذه الفترة مسبقاً" }); return; }

  const employees = await db.select().from(employeesTable)
    .where(and(eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at), eq(employeesTable.employment_status, "active")));

  const year = new Date().getFullYear().toString();
  const taxBrackets = await db.select().from(taxBracketsTable)
    .where(and(eq(taxBracketsTable.company_id, companyId), eq(taxBracketsTable.fiscal_year, year)))
    .orderBy(taxBracketsTable.min_salary);
  const contributions = await db.select().from(statutoryContributionsTable)
    .where(and(eq(statutoryContributionsTable.company_id, companyId), eq(statutoryContributionsTable.is_active, true)));

  // ── Pre-calculate company-wide revenue (sales + repairs) for the period ──
  const [salesRevRow] = await db.select({
    gross_revenue: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`,
    cost_total:    sql<string>`COALESCE(SUM(si.cost_total_sum), 0)`,
  }).from(salesTable)
    .leftJoin(
      db.select({ sale_id: saleItemsTable.sale_id, cost_total_sum: sql<string>`SUM(${saleItemsTable.cost_total})` })
        .from(saleItemsTable).groupBy(saleItemsTable.sale_id).as("si"),
      eq(salesTable.id, sql`si.sale_id`)
    )
    .where(and(
      eq(salesTable.company_id, companyId),
      gte(salesTable.date, period.start_date),
      lte(salesTable.date, period.end_date),
    ));
  const salesGross = Number(salesRevRow?.gross_revenue ?? 0);
  const salesCost  = Number(salesRevRow?.cost_total ?? 0);

  const [repairRevRow] = await db.select({
    gross_revenue:    sql<string>`COALESCE(SUM(CAST(${repairJobsTable.final_cost} AS numeric)), 0)`,
    workshop_cost:    sql<string>`COALESCE(SUM(CAST(${repairJobsTable.external_workshop_cost} AS numeric)), 0)`,
    broker_comm_sum:  sql<string>`COALESCE(SUM(CAST(${repairJobsTable.broker_commission} AS numeric)), 0)`,
  }).from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, companyId),
      sql`${repairJobsTable.status} = 'delivered'`,
      sql`${repairJobsTable.delivered_at} >= ${period.start_date}`,
      sql`${repairJobsTable.delivered_at} <= ${period.end_date}`,
    ));
  const repairGross        = Number(repairRevRow?.gross_revenue ?? 0);
  const repairWorkshopCost = Number(repairRevRow?.workshop_cost ?? 0);
  const repairBrokerComm   = Number(repairRevRow?.broker_comm_sum ?? 0);

  const [repairPartsCostRow] = await db.select({
    parts_cost: sql<string>`COALESCE(SUM(CAST(${repairJobPartsTable.unit_price} AS numeric) * CAST(${repairJobPartsTable.quantity} AS numeric)), 0)`,
  }).from(repairJobPartsTable)
    .where(and(
      eq(repairJobPartsTable.company_id, companyId),
      sql`${repairJobPartsTable.job_id} IN (
        SELECT id FROM repair_jobs WHERE company_id = ${companyId}
        AND status = 'delivered'
        AND delivered_at >= ${period.start_date}
        AND delivered_at <= ${period.end_date}
      )`,
    ));
  const repairPartsCost = Number(repairPartsCostRow?.parts_cost ?? 0);

  const companyGrossRevenue = salesGross + repairGross;
  const companyNetRevenue   = Math.max(
    0,
    (salesGross - salesCost) + (repairGross - repairWorkshopCost - repairPartsCost - repairBrokerComm)
  );

  const processedRecords: Array<Record<string, unknown>> = [];

  for (const emp of employees) {
    const existing = await db.select({ id: payrollRecordsTable.id }).from(payrollRecordsTable)
      .where(and(eq(payrollRecordsTable.payroll_period_id, id), eq(payrollRecordsTable.employee_id, emp.id)));
    if (existing.length > 0) continue;

    const baseSalary     = Number(emp.salary ?? 0);
    const commissionRate = Number(emp.commission_rate ?? 0);
    if (baseSalary <= 0 && commissionRate <= 0) continue;

    const grossSalary = baseSalary;
    const lineItems: Array<{ component_name: string; component_type: string; amount: number; description?: string }> = [];

    if (baseSalary > 0) {
      lineItems.push({ component_name: "الراتب الأساسي", component_type: "base", amount: baseSalary });
    }

    let commissionAmount = 0;
    if (commissionRate > 0) {
      const commissionBasis = (emp.commission_basis ?? 'gross') as 'gross' | 'net';
      const scopeDeptId     = emp.commission_scope_dept_id;
      let revenueBase = 0;

      if (scopeDeptId) {
        const deptEmpIds = await db.select({ id: employeesTable.id }).from(employeesTable)
          .where(and(eq(employeesTable.company_id, companyId), eq(employeesTable.department_id, scopeDeptId), isNull(employeesTable.deleted_at)));
        const ids = deptEmpIds.map(e => e.id);
        if (ids.length > 0) {
          const [deptRevRow] = await db.select({
            gross: sql<string>`COALESCE(SUM(${salesTable.total_amount}), 0)`,
            cost:  sql<string>`COALESCE(SUM(dsi.cost_total_sum), 0)`,
          }).from(salesTable)
            .leftJoin(
              db.select({ sale_id: saleItemsTable.sale_id, cost_total_sum: sql<string>`SUM(${saleItemsTable.cost_total})` })
                .from(saleItemsTable).groupBy(saleItemsTable.sale_id).as("dsi"),
              eq(salesTable.id, sql`dsi.sale_id`)
            )
            .where(and(
              eq(salesTable.company_id, companyId),
              gte(salesTable.date, period.start_date),
              lte(salesTable.date, period.end_date),
              inArray(salesTable.salesperson_id, ids),
            ));
          const deptGross = Number(deptRevRow?.gross ?? 0);
          const deptCost  = Number(deptRevRow?.cost ?? 0);
          revenueBase = commissionBasis === 'net' ? Math.max(0, deptGross - deptCost) : deptGross;
        }
      } else {
        revenueBase = commissionBasis === 'net' ? companyNetRevenue : companyGrossRevenue;
      }

      commissionAmount = revenueBase * commissionRate / 100;
      if (commissionAmount > 0) {
        const deptName = scopeDeptId
          ? (await db.select({ name: departmentsTable.name_ar }).from(departmentsTable).where(eq(departmentsTable.id, scopeDeptId)).limit(1))[0]?.name ?? 'القسم'
          : 'الشركة';
        const basisLabel = commissionBasis === 'net' ? 'صافي ربح' : 'إجمالي إيرادات';
        lineItems.push({
          component_name: `حصة الأرباح (${commissionRate}% من ${basisLabel} ${deptName})`,
          component_type: "incentive",
          amount: commissionAmount,
          description: `${basisLabel}: ${revenueBase.toFixed(2)} × ${commissionRate}%`,
        });
      }
    }

    let totalDeductions = 0;
    for (const contrib of contributions) {
      const empDeduction = grossSalary * Number(contrib.employee_percentage) / 100;
      if (empDeduction > 0) {
        lineItems.push({ component_name: contrib.name_ar, component_type: "deduction", amount: -empDeduction });
        totalDeductions += empDeduction;
      }
    }

    let taxAmount = 0;
    for (const bracket of taxBrackets) {
      const min  = Number(bracket.min_salary);
      const max  = bracket.max_salary != null ? Number(bracket.max_salary) : Infinity;
      const rate = Number(bracket.tax_rate);
      if (grossSalary > min) {
        const taxable = Math.min(grossSalary, max) - min;
        taxAmount += taxable * rate / 100;
      }
    }
    if (taxAmount > 0) {
      lineItems.push({ component_name: "ضريبة الدخل", component_type: "tax", amount: -taxAmount });
    }

    const advances = await db.select().from(salaryAdvancesTable)
      .where(and(eq(salaryAdvancesTable.employee_id, emp.id), eq(salaryAdvancesTable.status, "active")));
    let advanceDeductions = 0;
    for (const adv of advances) {
      const deductAmt = Math.min(Number(adv.remaining_balance ?? 0), Number(adv.approved_amount ?? 0));
      if (deductAmt > 0) {
        lineItems.push({ component_name: `خصم سلفة #${adv.id}`, component_type: "advance", amount: -deductAmt });
        advanceDeductions += deductAmt;
      }
    }

    const empDeductions = await db.select().from(employeeDeductionsTable)
      .where(and(
        eq(employeeDeductionsTable.employee_id, emp.id),
        isNull(employeeDeductionsTable.deleted_at),
        gte(employeeDeductionsTable.deduction_date, period.start_date),
        lte(employeeDeductionsTable.deduction_date, period.end_date),
      ));
    let attendanceDeductionsTotal = 0;
    for (const ded of empDeductions) {
      const dedAmt = Number(ded.amount ?? 0);
      if (dedAmt > 0) {
        lineItems.push({ component_name: ded.reason ?? `خصم ${ded.deduction_type}`, component_type: "deduction", amount: -dedAmt });
        attendanceDeductionsTotal += dedAmt;
      }
    }

    const periodMonth = period.start_date.substring(0, 7);
    const [incentiveSummary] = await db.select().from(monthlyIncentiveSummaryTable)
      .where(and(eq(monthlyIncentiveSummaryTable.employee_id, emp.id), eq(monthlyIncentiveSummaryTable.month, periodMonth)));
    let incentiveAmount = 0;
    if (incentiveSummary && incentiveSummary.status === "pending") {
      incentiveAmount = Number(incentiveSummary.total_accrued ?? 0);
      if (incentiveAmount > 0) {
        lineItems.push({ component_name: "الحوافز الشهرية", component_type: "incentive", amount: incentiveAmount });
      }
    }

    const totalIncentive = incentiveAmount + commissionAmount;
    const netSalary = grossSalary - totalDeductions - taxAmount - advanceDeductions - attendanceDeductionsTotal + totalIncentive;

    const [record] = await db.insert(payrollRecordsTable).values({
      payroll_period_id: id, employee_id: emp.id,
      gross_salary: String(grossSalary), total_allowances: "0",
      total_deductions: String(totalDeductions), tax_amount: String(taxAmount),
      net_salary: String(Math.max(0, netSalary)), currency: emp.currency ?? "EGP",
      advance_deductions: String(advanceDeductions), incentive_amount: String(totalIncentive),
      status: "draft",
    }).returning();

    await db.insert(payrollLineItemsTable).values(
      lineItems.map(li => ({ payroll_record_id: record.id, component_name: li.component_name, component_type: li.component_type, amount: String(li.amount), description: li.description ?? null }))
    );

    if (incentiveSummary && incentiveAmount > 0) {
      await db.update(monthlyIncentiveSummaryTable)
        .set({ status: "included_in_payroll", included_in_payroll_record_id: record.id, updated_at: new Date() })
        .where(eq(monthlyIncentiveSummaryTable.id, incentiveSummary.id));
    }

    processedRecords.push({ ...record, net_salary: Math.max(0, netSalary), gross_salary: grossSalary });
  }

  await db.update(payrollPeriodsTable)
    .set({ status: "processing", processed_by: userId, processed_at: new Date(), updated_at: new Date() })
    .where(eq(payrollPeriodsTable.id, id));

  await writeAuditLog({
    action: "update", record_type: "payroll_period", record_id: id,
    new_value: { status: "processing", processed_records: processedRecords.length },
    user: { id: userId ?? undefined, username: req.user?.username },
  });

  res.json({ ok: true, processed_records: processedRecords.length, records: processedRecords });
}));

/* ── Approve Period ───────────────────────────────────────────── */
router.post("/payroll/periods/:id/approve", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_approve_payroll")) { res.status(403).json({ error: "غير مصرح بالاعتماد" }); return; }
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const id        = parseInt(String(req.params["id"]), 10);
  const [row] = await db.update(payrollPeriodsTable)
    .set({ status: "approved", processed_by: userId, processed_at: new Date(), updated_at: new Date() })
    .where(and(eq(payrollPeriodsTable.id, id), eq(payrollPeriodsTable.company_id, companyId), eq(payrollPeriodsTable.status, "processing")))
    .returning();
  if (!row) { res.status(409).json({ error: "لا يمكن اعتماد هذه الفترة في حالتها الحالية" }); return; }
  await db.update(payrollRecordsTable).set({ status: "approved", updated_at: new Date() }).where(eq(payrollRecordsTable.payroll_period_id, id));

  try {
    const records = await db.select({ net_salary: payrollRecordsTable.net_salary })
      .from(payrollRecordsTable).where(eq(payrollRecordsTable.payroll_period_id, id));
    const totalNet = records.reduce((s, r) => s + Number(r.net_salary ?? 0), 0);
    if (totalNet > 0) {
      const [expAcc] = await db.select().from(accountsTable)
        .where(and(eq(accountsTable.company_id, companyId), eq(accountsTable.type, "expense"), eq(accountsTable.is_posting, true), ilike(accountsTable.name, "%رواتب%")))
        .limit(1);
      const [liabAcc] = await db.select().from(accountsTable)
        .where(and(eq(accountsTable.company_id, companyId), eq(accountsTable.type, "liability"), eq(accountsTable.is_posting, true)))
        .limit(1);
      if (expAcc && liabAcc) {
        const todayStr = row.end_date ?? new Date().toISOString().split("T")[0];
        const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(journalEntriesTable).where(eq(journalEntriesTable.company_id, companyId));
        const entryNo = `PAY-${String(Number(c ?? 0) + 1).padStart(4, "0")}`;
        const [entry] = await db.insert(journalEntriesTable).values({
          company_id: companyId, entry_no: entryNo, date: todayStr,
          description: `قيد رواتب — ${row.name}`, reference: `PAYROLL-${id}`, status: "draft",
          total_debit: String(totalNet), total_credit: String(totalNet),
        }).returning();
        await db.insert(journalEntryLinesTable).values([
          { entry_id: entry.id, account_id: expAcc.id, account_name: expAcc.name, account_code: expAcc.code, debit: String(totalNet), credit: "0", description: `مصروف رواتب — ${row.name}` },
          { entry_id: entry.id, account_id: liabAcc.id, account_name: liabAcc.name, account_code: liabAcc.code, debit: "0", credit: String(totalNet), description: `رواتب مستحقة — ${row.name}` },
        ]);
      }
    }
  } catch { /* قيد الرواتب اختياري — يُتجاهل إذا لم تُوجد الحسابات */ }

  res.json({ ok: true, status: "approved" });
}));

/* ── Pay Period (صرف الرواتب من الخزانة) ─────────────────────── */
router.post("/payroll/periods/:id/pay", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_approve_payroll")) { res.status(403).json({ error: "غير مصرح بصرف الرواتب" }); return; }
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const id        = parseInt(String(req.params["id"]), 10);
  const { safe_id, notes } = req.body as { safe_id?: number | string; notes?: string };

  const rawSafeId = safe_id ? parseInt(String(safe_id), 10) : NaN;
  if (!rawSafeId || isNaN(rawSafeId)) { res.status(400).json({ error: "يجب اختيار الخزانة لصرف الرواتب" }); return; }

  const [period] = await db.select().from(payrollPeriodsTable)
    .where(and(eq(payrollPeriodsTable.id, id), eq(payrollPeriodsTable.company_id, companyId)));
  if (!period) { res.status(404).json({ error: "الفترة غير موجودة" }); return; }
  if (period.status !== "approved") { res.status(409).json({ error: "يجب اعتماد الفترة أولاً قبل الصرف" }); return; }

  const unpaidRecords = await db.select({ net_salary: payrollRecordsTable.net_salary, id: payrollRecordsTable.id })
    .from(payrollRecordsTable)
    .where(and(eq(payrollRecordsTable.payroll_period_id, id), sql`${payrollRecordsTable.status} != 'paid'`));
  if (unpaidRecords.length === 0) {
    res.status(409).json({ error: "جميع الرواتب في هذه الفترة تم صرفها مسبقاً" }); return;
  }

  const totalNet = unpaidRecords.reduce((s, r) => s + Number(r.net_salary ?? 0), 0);
  if (totalNet <= 0) { res.status(400).json({ error: "لا يوجد مبلغ للصرف" }); return; }
  const unpaidIds = unpaidRecords.map(r => r.id);

  const result = await db.transaction(async (tx) => {
    const [safe] = await tx.select().from(safesTable)
      .where(and(eq(safesTable.id, rawSafeId), eq(safesTable.company_id, companyId)));
    if (!safe) return { error: { status: 404, message: "الخزانة المحددة غير موجودة" } };
    if (Number(safe.balance) < totalNet) {
      return { error: { status: 422, message: `رصيد الخزانة "${safe.name}" غير كافٍ — المتاح: ${Number(safe.balance).toFixed(2)} والمطلوب: ${totalNet.toFixed(2)}` } };
    }

    await tx.update(safesTable)
      .set({ balance: sql`${safesTable.balance} - ${String(totalNet)}` })
      .where(eq(safesTable.id, rawSafeId));

    await tx.insert(transactionsTable).values({
      type:           "payroll_disbursement",
      reference_type: "payroll_period",
      reference_id:   id,
      safe_id:        rawSafeId,
      safe_name:      safe.name,
      amount:         String(totalNet),
      direction:      "out",
      description:    notes?.trim() || `صرف رواتب — ${period.name}`,
      date:           new Date().toISOString().split("T")[0]!,
      company_id:     companyId,
    });

    try {
      const [liabAcc] = await tx.select().from(accountsTable)
        .where(and(eq(accountsTable.company_id, companyId), eq(accountsTable.type, "liability"), eq(accountsTable.is_posting, true), ilike(accountsTable.name, "%رواتب%")))
        .limit(1);
      const [cashAcc] = await tx.select().from(accountsTable)
        .where(and(eq(accountsTable.company_id, companyId), eq(accountsTable.type, "asset"), eq(accountsTable.is_posting, true), ilike(accountsTable.name, "%نقدية%")))
        .limit(1);
      if (liabAcc && cashAcc) {
        const todayStr = new Date().toISOString().split("T")[0]!;
        const [{ c }] = await tx.select({ c: sql<number>`count(*)` }).from(journalEntriesTable).where(eq(journalEntriesTable.company_id, companyId));
        const entryNo = `PAY-${String(Number(c ?? 0) + 1).padStart(4, "0")}`;
        const [entry] = await tx.insert(journalEntriesTable).values({
          company_id: companyId, entry_no: entryNo, date: todayStr,
          description: `قيد صرف رواتب — ${period.name}`, reference: `PAYROLL-PAY-${id}`, status: "posted",
          total_debit: String(totalNet), total_credit: String(totalNet),
        }).returning();
        await tx.insert(journalEntryLinesTable).values([
          { entry_id: entry.id, account_id: liabAcc.id, account_name: liabAcc.name, account_code: liabAcc.code, debit: String(totalNet), credit: "0", description: `تسوية رواتب مستحقة — ${period.name}` },
          { entry_id: entry.id, account_id: cashAcc.id, account_name: cashAcc.name, account_code: cashAcc.code, debit: "0", credit: String(totalNet), description: `صرف رواتب من خزانة "${safe.name}"` },
        ]);
      }
    } catch { /* القيد اختياري */ }

    await tx.update(payrollRecordsTable)
      .set({ status: "paid", updated_at: new Date() })
      .where(inArray(payrollRecordsTable.id, unpaidIds));
    await tx.update(payrollPeriodsTable)
      .set({ status: "paid", processed_by: userId, updated_at: new Date() })
      .where(eq(payrollPeriodsTable.id, id));

    return { ok: true, safeName: safe.name };
  });

  if ("error" in result) {
    res.status((result.error as { status: number }).status).json({ error: (result.error as { message: string }).message });
    return;
  }

  await writeAuditLog({
    action: "update", record_type: "payroll_period", record_id: id,
    new_value: { status: "paid", total_net: totalNet, safe_id: rawSafeId },
    user: { id: userId ?? undefined, username: req.user?.username },
  });

  res.json({ ok: true, total_paid: totalNet, safe_name: result.safeName });
}));

/* ── My Payslips (بوابة الموظف) ──────────────────────────────── */
router.get("/payroll/my-payslips", wrap(async (req, res) => {
  const empId = req.user?.employee_id ?? null;
  if (!empId) { res.json([]); return; }
  const rows = await db.select({
    id: payrollRecordsTable.id,
    payroll_period_id: payrollRecordsTable.payroll_period_id,
    gross_salary: payrollRecordsTable.gross_salary,
    net_salary: payrollRecordsTable.net_salary,
    total_deductions: payrollRecordsTable.total_deductions,
    tax_amount: payrollRecordsTable.tax_amount,
    advance_deductions: payrollRecordsTable.advance_deductions,
    incentive_amount: payrollRecordsTable.incentive_amount,
    status: payrollRecordsTable.status,
    currency: payrollRecordsTable.currency,
    period_name: payrollPeriodsTable.name,
    period_start: payrollPeriodsTable.start_date,
    period_end: payrollPeriodsTable.end_date,
    created_at: payrollRecordsTable.created_at,
    updated_at: payrollRecordsTable.updated_at,
  })
    .from(payrollRecordsTable)
    .leftJoin(payrollPeriodsTable, eq(payrollRecordsTable.payroll_period_id, payrollPeriodsTable.id))
    .where(eq(payrollRecordsTable.employee_id, empId))
    .orderBy(desc(payrollPeriodsTable.start_date));
  res.json(rows.map(r => ({
    ...r,
    gross_salary: Number(r.gross_salary), net_salary: Number(r.net_salary),
    total_deductions: Number(r.total_deductions), tax_amount: Number(r.tax_amount),
    advance_deductions: Number(r.advance_deductions), incentive_amount: Number(r.incentive_amount),
    created_at: fmt(r.created_at as Date | null | undefined), updated_at: fmt(r.updated_at as Date | null | undefined),
  })));
}));

router.get("/payroll/my-payslips/:id/lines", wrap(async (req, res) => {
  const empId = req.user?.employee_id ?? null;
  if (!empId) { res.json([]); return; }
  const id = parseInt(String(req.params["id"]), 10);
  const [rec] = await db.select({ id: payrollRecordsTable.id })
    .from(payrollRecordsTable).where(and(eq(payrollRecordsTable.id, id), eq(payrollRecordsTable.employee_id, empId)));
  if (!rec) { res.status(404).json({ error: "القسيمة غير موجودة" }); return; }
  const lines = await db.select().from(payrollLineItemsTable).where(eq(payrollLineItemsTable.payroll_record_id, id));
  res.json(lines.map(l => ({ ...l, amount: Number(l.amount), created_at: fmt(l.created_at as Date | null | undefined) })));
}));

/* ── Async payroll processing (fire & forget) ─────────────────── */
router.post("/payroll/periods/:id/process-async", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const periodId  = parseInt(String(req.params["id"]), 10);

  const [period] = await db.select({ id: payrollPeriodsTable.id, status: payrollPeriodsTable.status })
    .from(payrollPeriodsTable)
    .where(and(eq(payrollPeriodsTable.id, periodId), eq(payrollPeriodsTable.company_id, companyId)));
  if (!period) { res.status(404).json({ error: "الفترة غير موجودة" }); return; }
  if (period.status !== "draft") { res.status(409).json({ error: "تمت معالجة هذه الفترة مسبقاً" }); return; }

  const jobId = enqueueJob("payroll_process", { periodId, companyId, userId }, async (_job, updateProgress) => {
    const employees = await db.select().from(employeesTable)
      .where(and(eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at), eq(employeesTable.employment_status, "active")));

    updateProgress(5);

    const year = new Date().getFullYear().toString();
    const [taxBracketsAsync, contributionsAsync] = await Promise.all([
      db.select().from(taxBracketsTable)
        .where(and(eq(taxBracketsTable.company_id, companyId), eq(taxBracketsTable.fiscal_year, year)))
        .orderBy(taxBracketsTable.min_salary),
      db.select().from(statutoryContributionsTable)
        .where(and(eq(statutoryContributionsTable.company_id, companyId), eq(statutoryContributionsTable.is_active, true))),
    ]);

    updateProgress(10);
    const total = employees.length;
    let processed = 0;

    for (const emp of employees) {
      const existing = await db.select({ id: payrollRecordsTable.id }).from(payrollRecordsTable)
        .where(and(eq(payrollRecordsTable.payroll_period_id, periodId), eq(payrollRecordsTable.employee_id, emp.id)));
      if (existing.length > 0) { processed++; continue; }

      const baseSalary = Number(emp.salary ?? 0);
      if (baseSalary <= 0) { processed++; continue; }
      const grossSalary = baseSalary;
      const lineItems: Array<{ component_name: string; component_type: string; amount: number; description?: string }> = [];
      lineItems.push({ component_name: "الراتب الأساسي", component_type: "base", amount: baseSalary });

      let totalDeductions = 0;
      for (const contrib of contributionsAsync) {
        const empDeduction = grossSalary * Number(contrib.employee_percentage) / 100;
        if (empDeduction > 0) {
          lineItems.push({ component_name: contrib.name_ar, component_type: "deduction", amount: -empDeduction });
          totalDeductions += empDeduction;
        }
      }

      let taxAmount = 0;
      for (const bracket of taxBracketsAsync) {
        const min  = Number(bracket.min_salary);
        const max  = bracket.max_salary != null ? Number(bracket.max_salary) : Infinity;
        const rate = Number(bracket.tax_rate);
        if (grossSalary > min) taxAmount += (Math.min(grossSalary, max) - min) * rate / 100;
      }
      if (taxAmount > 0) lineItems.push({ component_name: "ضريبة الدخل", component_type: "tax", amount: -taxAmount });

      const advances = await db.select().from(salaryAdvancesTable)
        .where(and(eq(salaryAdvancesTable.employee_id, emp.id), eq(salaryAdvancesTable.status, "active")));
      let advanceDeductions = 0;
      for (const adv of advances) {
        const deductAmt = Math.min(Number(adv.remaining_balance ?? 0), Number(adv.approved_amount ?? 0));
        if (deductAmt > 0) {
          lineItems.push({ component_name: `خصم سلفة #${adv.id}`, component_type: "advance", amount: -deductAmt });
          advanceDeductions += deductAmt;
        }
      }

      const [period2] = await db.select({ start_date: payrollPeriodsTable.start_date })
        .from(payrollPeriodsTable).where(eq(payrollPeriodsTable.id, periodId));
      const periodMonth = (period2?.start_date ?? "").substring(0, 7);
      const [incentiveSummary] = await db.select().from(monthlyIncentiveSummaryTable)
        .where(and(eq(monthlyIncentiveSummaryTable.employee_id, emp.id), eq(monthlyIncentiveSummaryTable.month, periodMonth)));
      let incentiveAmount = 0;
      if (incentiveSummary?.status === "pending") {
        incentiveAmount = Number(incentiveSummary.total_accrued ?? 0);
        if (incentiveAmount > 0) lineItems.push({ component_name: "الحوافز الشهرية", component_type: "incentive", amount: incentiveAmount });
      }

      const netSalary = Math.max(0, grossSalary - totalDeductions - taxAmount - advanceDeductions + incentiveAmount);
      const [record] = await db.insert(payrollRecordsTable).values({
        payroll_period_id: periodId, employee_id: emp.id,
        gross_salary: String(grossSalary), total_allowances: "0",
        total_deductions: String(totalDeductions), tax_amount: String(taxAmount),
        net_salary: String(netSalary), currency: emp.currency ?? "EGP",
        advance_deductions: String(advanceDeductions), incentive_amount: String(incentiveAmount), status: "draft",
      }).returning();
      await db.insert(payrollLineItemsTable).values(
        lineItems.map(li => ({ payroll_record_id: record.id, component_name: li.component_name, component_type: li.component_type, amount: String(li.amount), description: li.description ?? null }))
      );
      if (incentiveSummary && incentiveAmount > 0) {
        await db.update(monthlyIncentiveSummaryTable)
          .set({ status: "included_in_payroll", included_in_payroll_record_id: record.id, updated_at: new Date() })
          .where(eq(monthlyIncentiveSummaryTable.id, incentiveSummary.id));
      }
      processed++;
      updateProgress(10 + Math.round(processed / total * 85));
    }

    await db.update(payrollPeriodsTable)
      .set({ status: "processing", processed_by: userId, processed_at: new Date(), updated_at: new Date() })
      .where(eq(payrollPeriodsTable.id, periodId));
    await writeAuditLog({
      action: "update", record_type: "payroll_period", record_id: periodId,
      new_value: { status: "processing", processed_records: processed },
      user: { id: userId ?? undefined },
    });
    return { processed_records: processed };
  });

  res.status(202).json({ job_id: jobId, status: "queued", message: "جارٍ معالجة الرواتب في الخلفية" });
}));

/* ── Job status check ────────────────────────────────────────── */
router.get("/payroll/jobs/:jobId", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const job = getJobStatus(String(req.params["jobId"]));
  if (!job) { res.status(404).json({ error: "المهمة غير موجودة" }); return; }
  res.json(job);
}));

/* ── Payroll Record ───────────────────────────────────────────── */
router.get("/payroll/records/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  const [record] = await db.select({
    id: payrollRecordsTable.id, payroll_period_id: payrollRecordsTable.payroll_period_id,
    employee_id: payrollRecordsTable.employee_id, gross_salary: payrollRecordsTable.gross_salary,
    total_allowances: payrollRecordsTable.total_allowances, total_deductions: payrollRecordsTable.total_deductions,
    tax_amount: payrollRecordsTable.tax_amount, net_salary: payrollRecordsTable.net_salary,
    advance_deductions: payrollRecordsTable.advance_deductions, incentive_amount: payrollRecordsTable.incentive_amount,
    currency: payrollRecordsTable.currency, status: payrollRecordsTable.status, notes: payrollRecordsTable.notes,
    created_at: payrollRecordsTable.created_at, updated_at: payrollRecordsTable.updated_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    employee_code: employeesTable.employee_code, hire_date: employeesTable.hire_date,
    period_name: payrollPeriodsTable.name, period_start: payrollPeriodsTable.start_date, period_end: payrollPeriodsTable.end_date,
  })
    .from(payrollRecordsTable)
    .leftJoin(employeesTable, eq(payrollRecordsTable.employee_id, employeesTable.id))
    .leftJoin(payrollPeriodsTable, eq(payrollRecordsTable.payroll_period_id, payrollPeriodsTable.id))
    .where(eq(payrollRecordsTable.id, id));
  if (!record) { res.status(404).json({ error: "سجل الراتب غير موجود" }); return; }
  const lineItems = await db.select().from(payrollLineItemsTable).where(eq(payrollLineItemsTable.payroll_record_id, id));
  res.json({
    ...record,
    gross_salary: Number(record.gross_salary), total_allowances: Number(record.total_allowances),
    total_deductions: Number(record.total_deductions), tax_amount: Number(record.tax_amount),
    net_salary: Number(record.net_salary), advance_deductions: Number(record.advance_deductions),
    incentive_amount: Number(record.incentive_amount),
    created_at: fmt(record.created_at), updated_at: fmt(record.updated_at),
    line_items: lineItems.map(li => ({ ...li, amount: Number(li.amount), created_at: fmt(li.created_at) })),
  });
}));

router.post("/payroll/records/:id/approve", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_approve_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  await db.update(payrollRecordsTable).set({ status: "approved", updated_at: new Date() }).where(eq(payrollRecordsTable.id, id));
  res.json({ ok: true });
}));

/* ── Pay individual record (صرف راتب موظف منفرد) ──────────────── */
router.post("/payroll/records/:id/pay", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_approve_payroll")) { res.status(403).json({ error: "غير مصرح بصرف الراتب" }); return; }
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const id        = parseInt(String(req.params["id"]), 10);
  const { safe_id, notes } = req.body as { safe_id?: number | string; notes?: string };

  const rawSafeId = safe_id ? parseInt(String(safe_id), 10) : NaN;
  if (!rawSafeId || isNaN(rawSafeId)) { res.status(400).json({ error: "يجب اختيار الخزانة لصرف الراتب" }); return; }

  const [record] = await db.select({
    id: payrollRecordsTable.id,
    net_salary: payrollRecordsTable.net_salary,
    status: payrollRecordsTable.status,
    currency: payrollRecordsTable.currency,
    employee_id: payrollRecordsTable.employee_id,
    payroll_period_id: payrollRecordsTable.payroll_period_id,
    first_name_ar: employeesTable.first_name_ar,
    last_name_ar: employeesTable.last_name_ar,
    period_name: payrollPeriodsTable.name,
    period_status: payrollPeriodsTable.status,
  })
    .from(payrollRecordsTable)
    .leftJoin(employeesTable, eq(payrollRecordsTable.employee_id, employeesTable.id))
    .leftJoin(payrollPeriodsTable, eq(payrollRecordsTable.payroll_period_id, payrollPeriodsTable.id))
    .where(eq(payrollRecordsTable.id, id));

  if (!record) { res.status(404).json({ error: "سجل الراتب غير موجود" }); return; }
  if (record.status === "paid") { res.status(409).json({ error: "تم صرف هذا الراتب مسبقاً" }); return; }
  if (record.period_status !== "approved") {
    res.status(409).json({ error: "يجب اعتماد الفترة أولاً قبل صرف الرواتب" }); return;
  }

  const amount = Number(record.net_salary ?? 0);
  if (amount <= 0) { res.status(400).json({ error: "لا يوجد مبلغ للصرف" }); return; }

  const result = await db.transaction(async (tx) => {
    const [safe] = await tx.select().from(safesTable)
      .where(and(eq(safesTable.id, rawSafeId), eq(safesTable.company_id, companyId)));
    if (!safe) return { error: { status: 404, message: "الخزانة المحددة غير موجودة" } };
    if (Number(safe.balance) < amount) {
      return { error: { status: 422, message: `رصيد الخزانة "${safe.name}" غير كافٍ — المتاح: ${Number(safe.balance).toFixed(2)} والمطلوب: ${amount.toFixed(2)}` } };
    }

    await tx.update(safesTable)
      .set({ balance: sql`${safesTable.balance} - ${String(amount)}` })
      .where(eq(safesTable.id, rawSafeId));

    const empName = `${record.first_name_ar ?? ''} ${record.last_name_ar ?? ''}`.trim();
    await tx.insert(transactionsTable).values({
      type:           "payroll_disbursement",
      reference_type: "payroll_record",
      reference_id:   id,
      safe_id:        rawSafeId,
      safe_name:      safe.name,
      amount:         String(amount),
      direction:      "out",
      description:    notes?.trim() || `صرف راتب — ${empName} — ${record.period_name ?? ''}`,
      date:           new Date().toISOString().split("T")[0]!,
      company_id:     companyId,
    });

    await tx.update(payrollRecordsTable)
      .set({ status: "paid", updated_at: new Date() })
      .where(eq(payrollRecordsTable.id, id));

    const remaining = await tx.select({ id: payrollRecordsTable.id })
      .from(payrollRecordsTable)
      .where(and(
        eq(payrollRecordsTable.payroll_period_id, record.payroll_period_id!),
        sql`status != 'paid'`,
      ));
    if (remaining.length === 0) {
      await tx.update(payrollPeriodsTable)
        .set({ status: "paid", processed_by: userId, updated_at: new Date() })
        .where(eq(payrollPeriodsTable.id, record.payroll_period_id!));
    }

    return { ok: true, safeName: safe.name, empName };
  });

  if ("error" in result) {
    res.status((result.error as { status: number }).status).json({ error: (result.error as { message: string }).message });
    return;
  }

  res.json({ ok: true, amount, safe_name: result.safeName, emp_name: result.empName });
}));

router.post("/payroll/records/:id/reject", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_approve_payroll")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  const { reason } = req.body as { reason?: string };
  await db.update(payrollRecordsTable).set({ status: "rejected", notes: reason ?? "مرفوض", updated_at: new Date() }).where(eq(payrollRecordsTable.id, id));
  res.json({ ok: true });
}));

export default router;
