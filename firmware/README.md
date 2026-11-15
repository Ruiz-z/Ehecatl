# ESP32 conectado a Ehécatl

Adaptación del programa recibido para **DHT11, FC28 resistivo de dos puntas y MQ2**. GPIO18 permite riego solo manual. El riego automático sigue prohibido. La polaridad es configurable y el montaje está pendiente. No incluye servos. La página local conserva el monitoreo, con la marca Ehécatl, sin porcentajes de suelo inventados ni alarmas de gas sin validar.

## 1. Preparar la aplicación en la misma red

1. Iniciar Ehécatl con su configuración habitual (`docker compose up --build`). La API ya escucha en `0.0.0.0:3001`; aplica también la migración nueva de órdenes de riego.
2. Consultar `ipconfig` en la computadora. Usar la **IPv4 del adaptador conectado a la misma red que el ESP32**, por ejemplo `192.168.1.100`. No usar `localhost`, la IP del contenedor, una VPN ni el ejemplo sin sustituirlo.
3. Desde otro equipo de esa red, abrir `http://IP_DE_LA_COMPUTADORA:3001/health`. Debe devolver una respuesta correcta. Si no llega, revisar el perfil de red privada del firewall y el aislamiento de clientes del router/hotspot. No es necesario publicar el puerto en internet.
4. Entrar como administrador, abrir parcela → zona → Sensores → Registrar dispositivo y elegir **ESP32 real**. Poner el intervalo esperado en **300 segundos**, igual al firmware. Dejar la calibración vacía hasta medirla en el montaje.
5. Guardar la nueva API key mostrada una sola vez. Una key de SmartRiego no sirve para Ehécatl. Cada ESP32 debe usar su propio dispositivo y clave.

## 2. Configurar y cargar

Abrir `ehecatl-esp32/ehecatl-esp32.ino` en Arduino IDE. Se reutilizan el soporte **esp32 de Espressif** y **DHT sensor library de Adafruit**, usados por el programa original; esta última utiliza Adafruit Unified Sensor. No se añade ArduinoJson ni se modifican las dependencias de la aplicación.

Copiar `ehecatl-esp32/config.example.h` como `ehecatl-esp32/config.h`. Completar solo en ese archivo:

- `EHECATL_WIFI_SSID` y `EHECATL_WIFI_PASSWORD`: red de 2.4 GHz del ESP32.
- `EHECATL_API_BASE_URL`: `http://IP_DE_LA_COMPUTADORA:3001`, sin `/readings` ni barra final.
- `EHECATL_ALLOW_PRIVATE_HTTP`: `true` para esta prueba en la misma red privada. El programa solo admite HTTP hacia IPv4 privadas; no sigue redirecciones. HTTPS requiere la CA real del servidor en `EHECATL_ROOT_CA`.
- `EHECATL_DEVICE_API_KEY`: clave nueva del dispositivo **REAL** de Ehécatl.
- `EHECATL_SEND_INTERVAL_SECONDS`: 300 por defecto, entre 30 y 86400. Ajustar también el intervalo esperado en la aplicación si se cambia.
- Servidores NTP: los valores por defecto requieren salida a internet por UDP 123. Una API local no proporciona hora. Si la red no permite NTP público, configurar un servidor NTP local accesible; sin hora válida no se transmiten mediciones.

`config.h` está ignorado por Git. No pegar claves en el sketch, en capturas, en el monitor serie ni en el README. El código sin archivo privado compila para revisión, pero no envía datos.

Seleccionar la placa y el puerto de su montaje en Arduino IDE. Los pines se conservan del código recibido y corresponden a un **ESP32 clásico**; confirmar el modelo antes de usar otra variante. Compilar y cargar. Abrir el monitor serie a **115200**.

| Elemento | Pin conservado | Dato enviado |
|---|---|---|
| DHT11 | GPIO27 | Temperatura del aire en °C y humedad relativa en %. |
| FC28 de dos puntas | GPIO35 | `soilMoistureRaw`, ADC de 12 bits, 0–4095. |
| MQ2 | GPIO33 | `mq2Raw`, ADC experimental de 12 bits, sin conversión a ppm. |
| Botón a GND | GPIO12, `INPUT_PULLUP` | Activa/pausa nuevas muestras para la API. |
| Bomba manual | GPIO18 | Salida apagada al arrancar según polaridad configurada. |

