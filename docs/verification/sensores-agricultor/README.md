# Verificación de Sensores para el agricultor

Fecha: 2026-11-15. RF-14 de spec-006. Rama `feat/sensores-agricultor`.

## Entorno

Docker Compose con PostgreSQL, API y web reales. Solo se reconstruyó web. Playwright con Chromium aislado. Parcela temporal en lat/lon 0, 0 y dispositivos SIMULATED creados exclusivamente para esta prueba; lecturas enviadas por el simulador existente. No se usaron interceptores de respuestas ni datos NASA falsos.

La cuenta agricultora y la administradora inician sesión con el API. El script lee la contraseña desde `.env`, no la imprime ni la guarda en evidencias. Elimina la parcela temporal al terminar.

## Capturas

| Estado | 1440 px | 390 px |
|---|---|---|
| Sin sensor | [Escritorio](sin-sensor-1440.png) | [Móvil](sin-sensor-390.png) |
| En línea sin calibrar | [Escritorio](en-linea-sin-calibrar-1440.png) | [Móvil](en-linea-sin-calibrar-390.png) |
| Calibrado | [Escritorio](calibrado-1440.png) | [Móvil](calibrado-390.png) |
| Sin señal | [Escritorio](sin-senal-1440.png) | [Móvil](sin-senal-390.png) |

Las capturas de escritorio muestran la posición inicial del panel con scroll propio. En móvil se captura la página completa. La cartografía externa no cargó imagen satelital en esta ejecución; no se verificó ese servicio.

## Comprobaciones

Los resultados de navegador se guardan en `verificacion.json`. Se comprueban los ocho casos de estado/ancho, ausencia de desbordamiento horizontal y de jerga en el texto visible de Sensores. El agricultor no tiene el desplegable de administración. Abrir todas las lecturas conserva ocultos los términos técnicos hasta abrir «Ver todos los datos».

Calibración desde la interfaz administradora con seco 3000 y húmedo 1000, ambos provenientes de lecturas reales del simulador. Se comprueba el PATCH y su persistencia; una lectura posterior de 1800 muestra 60 %. El punto seco permanece al actualizar lecturas. El riego se solicita desde la interfaz con confirmación y 10 s; se observa Orden enviada, Regando… y Terminó, y se comprueba DONE con 10 s en el API. Para «sin señal» se espera el vencimiento real de tres intervalos de 30 s; el botón queda deshabilitado. Sin sensor también queda deshabilitado.

Se prueban los botones de variable y periodo. La tierra sin calibrar muestra explicación y no crea una gráfica vacía. Las funciones de administrador se comprueban con dispositivos temporales; no se accionan bombas ni se cambian claves de dispositivos existentes.

## Comandos

`pnpm lint`, `pnpm test` y `pnpm --filter web build` pasan. Node 24.22.3 y pnpm 10.34.9, con rutas temporales para las cachés porque el entorno restringe escritura fuera del repositorio y `/tmp`. El primer intento con pnpm global falló al abrir su caché; no fue un fallo del código.

- Web: 69 tests correctos, incluidos seis de summary.
- API: 147 correctos y 24 omitidos; seis correctos adicionales del simulador.
- Geo: 39 correctos y cinco omitidos.

Las integraciones omitidas no se ejecutaron. No se probó un ESP32 físico, una bomba real, lector de pantalla ni todos los fallos posibles del dispositivo. El API no proporciona un motivo para FAILED; la web conserva el estado sin inventarlo. Los controles del servidor y el firmware no se modificaron.

Para repetir, con Docker ya en marcha y Playwright disponible en el entorno:

```sh
PLAYWRIGHT_MODULE=/ruta/al/playwright/index.mjs \
PLAYWRIGHT_CHROMIUM=/ruta/al/chromium \
node docs/verification/sensores-agricultor/verificar.mjs
```

El script crea y elimina datos temporales y requiere las cuentas demo existentes. No instala dependencias.
