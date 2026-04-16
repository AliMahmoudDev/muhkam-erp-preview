import { Router, type IRouter } from "express";
import { eq, max, asc, sql } from "drizzle-orm";
import { db, customersTable, transactionsTable, safesTable, customerLedgerTable, customerClassificationsTable } from "@workspace/db";
import { writeAuditLog } from "../lib/audit-log";
import { hasPermission } from "../lib/permissions";
import { getCustomerLedgerBalance } from "../lib/ledger-balance";
import {
  CreateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  DeleteCustomerParams,
  DeleteCustomerResponse,
  CreateCustomerReceiptParams,
  CreateCustomerReceiptBody,
  CreateCustomerReceiptResponse,
} from "@workspace/api-zod";
import { wrap, httpError } from "../lib/async-handler";
import { getOrCreateCustomerAccount } from "../lib/auto-account";

const router: IRouter = Router();

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function formatCustomer(c: typeof customersTable.$inferSelect, ledgerBalance?: number) {
  return {
    ...c,
    balance: ledgerBalance !== undefined ? ledgerBalance : Number(c.balance),
    is_customer: c.is_customer ?? true,
    is_supplier: c.is_supplier ?? false,
    created_at: c.created_at.toISOString(),
  };
}

async function getNextCustomerCode(): Promise<number> {
  const result = await db.select({ maxCode: max(customersTable.customer_code) }).from(customersTable);
  const currentMax = result[0]?.maxCode ?? 0;
  return Math.max(currentMax ?? 0, 1000) + 1;
}

router.get("/customers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_customers")) {
    res.status(403).json({ error: "غير مصرح بعرض العملاء" }); return;
  }
  // مصدر الحقيقة الوحيد: جدول customer_ledger
  // الرصيد = SUM(amount) لكل عميل
  // موجب = العميل مدين لنا (عليه) — سالب = نحن مدينون له (له علينا)
  const companyId = req.user?.company_id ?? null;
  const companyFilter = companyId !== null ? sql` WHERE c.company_id = ${companyId}` : sql``;
  const rawLimitC = parseInt(String(req.query.limit ?? "500"), 10);
  const limitC = Math.min(Math.max(isNaN(rawLimitC) ? 500 : rawLimitC, 1), 2000);
  const rows = await db.execute(sql`
    SELECT
      c.id, c.name, c.customer_code, c.phone,
      c.is_customer, c.is_supplier, c.account_id, c.normalized_name, c.created_at,
      c.classification_id,
      COALESCE(SUM(CAST(cl.amount AS FLOAT8)), 0) AS ledger_balance
    FROM customers c
    LEFT JOIN customer_ledger cl ON cl.customer_id = c.id
    ${companyFilter}
    GROUP BY c.id, c.name, c.customer_code, c.phone,
             c.is_customer, c.is_supplier, c.account_id, c.normalized_name, c.created_at,
             c.classification_id
    ORDER BY c.customer_code
    LIMIT ${limitC}
  `);
  const customers = (rows.rows as any[]).map(r => ({
    id: r.id,
    name: r.name,
    customer_code: r.customer_code,
    phone: r.phone,
    balance: Math.round(Number(r.ledger_balance) * 100) / 100,
    is_customer: r.is_customer ?? true,
    is_supplier: r.is_supplier ?? false,
    account_id: r.account_id,
    classification_id: r.classification_id ?? null,
    normalized_name: r.normalized_name,
    created_at: new Date(r.created_at).toISOString(),
  }));
  res.json(customers);
}));

