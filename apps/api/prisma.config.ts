import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'pnpm exec tsc -p tsconfig.seed.json && node scripts/copy-assets.mjs --seed && node dist-seed/prisma/seed.js' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
