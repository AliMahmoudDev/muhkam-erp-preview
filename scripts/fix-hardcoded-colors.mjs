import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BG_MAP = {
  'bg-[#0D1424]': 'bg-canvas',
  'bg-[#0d1424]': 'bg-canvas',
  'bg-[#0f1623]': 'bg-canvas',
  'bg-[#0F1623]': 'bg-canvas',
  'bg-[#0f1117]': 'bg-canvas',
  'bg-[#111827]': 'bg-canvas',
  'bg-[#1A2235]': 'bg-surface',
  'bg-[#1a2235]': 'bg-surface',
  'bg-[#1a1a2e]': 'bg-surface',
  'bg-[#1a1f2e]': 'bg-surface',
  'bg-[#1a1530]': 'bg-raised',
};

const EXCLUDE = ['LandingPage', 'LandingMockup', '/landing/'];

function walkTsx(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTsx(full, results);
    else if (full.endsWith('.tsx')) results.push(full);
  }
  return results;
}

const ROOT = '/home/claude/MUHKAM-ERP';
const files = walkTsx(join(ROOT, 'artifacts/erp-system/src'));

let totalFixed = 0;
const changed = [];

for (const file of files) {
  if (EXCLUDE.some(p => file.includes(p))) continue;

  let content = readFileSync(file, 'utf8');
  const original = content;
  let fileFixed = 0;

  for (const [old, token] of Object.entries(BG_MAP)) {
    const escaped = old.replace(/[[\]]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, token);
      fileFixed += matches.length;
    }
  }

  if (content !== original) {
    writeFileSync(file, content, 'utf8');
    changed.push({ file: file.replace(ROOT + '/', ''), fixed: fileFixed });
    totalFixed += fileFixed;
  }
}

console.log(`\n✅ تم إصلاح ${totalFixed} موضع في ${changed.length} ملف:\n`);
for (const { file, fixed } of changed) {
  console.log(`  ${fixed} ← ${file}`);
}