router.post("/customers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح بإضافة عملاء" }); return;
  }
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const normalized = normalizeName(parsed.data.name);
  const companyIdPost = req.user?.company_id ?? 1;

  // رقم الهاتف إلزامي
  const phonePost = String(parsed.data.phone ?? "").trim();
  if (!phonePost) {
    res.status(400).json({ error: "رقم الهاتف مطلوب" }); return;
  }

  // تحقق من تكرار الاسم
  const existingName = await db.execute(sql`SELECT id, name FROM customers WHERE normalized_name = ${normalized} AND company_id = ${companyIdPost} LIMIT 1`);
  if ((existingName.rows as any[]).length > 0) {
    const dup = (existingName.rows as any[])[0];
    res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${dup.name}"` }); return;
  }

  // تحقق من تكرار رقم الهاتف
  const existingPhone = await db.execute(sql`SELECT id, name FROM customers WHERE phone = ${phonePost} AND company_id = ${companyIdPost} LIMIT 1`);
  if ((existingPhone.rows as any[]).length > 0) {
    const dup = (existingPhone.rows as any[])[0];
    res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${dup.name}"` }); return;
  }

  const newCode = await getNextCustomerCode();

  const newClassificationId = req.body.classification_id
    ? parseInt(String(req.body.classification_id), 10) || null
    : null;

  const [customer] = await db.insert(customersTable).values({
    name: parsed.data.name.trim(),
    customer_code: newCode,
    normalized_name: normalized,
    phone: parsed.data.phone ?? null,
    balance: String(parsed.data.balance ?? 0),
    is_customer: parsed.data.is_customer ?? true,
    is_supplier: parsed.data.is_supplier ?? false,
    classification_id: newClassificationId,
    company_id: req.user?.company_id ?? undefined,
  }).returning();

  const acct = await getOrCreateCustomerAccount(newCode, parsed.data.name.trim());
  const [updated] = await db.update(customersTable)
    .set({ account_id: acct.id })
    .where(eq(customersTable.id, customer.id))
    .returning();

  // الرصيد الافتتاحي → دفتر الأستاذ (مصدر الحقيقة الوحيد)
  const openingBalance = Number(parsed.data.balance ?? 0);
  if (openingBalance !== 0) {
    await db.insert(customerLedgerTable).values({
      customer_id: updated.id,
      type: "opening_balance",
      amount: String(openingBalance),
      reference_type: null,
      reference_no: `OPEN-${newCode}`,
      description: `رصيد افتتاحي — ${parsed.data.name.trim()}`,
      date: new Date().toISOString().split("T")[0],
    });
  }

  void writeAuditLog({
    action: "create",
    record_type: "customer",
    record_id: updated.id,
    new_value: formatCustomer(updated),
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
  });

  res.status(201).json(formatCustomer(updated));
}));

router.get("/customers/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_customers")) {
    res.status(403).json({ error: "غير مصرح بعرض العملاء" }); return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const companyId = req.user?.company_id ?? null;
  const companyFilter = companyId !== null ? sql` AND c.company_id = ${companyId}` : sql``;
  const rows = await db.execute(sql`
    SELECT
      c.id, c.name, c.customer_code, c.phone,
      c.is_customer, c.is_supplier, c.account_id, c.created_at,
      COALESCE(SUM(CAST(cl.amount AS FLOAT8)), 0) AS ledger_balance
    FROM customers c
    LEFT JOIN customer_ledger cl ON cl.customer_id = c.id
    WHERE c.id = ${id}
    ${companyFilter}
    GROUP BY c.id, c.name, c.customer_code, c.phone,
             c.is_customer, c.is_supplier, c.account_id, c.created_at
  `);
  if (!rows.rows.length) {
    res.status(404).json({ error: "العميل غير موجود" }); return;
  }
  const r = rows.rows[0] as any;
  res.json({
    id: r.id,
    name: r.name,
    customer_code: r.customer_code,
    phone: r.phone,
    balance: Math.round(Number(r.ledger_balance) * 100) / 100,
    is_customer: r.is_customer ?? true,
    is_supplier: r.is_supplier ?? false,
    created_at: new Date(r.created_at).toISOString(),
  });
}));

router.put("/customers/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح بتعديل العملاء" }); return;
  }
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const normalized = normalizeName(parsed.data.name);
  const companyIdPut = req.user?.company_id ?? 1;

  // رقم الهاتف إلزامي
  const phonePut = String(parsed.data.phone ?? "").trim();
  if (!phonePut) {
    res.status(400).json({ error: "رقم الهاتف مطلوب" }); return;
  }

  // تحقق من تكرار الاسم (باستثناء نفس العميل)
  const dupNameRows = await db.execute(sql`SELECT id, name FROM customers WHERE normalized_name = ${normalized} AND company_id = ${companyIdPut} AND id != ${params.data.id} LIMIT 1`);
  if ((dupNameRows.rows as any[]).length > 0) {
    const dup = (dupNameRows.rows as any[])[0];
    res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${dup.name}"` }); return;
  }

  // تحقق من تكرار رقم الهاتف (باستثناء نفس العميل)
  const dupPhoneRows = await db.execute(sql`SELECT id, name FROM customers WHERE phone = ${phonePut} AND company_id = ${companyIdPut} AND id != ${params.data.id} LIMIT 1`);
  if ((dupPhoneRows.rows as any[]).length > 0) {
    const dup = (dupPhoneRows.rows as any[])[0];
    res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${dup.name}"` }); return;
  }

  const [before] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));

  const classificationId = req.body.classification_id !== undefined
    ? (req.body.classification_id === null ? null : parseInt(String(req.body.classification_id), 10))
    : undefined;

  const [customer] = await db.update(customersTable).set({
    name: parsed.data.name.trim(),
    normalized_name: normalized,
    phone: parsed.data.phone ?? null,
    balance: parsed.data.balance !== undefined ? String(parsed.data.balance) : undefined,
    is_customer: parsed.data.is_customer !== undefined ? parsed.data.is_customer : undefined,
    is_supplier: parsed.data.is_supplier !== undefined ? parsed.data.is_supplier : undefined,
    ...(classificationId !== undefined ? { classification_id: isNaN(classificationId as number) ? null : classificationId } : {}),
  }).where(eq(customersTable.id, params.data.id)).returning();
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  void writeAuditLog({
    action: "update",
    record_type: "customer",
    record_id: customer.id,
    old_value: before ? formatCustomer(before) : null,
    new_value: formatCustomer(customer),
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
  });

  res.json(UpdateCustomerResponse.parse(formatCustomer(customer)));
}));

