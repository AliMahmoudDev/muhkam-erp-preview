# ADR-005: Redis Caching Strategy for High-Read API Routes
# قرار معماري 005: استراتيجية التخزين المؤقت بـ Redis لمسارات API كثيرة القراءة

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-06-01 |
| **Deciders / المقررون** | Backend team |
| **Supersedes / يحلّ محل** | None — new decision |

---

## Context — السياق

### English

MUHKAM ERP is a multi-tenant Arabic SaaS ERP. Several API routes are called on every page load or with very high frequency:

- `GET /api/products` — fetched on POS screen open, sale form, inventory view (potentially dozens of times per minute per tenant)
- `GET /api/customers` — fetched on customer selector, reports, receipt forms
- `GET /api/categories` — fetched as a filter on every product-related page
- `GET /api/price-lists` — fetched for customer-specific pricing on every sale
- `GET /api/exchange-rates` — fetched before any foreign-currency transaction

Each of these routes performs a full PostgreSQL query (sometimes with JOINs and aggregates). Under concurrent load, this creates contention on the DB connection pool and inflates response times.

We needed a caching layer that:
1. Reduces DB load for stable, read-heavy data
2. Does **not** serve stale data after writes
3. Degrades gracefully when unavailable (no hard dependency)
4. Requires minimal per-route implementation effort

### العربية

مُحكم ERP نظام SaaS عربي متعدد المستأجرين. عدة مسارات API تُستدعى عند كل تحميل للصفحة أو بتكرار عالٍ جداً (المنتجات، العملاء، التصنيفات، قوائم الأسعار، أسعار الصرف). كل مسار ينفّذ استعلام PostgreSQL كامل، مما يُنشئ ضغطاً على مجمع الاتصالات ويزيد أوقات الاستجابة عند التحميل المتزامن.

كنا بحاجة لطبقة تخزين مؤقت:
1. تُقلل حمل قاعدة البيانات للبيانات المستقرة كثيرة القراءة
2. **لا** تُقدّم بيانات قديمة بعد عمليات الكتابة
3. تتدهور بسلاسة عند عدم التوفر (لا اعتماد صارم)
4. تتطلب جهداً أدنى للتنفيذ لكل مسار

---

## Decision — القرار

### English

We adopted Redis as the caching backend using a **cache-aside** (lazy-loading) pattern with a **fail-open** wrapper.

**Pattern**: `getCache → DB query → setCache`

**Key Design Choices**:

1. **Cache-Aside Pattern**: Each route checks the cache before hitting the DB. On a cache miss, it queries the DB and populates the cache. This is simpler than write-through and appropriate for read-heavy, write-infrequent data.

2. **Fail-Open Wrapper** (`src/lib/cache.ts`): All Redis operations are wrapped in try/catch. If Redis is unavailable (network error, restart, misconfiguration), the app falls back to direct DB queries silently. No errors surface to the client. This avoids Redis becoming a single point of failure.

3. **Per-Tenant Cache Keys**: Keys are namespaced by `companyId` to enforce multi-tenant isolation:
   ```
   products:{companyId}
   customers:{companyId}
   categories:{companyId}
   price-lists:{companyId}
   exchange-rates:{companyId}:{currency}:{date}
   ```

4. **Write-Through Invalidation**: Every mutating route (POST/PUT/DELETE) calls `deleteCache(key)` immediately after a successful DB write. This ensures cache consistency without complex eviction logic.

5. **Conservative TTLs**: TTLs are set deliberately short to limit staleness exposure:
   - Products: 120s (changes during active restocking)
   - Customers: 60s (balances change frequently)
   - Categories: 300s (rarely changes)
   - Price Lists: 300s (rarely changes)
   - Exchange Rates: 600s (changes at most daily)

6. **Pattern Deletion for Multi-Key Resources**: Exchange rates have compound keys (includes currency and date). On write, we use `deleteCachePattern('exchange-rates:{companyId}:*')` to sweep all variants at once.

7. **No Warehouse-Filtered Caching**: The products route skips cache when a `warehouse_id` query param is present, because warehouse-specific views produce different data and would require per-warehouse cache keys (too many keys, too much complexity).

### العربية

