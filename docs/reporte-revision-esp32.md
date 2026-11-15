# Reporte de revisión y preparación para ESP32

Fecha: 15 de noviembre de 2026. Código revisado: `897bedc`.

Actualización tras recibir los dos programas del ESP32: [revisión del firmware, sin servos](revision-firmware-esp32.md). La sección actual analiza la versión de un punto de suelo; la primera se conserva como historial. Incluye campos enviados, duración de riego incorrecta, permiso de bomba sin caducidad y cambios para conectarlo con Ehécatl. El usuario confirmó FC28 de dos puntas; las etiquetas de «capacitivo» del segundo archivo no corresponden al hardware elegido. Los programas confirman DHT11 y WiFi; la conectividad efectiva en campo sigue por comprobar.

## Resultado general

El proyecto conserva su objetivo: ayudar a decidir qué cultivo sigue y cuándo sembrarlo, combinando datos NASA, condiciones de la zona y prioridades del agricultor. La conexión del front con la API y la comparación con mantener el cultivo actual ya existen.

**Todavía no todo cumple lo establecido.** Hay diferencias en prioridades, manejo de zonas, cálculo de ingreso y presentación de datos. El ESP32 tiene una propuesta escrita, pero todavía no hay código para registrar dispositivos ni recibir sus mediciones.

Esta revisión entrega un diagnóstico y una propuesta de trabajo. No cambia el funcionamiento de la aplicación ni aprueba automáticamente la ampliación a sensores. Los hallazgos describen el estado actual; no todos fueron introducidos por el último cambio.

## Qué cambió y qué se conserva

| Parte | Cambios principales | Resultado de la revisión |
|---|---|---|
| Pantallas | Nuevo diseño, mapa, login, creación de parcelas, gráficas, tarjetas y controles de prioridades. | El flujo está implementado; falta cerrar algunas diferencias de funcionamiento y la revisión visual completa. |
| Conexión con el servidor | El front consulta usuarios, parcelas, catálogo, indicadores y recomendaciones reales. Compose usa la API real por defecto. | Conforme en lo revisado. El modo de ejemplo se conserva y se identifica en pantalla. |
| Recomendaciones | Hasta dos alternativas y una referencia de mantener el cultivo actual; ciclos ajustados a las ventanas de cada zona. | El motor contempla referencia viable e inviable, explicaciones, riesgos y menor confianza cuando faltan datos. Las pruebas pasan. |
| Datos NASA | POWER y MODIS, con respaldo Terra/Aqua mediante Planetary Computer. | Hay pruebas de normalización y fallos parciales. La pantalla todavía pierde parte de la información de procedencia. |
| Arranque | Migraciones y usuarios demo se preparan automáticamente antes de iniciar la API. | Implementado y con evidencia previa de Compose desde cero. Esta revisión no repitió ese despliegue. |
| ESP32 | Documento de propuesta de sensores, comparación y avisos. | Pendiente de definición final e implementación. |

Los controles de acceso por dueño, las ubicaciones libres y el uso de reglas explicables siguen presentes en el código revisado. No encontré una restricción del motor a Coahuila o Nevada.

## Qué corregir, por orden de importancia

### 1. Las prioridades deben pedir nuevas opciones al motor — prioridad alta

**Qué ocurre:** la API entrega solo dos alternativas. Al mover los controles, el navegador vuelve a puntuar esas alternativas y la referencia. Guardar las prioridades tampoco vuelve a solicitar las recomendaciones en esa pantalla.

**Por qué importa:** al cambiar de ahorrar agua a buscar ingreso, puede existir una opción mejor que nunca llegó al navegador. Las explicaciones también pueden conservar los pesos anteriores.

**Comprobación:** con los mismos datos de prueba del motor, priorizar agua devuelve secuencias con caupí y garbanzo. Al priorizar ingreso, el motor devuelve tomate y papa/tomate; esas opciones no estaban entre las dos anteriores. Reordenarlas en el navegador no permite descubrirlas.

**Cambio necesario:** guardar los pesos y volver a consultar el motor; actualizar alternativas, referencia, diferencias y explicaciones con la misma respuesta. Para una previsualización antes de guardar, definir primero un contrato que permita calcular con pesos temporales. Usar el puntaje del servidor como resultado definitivo y redondearlo solo al mostrarlo.

