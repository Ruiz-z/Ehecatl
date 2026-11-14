# Auditoría QA E2E del Backend — 2026-11-14

Reporte de hallazgos obtenido tras levantar el stack real (**PostgreSQL 16 + `apps/geo` FastAPI + `apps/api` NestJS**) y ejecutar las suites de QA E2E ubicadas en:

- `apps/api/test/qa-e2e.spec.ts`
- `apps/geo/tests/test_qa_e2e.py`

> [!NOTE]
> Las pruebas que fallan **no se eliminaron** deliberadamente para que sirvan como especificación ejecutable de regresión al corregir cada punto.

---

## Resumen de ejecución observada

- **API (`pnpm test` con `TEST_DATABASE_URL`, `QA_API_URL` y `SEED_DEMO_PASSWORD`)**:
  - 8 suites pasaron, 1 falló (`test/qa-e2e.spec.ts`).
  - 64 pruebas pasaron, **5 fallaron**.
- **Geo (`pytest -v` con `QA_GEO_URL`)**:
  - 18 pruebas pasaron, **6 fallaron** (en `tests/test_qa_e2e.py`).
- **Seed (`prisma db seed` x2)**: idempotente, precarga NASA POWER real en PostgreSQL (`origin=live` -> `origin=cache`).
- **Funcionalidad core verificada en vivo**: login JWT/bcrypt, `401` genérico, aislamiento multiusuario (`403`), acceso `ADMIN` usando prioridades del dueño, CRUD completo de parcelas/zonas/historial/prioridades, protección `409` al borrar última zona, borrado en cascada, catálogo de 18 cultivos (`GET /crops`), ingesta real NASA POWER (`T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR` en `mm/month`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `GWETTOP`, `GWETROOT`), caché `< 500 ms` y cambio de ranking según prioridades.

---

## Errores y hallazgos por corregir

### 1. `GEO_TIMEOUT_MS=""` en `.env` aborta al instante todas las peticiones a `geo` (`apps/api`)
- **Severidad**: Alta
- **Archivo**: `apps/api/src/modules/nasa-data/nasa.service.ts` (línea 63)
- **Prueba que falla**: `apps/api/test/qa-e2e.spec.ts:94-119` (`QA: Geo timeout vacío en env (GEO_TIMEOUT_MS="") no debe abortar instantáneamente con timeout=0`)
- **Causa raíz**:
  ```ts
  const response = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.GEO_TIMEOUT_MS ?? 130_000)) });
  ```
  Si `GEO_TIMEOUT_MS` existe en entorno con cadena vacía `""`, `??` no aplica y `Number("")` evalúa a `0`, generando `AbortSignal.timeout(0)` y provocando `502 BadGatewayException` inmediato.
  (Mismo patrón de riesgo en `NASA_CACHE_TTL_HOURS` en línea 70: `Number("" ?? 24)` sería `0`, dejando el TTL en 0 ms).
- **Corrección sugerida**: parsear solo si hay valor no vacío y positivo finito (`const parsed = Number(process.env.GEO_TIMEOUT_MS); const timeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 130_000;`), y aplicar la misma validación segura para `NASA_CACHE_TTL_HOURS`.

---

### 2. `GET /zones/:id/indicators?start=&end=` con query vacío devuelve `400` (`apps/api`)
- **Severidad**: Media
- **Archivos**:
  - `apps/api/src/modules/nasa-data/nasa.module.ts` (líneas 11–14)
  - `apps/api/src/modules/nasa-data/nasa.service.ts` (línea 43)
- **Prueba que falla**: `apps/api/test/qa-e2e.spec.ts:87-92` (`QA: GET /zones/:id/indicators?start=&end= (query vacío según docs/contracts.md) debe usar periodo por defecto`)
- **Causa raíz**:
  `docs/contracts.md` documenta `GET /zones/:id/indicators?start=&end=`. Cuando un cliente envía parámetros vacíos (`?start=&end=`), NestJS pasa `""` en lugar de `undefined` a `NasaService.get(..., start, end)`. Los parámetros por defecto de JS (`start = defaultPeriod().start`) solo se activan con `undefined`, por lo que `validatePeriod("", "")` rechaza con `400 Rango de fechas inválido`.
- **Corrección sugerida**: normalizar `start || undefined` y `end || undefined` en `NasaController` (o dentro de `NasaService.get` antes de aplicar `defaultPeriod()`), manteniendo `400` solo si se envía un solo extremo inválido o formato erróneo (ej. `?start=bad`).

