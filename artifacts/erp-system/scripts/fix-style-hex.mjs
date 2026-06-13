#!/usr/bin/env node
/**
 * MUHKAM Style-Hex Fixer
 * Replaces hard-coded hex color literals inside JSX style prop objects with
 * design-system CSS variable tokens.
 *
 * Skips marketing/landing pages that have intentional brand-color overrides
 * (those files receive a file-level eslint-disable comment instead).
 *
 * Usage: node scripts/fix-style-hex.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const SRC_ROOT = new URL('../src', import.meta.url).pathname;

/* Files that keep raw hex (file-level eslint-disable handles them instead) */
const SKIP = new Set([
  'pages/LandingPage.tsx',
  'pages/landing/LandingMockups.tsx',
]);

/*
 * Lowercase hex → CSS variable token.
 * The regex matches case-insensitively; keys are lowercase for normalisation.
 */
const HEX_MAP = {
  /* ── Status: warning (amber) ── */
  '#f59e0b': 'var(--status-warning)',
  /* ── Status: danger (red tones) ── */
  '#ef4444': 'var(--status-danger)',
  '#f87171': 'var(--status-danger)',
  /* ── Status: success (green / emerald) ── */
  '#22c55e': 'var(--status-success)',
  '#34d399': 'var(--status-success)',
  '#6ee7b7': 'var(--status-success)',
  '#10b981': 'var(--status-success)',
  /* ── Status: info (blue / indigo) ── */
  '#818cf8': 'var(--status-info)',
  '#93c5fd': 'var(--status-info)',
  '#60a5fa': 'var(--status-info)',
  '#3b82f6': 'var(--status-info)',
  /* ── Text primary (near-white; inverts to dark in light mode) ── */
  '#fff':     'var(--text-1)',
  '#ffffff':  'var(--text-1)',
  '#f1f5f9':  'var(--text-1)',
  '#f8fafc':  'var(--text-1)',
  /* ── Text secondary (muted slate) ── */
  '#94a3b8': 'var(--text-2)',
  '#64748b': 'var(--text-2)',
  '#cbd5e1': 'var(--text-2)',
  /* ── App background (very dark) ── */
  '#0f172a': 'var(--bg-app)',
  '#0f1729': 'var(--bg-app)',
  '#0f1629': 'var(--bg-app)',
  '#0f0f19': 'var(--bg-app)',
  '#0b1220': 'var(--bg-app)',
  '#0b0f14': 'var(--bg-app)',
  '#0d1117': 'var(--bg-app)',
  '#111':    'var(--bg-app)',
  /* ── Dark text / icon on coloured badge (inverts correctly) ── */
  '#0a0500': 'var(--text-1)',
  '#0d1f00': 'var(--text-1)',
  '#000':    'var(--text-1)',   /* text on brand button in layout.tsx */
  '#000000': 'var(--text-1)',
  /* ── Status: success (deeper greens) ── */
  '#059669': 'var(--status-success)',
  /* ── Status: danger (deeper reds / orange-reds) ── */
  '#dc2626': 'var(--status-danger)',
  '#b91c1c': 'var(--status-danger)',
  '#c2410c': 'var(--status-danger)',
  '#fca5a5': 'var(--status-danger)',
  /* ── Status: warning (deeper ambers / orange) ── */
  '#d97706': 'var(--status-warning)',
  '#92400e': 'var(--status-warning)',
  '#fbbf24': 'var(--status-warning)',
  '#f97316': 'var(--status-warning)',
  /* ── Status: info (indigo / violet / blue-600) ── */
  '#6366f1': 'var(--status-info)',
  '#2563eb': 'var(--status-info)',
  '#8b5cf6': 'var(--status-info)',
  '#a78bfa': 'var(--status-info)',
  '#7c3aed': 'var(--status-info)',
  /* ── Text secondary (additional slate grays) ── */
  '#475569': 'var(--text-2)',
  '#6b7280': 'var(--text-2)',
  '#374151': 'var(--text-2)',
  '#e2e8f0': 'var(--text-1)',
  /* ── Additional status tones (light shades / cyan) ── */
  '#86efac': 'var(--status-success)',   /* green-300  */
  '#06b6d4': 'var(--status-info)',      /* cyan-500   */
  '#c4b5fd': 'var(--status-info)',      /* violet-300 */
};

function walkDir(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walkDir(full));
    else if (extname(full) === '.tsx') out.push(full);
  }
  return out;
}

const counts = {};
let filesModified = 0;
let totalReplacements = 0;

for (const file of walkDir(SRC_ROOT)) {
  const rel = relative(SRC_ROOT, file);
  if (SKIP.has(rel)) { console.log(`skip  ${rel}`); continue; }

  const original = readFileSync(file, 'utf8');
  const updated = original.replace(/(['"])(#[0-9a-fA-F]{3,8})\1/g, (m, q, hex) => {
    const token = HEX_MAP[hex.toLowerCase()];
    if (!token) return m;
    const key = `${hex}→${token}`;
    counts[key] = (counts[key] || 0) + 1;
    totalReplacements++;
    return `${q}${token}${q}`;
  });

  if (updated !== original) {
    if (!DRY_RUN) writeFileSync(file, updated);
    filesModified++;
    console.log(`${DRY_RUN ? 'would fix' : 'fixed'} ${rel}`);
  }
}

console.log(`\n${ DRY_RUN ? '[DRY RUN] ' : '' }${totalReplacements} replacements in ${filesModified} files`);
if (Object.keys(counts).length) {
  for (const [k, v] of Object.entries(counts).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
}
