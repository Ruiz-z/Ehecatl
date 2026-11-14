# Plan de implementación — Ehécatl

## Resumen
Monorepo con tres apps empaquetadas en Docker Compose: `apps/api` (NestJS + Prisma + Postgres) es la única dueña de la base de datos y aloja identity, farm-context, crop-knowledge, el motor de rotación y la caché NASA; `apps/geo` (FastAPI) es un servicio **sin estado** que consulta NASA POWER y MODIS (ORNL), normaliza, calcula anomalías y ventanas de cultivo; `apps/web` (Next.js + shadcn + Leaflet) es la interfaz. Specs: `docs/specs/spec-001` a `spec-006`.

## Decisiones de arquitectura
| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| `geo` sin estado; la caché vive en Postgres vía `api` (tabla `nasa_cache`) | Un solo dueño de la BD, `geo` se prueba sin base | Que `geo` tenga su propia BD (duplica migraciones y dependencias) |
| Motor de rotación en `api` como funciones puras TS (`rotation-engine/engine/*.ts`) | Determinista, testeable sin red ni BD, cerca del contexto de la parcela | Motor en Python dentro de `geo` (mezcla datos crudos con reglas de negocio) |
| Catálogo de cultivos como JSON versionado + validador al arrancar | Trazable (fuente por cultivo), editable sin migraciones | Tabla en BD con CRUD (más trabajo, sin valor para la demo) |
| Recomendaciones calculadas al vuelo, no persistidas | Siempre reflejan prioridades/datos actuales; menos esquema | Persistir recomendaciones (requiere invalidación) |
| Prioridades por usuario (no por zona) | Son del agricultor; simplifica UI | Prioridades por zona (más formularios, poco valor) |
| Ventanas de cultivo calculadas desde climatología mensual de 10 años | Funciona en cualquier país y hemisferio | Calendarios PV/OI o años fijos (descartado por el usuario) |
| Contratos JSON escritos primero (`docs/contracts.md`) | Permite trabajar en paralelo con mocks | Integrar sobre la marcha (bloqueos entre personas) |

## Modelo de datos (Prisma, convenciones de la constitución #4)
- `User` (email, passwordHash, name, `role: Role {FARMER, ADMIN}`)
- `Priorities` (userId único, water, soil, income, risk — enteros 0–100, normalizados)
- `Parcel` (ownerId, name, lat, lon)
- `Zone` (parcelId, name, lat?, lon?, currentCropId, irrigated: bool, soilNotes?)
- `CropHistory` (zoneId, cropId, plantedAt, harvestedAt, yieldTonHa?)
- `NasaCache` (key único = hash(lat, lon, variable, rango), payload Json, source, fetchedAt, expiresAt)
Cascada: Parcel → Zone → CropHistory.

## Grafo de dependencias
Prefijos: **H** humano · **I** infraestructura · **B** backend · **F** front.
```
I1 monorepo+compose ──┬─ I2 api scaffold ── B2 identity ── B3 parcelas/zonas ── B4 historial+prioridades ─┐
                      ├─ I3 geo scaffold ── B6 POWER ── B7 NDVI ── B8 climatología ── B9 ventanas ── B10 /indicators ─┤
                      └─ I4 web scaffold                                                                  │
B1 contratos ── H2 aprobar ── B11 catálogo ── B12 transiciones ── B13 viabilidad ── B14 scoring ── B15 casos límite ─┤
                                     │                                                                    ▼
                                H4 revisar fuentes   B5 GET /crops   B16 caché NASA ── B17 recomendaciones
                                                                                                           ▼
            H5 diseño (después del backend) ── F1 login ── F2 parcelas+mapa ── F3 indicadores ── F4 recomendaciones+prioridades ── F5 estados
                                                                                                           ▼
                    H3 perfiles demo ── B18 seed + precarga ── I5 compose desde cero ── H7 validación ── H8 ensayo
```

## Reparto en paralelo (3–4 personas)
| Grupo | Persona | Tareas |
|---|---|---|
| I — Infraestructura | Mau | I1–I4 primero (desbloquean a todos), I5 al cierre |
| B — Datos NASA (Python) | Persona A | B6–B10 |
| B — Motor + catálogo (TS) | Persona B | B11–B15, B17 |
| B — API (TS) | Mau / Persona C | B1–B5, B16, B18 |
| F — Front | Mau / Persona C | F1–F5 (tras H5) |
| H — Humano | Todos; Persona D si está | H2–H8 (H3 ya, sin esperar código; H1 resuelta) |

## Fases y checkpoints
Orden acordado: **primero todo el backend**, luego diseño y front.
1. **Fundación** (I1–I4, B1, H2–H3) → checkpoint: `docker compose up` levanta las 3 apps con `/health` y contratos aprobados.
2. **Backend** (B2–B17, H4) → checkpoint: `GET /zones/:id/recommendations` responde con datos reales para un punto.
3. **Diseño** (H5, etapa de diseño SDD, con lo contemplado en spec 006) → checkpoint: pantallas aprobadas.
4. **UI** (F1–F5) → checkpoint: flujo completo en navegador.
5. **Cierre** (B18, I5, H6–H8) → checkpoint: criterios de "listo para demo" de la constitución.

## Riesgos y mitigaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| POWER/ORNL lentos o caídos en la demo | Alto | Precarga de caché en el seed (B18); respuesta parcial (spec 003 RF-6) |
| Reglas agronómicas poco creíbles | Alto | Fuentes por cultivo según `docs/fuentes-agronomicas.md` y razones visibles; revisión humana (H4) |
| Integración tardía entre pistas | Alto | Contratos primero (B1 + H2) y mocks en tests |
| Tiempo (entrega en 24–48 h) | Alto | Recortar en orden: zonas múltiples en UI → gráficas → historial; nunca recortar explicación ni datos reales |
| Resolución gruesa de POWER (~50 km) | Medio | Mostrarla en UI; NDVI a 250 m aporta detalle; IoT como siguiente fase |

## Lista de tareas
Detalle con criterios de aceptación y verificación en [`tasks/todo.md`](todo.md).
