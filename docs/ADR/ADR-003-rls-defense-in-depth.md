# ADR-003: PostgreSQL Row-Level Security (RLS) as Defense-in-Depth
# قرار معماري 003: أمان على مستوى الصفوف في PostgreSQL (RLS) كطبقة دفاع إضافية

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-03-01 |
| **Deciders / المقررون** | Security team + Backend team |
| **Related ADR / ADR ذو صلة** | ADR-001 (JWT auth), ADR-004 (monorepo) |

---

## Context — السياق

### English

MUHKAM ERP is a multi-tenant SaaS system where a single PostgreSQL database hosts data for all tenant companies. The primary tenant isolation mechanism is application-level: every query includes a `WHERE company_id = ?` filter enforced by the `getTenant(req)` middleware helper.

Application-level isolation is effective but has a single point of failure: a bug in any route handler — a missing `WHERE` clause, a wrong parameter binding, or a future regression — could expose one tenant's data to another tenant. In a financial ERP handling payroll, accounting, and customer data, such a breach is catastrophic.

The question was: **what is the cost/benefit of adding a database-level safeguard?**

### العربية

مُحكم ERP نظام SaaS متعدد المستأجرين حيث تستضيف قاعدة بيانات PostgreSQL واحدة بيانات جميع الشركات المستأجرة. آلية العزل الأساسية على مستوى التطبيق: كل استعلام يتضمن فلتر `WHERE company_id = ?` يفرضه مساعد الوسيط `getTenant(req)`.

العزل على مستوى التطبيق فعَّال لكنه يملك نقطة فشل واحدة: أي خطأ في أي معالج مسار — عبارة `WHERE` مفقودة، أو ربط معامل خاطئ، أو تراجع مستقبلي — يمكن أن يكشف بيانات مستأجر لمستأجر آخر. في نظام ERP مالي يتعامل مع الرواتب والمحاسبة وبيانات العملاء، مثل هذا الاختراق كارثي.

السؤال: **ما هي تكلفة وفائدة إضافة ضمانة على مستوى قاعدة البيانات؟**

---

## Decision — القرار

### English

Enable **PostgreSQL Row-Level Security (RLS)** on all tenant tables as a second, independent isolation layer. RLS policies are enforced by the database engine itself — they cannot be bypassed by application code.

**Implementation (`src/lib/rls-init.ts`):**

1. A dedicated PostgreSQL session variable is set at the start of every request:
   ```sql
   SET LOCAL app.current_company_id = '<company_id>';
   ```
2. RLS policies on each tenant table check this variable:
   ```sql
   CREATE POLICY tenant_isolation ON sales_table
     USING (company_id = current_setting('app.current_company_id')::integer);
   ```
3. The application DB user (`muhkam_app`) does **not** have the `BYPASSRLS` privilege.
4. `FORCE ROW LEVEL SECURITY` is applied so that even table owners cannot bypass it.

The session variable is set inside a transaction so that it resets automatically between requests — no risk of variable leakage across pooled connections.

**Coverage:** RLS is enabled on all ~50 tenant tables. System tables (companies, super-admin settings) are exempt.

### العربية

تفعيل **أمان على مستوى الصفوف (RLS) في PostgreSQL** على جميع جداول المستأجرين كطبقة عزل ثانية ومستقلة. تُفرض سياسات RLS بواسطة محرك قاعدة البيانات نفسه — لا يمكن لكود التطبيق تجاوزها.

**التنفيذ (`src/lib/rls-init.ts`):**

1. يُعيَّن متغير جلسة PostgreSQL مخصص في بداية كل طلب:
   ```sql
   SET LOCAL app.current_company_id = '<company_id>';
   ```
2. سياسات RLS على كل جدول مستأجر تفحص هذا المتغير:
   ```sql
   CREATE POLICY tenant_isolation ON sales_table
     USING (company_id = current_setting('app.current_company_id')::integer);
   ```
3. مستخدم قاعدة البيانات للتطبيق (`muhkam_app`) **لا** يملك صلاحية `BYPASSRLS`.
4. يُطبَّق `FORCE ROW LEVEL SECURITY` حتى لا يتجاوزه حتى أصحاب الجداول.

يُعيَّن متغير الجلسة داخل معاملة (transaction) لإعادة تعيينه تلقائيًا بين الطلبات — لا خطر من تسرب المتغير عبر الاتصالات المُجمَّعة (connection pool).

---

## Consequences — التبعات

### English

**Positive:**
- **Defense-in-depth**: A bug that omits a `company_id` WHERE clause in application code will still be blocked at the database level.
- The database itself is the last line of defense — even if the application is fully compromised, RLS contains the blast radius to a single tenant's data.
- Tenant isolation tests (`__tests__/integration/tenant-isolation.test.ts`) verify both layers independently.
- Compliance: many enterprise security frameworks (SOC 2, ISO 27001) consider database-level data segregation a best practice.

**Negative / Trade-offs:**
- **Performance**: RLS adds a predicate evaluation step to every query. Benchmarks showed < 2% overhead for typical queries — acceptable given the security benefit.
- **Session variable management**: The variable must be set before every query. This is handled in `rls-init.ts` but adds complexity to the DB initialization middleware.
- **Connection pool awareness**: `SET LOCAL` is transaction-scoped. All queries that rely on RLS must run inside an explicit transaction or immediately after the SET in the same transaction. Pooled connections must not share session state.
- **Super-admin operations**: The super-admin panel runs queries across all companies. These use a separate DB user with `BYPASSRLS`, scoped to specific system-admin operations only.

### العربية

**إيجابيات:**
- **دفاع متعمق**: أي خطأ يُهمل عبارة `company_id WHERE` في كود التطبيق سيُحجب على مستوى قاعدة البيانات.
- قاعدة البيانات هي خط الدفاع الأخير — حتى لو اختُرق التطبيق بالكامل، يُحصر النطاق ببيانات مستأجر واحد.
- اختبارات عزل المستأجرين تتحقق من كلتا الطبقتين بشكل مستقل.
- الامتثال: معايير أمنية كثيرة (SOC 2، ISO 27001) تعتبر الفصل على مستوى قاعدة البيانات ممارسة أفضل.

**سلبيات / مقايضات:**
- **الأداء**: RLS يضيف خطوة تقييم الشرط لكل استعلام. أظهرت المقاييس أقل من 2% زيادة في التحميل — مقبول مقابل الفائدة الأمنية.
- **إدارة متغير الجلسة**: يجب تعيين المتغير قبل كل استعلام، مما يضيف تعقيدًا لوسيط تهيئة قاعدة البيانات.
- **وعي بـ Connection Pool**: `SET LOCAL` محدودة بنطاق المعاملة. الاتصالات المُجمَّعة لا يجب أن تتشارك حالة الجلسة.

---

## Alternatives Considered — البدائل التي تم دراستها

| Approach | Reason Rejected |
|----------|----------------|
| Application-only `WHERE company_id` | Single point of failure — one bug = data leak |
| Separate database per tenant | Cost-prohibitive for SME SaaS; operational complexity; impractical for ~100+ tenants |
| Schema-per-tenant | Same operational complexity as DB-per-tenant; PostgreSQL RLS achieves isolation at lower cost |
| View-based isolation | Views can be bypassed; requires rewriting all queries against views |
