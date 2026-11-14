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
- RF-4: CUANDO se abre una parcela, EL SISTEMA muestra 3 tarjetas lado a lado: la **estrategia actual** («mantener lo actual», spec 005 RF-1c) y las 2 mejores alternativas, cada una con puntaje, diferencia contra la actual, explicación y riesgos.
- RF-4b: EL SISTEMA muestra cada indicador NASA en lenguaje de campo con semáforo (p. ej. «Humedad en raíz: baja (22 %) — riesgo de estrés hídrico») y deja el dato crudo y su variable (`GWETROOT`, `T2M_MAX`…) en un desplegable técnico.
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

## Dudas abiertas
- Ninguna bloqueante. La dirección visual (tema claro de alto contraste, legible bajo el sol) está en [`docs/design.md`](../design.md).