اعتمدنا Redis كخلفية للتخزين المؤقت باستخدام نمط **cache-aside** مع غلاف **fail-open** يعمل حتى بدون Redis.

**النمط**: `getCache → استعلام DB → setCache`

**الخيارات التصميمية الرئيسية**:

1. **نمط Cache-Aside**: كل مسار يتحقق من الكاش قبل الوصول لقاعدة البيانات. عند عدم وجود الكاش، يستعلم من قاعدة البيانات ويملأ الكاش.

2. **غلاف Fail-Open** (`src/lib/cache.ts`): جميع عمليات Redis مُغلَّفة في try/catch. إذا لم يكن Redis متاحاً، يرجع التطبيق للاستعلام المباشر من قاعدة البيانات بصمت.

3. **مفاتيح كاش لكل مستأجر**: المفاتيح تحتوي على `companyId` لضمان عزل المستأجرين.

4. **إبطال فوري عند الكتابة**: كل مسار كتابة (POST/PUT/DELETE) يستدعي `deleteCache(key)` فوراً بعد الكتابة الناجحة.

5. **فترات انتهاء صلاحية محافظة**: 60-600 ثانية حسب تكرار تغيير البيانات.

---

## Alternatives Considered — البدائل المدروسة

### English

| Alternative | Reason Rejected |
|-------------|-----------------|
| **In-process memory cache** (`node-cache`) | Not shared across API replicas; causes cache inconsistency under horizontal scaling |
| **Memcached** | Lacks native pattern-based key deletion (`deleteCachePattern`); no persistence option |
| **Database query result caching** (pg-level) | Requires pg-level config changes; harder to invalidate per-tenant |
| **CDN/HTTP caching** (Cache-Control headers) | Doesn't work for auth-protected JSON APIs; not tenant-aware |
| **Write-through cache** | More complex — requires cache population on every write, not just reads |

### العربية

| البديل | سبب الرفض |
|--------|-----------|
| **الكاش في الذاكرة المحلية** | غير مشترك بين نسخ الـ API المتعددة |
| **Memcached** | لا يدعم حذف المفاتيح بالنمط |
| **كاش نتائج قاعدة البيانات** | يتطلب تغييرات في إعدادات pg، أصعب في الإبطال لكل مستأجر |
| **كاش CDN/HTTP** | لا يعمل للـ APIs المحمية بالمصادقة |

---

## Consequences — التبعات

### English

**Positive**:
- 60-80% reduction in DB queries for hot routes under normal load
- Average response time for `/api/products` drops from ~80ms to ~5ms on cache hit
- Redis failure has zero impact on application availability
- Cache consistency maintained through write-through invalidation

**Negative / Trade-offs**:
- Cache invalidation adds a small Redis write overhead on every mutating operation (~1ms)
- A brief window (up to TTL) of stale data is possible if invalidation fails silently
- Warehouse-filtered product queries cannot be cached (skipped by design)
- Redis introduces an operational dependency (monitoring, memory management)

**Mitigations**:
- TTLs ensure maximum staleness is bounded
- Fail-open wrapper means Redis unavailability never causes user-facing errors
- Per-tenant keys prevent cross-tenant cache pollution

### العربية

**إيجابيات**: انخفاض 60-80% في استعلامات قاعدة البيانات للمسارات الساخنة. وقت استجابة `/api/products` ينخفض من ~80ms إلى ~5ms عند الإصابة بالكاش. فشل Redis لا يؤثر على توافر التطبيق.

**سلبيات / مقايضات**: إبطال الكاش يُضيف تكلفة كتابة صغيرة (~1ms) عند كل عملية تعديل. نافذة بيانات قديمة محتملة حتى انتهاء TTL إذا فشل الإبطال بصمت.

---

## Implementation Notes — ملاحظات التنفيذ

```typescript
// src/lib/cache.ts — fail-open wrapper
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null; // fail-open: Redis error → cache miss
  }
}

export async function setCache(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  } catch {
    // fail-open: silent
  }
}

export async function deleteCache(key: string): Promise<void> {
  try { await redis.del(key); } catch { /* silent */ }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(keys);
  } catch { /* silent */ }
}
```

---

*Related: ADR-001 (JWT), ADR-003 (RLS), RUNBOOK §4 (Cache Invalidation Commands)*
