# Spec 005 — Rotation engine (qué cultivo sigue y cuándo cambiar)

## Contexto y objetivo
Es el núcleo del reto: ayudar al agricultor a decidir **cuándo cambiar de cultivo y hacia cuál**, cuidando la salud del suelo y adaptándose a un clima cambiante. Reglas explicables más puntaje ponderado por las prioridades del agricultor (constitución #5, #6, #10).

## Usuarios / actores
Agricultor (lee recomendaciones), dashboard (las muestra).

## Historias de usuario
- H1: Como agricultor quiero saber qué cultivo sembrar después del actual y por qué.
- H2: Como agricultor quiero saber si mi cultivo actual se está volviendo riesgoso por clima y cuándo conviene cambiar.
- H3: Como agricultor quiero ver una secuencia de 2–3 ciclos, no solo el siguiente.
- H4: Como agricultor quiero que mis prioridades cambien el ranking.

## Requisitos funcionales (EARS)
- RF-1: CUANDO se solicita una recomendación para una zona, EL SISTEMA devuelve las 2–3 mejores secuencias de cultivos para las siguientes 2–3 ventanas de cultivo de esa zona.
- RF-1b: SI la zona tiene menos de 2 ventanas en el horizonte de 24 meses, ENTONCES EL SISTEMA reduce la secuencia a las ventanas disponibles (o sugiere cobertura/barbecho) y lo explica.
- RF-2: EL SISTEMA evalúa cada transición A → B con reglas de familia botánica, balance de nitrógeno, ruptura de ciclo de plagas/enfermedades y cobertura/erosión (spec 004).
- RF-3: EL SISTEMA evalúa la viabilidad de B comparando requisitos del cultivo (agua, temperatura, ciclo) con los indicadores NASA del punto (spec 003).
- RF-4: CUANDO los indicadores NASA muestran tendencia de sequía o calor para el cultivo actual, EL SISTEMA marca "riesgo alto" y sugiere cuándo conviene cambiar y hacia qué cultivo más tolerante.
- RF-5: EL SISTEMA pondera el puntaje final con las prioridades del agricultor (agua, suelo, ingreso, riesgo).
- RF-6: EL SISTEMA devuelve por cada recomendación el puntaje, las variables NASA y reglas que más pesaron, y los riesgos del cambio.
- RF-7: SI faltan datos NASA, ENTONCES EL SISTEMA calcula con lo disponible y baja el nivel de confianza, indicándolo.
- RF-8: SI no hay historial, ENTONCES EL SISTEMA recomienda igualmente y avisa de la menor confianza.
- RF-9: DADAS las mismas condiciones y prioridades distintas, EL SISTEMA puede devolver rankings distintos.

## Requisitos no funcionales
- Determinista: mismos insumos, misma salida. Respuesta < 2 s con datos cacheados.

## Casos límite
- Todos los cultivos inviables en el punto → devolver "ninguna opción viable" con las razones.
- Cultivo actual fuera del catálogo → 400.
- Empate de puntajes → desempate estable (por riesgo, luego por nombre).

## Fuera de alcance
Modelos de rendimiento entrenados, optimización económica con precios, ML de caja negra.

## Criterios de finalización
RF-1 a RF-9 con test en verde + demo: tres usuarios con ubicaciones y prioridades distintas reciben recomendaciones distintas y explicadas.

## Decisiones
- La recomendación se calcula **por zona** (spec 002).
- "Ciclo" = **ventana de cultivo calculada por zona** desde su climatología NASA (spec 003 RF-3b), no una temporada de calendario ni un año. Cada cultivo ocupa su duración real en días; los perennes (p. ej. alfalfa) ocupan varias ventanas seguidas. Las etiquetas locales (PV/OI en México) son solo de visualización.
- El conjunto de cultivos candidatos no está prefijado por región: se filtra por viabilidad climática de cada zona (spec 004).

- Puntaje de 0 a 100; pesos por defecto iguales (25 % agua, 25 % suelo, 25 % ingreso, 25 % riesgo).

## Dudas abiertas
- Ninguna bloqueante.
