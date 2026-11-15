# Correcciones de la auditoría backend — 2026-11-14

> Nota Bloque A (2026-11-14): los perfiles ahora apuntan a San Pedro (25.76, −102.98), Fallon (39.47, −118.78) y San Martín (−33.08, −68.47). La evidencia siguiente corresponde a los puntos anteriores y a las reglas de confianza de entonces; no acredita los nuevos puntos. Quedan pendientes seed, mapa, pico NDVI ≥0.4 y opciones reales, a verificar por el usuario.

Se corrigieron los bugs de código de los puntos 1–7 de `qa-audit-backend.md`.
La dependencia externa MODIS continúa sin responder desde este entorno.
Las decisiones de comportamiento se documentaron en la spec 005 y en el
contrato **antes** de modificar código. No se añadieron dependencias.

## Cambios y revisión contra requisitos

| Punto | Corrección y verificación |
|---|---|
| 1 | Timeout y TTL usan valores por defecto si el entorno contiene cadenas vacías, espacios, cero, negativos o valores no finitos. Pasan la QA original y seis casos adicionales de timeout/expiración persistida. |
| 2 | `NasaService.get` trata fechas vacías como omitidas, incluso para consumidores distintos del controlador. Los formatos no vacíos inválidos siguen rechazándose con 400. Pasa la QA original. |
| 3 | El haz avanza por hasta tres ciclos; puede volver a usar una ventana después de la cosecha, sin solapamiento y con la viabilidad mensual de `schedule`. Se conservan los IDs climatológicos. Pasan la QA tropical, una regresión adicional de tres ciclos y los casos estacionales, perennes, fechas futuras de siembra y determinismo existentes. `windows.py` no requiere cambios: una ventana continua sigue siendo correcta. Spec 005 RF-1/1b, RF-2/3/5/6/9. |
| 4 | Coahuila usa `irrigated: true` solo en el fixture demo. El seed y la QA real comprueban tres recomendaciones viables y distintas. La aprobación humana H3 del perfil sigue pendiente; no se afirma disponibilidad real de riego ni aprobación agronómica H4. No hay reglas por región ni mocks NASA. |
| 5 | `gather(return_exceptions=True)` conserva lotes MODIS exitosos; se comunican fallos de lote al estado `partial`/`unavailable`. Una consulta combinada reciente/histórica comparte `/dates` y limita a tres lotes concurrentes, de máximo diez fechas. Pasan la QA de fallo 503 y dos regresiones de endpoint (fallo parcial y total), incluida una sola llamada `/dates`. No se agregó fallback simulado. Spec 003 RF-2/3/6/7. |
| 6 | Cuando no se esperan meses completos recientes, su ausencia no degrada POWER si la consulta histórica respondió. Pasa la QA original; los fallos reales siguen degradando la fuente. Spec 003 RF-6 y contrato de meses completos. |
| 7 | La deduplicación recorre candidatos ordenados y solo inserta el primer candidato de cada ID; conserva el mayor puntaje y los desempates deterministas. Pasa la QA existente. Spec 005 RF-5/9. |

También pasan los riesgos ante sequía/calor del cultivo actual (RF-4), las
reducciones de confianza por datos faltantes (RF-7), las recomendaciones sin
historial (RF-8), el aislamiento por dueño, el uso de prioridades del dueño
por ADMIN y el flujo completo con un punto nuevo en Nairobi.

## Entorno y ejecución

- PostgreSQL `postgres:16`, contenedor nuevo `ehecatl-qa-fixes-postgres`, puerto
  `127.0.0.1:55433`, base `ehecatl_qa`, independiente de las bases existentes.
- Geo en `http://127.0.0.1:18000`; API compilada en `http://127.0.0.1:13001`.
- `prisma migrate deploy`: aplicada `202611140001_backend`.
- `prisma db seed` dos veces: ambas terminaron correctamente; primera con
  `origin=live`, segunda con `origin=cache`, sin duplicar perfiles.
- API ejecutada con `GEO_TIMEOUT_MS=""` y `NASA_CACHE_TTL_HOURS=""` para comprobar
  también ese entorno en el servicio real.
- Las migraciones, el seed y Geo requirieron ejecución fuera del sandbox:
  dentro de él Prisma daba `spawn EPERM` y las conexiones externas daban
  `ConnectError`. Los resultados definitivos corresponden a Geo con red real.

