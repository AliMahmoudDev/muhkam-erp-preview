# Coding Conventions — MUHKAM ERP

> اصطلاحات الكود الموحّدة للمشروع. الهدف: أن يفتح أي مبرمج محترف الـ codebase
> ويكتب كوداً متّسقاً مع الموجود دون تخمين. هذه الوثيقة وصفية للنمط القائم،
> وليست اقتراحاً لإعادة هيكلة.

---

## 1. اللغات والبنية العامة

- **Monorepo** يُدار بـ `pnpm workspaces`.
- الأماكن الرئيسية:
  - `artifacts/api-server` — خادم Express 5 + Drizzle ORM.
  - `artifacts/erp-system` — واجهة React + Vite.
  - `artifacts/erp-mobile` — تطبيق Expo.
  - `packages/*` (مُعرّفة كـ `@workspace/*`) — `db`, `api-zod`, `ui`, `lib`.
- TypeScript فقط. لا JavaScript في كود التطبيق.
- لا تستخدم `any` إلا للضرورة القصوى وموثّقة بتعليق `// eslint-disable-next-line` مع سبب.

---

## 2. تسمية الملفات (File Naming)

| النوع | الاصطلاح | مثال |
|------|----------|------|
| React component | `PascalCase.tsx` | `CustomerFormModal.tsx` |
| React page (مدخل المسار) | `kebab-case.tsx` أو مجلد بـ `index.tsx` | `bank-reconciliation.tsx`, `customers/index.tsx` |
| Custom hook | `useXxx.ts` (camelCase) | `useCustomerLedger.ts` |
| Backend route module | `kebab-case.ts` | `payment-vouchers.ts` |
| Backend lib helper | `kebab-case.ts` | `audit-log.ts`, `auto-account.ts` |
| ملف داخلي مشترك للمجلد | بادئة `_` | `_shared.ts`, `_helpers.ts`, `_components.tsx` |

**قاعدة:** عند إنشاء hook جديد استخدم `useXxx` camelCase. الملفات القديمة بصيغة
`use-xxx.ts` (مثل `use-toast.ts`) موروثة؛ لا تنشئ ملفات جديدة بهذا النمط.

---

## 3. تسمية المسارات (Route Naming)

- مسارات REST بصيغة الجمع: `/customers`, `/journal-entries`, `/payment-vouchers`.
- كلمات المسار `kebab-case` وليست `camelCase` أو `snake_case`.
- المعرّفات في الـ path: `/:id`. الإجراءات الفرعية بصيغة فعل واضح:
  `/journal-entries/:id/post`, `/journal-entries/:id/reverse`.

---

## 4. لغة رسائل المستخدم

- **كل رسالة خطأ موجّهة للمستخدم تكون بالعربية.** هذا منتج عربي RTL.
- ممنوع ترك رسائل إنجليزية مثل `"not found"` في استجابات الـ API.
- شكل الاستجابة الموحّد للخطأ: `{ error: "رسالة عربية واضحة" }`.
- رسائل الـ logs الداخلية (`logger.error`) تبقى بالإنجليزية — هي للمطوّرين لا للمستخدم.

---

## 5. عزل المستأجر (`company_id`)

- **القاعدة الذهبية:** `company_id` يُشتقّ دائماً من جلسة المصادقة عبر
  `getTenant(req)` من `middleware/auth`. **لا يُقرأ أبداً من جسم الطلب (body)**
  لمستخدم عادي.
- الاستثناء الوحيد: `super_admin` يمرّر `company_id` صراحةً (يتكفّل `getTenant`
  بذلك داخلياً ويرمي 400 إن لم يُمرَّر).
- كل `SELECT/UPDATE/DELETE` يجب أن يحتوي شرط
  `where(eq(table.company_id, cid))`. هذه هي الطبقة الأولى للحماية؛ RLS طبقة
  دفاع ثانية فقط (لا تعتمد عليها وحدها بسبب تجمّع الاتصالات).

