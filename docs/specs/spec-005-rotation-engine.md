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

- RF-10: EL SISTEMA calcula ETo diaria = 0.0135 × (T2M + 17.8) × radiación × 0.408, con radiación NASA en MJ/m²/día, y suma por los días inclusivos del ciclo. ETc = ETo acumulada × Kc estacional; Kc estacional = 0.20 ini + 0.25 (ini+mid)/2 + 0.35 mid + 0.20 (mid+end)/2. Las fracciones de etapa son genéricas, no fenología observada. Si falta temperatura o radiación en cualquier mes, usa waterMm del catálogo, method=catalog y aviso, reduciendo confianza.
- RF-11: EL SISTEMA usa ETc como demanda para viabilidad sin riego (lluvia ≥ 0.65 demanda) y déficit. Por paso deficitMm=max(0, demanda−lluvia); lluvia desconocida conserva null, usa déficit=demanda y mantiene el aviso. Por secuencia irrigationNeedMm=Σ deficitMm. Agua=clamp(100 × (1−irrigationNeedMm/horizonEtoMm),0,100), igual con y sin riego. horizonEtoMm acumula ETo desde el día de decisión hasta el fin del horizonte de 24 meses mediante climatología mensual, etoDaily y cycleMonths; si faltan datos o no es positiva, usa la suma de demandas de los pasos y añade aviso con confianza reducida. El beam acumula déficit y recalcula agua en cada extensión; suelo, ingreso y riesgo siguen promediándose. Baseline usa la misma regla.
- RF-12: EL SISTEMA calcula seguridad desde 100: calor −4/°C por encima de tempMax (máximo 30), media fuera del óptimo −3/°C (máximo 20), mínima <2 °C en sensible −20, déficit −30(1−coverage) sin riego o −15(1−coverage) con riego, sequía activa y tolerancia <60 −15, calor activo −10 y misma familia −20. Acota 0–100; no cuenta textos de riesgos. Márgenes desconocidos no generan penalidad térmica y se avisan.
- RF-13: EL SISTEMA expone water por paso sin perder reasons, climate ni rests. Cada recomendación y baseline publica irrigationNeedMm entero (0 si inviable); coveragePct se redondea a un decimal al responder. Los riesgos incluyen una sola línea «Agua faltante en 24 meses: ~X mm; con riego depende de su disponibilidad efectiva» o «Agua faltante en 24 meses: ~X mm: la lluvia no cubre la demanda», sin déficit repetido por ciclo; el resto sigue deduplicado. La tarjeta muestra el agua faltante con fallback para contratos antiguos y aportes enteros axes × pesos normalizados y nivel alto ≥70, medio ≥50 y bajo <50. Suelo e ingreso conservan sus reglas.

Estas fórmulas, constantes, fracciones, umbrales y niveles son heurísticas pendientes de validación H4; la aproximación por radiación no es Penman-Monteith FAO-56. No usa extremos mensuales para Hargreaves por rango térmico.

## Requisitos no funcionales
- Determinista: mismos insumos, misma salida. Respuesta < 2 s con datos cacheados.

## Casos límite
- Todos los cultivos inviables en el punto → devolver "ninguna opción viable" con las razones.
- Cultivo actual fuera del catálogo → 400.
- Empate de puntajes → desempate estable (por riesgo, luego por nombre).

## Fuera de alcance
Modelos de rendimiento entrenados, optimización económica con precios de mercado en tiempo real, ML de caja negra.

## Criterios de finalización
RF-1 a RF-13 (incluido RF-1c) con test en verde + demo: tres usuarios con ubicaciones y prioridades distintas reciben recomendaciones distintas y explicadas, siempre comparadas contra mantener lo actual.

## Decisiones
- La recomendación se calcula **por zona** (spec 002).
- "Ciclo" = duración real de un cultivo en días dentro de las **ventanas climatológicas calculadas por zona** (spec 003 RF-3b), no una temporada de calendario ni un año. Una ventana larga puede alojar varios ciclos sin solapamientos; los perennes (p. ej. alfalfa) pueden ocupar varias ventanas seguidas. Geo conserva los meses aptos consecutivos como una sola ventana (`windows.py` no se divide artificialmente). Las etiquetas locales (PV/OI en México) son solo de visualización.
- Corrección QA 2026-11-14: Coahuila se propone como parcela demo con riego declarado para mostrar recomendaciones viables con prioridades de ahorro de agua. Solo cambia el fixture, sin reglas por región ni datos NASA simulados; la aprobación del perfil por H3 sigue pendiente. El riego es una condición declarada que requiere disponibilidad efectiva, no una garantía agronómica (H4).
- El conjunto de cultivos candidatos no está prefijado por región: se filtra por viabilidad climática de cada zona (spec 004).

- Puntaje de 0 a 100; pesos por defecto iguales (25 % agua, 25 % suelo, 25 % ingreso, 25 % riesgo).

## Dudas abiertas
- Ninguna bloqueante.

## Bloque A — Confianza y riesgos (2026-11-14)

- RF-7b: Confianza `low` únicamente si POWER está ausente/incompleto o algún ciclo publicado usa demanda de catálogo. MODIS parcial/ausente, meses NDVI faltantes, normales con menos de diez muestras anuales, respaldo de ETo del horizonte o historial ausente reducen a `medium`, con aviso específico; sin limitaciones, `high`. Los avisos operativos por secuencia corta no degradan por sí solos la confianza.
- RF-6c: Cada recomendación y referencia añade `riskGroups: [{type,text}]`, conservando `risks`. Agrupa por tipo; calor publica la máxima más adversa con la tolerancia de ese mismo ciclo y número de ciclos afectados sobre el total. Otros riesgos se condensan sin perder causas distintas ni incertidumbre. El resumen hídrico conserva el déficit total.
