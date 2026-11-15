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
- RF-1: CUANDO se solicita una recomendación para una zona, EL SISTEMA devuelve hasta las 2 mejores alternativas de hasta 3 ciclos de cultivos sobre las primeras 3 ventanas disponibles en el horizonte de 24 meses, junto a la referencia de RF-1c.
- RF-1b: SI una ventana continua permite varios ciclos, ENTONCES EL SISTEMA puede encadenarlos dentro de ella, sembrando como mínimo el día siguiente a la cosecha anterior y reevaluando la viabilidad en los meses ocupados. SI no caben 2 ciclos viables en las ventanas disponibles, ENTONCES reduce la secuencia (o sugiere cobertura/barbecho) y lo explica; el número de ventanas por sí solo no reduce la secuencia.
- RF-1b (descansos): EL SISTEMA explicita los periodos sin cultivo de al menos un mes entre el inicio del horizonte, los ciclos y el final, con fechas inclusivas, número de meses, motivo según las ventanas NASA y sugerencia de mantener cobertura o rastrojo. Los tramos se separan cuando cambia su pertenencia a una ventana; no se inventan cultivos. Un mes se mide de fecha a fecha (o un mes calendario completo).
- RF-1c: EL SISTEMA devuelve siempre una referencia `baseline` («mantener lo actual»), repitiendo el cultivo actual hasta 3 ciclos con las mismas ventanas, reglas, historial y pesos que las alternativas. La evalúa separadamente para que el recorte del ranking no la elimine. SI no cabe ningún ciclo viable, ENTONCES `viable=false`, `score` y `components` son nulos y se explican las causas; no se asigna puntaje a un cultivo inviable. Cada alternativa incluye `delta` frente a la referencia, nulo si esta no es viable. Las alternativas excluyen las secuencias formadas únicamente por el cultivo actual.
- RF-2: EL SISTEMA evalúa cada transición A → B con reglas de familia botánica, balance de nitrógeno, ruptura de ciclo de plagas/enfermedades y cobertura/erosión (spec 004).
- RF-3: EL SISTEMA evalúa la viabilidad de B comparando requisitos del cultivo (agua, temperatura, ciclo) con los indicadores NASA del punto (spec 003).
- RF-4: CUANDO los indicadores NASA muestran tendencia de sequía o calor para el cultivo actual, EL SISTEMA marca "riesgo alto" y sugiere cuándo conviene cambiar y hacia qué cultivo más tolerante.
- RF-5: EL SISTEMA pondera el puntaje final con las prioridades del agricultor (agua, suelo, ingreso, riesgo). El eje **ingreso** se calcula de forma determinista desde el `marketValueTier` de cada cultivo (spec 004), sin precios en tiempo real.
- RF-6: EL SISTEMA devuelve por cada recomendación el puntaje, las variables NASA y reglas que más pesaron, y los riesgos del cambio.
- RF-6b: EL SISTEMA agrupa las razones por paso de la secuencia, con efecto a favor, en contra o neutral, y publica el clima del ciclo: temperatura media a un decimal, lluvia y duración en enteros; datos desconocidos nulos. Conserva la explicación plana compatible, presenta los pesos una sola vez y elimina riesgos duplicados.
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
Modelos de rendimiento entrenados, optimización económica con precios de mercado en tiempo real, ML de caja negra.

## Criterios de finalización
RF-1 a RF-9 (incluido RF-1c) con test en verde + demo: tres usuarios con ubicaciones y prioridades distintas reciben recomendaciones distintas y explicadas, siempre comparadas contra mantener lo actual.

## Decisiones
- La recomendación se calcula **por zona** (spec 002).
- "Ciclo" = duración real de un cultivo en días dentro de las **ventanas climatológicas calculadas por zona** (spec 003 RF-3b), no una temporada de calendario ni un año. Una ventana larga puede alojar varios ciclos sin solapamientos; los perennes (p. ej. alfalfa) pueden ocupar varias ventanas seguidas. Geo conserva los meses aptos consecutivos como una sola ventana (`windows.py` no se divide artificialmente). Las etiquetas locales (PV/OI en México) son solo de visualización.
- Corrección QA 2026-11-14: Coahuila se propone como parcela demo con riego declarado para mostrar recomendaciones viables con prioridades de ahorro de agua. Solo cambia el fixture, sin reglas por región ni datos NASA simulados; la aprobación del perfil por H3 sigue pendiente. El riego es una condición declarada que requiere disponibilidad efectiva, no una garantía agronómica (H4).
- El conjunto de cultivos candidatos no está prefijado por región: se filtra por viabilidad climática de cada zona (spec 004).

- Puntaje de 0 a 100; pesos por defecto iguales (25 % agua, 25 % suelo, 25 % ingreso, 25 % riesgo).

## Dudas abiertas
- Ninguna bloqueante.
