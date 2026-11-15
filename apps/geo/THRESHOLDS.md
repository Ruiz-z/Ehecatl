# Ingesta y umbrales v1 (B6–B10)

La normal es la media por variable y mes de los últimos diez años completos
anteriores al inicio del periodo consultado. Cada valor lleva su número de
muestras; se avisa si faltan años. No se interpolan huecos.

Las tendencias comparan hasta los tres últimos meses disponibles:

| Tendencia | Regla heurística |
|---|---|
| Sequía | Precipitación media relativa a la normal <= -25% |
| Calor | Anomalía media de temperatura >= +2 °C |
| Vegetación estresada | NDVI medio relativo a la normal <= -20% |
| Lluvia errática | CV de razones lluvia/normal >= 0.75, al menos 3 meses |

Son umbrales del prototipo pendientes de H4, no umbrales oficiales NASA.
Anomalías porcentuales con normal cero son null.

Una ventana requiere temperatura media 10–35 °C y lluvia >=40 mm/mes,
humedad de raíz >=0.4 o riego declarado. El motor luego aplica los requisitos
específicos de cada cultivo. Los meses consecutivos forman una ventana;
no se divide una ventana tropical por años ni por temporadas nacionales.
Horizonte: 24 meses posteriores al periodo de observación.

POWER incluye YYYY13 (promedio anual), que se descarta. PRECTOTCORR en mm/day
se convierte a mm/month con la longitud real del mes (incluido bisiesto).
La unidad de radiación se preserva de la respuesta. Relleno -999 se vuelve null.

MODIS se pagina en bloques <=10 fechas, con hasta 3 consultas concurrentes.
Se aplica 0.0001 una sola vez al dato bruto NDVI, rango válido -2000..10000.
Se descartan píxeles con fiabilidad distinta de 0/1 cuando existe esa banda;
si no hay banda de calidad se mantiene el valor y la resolución declarada.
Primero se promedian píxeles válidos por compuesto y luego compuestos por mes.

`NASA_TIMEOUT_SECONDS=30` limita cada petición HTTP;
`NASA_TOTAL_TIMEOUT_SECONDS=120` limita el trabajo total de cada fuente.
Las fuentes y los periodos se consultan por separado para conservar respuestas
parciales. Un periodo vacío o fuente sin cobertura nunca se rellena con mocks.

Referencias técnicas:
- https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
- https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/
- https://modis.ornl.gov/data/modis_webservice.html

`tests/fixtures/power.json` y `modis.json` son casos sintéticos de borde,
identificados como tests; las verificaciones de red se documentan aparte.

## Ejes históricos (2026-11-15)

Riesgo usa al menos cinco calendarios completos. Sin riego falla si lluvia <65 % de ETc. Temperaturas de tolerancia provienen del catálogo ECOCROP y helada se define como mínima mensual ≤0 °C en sensibles. Son umbrales pendientes de H4. La ETo por radiación y las fracciones de Kc conservan sus limitaciones; no son Penman-Monteith. Cada año usa días reales, meses parciales y años consecutivos. No se interpola historia ni se rellenan huecos. Lluvia sustituye agua disponible en la función FAO-33; no es ETa medida. Con riego se supone demanda cubierta y se avisa. El respaldo conserva las penalizaciones anteriores solo sin cinco años completos; no son frecuencia NASA.

## Fecha de siembra

`minHistoricalSuccess = 0.7` vive en `apps/api/src/modules/rotation-engine/engine/schedule.ts`. Con cinco años completos o más, cada ciclo necesita al menos 70 % de años buenos. Se comparan los arranques mensuales viables por clima normal; gana la mayor proporción y luego la fecha más temprana. Con menos de cinco años se conserva la primera fecha viable. Umbral heurístico pendiente de validación H4. No cambia las fórmulas históricas.
