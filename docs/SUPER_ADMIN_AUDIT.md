# تدقيق وتحسين صفحة المشرف الأعلى (Super Admin)

> وثيقة تدقيق شاملة على 8 مراحل لوحدة المشرف الأعلى في نظام مُحكم ERP.
> تاريخ التدقيق: 15 يونيو 2026.
> النطاق: `artifacts/erp-system/src/pages/super-admin/**` (الواجهة) و `artifacts/api-server/src/routes/super/**` (الخادم).

---

## ملخص تنفيذي

| البند | النتيجة |
|---|---|
| **السبب الجذري للقائمة الفارغة "0 من 0"** | استعلام الشركات لم يكن يكشف حالة الخطأ (`isError`) — أي فشل في الـ API كان يتحوّل بصمت إلى قائمة فارغة. **تم الإصلاح.** |
| **خطأ `app-settings` المتكرر للمشرف الأعلى** | المشرف الأعلى بلا `company_id`، فكان طلب `GET /api/settings/app-settings` يفشل. **تم الإصلاح** بحارس يتخطّى الطلب عند غياب سياق الشركة. |
| **عدم تطابق فلتر "مدفوعة"** | بطاقة "مدفوعة" كانت تطبّق فلتر `active` الخاطئ. **تم الإصلاح** ليطابق تعريف الخادم. |
| **استطلاع (polling) دائم لصحة Redis** | كان كل 10 ثوانٍ بلا توقف. **تم التخفيف** إلى 30 ثانية. |
| **الكود الميت** | لا يوجد كود ميت مؤكد — كل المرشّحين المشتبه بهم قيد الاستخدام فعلاً. |
| **فحوصات الجودة (typecheck + lint)** | ✅ تمر بلا أخطاء على الواجهة والخادم. |

جميع التغييرات تلتزم بقيود السلامة: لا تعديل على المصادقة/الأمان/النسخ الاحتياطي/RLS/العزل بين المستأجرين، ولا حذف ميزات، ولا تغييرات على المخطّط (schema)، ولا إعادة هيكلة واسعة، ولا تفعيل قائمة IP المسموحة للمشرف الأعلى.

---

## المرحلة 1 — جرد الوحدة (Inventory)

### تبويبات الواجهة

المنطق مُركَّز في خطّافات (hooks): `use-tabs-data.ts`, `use-company-state.ts`, `use-manager-state.ts`, `use-settings-state.ts`. الإحصائيات مشتركة عبر `/api/super/stats`.

| التبويب | الوظيفة | نقاط النهاية (Endpoints) | الحالة |
|---|---|---|---|
| **overview** | لوحة موجزة: بطاقات KPI، صحة الخادم، الشركات المنتهية قريباً، آخر سجلات التدقيق | `/api/super/stats`، `/api/super/health`، `/api/super/audit-log?limit=5` | سليم |
| **companies** | قائمة وإدارة الشركات: بحث، فلترة، ترقيم، تصدير CSV، إدارة الاشتراك | `/api/super/companies`، `/api/super/companies/:id` (GET/PUT/DELETE)، `/api/super/companies/:id/reset-admin-password`، `/api/super/export/companies` | **أُصلح** (انظر م.2) |
| **revenue** | تحليلات مالية: MRR، ARR، ARPU، معدّل التحويل، اتجاه 12 شهراً | `/api/super/revenue` | سليم (مُفعّل بالتبويب) |
| **alerts** | مركز التنبيهات الذكية: اشتراكات منتهية، حسابات خاملة، ذاكرة الخادم | `/api/super/alerts` | سليم |
| **audit_log** | السجلّ الجنائي لإجراءات المشرف الأعلى | `/api/super/audit-log?limit=N&action=...` | سليم |
| **announcements** | إنشاء وإدارة الإعلانات العامة أو الموجّهة لشركة | `/api/super/announcements` (GET/POST/PATCH/DELETE) | سليم |
| **health** | تشخيص مفصّل: مقاييس Node، مجمّع اتصالات DB، الذاكرة، زمن Redis | `/api/super/health`، `/api/super/health/redis` | **أُصلح** (انظر م.4) |
| **plans** | إدارة خطط الاشتراك: تعديل الأسعار والميزات | `/api/super/plan-settings` (GET/PUT) | سليم |
| **monitoring** | مراقبة تسجيلات التجارب لحظياً: حالات الحظر، النشاط المشبوه، فك حظر IP | `/api/super/trial-monitoring`، `/api/super/trial-monitoring/unblock-ip` | سليم |
| **managers** | إدارة حسابات المشرفين العامّين (CRUD) | `/api/super/managers` (GET/POST/PATCH/DELETE/toggle) | سليم — نمط مرجعي للأخطاء |
| **settings** | إعدادات النظام: نسخ احتياطي، Telegram، أمان (2FA)، بيانات الدعم | `/api/super/backup/*`، `/api/super/telegram-*`، `/api/super/support-settings`، `/api/super/encryption-status`، `/api/auth/2fa/*` | سليم |

