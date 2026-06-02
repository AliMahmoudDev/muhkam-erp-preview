---
name: txMock select chain is not thenable
description: Limitation of the db transaction mock in customers-full.test.ts
---

**Rule:**  
In `artifacts/api-server/src/__tests__/routes/customers-full.test.ts`, the `txMock` uses `vi.fn().mockReturnThis()` for all methods. When you do `const [row] = await tx.select().from(t).where(c)` inside a transaction callback, `txMock` is NOT thenable — it returns `txMock` itself, and destructuring with `const [row] =` will throw TypeError (not iterable).

**Why:**  
The outer `db.select()` returns a `makeChain()` object that has a `.then()` method (backed by `mockChainData`). But `txMock` is just a plain Record of vi.fn() mocks — no `.then()`.

**How to apply:**  
When writing code that needs to be tested via this mock:  
- Fetch data for 404 guards OUTSIDE `db.transaction()` using `db.select()` (which uses makeChain and is mockChainData-backed).  
- Inside the tx callback, only do inserts/updates (which use `await tx.insert().values()` without destructuring).
