# Contratos backend v1

Propuesta B1 lista para revisión H2. JSON en camelCase, fechas ISO 8601 UTC,
coordenadas WGS84; valores desconocidos `null`, nunca cero ni -999.
Los ejemplos ejecutables están en `docs/fixtures/indicators.json` y
`docs/fixtures/recommendations.json` y se consumen desde los tests.

## GET geo /indicators

Query obligatoria: `lat` [-90,90], `lon` [-180,180], `start` y `end`
(`YYYY-MM-DD`, no futuros, start <= end). Opcionales: `irrigated=false`,
`baselineYears=10` (2–30). Rango máximo 10 años; la normal usa los años
completos anteriores al año de start, sin contaminarse con el periodo reciente.
Rangos inválidos devuelven 400. Se incluyen solamente meses completos terminados.

Respuesta 200: `version: 1`, `point: {lat,lon}`, `period: {start,end}`,
`origin: live|cache|mock`, `fetchedAt`, `sources: {power,modis}` con
`status: available|partial|unavailable` y `reason: string|null`,
`monthly: Indicator[]`, `climatology: Normal[]`, `anomalies: Anomaly[]`,
`trends: Trend[]`, `windows: Window[]`, `warnings: string[]`.

- Indicator: `variable`, `date` (primer día del mes), `value: number|null`,
  `unit`, `source`, `resolution`. Variables: T2M, T2M_MAX, T2M_MIN (°C),
  PRECTOTCORR (mm/month, se convierte de mm/day usando días reales del mes),
  RH2M (%), ALLSKY_SFC_SW_DWN (unidad de respuesta POWER), GWETTOP,
  GWETROOT (fracción 0–1), NDVI (índice -0.2–1, factor 0.0001).
- Normal: `variable`, `month` 1–12, `value`, `samples`, `unit`.
- Anomaly: `variable`, `date`, `value` (observación menos normal),
  `percent: number|null` (null si normal cero).
- Trend: `type: drought|heat|erratic_rain|vegetation_stress`, `active`,
  `evidence: string[]`. Son heurísticas documentadas, no diagnósticos.
- Window: `id`, `start`, `end` (inclusive), `months: number[]`,
  `durationDays`, `temperatureMin`, `temperatureMax`, `meanTemperature`,
  `precipitationMm`, `irrigated`. Horizonte de 24 meses a partir del mes
  siguiente a end. Son aptitud climatológica, no pronósticos. Se cortan al
  horizonte; meses consecutivos válidos forman una ventana (incluye diciembre).

Cada fuente se consulta con timeout configurable `NASA_TIMEOUT_SECONDS`
(por defecto 30 por petición) y presupuesto total `NASA_TOTAL_TIMEOUT_SECONDS`
(por defecto 120). Un fallo devuelve las demás variables; no se inventan datos.
MODIS solicita lotes de máximo diez fechas y filtra relleno y calidad.
Los rangos reciente e histórico comparten una consulta MODIS `/dates` por punto
y petición de indicadores. Si falla un lote `/subset`, se conservan los lotes
exitosos y MODIS se marca `partial` (o `unavailable` si no quedan observaciones).
No se añade un fallback de datos simulados. Un rango sin meses completos
terminados devuelve `monthly: []`; esa exclusión intencional no implica un
fallo de cobertura de POWER si la consulta histórica fue satisfactoria.
No se calcula una ventana si falta temperatura o agua suficiente.

Respaldo MODIS: si ORNL falla o pierde lotes, se consulta MOD13Q1/Terra en
Microsoft Planetary Computer sin cuenta ni API key, dentro del mismo presupuesto
total de fuente. Se conservan escala, resolución, calidad 0/1 y agregación mensual.
`sources.modis` mantiene su forma; `Indicator.source` identifica ORNL DAAC o
Microsoft Planetary Computer según el proveedor que entregó el dato. Los meses
ORNL ya obtenidos prevalecen al combinar; un fallo recuperado por el respaldo
no fuerza `partial`. Si ambos fallan, se conserva lo disponible y el estado
parcial/no disponible. No cambian versión, endpoints ni las demás fuentes.

