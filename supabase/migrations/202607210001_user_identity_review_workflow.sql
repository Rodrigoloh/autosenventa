-- FASE 5: identidad pública, readiness por username y decisiones de revisión.

alter table public.profiles add column username text;

create function public.is_valid_public_username(candidate text)
returns boolean language sql immutable set search_path = '' as $$
  select candidate is not null
    and candidate = lower(candidate)
    and candidate ~ '^[a-z][a-z0-9_]{1,22}[a-z0-9]$'
    and candidate !~ '__'
    and candidate not in (
      'admin','administrator','staff','support','soporte','root','api','auth','login','logout',
      'registro','signup','signin','cuenta','perfil','profile','profiles','usuario','usuarios',
      'user','users','autos','auto','anuncios','listing','listings','review','reviews','revision',
      'revisiones','moderacion','driven','system','null','undefined','public','private','settings','config'
    )
$$;

alter table public.profiles add constraint profiles_username_valid
  check (username is null or public.is_valid_public_username(username));
create unique index profiles_username_case_insensitive_unique
  on public.profiles(lower(username)) where username is not null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare requested_username text := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
begin
  insert into public.profiles(id, display_name, username)
  values(new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), requested_username);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.guard_profile_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.id is distinct from new.id then raise exception 'Profile id cannot be changed'; end if;
  if old.role is distinct from new.role and coalesce(current_setting('app.role_change', true), '') <> 'allowed' then
    raise exception 'Use set_user_role to change roles';
  end if;
  if old.username is distinct from new.username
    and coalesce(current_setting('app.username_assignment', true), '') <> 'allowed' then
    raise exception 'Use set_my_username to choose username';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_profile_role() from public, anon, authenticated;

