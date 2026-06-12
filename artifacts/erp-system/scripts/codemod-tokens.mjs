#!/usr/bin/env node
/**
 * MUHKAM Token Codemod — replaces hardcoded Tailwind color classes and hex
 * values in inline styles with semantic design-token equivalents.
 *
 * Replacements:
 *   text-white[/*]    → text-ink[/*]     (opacity suffix preserved)
 *   border-white/*    → border-line      (opacity dropped — token has correct value)
 *   bg-white/*        → bg-surface | bg-raised  (by opacity bucket)
 *   '#111827' etc.    → 'var(--bg-card)' (hex strings in style props)
 *
 * Usage:
 *   node scripts/codemod-tokens.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const SRC_ROOT = new URL('../src', import.meta.url).pathname;
const EXTS = new Set(['.tsx', '.ts']);

/* ────────────────────────────────────────────────────────────────────
   Token mapping helpers
──────────────────────────────────────────────────────────────────── */

/** Map bg-white opacity value to the appropriate token class */
function bgWhiteToken(opacityStr, prefix = '') {
  // opacityStr: '0.03' | '0.07' | '5' | '10' | '15' | '25' ...
  let pct;
  if (opacityStr.startsWith('0.')) {
    pct = parseFloat(opacityStr) * 100;
  } else {
    pct = parseFloat(opacityStr);
  }
  if (pct <= 12) return `${prefix}bg-surface`;
  if (pct <= 30) return `${prefix}bg-raised`;
  return null; // >30 — leave unchanged (deliberate high-opacity)
}

/* ────────────────────────────────────────────────────────────────────
   Replacement rules applied to each file's full text
──────────────────────────────────────────────────────────────────── */

/**
 * Returns the text with all token replacements applied, plus a count map.
 */
function applyReplacements(src, filePath) {
  let text = src;
  const counts = {};

  function count(key, n = 1) {
    counts[key] = (counts[key] || 0) + n;
  }

  // ── 1. text-white → text-ink (any prefix like hover:, placeholder:, etc.)
  //    \b ensures we're at a word boundary before 'text-white'
  //    The opacity suffix (/50, /[0.7]) is left in place → becomes text-ink/50
  text = text.replace(/\btext-white\b/g, (m) => {
    count('text-white→text-ink');
    return 'text-ink';
  });

  // ── 2. border-white/N → border-line  (drop opacity — token handles it)
  //    NOTE: no trailing \b because "]" is non-word; use lookahead instead.
  text = text.replace(
    /\b((?:[a-z-]+:)*)border-white\/(\[[\d.]+\]|\d+)(?=[\s"'`\]|,;)}]|$)/g,
    (m, pfx) => {
      count('border-white→border-line');
      return `${pfx}border-line`;
    }
  );

  // ── 3. bg-white/[decimal] — arbitrary bracket notation
  text = text.replace(
    /\b((?:[a-z-]+:)*)bg-white\/\[([\d.]+)\]/g,
    (m, pfx, val) => {
      const tok = bgWhiteToken(val, pfx);
      if (!tok) return m;
      count(`bg-white/[${val}]→${tok}`);
      return tok;
    }
  );

  // ── 4. bg-white/N — integer shorthand (1-30)
  text = text.replace(
    /\b((?:[a-z-]+:)*)bg-white\/(\d+)\b/g,
    (m, pfx, val) => {
      const tok = bgWhiteToken(val, pfx);
      if (!tok) return m;
      count(`bg-white/${val}→${tok}`);
      return tok;
    }
  );

  // ── 5. Hex colors in style prop string literals
  //    Only replace exact-match quoted hex values ('' or "")
  const hexMap = [
    [/#111827/g, 'var(--bg-card)'],
    [/#0f172a/g, 'var(--bg-app)'],
    [/#1e293b/g, 'var(--bg-elevated)'],
    [/#0b0f14/g, 'var(--bg-app)'],
    [/#0b0f1a/g, 'var(--bg-app)'],
    [/#0d1117/g, 'var(--bg-app)'],
  ];

  // We only replace hex values that appear inside JS string literals
  // (quoted by ' or ") to avoid replacing in comments/docs.
  // Strategy: match '..hex..' or "..hex.." short strings
  for (const [hexRe, tokenVal] of hexMap) {
    const hexStr = hexRe.source; // e.g. #111827
    const hexLiteral = new RegExp(`(['"])(${hexStr})\\1`, 'g');
    text = text.replace(hexLiteral, (m, q, hex) => {
      count(`${hex}→${tokenVal}`);
      return `${q}${tokenVal}${q}`;
    });
  }

  return { text, counts };
}

/* ────────────────────────────────────────────────────────────────────
   File walker
──────────────────────────────────────────────────────────────────── */

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // Skip node_modules, dist, coverage
      if (['node_modules', 'dist', 'coverage', '.git'].includes(entry)) continue;
      walk(full, files);
    } else if (EXTS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/* ────────────────────────────────────────────────────────────────────
   Main
──────────────────────────────────────────────────────────────────── */

const allFiles = walk(SRC_ROOT);
const report = {
  scanned: allFiles.length,
  modified: 0,
  unchanged: 0,
  totalReplacements: 0,
  byPattern: {},
  modifiedFiles: [],
  errors: [],
};

for (const filePath of allFiles) {
  try {
    const original = readFileSync(filePath, 'utf8');
    const { text, counts } = applyReplacements(original, filePath);

    if (text === original) {
      report.unchanged++;
      continue;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    report.modified++;
    report.totalReplacements += total;
    report.modifiedFiles.push({
      file: relative(SRC_ROOT, filePath),
      replacements: total,
      breakdown: counts,
    });

    for (const [k, v] of Object.entries(counts)) {
      report.byPattern[k] = (report.byPattern[k] || 0) + v;
    }

    if (!DRY_RUN) {
      writeFileSync(filePath, text, 'utf8');
    }
  } catch (err) {
    report.errors.push({ file: filePath, error: String(err) });
  }
}

/* ────────────────────────────────────────────────────────────────────
   Output
──────────────────────────────────────────────────────────────────── */

console.log('\n' + '═'.repeat(64));
console.log(`  MUHKAM Token Codemod${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log('═'.repeat(64));
console.log(`\n  Files scanned   : ${report.scanned}`);
console.log(`  Files modified  : ${report.modified}`);
console.log(`  Files unchanged : ${report.unchanged}`);
console.log(`  Total replacements: ${report.totalReplacements}`);

console.log('\n  By pattern:');
const sorted = Object.entries(report.byPattern).sort(([, a], [, b]) => b - a);
for (const [k, v] of sorted) {
  console.log(`    ${v.toString().padStart(5)}  ${k}`);
}

if (report.errors.length) {
  console.log('\n  ERRORS:');
  for (const e of report.errors) console.log(`    ${e.file}: ${e.error}`);
}

console.log('\n  Top modified files:');
const top = report.modifiedFiles.sort((a, b) => b.replacements - a.replacements).slice(0, 20);
for (const f of top) {
  console.log(`    ${f.replacements.toString().padStart(4)}  ${f.file}`);
}

console.log('\n  Residual hardcoded patterns (need manual review):');
console.log('  Run after codemod to check:');
console.log('    grep -rn "text-white\\|bg-white/" src/ --include="*.tsx" | wc -l');
console.log('\n' + '═'.repeat(64) + '\n');

// Write JSON report
import { writeFileSync as wf } from 'node:fs';
const reportPath = new URL('../codemod-report.json', import.meta.url).pathname;
wf(reportPath, JSON.stringify(report, null, 2));
console.log(`  Report saved → codemod-report.json\n`);
