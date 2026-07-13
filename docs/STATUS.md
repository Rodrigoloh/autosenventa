# Estado del MVP

Actualizado: 2026-07-12

## Fundación comprobada

- Supabase local aislado en puertos 55320–55329; reset reproducible y seed idempotente.
- Cinco migraciones aplicadas desde cero.
- 27 pruebas pgTAP de perfiles, roles, anuncios, transiciones, historial y Storage.
- Pruebas TypeScript de entorno, formularios, perfiles/roles, guards y redirects.
- Auth SSR usa usuario validado; confirmación y recuperación tienen callback seguro.
- RLS, grants, funciones `SECURITY DEFINER`, columnas reservadas y paths de medios endurecidos.

## Pendiente

- Generar tipos desde una instancia remota cuando se cree el proyecto.
- Probar entrega de correo con SMTP de producción; localmente Mailpit captura los mensajes.
- Añadir pruebas HTTP end-to-end de Auth/Storage además de las pruebas SQL.
- Formulario de publicación, catálogo y panel editorial continúan fuera de alcance.

## Limitaciones automatizadas

Las pruebas SQL simulan `auth.uid()` con claims transaccionales y ejercen RLS directamente en Postgres; no prueban proxy/Kong ni carga binaria real. Los límites MIME/tamaño son configuración de Storage API y se verifican en la definición del bucket. La seguridad por fila y formato de path sí se ejecuta en SQL.

## Última verificación

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: 5/5 PASS.
- `npm run build`: PASS, 20 rutas.
- `npx supabase db reset`: PASS, migraciones 001–005 y seed.
- `npx supabase test db`: 27/27 PASS.
- `npm audit` y `npm audit --omit=dev`: 2 moderadas en el PostCSS transitivo de Next.js; sin actualización compatible propuesta por npm.
