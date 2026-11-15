# Registro de cambios

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
