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
`inputs: {point,currentCropId,historyCount,indicators}`, `baseline`, `recommendations`.

`baseline` siempre está presente: `id:"baseline"`, `viable`, `score`, `components`,
`sequence`, `explanation`, `risks`. Repite el cultivo actual hasta tres ciclos,
evaluado con las mismas reglas, historial y pesos, fuera del recorte del haz.
Si no cabe ningún ciclo, `viable:false`, `score:null`, `components:null`,
`sequence:[]` y las causas en `explanation`. Una referencia inviable no recibe
puntaje. La UI conserva esas causas como aviso y no calcula diferencias.

Cada recomendación tiene `id`, `score` 0–100, `sequence` con
`{cropId,cropName,windowId,start,end,occupiedWindowIds}`, `components`
(water,soil,income,risk, cada uno 0–100), `explanation: string[]`,
`risks: string[]`, `delta: number|null` (puntaje menos el de `baseline`, redondeado
a dos decimales, o nulo si la referencia es inviable). `changeAt` indica la fecha
de siembra de la primera alternativa, o null si solo es viable mantener lo actual.
Se generan hasta dos alternativas, excluyendo secuencias compuestas únicamente
por el cultivo actual, con hasta tres ciclos sobre las
primeras tres ventanas en 24 meses. Una ventana continua puede alojar varios
ciclos, cada uno validado en sus meses y sin solaparse (siembra >= cosecha
anterior + 1 día). `windowId` y `occupiedWindowIds` conservan los identificadores
climatológicos originales, que pueden repetirse entre pasos de una secuencia.
Se explica la reducción cuando no caben dos ciclos viables. Para un mismo
identificador de secuencia se conserva el candidato de mayor puntaje y luego
se aplican los desempates indicados abajo.
La fecha de siembra no antecede al día UTC de obtención de los indicadores.
Empates: menor riesgo, nombre e identificador de secuencia; salida determinista.
Si ninguna opción cabe, incluida la referencia: `status:no_viable_options`, lista
vacía, referencia inviable, razones y sugerencia de cobertura/barbecho.
Si solo cabe la referencia, `status:ok` y `recommendations:[]`.
Ingreso es un indicador heurístico de oportunidad (no precio ni rentabilidad).
Una perenne debe caber en el horizonte y ocupar ventanas consecutivas.

## Aprobaciones pendientes

La autorización del usuario del 2026-11-15 cubre la preparación siguiente de sensores y la previsualización de prioridades. No aprueba umbrales agronómicos ni actuación.

## Preparación de sensores v1 — 2026-11-15

- `POST /zones/:id/recommendations` con JWT y `{priorities:{water,soil,income,risk}}`: calcula sin guardar, mismos permisos y respuesta del GET. Pesos validados y normalizados como `/me/priorities`.
- `POST /devices` (admin JWT): `{zoneId,name,origin:"REAL"|"SIMULATED",expectedIntervalSeconds?,dryRaw?,wetRaw?,depthCm?}`. Modelo inicial FC28+DHT11+MQ2. Respuesta 201 `{device,apiKey}`; solo esta respuesta y la rotación muestran la clave.
- `GET /zones/:id/devices` (dueño/admin): dispositivos sin hash ni clave, con `status`, `origin`, `connection:online|offline|revoked`, fecha/antigüedad de la última medición y recepción; calibración opcional versionada.
- `PATCH /devices/:id` (admin): nombre, intervalo, profundidad, zona y par de calibración; ambos valores nulos eliminan calibración. No cambia origen ni lecturas anteriores.
- `POST /devices/:id/rotate-key` y `/revoke` (admin): rotar devuelve clave una vez y revocar invalida; no hay reactivación de dispositivos revocados.
- `GET /device` con `X-Device-Key`: diagnóstico del propio dispositivo, sin datos de terceros ni secretos. Permite al simulador verificar `SIMULATED` antes del primer envío.
- `POST /readings` con `X-Device-Key`, JSON <=4 KiB:

```json
{
  "readingId": "00000000-0000-4000-8000-000000000001",
  "measuredAt": "2026-11-15T12:00:00.000Z",
  "soilMoistureRaw": 1800,
  "airTemperature": 24,
  "airHumidity": 60,
  "mq2Raw": 300
}
```

Al menos una variable. ADC entero 0–4095, aire -50..80 °C y 0..100 %RH. La fecha del ejemplo debe sustituirse por la medición real. No se aceptan zona, origen ni índice de suelo calculado por el cliente. Se aplica la calibración guardada; sin ella `soilMoisture:null`. Confirmación 200 `{accepted:true,duplicate,id,readingId,measuredAt,receivedAt,origin}` sin comandos. Repetir el mismo contenido es idempotente; mismo identificador con contenido diferente 409. Clave inválida/revocada 401, dato inválido 400, exceso de solicitudes 429, JSON demasiado grande 413. Claves y hash nunca se devuelven en consultas ni logs.