---

### 3. Motor de rotación en zonas tropicales/continuas con 1 sola ventana larga (`apps/api`)
- **Severidad**: Media-Alta (impacta cobertura global: Constitución #7 y Spec-005 RF-1)
- **Archivos**:
  - `apps/api/src/modules/rotation-engine/engine/sequences.ts` (líneas 21–70)
  - `apps/geo/app/analysis/windows.py` (líneas 12–41)
- **Prueba que falla**: `apps/api/test/qa-e2e.spec.ts:121-145` (`QA Motor (Spec-005 RF-1): zona tropical/continua (1 ventana de 730 días) debería recomendar secuencia de 2–3 ciclos, no 1 solo cultivo`)
- **Causa raíz**:
  `calculate_windows` en `apps/geo` une todos los meses consecutivos aptos en una única ventana continua (en zonas tropicales húmedas o zonas cálidas con riego todo el año produce 1 sola ventana de ~730 días). Luego `recommend()` en `sequences.ts` itera una sola vez por cada elemento de `windows` (`for (let index = 0; index < windows.length; index++)`), asignando **como máximo 1 cultivo por ventana** y emitiendo el aviso `"Menos de dos ventanas en 24 meses: secuencia reducida; considerar cobertura o barbecho"`. Resultado: en climas continuos de 24 meses viables solo recomienda 1 cultivo de ~90–120 días en lugar de una secuencia de 2–3 ciclos.
- **Corrección sugerida**: si dentro de una ventana queda tiempo suficiente tras el primer cultivo (por ejemplo `end + 1 día <= window.end` y hay al menos un ciclo adicional factible dentro de esa misma ventana), permitir encadenar ciclos sucesivos dentro de la misma ventana hasta completar 2–3 ciclos o agotar el horizonte/ventana, sin emitir el warning de "menos de dos ventanas" cuando la ventana única cubre el año completo o permite múltiples ciclos. (Revisar también compatibilidad con `spec-005` / `docs/contracts.md`).

---

### 4. Perfil demo `coahuila@demo.ehecatl` devuelve `no_viable_options` (`apps/api/prisma`)
- **Severidad**: Media (Constitución #28 / Spec-005 criterios de finalización)
- **Archivo**: `apps/api/prisma/demo-profiles.json` (línea 2)
- **Prueba que falla**: `apps/api/test/qa-e2e.spec.ts:311-330` (`E2E Demo Profiles (Constitución #28 / Spec-005): los 3 agricultores demo reciben recomendaciones viables y distintas`)
- **Causa raíz**:
  Con `lat: 25.4, lon: -101.0, irrigated: false` y datos reales de NASA POWER, `coahuila@demo.ehecatl` devuelve `status: "no_viable_options"` y `recommendations: []` (mientras `nevada` devuelve `potato>soybean` y `mendoza` devuelve `soybean>sorghum>mustard`).
- **Corrección sugerida**: decidir con H3 si el perfil de Coahuila debe tener `irrigated: true` (para cumplir Constitución #28: los 3 usuarios demo reciben recomendaciones distintas y explicadas) o si se agrega otro perfil/zona con riego para la demo, dejando el caso `no_viable_options` en una segunda zona o test dedicado.

---

### 5. `fetch_modis` descarta los 10 años completos si falla 1 solo lote de `/subset` y MODIS falla en vivo (`apps/geo`)
- **Severidad**: Alta (bloqueo externo + fragilidad del cliente)
- **Archivo**: `apps/geo/app/sources/modis.py` (líneas 33–51)
- **Pruebas que fallan**:
  - `apps/geo/tests/test_qa_e2e.py:121-156` (`test_qa_modis_single_batch_503_should_not_discard_other_9_years`)
  - `apps/geo/tests/test_qa_e2e.py:162-204` (`test_qa_live_geo_real_nasa_power_and_modis` — 4 casos: `coahuila`, `nevada`, `mendoza`, `veracruz_nuevo_punto`)
  - `apps/api/test/qa-e2e.spec.ts:332-341` (`E2E Demo Profiles (Spec-003 RF-2): los 3 puntos demo obtienen cobertura MODIS NDVI real`)
- **Causa raíz**:
  1. **Externo**: `https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates` está devolviendo `httpx.ReadTimeout` en vivo, dejando `sources.modis.status = "unavailable"`, bajando la confianza a `"low"` y agregando ~30 s de espera en cada cache miss.
  2. **Bug en cliente (`modis.py:50`)**: `chunks = await asyncio.gather(*(batch(...) ...))` no usa `return_exceptions=True`. Para 10 años de baseline (~230 fechas = 23 peticiones `/subset`), si una sola petición falla con `503` o timeout, se aborta todo `fetch_modis` y se descartan los otros 22 lotes exitosos. Además se consulta `/dates` por separado para `recent` y `historic` aunque es el mismo punto.
- **Corrección sugerida**:
  - En `modis.py`: usar `return_exceptions=True` en `asyncio.gather` para conservar los lotes exitosos (marcando `partial` en `indicators.py` si hubo lotes fallidos) y evitar consultar `/dates` dos veces para el mismo `(lat, lon)`.
  - Evaluar en `indicators.py` / spec si conviene reducir concurrencia/reintentos o agregar un fallback opcional documentado para MODIS cuando ORNL DAAC siga caído (sin inventar datos silenciosamente; respetando Constitución #8).

---

### 6. Rango dentro del mes en curso marca `sources.power.status` como `"partial"` (`apps/geo`)
- **Severidad**: Baja-Media
- **Archivo**: `apps/geo/app/routes/indicators.py` (líneas 32–54)
- **Prueba que falla**: `apps/geo/tests/test_qa_e2e.py:92-118` (`test_qa_current_month_only_range_should_not_report_power_fault_as_partial`)
- **Causa raíz**:
  Cuando `start` y `end` están dentro del mes actual no terminado (ej. `2026-11-01` a `2026-11-14`), `recent_start > complete_end`, por lo que `recent` queda `[]` a propósito (no se invoca `fetch_power` para `recent`), pero la línea 50 calcula `status = "partial" if recent or historic else "unavailable"` con razón `"Fuente incompleta o sin cobertura"`, reportando erróneamente falla de NASA POWER cuando la fuente respondió bien para `historic`.
- **Corrección sugerida**: distinguir entre `not expects_recent` (no había meses completos en el rango pedido) y un fallo real de `fetch_power` o ausencia de datos, o emitir un warning informativo sobre meses incompletos sin marcar `power` como fallido/parcial.

---

### 7. Deduplicación en `sequences.ts` puede sobrescribir la mejor secuencia (`apps/api` — observación estática)
- **Severidad**: Baja (borde poco frecuente)
- **Archivo**: `apps/api/src/modules/rotation-engine/engine/sequences.ts` (línea 71)
- **Causa raíz**:
  ```ts
  const unique = new Map(beam.filter(c => c.sequence.length).sort(compare).map(c => [c.id, c]));
  ```
  `beam` está ordenado de mayor a menor puntaje (`sort(compare)`). Si dos ramas con distinto acomodo de ventanas producen el mismo `c.id` (por ejemplo al quedar una ventana sin cultivos viables), `new Map(...)` conserva la **última** entrada, sobrescribiendo la de mayor puntaje con la de menor puntaje.
- **Corrección sugerida**: insertar solo si `!unique.has(c.id)` después de ordenar con `compare`.

---

### Cómo re-ejecutar las pruebas QA después de corregir

1. Levantar PostgreSQL 16 aislado y aplicar migraciones + seed:
   ```powershell
   $env:DATABASE_URL="postgresql://ehecatl:qa_local_only@127.0.0.1:55433/ehecatl_qa"
   $env:TEST_DATABASE_URL=$env:DATABASE_URL
   $env:SEED_DEMO_PASSWORD="QaDemoPassword1234"
   pnpm --filter api exec prisma migrate deploy
   ```
2. Levantar `apps/geo` en `http://127.0.0.1:18000` y ejecutar `prisma db seed` (`GEO_URL=http://127.0.0.1:18000`).
3. Levantar `apps/api` en `http://127.0.0.1:13001` (`pnpm --filter api build` y `node dist/main.js`).
4. Correr ambas suites completas:
   ```powershell
   # Geo
   $env:QA_GEO_URL="http://127.0.0.1:18000"
   uv run --project apps/geo python -m pytest -v

   # API
   $env:QA_API_URL="http://127.0.0.1:13001"
   pnpm --filter api test
   ```
