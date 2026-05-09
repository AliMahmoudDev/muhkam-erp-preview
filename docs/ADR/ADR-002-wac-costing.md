# ADR-002: Weighted Average Cost (WAC) for Inventory Valuation
# قرار معماري 002: المتوسط المرجح للتكلفة (WAC) لتقييم المخزون

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-03-01 |
| **Deciders / المقررون** | Accounting team + Backend team |
| **Supersedes / يحلّ محل** | FIFO costing (v1.0) |

---

## Context — السياق

### English

Inventory costing determines what unit cost is used when goods are sold or consumed. The system must assign a cost to each outbound stock movement to calculate gross profit correctly and to value closing inventory on the balance sheet.

In v1.0, FIFO (First-In, First-Out) was implemented. During a review against Saudi accounting standards (aligned with IFRS as adopted in Saudi Arabia by SOCPA), the team identified that:

1. Most SME clients in the target market do not track item-level purchase batches.
2. FIFO requires maintaining a purchase-layer queue per product, per warehouse — complex queries and high storage overhead.
3. WAC is explicitly permitted by IAS 2 (Inventories) and is the dominant method among Saudi SMEs.
4. WAC naturally handles partial receipts and returns without queue manipulation.

### العربية

تكلفة المخزون تحدد تكلفة الوحدة المستخدمة عند بيع البضائع أو استهلاكها. يجب أن يُسنِد النظام تكلفةً لكل حركة مخزون صادرة لحساب إجمالي الربح بشكل صحيح وتقييم المخزون الختامي في الميزانية العمومية.

في الإصدار 1.0، تم تطبيق FIFO (الوارد أولاً يُصرف أولاً). خلال مراجعة مقابل معايير المحاسبة السعودية (المتوافقة مع IFRS كما اعتمدتها هيئة المحاسبيين السعوديين SOCPA)، وجد الفريق أن:

1. معظم عملاء الشركات الصغيرة والمتوسطة في السوق المستهدف لا يتتبعون دفعات الشراء على مستوى المنتج.
2. FIFO يتطلب الحفاظ على قائمة طبقات الشراء لكل منتج ومستودع — استعلامات معقدة وتكلفة تخزين عالية.
3. WAC مسموح به صراحةً بموجب المعيار IAS 2 (المخزون) وهو الأسلوب السائد بين الشركات السعودية الصغيرة والمتوسطة.
4. WAC يتعامل بشكل طبيعي مع الاستلامات الجزئية والمرتجعات دون التلاعب بقوائم الانتظار.

---

## Decision — القرار

### English

Use **Perpetual Weighted Average Cost (WAC)** — the average cost is recalculated on every purchase receipt and updated in the `products.average_cost` column.

**Formula on every inbound movement:**

```
new_average_cost = (current_qty × current_avg_cost + received_qty × purchase_unit_cost)
                   ────────────────────────────────────────────────────────────────────
                                  (current_qty + received_qty)
```

**On outbound movement (sale, consumption, transfer):**

- The current `average_cost` is used as the COGS unit cost.
- No lookup into historical purchase batches is needed.

**Implementation files:**

- `lib/db/src/schema/products.ts` — `average_cost` numeric column.
- `artifacts/api-server/src/routes/purchases.ts` — recalculates WAC on each purchase line save.
- `artifacts/api-server/src/routes/sales.ts` — uses `average_cost` as COGS at time of sale.
- `artifacts/api-server/src/routes/stock-transfers.ts` — carries `average_cost` to destination warehouse.

### العربية

استخدام **المتوسط المرجح للتكلفة الدائم (WAC)** — يُعاد حساب متوسط التكلفة في كل استلام شراء ويُحدَّث في عمود `products.average_cost`.

**الصيغة عند كل حركة واردة:**

```
متوسط_التكلفة_الجديد = (الكمية_الحالية × متوسط_التكلفة_الحالي + الكمية_المستلمة × تكلفة_وحدة_الشراء)
                        ─────────────────────────────────────────────────────────────────────────────
                                              (الكمية_الحالية + الكمية_المستلمة)
```

**عند الحركة الصادرة (بيع، استهلاك، نقل):**

- تُستخدم `average_cost` الحالية كتكلفة وحدة البضاعة المباعة (COGS).
- لا حاجة للبحث في دفعات الشراء التاريخية.

---

## Consequences — التبعات

### English

**Positive:**
- Simple, O(1) cost lookup at point of sale — no batch queue scanning.
- Naturally handles partial receipts, purchase returns, and inter-warehouse transfers.
- IFRS-compliant (IAS 2 permits WAC alongside FIFO).
- Easily auditable — the cost used for every outbound movement is the `average_cost` at that moment, recorded in `stock_movements`.

**Negative / Trade-offs:**
- WAC smooths cost fluctuations — not ideal if clients need to track specific batch costs (e.g., pharmaceutical lot traceability). Addressed by keeping `stock_movements.purchase_unit_cost` for reference.
- Switching back to FIFO would require a data migration to reconstruct purchase-layer queues from historical `stock_movements`.
- Rounding: WAC uses 4 decimal places (`numeric(12,4)`) to avoid accumulated rounding errors on high-volume transactions.

### العربية

**إيجابيات:**
- بحث بسيط O(1) للتكلفة عند نقطة البيع — لا حاجة لمسح قائمة الدفعات.
- يتعامل بشكل طبيعي مع الاستلامات الجزئية ومرتجعات الشراء والنقل بين المستودعات.
- متوافق مع IFRS (IAS 2 يسمح بـ WAC إلى جانب FIFO).
- سهل التدقيق — التكلفة المستخدمة لكل حركة صادرة هي `average_cost` في تلك اللحظة، مسجَّلة في `stock_movements`.

**سلبيات / مقايضات:**
- WAC يُقلِّل من تذبذبات التكلفة — ليس مثاليًا إذا احتاج العملاء لتتبع تكاليف دفعات محددة.
- العودة إلى FIFO تتطلب ترحيل بيانات لإعادة بناء قوائم طبقات الشراء.
- التقريب: WAC يستخدم 4 خانات عشرية (`numeric(12,4)`) لتجنب أخطاء التقريب المتراكمة.

---

## Alternatives Considered — البدائل التي تم دراستها

| Method | Reason Rejected |
|--------|----------------|
| FIFO | Requires purchase-layer queue per product/warehouse — high complexity and query cost |
| LIFO | Prohibited under IFRS (IAS 2 explicitly disallows LIFO) |
| Specific Identification | Only practical for serialized high-value items (not general inventory) |
| Standard Costing | Requires periodic variance analysis — unnecessary complexity for target SME market |
