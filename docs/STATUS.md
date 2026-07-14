# Estado del MVP

Actualizado: 2026-07-13

## Fundación comprobada

- Supabase local aislado en puertos 55320–55329; reset reproducible y seed idempotente.
- Siete migraciones aplicadas desde cero.
- 29 pruebas pgTAP de perfiles, roles, anuncios, transiciones, historial, timestamps y Storage.
- Pruebas TypeScript de entorno, formularios, perfiles/roles, guards y redirects.
- Auth SSR usa usuario validado; confirmación y recuperación tienen callback seguro.
- RLS, grants, funciones `SECURITY DEFINER`, columnas reservadas y paths de medios endurecidos.
- La suite Playwright conserva 6 pruebas de fundación para Auth/Mailpit/PKCE, PostgREST/RPC multiusuario y Storage binario real.

## Fase de borradores implementada

- Dashboard responsive de anuncios propios con estado, datos reales, avance, actualización y acciones según editabilidad.
- Creación servidor de un `draft`, propietario derivado de sesión y prevención de doble submit en interfaz.
- Edición y recuperación de datos del vehículo e historia del propietario para `draft|changes_requested`.
- Taxonomía activa leída de base, selector de modelo dependiente y validación marca-modelo en cliente, servidor y SQL.
- Título provisional derivado de año, marca, modelo y variante; slug y campos editoriales permanecen reservados.
- Vista previa privada, no indexable y limitada a los campos del propietario.
- Rutas: `/cuenta`, `/cuenta/anuncios`, `/cuenta/anuncios/nuevo`, `/cuenta/anuncios/[id]/editar` y `/cuenta/anuncios/[id]/vista-previa`.
- Validación Zod y constraints para año, precios, kilometraje, longitudes, valores permitidos y UUIDs.
- Pruebas ampliadas en las capas unitarias, pgTAP, PostgREST y Playwright.

## Pendiente

- Generar tipos desde una instancia remota cuando se cree el proyecto.
- Probar entrega de correo con SMTP de producción; localmente Mailpit captura los mensajes.
- Ejecutar la suite contra staging cuando existan ref, URLs y credenciales explícitas.
- Imágenes, video, envío a revisión, panel editorial, publicación pública, Featured, catálogo, comentarios, ofertas y pagos continúan fuera de alcance.

## Limitaciones automatizadas

Mailpit demuestra entrega y enlaces sólo en local, no SMTP remoto. La suite remota omite esos recorridos de correo. No se ha creado ni modificado un proyecto remoto porque no hay credenciales de staging configuradas.

## Verificación de esta fase

- `npm run lint`: PASS, 0 errores y 0 warnings.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 8/8.
- `npm run test:e2e`: PASS local, 7/7 (4 Auth, 1 HTTP/RLS, 1 borradores, 1 Storage).
- `npm run build`: PASS, 21 rutas; incluye edición y vista previa dinámicas.
- `npx supabase db reset`: PASS, migraciones `202607120001`–`202607130001` y seed desde base limpia.
- `npx supabase test db`: PASS, 39/39.
- Revisión visual: PASS en formulario de escritorio y vista previa a 390 × 844; se corrigió la conservación visual de selects después de guardar.
- `npm audit` y `npm audit --omit=dev`: 2 moderadas en el PostCSS transitivo de Next.js; sin actualización compatible propuesta por npm.
- staging remoto: no se ejecuta en esta fase local; conserva las guardas documentadas en `docs/STAGING.md`.
