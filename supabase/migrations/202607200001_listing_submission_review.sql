-- FASE 4: envío atómico a revisión y toma exclusiva por staff.

alter table public.listings
  add column submitted_at timestamptz,
  add column reviewer_id uuid references public.profiles(id) on delete restrict,
  add column review_started_at timestamptz;

alter table public.listings add constraint listings_review_assignment_consistent check (
  (reviewer_id is null and review_started_at is null)
  or (reviewer_id is not null and review_started_at is not null)
);

create index listings_review_queue_idx on public.listings(status, submitted_at);
create index listings_reviewer_status_idx on public.listings(reviewer_id, status);

create table public.listing_submissions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  attest_owner_authorized boolean not null check (attest_owner_authorized),
  attest_information_truthful boolean not null check (attest_information_truthful),
  attest_modifications_and_issues_disclosed boolean not null check (attest_modifications_and_issues_disclosed),
  attest_legal_documentation boolean not null check (attest_legal_documentation),
  attestation_version text not null check (length(trim(attestation_version)) between 1 and 50),
  created_at timestamptz not null default now()
);

create index listing_submissions_listing_created_idx
  on public.listing_submissions(listing_id, created_at desc);

alter table public.listing_submissions enable row level security;
create policy "staff read review submissions" on public.listing_submissions
for select to authenticated using (
  public.is_staff()
  and exists (select 1 from public.listings where id = listing_id)
);

revoke all on table public.listing_submissions from public, anon, authenticated;
grant select on table public.listing_submissions to authenticated;
grant all privileges on table public.listing_submissions to service_role;

-- Staff deja de tener una vía genérica de edición. Las transiciones de esta fase
-- pasan exclusivamente por los RPC estrechos definidos abajo.
drop policy if exists "staff update listings" on public.listings;
revoke execute on function public.transition_listing(uuid, public.listing_status)
from public, anon, authenticated;

create or replace function public.guard_listing_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.owner_id is distinct from new.owner_id then raise exception 'Owner cannot be changed'; end if;
  if old.deletion_started_at is not null
    and coalesce(current_setting('app.draft_deletion', true), '') <> 'allowed' then
    raise exception 'Draft deletion in progress';
  end if;
  if old.deletion_started_at is distinct from new.deletion_started_at
    and coalesce(current_setting('app.draft_deletion', true), '') <> 'allowed' then
    raise exception 'Use the draft deletion functions';
  end if;
  if old.status is distinct from new.status
    and coalesce(current_setting('app.status_transition', true), '') <> 'allowed' then
    raise exception 'Use a narrow listing transition function';
  end if;
  if (old.submitted_at is distinct from new.submitted_at)
    and coalesce(current_setting('app.listing_submission', true), '') <> 'allowed' then
    raise exception 'Submission metadata cannot be changed directly';
  end if;
  if (old.reviewer_id is distinct from new.reviewer_id
      or old.review_started_at is distinct from new.review_started_at)
    and coalesce(current_setting('app.review_claim', true), '') <> 'allowed' then
    raise exception 'Review assignment cannot be changed directly';
  end if;
  if not public.is_staff() and (
    old.slug is distinct from new.slug or
    old.listing_type is distinct from new.listing_type or
    old.editorial_description is distinct from new.editorial_description or
    old.is_featured is distinct from new.is_featured or
    old.featured_order is distinct from new.featured_order or
    old.published_at is distinct from new.published_at
  ) then raise exception 'Reserved editorial fields cannot be changed'; end if;
  if not public.is_staff() and (
    old.created_at is distinct from new.created_at or (
      old.updated_at is distinct from new.updated_at
      and coalesce(current_setting('app.status_transition', true), '') <> 'allowed'
    )
  ) then raise exception 'Reserved timestamps cannot be changed'; end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_listing_status() from public, anon, authenticated;

-- Devuelve códigos estables. La función no autoriza: sus callers bloquean y
-- comprueban actor/estado; la variante pública de lectura sí comprueba acceso.
create function public.evaluate_listing_submission_readiness(
  target_listing_id uuid,
  attest_owner_authorized boolean,
  attest_information_truthful boolean,
  attest_modifications_and_issues_disclosed boolean,
  attest_legal_documentation boolean,
  target_attestation_version text
) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  current_listing public.listings;
  codes text[] := array[]::text[];
  photo_count integer;
