# Spec 004 — Crop knowledge (catálogo agronómico)

## Contexto y objetivo
El motor necesita saber qué requiere cada cultivo y cómo se relaciona con el suelo y con otros cultivos. El catálogo es la base de las reglas de transición y debe citar su fuente (constitución #11).

## Usuarios / actores
Motor de rotación; el agricultor lo consulta al elegir cultivos; Administrador lo edita.

## Historias de usuario
- H1: Como motor quiero requisitos de agua, temperatura y ciclo por cultivo para evaluar si es viable en un punto.
- H2: Como motor quiero familia botánica y efecto en el suelo (nitrógeno, cobertura, raíz) para evaluar transiciones.
- H3: Como agricultor quiero ver de dónde sale cada dato del catálogo para confiar en él.

## Requisitos funcionales (EARS)
- RF-1: EL SISTEMA mantiene un catálogo versionado en el repo con, por cultivo: nombre, familia botánica, rango de temperatura, demanda hídrica, duración del ciclo, ventana de siembra por clima, balance de nitrógeno (fija/consume), cobertura de suelo, tolerancia a sequía y `marketValueTier` (`bajo` | `medio` | `alto`, nivel categórico de valor comercial o forrajero por hectárea, con su fuente, p. ej. SIAP/FAOSTAT; si no hay fuente verificable se marca «estimado»).
- RF-1b: EL SISTEMA exige `kc: {ini,mid,end}` entre 0.1 y 1.4 de FAO-56 Tabla 12, con `kcSource` identificando fila y selección dentro de rangos. Si usa categoría análoga, marca `kcEstimated: true`.
- RF-2: EL SISTEMA guarda por cada cultivo su fuente (FAO/GAEZ u otra) y la expone en la API.
- RF-3: CUANDO se consulta `GET /crops`, EL SISTEMA devuelve el catálogo completo.
- RF-4: EL SISTEMA define compatibilidades de transición entre familias (buena, neutra, a evitar) con la razón agronómica.
- RF-5: SI un cultivo no tiene todos los campos obligatorios, ENTONCES la carga del catálogo falla con un error que indica el cultivo y el campo.

## Requisitos no funcionales
- Catálogo inicial amplio (≈15–20 cultivos de climas distintos: granos, leguminosas, forrajes, oleaginosas, hortalizas y cultivos de cobertura). No se prioriza por país: el motor filtra por viabilidad climática de cada zona.

## Casos límite
- Cultivo con datos parciales: se excluye de las recomendaciones y se registra.
- Mismo cultivo con ciclos distintos por clima: se modela como variantes.

## Fuera de alcance
Variedades/cultivares, rendimientos por híbrido, precios de mercado en tiempo real (stretch). Sí se incluye el nivel categórico `marketValueTier`, que alimenta el eje ingreso de la spec 005.

## Criterios de finalización
RF-1 a RF-5 con test en verde + revisión de que cada cultivo cita fuente.

## Decisiones
- No hay cultivos prioritarios fijos: dependen de cada zona. La viabilidad se calcula contra los indicadores NASA del punto.
- Cada cultivo se describe por requisitos físicos (rango de temperatura, demanda hídrica, duración del ciclo en días, sensibilidad a heladas), no por fechas ni temporadas de un país. Encaja en una ventana de la zona si sus requisitos caben en ella.

## Dudas abiertas
- Ninguna bloqueante.
