# Fuentes agronómicas — catálogo de cultivos y reglas de rotación

Este documento lista las fuentes de dónde sale cada dato del catálogo (`crops.json`) y de la tabla de transiciones entre familias (`family-transitions.json`). Constitución #11: todo dato agronómico cita su fuente. Spec relacionada: [`spec-004-crop-knowledge.md`](specs/spec-004-crop-knowledge.md). Revisión humana: tarea **H4**.

> Links verificados el 2026-11-14 salvo los marcados "(no verificado)": no respondieron desde aquí, se deben comprobar a mano.

## 1. Requisitos climáticos de cada cultivo

### FAO ECOCROP
- **Link:** https://gaez.fao.org/pages/ecocrop
- **Qué da:** por especie, rangos de temperatura (óptimo y absoluto), precipitación anual, duración del ciclo (días), tolerancia a heladas, pH y textura de suelo.
- **Campos que alimenta:** `tempMin`, `tempOptMin`, `tempOptMax`, `tempMax`, `rainMin`/`rainMax`, `cycleDays`, `frostSensitive`.
- **Por qué:** es la referencia global estándar para "¿puede crecer este cultivo aquí?"; no depende de un país, igual que el resto del proyecto.

### FAO GAEZ v4 (Global Agro-Ecological Zones)
- **Link:** https://gaez.fao.org/
- **Qué da:** aptitud agroclimática y rendimiento potencial por cultivo en todo el mundo (secano y riego).
- **Campos que alimenta:** validación de la viabilidad que calcula el motor; argumento de pitch ("coincide con GAEZ").
- **Por qué:** lo menciona el propio reto en su pestaña de recursos.

## 2. Demanda de agua

### FAO Irrigation and Drainage Paper 56 — Crop Evapotranspiration
- **Link:** https://www.fao.org/4/x0490e/x0490e00.htm
- **Qué da:** coeficientes de cultivo (Kc) por etapa, duración de etapas y método Penman-Monteith para evapotranspiración.
- **Campos que alimenta:** `waterDemand` (bajo/medio/alto) y, si da tiempo, el cálculo de demanda con temperatura y radiación de NASA POWER.

### FAO Irrigation and Drainage Paper 66 — Crop Yield Response to Water
- **Link:** https://www.fao.org/4/i2800e/i2800e.pdf
- **Qué da:** sensibilidad del rendimiento al déficit hídrico por cultivo (factor Ky).
- **Campos que alimenta:** `droughtTolerance`.

## 3. Reglas de rotación entre cultivos

### SARE — Crop Rotation on Organic Farms: A Planning Manual
- **Link:** https://www.sare.org/resources/crop-rotation-on-organic-farms/
- **Qué da:** familias botánicas, por qué no repetir familia, intervalos de retorno para cortar ciclos de plagas y enfermedades, efectos de cada familia en el suelo.
- **Campos que alimenta:** `family`, tabla `family-transitions.json` (buena / neutra / a evitar con su razón), años mínimos de retorno.

### SARE — Managing Cover Crops Profitably (3.ª ed.)
- **Link:** https://www.sare.org/resources/managing-cover-crops-profitably-3rd-edition/
- **Qué da:** fijación de nitrógeno de leguminosas, cobertura de suelo, control de erosión y aporte de materia orgánica por especie.
- **Campos que alimenta:** `nitrogenBalance` (fija / neutro / consume), `soilCover`, opción "cobertura/barbecho" cuando no hay cultivo viable (spec 005 RF-1b).

### USDA NRCS — Conservation Practice Standard 328, Conservation Crop Rotation
- **Link:** https://www.nrcs.usda.gov/resources/guides-and-instructions/conservation-crop-rotation-ac-328-conservation-practice-standard (no verificado)
- **Qué da:** criterios oficiales de una rotación que mejora el suelo: reducir erosión, mantener materia orgánica, manejar plagas y nutrientes.
- **Campos que alimenta:** criterios del puntaje de "salud de suelo" del motor y su explicación.

## 4. Contexto regional (validación de la demo)

### SIAP (México) — estadística agrícola
- **Links:** https://www.gob.mx/siap · cierre agrícola: https://nube.siap.gob.mx/cierreagricola/ (no verificado)
- **Qué da:** superficie sembrada, rendimiento y cultivos por estado y municipio, por ciclo PV/OI.
- **Uso:** confirmar que las recomendaciones para el perfil de Coahuila son cultivos que de verdad se siembran ahí; etiquetas PV/OI solo para visualización.

### INIFAP (México)
- **Link:** https://www.gob.mx/inifap
- **Qué da:** paquetes tecnológicos por cultivo y región (fechas de siembra, variedades, manejo).
- **Uso:** validar ventanas de siembra del perfil de Coahuila.

### USDA NASS QuickStats (EE. UU.)
- **Uso:** lo mismo que SIAP para el perfil de Nevada. Está en la lista de recursos del reto; se usa solo como validación (el adaptador EE. UU. es stretch).

## 5. Datos NASA (no agronómicos, referencia de variables)
- **NASA POWER — documentación:** https://power.larc.nasa.gov/docs/ (parámetros `T2M`, `PRECTOTCORR`, `GWETTOP`, `GWETROOT`…).
- **MODIS/VIIRS Web Service (ORNL DAAC):** https://modis.ornl.gov/data/modis_webservice.html (NDVI `MOD13Q1`).

## Mapa campo → fuente

| Campo del catálogo | Fuente principal | Respaldo |
|---|---|---|
| Rangos de temperatura, heladas | ECOCROP | GAEZ |
| Lluvia necesaria, `waterDemand` | ECOCROP, FAO-56 | GAEZ |
| `cycleDays` | ECOCROP | FAO-56 (duración de etapas) |
| `droughtTolerance` | FAO-66 (Ky) | ECOCROP |
| `family` | SARE Crop Rotation | — |
| `nitrogenBalance`, `soilCover` | SARE Cover Crops | NRCS 328 |
| Transiciones entre familias | SARE Crop Rotation | NRCS 328 |
| Validación regional | SIAP / INIFAP (MX), NASS (EE. UU.) | GAEZ |

## Cómo citar en `crops.json`
Cada cultivo lleva un campo `sources` con las claves de este documento:

```json
{
  "id": "sorghum",
  "name": "Sorgo",
  "family": "Poaceae",
  "sources": ["ecocrop", "fao56", "fao66", "sare-rotation"]
}
```

Claves: `ecocrop`, `gaez`, `fao56`, `fao66`, `sare-rotation`, `sare-cover`, `nrcs-328`, `siap`, `inifap`, `nass`.