create function public.is_username_available(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_valid_public_username(lower(trim(candidate)))
    and not exists (select 1 from public.profiles where lower(username) = lower(trim(candidate)))
$$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated, service_role;

create function public.set_my_username(candidate text)
returns table(success boolean, error_code text, assigned_username text)
language plpgsql security definer set search_path = '' as $$
declare normalized text := lower(trim(candidate)); current_username text;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select username into current_username from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Profile not found'; end if;
  if current_username is not null then
    return query select false, 'username_immutable'::text, current_username; return;
  end if;
  if not public.is_valid_public_username(normalized) then
    return query select false, 'invalid_username'::text, null::text; return;
  end if;
  begin
    perform set_config('app.username_assignment','allowed',true);
    update public.profiles set username=normalized where id=auth.uid() and username is null;
    perform set_config('app.username_assignment','',true);
  exception when unique_violation then
    perform set_config('app.username_assignment','',true);
    return query select false, 'username_unavailable'::text, null::text; return;
  end;
  return query select true, null::text, normalized;
end;
$$;
revoke all on function public.set_my_username(text) from public, anon;
grant execute on function public.set_my_username(text) to authenticated, service_role;

create function public.get_public_profile(target_username text)
returns table(username text, display_name text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select profiles.username, profiles.display_name, profiles.created_at
  from public.profiles
  where profiles.username = lower(trim(target_username))
    and public.is_valid_public_username(lower(trim(target_username)))
$$;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;

create function public.get_public_profile_listings(target_username text)
returns table(id uuid, slug text, title text, year smallint, price_mxn numeric)
language sql stable security definer set search_path = '' as $$
  select listings.id, listings.slug, listings.title, listings.year, listings.price_mxn
  from public.listings join public.profiles on profiles.id=listings.owner_id
  where profiles.username=lower(trim(target_username)) and listings.status='published'
  order by listings.published_at desc nulls last
$$;
revoke all on function public.get_public_profile_listings(text) from public;
grant execute on function public.get_public_profile_listings(text) to anon, authenticated, service_role;

create table public.listing_review_decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.listing_submissions(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  message text,
  created_at timestamptz not null default now(),
  constraint review_decision_message_required check (
    (decision='approved' and message is null)
    or (decision in ('changes_requested','rejected') and length(trim(message)) >= 20)
  )
);
create index listing_review_decisions_listing_created_idx
  on public.listing_review_decisions(listing_id, created_at desc);
alter table public.listing_review_decisions enable row level security;
create policy "review decisions visible to staff or owner" on public.listing_review_decisions
for select to authenticated using (
  public.is_staff() or exists (
    select 1 from public.listings where listings.id=listing_id and listings.owner_id=auth.uid()
  )
);
revoke all on table public.listing_review_decisions from public, anon, authenticated;
grant select on table public.listing_review_decisions to authenticated;
grant all privileges on table public.listing_review_decisions to service_role;

create or replace function public.evaluate_listing_submission_readiness(
  target_listing_id uuid,
  attest_owner_authorized boolean,
  attest_information_truthful boolean,
  attest_modifications_and_issues_disclosed boolean,
  attest_legal_documentation boolean,
  target_attestation_version text
) returns text[]
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; codes text[] := array[]::text[]; photo_count integer;
begin
  select * into current_listing from public.listings where id=target_listing_id;
  if current_listing.id is null then return array['listing_not_found']; end if;
  if not exists (select 1 from public.profiles where id=current_listing.owner_id and username is not null) then
    codes := array_append(codes, 'missing_public_username');
  end if;
  if current_listing.category_id is null or current_listing.brand_id is null or current_listing.model_id is null
    or current_listing.year is null or current_listing.mileage_km is null
    or nullif(trim(current_listing.exterior_color),'') is null or nullif(trim(current_listing.body_style),'') is null
    or nullif(trim(current_listing.transmission),'') is null or nullif(trim(current_listing.fuel_type),'') is null then
    codes := array_append(codes, 'missing_vehicle_fields');
  end if;
  if (current_listing.category_id is not null and not exists(select 1 from public.categories where id=current_listing.category_id and active))
    or (current_listing.brand_id is not null and not exists(select 1 from public.brands where id=current_listing.brand_id and active))
    or (current_listing.model_id is not null and not exists(select 1 from public.models where id=current_listing.model_id and brand_id=current_listing.brand_id and active)) then
    codes := array_append(codes, 'invalid_taxonomy');
  end if;
  if current_listing.price_mxn is null or current_listing.price_mxn <= 0 then codes := array_append(codes,'invalid_price'); end if;
  if nullif(trim(current_listing.city),'') is null or nullif(trim(current_listing.state_region),'') is null then codes := array_append(codes,'missing_location'); end if;
  if length(trim(coalesce(current_listing.owner_description,''))) < 120 then codes := array_append(codes,'description_too_short'); end if;
  if length(trim(coalesce(current_listing.ownership_history,''))) < 60 then codes := array_append(codes,'ownership_history_too_short'); end if;
  if length(trim(coalesce(current_listing.maintenance_history,''))) < 40 then codes := array_append(codes,'maintenance_history_too_short'); end if;
  if nullif(trim(current_listing.modifications),'') is null then codes := array_append(codes,'missing_modifications_statement'); end if;
  if nullif(trim(current_listing.known_issues),'') is null then codes := array_append(codes,'missing_known_issues_statement'); end if;
  if current_listing.deletion_started_at is not null then codes := array_append(codes,'deletion_in_progress'); end if;
  select count(*) into photo_count from public.listing_media where listing_id=target_listing_id;
  if photo_count < 8 then codes := array_append(codes,'insufficient_photos'); end if;
  if (select count(*) from public.listing_media where listing_id=target_listing_id and is_cover) <> 1 then codes := array_append(codes,'missing_cover'); end if;
  if photo_count > 0 and exists(select 1 from (
    select sort_order,row_number() over(order by sort_order,created_at,id)-1 expected
    from public.listing_media where listing_id=target_listing_id
  ) ordered where sort_order<>expected) then codes := array_append(codes,'invalid_photo_order'); end if;
  if exists(select 1 from public.listing_media where listing_id=target_listing_id and deletion_started_at is not null)
    or exists(select 1 from public.listing_photo_uploads where listing_id=target_listing_id) then codes := array_append(codes,'photo_operation_pending'); end if;
  if exists(select 1 from public.listing_media media where media.listing_id=target_listing_id and not exists(
    select 1 from storage.objects objects where objects.bucket_id='listing-media' and objects.name=media.storage_path
  )) then codes := array_append(codes,'missing_storage_object'); end if;
  if not coalesce(attest_owner_authorized,false) or not coalesce(attest_information_truthful,false)
    or not coalesce(attest_modifications_and_issues_disclosed,false) or not coalesce(attest_legal_documentation,false)
    or coalesce(target_attestation_version,'') <> '2026-07-20-v1' then codes := array_append(codes,'missing_attestations'); end if;
  return codes;
end;
$$;
revoke all on function public.evaluate_listing_submission_readiness(uuid,boolean,boolean,boolean,boolean,text) from public, anon, authenticated;

create or replace function public.submit_listing_for_review(
  target_listing_id uuid, attest_owner_authorized boolean, attest_information_truthful boolean,
  attest_modifications_and_issues_disclosed boolean, attest_legal_documentation boolean,
  target_attestation_version text
) returns table(success boolean, readiness_codes text[])
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; codes text[]; submitted_time timestamptz := now(); previous_status public.listing_status;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into current_listing from public.listings where id=target_listing_id for update;
  if current_listing.id is null or current_listing.owner_id<>auth.uid() then raise exception 'Listing not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then return query select false,array['listing_not_draft']::text[]; return; end if;
  previous_status := current_listing.status;
  perform 1 from public.listing_media where listing_id=target_listing_id for update;
  perform 1 from public.listing_photo_uploads where listing_id=target_listing_id for update;
  codes := public.evaluate_listing_submission_readiness(target_listing_id,attest_owner_authorized,attest_information_truthful,
    attest_modifications_and_issues_disclosed,attest_legal_documentation,target_attestation_version);
  if cardinality(codes)>0 then return query select false,codes; return; end if;
  insert into public.listing_submissions(listing_id,submitted_by,attest_owner_authorized,attest_information_truthful,
    attest_modifications_and_issues_disclosed,attest_legal_documentation,attestation_version,created_at)
  values(target_listing_id,auth.uid(),true,true,true,true,target_attestation_version,submitted_time);
  perform set_config('app.status_transition','allowed',true);
  perform set_config('app.listing_submission','allowed',true);
  perform set_config('app.review_claim','allowed',true);
  update public.listings set status='submitted',submitted_at=submitted_time,reviewer_id=null,review_started_at=null where id=target_listing_id;
  perform set_config('app.review_claim','',true); perform set_config('app.listing_submission','',true); perform set_config('app.status_transition','',true);
  insert into public.listing_status_history(listing_id,from_status,to_status,actor_id,created_at)
  values(target_listing_id,previous_status,'submitted',auth.uid(),submitted_time);
  return query select true,array[]::text[];
end;
$$;
revoke all on function public.submit_listing_for_review(uuid,boolean,boolean,boolean,boolean,text) from public, anon;
grant execute on function public.submit_listing_for_review(uuid,boolean,boolean,boolean,boolean,text) to authenticated, service_role;

create function public.decide_listing_review(target_listing_id uuid, target_decision text, target_message text default null)
returns table(success boolean, conflict_code text)
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; current_submission uuid; decided_time timestamptz := now(); normalized_message text := nullif(trim(target_message),'');
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff role required'; end if;
  if target_decision not in ('approved','changes_requested','rejected') then raise exception 'Invalid review decision'; end if;
  if target_decision in ('changes_requested','rejected') and length(coalesce(normalized_message,''))<20 then
    return query select false,'message_too_short'::text; return;
  end if;
  select * into current_listing from public.listings where id=target_listing_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status<>'in_review' then return query select false,'already_decided'::text; return; end if;
  if current_listing.reviewer_id<>auth.uid() and public.current_role()<>'admin' then
    return query select false,'not_assigned'::text; return;
  end if;
  select id into current_submission from public.listing_submissions where listing_id=target_listing_id order by created_at desc,id desc limit 1 for update;
  if current_submission is null then raise exception 'Submission not available'; end if;
  begin
    insert into public.listing_review_decisions(submission_id,listing_id,reviewer_id,decision,message,created_at)
    values(current_submission,target_listing_id,auth.uid(),target_decision,case when target_decision='approved' then null else normalized_message end,decided_time);
  exception when unique_violation then
    return query select false,'already_decided'::text; return;
  end;
  perform set_config('app.status_transition','allowed',true); perform set_config('app.review_claim','allowed',true);
  update public.listings set status=target_decision::public.listing_status,reviewer_id=null,review_started_at=null where id=target_listing_id;
  perform set_config('app.review_claim','',true); perform set_config('app.status_transition','',true);
  insert into public.listing_status_history(listing_id,from_status,to_status,actor_id,created_at)
  values(target_listing_id,'in_review',target_decision::public.listing_status,auth.uid(),decided_time);
  return query select true,null::text;
end;
$$;
revoke all on function public.decide_listing_review(uuid,text,text) from public, anon;
grant execute on function public.decide_listing_review(uuid,text,text) to authenticated, service_role;