Mantener la bomba desconectada durante esta prueba. Configurar `EHECATL_PUMP_ACTIVE_LEVEL` en 1 para activo en HIGH o 0 para activo en LOW. El nivel contrario se escribe antes de habilitar la salida. Comprobar la polaridad con la bomba desconectada. Las entradas ADC del ESP32 no deben recibir 5 V: comprobar el voltaje de las salidas de los módulos antes de conectarlas. GPIO12 interviene en el arranque del ESP32 clásico; conservar su cableado revisado y no forzarlo a HIGH al encender.

## 3. Comprobar que llegan datos

1. Al conectar WiFi, el monitor serie muestra la IP de la página local del ESP32. Abrirla en un navegador de la misma red. Las lecturas locales se actualizan cada dos segundos y se muestran aunque el envío esté pausado.
2. Pulsar y soltar GPIO12. El envío empieza con la siguiente lectura válida y después se repite cada 300 segundos. Mantener pulsado no alterna el estado repetidamente.
3. Esperar `[API] HTTP 200`. Solo confirma recepción. El programa no busca `REGAR`/`ESPERAR` ni llama a `/irrigation-events`.
4. En Ehécatl → la misma zona → Sensores, pulsar **Actualizar**. Revisar origen **REAL**, fecha de medición/recepción, ADC del FC28, temperatura y humedad del DHT11 y ADC del MQ2. La pantalla actual no se actualiza automáticamente.
5. Medir ADC seco/húmedo y profundidad en el montaje; registrar esos valores desde la administración del dispositivo. El servidor calcula el índice relativo; no es humedad volumétrica ni equivale a GWETROOT. Valores fuera del intervalo calibrado reciben HTTP 400, sin recortarlos.

Si falla una variable del DHT11, se omite esa variable y se siguen enviando los ADC y el resto de datos válidos. No se mandan `NaN`, ceros inventados ni porcentajes calculados con 4095/0 como falsa calibración.

## Conexión interrumpida y errores

- Red en una tarea separada, con tiempos límite HTTP; botón, DHT y página local siguen funcionando mientras se espera una respuesta.
- Hasta ocho muestras en cola y una pendiente en RAM. Sin conexión se conservan ID, fecha y JSON al reintentar; si se pierde la confirmación, la API reconoce el duplicado y no crea otra fila. Cola llena: se omite la muestra nueva y se informa en Serial y página local.
- Reiniciar o perder alimentación **pierde los pendientes**. Este firmware no graba historial en flash ni recupera muestras anteriores al arranque. Tras reiniciar, espera hora fiable y el botón para crear nuevas muestras.
- Errores de red, 408/425/429 y 5xx: reintento de la misma muestra tras 5, 10, 20, 40 y después 60 segundos. Una nueva muestra no sustituye el contenido de la pendiente.
- 401/403: se suspende la transmisión. Revisar clave, revocación o rotación en Ehécatl, corregir `config.h`, volver a cargar y reiniciar.
- Otros códigos, incluidos 400/404/409/413 y redirecciones: se informa y descarta esa muestra. Revisar hora, URL o calibración según el código y los logs de la API. Solo HTTP 200 se cuenta como confirmado. No se imprime la clave ni el cuerpo de respuesta.
- Pausar con el botón detiene la creación de nuevas muestras para envío; las que ya estaban pendientes terminan de entregarse. Los sensores y la vista local continúan.

## Pruebas sin hardware

`tests/telemetry.test.cpp` ejecuta el mismo generador JSON y las mismas reglas de reintentos, botón y destino LAN que el sketch. Compilar con un compilador C++17, por ejemplo:

```sh
c++ -std=c++17 -Wall -Wextra -Werror firmware/tests/telemetry.test.cpp -o /tmp/ehecatl-telemetry-test
node firmware/tests/check-output.mjs /tmp/ehecatl-telemetry-test
pnpm lint
pnpm test
```

