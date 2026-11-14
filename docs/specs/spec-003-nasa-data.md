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
| Vigor de vegetación (NDVI) | MODIS MOD13Q1 vía ORNL DAAC REST | `250m_16_days_NDVI` | 250 m |

SMAP, GPM/IMERG y ECOSTRESS requieren Earthdata login: quedan como **stretch** si alguien crea una cuenta (gratuita).

## Usuarios / actores
Motor de rotación y dashboard (consumidores internos); el agricultor ve los indicadores resultantes.

## Historias de usuario
- H1: Como agricultor quiero ver el clima, la lluvia, la humedad del suelo y la salud de la vegetación de mi zona, con datos NASA reales.
- H2: Como motor de rotación quiero tendencias (sequía, calor, lluvia errática) calculadas contra la normal histórica.
- H3: Como equipo quiero caché para no depender de la latencia de las APIs durante la demo.

## Requisitos funcionales (EARS)
- RF-1: CUANDO se solicita un punto (lat, lon, rango de fechas), EL SISTEMA obtiene de NASA POWER temperatura, precipitación, humedad relativa, radiación y humedad de suelo (`GWETTOP`, `GWETROOT`).
- RF-2: CUANDO se solicita un punto, EL SISTEMA obtiene la serie NDVI de MODIS (MOD13Q1) vía el servicio ORNL DAAC y aplica el factor de escala (0.0001).
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
- Punto en el océano o sin cobertura MODIS → NDVI no disponible.
- Valores de relleno de POWER (`-999`) → se tratan como faltantes, nunca como datos.
- Rango de fechas futuro o inválido → 400.
- POWER tiene resolución gruesa (~50 km): se informa en la respuesta y en la UI.

## Fuera de alcance
SMAP, IMERG, ECOSTRESS (requieren Earthdata), rásteres completos, Landsat, Sentinel-2 y datasets solo de EE. UU. (stretch).

## Criterios de finalización
RF-1 a RF-8 con test en verde + demo: tres puntos distintos (Coahuila, Nevada y uno libre) devuelven datos reales con su origen.

## Dudas abiertas
- Ninguna bloqueante. Si se crea cuenta de Earthdata, se abre spec de ampliación para SMAP/IMERG.
