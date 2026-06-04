# API Patterns — MUHKAM ERP (api-server)

> أنماط الباك-إند Express 5 + Drizzle ORM. اقرأها قبل إضافة أو تعديل أي route.

---

## 1. بنية الـ Route

- المسارات في `src/routes/`. الوحدة البسيطة ملف `kebab-case.ts` يُصدّر `Router`.
- الوحدات المعقّدة تُقسّم إلى مجلد فرعي مع `index.ts` يجمع الأجزاء
  (انظر `routes/repairs/`, `routes/sales/`, `routes/employees/`,
  `routes/super/`, `routes/reports/`).
- المنطق المشترك داخل المجلد في `_shared.ts` / `_helpers.ts`.
- كل handler مُغلّف بـ `wrap(async (req, res) => { ... })` من
  `lib/async-handler` (يلتقط الأخطاء غير المتزامنة).

---

## 2. التحقّق بـ Zod

- عرّف schema في أعلى الملف أو استورده من `@workspace/api-zod`.
- تحقّق قبل أي كتابة:
  ```ts
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" });
    return;
  }
  ```
- رسائل الـ schema بالعربية لأنها تصل المستخدم.

---

## 3. `getTenant` / قواعد `company_id`

- استخرج المستأجر دائماً عبر:
  ```ts
  import { getTenant } from "../middleware/auth";
  const cid = getTenant(req);
  ```
- `getTenant` يرمي 403 إن لم يُحلّ المستأجر، و400 لـ super_admin بلا `company_id`.
- **ممنوع** قراءة `company_id` من `req.body` لمستخدم عادي.
- كل استعلام يحمل `where(eq(table.company_id, cid))`. RLS طبقة ثانية فقط.

---

## 4. فحوص الصلاحيات (Permissions)

- استخدم تركيبات الوسطاء الجاهزة من `middleware/auth`:
  - `anyAuth` = `[authenticate, requireTenant]`
  - `managerUp` = `[authenticate, requireRole("admin","manager"), requireTenant]`
  - `adminOnly` = `[authenticate, requireRole("admin"), requireTenant]`
- للتحقّق الدقيق داخل handler استخدم `hasPermission(...)` من `lib/permissions`.
- للوحدات المُسوّرة بميزة استخدم `requireFeature(...)` من
  `middleware/feature-guard`.
- قرارات التصريح **fail-closed**: ارفض افتراضياً واسمح صراحةً.

---

## 5. CSRF والمصادقة

- المصادقة JWT عبر كوكي httpOnly (ويب) أو رمز (موبايل) — يتكفّل بها
  `authenticate`.
- حماية CSRF مفعّلة على الطرق المغيِّرة للحالة عبر `middleware/csrf`. الواجهة
  ترسل الرأس تلقائياً عبر `authFetch`.

---

## 6. قواعد المعاملات (Transactions)

- أي عملية متعدّدة الجداول أو مالية تُلفّ بـ
  `db.transaction(async (tx) => { ... })`.
- استخدم `tx` (لا `db`) لكل استعلامات الوحدة الذرية.
- الحركات المالية تُسجَّل في ledger `transactions` ضمن نفس المعاملة.
- التزم بـ `invoice-no.ts` / مولّدات الترقيم التسلسلي للمستندات — حسّاسة
  للتصادم.

---

## 7. قواعد Audit Logging

سجّل عبر `writeAuditLog({...})` من `lib/audit-log` لأي عملية مالية/إدارية
حسّاسة. التوقيع:

```ts
void writeAuditLog({
  action: "create",            // AuditAction
  record_type: "receipt_voucher", // AuditRecordType
  record_id: voucher.id,
  new_value: { amount, safe_id },  // لا أسرار
  user: req.user,
  company_id: cid,             // من المستأجر فقط
  note: "سند قبض",
});
```

القواعد:
- **fire-and-forget**: استدعِها بـ `void`، لا تنتظرها بطريقة تكسر الطلب. الدالة
  لا ترمي استثناء (تلتقط أخطاءها داخلياً).
- لا تجعل فشل الـ audit يُفشل المعاملة (هذا نمط المشروع الحالي).
- لا تُسجّل أسراراً/كلمات سر/رموز.
- `company_id` من المستأجر فقط؛ `null` لأحداث super-admin/system — لا تُسند
  لمستأجر آخر.
- إن تطلّب الحدث `action` أو `record_type` جديداً أضِفه إلى الـ unions في
  `lib/audit-log.ts` (لا تستخدم سلسلة عشوائية).

---

## 8. شكل الاستجابة والأخطاء (Response & Error Shape)

- الخطأ دائماً: `{ error: "رسالة عربية" }` (انظر `CODING_CONVENTIONS §4`).
- رموز الحالة: 400 تحقّق، 401 غير مصادق، 403 غير مصرّح، 404 غير موجود،
  409 تعارض، 422 كيان غير صالح، 429 تجاوز معدّل، 503 خدمة غير متاحة.
- النجاح يُرجع الكائن أو `{ ... }` المتّسق مع schema المسار في
  `@workspace/api-zod` عند توفره.

---

## 9. قائمة تحقّق قبل دمج route جديد

- [ ] `wrap(...)` على كل handler.
- [ ] تحقّق Zod قبل أي كتابة.
- [ ] `getTenant(req)` + `where company_id` على كل استعلام.
- [ ] وسيط صلاحيات مناسب (`anyAuth`/`managerUp`/`adminOnly`/`requireFeature`).
- [ ] `db.transaction` للعمليات المركّبة/المالية.
- [ ] `writeAuditLog` لأي عملية مالية/إدارية حسّاسة.
- [ ] رسائل الخطأ بالعربية + شكل `{ error }`.
- [ ] اختبارات تغطّي: النجاح، فشل التحقّق، فشل الصلاحية، عزل المستأجر.
