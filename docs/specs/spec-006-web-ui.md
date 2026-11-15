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
- RF-4: CUANDO se abre una parcela, EL SISTEMA muestra hasta 3 tarjetas lado a lado: la **estrategia actual** («mantener lo actual», spec 005 RF-1c) y las 2 mejores alternativas disponibles, cada una con puntaje, diferencia contra la actual, explicación y riesgos. SI la estrategia actual no es viable, ENTONCES muestra un aviso con las causas y las alternativas sin diferencia de puntaje; no inventa una tarjeta puntuable.
- RF-4b: EL SISTEMA muestra cada indicador en lenguaje llano con consejo cuando corresponde, usando los textos aprobados en `features/nasa/copy.ts`. Incluye resumen de sequía/calor, aviso del mes pendiente, ayudas con teclado y barras de tres zonas con texto accesible. Conserva tonos desde tendencias del API; humedad (30 % y 50 %) y verdor (±20 % frente al mismo mes) usan heurísticas pendientes de H4. El dato exacto, fuente y mes quedan en «Ver el dato exacto», con la variable solo en «Nombre técnico». No inventa datos ni comparaciones faltantes.
- RF-4c: EL SISTEMA muestra en cada tarjeta de recomendación un aviso de validación local: «Esta sugerencia se basa en datos satelitales de 10 años y reglas FAO/SARE; valida disponibilidad de semilla, maquinaria y mercado con tu agrónomo local».
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
- Compose construye el front con `NEXT_PUBLIC_USE_MOCKS=false` por defecto, para que el login y los datos correspondan a los usuarios y la caché reales del seed. El modo de ejemplo puede habilitarse explícitamente y conserva su marca visible; la selección se inyecta durante el build de Next.js.

## Dudas abiertas
- Ninguna bloqueante. La dirección visual (tema claro de alto contraste, legible bajo el sol) está en [`docs/design.md`](../design.md).

## Bloque A — Estado coherente y límites visibles (2026-11-14)

- RF-4d: Los tonos de clima usan `trends` del API; las comparaciones usan `anomalies`. Las zonas orientativas de humedad y verdor se rigen por RF-4b. Una tendencia ausente o una normal faltante se muestra como información insuficiente, nunca «Normal». Lluvia presenta el mes y el acumulado de los últimos doce meses completos frente a la normal de esos mismos meses; cobertura incompleta se declara sin extrapolar.
- RF-4e: El verdor se compara con el mismo mes/punto de otros años según RF-4b; sin porcentaje definido no se interpreta el valor absoluto. Fuente, fecha y valor quedan en «Ver el dato exacto». Las gráficas conservan tonos desde tendencias del API.
- RF-4f: La tarjeta lista «Qué sabemos / Qué falta» desde estado de fuentes y todos los warnings, sin truncarlos. Consume riesgos agrupados con fallback compatible a `risks`. No se modifica el diseño del carrusel ni se añade superficie/ahorro (fuera de Bloque A).
