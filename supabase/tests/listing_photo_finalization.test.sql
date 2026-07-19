begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('51515151-5151-4515-8515-515151515151','00000000-0000-0000-0000-000000000000','authenticated','authenticated','photo-a@example.test','x',now(),'{}','{}',now(),now()),
('52525252-5252-4525-8525-525252525252','00000000-0000-0000-0000-000000000000','authenticated','authenticated','photo-b@example.test','x',now(),'{}','{}',now(),now());

insert into public.listings(id,owner_id,title) values
('61616161-6161-4616-8616-616161616161','51515151-5151-4515-8515-515151515151','Fotos draft'),
('62626262-6262-4626-8626-626262626262','52525252-5252-4525-8525-525252525252','Draft ajeno'),
('63636363-6363-4636-8636-636363636363','51515151-5151-4515-8515-515151515151','Limite');
insert into public.listings(id,owner_id,title,status) values
('64646464-6464-4646-8646-646464646464','51515151-5151-4515-8515-515151515151','Fuera de draft','submitted');

insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at) values
('71717171-7171-4717-8717-717171717171','61616161-6161-4616-8616-616161616161','51515151-5151-4515-8515-515151515151','61616161-6161-4616-8616-616161616161/71717171-7171-4717-8717-717171717171.jpg','image/jpeg',100,now()+interval '10 minutes'),
('72727272-7272-4727-8727-727272727272','61616161-6161-4616-8616-616161616161','51515151-5151-4515-8515-515151515151','61616161-6161-4616-8616-616161616161/72727272-7272-4727-8727-727272727272.png','image/png',200,now()+interval '10 minutes'),
('73737373-7373-4737-8737-737373737373','61616161-6161-4616-8616-616161616161','51515151-5151-4515-8515-515151515151','61616161-6161-4616-8616-616161616161/73737373-7373-4737-8737-737373737373.webp','image/webp',300,now()+interval '10 minutes'),
('74747474-7474-4747-8747-747474747474','64646464-6464-4646-8646-646464646464','51515151-5151-4515-8515-515151515151','64646464-6464-4646-8646-646464646464/74747474-7474-4747-8747-747474747474.jpg','image/jpeg',400,now()+interval '10 minutes');
insert into storage.objects(bucket_id,name) values
('listing-media','61616161-6161-4616-8616-616161616161/71717171-7171-4717-8717-717171717171.jpg'),
('listing-media','61616161-6161-4616-8616-616161616161/72727272-7272-4727-8727-727272727272.png'),
('listing-media','61616161-6161-4616-8616-616161616161/73737373-7373-4737-8737-737373737373.webp'),
('listing-media','64646464-6464-4646-8646-646464646464/74747474-7474-4747-8747-747474747474.jpg');

select lives_ok(
  $$select * from public.finalize_listing_photo_upload('71717171-7171-4717-8717-717171717171','51515151-5151-4515-8515-515151515151','image/jpeg',100,1200,800)$$,
  '1 primera fotografia finaliza'
);
select ok((select is_cover and sort_order=0 from public.listing_media where storage_path like '%71717171%'), '2 primera fotografia es portada con orden cero');
select is((select count(*) from public.listing_photo_uploads where id='71717171-7171-4717-8717-717171717171'), 0::bigint, '3 reserva finalizada se consume');

select lives_ok(
  $$select * from public.finalize_listing_photo_upload('72727272-7272-4727-8727-727272727272','51515151-5151-4515-8515-515151515151','image/png',200,1000,700)$$,
  '4 segunda fotografia finaliza'
);
select ok((select not is_cover and sort_order=1 from public.listing_media where storage_path like '%72727272%'), '5 fotografias posteriores reciben orden consecutivo');
select is((select count(*) from public.listing_media where listing_id='61616161-6161-4616-8616-616161616161' and is_cover), 1::bigint, '6 nunca crea dos portadas');
select throws_ok(
  $$select * from public.finalize_listing_photo_upload('72727272-7272-4727-8727-727272727272','51515151-5151-4515-8515-515151515151','image/png',200,1000,700)$$,
  'P0001','Upload reservation not available','7 reserva consumida no se reutiliza'
);
select throws_ok(
  $$select * from public.finalize_listing_photo_upload('73737373-7373-4737-8737-737373737373','52525252-5252-4525-8525-525252525252','image/webp',300,800,600)$$,
  'P0001','Upload reservation not available','8 finalizacion ajena falla'
);
select throws_ok(
  $$select * from public.finalize_listing_photo_upload('74747474-7474-4747-8747-747474747474','51515151-5151-4515-8515-515151515151','image/jpeg',400,800,600)$$,
  'P0001','Listing is not an editable draft','9 finalizacion fuera de draft falla'
);

insert into public.listing_media(id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover)
select md5('media-'||position)::uuid,
       '63636363-6363-4636-8636-636363636363',
       '63636363-6363-4636-8636-636363636363/'||md5('media-'||position)::uuid||'.jpg',
       'image','image/jpeg',100,100,100,'51515151-5151-4515-8515-515151515151',position,position=0
from generate_series(0,19) as position;
insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at) values
('75757575-7575-4757-8757-757575757575','63636363-6363-4636-8636-636363636363','51515151-5151-4515-8515-515151515151','63636363-6363-4636-8636-636363636363/75757575-7575-4757-8757-757575757575.jpg','image/jpeg',500,now()+interval '10 minutes');
insert into storage.objects(bucket_id,name) values('listing-media','63636363-6363-4636-8636-636363636363/75757575-7575-4757-8757-757575757575.jpg');
select throws_ok(
  $$select * from public.finalize_listing_photo_upload('75757575-7575-4757-8757-757575757575','51515151-5151-4515-8515-515151515151','image/jpeg',500,800,600)$$,
  'P0001','Listing photo limit reached','10 finalizacion no excede veinte fotografias'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','51515151-5151-4515-8515-515151515151',true);
select throws_ok(
  $$select * from public.finalize_listing_photo_upload('73737373-7373-4737-8737-737373737373','51515151-5151-4515-8515-515151515151','image/webp',300,800,600)$$,
  '42501',null,'11 authenticated no ejecuta finalizacion privilegiada'
);
reset role;
select ok(
  pg_get_functiondef('public.finalize_listing_photo_upload(uuid,uuid,text,bigint,integer,integer)'::regprocedure) ilike '%for update%'
  and exists (
    select 1 from pg_constraint
    where conrelid='public.listing_media'::regclass
      and conname='listing_media_listing_sort_unique'
      and condeferrable
  ),
  '12 bloqueo del listing y unicidad protegen orden y portada bajo concurrencia'
);

select * from finish();
rollback;
