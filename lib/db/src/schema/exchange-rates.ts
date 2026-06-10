import { pgTable, serial, text, numeric, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const exchangeRatesTable = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull(),
  rate: numeric("rate", { precision: 12, scale: 6 }).notNull(),
  date: text("date").notNull(),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("exchange_rates_company_currency_idx").on(t.company_id, t.currency),
  index("exchange_rates_company_date_idx").on(t.company_id, t.date),
  uniqueIndex("exchange_rates_company_currency_date_uidx").on(t.company_id, t.currency, t.date),
]);

export type ExchangeRate = typeof exchangeRatesTable.$inferSelect;
