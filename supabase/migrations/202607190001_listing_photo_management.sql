-- Fase 3 de fotografías: administración segura y eliminación coordinada.
-- Storage y Postgres no comparten transacción. Los marcadores persistentes hacen
-- que una eliminación parcial sea bloqueante y reintentable, nunca silenciosa.

alter table public.listings
  add column if not exists deletion_started_at timestamptz;

alter table public.listing_media
  add column if not exists deletion_started_at timestamptz;

create index if not exists listing_media_pending_delete_idx
  on public.listing_media(listing_id)
  where deletion_started_at is not null;

-- La unicidad parcial garantiza "como máximo una". Este trigger diferible añade
-- "exactamente una" al final de cada transacción cuando todavía existen fotos.
create or replace function public.enforce_listing_photo_cover() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_listing_id uuid;
begin
  affected_listing_id := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;
  if exists (select 1 from public.listings where id = affected_listing_id)
    and exists (select 1 from public.listing_media where listing_id = affected_listing_id)
    and (select count(*) from public.listing_media where listing_id = affected_listing_id and is_cover) <> 1 then
    raise exception 'Listing photos require exactly one cover';
  end if;
  return null;
end;
$$;
revoke all on function public.enforce_listing_photo_cover() from public, anon, authenticated;
drop trigger if exists enforce_listing_photo_cover_deferred on public.listing_media;
create constraint trigger enforce_listing_photo_cover_deferred
after insert or update or delete on public.listing_media
deferrable initially deferred
for each row execute function public.enforce_listing_photo_cover();

-- El marcador del anuncio no pertenece al formulario ni a la Data API. Además,
-- una vez iniciado el borrado no se permite ninguna otra actualización.
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
  if old.status is distinct from new.status and current_setting('app.status_transition', true) <> 'allowed' then
    raise exception 'Use transition_listing to change status';
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

drop policy if exists "owners update editable listings" on public.listings;
create policy "owners update editable listings" on public.listings
for update to authenticated
using (owner_id = auth.uid() and status in ('draft','changes_requested') and deletion_started_at is null)
with check (owner_id = auth.uid() and status in ('draft','changes_requested') and deletion_started_at is null and not is_featured and editorial_description is null);

-- La eliminación directa ya no es segura porque no puede coordinar Storage.
drop policy if exists "owners delete own drafts" on public.listings;
revoke delete on table public.listings from authenticated;

