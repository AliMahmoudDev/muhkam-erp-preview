# ADR-006: Zod for API Route Input Validation
# قرار معماري 006: Zod للتحقق من صحة مدخلات مسارات API

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-06-01 |
| **Deciders / المقررون** | Backend team |
| **Supersedes / يحلّ محل** | Manual `if (!req.body.field)` checks |

---

## Context — السياق

### English

MUHKAM ERP has 70+ API routes, each receiving untrusted user input from the frontend. Without structured validation, this creates several problems:

1. **Type unsafety**: `req.body` is typed as `any` by Express — a wrong field name or type silently passes to Drizzle ORM, causing runtime errors or SQL injection vectors.
2. **Duplicated validation logic**: Without a schema library, every route hand-codes its own validation checks, leading to inconsistency and missed cases.
3. **Poor error messages**: Manual checks return ad-hoc error strings. Arabic-speaking users receive inconsistent, sometimes English-only error messages.
4. **No schema reuse**: Request/response shapes needed in both the frontend and backend had to be defined twice, causing drift.

We needed a validation library that:
- Is TypeScript-native (infers types from schema definition)
- Works isomorphically (same schema on frontend and API server)
- Produces structured, localizable error messages
- Composes well (nested objects, arrays, discriminated unions)
- Has an active ecosystem and long-term support

### العربية

مُحكم ERP يحتوي على أكثر من 70 مساراً للـ API، كل منها يستقبل مدخلات مستخدم غير موثوقة. بدون تحقق منظم، توجد مشاكل عديدة:

1. **عدم أمان الأنواع**: `req.body` مُصنَّف كـ `any` في Express.
2. **ازدواجية منطق التحقق**: كل مسار يكتب تحققاته الخاصة.
3. **رسائل خطأ سيئة**: مستخدمون يتلقون رسائل خطأ غير متسقة.
4. **لا إعادة استخدام للمخططات**: الأشكال نُعرَّف مرتين (frontend + backend).

---

## Decision — القرار

### English

We adopted **Zod** (v4 in the API server) as the single validation layer for all route inputs and shared types. Schemas are defined once in the `@workspace/api-zod` package and shared across the monorepo.

**Key Design Choices**:

1. **Centralized schemas in `@workspace/api-zod`**: All request/response schemas live in a shared package. The API server imports them for validation; the frontend imports them for type inference. This ensures zero drift between client and server contract.

2. **Zod v4 on the API** (`zod/v4`): Zod v4 has improved performance (2-3x faster parsing) and better TypeScript integration. Route-local schemas use `import { z } from "zod/v4"`.

3. **`safeParse` over `parse`**: We always use `schema.safeParse(req.body)` rather than `schema.parse()`. This gives us a structured result with `.success` + `.error` instead of a thrown exception, allowing graceful error responses.

4. **Arabic error messages**: Zod custom messages (`{ required_error: "الحقل مطلوب" }`) are used throughout for Arabic-first UX.

5. **Route-level validation middleware pattern**:
   ```typescript
   const parsed = CreateSaleBody.safeParse(req.body);
   if (!parsed.success) {
     return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" });
   }
   const { total_amount, items, ... } = parsed.data;  // fully typed
   ```

6. **Response validation with Zod** (in high-trust paths): Response schemas (`GetProductsResponse`, `GetSalesResponse`) are used via `Schema.parse()` to strip unexpected fields and enforce the API contract. If a DB column is accidentally added, it won't leak into the response.

### العربية

اعتمدنا **Zod** (الإصدار 4 في خادم API) كطبقة التحقق الوحيدة لجميع مدخلات المسارات والأنواع المشتركة. المخططات مُعرَّفة مرة واحدة في حزمة `@workspace/api-zod` ومشتركة عبر الـ monorepo.

**الخيارات التصميمية الرئيسية**:

1. **مخططات مركزية**: جميع مخططات الطلب/الاستجابة تعيش في حزمة مشتركة.
2. **`safeParse` بدلاً من `parse`**: يُعطينا نتيجة منظمة بدلاً من استثناء مُرمى.
3. **رسائل خطأ عربية**: رسائل مخصصة بالعربية لتجربة المستخدم العربي.
4. **التحقق من الاستجابة**: مخططات الاستجابة تُجرّد الحقول غير المتوقعة وتطبّق عقد الـ API.

---

## Alternatives Considered — البدائل المدروسة

### English

| Alternative | Reason Rejected |
|-------------|-----------------|
| **Joi** | No TypeScript-native type inference; runtime schema only |
| **class-validator** | Requires decorators + class instantiation boilerplate; poor tree-shaking |
| **Manual validation (`if` checks)** | Status quo — inconsistent, verbose, error-prone, no type inference |
| **Yup** | Similar to Zod but slower; smaller ecosystem; no v4 equivalent |
| **JSON Schema + ajv** | Verbose schema definition; no TypeScript inference without codegen |
| **io-ts** | Powerful but extremely verbose; steep learning curve for Arabic-focused team |
| **valibot** | Good performance but smaller ecosystem; Zod v4 closed the performance gap |

### العربية

| البديل | سبب الرفض |
|--------|-----------|
| **Joi** | لا يستنتج أنواع TypeScript تلقائياً |
| **class-validator** | يتطلب decorators وكلاسات — كود إضافي |
| **التحقق اليدوي** | غير متسق، مطوّل، عرضة للأخطاء |
| **JSON Schema + ajv** | تعريف مخططات مطوّل؛ لا استنتاج TypeScript |

---

## Consequences — التبعات

### English

**Positive**:
- **End-to-end type safety**: Schema definition → TypeScript type inference → runtime validation — all from one schema.
- **Shared contract**: Frontend and backend share the same schema package, preventing type drift.
- **Consistent error messages**: All validation errors use the same structure `{ error: string }`, with Arabic messages by default.
- **Coercion and transformation**: Zod handles type coercion (`z.coerce.number()`, `z.string().transform(...)`) cleanly.
- **Composability**: Complex nested schemas (sale items array, payment split) are built by composing simpler schemas.

**Negative / Trade-offs**:
- **Bundle size**: Zod adds ~50KB (gzipped: ~14KB) to the shared package. Acceptable for an ERP — not for a public website.
- **Parse overhead**: Zod parsing adds a small overhead (~0.1ms for typical request bodies). Negligible at ERP scale.
- **Schema maintenance**: Every new field requires schema updates in `@workspace/api-zod`. Teams must remember to update schemas when changing DB columns.

### العربية

**إيجابيات**: أمان الأنواع من طرف لطرف. عقد مشترك بين الـ frontend والـ backend. رسائل خطأ متسقة بالعربية. تحويل وتقريب الأنواع بشكل نظيف. قابلية تركيب المخططات المعقدة.

**سلبيات**: حجم bundle إضافي (~14KB مضغوط). يتطلب تحديث المخطط عند تغيير أعمدة قاعدة البيانات.

---

## Implementation Examples — أمثلة التنفيذ

```typescript
// packages/api-zod/src/sales.ts — shared schema
export const CreateSaleBody = z.object({
  total_amount: z.number().positive("إجمالي الفاتورة يجب أن يكون أكبر من صفر"),
  payment_type: z.enum(["cash", "credit", "partial"]),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    total_price: z.number().min(0),
  })).min(1, "الفاتورة يجب أن تحتوي على صنف واحد على الأقل"),
  customer_id: z.number().int().positive().optional().nullable(),
  // ...
});

// In the route handler:
const parsed = CreateSaleBody.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" });
}
// parsed.data is now fully typed — no 'any' casts needed
const { total_amount, items, payment_type } = parsed.data;
```

---

*Related: ADR-007 (Test Strategy — Zod schemas are tested via Supertest)*
