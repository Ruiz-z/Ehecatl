# Tareas — Ehécatl

Tareas separadas por tipo para repartir entre varias personas. Traspaso de pendientes: [`docs/pendientes-equipo.md`](../docs/pendientes-equipo.md).

| Prefijo | Tipo | Quién |
|---|---|---|
| **H** | Humano: decisiones, revisiones, diseño, pitch, ensayo | Cualquiera del equipo; no se delega a un agente |
| **I** | Infraestructura: monorepo, scaffolds, Docker, empaquetado | Persona de infra |
| **B** | Backend: API (NestJS), datos NASA (Python), motor de rotación | Personas de backend |
| **F** | Front: web Next.js | Persona de front |

Cada tarea técnica: < 30 min, tests primero, deja el sistema funcionando. Formato: **Hecho cuando** · **Verificar** · **Archivos** · **Depende de** · **Specs**.

---

## H — Humano

- [x] **H1: Revisar reglas del hackatón sobre código previo**
  - Resuelto: no hay reglas sobre código previo; SmartRiego MX se puede usar como referencia.

- [ ] **H2: Aprobar contratos JSON**
  - Hecho cuando: todo el equipo acepta `docs/contracts.md` (B1); a partir de ahí no se cambian sin avisar.
  - Depende de: B1

- [ ] **H3: Elegir puntos y perfiles demo**
  - Hecho cuando: hay ≥3 agricultores definidos (Coahuila, Nevada y uno del hemisferio sur) con cultivo actual, historial, riego sí/no y prioridades distintas, y realidades contrastantes (árido con estrés hídrico y monocultivo, agua subterránea restringida, zona húmeda con erosión).
  - Depende de: — · Alimenta: B18

- [ ] **H4: Revisar fuentes agronómicas del catálogo**
  - Hecho cuando: cada cultivo de `crops.json` y cada regla de transición entre familias cita una fuente de [`docs/fuentes-agronomicas.md`](../docs/fuentes-agronomicas.md), y los links marcados "no verificado" se comprobaron a mano.
  - Depende de: B11

- [ ] **H5: Diseño de pantallas e identidad visual (etapa de diseño SDD)**
  - Se hace **después del backend**, con lo ya contemplado en la spec 006 y los contratos reales de la API.
  - Hecho cuando: login, lista de parcelas con mapa y detalle de zona (indicadores + recomendaciones + prioridades) aprobados.
  - Depende de: B17 · Specs: 006 · Bloquea: F1–F5

- [ ] **H6: Guion de demo, pitch y slides**
  - Hecho cuando: guion de 3–5 min que muestra los tres insumos (NASA, contexto local, prioridades), el cambio de cultivo y un punto nuevo en vivo.
  - Depende de: H3

- [ ] **H7: Validación RF por RF y veredicto**
  - Hecho cuando: tabla RF → test → resultado para specs 001–006 y veredicto "spec cumplida / no" (prompt de validación de `sdd/prompts.md`).
  - Depende de: todas las B y F

- [ ] **H8: Ensayo de demo completo**
  - Hecho cuando: se corre la demo desde `docker compose up` siguiendo el guion, sin red lenta (caché precargada).
  - Depende de: I5, H6

---

## I — Infraestructura

