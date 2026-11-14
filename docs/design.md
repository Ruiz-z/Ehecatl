# Design — Ehécatl (instrucciones para Codex)

Dirección visual para `apps/web` (tareas F). Referencia: **OneSoil** (app web de agricultura de precisión). Se toma su *estructura y densidad*, no su marca ni su arte. Sustituye a las maquetas "Trigo" y "Pradera" de `design/mockup/`, que quedan descartadas.

## 1. Principios
1. **El mapa es el protagonista.** Pantalla completa, imagen satelital; el resto flota encima o va en paneles laterales.
2. **Aplicación, no sitio.** Riel de iconos a la izquierda, panel de lista/detalle, mapa a la derecha. Cero hero marketing dentro de la app.
3. **Datos antes que decoración.** Cada tarjeta muestra una cifra o una gráfica real de la zona, con su fuente (NASA POWER / MODIS).
4. **Claro y sobrio.** UI blanca/gris muy clara, un solo acento verde, color intenso solo en los datos (NDVI, lluvia, temperatura).
5. **Explicable.** Toda recomendación muestra el "por qué" etiquetado: *Dato NASA* · *Regla de rotación* · *Tu parcela*.
6. **Español de México, tono de campo.** "Qué sembrar después", no "Recomendaciones del motor".

## 2. Layout (escritorio ≥1024 px)
```
┌────┬──────────────────┬───────────────────────────────────┐
│riel│ Panel (360 px)   │ Mapa satelital (resto)            │
│64px│ lista / detalle  │  controles flotantes a la derecha │
└────┴──────────────────┴───────────────────────────────────┘
```
- **Riel (64 px):** logo Ehécatl, iconos: Parcelas, Qué sembrar, Datos NASA, Prioridades; abajo usuario y salir. Icono activo con fondo verde claro.
- **Panel (360 px, colapsable):** contenido de la ruta; scroll propio. Cabecera fija con nombre de parcela, cultivo actual y botón cerrar.
- **Mapa:** Leaflet. Capa base satelital (Esri World Imagery, con atribución) + capa de calles opcional. Polígono/pin de cada zona; capa **NDVI** como mapa de calor (amarillo→verde) cuando haya dato.
- **Controles flotantes (derecha del mapa):** zoom, capas (satélite/calles/NDVI), mi ubicación. Botones circulares blancos con sombra suave.
- **Móvil (<768 px):** el panel pasa a *bottom sheet* arrastrable sobre el mapa; el riel se vuelve barra inferior de 4 iconos.

## 3. Pantallas (misma lista que las specs; ver `docs/specs/spec-006-web-ui.md`)
1. **Login** — tarjeta centrada sobre fondo verde salvia suave; selector rápido de usuarios demo (tarjetas con nombre y región).
2. **Mis parcelas** — panel: buscador + lista de parcelas (nombre, lugar, cultivo actual, chip de riesgo o "Sin datos NASA aún"). Mapa con un pin por parcela; al elegir una, el mapa vuela a ella.
3. **Nueva parcela** — mapa para colocar el punto (o lat/lon manual), nombre, cultivo actual, riego sí/no. Funciona para cualquier lugar del mundo.
4. **Parcela · Estado** — pestañas **Estado | Datos | Qué sembrar**. Estado: dos tarjetas lado a lado (NDVI de la zona + imagen satelital), cifras clave (lluvia vs. normal, temperatura vs. normal, humedad de suelo).
5. **Parcela · Datos** — gráficas apiladas con tooltip (ver §6): lluvia acumulada, grados-día de crecimiento / temperatura, humedad de suelo, NDVI. Rango de fechas arriba a la derecha.
6. **Parcela · Qué sembrar** — banner de riesgo (si aplica), 2–3 tarjetas de secuencia (ver §7), prioridades como sliders al pie.
7. **Estados:** vacío, cargando (skeleton), error de datos, sin ventanas de cultivo.

