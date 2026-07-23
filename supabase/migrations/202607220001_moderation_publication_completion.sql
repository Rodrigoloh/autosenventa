-- Cierra el flujo de moderacion: approved es una decision, published es el estado operativo.

create or replace function public.decide_listing_review(
  target_listing_id uuid,
  target_decision text,
  target_message text default null
)
returns table(success boolean, conflict_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  current_submission uuid;
  decided_time timestamptz := now();
  normalized_message text := nullif(trim(target_message), '');
  final_status public.listing_status;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff role required';
  end if;
  if target_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Invalid review decision';
  end if;
  if target_decision in ('changes_requested', 'rejected')
    and length(coalesce(normalized_message, '')) < 20 then
    return query select false, 'message_too_short'::text;
    return;
  end if;

  select * into current_listing
  from public.listings
  where id = target_listing_id
  for update;

  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'in_review' then
    return query select false, 'already_decided'::text;
    return;
  end if;
  if current_listing.reviewer_id <> auth.uid() and public.current_role() <> 'admin' then
    return query select false, 'not_assigned'::text;
    return;
  end if;

  select id into current_submission
  from public.listing_submissions
  where listing_id = target_listing_id
  order by created_at desc, id desc
  limit 1
  for update;
  if current_submission is null then raise exception 'Submission not available'; end if;

  begin
    insert into public.listing_review_decisions(
      submission_id, listing_id, reviewer_id, decision, message, created_at
    ) values (
      current_submission, target_listing_id, auth.uid(), target_decision,
      case when target_decision = 'approved' then null else normalized_message end,
      decided_time
    );
  exception when unique_violation then
    return query select false, 'already_decided'::text;
    return;
  end;

  final_status := case when target_decision = 'approved' then 'published'::public.listing_status
    else target_decision::public.listing_status end;

  perform set_config('app.status_transition', 'allowed', true);
  perform set_config('app.review_claim', 'allowed', true);
  update public.listings
  set status = final_status,
      published_at = case when final_status = 'published' then decided_time else published_at end,
      reviewer_id = case when final_status = 'published' then reviewer_id else null end,
      review_started_at = case when final_status = 'published' then review_started_at else null end
  where id = target_listing_id;
  perform set_config('app.review_claim', '', true);
  perform set_config('app.status_transition', '', true);

  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id, created_at)
  values(target_listing_id, 'in_review', final_status, auth.uid(), decided_time);
  return query select true, null::text;
end;
$$;

revoke all on function public.decide_listing_review(uuid, text, text) from public, anon;
grant execute on function public.decide_listing_review(uuid, text, text) to authenticated, service_role;

create function public.publish_legacy_approved_listing(target_listing_id uuid)
returns table(success boolean, conflict_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  published_time timestamptz := now();
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Staff role required';
  end if;

  select * into current_listing
  from public.listings
  where id = target_listing_id
  for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status = 'published' then
    return query select true, 'already_published'::text;
    return;
  end if;
  if current_listing.status <> 'approved' then
    return query select false, 'not_legacy_approved'::text;
    return;
  end if;
  if not exists (
    select 1 from public.listing_review_decisions
    where listing_id = target_listing_id and decision = 'approved'
  ) then
    return query select false, 'approved_decision_missing'::text;
    return;
  end if;

  perform set_config('app.status_transition', 'allowed', true);
  update public.listings
  set status = 'published', published_at = published_time
  where id = target_listing_id;
  perform set_config('app.status_transition', '', true);

  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id, created_at)
  values(target_listing_id, 'approved', 'published', auth.uid(), published_time);
  return query select true, null::text;
end;
$$;

revoke all on function public.publish_legacy_approved_listing(uuid) from public, anon;
grant execute on function public.publish_legacy_approved_listing(uuid) to authenticated, service_role;

-- La lectura publica pasa por una proyeccion estrecha; las tablas completas quedan
-- visibles solamente para propietario y staff.
drop policy if exists "published listings public read" on public.listings;
drop policy if exists "published listing media public read" on public.listing_media;

