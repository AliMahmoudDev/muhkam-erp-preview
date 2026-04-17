import {
  pgTable, serial, text, integer, timestamp, numeric, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { branchesTable } from "./branches";

/* ── Departments ─────────────────────────────────────────────────── */
export const departmentsTable = pgTable("departments", {
  id:              serial("id").primaryKey(),
  company_id:      integer("company_id").notNull().default(1).references(() => companiesTable.id),
  name_en:         text("name_en").notNull(),
  name_ar:         text("name_ar").notNull(),
  description_en:  text("description_en"),
  description_ar:  text("description_ar"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("departments_company_idx").on(t.company_id),
]);

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, created_at: true });
export type Department = typeof departmentsTable.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

/* ── Job Titles ──────────────────────────────────────────────────── */
export const jobTitlesTable = pgTable("job_titles", {
  id:          serial("id").primaryKey(),
  company_id:  integer("company_id").notNull().default(1).references(() => companiesTable.id),
  name_en:     text("name_en").notNull(),
  name_ar:     text("name_ar").notNull(),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("job_titles_company_idx").on(t.company_id),
]);

export const insertJobTitleSchema = createInsertSchema(jobTitlesTable).omit({ id: true, created_at: true });
export type JobTitle = typeof jobTitlesTable.$inferSelect;
export type InsertJobTitle = z.infer<typeof insertJobTitleSchema>;

/* ── Employees ───────────────────────────────────────────────────── */
export const employeesTable = pgTable("employees", {
  id:                 serial("id").primaryKey(),
  company_id:         integer("company_id").notNull().default(1).references(() => companiesTable.id),
  employee_code:      text("employee_code").notNull(),
  first_name_en:      text("first_name_en").notNull(),
  last_name_en:       text("last_name_en").notNull(),
  first_name_ar:      text("first_name_ar").notNull(),
  last_name_ar:       text("last_name_ar").notNull(),
  email:              text("email").notNull(),
  phone:              text("phone"),
  personal_phone:     text("personal_phone"),
  national_id:        text("national_id"),
  job_title_id:       integer("job_title_id").references(() => jobTitlesTable.id),
  department_id:      integer("department_id").references(() => departmentsTable.id),
  branch_id:          integer("branch_id").references(() => branchesTable.id),
  hire_date:          text("hire_date").notNull(),
  employment_status:  text("employment_status").notNull().default("active"),
  salary:             numeric("salary", { precision: 12, scale: 2 }).notNull().default("0"),
  currency:           text("currency").notNull().default("EGP"),
  bank_account:       text("bank_account"),
  address_en:         text("address_en"),
  address_ar:         text("address_ar"),
  city:               text("city"),
  country:            text("country").default("مصر"),
  notes:              text("notes"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at:         timestamp("deleted_at", { withTimezone: true }),
  created_by:         integer("created_by"),
  updated_by:         integer("updated_by"),
}, t => [
  index("employees_company_idx").on(t.company_id),
  index("employees_code_company_idx").on(t.company_id, t.employee_code),
  index("employees_dept_idx").on(t.department_id),
  index("employees_status_idx").on(t.company_id, t.employment_status),
]);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true, created_at: true, updated_at: true, deleted_at: true,
});
export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

/* ── Employee Documents ──────────────────────────────────────────── */
export const employeeDocumentsTable = pgTable("employee_documents", {
  id:            serial("id").primaryKey(),
  employee_id:   integer("employee_id").notNull().references(() => employeesTable.id),
  document_type: text("document_type").notNull(),
  file_name:     text("file_name").notNull(),
  file_path:     text("file_path"),
  expiry_date:   text("expiry_date"),
  verified_by:   integer("verified_by"),
  verified_at:   timestamp("verified_at", { withTimezone: true }),
  notes:         text("notes"),
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_docs_employee_idx").on(t.employee_id),
]);

export const insertEmployeeDocumentSchema = createInsertSchema(employeeDocumentsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type EmployeeDocument = typeof employeeDocumentsTable.$inferSelect;

/* ── Employee Emergency Contacts ─────────────────────────────────── */
export const employeeContactsTable = pgTable("employee_contacts", {
  id:           serial("id").primaryKey(),
  employee_id:  integer("employee_id").notNull().references(() => employeesTable.id),
  contact_type: text("contact_type").notNull().default("emergency"),
  name:         text("name").notNull(),
  relationship: text("relationship"),
  phone:        text("phone"),
  email:        text("email"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_contacts_employee_idx").on(t.employee_id),
]);

export const insertEmployeeContactSchema = createInsertSchema(employeeContactsTable).omit({
  id: true, created_at: true,
});
export type EmployeeContact = typeof employeeContactsTable.$inferSelect;

/* ── Employee Status History ─────────────────────────────────────── */
export const employeeStatusHistoryTable = pgTable("employee_status_history", {
  id:          serial("id").primaryKey(),
  employee_id: integer("employee_id").notNull().references(() => employeesTable.id),
  old_status:  text("old_status"),
  new_status:  text("new_status").notNull(),
  reason:      text("reason"),
  changed_by:  integer("changed_by"),
  changed_at:  timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_status_hist_employee_idx").on(t.employee_id),
]);

export type EmployeeStatusHistory = typeof employeeStatusHistoryTable.$inferSelect;
