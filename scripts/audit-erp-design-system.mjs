import fs from "node:fs";
import path from "node:path";

const ROOT = "artifacts/erp-system/src";
const OUT = "artifacts/erp-system/design-system-audit-report.md";

const patterns = [
  ["hardcoded_hex", /#[0-9a-fA-F]{6}/g],
  ["tailwind_arbitrary_bg", /bg-\[#([0-9a-fA-F]{6})\]/g],
  ["tailwind_white_text", /text-white(?:\/\d+)?/g],
  ["tailwind_white_bg", /bg-white(?:\/\d+)?/g],
  ["tailwind_white_border", /border-white(?:\/\d+)?/g],
  ["inline_style", /style=\{\{/g],
  ["inline_background", /background(?:Color)?:\s*["'`]/g],
  ["backdrop_blur", /backdropFilter|backdrop-blur/g],
  ["gradient", /linear-gradient|radial-gradient/g],
];

const ignored = [
  "/dist/",
  "/node_modules/",
  "/export-pdf/",
];

function walk(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const st = fs.statSync(full);
    if (ignored.some(x => full.includes(x))) continue;
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts|css)$/.test(full)) out.push(full);
  }
  return out;
}

const rows = [];
const totals = new Map();

for (const file of walk(ROOT)) {
  const txt = fs.readFileSync(file, "utf8");
  const lines = txt.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    for (const [name, re] of patterns) {
      re.lastIndex = 0;
      const matches = lines[i].match(re);
      if (!matches) continue;

      totals.set(name, (totals.get(name) ?? 0) + matches.length);
      rows.push({
        file,
        line: i + 1,
        type: name,
        text: lines[i].trim().slice(0, 220),
      });
    }
  }
}

const byFile = new Map();
for (const r of rows) {
  byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1);
}

let md = "# MUHKAM ERP Design System Audit\n\n";
md += "## Summary\n\n";
for (const [k, v] of [...totals.entries()].sort((a,b) => b[1] - a[1])) {
  md += `- ${k}: ${v}\n`;
}

md += "\n## Top Problem Files\n\n";
for (const [file, count] of [...byFile.entries()].sort((a,b) => b[1] - a[1]).slice(0, 80)) {
  md += `- ${count} — \`${file}\`\n`;
}

md += "\n## Detailed Findings\n\n";
for (const r of rows.slice(0, 1200)) {
  md += `### ${r.type}\n`;
  md += `\`${r.file}:${r.line}\`\n\n`;
  md += "```tsx\n" + r.text + "\n```\n\n";
}

fs.writeFileSync(OUT, md);
console.log(`audit written: ${OUT}`);
console.log(`findings: ${rows.length}`);
