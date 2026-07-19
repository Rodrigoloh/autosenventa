-- Fase 2 de fotografías: consumo atómico de una reserva ya validada en servidor.
-- Sólo service_role puede invocar esta función; el navegador no controla actor,
-- listing, path, media id, orden ni portada.

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
  if target_requester_id is null then
    raise exception 'Not authorized';
  end if;
  if verified_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid verified MIME type';
  end if;
  if verified_size_bytes is null or verified_size_bytes < 1 or verified_size_bytes > 10485760 then
    raise exception 'Invalid verified image size';
  end if;
  if verified_width is null or verified_height is null
    or verified_width < 1 or verified_height < 1
    or verified_width::bigint * verified_height::bigint > 25000000 then
    raise exception 'Invalid verified image dimensions';
  end if;

  select uploads.* into reserved_upload
  from public.listing_photo_uploads as uploads
  where uploads.id = target_reservation_id
  for update;

  if reserved_upload.id is null then
    raise exception 'Upload reservation not available';
  end if;
  if reserved_upload.requested_by <> target_requester_id then
    raise exception 'Upload reservation not available';
  end if;
  if reserved_upload.expires_at <= now() then
    raise exception 'Upload reservation expired';
  end if;
  if reserved_upload.expected_mime_type <> verified_mime_type
    or reserved_upload.expected_size_bytes <> verified_size_bytes then
    raise exception 'Uploaded object does not match reservation';
  end if;

  select listings.* into current_listing
  from public.listings as listings
  where listings.id = reserved_upload.listing_id
  for update;

  if current_listing.id is null
    or current_listing.owner_id <> target_requester_id then
    raise exception 'Listing not available';
  end if;
  if current_listing.status <> 'draft' then
    raise exception 'Listing is not an editable draft';
  end if;
  if not exists (
    select 1 from storage.objects as objects
    where objects.bucket_id = 'listing-media'
      and objects.name = reserved_upload.storage_path
  ) then
    raise exception 'Uploaded object not found';
  end if;
  if (select count(*) from public.listing_media as media where media.listing_id = current_listing.id) >= 20 then
    raise exception 'Listing photo limit reached';
  end if;

  select coalesce(max(media.sort_order), -1) + 1,
         not exists (
           select 1 from public.listing_media as existing
           where existing.listing_id = current_listing.id
         )
  into next_sort_order, should_be_cover
  from public.listing_media as media
  where media.listing_id = current_listing.id;

  if next_sort_order > 19 then
    raise exception 'Listing photo limit reached';
  end if;

  insert into public.listing_media(
    id, listing_id, storage_path, media_type, mime_type, file_size_bytes,
    width, height, uploaded_by, sort_order, is_cover, updated_at
  ) values (
    generated_media_id, current_listing.id, reserved_upload.storage_path,
    'image', verified_mime_type, verified_size_bytes,
    verified_width, verified_height, target_requester_id,
    next_sort_order, should_be_cover, now()
  );

  delete from public.listing_photo_uploads
  where id = reserved_upload.id;

  return query select
    generated_media_id,
    current_listing.id,
    reserved_upload.storage_path,
    next_sort_order,
    should_be_cover;
end;
$$;

revoke all on function public.finalize_listing_photo_upload(uuid, uuid, text, bigint, integer, integer)
from public, anon, authenticated;
grant execute on function public.finalize_listing_photo_upload(uuid, uuid, text, bigint, integer, integer)
to service_role;
