/**
 * OpenAPI 3.0 specification for مُحكم - MUHKAM ERP API.
 * Served at /api/docs via swagger-ui-express.
 */

export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "مُحكم - MUHKAM ERP — Arabic ERP API",
    version: "1.0.0",
    description: "Production-grade ERP system for Egyptian mobile repair shops. Features: POS, inventory, HR, multi-tenant SaaS, period-lock accounting, VAT 14%.",
    contact: { name: "MUHKAM Support", email: "support@muhkam-erp.com" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: "/", description: "Current server" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token from /api/auth/login. Expires in 15 minutes.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
          details: { type: "string", example: "JWT expired" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "admin" },
          password: { type: "string", example: "Admin@123" },
          company_id: { type: "integer", example: 1, description: "Optional — resolved from username if omitted" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          accessToken:  { type: "string" },
          refreshToken: { type: "string" },
          user: {
            type: "object",
            properties: {
              id:         { type: "integer" },
              username:   { type: "string" },
              role:       { type: "string", enum: ["super_admin","admin","manager","cashier","salesperson"] },
              company_id: { type: "integer" },
            },
          },
        },
      },
      Product: {
        type: "object",
        properties: {
          id:                  { type: "integer" },
          name:                { type: "string" },
          sku:                 { type: "string" },
          category_id:         { type: "integer", nullable: true },
          quantity:            { type: "number" },
          cost_price:          { type: "string" },
          sale_price:          { type: "string" },
          tax_rate:            { type: "string", description: "VAT percentage (e.g. '14')" },
          low_stock_threshold: { type: "integer" },
          created_at:          { type: "string", format: "date-time" },
        },
      },
      Sale: {
        type: "object",
        properties: {
          id:             { type: "integer" },
          invoice_number: { type: "string" },
          customer_id:    { type: "integer", nullable: true },
          total_amount:   { type: "string" },
          tax_amount:     { type: "string" },
          tax_rate:       { type: "string" },
          status:         { type: "string", enum: ["draft","confirmed","cancelled"] },
          sale_date:      { type: "string", format: "date-time" },
        },
      },
      FiscalYear: {
        type: "object",
        properties: {
          id:          { type: "integer" },
          year_label:  { type: "string", example: "السنة المالية 2026" },
          start_date:  { type: "string", format: "date", example: "2026-01-01" },
          end_date:    { type: "string", format: "date", example: "2026-12-31" },
          is_open:     { type: "boolean" },
          is_current:  { type: "boolean" },
          closed_at:   { type: "string", format: "date-time", nullable: true },
          notes:       { type: "string", nullable: true },
          created_at:  { type: "string", format: "date-time" },
        },
      },
      TrialBalance: {
        type: "object",
        properties: {
          accounts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                account_id:   { type: "integer" },
                account_code: { type: "string" },
                account_name: { type: "string" },
                account_type: { type: "string", enum: ["asset","liability","equity","revenue","expense"] },
                total_debit:  { type: "number" },
                total_credit: { type: "number" },
                balance:      { type: "number" },
              },
            },
          },
          summary: {
            type: "object",
            properties: {
              grand_debit:  { type: "number" },
              grand_credit: { type: "number" },
              difference:   { type: "number" },
              is_balanced:  { type: "boolean" },
            },
          },
          generated_at: { type: "string", format: "date-time" },
        },
      },
      VatReport: {
        type: "object",
        properties: {
          output_vat: {
            type: "object",
            properties: {
              total_sales:   { type: "number" },
              tax_amount:    { type: "number" },
              invoice_count: { type: "integer" },
            },
          },
          input_vat: {
            type: "object",
            properties: {
              total_purchases: { type: "number" },
              tax_amount:      { type: "number" },
              invoice_count:   { type: "integer" },
            },
          },
          net_vat_payable: { type: "number" },
          vat_status:      { type: "string" },
          generated_at:    { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  tags: [
    { name: "Auth",         description: "Authentication & token management" },
    { name: "Products",     description: "Product catalog with VAT" },
    { name: "Sales",        description: "Sales invoices & POS" },
    { name: "Purchases",    description: "Purchase orders" },
    { name: "Inventory",    description: "Stock management" },
    { name: "Customers",    description: "Customer CRM" },
    { name: "Employees",    description: "HR — employees, payroll, attendance" },
    { name: "Accounts",     description: "Chart of Accounts" },
    { name: "Journal",      description: "Journal entries & ledger" },
    { name: "FiscalYears",  description: "Fiscal year management" },
    { name: "Reports",      description: "Financial reports — P&L, Balance Sheet, Trial Balance, VAT" },
    { name: "Health",       description: "System health checks" },
    { name: "Treasury",     description: "Treasury & vouchers" },
  ],
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: {
            description: "Success",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } },
          },
          401: { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          429: { description: "Rate limited (5 attempts/15 min)" },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token (rotation enabled)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken"],
                properties: { refreshToken: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "New token pair", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
          401: { description: "Invalid or reused refresh token — all sessions revoked on replay detection" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout — invalidate session",
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "List all products",
        responses: {
          200: {
            description: "Array of products",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } },
          },
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create product",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "cost_price", "sale_price"],
                properties: {
                  name:                { type: "string" },
                  sku:                 { type: "string" },
                  category_id:         { type: "integer" },
                  cost_price:          { type: "number" },
                  sale_price:          { type: "number" },
                  tax_rate:            { type: "number", default: 14, description: "VAT rate %" },
                  quantity:            { type: "integer", default: 0 },
                  low_stock_threshold: { type: "integer", default: 5 },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } } },
      },
    },
    "/api/products/{id}": {
      put: {
        tags: ["Products"],
        summary: "Update product",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Updated product" } },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete product",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
    "/api/sales": {
      get: {
        tags: ["Sales"],
        summary: "List sales invoices",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "date_from", in: "query", schema: { type: "string", format: "date" } },
          { name: "date_to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Paginated sales" } },
      },
      post: {
        tags: ["Sales"],
        summary: "Create sale invoice",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  customer_id: { type: "integer" },
                  sale_date:   { type: "string", format: "date" },
                  tax_rate:    { type: "number", default: 14 },
                  items:       { type: "array", items: { type: "object", properties: { product_id: { type: "integer" }, quantity: { type: "number" }, unit_price: { type: "number" } } } },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Sale created with VAT calculated" } },
      },
    },
    "/api/fiscal-years": {
      get: {
        tags: ["FiscalYears"],
        summary: "List fiscal years",
        responses: { 200: { description: "Array of fiscal years", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/FiscalYear" } } } } } },
      },
      post: {
        tags: ["FiscalYears"],
        summary: "Create fiscal year",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["year_label", "start_date", "end_date"],
                properties: {
                  year_label: { type: "string" },
                  start_date: { type: "string", format: "date" },
                  end_date:   { type: "string", format: "date" },
                  notes:      { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Created fiscal year" } },
      },
    },
    "/api/fiscal-years/{id}/close": {
      patch: {
        tags: ["FiscalYears"],
        summary: "Close fiscal year (period lock)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Fiscal year closed — no more postings allowed" },
          400: { description: "Already closed" },
        },
      },
    },
    "/api/fiscal-years/{id}/reopen": {
      patch: {
        tags: ["FiscalYears"],
        summary: "Reopen a closed fiscal year (admin only)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Reopened" } },
      },
    },
    "/api/fiscal-years/{id}/set-current": {
      patch: {
        tags: ["FiscalYears"],
        summary: "Set fiscal year as current",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Set as current" } },
      },
    },
    "/api/reports/trial-balance": {
      get: {
        tags: ["Reports"],
        summary: "Trial Balance — ميزان المراجعة",
        parameters: [
          { name: "date_from", in: "query", schema: { type: "string", format: "date" } },
          { name: "date_to",   in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Trial balance with balance check", content: { "application/json": { schema: { $ref: "#/components/schemas/TrialBalance" } } } } },
      },
    },
    "/api/reports/vat-report": {
      get: {
        tags: ["Reports"],
        summary: "VAT Report — ضريبة القيمة المضافة 14%",
        parameters: [
          { name: "date_from", in: "query", schema: { type: "string", format: "date" } },
          { name: "date_to",   in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Output VAT, input VAT, net payable", content: { "application/json": { schema: { $ref: "#/components/schemas/VatReport" } } } } },
      },
    },
    "/api/reports/profit-loss": {
      get: {
        tags: ["Reports"],
        summary: "P&L Report",
        parameters: [
          { name: "date_from", in: "query", schema: { type: "string", format: "date" } },
          { name: "date_to",   in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Profit and Loss statement" } },
      },
    },
    "/api/reports/balance-sheet": {
      get: {
        tags: ["Reports"],
        summary: "Balance Sheet",
        parameters: [
          { name: "as_of_date", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { 200: { description: "Balance Sheet snapshot" } },
      },
    },
    "/api/reports/cash-flow": {
      get: {
        tags: ["Reports"],
        summary: "Cash Flow Statement",
        responses: { 200: { description: "Cash flow" } },
      },
    },
    "/healthz": {
      get: {
        tags: ["Health"],
        summary: "Basic health check",
        security: [],
        responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } } },
      },
    },
    "/healthz/deep": {
      get: {
        tags: ["Health"],
        summary: "Deep health check — DB round-trip, pool, latency",
        security: [],
        responses: {
          200: { description: "All systems healthy" },
          503: { description: "Degraded — check response body for details" },
        },
      },
    },
    "/api/employees": {
      get: { tags: ["Employees"], summary: "List employees", responses: { 200: { description: "Employee list" } } },
      post: { tags: ["Employees"], summary: "Create employee", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created" } } },
    },
    "/api/customers": {
      get: { tags: ["Customers"], summary: "List customers", responses: { 200: { description: "Customer list" } } },
      post: { tags: ["Customers"], summary: "Create customer", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Created" } } },
    },
    "/api/accounts": {
      get: { tags: ["Accounts"], summary: "Chart of Accounts", responses: { 200: { description: "Account tree" } } },
    },
    "/api/journal-entries": {
      get: { tags: ["Journal"], summary: "List journal entries", responses: { 200: { description: "Journal entries" } } },
      post: { tags: ["Journal"], summary: "Post journal entry", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: { description: "Posted" } } },
    },
  },
};