Evidencia: `apps/web/src/features/rotation/recommendations.tsx:121,145,194`, `apps/web/src/shared/api/client.ts`, `apps/api/src/modules/rotation-engine/engine/sequences.ts:37`. Requisitos: spec 006 RF-5 y spec 005 RF-5/RF-9.

### 2. La pantalla solo utiliza la primera zona — prioridad alta para sensores

**Qué ocurre:** aunque el servidor admite varias zonas, el adaptador del front toma únicamente `parcel.zones[0]`. Tampoco ofrece el flujo para capturar historial o gestionar otras zonas.

**Por qué importa:** un sensor instalado en una segunda zona no tendría una vista propia. Se podría interpretar la información de una zona como si describiera toda la parcela. Sin captura de historial en pantalla, el agricultor tampoco puede aportar ese insumo desde el flujo actual.

**Cambio necesario:** permitir elegir la zona y consultar sus datos, recomendaciones, historial y dispositivos. La asignación del ESP32 debe quedar ligada a esa zona concreta.

Evidencia: `apps/web/src/shared/api/adapters.ts:64`, `apps/web/src/shared/api/types.ts`, `apps/api/src/modules/farm-context/farm.controller.ts`. Requisitos: spec 002 RF-3/RF-5 y decisión de recomendaciones por zona de spec 006.

### 3. El puntaje de ingreso no sigue la definición escrita — prioridad media

**Qué ocurre:** la spec pide una categoría comercial `marketValueTier` —baja, media o alta— con fuente o identificada como estimada. El catálogo usa directamente números `incomeOpportunity`, sin esa categoría ni trazabilidad específica del valor económico.

**Por qué importa:** el ranking funciona, pero no queda claro de dónde sale la ventaja económica entre cultivos. Las fuentes generales del cultivo no explican por sí solas ese puntaje.

**Cambio necesario:** incorporar categoría, fuente o marca de estimación y una conversión documentada a puntos. Mantener pendiente la revisión agronómica H4; el resultado no representa una ganancia garantizada.

Evidencia: `apps/api/src/modules/crop-knowledge/crop-catalog.ts:9,33`, `apps/api/src/modules/crop-knowledge/data/crops.json`, `apps/api/src/modules/rotation-engine/engine/sequences.ts:78`. Requisitos: spec 004 RF-1/RF-5 y spec 005 RF-5.

### 4. Mostrar la fuente real y la escala de cada dato — prioridad media

**Qué ocurre:** el servidor conserva la fuente de cada observación, pero el front no conserva su resolución. Las gráficas de NDVI muestran siempre ORNL DAAC, incluso cuando el dato vino de Planetary Computer y pudo ser Aqua. El resumen de NDVI tampoco conserva su fecha individual.

**Por qué importa:** antes de comparar con un sensor es necesario saber cuándo se midió cada dato y qué extensión del terreno representa. Consultar la caché hoy no significa que la observación sea de hoy.

**Cambio necesario:** llevar fecha, fuente, producto y resolución hasta la pantalla de cada indicador. Mostrar por separado cuándo se consultó y cuándo corresponde la observación. Explicar que POWER aporta contexto regional y que un sensor mide un punto de la parcela.

Evidencia: `apps/web/src/shared/api/adapters.ts`, `apps/web/src/features/nasa/field-status.tsx`, `apps/web/src/features/nasa/field-charts.tsx:105`. Requisitos: spec 003 y spec 006 RF-3; también necesario para spec 007 RF-13.

### 5. No confundir ausencia de cultivos viables con cero ventanas — prioridad media

**Qué ocurre:** ante `no_viable_options`, la pantalla afirma que existen «0 ventanas viables». El motor puede devolver ese estado aunque haya ventanas climáticas: puede suceder que ningún cultivo del catálogo quepa por duración, agua o temperatura.

**Cambio necesario:** decir «No encontramos cultivos viables con estas condiciones» y mostrar las causas. Indicar cero ventanas únicamente cuando los datos lo confirmen.

Evidencia: `apps/web/src/features/rotation/recommendations.tsx:157`, spec 005, caso límite de todos los cultivos inviables.

