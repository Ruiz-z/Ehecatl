# Revisión del firmware recibido para ESP32

Fecha: 15 de noviembre de 2026. Complemento del [reporte de conformidad](reporte-revision-esp32.md).

**Actualización de integración:** el usuario entregó otra copia funcional de sensores y confirmó conexión en la misma red. El [firmware adaptado a Ehécatl](../firmware/README.md) conserva los pines del montaje, utiliza el contrato v1 y agrega riego solo manual según la autorización actual. El montaje físico sigue pendiente. Los hallazgos siguientes corresponden a los programas originales de SmartRiego; la verificación del nuevo firmware se registra en `registro-cambios.md`. No se incorporan las credenciales recibidas.

Se revisaron las dos versiones entregadas por el usuario como referencia de SmartRiego. Se excluyen los servos y sus funciones, como pidió el usuario. No se copiaron los programas originales al repositorio porque contienen credenciales. Esta es una revisión estática: no se compilaron ni se cargaron a una placa.

## Versión actual: un punto de medición y una bomba

El segundo archivo tiene 241 líneas, frente a 395 del primero. Reduce el montaje a un DHT11, una entrada de suelo, un MQ2, una bomba y una clave. **Es una base más sencilla para la primera integración, pero todavía conserva el contrato y las decisiones de riego de SmartRiego.**

El usuario confirmó que instalará **FC28 de dos puntas**. Los comentarios del nuevo archivo que dicen «sensor capacitivo» deben corregirse; esa etiqueta no cambia el sensor real ni sustituye su calibración. Se mantiene el FC28 en el plan del proyecto.

### Qué mejoró respecto al primer archivo

| Cambio | Resultado |
|---|---|
| Un punto de suelo y una clave de dispositivo. | Más sencillo de asociar a una zona de Ehécatl. No reemplaza la necesidad del proyecto de admitir varias zonas. |
| La condición de encendido ahora incluye `servidorDiceRegar`. | La bomba sí consulta el permiso guardado; en el primer archivo esa decisión no controlaba la bomba. Esto no demuestra que el permiso sea reciente o que venga de Ehécatl. |
| Se retiró la entrada analógica de agua. | Ya no hay etiquetas contradictorias GPIO25/GPIO36; tampoco hay medición de agua o caudal en esta versión. |
| Arranque con llamada a `apagarBomba()`. | Ordena nivel LOW al arrancar. Comprobar en el montaje si LOW corresponde a apagado: depende de la etapa de potencia o relé utilizado. |

### Qué sigue pendiente en esta versión

1. **El envío sigue siendo incompatible con la propuesta de Ehécatl.** `enviarLectura()` manda únicamente `humidity` y `temperature` (líneas 72–73). No envía `humAire`, MQ2, fecha de medición ni valor ADC crudo. Acordar los campos de la spec 007, agregar recepción en la API y registrar el dispositivo antes de cambiar la dirección del servidor. No existen todavía `/readings` ni `/irrigation-events` en Ehécatl.
2. **El FC28 sigue sin calibración real.** La línea 215 mapea 4095 a seco y 0 a húmedo. Registrar extremos medidos para el FC28 instalado, conservar ADC y convertir a la escala acordada. `UMBRAL_SUELO=2500` es un umbral fijo de demostración; no debe presentarse como necesidad de riego validada por cultivo.
3. **La bomba puede regar sin una respuesta válida.** `servidorDiceRegar` empieza en `true` (línea 49). Si no hay WiFi, la clave es rechazada o el servidor falla, no se actualiza. Si el suelo supera el umbral y se activa el sistema, puede encender. Una respuesta antigua `REGAR` tampoco caduca. El resultado se busca como texto literal: un JSON equivalente con espacios puede no reconocerse. Si se desarrolla riego en otra fase, definir permiso válido, vigencia y apagado ante fallos; no interpretar silencio como autorización.
4. **La duración registrada continúa equivocada.** Enciende cinco segundos (línea 229) y reporta un minuto (línea 234). Definir y registrar la duración real en una unidad que la represente, sin redondearla para satisfacer un contrato anterior.
5. **Se mantienen las esperas y el botón por nivel.** Durante los cinco segundos de `delay()` no se comprueba el botón; los POST también ocupan el mismo recorrido del programa. Una pulsación larga puede alternar varias veces el estado cada 400 ms. Usar temporizadores, límites de red y detección de una pulsación nueva. Si se conserva riego, definir máximo acumulado y espera entre ciclos: ahora puede repetir mientras siga seco.
6. **No valida fallos del DHT11 ni reenvía lecturas perdidas.** Añadir comprobación de números finitos, estado de cada sensor, cola limitada e identificador por lectura. Mantener la fecha original al reenviar y no inventar cero cuando el DHT falle.
7. **La protección ante caída de voltaje sigue desactivada.** La línea 142 mantiene `WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0)`. Resolver alimentación y motor, conservando esa protección. También sigue pendiente revisar el botón en GPIO12 según la placa real.

