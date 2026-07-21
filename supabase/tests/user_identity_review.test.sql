begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner5@example.test','x',now(),'{}','{"username":"OwnerPhase5"}',now(),now()),
('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','legacy5@example.test','x',now(),'{}','{}',now(),now()),
('a1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staffa5@example.test','x',now(),'{}','{"username":"staffmembera"}',now(),now()),
('a1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staffb5@example.test','x',now(),'{}','{"username":"staffmemberb"}',now(),now()),
('a1000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin5@example.test','x',now(),'{}','{"username":"marketadmin"}',now(),now());

select is((select username from public.profiles where id='a1000000-0000-4000-8000-000000000001'),'ownerphase5','registro normaliza username a minúsculas');
select is((select username from public.profiles where id='a1000000-0000-4000-8000-000000000002'),null,'cuenta existente conserva username nulo');
select ok(public.is_valid_public_username('usuario_5'),'formato válido aceptado');
select ok(not public.is_valid_public_username('5usuario'),'username debe comenzar con letra');
select ok(not public.is_valid_public_username('usuario_'),'username no termina en guion bajo');
select ok(not public.is_valid_public_username('usuario__cinco'),'doble guion bajo rechazado');
select ok(not public.is_valid_public_username('soporte'),'username reservado rechazado');
select throws_ok(
  $$insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('a1000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','duplicate5@example.test','x','{}','{"username":"OWNERPHASE5"}',now(),now())$$,
  '23505',null,'mayúsculas no evaden unicidad'
);
select throws_ok(
  $$insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('a1000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reserved5@example.test','x','{}','{"username":"admin"}',now(),now())$$,
  '23514',null,'trigger rechaza username reservado'
);

select set_config('app.role_change','allowed',true);
update public.profiles set role='staff' where id in ('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004');
update public.profiles set role='admin' where id='a1000000-0000-4000-8000-000000000005';
select set_config('app.role_change','',true);

set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select is((select success from public.set_my_username('legacy_user')),true,'cuenta legacy establece username propio');
select is((select assigned_username from public.set_my_username('otro_nombre')),'legacy_user','username es inmutable después de establecerse');
select throws_ok($$update public.profiles set username='manipulado' where id='a1000000-0000-4000-8000-000000000002'$$,'P0001','Use set_my_username to choose username','update directo de username falla');
select is((select count(*) from public.profiles where id='a1000000-0000-4000-8000-000000000001'),0::bigint,'usuario no lee perfil ajeno');
select ok(not has_function_privilege('anon','public.set_my_username(text)','EXECUTE'),'anon no ejecuta asignación');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.set_my_username(text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC no ejecuta asignación');

reset role;
insert into public.listings(id,owner_id,title) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Readiness username');
select set_config('app.username_assignment','allowed',true);
update public.profiles set username=null where id='a1000000-0000-4000-8000-000000000001';
select set_config('app.username_assignment','',true);
select ok('missing_public_username'=any(public.evaluate_listing_submission_readiness('a2000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1')),'draft sin username devuelve código estable');
select set_config('app.username_assignment','allowed',true);
update public.profiles set username='ownerphase5' where id='a1000000-0000-4000-8000-000000000001';
select set_config('app.username_assignment','',true);
select ok(not ('missing_public_username'=any(public.evaluate_listing_submission_readiness('a2000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1'))),'readiness retira código después de elegir username');

insert into public.listings(id,owner_id,title,status,submitted_at,reviewer_id,review_started_at)
values('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Decisión concurrente','in_review',now(),'a1000000-0000-4000-8000-000000000003',now());
insert into public.listing_submissions(id,listing_id,submitted_by,attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version)
values('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1');

set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000004',true);
select is((select conflict_code from public.decide_listing_review('a2000000-0000-4000-8000-000000000002','approved',null)),'not_assigned','segundo staff no decide anuncio ajeno');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select is((select conflict_code from public.decide_listing_review('a2000000-0000-4000-8000-000000000002','changes_requested','muy corto')),'message_too_short','solicitar cambios exige mensaje');
select is((select conflict_code from public.decide_listing_review('a2000000-0000-4000-8000-000000000002','changes_requested','Mensaje detallado para corregir el anuncio.'))::text,null,'revisor asignado solicita cambios');
select is((select status::text from public.listings where id='a2000000-0000-4000-8000-000000000002'),'changes_requested','decisión cambia estado');
select is((select count(*) from public.listing_review_decisions where listing_id='a2000000-0000-4000-8000-000000000002'),1::bigint,'decisión queda append-only');
select throws_ok($$update public.listing_review_decisions set message='alterado' where listing_id='a2000000-0000-4000-8000-000000000002'$$,'42501',null,'staff no altera decisión pasada');
select is((select success from public.decide_listing_review('a2000000-0000-4000-8000-000000000002','approved',null)),false,'segunda decisión no completa');

reset role;
insert into public.listings(id,owner_id,title,status,submitted_at,reviewer_id,review_started_at)
values('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','Aprobación','in_review',now(),'a1000000-0000-4000-8000-000000000003',now());
insert into public.listing_submissions(id,listing_id,submitted_by,attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version)
values('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
select is((select success from public.decide_listing_review('a2000000-0000-4000-8000-000000000003','approved',null)),true,'aprobación completa');
select is((select status::text from public.listings where id='a2000000-0000-4000-8000-000000000003'),'approved','aprobado no se publica');
select is((select published_at from public.listings where id='a2000000-0000-4000-8000-000000000003'),null,'aprobación no asigna fecha pública');
select is((select count(*) from public.listing_status_history where listing_id='a2000000-0000-4000-8000-000000000003' and actor_id='a1000000-0000-4000-8000-000000000003'),1::bigint,'historial registra actor de decisión');

reset role;
set local role anon;
select is((select username from public.get_public_profile('OWNERPHASE5')),'ownerphase5','perfil público normaliza parámetro');
select is((select count(*) from public.get_public_profile_listings('ownerphase5')),0::bigint,'approved no aparece como anuncio público');
select ok(not has_function_privilege('anon','public.decide_listing_review(uuid,text,text)','EXECUTE'),'anon no ejecuta decisiones');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.decide_listing_review(uuid,text,text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC no conserva decisiones');

select * from finish();
rollback;