---

## 6. متى تستخدم `db.transaction`

استخدم `db.transaction(async (tx) => { ... })` لأي عملية:

- تكتب في أكثر من جدول وتجب ذرّيتها (atomicity).
- تنطوي على حركة مالية + قيد في `transactions` ledger.
- تعدّل المخزون + تسجّل `stock_movements` معاً.
- تنشئ مستنداً + ترقيمه التسلسلي (`invoice-no.ts` / repairs).

داخل الـ transaction مرّر `tx` لكل استعلامات تلك العملية. لا تخلط بين `db` و`tx`
في نفس الوحدة الذرية.

---

## 7. متى يكون Audit Logging مطلوباً

سجّل عبر `writeAuditLog(...)` (من `lib/audit-log`) عند أي:

- **إنشاء/تعديل/حذف مالي حسّاس:** قيود يومية، سندات قبض/صرف، حركات مالية،
  أرصدة افتتاحية، فواتير شراء، تسويات مخزون، تحويلات خزينة.
- **عمليات SaaS / super-admin:** إدارة الشركات، إعادة تعيين كلمات السر،
  استعادة النسخ الاحتياطية.
- **تغييرات دورة حياة:** قفل/فتح فترة مالية، عكس قيد، تغيير حالة بطاقة صيانة.

القواعد:
- `writeAuditLog` **fire-and-forget ولا يرمي استثناء أبداً** — فشل التسجيل لا
  يكسر الطلب. استدعِها بـ `void writeAuditLog({...})`.
- لا تُسجّل أسراراً أو كلمات سر أو رموز في `old_value`/`new_value`.
- `company_id` من سياق المستأجر فقط؛ تُترك `null` لأحداث super-admin/system —
  لا تُسند لمستأجر آخر.
- سجّل `action`, `record_type`, `record_id`, و`user` عند توفرها.

---

## 8. الجلب من الواجهة (Frontend Fetch)

- استخدم `authFetch` (من `lib/auth-fetch`) لكل طلب يحتاج مصادقة — يضيف رمز CSRF
  ويُجدّد الجلسة تلقائياً عند 401.
- `fetch` المباشر مسموح **فقط** في الصفحات العامة أو ما قبل المصادقة:
  - `login.tsx` (تسجيل الدخول و2FA — لا توجد جلسة بعد).
  - `login/RegisterForm.tsx` (تسجيل شركة جديدة).
  - `repair-track.tsx` (تتبّع صيانة عام بلا مصادقة).
- أي `fetch` مباشر آخر يُعدّ مخالفة ويجب تحويله إلى `authFetch`.

---

## 9. التحقّق من المدخلات (Validation)

- الباك-إند: كل route يتحقّق من المدخلات بـ **Zod** قبل أي كتابة.
- استخدم `.safeParse` وافحص `parsed.success`، أو schemas المولّدة من
  `@workspace/api-zod` عند توفرها.
- لا تكتب في قاعدة البيانات قبل نجاح التحقّق.

---

## 10. معالجة الأخطاء في الـ routes

- لُفّ كل handler بـ `wrap(async (req, res) => { ... })` من `lib/async-handler`
  لمنع الـ unhandled promise rejections.
- استخدم رموز الحالة الصحيحة: 400 (تحقّق)، 401 (غير مصادق)، 403 (غير مصرّح)،
  404 (غير موجود)، 409 (تعارض)، 422 (كيان غير قابل للمعالجة).

---

## 11. الالتزام والمراجعة

- لا تُدخل ملفات مولّدة أو صوراً غير مطلوبة.
- لا تلمس `.agents/memory` يدوياً.
- شغّل `pnpm lint` و`pnpm typecheck` و`pnpm test` قبل اعتبار أي تغيير مكتملاً.
- راجع `docs/API_PATTERNS.md` و`docs/FRONTEND_PATTERNS.md` و`docs/TESTING_GUIDE.md`
  للتفاصيل الخاصة بكل طبقة.
