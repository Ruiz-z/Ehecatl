# Verificación del traspaso — 2026-11-14

> Nota Bloque A (2026-11-14): los perfiles ahora apuntan a San Pedro (25.76, −102.98), Fallon (39.47, −118.78) y San Martín (−33.08, −68.47). La evidencia siguiente corresponde a los puntos anteriores y a las reglas de confianza de entonces; no acredita los nuevos puntos. Quedan pendientes seed, mapa, pico NDVI ≥0.4 y opciones reales, a verificar por el usuario.

Evidencia técnica del trabajo en `fix/pendientes-equipo`, desde `origin/dev`.
No sustituye las aprobaciones humanas H2, H3, H4 ni el ensayo H8.

## Compose desde cero (I5)

- Proyecto de prueba exclusivo `ehecatl-pendientes-qa`, puertos distintos y volumen
  `ehecatl-pendientes-qa-postgres-data`; las bases existentes se conservaron.
- Se eliminó únicamente ese volumen de prueba y se ejecutó
  `docker compose up --build -d --wait`: PostgreSQL, Geo, API y web saludables.
- El entrypoint aplicó `202611140001_backend`, ejecutó el seed compilado con
  `GEO_URL=http://geo:8000` y después inició Nest, sin comandos manuales de migración/seed.
- Login real de admin y tres agricultores verificado en las seis pruebas E2E API.
- Reinicio de API: migraciones y seed se repiten correctamente; antes y después
  permanecen **4 usuarios, 3 parcelas y 3 zonas**.
- Se descubrió y corrigió la biblioteca de sistema faltante `libexpat1`, con
  autorización del usuario. El build de Geo comprueba `import rasterio`.
- El build final de web utiliza la API real por defecto; el modo de ejemplo
  requiere habilitarlo explícitamente y conserva su marca visible.
- Tras terminar, se retiraron los contenedores, red y volumen exclusivos de QA
  y su configuración temporal con secretos. El PostgreSQL preexistente en 55433
  continúa funcionando. El `.env` raíz queda preparado e ignorado por Git para
  ejecutar el Compose normal con `docker compose up --build`.

## Perfiles y cobertura real

Fuente de los resultados: [`verification/pendientes-live.json`](verification/pendientes-live.json).
Periodo observado: noviembre de 2025 a octubre de 2026; POWER y MODIS disponibles
en los tres puntos. NDVI proviene de MODIS Terra/Aqua vía Planetary Computer.

| Perfil propuesto | Riego declarado | Primera alternativa | Meses NDVI válidos | Referencia actual | Recomendación desde caché |
|---|---|---|---|---|---|
| Coahuila | Sí | Caupí → Sorgo → Caupí | 10/12 | Viable, 43.52 | 63 ms |
| Nevada | Sí | Papa → Soya | 12/12 | Inviable: ciclo de alfalfa de 600 días no cabe | 47 ms |
| Mendoza | Sí | Soya → Trigo sarraceno → Soya | 12/12 | Viable, 37.43 | 47 ms |

En Coahuila faltan NDVI válidos de mayo y junio de 2026; no se rellenan.
`available` indica que el proveedor devolvió observaciones utilizables, no que
cada mes tenga cobertura completa. La confianza del motor sigue baja por datos
incompletos; no se ocultan los avisos.

Se crearon y eliminaron parcelas nuevas en Coahuila y Mendoza. En ambas, sin
riego declarado se reprodujo `no_viable_options`; al declarar riego se obtuvieron
dos alternativas y referencia viable. En Coahuila las razones incluyen lluvia
insuficiente por ciclo; en Mendoza las ventanas de temporal no permiten completar
los ciclos. No se cambió el catálogo, el perfil demo ni las reglas para forzar
resultados. Declarar riego requiere disponibilidad efectiva y revisión H3/H4.

## Requisitos y pruebas

| Spec / RF | Evidencia |
|---|---|
| 005 RF-1, 1b | `engine.spec.ts`, `schedule.spec.ts`, QA tropical: hasta tres ciclos, ventanas continuas, perennes y ausencia de solapamiento |
| 005 RF-1c | Referencia fuera del haz, mismos pesos/reglas, referencia viable/inviable, sin ventanas, diferencias correctas y determinismo en `engine.spec.ts`; adaptación web en `adapters.test.ts` |
| 005 RF-2 | Familia, nitrógeno, cobertura y plagas: pruebas de transición en `engine.spec.ts` |
| 005 RF-3 | Agua, temperatura, heladas y duración: `engine.spec.ts`, `schedule.spec.ts` y diagnóstico real con/sin riego |
| 005 RF-4 | Riesgo actual por sequía/calor y alternativa tolerante: `engine.spec.ts`, `qa-e2e.spec.ts` |
| 005 RF-5, 6, 9 | Cambios de prioridades, componentes, explicación y determinismo: motor, adaptador y E2E real |
| 005 RF-7, 8 | Confianza reducida por datos/historial faltantes: `engine.spec.ts` y respuestas reales |
| 003 RF-1 a 4 | Normalización, calidad, escala, climatología, anomalías y ventanas: `test_nasa.py`, `test_planetary_modis.py`, `test_modis_aqua.py`, `test_qa_e2e.py` |
| 003 RF-5 a 8 | Caché, origen, fallos parciales: `nasa.spec.ts`, `database.spec.ts`; precarga automática real de los tres puntos |
| 001 RF-1 a 6 | Login, JWT/bcrypt, aislamiento dueño/admin: `access.spec.ts`, `database.spec.ts`, E2E y seed real de cuatro usuarios |

`pnpm lint` pasa en API, Geo y web. `pnpm test` con PostgreSQL de prueba:
**74 API + 38 Geo + 17 web = 129 pruebas pasan**; quedan 11 pruebas en vivo
omitidas porque Turbo filtra las variables `QA_API_URL`/`QA_GEO_URL`.
Las seis E2E API se ejecutaron directamente por paquete y pasan, incluyendo
los cuatro logins, aislamiento, MODIS, perfiles distintos y un punto nuevo en Nairobi.
También pasan las cinco pruebas Geo en vivo: Coahuila, Nevada, Mendoza, Veracruz
y un punto oceánico sin error 500. En total quedan cubiertas **140 pruebas distintas**
(129 de la suite con PostgreSQL + 11 verificaciones adicionales en vivo).

Comandos para ejecutar las pruebas en vivo con `QA_API_URL`, `QA_GEO_URL` y
`SEED_DEMO_PASSWORD` definidos, sin que Turbo filtre las variables:

```powershell
pnpm --filter api test --runTestsByPath test/qa-e2e.spec.ts --testNamePattern 'QA E2E Live'
pnpm --filter geo exec uv run python -m pytest tests/test_qa_e2e.py -k live_geo
```

## Pendientes humanos y de siguiente fase

- H2: aprobación del contrato y H3/H4: perfiles, disponibilidad de riego y valores agronómicos.
- Dos meses NDVI sin valor válido en Coahuila; conservar el faltante mientras no exista observación utilizable.
- Spec 007 en borrador y sensores como siguiente fase, por decisión del usuario.
- ETo/ETc y entrevista inicial requieren specs propias; visión artificial/dron fuera de la beta.
- La prueba de servicios no sustituye una revisión visual completa del flujo web ni el ensayo humano H8.
