# Spec 007 — Sensores a pie de parcela (verdad de terreno y confianza)

> **Estado: borrador para aprobación (H2).** No se implementa nada hasta aprobarla. Reutiliza el patrón de dispositivos de SmartRiego MX (`~/personal/Hackregional/Regional/docs/specs/spec-003-dispositivos-iot.md`), con una diferencia de fondo: aquí el sistema **solo avisa**, nunca acciona.

## Contexto y objetivo
Ehécatl es una **app beta**. Los datos satelitales son útiles como contexto, pero no se pueden tomar como verdad de campo: cada fuente se actualiza con su propia frecuencia (en días o semanas), a una resolución de cientos de metros a decenas de kilómetros, y las condiciones de una parcela cambian más rápido. Quien decide en campo mide **a pie de parcela**.

El objetivo es que sensores en la parcela (nodo ESP32) midan variables clave, que el sistema las **compare con las estimaciones satelitales** del mismo punto, y que esa comparación **construya confianza gradual** en el usuario: «tu sensor y el satélite coinciden / no coinciden, y esto significa para tu decisión». Como la app es beta, el sistema **avisa qué medidas tomar** y nunca actúa por sí mismo.

## Usuarios / actores
Agricultor (ve lecturas, comparación y avisos de sus zonas), Administrador (da de alta y revoca dispositivos, como en SmartRiego), Nodo ESP32 (envía lecturas con su API key).

## Historias de usuario
- H1: Como agricultor quiero ver lo que mide mi sensor en mi parcela junto a lo que dice el satélite para saber si puedo confiar en el satélite en mi zona.
- H2: Como agricultor quiero saber qué tan reciente es cada dato (de campo y satelital) para no decidir con información vieja.
- H3: Como agricultor quiero recibir un aviso con medidas sugeridas, y decidir yo si las aplico, porque la app todavía es beta.
- H4: Como equipo quiero llevar un registro de qué tanto coinciden sensor y satélite para evaluar la herramienta durante la beta.
- H5: Como administrador quiero registrar un dispositivo en una zona y revocarlo si se compromete.

## Requisitos funcionales (EARS)
### Dispositivos
- RF-1: CUANDO un Administrador registra un dispositivo (`POST /devices` con `zoneId`, nombre y calibración), EL SISTEMA genera una API key única, la muestra **una sola vez** y guarda solo su hash.
- RF-2: EL SISTEMA exige el header `X-Device-Key` en `POST /readings` y lo valida contra un dispositivo activo; SI no coincide (ausente, inválida, revocada o regenerada), ENTONCES responde 401 y no persiste el payload.
- RF-3: CUANDO un Administrador revoca o regenera la key de un dispositivo, EL SISTEMA invalida la anterior de inmediato. Reasignar de zona conserva la key.
- RF-4: EL SISTEMA marca un dispositivo como **en línea** si envió una lectura dentro de su intervalo esperado (configurable, por defecto 3 × el intervalo de envío) y **sin señal** en caso contrario.

### Lecturas
- RF-5: CUANDO un dispositivo envía `POST /readings` con `measuredAt` y al menos una variable (`soilMoisture`, `soilTemperature`, `airTemperature`, `airHumidity`), EL SISTEMA las valida, las normaliza y las guarda asociadas a la zona del dispositivo.
- RF-6: EL SISTEMA aplica la **calibración** del dispositivo (valores crudo en seco y en saturación) para llevar `soilMoisture` a una fracción 0–1 comparable con la humedad satelital; guarda también el valor crudo.
- RF-7: SI una lectura está fuera de rango físico (p. ej. humedad < 0 o > 1 tras calibrar, temperatura imposible) o su `measuredAt` es futuro o demasiado antiguo, ENTONCES EL SISTEMA la descarta, registra el motivo y no la usa en ninguna comparación.
- RF-8: CUANDO el usuario consulta `GET /zones/:id/readings?from&to`, EL SISTEMA devuelve las lecturas con las reglas de acceso de la spec 001 (dueño o administrador).

### Comparación con el satélite
- RF-9: EL SISTEMA compara, por zona y por variable, la serie de campo contra su contraparte de la spec 003: `soilMoisture` ↔ `GWETROOT` / `GWETTOP`, `airTemperature` ↔ `T2M`, `airHumidity` ↔ `RH2M`. Como las escalas no son iguales (resolución de ~50 km, humedad relativa a la saturación frente a humedad medida en un punto), la comparación es de **tendencia y dirección de la anomalía** y de **diferencia relativa**, no de igualdad de valores; la respuesta indica qué método se usó.
- RF-10: EL SISTEMA clasifica cada comparación como **coincide**, **coincide parcialmente** o **no coincide**, con umbrales documentados (heurísticos, pendientes de H4) y el número de días de datos que la respaldan.
- RF-11: SI hay menos de un mínimo de días con datos de campo (configurable, por defecto 7), ENTONCES EL SISTEMA no clasifica y responde «aún reuniendo datos».
- RF-12: EL SISTEMA mantiene por zona un **historial de concordancia** (porcentaje de días en que coincidieron) para mostrar cómo evoluciona la confianza en el tiempo.

