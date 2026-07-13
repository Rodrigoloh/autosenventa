# Auditoría de seguridad de la fundación

## Inventario exacto

- 8 tablas, 2 enums, 7 funciones, 3 triggers de aplicación.
- 3 categorías, 4 marcas y 4 modelos en seed; cero usuarios.
- 1 bucket privado y políticas separadas para público, propietario y staff.
- Acciones Auth: password login, signup con confirmación, reset y actualización de contraseña.

Las políticas completas y sus recursos se mantienen versionadas en `supabase/migrations`; `supabase/tests/authorization.test.sql` demuestra 29 expectativas. Playwright añade 6 pruebas de recorridos reales (4 Auth, 1 autorización HTTP y 1 Storage binario).

## Hallazgos corregidos

Críticos: ninguno confirmado como explotable durante las pruebas.

Altos: ejecución implícita por `PUBLIC` en RPC `SECURITY DEFINER`; campos editoriales/timestamps insuficientemente protegidos; rol/propietario/estado requerían defensa adicional; el path de metadatos podía no corresponder al anuncio.

Medios: ausencia de grants explícitos con la configuración moderna de Data API; políticas públicas mezclaban `is_staff()`; sesión basada en claims sin `getUser()`; rol TypeScript casteado sin validar; recuperación sin callback final; redirect y URL de correo no estaban centralizados; límite bucket/global inconsistente; timestamps reservados podían alterarse por HTTP. `service_role` necesitó grants SQL explícitos para setup/cleanup servidor, sin exposición al cliente.

## Advisory transitivo pendiente

Next.js 16.2.10 instala `postcss@8.4.31`, afectado por GHSA-qx2v-qp2m-jg93 (`postcss <8.5.10`), XSS moderado al serializar una secuencia `</style>` sin escapar. `npm audit` sólo propone `--force` hacia Next 9.3.3, un cambio incompatible y regresivo; no existe actualmente una actualización compatible ofrecida por npm y no se hará downgrade de Next.js.

Mitigación: no interpolar contenido no confiable dentro de CSS ni de tags `<style>`. Se prohíbe `npm audit fix --force`. Hay que volver a revisar el advisory y la dependencia transitiva al actualizar Next.js. El `postcss@8.5.18` de Tailwind no está afectado; el vulnerable es el anidado en Next.

## Políticas por recurso

- `profiles`: `profiles read own or staff`, `profiles update own safe fields`.
- `categories`: `active categories public read`, `staff manages categories`.
- `brands`: `active brands public read`, `staff manages brands`.
- `models`: `active models public read`, `staff manages models`.
- `listings`: `published listings public read`, `owners read own listings`, `staff read all listings`, `owners create drafts`, `owners update editable listings`, `staff update listings`.
- `listing_media`: `published listing media public read`, `owners read own listing media`, `staff read all listing media`, `owners manage editable media`, `staff manages media`.
- `listing_status_history`: `history visible to owner or staff`; no insert/update/delete para clientes.
- `staff_notes`: `notes staff only`.
- `storage.objects`: `published storage media public read`, `owners read own storage media`, `staff read all storage media`, `owners upload own listing media`, `owners edit own listing media`, `owners delete own listing media`.

No queda ningún grant de ejecución a `anon` sobre funciones internas. `authenticated` sólo ejecuta lectura de rol y los RPC controlados de transición/asignación.

## Superficies protegidas y Auth

- Usuario: `/cuenta`, `/cuenta/anuncios`, `/cuenta/anuncios/nuevo`, `/cuenta/anuncios/[id]/editar` mediante layout servidor.
- Staff: `/staff`, `/staff/anuncios`, `/staff/anuncios/[id]`, `/staff/taxonomia`; layout y cada page exigen `staff|admin`.
- Admin: `/staff/usuarios` exige `admin` de nuevo en la page.
- Acciones: `signIn`, `signUp`, `resetPassword`, `updatePassword`; callback GET intercambia código por sesión y sólo redirige a paths internos.
- Logout: Server Action elimina la sesión; el guard de `/cuenta` vuelve a enviar a login.
- E2E: service role/DB sólo existen en el runner Node. La aplicación servida recibe únicamente URL de Supabase, publishable key y site URL públicas.
