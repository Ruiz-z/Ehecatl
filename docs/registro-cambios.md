# Registro de cambios

## 2026-11-14 — Estado del campo en lenguaje llano

- **Archivos:** `apps/web/package.json`, `apps/web/src/features/nasa/{copy.ts,verdict.ts,verdict.test.ts,types.ts,field-status.tsx,field-charts.tsx,fixtures/observations.ts}`, `apps/web/src/features/parcels/{fixtures/parcels.ts,parcel-detail.tsx}`, `apps/web/src/features/rotation/recommendations.tsx`, `apps/web/src/shared/api/{adapters.ts,adapters.test.ts,types.ts}`, `apps/web/src/shared/components/map-canvas.tsx`, `apps/web/src/app/globals.css`, `docs/{design.md,registro-cambios.md}`, `docs/specs/spec-006-web-ui.md`.
- **Qué se cambió:** RF-4b y requisitos relacionados actualizados antes del código. Diccionario único con los textos aprobados, resumen puro de cuatro casos, aviso de mes pendiente, barras de tres zonas con texto accesible, ayudas con `aria-expanded` operables con teclado y cajones de dato exacto. Gráficas con títulos y leyendas aprobados. Los tonos de clima y gráficas conservan tendencias y comparaciones del API; humedad y verdor usan constantes documentadas como «heurística pendiente de H4». Mocks pasan por el mismo diccionario; máxima sintética separada de temperatura media. Se retiran nombres técnicos visibles del mapa y guiones largos de los rangos de la web. No se modifican API, Geo ni dependencias.
- **Por qué:** que el agricultor entienda qué dicen los datos y qué acción considerar, sin convertir valores absolutos de verdor en diagnósticos ni rellenar lecturas ausentes.
- **Textos faltantes en el plan:** comparaciones sin referencia, resumen con tendencias ausentes, lluvia irregular sin sequía, calor activo con máxima mensual inferior a la referencia y acumulado anual sin referencia completa. Se reutiliza «Sin comparación suficiente» donde falta comparación; sin tendencias no se afirma ausencia de alertas. No hay etiquetas cortas para las zonas de verdor: se usan las oraciones aprobadas. Solo se proporcionó prosa de dato exacto para MODIS; los otros indicadores conservan las etiquetas existentes Valor/Fuente/Fecha. Los avisos del API se conservan completos, sin redactar sustitutos nuevos.
- **Verificación:** `pnpm lint` aprobado (3 tareas, 2 desde caché); `pnpm test` aprobado: web 42, API 101 con 10 omitidos, Geo 38 con 5 omitidos. `pnpm --filter web build` aprobado. Chromium con mocks a 1440 y 390 px: sin desbordamiento ni errores JavaScript; ayudas con Enter, barras accesibles, dato exacto y enlace a Qué sembrar comprobados. Capturas en `/tmp/ehecatl-estado-{1440,390}.png`. Búsqueda final en `apps/web/src`: términos técnicos restantes solo en identificadores, fixtures, tests, comentario CSS, fuente tipográfica y bloque Nombre técnico. `git diff --check` limpio.
- **Límites:** no se probaron NASA en vivo, lector de pantalla ni todos los estados con un API real; las suites conservaron las omisiones indicadas. No se ejecutó Docker Compose. Node disponible 26.13.1 frente a 24 requerido; pnpm 10.34.9 ejecutado con caché temporal porque la ubicación predeterminada es de solo lectura.
- **Git:** rama `feat/estado-entendible` conservada. Sin commit: `git add` rechazado con `Unable to create .git/index.lock: Read-only file system`. Cambios en el árbol; sin push, secretos ni `apps/web/AGENTS.md` en staging.
- **Ajustes de revisión:** el cultivo va en minúscula dentro de la frase («Tu maíz…»), «en octubre de otros años» sustituye a «otros octubre», y el resumen avisa «Revisa tus plantas» cuando lluvia y calor van normales pero el verdor de la zona está por debajo de lo normal (antes decía «Sin alertas por ahora» junto a «plantas mucho más secas»).

## 2026-11-14 — Tarjeta de NDVI sin hueco vacío

