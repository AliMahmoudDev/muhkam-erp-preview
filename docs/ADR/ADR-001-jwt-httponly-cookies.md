# ADR-001: JWT Authentication via httpOnly Cookies
# قرار معماري 001: مصادقة JWT عبر ملفات تعريف الارتباط httpOnly

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-03-01 |
| **Deciders / المقررون** | Backend team |
| **Supersedes / يحلّ محل** | Bearer token in `Authorization` header (v1.0) |

---

## Context — السياق

### English

MUHKAM ERP is a browser-based Arabic ERP for SMEs. Before v1.1, the API used the standard `Authorization: Bearer <token>` header pattern. Tokens were stored in `localStorage` on the frontend. A security review identified that this approach exposed tokens to Cross-Site Scripting (XSS) attacks: any injected script could read `localStorage` and exfiltrate the JWT, leading to full account compromise.

The alternative — storing the JWT in an httpOnly cookie — makes the token completely inaccessible to JavaScript, eliminating the XSS token-theft vector.

### العربية

مُحكم ERP نظام ERP عربي مبني على المتصفح للشركات الصغيرة والمتوسطة. قبل الإصدار 1.1، كانت API تستخدم نمط `Authorization: Bearer <token>` القياسي، مع تخزين الرمز في `localStorage` على الواجهة الأمامية. كشف مراجعة أمنية أن هذا النهج يعرِّض الرموز لهجمات XSS: أي سكريبت مُحقَن يمكنه قراءة `localStorage` وسرقة JWT، مما يؤدي إلى اختراق الحساب بالكامل.

البديل — تخزين JWT في ملف تعريف ارتباط httpOnly — يجعل الرمز غير قابل للوصول تمامًا من JavaScript، مما يُلغي مخاطر سرقة الرمز عبر XSS.

---

## Decision — القرار

### English

Store the JWT access token in an **httpOnly, Secure, SameSite=Strict** cookie. A separate refresh token is stored in a second httpOnly cookie with a longer TTL. The `Authorization: Bearer` header is accepted as a fallback to preserve backward compatibility with API clients (mobile app, server-to-server calls).

Key implementation points in `src/middleware/auth.ts`:

1. **Cookie extraction first**: `req.cookies.token` is checked before `req.headers.authorization`.
2. **Role is never trusted from the token payload**: The user's current role is fetched fresh from the database on every authenticated request.
3. **Refresh token rotation**: Each use of a refresh token issues a new one and invalidates the old one (stored in `refresh_tokens` table).
4. **Session blacklist**: Logout invalidates the current token by adding its JTI to a Redis-backed blacklist (with in-memory fallback).

### العربية

تخزين رمز الوصول JWT في ملف تعريف ارتباط **httpOnly + Secure + SameSite=Strict**. يُخزَّن رمز التحديث المنفصل في ملف تعريف ارتباط httpOnly ثانٍ بمدة صلاحية أطول. يُقبل رأس `Authorization: Bearer` كبديل للحفاظ على التوافق مع عملاء API (تطبيق الجوال، الاستدعاءات بين الخوادم).

نقاط التنفيذ الرئيسية في `src/middleware/auth.ts`:

1. **استخراج ملف تعريف الارتباط أولاً**: يُفحص `req.cookies.token` قبل `req.headers.authorization`.
2. **عدم الثقة بالدور من الرمز**: دور المستخدم الحالي يُجلب طازجًا من قاعدة البيانات في كل طلب مُصادَق عليه.
3. **تدوير رمز التحديث**: كل استخدام لرمز التحديث يُصدر رمزًا جديدًا ويُبطل القديم (مخزون في جدول `refresh_tokens`).
4. **قائمة إلغاء الجلسات**: تسجيل الخروج يُبطل الرمز الحالي بإضافة JTI الخاص به إلى القائمة السوداء المدعومة بـ Redis.

---

## Consequences — التبعات

### English

**Positive:**
- XSS cannot steal the JWT — cookie is invisible to JavaScript.
- CSRF is mitigated by `SameSite=Strict` and the custom `X-Company-Id` header requirement.
- Token rotation and blacklisting give fine-grained session control.
- Role is always fresh — impossible for a stale JWT role to grant excess privileges.

**Negative / Trade-offs:**
- Cookies require same-origin or explicit CORS + `credentials: true` configuration — cross-origin API clients need extra setup.
- Mobile apps (Expo) cannot use httpOnly cookies natively; they fall back to the `Authorization: Bearer` header with secure storage (`Expo SecureStore`).
- CSRF protection requires careful `SameSite` and origin validation on the server.

### العربية

**إيجابيات:**
- XSS لا يمكنه سرقة JWT — ملف تعريف الارتباط غير مرئي لـ JavaScript.
- CSRF مُخفَّف بـ `SameSite=Strict` ومتطلب رأس `X-Company-Id` المخصص.
- تدوير الرمز والقائمة السوداء يمنحان تحكمًا دقيقًا في الجلسات.
- الدور دائمًا محدَّث — مستحيل أن يمنح دور JWT قديم صلاحيات زائدة.

**سلبيات / مقايضات:**
- ملفات تعريف الارتباط تتطلب نفس الأصل أو إعداد CORS صريحًا مع `credentials: true`.
- تطبيقات الجوال (Expo) لا يمكنها استخدام ملفات تعريف الارتباط httpOnly بشكل أصلي — تستخدم `Authorization: Bearer` مع `Expo SecureStore`.
- حماية CSRF تتطلب التحقق الدقيق من `SameSite` والأصل على الخادم.

---

## Alternatives Considered — البدائل التي تم دراستها

| Alternative | Reason Rejected |
|-------------|----------------|
| `localStorage` + Bearer header | XSS can read `localStorage` — token theft risk |
| `sessionStorage` + Bearer header | Same XSS risk; lost on tab close (poor UX) |
| OAuth2 / external IdP | Significant complexity; Arabic SME market prefers embedded auth |
| Memory-only token (no storage) | Lost on page reload — unusable UX |
