# Arquitectura

## Stack y sesión

Next.js 16/App Router, React 19, TypeScript estricto, Tailwind 4, Supabase SSR y Zod. El navegador recibe sólo URL y publishable key. El cliente servidor usa cookies; `proxy.ts` renueva sesión mediante `getUser()`. `getViewer()` vuelve a validar el usuario con Auth, consulta el rol en `profiles` y rechaza perfiles inexistentes o roles fuera del enum.

`/cuenta` exige usuario. Cada ruta `/staff` vuelve a exigir `staff|admin` en servidor además del layout; `/staff/usuarios` exige `admin`. RLS sigue siendo la autoridad final. Ni navegación, middleware ni claims enviados por el navegador asignan roles.

Confirmación y recuperación intercambian PKCE en `/auth/callback`. `safeInternalPath` impide redirects externos. Recuperación termina en `/actualizar-password`; las URLs se construyen desde `NEXT_PUBLIC_SITE_URL` validada.

## Inventario de datos

Enums: `app_role` (`user`, `staff`, `admin`) y `listing_status` (`draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `published`, `rejected`, `archived`).

Tablas: `profiles`, `categories`, `brands`, `models`, `listings`, `listing_media`, `listing_status_history`, `staff_notes`. Bucket privado: `listing-media`.

Funciones: `current_role`, `is_staff`, `handle_new_user`, `transition_listing`, `guard_listing_status`, `guard_profile_role`, `set_user_role`. Las funciones `SECURITY DEFINER` fijan `search_path=''`; se revocó ejecución implícita de `PUBLIC` y sólo los RPC necesarios se conceden a `authenticated`.

Triggers: `on_auth_user_created` crea el perfil con rol por defecto de base (ignora un rol en metadata); `guard_profile_sensitive_fields` protege ID/rol; `guard_listing_sensitive_fields` hace inmutables propietario/estado directo y reserva campos editoriales.

## Estados y autorización

- Propietario: `draft|changes_requested -> submitted`.
- Staff/admin: `submitted -> in_review`; `in_review -> changes_requested|approved|rejected`; `approved -> published`; `published -> approved`; cualquier estado no archivado `-> archived`.
- Cada transición válida inserta actor y fecha en `listing_status_history`; no existen políticas de insert/update/delete para clientes sobre historial.
- `set_user_role` sólo actúa cuando el rol persistido del actor es `admin`.

RLS separa políticas `anon` y `authenticated`. Público lee taxonomía activa, anuncios publicados y medios vinculados a publicaciones. Propietarios leen sus recursos y editan sólo borradores/cambios solicitados. Staff lee revisión y administra taxonomía/notas. Los grants de Data API son mínimos y RLS decide cada fila.

Storage acepta JPEG, PNG, WebP, MP4 y WebM hasta 50 MiB. El path obligatorio es `<listing_uuid>/<random_uuid>.<ext>`; tanto la política de objetos como un constraint de `listing_media` verifican la relación con el anuncio. Nunca se usa el nombre original como control de acceso.

## Capas de prueba reales

pgTAP comprueba el núcleo SQL. Playwright añade tres superficies: navegador/Server Actions/Auth PKCE, clientes autenticados distintos contra PostgREST/RPC, y bytes reales contra Storage API. El setup usa Auth Admin y una conexión DB privilegiada para cuentas/rol staff efímeros; esas credenciales viven sólo en Node. Los clientes que ejercen políticas usan exclusivamente publishable key más su sesión.

Playwright carga un archivo de entorno explícito, construye Next.js con esas variables y, salvo `E2E_START_APP=false`, sirve el build. El target sólo puede ser `local` o `staging`; staging requiere refs declarados distintos. `ALLOW_DESTRUCTIVE_E2E=true` es condición previa a cualquier creación/limpieza.

## Baseline

La migración `202607120001` se conserva sin reescritura destructiva porque forma el baseline documentado. Los hallazgos se corrigen en migraciones `002`–`007`: timestamps reservados y grants explícitos de `service_role` se añadieron al comprobar interfaces HTTP. El seed sólo contiene taxonomía idempotente, sin usuarios ni credenciales.