### مسارات الخادم (مُركَّبة تحت `/api/super/`)

نقطة مهمة (موثّقة من جلسة سابقة): مسارات `super` مُركَّبة **قبل** `requireTenant`/`tenantGuard`/`emailVerifyGuard`، لذا لا تُحجب بحارس المستأجر. كما أن `writeAuditLog` آمنة عند الفشل (try/catch داخلي) فلا تُسقط الطلب.

| الطريقة | المسار | الغرض |
|---|---|---|
| GET | `/super/companies` | كل الشركات مع عدد المستخدمين والحالة |
| POST | `/super/companies` | إنشاء شركة + أول مستخدم مشرف لها |
| GET | `/super/companies/:id` | تفاصيل شركة واحدة مع مستخدميها |
| PUT | `/super/companies/:id` | تحديث الخطة/الإصدار/تاريخ الانتهاء/الحالة |
| DELETE | `/super/companies/:id` | حذف متسلسل للشركة وبياناتها |
| POST | `/super/companies/:id/reset-admin-password` | توليد كلمة مرور مؤقتة لمشرف الشركة |
| GET | `/super/stats` | إحصائيات لوحة التحكم المجمّعة |
| GET | `/super/revenue` | مقاييس الإيرادات واتجاهات 12 شهراً |
| GET/PUT | `/super/plan-settings[/:key]` | عرض/تحديث خطط الاشتراك |
| GET | `/super/audit-log` | السجلّ الجنائي القابل للبحث |
| GET | `/super/health`، `/super/health/redis` | فحص صحّة عميق + Redis |
| GET | `/super/trial-monitoring` | لوحة أمان تسجيلات التجارب |
| POST | `/super/trial-monitoring/unblock-ip` | فكّ حظر IP من Redis |
| POST/GET | `/super/backup/*` | إنشاء/سرد النسخ الاحتياطية |
| PUT | `/super/telegram-settings` | ضبط فئات تنبيهات Telegram |

---

## المرحلة 2 — القوائم الفارغة "0 من 0" (السبب الجذري + الإصلاح)

### السبب الجذري
استعلام الشركات في `use-company-state.ts` كان:
```ts
const { data: companies = [], isLoading: coLoading } = useQuery(...)
```
لم يكن يكشف `isError` أو `refetch`. ولأن الإحصائيات (`/api/super/stats`) استعلام **منفصل**، كان بإمكانها أن تنجح بينما يفشل استعلام `/api/super/companies` — فتظهر البطاقات بأرقام صحيحة بينما الجدول فارغ "0 من 0"، **دون أي رسالة خطأ**. أي خطأ (انتهاء جلسة، 500، استجابة غير مصفوفة) كان يُبتلع بصمت.

للمقارنة: تبويب **المديرين** كان يطبّق النمط الصحيح أصلاً (`mgError` + `mgRefetch` + واجهة خطأ في `ManagersTable`). اعتمدناه كنمط مرجعي ورفعنا تبويب الشركات إلى نفس المستوى.