router.delete("/customers/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح بحذف العملاء" }); return;
  }
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // فحص الرصيد — لا يمكن حذف عميل بدين قائم
  const ledgerRows = await db
    .select({ amount: customerLedgerTable.amount })
    .from(customerLedgerTable)
    .where(eq(customerLedgerTable.customer_id, params.data.id));
  const ledgerBalance = ledgerRows.reduce((s, r) => s + Number(r.amount), 0);
  if (Math.abs(ledgerBalance) > 0.001) {
    const label = ledgerBalance > 0 ? `عليه لنا ${ledgerBalance.toFixed(2)}` : `له علينا ${Math.abs(ledgerBalance).toFixed(2)}`;
    res.status(400).json({ error: `لا يمكن حذف العميل — يوجد رصيد غير مسوّى (${label})` });
    return;
  }

  const [before] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  await db.delete(customersTable).where(eq(customersTable.id, params.data.id));

  void writeAuditLog({
    action: "delete",
    record_type: "customer",
    record_id: params.data.id,
    old_value: before ? formatCustomer(before) : null,
    new_value: null,
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
  });

  res.json(DeleteCustomerResponse.parse({ success: true, message: "Customer deleted" }));
}));

router.post("/customers/:id/receipt", wrap(async (req, res) => {
  const params = CreateCustomerReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateCustomerReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const newBalance = Number(customer.balance) - parsed.data.amount;
  const [updated] = await db.update(customersTable).set({ balance: String(newBalance) })
    .where(eq(customersTable.id, params.data.id)).returning();

  await db.insert(transactionsTable).values({
    type: "receipt",
    amount: String(parsed.data.amount),
    description: parsed.data.description ?? `سند قبض - ${customer.name}`,
  });

  const ledgerBal = await getCustomerLedgerBalance(updated.account_id);
  res.json(CreateCustomerReceiptResponse.parse(formatCustomer(updated, ledgerBal)));
}));

/* ── دفتر أستاذ العميل — جلب كل الحركات مع الرصيد المتراكم ──────────────── */
router.get("/customers/:id/ledger", wrap(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) throw httpError(404, "العميل غير موجود");

  const entries = await db
    .select()
    .from(customerLedgerTable)
    .where(eq(customerLedgerTable.customer_id, id))
    .orderBy(asc(customerLedgerTable.date), asc(customerLedgerTable.created_at));

  let running = 0;
  const rows = entries.map(e => {
    const amt = Number(e.amount);
    running += amt;
    return {
      id: e.id,
      type: e.type,
      amount: amt,
      balance_after: Math.round(running * 100) / 100,
      reference_type: e.reference_type,
      reference_id: e.reference_id,
      reference_no: e.reference_no,
      description: e.description,
      date: e.date,
      created_at: e.created_at.toISOString(),
    };
  });

  const balance = Math.round(running * 100) / 100;

  res.json({
    customer_id: id,
    customer_name: customer.name,
    balance,
    entries: rows,
  });
}));