- **Archivos:** `apps/web/src/features/nasa/field-status.tsx`, `apps/web/src/app/globals.css`, `docs/registro-cambios.md`.
- **Qué se cambió:** el texto relativo del NDVI («5 % menos verde que lo normal para octubre») pasa a ser el titular de la tarjeta, que reparte su contenido en la altura de la imagen satelital con el dato técnico abajo.
- **Por qué:** al quitar el número absoluto, la tarjeta quedaba con un bloque gris casi vacío junto al mapa.

## 2026-11-14 — Bloque A: credibilidad de la demo

- **Archivos:** `docs/specs/spec-{003-nasa-data,005-rotation-engine,006-web-ui}.md`, `docs/contracts.md`, `apps/api/prisma/demo-profiles.json`, `apps/api/src/modules/rotation-engine/engine/{sequences,risk-groups}.ts`, `apps/api/test/{engine,contracts}.spec.ts`, `apps/geo/tests/{test_qa_e2e,test_planetary_modis}.py`, `apps/web/src/shared/api/{adapters,adapters.test,client,types}.ts`, `apps/web/src/features/nasa/{types.ts,field-status.tsx,field-charts.tsx,fixtures/observations.ts}`, `apps/web/src/features/rotation/{types.ts,recommendations.tsx,fixtures/strategies.ts}`, `docs/fixtures/{indicators,recommendations}.json`, `docs/{backend-verification,pendientes-verificacion,qa-audit-backend,qa-fixes-backend}.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** spec y contrato primero. Candidatos agrícolas en San Pedro, Fallon y San Martín, conservando correos, cultivos, riego y prioridades. Notas sobre la validez histórica de las verificaciones antiguas; grabaciones NASA y sus metadatos conservan las coordenadas originales, sin atribuir observaciones viejas a puntos nuevos. Estado usa tendencias/anomalías del API, lluvia mensual y acumulado comparable de doce meses sin extrapolar, NDVI contra su propio mes normal y dato crudo en desplegable. Los mocks pasan por el mismo adaptador y siguen marcados. Confianza baja solo por POWER incompleto/ausente o demanda del catálogo; MODIS, años faltantes, historial o respaldo del horizonte reducen a media, con avisos específicos. «Qué sabemos / Qué falta» conserva todos los warnings y el estado de fuentes. Riesgos agrupados aditivos por tipo con peor margen de calor y conteo de ciclos; `risks` se conserva.
- **Por qué:** evitar contradicciones entre Estado y el motor, lecturas absolutas engañosas del NDVI y pérdida de credibilidad por confianza siempre baja o riesgos repetidos. Se implementa únicamente Bloque A, sin rediseño del carrusel, superficie ni ahorro.
- **Verificación:** `pnpm lint` aprobado (3 tareas; última ejecución con 2 desde caché); `pnpm test` aprobado: API 104 aprobados/6 omitidos, web 31 aprobados, Geo 38 aprobados/5 omitidos. `pnpm --filter web build` y build API aprobados. PostgreSQL real en `ehecatl_demo_a_test_20261114`, creada y migrada únicamente en localhost:5432 para estas pruebas, sin seed. Regresión de contrato comprueba que `riskGroups` coincide con el motor. Chromium con mocks: Estado a 1440/390 px sin desbordamiento y sin errores locales de JavaScript. Node disponible 26.13.1 frente a 24 requerido: advertencia; pnpm 10.34.9 con PATH temporal, cachés en `/tmp`. `git diff --check` limpio.
- **RF:** spec 005 RF-7b cubierto con POWER, respaldo de catálogo, MODIS parcial/ausente, meses NDVI omitidos, años faltantes e historial; RF-6c con peor margen y 2 de 3 ciclos, baseline y contrato compatible. Spec 006 RF-4d/e/f con tendencia que prevalece sobre el mes, NDVI +58.6 %, falta de normal, doce meses completos/incompletos, dato técnico y warnings largos. Las regresiones RF-1 a RF-13 se verifican con la suite del motor. No se cambian reglas NASA ni control de acceso.
- **Git:** cambios en `feat/demo-creible` sin commit: `git add` rechazado con `Unable to create .git/index.lock: Read-only file system`; no se intentó push. No se modificaron `.env` ni `apps/web/AGENTS.md`.
- **Límites:** no se ejecutaron seed ni Docker; validación NASA en vivo, mapa agrícola, pico NDVI ≥0.4 y opciones para los nuevos perfiles pendientes del usuario (H3). La revisión de Chromium usa solo mocks visibles. No se alteró la base `ehecatl`.
- **Ajuste posterior (puntos y confianza):** las coordenadas demo pasaron a 25.55/−103.25 (Coahuila), 38.95/−119.15 (Nevada) y −33.10/−68.50 (Mendoza), elegidas con NASA en vivo por su NDVI estacional (máx. 0.52, 0.71 y 0.61; los candidatos iniciales no superaban 0.31). Además, un mes reciente de POWER aún sin publicar ya no fuerza confianza «baja»: la reduce a «media» con el aviso «POWER aún no publica los meses más recientes», porque la demanda usa la normal histórica (`sequences.ts`, `engine.spec.ts`).

## 2026-11-14 — Déficit hídrico acumulado en el eje agua

- **Archivos:** `docs/specs/spec-005-rotation-engine.md`, `docs/contracts.md`, `docs/fixtures/recommendations.json`, `apps/api/BACKEND.md`, `apps/api/src/modules/rotation-engine/engine/{evapotranspiration,sequences,viability}.ts`, `apps/api/test/{engine,contracts}.spec.ts`, `apps/web/src/features/rotation/{types.ts,recommendations.tsx,fixtures/strategies.ts}`, `apps/web/src/shared/api/{adapters,adapters.test}.ts`, `docs/registro-cambios.md`.
- **Qué se cambió:** spec y contrato primero. El beam acumula déficit real por paso y recalcula agua respecto a ETo de todo el horizonte desde la decisión, incluidos descansos; baseline comparte la regla. Sin ETo válida usa suma de demandas con aviso y confianza baja. Lluvia desconocida cuenta demanda completa. Se publica irrigationNeedMm entero y coveragePct a un decimal sin redondear los cálculos internos. Un solo resumen de agua faltante sustituye los déficits repetidos; los demás riesgos siguen deduplicados. Tarjeta con agua faltante y fallback, aportes enteros, adaptador y mocks actualizados. Fixture de contrato regenerado desde sus insumos sintéticos.
- **Por qué:** el promedio de cobertura con riego premiaba a perennes de mucha demanda casi como a ciclos cortos, ocultando el volumen de agua faltante. La regresión con los datos suministrados de Coahuila comprueba que alfalfa obtiene menor agua que caupí→sorgo→caupí. Fórmulas y constantes siguen siendo heurísticas pendientes de H4.
- **Verificación:** `pnpm lint` aprobado (3 tareas, geo desde caché); `pnpm test` aprobado: API 99 aprobados y 6 omitidos, web 25 aprobados, geo 38 aprobados y 5 omitidos. `pnpm --filter web build` y build API aprobados. PostgreSQL real en base separada `ehecatl_water_test_20261114` en localhost:5432, migración aplicada únicamente ahí; no se tocó `ehecatl`. Sin Docker Compose ni dependencias nuevas.
- **RF:** RF-11 cubierto por regresión árida, suma de déficits, igualdad del eje con/sin riego, respaldo, lluvia desconocida y determinismo; RF-10 con meses parciales, descansos, bisiesto y ETo no positiva; RF-6b/RF-13 con resumen único, cobertura redondeada y campo aditivo compatible en adaptador. Regresiones de RF-1 a RF-9 y RF-12 pasan en la suite existente.
- **Límites:** sin NASA vivo, demo ni navegador; 11 pruebas omitidas requieren QA_API_URL/QA_GEO_URL. Node disponible 26.13.1 frente a Node 24 requerido (advertencia); pnpm 10.34.9 mediante PATH temporal y UV_CACHE_DIR en /tmp por restricciones del sandbox.
- **Git:** rama `feat/motor-eto-etc` conservada; .git es de solo lectura en el sandbox, cambios conservados en el árbol, sin push.

## 2026-11-14 — Motor ETc, puntaje contextual y presentación

- **Archivos:** `apps/api/src/modules/rotation-engine/engine/{evapotranspiration,schedule,viability,sequences,score}.ts`, `apps/api/test/{catalog,engine,schedule,contracts}.spec.ts`, `apps/api/BACKEND.md`, `apps/web/src/features/rotation/{types,ranking,recommendations,fixtures/strategies,ranking.test}.ts(x)`, `apps/web/src/shared/api/{adapters,adapters.test}.ts`, `apps/web/src/app/globals.css`, `docs/fixtures/recommendations.json`, `docs/fuentes-agronomicas.md`, `docs/pendientes-equipo.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** ETo por radiación y días del calendario compartidos con schedule, ETc con Kc ponderado; demanda contextual para viabilidad, cobertura hídrica y seguridad por márgenes medidos. Water aditivo, fallback explícito, confianza reducida sin insumos, tarjetas con demanda/lluvia, desglose ponderado y nivel. Fixture de contrato regenerado por el motor; mocks web declaran respaldo sin lluvia. Se documenta la fila de los 18 Kc y se cierra el balance en pendientes.
- **Por qué:** el puntaje anterior calificaba al cultivo sin balance de agua de su parcela y contaba textos de riesgo. Siguen pendientes H4, riego en niveles, Penman-Monteith y Kc por etapas reales.
- **Verificación final:** `pnpm lint` pasó (API/web; geo desde caché); `pnpm test` pasó: API 94 aprobados y 6 omitidos, web 24 aprobados, geo 38 aprobados y 5 omitidos. PostgreSQL real en `ehecatl_eto_test_20261114` de localhost:5432, con migración aplicada exclusivamente ahí; no se tocó la base `ehecatl`. `pnpm --filter web build` y build de API pasaron. Los omitidos requieren `QA_API_URL`/`QA_GEO_URL`. `git diff --check` limpio.
- **Entorno de verificación:** pnpm 10.34.9 local vía PATH temporal y `UV_CACHE_DIR=/tmp/ehecatl-uv-cache` para resolver locks de solo lectura; ejecución con Node 26.13.1, advertencia porque el proyecto pide Node 24. Sin dependencias nuevas. No se ejecutó Docker Compose ni navegador.
- **Cobertura de RF:** catálogo RF-1b/RF-5 en catalog.spec; motor RF-1 a RF-9 preservados por engine/contracts/qa-e2e y access/database; RF-10 cálculo, meses parciales, bisiesto y respaldo completo en schedule.spec; RF-11 viabilidad ETc y agua con/sin riego en schedule/engine; RF-12 márgenes, topes, tendencias y familia en engine; RF-13 contrato aditivo, conservación de pasos/descansos, adaptador, contribuciones y niveles en contracts/adapters/ranking. La demo viva y aprobación agronómica H4 siguen pendientes.
- **Puntajes:** fixture sintético regenerado: alfalfa>canola 87.59 y alfalfa>sunflower 86.96; baseline inviable (null). No son puntajes de Coahuila real; no se recalculó ese ranking con NASA vivo. Referencia térmica real suministrada: ETo junio 5.63484924 mm/día.
- **Git:** rama `feat/motor-eto-etc` conservada; commits bloqueados porque `.git` es de solo lectura en el sandbox. Sin push.


