begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','post-owner@example.test','x',now(),'{}','{"username":"postowner"}',now(),now()),
('c1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','post-staff@example.test','x',now(),'{}','{"username":"poststaff"}',now(),now()),
('c1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','post-other-staff@example.test','x',now(),'{}','{"username":"postotherstaff"}',now(),now()),
('c1000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','post-user@example.test','x',now(),'{}','{"username":"postuser"}',now(),now());
select set_config('app.role_change','allowed',true);
update public.profiles set role='staff' where id in ('c1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003');
select set_config('app.role_change','',true);

insert into public.listings(id,owner_id,title,status,published_at,submitted_at,reviewer_id,review_started_at)
values('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Control post publicación','published','2026-07-01 12:00:00+00','2026-06-30 12:00:00+00','c1000000-0000-4000-8000-000000000002','2026-06-30 13:00:00+00');
insert into public.listing_submissions(id,listing_id,submitted_by,attest_owner_authorized,attest_information_truthful,attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version,created_at)
values('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',true,true,true,true,'2026-07-20-v1','2026-06-30 12:00:00+00');
insert into public.listing_review_decisions(submission_id,listing_id,reviewer_id,decision,created_at)
values('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002','approved','2026-07-01 12:00:00+00');

select ok('paused'=any(enum_range(null::public.listing_status)::text[]),'enum incluye paused');
select ok(has_function_privilege('authenticated','public.pause_listing_publication(uuid,text)','EXECUTE'),'authenticated puede invocar pausa estrecha');
select ok(has_function_privilege('authenticated','public.resume_listing_publication(uuid)','EXECUTE'),'authenticated puede invocar reanudación estrecha');
select ok(has_function_privilege('authenticated','public.return_listing_to_review(uuid,text)','EXECUTE'),'authenticated puede invocar retorno estrecho');
select ok(not has_function_privilege('anon','public.pause_listing_publication(uuid,text)','EXECUTE'),'anon no ejecuta pausa');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.pause_listing_publication(uuid,text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC no ejecuta pausa');
select ok(not has_table_privilege('authenticated','public.listing_post_publication_events','INSERT'),'authenticated no inserta auditoría');
select ok(not has_table_privilege('authenticated','public.listing_post_publication_events','UPDATE'),'authenticated no sobrescribe auditoría');
select ok(not has_table_privilege('authenticated','public.listing_post_publication_events','DELETE'),'authenticated no elimina auditoría');
select is(to_regprocedure('public.pause_listing_publication(uuid,text,uuid)'),null::regprocedure,'pausa no acepta actor_id');
select is(to_regprocedure('public.return_listing_to_review(uuid,text,uuid,public.listing_status)'),null::regprocedure,'retorno no acepta reviewer ni status');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.pause_listing_publication('c2000000-0000-4000-8000-000000000001','Motivo suficientemente detallado para pausar.')$$,'P0001','Staff role required','usuario normal no pausa');
select throws_ok($$select public.resume_listing_publication('c2000000-0000-4000-8000-000000000001')$$,'P0001','Staff role required','usuario normal no reanuda');
select throws_ok($$select public.return_listing_to_review('c2000000-0000-4000-8000-000000000001','Motivo suficientemente detallado para revisar.')$$,'P0001','Staff role required','usuario normal no regresa a revisión');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.pause_listing_publication('c2000000-0000-4000-8000-000000000001','El propietario intenta pausar su publicación.')$$,'P0001','Staff role required','propietario no pausa');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select is((select conflict_code from public.pause_listing_publication('c2000000-0000-4000-8000-000000000001','corto')),'reason_invalid','pausa exige motivo útil');
select is((select success from public.pause_listing_publication('c2000000-0000-4000-8000-000000000001','Inventario temporalmente indisponible para venta.')),true,'staff pausa publicación');
select is((select conflict_code from public.pause_listing_publication('c2000000-0000-4000-8000-000000000001','Segundo intento que no debe duplicar la pausa.')),'status_conflict','segunda pausa bloqueada por estado bajo lock');

