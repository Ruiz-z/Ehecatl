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
┌────┬───────────────────────────────┬───────────────────┐
│riel│ Contenido SÓLIDO (≈56 %)      │ Mapa (≈44 %)      │
│72px│ lista / detalle, scroll propio│ satelital, sticky │
└────┴───────────────────────────────┴───────────────────┘
```
- **Riel (72 px):** negro `#0E1410`, iconos crema, el activo con fondo `--accent` y icono negro. Abajo avatar y salir.
- **Contenido:** columna blanca opaca sobre fondo hueso, **sin vidrio ni mapa detrás**. Cabecera con migas, título 36 px y píldoras de datos de la parcela.
- **Mapa:** Leaflet, base satelital Esri con atribución, pegado al borde derecho, `position: sticky`; pin en `--accent` con borde negro. Controles flotantes circulares blancos.
- **Tablet (<1024):** mapa arriba (alto 280 px) y contenido debajo. **Móvil (<768):** mapa colapsable y contenido a ancho completo; navegación en barra inferior negra de 4 iconos. Hoja blanca opaca, nunca translúcida.
- **Login:** único lugar con «momento de marca»: imagen satelital de fondo con degradado negro solo bajo el texto, titular grande y formulario en tarjeta blanca sólida.

## 3. Pantallas (misma lista que las specs; ver `docs/specs/spec-006-web-ui.md`)
1. **Login** — tarjeta centrada sobre fondo verde salvia suave; selector rápido de usuarios demo (tarjetas con nombre y región).
2. **Mis parcelas** — panel: buscador + lista de parcelas (nombre, lugar, cultivo actual, chip de riesgo o "Sin datos NASA aún"). Mapa con un pin por parcela; al elegir una, el mapa vuela a ella.
3. **Nueva parcela** — mapa para colocar el punto (o lat/lon manual), nombre, cultivo actual, riego sí/no. Funciona para cualquier lugar del mundo.
4. **Parcela · Estado** — pestañas **Estado | Datos | Qué sembrar**. Estado: dos tarjetas lado a lado (NDVI de la zona + imagen satelital), cifras clave (lluvia vs. normal, temperatura vs. normal, humedad de suelo).
5. **Parcela · Datos** — calendario de doce meses y un detalle a la vez (ver §6).
6. **Parcela · Qué sembrar** — banner de riesgo (si aplica), 2–3 tarjetas de secuencia (ver §7), prioridades como sliders al pie.
7. **Estados:** vacío, cargando (skeleton), error de datos, sin ventanas de cultivo.

## 4. Paleta «Lima» (oficial; base visual: kit Harvestiq de Figma, solo sistema, sin sus imágenes)
Un solo acento saturado, negro casi puro y blanco hueso. Todo lo demás son neutros. La zanahoria queda **solo** para riesgo/alerta.

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--foreground` / `--primary` | `#0E1410` | texto principal, botones, riel | 17.6:1 sobre hueso |
| `--background` | `#F7F8FA` | fondo de la app | — |
| `--card` | `#FFFFFF` | tarjetas y columna de contenido | — |
| `--accent` | `#6FC20B` | **relleno** (barras, icono en círculo, píldora activa, punto de sección). Texto encima: `#0E1410` (8.3:1) | ❌ nunca como texto sobre claro (2.1:1) |
| `--accent-soft` | `#E9F6D0` | fondo de píldora «viable», filas destacadas | texto negro 16.5:1 |
| `--accent-text` | `#3E7A00` | verde para texto pequeño sobre blanco (p. ej. «+43 puntos») | 5.3:1 |
| `--muted-foreground` | `#5B645E` | texto secundario | 6.1:1 sobre blanco |
| `--border` | `#D9DDD8` | divisores decorativos | solo decorativo |
| `--control-border` | `#8A928C` | borde de inputs y controles | 3.2:1 |
| `--risk` | `#D0410C` | relleno de alerta; texto de riesgo `#B53509` (6.0:1) | |
| `--warning-soft` / `--danger-soft` | `#FDF0DC` / `#FDE7E4` | fondos de aviso | |

