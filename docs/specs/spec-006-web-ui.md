# Spec 006 — Web UI (selector de punto, dashboard y recomendaciones)

## Contexto y objetivo
Que el agricultor entienda en segundos qué dicen los datos NASA de su campo y qué hacer. La usabilidad pesa tanto como los datos (reto: "herramientas intuitivas", "recomendaciones claras y prácticas").

## Usuarios / actores
Agricultor, Administrador.

## Historias de usuario
- H1: Como agricultor quiero elegir mi punto en un mapa o por coordenadas.
- H2: Como agricultor quiero ver gráficas simples de lluvia, temperatura, humedad de suelo y vegetación.
- H3: Como agricultor quiero tarjetas de recomendación con "por qué" y riesgos, en lenguaje llano.
- H4: Como agricultor quiero ajustar mis prioridades y ver cómo cambia el resultado.
- H5: Como jurado quiero ver rápido que se usan datos NASA, contexto local y prioridades.

## Requisitos funcionales (EARS)
- RF-1: CUANDO el usuario inicia sesión, EL SISTEMA muestra sus parcelas.
- RF-2: CUANDO el usuario crea una parcela, EL SISTEMA permite elegir el punto en un mapa o escribir lat/lon.
- RF-3: CUANDO se abre una parcela, EL SISTEMA muestra los indicadores NASA con su fuente, fecha y origen (`live`/`cache`/`mock`).
- RF-4: CUANDO se abre una parcela, EL SISTEMA muestra 2–3 tarjetas de secuencia recomendada con puntaje, explicación y riesgos.
- RF-5: CUANDO el usuario cambia sus prioridades, EL SISTEMA recalcula y actualiza el ranking.
- RF-6: MIENTRAS se cargan datos, EL SISTEMA muestra estados de carga; SI una fuente falla, ENTONCES muestra el resto y avisa de lo faltante.
- RF-7: EL SISTEMA muestra siempre los tres insumos (NASA, contexto local, prioridades) usados en cada recomendación.

## Requisitos no funcionales
- Responsive de escritorio a tablet; accesibilidad básica (contraste, teclado); textos en español.

## Casos límite
- Parcela sin datos NASA aún → estado vacío con acción para cargar.
- Muchas parcelas → lista paginada o con búsqueda.

## Fuera de alcance
App móvil, modo offline, reportes PDF, notificaciones.

## Criterios de finalización
RF-1 a RF-7 + demo manual del flujo: login → crear/abrir parcela → ver datos NASA → ver recomendaciones → cambiar prioridades.

## Decisiones
- Mapa con Leaflet + OpenStreetMap (sin API key).
- Las tarjetas de recomendación se muestran por zona.

## Dudas abiertas
- Identidad visual sin definir: se resuelve en la etapa de diseño del SDD, antes de las tareas de UI.