/* ── سداد مباشر من العميل (بدون فاتورة) ──────────────────────────────────── */
router.post("/customers/:id/payment", wrap(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const { amount, safe_id, notes, date } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) throw httpError(400, "أدخل مبلغاً صحيحاً");

  const txDate = date ?? new Date().toISOString().split("T")[0];
  const paymentNo = `PAY-${Date.now()}`;

  await db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) throw httpError(404, "العميل غير موجود");

    // 1. خصم من رصيد الخزينة إن وُجدت
    if (safe_id) {
      const safeIdInt = parseInt(safe_id);
      const [safe] = await tx.select().from(safesTable).where(eq(safesTable.id, safeIdInt));
      if (safe) {
        await tx.update(safesTable)
          .set({ balance: String(Number(safe.balance) + amt) })
          .where(eq(safesTable.id, safeIdInt));

        // الحركة المالية المركزية
        await tx.insert(transactionsTable).values({
          type: "receipt_voucher",
          reference_type: "customer_payment",
          reference_id: id,
          safe_id: safeIdInt,
          safe_name: safe.name,
          customer_id: id,
          customer_name: customer.name,
          amount: String(amt),
          direction: "in",
          description: notes ? `${notes} — ${customer.name}` : `سداد مباشر ${paymentNo} — ${customer.name}`,
          date: txDate,
        });
      }
    }

    // 2. دفتر الأستاذ — تسجيل السداد (يُقلّل الدين)
    await tx.insert(customerLedgerTable).values({
      customer_id: id,
      type: "payment",
      amount: String(-amt),
      reference_type: "manual_payment",
      reference_no: paymentNo,
      description: notes ? `${notes}` : `سداد مباشر ${paymentNo}`,
      date: txDate,
    });

    // 3. تحديث رصيد العميل المحفوظ (يمكن أن يصبح سالباً إذا سدّد أكثر مما عليه)
    const newBalance = Number(customer.balance) - amt;
    await tx.update(customersTable)
      .set({ balance: String(newBalance) })
      .where(eq(customersTable.id, id));
  });

  // إعادة الرصيد المحدّث
  const [updated] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  const ledgerBal = await getCustomerLedgerBalance(updated.account_id);
  res.json({ success: true, customer: formatCustomer(updated, ledgerBal) });
}));

router.post("/customers/:id/supplier-payment", wrap(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const { amount, safe_id, notes, date } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) throw httpError(400, "أدخل مبلغاً صحيحاً");
  const safeId = parseInt(safe_id);
  if (isNaN(safeId)) throw httpError(400, "اختر الخزينة");

  const txDate = date ?? new Date().toISOString().split("T")[0];
  const paymentNo = `SPAY-${Date.now()}`;
  let resultCustomer: typeof customersTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) throw httpError(404, "العميل غير موجود");
    if (!customer.is_supplier) throw httpError(400, "هذا العميل ليس مورداً");

    const [safe] = await tx.select().from(safesTable).where(eq(safesTable.id, safeId));
    if (!safe) throw httpError(404, "الخزينة غير موجودة");
    if (Number(safe.balance) < amt) throw httpError(400, "رصيد الخزينة غير كافٍ");

    await tx.update(safesTable)
      .set({ balance: String(Number(safe.balance) - amt) })
      .where(eq(safesTable.id, safe.id));

    const [updated] = await tx.update(customersTable)
      .set({ balance: String(Number(customer.balance) + amt) })
      .where(eq(customersTable.id, id))
      .returning();

    await tx.insert(transactionsTable).values({
      type: "supplier_payment",
      direction: "out",
      customer_id: id,
      customer_name: customer.name,
      safe_id: safe.id,
      safe_name: safe.name,
      amount: String(amt),
      description: notes || `تسديد دفعة للمورد - ${customer.name}`,
      date: txDate,
    });

    // دفتر الأستاذ: تسديد للمورد يُقلّل ما يدين به لنا (أو يزيد دينه علينا)
    // الرصيد السالب = ندين له، التسديد يُقلّل ما علينا → +amt في دفتر الأستاذ
    await tx.insert(customerLedgerTable).values({
      customer_id: id,
      type: "supplier_payment",
      amount: String(amt), // يُزيد رصيده (يُقلّل ما ندين به)
      reference_type: "supplier_payment",
      reference_no: paymentNo,
      description: notes ? `${notes}` : `تسديد للمورد ${paymentNo} — ${customer.name}`,
      date: txDate,
    });

    resultCustomer = updated;
  });

  res.json({ success: true, customer: formatCustomer(resultCustomer!) });
}));

/* ─── تصنيفات العملاء ─── */

router.get("/customer-classifications", wrap(async (req, res) => {
  const companyId = req.user?.company_id ?? 1;
  const rows = await db
    .select()
    .from(customerClassificationsTable)
    .where(eq(customerClassificationsTable.company_id, companyId))
    .orderBy(asc(customerClassificationsTable.name));
  res.json(rows);
}));