El programa sigue midiendo y enviando con `sistemaActivo=false`; la pausa solo evita llegar a la lógica de riego. El panel local debe explicar esa diferencia. La humedad del aire y el MQ2 se muestran localmente, pero todavía no llegan a Ehécatl.

### Qué adaptar primero

Para una primera entrega alineada con la spec 007: **FC28 + DHT11 → ESP32 → recepción y almacenamiento en Ehécatl → pantalla de su zona**. Acordar payload, calibración, fecha y confirmación; emitir una clave nueva; agregar validación y reintentos. MQ2 puede incorporarse después de definir sus campos y significado.

La revisión histórica no autorizaba actuación. La spec 007 RF-15 y RF-20 a RF-23 ahora permiten exclusivamente órdenes manuales separadas de las lecturas. El riego automático sigue prohibido.

Se volvió a ejecutar la suite del proyecto: revisión de código en verde con caché de Turbo y 125 pruebas correctas, con 15 omitidas por falta de conexiones configuradas. No son pruebas del ESP32. El destino remoto y las credenciales de SmartRiego no se utilizaron; su traslado a Ehécatl sigue pendiente de configuración y renovación de claves.

## Primera versión: revisión histórica

Lo que sigue describe exclusivamente el primer archivo, de tres puntos de suelo. Sus diferencias con la versión más reciente están aclaradas arriba; en particular, la bomba de la versión actual sí consulta `servidorDiceRegar` y ya no existe la entrada de agua.

### Resultado de la primera versión

**Se puede reutilizar la lectura de sensores, el promedio de varias muestras y la conexión WiFi. El envío de datos y la lógica de la bomba necesitan adaptación.** Cambiar solo la dirección del servidor no basta: Ehécatl todavía no implementa las rutas de dispositivos, lecturas ni eventos de riego.

El programa confirma que se usa DHT11 y que hay tres entradas de humedad de suelo, un MQ2 y una entrada analógica de agua. No demuestra por sí solo que los tres sensores estén instalados ni que exista medición de caudal.

## Qué lee y qué envía realmente

| Dato | Lo lee | Lo envía al servidor |
|---|---|---|
| Temperatura del aire, DHT11 | Sí | Sí, con el nombre `temperature`. |
| Humedad del aire, DHT11 | Sí | No; solo se muestra localmente. |
| Humedad de suelo de tres puntos | Sí | Sí, como `humidity`, en porcentaje calculado sin calibración de campo. |
| Gas/humo, MQ2 | Sí | No; solo se muestra localmente. |
| Sensor de agua | Sí | No; solo se muestra localmente. |
| Caudal o litros reales | No hay cálculo ni lectura de caudal en este programa. | No. |

Las tres lecturas enviadas comparten la temperatura de un mismo DHT11. Eso puede representarse como sensor ambiental compartido si corresponde a la instalación; no deben contarse como tres mediciones ambientales independientes.

## Cambios necesarios para conectar con Ehécatl

