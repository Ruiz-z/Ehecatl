# Verificación backend — 2026-11-14

Implementado en cuatro ramas locales que nacen de `dev` (`d1a07fe`):

| Rama | Contenido |
|---|---|
| `feat/backend-contratos` | B1, ejemplos JSON para revisión H2 |
| `feat/backend-nasa` | B6–B10, clientes y análisis Python |
| `feat/backend-api` | B2–B5, B11–B18, modelos y migración, tests API |
| `feat/backend-integracion` | Los tres bloques por cherry-pick, ajustes y verificación conjunta |

`dev` no se modificó. No se hizo push ni merge a dev. El fetch SSH devolvió
`Permission denied (publickey)`; se usó el dev local, coincidente con la
referencia origin/dev disponible. Actualizar dev con la llave del equipo y
revisar los cambios nuevos antes del merge compartido.

Para revisar todo junto, comparar `dev...feat/backend-integracion`. Esa rama
contiene todos los cambios; puede ser la única rama que se integre a dev.
Las otras tres conservan bloques separados para revisión. No hace falta
integrar las cuatro: la rama de integración ya incluye los tres bloques.

## Evidencias

- `pnpm lint`: API, geo y web pasan.
- `pnpm test`: 55 pruebas API y 13 geo pasan, incluidas cuatro de integración
  con PostgreSQL real mediante `TEST_DATABASE_URL`.
- `pnpm --filter api build` y compilación del seed pasan.
- `prisma migrate deploy`: migración aplicada en PostgreSQL 16 aislado,
  puerto 55432; ninguna base de desarrollo se usó en la prueba.
- Dos ejecuciones de `prisma db seed`: permanecen cuatro usuarios (admin y tres
  agricultores), tres parcelas y tres zonas. Contraseñas efímeras vía entorno.
- Login real y `curl` de recomendaciones contra el build de API, puerto 13001:
  Coahuila sin riego devuelve ninguna viable con razones; Nevada y Mendoza
  devuelven secuencias distintas. POWER real, MODIS ausente y confianza baja.
  Comprobación adicional en la imagen Docker final: health, los 18 cultivos y
  recomendaciones funcionan; segunda consulta HTTP desde caché: 21 / 13 / 20 ms
  dentro del contenedor. Docker también ejecuta `prisma migrate deploy` sin errores.
  Detalle sin secretos: [`verification/backend-live.json`](verification/backend-live.json).
- Fixture POWER grabada desde NASA con URL y fecha en
  `apps/geo/tests/fixtures/power_recorded_coahuila.meta.json`; las demás fixtures
  sintéticas se usan únicamente en tests y los contratos declaran `origin: mock`.

## Cobertura de requisitos

| Spec | RF | Evidencia |
|---|---|---|
| 001 | 1–3 | Login bcrypt/JWT, 401 genérico, firma y expiración: `access.spec.ts` |
| 001 | 4–5 | Ownership agricultor propio/ajeno/admin: tests HTTP y PostgreSQL |
| 001 | 6 | Seed real ejecutado dos veces, cuatro usuarios; perfiles sujetos a H3 |
| 002 | 1, 2, 5, 5b | Coordenadas globales, zona por defecto e independientes, CRUD |
| 002 | 3–4 | Historial con fechas reales y pesos enteros normalizados a 100 |
| 002 | 6–7 | Acceso por zona e historial, cascadas reales y última zona protegida |
| 003 | 1, 3 | POWER real, conversión mm/day a mm/month, relleno y metadatos |
| 003 | 2 | NDVI 0.0001, calidad, agregación y paginación: tests sintéticos; falta fixture real |
| 003 | 3b, 4 | Climatología, anomalías, cuatro tendencias, riego y ambos hemisferios |
| 003 | 5–7 | Hit/miss persistido, TTL, origen, fallos parciales y rangos inválidos |
| 003 | 8 | Precarga real de los tres puntos ejecutada; ORNL no respondió |
| 004 | 1–5 | 18 cultivos, fuentes, validador y todas las parejas de familias; H4 pendiente |
| 005 | 1, 1b | Secuencias sobre ventanas reales, secuencia reducida y barbecho |
| 005 | 2–4 | Familia, N, plagas, cobertura, meses ocupados, riesgo por sequía/calor |
| 005 | 5–6, 9 | Componentes y pesos publicados; ranking cambia con prioridades |
| 005 | 7–8 | Menor confianza con fuentes faltantes o sin historial |
| 005 | Casos límite | Ninguna viable, perennes sin solapamiento, desempate estable |

## Pendientes explícitos

- **B7:** cliente implementado, pero ORNL devolvió timeouts y HTTP 503, incluso
  al intentar el ejemplo público directo. Falta grabar una respuesta NDVI real
  y repetir la comprobación cuando el servicio se recupere. No se sustituyó
  por datos inventados. La ruta conserva POWER y avisa del faltante.
- **B18/H3:** seed implementado y probado con perfiles propuestos editables.
  H3 debe aprobarlos; Coahuila sin riego ilustra el caso sin opción viable.
- **H2:** revisar y aprobar el contrato escrito. **H4:** validar valores
  representativos del catálogo y umbrales; no son valores por cultivar validados.
- **I5:** automatizar migraciones y seed al arrancar Compose corresponde a infra;
  hasta entonces la migración se aplica manualmente como explica `apps/api/BACKEND.md`.
- Stretch B-S1/B-S2 quedan fuera del backend MVP y requieren ampliar la spec.

Las herramientas Node 24/pnpm/uv usadas para verificar quedaron fuera del repo,
en `C:\vsCodePersonal\.backend-tools`; no se añadieron dependencias npm
fuera de bcrypt, @nestjs/jwt y @types/bcrypt, autorizadas en la conversación.
