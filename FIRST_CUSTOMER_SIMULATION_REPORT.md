# تقرير محاكاة يوم العمل الكامل — أول عميل إنتاجي

**التاريخ:** 11 يونيو 2026
**المحقق:** Replit Agent (First-Customer Production Simulation)
**الحالة:** ✅ مكتمل — 4 إصلاحات طُبّقت

---

## 1. ملخص تنفيذي

جرى تشغيل محاكاة يوم عمل إنتاجي كامل على بيئة حية تشمل كل رحلة العميل الأول:
تسجيل الدخول → العملاء → الموردون → المنتجات → المشتريات → المبيعات → المرتجعات → المدفوعات → التقارير → النسخ الاحتياطي → تسجيل الخروج.

نتيجة المحاكاة: **جميع مراحل الرحلة تعمل**. تم اكتشاف 4 أخطاء وإصلاحها. تم توثيق عدد من المتطلبات الجانبية للتطوير المستقبلي.

---

## 2. نتائج الرحلة — خطوة بخطوة

| # | الخطوة | النتيجة | تفاصيل |
|---|--------|---------|--------|
| S1 | تسجيل الدخول | ✅ | Cookie-based JWT + CSRF token |
| S2 | لوحة التحكم | ✅ | `GET /api/dashboard/stats` → `net_profit=600` |
| S3 | إنشاء عميل | ✅ | `POST /api/customers` → id=131 |
| S4 | إنشاء مورّد | ✅ | `POST /api/suppliers` → id=130 |
| S5 | إنشاء فئة منتج | ✅ | `POST /api/categories` → id=4 |
| S6 | إنشاء منتج | ✅ | `POST /api/products` → id=862 |
| S7 | تسوية المخزون | ✅ | `POST /api/inventory/adjustment` → `old_qty=10 new_qty=30` |
| S8 | فاتورة شراء + ترحيل | ✅ | `PUR-2026-0004` نقدي → مرحّل |
| S9 | فاتورة بيع + ترحيل | ✅ | `INV-2026-0001` (نقدي) + `INV-2026-0002` (آجل) |
| S10a | مرتجع مبيعات | ✅ | `SR-2026-0002` — auto-populate customer (**إصلاح #3**) |
| S10b | مرتجع مشتريات | ✅ | `PR-2026-0001` |
| S11 | تحصيل عميل | ✅ | `POST /api/customers/131/receipt` |
| S12 | التقارير المالية | ✅ | ميزان المراجعة، الميزانية، التدفق النقدي، ضريبة القيمة المضافة |
| S13 | فحص صحة النظام | ✅ | `status=OK` — 5/5 فحوصات (**إصلاحات #1 و#2**) |
| S14 | النسخ الاحتياطي | ✅ | `POST /api/system/backup` → HTTP 200 (ملف مشفّر) |
| S15 | تسجيل الخروج | ✅ | `POST /api/auth/logout` (**إصلاح #4**) |

---

## 3. الأخطاء المُكتشفة والمُصلحة

### الإصلاح #1 — فحص الصحة: إحصاء مبيعات نقدية في رصيد AR

**الملف:** `artifacts/api-server/src/routes/reports/financial/health-check.ts`
**الخطورة:** 🔴 حرجة — ينتج تنبيه CRITICAL وهمي لكل عميل لديه مبيعات نقدية
**الوصف:** كانت CTE المسماة `cust_sales` تستخدم `total_amount` من جدول المبيعات، وهو يشمل المبيعات النقدية المدفوعة فوراً. هذه المبيعات لا تُنشئ قيوداً في AR، فيحدث فارق وهمي مع رصيد دفتر الأستاذ.

**الإصلاح:** تغيير الحقل من `total_amount` إلى `remaining_amount`:

```sql
-- قبل
SELECT customer_id, COALESCE(SUM(CAST(total_amount AS FLOAT8)),0) AS tot
FROM sales WHERE posting_status='posted' ...

-- بعد
SELECT customer_id, COALESCE(SUM(CAST(remaining_amount AS FLOAT8)),0) AS tot
FROM sales WHERE posting_status='posted' ...
```

`remaining_amount` يساوي `0` للمبيعات النقدية المدفوعة بالكامل، و `total_amount` للمبيعات الآجلة غير المدفوعة.

---

### الإصلاح #2 — فحص الصحة: احتساب مرتجعات نقدية في رصيد AR

**الملف:** `artifacts/api-server/src/routes/reports/financial/health-check.ts`
**الخطورة:** 🔴 حرجة — ينتج تنبيه CRITICAL وهمي عند وجود مرتجعات نقدية
**الوصف:** كانت CTE المسماة `cust_returns` تحسب جميع مرتجعات المبيعات بما فيها المرتجعات النقدية (`refund_type='cash'`). المرتجعات النقدية لا تُنشئ قيوداً على حساب AR (الخزينة هي التي تُخصم)، فيحدث فارق وهمي عند مقارنتها بدفتر AR.

**الإصلاح:** تقييد `cust_returns` بالمرتجعات الآجلة فقط:

```sql
-- قبل
FROM sales_returns WHERE 1=1 ...

-- بعد
FROM sales_returns WHERE refund_type = 'credit' ...
```

---

### الإصلاح #3 — مرتجع المبيعات: فقدان بيانات العميل

**الملف:** `artifacts/api-server/src/routes/returns/sales-returns.ts`
**الخطورة:** 🟡 متوسطة — المرتجع يُسجَّل بدون ربط بالعميل
**الوصف:** عند إنشاء مرتجع بيعات بتمرير `sale_id` فقط (بدون `customer_id`/`customer_name`)، كانت الحقول تُحفظ كـ `null`. هذا يعني أن دفتر أستاذ العميل لا يُحدَّث، وأن القيود المحاسبية تفقد مرجع العميل.

**الإصلاح:** استخراج تلقائي لبيانات العميل من الفاتورة الأصلية عند جلبها:

```typescript
// قبل: يجلب total_amount فقط
const [origSale] = await db.select({ total_amount: salesTable.total_amount })...

// بعد: يجلب customer_id و customer_name أيضاً
const [origSale] = await db.select({
  total_amount: salesTable.total_amount,
  customer_id: salesTable.customer_id,
  customer_name: salesTable.customer_name,
})...

// Auto-populate
if (!effectiveCustomerId && origSale.customer_id) {
  effectiveCustomerId = String(origSale.customer_id);
}
if (!effectiveCustomerName && origSale.customer_name) {
  effectiveCustomerName = origSale.customer_name;
}
```

جميع الاستخدامات الداخلية في الـ transaction (دفتر الأستاذ، الخزينة، القيود) تستخدم الآن `effectiveCustomerId` / `effectiveCustomerName`.

---

### الإصلاح #4 — Logout: تعطل عند غياب Content-Type

**الملف:** `artifacts/api-server/src/routes/auth/login.ts`
**الخطورة:** 🟡 متوسطة — خطأ 500 عند تسجيل الخروج بدون header مناسب
**الوصف:** عملية تفكيك `req.body` كانت تستدعي استثناء إذا كان `req.body` يساوي `undefined` (يحدث عند إرسال طلب POST بدون `Content-Type: application/json`، فلا تُشغّل middleware الـ JSON parser).

```
Error: Cannot destructure property 'refreshToken' of 'req.body' as it is undefined.
```

**الإصلاح:** تفكيك آمن مع قيمة افتراضية:

```typescript
// قبل
const { refreshToken: bodyRefresh } = req.body as { refreshToken?: string };

// بعد
const { refreshToken: bodyRefresh } = ((req.body as { refreshToken?: string } | undefined) ?? {});
```

---

## 4. ملاحظات عقد الـ API (Gotchas للعميل الأول)

هذه ليست أخطاء بل سلوك مقصود يجب توثيقه في replit.md:

| الموضوع | التفاصيل |
|---------|---------|
| **إنشاء منتج** | الحقل المطلوب هو `sale_price` وليس `price`. الحقول العددية يجب أن تكون `number` وليس `string`. |
| **تسوية مخزون** | الحقل المطلوب هو `new_quantity` (الكمية النهائية المرغوبة) وليس `quantity`. |
| **بنود الشراء/البيع** | كل بند يجب أن يحتوي على `product_name` (نص) و `total_price` (رقم) بالإضافة إلى `unit_price`. |
| **اسم المورد في الشراء** | الـ API يأخذ `supplier_name` كنص حر وليس `supplier_id`. الواجهة الأمامية مسؤولة عن إرسال الاسم. |
| **نوع استرداد المرتجع** | الحقل اسمه `refund_type` (قيم: `cash` \| `credit`) وليس `refund_method`. |
| **تحصيل العميل المباشر** | `POST /customers/:id/receipt` لا يُنشئ `receipt_voucher` في جدول `receipt_vouchers`، وبالتالي لا يظهر في فحص الصحة ضمن `total_receipts`. للتتبع الكامل استخدم `POST /receipt-vouchers`. |

---

## 5. التقارير المالية — الحالة

| التقرير | المسار | الحالة |
|---------|--------|--------|
| ميزان المراجعة | `GET /api/reports/trial-balance` | ✅ |
| الميزانية العمومية | `GET /api/reports/balance-sheet` | ✅ |
| التدفق النقدي (مباشر) | `GET /api/reports/cash-flow` | ✅ |
| التدفق النقدي (غير مباشر) | `GET /api/reports/cash-flow-indirect` | ✅ |
| ضريبة القيمة المضافة | `GET /api/reports/vat-report` | ✅ |
| كشف حساب عميل | `GET /api/reports/customer-statement` | ✅ |
| كشف حساب مورّد | `GET /api/reports/supplier-statement` | ✅ |
| تحليل المبيعات | `GET /api/reports/sales-analysis` | ✅ |
| فحص صحة النظام | `GET /api/reports/health-check` | ✅ |
| تقرير تقادم العملاء | `GET /api/reports/customer-aging` | ❌ غير موجود |
| قائمة الدخل | `GET /api/reports/income-statement` | ❌ غير موجود |
| تقرير المخزون | `GET /api/reports/inventory` | ❌ غير موجود (الملف فارغ) |

---

## 6. التحقق من الاختبارات

تم تشغيل التحقق النهائي بعد تنظيف الـ commit وقبل الرفع:

- Backend lint: ✅ PASS — 0 errors / 5 known warnings
- Backend typecheck: ✅ PASS — 0 errors
- Backend tests: ✅ PASS — 55 files / 720 tests
- Frontend typecheck: ✅ PASS — 0 errors
- Frontend tests: ✅ PASS — 23 files / 264 tests

تحذيرات lint المتبقية معروفة في `load-env.ts` و `csrf.ts`، ولا تخص الإصلاحات الحالية.

---

## 7. التوصيات المستقبلية (للتطوير التالي)

| الأولوية | الموضوع | التفاصيل |
|---------|---------|---------|
| 🟡 متوسطة | **تقرير تقادم العملاء** | إنشاء `GET /api/reports/customer-aging` لعرض الأرصدة مجمّعة حسب الفترة (30/60/90/+90 يوم). |
| 🟡 متوسطة | **قائمة الدخل** | إنشاء `GET /api/reports/income-statement` (الإيرادات ناقص التكاليف = صافي الربح مفصّل). |
| 🟡 متوسطة | **تقرير المخزون** | استكمال `inventory-reports.ts` بتقرير القيمة الإجمالية للمخزون حسب المنتج/الفئة. |
| 🟢 منخفضة | **تحصيل العميل المباشر** | تغيير `POST /customers/:id/receipt` ليُنشئ `receipt_voucher` مرحّلاً، أو إضافة `customer_ledger.type='receipt'` إلى حساب `total_receipts` في فحص الصحة. |
| 🟢 منخفضة | **اسم العميل في المبيعات** | التحقق من أن الواجهة الأمامية ترسل `customer_name` مع `customer_id` عند إنشاء المبيعات (البيانات التاريخية ستظهر بدون اسم العميل في السجلات). |

---

## 8. الخلاصة

النظام جاهز للعميل الأول من الناحية الوظيفية. الرحلة الكاملة (15 خطوة) تعمل بدون أي انهيار. الإصلاحات الأربعة ترفع مستوى الاستقرار الإنتاجي، خاصةً فحص الصحة الذي كان يُظهر تنبيهات CRITICAL وهمية عند أي عملية نقدية. التقارير الأساسية كافة متاحة. التوصيات المستقبلية ثلاثة تقارير مفقودة وتحسين تتبع التحصيل.

| الإجمالي | القيمة |
|---------|-------|
| خطوات الرحلة | 15/15 ✅ |
| أخطاء مُكتشفة | 4 |
| أخطاء مُصلحة | 4 |
| تقارير تعمل | 9/12 |
| typecheck | ✅ PASS |
