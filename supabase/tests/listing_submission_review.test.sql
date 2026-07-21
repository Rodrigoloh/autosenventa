begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-owner@example.test','x',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-other@example.test','x',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-staff@example.test','x',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-admin@example.test','x',now(),'{}','{}',now(),now());
select set_config('app.role_change','allowed',true);
update public.profiles set role='staff' where id='91000000-0000-4000-8000-000000000003';
update public.profiles set role='admin' where id='91000000-0000-4000-8000-000000000004';
select set_config('app.role_change','',true);
select set_config('app.username_assignment','allowed',true);
update public.profiles set username=case id
  when '91000000-0000-4000-8000-000000000001' then 'phase4owner'
  when '91000000-0000-4000-8000-000000000002' then 'phase4other'
  when '91000000-0000-4000-8000-000000000003' then 'phase4staff'
  else 'phase4admin' end
where id::text like '91000000%';
select set_config('app.username_assignment','',true);

insert into public.listings(id,owner_id,title,category_id,brand_id,model_id,year,price_mxn,mileage_km,city,state_region,
 exterior_color,body_style,transmission,fuel_type,owner_description,ownership_history,maintenance_history,modifications,known_issues)
select '92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','Fase 4',
 c.id,b.id,m.id,2020,500000,30000,'Guadalajara','Jalisco','Rojo','Convertible','Manual','Gasolina',
 repeat('Descripción completa ',8),repeat('Historia de propiedad ',4),repeat('Mantenimiento documentado ',2),'Sin modificaciones','Ninguno'
from public.categories c, public.brands b join public.models m on m.brand_id=b.id
where c.active and b.slug='mazda' and m.slug='mx-5' limit 1;

insert into storage.objects(bucket_id,name)
select 'listing-media','92000000-0000-4000-8000-000000000001/'||lpad(n::text,8,'0')||'-0000-4000-8000-000000000000.jpg'
from generate_series(1,8) n;
insert into public.listing_media(id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover)
select (lpad(n::text,8,'0')||'-0000-4000-8000-000000000000')::uuid,
 '92000000-0000-4000-8000-000000000001',
 '92000000-0000-4000-8000-000000000001/'||lpad(n::text,8,'0')||'-0000-4000-8000-000000000000.jpg',
 'image','image/jpeg',100,100,100,'91000000-0000-4000-8000-000000000001',n-1,n=1
from generate_series(1,8) n;