- `GET /zones/:id/readings?from&to&limit&cursor` (dueño/admin): fechas ISO UTC, intervalo <=31 días; últimos siete días y 50 filas por defecto, hasta 200. Respuesta `{items,nextCursor,from,to}`; por fila se conserva zona, dispositivo, origen, fechas, ADC, índice relativo nullable, variables opcionales y versión de calibración. No mezcla lecturas de zonas ni expone hashes. Cursor ajeno se rechaza.
- `READINGS_MAX_AGE_HOURS=168` regula antigüedad admitida y `READINGS_RETENTION_DAYS=90` la limpieza explícita. Fecha futura se rechaza. Intervalo esperado de 300 s por defecto, mínimo 30; en línea hasta tres intervalos desde la medición más reciente. Limitador 60 peticiones/minuto por dispositivo en una instancia API. Reasignar o recalibrar no altera el historial.
- No existen eventos ni órdenes de riego. Simulación marcada desde el registro, antes de enviar; MQ2 no se convierte a ppm ni cambia el motor. La comparación con NASA se presenta pendiente.

H2 (contratos), H3 (perfiles demo) y H4 (agronomía) siguen siendo humanos.
Los perfiles de seed son propuestas editables, no decisiones aprobadas.

## Explicación por pasos y descansos (ampliación aditiva v1)

Se conservan `explanation` y `risks`. Cada paso de `sequence` añade
`reasons: [{text,effect}]`, con `effect: favor|contra|neutral`, y
`climate: {meanTemperature,rainMm,cycleDays}`: temperatura en °C a un
decimal, lluvia en mm y duración en días enteros; desconocidos `null`.
Los pesos aparecen una sola vez en la explicación plana; los riesgos no se repiten.

Cada recomendación y `baseline` (incluso inviable) añade
`rests: [{start,end,months,reason,suggestion}]`. Fechas inclusivas dentro
del horizonte de 24 meses (mes siguiente a `inputs.indicators.period.end`).
Son huecos de al menos un mes de fecha a fecha o un mes calendario completo,
separados por los límites de las ventanas originales (sin recorte a tres).
`months` cuenta los meses calendario tocados por el tramo.
Fuera de ventana: «Fuera de temporada: frío o falta de agua»; dentro:
«Ningún cultivo completa su ciclo en este tramo». Sin ventanas se usa el
primer motivo. Sugerencia: «Mantener cobertura o rastrojo para proteger el suelo».
El front acepta respuestas antiguas sin estos campos y conserva su explicación.

## Balance hídrico por paso (aditivo v1)

Cada paso añade `water: {etoMm,kc,demandMm,rainMm,coveragePct,method}`.
ETo acumulada y demanda ETc en mm; kc es el coeficiente estacional; lluvia
en mm, coveragePct = 100 × min(1, lluvia/demanda). Método `radiation`
con T2M y radiación mensual MJ/m²/día completos, o `catalog` si falta
algún dato: etoMm=null y demandMm=waterMm del catálogo, con aviso.
Lluvia desconocida y su cobertura son null; nunca se inventan aportes de riego.
coveragePct se publica a un decimal; los cálculos internos conservan precisión. Clientes antiguos
pueden omitir water; la UI muestra que no hay balance disponible.

Cada recomendación y baseline añade `irrigationNeedMm` entero: suma de max(0,demandMm−rainMm), con demanda completa si lluvia es null; baseline inviable publica 0. Agua se calcula por secuencia como clamp(100 × (1−déficit acumulado/ETo del horizonte),0,100), igual con y sin riego. ETo recorre desde el día de decisión hasta el fin del horizonte de 24 meses; sin temperatura/radiación válida o ETo positiva usa suma de demandas de la secuencia, con aviso y confianza media, salvo POWER incompleto o demanda de catálogo (baja). El beam recalcula agua al extender; los otros ejes se promedian. Heurística pendiente de H4. Los riesgos hídricos se resumen una vez por secuencia, sin repetir déficit por ciclo. La tarjeta presenta agua faltante y aportes enteros; acepta respuestas antiguas sin irrigationNeedMm.

## Bloque A — Credibilidad (2026-11-14)

`confidence` aplica spec 005 RF-7b: `low` por POWER incompleto/ausente o demanda `catalog`; `medium` por MODIS/histórico/historial incompletos o respaldo de ETo del horizonte; `high` sin esas limitaciones. Cada limitación se incluye en `warnings`. No equivale a validación agronómica.

Campo aditivo en recomendaciones y baseline: `riskGroups: [{type,text}]`. Tipos: `heat`, `temperature`, `frost`, `drought`, `water`, `data`, `schedule`, `other`. Calor resume el peor exceso sobre tolerancia (máxima y tolerancia del mismo ciclo) y ciclos afectados; `risks` conserva todos los textos originales. Baseline inviable: `riskGroups: []`. Clientes antiguos pueden omitir el campo.

La UI usa `inputs.indicators.sources` y `warnings` para «Qué sabemos / Qué falta». El estado NASA usa `trends` y las anomalías del mes correspondiente; no se añaden campos ni umbrales al contrato de indicadores. La ausencia de tendencia no acredita normalidad.
