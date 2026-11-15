# Cómo se calcula el puntaje de las estrategias

Explica qué cambió en el motor de rotación al pasar a ejes calculados con datos, de dónde sale cada porcentaje y qué tan confiable es el resultado. Detalle técnico en [`specs/spec-005-rotation-engine.md`](specs/spec-005-rotation-engine.md) y fuentes en [`fuentes-agronomicas.md`](fuentes-agronomicas.md).

## 1. De dónde salen los cultivos
- El catálogo sigue siendo el mismo: 18 cultivos en `apps/api/src/modules/crop-knowledge/data/crops.json`.
- El motor prueba cada cultivo en cada ventana de siembra y descarta los que no caben por temperatura, agua o duración del ciclo.
- Arma secuencias de hasta 3 ciclos en 24 meses y se queda con las de mejor puntaje.

Lo que cambió es el orden. Antes pesaban un número fijo de ingreso por cultivo y penalizaciones puestas a mano. Ahora pesan la historia de NASA y el coeficiente Ky de FAO. Por eso cambian los cultivos que quedan arriba.

## 2. De dónde sale cada porcentaje

| Qué ves | Cómo se obtiene |
|---|---|
| Porcentaje de peso (por ejemplo 60, 20, 10, 10) | Las prioridades del agricultor. No son un dato, son su decisión. |
| Agua | Lluvia del ciclo contra el agua que pide el cultivo (ETo de NASA POWER por el Kc de FAO-56). Se suma el faltante de toda la secuencia y se compara con el agua que evapora el clima en el horizonte. |
| Riesgo | `100 × años sin fallo / años con datos completos`. Se repite el calendario del ciclo en cada uno de los 10 años de historia de POWER. Un año falla si la temperatura media de algún mes sale del rango del cultivo, si hay helada en un cultivo sensible o si sin riego la lluvia no llega al 65 % de lo que pide. |
| Cosecha (antes Ingreso) | `100 × (1 − Ky × (1 − agua disponible / agua que pide))`, promediado en los 10 años. Con riego declarado siempre da 100. |
| Suelo | Reglas de rotación por familia de cultivo (SARE y FAO). No es un dato medido. |
| Puntaje final | Suma de cada eje por su peso, de 0 a 100. |

Ejemplo con pesos 60, 20, 10 y 10 y ejes 79, 83, 100 y 80: `79×0.6 + 83×0.2 + 100×0.1 + 80×0.1 = 82`.

## 3. Qué es dato y qué es regla

| Eje | Origen |
|---|---|
| Agua | Dato NASA y fórmula FAO-56 |
| Riesgo | Dato NASA (10 años) y rangos de temperatura de ECOCROP |
| Cosecha | Dato NASA y Ky de FAO-33 y FAO-66 |
| Suelo | Regla agronómica publicada |
| Pesos | Decisión del agricultor |

Nueve de los 18 Ky se tomaron de un cultivo afín de la misma tabla y van marcados como estimados en cada paso.

## 4. Qué tan confiable es

Es una herramienta de orientación, no una recomendación agronómica validada.

Lo sólido:
- El clima es dato real de NASA y las fórmulas son publicadas.
- Es reproducible: mismos datos, mismo resultado, con tests.
- Cada paso muestra su origen y marca lo estimado.

Lo que falta:
- Ningún agrónomo ha revisado los umbrales ni las reglas de suelo (tarea H4).
- No se ha comparado contra cosechas ni estaciones reales.
- POWER tiene unos 50 km de resolución: el clima es el de la zona, no el de la parcela.
- Con riego, Cosecha vale 100 para todos y no distingue cultivos.
- Ya no entra precio ni mercado. Un cultivo de cobertura como la mostaza puede ganarle a uno que deja más dinero.
- El riesgo da 100 en casi todos los ciclos de Nevada y Mendoza y separa poco las opciones.
- No se consideran plagas, variedades, costos ni suelo real de la parcela.
- Queda sin explicar un hueco de febrero a julio en Coahuila, que podría ser un error del motor.

## 5. Margen de error

No hay un margen de error medido. Nunca se comparó el motor contra datos de campo, así que cualquier porcentaje de error sería inventado.

Fuentes de incertidumbre conocidas. Los órdenes de magnitud vienen de la literatura, no de pruebas propias:
- Lluvia de POWER: frente a estaciones puede fallar del orden de 20 a 30 % o más en lluvia mensual, según la zona. Es la fuente de error más grande y afecta a Agua y a los fallos por falta de lluvia.
- Temperatura: errores de uno o dos grados frente a una estación local.
- Kc y Ky de FAO: son promedios de muchos sitios y pueden variar para un cultivar o clima concreto.
- Reglas de suelo y umbrales: son criterios, no tienen margen estadístico.

El puntaje se lee como un orden relativo. Una diferencia de 0.2 puntos entre dos estrategias no significa nada.

## 6. Qué decir en la demo
- «El clima es dato real de NASA. Las reglas agronómicas vienen de FAO y SARE y están pendientes de validación local.»
- Presentarlo como apoyo para decidir, no como la respuesta.

## 7. Cómo volverlo más confiable
1. Revisión agronómica (H4) de umbrales, Ky estimados y reglas de suelo.
2. Prueba de sensibilidad: mover umbrales y Kc entre 10 y 20 % y comprobar si el top 3 cambia.
3. Comparar POWER con una estación real de una zona demo para obtener un error de lluvia y temperatura propio.
4. Decidir qué hacer con los cultivos de cobertura y con el valor de mercado.
