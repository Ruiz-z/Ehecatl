# Propuesta: «Por qué» más corto en las tarjetas de estrategia

## Problema
En la tarjeta de cada estrategia, «Por qué y qué riesgos tiene» lista por cada ciclo hasta cinco motivos, una línea de agua con cifras técnicas y otra de clima. Con tres ciclos son más de veinte renglones. Al agricultor le llega mucha información a la vez y no sabe cuál pesa más.

## Qué se propone
Cada ciclo muestra a la vista solo cuatro cosas:

1. El cultivo de salida y el de llegada, con el periodo por mes («noviembre de 2026 a febrero de 2027»).
2. Un motivo a favor.
3. Todos los motivos en contra, porque son los que cambian una decisión.
4. El agua del ciclo en una frase: «La lluvia da 15 % del agua que necesita. El resto sale del riego.»

Todo lo demás pasa a «Ver más detalle», cerrado por defecto:

- Los otros motivos a favor y los neutrales.
- La demanda en mm (ETc), la lluvia del ciclo y el porcentaje que cubre.
- La temperatura media, los mm de lluvia y los días del ciclo.
- Las fechas exactas de inicio y fin.

Las etiquetas «A favor», «En contra» y «Neutral» siguen existiendo para lector de pantalla. A la vista se distinguen por el icono (palomita, triángulo, raya).

## Qué no cambia
- El API, el motor y los textos de los motivos.
- La lógica de confianza y los riesgos de «Antes de decidir».
- La información disponible: solo se ordena qué se ve primero.

## Reglas de la selección
- Si hay varios motivos a favor, se muestra el primero que manda el motor.
- Si no hay ninguno a favor ni en contra, se muestra el primero de la lista.
- La frase de agua cubre cuatro casos: sin cálculo, sin dato de lluvia, lluvia suficiente y lluvia insuficiente (con o sin riego declarado).

## Pendiente
Los motivos siguen escritos por el motor en lenguaje técnico («ruptura de hospederos de plagas», «penalización por retorno»). Reescribirlos toca `apps/api` y necesita revisión agronómica (H4). Es el siguiente paso si esta versión funciona.

## Cómo se verifica
- Pruebas de la selección y de la frase de agua (`step-summary.test.ts`).
- Captura de la tarjeta de Coahuila con el detalle cerrado y abierto.
- `pnpm lint`, `pnpm test` y `pnpm --filter web build`.
