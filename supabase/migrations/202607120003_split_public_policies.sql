-- Las políticas anon no deben depender de funciones internas sin EXECUTE para anon.
drop policy if exists "taxonomy public read" on public.categories;
drop policy if exists "brands public read" on public.brands;
drop policy if exists "models public read" on public.models;
create policy "active categories public read" on public.categories for select to anon, authenticated using (active);
create policy "active brands public read" on public.brands for select to anon, authenticated using (active);
create policy "active models public read" on public.models for select to anon, authenticated using (active);

drop policy if exists "published listings public" on public.listings;
create policy "published listings public read" on public.listings for select to anon, authenticated using (status = 'published');
create policy "owners read own listings" on public.listings for select to authenticated using (owner_id = auth.uid());
create policy "staff read all listings" on public.listings for select to authenticated using (public.is_staff());

drop policy if exists "media follows listing visibility" on public.listing_media;
create policy "published listing media public read" on public.listing_media for select to anon, authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.status = 'published')
);
create policy "owners read own listing media" on public.listing_media for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
);
create policy "staff read all listing media" on public.listing_media for select to authenticated using (public.is_staff());

drop policy if exists "published media read" on storage.objects;
create policy "published storage media public read" on storage.objects for select to anon, authenticated using (
  bucket_id = 'listing-media' and exists (
    select 1 from public.listing_media m join public.listings l on l.id=m.listing_id
    where m.storage_path=name and l.status='published'
  )
);
create policy "owners read own storage media" on storage.objects for select to authenticated using (
  bucket_id = 'listing-media' and exists (
    select 1 from public.listing_media m join public.listings l on l.id=m.listing_id
    where m.storage_path=name and l.owner_id=auth.uid()
  )
);
create policy "staff read all storage media" on storage.objects for select to authenticated using (
  bucket_id = 'listing-media' and public.is_staff()
);
