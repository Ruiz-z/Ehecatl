# Registro de cambios

## 2026-11-15 — Integración con la rama remota antes del push de sensores

- **Archivos:** `apps/api/src/modules/crop-knowledge/data/crops.json`, `apps/api/test/catalog.spec.ts`, `apps/web/src/{app/globals.css,features/nasa/field-charts.tsx,features/nasa/field-status.tsx,features/rotation/recommendations.tsx,features/rotation/types.ts,shared/api/adapters.ts,shared/api/adapters.test.ts,shared/api/client.ts,shared/api/types.ts}`, `docs/fixtures/recommendations.json`, `docs/pendientes-equipo.md` y este registro.
- **Qué se cambió y por qué:** antes del push autorizado, se integra la preparación de sensores sobre `origin/fix/pendientes-equipo` (`93251b5`). Se conservan los coeficientes Kc, el balance ETo/ETc, los riesgos agrupados, los descansos y el calendario anual incorporados remotamente, junto con zonas, sensores, recálculo de prioridades y metadatos de fuentes. La fecha NDVI conserva su presentación en español y añade `observedAt` para la fecha original. El fixture de recomendaciones se recalcula con sus mismos insumos y el catálogo combinado, porque cambiaron los candidatos seleccionados; no se relajan las comprobaciones del contrato.
- **Verificación posterior a la integración:** `pnpm lint` correcto; `pnpm test` con PostgreSQL aislado: 133 API + 4 simulador + 38 Geo + 54 web = **229 pruebas correctas**, con 11 pruebas en vivo omitidas. Migraciones desde cero y compilaciones de API y web correctas. El ensayo en Chrome pasa sus 11 comprobaciones de login, claves, simulador, calibración, zonas, prioridades, permisos y tablet, sin excepciones JavaScript. NASA se sustituye por fixtures marcados solo en la base de QA. Se elimina únicamente esa base temporal; no se despliega ni se migra la base de la aplicación.

## 2026-11-15 — Preparación de software para integrar sensores sin hardware

- **Autorización y alcance:** solicitud expresa del usuario tras subir el punto de retorno `c51dd4c`. Spec 007 habilita esta entrega: dispositivos, lecturas, frescura, pantalla y simulador. Comparación, confianza y avisos agronómicos quedan para periodos equivalentes y validación H4; sin comandos, riego ni servos. No se incorporan credenciales ni firmware de SmartRiego.
- **Archivos de alcance y documentación:** `docs/constitution.md`, `docs/specs/spec-003-nasa-data.md`, `spec-004-crop-knowledge.md`, `spec-005-rotation-engine.md`, `spec-006-web-ui.md`, `spec-007-field-sensors.md`, `docs/contracts.md`, `docs/preparacion-sensores.md`, `docs/pendientes-equipo.md`, `docs/reporte-revision-esp32.md`, `tasks/todo.md`, `README.md`, `apps/api/README.md`, este registro y `docs/verification/sensors-ui.json`.
- **API y persistencia:** `apps/api/prisma/schema.prisma`, `prisma/migrations/202611150001_field_sensors/migration.sql`, `src/modules/field-sensors/{validation.ts,sensors.service.ts,sensors.controller.ts}`, `src/app.module.ts`, `src/main.ts`. Dispositivos con clave aleatoria guardada como hash; origen inmutable; emisión, rotación, revocación, reasignación y calibración versionada. Lecturas FC28/DHT11/MQ2 con fechas y crudo, índice relativo nulo sin calibrar, validación física/temporal, límite de 4 KiB y 60 solicitudes/minuto, transacción con bloqueo e idempotencia. Historial por zona y acceso dueño/admin sin hashes. La recepción no espera a NASA ni manda órdenes.
- **Prioridades y catálogo:** `apps/api/src/modules/rotation-engine/{rotation.controller.ts,rotation.service.ts}`, `src/modules/crop-knowledge/{crop-catalog.ts,data/crops.json}`. Previsualización con pesos temporales normalizados, sin guardar; categorías económicas explícitamente estimadas convertidas a 25/60/90 puntos, con validación de coherencia y H4 pendiente. No se cambian reglas NASA por región.
- **Web:** `apps/web/src/features/parcels/{types.ts,zones.ts,zone-picker.tsx,parcel-tabs.ts,parcel-detail.tsx}`, `features/sensors/{api.ts,sensors.tsx}`, `features/rotation/{types.ts,recommendations.tsx}`, `features/nasa/{types.ts,field-status.tsx,field-charts.tsx}`, `shared/api/{types.ts,adapters.ts,client.ts,use-async.ts}`, `src/app/globals.css`. Selector y creación de zonas, selección conservada en URL, panel de sensores con administración y clave efímera, tabla/gráfica por dispositivo y origen visible. Prioridades vuelven a consultar el motor tras 350 ms; se descartan resultados obsoletos, conservando puntajes/explicaciones del servidor. Se muestran metadatos NASA y se corrige el mensaje sin cultivos viables.
- **Herramientas y operación:** `apps/api/scripts/{simulate-device.mjs,simulate-device.test.mjs,prune-readings.mjs}`, `apps/api/package.json`, `apps/api/Dockerfile`, `apps/api/.env.example`, `.env.example`, `docker-compose.yml`. Simulador con verificación previa de origen simulado, reintentos de la misma muestra y HTTPS fuera de localhost. Limpieza explícita de retención tras build. Sin dependencias nuevas ni cambios a archivos `.env` personales.
- **Pruebas:** `apps/api/test/{sensors.spec.ts,sensors-database.spec.ts,access.spec.ts,catalog.spec.ts}`, `apps/web/src/shared/api/adapters.test.ts`, `features/parcels/parcel-tabs.test.ts`. PostgreSQL aislado verifica roles, concurrencia sin duplicados, rechazo de datos, claves, calibración, reasignación, paginación y tasa. Las comprobaciones y builds de cierre se registran al terminar la validación.
- **Ensayo visual:** login real, registro, simulador, calibración, separación por zona, navegación, recálculo y vista de agricultor pasan en Chrome. NASA usa fixtures marcados exclusivamente en QA; no es evidencia NASA en vivo. Capturas locales revisadas en escritorio/tablet; evidencia sin secretos en `docs/verification/sensors-ui.json`.
- **Cierre de verificación:** `pnpm lint` pasa; `pnpm test` con PostgreSQL aislado: 102 API + 4 simulador + 38 Geo + 20 web = **164 pruebas correctas**, con 11 pruebas NASA/API en vivo omitidas. Migraciones aplicadas desde cero únicamente en la base de QA. Builds locales de API, seed y web correctos; `docker compose build api web`, `docker compose config -q` y `git diff --check` pasan. Se verifican también los archivos nuevos y ausencia de credenciales de los programas recibidos. Las imágenes quedaron construidas, sin desplegar el stack ni migrar la base de la aplicación. No se modificaron `.env` personales, dependencias o lockfile.

