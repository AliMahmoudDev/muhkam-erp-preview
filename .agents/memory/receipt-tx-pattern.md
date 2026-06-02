---
name: Receipt endpoint atomic pattern
description: How to structure POST /customers/:id/receipt for atomicity + tenant isolation
---

**Rule:**  
`POST /customers/:id/receipt` must:  
1. Fetch customer with `company_id` filter OUTSIDE the transaction (so 404 returns cleanly before entering tx).
2. Wrap all three writes inside `db.transaction()`: customerLedger insert (amount negative), transactionsTable insert, customersTable balance update.
3. Both inserts must carry explicit `company_id: getTenant(req)` — the schema default is 1 which is wrong for multi-tenant.

**Why:**  
The original code had no transaction (partial write on crash), missing customerLedger entry (balance inconsistency vs /payment endpoint), and missing company_id on transactionsTable (data assigned to company 1 for all tenants by default).

**How to apply:**  
Any new "receipt" or "payment" style endpoint that touches multiple tables should follow this three-step pattern. The `/payment` endpoint also omits company_id from customerLedger — a latent bug not fixed here to keep scope tight.
