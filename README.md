# Garage

Fundación comprobada de una plataforma curada de automóviles.

## Borradores de anuncios

Una sesión autenticada administra sus anuncios desde `/cuenta/anuncios`. “Crear anuncio” inserta un registro `draft` cuyo propietario se obtiene en servidor y redirige a `/cuenta/anuncios/[id]/editar`. El formulario permite guardar identificación, datos comerciales, especificaciones e historia del propietario; la vista `/cuenta/anuncios/[id]/vista-previa` es privada y no indexable.

Sólo `draft` y `changes_requested` son editables. Cada lectura y escritura filtra de nuevo por el usuario autenticado y RLS conserva la autoridad final. El payload se construye con una lista cerrada: no admite propietario, estado, Featured, slug, edición de staff, fechas editoriales ni timestamps administrativos. El título provisional se deriva en base de datos de año, marca, modelo y variante.

Las categorías, marcas y modelos provienen de las tablas activas. El navegador filtra modelos por marca para la experiencia de uso; Zod, la acción servidor, un trigger y una FK compuesta vuelven a validar taxonomía activa y pertenencia del modelo.

Todavía no se incluyen imágenes, video, envío a revisión, edición de staff, publicación pública, catálogo, comentarios, ofertas ni pagos.

## Supabase local

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

Este proyecto usa API `55321`, DB `55322`, Studio `55323` y Mailpit `55324` para coexistir con otras pilas. Obtén las claves locales con `npx supabase status` y copia `.env.example` a `.env.local`. `.gitignore` excluye `.env*`, por lo que `.env.local` no se versiona.

## Primeros usuarios y roles

Registra usuarios desde `/registro` o Auth > Users en Studio. Todo perfil nace como `user`, incluso si el cliente envía metadata de rol.

Para crear el primer admin, identifica su UUID y ejecuta una sola vez en SQL Editor con acceso de base:

```sql
select set_config('app.role_change', 'allowed', true);
update public.profiles set role = 'admin' where id = '<USER_UUID>';
select set_config('app.role_change', '', true);
```

Después, un admin asigna o retira staff exclusivamente mediante:

```sql
select public.set_user_role('<USER_UUID>', 'staff');
```

Un cliente normal o staff recibe error al llamar ese RPC. No uses service role en el navegador.

## Entornos

- `.env.local`: desarrollo manual de Next.js; sólo URL, publishable key y URL del sitio.
- `.env.test`: secretos locales de la suite, ignorados por Git. Se obtiene con `npx supabase status --output env` y nunca se copia al navegador.
- staging: archivo fuera de Git seleccionado con `E2E_ENV_FILE`; exige `E2E_TARGET=staging`, refs distintas de staging/producción y credenciales propias.
- producción: nunca se usa para pruebas destructivas. Las URLs/ref conocidas se declaran como guardas, no como objetivo.

La suite se niega a iniciar sin `ALLOW_DESTRUCTIVE_E2E=true`, bloquea coincidencias con URLs de producción y valida que el hostname remoto corresponda a `E2E_STAGING_PROJECT_REF`. La service role y la conexión DB se usan sólo desde el proceso Node de setup/cleanup; jamás son `NEXT_PUBLIC_*`.

## Playwright, HTTP y Storage

Prepara `.env.test` a partir de `.env.example`, inicia Supabase y ejecuta:

```bash
npx supabase start
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` construye y sirve Next.js en la URL indicada. `e2e/auth.spec.ts` recorre registro, confirmación PKCE, login, guards, logout y recuperación; Mailpit se abre en `http://127.0.0.1:55324`. `e2e/listing-drafts.spec.ts` crea, guarda, recupera y previsualiza un borrador tras volver a iniciar sesión. `e2e/http-authorization.spec.ts` usa sesiones reales distintas contra PostgREST. `e2e/storage.spec.ts` carga un PNG real y prueba lectura, overwrite, path ajeno, MIME y tamaño. Todos usan identificadores únicos y limpian sus datos.

Si Chromium administrado no puede descargarse y existe Chrome local, define `E2E_BROWSER_CHANNEL=chrome`. Mailpit sólo prueba entrega local, no SMTP remoto.

## Aplicación y checks

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

La preparación remota reproducible y su limpieza están en `docs/STAGING.md`. Consulta también `docs/ARCHITECTURE.md`, `docs/SECURITY_AUDIT.md` y `docs/STATUS.md`.
