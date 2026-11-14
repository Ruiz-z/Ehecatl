# Clasificación de recursos NASA y socios para Ehécatl

Revisión de la lista oficial *NASA Data & Resources* y *Partner Resources* del reto Field Shift, clasificada contra la [spec 003](specs/spec-003-nasa-data.md) y la constitución #7 (fuentes abiertas, sin login). Registrada el 2026-11-14. Las notas marcadas **[verificado]** se comprobaron con llamadas reales; **[sin verificar]** quedan pendientes de confirmar antes de usarse.

**Conclusión:** la spec 003 no cambia. NASA POWER + MODIS (ORNL DAAC) son las únicas dos APIs globales de la lista que entregan series numéricas en JSON sin registro ni token.

## 1. Núcleo MVP v1 (global, sin login ni API key)

| Recurso | Endpoint | Uso en `apps/geo` | Estado |
|---|---|---|---|
| **NASA POWER** (comunidad `AG`) | `https://power.larc.nasa.gov/api/temporal/monthly/point` (o `daily/point`) | `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `GWETTOP`, `GWETROOT`; relleno `-999` = faltante | **[verificado]** monthly point respondió con `GWETROOT`, `GWETTOP`, `PRECTOTCORR` y `T2M` para 25.42, -101.0 |
| **MODIS MOD13Q1** vía ORNL DAAC | `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset` | NDVI 250 m (`250m_16_days_NDVI`, factor 0.0001) | **[verificado]** NDVI devolvió valores. La banda `250m_16_days_pixel_reliability` para filtrar calidad es **[sin verificar]**: confirmar el nombre contra la API antes de B7 |

Escala espacial: POWER da la línea base climática macro (~0.5°, ~50 km) y MODIS el vigor local a 250 m. La humedad medida en campo (IoT/ESP32) entraría como verdad de terreno en una fase posterior y se presenta solo como «siguiente fase».

## 2. Requieren cuenta gratuita (stretch)

Fuera del MVP porque exigen Earthdata/Copernicus y manejo de rásteres (HDF5, GeoTIFF, NetCDF/GRIB).

| Recurso | Cómo se suple en v1 |
|---|---|
| **SMAP** (humedad de suelo) | `GWETTOP` y `GWETROOT` de POWER (estimaciones de modelo; no afirmar que «asimilan datos SMAP», **[sin verificar]**) |
| **GPM / IMERG** (precipitación) | `PRECTOTCORR` de POWER |
| **ECOSTRESS** (temperatura de superficie, evapotranspiración) | ET₀ desde radiación y temperatura de POWER + Kc de FAO-56 |
| **Landsat 30 m, Sentinel-2 10–20 m** | MODIS 250 m |
| **NLDAS/GLDAS, GEDI, ERA5** | Sin sustituto en v1 |

## 3. Solo EE. UU. (adaptador opcional para el perfil de Nevada)

USDA Web Soil Survey / SSURGO / STATSGO2, Cropland Data Layer (CropScape), PRISM, NAIP, USGS NLCD, CoCoRaHS, USGS NWIS, USDA AMS Market News y NASS QuickStats, OpenET, USFS LANDFIRE. Chocan con la cobertura global, así que quedan fuera del núcleo. NASS QuickStats puede documentar el `marketValueTier` del usuario demo de Nevada, siempre con su fuente o marcado «estimado».

## 4. Validación agronómica (`crops.json`)

FAO GAEZ + ECOCROP (aptitud climática global) y USDA Ag Data Commons (respaldo bibliográfico para reglas de `family-transitions.json`). Detalle y enlaces en [`fuentes-agronomicas.md`](fuentes-agronomicas.md).

## 5. Ideas opcionales (no están en la spec; decidir antes de incluirlas)

- **SRTM (elevación/pendiente)** para riesgo de erosión, vía OpenTopoData (`https://api.opentopodata.org/v1/srtm90m?locations=lat,lon`) con 3 puntos cercanos. Los límites de uso de la API pública están **sin verificar**; con caché sería viable. No es MVP.
- **NASA GIBS / Worldview** (tiles WMTS públicos de IMERG y MODIS) como capa visual en Leaflet, sin login. Baja prioridad; el mapa base ya usa Esri.

## Pendientes de verificación

1. Nombre exacto de la banda de calidad de MODIS en ORNL (antes de B7).
2. Límites de uso de OpenTopoData, solo si se decide usar SRTM.
3. Redacción para el pitch: describir `GWETTOP`/`GWETROOT` como estimaciones de modelo de POWER, no como datos SMAP.