### الإصلاحات المطبّقة
1. **كشف حالة الخطأ**: استعلام الشركات يكشف الآن `coError`/`coFetching`/`coRefetch`/`coUpdatedAt`.
2. **حارس الاستجابة غير المصفوفة**: إن لم تكن الاستجابة مصفوفة، يُرمى خطأ صريح يُظهر حالة الخطأ بدل قائمة فارغة مضلّلة.
3. **واجهة حالة الخطأ**: رسالة واضحة + زر "إعادة المحاولة" داخل `companies/index.tsx`.
4. **هيكل تحميل (Skeleton)**: استبدال "جاري التحميل…" بصفوف وميض احترافية.
5. **زر تحديث يدوي + وقت آخر تحديث** في رأس الجدول.
6. **تعطيل الترقيم** أثناء الخطأ (`!coLoading && !coError`).
7. **إصلاح فلتر "مدفوعة"**: كانت بطاقة "مدفوعة" تطبّق `filter: 'active'` (خطأ). الآن `filter: 'paid'`، ومنطق الفلترة يطابق تعريف الخادم تماماً: `plan_type === 'paid' && status === 'active'` (مطابق لـ `routes/super/companies/stats.ts`). أُضيف أيضاً شريحة "مدفوعة" إلى فلاتر الحالة لاتساق سلوك النقر.

---

## المرحلة 3 — الخادم وخطأ `app-settings`

### النتيجة
طلب `GET /api/settings/app-settings` كان يُطلق من `AppSettingsProvider` لكل المستخدمين عند الإقلاع. وبما أن المشرف الأعلى **بلا `company_id`**، كان `getTenant()` في الخادم يرمي خطأً ويعيد 400 (وللزائر غير المصادَق يعيد 401). هذا الطلب لا يكسر الصفحة فعلياً — `fetchServerSettings` يلتقط الخطأ ويعيد `null` ويبقى `localStorage` هو المصدر الموثوق — لكنه ضجيج متكرر وطلب لا طائل منه.

### الإصلاح
أُضيف حارس في `fetchServerSettings`:
```ts
if (!getCurrentCompanyId()) return null;
```
`app-settings` مرتبط بالشركة؛ فعند غياب سياق الشركة (المشرف الأعلى أو زائر غير مصادَق) يُتخطّى الطلب نظيفاً. هذا حلّ على مستوى الواجهة فقط — **لا مساس بمنطق المصادقة أو حارس المستأجر**.

### ملاحظة خارج النطاق
سجلّات التشغيل تُظهر حلقة تكرار `app-settings 401 → auth/refresh 400` عند جلسة منتهية في المتصفّح (مستخدم عادي بـ `company_id` مخزّن لكن انتهت جلسته). هذا سلوك طبقة المصادقة وليس ضمن نطاق صفحة المشرف الأعلى؛ يُوصى بمعالجته بحذر لاحقاً (P1) دون لمس منطق التحديث الآن (يقع ضمن المنطقة المحظورة).

---

## المرحلة 4 — الأداء

| النتيجة | التقييم | الإجراء |
|---|---|---|
| معظم استعلامات التبويبات مُقيَّدة بـ `enabled: activeTab === …` | جيد — لا استطلاع للتبويبات غير النشطة | لا تغيير |
| استعلام `health` يستطلع كل 30s فقط عند تبويب health/overview | جيد | لا تغيير |
| **استعلام `redisHealth` كان يستطلع كل 10s دائماً** (يُستخدم في الترويسة الدائمة، بلا تقييد بالتبويب) | عدواني | **خُفِّض إلى 30s** و `staleTime` من 8s إلى 20s |
| `alerts`/`monitoring` يستطلعان فقط عند تبويبهما | جيد | لا تغيير |

---

## المرحلة 5 — الكود الميت

تم فحص المرشّحين المشتبه بهم (`AnimatedNumber`، `CreateCompanyResultModal`، `ResetPasswordResultModal`، `authHeaders`) بالإضافة إلى مسح شامل لكل ملفات الوحدة:

- **النتيجة: لا يوجد كود ميت مؤكد.** كل المرشّحين قيد الاستخدام فعلاً (`AnimatedNumber` في `StatsCards.tsx`، المودالات في `company-modals.tsx`، `authHeaders` في خطّافات الحالة).
- مسح "الملفات غير المُشار إليها" لم يُرجع أي ملف يتيم داخل `super-admin/`.
- **توصية**: لفحص استنفادي على مستوى المشروع، تشغيل `knip` لاحقاً.

---

## المرحلة 6 — تدقيق الواجهة + المكاسب السريعة

### المكاسب السريعة المطبّقة (ضمن النطاق المسموح: شريط أدوات/جدول/فارغ/تحميل/خطأ)
- حالة خطأ موحّدة + زر إعادة المحاولة في الشركات.
- هيكل تحميل (skeleton) بوميض بدل نص ثابت.
- زر تحديث يدوي + ختم "آخر تحديث".
- شريحة فلتر "مدفوعة" متّسقة مع البطاقة.

