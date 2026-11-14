# Backend B2–B5, B11–B18

Requiere Node 24, pnpm 10.34.9, PostgreSQL 16 y el servicio geo.
Copiar `.env.example` a `.env`, definir `DATABASE_URL` y un `JWT_SECRET`
aleatorio de al menos 32 bytes. Nunca versionar `.env`.

```powershell
pnpm install --frozen-lockfile
pnpm --filter api prisma generate
pnpm --filter api prisma migrate deploy
pnpm --filter api dev
```

Pruebas sin red: `pnpm --filter api test`. Prueba adicional con PostgreSQL
aislado: definir `TEST_DATABASE_URL` apuntando a una BD vacía, aplicar primero
las migraciones con `DATABASE_URL` apuntando a esa misma BD y ejecutar los tests.
La prueba borra únicamente sus usuarios con UUID propio y cascadas asociadas.

## Seed y demo (propuesta para H3)

Definir `SEED_DEMO_PASSWORD` (12–72 bytes), levantar geo y ejecutar:

```powershell
pnpm --filter api prisma db seed
```

Se crea `admin@demo.ehecatl` y los tres agricultores descritos en
`prisma/demo-profiles.json`. H3 debe aprobar/cambiar estos perfiles.
`SEED_PROFILES_PATH` permite otro archivo JSON del mismo formato.
El seed es repetible: actualiza perfiles, zonas, historial y prioridades sin
duplicarlos. La precarga usa exclusivamente NASA real vía geo; si faltan datos
POWER utilizables o ventanas, falla con un mensaje explícito para reintentar.
MODIS puede faltar; la caché parcial expira en cinco minutos para reintentarlo.
No se imprimen ni guardan contraseñas en documentación o fixtures.

Login: `POST /auth/login` con email y password devuelve `accessToken`.
Usar `Authorization: Bearer ...` para parcelas, zonas, historial, prioridades,
catálogo, indicadores y recomendaciones. El administrador usa las prioridades
del dueño para sus recomendaciones. Los datos sensibles de User nunca salen
en las respuestas de parcelas o zonas.

## Supuestos agronómicos pendientes de H4

Los 18 cultivos tienen referencias a ECOCROP, FAO y SARE, recogidas en
`docs/fuentes-agronomicas.md`. Los rangos, ciclos y demanda por ciclo son valores
representativos del prototipo: no son una extracción validada por cultivar.
`soilCover`, `droughtTolerance` e `incomeOpportunity` son escalas heurísticas
0–100. Ingreso representa oportunidad relativa del prototipo; no es un precio,
margen, rendimiento ni recomendación financiera. La revisión H4 debe ajustar
estos números y su aplicabilidad local antes de considerarlos validados.

El agua se estima proporcionalmente a los días del ciclo dentro de una ventana;
no se asigna la lluvia de 24 meses a un cultivo de 90 días. Se rechaza por debajo
de 65% de la demanda, se advierte entre 65% y 100%. Riego permite la opción con
un riesgo explícito de abastecimiento. Las normales no son pronósticos.

El puntaje de agua combina demanda relativa y tolerancia; suelo combina
transición, fijación de nitrógeno, ruptura de hospederos, historial y cobertura;
riesgo resta puntos por avisos climáticos y repetición de familia. Cada factor
se publica con sus pesos. El motor explora un haz de hasta 60 candidatos por
ventana y devuelve los tres mejores determinísticamente; es una búsqueda
heurística, no garantiza el óptimo global. Empates: riesgo, nombre e ID.

La caché distingue punto exacto, riego, periodo, climatología y versión del
contrato. TTL normal 24 h; las respuestas parciales se guardan hasta cinco
minutos. Un origen mock permanece mock incluso al leerlo de caché.

## Límite de alcance

H2, H3 y H4 siguen pendientes de humanos. La integración de migración/seed en
el entrypoint Docker corresponde a I5. Compose pasa JWT/GEO al API; definir
`JWT_SECRET` en el `.env` raíz antes de arrancar. Aplicar migraciones manualmente
con `docker compose exec api node node_modules/prisma/build/index.js migrate deploy`
hasta integrar I5. El seed se ejecuta desde desarrollo local (requiere compilador
y fuentes); empaquetarlo en el entrypoint sigue pendiente de I5.
