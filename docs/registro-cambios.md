# Registro de cambios

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