## Qué se necesita para integrar el ESP32

La [spec 007](specs/spec-007-field-sensors.md) sigue en borrador. La constitución todavía considera IoT una fase opcional. Preparar hardware no implica que ya exista la conexión de software.

El equipo confirmó ESP32, «DTH11», MQ2, FC28 y una microbomba de agua con flujo. Se interpreta «DTH11» como **DHT11**, pendiente de comprobar la etiqueta. La variante de ESP32, las placas comerciales de los sensores, el modelo y consumo de la bomba, la profundidad y la conectividad en campo siguen sin confirmarse. WiFi es una hipótesis de trabajo.

### Cómo encaja el hardware que ya eligieron

| Componente | Para qué sirve aquí | Cambio necesario |
|---|---|---|
| DHT11 | Temperatura y humedad relativa del aire. | Enviar `airTemperature` en °C y `airHumidity` en %; compararlas con `T2M` y `RH2M` en periodos equivalentes. No enviar temperatura de suelo, porque este sensor no la mide. |
| FC28 | Señal local relacionada con humedad del suelo. | Leer la salida analógica, conservar el dato crudo y calibrar en el suelo de la prueba. Mostrar un índice relativo de humedad mientras no exista una calibración física validada. |
| MQ2 | Señal de humo y gases combustibles. | Ampliar la propuesta y el contrato si se quiere guardar y mostrar. No está contemplado en las variables de la spec 007 ni tiene una comparación equivalente con las fuentes NASA actuales. |
| Microbomba | Mover agua; es un actuador. | Definir si será una demostración independiente o una ampliación del producto. Controlarla desde Ehécatl, incluso con un botón manual, contradice RF-15 de la spec 007 actual. |
| Medición de flujo | Saber cuánto agua pasa realmente. | Confirmar si existe un caudalímetro o una bomba con medición integrada. Una bomba que entrega flujo no implica que lo esté midiendo. Sin ese sensor no mostrar litros medidos ni confirmar riego efectivo. |