update public.listings set transmission=null where id='92000000-0000-4000-8000-000000000001';
select ok('missing_vehicle_fields'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'campos obligatorios del vehículo bloquean');
update public.listings set transmission='Manual',price_mxn=0 where id='92000000-0000-4000-8000-000000000001';
select ok('invalid_price'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'precio cero bloquea');
update public.listings set price_mxn=500000,city=null where id='92000000-0000-4000-8000-000000000001';
select ok('missing_location'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'ubicación incompleta bloquea');
update public.listings set city='Guadalajara',owner_description='corta' where id='92000000-0000-4000-8000-000000000001';
select ok('description_too_short'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'descripción corta bloquea');
update public.listings set owner_description=repeat('Descripción completa ',8),ownership_history='corta' where id='92000000-0000-4000-8000-000000000001';
select ok('ownership_history_too_short'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'historia de propiedad corta bloquea');
update public.listings set ownership_history=repeat('Historia de propiedad ',4),maintenance_history='corta' where id='92000000-0000-4000-8000-000000000001';
select ok('maintenance_history_too_short'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'mantenimiento corto bloquea');
update public.listings set maintenance_history=repeat('Mantenimiento documentado ',2),modifications=null where id='92000000-0000-4000-8000-000000000001';
select ok('missing_modifications_statement'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'declaración de modificaciones bloquea');
update public.listings set modifications='Sin modificaciones',known_issues=null where id='92000000-0000-4000-8000-000000000001';
select ok('missing_known_issues_statement'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'declaración de problemas bloquea');
update public.listings set known_issues='Ninguno' where id='92000000-0000-4000-8000-000000000001';
delete from public.listing_media where id='00000008-0000-4000-8000-000000000000';
select ok('insufficient_photos'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'siete fotos bloquean');
insert into public.listing_media(id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover)
values('00000008-0000-4000-8000-000000000000','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001/00000008-0000-4000-8000-000000000000.jpg','image','image/jpeg',100,100,100,'91000000-0000-4000-8000-000000000001',7,false);
update public.listing_media set sort_order=9 where id='00000008-0000-4000-8000-000000000000';
select ok('invalid_photo_order'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'orden discontinuo bloquea');
update public.listing_media set sort_order=7,deletion_started_at=now() where id='00000008-0000-4000-8000-000000000000';
select ok('photo_operation_pending'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'eliminación de foto pendiente bloquea');
update public.listing_media set deletion_started_at=null where id='00000008-0000-4000-8000-000000000000';
insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at)
values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001/93000000-0000-4000-8000-000000000001.jpg','image/jpeg',100,now()+interval '1 hour');
select ok('photo_operation_pending'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'reserva pendiente bloquea');
delete from public.listing_photo_uploads where id='93000000-0000-4000-8000-000000000001';
select ok('missing_attestations'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',false,true,true,true,'2026-07-20-v1')),'declaraciones incompletas bloquean');
insert into public.listing_media(id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover)
values('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001/94000000-0000-4000-8000-000000000001.jpg','image','image/jpeg',100,100,100,'91000000-0000-4000-8000-000000000001',8,false);
select ok('missing_storage_object'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'objeto privado faltante bloquea');
delete from public.listing_media where id='94000000-0000-4000-8000-000000000001';
select set_config('app.draft_deletion','allowed',true);
update public.listings set deletion_started_at=now() where id='92000000-0000-4000-8000-000000000001';
select set_config('app.draft_deletion','',true);
select ok('deletion_in_progress'=any(public.evaluate_listing_submission_readiness('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'eliminación total iniciada bloquea');
select set_config('app.draft_deletion','allowed',true);
update public.listings set deletion_started_at=null where id='92000000-0000-4000-8000-000000000001';
select set_config('app.draft_deletion','',true);

select ok(not has_function_privilege('authenticated','public.transition_listing(uuid,public.listing_status)','EXECUTE'),'RPC genérico no es ejecutable por authenticated');
select ok(not has_function_privilege('anon','public.transition_listing(uuid,public.listing_status)','EXECUTE'),'RPC genérico no es ejecutable por anon');
select ok(not exists (
  select 1 from pg_proc functions
  cross join lateral aclexplode(coalesce(functions.proacl, acldefault('f', functions.proowner))) privileges
  where functions.oid='public.transition_listing(uuid,public.listing_status)'::regprocedure
    and privileges.grantee=0 and privileges.privilege_type='EXECUTE'
),'PUBLIC no conserva EXECUTE sobre el RPC genérico');
select ok(has_function_privilege('authenticated','public.submit_listing_for_review(uuid,boolean,boolean,boolean,boolean,text)','EXECUTE'),'authenticated puede usar el RPC estrecho de envío');
select ok(has_function_privilege('authenticated','public.claim_listing_for_review(uuid)','EXECUTE'),'authenticated puede invocar claim, que valida rol internamente');

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is(public.get_listing_submission_readiness('92000000-0000-4000-8000-000000000001'),array[]::text[],'motor y tracción opcionales no bloquean readiness');
select is((select success from public.submit_listing_for_review('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),true,'propietario envía anuncio completo');
select is((select status::text from public.listings where id='92000000-0000-4000-8000-000000000001'),'submitted','estado queda submitted');
select is((select count(*) from public.listing_submissions where listing_id='92000000-0000-4000-8000-000000000001'),0::bigint,'propietario no lee tabla inmutable de submissions');
select is((select success from public.submit_listing_for_review('92000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),false,'doble envío no crea otra transición');
select is((select count(*) from public.listing_status_history where listing_id='92000000-0000-4000-8000-000000000001' and to_status='submitted'),1::bigint,'existe un solo historial de envío');
select is_empty($$update public.listings set city='Otra' where id='92000000-0000-4000-8000-000000000001' returning id$$,'propietario no edita después de enviar');
select throws_ok($$select public.set_listing_photo_cover('00000001-0000-4000-8000-000000000000')$$,'P0001','Listing is not an editable draft','propietario no administra portada después de enviar');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.claim_listing_for_review('92000000-0000-4000-8000-000000000001')$$,'P0001','Staff role required','usuario normal no toma revisión');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select is_empty($$update public.listings set city='Manipulada' where id='92000000-0000-4000-8000-000000000001' returning id$$,'staff no actualiza directamente el anuncio');
select is((select success from public.claim_listing_for_review('92000000-0000-4000-8000-000000000001')),true,'staff toma revisión');
select is((select reviewer_id from public.listings where id='92000000-0000-4000-8000-000000000001'),'91000000-0000-4000-8000-000000000003'::uuid,'reviewer_id conserva al ganador');
select is((select success from public.claim_listing_for_review('92000000-0000-4000-8000-000000000001')),false,'segunda toma pierde sin sobrescribir');
select is((select count(*) from public.listing_status_history where listing_id='92000000-0000-4000-8000-000000000001' and to_status='in_review'),1::bigint,'toma produce un solo historial');
select is((select count(*) from public.listing_submissions where listing_id='92000000-0000-4000-8000-000000000001'),1::bigint,'staff lee la instantánea de envío');
select throws_ok($$update public.listing_submissions set attestation_version='alterada' where listing_id='92000000-0000-4000-8000-000000000001'$$,'42501',null,'staff no modifica submissions');

reset role;
insert into public.listings(id,owner_id,title,status,submitted_at)
values('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','Claim admin','submitted',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true);
select is((select success from public.claim_listing_for_review('92000000-0000-4000-8000-000000000002')),true,'admin también puede tomar revisión');

select * from finish();
rollback;
