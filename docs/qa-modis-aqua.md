# Complemento Aqua sin regresiones — 2026-11-14

Se autorizó completar meses sin NDVI Terra válido con MODIS Aqua/MYD13Q1.
Esta ampliación resuelve el fallo de Veracruz registrado en `qa-modis-fallback.md`.

## Alcance

- Rama `fix/geo-modis-aqua`, creada desde `dev` e incorporando por fast-forward
  `fix/geo-modis-fallback` (`1d341f8`) como prerrequisito.
- Primero se actualizaron la spec 003 (RF-2b/2d), el contrato y la referencia
  de productos MODIS en la constitución.
- Solo cambió el adaptador Planetary Computer: Terra conserva cada mes válido;
  Aqua se consulta únicamente para meses faltantes, con la misma política en
  histórico y reciente. No se promedian ni duplican meses entre productos.
- Los meses Aqua identifican `MODIS MYD13Q1 / Microsoft Planetary Computer`.
  Conservan escala 0.0001, resolución 250 m y filtro de calidad 0/1.
- Terra conserva su presupuesto previo; Aqua usa el tiempo restante del mismo
  presupuesto total. Si Aqua falla o no aporta datos válidos, se conserva Terra.
- No cambiaron ORNL, POWER, rutas, motor, API, perfiles demo, esquema de base,
  dependencias ni las QA existentes. No se agregaron excepciones por ubicación.

## Evidencia de Veracruz

Para `19.1738, -96.1342`, periodo `2025-11-01` a `2026-10-31`, Terra solo
aportaba observaciones recientes con calidad 3. Aqua aporta tres observaciones
aceptables, agregadas en dos meses reales:

| Fecha mensual | NDVI | Fuente |
|---|---|---|
| `2026-03-01` | `0.2444` | MODIS MYD13Q1 / Microsoft Planetary Computer |
| `2026-05-01` | `0.50125` | MODIS MYD13Q1 / Microsoft Planetary Computer |

El adaptador devuelve esos meses sin errores de lote. La QA original de
Veracruz pasa, sin admitir nubes ni modificar su expectativa.

## Comprobación de que lo demás se conserva

Se compararon las respuestas reales de los tres perfiles demo contra la
versión anterior, usando una base QA nueva. En **Coahuila, Nevada y Mendoza**
son exactamente iguales:

- Recomendaciones completas, incluidos puntajes, secuencias, componentes y explicaciones.
- Prioridades y riesgo del cultivo actual.
- Ventanas climatológicas.
- Todas las observaciones mensuales de POWER.

La comparación está en `C:/vsCodePersonal/.backend-tools/aqua-regression-comparison.json`.
Solo NDVI y los indicadores derivados de esa serie pueden ganar observaciones.

## Pruebas

PostgreSQL 16 aislado en `127.0.0.1:55433`, base `ehecatl_aqua_qa` con las
migraciones existentes. Validación final: Geo `18004`, API `13004`.
Seed sin cambios ejecutado dos veces: primera con NASA real y segunda desde caché.

| Verificación | Resultado |
|---|---|
| `pnpm lint` | Aprobado: API, Geo y web. |
| `pnpm test`, con `TEST_DATABASE_URL` | Aprobado: API 70 pasaron / 6 omitidas; Geo 38 pasaron / 5 omitidas. Los casos en vivo se ejecutaron aparte. |
| `pnpm --filter api test`, con `TEST_DATABASE_URL`, `QA_API_URL` y `SEED_DEMO_PASSWORD` | **76 pasaron, 0 fallaron, 0 omitidas; 9 suites aprobadas.** |
| `pytest -v -p no:cacheprovider`, con `QA_GEO_URL` | **43 pasaron, 0 fallaron, 0 omitidas.** Incluye Veracruz y el punto oceánico. |
| Comparación de los tres perfiles | Las cinco categorías anteriores coinciden en los tres perfiles. |
| `git diff --check` | Aprobado. |

Las seis pruebas nuevas verifican precedencia Terra, meses faltantes a través
de cambio de año, presupuesto Terra intacto, ausencia de consulta Aqua cuando
Terra está completo, preservación ante fallos de Aqua, plataforma/producto,
calidad 1 aceptada, calidad 3 rechazada, escala y origen. Las pruebas anteriores
de calidad, reproyección, límites, cancelación y paginación siguen pasando.

SHA-256 de las QA originales, conservadas byte a byte:

```text
apps/api/test/qa-e2e.spec.ts
8DB458DDA41052240EAA06F694219C3B01FCA65FC0F841BD6345B4AA7B2A3E72
apps/geo/tests/test_qa_e2e.py
4AC74EC8179F59F5E17DEE9D926142F912E57B9A903DB48E6AE84DCFEAE1E480
```

## Archivos de este cambio

- `apps/geo/app/sources/planetary_modis.py`
- `apps/geo/tests/test_modis_aqua.py` (nuevo)
- `docs/constitution.md`
- `docs/contracts.md`
- `docs/specs/spec-003-nasa-data.md`
- `docs/qa-modis-aqua.md` (nuevo)

Logs locales en `C:/vsCodePersonal/.backend-tools/`:
`aqua-lint.log`, `aqua-workspace-test.log`, `aqua-api-live.log`,
`aqua-geo-final.log`, `aqua-seed.log` y `aqua-seed-repeat.log`.
El checkout original sigue intacto. No se hizo `git push`.