create function public.get_public_listing(target_listing_id uuid)
returns table(
  id uuid, title text, year smallint, variant text, price_mxn numeric,
  mileage_km integer, city text, state_region text,
  exterior_color text, interior_color text, body_style text,
  transmission text, drivetrain text, fuel_type text, engine text,
  owner_description text, ownership_history text, maintenance_history text,
  modifications text, known_issues text, sale_reason text,
  brand_name text, model_name text, owner_username text,
  owner_display_name text, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.title, l.year, l.variant, l.price_mxn,
    l.mileage_km, l.city, l.state_region,
    l.exterior_color, l.interior_color, l.body_style,
    l.transmission, l.drivetrain, l.fuel_type, l.engine,
    l.owner_description, l.ownership_history, l.maintenance_history,
    l.modifications, l.known_issues, l.sale_reason,
    b.name, m.name, p.username, p.display_name, l.published_at
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  left join public.brands b on b.id = l.brand_id
  left join public.models m on m.id = l.model_id
  where l.id = target_listing_id and l.status = 'published'
$$;

revoke all on function public.get_public_listing(uuid) from public;
grant execute on function public.get_public_listing(uuid) to anon, authenticated, service_role;

drop function public.get_public_profile_listings(text);
create function public.get_public_profile_listings(target_username text)
returns table(id uuid, slug text, title text, year smallint, price_mxn numeric, city text)
language sql stable security definer set search_path = '' as $$
  select listings.id, listings.slug, listings.title, listings.year, listings.price_mxn, listings.city
  from public.listings join public.profiles on profiles.id=listings.owner_id
  where profiles.username=lower(trim(target_username)) and listings.status='published'
  order by listings.published_at desc nulls last
$$;
revoke all on function public.get_public_profile_listings(text) from public;
grant execute on function public.get_public_profile_listings(text) to anon, authenticated, service_role;

-- Reservas y gestion de medios admiten los dos estados editables del propietario.
create or replace function public.can_upload_reserved_listing_photo(target_storage_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.listing_photo_uploads uploads
    join public.listings listings on listings.id = uploads.listing_id
    where uploads.storage_path = target_storage_path
      and uploads.requested_by = auth.uid()
      and uploads.expires_at > now()
      and listings.owner_id = auth.uid()
      and listings.status in ('draft', 'changes_requested')
      and listings.deletion_started_at is null
  )
$$;

create or replace function public.cancel_listing_photo_upload(target_reservation_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare deleted_count integer;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  delete from public.listing_photo_uploads uploads
  using public.listings listings
  where uploads.id = target_reservation_id
    and listings.id = uploads.listing_id
    and uploads.requested_by = auth.uid()
    and listings.owner_id = auth.uid()
    and listings.status in ('draft', 'changes_requested')
    and listings.deletion_started_at is null
    and not exists (
      select 1 from public.listing_media media where media.storage_path = uploads.storage_path
    );
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

-- Reemplazos acotados de las operaciones de medios para changes_requested.
create or replace function public.set_listing_photo_cover(target_media_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare target_listing_id uuid; current_listing public.listings;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select listing_id into target_listing_id from public.listing_media where id=target_media_id;
  select * into current_listing from public.listings where id=target_listing_id for update;
  if current_listing.id is null or current_listing.owner_id<>auth.uid() then raise exception 'Photo not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  perform 1 from public.listing_media where listing_id=target_listing_id for update;
  if exists(select 1 from public.listing_media where listing_id=target_listing_id and deletion_started_at is not null) then raise exception 'Photo deletion in progress'; end if;
  update public.listing_media set is_cover=false,updated_at=now() where listing_id=target_listing_id and is_cover;
  update public.listing_media set is_cover=true,updated_at=now() where id=target_media_id and listing_id=target_listing_id;
  return found;
end;
$$;

create or replace function public.reorder_listing_photos(target_listing_id uuid,target_media_ids uuid[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; media_count integer;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if target_media_ids is null then raise exception 'Complete photo order required'; end if;
  select * into current_listing from public.listings where id=target_listing_id and owner_id=auth.uid() for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  perform 1 from public.listing_media where listing_id=target_listing_id for update;
  select count(*) into media_count from public.listing_media where listing_id=target_listing_id;
  if exists(select 1 from public.listing_media where listing_id=target_listing_id and deletion_started_at is not null) then raise exception 'Photo deletion in progress'; end if;
  if cardinality(target_media_ids)<>media_count
    or cardinality(target_media_ids)<>(select count(distinct item) from unnest(target_media_ids) item)
    or exists(select id from public.listing_media where listing_id=target_listing_id except select item from unnest(target_media_ids) item)
    or exists(select item from unnest(target_media_ids) item except select id from public.listing_media where listing_id=target_listing_id)
  then raise exception 'Complete photo order does not match listing'; end if;
  set constraints public.listing_media_listing_sort_unique deferred;
  update public.listing_media media set sort_order=ordered.ordinality-1,updated_at=now()
  from unnest(target_media_ids) with ordinality ordered(id,ordinality)
  where media.id=ordered.id and media.listing_id=target_listing_id;
  return true;
end;
$$;

create or replace function public.prepare_listing_photo_deletion(target_media_id uuid)
returns table(deleting_listing_id uuid,deleting_storage_path text)
language plpgsql security definer set search_path = '' as $$
declare target_media public.listing_media; current_listing public.listings;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into target_media from public.listing_media where id=target_media_id;
  if target_media.id is null then raise exception 'Photo not available'; end if;
  select * into current_listing from public.listings where id=target_media.listing_id for update;
  if current_listing.id is null or current_listing.owner_id<>auth.uid() then raise exception 'Photo not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  perform 1 from public.listing_media where listing_id=current_listing.id for update;
  select * into target_media from public.listing_media where id=target_media_id and listing_id=current_listing.id;
  if target_media.id is null then raise exception 'Photo not available'; end if;
  if exists(select 1 from public.listing_media where listing_id=current_listing.id and deletion_started_at is not null and id<>target_media_id) then raise exception 'Another photo deletion is in progress'; end if;
  if target_media.deletion_started_at is null then update public.listing_media set deletion_started_at=now(),updated_at=now() where id=target_media.id; end if;
  return query select current_listing.id,target_media.storage_path;
end;
$$;

create or replace function public.finalize_listing_photo_deletion(target_media_id uuid,target_requester_id uuid)
returns table(deleted_listing_id uuid,deleted_storage_path text)
language plpgsql security definer set search_path = '' as $$
declare target_media public.listing_media; current_listing public.listings; remaining_count integer;
begin
  select * into target_media from public.listing_media where id=target_media_id;
  if target_media.id is null then raise exception 'Photo not available'; end if;
  select * into current_listing from public.listings where id=target_media.listing_id for update;
  if current_listing.id is null or current_listing.owner_id<>target_requester_id then raise exception 'Photo not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  perform 1 from public.listing_media where listing_id=current_listing.id for update;
  select * into target_media from public.listing_media where id=target_media_id and listing_id=current_listing.id;
  if target_media.id is null or target_media.deletion_started_at is null then raise exception 'Photo deletion was not started'; end if;
  if exists(select 1 from storage.objects where bucket_id='listing-media' and name=target_media.storage_path) then raise exception 'Photo storage object still exists'; end if;
  delete from public.listing_media where id=target_media.id;
  set constraints public.listing_media_listing_sort_unique deferred;
  with ranked as (select id,row_number() over(order by sort_order,created_at,id)-1 new_order from public.listing_media where listing_id=current_listing.id)
  update public.listing_media media set sort_order=ranked.new_order,updated_at=now() from ranked where media.id=ranked.id;
  select count(*) into remaining_count from public.listing_media where listing_id=current_listing.id;
  if remaining_count>0 and not exists(select 1 from public.listing_media where listing_id=current_listing.id and is_cover) then
    update public.listing_media set is_cover=true,updated_at=now() where id=(select id from public.listing_media where listing_id=current_listing.id order by sort_order,id limit 1);
  end if;
  return query select current_listing.id,target_media.storage_path;
end;
$$;

-- reserve/finalize conservan su validacion completa y solo amplian el estado editable.
create or replace function public.reserve_listing_photo_upload(target_listing_id uuid,target_mime_type text,target_size_bytes bigint,target_extension text)
returns table(reservation_id uuid,storage_path text)
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid:=auth.uid(); current_listing public.listings; normalized_mime text:=lower(trim(target_mime_type)); normalized_extension text:=lower(trim(leading '.' from trim(target_extension))); active_slots bigint; generated_id uuid:=gen_random_uuid(); generated_path text;
begin
  if current_user_id is null then raise exception 'Not authorized'; end if;
  if normalized_mime is null or normalized_mime not in ('image/jpeg','image/png','image/webp') then raise exception 'Invalid image MIME type'; end if;
  if target_size_bytes is null or target_size_bytes<1 or target_size_bytes>10485760 then raise exception 'Invalid image size'; end if;
  if normalized_extension is null or normalized_extension not in ('jpg','jpeg','png','webp') then raise exception 'Invalid image extension'; end if;
  if (normalized_mime='image/jpeg' and normalized_extension not in ('jpg','jpeg')) or (normalized_mime='image/png' and normalized_extension<>'png') or (normalized_mime='image/webp' and normalized_extension<>'webp') then raise exception 'Image MIME type and extension do not match'; end if;
  select * into current_listing from public.listings where id=target_listing_id and owner_id=current_user_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  select (select count(*) from public.listing_media where listing_id=target_listing_id)+(select count(*) from public.listing_photo_uploads where listing_id=target_listing_id and expires_at>now()) into active_slots;
  if active_slots>=20 then raise exception 'Listing photo limit reached'; end if;
  generated_path:=target_listing_id::text||'/'||generated_id::text||'.'||normalized_extension;
  insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at)
  values(generated_id,target_listing_id,current_user_id,generated_path,normalized_mime,target_size_bytes,now()+interval '15 minutes');
  return query select generated_id,generated_path;
end;
$$;

create or replace function public.finalize_listing_photo_upload(target_reservation_id uuid,target_requester_id uuid,verified_mime_type text,verified_size_bytes bigint,verified_width integer,verified_height integer)
returns table(media_id uuid,finalized_listing_id uuid,finalized_storage_path text,finalized_sort_order integer,finalized_is_cover boolean)
language plpgsql security definer set search_path = '' as $$
declare reserved_upload public.listing_photo_uploads; current_listing public.listings; next_sort_order integer; should_be_cover boolean; generated_media_id uuid:=gen_random_uuid();
begin
  if target_requester_id is null then raise exception 'Not authorized'; end if;
  if verified_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Invalid verified MIME type'; end if;
  if verified_size_bytes is null or verified_size_bytes<1 or verified_size_bytes>10485760 then raise exception 'Invalid verified image size'; end if;
  if verified_width is null or verified_height is null or verified_width<1 or verified_height<1 or verified_width::bigint*verified_height::bigint>25000000 then raise exception 'Invalid verified image dimensions'; end if;
  select * into reserved_upload from public.listing_photo_uploads where id=target_reservation_id for update;
  if reserved_upload.id is null or reserved_upload.requested_by<>target_requester_id then raise exception 'Upload reservation not available'; end if;
  if reserved_upload.expires_at<=now() then raise exception 'Upload reservation expired'; end if;
  if reserved_upload.expected_mime_type<>verified_mime_type or reserved_upload.expected_size_bytes<>verified_size_bytes then raise exception 'Uploaded object does not match reservation'; end if;
  select * into current_listing from public.listings where id=reserved_upload.listing_id for update;
  if current_listing.id is null or current_listing.owner_id<>target_requester_id then raise exception 'Listing not available'; end if;
  if current_listing.status not in ('draft','changes_requested') then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  if not exists(select 1 from storage.objects where bucket_id='listing-media' and name=reserved_upload.storage_path) then raise exception 'Uploaded object not found'; end if;
  if (select count(*) from public.listing_media where listing_id=current_listing.id)>=20 then raise exception 'Listing photo limit reached'; end if;
  select coalesce(max(sort_order),-1)+1,not exists(select 1 from public.listing_media where listing_id=current_listing.id) into next_sort_order,should_be_cover from public.listing_media where listing_id=current_listing.id;
  if next_sort_order>19 then raise exception 'Listing photo limit reached'; end if;
  insert into public.listing_media(id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover,updated_at)
  values(generated_media_id,current_listing.id,reserved_upload.storage_path,'image',verified_mime_type,verified_size_bytes,verified_width,verified_height,target_requester_id,next_sort_order,should_be_cover,now());
  delete from public.listing_photo_uploads where id=reserved_upload.id;
  return query select generated_media_id,current_listing.id,reserved_upload.storage_path,next_sort_order,should_be_cover;
end;
$$;

revoke all on function public.publish_legacy_approved_listing(uuid), public.get_public_listing(uuid) from public;
revoke all on function public.publish_legacy_approved_listing(uuid) from anon;
grant execute on function public.publish_legacy_approved_listing(uuid) to authenticated, service_role;
grant execute on function public.get_public_listing(uuid) to anon, authenticated, service_role;
