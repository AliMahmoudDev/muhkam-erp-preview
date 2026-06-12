import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');

const DANGEROUS_DIRECT_PATTERNS = [
  /localStorage\.(getItem|setItem|removeItem)\(['"]halal_erp_settings['"]/,
  /localStorage\.(getItem|setItem|removeItem)\(['"]erp_subscription['"]/,
  /localStorage\.(getItem|setItem|removeItem)\(['"]erp_current_warehouse_id['"]/,
  /localStorage\.(getItem|setItem|removeItem)\(['"]muhkam_held_invoices['"]/,
  /localStorage\.(getItem|setItem|removeItem)\(['"]pos:lastWarehouse['"]/,
  /localStorage\.(getItem|setItem|removeItem)\(['"]pos:lastSafe['"]/,
  /const\s+draftKey\s*=\s*`delivery-gate-draft:\$\{job\.id\}`/,
];

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage']);

function walk(dir: string): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;

    const full = join(dir, entry);
    const st = statSync(full);

    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }

  return out;
}

describe('tenant localStorage isolation guard', () => {
  it('does not use dangerous tenant data keys directly in localStorage', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_DIR)) {
      if (file.includes('__tests__')) continue;

      const content = readFileSync(file, 'utf8');
      for (const pattern of DANGEROUS_DIRECT_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(file.replace(process.cwd() + '/', ''));
          break;
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
