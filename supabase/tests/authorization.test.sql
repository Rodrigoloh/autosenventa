begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user1@example.test', 'not-a-real-password', now(), '{}', '{"role":"admin"}', now(), now()),
('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user2@example.test', 'not-a-real-password', now(), '{}', '{}', now(), now()),
('33333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@example.test', 'not-a-real-password', now(), '{}', '{}', now(), now()),
('44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', 'not-a-real-password', now(), '{}', '{}', now(), now());

select set_config('app.role_change', 'allowed', true);
update public.profiles set role='staff' where id='33333333-3333-4333-8333-333333333333';
update public.profiles set role='admin' where id='44444444-4444-4444-8444-444444444444';
select set_config('app.role_change', '', true);

select ok(exists(select 1 from public.profiles where id='11111111-1111-4111-8111-111111111111'), '1 registro crea perfil');
select is((select role::text from public.profiles where id='11111111-1111-4111-8111-111111111111'), 'user', '7 metadata del navegador no define rol');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$update public.profiles set display_name='Propietario' where id='11111111-1111-4111-8111-111111111111'$$, '2 usuario modifica campo publico propio');
select throws_ok($$update public.profiles set role='admin' where id='11111111-1111-4111-8111-111111111111'$$, 'P0001', 'Use set_user_role to change roles', '3 usuario no cambia su rol');
select is_empty($$update public.profiles set role='admin' where id='22222222-2222-4222-8222-222222222222' returning id$$, '4 usuario no cambia rol ajeno');

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select throws_ok($$select public.set_user_role('22222222-2222-4222-8222-222222222222','staff')$$, 'P0001', 'Admin role required', '5 staff no asigna roles');
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select lives_ok($$select public.set_user_role('22222222-2222-4222-8222-222222222222','staff')$$, '6 admin asigna rol por funcion');
select public.set_user_role('22222222-2222-4222-8222-222222222222','user');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$insert into public.listings(id,owner_id,title) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Auto propio')$$, '8 usuario crea anuncio propio');
select throws_ok($$insert into public.listings(id,owner_id,title) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Ajeno')$$, '42501', null, '9 usuario no asigna propietario ajeno');

reset role;
insert into public.listings(id,owner_id,title) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','Borrador ajeno');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select count(*) from public.listings where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 0::bigint, '10 usuario no lee borrador ajeno');
select is_empty($$update public.listings set title='Manipulado' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning id$$, '11 usuario no edita anuncio ajeno');
select throws_ok($$insert into public.listings(owner_id,title,status) values('11111111-1111-4111-8111-111111111111','Publicado falso','published')$$, '42501', null, '12 usuario no publica al insertar');
select throws_ok($$update public.listings set is_featured=true where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved editorial fields cannot be changed', '13 usuario no activa featured');
select throws_ok($$update public.listings set editorial_description='Editorial falsa' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved editorial fields cannot be changed', '14 usuario no edita campo editorial');
select throws_ok($$update public.listings set created_at='2000-01-01' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved timestamps cannot be changed', 'usuario no altera created_at');
select throws_ok($$update public.listings set updated_at='2000-01-01' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved timestamps cannot be changed', 'usuario no altera updated_at');
select throws_ok($$update public.listings set status='published' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, '42501', null, '15 update directo de estado falla');
select lives_ok($$select public.transition_listing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','submitted')$$, 'usuario envia borrador');

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*) from public.listings where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1::bigint, '17 staff lee anuncio enviado');
select lives_ok($$select public.transition_listing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','in_review')$$, '18 staff ejecuta transicion valida');
select throws_ok($$select public.transition_listing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','published')$$, 'P0001', 'Invalid status transition', '19 transicion invalida falla');
select is((select count(*) from public.listing_status_history where listing_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 2::bigint, '20 cada transicion crea historial');

reset role;
insert into public.listings(id,owner_id,title,status) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Publicado real','published');
set local role anon;
select is((select count(*) from public.listings), 1::bigint, '16 publico solo lee publicados');

reset role;
insert into public.listings(id,owner_id,title) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','Medios privados');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$insert into storage.objects(bucket_id,name) values('listing-media','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/99999999-9999-4999-8999-999999999999.jpg')$$, '21 propietario carga en path autorizado');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('listing-media','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/88888888-8888-4888-8888-888888888888.jpg')$$, '42501', null, '22 usuario no escribe path ajeno');
select is((select count(*) from storage.objects where name like 'eeeeeeee%'), 0::bigint, '23 usuario no lee archivo privado ajeno');
set local role anon;
select is((select count(*) from storage.objects where name like 'eeeeeeee%'), 0::bigint, '24 publico no lee medios privados');

reset role;
select ok((select file_size_limit=52428800 and allowed_mime_types @> array['image/jpeg','video/mp4'] from storage.buckets where id='listing-media'), '25 bucket aplica tamano y tipos documentados');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('listing-media','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/foto-original.jpg')$$, '42501', null, '26 path exige UUID aleatorio, no nombre original');

select * from finish();
rollback;
