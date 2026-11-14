# Registro de cambios

## 2026-11-14 — Pulido del front: aviso de riesgo sin texto repetido

- **Archivos:** `apps/web/src/features/rotation/recommendations.tsx`, `docs/registro-cambios.md`.
- **Qué se cambió:** se quitó el sufijo «Datos de ejemplo.» que se repetía dentro de cada motivo del aviso de riesgo en modo mock.
- **Por qué:** la pantalla ya muestra el chip «Datos de ejemplo»; repetirlo en el texto era ruido. La marca de demo se conserva una sola vez por pantalla (AGENTS.md).

## 2026-11-14 — Documentación obligatoria de modificaciones

- **Archivos:** `AGENTS.md`, `docs/registro-cambios.md`.
- **Qué se cambió:** se añadió la regla de registrar cada modificación y se creó este registro compartido.
- **Por qué:** mantener un historial que explique qué se hizo y el motivo de cada cambio, según lo solicitado por el usuario.