## 4. Paleta «Zanahoria» (oficial; la elegió el equipo desde una foto de zanahoria en tierra)
Cinco colores base muestreados de la imagen: **zanahoria** `#D0410C`, **naranja** `#E89146`, **hoja** `#404D20`, **tierra** `#AC8553`, **lima** `#B4B84D`. Reglas de uso (contrastes calculados WCAG):

| Color | Sobre blanco | Uso permitido |
|---|---|---|
| Hoja `#404D20` | 9.1:1 ✅ | Texto de títulos, barra/riel, botón primario (texto blanco 9.1:1) |
| Zanahoria `#D0410C` | 4.7:1 ✅ solo ≥14 px negrita | Acento fuerte: botón de acción, puntaje, pin. Para texto pequeño usar `#B53509` (6.0:1) |
| Naranja `#E89146` | 2.4 ❌ | Solo relleno/resalte; texto encima en `#1F2A12` (6.1:1) |
| Tierra `#AC8553` | 3.4 ❌ | Bordes, iconos decorativos, fondos suaves; texto de tierra: `#6E5430` (6.6:1) |
| Lima `#B4B84D` | 2.1 ❌ | Relleno de «viable/ok», barras; texto encima en `#1F2A12` (7.1:1) |

```css
:root {
  --background: #FBF7EF;       /* crema cálido, alto contraste con el texto */
  --surface: #F3ECDD;          /* paneles, riel claro */
  --card: #FFFFFF;
  --border: #E2D6BE;
  --foreground: #232A14;       /* texto principal, 13.9:1 sobre crema */
  --muted-foreground: #5E5A45; /* secundario, ≥5.5:1 */
  --primary: #404D20;          /* hoja: botón primario, riel, títulos */
  --primary-foreground: #FFFFFF;
  --accent: #D0410C;           /* zanahoria: acción destacada, puntaje */
  --accent-foreground: #FFFFFF;
  --accent-text: #B53509;      /* zanahoria para texto pequeño */
  --highlight: #E89146;        /* naranja: resalte, secuencia #1 */
  --ok: #B4B84D;  --ok-soft: #EDEFC9; /* viable */
  --earth: #AC8553; --earth-text: #6E5430;
  --warning: #B45309; --warning-soft: #FDF0DC;
  --danger: #B42318;  --danger-soft: #FDE7E4;
  --radius: 12px;
}
```
Tema claro de alto contraste a propósito (legible bajo luz directa del sol); **no hay modo oscuro**. El riel y la barra superior van en hoja `#404D20` con texto crema.

**Colores de datos (no reutilizar para UI):**
| Dato | Color | Nota |
|---|---|---|
| NDVI | rampa `#D73027 → #FEE08B → #A6D96A → #1A9850` | rojo = poco verdor |
| Lluvia | azul `#2F7FD0` con área al 20 % | acumulada, línea + área |
| Temperatura / grados-día | naranja `#E8782A` | línea |
| Humedad de suelo | café `#8C5A2B` | línea |
| Normal histórica | gris `#9AA39D` punteado | siempre visible como referencia |

Familia de cultivo (chips y barras de la tira): gramínea `#E8A23B`, leguminosa `#3FA58A`, otra `#4B7BC8`, descanso/cobertura `#B9C0BA`.

## 5. Tipografía y forma
- **Inter** (o la fuente del sistema si no carga), copiada localmente en el build (la demo no debe depender de internet).
- Escala: 12 (leyenda) · 14 (cuerpo del panel) · 16 · 20 (título de panel) · 28 (cifra grande). Cifras con `tabular-nums`.
- Radios 12 px en tarjetas, 8 px en inputs/botones, círculo en controles del mapa. Sombra solo en lo que flota sobre el mapa: `0 2px 8px rgb(0 0 0 / .15)`.
- Iconos: **lucide-react**, trazo 1.75, 20 px.

