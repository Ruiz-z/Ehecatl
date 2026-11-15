# Constitución — Ehécatl

Herramienta de decisión para **rotación y cambio de cultivos** con datos NASA (NASA Space Apps 2026, reto *Field Shift*).

1. **Stack fijo**: backend NestJS + Prisma + PostgreSQL; web Next.js + shadcn/ui; servicio Python (FastAPI) en `apps/geo` para ingesta y normalización de datos NASA. Sin frameworks nuevos sin actualizar esta constitución primero.
2. **Empaquetado**: todo corre con `docker compose up` (postgres + api + web + geo). Un comando desde cero.
3. **Arquitectura por dominio** (identity, farm-context, nasa-data, crop-knowledge, rotation-engine), nunca por capa técnica. `common/`/`shared/` solo para lo realmente transversal.
4. **Modelo de datos**: `id` uuid, `createdAt`/`updatedAt` en timestamptz, `@@map` a snake_case plural, enums para estados, `schema.prisma` agrupado por módulo.
5. **Núcleo del producto**: recomendar **por zona** **qué cultivo sigue y cuándo cambiar**, contando en **ventanas de cultivo calculadas por zona** a partir de su climatología NASA (no en calendarios de un país ni en años fijos) (transición A → B y secuencia de 2–3 ciclos), combinando tres insumos obligatorios: datos NASA, contexto local de la parcela y prioridades del agricultor.
6. **Recomendaciones explicables**: cada una muestra el porqué (variables NASA, valores, reglas y pesos que influyeron) y los riesgos del cambio. Nunca una caja negra.
7. **Cobertura global**: el usuario elige cualquier lat/lon y el sistema funciona con el núcleo global de fuentes abiertas sin login (NASA POWER y MODIS NDVI vía ORNL DAAC, con Microsoft Planetary Computer como respaldo anónimo de MODIS Terra/Aqua); SMAP/IMERG son stretch porque requieren Earthdata. Coahuila y Nevada son fixtures de demo/prueba, nunca restricciones. Los datasets solo de EE. UU. (SSURGO, CDL, NASS…) son un adaptador opcional.
8. **Datos NASA reales** con caché en base de datos. Los mocks solo en tests automatizados y, si se usan en la demo, deben marcarse visiblemente.
9. **Multiusuario**: varios agricultores con parcelas propias y perfiles distintos; roles fijos Agricultor y Administrador (superset). Auth con JWT (email + password, bcrypt). Un agricultor nunca accede a parcelas ajenas.
10. **Prioridades del agricultor como pesos** (agua, salud del suelo, ingreso, riesgo) que cambian el ranking; mismas condiciones con distintas prioridades dan recomendaciones distintas.
11. **Conocimiento de cultivos trazable**: el catálogo cita su fuente (FAO/GAEZ u otra) y se versiona en el repo.
12. **IoT/ESP32**: preparación de software autorizada el 2026-11-15 (spec 007): API key individual, lecturas FC28/DHT11, MQ2 experimental y simulación marcada. Firmware adaptado al contrato de Ehécatl para la misma red local, sin credenciales en Git. Comparación y confianza posteriores. Se permite solo riego manual solicitado por dueño o administrador, con límites duros en firmware y validación en API. El riego automático sigue prohibido.
13. **Secretos**: ninguna credencial se commitea; todo vía `.env` (no versionado) y secretos de CI.
14. **Tests obligatorios** en: motor de transición/rotación, normalización de datos NASA, y control de acceso por dueño.
15. **Idioma**: código e identificadores en inglés; documentación, specs y commits en español.
16. **Antes de tocar código**: leer esta constitución y la spec activa. Los cambios de alcance actualizan primero la spec.

## Fuera de alcance v1
App móvil, visión artificial/plagas, dron, despliegue en VM/CI complejo, adaptador EE. UU. (stretch), riego automático, programación por horario, medición de caudal y control de varias bombas.

## Listo para demo cuando
- [ ] `docker compose up` levanta todo desde cero.
- [ ] Al menos 3 usuarios demo con ubicaciones y prioridades distintas inician sesión.
- [ ] Cada uno ve datos NASA reales de su punto y recibe recomendaciones de transición distintas y explicadas.
- [ ] Un punto nuevo, elegido en vivo, funciona sin cambios de código.
