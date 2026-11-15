# Spec 003 — NASA data (ingesta, normalización y caché)

## Contexto y objetivo
Obtener observaciones reales de la NASA para cualquier lat/lon y convertirlas en indicadores simples y comparables que alimenten el motor de rotación (constitución #7, #8). Servicio Python en `apps/geo`. **Sin cuenta de NASA Earthdata**: solo fuentes abiertas sin login.

## Fuentes (verificadas sin login, 2026-11-14)
| Variable | Fuente | Parámetro / producto | Resolución |
|---|---|---|---|
| Temperatura (media, máx., mín.) | NASA POWER API (community `AG`) | `T2M`, `T2M_MAX`, `T2M_MIN` | ~0.5° |
| Precipitación | NASA POWER API | `PRECTOTCORR` | ~0.5° |
| Humedad relativa, radiación | NASA POWER API | `RH2M`, `ALLSKY_SFC_SW_DWN` | ~0.5° |
| Humedad de suelo (superficie / raíz) | NASA POWER API | `GWETTOP`, `GWETROOT` | ~0.5° |
| Vigor de vegetación (NDVI) | MODIS MOD13Q1 vía ORNL DAAC REST; respaldo Microsoft Planetary Computer con Terra y complemento Aqua/MYD13Q1 | `250m_16_days_NDVI` | 250 m |

SMAP, GPM/IMERG y ECOSTRESS requieren Earthdata login: quedan como **stretch** si alguien crea una cuenta (gratuita).

## Usuarios / actores
Motor de rotación y dashboard (consumidores internos); el agricultor ve los indicadores resultantes.

## Historias de usuario
- H1: Como agricultor quiero ver el clima, la lluvia, la humedad del suelo y la salud de la vegetación de mi zona, con datos NASA reales.
- H2: Como motor de rotación quiero tendencias (sequía, calor, lluvia errática) calculadas contra la normal histórica.
- H3: Como equipo quiero caché para no depender de la latencia de las APIs durante la demo.

## Requisitos funcionales (EARS)
- RF-1: CUANDO se solicita un punto (lat, lon, rango de fechas), EL SISTEMA obtiene de NASA POWER temperatura, precipitación, humedad relativa, radiación y humedad de suelo (`GWETTOP`, `GWETROOT`).
- RF-2: CUANDO se solicita un punto, EL SISTEMA obtiene la serie NDVI de MODIS (MOD13Q1) vía el servicio ORNL DAAC y aplica el factor de escala (0.0001). SI ORNL falla, excede su presupuesto o pierde lotes, ENTONCES intenta el respaldo anónimo de Microsoft Planetary Computer para el mismo punto y rango, sin modificar las demás fuentes ni el contrato JSON.
- RF-2b: EL SISTEMA consulta la colección `modis-13Q1-061` filtrando primero Terra (MOD13Q1), pagina todas las escenas y lee únicamente el píxel correspondiente de NDVI y `pixel_reliability`. Prefiere la API pública de valores puntuales crudos (`unscale=false`, no imágenes coloreadas); si falla, lee ambos GeoTIFF con `rasterio`. Solo acepta calidad 0/1 y NDVI crudo entre -2000 y 10000; conserva la agregación mensual existente. La fuente de cada indicador identifica al proveedor y producto reales.
- RF-2c: Para lectura directa GeoTIFF, EL SISTEMA obtiene automáticamente un SAS temporal por contenedor desde la API pública de Planetary Computer, sin cuenta, API key ni secretos persistidos. El respaldo comparte el presupuesto total MODIS de 120 s por defecto; un fallo conserva los datos ORNL exitosos y nunca inventa cobertura. Una respuesta ORNL vacía sin errores sigue representando falta de cobertura y no activa el respaldo.
- RF-2d: SI en el respaldo Planetary Computer faltan meses con NDVI Terra válido, ENTONCES EL SISTEMA intenta completar únicamente esos meses con Aqua/MYD13Q1 del mismo punto y rango. Se aplica la misma preferencia Terra → Aqua al periodo reciente y al histórico; no se promedian entre sí los productos mensuales, no se duplican meses y no se reemplaza Terra válido. Aqua conserva calidad 0/1, escala 0.0001, resolución 250 m y origen explícito. Un fallo de Aqua conserva los resultados de Terra. Ambos comparten el presupuesto existente y no se agregan dependencias.
- RF-3: EL SISTEMA normaliza cada variable a un indicador (valor, unidad, fuente, fecha, resolución) y lo agrega por mes.
- RF-3b: EL SISTEMA calcula las **ventanas de cultivo** de cada zona a partir de su climatología mensual (temperatura media y lluvia de los últimos 10 años): meses consecutivos con temperatura dentro de un rango útil y agua suficiente (lluvia, humedad de suelo o riego declarado). El resultado puede ser 0, 1, 2 o más ventanas al año y funciona en ambos hemisferios.
- RF-4: EL SISTEMA calcula la anomalía de cada variable contra la normal del mismo punto (ventana histórica configurable, por defecto 10 años) y clasifica tendencias: sequía, calor, lluvia errática, vegetación estresada.
- RF-5: CUANDO ya existe una respuesta cacheada vigente para (punto, variable, rango), EL SISTEMA la sirve sin llamar a la API externa.
- RF-6: SI una fuente falla o excede el timeout, ENTONCES EL SISTEMA devuelve las demás variables y marca la faltante como no disponible, sin romper la respuesta.
- RF-7: EL SISTEMA expone en cada respuesta el origen (`live`, `cache`, `mock`).
- RF-8: CUANDO se ejecuta el seed, EL SISTEMA precarga la caché de los puntos de los usuarios demo.

## Requisitos no funcionales
- Respuesta cacheada < 500 ms. Sin credenciales necesarias en v1.

## Casos límite
- Preparación ESP32 (2026-11-15): se conservan fuente, producto, fecha y resolución por observación en la UI. Las lecturas se presentan por separado; no se comparan datos de hoy contra promedios mensuales como si fueran simultáneos.
- Punto en el océano o sin cobertura MODIS → NDVI no disponible.
- Valores de relleno de POWER (`-999`) → se tratan como faltantes, nunca como datos.
- Rango de fechas futuro o inválido → 400.
- POWER tiene resolución gruesa (~50 km): se informa en la respuesta y en la UI. Por diseño, POWER da la línea base climática macro de 10 años y MODIS (250 m) el vigor local de la parcela; la humedad medida en campo (nodos IoT/ESP32) entraría como verdad de terreno en una fase posterior y se muestra solo como «siguiente fase», nunca simulada como dato real.

## Fuera de alcance
SMAP, IMERG, ECOSTRESS (requieren Earthdata), rásteres completos, Landsat, Sentinel-2 y datasets solo de EE. UU. (stretch).

## Criterios de finalización
RF-1 a RF-8 con test en verde + demo: tres puntos distintos (Coahuila, Nevada y uno libre) devuelven datos reales con su origen.

## Dudas abiertas
- Ninguna bloqueante. Si se crea cuenta de Earthdata, se abre spec de ampliación para SMAP/IMERG.

## Empaquetado verificado — 2026-11-14

- La imagen runtime de Geo incluye `libexpat1`, biblioteca del sistema requerida por `rasterio` en `python:3.12-slim`. Dependencia autorizada explícitamente por el usuario tras reproducir `ImportError: libexpat.so.1` en Compose limpio. El build comprueba `import rasterio` para impedir que una imagen incompleta llegue a la demo. No cambia el contrato ni los filtros o proveedores NASA.

## Decisión de respaldo MODIS — 2026-11-14

- Autorizado como fix acotado: ORNL sigue siendo principal; solo se añade Planetary Computer como respaldo del mismo producto NASA y se permite `rasterio` para lectura puntual y reproyección. No se añaden sensores, credenciales del usuario ni cambios al motor, perfiles demo o POWER.
- Los dos proveedores comparten filtros de relleno/calidad y normalización. No se duplican meses al combinar resultados; los meses ORNL ya obtenidos tienen preferencia. Si el respaldo termina correctamente, los errores recuperados de ORNL no degradan por sí solos el estado MODIS; si también falla el respaldo, se conserva el estado parcial/no disponible.
- Se verifica con pruebas de paginación, plataforma Terra, SAS anónimo por contenedor, lectura puntual/reproyección, filtros de calidad, timeout y conservación de datos, además de las QA originales sin cambios.
- Referencias: [colección MODIS](https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-13Q1-061), [acceso SAS anónimo](https://planetarycomputer.microsoft.com/docs/concepts/sas/).

## Ampliación autorizada Terra → Aqua — 2026-11-14

- Se amplía el respaldo anterior para completar meses nubosos de Terra con observaciones reales Aqua. Esta decisión sustituye la restricción inicial a Terra en RF-2b; ORNL, POWER, la API y el motor conservan su comportamiento.
- Las observaciones Aqua se identifican como `MODIS MYD13Q1 / Microsoft Planetary Computer`. No se aceptan datos con calidad 3 ni se hacen excepciones por ubicación; si ambos productos carecen de datos válidos, se conserva `partial`/`unavailable`.
- Verificación: precedencia de Terra, complemento mensual histórico/reciente, filtro de plataforma/producto Aqua, nubes y fallos del complemento, más las QA originales sin cambios.
- Referencia NASA: [MODIS Terra/Aqua, resolución y composiciones desfasadas](https://modis.gsfc.nasa.gov/data/dataprod/mod13.php).

## Bloque A — Perfiles agrícolas de demo (2026-11-14)

Los perfiles conservan correos, cultivos, riego y prioridades. Los puntos candidatos son San Pedro/Comarca Lagunera (25.76, −102.98), Fallon/Lahontan (39.47, −118.78) y San Martín/Mendoza (−33.08, −68.47). H3 requiere imagen satelital de parcelas, pico estacional de climatología NDVI ≥0.4 y opciones de rotación para los tres. La comprobación NASA/mapa y la reejecución del seed quedan a cargo del usuario; cambiar coordenadas no acredita esos criterios. No hay reglas regionales.

## Historia mensual por año (2026-11-15)

- RF-3c: La respuesta añade `history`, filas `{variable,year,month,value}` de los años base de POWER para T2M, T2M_MAX, T2M_MIN, PRECTOTCORR y ALLSKY_SFC_SW_DWN. Lluvia en mm/mes y radiación en MJ/m²/día. No interpola ni rellena. Conserva nulos observados y ordena por año, mes y variable. No incluye MODIS ni meses recientes. La clave de caché pasa a v2.