begin
  select * into current_listing from public.listings where id = target_listing_id;
  if current_listing.id is null then return array['listing_not_found']; end if;

  if current_listing.category_id is null or current_listing.brand_id is null
    or current_listing.model_id is null or current_listing.year is null
    or current_listing.mileage_km is null or nullif(trim(current_listing.exterior_color), '') is null
    or nullif(trim(current_listing.body_style), '') is null
    or nullif(trim(current_listing.transmission), '') is null
    or nullif(trim(current_listing.fuel_type), '') is null then
    codes := array_append(codes, 'missing_vehicle_fields');
  end if;
  if (current_listing.category_id is not null and not exists (select 1 from public.categories where id=current_listing.category_id and active))
    or (current_listing.brand_id is not null and not exists (select 1 from public.brands where id=current_listing.brand_id and active))
    or (current_listing.model_id is not null and not exists (select 1 from public.models where id=current_listing.model_id and brand_id=current_listing.brand_id and active)) then
    codes := array_append(codes, 'invalid_taxonomy');
  end if;
  if current_listing.price_mxn is null or current_listing.price_mxn <= 0 then
    codes := array_append(codes, 'invalid_price');
  end if;
  if nullif(trim(current_listing.city), '') is null or nullif(trim(current_listing.state_region), '') is null then
    codes := array_append(codes, 'missing_location');
  end if;
  if length(trim(coalesce(current_listing.owner_description, ''))) < 120 then codes := array_append(codes, 'description_too_short'); end if;
  if length(trim(coalesce(current_listing.ownership_history, ''))) < 60 then codes := array_append(codes, 'ownership_history_too_short'); end if;
  if length(trim(coalesce(current_listing.maintenance_history, ''))) < 40 then codes := array_append(codes, 'maintenance_history_too_short'); end if;
  if nullif(trim(current_listing.modifications), '') is null then codes := array_append(codes, 'missing_modifications_statement'); end if;
  if nullif(trim(current_listing.known_issues), '') is null then codes := array_append(codes, 'missing_known_issues_statement'); end if;
  if current_listing.deletion_started_at is not null then codes := array_append(codes, 'deletion_in_progress'); end if;

  select count(*) into photo_count from public.listing_media where listing_id=target_listing_id;
  if photo_count < 8 then codes := array_append(codes, 'insufficient_photos'); end if;
  if (select count(*) from public.listing_media where listing_id=target_listing_id and is_cover) <> 1 then
    codes := array_append(codes, 'missing_cover');
  end if;
  if photo_count > 0 and exists (
    select 1 from (
      select sort_order, row_number() over (order by sort_order, created_at, id) - 1 as expected
      from public.listing_media where listing_id=target_listing_id
    ) ordered where sort_order <> expected
  ) then codes := array_append(codes, 'invalid_photo_order'); end if;
  if exists (select 1 from public.listing_media where listing_id=target_listing_id and deletion_started_at is not null)
    or exists (select 1 from public.listing_photo_uploads where listing_id=target_listing_id) then
    codes := array_append(codes, 'photo_operation_pending');
  end if;
  if exists (
    select 1 from public.listing_media media
    where media.listing_id=target_listing_id and not exists (
      select 1 from storage.objects objects
      where objects.bucket_id='listing-media' and objects.name=media.storage_path
    )
  ) then codes := array_append(codes, 'missing_storage_object'); end if;
  if not coalesce(attest_owner_authorized, false)
    or not coalesce(attest_information_truthful, false)
    or not coalesce(attest_modifications_and_issues_disclosed, false)
    or not coalesce(attest_legal_documentation, false)
    or coalesce(target_attestation_version, '') <> '2026-07-20-v1' then
    codes := array_append(codes, 'missing_attestations');
  end if;
  return codes;
end;
$$;
revoke all on function public.evaluate_listing_submission_readiness(uuid,boolean,boolean,boolean,boolean,text) from public, anon, authenticated;

