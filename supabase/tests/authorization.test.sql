begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

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
select throws_ok($$delete from public.listings where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning id$$, '42501', null, '11b usuario no elimina anuncios directamente');
select throws_ok($$insert into public.listings(owner_id,title,status) values('11111111-1111-4111-8111-111111111111','Publicado falso','published')$$, '42501', null, '12 usuario no publica al insertar');
select throws_ok($$update public.listings set is_featured=true where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved editorial fields cannot be changed', '13 usuario no activa featured');
select throws_ok($$update public.listings set editorial_description='Editorial falsa' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved editorial fields cannot be changed', '14 usuario no edita campo editorial');
select throws_ok($$update public.listings set created_at='2000-01-01' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved timestamps cannot be changed', 'usuario no altera created_at');
select throws_ok($$update public.listings set updated_at='2000-01-01' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'P0001', 'Reserved timestamps cannot be changed', 'usuario no altera updated_at');
select throws_ok($$update public.listings set status='published' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, '42501', null, '15 update directo de estado falla');
select lives_ok($$select public.transition_listing('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','submitted')$$, 'usuario envia borrador');
select throws_ok($$delete from public.listings where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id$$, '42501', null, '15b usuario no elimina enviado directamente');

reset role;
insert into public.listings(id,owner_id,title) values('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1','11111111-1111-4111-8111-111111111111','Borrador eliminable');
insert into public.listing_media(
  id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by
) values(
  'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2','f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
  'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1/f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2.jpg',
  'image','image/jpeg',1,1,1,'11111111-1111-4111-8111-111111111111'
);
insert into public.listing_status_history(listing_id,from_status,to_status,actor_id) values('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1','draft','draft','11111111-1111-4111-8111-111111111111');
insert into public.staff_notes(listing_id,author_id,body) values('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1','33333333-3333-4333-8333-333333333333','Nota vinculada');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$delete from public.listings where id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'$$, '42501', null, '15c usuario no evita limpieza coordinada con DELETE directo');
reset role;
delete from public.listings where id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
select is((select count(*) from public.listings where id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'), 0::bigint, '15d draft eliminado desaparece');
select is((select count(*) from public.listing_media where listing_id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'), 0::bigint, '15e media relacional se elimina en cascada');
select is((select count(*) from public.listing_status_history where listing_id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1') + (select count(*) from public.staff_notes where listing_id='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'), 0::bigint, '15f relaciones dependientes se eliminan en cascada');

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
select set_config('app.test_reservation_id', reservation_id::text, false),
       set_config('app.test_reservation_path', storage_path, false)
from public.reserve_listing_photo_upload(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','image/jpeg',1024,'jpg'
);
select lives_ok($$insert into storage.objects(bucket_id,name) values('listing-media',current_setting('app.test_reservation_path'))$$, '21 propietario carga solamente en path reservado');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('listing-media','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/88888888-8888-4888-8888-888888888888.jpg')$$, '42501', null, '22 usuario no escribe path ajeno');
select is((select count(*) from storage.objects where name like 'eeeeeeee%'), 0::bigint, '23 usuario no lee archivo privado ajeno');
set local role anon;
select is((select count(*) from storage.objects where name like 'eeeeeeee%'), 0::bigint, '24 publico no lee medios privados');

reset role;
select ok((select not public and file_size_limit=10485760 and allowed_mime_types = array['image/jpeg','image/png','image/webp'] from storage.buckets where id='listing-media'), '25 bucket privado aplica limite y tipos de fotografias');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('listing-media','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/foto-original.jpg')$$, '42501', null, '26 path exige UUID aleatorio, no nombre original');

select lives_ok($$
  update public.listings set
    year=2016,
    brand_id=(select id from public.brands where slug='mazda'),
    model_id=(select m.id from public.models m join public.brands b on b.id=m.brand_id where b.slug='mazda' and m.slug='mx-5'),
    variant='Grand Touring', price_mxn=420000, mileage_km=55000,
    owner_description='Historia real', ownership_history='Dos propietarios', maintenance_history='Servicios al día'
  where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
$$, '30 propietario guarda datos permitidos del borrador');
select is((select title from public.listings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), '2016 Mazda MX-5 Grand Touring', '31 titulo provisional se deriva en base');
select throws_ok($$
  update public.listings set
    brand_id=(select id from public.brands where slug='ford'),
    model_id=(select m.id from public.models m join public.brands b on b.id=m.brand_id where b.slug='mazda' and m.slug='mx-5')
  where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
$$, 'P0001', 'Model must be active and belong to brand', '32 marca y modelo incompatibles fallan');
select throws_ok($$update public.listings set price_mxn=-1 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$, '23514', null, '33 precio negativo falla');
select throws_ok($$update public.listings set mileage_km=-1 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$, '23514', null, '34 kilometraje negativo falla');

reset role;
insert into public.categories(name,slug,active) values('Inactiva test','inactiva-test',false);
insert into public.brands(name,slug,active) values('Inactiva test','inactiva-test',false);
insert into public.brands(name,slug,active) values('Activa test','activa-test',true);
insert into public.models(brand_id,name,slug,active)
select id,'Inactivo test','inactivo-test',false from public.brands where slug='activa-test';
select set_config('app.test_inactive_category', (select id::text from public.categories where slug='inactiva-test'), false);
select set_config('app.test_inactive_brand', (select id::text from public.brands where slug='inactiva-test'), false);
select set_config('app.test_active_brand', (select id::text from public.brands where slug='activa-test'), false);
select set_config('app.test_inactive_model', (select id::text from public.models where slug='inactivo-test'), false);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok($$update public.listings set category_id=current_setting('app.test_inactive_category')::bigint where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$, 'P0001', 'Category must be active', '35 categoria inactiva falla');
select throws_ok($$update public.listings set brand_id=current_setting('app.test_inactive_brand')::bigint, model_id=null where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$, 'P0001', 'Brand must be active', '36 marca inactiva falla');
select throws_ok($$update public.listings set brand_id=current_setting('app.test_active_brand')::bigint, model_id=current_setting('app.test_inactive_model')::bigint where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$, 'P0001', 'Model must be active and belong to brand', '37 modelo inactivo falla');
select is((select status::text from public.listings where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'draft', '38 guardar no modifica estado');
select is_empty($$update public.listings set variant='No permitido' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id$$, '39 anuncio no editable rechaza actualizacion del propietario');

-- Fundación de fotografías: reservas estrechas, límite y grants mínimos.
select throws_ok(
  $$select * from public.reserve_listing_photo_upload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','image/gif',1024,'gif')$$,
  'P0001', 'Invalid image MIME type', '40 reserva rechaza MIME no permitido'
);
select throws_ok(
  $$select * from public.reserve_listing_photo_upload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','image/png',0,'png')$$,
  'P0001', 'Invalid image size', '41 reserva rechaza tamano cero'
);
select throws_ok(
  $$select * from public.reserve_listing_photo_upload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','image/webp',10485761,'webp')$$,
  'P0001', 'Invalid image size', '42 reserva rechaza mas de 10 MiB'
);

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select throws_ok(
  $$select * from public.reserve_listing_photo_upload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','image/jpeg',1024,'jpg')$$,
  'P0001', 'Listing not available', '43 usuario no reserva para anuncio ajeno'
);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok(
  $$select * from public.reserve_listing_photo_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','image/jpeg',1024,'jpg')$$,
  'P0001', 'Listing is not an editable draft', '44 propietario no reserva fuera de draft'
);
select throws_ok(
  $$insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at) values(gen_random_uuid(),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/77777777-7777-4777-8777-777777777777.jpg','image/jpeg',1024,now()+interval '5 minutes')$$,
  '42501', null, '45 usuario no crea reservas mediante DML'
);
select throws_ok(
  $$insert into public.listing_media(listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/66666666-6666-4666-8666-666666666666.jpg','image','image/jpeg',1024,1,1,'11111111-1111-4111-8111-111111111111')$$,
  '42501', null, '46 usuario no escribe listing_media directamente'
);

reset role;
select ok((
  select requested_by='11111111-1111-4111-8111-111111111111'
    and listing_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    and storage_path ~ '^eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/[0-9a-f-]{36}\.jpg$'
  from public.listing_photo_uploads
  where id=current_setting('app.test_reservation_id')::uuid
), '47 RPC deriva usuario y genera ID/path internamente');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('app.cancel_reservation_id', reservation_id::text, false)
from public.reserve_listing_photo_upload('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','image/png',2048,'png');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is(public.cancel_listing_photo_upload(current_setting('app.cancel_reservation_id')::uuid), false, '48 usuario no cancela reserva ajena');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is(public.cancel_listing_photo_upload(current_setting('app.cancel_reservation_id')::uuid), true, '49 propietario cancela su reserva no consumida');

reset role;
insert into public.listing_media(
  id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order
) values(
  'abababab-abab-4bab-8bab-abababababab','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/abababab-abab-4bab-8bab-abababababab.jpg',
  'image','image/jpeg',1024,1,1,'11111111-1111-4111-8111-111111111111',0
);
insert into storage.objects(bucket_id,name)
values('listing-media','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/abababab-abab-4bab-8bab-abababababab.jpg');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select is((select count(*) from public.listing_media where id='abababab-abab-4bab-8bab-abababababab'), 1::bigint, '50 staff lee metadatos para revision futura');
select throws_ok(
  $$update public.listing_media set is_cover=true where id='abababab-abab-4bab-8bab-abababababab'$$,
  '42501', null, '51 staff no modifica listing_media directamente'
);
select is((select count(*) from storage.objects where name='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/abababab-abab-4bab-8bab-abababababab.jpg'), 1::bigint, '52 staff lee objetos ya vinculados para revision futura');
select is_empty(
  $$update storage.objects set metadata='{}'::jsonb where name='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/abababab-abab-4bab-8bab-abababababab.jpg' returning id$$,
  '53 staff no modifica objetos directamente'
);
set local role anon;
select is((select count(*) from storage.objects where name='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/abababab-abab-4bab-8bab-abababababab.jpg'), 0::bigint, '54 anon no lee siquiera objetos vinculados');

reset role;
select set_config('app.expired_reservation_path', storage_path, false),
       set_config('app.expired_reservation_id', id::text, false)
from public.listing_photo_uploads
where id=current_setting('app.test_reservation_id')::uuid;
update public.listing_photo_uploads
set created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour'
where id=current_setting('app.expired_reservation_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok(
  $$insert into storage.objects(bucket_id,name) values('listing-media',current_setting('app.expired_reservation_path'))$$,
  '42501', null, '55 reserva expirada no autoriza subida'
);

reset role;
insert into public.listings(id,owner_id,title) values('12121212-1212-4212-8212-121212121212','11111111-1111-4111-8111-111111111111','Limite fotos');
insert into public.listing_media(
  id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order
) values(
  '13131313-1313-4313-8313-131313131313','12121212-1212-4212-8212-121212121212',
  '12121212-1212-4212-8212-121212121212/13131313-1313-4313-8313-131313131313.jpg',
  'image','image/jpeg',1024,1,1,'11111111-1111-4111-8111-111111111111',0
);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select lives_ok($$
  do $reserve$
  begin
    for reservation_number in 1..19 loop
      perform * from public.reserve_listing_photo_upload(
        '12121212-1212-4212-8212-121212121212','image/webp',1024,'webp'
      );
    end loop;
  end
  $reserve$
$$, '56 permite completar 20 espacios contando medios y reservas vigentes');
reset role;
select is(
  (select count(*) from public.listing_media where listing_id='12121212-1212-4212-8212-121212121212')
  +
  (select count(*) from public.listing_photo_uploads where listing_id='12121212-1212-4212-8212-121212121212' and expires_at > now()),
  20::bigint,
  '57 contador combina fotografias existentes y reservas vigentes'
);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select throws_ok(
  $$select * from public.reserve_listing_photo_upload('12121212-1212-4212-8212-121212121212','image/webp',1024,'webp')$$,
  'P0001', 'Listing photo limit reached', '58 reserva numero 21 es rechazada'
);

reset role;
select ok((
  select condeferrable and condeferred
  from pg_constraint
  where conrelid='public.listing_media'::regclass
    and conname='listing_media_listing_sort_unique'
), '59 orden por anuncio tiene unicidad diferible');

select * from finish();
rollback;
