# Estado del MVP

Actualizado: 2026-07-12

## Fundación comprobada

- Supabase local aislado en puertos 55320–55329; reset reproducible y seed idempotente.
- Siete migraciones aplicadas desde cero.
- 29 pruebas pgTAP de perfiles, roles, anuncios, transiciones, historial, timestamps y Storage.
- Pruebas TypeScript de entorno, formularios, perfiles/roles, guards y redirects.
- Auth SSR usa usuario validado; confirmación y recuperación tienen callback seguro.
- RLS, grants, funciones `SECURITY DEFINER`, columnas reservadas y paths de medios endurecidos.
- 6 pruebas Playwright recorren Auth/Mailpit/PKCE, PostgREST/RPC multiusuario y Storage binario real.

## Pendiente

- Generar tipos desde una instancia remota cuando se cree el proyecto.
- Probar entrega de correo con SMTP de producción; localmente Mailpit captura los mensajes.
- Ejecutar la suite contra staging cuando existan ref, URLs y credenciales explícitas.
- Formulario de publicación, catálogo y panel editorial continúan fuera de alcance.

## Limitaciones automatizadas

Mailpit demuestra entrega y enlaces sólo en local, no SMTP remoto. La suite remota omite esos recorridos de correo. No se ha creado ni modificado un proyecto remoto porque no hay credenciales de staging configuradas.

## Última verificación

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: 5/5 PASS.
- `npm run test:e2e`: PASS local, 6/6 (4 Auth, 1 HTTP, 1 Storage).
- `npm run build`: PASS, 20 rutas.
- `npx supabase db reset`: PASS, migraciones 001–007 y seed.
- `npx supabase test db`: 29/29 PASS.
- `npm audit` y `npm audit --omit=dev`: 2 moderadas en el PostCSS transitivo de Next.js; sin actualización compatible propuesta por npm.
- staging remoto: NOT RUN; faltan `E2E_STAGING_PROJECT_REF`, URLs y credenciales de staging.
