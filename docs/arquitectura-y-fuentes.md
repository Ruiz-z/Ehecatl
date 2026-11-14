# Ehécatl: herramientas, arquitectura, APIs y datos NASA

Resumen de lo que se usa en el proyecto, a 2026-11-14 (estado de `origin/dev` más la rama `feat/f-diseno-web`). Detalle de contratos en [`contracts.md`](contracts.md); clasificación de fuentes NASA en [`fuentes-nasa-clasificacion.md`](fuentes-nasa-clasificacion.md).

## 1. Arquitectura

```
Navegador ── apps/web (Next.js, :3000)
                 │  fetch + JWT  (o fixtures con NEXT_PUBLIC_USE_MOCKS=true)
                 ▼
            apps/api (NestJS, :3001) ──── PostgreSQL 16 (:5432)
                 │  HTTP interno (GEO_URL)
                 ▼
            apps/geo (FastAPI, :8000) ──── NASA POWER · MODIS (ORNL DAAC)
```

| Pieza | Responsabilidad |
|---|---|
| `apps/web` | Interfaz: login, parcelas, estado, datos NASA, «Qué sembrar». |
| `apps/api` | Auth JWT, parcelas/zonas/historial/prioridades, catálogo de cultivos, **motor de rotación**, caché persistida de indicadores NASA. |
| `apps/geo` | Ingesta NASA, normalización mensual, climatología (normal de 10 años), anomalías, tendencias y ventanas de cultivo. Sin base de datos. |
| PostgreSQL | Modelos Prisma: `User`, `Priorities`, `Parcel`, `Zone`, `CropHistory`, `NasaCache`. |
| Docker Compose | Levanta `postgres`, `api`, `geo` y `web` con `docker compose up --build`. |

Flujo de una recomendación: el web pide `GET /zones/:id/recommendations` → la API lee la zona, sus prioridades y los indicadores (de caché o de `geo`) → el motor puntúa secuencias de cultivo → responde 3 estrategias con puntaje 0–100.

## 2. Herramientas y stack

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm 10.34.9, Turborepo, Node 24 (`.nvmrc`) |
| API | NestJS 12, Prisma 7.10 (+ `@prisma/adapter-pg`), PostgreSQL 16, JWT (`@nestjs/jwt`), bcrypt, Jest + supertest |
| Geo | Python ≥3.11 (3.12), FastAPI, httpx, uvicorn, uv, pytest |
| Web | Next.js 16 (App Router), React, Tailwind, shadcn/ui, lucide-react, Leaflet + react-leaflet, Recharts |
| Mapa base | Esri World Imagery (satelital, con atribución) |
| Infra | Docker Compose, healthchecks en `/health` de api y geo |
| Calidad | ESLint, TypeScript 6 estricto, Jest, pytest |
| Proceso | Spec-Driven Development (specs en `docs/specs/`), Conventional Commits en español |
| Diseño | `docs/design.md` (paleta «Lima»), referencia Harvestiq (Figma) y OneSoil; Figma MCP; Codex CLI para la implementación visual |

## 3. APIs propias

### API (`apps/api`, puerto 3001)
Públicas: `GET /health`, `POST /auth/login` (`{email,password}` → JWT, 1 h). Todo lo demás exige `Authorization: Bearer`.

| Ruta | Uso |
|---|---|
| `GET /crops` | Catálogo de cultivos con fuentes |
| `GET/POST /parcels`, `GET/PATCH/DELETE /parcels/:id` | Parcelas (al crear se genera una zona por defecto) |
| `GET/POST /parcels/:id/zones`, `GET/PATCH/DELETE /zones/:id` | Zonas |
| `GET/POST /zones/:id/history`, `PATCH/DELETE /zones/:id/history/:historyId` | Historial de cultivos |
| `GET/PUT /me/priorities` | Pesos agua / suelo / ingreso / riesgo (suman 100) |
| `GET /zones/:id/indicators?start=&end=` | Indicadores NASA de la zona (caché, TTL 24 h) |
| `GET /zones/:id/recommendations` | Estrategias de rotación con puntaje |

Reglas de acceso: 401 genérico, 403 por dueño o rol, 404 inexistente, 400 entrada inválida. El administrador lee cualquier parcela.

### Geo (`apps/geo`, puerto 8000)
`GET /health` y `GET /indicators?lat&lon&start&end[&irrigated][&baselineYears]`. Responde `monthly`, `climatology`, `anomalies`, `trends`, `windows`, `warnings`, el `origin` (`live|cache|mock`) y el estado de cada fuente.

