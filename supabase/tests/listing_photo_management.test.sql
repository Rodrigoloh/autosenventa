begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('81818181-8181-4818-8818-818181818181','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manage-a@example.test','x',now(),'{}','{}',now(),now()),
('82828282-8282-4828-8828-828282828282','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manage-b@example.test','x',now(),'{}','{}',now(),now());

insert into public.listings(id,owner_id,title) values
('91919191-9191-4919-8919-919191919191','81818181-8181-4818-8818-818181818181','Administrar fotos'),
('92929292-9292-4929-8929-929292929292','82828282-8282-4828-8828-828282828282','Fotos ajenas'),
('94949494-9494-4949-8949-949494949494','81818181-8181-4818-8818-818181818181','Eliminar completo'),
('95959595-9595-4959-8959-959595959595','81818181-8181-4818-8818-818181818181','Vacío');
insert into public.listings(id,owner_id,title,status) values
('93939393-9393-4939-8939-939393939393','81818181-8181-4818-8818-818181818181','Fuera de draft','submitted');

insert into public.listing_media(id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover) values
('a1111111-1111-4111-8111-111111111111','91919191-9191-4919-8919-919191919191','91919191-9191-4919-8919-919191919191/a1111111-1111-4111-8111-111111111111.jpg','image','image/jpeg',100,10,10,'81818181-8181-4818-8818-818181818181',0,true),
('a2222222-2222-4222-8222-222222222222','91919191-9191-4919-8919-919191919191','91919191-9191-4919-8919-919191919191/a2222222-2222-4222-8222-222222222222.jpg','image','image/jpeg',100,10,10,'81818181-8181-4818-8818-818181818181',1,false),
('a3333333-3333-4333-8333-333333333333','91919191-9191-4919-8919-919191919191','91919191-9191-4919-8919-919191919191/a3333333-3333-4333-8333-333333333333.jpg','image','image/jpeg',100,10,10,'81818181-8181-4818-8818-818181818181',2,false),
('b1111111-1111-4111-8111-111111111111','92929292-9292-4929-8929-929292929292','92929292-9292-4929-8929-929292929292/b1111111-1111-4111-8111-111111111111.jpg','image','image/jpeg',100,10,10,'82828282-8282-4828-8828-828282828282',0,true),
('c1111111-1111-4111-8111-111111111111','93939393-9393-4939-8939-939393939393','93939393-9393-4939-8939-939393939393/c1111111-1111-4111-8111-111111111111.jpg','image','image/jpeg',100,10,10,'81818181-8181-4818-8818-818181818181',0,true),
('d1111111-1111-4111-8111-111111111111','94949494-9494-4949-8949-949494949494','94949494-9494-4949-8949-949494949494/d1111111-1111-4111-8111-111111111111.jpg','image','image/jpeg',100,10,10,'81818181-8181-4818-8818-818181818181',0,true);

insert into storage.objects(bucket_id,name) select 'listing-media',storage_path from public.listing_media;
insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at) values
('d2222222-2222-4222-8222-222222222222','94949494-9494-4949-8949-949494949494','81818181-8181-4818-8818-818181818181','94949494-9494-4949-8949-949494949494/d2222222-2222-4222-8222-222222222222.png','image/png',200,now()+interval '10 minutes');
insert into storage.objects(bucket_id,name) values
('listing-media','94949494-9494-4949-8949-949494949494/d2222222-2222-4222-8222-222222222222.png');