**DHT11:** sirve para una demostración de temperatura y humedad del aire. La ficha de Aosong indica precisiones de aproximadamente ±2 °C y ±5 puntos de humedad relativa; por eso diferencias pequeñas frente a NASA no bastan para declarar desacuerdo. Verificar la versión real del módulo y colocar el sensor protegido del sol directo y de salpicaduras. Fuente: [ficha del fabricante, alojada por un distribuidor](https://www.electronicoscaldas.com/datasheet/DHT11_Aosong.pdf).

**FC28:** la sonda habitual de dos puntas es resistiva y puede corroerse si permanece alimentada en suelo húmedo. Para el prototipo, propongo alimentar la sonda solo al medir mediante una etapa de conmutación adecuada y revisar su calibración. Usar la salida analógica permite ver variaciones; la salida digital solo indica que se cruzó el umbral del módulo. Las características eléctricas deben comprobarse en la placa adquirida. Referencia de un proveedor para módulos [FC28/YL69](https://shillehtek.com/blogs/shillehtek-product-manuals/soil-moisture-sensor-hygrometer-module-for-arduino-watering-kit-manual).

**MQ2:** el fabricante lo define para humo y gases combustibles. Su calentador trabaja a 5 V y la señal puede superar el nivel admitido por una entrada del ESP32: verificar y adaptar niveles antes de conectarlo. Considerar su consumo y el acondicionamiento/calentamiento indicado por el fabricante; marcar la señal como no lista durante esa fase. Guardar señal cruda o voltaje, sin convertirla automáticamente a ppm ni a «calidad del aire» validada. No incorporarla al puntaje agronómico ni a la confianza NASA sin una regla y validación específicas. Fuente: [Winsen MQ2](https://www.winsen-sensor.com/product/mq-2.html).

**Microbomba:** para una bomba de motor DC hace falta una etapa de potencia adecuada —por ejemplo, un MOSFET o controlador compatible con señal de 3.3 V—, alimentación dimensionada al consumo de arranque y protección frente al pico del motor. Un GPIO solo da la señal de control. El circuito concreto depende de la bomba y no puede cerrarse aún. Referencia del principio de control de motores: [Adafruit](https://learn.adafruit.com/adafruit-arduino-lesson-13-dc-motors/transistors).

**La bomba cambia el alcance si la controla la aplicación.** La propuesta vigente prohíbe comandos al dispositivo y accionamiento de riego, tanto automático como remoto manual. Para integrarlo se necesita una spec adicional y revisar esa restricción: permisos para ordenar riego, duración máxima, apagado local ante fallos o reinicios, confirmación de ejecución y registro del evento. Si hay caudalímetro, agregar detección de ausencia de flujo y calibración de pulsos a litros. Estas funciones son trabajo futuro propuesto; no existen ni quedan aprobadas por incluirlas en este reporte.

| Trabajo | Qué se debe agregar o precisar |
|---|---|
| Acuerdo del equipo | Cerrar spec 007 y reflejar el alcance en constitución, specs 003/005/006, contratos y tareas. Mantener la regla de solo avisar. |
| Registro de dispositivos | Alta por administrador, zona asignada, modelo de sensor, profundidad, calibración e intervalo esperado. Clave individual, visible una vez, almacenada como hash y revocable. |
| Recepción de lecturas | Implementar `POST /readings` con `X-Device-Key`. Validar fecha, unidades, rangos y tamaño; guardar valor crudo, valor interpretado, fecha de medición y fecha de recepción. DHT11 y FC28 encajan en las variables propuestas; MQ2 y caudal requieren ampliar el contrato antes de enviarlos. |
| Base de datos | Agregar dispositivos, lecturas e índices por zona y fecha. Después, historial de comparación y avisos. Conservar la zona original de lecturas anteriores si se mueve un dispositivo. |
| Programa del ESP32 | Leer sensores, sincronizar reloj, enviar mediciones, reconocer confirmación y reintentar cuando falle internet. Identificar cada lectura para evitar duplicados al reenviar. |
| Acceso desde la parcela | Definir una dirección de API alcanzable desde el nodo. `localhost` en el ESP32 apunta al propio ESP32. Para una prueba en la misma red, usar la dirección del equipo servidor; para operación remota, un destino accesible y HTTPS. |
| Pantalla | Elegir zona y mostrar medición, antigüedad, dispositivo conectado/sin señal y gráfica. Permitir al dueño consultar solo sus zonas. |
| Comparación y recomendaciones | Comparar periodos equivalentes y variables compatibles; explicar el resultado. Incorporar concordancia a la confianza solo con datos suficientes y reglas documentadas. |

El flujo propuesto es: **sensor → ESP32 → API → base de datos → pantalla**. El servicio Geo sigue consultando NASA. La API reúne ambas fuentes para la comparación; recibir una lectura no debería esperar una consulta a NASA.

### Tres ajustes importantes antes de comparar mediciones

**La escala de tiempo debe coincidir.** Hoy Geo consulta POWER mensual y excluye el mes en curso de las observaciones completas. La spec 007 propone evaluar concordancia desde siete días de campo. Esos siete días no tienen una contraparte diaria en el servicio actual. Propongo agregar una consulta diaria de POWER para comparación, con caché y fecha real disponible, conservando la información mensual para planear cultivos. NASA ofrece una [API diaria](https://power.larc.nasa.gov/docs/services/api/temporal/daily/). Si se decide conservar solo datos mensuales, habrá que cambiar el periodo mínimo y el mensaje de comparación en la spec.

**Un porcentaje normalizado no demuestra equivalencia física.** Calibrar un sensor entre seco y saturado puede producir un índice útil de 0 a 1; no demuestra por sí solo que ese índice sea la misma magnitud que `GWETROOT`. La propia spec 007 RF-9 reconoce escalas distintas. Hay que precisar RF-6: identificar unidad y método de calibración, conservar crudo y comparar tendencias con un método definido. La temperatura de suelo tampoco debe compararse como si fuera temperatura de aire. La revisión H4 debe validar estas reglas.

**La confianza requiere evidencia suficiente.** Siete días es el mínimo propuesto para empezar a evaluar, no una garantía de precisión. No aumentar confianza solo porque llegó una lectura o porque dos números se parecen. Si faltan datos NASA, el sensor está descalibrado o dejó de transmitir, explicarlo y conservar las advertencias.

### Lo que conviene verificar al preparar la placa

- Confirmar modelo exacto del ESP32, sensores y compatibilidad eléctrica antes de elegir pines o voltajes.
- Si es un ESP32 clásico y la humedad usa una entrada analógica, preferir ADC1 para simplificar el uso junto con WiFi; ADC2 comparte recursos con WiFi. La documentación de [Espressif sobre ADC](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32/api-reference/peripherals/adc_oneshot.html) describe esta limitación.
- Calibrar la lectura electrónica y la respuesta del sensor al suelo por separado. Espressif documenta variaciones del ADC y recomienda calibración y varias muestras para reducir ruido en su [guía de calibración](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/adc/adc_calibration.html).
- Para enviar la clave del dispositivo por internet, usar HTTPS con verificación del certificado. El cliente oficial del ESP32 lo admite mediante certificado raíz o paquete de certificados: [guía HTTPS de Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html).
- Definir alimentación, protección física, profundidad y separación de nodos según la instalación real. No se puede cerrar una lista de componentes con la información actual.

## Orden propuesto de trabajo

1. **Corregir prioridades y acceso por zona.** Son diferencias existentes y afectan lo que el agricultor verá al conectar sensores.
2. **Cerrar el contrato del dispositivo.** Acordar variables, unidades, valor crudo, calibración, identificador de lectura, fechas, errores y confirmación. Definir la retención y cuánto tiempo se admiten lecturas atrasadas, para que los reintentos tengan sentido.
3. **Conectar DHT11 y FC28 y mostrar sus lecturas.** Incluir autenticación, persistencia, permisos, calibración, estado sin señal y reintentos. Esta entrega permite ver campo y NASA por separado; todavía no completa los 19 requisitos de la spec 007. Incorporar MQ2 como señal experimental tras definir su contrato; no esperar su validación para recibir temperatura y humedad.
4. **Agregar comparación con periodos equivalentes.** Mostrar «aún reuniendo datos» cuando no haya suficientes pares válidos; documentar umbrales y cómo se combinan varios nodos.
5. **Agregar avisos y ajuste de confianza.** Evitar avisos repetidos, registrar la respuesta del agricultor y comprobar el comportamiento sin sensor o con fuentes faltantes. El sistema mantiene al agricultor como quien decide, sin comandos de riego.
6. **Tratar la bomba como ampliación aparte.** La primera integración de mediciones puede funcionar sin controlarla. Si el producto va a ordenar riego, definir y revisar esa función antes de programarla, incluyendo si habrá medición real de caudal.

Para considerar completa la integración: lectura real visible en su zona; clave incorrecta o revocada rechazada; reenvío sin duplicado; lectura inválida descartada con motivo; aislamiento entre agricultores; desconexión visible; comparación sin inventar datos y avisos sin accionar dispositivos. También falta el ensayo manual del flujo completo.

## Qué se verificó y qué queda pendiente

- Se revisaron historial de cambios, constitución, specs 001–007, contratos, pendientes, modelos de datos y código de API, Geo y front.
- **`pnpm lint`: pasa** en las tres aplicaciones.
- **`pnpm test`: 125 pruebas pasan**: 70 API, 38 Geo y 17 web. **15 se omiten**: 4 de integración con PostgreSQL y 11 contra servicios en vivo. No se configuraron esas conexiones para esta revisión.
- Se reprodujo la diferencia de prioridades usando las funciones compiladas del motor y el mismo fixture de su suite. Se comprobó en el código que la pantalla solo reordena las alternativas recibidas.
- La evidencia guardada del 14 de noviembre documenta Compose limpio y NASA real: [verificación previa](pendientes-verificacion.md) y [datos registrados](verification/pendientes-live.json). Esa evidencia reporta dos meses NDVI faltantes en Coahuila; **no es una consulta nueva realizada en esta revisión**.
- H2/H3/H4, la validación visual completa y el ensayo de demo siguen pendientes según las tareas del repositorio. Las pruebas actuales en verde no cubren todas las diferencias de integración señaladas.
- No se realizó una prueba con hardware: no hay firmware ni rutas de dispositivos/lecturas en el código de aplicación revisado. No se modificó código de negocio, configuración ni datos existentes.
