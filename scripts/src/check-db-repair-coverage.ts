/**
 * check-db-repair-coverage.ts
 *
 * Ensures every pgTable that has a company_id column in
 * lib/db/src/schema/*.ts is covered by an UPDATE statement in
 * scripts/db-repair.sql.
 *
 * Exits with code 1 and lists missing tables if any are found.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCHEMA_DIR = join(ROOT, "lib/db/src/schema");
const REPAIR_SQL = join(ROOT, "scripts/db-repair.sql");

// ── 1. Collect every pgTable that declares a company_id column ────────────────

function extractTablesWithCompanyId(dir: string): string[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  const tables: string[] = [];

  for (const file of files) {
    const src = readFileSync(join(dir, file), "utf8");

    // Find every pgTable("name", { ... }) block using brace counting.
    // We locate the opening quote of the table name, then scan for the
    // second argument's braces so we can check if company_id lives inside.
    const pgTableRe = /pgTable\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = pgTableRe.exec(src)) !== null) {
      const tableName = m[1];
      const blockStart = m.index + m[0].length - 1; // position of the opening {

      // Walk forward counting braces to find the matching closing }.
      let depth = 0;
      let i = blockStart;
      while (i < src.length) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }

      const block = src.slice(blockStart, i + 1);

      // Check if company_id is declared as a column key inside this block.
      // Match lines like:  company_id: integer(...)  or  "company_id": ...
      if (/\bcompany_id\s*:/.test(block)) {
        tables.push(tableName);
      }
    }
  }

  return tables.sort();
}

// ── 2. Collect every table name in an UPDATE statement in db-repair.sql ───────

function extractRepairSqlTables(sqlPath: string): Set<string> {
  const sql = readFileSync(sqlPath, "utf8");
  const covered = new Set<string>();

  // Match:  UPDATE <table_name> SET company_id
  const updateRe = /\bUPDATE\s+(\w+)\s+SET\s+company_id\b/gi;
  let m: RegExpExecArray | null;
  while ((m = updateRe.exec(sql)) !== null) {
    covered.add(m[1].toLowerCase());
  }

  return covered;
}

// ── 3. Compare and report ─────────────────────────────────────────────────────

const schemaTables = extractTablesWithCompanyId(SCHEMA_DIR);
const repairTables = extractRepairSqlTables(REPAIR_SQL);

const missing = schemaTables.filter(
  (t) => !repairTables.has(t.toLowerCase()),
);

console.log(`db-repair coverage check`);
console.log(`  Schema tables with company_id : ${schemaTables.length}`);
console.log(`  Tables covered in db-repair   : ${repairTables.size}`);

if (missing.length === 0) {
  console.log(`  Result: OK — all tables are covered.\n`);
  process.exit(0);
} else {
  console.error(
    `\n  ERROR: The following ${missing.length} table(s) have a company_id column` +
      ` but are NOT covered in scripts/db-repair.sql:\n`,
  );
  for (const t of missing) {
    console.error(`    - ${t}`);
  }
  console.error(
    `\n  Add an UPDATE block for each missing table in scripts/db-repair.sql` +
      ` and re-run this check.\n`,
  );
  process.exit(1);
}