| Lo que hace ahora | Lo que debe cambiar |
|---|---|
| Envía `humidity` y `temperature`. | Alinear con la propuesta: `soilMoisture`, `airTemperature`, `airHumidity` y `measuredAt`. Definir también el campo del valor crudo y las unidades antes de implementar. |
| Convierte todo el intervalo ADC 0–4095 a 0–100 %. | Calibrar cada FC28 con el suelo y alimentación reales. El intervalo electrónico no representa por sí mismo suelo seco y saturado. Si el contrato adopta 0–1, convertir a esa escala sin presentarla como una medida física equivalente a NASA. |
| No comprueba si falló la lectura DHT11. | Validar números finitos antes de construir JSON. Si falla una variable, omitirla y marcar el fallo; no enviarla como cero ni reutilizarla con fecha nueva. La biblioteca DHT de Adafruit puede devolver `NaN` al fallar. |
| Envía tres solicitudes con tres claves. | Registrar tres dispositivos lógicos si realmente son tres puntos distintos, asociarlos a sus zonas y emitir claves nuevas desde Ehécatl. No trasladar las claves de SmartRiego. |
| Espera una decisión `REGAR`/`ESPERAR`. | En la propuesta de Ehécatl, `POST /readings` solo confirma recepción. Definir código de éxito y confirmación; retirar esa dependencia de decisiones de riego. |
| Descarta el envío si no hay conexión o falla HTTP. | Añadir una cola limitada, reintentos con espera progresiva e identificador de lectura. Conservar la fecha original; al recuperar conexión, evitar duplicados. |
| Ejecuta los POST dentro del mismo recorrido del programa. | Configurar límites de conexión y respuesta. Organizar lectura, red y control como tareas o estados para que una red lenta no retrase el botón o el apagado. |
| Usa una dirección HTTP de SmartRiego. | Configurar el destino de Ehécatl y HTTPS con certificado validado cuando salga a internet. El comentario del firmware reporta aislamiento entre equipos WiFi: comprobar la red real, porque estar en la misma WiFi no garantiza acceso por IP local. |

La propuesta de campos todavía está en borrador; esta tabla no significa que las rutas ya estén disponibles. MQ2 y agua requieren ampliar el contrato si se desea almacenarlos. Identificar el sensor de agua antes de decidir si su valor significa presencia, nivel u otra variable.

