# Testing Guide — MUHKAM ERP

> دليل كتابة الاختبارات. الإطار: **Vitest** + **Supertest** (باك-إند) و
> **React Testing Library** (واجهة).

---

## 1. أين تعيش الاختبارات

- **الباك-إند:** `artifacts/api-server/src/__tests__/`
  - `routes/*.test.ts` — اختبارات المسارات (الأكثر شيوعاً).
  - `integration/*.test.ts` — تكامل (مثل `tenant-isolation.test.ts`).
  - `smoke/*.test.ts` — تدفقات حرجة شاملة (`critical-flows.test.ts`).
- **الواجهة:** اختبارات بجوار المكوّنات أو ضمن `src/**` بامتداد `*.test.tsx`.

التشغيل:
```bash
pnpm --filter @workspace/api-server run test        # كل اختبارات الباك-إند
pnpm --filter @workspace/api-server exec vitest run src/__tests__/routes/accounts.test.ts
pnpm --filter @workspace/erp-system run test        # كل اختبارات الواجهة
```

---

## 2. بنية اختبار route نموذجي

اتبع نمط الملفات الموجودة (مثل `customers-full.test.ts`):

1. عرّف الـ mocks المرفوعة (`vi.hoisted`) في **أعلى الملف**.
2. `vi.mock("@workspace/db", ...)` لتزييف طبقة قاعدة البيانات.
3. ابنِ تطبيق Express صغيراً يُركّب الـ router تحت الاختبار.
4. استخدم `supertest` لإطلاق الطلبات والتأكيد على الحالة والجسم.

---

## 3. تزييف قاعدة البيانات (DB Mocks) وقاعدة `vi.hoisted`

⚠️ **قاعدة حرجة:** `vi.mock(...)` يُرفع (hoisted) إلى أعلى الوحدة قبل أي كود.
أي بيانات يحتاجها المصنع داخل `vi.mock` يجب أن تُعرّف عبر `vi.hoisted` **في
المستوى الأعلى للوحدة** (لا داخل دالة/قبل أي تعليمة أخرى):

```ts
// ✅ صحيح — في أعلى الملف مباشرة
const { mockChainData } = vi.hoisted(() => ({ mockChainData: { rows: [] } }));

vi.mock("@workspace/db", () => ({
  db: { /* يستخدم mockChainData */ },
}));
```

وضع `vi.hoisted()` داخل `describe`/دالة يُطلق تحذير Vitest وسيصبح خطأً في
إصدار قادم. أبقِه في المستوى الأعلى دائماً.

---

## 4. الـ Fixtures

- أعد استخدام أنماط البناء الموجودة في الاختبارات الحالية بدل اختراع mocks
  جديدة هشّة.
- ابنِ أقل قدر من البيانات اللازم للتأكيد. تجنّب سلاسل mock عميقة غير ضرورية.

---

## 5. اختبارات عزل المستأجر (Tenant Isolation) — إلزامية للمسارات

لكل route يكتب/يقرأ بيانات مستأجر، أضِف تأكيداً أن:
- مستخدم الشركة (أ) لا يستطيع قراءة/تعديل سجل الشركة (ب).
- `company_id` لا يُؤخذ من جسم الطلب لمستخدم عادي.
- انظر `integration/tenant-isolation.test.ts` كمرجع.

---

## 6. اختبارات المعاملات (Transactions)

- للعمليات المركّبة، أكّد أن `db.transaction` استُدعي.
- أكّد أنه **لا تحدث كتابة عند فشل التحقّق** (rollback / عدم استدعاء insert).

---

## 7. اختبارات Audit Logging

للمسارات المالية الحسّاسة أضِف:
- **النجاح** ينشئ سجل audit (`writeAuditLog`/insert في `audit_logs` استُدعي
  بالقيم الصحيحة).
- **فشل التحقّق** لا ينشئ سجل audit.
- **فشل الصلاحية** لا ينشئ سجل audit.
- لا يُسجَّل أي سرّ.

> ملاحظة: `writeAuditLog` fire-and-forget ولا يرمي؛ عند التأكيد عليه راقب
> استدعاء الإدراج المُزيّف لا قيمة مُرجعة.

---

## 8. الحدّ الأدنى لتغطية أي route مالي جديد

لكل route مالي/حسّاس، الاختبارات الدنيا:
1. إنشاء ناجح (happy path).
2. فشل التحقّق (400) — مدخلات غير صالحة.
3. فشل الصلاحية (403) — دور غير كافٍ.
4. عزل المستأجر — لا تسرّب عبر الشركات.
5. سلوك المعاملة/الـ audit عند وجوده.

---

## 9. قبل الدمج

```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/erp-system run test
pnpm lint
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/erp-system run typecheck
```
كلها يجب أن تكون خضراء، وبلا تحذير `vi.hoisted`.
