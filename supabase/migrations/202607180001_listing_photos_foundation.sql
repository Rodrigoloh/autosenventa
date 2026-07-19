-- Fase 1 de fotografías: esquema, reservas y autorización de Storage.
-- Las columnas de metadatos permanecen nullable para no inventar datos de medios
-- históricos. Los CHECK NOT VALID se aplican inmediatamente a filas nuevas y se
-- podrán validar después de auditar/backfillear cualquier fila previa.

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'listing-media';

alter table public.listing_media
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists uploaded_by uuid,
  add column if not exists updated_at timestamptz default now();

-- El default histórico era cero, por lo que podrían existir posiciones repetidas.
-- Se normaliza antes de crear CHECKs nuevos: actualizar una fila histórica después
-- de un CHECK NOT VALID también exigiría que sus metadatos ya estuvieran completos.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_listing_sort_unique'
  ) then
    with ranked as (
      select id,
             row_number() over (
               partition by listing_id
               order by sort_order, created_at, id
             ) - 1 as normalized_sort_order
      from public.listing_media
    )
    update public.listing_media as media
    set sort_order = ranked.normalized_sort_order
    from ranked
    where media.id = ranked.id;

    alter table public.listing_media
      add constraint listing_media_listing_sort_unique
      unique (listing_id, sort_order)
      deferrable initially deferred;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_uploaded_by_fkey'
  ) then
    alter table public.listing_media
      add constraint listing_media_uploaded_by_fkey
      foreign key (uploaded_by) references public.profiles(id) on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_sort_order_range'
  ) then
    alter table public.listing_media
      add constraint listing_media_sort_order_range
      check (sort_order between 0 and 19) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_image_mime'
  ) then
    alter table public.listing_media
      add constraint listing_media_image_mime
      check (mime_type is not null and mime_type in ('image/jpeg', 'image/png', 'image/webp'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_image_size'
  ) then
    alter table public.listing_media
      add constraint listing_media_image_size
      check (file_size_bytes is not null and file_size_bytes between 1 and 10485760)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_image_dimensions'
  ) then
    alter table public.listing_media
      add constraint listing_media_image_dimensions
      check (width is not null and height is not null and width > 0 and height > 0)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_media'::regclass
      and conname = 'listing_media_photos_only'
  ) then
    alter table public.listing_media
      add constraint listing_media_photos_only
      check (media_type = 'image') not valid;
  end if;
end $$;

