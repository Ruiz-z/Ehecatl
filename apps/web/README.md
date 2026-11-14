# Ehécatl · interfaz web

Aplicación Next.js App Router, TypeScript estricto y Tailwind. Dirección visual en `docs/design.md`: paleta Zanahoria, Inter variable incluida localmente (licencia OFL en `src/shared/fonts/`), tema claro y mapa protagonista.

## Desarrollo y verificación

Desde la raíz del monorepo:

```sh
pnpm install
pnpm --filter web dev
pnpm lint
pnpm test
pnpm --filter web build
```

El servidor usa el puerto 3000. Si está ocupado: `pnpm --filter web dev --port 3016`. La prueba web usa `node:test` y el soporte de TypeScript de Node 24; no necesita otro framework.

## Recorrido de la demo

- `/login`: selección de Ana (Coahuila árido), James (Nevada con agua restringida) o Lucía (Entre Ríos húmedo).
- `/parcelas`: búsqueda, lista y pins, capas satélite/calles/NDVI, zoom y ubicación del dispositivo.
- `/parcelas/nueva`: ubicación por mapa o coordenadas globales; nombre, cultivo y riego. Guardado en el navegador.
- `/parcelas/el-mezquite`: estado y observaciones explicadas; desplegables con variable, fuente, fecha y origen.
- `?tab=datos`: cuatro series con promedio histórico, tooltip, rango de 6/12 meses y tabla accesible.
- `?tab=sembrar`: tres estrategias, comparación con mantener lo actual, ventanas de 24 meses, razones, riesgos, confianza y validación local. Prioridades al pie; acceso directo desde el riel.

El panel móvil se puede arrastrar desde el asa o expandir y reducir con su botón. Las rutas y pestañas tienen enlaces reales; no dependen de pestañas temporales en memoria.

## Estados reproducibles

| Perfil | Parcela / acción | Estado |
|---|---|---|
| Ana | La Esperanza | Sin datos; botón para cargar escenario de ejemplo |
| Ana | Cargar datos en La Esperanza | Skeleton durante la carga local |
| James | Silver Creek | Error parcial: omite humedad, mantiene otras fuentes, baja confianza y ofrece reintento |
| James | North Field → Qué sembrar | Sin ventanas viables |
| Cualquiera | Buscar un nombre inexistente | Lista vacía con acción para limpiar búsqueda |
| Cualquiera | Abrir una parcela de otro perfil | Parcela no disponible |

## Contratos y límites

Los contratos están en `features/parcels/types.ts`, `features/nasa/fixtures/observations.ts` y `features/rotation/types.ts`. Los datos están tipados en carpetas `fixtures/`. `rotation/ranking.ts` es puro: normaliza pesos, calcula puntajes 0–100 y deltas frente a la base; desempata por seguridad y nombre. Tiene tres pruebas para cambios de prioridad, pesos en cero y empates.

Esta entrega no llama a la API ni a NASA y no implementa autenticación real. El selector de perfiles es una sesión local de demostración. Se filtran las parcelas por perfil para mostrar el recorrido; esa separación no sustituye autorización del servidor. Los datos y secuencias son ilustrativos, se identifican en pantalla y no son recomendaciones agronómicas validadas. El clima de cada escenario pertenece al fixture del perfil; no se deduce del país ni de la latitud. Un punto nuevo puede tener cualquier lat/lon y cargar el escenario del perfil.

La base satelital es Esri World Imagery y la capa de calles es OpenStreetMap, ambas con atribución y conexión a internet. La miniatura satelital muestra el punto real, no un límite de parcela. La capa NDVI muestra círculos ilustrativos, no un raster NASA ni mediciones de un polígono. La UI y la fuente se sirven localmente; los mapas requieren red.

## Revisión visual

Capturas locales en `screenshots/` (ignoradas por Git): `login`, `parcelas`, `nueva`, `estado`, `datos`, `sembrar`, `sin-datos`, `error` y `sin-ventanas`, cada una a 1440 y 390 px. Se agregan vistas móviles expandidas, prioridades con ingreso dominante, skeleton y variantes de tablet.

Revisión con `general-design-review`, accesibilidad y craft: se aumentaron las explicaciones y leyendas, se compactó la cabecera de comparación, se corrigió la salida de sesión móvil, se ocultó la serie faltante al fallar la fuente y se agregó alternativa de botón al arrastre. La comparación se amplía sobre el mapa para mostrar las tres estrategias lado a lado en escritorio; en móvil se apilan. Las tramas del cultivo actual distinguen el ciclo vigente sin depender del color.

Verificado en Chromium con ChromeDriver: login, creación y persistencia local, perfiles separados, ranking reactivo, estado vacío, carga, error parcial, confianza, ausencia de ventanas, foco visible de teclado y ausencia de desbordamiento a 320/390/768/1024/1440 px. No equivale a una certificación WCAG ni a pruebas con lector de pantalla, dispositivo táctil físico o API integrada.

El gate automático de `taste-skill` no se considera aprobado: emitió `GATE: FAIL 20` en la raíz del monorepo, incluyendo reglas comerciales (hero, secciones de pantalla completa, `.wrap`, imágenes y animación de marketing) incompatibles con el login centrado de `docs/design.md`. Se corrigieron el contraste del ámbar sobre su fondo suave (tinta `--earth-text`, conservando los tokens oficiales), la visibilidad del radio nativo y el indicador de desarrollo de Next. El gate reutilizó aquel resultado por caché; el nuevo pase desde `apps/web` fue interrumpido por el entorno. La revisión directa de Chromium sí se completó. No se agregaron excepciones para hacer pasar el comprobador.