## 2026-11-14 — Catálogo Kc trazable

- **Archivos:** crop-knowledge/data/crops.json y crop-catalog.ts.
- **Qué se cambió:** 18 ternas Kc FAO-56 Tabla 12, fila y extremos elegidos; mostaza/canola y sarraceno/cereales marcados como analogías. Validador exige Kc 0.1–1.4 y fuente.
- **Por qué:** calcular demanda ETc sin coeficientes inventados.

## 2026-11-14 — Balance hídrico y puntaje contextual: especificación

- **Archivos:** specs 004/005, contratos, fixture recommendations y fuentes agronómicas.
- **Qué se cambió:** contrato water aditivo, Kc obligatorio y fórmulas de agua, riesgo y nivel.
- **Por qué:** evaluar el cultivo en su parcela; heurísticas sujetas a H4.

## 2026-11-14 — Descansos agrupados en «Meses sin siembra»

- **Archivos:** `apps/web/src/features/rotation/{rests.ts,rests.test.ts,recommendations.tsx}`, `apps/web/package.json` (el script de test incluye la prueba nueva), `apps/web/src/app/globals.css`, `docs/registro-cambios.md`.
- **Qué se cambió:** la sugerencia para el suelo se dice una sola vez («Mientras tanto: …») cuando todos los descansos coinciden, y el motivo «ningún cultivo completa su ciclo en este tramo» se muestra como «el periodo es demasiado corto para completar un ciclo». El contrato y el motor no cambian.
- **Por qué:** en Nevada la lista repetía seis veces la misma sugerencia y el motivo no explicaba el descanso inicial.