### اتجاه إعادة التصميم المقترَح (يتطلب موافقتك قبل التنفيذ)
الوحدة تعتمد حالياً على أنماط مضمّنة (inline styles) كثيفة ورموز تعبيرية (emoji) في كل مكان، ما يجعلها متعبة بصرياً وصعبة الصيانة. الاتجاه المقترَح: **SaaS هادئ** على غرار Linear/Stripe/Vercel مع **الحفاظ على RTL والهوية العربية**:
- استبدال الـ emoji في البطاقات/التبويبات بأيقونات Lucide متّسقة.
- نظام مسافات/حدود/زوايا موحّد (tokens) بدل القيم المضمّنة المتفرّقة.
- تقليل التباين الصارخ والظلال الثقيلة لصالح هرمية بصرية أهدأ.
- جداول بكثافة معلومات أعلى وحالات فارغة/خطأ موحّدة عبر كل التبويبات.

> **لم يُنفَّذ أي إعادة تصميم شاملة** التزاماً بقيد "لا إعادة تصميم كامل دون موافقة".

---

## المرحلة 7 — الميزات الناقصة (مصنّفة بالأولوية)

| الأولوية | الميزة | الملاحظة |
|---|---|---|
| **P0** | توحيد حالات الخطأ/الفارغ عبر **كل** التبويبات (مثل ما طُبِّق على الشركات) | بعض التبويبات تظهر فارغة عند الفشل دون رسالة |
| **P0** | معالجة حلقة `app-settings 401 ↔ auth/refresh` عند انتهاء الجلسة | ضجيج وحِمل غير ضروري (طبقة مصادقة — بحذر) |
| **P1** | ترتيب أعمدة الجدول (sort) في الشركات والمديرين | يوجد بحث/فلترة فقط |
| **P1** | تأكيد موحّد للعمليات الحسّاسة (حذف/إعادة تعيين) بنمط واحد | موجود جزئياً عبر مودالات متفرّقة |
| **P1** | مؤشّر "آخر تحديث" + زر تحديث في بقية التبويبات (كالشركات) | اتساق تجربة |
| **P2** | تصدير CSV لبقية الجداول (المديرين، التدقيق) | موجود للشركات فقط |
| **P2** | ترقيم/تحميل تدريجي لسجلّ التدقيق عند الأحجام الكبيرة | حالياً حدّ ثابت |
| **P2** | لوحة Skeleton موحّدة كمكوّن مشترك | حالياً مكرّر |

---

## المرحلة 8 — الفحوصات

| الفحص | النتيجة |
|---|---|
| `pnpm --filter @workspace/erp-system run typecheck` | ✅ 0 أخطاء |
| `pnpm --filter @workspace/erp-system run lint` | ✅ 0 أخطاء (تحذيران سابقان في `ChecklistTab.tsx` غير متعلّقَين بالتغييرات) |
| `pnpm --filter @workspace/api-server run typecheck` | ✅ 0 أخطاء |
| `pnpm --filter @workspace/api-server run lint` | ✅ 0 أخطاء (5 تحذيرات أمان سابقة في `load-env.ts`/`csrf.ts` غير متعلّقة) |
| HMR | ✅ طُبِّق نظيفاً بلا أخطاء |

---

## ملخّص الملفات المعدّلة

| الملف | التغيير |
|---|---|
| `super-admin/use-company-state.ts` | كشف `coError/coFetching/coRefetch/coUpdatedAt` + حارس استجابة غير مصفوفة؛ فلتر `paid` مطابق للخادم؛ بطاقة "مدفوعة" `active→paid`؛ إضافة شريحة `paid` |
| `super-admin/companies/types.ts` | إضافة `coError/coFetching/coRefetch/coUpdatedAt` إلى `TabCompaniesProps` |
| `super-admin/index.tsx` | تمرير الخصائص الجديدة لـ `TabCompanies` + إطارَا حركة `sa-shimmer`/`sa-spin` |
| `super-admin/companies/index.tsx` | هيكل تحميل + حالة خطأ مع إعادة محاولة + زر تحديث + ختم آخر تحديث + تعطيل الترقيم عند الخطأ |
| `contexts/app-settings.tsx` | حارس `getCurrentCompanyId()` يتخطّى جلب الإعدادات عند غياب سياق الشركة (يعالج 400 للمشرف الأعلى) |
| `super-admin/use-tabs-data.ts` | استطلاع صحّة Redis 10s→30s و `staleTime` 8s→20s |

