# Web

Scaffold Next.js App Router con TypeScript estricto y Tailwind CSS. La página inicial es mínima; el diseño y las pantallas de negocio corresponden a H5/F1–F5.

- Desarrollo desde la raíz: `pnpm --filter web dev` (puerto 3000).
- Build: `pnpm --filter web build`.
- Lint y tipos: `pnpm --filter web lint`.
- Docker: `docker compose up --build web`.

shadcn/ui se inicializó manualmente siguiendo su [instalación oficial](https://ui.shadcn.com/docs/installation/manual): `components.json`, tokens CSS y utilitario `cn`. Los alias apuntan a `src/shared`; las rutas viven en `src/app` y las futuras funcionalidades en `src/features`. No se agregaron componentes sin uso. Para agregar uno: `pnpm dlx shadcn@latest add button` desde esta app.

`NEXT_PUBLIC_API_URL` es configuración pública de build. Compose la toma del `.env` raíz; `.env.example` muestra el valor local. No contiene secretos.
