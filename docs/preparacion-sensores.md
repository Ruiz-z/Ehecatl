# Preparación de sensores sin hardware

Entrega autorizada el 15 de noviembre de 2026. Punto de retorno: `c51dd4c` en `origin/fix/pendientes-equipo`.

## Qué está preparado

- Seleccionar y crear zonas; conservar la selección entre pestañas.
- Prioridades que calculan nuevas alternativas en el servidor sin guardar automáticamente; admin puede explorar sin sobrescribir preferencias del dueño.
- Panel Sensores con dispositivos, fechas, origen, configuración y claves para admin; historial paginado con gráfica por dispositivo para dueño/admin. «Actualizar» consulta de nuevo el estado y las muestras.
- Recepción del ADC del FC28, temperatura/humedad del DHT11 y ADC experimental del MQ2. Sin calibración se conserva crudo e índice nulo.
- Validación, reintentos sin duplicados, límites de tamaño y tasa. Claves guardadas con hash, visibles una sola vez al emitirlas.
- Metadatos NASA conservados, ingreso por categorías explícitamente estimadas y mensajes sin cultivos viables corregidos.

No se incluyen comandos, bomba, eventos de riego ni servos. MQ2 no equivale a ppm o calidad del aire validada. La comparación NASA/campo y avisos agronómicos requieren periodos equivalentes y H4; se muestran pendientes y no modifican confianza. Siete días de campo no validan automáticamente una comparación con datos mensuales.

## Arranque

Con el `.env` ya configurado:

```sh
docker compose up --build
```

La imagen aplica la migración aditiva de dispositivos/lecturas. Se conserva el restablecimiento existente de perfiles demo al arrancar. No ejecutar `down -v` sobre una base que se quiera conservar.

En desarrollo local, aplicar la migración antes de iniciar:

```sh
pnpm --filter api exec prisma migrate deploy
pnpm dev
```

El front debe usar `NEXT_PUBLIC_USE_MOCKS=false` y una URL de API alcanzable por el navegador. Estas variables públicas se fijan al compilar. No se modifican automáticamente los `.env` personales.

## Prueba sin ESP32

1. Entrar como administrador, abrir una parcela, elegir zona y abrir «Sensores».
2. Registrar un dispositivo con origen **Simulador · datos de ejemplo**. Dejar calibración vacía mientras no existan mediciones del montaje. El origen no se cambia después.
3. Copiar la clave y guardarla solo localmente. Nunca en Git, URLs o argumentos de consola compartidos. El servidor no permite volver a consultarla.
4. Definir `DEVICE_API_KEY` en el entorno de una terminal privada o en `apps/api/.env` (ignorado por Git) y ejecutar:

```sh
pnpm --filter api sensors:simulate
```

El programa verifica que el dispositivo sea `SIMULATED` antes de enviar. Una clave REAL provoca la salida sin registrar muestras.

| Variable opcional | Valor por defecto | Uso |
|---|---|---|
| `SIMULATOR_API_URL` | `http://localhost:3001` | HTTPS fuera de localhost. |
| `SIMULATOR_COUNT` | `5` | 1–10000 muestras. |
| `SIMULATOR_INTERVAL_MS` | `5000` | Intervalo, mínimo 1000 ms. |
| `SIMULATOR_SOIL_RAW` | `1800` | ADC de ejemplo; debe caber en la calibración si existe. |

Reintenta la misma muestra con el mismo identificador y fecha. La cola está en memoria: interrumpir el proceso no conserva pendientes. El firmware real deberá definir recuperación tras reinicios.

5. Pulsar «Actualizar». Verificar «Datos de ejemplo», fechas de medición/recepción y ADC. Sin calibración no se inventa porcentaje.
6. Probar otra zona, acceso como agricultor, nueva clave y revocación. Una clave revocada recibe 401; el historial permanece.

Para el ESP32, registrar otro dispositivo **REAL** y usar el [firmware adaptado y la guía para la misma red local](../firmware/README.md), que implementa el [contrato](contracts.md#preparación-de-sensores-v1--2026-11-15). El envío anterior `humidity`/`temperature` y la respuesta `REGAR` no son compatibles. No reutilizar las credenciales compartidas de SmartRiego. La bomba sigue pendiente y no se activa desde este firmware.

## Calibración y frescura

El FC28 es resistivo. Registrar ADC seco/húmedo del montaje y profundidad. Cada lectura conserva su versión de calibración; cambiarla no reescribe historial.

`(ADC - seco) / (húmedo - seco)` es un índice relativo 0–1, no contenido volumétrico ni porcentaje NASA. Fuera del intervalo se rechaza sin recortar. Antes de calibrar se aceptan ADC y variables de aire.

Intervalo esperado de 300 segundos por defecto. En línea hasta tres intervalos desde la medición más reciente; recibir datos antiguos no los hace frescos. Reasignar reinicia frescura en la nueva zona y conserva el historial en la original.

## Retención y operación

- `READINGS_MAX_AGE_HOURS=168`: antigüedad admitida; fechas futuras rechazadas. Reintentos de muestras ya guardadas confirman sin duplicar.
- Máximo 4 KiB por JSON y 60 solicitudes/minuto por dispositivo. Limitador en memoria para la instancia única de Compose; varias réplicas requieren coordinación compartida.
- `READINGS_RETENTION_DAYS=90`: limpieza explícita, mínimo siete días. Tras compilar API, `pnpm --filter api readings:prune` elimina lecturas anteriores al periodo configurado en la base indicada. No se ejecuta automáticamente ni cambia claves.
- Consulta máxima de 31 días y 200 filas/página; el panel muestra últimos 1, 7 o 30 días y permite cargar páginas anteriores.

## Verificación

| Requisito | Verificación |
|---|---|
| Spec 007 RF-1 a RF-3 | Rol admin, hash sin exposición, rotación/revocación y reasignación en pruebas con PostgreSQL. |
| RF-4 | Estado por fecha de medición, umbral exacto de tres intervalos y recepción atrasada en pruebas de frescura. |
| RF-5 a RF-7 | Rangos/fecha/crudo, calibración nullable/versionada, límites e idempotencia concurrente. |
| RF-8 | Dueño/admin, páginas sin repetir registros, cursor de otra zona rechazado. |
| RF-13, preparación | Medición/recepción separadas, antigüedad del dispositivo y metadatos por indicador NASA; comparación posterior. |
| RF-15 y RF-19 | Confirmación sin órdenes; simulador rechaza dispositivo REAL y conserva marca SIMULATED en API/pantalla. |
| Spec 005 RF-5/RF-9 y spec 006 RF-5 | Cambio de prioridades produce nuevas alternativas sin modificar preferencias; prueba HTTP y navegador. |
| Specs 002/006 | Selección de zona sin sustituir IDs inválidos, navegación conservada y permisos. |

Resultados de cierre en `docs/registro-cambios.md` y [evidencia de navegador](verification/sensors-ui.json). Ensayos con base aislada sin modificar la base de la aplicación. Montaje, calibración real, comparación y validación agronómica siguen pendientes.