| Verificación | Resultado definitivo |
|---|---|
| `pnpm lint` | Correcto: api, geo y web, 3 tareas. |
| `pnpm --filter api build` | Correcto. |
| `pnpm --filter api test`, con `TEST_DATABASE_URL`, `QA_API_URL` y `SEED_DEMO_PASSWORD` | 75 aprobadas, 1 fallida, 0 omitidas; 8 suites aprobadas y 1 fallida. |
| `pytest -v -p no:cacheprovider` en `apps/geo`, con `QA_GEO_URL` | 22 aprobadas, 4 fallidas, 0 omitidas. Se desactivó solo el caché de pytest por permisos del directorio local. |
| `pnpm test` del workspace, con `TEST_DATABASE_URL` | Correcto: API 70 aprobadas y 6 omitidas; Geo 21 aprobadas y 5 omitidas. Las omitidas son los casos que requieren `QA_API_URL`/`QA_GEO_URL`, ejecutados por separado arriba. Advertencia inocua por permisos del caché de pytest. |
| `git diff --check` | Correcto. |

Pasaron **todas** las pruebas de `access.spec.ts`, `database.spec.ts`,
`health.spec.ts`, `engine.spec.ts`, `nasa.spec.ts`, `contracts.spec.ts`,
`catalog.spec.ts` y `schedule.spec.ts`. En `qa-e2e.spec.ts` pasaron todas salvo
el caso MODIS listado a continuación. En Geo pasaron todas las pruebas de
`test_health.py`, `test_nasa.py` y todos los casos QA salvo los cuatro MODIS
listados a continuación, incluido el manejo del punto oceánico sin 500.

## Fallos que persisten

API, `apps/api/test/qa-e2e.spec.ts:339`:

- `E2E Demo Profiles (Spec-003 RF-2): los 3 puntos demo obtienen cobertura MODIS NDVI real`.

Geo, `apps/geo/tests/test_qa_e2e.py`, parametrizaciones de
`test_qa_live_geo_real_nasa_power_and_modis`:

- `coahuila-25.4--101.0-False`
- `nevada-39.5--119.8-True`
- `mendoza--33.0--68.8-True`
- `veracruz_nuevo_punto-19.1738--96.1342-False`

Los fallos esperan MODIS `available` y reciben `unavailable`. La comprobación
directa, con red habilitada, de
`https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=25.4&longitude=-101.0`
terminó en `httpx.ReadTimeout` tras **30.56 segundos**. Es evidencia de falta
de respuesta desde este entorno; no demuestra una caída universal de ORNL.
POWER sí respondió en vivo. Se mantiene la menor confianza por NDVI faltante.

| Perfil | Mejor secuencia real | Estado | POWER | MODIS |
|---|---|---|---|---|
| Coahuila | `cowpea>sorghum>cowpea` | `ok` | `available` | `unavailable` |
| Nevada | `potato>soybean` | `ok` | `available` | `unavailable` |
| Mendoza | `soybean>buckwheat>soybean` | `ok` | `available` | `unavailable` |

## Archivos modificados

- `apps/api/prisma/demo-profiles.json`
- `apps/api/src/modules/nasa-data/nasa.service.ts`
- `apps/api/src/modules/rotation-engine/engine/sequences.ts`
- `apps/api/test/engine.spec.ts` (solo prueba adicional)
- `apps/api/test/nasa.spec.ts` (solo pruebas adicionales)
- `apps/geo/app/routes/indicators.py`
- `apps/geo/app/sources/modis.py`
- `apps/geo/tests/test_nasa.py` (solo pruebas adicionales)
- `docs/contracts.md`
- `docs/specs/spec-005-rotation-engine.md`
- `docs/qa-fixes-backend.md` (este reporte, nuevo)

Las QA originales y el reporte de auditoría ya estaban sin seguimiento antes
de empezar; se conservaron sin modificar. SHA-256 de las QA antes y después:

```text
apps/api/test/qa-e2e.spec.ts
8DB458DDA41052240EAA06F694219C3B01FCA65FC0F841BD6345B4AA7B2A3E72
apps/geo/tests/test_qa_e2e.py
4AC74EC8179F59F5E17DEE9D926142F912E57B9A903DB48E6AE84DCFEAE1E480
```

Logs de la ejecución disponibles localmente en `C:/vsCodePersonal/.backend-tools/`:
`qa-lint-fixes.log`, `qa-api-fixes.log`, `qa-geo-fixes.log`,
`qa-workspace-test-fixes.log`, `qa-seed-fixes.log` y `qa-seed-repeat-fixes.log`.
No se hizo commit ni `git push`.
