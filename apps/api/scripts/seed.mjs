import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Prisma ejecuta un programa directamente; no interpreta && como un shell.
for (const args of [
  [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-p', 'tsconfig.seed.json'],
  ['scripts/copy-assets.mjs', '--seed'],
  ['dist-seed/prisma/seed.js'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
