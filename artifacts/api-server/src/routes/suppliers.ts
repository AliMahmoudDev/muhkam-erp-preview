import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { getTenant } from "../middleware/auth";
import { CreateCustomerBody } from "@workspace/api-zod";
import { getOrCreateCustomerAccount } from "../lib/auto-account";
import { normalizeName, getNextCustomerCode } from "./customers";

const router: IRouter = Router();

router.get("/suppliers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_customers")) {
    res.status(403).json({ error: "غير مصرح بعرض الموردين" }); return;
  }
  const companyId = getTenant(req);
  const rows = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.company_id, companyId), eq(customersTable.is_supplier, true)))
    .orderBy(customersTable.customer_code);
  res.json(rows);
}));

router.post("/suppliers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_customers")) {
    res.status(403).json({ error: "غير مصرح بإضافة موردين" }); return;
  }
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message }); return;
  }
  const companyId = req.user!.company_id!;
  const newCode = await getNextCustomerCode();
  const normalized = normalizeName(parsed.data.name);

  const [supplier] = await db.insert(customersTable).values({
    name: parsed.data.name.trim(),
    customer_code: newCode,
    normalized_name: normalized,
    phone: parsed.data.phone ?? null,
    balance: String(parsed.data.balance ?? 0),
    is_customer: false,
    is_supplier: true,
    company_id: companyId,
  }).returning();

  await getOrCreateCustomerAccount(newCode, parsed.data.name.trim(), companyId);

  res.status(201).json(supplier);
}));

export default router;
