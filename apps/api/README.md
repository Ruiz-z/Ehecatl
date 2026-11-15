# API

Preparación ESP32: [guía de dispositivos, simulador y calibración](../../docs/preparacion-sensores.md). Aplicar `pnpm --filter api exec prisma migrate deploy` en desarrollo antes de usar sensores. `pnpm --filter api sensors:simulate` requiere una clave local de dispositivo `SIMULATED`. Ninguna respuesta ordena riego.

Desde la raíz: `pnpm install`. Copiar `apps/api/.env.example` a `apps/api/.env` y levantar PostgreSQL con `docker compose up -d postgres`.

- Desarrollo: `pnpm --filter api dev` (puerto 3001).
- Build: `pnpm --filter api build`.
- Ejecución del build: `pnpm --filter api start`.
- Test HTTP de health, sin BD: `pnpm --filter api test`.
- Verificación estática TypeScript: `pnpm --filter api lint`.

Prisma genera el cliente en desarrollo/build/lint. La URL se configura en `prisma.config.ts`. El esquema incluye usuarios, parcelas, zonas, historial, prioridades y caché NASA. Al arrancar, `PrismaService` abre la conexión y ejecuta `SELECT 1`; si PostgreSQL no responde, la API no empieza a escuchar. `/health` comprueba que el proceso HTTP responde.

Docker usa el contexto de la raíz: `docker compose up --build api`. Requiere `JWT_SECRET` y `SEED_DEMO_PASSWORD` en el `.env` raíz. Espera a PostgreSQL y Geo; el entrypoint aplica migraciones y ejecuta `dist-seed/prisma/seed.js` antes de iniciar Nest. La imagen incluye el seed y el catálogo compilados, sin compilar TypeScript durante el arranque. El seed usa `GEO_URL=http://geo:8000`, precarga NASA real y se repite idempotentemente al reiniciar. Véase [BACKEND.md](BACKEND.md).