reset role;
select is((select status::text from public.listings where id='c2000000-0000-4000-8000-000000000001'),'paused','published pasa a paused');
select is((select published_at from public.listings where id='c2000000-0000-4000-8000-000000000001'),'2026-07-01 12:00:00+00'::timestamptz,'pausa conserva published_at');
select is((select count(*) from public.get_public_listing('c2000000-0000-4000-8000-000000000001')),0::bigint,'paused no tiene detalle público');
select is((select count(*) from public.get_public_profile_listings('postowner')),0::bigint,'paused no aparece en perfil público');
select is((select count(*) from public.listing_status_history where listing_id='c2000000-0000-4000-8000-000000000001' and from_status='published' and to_status='paused'),1::bigint,'pausa registra historial de estado');
select is((select reason from public.listing_post_publication_events where listing_id='c2000000-0000-4000-8000-000000000001' and action='paused'),'Inventario temporalmente indisponible para venta.','auditoría conserva motivo');
select is((select actor_id from public.listing_post_publication_events where listing_id='c2000000-0000-4000-8000-000000000001' and action='paused'),'c1000000-0000-4000-8000-000000000002'::uuid,'auditoría deriva actor');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select is((select reason from public.get_owner_post_publication_events() where listing_id='c2000000-0000-4000-8000-000000000001' limit 1),'Inventario temporalmente indisponible para venta.','propietario recibe motivo por proyección estrecha');
select is((select count(*) from public.listing_post_publication_events),0::bigint,'propietario no lee auditoría interna con actor');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
select is((select success from public.resume_listing_publication('c2000000-0000-4000-8000-000000000001')),true,'staff reanuda publicación');

reset role;
select is((select status::text from public.listings where id='c2000000-0000-4000-8000-000000000001'),'published','paused vuelve a published');
select is((select published_at from public.listings where id='c2000000-0000-4000-8000-000000000001'),'2026-07-01 12:00:00+00'::timestamptz,'reanudación conserva fecha original');
select is((select count(*) from public.get_public_listing('c2000000-0000-4000-8000-000000000001')),1::bigint,'reanudado vuelve a detalle público');
select is((select count(*) from public.get_public_profile_listings('postowner')),1::bigint,'reanudado vuelve al perfil público');
select is((select count(*) from public.listing_review_decisions where listing_id='c2000000-0000-4000-8000-000000000001' and decision='approved'),1::bigint,'reanudación no crea decisión editorial');
select is((select count(*) from public.listing_post_publication_events where listing_id='c2000000-0000-4000-8000-000000000001' and action='resumed'),1::bigint,'reanudación queda auditada');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select is((select conflict_code from public.return_listing_to_review('c2000000-0000-4000-8000-000000000001','breve')),'reason_invalid','retorno exige motivo útil');
select is((select success from public.return_listing_to_review('c2000000-0000-4000-8000-000000000001','La información publicada requiere una nueva validación.')),true,'staff regresa publicación a revisión');

reset role;
select is((select status::text from public.listings where id='c2000000-0000-4000-8000-000000000001'),'in_review','published pasa a in_review');
select is((select reviewer_id from public.listings where id='c2000000-0000-4000-8000-000000000001'),'c1000000-0000-4000-8000-000000000002'::uuid,'retorno asigna al actor');
select ok((select review_started_at > '2026-07-01 12:00:00+00' from public.listings where id='c2000000-0000-4000-8000-000000000001'),'retorno establece nuevo inicio');
select is((select count(*) from public.get_public_listing('c2000000-0000-4000-8000-000000000001')),0::bigint,'in_review no tiene detalle público');
select is((select count(*) from public.get_public_profile_listings('postowner')),0::bigint,'in_review no aparece en perfil público');
select is((select count(*) from public.listing_submissions where listing_id='c2000000-0000-4000-8000-000000000001'),2::bigint,'retorno crea nueva ronda de submission');
select is((select count(*) from public.listing_review_decisions where listing_id='c2000000-0000-4000-8000-000000000001'),1::bigint,'retorno preserva decisión y aún no crea otra');
select is((select count(*) from public.listing_post_publication_events where listing_id='c2000000-0000-4000-8000-000000000001' and action='returned_to_review'),1::bigint,'retorno queda auditado');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
select is((select success from public.decide_listing_review('c2000000-0000-4000-8000-000000000001','approved',null)),true,'nueva ronda puede aprobar y publicar');
reset role;
select is((select status::text from public.listings where id='c2000000-0000-4000-8000-000000000001'),'published','nueva aprobación regresa a published');
select is((select count(*) from public.listing_review_decisions where listing_id='c2000000-0000-4000-8000-000000000001' and decision='approved'),2::bigint,'nueva resolución crea segunda decisión approved');
select is((select published_at from public.listings where id='c2000000-0000-4000-8000-000000000001'),'2026-07-01 12:00:00+00'::timestamptz,'reaprobación conserva primera fecha publicada');
select is((select count(*) from public.listing_status_history where listing_id='c2000000-0000-4000-8000-000000000001'),4::bigint,'historial conserva las cuatro transiciones post-publicación');

select * from finish();
rollback;
