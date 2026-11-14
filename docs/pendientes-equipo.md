# Pendientes para el equipo

Traspaso a 2026-11-14. Lo que Mau (front/infra) dejó planeado y **no** hizo, con contexto para retomarlo. El backend (`apps/api`, `apps/geo`) lo lleva el compañero; Mau no lo modifica.

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
- **ETo/ETc (FAO-56, Boletín 56):** ETc = Kc × ETo, 1 mm = 1 L/m²; el lisímetro es la medida de campo. Va en una spec aparte (fuera de la 007).
- **Diagnóstico del dueño:** paso de entrevista inicial que surgió de las notas de la visita de la experta.
- **Visión artificial/dron:** fuera de alcance de la beta.

## Reglas recordatorio
Registrar cada cambio en `docs/registro-cambios.md`; commits sin `Co-Authored-By`; ramas desde `origin/dev`; nada de push sin autorización.
