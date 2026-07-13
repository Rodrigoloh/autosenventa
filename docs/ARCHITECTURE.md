# Arquitectura

## Stack

- Next.js 16 con App Router, React 19 y TypeScript estricto.
- Tailwind CSS 4; `components.json` deja configurado shadcn/ui para componentes futuros.
- Supabase (`@supabase/ssr`) para Auth, Postgres y Storage.
- Zod para validar entorno y entradas de acciones de servidor.

## Límites de confianza

El navegador usa exclusivamente la publishable key. `src/lib/supabase/server.ts` crea el cliente SSR con cookies, mientras `src/proxy.ts` renueva la sesión. No existe ni debe añadirse una service role key al bundle web.

Los layouts `/cuenta` y `/staff` comprueban sesión y rol en servidor. Las comprobaciones visuales sólo mejoran navegación; la autorización efectiva vive también en RLS. `assertOwnsResource` debe usarse en futuras acciones sobre anuncios individuales.

## Datos y estados

La migración inicial define perfiles, taxonomía, anuncios, medios, notas privadas e historial. El estado sólo cambia a través de `transition_listing`; un trigger rechaza cambios directos y también hace inmutable `owner_id`. Cada transición registra actor y fecha. `set_user_role` exige rol `admin` dentro de Postgres.

Todas las tablas tienen RLS habilitado. Los visitantes sólo leen anuncios `published`; propietarios leen los suyos y sólo editan `draft`/`changes_requested`; staff accede a revisión. El bucket privado `listing-media` replica esas reglas y exige rutas con el UUID del anuncio como primer segmento.

## Decisiones de alcance

- No hay datos semilla ni mock en producción.
- Las rutas dinámicas sin datos devuelven 404 y los listados muestran estados vacíos reales.
- El formulario de anuncios, catálogo consultable y acciones editoriales se reservan para la siguiente fase.
- La validación de entorno es diferida: CI puede compilar sin secretos, pero cualquier petición que use Supabase falla con un mensaje explícito si falta `.env.local`.
