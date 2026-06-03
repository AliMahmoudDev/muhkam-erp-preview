/**
 * production-preflight.ts
 *
 * Read-only production readiness check. Reads environment variable NAMES only —
 * it NEVER prints, logs, or exposes any secret VALUE.
 *
 * Behavior:
 *   - Verifies all REQUIRED secrets are present.
 *   - Verifies JWT_SECRET / JWT_REFRESH_SECRET meet a minimum length and differ.
 *   - Verifies REPAIR_TRACKING_SECRET is present and long enough.
 *   - Verifies SUPER_ADMIN_IPS is non-empty when NODE_ENV=production.
 *   - Verifies BACKUP_ENCRYPTION_KEY / TOTP_ENCRYPTION_KEY are present.
 *   - Flags ALLOWED_ORIGINS as recommended (warn) in production.
 *   - Flags REDIS_URL as recommended (warn), never blocking.
 *   - Exits with code 1 if any CRITICAL check fails; otherwise exits 0.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run production:preflight
 */

const IS_PROD = process.env.NODE_ENV === "production";

const MIN_JWT_LEN = 32;
const MIN_TRACKING_LEN = 32;

type Level = "OK" | "MISSING" | "WARN" | "WEAK";

interface CheckResult {
  name: string;
  level: Level;
  critical: boolean;
  note: string;
}

const results: CheckResult[] = [];

/** Record a check result. `value` is read only to test presence/length — never printed. */
function record(
  name: string,
  level: Level,
  critical: boolean,
  note: string,
): void {
  results.push({ name, level, critical, note });
}

function isPresent(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

function lengthOf(key: string): number {
  const v = process.env[key];
  return typeof v === "string" ? v.trim().length : 0;
}

// ── REQUIRED — server refuses to start without these ─────────────────────────
const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "TOTP_ENCRYPTION_KEY",
  "BACKUP_ENCRYPTION_KEY",
] as const;

for (const key of REQUIRED) {
  if (isPresent(key)) {
    record(key, "OK", true, "present");
  } else {
    // Critical only in production; advisory in dev so Replit/local runs pass.
    record(
      key,
      IS_PROD ? "MISSING" : "WARN",
      IS_PROD,
      IS_PROD
        ? "REQUIRED — server will not start"
        : "not set (dev) — required in production",
    );
  }
}

// ── JWT strength + distinctness (critical only in production) ─────────────────
if (isPresent("JWT_SECRET") && lengthOf("JWT_SECRET") < MIN_JWT_LEN) {
  record("JWT_SECRET", "WEAK", IS_PROD, `shorter than ${MIN_JWT_LEN} chars`);
}
if (
  isPresent("JWT_REFRESH_SECRET") &&
  lengthOf("JWT_REFRESH_SECRET") < MIN_JWT_LEN
) {
  record(
    "JWT_REFRESH_SECRET",
    "WEAK",
    IS_PROD,
    `shorter than ${MIN_JWT_LEN} chars`,
  );
}
if (
  isPresent("JWT_SECRET") &&
  isPresent("JWT_REFRESH_SECRET") &&
  process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
) {
  record(
    "JWT_REFRESH_SECRET",
    "WEAK",
    IS_PROD,
    "must DIFFER from JWT_SECRET",
  );
}

// ── REPAIR_TRACKING_SECRET — fail-closed for QR tracking ─────────────────────
if (isPresent("REPAIR_TRACKING_SECRET")) {
  if (lengthOf("REPAIR_TRACKING_SECRET") < MIN_TRACKING_LEN) {
    record(
      "REPAIR_TRACKING_SECRET",
      "WEAK",
      IS_PROD,
      `shorter than ${MIN_TRACKING_LEN} chars`,
    );
  } else {
    record("REPAIR_TRACKING_SECRET", "OK", false, "present");
  }
} else {
  record(
    "REPAIR_TRACKING_SECRET",
    IS_PROD ? "MISSING" : "WARN",
    IS_PROD,
    IS_PROD
      ? "QR repair-tracking endpoints return 503 until set"
      : "not set (dev) — tracking disabled",
  );
}

// ── SUPER_ADMIN_IPS — fail-closed for super-admin in production ───────────────
if (isPresent("SUPER_ADMIN_IPS")) {
  record("SUPER_ADMIN_IPS", "OK", false, "allowlist set");
} else {
  record(
    "SUPER_ADMIN_IPS",
    IS_PROD ? "MISSING" : "WARN",
    IS_PROD,
    IS_PROD
      ? "super-admin access BLOCKED until an IP allowlist is set"
      : "empty (dev) — allows all",
  );
}

// ── ALLOWED_ORIGINS — recommended in production ──────────────────────────────
if (isPresent("ALLOWED_ORIGINS")) {
  record("ALLOWED_ORIGINS", "OK", false, "CORS allowlist set");
} else {
  record(
    "ALLOWED_ORIGINS",
    IS_PROD ? "WARN" : "OK",
    false,
    IS_PROD
      ? "recommended — required for mobile/external-origin clients"
      : "not set (dev)",
  );
}

// ── REDIS_URL — recommended, never blocking ──────────────────────────────────
if (isPresent("REDIS_URL")) {
  record("REDIS_URL", "OK", false, "distributed cache enabled");
} else {
  record(
    "REDIS_URL",
    "WARN",
    false,
    "recommended — in-memory fallback used (fine for single instance)",
  );
}

// ── Optional integrations — informational only ───────────────────────────────
for (const key of [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "RESEND_API_KEY",
  "SENTRY_DSN",
]) {
  record(
    key,
    isPresent(key) ? "OK" : "WARN",
    false,
    isPresent(key) ? "present" : "optional — feature disabled if empty",
  );
}

// ── Report ───────────────────────────────────────────────────────────────────
const ICON: Record<Level, string> = {
  OK: "✅ OK     ",
  MISSING: "❌ MISSING",
  WARN: "⚠️  WARN   ",
  WEAK: "❌ WEAK   ",
};

const namePad = Math.max(...results.map((r) => r.name.length));

console.log("");
console.log("=== MUHKAM ERP — Production Preflight ===");
console.log(`NODE_ENV = ${process.env.NODE_ENV ?? "(unset)"}`);
console.log("");

for (const r of results) {
  const tag = r.critical ? "[critical]" : "[advisory]";
  console.log(
    `${ICON[r.level]}  ${r.name.padEnd(namePad)}  ${tag}  ${r.note}`,
  );
}

const criticalFailures = results.filter(
  (r) => r.critical && (r.level === "MISSING" || r.level === "WEAK"),
);
const warnings = results.filter((r) => r.level === "WARN");

console.log("");
console.log(
  `Summary: ${criticalFailures.length} critical issue(s), ${warnings.length} advisory warning(s).`,
);

if (criticalFailures.length > 0) {
  console.log("");
  console.log("❌ NOT READY for production. Resolve critical issues above.");
  process.exit(1);
}

console.log("");
console.log("✅ All critical checks passed.");
process.exit(0);
