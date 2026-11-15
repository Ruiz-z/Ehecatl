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

- `/login`: email y contraseña, con atajos a tres agricultores y un administrador de ejemplo.
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

## Autenticación y API

`NEXT_PUBLIC_USE_MOCKS=true` por defecto usa fixtures marcados como ejemplo. `false` selecciona fetch contra `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:3001`). Copia `.env.example` a `.env.local`; las variables públicas se fijan al construir Next.js.

`src/shared/api/types.ts` expone `ApiClient` y `AuthClient`. La sesión se guarda detrás de `AuthClient` en localStorage, con expiración; no guarda contraseña. Esto permite reemplazar el almacenamiento por una cookie mediante un adaptador. La protección cliente evita mostrar rutas privadas sin sesión; la autorización real y la validación del JWT corresponden al servidor.

Con `NEXT_PUBLIC_USE_MOCKS=true` las cuatro cuentas locales son `ana@demo.ehecatl.test`, `james@demo.ehecatl.test`, `lucia@demo.ehecatl.test` y `admin@demo.ehecatl.test`, con contraseña pública `Ehecatl-demo-2026`; los botones solo rellenan el formulario. Con `false` se usan las cuentas que siembra `apps/api` (`prisma db seed`, con `SEED_DEMO_PASSWORD`): no hay atajos y se escribe el correo y la contraseña. No se crean ni modifican usuarios del backend desde la web.

### Modo remoto (`NEXT_PUBLIC_USE_MOCKS=false`)

Contrato en `docs/contracts.md`. Las respuestas del API se traducen a los modelos de vista en `src/shared/api/adapters.ts` (funciones puras con tests); `client.ts` solo hace las llamadas.

| Método del cliente | Endpoint | Notas |
|---|---|---|
| `login` | `POST /auth/login` y `GET /me/priorities` | `role` llega como `FARMER`/`ADMIN`; las prioridades se piden aparte. |
| `listCrops` | `GET /crops` | Catálogo en memoria; da el nombre y la familia de cada cultivo. |
| `listParcels` | `GET /parcels` | Una parcela de la web es la primera zona de la parcela del API. El API no da lugar, superficie ni riesgo: se muestran coordenadas y sin chip de riesgo. |
| `createParcel` | `POST /parcels` | `{name,lat,lon,currentCropId,irrigated}`; el API crea la zona por defecto. |
| `getIndicators` | `GET /zones/:id/indicators` | Series mensuales, normal de 10 años y origen (`live`/`cache`). La primera consulta de un punto nuevo puede tardar minutos. NDVI queda en «sin dato» si MODIS no cubre el punto. |
| `getRecommendations` | `GET /zones/:id/recommendations` | Alternativas con `components` por eje. El API aún no devuelve la estrategia «mantener lo actual», así que la tarjeta base y los deltas aparecen solo si llegan; las razones no traen origen y se muestran sin etiqueta. `no_viable_options` muestra la pantalla de sin ventanas. |
| `savePriorities` | `PUT /me/priorities` | Pesos enteros que suman 100. |

Los errores HTTP se muestran sin revelar cuál credencial falló. No hay fallback silencioso a fixtures en modo remoto, y el chip «Datos de ejemplo» solo aparece con mocks. El API debe aceptar el origen de la web en `WEB_ORIGINS`.

La base satelital usa Esri World Imagery y las calles OpenStreetMap, con atribución y conexión a internet. En modo demo, NDVI y recomendaciones son ilustrativos y se identifican en pantalla. Los puntos nuevos aceptan cualquier latitud y longitud.

## Verificación visual

Capturas locales nuevas en `screenshots/` (ignoradas por Git) a 1440 y 390 px: login, parcelas, nueva, estado, datos, sembrar, sin-datos, error y sin-ventanas, incluidas vistas móviles expandidas. La revisión no equivale a certificación WCAG o prueba con lector de pantalla.

## Resultado de esta segunda pasada

- `pnpm lint`: pasa en los tres paquetes.
- `pnpm test`: pasa; 6 tests web (validación, credenciales de las cuatro cuentas, ranking y permanencia de la estrategia actual), 1 API y 1 geo.
- `pnpm --filter web build`: pasa.
- Chromium a 1440/390: capturas revisadas, sin desbordamiento horizontal ni errores graves de consola. Probados redirección privada, errores de formulario y credenciales, atajos sin entrada automática, login, parcelas propias, cierre de sesión y admin.
- El entorno usa Node 26 y avisa que el proyecto requiere Node 24. Se usó el ejecutable pnpm ya disponible en `/tmp/ehecatl-bin` y caché uv en `/tmp` por restricciones de escritura; no se instalaron dependencias.

Contraste y accesibilidad: se conservan los tokens, se amplían controles a 44 px, se añaden etiquetas persistentes y errores anunciados, y se conserva la alternativa de tabla para gráficas y botón para arrastrar el panel. No se verificaron lectores de pantalla ni dispositivos táctiles físicos.

### Comprobación contra identity 001

| RF | Evidencia / límite |
|---|---|
| RF-1 | Formulario email/password y adaptador POST implementados; prueba real de JWT pendiente del backend. |
| RF-2 | Error genérico para credenciales incorrectas, probado en fixtures y navegador. Adaptador trata HTTP 401. |
| RF-3 | No se persisten contraseñas de usuario en web; bcrypt corresponde al backend, no verificado. |
| RF-4 | Interfaz oculta parcelas ajenas, probado con Ana/James. El 403 real y ownership del servidor siguen pendientes. |
| RF-5 | Admin fixture ve todas las parcelas, probado en navegador. Permiso real pendiente del servidor. |
| RF-6 | Cuatro cuentas fixture disponibles. No hay seed B18 en esta rama, por lo que este RF no está cumplido de extremo a extremo. |

No se modificaron el motor del backend ni la ingesta NASA. Los tests de ranking verifican solamente la comparación ilustrativa de la web; no certifican el cumplimiento completo de spec 005. F1–F5 no se marcan terminadas en `tasks/todo.md` porque requieren integración real.
