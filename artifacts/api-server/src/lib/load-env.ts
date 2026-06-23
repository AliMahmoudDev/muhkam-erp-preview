import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads .env as early as possible before modules that read process.env at import time.
 * Existing environment variables are never overwritten.
 */
function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const eq = normalized.indexOf('=');
  if (eq <= 0) return null;

  const key = normalized.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = normalized.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function candidateEnvFiles(): string[] {
  const cwd = process.cwd();
  return [
    process.env.MUHKAM_ENV_FILE,
    path.resolve(cwd, '.env'),
    path.resolve(cwd, 'artifacts/api-server/.env'),
    path.resolve(cwd, '../../.env'),
  ].filter((p): p is string => Boolean(p));
}

for (const envFile of candidateEnvFiles()) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(envFile)) continue;

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const [key, value] = parsed;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    // eslint-disable-next-line security/detect-object-injection
    process.env[key] = value;
  }

  break;
}