router.post("/customer-classifications", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const name = String(req.body.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "أدخل اسم التصنيف" }); return; }
  const companyId = req.user?.company_id ?? 1;
  // تحقق من تكرار اسم التصنيف
  const dupClass = await db.execute(sql`SELECT id FROM customer_classifications WHERE LOWER(name) = LOWER(${name}) AND company_id = ${companyId} LIMIT 1`);
  if ((dupClass.rows as any[]).length > 0) {
    res.status(400).json({ error: `التصنيف "${name}" موجود بالفعل` }); return;
  }
  const [created] = await db
    .insert(customerClassificationsTable)
    .values({ name, company_id: companyId })
    .returning();
  res.status(201).json(created);
}));

router.put("/customer-classifications/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const name = String(req.body.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "أدخل اسم التصنيف" }); return; }
  const companyId = req.user?.company_id ?? 1;
  const [updated] = await db
    .update(customerClassificationsTable)
    .set({ name })
    .where(eq(customerClassificationsTable.id, id) && eq(customerClassificationsTable.company_id, companyId) as any)
    .returning();
  if (!updated) { res.status(404).json({ error: "التصنيف غير موجود" }); return; }
  res.json(updated);
}));

router.delete("/customer-classifications/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const [linkedCustomer] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.classification_id, id)).limit(1);
  if (linkedCustomer) { res.status(400).json({ error: "لا يمكن حذف التصنيف لأنه مرتبط بعملاء" }); return; }
  await db
    .update(customersTable)
    .set({ classification_id: null })
    .where(eq(customersTable.classification_id, id));
  await db
    .delete(customerClassificationsTable)
    .where(eq(customerClassificationsTable.id, id));
  res.json({ success: true });
}));

router.get("/customer-reports", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_customers")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user?.company_id ?? 1;
  const customerId  = req.query.customer_id  ? parseInt(String(req.query.customer_id),  10) : null;
  const classId     = req.query.classification_id ? parseInt(String(req.query.classification_id), 10) : null;
  const dateFrom    = req.query.date_from ? String(req.query.date_from) : null;
  const dateTo      = req.query.date_to   ? String(req.query.date_to)   : null;

  const customerFilter       = customerId ? sql` AND c.id = ${customerId}` : sql``;
  const classificationFilter = classId    ? sql` AND c.classification_id = ${classId}` : sql``;

  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.customer_code,
      cc.name AS classification_name,
      COALESCE((
        SELECT SUM(CAST(cl2.amount AS FLOAT8))
        FROM customer_ledger cl2
        WHERE cl2.customer_id = c.id
          AND (${dateFrom}::date IS NULL OR cl2.date::date < ${dateFrom}::date)
      ), 0) AS opening_balance,
      COALESCE(SUM(CASE
        WHEN CAST(cl.amount AS FLOAT8) > 0
          AND (${dateFrom}::date IS NULL OR cl.date::date >= ${dateFrom}::date)
          AND (${dateTo}::date   IS NULL OR cl.date::date <= ${dateTo}::date)
        THEN CAST(cl.amount AS FLOAT8) ELSE 0 END), 0) AS period_debits,
      COALESCE(SUM(CASE
        WHEN CAST(cl.amount AS FLOAT8) < 0
          AND (${dateFrom}::date IS NULL OR cl.date::date >= ${dateFrom}::date)
          AND (${dateTo}::date   IS NULL OR cl.date::date <= ${dateTo}::date)
        THEN ABS(CAST(cl.amount AS FLOAT8)) ELSE 0 END), 0) AS period_credits
    FROM customers c
    LEFT JOIN customer_classifications cc ON cc.id = c.classification_id
    LEFT JOIN customer_ledger cl ON cl.customer_id = c.id
    WHERE c.company_id = ${companyId} ${customerFilter} ${classificationFilter}
    GROUP BY c.id, c.name, c.customer_code, cc.name
    ORDER BY c.customer_code
  `);

  const result = (rows.rows as any[]).map(r => ({
    id: r.id,
    name: r.name,
    customer_code: r.customer_code,
    classification_name: r.classification_name ?? null,
    opening_balance: Math.round(Number(r.opening_balance) * 100) / 100,
    period_debits:   Math.round(Number(r.period_debits)   * 100) / 100,
    period_credits:  Math.round(Number(r.period_credits)  * 100) / 100,
    closing_balance: Math.round((Number(r.opening_balance) + Number(r.period_debits) - Number(r.period_credits)) * 100) / 100,
  }));

  res.json(result);
}));

export default router;
