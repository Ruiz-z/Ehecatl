# Ehécatl

Herramienta de decisión para **rotación y cambio de cultivos** con datos NASA. Proyecto para el NASA Space Apps Challenge 2026, reto [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/).

## Estado

Scaffolding de infraestructura con las apps base y health. Los módulos de negocio se implementan en las tareas B y F.

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

Los valores de PostgreSQL en `.env.example` son exclusivamente para desarrollo local. Compose tiene los mismos valores por defecto para arrancar sin preparación adicional. No hay migraciones ni seed de negocio todavía (I5).

## Desarrollo local

Requisitos: Node.js 24 LTS, pnpm 10.34.9 y uv. Python 3.12 se selecciona mediante `apps/geo/.python-version`.

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