## 2026-11-14 — Explicación por pasos y descansos explícitos

- **Archivos:** `docs/specs/spec-005-rotation-engine.md`, `docs/contracts.md`, `docs/fixtures/recommendations.json`, `apps/api/src/modules/rotation-engine/engine/{sequences,transitions}.ts`, `apps/api/test/{engine,contracts}.spec.ts`, `apps/web/src/shared/api/{adapters.ts,adapters.test.ts}`, `apps/web/src/features/rotation/{types.ts,recommendations.tsx,ranking.test.ts,fixtures/strategies.ts}`, `apps/web/src/app/globals.css`, `docs/pendientes-equipo.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** ampliación aditiva con razones y efectos por ciclo, clima redondeado y descansos con motivo; presentación en una sola fila y prioridades sin repetición.
- **Por qué:** explicar las decisiones y los meses sin siembra sin inventar datos ni cambiar la puntuación agronómica.
- **Contrato y compatibilidad:** se conservan `explanation` y `risks`; el fixture se regeneró desde sus propios insumos sintéticos. Los descansos usan todas las ventanas originales y también se publican en la referencia inviable. La web conserva el fallback plano; el mock muestra sus descansos como ejemplo y el clima desconocido como «sin dato».
- **Verificación:** `pnpm lint`: 3 tareas satisfactorias; `pnpm test`: API 80 aprobadas y 6 omitidas, web 20 aprobadas, Geo 38 aprobadas y 5 omitidas; `pnpm --filter web build`: compilación, TypeScript y 6 páginas generadas correctamente. Las 11 omitidas requieren servicios vivos; no se desactivaron tests. `git diff --check` sin errores.
- **RF de spec 005:** RF-1b cubierto con huecos al inicio/intermedios/finales, sin huecos, sin ventanas y cambio de temporada; RF-6/RF-6b con efectos favor/contra/neutral, temperatura redondeada, clima nulo, pesos únicos y aviso de riego repetido deduplicado. Las regresiones existentes cubren RF-1/RF-1c (referencia viable/inviable), RF-2/RF-3 (transición/viabilidad), RF-4 (riesgo), RF-5/RF-9 (prioridades) y RF-7/RF-8 (confianza y datos faltantes).
- **Entorno y límites:** pruebas PostgreSQL en la base separada `ehecatl_explanation_test_20261114`, con migraciones aplicadas únicamente allí; se conserva para repetir la verificación y no se tocó la base `ehecatl`. El sandbox impidió el pnpm predeterminado y la caché UV; se usaron un wrapper temporal al pnpm 10.33.4 ya instalado y `UV_CACHE_DIR` en `/tmp`, sin modificar dependencias ni configuración del proyecto. Node disponible 26.13.1, frente al 24 solicitado por el repo: advertencia de versión durante los comandos. No se ejecutó Compose ni navegador/capturas, por instrucción del usuario. No hay commits: `.git` es de solo lectura (`index.lock`); cambios conservados en el árbol de `feat/explicacion-y-descanso`, sin push.


## 2026-11-14 — Botón para ver la contraseña en el login

- **Archivos:** `apps/web/src/features/identity/login-screen.tsx`, `apps/web/src/app/globals.css`, `docs/registro-cambios.md`.
- **Qué se cambió:** el campo de contraseña tiene un botón con icono de ojo que alterna entre ocultar y mostrar el texto (`aria-pressed` y etiqueta accesible).
- **Por qué:** petición del usuario; permite comprobar lo que se escribe, sobre todo con contraseñas largas como la de la demo.

## 2026-11-14 — Arranque autónomo de Compose y comparación con el cultivo actual

- **Archivos:** `.gitattributes`, `.env.example`, `docker-compose.yml`, `README.md`, `apps/api/{Dockerfile,package.json,.env.example,README.md,BACKEND.md}`, `apps/api/scripts/docker-entrypoint.sh`, `apps/api/prisma/seed.ts`, `apps/api/src/modules/rotation-engine/engine/sequences.ts`, `apps/api/test/{engine.spec.ts,contracts.spec.ts}`, `apps/web/src/shared/api/{adapters.ts,adapters.test.ts}`, `apps/web/src/features/rotation/{types.ts,recommendations.tsx}`, `docs/specs/{spec-001-identity.md,spec-005-rotation-engine.md,spec-006-web-ui.md}`, `docs/{contracts.md,fixtures/recommendations.json,pendientes-equipo.md,backend-verification.md,registro-cambios.md}`.
- **Qué se cambió:** la imagen compila/empaqueta el seed; Compose espera PostgreSQL/Geo, exige secretos locales y ejecuta migraciones y precarga NASA antes de escuchar HTTP. Se documenta el restablecimiento de perfiles demo al reiniciar. El seed rechaza perfiles sin opciones viables con las causas reales. Se restituye RF-1c antes de modificar el motor: referencia evaluada por las mismas reglas y pesos, dos alternativas con diferencias, puntaje nulo cuando mantener lo actual es inviable, y adaptación de la interfaz/fixture. Se mantienen los componentes originales para reponderar en el front y solo se redondean al mostrarlos.
- **Por qué:** resolver I5 y las discrepancias del traspaso sin inventar cobertura NASA ni relajar reglas por región. Los secretos se generaron únicamente en el `.env` local ignorado por Git; no se registran sus valores. La spec 007 sigue en borrador y como siguiente fase por decisión explícita del usuario; no se amplía a sensores, ETo/ETc, entrevista ni dron.
- **Corrección descubierta en Compose limpio:** se añadió `libexpat1` a `apps/geo/Dockerfile` y una comprobación de importación de `rasterio` durante el build, tras reproducir un 502 causado por `ImportError: libexpat.so.1`. Dependencia autorizada explícitamente por el usuario conforme a `AGENTS.md`; documentada primero en `docs/specs/spec-003-nasa-data.md` y también en `apps/geo/README.md`. No se añadieron dependencias Python/npm.
- **Integración del front y tareas:** `apps/web/Dockerfile`, `docker-compose.yml`, `.env.example`, spec 006 y README exponen `NEXT_PUBLIC_USE_MOCKS` en build y usan la API real por defecto en Compose; antes el valor omitido activaba el modo de ejemplo y no ejercitaba el login sembrado. `tasks/todo.md` se alinea con RF-1c y su caso de referencia inviable.
- **Cierre técnico y evidencias:** `docs/pendientes-verificacion.md` contiene la matriz RF y el ensayo técnico de I5; `docs/verification/pendientes-live.json` conserva fuentes, cobertura, puntajes y diagnóstico con/sin riego sin secretos. I5, B14 y B17 se marcan hechos en `tasks/todo.md`; B18 mantiene H3 pendiente. Compose desde volumen vacío y reinicio idempotente dejan 4 usuarios, 3 parcelas y 3 zonas. Las seis E2E API pasan, incluidos login de los cuatro usuarios, permisos y un punto nuevo en Nairobi. MODIS real: 10/12 meses Coahuila (mayo/junio faltantes), 12/12 Nevada y Mendoza; no se rellenan huecos. `pnpm test` con PostgreSQL real: 74 API, 38 Geo y 17 web pasan; las pruebas QA en vivo se invocan directamente por paquete porque Turbo filtra sus variables de entorno.
- **Resultado final:** las cinco pruebas Geo en vivo también pasan (Coahuila, Nevada, Mendoza, Veracruz y océano), para 140 pruebas distintas cubiertas: 129 en la suite con PostgreSQL y 11 E2E adicionales. `pnpm lint`, builds de las tres imágenes, `docker compose config -q` y `git diff --check` pasan. H2/H3/H4 y sensores siguen pendientes; no se hizo commit ni push.
- **Limpieza:** se retiraron únicamente los contenedores, red y volumen de `ehecatl-pendientes-qa` y la configuración temporal con secretos. El PostgreSQL existente en 55433 se conserva activo; el `.env` local ignorado permite arrancar el Compose normal.
- **Verificación:** `pnpm lint` en verde; `pnpm test`: 70 API, 38 Geo y 17 web pasan (15 pruebas que requieren servicios vivos se omiten sin sus variables); cuatro pruebas adicionales de integración con PostgreSQL real en verde. Build de API/seed/web en Docker y pruebas de referencia viable/inviable, ausencia de ventanas, prioridades y determinismo. La validación completa de Compose, NASA real y requisitos se registra junto al cierre del seguimiento.

## 2026-11-14 — Pulido del front: aviso de riesgo sin texto repetido

- **Archivos:** `apps/web/src/features/rotation/recommendations.tsx`, `docs/registro-cambios.md`.
- **Qué se cambió:** se quitó el sufijo «Datos de ejemplo.» que se repetía dentro de cada motivo del aviso de riesgo en modo mock.
- **Por qué:** la pantalla ya muestra el chip «Datos de ejemplo»; repetirlo en el texto era ruido. La marca de demo se conserva una sola vez por pantalla (AGENTS.md).

## 2026-11-14 — Documentación obligatoria de modificaciones

- **Archivos:** `AGENTS.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** se añadió la regla de registrar cada modificación y se creó este registro compartido.
- **Por qué:** mantener un historial que explique qué se hizo y el motivo de cada cambio, según lo solicitado por el usuario.

