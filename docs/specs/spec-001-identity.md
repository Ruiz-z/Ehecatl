# Spec 001 — Identity (usuarios y acceso)

## Contexto y objetivo
Varios agricultores usan la herramienta, cada uno con sus parcelas y prioridades. Hace falta un acceso mínimo y seguro para que los perfiles de demo se vean distintos y nadie vea datos ajenos (constitución #9).

## Usuarios / actores
Agricultor (dueño de sus parcelas), Administrador (superset).

## Historias de usuario
- H1: Como agricultor quiero iniciar sesión para ver solo mis parcelas.
- H2: Como administrador quiero ver cualquier parcela para dar soporte en la demo.
- H3: Como equipo quiero usuarios demo ya sembrados para mostrar perfiles distintos sin capturar datos a mano.

## Requisitos funcionales (EARS)
- RF-1: CUANDO un usuario envía email y password válidos a `POST /auth/login`, EL SISTEMA responde un JWT y los datos básicos del usuario.
- RF-2: SI las credenciales son inválidas, ENTONCES EL SISTEMA responde 401 sin indicar cuál campo falló.
- RF-3: EL SISTEMA guarda passwords solo con hash bcrypt.
- RF-4: CUANDO un Agricultor pide una parcela cuyo `ownerId` no es el suyo, EL SISTEMA responde 403.
- RF-5: EL SISTEMA permite al Administrador leer cualquier parcela.
- RF-6: CUANDO se ejecuta el seed, EL SISTEMA crea al menos 3 agricultores demo con ubicaciones, cultivos y prioridades distintas, y 1 administrador. Los perfiles representan realidades contrastantes (p. ej. zona árida con estrés hídrico y monocultivo de maíz/forraje; agua subterránea restringida; zona templada/húmeda con exceso de lluvia o erosión), sin hardcodear regiones en el código.

## Requisitos no funcionales
- JWT con expiración; secreto vía `.env`.

## Casos límite
- Token expirado o malformado → 401.
- Email duplicado al crear usuario → 409.

## Fuera de alcance
Registro público, OAuth, recuperación de contraseña, permisos dinámicos.

## Criterios de finalización
RF-1 a RF-6 con test en verde + demo: dos agricultores ven parcelas distintas y el administrador ve ambas.

## Decisiones
- Login normal (email + password) con usuarios sembrados; sin selector de perfil.

## Dudas abiertas
- Ninguna bloqueante.
