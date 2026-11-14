# Spec 002 — Farm context (parcelas, zonas, historial y prioridades)

## Contexto y objetivo
El reto exige combinar datos NASA con **información local**: cultivo actual, historial y prioridades del agricultor. Este módulo guarda ese contexto para cualquier punto del mundo (constitución #5, #7, #10).

## Usuarios / actores
Agricultor (CRUD de lo suyo), Administrador (lectura/edición de todo).

## Historias de usuario
- H1: Como agricultor quiero registrar una parcela eligiendo su ubicación en el mapa para obtener datos de ese lugar.
- H2: Como agricultor quiero indicar mi cultivo actual y mi historial reciente para que la recomendación considere la transición.
- H3: Como agricultor quiero fijar mis prioridades (agua, suelo, ingreso, riesgo) para que el ranking refleje lo que me importa.
- H4: Como agricultor quiero dividir la parcela en zonas con condiciones distintas, porque cada zona puede necesitar un cultivo distinto.

## Requisitos funcionales (EARS)
- RF-1: CUANDO un Agricultor crea una parcela (`POST /parcels` con nombre, lat, lon y cultivo actual), EL SISTEMA la asocia a su `ownerId`.
- RF-2: SI lat/lon están fuera de rango (lat ∉ [-90, 90] o lon ∉ [-180, 180]), ENTONCES EL SISTEMA responde 400.
- RF-3: CUANDO el Agricultor registra el historial de una zona, EL SISTEMA guarda cada cultivo previo con fecha de siembra, fecha de cosecha y rendimiento opcional.
- RF-4: CUANDO el Agricultor define prioridades, EL SISTEMA guarda pesos normalizados para agua, salud del suelo, ingreso y riesgo.
- RF-5: CUANDO el Agricultor agrega una zona (nombre, lat/lon propio opcional, cultivo actual, notas de suelo opcionales), EL SISTEMA la liga a la parcela; el cultivo actual, el historial y las recomendaciones se manejan **por zona**.
- RF-5b: CUANDO se crea una parcela, EL SISTEMA crea una zona por defecto con el punto y cultivo de la parcela, para que nunca exista una parcela sin zona.
- RF-6: EL SISTEMA aplica las reglas de acceso de la spec 001 a toda parcela y zona.
- RF-7: CUANDO se borra una parcela, EL SISTEMA borra en cascada zonas, historial y recomendaciones.

## Requisitos no funcionales
- Cualquier lat/lon válido se acepta; ninguna lista de lugares permitidos.

## Casos límite
- Parcela sin historial: la recomendación se calcula con un aviso de menor confianza.
- Cultivo actual que no está en el catálogo → 400 con la lista de cultivos válidos.
- Prioridades que no suman 100 → se normalizan.

## Fuera de alcance
Polígonos de parcela, importación de shapefiles, geocodificación inversa avanzada.

## Criterios de finalización
RF-1 a RF-7 con test en verde + demo: crear una parcela en un punto cualquiera, con historial y prioridades.

## Decisiones
- Las zonas entran en el MVP: el contexto y la recomendación dependen de la zona.
- El historial se guarda por fechas reales (siembra y cosecha, al menos mes y año), no por etiquetas de temporada de un país. Las etiquetas locales (p. ej. PV/OI en México) son solo de visualización.

## Dudas abiertas
- Ninguna bloqueante. Por defecto se guardan los cultivos de los últimos 2 años.