## 2026-11-15 — Revisión de la segunda versión del firmware y confirmación de FC28

- **Archivos:** `docs/revision-firmware-esp32.md`, `docs/reporte-revision-esp32.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** se añade una sección vigente para el programa de un punto y se identifica la revisión anterior como histórica. Se documenta que la bomba ahora consulta la decisión del servidor, pero el permiso empieza en verdadero y no caduca; siguen pendientes contrato de lecturas, calibración, duración registrada y esperas. Se incorpora la confirmación del usuario de FC28 de dos puntas, pese a los comentarios de «capacitivo» del nuevo archivo.
- **Por qué:** mantener el diagnóstico actualizado sin mezclar hallazgos de versiones distintas ni incorporar código con credenciales. No se cambia el alcance de actuación ni se implementa firmware o API de sensores.
- **Verificación:** `pnpm lint` pasa con caché de Turbo; `pnpm test` se ejecuta de nuevo: 70 API, 38 Geo y 17 web correctas, con 15 omitidas por conexiones no configuradas. Revisión estática del segundo archivo; sin compilación ni prueba física del ESP32 y sin usar credenciales o destino SmartRiego.

## 2026-11-15 — Revisión del firmware recibido, excluyendo servos

- **Archivos:** `docs/revision-firmware-esp32.md`, `docs/reporte-revision-esp32.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** se documenta la revisión estática del programa proporcionado: contrato de lecturas incompatible, datos leídos que no se envían, calibración, validación DHT, reintentos, funcionamiento automático de la bomba, duración registrada incorrecta, esperas que retrasan el botón y ausencia de cálculo de caudal. Se precisan pines, etiquetas, protección de alimentación y configuración de credenciales, sin reproducir secretos ni incorporar el archivo original.
- **Por qué:** aterrizar la preparación de ESP32 usando el firmware real como referencia y respetar la instrucción de excluir servos. No se implementan dispositivos ni se modifica el alcance de actuación del producto.
- **Verificación:** `pnpm lint` pasa usando la caché de Turbo; `pnpm test` se ejecuta de nuevo y pasan 70 API, 38 Geo y 17 web, con 15 pruebas omitidas por falta de conexiones configuradas. No se compila ni se prueba el firmware en placa; no se consultan los servicios ni se usan las credenciales del archivo recibido.

## 2026-11-15 — Revisión de conformidad y preparación para ESP32

- **Archivos:** `docs/reporte-revision-esp32.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** se agrega un reporte en lenguaje sencillo del estado del front y la lógica frente a las specs, con diferencias en recálculo de prioridades, selección de zonas, trazabilidad de ingreso, metadatos NASA y mensajes sin opciones viables. Se documenta el trabajo pendiente para dispositivos ESP32, recepción de lecturas, calibración, comparación temporal y avisos. Se incorpora el hardware indicado por el usuario (DHT11, interpretando «DTH11», MQ2, FC28 y microbomba), sus límites y la diferencia entre mover agua y medir caudal; el control de la bomba requiere cambiar el alcance que actualmente prohíbe actuación.
- **Por qué:** revisar los cambios acumulados y orientar la preparación del hardware sin implementar ni aprobar implícitamente la spec 007. El reporte distingue hallazgos actuales, propuestas y evidencia previa de NASA/Compose.
- **Verificación:** `pnpm lint` pasa en API/Geo/web; `pnpm test` pasa con 70 API, 38 Geo y 17 web (125 en total), con 15 pruebas omitidas por falta de configuración de base de prueba y servicios vivos. Reproducción del caso de prioridades con el fixture del motor. No se modifican código, configuración ni datos de la aplicación.

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
