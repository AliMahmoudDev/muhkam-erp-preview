# CSRF Protection & authFetch Usage Rules

> **هذا المستند يوثّق قواعد حماية CSRF واستخدام authFetch في مشروع مُحكم ERP.**
> يجب على كل مطور مراجعة هذه القواعد قبل إضافة أي طلب HTTP جديد من الواجهة الأمامية.

---

## 1. نظرة عامة على حماية CSRF

المشروع يستخدم نمط **Double-Submit Cookie** لحماية CSRF:

1. الخادم يضبط كوكي `csrf_token` (غير httpOnly — يقرأه JavaScript).
2. الطلبات المُغيّرة للحالة (POST/PUT/PATCH/DELETE) يجب أن تُرسل نفس القيمة في ترويسة `X-CSRF-Token`.
3. المقارنة تتم بأسلوب timing-safe لمنع هجمات التوقيت.

**الملف المسؤول:** `artifacts/api-server/src/middleware/csrf.ts`

---

## 2. متى تستخدم authFetch

استخدم `authFetch` (من `@/lib/auth-fetch`) لأي طلب من الواجهة الأمامية يستوفي الشروط التالية:

- ✅ طلب إلى API داخلي (`/api/*`)
- ✅ يحتاج مصادقة (المستخدم مُسجّل دخوله)
- ✅ يُغيّر الحالة (POST / PUT / PATCH / DELETE)

### أمثلة يجب فيها استخدام authFetch:

| العملية | الملف | الطريقة |
|---------|-------|---------|
| إنشاء/تعديل/حذف شركة | `use-company-state.ts` | POST/PUT/DELETE |
| إنشاء/تعديل/حذف مدير | `use-manager-state.ts` | POST/PATCH/DELETE |
| إعادة تعيين كلمة المرور | `use-company-state.ts` | POST |
| تغيير حالة بطاقة صيانة | `RepairPipeline.tsx` | PATCH |
| تسجيل مرتجع عميل | `RepairReturnModal.tsx` | POST |
| إنشاء ضمان | `WarrantyModal.tsx` | POST |
| إنشاء فاتورة بيع/شراء | `authFetch` via hooks | POST |
| تسجيل حضور/انصراف | `employee-portal/index.tsx` | POST |
| تطبيق جلسة جرد | `inventory/count/index.tsx` | POST |

### ما يفعله authFetch تلقائياً:

```typescript
// auth-fetch.ts يقوم بـ:
// 1. قراءة كوكي csrf_token
// 2. إضافة ترويسة X-CSRF-Token للطلبات المُغيّرة
// 3. إرسال credentials: "include" (كوكيز المصادقة)
```

---

## 3. متى يمكن استخدام fetch() العادي

استخدم `fetch()` العادي **فقط** في الحالات التالية:

| الحالة | السبب | مثال |
|--------|-------|------|
| تسجيل الدخول | المستخدم لا يملك CSRF بعد | `login.tsx` |
| التسجيل | مُستثنى من CSRF بالتصميم | `RegisterForm.tsx` |
| صفحة عامة بدون مصادقة | لا توجد كوكيز مصادقة | `repair-track.tsx` |
| تقرير خطأ تشخيصي | fire-and-forget | `error-boundary.tsx` |

---

## 4. القواعد الملزمة

### ❌ لا تفعل:

- لا تستخدم `fetch()` لطلبات مصادقة تُغيّر الحالة.
- لا تُضف `X-CSRF-Token` يدوياً — `authFetch` يتكفل بذلك.
- لا تستبدل `authFetch` بـ `fetch()` في كود موجود.
- لا تحذف `credentials: "include"` يدوياً — `authFetch` يضبطها تلقائياً.
- لا تُضعف أو تُعطّل rate limiting.

### ✅ افعل:

- استخدم `authFetch` لكل mutation داخلي مصادق.
- حافظ على `Content-Type: application/json` عند إرسال JSON.
- حافظ على نفس بنية الطلب (URL, method, body) عند التحويل.
- اختبر أن CI يجتاز بعد أي تغيير.

---

## 5. سلوك CSRF على الخادم

### المُستثنى من فحص CSRF:

| الحالة | السبب |
|--------|-------|
| GET / HEAD / OPTIONS | طرق آمنة لا تُغيّر الحالة |
| `/api/auth/login*` | المستخدم لا يملك رمز CSRF بعد |
| `/api/auth/register` | حساب جديد |
| `/api/auth/refresh` | يعمل بالكوكيز فقط |
| Bearer-only (بدون كوكيز) | ليس عرضة لـ CSRF |
| `x-client: mobile` | التطبيق لا يستخدم كوكيز |
| طلبات بدون أي مصادقة | تُمرّر لوسيط المصادقة → 401 |

### ترتيب الوسائط:

```
cookieParser → csrfProtection → ... → router → authenticate → routes
```

---

## 6. Rate Limiting

| المحدد | النطاق | الحد |
|--------|--------|------|
| `generalLimiter` | كل `/api` | 100 طلب/دقيقة per IP |
| `authLimiter` | تسجيل الدخول | 10 طلبات/دقيقة per IP |
| `superAdminLimiter` | `/api/super/*` | 30 طلب/دقيقة per IP |
| `perTenantRateLimit` | كل `/api` | 600 قراءة / 120 كتابة per company |

لا تُضعف أو تتجاوز هذه الحدود بدون مراجعة أمنية.

---

## 7. قائمة مراجعة PR (للمراجعين)

عند مراجعة أي PR يحتوي على طلبات HTTP جديدة من الواجهة:

- [ ] هل الطلب الجديد POST/PUT/PATCH/DELETE؟
- [ ] هل هو إلى API داخلي (`/api/*`)؟
- [ ] هل يحتاج مصادقة (المستخدم مسجّل الدخول)؟
- [ ] إذا نعم لكل ما سبق → هل يستخدم `authFetch`؟
- [ ] هل URL / method / body / response handling محفوظة؟
- [ ] هل CI/E2E يجتاز؟
- [ ] هل لم يتم إضافة `credentials: "include"` يدوياً (authFetch يتكفل)؟
- [ ] هل لم يتم إضافة `X-CSRF-Token` يدوياً؟

---

## 8. المراجع

- `artifacts/api-server/src/middleware/csrf.ts` — وسيط CSRF
- `artifacts/erp-system/src/lib/auth-fetch.ts` — مغلّف fetch المُؤمّن
- `artifacts/api-server/src/app.ts` — ترتيب الوسائط
- PR #20 — إضافة حماية CSRF
- PR #21 — إصلاح resetPassword
- PR #26 — إصلاح super-admin fetch
- PR #27 — إصلاح repair fetch
- PR #30 — rate limiting للمشرف العام

---

*آخر تحديث: 2026-05-28 — بعد PR #30*