set local role authenticated;
select set_config('request.jwt.claim.sub','81818181-8181-4818-8818-818181818181',true);
select throws_ok($$delete from public.listings where id='91919191-9191-4919-8919-919191919191'$$,'42501',null,'1 navegador no elimina listings directamente');
select throws_ok($$update public.listings set deletion_started_at=now() where id='91919191-9191-4919-8919-919191919191'$$,'P0001','Use the draft deletion functions','2 navegador no escribe marcador de borrado');
select lives_ok($$select public.set_listing_photo_cover('a2222222-2222-4222-8222-222222222222')$$,'3 propietario elige portada');
select ok((select count(*)=1 and bool_and(id='a2222222-2222-4222-8222-222222222222') from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191' and is_cover),'4 queda exactamente la portada elegida');
select throws_ok($$select public.set_listing_photo_cover('b1111111-1111-4111-8111-111111111111')$$,'P0001','Photo not available','5 no elige portada ajena');
select throws_ok($$select public.set_listing_photo_cover('c1111111-1111-4111-8111-111111111111')$$,'P0001','Listing is not an editable draft','6 no administra fuera de draft');
select lives_ok($$select public.reorder_listing_photos('91919191-9191-4919-8919-919191919191',array['a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222']::uuid[])$$,'7 acepta conjunto completo reordenado');
select is((select array_agg(id order by sort_order) from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191'),array['a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222']::uuid[],'8 persiste orden compacto');
select is((select id from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191' and is_cover),'a2222222-2222-4222-8222-222222222222'::uuid,'9 reordenar preserva portada');
select throws_ok($$select public.reorder_listing_photos('91919191-9191-4919-8919-919191919191',array['a1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333']::uuid[])$$,'P0001','Complete photo order does not match listing','10 rechaza duplicados');
select throws_ok($$select public.reorder_listing_photos('91919191-9191-4919-8919-919191919191',array['a1111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333']::uuid[])$$,'P0001','Complete photo order does not match listing','11 rechaza omisiones');
select throws_ok($$select public.reorder_listing_photos('91919191-9191-4919-8919-919191919191',array['a1111111-1111-4111-8111-111111111111','a3333333-3333-4333-8333-333333333333','b1111111-1111-4111-8111-111111111111']::uuid[])$$,'P0001','Complete photo order does not match listing','12 rechaza IDs ajenos');
select throws_ok($$delete from public.listing_media where id='a1111111-1111-4111-8111-111111111111'$$,'42501',null,'13 navegador no elimina metadata directamente');
select lives_ok($$select * from public.prepare_listing_photo_deletion('a2222222-2222-4222-8222-222222222222')$$,'14 prepara borrado propio por mediaId');
select throws_ok($$select public.set_listing_photo_cover('a1111111-1111-4111-8111-111111111111')$$,'P0001','Photo deletion in progress','15 bloquea administración concurrente');
select throws_ok($$select * from public.prepare_listing_photo_deletion('b1111111-1111-4111-8111-111111111111')$$,'P0001','Photo not available','16 no prepara borrado ajeno');

reset role;
select set_config('storage.allow_delete_query','true',true);
delete from storage.objects where name='91919191-9191-4919-8919-919191919191/a2222222-2222-4222-8222-222222222222.jpg';
select set_config('storage.allow_delete_query','false',true);
select lives_ok($$select * from public.finalize_listing_photo_deletion('a2222222-2222-4222-8222-222222222222','81818181-8181-4818-8818-818181818181')$$,'17 servicio finaliza tras borrar objeto');
select is((select count(*) from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191'),2::bigint,'18 elimina fila de media');
select is((select array_agg(sort_order order by sort_order) from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191'),array[0,1],'19 compacta orden después de eliminar');
select ok((select count(*)=1 from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191' and is_cover) and (select is_cover from public.listing_media where listing_id='91919191-9191-4919-8919-919191919191' order by sort_order limit 1),'20 reasigna portada a la primera');
select is((select count(*) from storage.objects where name like '91919191-9191-4919-8919-919191919191/%a2222222%'),0::bigint,'21 objeto individual desaparece');

set local role authenticated;
select set_config('request.jwt.claim.sub','81818181-8181-4818-8818-818181818181',true);
select lives_ok($$select public.begin_draft_deletion('94949494-9494-4949-8949-949494949494')$$,'22 inicia borrado total propio');
select ok((select deletion_started_at is not null from public.listings where id='94949494-9494-4949-8949-949494949494'),'23 persiste marcador de borrado');
select throws_ok($$select * from public.reserve_listing_photo_upload('94949494-9494-4949-8949-949494949494','image/png',200,'png')$$,'P0001','Draft deletion in progress','24 bloquea nuevas reservas');
select is(public.can_upload_reserved_listing_photo('94949494-9494-4949-8949-949494949494/d2222222-2222-4222-8222-222222222222.png'),false,'25 bloquea upload de reserva previa');
select throws_ok($$select * from public.prepare_listing_photo_deletion('d1111111-1111-4111-8111-111111111111')$$,'P0001','Draft deletion in progress','26 bloquea operaciones individuales');
reset role;
select throws_ok($$select * from public.finalize_listing_photo_upload('d2222222-2222-4222-8222-222222222222','81818181-8181-4818-8818-818181818181','image/png',200,10,10)$$,'P0001','Draft deletion in progress','27 bloquea finalización de reserva previa');
select throws_ok($$select public.finalize_draft_deletion('94949494-9494-4949-8949-949494949494','81818181-8181-4818-8818-818181818181')$$,'P0001','Draft storage prefix is not empty','28 no borra DB mientras queden objetos');
select set_config('storage.allow_delete_query','true',true);
delete from storage.objects where bucket_id='listing-media' and name like '94949494-9494-4949-8949-949494949494/%';
select set_config('storage.allow_delete_query','false',true);
select lives_ok($$select public.finalize_draft_deletion('94949494-9494-4949-8949-949494949494','81818181-8181-4818-8818-818181818181')$$,'29 finaliza borrado con prefijo vacío');
select is((select count(*) from public.listings where id='94949494-9494-4949-8949-949494949494')+(select count(*) from public.listing_media where listing_id='94949494-9494-4949-8949-949494949494')+(select count(*) from public.listing_photo_uploads where listing_id='94949494-9494-4949-8949-949494949494'),0::bigint,'30 elimina listing, media y reservas');
select is((select count(*) from storage.objects where name like '94949494-9494-4949-8949-949494949494/%'),0::bigint,'31 deja prefijo vacío');

set local role authenticated;
select set_config('request.jwt.claim.sub','81818181-8181-4818-8818-818181818181',true);
select throws_ok($$select public.begin_draft_deletion('93939393-9393-4939-8939-939393939393')$$,'P0001','Listing is not a deletable draft','32 no elimina fuera de draft');
select throws_ok($$select public.finalize_draft_deletion('95959595-9595-4959-8959-959595959595','81818181-8181-4818-8818-818181818181')$$,'42501',null,'33 authenticated no ejecuta finalizador privilegiado');
select throws_ok($$delete from storage.objects where bucket_id='listing-media' and name like '91919191-9191-4919-8919-919191919191/%' returning id$$,'42501',null,'34 navegador no elimina objetos arbitrarios');
reset role;
select ok(
  pg_get_functiondef('public.reorder_listing_photos(uuid,uuid[])'::regprocedure) ilike '%for update%'
  and pg_get_functiondef('public.prepare_listing_photo_deletion(uuid)'::regprocedure) ilike '%for update%'
  and pg_get_functiondef('public.begin_draft_deletion(uuid)'::regprocedure) ilike '%for update%'
  and exists (select 1 from pg_trigger where tgname='enforce_listing_photo_cover_deferred' and tgdeferrable and tginitdeferred),
  '35 locks serializan operaciones y trigger diferible exige portada exacta'
);

select * from finish();
rollback;
