# MUHKAM ERP — Database Documentation

PostgreSQL 16 via Drizzle ORM. Schema lives in `lib/db/src/schema/`.

---

## Table of Contents

1. [Multi-Tenant Architecture](#multi-tenant-architecture)
2. [Core Tables](#core-tables)
3. [Sales & POS](#sales--pos-tables)
4. [Purchasing Tables](#purchasing-tables)
5. [Inventory Tables](#inventory-tables)
6. [Financial Tables](#financial-tables)
7. [Human Resources Tables](#human-resources-tables)
8. [Device & Warranty Tables](#device--warranty-tables)
9. [SaaS / Platform Tables](#saas--platform-tables)
10. [Table Relationships](#table-relationships)
11. [Row Level Security (RLS)](#row-level-security-rls)

---

## Multi-Tenant Architecture

Every business-data table has a `company_id` column that references `companies.id`.

```sql
-- Every business table looks like this:
CREATE TABLE sales (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  -- ... other columns
);
```

**Two layers of isolation are enforced:**

1. **Application layer (primary):** Every Drizzle query in the backend includes `.where(eq(table.company_id, companyId))`. This is the primary and most reliable guard.

2. **PostgreSQL RLS (defense-in-depth):** When a request is authenticated, `app.current_company_id` is set as a session variable. RLS policies on each table reference this variable.

```sql
-- Example RLS policy on the `sales` table:
CREATE POLICY tenant_isolation ON sales
  USING (company_id = current_setting('app.current_company_id')::int);
```

**Important:** Because Drizzle uses a connection pool, the RLS session variable may not be set on every query (connection pinning is a future enhancement). The application-layer `company_id` filter is therefore the definitive isolation mechanism.

---

## Core Tables

### `companies`
The root table of the SaaS platform. Each row represents one tenant company.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-incrementing ID |
| `name` | text | Company display name |
| `plan_type` | text | `trial` / `basic` / `basic_mobile` / `advanced` / `paid` |
| `edition` | text | `ultimate` or `advanced` (feature set) |
| `features` | jsonb | Per-company feature toggles (`CompanyFeatures` type) |
| `start_date` | date | Subscription start date |
| `end_date` | date | Subscription expiry date |
| `is_active` | boolean | Manual suspend/activate flag |
| `admin_email` | text | Contact email |
| `created_at` | timestamptz | Registration timestamp |

**`features` JSONB structure:**
```json
{
  "accounting": true,
  "hr": true,
  "pos": true,
  "warranty": true,
  "consignment": true,
  "fixed_assets": true,
  "maintenance": false,
  "budgets": true,
  "bank_reconciliation": true
}
```

### `erp_users`
All users across all companies plus super-admin accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `name` | text | Full name |
| `username` | text | Unique login username |
| `pin` | text | bcrypt-hashed password |
| `role` | text | `super_admin` / `admin` / `manager` / `cashier` / `salesperson` / `accountant` / `viewer` |
| `company_id` | integer FK | `NULL` for super_admin users |
| `active` | boolean | Account enabled flag |
| `warehouse_id` | integer FK | Required for cashier/salesperson |
| `safe_id` | integer FK | Required for cashier/salesperson |
| `employee_id` | integer FK | Links user to HR employee record |
| `permissions` | jsonb | Granular permission overrides |
| `email` | text | Optional email |
| `totp_secret` | text | Encrypted TOTP secret (2FA) |
| `totp_enabled` | boolean | 2FA enabled flag |
| `login_attempts` | integer | Failed login counter (brute-force protection) |
| `locked_until` | timestamptz | Account lockout expiry |
| `last_login` | timestamptz | Last successful login |

---

## Sales & POS Tables

### `sales`
Invoice header record.

| Column | Description |
|--------|-------------|
| `id` | PK |
| `company_id` | Tenant isolation |
| `invoice_number` | Auto-generated human-readable number |
| `customer_id` | FK → `customers` |
| `warehouse_id` | FK → `warehouses` |
| `safe_id` | FK → `safes` (cash register used) |
| `user_id` | FK → `erp_users` (salesperson) |
| `sale_date` | Date of sale |
| `total_amount` | Invoice total |
| `discount_amount` | Invoice-level discount |
| `tax_amount` | Tax applied |
| `payment_method` | `cash` / `card` / `bank_transfer` / `credit` |
| `status` | `completed` / `cancelled` / `draft` |
| `notes` | Free-text notes |

### `sale_items`
Line items for each sale.

| Column | Description |
|--------|-------------|
| `sale_id` | FK → `sales` |
| `product_id` | FK → `products` |
| `quantity` | Units sold |
| `unit_price` | Price at time of sale |
| `discount_amount` | Line-item discount |
| `total_price` | quantity × unit_price − discount |

### `sales_returns` / `sale_return_items`
Mirror of `sales` / `sale_items` for customer returns. Reverses stock movements and customer ledger entries.

### `customers`
Customer records. The `is_supplier` boolean flag means a customer can also act as a supplier in purchases.

| Column | Description |
|--------|-------------|
| `company_id` | Tenant |
| `name` | Customer name |
| `phone` | Contact number |
| `customer_code` | Unique code within company |
| `account_id` | FK → `accounts` (linked ledger account) |
| `is_supplier` | `true` if this customer is also used as a supplier |
| `credit_limit` | Maximum allowed credit balance |

### `customer_classifications`
Customer grouping/tier labels (e.g. "VIP", "Wholesale").

### `customer_ledger`
Double-entry ledger for customer balances (debit/credit movements).

### `suppliers`
Dedicated supplier records. A separate table from `customers`, used when a supplier is not also a customer.

### `sales_targets`
Monthly/periodic sales goals per employee.

---

## Purchasing Tables

### `purchases`
Purchase order header (mirrors `sales` structure).

### `purchase_items`
Line items per purchase order.

### `purchase_returns` / `purchase_return_items`
Returns to supplier — reverses stock and payable balances.

---

## Inventory Tables

### `products`
Product catalog. Each row is a SKU.

| Column | Description |
|--------|-------------|
| `company_id` | Tenant |
| `name` | Product name |
| `sku` | Stock-keeping unit code |
| `barcode` | Barcode / QR code |
| `category_id` | FK → `categories` |
| `cost_price` | Purchase cost |
| `selling_price` | Default selling price |
| `quantity` | Current stock (aggregated) |
| `unit` | Unit of measure |
| `warehouse_id` | Default warehouse |
| `alert_quantity` | Low-stock threshold |

### `stock_movements`
Every stock in/out event is recorded here. Provides a full audit trail of inventory changes.

| Column | Description |
|--------|-------------|
| `product_id` | FK → `products` |
| `warehouse_id` | FK → `warehouses` |
| `movement_type` | `in` / `out` / `transfer_in` / `transfer_out` / `adjustment` / `return` |
| `quantity` | Units moved (positive) |
| `reference_type` | `sale` / `purchase` / `transfer` / `adjustment` |
| `reference_id` | ID of the source document |

### `warehouses`
Physical warehouse locations.

### `stock_transfers` / `stock_transfer_items`
Movement of stock between two warehouses. Header (`stock_transfers`) + line items (`stock_transfer_items`). Creates paired `transfer_out` + `transfer_in` stock movements.

### `stock_count_sessions` / `stock_count_items`
Physical inventory count sessions. When applied, adjusts quantities and creates stock movements.

### `categories`
Product categories (hierarchical).

---

## Financial Tables

### `accounts`
Chart of accounts. Double-entry accounting tree.

| Column | Description |
|--------|-------------|
| `company_id` | Tenant |
| `code` | Account code (e.g., `1001`) |
| `name` | Account name in Arabic |
| `type` | `asset` / `liability` / `equity` / `revenue` / `expense` |
| `parent_id` | FK → `accounts` (tree structure) |
| `is_leaf` | Only leaf accounts can have transactions |
| `balance` | Denormalized current balance |

### `journal_entries` / `journal_entry_lines`
Double-entry bookkeeping. Every financial transaction produces a journal entry where debits = credits.

### `transactions`
Simplified financial transaction record (linked to journal entries).

### `safes`
Cash registers / petty cash boxes. Each has a current balance.

### `safe_transfers`
Money movement between two safes. Can carry a fee (fixed or percentage). See `services/safe-transfer.service.ts` for the business logic.

| Column | Description |
|--------|-------------|
| `from_safe_id` | Source safe |
| `to_safe_id` | Destination safe |
| `amount` | Gross amount transferred |
| `fee_type` | `none` / `fixed` / `percentage` |
| `fee_amount` | Calculated fee |
| `net_amount` | Amount received (amount − fee) |

### `receipt_vouchers`
Money received from customers (reduces customer balance).

### `payment_vouchers`
Money paid to suppliers (reduces supplier payable).

### `deposit_vouchers`
Bank deposits.

### `treasury_vouchers`
Internal treasury movements. Defined in `lib/db/src/schema/returns.ts` alongside the returns tables (historical co-location).

### `fiscal_years`
Accounting periods. Transactions in a closed period are blocked unless the admin uses an override.

### `exchange_rates`
Currency exchange rates per day.

### `budgets` / `budget_lines`
Financial budgets per account.

### `cost_centers`
Cost allocation centers for departmental accounting.

### `fixed_assets`
Company assets subject to depreciation.

### `depreciation_runs`
Recorded depreciation calculations.

### `bank_accounts`
Company bank accounts.

### `bank_statement_lines`
Imported bank statement entries for reconciliation.

### `accruals` / `accrual_runs`
Deferred income/expense accruals.

---

## Human Resources Tables

All HR tables live in `lib/db/src/schema/employees.ts`, `attendance.ts`, `leaves.ts`, `payroll.ts`, `salary-advances.ts`, `incentives.ts`, and `employee-bonuses-custody.ts`.

### Employee Master Tables

| Table | Description |
|-------|-------------|
| `employees` | Full employee profiles (name, code, department, hire date, salary, status) |
| `employee_documents` | Uploaded documents per employee (ID, contracts, certificates) |
| `employee_contacts` | Emergency contacts per employee |
| `employee_status_history` | Log of status changes (active → on_leave → terminated) |
| `departments` | Company departments |
| `job_titles` | Job titles / positions |

### Attendance Tables

| Table | Description |
|-------|-------------|
| `attendance_records` | Daily check-in / check-out entries |
| `attendance_summary` | Monthly aggregated attendance per employee |
| `shift_schedules` | Configured work shifts (day, night, etc.) |
| `employee_shift_assignments` | Maps each employee to a shift |
| `overtime_records` | Approved overtime hours per employee |
| `public_holidays` | Non-working public holiday dates |
| `attendance_deduction_settings` | Thresholds and rules for attendance deductions |
| `attendance_deduction_tiers` | Tiered deduction amounts (e.g. 1 day absent = X% deduction) |

### Leave Tables

| Table | Description |
|-------|-------------|
| `leave_types` | Configurable leave types (annual, sick, unpaid, etc.) |
| `leave_policies` | Accrual rules per leave type (days per year, carry-over, etc.) |
| `employee_leave_balances` | Current leave balance per employee per type |
| `leave_requests` | Employee leave requests |
| `leave_approvals` | Manager approval/rejection records per request |
| `leave_accrual_history` | Log of balance accrual events |
| `leave_blackout_dates` | Dates when leave cannot be taken |

### Payroll Tables

| Table | Description |
|-------|-------------|
| `payroll_periods` | Payroll run periods (month/year) |
| `payroll_records` | One record per employee per payroll period |
| `payroll_line_items` | Breakdown of each pay component (base, allowances, deductions) |
| `payroll_adjustments` | Manual one-off adjustments to a payroll record |
| `salary_structures` | Named salary structure templates |
| `salary_components` | Components within a structure (e.g. "Housing Allowance") |
| `tax_brackets` | Progressive income tax bracket definitions |
| `statutory_contributions` | Social insurance / statutory contribution rates |
| `salary_history` | Audit trail of salary changes per employee |

### Salary Advance Tables

| Table | Description |
|-------|-------------|
| `salary_advances` | Advance requests with amount, purpose, and approval status |
| `salary_advance_deductions` | Monthly installment deductions tied to a payroll period |
| `salary_advance_settings` | Company-level advance rules (max amount, max installments) |
| `salary_advance_history` | Lifecycle log of each advance |
| `salary_advance_ledger` | Running balance ledger for outstanding advances |

### Incentive Tables

| Table | Description |
|-------|-------------|
| `incentive_schemes` | Named incentive plan definitions |
| `incentive_rules` | Conditions that trigger an incentive (e.g. sales over X) |
| `incentive_slabs` | Tiered commission rates within a rule |
| `employee_incentive_assignments` | Maps employees to incentive schemes |
| `daily_incentive_accrual` | Daily calculated incentive amounts per employee |
| `monthly_incentive_summary` | Aggregated monthly totals (fed into payroll) |
| `incentive_metrics` | Metrics snapshot used to evaluate incentive rules |

### Bonus & Custody Tables

| Table | Description |
|-------|-------------|
| `employee_bonuses` | One-off bonus payments |
| `employee_custody` | Custody item records (company-owned assets issued to employees) |
| `employee_custody_lines` | Line items per custody record |
| `employee_deductions` | Non-attendance-based deductions (fines, etc.) |

---

## Device & Warranty Tables

### `repairs`
Repair job orders for customer devices.

### `devices`
Device records (model, serial number, customer).

### `warranty_records`
Warranty claims and tracking.

---

## SaaS / Platform Tables

### `plan_settings`
Editable pricing plans. Seeded with defaults (trial/basic/advanced) and editable from the super-admin UI.

| Column | Description |
|--------|-------------|
| `key` | Plan identifier (`trial`, `basic`, `advanced`, etc.) |
| `name_ar` | Arabic display name |
| `price` | Monthly price in EGP |
| `includes_mobile` | Whether the mobile app is included |
| `is_active` | Whether plan is currently offered |

### `audit_logs`
Forensic trail of all significant actions in the system.

| Column | Description |
|--------|-------------|
| `action` | Event type (e.g., `COMPANY_EXTENDED`, `create`, `delete`) |
| `record_type` | The entity affected (e.g., `company`, `sale`, `employee`) |
| `record_id` | ID of the affected record |
| `old_value` | JSONB snapshot before the change |
| `new_value` | JSONB snapshot after the change |
| `user_id` | Who performed the action |
| `company_id` | `NULL` for super-admin/system events |

### `announcements`
System-wide messages published by super-admin. `company_id = NULL` means all tenants.

### `notifications`
Per-company alert notifications.

### `refresh_tokens`
Stored refresh token records for token rotation and revocation.

### `idempotency_keys`
Used on write endpoints to prevent duplicate submissions.

### `system_settings`
Key-value store for per-company configuration (support contact, branding, etc.).

---

## Table Relationships

```
companies
  └── erp_users (company_id)
  └── warehouses (company_id)
  └── safes (company_id)
  └── departments (company_id)
      └── employees (department_id)
          └── attendance_records
          └── leave_requests
          └── payroll_records
              └── payroll_line_items
          └── salary_advances
              └── salary_advance_deductions
  └── categories (company_id)
  └── products (company_id)
      └── stock_movements
      └── sale_items (product_id)
      └── purchase_items (product_id)
  └── customers (company_id)
      └── customer_ledger
  └── sales (company_id)
      └── sale_items (sale_id)
      └── sales_returns
          └── sale_return_items
  └── purchases (company_id)
      └── purchase_items
      └── purchase_returns
  └── accounts (company_id)
      └── journal_entry_lines (account_id)
  └── journal_entries (company_id)
      └── journal_entry_lines
  └── fiscal_years (company_id)
  └── audit_logs (company_id, nullable)
```

---

## Row Level Security (RLS)

RLS is configured as a defense-in-depth layer. The primary isolation is always the application-layer `company_id` filter.

When a user authenticates, the backend executes:
```sql
SET ROLE erp_app_role;
SELECT set_config('app.current_company_id', '<id>', false);
SELECT set_config('app.is_super_admin', 'false', false);
```

RLS policies on each table evaluate these session variables. Super admins set `app.is_super_admin = 'true'` which bypasses tenant policies.

**Limitation:** Because the Drizzle connection pool may route subsequent queries to different connections, the RLS context is not guaranteed for every query in a request. Application-layer filtering remains the definitive guard.
