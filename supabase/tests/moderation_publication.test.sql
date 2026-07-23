begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-owner@example.test','x',now(),'{}','{"username":"publicationowner"}',now(),now()),
('b1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-staff@example.test','x',now(),'{}','{"username":"publicationstaff"}',now(),now()),
('b1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-other@example.test','x',now(),'{}','{"username":"publicationother"}',now(),now()),
('b1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-admin@example.test','x',now(),'{}','{"username":"publicationadmin"}',now(),now());
select set_config('app.role_change','allowed',true);
update public.profiles set role='staff' where id in ('b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003');
update public.profiles set role='admin' where id='b1000000-0000-4000-8000-000000000004';
select set_config('app.role_change','',true);

insert into public.listings(id,owner_id,title,status,submitted_at,reviewer_id,review_started_at)
values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Publicación atómica','in_review',now(),'b1000000-0000-4000-8000-000000000002',now());
insert into public.listing_submissions(id,listing_id,submitted_by,attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version)
values('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1');

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select is((select conflict_code from public.decide_listing_review('b2000000-0000-4000-8000-000000000001','approved',null)),'not_assigned','otro staff no aprueba');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.decide_listing_review('b2000000-0000-4000-8000-000000000001','approved',null)$$,'P0001','Staff role required','propietario no aprueba');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select is((select success from public.decide_listing_review('b2000000-0000-4000-8000-000000000001','approved',null)),true,'revisor aprueba y publica');

reset role;
select is((select status::text from public.listings where id='b2000000-0000-4000-8000-000000000001'),'published','estado final es published');
select ok((select published_at is not null from public.listings where id='b2000000-0000-4000-8000-000000000001'),'published_at establecido');
select is((select reviewer_id from public.listings where id='b2000000-0000-4000-8000-000000000001'),'b1000000-0000-4000-8000-000000000002'::uuid,'revisor preservado');
select ok((select review_started_at is not null from public.listings where id='b2000000-0000-4000-8000-000000000001'),'inicio de revisión preservado');
select is((select count(*) from public.listing_review_decisions where listing_id='b2000000-0000-4000-8000-000000000001' and decision='approved'),1::bigint,'una decisión approved');
select is((select reviewer_id from public.listing_review_decisions where listing_id='b2000000-0000-4000-8000-000000000001'),'b1000000-0000-4000-8000-000000000002'::uuid,'actor de decisión registrado');
select is((select count(*) from public.listing_status_history where listing_id='b2000000-0000-4000-8000-000000000001' and from_status='in_review' and to_status='published'),1::bigint,'historial in_review a published único');

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select is((select success from public.decide_listing_review('b2000000-0000-4000-8000-000000000001','approved',null)),false,'segunda aprobación no completa');
reset role;
select is((select count(*) from public.listing_review_decisions where listing_id='b2000000-0000-4000-8000-000000000001'),1::bigint,'segunda aprobación no duplica decisión');

set local role anon;
select is((select id from public.get_public_listing('b2000000-0000-4000-8000-000000000001')),'b2000000-0000-4000-8000-000000000001'::uuid,'proyección pública resuelve published');
select is((select count(*) from public.listings),0::bigint,'anon no accede a fila completa');
select ok(not has_function_privilege('anon','public.regularize_legacy_approved_listings()','EXECUTE'),'anon no ejecuta regularización');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.regularize_legacy_approved_listings()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC no ejecuta regularización');

reset role;
insert into public.listings(id,owner_id,title,status,reviewer_id,review_started_at,published_at) values
('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','Approved legado verificable','approved','b1000000-0000-4000-8000-000000000002','2026-07-01 10:00:00+00',null),
('b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','Approved sin decisión','approved',null,null,null),
('b2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001','Approved ya fechado','approved','b1000000-0000-4000-8000-000000000002','2026-07-01 10:00:00+00','2026-07-03 10:00:00+00'),
('b2000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000001','Rechazado bloqueado','rejected',null,null,null);
insert into public.listing_submissions(id,listing_id,submitted_by,attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version)
values
('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1'),
('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1'),
('b3000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1');
insert into public.listing_review_decisions(submission_id,listing_id,reviewer_id,decision,created_at)
values
('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','approved','2026-07-02 10:00:00+00'),
('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000004','approved','2026-07-03 12:00:00+00'),
('b3000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000002','approved','2026-07-03 10:00:00+00');

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select ok(not has_function_privilege('authenticated','public.regularize_legacy_approved_listings()','EXECUTE'),'authenticated no ejecuta regularización');
select is_empty($$update public.listings set title='rechazado alterado' where id='b2000000-0000-4000-8000-000000000005' returning id$$,'rejected no se edita directamente');
select is_empty($$update public.listings set title='publicado alterado' where id='b2000000-0000-4000-8000-000000000001' returning id$$,'published no se edita directamente');
reset role;
select is(public.regularize_legacy_approved_listings(),1,'regulariza exactamente uno de tres approved');
select is((select status::text from public.listings where id='b2000000-0000-4000-8000-000000000002'),'published','approved verificable termina published');
select is((select published_at from public.listings where id='b2000000-0000-4000-8000-000000000002'),'2026-07-03 12:00:00+00'::timestamptz,'usa fecha de la decisión approved más reciente');
select is((select reviewer_id from public.listings where id='b2000000-0000-4000-8000-000000000002'),'b1000000-0000-4000-8000-000000000002'::uuid,'preserva reviewer_id del listing');
select is((select review_started_at from public.listings where id='b2000000-0000-4000-8000-000000000002'),'2026-07-01 10:00:00+00'::timestamptz,'preserva review_started_at');
select is((select count(*) from public.listing_review_decisions where listing_id='b2000000-0000-4000-8000-000000000002'),2::bigint,'no inserta segunda decisión approved');
select is((select count(*) from public.listing_status_history where listing_id='b2000000-0000-4000-8000-000000000002' and from_status='approved' and to_status='published'),1::bigint,'registra una transición approved a published');
select is((select actor_id from public.listing_status_history where listing_id='b2000000-0000-4000-8000-000000000002' and from_status='approved' and to_status='published'),'b1000000-0000-4000-8000-000000000004'::uuid,'historial atribuido al autor de la decisión más reciente');
select is((select status::text from public.listings where id='b2000000-0000-4000-8000-000000000003'),'approved','approved sin decisión no se regulariza');
select is((select status::text from public.listings where id='b2000000-0000-4000-8000-000000000004'),'approved','approved con published_at previo no se regulariza');
select is(public.regularize_legacy_approved_listings(),0,'segunda ejecución es idempotente');
select is((select count(*) from public.listing_status_history where listing_id='b2000000-0000-4000-8000-000000000002' and from_status='approved' and to_status='published'),1::bigint,'repetición no duplica historial');
select is(to_regprocedure('public.publish_legacy_approved_listing(uuid)'),null::regprocedure,'RPC manual legado fue eliminado');
select ok(has_function_privilege('authenticated','public.decide_listing_review(uuid,text,text)','EXECUTE'),'authenticated usa RPC estrecho de decisión');

select * from finish();
rollback;
