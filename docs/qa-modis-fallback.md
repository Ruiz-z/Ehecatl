# Respaldo MODIS anónimo — 2026-11-14

Fix acotado a añadir Microsoft Planetary Computer como respaldo de ORNL DAAC,
sin cambiar endpoints, versión JSON, NASA POWER, motor ni perfiles demo.

## Rama y alcance

- Rama: `fix/geo-modis-fallback`, creada desde `dev` (`d1a07fe`).
- Se incorporó `feat/backend-integracion` (`3984411`) por fast-forward como
  prerrequisito autorizado: `dev` todavía no contenía la implementación backend.
- `8c1820d` conserva las correcciones QA previas como base separada. El commit
  siguiente contiene únicamente este adaptador, su documentación y pruebas.
- Checkout del fix: `C:/vsCodePersonal/Ehecatl-modis-fallback`. El checkout
  original `C:/vsCodePersonal/Ehecatl` y sus cambios locales se conservaron.
- La spec y el contrato se actualizaron antes de implementar; la cláusula 7
  de la constitución se amplió solo para nombrar el respaldo anónimo.
- El usuario autorizó `rasterio`; `pyproject.toml` y `uv.lock` incorporan esa
  dependencia y sus transitivas. No se añadieron credenciales ni frameworks.

## Implementación y revisión RF

- ORNL sigue siendo principal. Una respuesta sin errores no activa el respaldo,
  incluso si no tiene cobertura; fallos y lotes perdidos sí lo activan.
- El respaldo consulta STAC `modis-13Q1-061`, filtra Terra/MOD13Q1 y pagina las
  escenas. Admite `datetime` o `start_datetime`, sin traer fechas fuera del rango.
- Primero consulta la API pública de valores puntuales con NDVI y calidad,
  `unscale=false`. Si falla, firma anónimamente los GeoTIFF por contenedor y
  usa `rasterio` para reproyectar WGS84 y leer solo el píxel, con límites HTTP.
- Se mantiene el filtro de calidad 0/1 y el rango crudo -2000..10000, escala
  0.0001 y promedio mensual. Los valores de relleno/nubes no se vuelven datos.
- Cada indicador identifica al proveedor real. Los meses ORNL ya recuperados
  prevalecen al combinar y no se duplican. Si ambos proveedores fallan, se
  conservan los resultados parciales.
- Ambos proveedores comparten el presupuesto total existente de 120 segundos;
  ORNL tiene un máximo inicial de 30 segundos para dejar margen al respaldo.
  Hay ocho lecturas de escenas simultáneas. Se cancelan las pendientes cuando
  vence el presupuesto o se cancela la solicitud.
- Spec 003 RF-2/2b/2c: respaldo real sin login y con calidad; RF-3: normalización
  conservada; RF-4: sigue funcionando la climatología/anomalías existente;
  RF-5/8: seed y caché API sin cambios; RF-6: degradación parcial honesta;
  RF-7: origen y fuente reales. POWER, RF-1 y ventanas RF-3b no se modificaron.

Referencias: [colección y calidad MODIS](https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-13Q1-061),
[SAS anónimo](https://planetarycomputer.microsoft.com/docs/concepts/sas/),
[API de valores puntuales](https://planetarycomputer.microsoft.com/api/data/v1/openapi.json).

## Validación

PostgreSQL 16 aislado en `127.0.0.1:55433`, base nueva `ehecatl_modis_qa`;
Geo en `127.0.0.1:18001`, API en `127.0.0.1:13002`. Se aplicaron las migraciones
existentes. Seed final ejecutado dos veces: NASA real, luego caché, sin duplicados.

| Comando | Resultado |
|---|---|
| `pnpm lint` | Aprobado: API, Geo y web. |
| `pnpm --filter api build` | Aprobado. |
| `pnpm test`, con `TEST_DATABASE_URL` | Aprobado: API 70 pasaron / 6 omitidas; Geo 32 pasaron / 5 omitidas. Los casos en vivo se ejecutaron aparte con sus variables QA. |
| `pnpm --filter api test`, con `TEST_DATABASE_URL`, `QA_API_URL`, `SEED_DEMO_PASSWORD` | **76 pasaron, 0 fallaron, 0 omitidas; 9 suites aprobadas.** Incluye la QA MODIS de los tres perfiles demo que antes fallaba. |
| `pytest -v -p no:cacheprovider`, con `QA_GEO_URL` | **36 pasaron, 1 falló, 0 omitidas.** Único fallo: Veracruz, descrito abajo. |
| `git diff --check` | Aprobado. |

Las once pruebas nuevas cubren lectura puntual/reproyección, nodata y límites,
paginación, Terra, SAS por contenedor sin credenciales, filtros de calidad,
escala/promedio, fallos I/O, presupuesto, conservación de ORNL, océano,
API HTTP puntual y cancelación de lecturas. Las pruebas originales no se editaron.

Durante el ajuste inicial, la lectura directa de cientos de GeoTIFF agotaba
el presupuesto. La vía HTTP puntual resolvió esa latencia: el rango completo
2015-01-01 a 2026-10-31 en Coahuila terminó en **14.06 s** de respaldo y sin
errores de lectura. No se aumentaron los timeouts para obtener ese resultado.

## Único fallo restante: datos recientes nubosos en Veracruz

`apps/geo/tests/test_qa_e2e.py::test_qa_live_geo_real_nasa_power_and_modis[veracruz_nuevo_punto-19.1738--96.1342-False]`
exige `sources.modis.status == "available"`, pero recibe `partial`.

La comprobación directa del respaldo para ese punto y periodo devolvió
**21 escenas recientes con HTTP 200, todas con `pixel_reliability=3` (nubes)**.
Ejemplos crudos NDVI/calidad: `A2026273: [1607, 3]`, `A2026257: [1558, 3]`,
`A2025353: [1528, 3]`, `A2025321: [1023, 3]`.
El rango histórico sí aporta NDVI válido; el reciente no aporta observaciones
con calidad 0/1. Por eso se conserva el histórico y se informa `partial`,
sin admitir nubes, inventar valores ni cambiar la QA. Esta condición ya no es
un fallo de conexión del adaptador.

Coahuila, Nevada y Mendoza recuperaron `power=available`, `modis=available`;
las tres secuencias demo siguen siendo distintas. También pasa el caso oceánico
sin respuesta 500. ORNL continúa protegido por timeout y el respaldo es real.

## Archivos de este fix

- `docs/constitution.md`
- `docs/contracts.md`
- `docs/specs/spec-003-nasa-data.md`
- `apps/geo/app/sources/modis.py`
- `apps/geo/app/sources/planetary_modis.py` (nuevo)
- `apps/geo/pyproject.toml`
- `apps/geo/uv.lock`
- `apps/geo/tests/test_planetary_modis.py` (nuevo)
- `docs/qa-modis-fallback.md` (nuevo)

QA originales verificadas byte a byte contra el checkout original y por SHA-256:

```text
apps/api/test/qa-e2e.spec.ts
8DB458DDA41052240EAA06F694219C3B01FCA65FC0F841BD6345B4AA7B2A3E72
apps/geo/tests/test_qa_e2e.py
4AC74EC8179F59F5E17DEE9D926142F912E57B9A903DB48E6AE84DCFEAE1E480
```

Logs locales: `C:/vsCodePersonal/.backend-tools/modis-{lint,build,workspace-test,api-live,geo-final,seed,seed-repeat}.log`.
No se hizo `git push`.
