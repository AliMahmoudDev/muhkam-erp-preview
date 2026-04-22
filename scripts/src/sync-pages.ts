import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_DIR = join(ROOT, "artifacts", "erp-system", "src", "pages");
const TARGET_DIR = join(ROOT, "artifacts", "muhkam-base", "src", "pages");

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
let skipped = 0;

console.log("🔄 مزامنة الصفحات: erp-system → muhkam-pro\n");

for (const file of sourceFiles) {
  if (!targetFilesSet.has(file)) {
    console.log(`⏭  تجاهل (غير موجود في الأساسي): ${file}`);
    skipped++;
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
  console.log(`✅ تمت المزامنة: ${file}`);
  synced++;
}

console.log(`\n──────────────────────────────────`);
console.log(`✅ تمت مزامنة  : ${synced} ملف`);
console.log(`🟰 بدون تغيير  : ${unchanged} ملف`);
console.log(`⏭  تم التجاهل  : ${skipped} ملف (غير موجود في الأساسي)`);
console.log(`──────────────────────────────────`);

if (synced === 0) {
  console.log("\n✨ كل الصفحات المشتركة محدّثة بالفعل.");
}
