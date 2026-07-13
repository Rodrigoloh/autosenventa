update storage.buckets set file_size_limit = 52428800 where id = 'listing-media';

alter table public.listing_media add constraint media_path_matches_listing check (
  storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'
  and split_part(storage_path, '/', 1) = listing_id::text
);