create function public.get_listing_submission_readiness(target_listing_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into current_listing from public.listings where id=target_listing_id;
  if current_listing.id is null or (current_listing.owner_id <> auth.uid() and not public.is_staff()) then
    raise exception 'Listing not available';
  end if;
  return array_remove(public.evaluate_listing_submission_readiness(
    target_listing_id, true, true, true, true, '2026-07-20-v1'
  ), 'missing_attestations');
end;
$$;
revoke all on function public.get_listing_submission_readiness(uuid) from public, anon;
grant execute on function public.get_listing_submission_readiness(uuid) to authenticated;

create function public.submit_listing_for_review(
  target_listing_id uuid,
  attest_owner_authorized boolean,
  attest_information_truthful boolean,
  attest_modifications_and_issues_disclosed boolean,
  attest_legal_documentation boolean,
  target_attestation_version text
) returns table(success boolean, readiness_codes text[])
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; codes text[]; submitted_time timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into current_listing from public.listings where id=target_listing_id for update;
  if current_listing.id is null or current_listing.owner_id <> auth.uid() then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'draft' then return query select false, array['listing_not_draft']::text[]; return; end if;
  perform 1 from public.listing_media where listing_id=target_listing_id for update;
  perform 1 from public.listing_photo_uploads where listing_id=target_listing_id for update;
  codes := public.evaluate_listing_submission_readiness(target_listing_id, attest_owner_authorized,
    attest_information_truthful, attest_modifications_and_issues_disclosed,
    attest_legal_documentation, target_attestation_version);
  if cardinality(codes) > 0 then return query select false, codes; return; end if;

  insert into public.listing_submissions(listing_id,submitted_by,attest_owner_authorized,
    attest_information_truthful,attest_modifications_and_issues_disclosed,
    attest_legal_documentation,attestation_version,created_at)
  values(target_listing_id,auth.uid(),true,true,true,true,target_attestation_version,submitted_time);
  perform set_config('app.status_transition','allowed',true);
  perform set_config('app.listing_submission','allowed',true);
  update public.listings set status='submitted',submitted_at=submitted_time where id=target_listing_id;
  perform set_config('app.listing_submission','',true);
  perform set_config('app.status_transition','',true);
  insert into public.listing_status_history(listing_id,from_status,to_status,actor_id,created_at)
  values(target_listing_id,'draft','submitted',auth.uid(),submitted_time);
  return query select true, array[]::text[];
end;
$$;
revoke all on function public.submit_listing_for_review(uuid,boolean,boolean,boolean,boolean,text) from public, anon;
grant execute on function public.submit_listing_for_review(uuid,boolean,boolean,boolean,boolean,text) to authenticated;

create function public.claim_listing_for_review(target_listing_id uuid)
returns table(success boolean, conflict_code text)
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; started_time timestamptz := now();
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff role required'; end if;
  select * into current_listing from public.listings where id=target_listing_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'submitted' or current_listing.reviewer_id is not null then
    return query select false, 'already_claimed'::text; return;
  end if;
  perform set_config('app.status_transition','allowed',true);
  perform set_config('app.review_claim','allowed',true);
  update public.listings set status='in_review',reviewer_id=auth.uid(),review_started_at=started_time
  where id=target_listing_id;
  perform set_config('app.review_claim','',true);
  perform set_config('app.status_transition','',true);
  insert into public.listing_status_history(listing_id,from_status,to_status,actor_id,created_at)
  values(target_listing_id,'submitted','in_review',auth.uid(),started_time);
  return query select true, null::text;
end;
$$;
revoke all on function public.claim_listing_for_review(uuid) from public, anon;
grant execute on function public.claim_listing_for_review(uuid) to authenticated;
grant execute on function public.evaluate_listing_submission_readiness(uuid,boolean,boolean,boolean,boolean,text),
  public.get_listing_submission_readiness(uuid),
  public.submit_listing_for_review(uuid,boolean,boolean,boolean,boolean,text),
  public.claim_listing_for_review(uuid) to service_role;
