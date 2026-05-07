/**
 * reports/shared.ts — utility functions shared across all report sub-routers.
 * No router is exported from here — only pure helper functions and types.
 */
import { sql } from "drizzle-orm";

/* ── ISO date validation ─────────────────────────────────── */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function safeDate(val?: string): string | undefined {
  if (!val) return undefined;
  const v = val.trim();
  return ISO_DATE_RE.test(v) ? v : undefined;
}

/* ── Validation layer ────────────────────────────────────── */
export const TOLERANCE = 0.02;

export interface CheckItem { name: string; expected: number; actual: number; ok: boolean }
export interface ValidationResult {
  status: "OK" | "WARNING";
  validation_message?: string;
  checks: CheckItem[];
}

export function r2(n: number) { return Math.round(n * 100) / 100; }

export function buildValidation(checks: Omit<CheckItem, "ok">[]): ValidationResult {
  const results: CheckItem[] = checks.map(c => ({
    ...c,
    expected: r2(c.expected),
    actual:   r2(c.actual),
    ok: Math.abs(r2(c.expected) - r2(c.actual)) <= TOLERANCE,
  }));
  const failed = results.filter(c => !c.ok);
  if (failed.length === 0) return { status: "OK", checks: results };
  return {
    status: "WARNING",
    validation_message: failed.map(f =>
      `"${f.name}": متوقع ${f.expected}، فعلي ${f.actual}`
    ).join(" | "),
    checks: results,
  };
}

/* ── Whitelists — prevent SQL injection via sql.raw() ───── */
export const ALLOWED_ALIASES = new Set([
  "s", "sr", "e", "c", "p", "je", "jel", "pr", "pi", "si", "sri", "v", "t",
]);
export const ALLOWED_DATE_COLS = new Set(["date", "created_at"]);

export function safeAlias(alias: string): string {
  if (!ALLOWED_ALIASES.has(alias)) {
    throw new Error(`reports: alias not whitelisted: ${alias}`);
  }
  return alias;
}
export function safeCol(col: string): string {
  if (!ALLOWED_DATE_COLS.has(col)) {
    throw new Error(`reports: column not whitelisted: ${col}`);
  }
  return col;
}

/* ── SQL fragment builders (all parameterized) ───────────── */
export function cfSql(alias: string, companyId: number | null) {
  if (companyId === null) return sql`AND 1=0`;
  return sql`AND ${sql.raw(safeAlias(alias))}.company_id = ${companyId}`;
}

export function cfSimpleSql(companyId: number | null) {
  if (companyId === null) return sql`AND 1=0`;
  return sql`AND company_id = ${companyId}`;
}

export function dfSql(alias: string, col: string, from?: string, to?: string) {
  const sf = safeDate(from);
  const st = safeDate(to);
  const colRef = sql.raw(`${safeAlias(alias)}.${safeCol(col)}`);
  if (sf && st) return sql`AND ${colRef} >= ${sf} AND ${colRef} <= ${st}`;
  if (sf)       return sql`AND ${colRef} >= ${sf}`;
  if (st)       return sql`AND ${colRef} <= ${st}`;
  return sql``;
}

export function wfSql(alias: string, warehouseId?: string | number | null) {
  const wid = warehouseId ? Number(warehouseId) : null;
  if (!wid || isNaN(wid)) return sql``;
  const col = sql.raw(`${safeAlias(alias)}.warehouse_id`);
  return sql`AND ${col} = ${wid}`;
}