## 2026-11-14 — Registro retroactivo de los cambios previos a la regla

Estas entradas cubren trabajo mergeado antes de que existiera la obligación de registrar.

### Front conectado al API real (PR #13)
- **Archivos:** `apps/web/src/shared/api/{adapters.ts,adapters.test.ts,client.ts,types.ts,use-async.ts,messages.ts}`, `apps/web/src/features/{rotation,nasa,parcels,identity}/*`, `apps/web/src/shared/components/{app-shell.tsx,ui.tsx}`, `apps/web/README.md`.
- **Qué se cambió:** el front consume `POST /auth/login`, `/crops`, `/parcels`, `/zones/:id/indicators`, `/zones/:id/recommendations` y `/me/priorities` mediante adaptadores puros; el modo mock sigue disponible con `NEXT_PUBLIC_USE_MOCKS`. Los datos faltantes (NDVI nulo, sin baseline, `no_viable_options`) se muestran sin inventar valores y el chip «Datos de ejemplo» solo aparece en modo mock.
- **Por qué:** pasar de la interfaz con fixtures a la demo contra el backend real, sin modificar `apps/api` ni `apps/geo`.

### Documentación de arquitectura y fuentes NASA (PR #11)
- **Archivos:** `docs/arquitectura-y-fuentes.md`, `docs/fuentes-nasa-clasificacion.md`.
- **Qué se cambió:** se documentan herramientas, arquitectura, APIs propias y datos NASA usados (POWER, MODIS) y la clasificación de recursos del reto.
- **Por qué:** tener una referencia única para el pitch y para el equipo.

### Spec 007 de sensores a pie de parcela (PR #15)
- **Archivos:** `docs/specs/spec-007-field-sensors.md`.
- **Qué se cambió:** se agregó la spec en borrador (RF-1 a RF-19): dispositivos con API key, lecturas, comparación con satélite, frescura, avisos sin accionar riego.
- **Por qué:** una experta visitó el proyecto y se concluyó que los datos satelitales no bastan como verdad de campo en una beta; los sensores a pie de parcela construyen confianza. Pendiente de aprobación.

### Traspaso de pendientes al equipo
- **Archivos:** `docs/pendientes-equipo.md`, `tasks/todo.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** se documentan I5, la aprobación de la spec 007, las discrepancias de backend y las ideas siguientes; `tasks/todo.md` enlaza el documento.
- **Por qué:** dejar al compañero el contexto y los pasos de lo que Mau no cubrió, sin tocar el backend.
