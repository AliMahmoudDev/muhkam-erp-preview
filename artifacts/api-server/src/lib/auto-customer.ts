/**
 * auto-customer.ts
 * Helpers مشتركة لإنشاء (أو إيجاد) عميل بشكل تلقائي عند بطاقات الصيانة وشراء الأجهزة.
 * كان النظام سابقاً يحفظ الاسم نصاً فقط في الجدول التابع (repair_jobs / devices) دون
 * إضافة سجل في customers، ممّا يجعل تلك البيانات غير قابلة للبحث / المتابعة المالية.
 *
 * هذا الملف يُعيد السلوك السابق: إن لم يُحدَّد customer_id في الطلب يُبحث برقم
 * الهاتف داخل الشركة، فإن لم يُوجد يُنشَأ عميل جديد بالتصنيف المطلوب.
 */
import { eq, and, sql } from "drizzle-orm";
import { db, customersTable, customerClassificationsTable } from "@workspace/db";
import { normalizeName } from "../routes/customers";

type TxLike = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = typeof db | TxLike;

/**
 * يُعيد id لتصنيف عميل (يُنشئه إن لم يكن موجوداً داخل نفس الشركة).
 * المقارنة case-insensitive لتفادي تكرار التصنيفات بالأحرف المختلفة.
 */
export async function getOrCreateClassification(
  client: DbOrTx,
  companyId: number,
  name: string,
): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("classification name required");

  const existing = await client
    .select({ id: customerClassificationsTable.id })
    .from(customerClassificationsTable)
    .where(
      and(
        eq(customerClassificationsTable.company_id, companyId),
        sql`LOWER(${customerClassificationsTable.name}) = LOWER(${trimmed})`,
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const [created] = await client
    .insert(customerClassificationsTable)
    .values({ company_id: companyId, name: trimmed })
    .returning({ id: customerClassificationsTable.id });
  return created.id;
}

export interface AutoCustomerOpts {
  name: string;
  phone?: string | null;
  classificationName: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  source?: string;
}

/**
 * يبحث عن عميل برقم الهاتف داخل الشركة، فإن لم يُوجد يُنشَأ عميل جديد بالتصنيف المُحدَّد.
 * يُعيد دائماً customer_id صالحاً.
 */
export async function findOrCreateCustomerByPhone(
  client: DbOrTx,
  companyId: number,
  opts: AutoCustomerOpts,
): Promise<{ id: number; created: boolean }> {
  const cleanName = opts.name.trim();
  if (!cleanName) throw new Error("customer name required");

  const cleanPhone = (opts.phone ?? "").toString().trim() || null;

  /* 1) لو في رقم هاتف، نبحث به أولاً (داخل نفس الشركة) */
  if (cleanPhone) {
    const found = await client
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.company_id, companyId),
          eq(customersTable.phone, cleanPhone),
        ),
      )
      .limit(1);
    if (found[0]) return { id: found[0].id, created: false };
  }

  /* 2) إنشاء التصنيف إن لزم */
  const classification_id = await getOrCreateClassification(
    client,
    companyId,
    opts.classificationName,
  );

  /* 3) قفل استشاري على مستوى الـ transaction لتفادي race في customer_code
   *    (الـ UNIQUE على customer_code ضمن جميع الشركات). يُحرَّر تلقائياً عند COMMIT/ROLLBACK.
   *    يتطلّب أن يُستدعى الـ helper داخل db.transaction. */
  await client.execute(sql`SELECT pg_advisory_xact_lock(987651)`);

  /* 4) حساب customer_code التالي (مُحَصَّر صراحةً بالشركة الحالية كـ defense-in-depth بجانب الـ RLS) */
  const codeRow = await client
    .select({
      maxCode: sql<number>`COALESCE(MAX(${customersTable.customer_code}), 1000)`,
    })
    .from(customersTable)
    .where(eq(customersTable.company_id, companyId));
  const customer_code = Number(codeRow[0]?.maxCode ?? 1000) + 1;

  /* 4) إنشاء العميل */
  const [created] = await client
    .insert(customersTable)
    .values({
      company_id: companyId,
      name: cleanName,
      normalized_name: normalizeName(cleanName),
      phone: cleanPhone,
      classification_id,
      customer_code,
      is_customer: opts.isCustomer ?? true,
      is_supplier: opts.isSupplier ?? false,
      source: opts.source ?? null,
    })
    .returning({ id: customersTable.id });

  return { id: created.id, created: true };
}