### Frescura y confianza
- RF-13: EL SISTEMA expone en cada dato la **fecha del dato** y su **antigüedad**: para campo, minutos o horas desde la última lectura; para satélite, la fecha del último valor y la frecuencia propia de la fuente.
- RF-14: CUANDO una recomendación de la spec 005 se calcula para una zona con sensor activo, EL SISTEMA añade a su confianza el resultado de la comparación: concordancia alta con datos frescos la **mantiene o sube**; falta de concordancia la **baja** y lo explica («tu sensor y el satélite no coinciden»). Sin sensor, la recomendación declara «basada solo en datos satelitales».

### Avisos, no acciones
- RF-15: EL SISTEMA **nunca** envía comandos a un dispositivo ni acciona riego u otro actuador. Las respuestas a `POST /readings` solo confirman recepción.
- RF-16: CUANDO una lectura de campo cruza un umbral relevante para el cultivo de la zona (p. ej. humedad de raíz por debajo del nivel útil) o la comparación revela una discrepancia fuerte, EL SISTEMA genera un **aviso** con el dato medido, su frescura y las **medidas sugeridas** en lenguaje de campo, aclarando que es una sugerencia de una versión beta y que la decisión es del agricultor.
- RF-17: EL SISTEMA evita avisos repetidos: no genera otro aviso igual para la misma zona mientras el anterior siga vigente.
- RF-18: CUANDO el agricultor ve un aviso, PUEDE marcarlo como «lo apliqué» o «no lo apliqué»; EL SISTEMA lo registra para evaluar la herramienta. Es informativo y no cambia ninguna decisión del sistema.

### Datos de ejemplo
- RF-19: SI no hay hardware conectado, ENTONCES EL SISTEMA puede cargar lecturas de ejemplo **marcadas como tales** en la API y en pantalla. Nunca se presentan datos simulados como medidos (constitución #13).

## Requisitos no funcionales
- Key de dispositivo con entropía alta, guardada con hash y nunca registrada en logs.
- Límite de tasa por dispositivo y tamaño máximo de payload.
- Una lectura se persiste y se confirma en menos de 500 ms.
- Retención de lecturas crudas configurable; el historial de concordancia se conserva más tiempo.
- Funciona para cualquier zona del mundo: sin regiones ni umbrales hardcodeados por lugar.

## Casos límite
- Nodo sin conexión varios días → pasa a «sin señal»; la recomendación vuelve a «solo satelital» y se avisa.
- Reloj del dispositivo desfasado → se usa el `measuredAt` si es plausible; si no, se descarta (RF-7) y se registra.
- Dos dispositivos en la misma zona → permitido; la comparación usa el promedio y expone la dispersión.
- Dispositivo reasignado a otra zona → las lecturas anteriores se quedan en su zona original.
- Sensor descalibrado o con deriva → la concordancia baja de forma sostenida; el aviso recomienda revisar el sensor antes de culpar al satélite.
- Satélite sin dato del periodo (p. ej. NDVI sin cobertura) → esa variable no se compara y se dice.

## Fuera de alcance
- **Accionar riego u otros actuadores** y cualquier comando al dispositivo (la app es beta; solo avisa).
- Visión artificial, imágenes de dron (RGB, multiespectrales, hiperespectrales) y lisímetro.
- Cálculo de evapotranspiración (ETo, ETc, Kc de FAO-56): es tema de una spec aparte.
- Aprovisionamiento automático de dispositivos, firmware OTA y calibración remota.
- Alertas push o por correo; los avisos se ven en la app.

## Criterios de finalización
RF-1 a RF-19 con test en verde, más una demo con **un nodo real** (o lecturas de ejemplo marcadas): el agricultor ve su zona con lectura de campo y dato satelital lado a lado, la comparación con su estado, la frescura de cada dato y un aviso con medidas sugeridas.

## Impacto en otros documentos (por actualizar tras aprobar esta spec)
- `docs/constitution.md` #12 (IoT pasa de stretch a parte del producto beta) y la lista de fuera de alcance.
- Spec 003: antigüedad y frecuencia de cada fuente (RF-13).
- Spec 005: ajuste de confianza por concordancia (RF-14).
- Spec 006: panel de sensor, comparación, frescura, avisos con medidas y marca «versión beta».
- `tasks/todo.md`: nuevas tareas de backend (dispositivos, lecturas, comparación, avisos), front y firmware; I-S1 deja de ser stretch.

## Dudas abiertas
1. ¿Qué mide exactamente el nodo? (humedad de suelo capacitiva, temperatura de aire/suelo, humedad relativa) y a qué profundidad: `GWETTOP` es superficie y `GWETROOT` es zona radicular.
2. ¿Cuántos nodos habrá en la demo y en qué zonas?
3. ¿Cómo se conecta el nodo en la parcela (WiFi, gateway, otro)? Define el intervalo de envío y el criterio de «sin señal».
4. ¿Quién da de alta el dispositivo: solo el administrador, como en SmartRiego, o también el agricultor?
5. Umbrales de concordancia y de aviso por cultivo: requieren revisión agronómica (H4).
6. ¿Se reutiliza el firmware de SmartRiego (`firmware/smartriego-esp32`) cambiando el destino y quitando la parte de comandos?