### Variables de entorno relevantes
`DATABASE_URL`, `JWT_SECRET`, `GEO_URL`, `NASA_CACHE_TTL_HOURS` (24), `GEO_TIMEOUT_MS`, `NASA_TIMEOUT_SECONDS` (30), `NASA_TOTAL_TIMEOUT_SECONDS` (120), `WEB_ORIGINS`, `SEED_DEMO_PASSWORD`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCKS`. Nada de secretos en el repo; van en `.env`.

## 4. Datos NASA que usamos (sin cuenta ni API key)

| Variable | Fuente | Parámetro | Resolución | Para qué |
|---|---|---|---|---|
| Temperatura media, máxima y mínima | NASA POWER (comunidad `AG`) | `T2M`, `T2M_MAX`, `T2M_MIN` | ~0.5° (~50 km) | Ventanas de cultivo, calor |
| Precipitación | NASA POWER | `PRECTOTCORR` (mm/día → mm/mes con días reales) | ~0.5° | Agua disponible, sequía |
| Humedad relativa | NASA POWER | `RH2M` | ~0.5° | Estado de la parcela |
| Radiación solar | NASA POWER | `ALLSKY_SFC_SW_DWN` | ~0.5° | Contexto agroclimático |
| Humedad de suelo (superficie / raíz) | NASA POWER | `GWETTOP`, `GWETROOT` (fracción 0–1) | ~0.5° | Estrés hídrico, ventanas |
| Vigor de vegetación | MODIS MOD13Q1 vía ORNL DAAC | `250m_16_days_NDVI` (factor 0.0001) | 250 m | Salud del cultivo, vegetación estresada |

Endpoints: `https://power.larc.nasa.gov/api/temporal/monthly/point` y `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset`.

Tratamiento de los datos: el relleno `-999` de POWER se vuelve `null`; `YYYY13` (promedio anual) se descarta; MODIS se pide en lotes de 10 fechas, con hasta 3 consultas concurrentes, y se filtran relleno y calidad. No se interpola ni se inventa nada; si una fuente falla se devuelven las demás y la faltante se marca no disponible.

Qué se calcula a partir de ellos:
- **Normal histórica:** media mensual de los 10 años completos anteriores al periodo consultado.
- **Anomalías:** observación menos normal, absoluta y en porcentaje.
- **Tendencias** (heurísticas del prototipo, pendientes de validación H4): sequía (lluvia ≤ −25 % de lo normal), calor (≥ +2 °C), vegetación estresada (NDVI ≤ −20 %), lluvia errática (CV ≥ 0.75). Ver `apps/geo/THRESHOLDS.md`.
- **Ventanas de cultivo:** meses consecutivos con temperatura media de 10–35 °C y agua suficiente (lluvia ≥ 40 mm/mes, humedad de raíz ≥ 0.4 o riego declarado), con horizonte de 24 meses. Sirven en ambos hemisferios.

Limitaciones que hay que decir en el pitch:
- POWER es de resolución gruesa (~50 km): da la línea base climática; MODIS aporta el vigor local a 250 m.
- `GWETTOP` y `GWETROOT` son estimaciones de modelo de POWER, no datos SMAP directos.
- Las sugerencias son aptitud climática, no pronósticos; cada tarjeta lleva el aviso de validación local.

### Fuera del MVP
SMAP, GPM/IMERG, ECOSTRESS, Landsat y Sentinel-2 requieren cuenta Earthdata/Copernicus y manejo de rásteres, así que quedan como stretch. Los conjuntos solo de EE. UU. (SSURGO, CropScape, PRISM, etc.) tampoco entran en el núcleo. Ver la clasificación completa en [`fuentes-nasa-clasificacion.md`](fuentes-nasa-clasificacion.md).

## 5. Otras fuentes (no NASA)

| Fuente | Uso |
|---|---|
| FAO GAEZ / ECOCROP, SARE, USDA Ag Data Commons | Catálogo de cultivos y reglas de transición entre familias (`crops.json`, `family-transitions.json`); detalle en [`fuentes-agronomicas.md`](fuentes-agronomicas.md) |
| SIAP / FAOSTAT / NASS QuickStats | Respaldo del `marketValueTier` (bajo/medio/alto); si no hay fuente se marca «estimado» |
| Esri World Imagery | Mapa satelital de fondo |

## 6. Motor de rotación (resumen)

- Puntaje 0–100 con cuatro ejes: **agua, suelo, ingreso, riesgo**. Pesos por defecto 25 % cada uno; el agricultor los ajusta con sliders.
- Siempre calcula la estrategia **«mantener lo actual»** con las mismas reglas y la muestra junto a las 2 mejores alternativas, con la diferencia en puntos.
- Compatibilidad entre familias de cultivo (buena, neutra, a evitar) y ventanas de siembra por zona.
- Salida determinista: ante empate, menor riesgo, nombre e identificador.
- Cada resultado trae `explanation` y `risks`, la confianza (alta, media, baja) y el aviso de validación local.
- El eje de ingreso es un indicador heurístico de oportunidad, no precio ni rentabilidad.

## 7. Estado y pendientes

- Front: completo con fixtures (rama `feat/f-diseno-web`, PR #10). Falta conectarlo al backend real (`NEXT_PUBLIC_USE_MOCKS=false` y ajustar el contrato).
- Backend en `dev`: auth, parcelas/zonas, catálogo, indicadores, motor y caché.
- Aprobaciones humanas pendientes: H2 (contratos), H3 (perfiles demo), H4 (agronomía y umbrales).
- Por verificar: nombre de la banda de calidad de MODIS en ORNL; límites de OpenTopoData si se decide usar SRTM.