En Windows puede compilarse con MSVC desde su terminal de desarrollo (`cl /std:c++17 /EHsc /utf-8 firmware/tests/telemetry.test.cpp`, colocando los binarios fuera del repositorio) y pasar la ruta del `.exe` a `check-output.mjs`. Las pruebas de API consumen el mismo fixture `docs/fixtures/esp32-readings.json`, incluso con variables de aire ausentes. Los cuatro ejemplos son casos independientes, no cuatro envíos con el mismo ID.

Para comprobar la compilación completa, con el SDK y la biblioteca DHT instalados:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/ehecatl-esp32
```

La compilación utiliza el perfil genérico **ESP32 Dev Module** hasta confirmar el modelo exacto. Se comprobó con Arduino-ESP32 **3.3.12**, DHT **1.4.7** y Adafruit Unified Sensor **1.1.15**. Compilar no verifica el cableado ni equivale a una prueba física.

Referencias: [instalación de Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html), [API WiFi](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html), [DHT de Adafruit](https://github.com/adafruit/DHT-sensor-library). La comparación NASA/campo y los avisos agronómicos siguen pendientes. El riego automático está prohibido.

## Riego manual autorizado

Actualizar la copia privada `config.h` desde la plantilla. `EHECATL_UNUSED_PUMP_PIN` ahora es `EHECATL_PUMP_PIN`. Agregar las tres constantes nuevas de bomba. No copiar credenciales a la plantilla.

- `EHECATL_PUMP_PIN`: GPIO18.
- `EHECATL_PUMP_ACTIVE_LEVEL`: 0 o 1. Es obligatorio verificarlo en el montaje.
- `EHECATL_PUMP_MAX_SECONDS`: 30. `EHECATL_PUMP_COOLDOWN_SECONDS`: 300. La compilación rechaza otros valores; la máquina aplica los límites independientemente de la API.

Sensores permite elegir 10, 20 o 30 segundos y confirmar. La API valida acceso, señal, exclusión y enfriamiento. El ESP32 consulta cada cinco segundos en la tarea de red, con tiempos límite. No recibe conexiones entrantes para regar. El botón físico solo pausa lecturas; no acciona ni detiene la bomba.

Una tarea independiente controla la salida. Al perder WiFi, recibir rechazo de credencial o vencer la orden, apaga y reporta FAILED con segundos transcurridos. Al completar reporta DONE. El sondeo puede demorarse mientras hay una solicitud HTTP; el apagado no depende de ella. No se interpretan lecturas como permisos de riego.

Tras arrancar espera cinco minutos y rechaza órdenes creadas antes del arranque. La API nunca vuelve a entregar una orden entregada. Reiniciar pierde el reporte RAM; la API cierra una orden entregada sin reporte como FAILED después de vencer, con duración real desconocida. El historial no inventa segundos. La página local muestra bomba y última orden. No hay riego automático, horarios, caudal ni varias bombas.

## Simulador sin hardware

Registrar un dispositivo SIMULATED, guardar su clave en el entorno privado y ejecutar:

```sh
SIMULATOR_IRRIGATION=true SIMULATOR_COUNT=60 pnpm --filter api sensors:simulate
```

Usar `DEVICE_API_KEY` y `SIMULATOR_API_URL` en el entorno. El simulador solo admite SIMULATED, marca las lecturas y reportes, consulta entre lecturas y espera la duración pedida sin accionar hardware. El historial conserva origen simulado. Para una orden nueva el simulador debe estar ejecutándose antes de crearla. No recupera órdenes anteriores a su inicio.

## Tareas humanas antes de conectar una bomba

No alimentar la bomba desde GPIO18 ni desde el pin de 3.3 V. Usar etapa de potencia con relé o MOSFET adecuado, alimentación separada y protección de carga inductiva según el montaje. Verificar nivel lógico, aislamiento y tierra conforme al módulo usado. Mantener activada la protección de baja tensión del ESP32.

Primero comprobar arranque apagado y polaridad con la bomba desconectada. Después probar sin agua, con supervisión, duración, corte de WiFi y reinicio. Este repositorio no verifica corriente, alimentación, cableado, polaridad física ni caudal. No se ejecutaron pruebas contra hardware.
