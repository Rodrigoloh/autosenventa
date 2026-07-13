# Garage

Fundación comprobada de una plataforma curada de automóviles.

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

## Aplicación y checks

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Mailpit permite revisar confirmaciones/resets locales en `http://127.0.0.1:55324`. Consulta `docs/ARCHITECTURE.md`, `docs/SECURITY_AUDIT.md` y `docs/STATUS.md`.