create or replace function public.begin_draft_deletion(target_listing_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  started_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;

  select listings.* into current_listing
  from public.listings as listings
  where listings.id = target_listing_id
    and listings.owner_id = auth.uid()
  for update;

  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not a deletable draft'; end if;

  started_at := coalesce(current_listing.deletion_started_at, now());
  if current_listing.deletion_started_at is null then
    perform set_config('app.draft_deletion', 'allowed', true);
    update public.listings set deletion_started_at = started_at where id = current_listing.id;
    perform set_config('app.draft_deletion', '', true);
  end if;
  return started_at;
end;
$$;

-- Sólo service_role finaliza, después de comprobar que el prefijo privado quedó vacío.
create or replace function public.finalize_draft_deletion(
  target_listing_id uuid,
  target_requester_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
begin
  select listings.* into current_listing
  from public.listings as listings
  where listings.id = target_listing_id
  for update;

  if current_listing.id is null or current_listing.owner_id <> target_requester_id then
    raise exception 'Listing not available';
  end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not a deletable draft'; end if;
  if current_listing.deletion_started_at is null then raise exception 'Draft deletion was not started'; end if;
  if exists (
    select 1 from storage.objects as objects
    where objects.bucket_id = 'listing-media'
      and objects.name like target_listing_id::text || '/%'
  ) then raise exception 'Draft storage prefix is not empty'; end if;

  delete from public.listings where id = current_listing.id;
  return true;
end;
$$;

create or replace function public.set_listing_photo_cover(target_media_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_listing_id uuid;
  current_listing public.listings;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select media.listing_id into target_listing_id
  from public.listing_media as media where media.id = target_media_id;
  if target_listing_id is null then raise exception 'Photo not available'; end if;

  select listings.* into current_listing
  from public.listings as listings where listings.id = target_listing_id for update;
  if current_listing.id is null or current_listing.owner_id <> auth.uid() then raise exception 'Photo not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;

  perform 1 from public.listing_media as media where media.listing_id = target_listing_id for update;
  if exists (select 1 from public.listing_media where listing_id = target_listing_id and deletion_started_at is not null) then
    raise exception 'Photo deletion in progress';
  end if;
  if not exists (select 1 from public.listing_media where id = target_media_id and listing_id = target_listing_id) then
    raise exception 'Photo not available';
  end if;

  update public.listing_media set is_cover = false, updated_at = now()
  where listing_id = target_listing_id and is_cover;
  update public.listing_media set is_cover = true, updated_at = now()
  where id = target_media_id and listing_id = target_listing_id;
  return true;
end;
$$;

create or replace function public.reorder_listing_photos(
  target_listing_id uuid,
  target_media_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  media_count integer;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if target_media_ids is null then raise exception 'Complete photo order required'; end if;

  select listings.* into current_listing
  from public.listings as listings
  where listings.id = target_listing_id and listings.owner_id = auth.uid()
  for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;

  perform 1 from public.listing_media as media where media.listing_id = target_listing_id for update;
  select count(*) into media_count from public.listing_media where listing_id = target_listing_id;
  if exists (select 1 from public.listing_media where listing_id = target_listing_id and deletion_started_at is not null) then
    raise exception 'Photo deletion in progress';
  end if;
  if cardinality(target_media_ids) <> media_count
    or cardinality(target_media_ids) <> (select count(distinct item) from unnest(target_media_ids) as item)
    or exists (
      select id from public.listing_media where listing_id = target_listing_id
      except select item from unnest(target_media_ids) as item
    )
    or exists (
      select item from unnest(target_media_ids) as item
      except select id from public.listing_media where listing_id = target_listing_id
    ) then raise exception 'Complete photo order does not match listing'; end if;

  set constraints public.listing_media_listing_sort_unique deferred;
  update public.listing_media as media
  set sort_order = ordered.ordinality - 1, updated_at = now()
  from unnest(target_media_ids) with ordinality as ordered(id, ordinality)
  where media.id = ordered.id and media.listing_id = target_listing_id;
  return true;
end;
$$;

create or replace function public.prepare_listing_photo_deletion(target_media_id uuid)
returns table(deleting_listing_id uuid, deleting_storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_media public.listing_media;
  current_listing public.listings;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select media.* into target_media from public.listing_media as media where media.id = target_media_id;
  if target_media.id is null then raise exception 'Photo not available'; end if;

  select listings.* into current_listing
  from public.listings as listings where listings.id = target_media.listing_id for update;
  if current_listing.id is null or current_listing.owner_id <> auth.uid() then raise exception 'Photo not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;

  perform 1 from public.listing_media as media where media.listing_id = current_listing.id for update;
  select media.* into target_media from public.listing_media as media where media.id = target_media_id and media.listing_id = current_listing.id;
  if target_media.id is null then raise exception 'Photo not available'; end if;
  if exists (
    select 1 from public.listing_media
    where listing_id = current_listing.id and deletion_started_at is not null and id <> target_media_id
  ) then raise exception 'Another photo deletion is in progress'; end if;

  if target_media.deletion_started_at is null then
    update public.listing_media set deletion_started_at = now(), updated_at = now() where id = target_media.id;
  end if;
  return query select current_listing.id, target_media.storage_path;
end;
$$;

create or replace function public.cancel_listing_photo_deletion(
  target_media_id uuid,
  target_requester_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_media public.listing_media;
  current_listing public.listings;
begin
  select media.* into target_media from public.listing_media as media where media.id = target_media_id for update;
  if target_media.id is null then return false; end if;
  select listings.* into current_listing from public.listings as listings where listings.id = target_media.listing_id for update;
  if current_listing.owner_id <> target_requester_id then raise exception 'Photo not available'; end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'listing-media' and name = target_media.storage_path
  ) then raise exception 'Deleted storage object cannot be restored'; end if;
  update public.listing_media set deletion_started_at = null, updated_at = now() where id = target_media.id;
  return true;
end;
$$;

create or replace function public.finalize_listing_photo_deletion(
  target_media_id uuid,
  target_requester_id uuid
)
returns table(deleted_listing_id uuid, deleted_storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_media public.listing_media;
  current_listing public.listings;
  remaining_count integer;
begin
  select media.* into target_media from public.listing_media as media where media.id = target_media_id;
  if target_media.id is null then raise exception 'Photo not available'; end if;
  select listings.* into current_listing from public.listings as listings where listings.id = target_media.listing_id for update;
  if current_listing.id is null or current_listing.owner_id <> target_requester_id then raise exception 'Photo not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;

  perform 1 from public.listing_media as media where media.listing_id = current_listing.id for update;
  select media.* into target_media from public.listing_media as media where media.id = target_media_id and media.listing_id = current_listing.id;
  if target_media.id is null or target_media.deletion_started_at is null then raise exception 'Photo deletion was not started'; end if;
  if exists (
    select 1 from storage.objects where bucket_id = 'listing-media' and name = target_media.storage_path
  ) then raise exception 'Photo storage object still exists'; end if;

  delete from public.listing_media where id = target_media.id;
  set constraints public.listing_media_listing_sort_unique deferred;
  with ranked as (
    select id, row_number() over (order by sort_order, created_at, id) - 1 as new_order
    from public.listing_media where listing_id = current_listing.id
  )
  update public.listing_media as media
  set sort_order = ranked.new_order, updated_at = now()
  from ranked where media.id = ranked.id;

  select count(*) into remaining_count from public.listing_media where listing_id = current_listing.id;
  if remaining_count > 0 and not exists (
    select 1 from public.listing_media where listing_id = current_listing.id and is_cover
  ) then
    update public.listing_media set is_cover = true, updated_at = now()
    where id = (
      select id from public.listing_media where listing_id = current_listing.id order by sort_order, id limit 1
    );
  end if;
  return query select current_listing.id, target_media.storage_path;
end;
$$;

-- Incrementa las funciones de FASE 1 para cerrar reservas y uploads firmados
-- desde el instante en que comienza la eliminación del draft.
create or replace function public.can_upload_reserved_listing_photo(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.listing_photo_uploads as uploads
    join public.listings as listings on listings.id = uploads.listing_id
    where uploads.storage_path = target_storage_path
      and uploads.requested_by = auth.uid()
      and uploads.expires_at > now()
      and listings.owner_id = auth.uid()
      and listings.status = 'draft'
      and listings.deletion_started_at is null
  )
$$;

-- Las funciones de reserva/finalización conservan sus firmas y comprueban el
-- marcador bajo el mismo lock que serializa altas y borrados.
create or replace function public.reserve_listing_photo_upload(
  target_listing_id uuid,
  target_mime_type text,
  target_size_bytes bigint,
  target_extension text
)
returns table(reservation_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid(); current_listing public.listings;
  normalized_mime text := lower(trim(target_mime_type));
  normalized_extension text := lower(trim(leading '.' from trim(target_extension)));
  active_slots bigint; generated_id uuid := gen_random_uuid(); generated_path text;
begin
  if current_user_id is null then raise exception 'Not authorized'; end if;
  if normalized_mime is null or normalized_mime not in ('image/jpeg','image/png','image/webp') then raise exception 'Invalid image MIME type'; end if;
  if target_size_bytes is null or target_size_bytes < 1 or target_size_bytes > 10485760 then raise exception 'Invalid image size'; end if;
  if normalized_extension is null or normalized_extension not in ('jpg','jpeg','png','webp') then raise exception 'Invalid image extension'; end if;
  if (normalized_mime='image/jpeg' and normalized_extension not in ('jpg','jpeg'))
    or (normalized_mime='image/png' and normalized_extension<>'png')
    or (normalized_mime='image/webp' and normalized_extension<>'webp') then raise exception 'Image MIME type and extension do not match'; end if;

  select listings.* into current_listing from public.listings as listings
  where listings.id=target_listing_id and listings.owner_id=current_user_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;

  select (select count(*) from public.listing_media where listing_id=target_listing_id)
    + (select count(*) from public.listing_photo_uploads where listing_id=target_listing_id and expires_at>now()) into active_slots;
  if active_slots >= 20 then raise exception 'Listing photo limit reached'; end if;
  generated_path := target_listing_id::text||'/'||generated_id::text||'.'||normalized_extension;
  insert into public.listing_photo_uploads(id,listing_id,requested_by,storage_path,expected_mime_type,expected_size_bytes,expires_at)
  values(generated_id,target_listing_id,current_user_id,generated_path,normalized_mime,target_size_bytes,now()+interval '15 minutes');
  return query select generated_id, generated_path;
end;
$$;

create or replace function public.finalize_listing_photo_upload(
  target_reservation_id uuid,
  target_requester_id uuid,
  verified_mime_type text,
  verified_size_bytes bigint,
  verified_width integer,
  verified_height integer
)
returns table(
  media_id uuid,
  finalized_listing_id uuid,
  finalized_storage_path text,
  finalized_sort_order integer,
  finalized_is_cover boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_upload public.listing_photo_uploads;
  current_listing public.listings;
  next_sort_order integer;
  should_be_cover boolean;
  generated_media_id uuid := gen_random_uuid();
begin
  if target_requester_id is null then raise exception 'Not authorized'; end if;
  if verified_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Invalid verified MIME type'; end if;
  if verified_size_bytes is null or verified_size_bytes < 1 or verified_size_bytes > 10485760 then raise exception 'Invalid verified image size'; end if;
  if verified_width is null or verified_height is null or verified_width < 1 or verified_height < 1
    or verified_width::bigint * verified_height::bigint > 25000000 then raise exception 'Invalid verified image dimensions'; end if;

  select uploads.* into reserved_upload from public.listing_photo_uploads as uploads
  where uploads.id = target_reservation_id for update;
  if reserved_upload.id is null or reserved_upload.requested_by <> target_requester_id then raise exception 'Upload reservation not available'; end if;
  if reserved_upload.expires_at <= now() then raise exception 'Upload reservation expired'; end if;
  if reserved_upload.expected_mime_type <> verified_mime_type
    or reserved_upload.expected_size_bytes <> verified_size_bytes then raise exception 'Uploaded object does not match reservation'; end if;

  select listings.* into current_listing from public.listings as listings
  where listings.id = reserved_upload.listing_id for update;
  if current_listing.id is null or current_listing.owner_id <> target_requester_id then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'draft' then raise exception 'Listing is not an editable draft'; end if;
  if current_listing.deletion_started_at is not null then raise exception 'Draft deletion in progress'; end if;
  if not exists (select 1 from storage.objects where bucket_id='listing-media' and name=reserved_upload.storage_path) then raise exception 'Uploaded object not found'; end if;
  if (select count(*) from public.listing_media where listing_id=current_listing.id) >= 20 then raise exception 'Listing photo limit reached'; end if;

  select coalesce(max(sort_order),-1)+1,
    not exists(select 1 from public.listing_media where listing_id=current_listing.id)
  into next_sort_order, should_be_cover
  from public.listing_media where listing_id=current_listing.id;
  if next_sort_order > 19 then raise exception 'Listing photo limit reached'; end if;

  insert into public.listing_media(
    id,listing_id,storage_path,media_type,mime_type,file_size_bytes,width,height,uploaded_by,sort_order,is_cover,updated_at
  ) values (
    generated_media_id,current_listing.id,reserved_upload.storage_path,'image',verified_mime_type,
    verified_size_bytes,verified_width,verified_height,target_requester_id,next_sort_order,should_be_cover,now()
  );
  delete from public.listing_photo_uploads where id=reserved_upload.id;
  return query select generated_media_id,current_listing.id,reserved_upload.storage_path,next_sort_order,should_be_cover;
end;
$$;

revoke all on function public.begin_draft_deletion(uuid) from public, anon;
revoke all on function public.finalize_draft_deletion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_listing_photo_cover(uuid) from public, anon;
revoke all on function public.reorder_listing_photos(uuid, uuid[]) from public, anon;
revoke all on function public.prepare_listing_photo_deletion(uuid) from public, anon;
revoke all on function public.cancel_listing_photo_deletion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_listing_photo_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_draft_deletion(uuid) to authenticated, service_role;
grant execute on function public.finalize_draft_deletion(uuid, uuid) to service_role;
grant execute on function public.set_listing_photo_cover(uuid) to authenticated, service_role;
grant execute on function public.reorder_listing_photos(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.prepare_listing_photo_deletion(uuid) to authenticated, service_role;
grant execute on function public.cancel_listing_photo_deletion(uuid, uuid) to service_role;
grant execute on function public.finalize_listing_photo_deletion(uuid, uuid) to service_role;
