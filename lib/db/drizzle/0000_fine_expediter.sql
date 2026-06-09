CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text,
	"category_id" integer,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sale_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"low_stock_threshold" integer,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"customer_code" integer,
	"normalized_name" text,
	"phone" text,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_customer" boolean DEFAULT true NOT NULL,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"account_id" integer,
	"classification_id" integer,
	"price_list_id" integer,
	"price_list_markup" numeric(8, 2),
	"source" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_company_customer_code_unique" UNIQUE("company_id","customer_code")
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 4) DEFAULT '0' NOT NULL,
	"cost_total" numeric(12, 4) DEFAULT '0' NOT NULL,
	"quantity_returned" numeric(12, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"invoice_no" text NOT NULL,
	"customer_name" text,
	"customer_id" integer,
	"payment_type" text NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"posting_status" text DEFAULT 'draft' NOT NULL,
	"safe_id" integer,
	"safe_name" text,
	"warehouse_id" integer,
	"warehouse_name" text,
	"salesperson_id" integer,
	"salesperson_name" text,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"date" text,
	"user_id" integer,
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"quantity_returned" numeric(12, 3) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"invoice_no" text NOT NULL,
	"supplier_name" text,
	"customer_id" integer,
	"customer_name" text,
	"payment_type" text NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remaining_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"posting_status" text DEFAULT 'draft' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"exchange_rate" numeric(12, 6) DEFAULT '1' NOT NULL,
	"shipping_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_consignment" boolean DEFAULT false NOT NULL,
	"consignment_warehouse_id" integer,
	"notes" text,
	"date" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"safe_id" integer,
	"safe_name" text,
	"reference_type" text,
	"reference_id" integer,
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"safe_id" integer,
	"safe_name" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"reference_type" text,
	"reference_id" integer,
	"safe_id" integer,
	"safe_name" text,
	"customer_id" integer,
	"customer_name" text,
	"amount" numeric(12, 2) NOT NULL,
	"direction" text DEFAULT 'none' NOT NULL,
	"description" text,
	"date" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"pin" text NOT NULL,
	"role" text DEFAULT 'cashier' NOT NULL,
	"permissions" text DEFAULT '{}',
	"active" boolean DEFAULT true,
	"company_id" integer,
	"warehouse_id" integer,
	"safe_id" integer,
	"employee_id" integer,
	"login_attempts" integer DEFAULT 0 NOT NULL,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false,
	"totp_verified" boolean DEFAULT false,
	"trusted_device_id" text,
	"repair_commission_pct" integer DEFAULT 0 NOT NULL,
	"repair_specialty" text,
	"repair_notifications" boolean DEFAULT true NOT NULL,
	"dashboard_shortcuts" jsonb DEFAULT '[]'::jsonb,
	"mobile_nav_tabs" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "safe_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_safe_id" integer,
	"from_safe_name" text,
	"to_safe_id" integer,
	"to_safe_name" text,
	"amount" numeric(12, 2) NOT NULL,
	"fee_type" text DEFAULT 'none',
	"fee_rate" numeric(10, 4) DEFAULT '0',
	"fee_amount" numeric(12, 2) DEFAULT '0',
	"net_amount" numeric(12, 2),
	"notes" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0',
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"is_consignment" boolean DEFAULT false NOT NULL,
	"supplier_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"parent_id" integer,
	"level" integer DEFAULT 1 NOT NULL,
	"is_posting" boolean DEFAULT true NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_no" text NOT NULL,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reference" text,
	"total_debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"account_name" text NOT NULL,
	"account_code" text NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"cost_center_id" integer
);
--> statement-breakpoint
CREATE TABLE "purchase_return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"original_purchase_item_id" integer,
	"unit_cost_at_return" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_cost_at_return" numeric(12, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"return_no" text NOT NULL,
	"purchase_id" integer,
	"customer_id" integer,
	"customer_name" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refund_type" text DEFAULT 'balance_credit',
	"safe_id" integer,
	"safe_name" text,
	"date" text,
	"reason" text,
	"notes" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"original_sale_item_id" integer,
	"unit_cost_at_return" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_cost_at_return" numeric(12, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"return_no" text NOT NULL,
	"sale_id" integer,
	"customer_id" integer,
	"customer_name" text,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refund_type" text DEFAULT 'credit',
	"safe_id" integer,
	"safe_name" text,
	"date" text,
	"reason" text,
	"notes" text,
	"user_id" integer,
	"warehouse_id" integer,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_no" text NOT NULL,
	"type" text NOT NULL,
	"safe_id" integer NOT NULL,
	"safe_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"party_name" text,
	"description" text NOT NULL,
	"category" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"voucher_no" text NOT NULL,
	"date" text NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"safe_id" integer NOT NULL,
	"safe_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"posting_status" text DEFAULT 'draft' NOT NULL,
	"source" text,
	"notes" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"voucher_no" text NOT NULL,
	"date" text NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"safe_id" integer NOT NULL,
	"safe_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"posting_status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text,
	"voucher_no" text NOT NULL,
	"date" text NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"safe_id" integer NOT NULL,
	"safe_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"posting_status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"quantity_before" numeric(12, 3) DEFAULT '0' NOT NULL,
	"quantity_after" numeric(12, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(12, 4) DEFAULT '0' NOT NULL,
	"reference_type" text,
	"reference_id" integer,
	"reference_no" text,
	"notes" text,
	"date" text,
	"warehouse_id" integer DEFAULT 1 NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"branch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" integer NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"user_id" integer,
	"username" text,
    "note" text,
	"company_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"reference_id" text,
	"trigger_mode" text DEFAULT 'event' NOT NULL,
	"last_triggered_date" text,
	"role_target" text,
	"user_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" integer,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan_type" text DEFAULT 'trial' NOT NULL,
	"edition" text DEFAULT 'ultimate' NOT NULL,
	"features" jsonb,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"admin_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signup_ip" text,
	"signup_user_agent" text,
	"has_used_trial" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" text,
	"email_verification_expires_at" timestamp with time zone,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"trial_score" integer DEFAULT 100 NOT NULL,
	"is_suspicious" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reference_type" text,
	"reference_id" integer,
	"reference_no" text,
	"description" text,
	"date" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_count_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"system_qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"physical_qty" numeric(12, 3) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_count_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"company_id" integer DEFAULT 1 NOT NULL,
	"created_by" integer,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_cost" numeric(12, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"from_branch_id" integer,
	"to_branch_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_code" text,
	"created_by" integer,
	"approved_by" integer,
	"shipped_by" integer,
	"received_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"contact_type" text DEFAULT 'emergency' NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text,
	"expiry_date" text,
	"verified_by" integer,
	"verified_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"reason" text,
	"changed_by" integer,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"employee_code" text NOT NULL,
	"first_name_en" text NOT NULL,
	"last_name_en" text NOT NULL,
	"first_name_ar" text NOT NULL,
	"last_name_ar" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"personal_phone" text,
	"national_id" text,
	"national_id_image" text,
	"job_title_id" integer,
	"department_id" integer,
	"branch_id" integer,
	"hire_date" text NOT NULL,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"salary_type" text DEFAULT 'fixed' NOT NULL,
	"commission_rate" numeric(5, 2),
	"commission_basis" text,
	"commission_scope_dept_id" integer,
	"bank_account" text,
	"address_en" text,
	"address_ar" text,
	"city" text,
	"country" text DEFAULT 'مصر',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" integer,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "job_titles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_record_id" integer NOT NULL,
	"adjustment_type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"approved_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_record_id" integer NOT NULL,
	"component_name" text NOT NULL,
	"component_type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"processed_by" integer,
	"processed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_period_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"gross_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_allowances" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"advance_deductions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"incentive_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"salary_structure_id" integer NOT NULL,
	"component_type" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"amount" numeric(14, 2),
	"percentage_of_base" numeric(7, 4),
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"is_taxable" boolean DEFAULT false NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"salary_amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"effective_date" text NOT NULL,
	"reason" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"base_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statutory_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"contribution_type" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"employee_percentage" numeric(7, 4) DEFAULT '0' NOT NULL,
	"employer_percentage" numeric(7, 4) DEFAULT '0' NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_brackets" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"fiscal_year" text NOT NULL,
	"min_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"max_salary" numeric(14, 2),
	"tax_rate" numeric(7, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_deduction_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"grace_minutes" integer DEFAULT 10 NOT NULL,
	"weekly_off_days" text DEFAULT '5' NOT NULL,
	"absence_full_day_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"absence_half_day_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"apply_early_leave" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_deduction_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_deduction_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"applies_to" text DEFAULT 'late' NOT NULL,
	"min_minutes" integer NOT NULL,
	"max_minutes" integer,
	"amount" numeric(14, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"attendance_date" text NOT NULL,
	"check_in_time" text,
	"check_out_time" text,
	"status" text DEFAULT 'present' NOT NULL,
	"working_hours" numeric(5, 2),
	"late_minutes" integer DEFAULT 0,
	"early_departure_minutes" integer DEFAULT 0,
	"overtime_hours" numeric(5, 2) DEFAULT '0',
	"notes" text,
	"submitted_by" integer,
	"verified_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"month" text NOT NULL,
	"total_present_days" integer DEFAULT 0 NOT NULL,
	"total_absent_days" integer DEFAULT 0 NOT NULL,
	"total_late_days" integer DEFAULT 0 NOT NULL,
	"total_early_departures" integer DEFAULT 0 NOT NULL,
	"total_overtime_hours" numeric(7, 2) DEFAULT '0' NOT NULL,
	"total_working_hours" numeric(7, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_shift_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"shift_schedule_id" integer NOT NULL,
	"assigned_date" text NOT NULL,
	"end_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overtime_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" text NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"reason" text,
	"approved_by" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"holiday_date" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_duration" integer DEFAULT 60 NOT NULL,
	"grace_minutes" integer DEFAULT 5 NOT NULL,
	"weekly_hours" numeric(5, 2) DEFAULT '40' NOT NULL,
	"working_days" text DEFAULT '0,1,2,3,4' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_leave_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"accrued_days" numeric(7, 2) DEFAULT '0' NOT NULL,
	"used_days" numeric(7, 2) DEFAULT '0' NOT NULL,
	"balance_days" numeric(7, 2) DEFAULT '0' NOT NULL,
	"carryover_days" numeric(7, 2) DEFAULT '0' NOT NULL,
	"as_of_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_accrual_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"accrued_days" numeric(7, 2) NOT NULL,
	"month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"leave_request_id" integer NOT NULL,
	"approver_id" integer NOT NULL,
	"status" text NOT NULL,
	"comment" text,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_blackout_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"reason_en" text,
	"reason_ar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"leave_type_id" integer NOT NULL,
	"entitlement_days_per_year" integer DEFAULT 21 NOT NULL,
	"accrual_method" text DEFAULT 'fixed' NOT NULL,
	"min_duration" numeric(4, 1) DEFAULT '1' NOT NULL,
	"max_consecutive_days" integer DEFAULT 30,
	"probation_days" integer DEFAULT 90,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"total_days" numeric(5, 1) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"code" text NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"carryover_allowed" boolean DEFAULT false NOT NULL,
	"carryover_limit" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_incentive_accrual" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"incentive_rule_id" integer NOT NULL,
	"accrual_date" text NOT NULL,
	"metric_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"target_value" numeric(14, 2) NOT NULL,
	"achievement_percentage" numeric(7, 2) DEFAULT '0' NOT NULL,
	"accrued_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"status" text DEFAULT 'accrued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_incentive_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"incentive_scheme_id" integer NOT NULL,
	"assigned_date" text NOT NULL,
	"end_date" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"incentive_rule_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"metric_date" text NOT NULL,
	"metric_value" numeric(14, 2) NOT NULL,
	"source_document_id" integer,
	"source_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"incentive_scheme_id" integer NOT NULL,
	"metric_type" text NOT NULL,
	"target_value" numeric(14, 2) NOT NULL,
	"incentive_amount" numeric(14, 2),
	"incentive_type" text DEFAULT 'fixed' NOT NULL,
	"calculation_method" text DEFAULT 'achievement' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_schemes" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_slabs" (
	"id" serial PRIMARY KEY NOT NULL,
	"incentive_rule_id" integer NOT NULL,
	"slab_number" integer NOT NULL,
	"from_percentage" numeric(7, 2) NOT NULL,
	"to_percentage" numeric(7, 2),
	"incentive_value" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_incentive_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"month" text NOT NULL,
	"total_accrued" numeric(14, 2) DEFAULT '0' NOT NULL,
	"included_in_payroll_record_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_advance_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"salary_advance_id" integer NOT NULL,
	"payroll_record_id" integer,
	"deduction_amount" numeric(14, 2) NOT NULL,
	"deduction_date" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_advance_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"salary_advance_id" integer NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"changed_by" integer,
	"comment" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_advance_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"advance_id" integer NOT NULL,
	"ledger_type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"ledger_date" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_advance_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"max_advance_percentage" numeric(5, 2) DEFAULT '50' NOT NULL,
	"max_concurrent_advances" integer DEFAULT 2 NOT NULL,
	"min_salary_for_advance" numeric(14, 2) DEFAULT '3000' NOT NULL,
	"repayment_tenure_months" integer DEFAULT 1 NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"employee_id" integer NOT NULL,
	"requested_date" text NOT NULL,
	"requested_amount" numeric(14, 2) NOT NULL,
	"approved_amount" numeric(14, 2),
	"advance_type" text DEFAULT 'personal' NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approver_id" integer,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"remaining_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"deduct_from" text DEFAULT 'fixed' NOT NULL,
	"safe_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_bonuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text,
	"granted_date" text NOT NULL,
	"granted_by" integer,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_custody_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"custody_id" integer NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"description" text,
	"line_date" text NOT NULL,
	"expense_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_custody" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"safe_id" integer,
	"amount" numeric(14, 2) NOT NULL,
	"returned_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"purpose" text,
	"granted_date" text NOT NULL,
	"settled_date" text,
	"status" text DEFAULT 'open' NOT NULL,
	"granted_by" integer,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"notes" text,
	"reimbursement_due" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"deduction_type" text DEFAULT 'other' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text,
	"deduction_date" text NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"created_by" integer,
	"attendance_record_id" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" integer NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"year_label" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"sale_id" integer,
	"product_id" integer,
	"product_name" text NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"customer_phone" text,
	"serial_number" text,
	"device_model" text,
	"warranty_months" integer DEFAULT 3 NOT NULL,
	"warranty_start" date NOT NULL,
	"warranty_end" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"target" text DEFAULT 'all' NOT NULL,
	"company_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text DEFAULT 'super_admin' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"rate" numeric(12, 6) NOT NULL,
	"date" text NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "depreciation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"period" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"entry_id" integer,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'equipment' NOT NULL,
	"purchase_date" text NOT NULL,
	"purchase_cost" numeric(14, 2) NOT NULL,
	"residual_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"useful_life_months" integer NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"asset_account_id" integer,
	"acc_dep_account_id" integer,
	"dep_expense_account_id" integer,
	"accumulated_depreciation" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"disposal_date" text,
	"disposal_proceeds" numeric(14, 2),
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accrual_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"accrual_id" integer NOT NULL,
	"period" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"entry_id" integer,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accruals" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"months_total" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"expense_account_id" integer,
	"prepaid_account_id" integer,
	"amount_recognized" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_number" text,
	"bank_name" text NOT NULL,
	"currency" text DEFAULT 'EGP' NOT NULL,
	"safe_id" integer,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_account_id" integer NOT NULL,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" text NOT NULL,
	"reference" text,
	"matched_entry_id" integer,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" text NOT NULL,
	"period" text NOT NULL,
	"budgeted_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"company_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"date_from" text NOT NULL,
	"date_to" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer DEFAULT 1 NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"reference_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"description" text,
	"price" integer DEFAULT 0 NOT NULL,
	"includes_mobile" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sales_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"year_month" text NOT NULL,
	"target_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_targets_user_month_uq" UNIQUE("user_id","year_month","company_id")
);
--> statement-breakpoint
CREATE TABLE "bad_debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason" text,
	"account_id" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"source_invoice_id" integer,
	"source_repair_job_id" integer,
	"notes" text,
	"written_off_at" date,
	"created_by" integer,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"label_ar" text NOT NULL,
	"category" text DEFAULT 'عام',
	"device_type" text DEFAULT 'general',
	"sort_order" integer DEFAULT 0,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_dashboard_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"statuses" text NOT NULL,
	"color" text DEFAULT '#8b5cf6' NOT NULL,
	"icon" text DEFAULT 'Wrench' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"alert_threshold" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_device_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"model" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_device_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"repair_job_id" integer NOT NULL,
	"photo_url" text NOT NULL,
	"photo_type" text DEFAULT 'intake' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" integer
);
--> statement-breakpoint
CREATE TABLE "repair_job_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"source" text DEFAULT 'internal',
	"warehouse_id" integer,
	"is_returned" boolean DEFAULT false,
	"return_destination" text,
	"returned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"job_no" text NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"device_brand" text NOT NULL,
	"device_model" text NOT NULL,
	"device_type" text DEFAULT 'general' NOT NULL,
	"imei" text,
	"serial_no" text,
	"color" text,
	"storage" text,
	"problem_description" text,
	"technician_id" integer,
	"technician_name" text,
	"technician_2_id" integer,
	"technician_2_name" text,
	"technician_2_section" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"checklist" text,
	"qa_checklist" text,
	"qa_completed_at" timestamp,
	"qa_notes" text,
	"device_score" integer,
	"estimated_cost" numeric(12, 2) DEFAULT '0',
	"final_cost" numeric(12, 2) DEFAULT '0',
	"deposit_paid" numeric(12, 2) DEFAULT '0',
	"external_workshop" boolean DEFAULT false,
	"external_workshop_name" text,
	"external_workshop_cost" numeric(12, 2) DEFAULT '0',
	"broker_name" text,
	"broker_commission" numeric(12, 2) DEFAULT '0',
	"alert_days_threshold" integer,
	"locked" boolean DEFAULT false,
	"received_at" date NOT NULL,
	"estimated_delivery" date,
	"delivered_at" date,
	"device_pin" text,
	"accessories" text,
	"branch_id" integer,
	"notes" text,
	"pre_delivery_reviewed_at" timestamp,
	"shipping_cost" numeric(12, 2) DEFAULT '0',
	"shipping_expense_id" integer,
	"shipping_settled_at" timestamp,
	"final_discount" numeric(12, 2) DEFAULT '0',
	"delivery_receipt_sent_at" timestamp,
	"delivery_receipt_method" text,
	"job_type" text DEFAULT 'repair' NOT NULL,
	"warranty_of" integer,
	"is_customer_returned" boolean DEFAULT false,
	"customer_return_amount" numeric(12, 2) DEFAULT '0',
	"responsible_technician_id" integer,
	"qa_report" text,
	"qa_inspector_name" text,
	"delivery_payment_type" text,
	"delivery_safe_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"notes" text,
	"received_by" integer,
	"received_by_name" text,
	"safe_id" integer,
	"safe_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_pipeline_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"status_key" text NOT NULL,
	"label_ar" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"sort_order" integer NOT NULL,
	"requirements" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "repair_receipt_technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"repair_job_id" integer NOT NULL,
	"technician_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"status_from" text,
	"status_to" text,
	"technician_id" integer,
	"technician_name" text,
	"user_id" integer,
	"user_name" text,
	"event_type" text DEFAULT 'status_change',
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"key" text NOT NULL,
	"label_ar" text NOT NULL,
	"color" text DEFAULT '#64748b',
	"sort_order" integer DEFAULT 0,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrap_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer,
	"product_name" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0',
	"warehouse_id" integer,
	"reason" text,
	"source_type" text,
	"source_id" integer,
	"created_by" integer,
	"created_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_accessories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"key" text NOT NULL,
	"label_ar" text NOT NULL,
	"emoji" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"branch_id" integer,
	"device_no" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"color" text,
	"storage" text,
	"imei" text,
	"serial_no" text,
	"battery_health" integer,
	"grade" text DEFAULT 'B',
	"condition_notes" text,
	"purchase_price" numeric(12, 2) DEFAULT '0',
	"sale_price" numeric(12, 2) DEFAULT '0',
	"status" text DEFAULT 'available' NOT NULL,
	"dual_sim" boolean DEFAULT false,
	"with_box" boolean DEFAULT false,
	"icloud_locked" boolean DEFAULT false,
	"network_locked" boolean DEFAULT false,
	"previously_opened" boolean DEFAULT false,
	"mdm_locked" boolean DEFAULT false,
	"supplier_name" text,
	"purchase_invoice_no" text,
	"inspector_name" text,
	"sold_to_customer_id" integer,
	"sold_to_customer_name" text,
	"sold_at" timestamp,
	"sold_by_user_id" integer,
	"sold_by_user_name" text,
	"sold_price" numeric(12, 2),
	"warranty_months" integer,
	"payment_method" text,
	"payment_status" text,
	"added_by_user_id" integer,
	"added_by_user_name" text,
	"supplier_phone" text,
	"id_card_data" text,
	"product_id" integer,
	"purchase_id" integer,
	"purchase_invoice_ref" text,
	"inspection_data" text,
	"inspector_employee_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trial_abuse_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"user_agent" text,
	"fingerprint" text,
	"fingerprint_data" text,
	"device_score" integer DEFAULT 0,
	"registration_count" integer DEFAULT 0,
	"company_id" integer,
	"flagged" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"overridden_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"price_list_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"markup_percent" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_classifications" ADD CONSTRAINT "customer_classifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_classification_id_customer_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."customer_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp_users" ADD CONSTRAINT "erp_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_transfers" ADD CONSTRAINT "safe_transfers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safes" ADD CONSTRAINT "safes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_return_id_purchase_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_return_id_sales_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."sales_returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_vouchers" ADD CONSTRAINT "treasury_vouchers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_vouchers" ADD CONSTRAINT "deposit_vouchers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_ledger" ADD CONSTRAINT "customer_ledger_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_sessions" ADD CONSTRAINT "stock_count_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_branch_id_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_branch_id_branches_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_contacts" ADD CONSTRAINT "employee_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_title_id_job_titles_id_fk" FOREIGN KEY ("job_title_id") REFERENCES "public"."job_titles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_commission_scope_dept_id_departments_id_fk" FOREIGN KEY ("commission_scope_dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_payroll_record_id_payroll_records_id_fk" FOREIGN KEY ("payroll_record_id") REFERENCES "public"."payroll_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_payroll_record_id_payroll_records_id_fk" FOREIGN KEY ("payroll_record_id") REFERENCES "public"."payroll_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_payroll_period_id_payroll_periods_id_fk" FOREIGN KEY ("payroll_period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_salary_structure_id_salary_structures_id_fk" FOREIGN KEY ("salary_structure_id") REFERENCES "public"."salary_structures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_contributions" ADD CONSTRAINT "statutory_contributions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_deduction_settings" ADD CONSTRAINT "attendance_deduction_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_deduction_tiers" ADD CONSTRAINT "attendance_deduction_tiers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_summary" ADD CONSTRAINT "attendance_summary_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_shift_schedule_id_shift_schedules_id_fk" FOREIGN KEY ("shift_schedule_id") REFERENCES "public"."shift_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD CONSTRAINT "employee_leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_accrual_history" ADD CONSTRAINT "leave_accrual_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_accrual_history" ADD CONSTRAINT "leave_accrual_history_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_blackout_dates" ADD CONSTRAINT "leave_blackout_dates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_incentive_accrual" ADD CONSTRAINT "daily_incentive_accrual_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_incentive_accrual" ADD CONSTRAINT "daily_incentive_accrual_incentive_rule_id_incentive_rules_id_fk" FOREIGN KEY ("incentive_rule_id") REFERENCES "public"."incentive_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_incentive_assignments" ADD CONSTRAINT "employee_incentive_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_incentive_assignments" ADD CONSTRAINT "employee_incentive_assignments_incentive_scheme_id_incentive_schemes_id_fk" FOREIGN KEY ("incentive_scheme_id") REFERENCES "public"."incentive_schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_metrics" ADD CONSTRAINT "incentive_metrics_incentive_rule_id_incentive_rules_id_fk" FOREIGN KEY ("incentive_rule_id") REFERENCES "public"."incentive_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_metrics" ADD CONSTRAINT "incentive_metrics_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_rules" ADD CONSTRAINT "incentive_rules_incentive_scheme_id_incentive_schemes_id_fk" FOREIGN KEY ("incentive_scheme_id") REFERENCES "public"."incentive_schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_schemes" ADD CONSTRAINT "incentive_schemes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_slabs" ADD CONSTRAINT "incentive_slabs_incentive_rule_id_incentive_rules_id_fk" FOREIGN KEY ("incentive_rule_id") REFERENCES "public"."incentive_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_incentive_summary" ADD CONSTRAINT "monthly_incentive_summary_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_deductions" ADD CONSTRAINT "salary_advance_deductions_salary_advance_id_salary_advances_id_fk" FOREIGN KEY ("salary_advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_history" ADD CONSTRAINT "salary_advance_history_salary_advance_id_salary_advances_id_fk" FOREIGN KEY ("salary_advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_ledger" ADD CONSTRAINT "salary_advance_ledger_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_ledger" ADD CONSTRAINT "salary_advance_ledger_advance_id_salary_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advance_settings" ADD CONSTRAINT "salary_advance_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_custody_lines" ADD CONSTRAINT "employee_custody_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_custody_lines" ADD CONSTRAINT "employee_custody_lines_custody_id_employee_custody_id_fk" FOREIGN KEY ("custody_id") REFERENCES "public"."employee_custody"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_custody" ADD CONSTRAINT "employee_custody_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_custody" ADD CONSTRAINT "employee_custody_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_erp_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."erp_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_asset_id_fixed_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_asset_account_id_accounts_id_fk" FOREIGN KEY ("asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_acc_dep_account_id_accounts_id_fk" FOREIGN KEY ("acc_dep_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_dep_expense_account_id_accounts_id_fk" FOREIGN KEY ("dep_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual_runs" ADD CONSTRAINT "accrual_runs_accrual_id_accruals_id_fk" FOREIGN KEY ("accrual_id") REFERENCES "public"."accruals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual_runs" ADD CONSTRAINT "accrual_runs_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accrual_runs" ADD CONSTRAINT "accrual_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accruals" ADD CONSTRAINT "accruals_expense_account_id_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accruals" ADD CONSTRAINT "accruals_prepaid_account_id_accounts_id_fk" FOREIGN KEY ("prepaid_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accruals" ADD CONSTRAINT "accruals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_safe_id_safes_id_fk" FOREIGN KEY ("safe_id") REFERENCES "public"."safes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_entry_id_journal_entries_id_fk" FOREIGN KEY ("matched_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_device_photos" ADD CONSTRAINT "repair_device_photos_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_payments" ADD CONSTRAINT "repair_payments_job_id_repair_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_receipt_technicians" ADD CONSTRAINT "repair_receipt_technicians_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_accessories" ADD CONSTRAINT "repair_accessories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_company_id_idx" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "products_company_sku_idx" ON "products" USING btree ("company_id","sku");--> statement-breakpoint
CREATE INDEX "products_company_name_idx" ON "products" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_company_category_idx" ON "products" USING btree ("company_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_company_idx" ON "categories" USING btree ("name","company_id");--> statement-breakpoint
CREATE INDEX "customer_classifications_company_id_idx" ON "customer_classifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "customers_company_id_idx" ON "customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "customers_company_phone_idx" ON "customers" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "customers_company_name_idx" ON "customers" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "customers_classification_id_idx" ON "customers" USING btree ("classification_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_id_idx" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_user_id_idx" ON "sales" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sales_customer_id_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_safe_id_idx" ON "sales" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "sales_warehouse_id_idx" ON "sales" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sales_company_date_idx" ON "sales" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "sales_company_status_idx" ON "sales" USING btree ("company_id","posting_status");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_id_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchases_customer_id_idx" ON "purchases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "purchases_status_idx" ON "purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchases_created_at_idx" ON "purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "purchases_date_idx" ON "purchases" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_request_id_uidx" ON "purchases" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "purchases_company_date_idx" ON "purchases" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "purchases_company_status_idx" ON "purchases" USING btree ("company_id","posting_status");--> statement-breakpoint
CREATE INDEX "expense_categories_company_idx" ON "expense_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "expenses_safe_id_idx" ON "expenses" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "expenses_company_created_at_idx" ON "expenses" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "income_safe_id_idx" ON "income" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "income_source_idx" ON "income" USING btree ("source");--> statement-breakpoint
CREATE INDEX "income_created_at_idx" ON "income" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "income_company_id_idx" ON "income" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "income_company_created_at_idx" ON "income" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_safe_id_idx" ON "transactions" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "transactions_customer_id_idx" ON "transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "transactions_reference_type_idx" ON "transactions" USING btree ("reference_type");--> statement-breakpoint
CREATE INDEX "transactions_direction_idx" ON "transactions" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_company_date_idx" ON "transactions" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "transactions_company_type_idx" ON "transactions" USING btree ("company_id","type");--> statement-breakpoint
CREATE INDEX "safe_transfers_from_safe_id_idx" ON "safe_transfers" USING btree ("from_safe_id");--> statement-breakpoint
CREATE INDEX "safe_transfers_to_safe_id_idx" ON "safe_transfers" USING btree ("to_safe_id");--> statement-breakpoint
CREATE INDEX "safe_transfers_created_at_idx" ON "safe_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accounts_company_id_idx" ON "accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "accounts_parent_id_idx" ON "accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "accounts_is_active_idx" ON "accounts" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_code_company_uidx" ON "accounts" USING btree ("code","company_id");--> statement-breakpoint
CREATE INDEX "journal_entries_company_id_idx" ON "journal_entries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "journal_entries_company_date_idx" ON "journal_entries" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "journal_entries_date_idx" ON "journal_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "journal_entries_status_idx" ON "journal_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "journal_entries_created_at_idx" ON "journal_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_entry_id_idx" ON "journal_entry_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_account_id_idx" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_cost_center_idx" ON "journal_entry_lines" USING btree ("cost_center_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_return_id_idx" ON "purchase_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_product_id_idx" ON "purchase_return_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_purchase_id_idx" ON "purchase_returns" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_customer_id_idx" ON "purchase_returns" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_created_at_idx" ON "purchase_returns" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_returns_request_id_uidx" ON "purchase_returns" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_return_id_idx" ON "sale_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "sale_return_items_product_id_idx" ON "sale_return_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_returns_customer_id_idx" ON "sales_returns" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_returns_sale_id_idx" ON "sales_returns" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_returns_warehouse_id_idx" ON "sales_returns" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "sales_returns_created_at_idx" ON "sales_returns" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_returns_request_id_uidx" ON "sales_returns" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "treasury_vouchers_safe_id_idx" ON "treasury_vouchers" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "treasury_vouchers_type_idx" ON "treasury_vouchers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "treasury_vouchers_created_at_idx" ON "treasury_vouchers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deposit_vouchers_customer_id_idx" ON "deposit_vouchers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "deposit_vouchers_safe_id_idx" ON "deposit_vouchers" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "deposit_vouchers_date_idx" ON "deposit_vouchers" USING btree ("date");--> statement-breakpoint
CREATE INDEX "deposit_vouchers_created_at_idx" ON "deposit_vouchers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_vouchers_request_id_uidx" ON "deposit_vouchers" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "payment_vouchers_customer_id_idx" ON "payment_vouchers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_vouchers_safe_id_idx" ON "payment_vouchers" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "payment_vouchers_date_idx" ON "payment_vouchers" USING btree ("date");--> statement-breakpoint
CREATE INDEX "payment_vouchers_created_at_idx" ON "payment_vouchers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_vouchers_request_id_uidx" ON "payment_vouchers" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "receipt_vouchers_customer_id_idx" ON "receipt_vouchers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "receipt_vouchers_safe_id_idx" ON "receipt_vouchers" USING btree ("safe_id");--> statement-breakpoint
CREATE INDEX "receipt_vouchers_date_idx" ON "receipt_vouchers" USING btree ("date");--> statement-breakpoint
CREATE INDEX "receipt_vouchers_created_at_idx" ON "receipt_vouchers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_vouchers_request_id_uidx" ON "receipt_vouchers" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_movement_type_idx" ON "stock_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_type_idx" ON "stock_movements" USING btree ("reference_type");--> statement-breakpoint
CREATE INDEX "stock_movements_date_idx" ON "stock_movements" USING btree ("date");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_product_warehouse_idx" ON "stock_movements" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movements_warehouse_id_idx" ON "stock_movements" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movements_company_id_idx" ON "stock_movements" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_company_uidx" ON "system_settings" USING btree ("key","company_id");--> statement-breakpoint
CREATE INDEX "alerts_type_ref_idx" ON "alerts" USING btree ("type","reference_id");--> statement-breakpoint
CREATE INDEX "alerts_is_read_idx" ON "alerts" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "alerts_is_resolved_idx" ON "alerts" USING btree ("is_resolved");--> statement-breakpoint
CREATE INDEX "alerts_role_target_idx" ON "alerts" USING btree ("role_target");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "customer_ledger_customer_id_idx" ON "customer_ledger" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_ledger_type_idx" ON "customer_ledger" USING btree ("type");--> statement-breakpoint
CREATE INDEX "customer_ledger_date_idx" ON "customer_ledger" USING btree ("date");--> statement-breakpoint
CREATE INDEX "customer_ledger_reference_idx" ON "customer_ledger" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "st_company_status_idx" ON "stock_transfers" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "st_company_from_branch_idx" ON "stock_transfers" USING btree ("company_id","from_branch_id");--> statement-breakpoint
CREATE INDEX "st_company_to_branch_idx" ON "stock_transfers" USING btree ("company_id","to_branch_id");--> statement-breakpoint
CREATE INDEX "st_created_at_idx" ON "stock_transfers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "branches_company_id_idx" ON "branches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_contacts_employee_idx" ON "employee_contacts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_docs_employee_idx" ON "employee_documents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_status_hist_employee_idx" ON "employee_status_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employees_company_idx" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "employees_code_company_idx" ON "employees" USING btree ("company_id","employee_code");--> statement-breakpoint
CREATE INDEX "employees_dept_idx" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("company_id","employment_status");--> statement-breakpoint
CREATE INDEX "job_titles_company_idx" ON "job_titles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_record_idx" ON "payroll_adjustments" USING btree ("payroll_record_id");--> statement-breakpoint
CREATE INDEX "payroll_line_items_record_idx" ON "payroll_line_items" USING btree ("payroll_record_id");--> statement-breakpoint
CREATE INDEX "payroll_periods_company_idx" ON "payroll_periods" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "payroll_records_period_idx" ON "payroll_records" USING btree ("payroll_period_id");--> statement-breakpoint
CREATE INDEX "payroll_records_employee_idx" ON "payroll_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "payroll_records_status_idx" ON "payroll_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sal_comp_struct_idx" ON "salary_components" USING btree ("salary_structure_id");--> statement-breakpoint
CREATE INDEX "salary_history_employee_idx" ON "salary_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "sal_struct_company_idx" ON "salary_structures" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "statutory_contrib_company_idx" ON "statutory_contributions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tax_brackets_company_year_idx" ON "tax_brackets" USING btree ("company_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "att_ded_settings_company_idx" ON "attendance_deduction_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "att_ded_tiers_company_idx" ON "attendance_deduction_tiers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "att_ded_tiers_type_idx" ON "attendance_deduction_tiers" USING btree ("company_id","applies_to");--> statement-breakpoint
CREATE INDEX "attendance_emp_idx" ON "attendance_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance_records" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "attendance_emp_date_idx" ON "attendance_records" USING btree ("employee_id","attendance_date");--> statement-breakpoint
CREATE INDEX "att_summary_emp_month_idx" ON "attendance_summary" USING btree ("employee_id","month");--> statement-breakpoint
CREATE INDEX "emp_shift_assign_emp_idx" ON "employee_shift_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_shift_assign_shift_idx" ON "employee_shift_assignments" USING btree ("shift_schedule_id");--> statement-breakpoint
CREATE INDEX "overtime_emp_idx" ON "overtime_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "holidays_company_idx" ON "public_holidays" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "shifts_company_idx" ON "shift_schedules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leave_balance_emp_idx" ON "employee_leave_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_balance_emp_type_idx" ON "employee_leave_balances" USING btree ("employee_id","leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_accrual_emp_idx" ON "leave_accrual_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_accrual_month_idx" ON "leave_accrual_history" USING btree ("month");--> statement-breakpoint
CREATE INDEX "leave_approvals_req_idx" ON "leave_approvals" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "leave_blackout_company_idx" ON "leave_blackout_dates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leave_policy_company_idx" ON "leave_policies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leave_policy_type_idx" ON "leave_policies" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_req_emp_idx" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_req_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_req_type_idx" ON "leave_requests" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_types_company_idx" ON "leave_types" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "daily_accrual_emp_idx" ON "daily_incentive_accrual" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "daily_accrual_date_idx" ON "daily_incentive_accrual" USING btree ("accrual_date");--> statement-breakpoint
CREATE INDEX "daily_accrual_emp_date_idx" ON "daily_incentive_accrual" USING btree ("employee_id","accrual_date");--> statement-breakpoint
CREATE INDEX "emp_incentive_assign_emp_idx" ON "employee_incentive_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_incentive_assign_scheme_idx" ON "employee_incentive_assignments" USING btree ("incentive_scheme_id");--> statement-breakpoint
CREATE INDEX "incentive_metrics_emp_date_idx" ON "incentive_metrics" USING btree ("employee_id","metric_date");--> statement-breakpoint
CREATE INDEX "incentive_rules_scheme_idx" ON "incentive_rules" USING btree ("incentive_scheme_id");--> statement-breakpoint
CREATE INDEX "incentive_schemes_company_idx" ON "incentive_schemes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "incentive_slabs_rule_idx" ON "incentive_slabs" USING btree ("incentive_rule_id");--> statement-breakpoint
CREATE INDEX "monthly_incentive_emp_month_idx" ON "monthly_incentive_summary" USING btree ("employee_id","month");--> statement-breakpoint
CREATE INDEX "salary_adv_deduct_advance_idx" ON "salary_advance_deductions" USING btree ("salary_advance_id");--> statement-breakpoint
CREATE INDEX "salary_adv_history_advance_idx" ON "salary_advance_history" USING btree ("salary_advance_id");--> statement-breakpoint
CREATE INDEX "salary_adv_ledger_emp_idx" ON "salary_advance_ledger" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "salary_adv_ledger_advance_idx" ON "salary_advance_ledger" USING btree ("advance_id");--> statement-breakpoint
CREATE INDEX "salary_advance_settings_company_idx" ON "salary_advance_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "salary_advances_emp_idx" ON "salary_advances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "salary_advances_status_idx" ON "salary_advances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "emp_bonus_company_idx" ON "employee_bonuses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_bonus_employee_idx" ON "employee_bonuses" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_custody_lines_company_idx" ON "employee_custody_lines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_custody_lines_custody_idx" ON "employee_custody_lines" USING btree ("custody_id");--> statement-breakpoint
CREATE INDEX "emp_custody_company_idx" ON "employee_custody" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_custody_employee_idx" ON "employee_custody" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_custody_status_idx" ON "employee_custody" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "emp_deduct_company_idx" ON "employee_deductions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_deduct_employee_idx" ON "employee_deductions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_deduct_type_idx" ON "employee_deductions" USING btree ("company_id","deduction_type");--> statement-breakpoint
CREATE INDEX "emp_deduct_att_rec_idx" ON "employee_deductions" USING btree ("attendance_record_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_company_scope_key_uidx" ON "idempotency_keys" USING btree ("company_id","scope","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "fiscal_years_company_id_idx" ON "fiscal_years" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "fiscal_years_company_current_idx" ON "fiscal_years" USING btree ("company_id","is_current");--> statement-breakpoint
CREATE INDEX "exchange_rates_company_currency_idx" ON "exchange_rates" USING btree ("company_id","currency");--> statement-breakpoint
CREATE INDEX "exchange_rates_company_date_idx" ON "exchange_rates" USING btree ("company_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_company_currency_date_uidx" ON "exchange_rates" USING btree ("company_id","currency","date");--> statement-breakpoint
CREATE INDEX "depreciation_runs_asset_id_idx" ON "depreciation_runs" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "depreciation_runs_company_id_idx" ON "depreciation_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "depreciation_runs_period_idx" ON "depreciation_runs" USING btree ("period");--> statement-breakpoint
CREATE INDEX "fixed_assets_company_id_idx" ON "fixed_assets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accrual_runs_accrual_id_idx" ON "accrual_runs" USING btree ("accrual_id");--> statement-breakpoint
CREATE INDEX "accrual_runs_company_id_idx" ON "accrual_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "accruals_company_id_idx" ON "accruals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "accruals_status_idx" ON "accruals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bank_accounts_company_id_idx" ON "bank_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_bank_account_idx" ON "bank_statement_lines" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_company_id_idx" ON "bank_statement_lines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_status_idx" ON "bank_statement_lines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "budget_lines_budget_id_idx" ON "budget_lines" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "budget_lines_company_id_idx" ON "budget_lines" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_lines_unique_idx" ON "budget_lines" USING btree ("budget_id","account_id","period");--> statement-breakpoint
CREATE INDEX "budgets_company_id_idx" ON "budgets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "budgets_fiscal_year_idx" ON "budgets" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "cost_centers_company_id_idx" ON "cost_centers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_company_idx" ON "notifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_targets_company_month_idx" ON "sales_targets" USING btree ("company_id","year_month");--> statement-breakpoint
CREATE INDEX "bad_debts_company_idx" ON "bad_debts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bad_debts_status_idx" ON "bad_debts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repair_checklist_company_idx" ON "repair_checklist_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "repair_dashboard_cards_company_idx" ON "repair_dashboard_cards" USING btree ("company_id","sort_order");--> statement-breakpoint
CREATE INDEX "repair_device_models_company_idx" ON "repair_device_models" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "repair_device_photos_job_idx" ON "repair_device_photos" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_job_parts_job_idx" ON "repair_job_parts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_company_idx" ON "repair_jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_status_idx" ON "repair_jobs" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "repair_jobs_tech_idx" ON "repair_jobs" USING btree ("company_id","technician_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_imei_idx" ON "repair_jobs" USING btree ("company_id","imei");--> statement-breakpoint
CREATE INDEX "repair_payments_job_idx" ON "repair_payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "repair_payments_company_idx" ON "repair_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "repair_pipeline_config_company_idx" ON "repair_pipeline_config" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "repair_receipt_tech_job_idx" ON "repair_receipt_technicians" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_receipt_tech_tech_idx" ON "repair_receipt_technicians" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "repair_history_job_idx" ON "repair_status_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "repair_history_company_idx" ON "repair_status_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "repair_statuses_company_idx" ON "repair_statuses" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repair_statuses_company_key_unique" ON "repair_statuses" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "scrap_items_company_idx" ON "scrap_items" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repair_accessories_company_key_uidx" ON "repair_accessories" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "price_list_items_list_idx" ON "price_list_items" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "price_list_items_product_idx" ON "price_list_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "price_lists_company_id_idx" ON "price_lists" USING btree ("company_id");