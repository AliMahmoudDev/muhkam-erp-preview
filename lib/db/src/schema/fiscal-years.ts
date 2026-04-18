import { pgTable, serial, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const fiscalYearsTable = pgTable("fiscal_years", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull().references(() => companiesTable.id),
  year_label:   text("year_label").notNull(),
  start_date:   text("start_date").notNull(),
  end_date:     text("end_date").notNull(),
  is_open:      boolean("is_open").notNull().default(true),
  is_current:   boolean("is_current").notNull().default(false),
  closed_by:    integer("closed_by"),
  closed_at:    timestamp("closed_at", { withTimezone: true }),
  notes:        text("notes"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("fiscal_years_company_id_idx").on(t.company_id),
  index("fiscal_years_company_current_idx").on(t.company_id, t.is_current),
]);

export type FiscalYear = typeof fiscalYearsTable.$inferSelect;