Referencias técnicas: [código de la biblioteca DHT de Adafruit](https://github.com/adafruit/DHT-sensor-library/blob/master/DHT.cpp), [opciones de timeout de HTTPClient para ESP32](https://github.com/espressif/arduino-esp32/blob/master/libraries/HTTPClient/src/HTTPClient.h) y [cliente HTTPS de Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html). Las versiones de bibliotecas del archivo recibido no están especificadas; habrá que fijarlas al preparar la compilación.

## La bomba tiene problemas concretos que deben resolverse

1. **Se activa automáticamente por un valor fijo de suelo.** Si `valP2 >= 2500`, enciende cinco segundos y espera otros tres. Si el sensor sigue seco, puede repetir el ciclo mientras el sistema esté activo. No hay un máximo acumulado de riego ni espera por absorción definida. La decisión recibida del servidor no controla esta bomba.
2. **El historial registra una duración incorrecta.** La bomba funciona cinco segundos, pero `enviarEventoRiego(1, ...)` declara un minuto. No se debe redondear un evento para satisfacer un contrato. Si se amplía el producto a riego, definir duración real en segundos o milisegundos y distinguir orden enviada, activación y flujo confirmado.
3. **El botón no se atiende durante las esperas.** El programa usa `delay(5000)` y otras esperas; durante ellas no vuelve a comprobar el botón ni a atender la web local. Cambiar a temporizadores con `millis()` y estados de bomba; si se conserva riego, el apagado debe tener prioridad sobre red y medición.
4. **Mantener pulsado el botón puede cambiar el estado varias veces.** Se comprueba el nivel del botón cada 400 ms, no una pulsación nueva. Detectar el cambio de estado con antirrebote para que una pulsación produzca una sola acción.
5. **No hay medición real de flujo.** `analogRead()` sobre el sensor de agua no calcula litros/minuto. Si el caudalímetro disponible usa pulsos, agregar contador de pulsos y calibración; si usa otra interfaz, implementar la correspondiente. El estado de una salida digital no demuestra que circuló agua.

La spec 007 RF-15 prohíbe accionar riego. El firmware recibido ya contiene actuación local automática, por lo que conservarla como parte de Ehécatl requiere definir ese cambio de alcance. Para la primera integración propuesta, reutilizar la medición y el envío, dejando el control de bomba fuera del flujo de decisiones de la aplicación. Una demostración independiente de la bomba no debe presentarse como control aprobado por NASA o por el motor de cultivos.

## Detalles del montaje que ahora se pueden precisar

- **Pines:** humedad de suelo en GPIO35/34/32, MQ2 en GPIO33 y agua en GPIO36. En un ESP32 clásico corresponden a ADC1, lo que evita compartir ADC2 con WiFi. Confirmar la variante real antes del cableado. La [documentación ADC de Espressif](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32/api-reference/peripherals/adc_oneshot.html) describe la selección de canales y el uso compartido de ADC2.
- **Error de etiqueta:** el código usa GPIO36 para agua, pero varios comentarios y el mensaje serial dicen GPIO25. Corregir las etiquetas para que coincidan con el circuito.
- **Botón en GPIO12:** en el ESP32 clásico ese pin participa en la selección del voltaje de la memoria al arrancar. Revisar el circuito o elegir un pin que no intervenga en el arranque. No se afirma que el montaje actual ya falle: depende de la placa y de cómo esté conectado. [Referencia de arranque](https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/boot-mode-selection.html).
- **Protección de alimentación desactivada:** `WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0)` apaga el detector de caída de voltaje. Retirar esa desactivación y resolver la alimentación si el motor produce reinicios. El detector existe para reiniciar cuando el voltaje deja de ser adecuado. [Referencia de Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/fatal-errors.html#brownout).
- **La bomba requiere una etapa de potencia:** el código no permite comprobar si ya existen transistor/controlador, protección del motor y alimentación suficiente. Verificarlos antes de probar la bomba; no se puede deducir el circuito a partir de `digitalWrite()`.
- **Pausado no significa sin mediciones:** el programa sigue leyendo y enviando cuando `sistemaActivo` es falso; la pausa solo evita la actuación. Ese comportamiento puede servir para monitoreo, pero la pantalla debe decirlo claramente.

## Credenciales y alcance de la validación

El archivo recibido contiene contraseña WiFi y tres claves de dispositivo en texto plano. Si siguen vigentes, cambiar la contraseña y revocar o regenerar esas claves antes de reutilizarlas. En una futura carpeta de firmware, versionar una configuración de ejemplo y mantener la configuración real ignorada por Git. No se han probado las claves, contactado el destino SmartRiego ni copiado sus valores a estos documentos.

Las comprobaciones del proyecto siguen pasando: `pnpm lint` pasa con caché de Turbo y `pnpm test` ejecuta de nuevo 125 pruebas correctas, con 15 omitidas por falta de conexiones configuradas. **Estas pruebas no validan el firmware.** No se detectaron herramientas Arduino CLI/PlatformIO en el entorno; faltan placa, versiones de librerías y ensayo físico para confirmar compilación y comportamiento.

## Cierre de software del punto de bomba: riego solo manual

La constitución y la spec se actualizaron antes del código. Se retira la decisión automática por humedad del diseño de integración. El firmware consulta órdenes manuales con clave propia y aplica tope de 30 segundos, cinco minutos desde apagado y exclusión de riegos. La salida arranca apagada con polaridad configurable. Una tarea independiente de sensores y HTTP corta por WiFi, expiración o credencial rechazada. Reiniciar apaga y no recupera órdenes. También espera cinco minutos tras el arranque y rechaza órdenes anteriores a este.

La prueba C++ usa la misma máquina de estados y parser que el sketch. Cubre tope, enfriamiento, WiFi, vencimiento, reinicio, exclusión, desbordamiento del contador y contrato sin bibliotecas nuevas. API con JWT por dueño o administrador, entrega atómica por clave, cancelación pendiente, auditoría e historial marcado. Verificación detallada y límites de lo observado en `registro-cambios.md`.

El punto de software queda implementado. El punto de hardware permanece abierto: relé o MOSFET, alimentación separada, protección inductiva, polaridad y prueba supervisada sin agua. No se conectó ni se ejecutó nada contra hardware. La compilación de C++ no demuestra que el relé esté apagado físicamente. El riego automático está prohibido.