```css
:root {
  --background:#F7F8FA; --card:#FFFFFF; --foreground:#0E1410;
  --primary:#0E1410; --primary-foreground:#FFFFFF;
  --accent:#6FC20B; --accent-foreground:#0E1410; --accent-soft:#E9F6D0; --accent-text:#3E7A00;
  --muted-foreground:#5B645E; --border:#D9DDD8; --control-border:#8A928C;
  --risk:#D0410C; --risk-text:#B53509; --warning-soft:#FDF0DC; --danger-soft:#FDE7E4;
  --radius-lg:20px; --radius-md:14px;
}
```
Tema claro de alto contraste a propósito (legible bajo el sol): **no hay modo oscuro**.

### Reglas anti «se ve a IA» (obligatorias)
- **Prohibido:** `backdrop-filter`/vidrio, degradados de fondo, sombras de panel, chips en todo, un icono junto a cada línea, texto < 13 px, más de 1 acento + 1 color de alerta por pantalla.
- Jerarquía por **tamaño y peso**, no por color: título de pantalla 32–40 px semibold con tracking −0.02em; título de tarjeta 20–22; cuerpo 15–16; auxiliar ≥ 13.
- Botón principal: **píldora negra** con círculo lima y flecha ↗. Etiqueta de sección: píldora `--accent-soft` con punto lima.
- Iconos solo dentro de un círculo `--accent` cuando aportan (KPI, categoría).
- Profundidad con contraste de superficies (hueso vs. blanco) y radios grandes; nada de sombras.

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
- Calendario del año como pieza principal en Datos: tabla accesible de doce meses y cinco renglones (Lluvia, Calor, Tierra, Plantas, Se puede sembrar). Texto y color juntos; sin dato rayado. Cada renglón usa su familia de color: lluvia en arena y azules, calor en azul, gris y naranja, tierra en cafés, plantas en amarillo y verdes, siembra en verde o gris. En móvil, scroll dentro del contenedor y primera columna fija.
- Un solo detalle seleccionado con botones aria-pressed, Lluvia por defecto. Barras de lluvia con marcas de normal; línea de temperatura promedio sin suavizado y con eje ajustado al rango real, normal punteada. Tierra y Plantas usan tiras ampliadas con valores debajo, sin línea ni eje.
- Tokens existentes para todos los colores, foco visible, tablas de valores con encabezados y ámbitos. Los textos aprobados y umbrales orientativos se centralizan en copy.ts (heurística pendiente de H4).
- Resúmenes anuales sin extrapolar faltantes, nota de mes pendiente y pie «Datos de NASA. {inicio} a {fin}.». Se conserva la marca de datos de ejemplo.

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
Usar los textos aprobados de `features/nasa/copy.ts` sin reescribirlos. Resumen con consejo, indicadores en prosa y ayudas con teclado. Humedad de la tierra y verdor llevan barras de tres zonas con texto visible. El desplegable «Ver el dato exacto» muestra valor, fuente y mes; la variable solo aparece en «Nombre técnico». Los umbrales de humedad y verdor son heurísticas pendientes de H4.

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

## 11. Marca

El símbolo propio une un tallo y una hoja a la izquierda con una espiral de viento a la derecha: viento que hace brotar. La hoja usa `--accent` (`#6FC20B`); el tallo y el viento heredan el color del texto, blanco sobre oscuro y `#0E1410` sobre claro. Tamaño mínimo: 16 px; cabecera y riel: 28 px. No usar el brote de lucide como logo; se conserva como ilustración de estados vacíos y como icono de navegación.

La palabra «ehécatl.» conserva minúsculas y punto lima, con peso 650 y espaciado de letras de `-.03em`. El riel compacto muestra solo el símbolo. En el login, el logo blanco se apoya en un degradado oscuro superior de 160 px, sin placa; el pie conserva su placa. El favicon usa el símbolo sobre un fondo redondeado `#0E1410`.
