# المساهمة في مشروع مُحكم ERP

## 1. متطلبات البيئة

قبل البدء، تأكد من تثبيت الأدوات التالية:

- **Node.js 22** — بيئة تشغيل JavaScript للخادم والأدوات
- **pnpm** — مدير الحزم المستخدم في المشروع (لا تستخدم npm أو yarn)
- **PostgreSQL 16** — قاعدة البيانات الرئيسية للمشروع
- **Docker** — اختياري لتشغيل PostgreSQL وRedis في حاويات معزولة

---

## 2. خطوات تشغيل المشروع محلياً

```bash
# 1. استنساخ المستودع
git clone https://github.com/halaltec/muhkam-erp.git
cd muhkam-erp

# 2. تثبيت جميع الحزم
pnpm install

# 3. إعداد متغيرات البيئة
# انسخ الملف النموذجي وعدّله بقيمك الخاصة
cp .env.example .env

# المتغيرات الأساسية المطلوبة:
# DATABASE_URL=postgresql://user:password@localhost:5432/muhkam
# JWT_SECRET=<سرّ قوي وعشوائي>
# JWT_REFRESH_SECRET=<سرّ ثانٍ مختلف تماماً>

# 4. دفع مخطط قاعدة البيانات
pnpm --filter @workspace/db run push

# 5. تشغيل الخادم الخلفي (المنفذ 8080)
cd artifacts/api-server
PORT=8080 pnpm run dev

# 6. في نافذة طرفية جديدة — تشغيل الواجهة الأمامية (المنفذ 5000)
cd artifacts/erp-system
PORT=5000 pnpm run dev
```

بعد اكتمال الخطوات، افتح المتصفح على `http://localhost:5000` للوصول إلى النظام.

---

## 3. هيكل المشروع

```
muhkam-erp/
├── artifacts/
│   ├── api-server/       # الخادم الخلفي (Express 5 + TypeScript)
│   ├── erp-system/       # الواجهة الأمامية الرئيسية (React 19 + Vite)
│   ├── erp-mobile/       # تطبيق الجوال (Expo + React Native)
│   └── mockup-sandbox/   # بيئة تجريبية لمكونات الواجهة
├── lib/
│   ├── db/               # مخطط قاعدة البيانات (Drizzle ORM) وإعدادات الاتصال
│   ├── api-spec/         # مواصفة OpenAPI (openapi.yaml) مصدر الحقيقة للـ API
│   ├── api-zod/          # مخططات Zod مولَّدة تلقائياً من المواصفة
│   └── api-client-react/ # Hooks جاهزة (React Query) مولَّدة تلقائياً
└── scripts/              # سكريبتات البناء والنشر والصيانة
```

### تفاصيل المجلدات الرئيسية

| المجلد | الوصف |
|--------|-------|
| `artifacts/api-server` | يحتوي على جميع مسارات الـ API، الوسائط (middleware)، الخدمات، والمنطق التجاري. نقطة الدخول: `src/index.ts` |
| `artifacts/erp-system` | الواجهة الأمامية العربية بتصميم RTL داكن. الصفحات في `src/pages/`، المكونات في `src/components/` |
| `lib/db` | يعرِّف جميع جداول قاعدة البيانات (~48 جدولاً) باستخدام Drizzle ORM. أي تعديل على المخطط يبدأ هنا |

---

## 4. قواعد الكود

### TypeScript
- وضع `strict: true` مفعَّل في جميع المشاريع — لا يُقبل أي كود لا يجتاز `pnpm run type-check`
- ممنوع استخدام `any` في كود الإنتاج إلا في حالات استثنائية موثَّقة
- جميع دوال الخادم يجب أن تحتوي على تعليق JSDoc بالعربي بالصيغة التالية:

```typescript
/**
 * [وصف عربي للوظيفة]
 * @param {type} paramName - [وصف المعامل]
 * @returns {type} - [وصف ما يُرجعه]
 */
```