create table public.listing_photo_uploads (
  id uuid primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  expected_mime_type text not null
    check (expected_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  expected_size_bytes bigint not null
    check (expected_size_bytes between 1 and 10485760),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint listing_photo_upload_path_matches_listing check (
    split_part(storage_path, '/', 1) = listing_id::text
    and storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  constraint listing_photo_upload_expiry_after_creation check (expires_at > created_at)
);

create index listing_photo_uploads_listing_expiry_idx
  on public.listing_photo_uploads(listing_id, expires_at);
create index listing_photo_uploads_expiry_idx
  on public.listing_photo_uploads(expires_at);

alter table public.listing_photo_uploads enable row level security;

-- No hay políticas de DML sobre reservas: sólo los RPC SECURITY DEFINER pueden
-- crearlas o cancelarlas. La función usada por Storage tampoco expone sus filas.
revoke all on table public.listing_photo_uploads from public, anon, authenticated;
grant all privileges on table public.listing_photo_uploads to service_role;

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
  current_user_id uuid := auth.uid();
  current_listing public.listings;
  normalized_mime text := lower(trim(target_mime_type));
  normalized_extension text := lower(trim(leading '.' from trim(target_extension)));
  active_slots bigint;
  generated_id uuid := gen_random_uuid();
  generated_path text;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  if normalized_mime is null or normalized_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid image MIME type';
  end if;
  if target_size_bytes is null or target_size_bytes < 1 or target_size_bytes > 10485760 then
    raise exception 'Invalid image size';
  end if;
  if normalized_extension is null or normalized_extension not in ('jpg', 'jpeg', 'png', 'webp') then
    raise exception 'Invalid image extension';
  end if;
  if (normalized_mime = 'image/jpeg' and normalized_extension not in ('jpg', 'jpeg'))
    or (normalized_mime = 'image/png' and normalized_extension <> 'png')
    or (normalized_mime = 'image/webp' and normalized_extension <> 'webp') then
    raise exception 'Image MIME type and extension do not match';
  end if;

  select listings.* into current_listing
  from public.listings as listings
  where listings.id = target_listing_id
    and listings.owner_id = current_user_id
  for update;

  if current_listing.id is null then
    raise exception 'Listing not available';
  end if;
  if current_listing.status <> 'draft' then
    raise exception 'Listing is not an editable draft';
  end if;

  select
    (select count(*) from public.listing_media as media
      where media.listing_id = target_listing_id)
    +
    (select count(*) from public.listing_photo_uploads as uploads
      where uploads.listing_id = target_listing_id
        and uploads.expires_at > now())
  into active_slots;

  if active_slots >= 20 then
    raise exception 'Listing photo limit reached';
  end if;

  generated_path := target_listing_id::text || '/' || generated_id::text || '.' || normalized_extension;

  insert into public.listing_photo_uploads(
    id, listing_id, requested_by, storage_path,
    expected_mime_type, expected_size_bytes, expires_at
  ) values (
    generated_id, target_listing_id, current_user_id, generated_path,
    normalized_mime, target_size_bytes, now() + interval '15 minutes'
  );

  return query select generated_id, generated_path;
end;
$$;

create or replace function public.cancel_listing_photo_upload(target_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  delete from public.listing_photo_uploads as uploads
  where uploads.id = target_reservation_id
    and uploads.requested_by = auth.uid()
    and not exists (
      select 1 from public.listing_media as media
      where media.storage_path = uploads.storage_path
    );

  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

-- Predicado exacto para INSERT en Storage. SECURITY DEFINER permite consultar la
-- tabla de reservas sin conceder SELECT directo al navegador.
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
  )
$$;

revoke all on function public.reserve_listing_photo_upload(uuid, text, bigint, text) from public, anon;
revoke all on function public.cancel_listing_photo_upload(uuid) from public, anon;
revoke all on function public.can_upload_reserved_listing_photo(text) from public, anon;
grant execute on function public.reserve_listing_photo_upload(uuid, text, bigint, text) to authenticated;
grant execute on function public.cancel_listing_photo_upload(uuid) to authenticated;
grant execute on function public.can_upload_reserved_listing_photo(text) to authenticated;
grant execute on function public.reserve_listing_photo_upload(uuid, text, bigint, text) to service_role;
grant execute on function public.cancel_listing_photo_upload(uuid) to service_role;
grant execute on function public.can_upload_reserved_listing_photo(text) to service_role;

-- Toda mutación de metadatos se reserva para operaciones estrechas posteriores.
revoke insert, update, delete on table public.listing_media from anon, authenticated;
revoke insert, update, delete on table public.listing_photo_uploads from anon, authenticated;

drop policy if exists "owners manage editable media" on public.listing_media;
drop policy if exists "staff manages media" on public.listing_media;

drop policy if exists "published storage media public read" on storage.objects;
drop policy if exists "owners upload own listing media" on storage.objects;
drop policy if exists "owners edit own listing media" on storage.objects;
drop policy if exists "owners delete own listing media" on storage.objects;

-- Recreate read policies explicitly and keep all object reads authenticated.
drop policy if exists "owners read own storage media" on storage.objects;
drop policy if exists "staff read all storage media" on storage.objects;

create policy "owners read own storage media"
on storage.objects for select to authenticated
using (
  bucket_id = 'listing-media'
  and exists (
    select 1
    from public.listing_media as media
    join public.listings as listings on listings.id = media.listing_id
    where media.storage_path = name
      and listings.owner_id = auth.uid()
  )
);

create policy "staff read all storage media"
on storage.objects for select to authenticated
using (
  bucket_id = 'listing-media'
  and public.is_staff()
  and exists (
    select 1 from public.listing_media as media
    where media.storage_path = name
  )
);

create policy "owners upload reserved listing photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'listing-media'
  and public.can_upload_reserved_listing_photo(name)
);
