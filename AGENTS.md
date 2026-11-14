# AGENTS.md — Ehécatl

## Proyecto
Ehécatl es una herramienta de decisión para **rotación y cambio de cultivos** (NASA Space Apps 2026, reto *Field Shift*). Combina observaciones de la Tierra de la NASA (POWER, IMERG, SMAP, NDVI) con el contexto de cada parcela y las prioridades del agricultor, y recomienda qué cultivo sigue y cuándo cambiar, con explicación. Monorepo: backend NestJS + Prisma + PostgreSQL, web Next.js + shadcn, servicio Python FastAPI (`apps/geo`) para datos NASA, todo empaquetado con Docker Compose.

## Comandos
- Ejecutar todo: `docker compose up --build`
- Desarrollo local: `pnpm dev`
- Tests: `pnpm test` (JS/TS) y `python -m pytest` dentro de `apps/geo`
- Lint/formato: `pnpm lint`

(Se completarán al crear el scaffolding; no inventar comandos que aún no existan.)

## Estilo y convenciones
- TypeScript estricto en backend y web; Python 3.11+ en `apps/geo`.
- Identificadores de código en inglés; documentación, specs y commits en español.
- Arquitectura por dominio: `modules/` y `features/` por negocio; `common/`/`shared/` solo para lo transversal.
- Prisma: uuid, timestamptz, `@@map` snake_case plural, enums para estados.

## Reglas
- Lee `docs/constitution.md` y la spec activa en `docs/specs/` antes de tocar código.
- Cualquier cambio de alcance se hace primero en la spec, nunca directo en el código.
- No agregar frameworks ni dependencias nuevas sin preguntar.
- No hardcodear Coahuila ni Nevada: son fixtures de demo, el sistema debe funcionar para cualquier lat/lon.
- Los mocks de datos NASA solo en tests; en demo deben marcarse.
- Nunca commitear secretos; usar `.env` (no versionado).
- SmartRiego MX (`~/personal/Hackregional`) se puede usar como referencia de specs, modelos y arquitectura.

## Git
- Las ramas se crean siempre a partir de `origin/dev` (`git fetch origin && git switch -c feat/<nombre> origin/dev`), con prefijo según el tipo: `feat/...`, `fix/...` (y `docs/...`, `chore/...` cuando aplique). Nombre en kebab-case, p. ej. `feat/b2-identity`.
- Commits con Conventional Commits en español: `tipo(alcance): descripción` (p. ej. `feat(api): agrega login con JWT`, `fix(geo): ...`, `docs(specs): ...`, `chore(infra): ...`).
- Nunca agregar `Co-Authored-By` ni otra atribución en los commits.
- Nunca hacer `git push` sin autorización explícita.

## Al terminar cualquier tarea
- Ejecutar `pnpm lint` y `pnpm test` (y los tests de `apps/geo` si se tocó) y mostrar el resultado.
- Si se tocó el motor de rotación, la ingesta NASA o el control de acceso: verificar contra los RF de la spec activa antes de marcar la tarea como hecha.