- [x] **I1: Monorepo + Docker Compose con Postgres**
  - Hecho cuando: `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml` con servicio `postgres` y `.env.example`; `.env` ignorado en git.
  - Verificar: `docker compose up postgres` y `pg_isready` responde.
  - Archivos: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`, `.env.example`, `.gitignore`
  - Depende de: — · Specs: constitución #2, #13

- [x] **I2: Scaffold `apps/api` (NestJS + Prisma) con `/health`**
  - Hecho cuando: Nest arranca, Prisma conectado a Postgres, `GET /health` → 200; servicio `api` en compose.
  - Verificar: `pnpm --filter api test` y `curl localhost:3001/health`.
  - Archivos: `apps/api/**` (main, app.module, prisma module, health), `apps/api/Dockerfile`
  - Depende de: I1

- [x] **I3: Scaffold `apps/geo` (FastAPI) con `/health`**
  - Hecho cuando: FastAPI + httpx + pytest; `GET /health` → 200; servicio `geo` en compose.
  - Verificar: `python -m pytest` en `apps/geo` y `curl localhost:8000/health`.
  - Archivos: `apps/geo/app/main.py`, `apps/geo/pyproject.toml`, `apps/geo/tests/test_health.py`, `apps/geo/Dockerfile`
  - Depende de: I1

- [x] **I4: Scaffold `apps/web` (Next.js + shadcn)**
  - Hecho cuando: Next arranca con página vacía, shadcn inicializado, servicio `web` en compose.
  - Verificar: `pnpm --filter web build` y abrir `localhost:3000`.
  - Archivos: `apps/web/**`, `apps/web/Dockerfile`
  - Depende de: I1

- [ ] **I5: Compose desde cero (migraciones + seed automáticos)**
  - Hecho cuando: `docker compose down -v && docker compose up --build` deja la demo lista, con migraciones y seed aplicados al arrancar.
  - Verificar: ejecución completa en una máquina limpia.
  - Archivos: `docker-compose.yml`, `apps/api/Dockerfile`, script de entrypoint
  - Depende de: B18 · Specs: constitución #2

### Checkpoint I
- [x] `docker compose up --build` levanta postgres, api, geo y web con `/health` en verde (I1–I4).

---

## B — Backend

> Implementación y verificación local: `feat/backend-integracion`; ver `docs/backend-verification.md`. H2, H3 y H4 siguen pendientes. B7 tiene cliente y tests sintéticos, pero falta fixture real por timeouts/503 de ORNL. B18 tiene seed idempotente y precarga POWER real verificados; falta aprobación humana de perfiles H3. Los checkpoints NASA se verificaron con respuestas parciales: MODIS no disponible, confianza reducida.

### Contratos
- [x] **B1: Contratos JSON entre apps**
  - Hecho cuando: `docs/contracts.md` define `GET geo /indicators` (indicadores mensuales, anomalías, tendencias, ventanas, `origin`) y `GET api /zones/:id/recommendations` (secuencias, puntaje 0–100, explicación, riesgos, confianza) con ejemplos.
  - Verificar: aprobación en H2; los ejemplos se usan como fixtures de test.
  - Archivos: `docs/contracts.md`
  - Depende de: — · Specs: 003, 005

### API — identity y farm-context (NestJS)
- [x] **B2: Identity — modelo User, login JWT, guard**
  - Hecho cuando: `POST /auth/login` devuelve JWT; credenciales malas → 401 genérico; password con bcrypt; guard de JWT y decorador de rol.
  - Verificar: tests unitarios del servicio + integración del endpoint.
  - Archivos: `prisma/schema.prisma`, `modules/identity/*`
  - Depende de: I2 · Specs: 001 RF-1..3

- [x] **B3: Parcelas y zonas con ownership**
  - Hecho cuando: CRUD de `Parcel` (lat/lon validados, 400 fuera de rango), zona por defecto al crear, CRUD de `Zone`; Agricultor ajeno → 403; Admin accede a todo; borrado en cascada.
  - Verificar: tests de ownership (propio, ajeno, admin) y de validación de coordenadas.
  - Archivos: `schema.prisma`, `modules/farm-context/parcels/*`, `modules/farm-context/zones/*`
  - Depende de: B2 · Specs: 001 RF-4..5, 002 RF-1, 2, 5, 5b, 6, 7

- [x] **B4: Historial de cultivos y prioridades**
  - Hecho cuando: `CropHistory` por zona con fechas reales; `PUT /me/priorities` normaliza pesos (25 cada uno por defecto); cultivo fuera del catálogo → 400.
  - Verificar: tests de normalización y de validación de cultivo.
  - Archivos: `schema.prisma`, `modules/farm-context/history/*`, `modules/farm-context/priorities/*`
  - Depende de: B3, B11 · Specs: 002 RF-3, 4

- [x] **B5: `GET /crops`**
  - Hecho cuando: expone el catálogo con la fuente de cada cultivo.
  - Verificar: test del endpoint.
  - Archivos: `modules/crop-knowledge/crops.controller.ts`
  - Depende de: B11 · Specs: 004 RF-2, 3

### Datos NASA (Python, `apps/geo`)
- [x] **B6: Cliente NASA POWER + normalización**
  - Hecho cuando: obtiene `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `GWETTOP`, `GWETROOT` mensuales; `-999` → faltante; indicador con valor, unidad, fuente, fecha y resolución.
  - Verificar: pytest con respuesta grabada (fixture) + una prueba manual en vivo.
  - Archivos: `apps/geo/app/sources/power.py`, `apps/geo/tests/test_power.py`, `tests/fixtures/power_*.json`
  - Depende de: I3, B1 · Specs: 003 RF-1, 3

- [ ] **B7: Cliente MODIS NDVI (ORNL DAAC)**
  - Hecho cuando: serie NDVI MOD13Q1 con escala 0.0001 aplicada, agregada por mes; sin cobertura → no disponible.
  - Verificar: pytest con fixture grabada.
  - Archivos: `apps/geo/app/sources/modis.py`, `apps/geo/tests/test_modis.py`
  - Depende de: I3, B1 · Specs: 003 RF-2

- [x] **B8: Climatología, anomalías y tendencias**
  - Hecho cuando: normal mensual de 10 años por punto; anomalía del periodo reciente; clasificación sequía / calor / lluvia errática / vegetación estresada con umbrales documentados.
  - Verificar: pytest con series sintéticas que disparan cada tendencia.
  - Archivos: `apps/geo/app/analysis/climatology.py`, `apps/geo/tests/test_climatology.py`
  - Depende de: B6, B7 · Specs: 003 RF-4

- [x] **B9: Ventanas de cultivo por zona**
  - Hecho cuando: desde la climatología mensual calcula ventanas (meses consecutivos con temperatura útil y agua suficiente; `irrigated=true` relaja la condición de agua); funciona en ambos hemisferios y cruzando fin de año.
  - Verificar: pytest con casos: tropical (1 ventana larga), semiárido (0 sin riego, ≥1 con riego), hemisferio sur, ventana diciembre–febrero.
  - Archivos: `apps/geo/app/analysis/windows.py`, `apps/geo/tests/test_windows.py`
  - Depende de: B8 · Specs: 003 RF-3b

- [x] **B10: Endpoint `GET /indicators`**
  - Hecho cuando: responde según el contrato; si una fuente falla devuelve el resto con la faltante marcada; timeout configurable; 400 para rango inválido.
  - Verificar: pytest con una fuente simulada caída.
  - Archivos: `apps/geo/app/routes/indicators.py`, `apps/geo/tests/test_indicators.py`
  - Depende de: B9 · Specs: 003 RF-6, 7

### Motor de rotación y catálogo (TS, funciones puras)
- [ ] **B11: Catálogo de cultivos + validador**
  - Hecho cuando: `crops.json` con 15–20 cultivos (familia, rango de temperatura, demanda hídrica, días de ciclo, sensibilidad a heladas, balance de N, cobertura, tolerancia a sequía, `marketValueTier` bajo/medio/alto con fuente o «estimado», perenne, fuente) y tabla de compatibilidad entre familias con razón; la carga falla indicando cultivo y campo faltante.
  - Verificar: test del validador (catálogo válido y uno roto); revisión humana en H4.
  - Archivos: `modules/crop-knowledge/data/crops.json`, `data/family-transitions.json`, `crop-catalog.ts`, `crop-catalog.spec.ts`
  - Depende de: I2 · Specs: 004 RF-1, 2, 4, 5

- [x] **B12: Reglas de transición A → B**
  - Hecho cuando: puntaje de transición por familia, balance de N, ruptura de plagas y cobertura, cada regla con su razón legible.
  - Verificar: tests (cereal → leguminosa favorable, misma familia penalizada).
  - Archivos: `modules/rotation-engine/engine/transitions.ts`, `transitions.spec.ts`
  - Depende de: B11 · Specs: 005 RF-2

- [x] **B13: Viabilidad de cultivo en una ventana**
  - Hecho cuando: compara requisitos del cultivo con la ventana (temperatura, agua, duración, heladas) y las tendencias NASA; marca riesgo alto del cultivo actual ante sequía o calor.
  - Verificar: tests con los indicadores de ejemplo del contrato (B1).
  - Archivos: `engine/viability.ts`, `viability.spec.ts`
  - Depende de: B11, B1 · Specs: 005 RF-3, 4

- [ ] **B14: Generación de secuencias y scoring ponderado**
  - Hecho cuando: genera secuencias para las siguientes 2–3 ventanas (perennes ocupan varias), puntaje 0–100 ponderado por prioridades, 2 mejores alternativas más la estrategia 0 «mantener lo actual» calculada con las mismas reglas y pesos (con diferencia de puntaje), explicación (variables y reglas que más pesaron) y riesgos; el eje ingreso sale de `marketValueTier`.
  - Verificar: tests: mismas condiciones + prioridades distintas → ranking distinto; determinismo; la estrategia 0 siempre presente y con las mismas reglas.
  - Archivos: `engine/sequences.ts`, `engine/score.ts`, `*.spec.ts`
  - Depende de: B12, B13 · Specs: 005 RF-1, 1c, 5, 6, 9

- [x] **B15: Casos límite del motor**
  - Hecho cuando: sin opciones viables → "ninguna viable" con razones; menos de 2 ventanas → secuencia reducida o cobertura/barbecho; datos faltantes o sin historial → confianza menor; desempate estable.
  - Verificar: tests de cada caso.
  - Archivos: `engine/*.ts`, `engine/edge-cases.spec.ts`
  - Depende de: B14 · Specs: 005 RF-1b, 7, 8

### Integración
- [x] **B16: Caché NASA en `api`**
  - Hecho cuando: cliente HTTP `api → geo`, tabla `NasaCache`, se sirve de caché si está vigente, `origin` correcto (`live`/`cache`).
  - Verificar: test de integración con `geo` simulado (hit y miss).
  - Archivos: `schema.prisma`, `modules/nasa-data/*`
  - Depende de: I2, B1 · Specs: 003 RF-5, 7

- [ ] **B17: `GET /zones/:id/recommendations`**
  - Hecho cuando: junta zona + historial + prioridades + indicadores (caché) + catálogo, ejecuta el motor y responde según el contrato (3 estrategias: actual + 2 alternativas); respeta ownership.
  - Verificar: test de integración + `curl` contra una zona real.
  - Archivos: `modules/rotation-engine/rotation.controller.ts`, `rotation.service.ts`, `*.spec.ts`
  - Depende de: B4, B10, B15, B16 · Specs: 005 RF-1..9

- [ ] **B18: Seed demo + precarga de caché**
  - Hecho cuando: 1 admin + los agricultores definidos en H3, con zonas, historial y prioridades; caché NASA precargada para sus puntos.
  - Verificar: `pnpm --filter api prisma db seed` y recomendaciones distintas por usuario.
  - Archivos: `apps/api/prisma/seed.ts`
  - Depende de: B17, H3 · Specs: 001 RF-6, 003 RF-8

### Checkpoints B
- [x] Dos agricultores distintos no ven sus parcelas mutuamente; el admin ve todas (B2–B3).
- [x] `GET /indicators` devuelve datos reales para Coahuila, Nevada y un punto del hemisferio sur (B6–B10).
- [x] `pnpm test` y `pytest` en verde; una zona real devuelve recomendaciones explicadas con datos NASA reales (B17).

---

## F — Front

- [ ] **F1: Login y sesión**
  - Hecho cuando: login funcional y rutas privadas protegidas.
  - Verificar: manual + `pnpm --filter web build`.
  - Depende de: B2, I4, H5 · Specs: 006 RF-1

- [ ] **F2: Parcelas con mapa (Leaflet + OSM)**
  - Hecho cuando: lista de parcelas, crear eligiendo el punto en el mapa o escribiendo lat/lon, zonas por parcela.
  - Verificar: manual.
  - Depende de: B3, F1 · Specs: 006 RF-1, 2

- [ ] **F3: Indicadores NASA de la zona**
  - Hecho cuando: gráficas simples (lluvia, temperatura, humedad de suelo, NDVI) con fuente, fecha, resolución y origen.
  - Verificar: manual.
  - Depende de: B16, F2 · Specs: 006 RF-3

- [ ] **F4: Recomendaciones + prioridades**
  - Hecho cuando: 3 tarjetas (estrategia actual + 2 alternativas) con puntaje, diferencia contra la actual, por qué, riesgos, aviso de validación local y los tres insumos visibles; indicadores NASA en lenguaje llano con semáforo y dato crudo en desplegable; los sliders de prioridades recalculan el ranking.
  - Verificar: manual.
  - Depende de: B17, F3 · Specs: 006 RF-4, 4b, 4c, 5, 7

- [ ] **F5: Estados de carga, vacío y error**
  - Hecho cuando: loaders, fuentes faltantes avisadas, zona sin datos con acción para cargar.
  - Verificar: manual con `geo` apagado.
  - Depende de: F4 · Specs: 006 RF-6

### Checkpoint F
- [ ] Flujo completo en navegador: login → parcela → indicadores → recomendaciones → cambiar prioridades.

---

## Checkpoint final
- [ ] Criterios de "listo para demo" de la constitución cumplidos, incluido un punto nuevo elegido en vivo (H7, H8).

## Stretch (solo si sobra tiempo)
- [ ] **B-S1:** SMAP / IMERG con cuenta de Earthdata (requiere que un humano cree la cuenta).
- [ ] **B-S2:** Adaptador EE. UU. (SSURGO, CDL, NASS) cuando el punto está en EE. UU.
- [ ] **I-S1:** Nodo ESP32 de humedad como verdad de terreno de la zona.
