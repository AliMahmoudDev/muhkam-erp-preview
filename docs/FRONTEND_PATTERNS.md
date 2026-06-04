# Frontend Patterns — MUHKAM ERP (erp-system)

> أنماط الواجهة الأمامية React + Vite. اقرأها قبل إضافة صفحة أو مكوّن جديد.

---

## 1. بنية الصفحة (Page Structure)

- الصفحات في `src/pages/`. الصفحة البسيطة ملف واحد `kebab-case.tsx`؛ الصفحة
  المعقّدة مجلد فيه `index.tsx` + مكوّنات فرعية + `hooks/`.
- **النموذج المرجعي الجيّد:** مجلد `pages/pos/` (مقسّم إلى مكوّنات صغيرة
  واضحة: `PosCart`, `PosPayment`, `PosReceipt`, ...) ومجلد `pages/sales/`.
- **القاعدة:** إذا تجاوز ملف الصفحة ~400 سطر أو حمل أكثر من مسؤولية واحدة
  (قائمة + نموذج + دفع + ledger)، قسّمه إلى:
  - مكوّن عرض القائمة (`XxxList.tsx`).
  - مكوّنات النماذج/المودالات (`XxxFormModal.tsx`).
  - hook للحالة والإجراءات (`hooks/useXxxActions.ts`).

---

## 2. تقسيم المكوّنات والـ hooks

- منطق الحالة (state)، الجلب، والطفرات (mutations) يعيش في **custom hooks**
  وليس داخل JSX.
- المكوّن يعرض؛ الـ hook يحسب ويغيّر الحالة.
- استخرج hook عندما يتجاوز عدد `useState`/`useEffect`/`useQuery`/`useMutation`
  داخل مكوّن واحد ما يمكن قراءته بسهولة (تقريباً > 8).

---

## 3. حالات التحميل والخطأ والفراغ (Loading / Error / Empty)

- تُبنى حالياً داخل كل صفحة. عند إضافة صفحة جديدة التزم بنفس الأسلوب البصري
  (نفس النصوص العربية ونفس مكوّنات الهيكل العظمي `skeletons.tsx` إن وُجدت).
- الفراغ (Empty state): رسالة عربية واضحة + زر إجراء عند الاقتضاء.
- الخطأ: رسالة عربية + زر «إعادة المحاولة» يستدعي `refetch()`.

---

## 4. معيار مفاتيح الاستعلام (Query Keys) ⭐

**المشكلة التاريخية:** المشروع يخلط نمطين — مفاتيح مبنية على المسار
(`['/api/customers']`) ومفاتيح مسمّاة (`['payroll-periods']`,
`['inventory-audit', id]`). هذا يجعل `invalidateQueries` غير موثوق.

**المعيار الجديد:** استخدم المصنع المركزي في `src/lib/queryKeys.ts`:

```ts
import { queryKeys } from '@/lib/queryKeys';

useQuery({ queryKey: queryKeys.customers.list(), queryFn: ... });
useQuery({ queryKey: queryKeys.customers.detail(id), queryFn: ... });

qc.invalidateQueries({ queryKey: queryKeys.customers.all });
```

القواعد:
- **لا تكتب مصفوفات مفاتيح حرفية جديدة.** استخدم المصنع دائماً.
- كل domain له `all` (جذر للإبطال) + دوال `list()`, `detail(id)` حسب الحاجة.
- لا تُحوِّل كل الصفحات القديمة دفعة واحدة؛ التحويل تدريجي وآمن لكل module على
  حدة. المفاتيح القديمة والجديدة تتعايش حتى يكتمل التحويل.

---

## 5. نمط authFetch

- استورد `authFetch` و`api` من `lib/auth-fetch`:
  ```ts
  const res = await authFetch(api('/api/customers'));
  ```
- `authFetch` يضيف رأس CSRF تلقائياً ويُجدّد الجلسة عند 401.
- `fetch` المباشر مسموح **فقط** في الصفحات العامة/ما قبل المصادقة
  (`login.tsx`, `RegisterForm.tsx`, `repair-track.tsx`). انظر
  `docs/CODING_CONVENTIONS.md §8`.

---

## 6. التحقّق من النماذج (Form Validation)

- النماذج الحالية تستخدم تحقّقاً يدوياً في الغالب.
- المكتبات المتاحة في المشروع: `react-hook-form` + `@hookform/resolvers` + `zod`.
- **للنماذج الجديدة:** يُفضّل `react-hook-form` مع `zodResolver` لتوحيد رسائل
  الخطأ العربية ومنطق التحقّق. لا تُعد كتابة النماذج القائمة دون اختبار يغطّي
  سلوكها أولاً.

---

## 7. نمط المودالات (Modals)

- المودال مكوّن `PascalCase.tsx` مستقل (مثل `CustomerFormModal.tsx`).
- يستقبل `open`/`onClose` (أو ما يماثلها) + بيانات الإدخال.
- المودالات الضخمة (> 500 سطر) يجب أن تُقسّم: shell خفيف +
  `XxxForm.tsx` + hook للمنطق (`useXxx.ts`).

---

## 8. قائمة تحقّق قبل دمج صفحة جديدة

- [ ] الصفحة < ~400 سطر أو مقسّمة إلى مكوّنات/hooks.
- [ ] كل الجلب عبر `authFetch` (إلا الصفحات العامة).
- [ ] مفاتيح الاستعلام من `queryKeys.ts` لا حرفية.
- [ ] حالات تحميل/خطأ/فراغ موجودة وبالعربية.
- [ ] `pnpm --filter @workspace/erp-system run typecheck` و`test` و`lint` خضراء.