## 6. Gráficas
- Una sola librería (la que ya traiga shadcn charts / Recharts). Eje X fechas, sin cuadrícula vertical, cuadrícula horizontal muy tenue.
- **Tooltip fijo** al pasar el cursor: etiqueta oscura con valor y fecha, como en la referencia.
- Mostrar siempre la **línea de lo normal** (media 10 años) y resaltar la desviación en texto: "38 % menos que lo normal" (rojo/ámbar si es adverso, verde si no).
- Debajo de cada gráfica: fuente y rango ("NASA POWER · nov 2025 – oct 2026").
- Series distinguibles sin color (trazo, marcador, etiqueta directa); validar con daltonismo.

## 7. Tarjeta de secuencia ("Qué sembrar después")
- **Siempre 3 tarjetas lado a lado** (spec 006 RF-4): **Estrategia actual** («Mantener lo actual», borde gris, etiqueta «Si no cambias») + las 2 mejores alternativas. Cada alternativa muestra la diferencia contra la actual («+18 puntos»). Si la actual gana, se dice y se explica.
- Encabezado: posición (1–3), nombre `Sorgo → Frijol → Cebada`, puntaje **0–100** grande a la derecha.
- **Tira de ventanas de cultivo** (24 meses): barras por cultivo con el color de su familia, tramo "cultivo actual" rayado, marcas de las ventanas calculadas por zona.
- Línea "**Cuándo cambiar**" con fecha concreta.
- 4 mini-barras: Agua · Suelo · Ingreso · Riesgo, con el peso que tienen según las prioridades del usuario.
- Acordeón "Por qué y qué riesgos tiene" (cerrado por defecto salvo la #1): cada razón con su etiqueta de origen y "Pesó mucho/algo".
- Pie: chip de **confianza** (alta/media/baja) y por qué, y el **aviso de validación local** en texto pequeño: «Esta sugerencia se basa en datos satelitales de 10 años y reglas FAO/SARE; valida disponibilidad de semilla, maquinaria y mercado con tu agrónomo local».
- La tarjeta #1 con borde `--primary`; las otras con borde `--border`.

## 7b. Indicadores en lenguaje de campo (spec 006 RF-4b)
Nunca mostrar nombres de variable como texto principal. Formato: **etiqueta llana + valor + semáforo + consecuencia**, p. ej. «Humedad en raíz: baja (22 %) — riesgo de estrés hídrico», punto verde/ámbar/rojo (con icono y texto, no solo color). El dato crudo (`GWETROOT`, `T2M_MAX`, fuente y fecha) va en un desplegable «Ver dato NASA».

## 8. Interacción
- Cambiar un slider de prioridad recalcula y reordena las tarjetas al instante (con transición corta, 150 ms).
- Foco visible en todo (anillo 2 px `--primary`), todo operable con teclado, `prefers-reduced-motion` respetado.
- Marcar siempre cuando los datos sean de ejemplo ("Datos de ejemplo", chip ámbar), regla de `AGENTS.md`.

## 9. Datos de demo
3 usuarios con perfiles distintos (Coahuila MX, Nevada US y un punto del hemisferio sur). Cada uno con 1–2 parcelas, cultivo actual y prioridades diferentes, para que las recomendaciones salgan distintas. Nada hardcodeado a esas regiones.

## 10. Reglas para Codex
- Implementa con Tailwind + shadcn/ui en `apps/web/src/features/*` y `src/shared/*`; las rutas en `src/app` solo componen.
- Tokens en `globals.css` con los nombres de §4; no pongas hex sueltos en componentes.
- Mapa con Leaflet en un componente cliente (`dynamic`, sin SSR).
- No agregues dependencias nuevas sin preguntar (Leaflet, lucide y una librería de gráficas sí están aprobadas).
- Un commit por pantalla, Conventional Commits en español, sin `Co-Authored-By`, sin `git push`, rama desde `origin/dev` (`feat/f-...`).
- Antes de dar algo por hecho: `pnpm lint`, `pnpm test`, `pnpm --filter web build` y captura de la pantalla en escritorio y móvil.