---

## المرحلة 9 — إصلاح عاجل: 500 → عاصفة إعادة محاولة → 429

### جذر المشكلة

| # | السبب | التفاصيل |
|---|---|---|
| 1 | **`superAdminLimiter` = 30 طلب/دقيقة** | الصفحة تُطلق 6+ استعلامات عند التحميل (companies, stats, managers, health, redis, audit). مع افتراضي React Query 3 محاولات، فشل استعلامَين = 12 طلباً إضافياً يُستنفَد فيها الحدّ خلال ثوانٍ |
| 2 | **React Query يُعيد المحاولة على 429** | لم يكن ثمة فلتر للحالات 401/403/429، فالاستجابة 429 تُولّد محاولات جديدة تُعيد 429 في حلقة مفرغة |
| 3 | **`refetchOnWindowFocus: true` (الافتراضي)** | أي تبديل نافذة يُعيد جلب جميع الاستعلامات القديمة دفعةً واحدة |
| 4 | **`managers` query: `refetchOnMount: 'always'`** | يُجبر إعادة الجلب عند كل تركيب للمكوّن حتى لو البيانات حديثة |
| 5 | **استعلامات DB تسلسلية** في مسارَي companies و stats | كل طلب يحتجز وصلتَي pool بدلاً من واحدة متوازية |
| 6 | **`daysRemaining()` بلا حارس** | تاريخ null/فارغ/غير صالح ينتج NaN (خطر فشل التسلسل في حالات انجراف Schema) |

### التغييرات المنجزة

| الملف | التغيير |
|---|---|
| `artifacts/api-server/src/app.ts` | `superAdminLimiter` limit: 30 → 200 req/min |
| `artifacts/api-server/src/routes/super/companies/helpers.ts` | `daysRemaining()`: حارس null/invalid-date → -9999 |
| `artifacts/api-server/src/routes/super/companies/crud.ts` | استعلامَا DB في `Promise.all()` بدلاً من تسلسلي |
| `artifacts/api-server/src/routes/super/companies/stats.ts` | استعلامَا DB في `Promise.all()` بدلاً من تسلسلي |
| `artifacts/erp-system/src/pages/super-admin/sa-query.ts` | **جديد** — `StatusError` (خطأ مع status HTTP) + `saRetry` (يتخطّى إعادة المحاولة على 401/403/429؛ محاولة واحدة فقط لـ 5xx) |
| `artifacts/erp-system/src/pages/super-admin/use-company-state.ts` | fetcher يرمي `StatusError`؛ companies query: `retry: saRetry, refetchOnWindowFocus: false` |
| `artifacts/erp-system/src/pages/super-admin/use-manager-state.ts` | fetcher يرمي `StatusError`؛ managers query: `retry: saRetry, refetchOnWindowFocus: false`؛ **حذف** `refetchOnMount: 'always'` |
| `artifacts/erp-system/src/pages/super-admin/use-tabs-data.ts` | fetcher يرمي `StatusError`؛ **جميع** الاستعلامات (9): `retry: saRetry, refetchOnWindowFocus: false` |
| `artifacts/erp-system/src/pages/super-admin/index.tsx` | stats query: يرمي `StatusError`، `retry: saRetry, refetchOnWindowFocus: false` |
| `artifacts/api-server/src/__tests__/lib/days-remaining.test.ts` | **جديد** — 7 حالات اختبار لـ `daysRemaining` |

### نتائج الفحوصات

| الفحص | النتيجة |
|---|---|
| `pnpm --filter @workspace/api-server run typecheck` | ✅ 0 أخطاء |
| `pnpm --filter @workspace/erp-system run typecheck` | ✅ 0 أخطاء |
| اختبارات `daysRemaining` (7 حالات) | ✅ نجاح |

---

## المرحلة 9 — الصقل الاحترافي النهائي للواجهة