Dentro del respaldo Planetary Computer, los meses sin NDVI válido de Terra
pueden completarse con Aqua/MYD13Q1 del mismo punto y rango, tanto en histórico
como en reciente. Cada mes conserva Terra si existe; de lo contrario usa el
promedio Aqua con calidad 0/1, escala 0.0001 y resolución 250 m.
`Indicator.source` distingue `MODIS MOD13Q1 / Microsoft Planetary Computer`
de `MODIS MYD13Q1 / Microsoft Planetary Computer`. No se mezclan ni duplican
meses entre productos. Un fallo de Aqua conserva los datos Terra y no cambia
los campos, endpoints, prioridades, ventanas ni reglas del motor.

## API pública y protegida

`GET /health` y `POST /auth/login` son públicos. El resto requiere
`Authorization: Bearer <token>`. Login acepta `{email,password}` y devuelve
`{accessToken,tokenType:"Bearer",expiresIn:3600,user:{id,email,name,role}}`.
401 genérico para credenciales o token inválidos; 403 por ownership o rol;
404 para recurso inexistente; 400 para entradas inválidas.

- `GET /crops`: catálogo completo con fuentes y unidades.
- `GET|POST /parcels`, `GET|PATCH|DELETE /parcels/:id`.
  Alta `{name,lat,lon,currentCropId,irrigated?}` crea zona por defecto.
- `GET|POST /parcels/:id/zones`, `GET|PATCH|DELETE /zones/:id`.
  Zona `{name,currentCropId,irrigated?,lat?,lon?,soilNotes?}`. Coordenadas
  opcionales se envían juntas; null en ambas hereda el punto de la parcela.
  No se permite eliminar la última zona de una parcela (409).
- `GET|POST /zones/:id/history`, `PATCH|DELETE /zones/:id/history/:historyId`.
  `{cropId,plantedAt,harvestedAt,yieldTonHa?}`, fechas ISO, cosecha >= siembra.
- `GET|PUT /me/priorities`: `{water,soil,income,risk}`, números finitos
  no negativos; suma cero usa 25 cada uno; se normalizan a enteros sumando 100.
- `GET /zones/:id/indicators?start=&end=`: el API obtiene coordenadas y riego
  de la zona, usa caché persistida y devuelve el contrato geo. Por defecto
  usa los últimos doce meses completos; los parámetros vacíos se tratan como
  omitidos. Fechas no vacías inválidas siguen devolviendo 400.
  TTL `NASA_CACHE_TTL_HOURS=24`, timeout `GEO_TIMEOUT_MS=130000`;
  valores vacíos, no finitos o no positivos usan esos valores por defecto.

## GET api /zones/:id/recommendations

Respeta ownership de parcela/zona. Usa las prioridades del dueño aun cuando
consulta un administrador. Respuesta 200: `version:1`, `zoneId`,
`status: ok|no_viable_options`, `origin`, `confidence: high|medium|low`,
`warnings`, `priorities`, `currentCropRisk: {level: low|high,reasons,changeAt}`,
`inputs: {point,currentCropId,historyCount,indicators}`, `recommendations`.

Cada recomendación tiene `id`, `score` 0–100, `sequence` con
`{cropId,cropName,windowId,start,end,occupiedWindowIds}`, `components`
(water,soil,income,risk, cada uno 0–100), `explanation: string[]`,
`risks: string[]`. `changeAt` indica el comienzo de la primera ventana
viable. Se generan hasta tres resultados con hasta tres ciclos sobre las
primeras tres ventanas en 24 meses. Una ventana continua puede alojar varios
ciclos, cada uno validado en sus meses y sin solaparse (siembra >= cosecha
anterior + 1 día). `windowId` y `occupiedWindowIds` conservan los identificadores
climatológicos originales, que pueden repetirse entre pasos de una secuencia.
Se explica la reducción cuando no caben dos ciclos viables. Para un mismo
identificador de secuencia se conserva el candidato de mayor puntaje y luego
se aplican los desempates indicados abajo.
La fecha de siembra no antecede al día UTC de obtención de los indicadores.
Empates: menor riesgo, nombre e identificador de secuencia; salida determinista.
Si ninguna opción cabe: lista vacía, razones y sugerencia de cobertura/barbecho.
Ingreso es un indicador heurístico de oportunidad (no precio ni rentabilidad).
Una perenne debe caber en el horizonte y ocupar ventanas consecutivas.

## Aprobaciones pendientes

H2 (contratos), H3 (perfiles demo) y H4 (agronomía) siguen siendo humanos.
Los perfiles de seed son propuestas editables, no decisiones aprobadas.
