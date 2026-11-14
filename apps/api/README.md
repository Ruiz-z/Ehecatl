# API

Desde la raíz: `pnpm install`. Copiar `apps/api/.env.example` a `apps/api/.env` y levantar PostgreSQL con `docker compose up -d postgres`.

- Desarrollo: `pnpm --filter api dev` (puerto 3001).
- Build: `pnpm --filter api build`.
- Ejecución del build: `pnpm --filter api start`.
- Test HTTP de health, sin BD: `pnpm --filter api test`.
- Verificación estática TypeScript: `pnpm --filter api lint`.

Prisma genera el cliente en desarrollo/build/lint. La URL se configura en `prisma.config.ts`, como requiere Prisma 7. El esquema no contiene modelos de negocio. Al arrancar, `PrismaService` abre la conexión y ejecuta `SELECT 1`; si PostgreSQL no responde, la API no empieza a escuchar. `/health` comprueba que el proceso HTTP responde.

Docker usa el contexto de la raíz: `docker compose up --build api`.