> **التاريخ:** 15 يونيو 2026.
> **الهدف:** رفع مستوى تصميم وحدة المشرف الأعلى ليكون بمستوى لوحات SaaS الاحترافية (Linear / Stripe / Vercel) — واجهة فقط، لا تغييرات على المصادقة/الأمان/المخطط.

### ما تم إنجازه

#### 1. `sa-primitives.tsx` — ملف جديد بأدوات UI مشتركة

مكوّنات مشتركة أُضيفت لتوحيد حالات التحميل/الخطأ/الفراغ عبر جميع التبويبات:

| المكوّن | الغرض |
|---|---|
| `SASkeleton` | صفوف shimmer متحركة بدلاً من نص "جاري التحميل..." |
| `SAEmptyState` | حالة فارغة مع أيقونة + عنوان |
| `SAErrorState` | حالة خطأ مع أيقونة `AlertCircle` + زر إعادة المحاولة |
| `SASection` | غلاف card موحّد |
| `SATableHeader` | رأس جدول موحّد مع عنوان + إجراءات |
| `StatusChip` | شارة pill ملوّنة للحالات |

#### 2. `layout/sa-nav.tsx` — إعادة تصميم التنقل

- **إزالة كاملة للإيموجي** → أيقونات Lucide (حجم 18px) بألوان مميزة لكل تبويب
- **حالة نشطة أهدأ**: خط برتقالي علوي (2px) + خلفية شفافة بلون التبويب، بدلاً من gradient عائم + scale
- **إزالة نص الوصف** (9px — غير مقروء): بطاقات أكثر إتقاناً وأقل ضجيجاً
- **تحويم بسيط**: تغيير background فقط، بلا transform

#### 3. `layout/sa-header.tsx`

- استبدال `🛡️` بأيقونة `ShieldCheck` من Lucide

#### 4. `overview/OverviewKpiCards.tsx`

- استبدال أيقونات emoji كبيرة (28px) بدوائر أيقونات Lucide صغيرة (38×38px) بخلفية شفافة ملوّنة
- ألوان hex صريحة بدلاً من CSS variables في خلفيات الأيقونات (يمنع `var(--x)18` المكسور)

#### 5. `overview/OverviewHealthCards.tsx`

- استبدال `🌡️` و`📡` في عناوين الأقسام بأيقونات Lucide (`Server`, `BarChart3`) داخل badges صغيرة
- تحسين حالات التحميل (نص نظيف بدلاً من `⏳ جارٍ الفحص...`)
- استبدال `✅ متصلة` / `❌ منقطعة` بنص ملوّن نظيف

#### 6. `managers/ManagersTable.tsx`

- استبدال نص `"جاري التحميل..."` الثابت بـ `<SASkeleton rows={4} rowHeight={52} />`
- استبدال block الخطأ المكرر بـ `<SAErrorState />`
- استبدال block الفراغ بـ `<SAEmptyState icon={<Users />} />`

#### 7. `tab-overview.tsx`

- حذف `🏠` من عنوان "نظرة عامة على النظام"
- حذف `⚡` من "وصول سريع"
- تنظيف labels أزرار الوصول السريع من الإيموجي

#### 8. `tab-managers.tsx`

- استبدال `➕` بأيقونة `<Plus size={14} />` من Lucide

#### 9. `companies/CompanyTableRow.tsx`

- استبدال `▶` بأيقونة `<ChevronRight size={14} />` مع دعم الـ rotation animation
- استبدال `🗑️` بأيقونة `<Trash2 size={13} />`
- تنظيف emoji في `ActionBtn` (✅ / ⛔ / 📋 → نص فقط)
- تنظيف `"🏷️ النسخة:"` → `"النسخة:"`
- تنظيف `"⭐ MuhKam Pro"` / `"🚀 MuhKam Advanced"` في select options والشارة

### نتائج الفحوصات

| الفحص | النتيجة |
|---|---|
| `pnpm --filter @workspace/erp-system run typecheck` | ✅ 0 أخطاء |
| `pnpm --filter @workspace/api-server run typecheck` | ✅ 0 أخطاء |
| `pnpm --filter @workspace/erp-system run lint` | ✅ 0 أخطاء (2 تحذيرات موجودة سابقاً في ChecklistTab.tsx) |
| console browser | ✅ لا أخطاء runtime |
| جميع ميزات SA | ✅ محفوظة كاملاً — لا تغيير على البيانات أو المصادقة |
