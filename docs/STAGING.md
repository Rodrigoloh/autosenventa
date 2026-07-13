# Staging de Supabase

## Enlace y migraciones

Usa un proyecto creado exclusivamente para staging. Antes de cualquier comando compara el ref visible en el Dashboard con `E2E_STAGING_PROJECT_REF` y confirma que sea distinto de `E2E_PRODUCTION_PROJECT_REF`.

```bash
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>
npx supabase db push
```

`db push` aplica sólo migraciones pendientes. El seed versionado contiene taxonomía idempotente y puede aplicarse cuando staging necesite esos datos con `npx supabase db push --include-seed`; no contiene usuarios ni claves. Revisa antes `supabase/.temp/project-ref` y ejecuta `npx supabase projects list`: si coincide con producción, detente.

## Primer admin

Registra primero el usuario por Auth. En SQL Editor de staging, con acceso privilegiado y su UUID verificado:

```sql
begin;
select set_config('app.role_change', 'allowed', true);
update public.profiles set role = 'admin' where id = '<USER_UUID>';
commit;
```

Después ese admin puede usar `set_user_role`; ni staff ni clientes normales pueden hacerlo. La service role nunca va al navegador.

## Variables y ejecución

Crea fuera de Git, por ejemplo `.env.staging.e2e`, con todos los nombres E2E de `.env.example`. Requisitos especiales: `E2E_TARGET=staging`, `E2E_STAGING_PROJECT_REF`, un `E2E_PRODUCTION_PROJECT_REF` distinto, URLs de producción conocidas, service role y conexión directa de base de staging. Usa `E2E_START_APP=false` si `E2E_APP_URL` ya es un despliegue; usa `true` para servir el build local apuntando a staging.

```bash
E2E_ENV_FILE=.env.staging.e2e npm run test:e2e
```

En PowerShell:

```powershell
$env:E2E_ENV_FILE='.env.staging.e2e'
npm run test:e2e
```

La suite requiere además `ALLOW_DESTRUCTIVE_E2E=true`; sin ella falla antes de crear datos. Para staging valida que la URL de Supabase empiece por el ref declarado y bloquea refs iguales. Las cuentas usan correos `e2e-...@example.test`, UUID aleatorios y limpieza en `afterAll`.

Si una ejecución se interrumpe antes de limpiar, localiza usuarios por el prefijo `e2e-` en Auth, elimina primero objetos `listing-media` y anuncios asociados mediante una operación privilegiada, y por último elimina los usuarios. Nunca hagas esta limpieza en producción. Conserva logs/IDs de la ejecución antes de borrar.

Los recorridos Mailpit de confirmación y recuperación se omiten en staging porque no acreditan SMTP remoto. PostgREST, RPC, login con cuentas confirmadas y Storage quedan preparados para ejecutarse con las credenciales anteriores.