### القواعد العامة
- **ممنوع تغيير المنطق التجاري (business logic) دون فتح Issue** يصف السبب والتأثير المتوقع
- جميع نقاط API الجديدة يجب أن تخضع للتحقق من الصلاحيات عبر وسائط `authenticate` و`requireRole`
- كل عملية تكتب في قاعدة البيانات يجب أن تتضمن `company_id` صريحاً لضمان عزل المستأجرين
- استخدم `safeArray<T>()` من `src/lib/safe-data.ts` عند معالجة أي بيانات قادمة من الـ API في الواجهة الأمامية

---

## 5. كيفية إضافة API Route جديدة

اتبع هذا الترتيب الإلزامي:

### الخطوة 1 — تعريف المخطط في `lib/db`
```typescript
// lib/db/src/schema/my-feature.ts
export const myFeatureTable = pgTable("my_feature", {
  id:         serial("id").primaryKey(),
  company_id: integer("company_id").notNull(),
  // ... باقي الحقول
});
```
ثم أضفه إلى `lib/db/src/schema/index.ts` ودفع المخطط:
```bash
pnpm --filter @workspace/db run push
```

### الخطوة 2 — تعريف مخططات Zod في `lib/api-zod`
أضف مخططات الإدخال والإخراج في `lib/api-zod/src/` وصدِّرها من `index.ts`.

### الخطوة 3 — كتابة المسار في `artifacts/api-server`
```typescript
// artifacts/api-server/src/routes/my-feature.ts
import { Router } from "express";
import { authenticate, requireRole, getTenant } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, requireRole("admin", "manager"), async (req, res) => {
  const companyId = getTenant(req);
  // ... منطق الجلب
});

export default router;
```
ثم سجِّله في `artifacts/api-server/src/routes/index.ts`.

### الخطوة 4 — تحديث المواصفة وتوليد الـ Hooks
حدِّث `lib/api-spec/openapi.yaml` بالمسار الجديد، ثم:
```bash
pnpm --filter @workspace/api-client-react run generate
```
يُولِّد هذا Hooks جاهزة للاستخدام في الواجهة الأمامية عبر `lib/api-client-react`.

---

## 6. كيفية تشغيل الاختبارات

### اختبارات الخادم الخلفي
```bash
# تشغيل جميع الاختبارات
pnpm --filter @workspace/api-server test

# تشغيل الاختبارات مع المراقبة المستمرة
pnpm --filter @workspace/api-server test:watch

# تقرير تغطية الكود
pnpm --filter @workspace/api-server test:coverage
```

### اختبارات الواجهة الأمامية
```bash
# تشغيل جميع الاختبارات
pnpm --filter @workspace/erp-system test

# تشغيل الاختبارات مع المراقبة المستمرة
pnpm --filter @workspace/erp-system test:watch
```

### تشغيل جميع الاختبارات دفعةً واحدة
```bash
pnpm run test:all
```

---

## 7. قواعد الـ Git

### تسمية الفروع
استخدم الصيغ التالية بدقة:

```
feature/اسم-الميزة        # لإضافة ميزة جديدة
fix/اسم-المشكلة           # لإصلاح خطأ
refactor/اسم-التحسين      # لإعادة هيكلة الكود دون تغيير السلوك
docs/اسم-التوثيق          # لتحديث التوثيق فقط
```

**أمثلة:**
```
feature/وحدة-الضمانات
fix/خطأ-حساب-الضريبة
refactor/تحسين-استعلامات-المخزون
```

### رسائل الـ Commit
- اكتب رسالة الـ Commit **بالعربي وبوضوح** يصف ماذا تغيَّر ولماذا
- استخدم صيغة: `نوع: وصف موجز`

**أمثلة:**
```
إضافة: وحدة تتبع الضمانات مع إشعارات الانتهاء
إصلاح: خطأ في حساب الرصيد عند التحويل بين الخزائن
تحسين: تقليل عدد استعلامات قاعدة البيانات في لوحة التحكم
توثيق: إضافة JSDoc لوسائط المصادقة
```

### قواعد إضافية
- لا تُدمج أي فرع في `main` دون مراجعة (Pull Request) من شخص آخر
- تأكد من اجتياز `pnpm run typecheck` و`pnpm run lint` قبل فتح أي Pull Request
- لا ترفع ملفات `.env` أو أي بيانات حساسة تحت أي ظرف
