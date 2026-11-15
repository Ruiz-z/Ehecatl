# Pendientes para el equipo

## Seguimiento — 2026-11-15: preparación de integración autorizada

El usuario autorizó implementar la preparación sin hardware, desde el respaldo `c51dd4c`. Zonas, prioridades, dispositivos, lecturas, pantalla y simulador se documentan en [preparacion-sensores.md](preparacion-sensores.md). El estado de la spec 007 cambia solo para esta entrega; comparación, confianza, avisos agronómicos y actuación no se dan por implementados. Las decisiones del 14 de noviembre conservadas abajo son históricas y quedan sustituidas en este alcance por la autorización nueva.

Siguen pendientes montaje del ESP32, profundidad y calibración del FC28, datos temporales comparables, H3/H4 y ensayo físico. Sin bomba ni servos desde la aplicación.

Traspaso a 2026-11-14. Lo que Mau (front/infra) dejó planeado y **no** hizo, con contexto para retomarlo. El backend también entra en el alcance autorizado para el balance ETo/ETc.

## Seguimiento — 2026-11-14

- **I5 implementado:** la imagen incluye el seed compilado; el entrypoint aplica migraciones, precarga NASA con `GEO_URL=http://geo:8000` y después inicia la API. Compose espera a PostgreSQL y Geo saludables y exige secretos en `.env`. La verificación se realiza con un volumen de prueba exclusivo, sin borrar bases existentes.
- **Empaquetado detectado durante la prueba:** Geo requería `libexpat1` para importar `rasterio`; se añadió con autorización explícita del usuario y se valida en el build. El front de Compose se construye con la API real por defecto (`NEXT_PUBLIC_USE_MOCKS=false`), para que el login use efectivamente los usuarios sembrados.
- **«Mantener lo actual» restituido:** spec 005 RF-1c, contrato, motor, fixture y adaptador web alineados. Se evalúa fuera del recorte del ranking y con las mismas reglas/pesos; si es inviable, se explican las causas con puntaje/diferencias nulos. Hasta dos alternativas más la referencia viable.
- **Seed:** `GEO_URL` documentado en ambos entornos y fijado en Compose. Si un perfil no produce ninguna opción viable, el seed falla con las causas para revisar las condiciones declaradas; no altera datos NASA ni reglas por ubicación.
- **Sensores:** decisión explícita del usuario: mantenerlos como **siguiente fase**. La spec 007 conserva su estado de borrador; no se propaga a la constitución ni a las specs 003/005/006 y no se implementan dispositivos, lecturas ni avisos. Las preguntas de hardware y H4 siguen abiertas.
- **Balance ETo/ETc implementado:** specs 004/005 y contrato actualizados, Kc FAO-56, demanda por radiación mensual, agua y riesgo por parcela, desglose y niveles. Siguen pendientes riego por niveles, Penman-Monteith, Kc por etapa real y validación H4.
- **Ideas sin spec:** entrevista inicial permanece en el backlog; visión artificial/dron continúa fuera de alcance. No se amplía el producto sin una spec.

Las secciones siguientes conservan el contexto del traspaso original.

Verificación y cobertura RF: [`pendientes-verificacion.md`](pendientes-verificacion.md).
Evidencia NASA sin secretos: [`verification/pendientes-live.json`](verification/pendientes-live.json).
I5, B14 y B17 quedan cerrados técnicamente; B18 conserva pendiente la aprobación H3.
Las parcelas nuevas de Coahuila y Mendoza sin riego reproducen `no_viable_options`;
con riego declarado devuelven opciones. MODIS: 10/12 meses en Coahuila (faltan mayo/junio),
12/12 en Nevada y Mendoza. No se modifican reglas ni datos para ocultar faltantes.

## 1. I5: Compose desde cero (infra, toca `apps/api/Dockerfile`)
- **Problema:** `docker compose up --build` en una máquina limpia deja la base vacía (sin migraciones) y sin usuarios demo.
- **Pasos:**
  1. Ejecutar `prisma migrate deploy` al arrancar `api` (entrypoint o servicio `migrate` que corra antes).
  2. Ejecutar el seed (B18) con `GEO_URL=http://geo:8000`; sin esa variable falla con 502 al precargar indicadores NASA.
  3. Definir `SEED_DEMO_PASSWORD` y `JWT_SECRET` en `.env` (no versionado).
- **Archivos:** `docker-compose.yml`, `apps/api/Dockerfile`, script de entrypoint.
- **Listo cuando:** `docker compose down -v && docker compose up --build` y luego login con un usuario demo funciona sin pasos manuales. Ver `tasks/todo.md` I5.
- **Quién:** compañero (toca la imagen del backend) o acordar que lo haga Mau solo en `docker-compose.yml`.

## 2. Spec 007 de sensores: aprobación y propagación
- **Estado:** borrador en `docs/specs/spec-007-field-sensors.md`, sin aprobar.
- **Tras aprobarla, actualizar:** constitución #12 y su lista de fuera de alcance (IoT deja de ser stretch); specs 003 (frescura por fuente), 005 (confianza por concordancia) y 006 (panel de sensor, avisos); `tasks/todo.md` (nuevas tareas y I-S1 fuera de stretch).
- **Dudas abiertas a resolver:** qué mide el nodo y a qué profundidad; cuántos nodos; conectividad; quién da de alta dispositivos; umbrales (H4); reutilizar firmware de SmartRiego.
- **Recorte sugerido para la demo:** una pantalla con lecturas de ejemplo **marcadas como tales** junto al dato satelital, presentada como «siguiente fase». Nada de actuación sobre riego.

## 3. Discrepancias de backend detectadas
- **Estrategia «mantener lo actual»:** se quitó de la spec 005 (el criterio de finalización aún dice «comparadas contra mantener lo actual») pero la spec 006 RF-4 y el front la citan. El front ya tolera su ausencia (`delta` nulo). Decidir: restituirla en el motor o quitarla de la spec 006.
- **`no_viable_options`:** Coahuila y la parcela nueva de Mendoza pueden devolver este estado; revisar reglas y datos demo (H3).
- **Seed (B18):** requiere `GEO_URL`; documentar o dar valor por defecto.
- **MODIS:** huecos de NDVI; el fallback a Microsoft Planetary Computer entró con PR #12. Verificar cobertura en los puntos demo.

## 4. Ideas siguientes (sin spec)
- **ETo/ETc:** balance implementado en specs 004/005; no depende de sensores de spec 007. Pendientes Penman-Monteith, Kc por etapa real y validación H4.
- **Diagnóstico del dueño:** paso de entrevista inicial que surgió de las notas de la visita de la experta.
- **Visión artificial/dron:** fuera de alcance de la beta.

## Reglas recordatorio
Registrar cada cambio en `docs/registro-cambios.md`; commits sin `Co-Authored-By`; ramas desde `origin/dev`; nada de push sin autorización.

## Replanteo del motor (siguiente fase)

- **Hecho:** balance lluvia/ETc y fallback de catálogo explícito; no se inventan reserva de suelo ni aportes de riego.
- Riego en niveles de disponibilidad efectiva, en lugar de una condición binaria.
- Alternativas que difieran en el primer cultivo y ayuden a decidir el siguiente paso.
- Confianza que no sea siempre baja: revisar cobertura, procedencia e incertidumbre de los insumos.
- **Hecho:** niveles alto/medio/bajo y desglose ponderado agua + suelo + ingreso + riesgo.

Lo implementado requiere validación agronómica H4; las demás propuestas requieren especificación antes de implementarse.
