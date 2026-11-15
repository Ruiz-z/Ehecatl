# Ehécatl

Herramienta de decisión para **rotación y cambio de cultivos** con datos NASA. Proyecto para el NASA Space Apps Challenge 2026, reto [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).

## Estado

API, Geo y web integrados, con migraciones y seed automáticos en Compose. El motor combina datos NASA reales, contexto de zona y prioridades, y compara alternativas con mantener el cultivo actual. Evidencias y pendientes humanos en [`docs/pendientes-verificacion.md`](docs/pendientes-verificacion.md).

## Docker

Requisitos: Docker Engine y Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:3001/health
- Geo: http://localhost:8000/health
- PostgreSQL 16: localhost:5432, con volumen nombrado `postgres_data`.

Antes de levantar el stack, definir en `.env` un `JWT_SECRET` aleatorio de al menos 32 bytes y `SEED_DEMO_PASSWORD` de 12–72 bytes. `.env` está ignorado por Git. Los valores de PostgreSQL del ejemplo son exclusivamente para desarrollo local.

Compose espera a PostgreSQL y Geo saludables. La API aplica `prisma migrate deploy`, ejecuta el seed ya compilado con `GEO_URL=http://geo:8000` y después empieza a escuchar. La primera precarga consulta NASA real y puede tardar varios minutos (margen del healthcheck: 10 minutos). Si falla la migración o falta NASA utilizable, el proceso termina con un error; tras recuperar la fuente, reintentar `docker compose up -d api`.

Usuarios demo: `admin@demo.ehecatl`, `coahuila@demo.ehecatl`, `nevada@demo.ehecatl` y `mendoza@demo.ehecatl`; todos usan `SEED_DEMO_PASSWORD`. El seed es idempotente; cada arranque restablece los perfiles demo y sus prioridades, sin duplicar usuarios ni parcelas. Los perfiles siguen sujetos a H3. No ejecutar `docker compose down -v` sobre una base que se quiera conservar: elimina sus datos.

El front de Compose usa la API real (`NEXT_PUBLIC_USE_MOCKS=false` por defecto); tanto esa opción como `NEXT_PUBLIC_API_URL` se inyectan en el build. Si se cambia cualquiera, reconstruir `web`. El modo de ejemplo local sigue disponible y se marca visiblemente.

## Desarrollo local

Requisitos: Node.js 24 LTS (fijado en `.nvmrc`; usa `nvm use` o `fnm use`), pnpm 10.34.9 y uv. Python 3.12 se selecciona mediante `apps/geo/.python-version`.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
uv sync --project apps/geo --frozen
docker compose up -d postgres
pnpm dev
```

Detener antes los contenedores `api`, `geo` y `web` si ocupan los mismos puertos. La API necesita `DATABASE_URL`; Geo no usa PostgreSQL. Los archivos `.env.example` de cada app documentan la configuración local, y el de la raíz configura Compose. `NEXT_PUBLIC_API_URL` se inyecta durante el build web.

## Verificación

```bash
pnpm build
pnpm lint
pnpm test
pnpm --filter api test
(cd apps/geo && uv run python -m pytest)
pnpm --filter web build
docker compose config -q
```

`pnpm test` ejecuta Jest en API y pytest vía uv en Geo; la página web mínima no contiene lógica que requiera tests unitarios. `pnpm lint` ejecuta tipos estrictos en API, compilación sintáctica en Python y ESLint más tipos estrictos en web. Los detalles están en el README de cada app.

## Documentación
- [`docs/constitution.md`](docs/constitution.md) — reglas y alcance del proyecto
- [`docs/specs/`](docs/specs) — specs por módulo (borradores)
- [`docs/fuentes-agronomicas.md`](docs/fuentes-agronomicas.md) — fuentes del catálogo de cultivos y reglas de rotación
- [`tasks/plan.md`](tasks/plan.md) y [`tasks/todo.md`](tasks/todo.md) — plan y tareas (H humano · I infra · B backend · F front)
- [`AGENTS.md`](AGENTS.md) — guía para trabajar en el repo

## Módulos
`identity` · `farm-context` · `nasa-data` · `crop-knowledge` · `rotation-engine` · `web-ui` · `iot-optional` (stretch)
