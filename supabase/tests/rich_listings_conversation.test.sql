begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rich-owner@example.test','x',now(),'{}','{"username":"richowner"}',now(),now()),
('d1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rich-user@example.test','x',now(),'{}','{"username":"richuser"}',now(),now()),
('d1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rich-staff@example.test','x',now(),'{}','{"username":"richstaff"}',now(),now());
select set_config('app.role_change','allowed',true); update public.profiles set role='staff' where id='d1000000-0000-4000-8000-000000000003'; select set_config('app.role_change','',true);
insert into public.listings(id,owner_id,title,status,published_at) values
('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Rich draft','draft',null),
('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','Rich published','published',now()),
('d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000002','Other published','published',now());
create temp table rich_test_ids(name text primary key,id uuid not null);
grant select,insert on rich_test_ids to authenticated;

select ok(has_table_privilege('authenticated','public.listing_equipment','INSERT'),'authenticated recibe DML rich bajo RLS');
select ok(not has_table_privilege('anon','public.listing_documentation','SELECT'),'documentación no tiene lectura anon');
select ok(not has_table_privilege('authenticated','public.listing_comments','INSERT'),'comments no aceptan inserción directa');
select ok(has_function_privilege('authenticated','public.create_listing_comment(uuid,text,uuid)','EXECUTE'),'comment RPC disponible autenticado');
select ok(not has_function_privilege('anon','public.create_listing_comment(uuid,text,uuid)','EXECUTE'),'anon no crea comentarios');
select ok(not has_table_privilege('authenticated','public.listing_comment_moderation_events','INSERT'),'auditoría no admite inserción cliente');

set local role authenticated; select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
insert into public.listing_ownership_details(listing_id,owned_since_month,owned_since_year,known_owner_count,vin) values('d2000000-0000-4000-8000-000000000001',3,2021,'3','1hgcm82633a004352');
select is((select vin from public.listing_ownership_details where listing_id='d2000000-0000-4000-8000-000000000001'),'1HGCM82633A004352','VIN normaliza uppercase');
select throws_ok($$update public.listing_ownership_details set vin='INVALID' where listing_id='d2000000-0000-4000-8000-000000000001'$$,'P0001','VIN must contain 17 valid characters','VIN inválido falla server-side');
insert into public.listing_documentation(listing_id,document_type,keys_count,owners_manual,service_history_level) values('d2000000-0000-4000-8000-000000000001','original_invoice',2,'yes','partial');
insert into public.listing_equipment(listing_id,name) values('d2000000-0000-4000-8000-000000000001','Bose');
select is((select count(*) from public.listing_equipment where listing_id='d2000000-0000-4000-8000-000000000001'),1::bigint,'owner gestiona rich en draft');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select throws_ok($$insert into public.listing_equipment(listing_id,name) values('d2000000-0000-4000-8000-000000000001','Spoof')$$,'42501',null,'otro usuario no edita rich data');
select is((select count(*) from public.listing_documentation where listing_id='d2000000-0000-4000-8000-000000000001'),0::bigint,'otro usuario no lee documentación');
reset role;

insert into public.listing_ownership_details(listing_id,owned_since_year,known_owner_count,vin,originality_status) values('d2000000-0000-4000-8000-000000000002',2021,'3','JH4KA8260MC000000','mostly_original');
insert into public.listing_documentation(listing_id,document_type,keys_count,owners_manual,service_history_level) values('d2000000-0000-4000-8000-000000000002','original_invoice',2,'yes','partial');
select is((public.get_public_listing_rich('d2000000-0000-4000-8000-000000000002')->'ownership'->>'vinMasked'),'***********000000','proyección pública enmascara VIN');
select ok((public.get_public_listing_rich('d2000000-0000-4000-8000-000000000002')::text !~ 'JH4KA8260MC000000'),'VIN completo nunca aparece en proyección');
select is((public.get_public_listing_rich('d2000000-0000-4000-8000-000000000001')),null::jsonb,'draft no obtiene proyección pública');

set local role authenticated; select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
insert into rich_test_ids values('root',public.create_listing_comment('d2000000-0000-4000-8000-000000000002','¿Tiene servicios?',null));
select ok((select id is not null from rich_test_ids where name='root'),'autenticado crea comentario propio');
select is((select author_id from public.get_public_listing_comments('d2000000-0000-4000-8000-000000000002') where id=(select id from rich_test_ids where name='root')),'d1000000-0000-4000-8000-000000000002'::uuid,'author se deriva de auth.uid');
select ok(not has_table_privilege('authenticated','public.listing_comments','UPDATE'),'spoof y update directo no tienen privilegio');
select is(public.edit_listing_comment((select id from rich_test_ids where name='root'),'Pregunta editada'),true,'autor edita comentario');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select is(public.edit_listing_comment((select id from rich_test_ids where name='root'),'Ataque'),false,'otro usuario no edita comentario');
insert into rich_test_ids values('reply',public.create_listing_comment('d2000000-0000-4000-8000-000000000002','Respuesta del vendedor',(select id from rich_test_ids where name='root')));
select ok((select id is not null from rich_test_ids where name='reply'),'reply mismo listing funciona');
select throws_ok(format('select public.create_listing_comment(%L,%L,%L)','d2000000-0000-4000-8000-000000000003','Cross listing',(select id from rich_test_ids where name='root')),'P0001','Invalid parent comment','reply cross-listing falla');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select is(public.toggle_listing_comment_vote((select id from rich_test_ids where name='reply')),true,'primer upvote agrega');
select is(public.toggle_listing_comment_vote((select id from rich_test_ids where name='reply')),false,'segundo upvote remueve');
select is((select count(*) from public.listing_comment_votes),0::bigint,'toggle conserva unicidad');
select lives_ok(format('select public.report_listing_comment(%L,%L,%L)',(select id from rich_test_ids where name='reply'),'false_information','Detalle'),'authenticated reporta');
select throws_ok(format('select public.report_listing_comment(%L,%L,%L)',(select id from rich_test_ids where name='reply'),'false_information','Duplicado'),'P0001','Duplicate report','reporte duplicado bloqueado');
select is((select count(*) from public.listing_comment_reports),1::bigint,'reporter ve sólo su reporte');
select is(public.delete_listing_comment((select id from rich_test_ids where name='root')),true,'soft delete funciona');
reset role;
select is((select count(*) from public.get_public_listing_comments('d2000000-0000-4000-8000-000000000002') where status='removed'),1::bigint,'soft delete conserva raíz con replies');

set local role authenticated; select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.listing_comment_reports),1::bigint,'staff ve reportes');
select is(public.moderate_listing_comment((select id from rich_test_ids where name='reply'),'hidden',null,'Ocultar durante revisión'),true,'staff oculta comentario');
select is((select count(*) from public.listing_comment_moderation_events),1::bigint,'moderación registra evento append-only');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
select throws_ok(format('select public.toggle_listing_comment_vote(%L)',(select id from rich_test_ids where name='reply')),'P0001','Comment not votable','hidden no recibe votos');
select throws_ok(format('select public.moderate_listing_comment(%L,%L,null,null)',(select id from rich_test_ids where name='reply'),'restored'),'P0001','Staff role required','usuario normal no modera');
reset role;
select is((select count(*) from public.get_public_listing_comments('d2000000-0000-4000-8000-000000000002') where body='Respuesta del vendedor'),0::bigint,'hidden desaparece públicamente');

select * from finish();
rollback;
