import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_DIR = join(ROOT, "artifacts", "erp-system", "src", "pages");
const TARGET_DIR = join(ROOT, "artifacts", "muhkam-pro", "src", "pages");

/**
 * صفحات قسم المحاسبة — لا تُزامَن مع muhkam-pro
 * هذه الصفحات خاصة بـ Muhkam-Advanced فقط
 */
const ACCOUNTING_PAGES = new Set([
  "accounts.tsx",
  "accruals.tsx",
  "bank-reconciliation.tsx",
  "budgets.tsx",
  "cost-centers.tsx",
  "fiscal-years.tsx",
  "fixed-assets.tsx",
  "journal-entries.tsx",
]);

function getAllFiles(dir: string, base = dir): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...getAllFiles(full, base));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      result.push(relative(base, full));
    }
  }
  return result.sort();
}

const sourceFiles = getAllFiles(SOURCE_DIR);
const targetFilesSet = new Set(getAllFiles(TARGET_DIR));

let synced = 0;
let unchanged = 0;
let skippedMissing = 0;
let skippedAccounting = 0;

console.log("🔄 مزامنة الصفحات: erp-system (Muhkam-Advanced) → muhkam-pro\n");
console.log("📌 القاعدة: كل الصفحات تتزامن ماعدا صفحات قسم المحاسبة\n");

for (const file of sourceFiles) {
  const fileName = file.split("/").pop() ?? file;

  // تجاهل صفحات المحاسبة — خاصة بـ Advanced فقط
  if (ACCOUNTING_PAGES.has(fileName)) {
    console.log(`📊 محاسبة (متجاهل):  ${file}`);
    skippedAccounting++;
    continue;
  }

  // تجاهل الملفات غير الموجودة في muhkam-pro
  if (!targetFilesSet.has(file)) {
    console.log(`⏭  غير موجود في Pro: ${file}`);
    skippedMissing++;
    continue;
  }

  const srcPath = join(SOURCE_DIR, file);
  const dstPath = join(TARGET_DIR, file);
  const srcContent = readFileSync(srcPath, "utf-8");
  const dstContent = existsSync(dstPath) ? readFileSync(dstPath, "utf-8") : null;

  if (srcContent === dstContent) {
    unchanged++;
    continue;
  }

  writeFileSync(dstPath, srcContent, "utf-8");
  console.log(`✅ تمت المزامنة:     ${file}`);
  synced++;
}

console.log(`\n──────────────────────────────────────────`);
console.log(`✅ تمت مزامنة      : ${synced} ملف`);
console.log(`🟰 بدون تغيير      : ${unchanged} ملف`);
console.log(`📊 محاسبة (متجاهل) : ${skippedAccounting} ملف`);
console.log(`⏭  غير موجود في Pro: ${skippedMissing} ملف`);
console.log(`──────────────────────────────────────────`);

if (synced === 0) {
  console.log("\n✨ كل الصفحات المشتركة محدّثة بالفعل.");
}
