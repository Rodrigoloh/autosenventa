-- Las políticas privilegiadas sólo deben evaluarse para sesiones authenticated.
drop policy if exists "staff manages categories" on public.categories;
drop policy if exists "staff manages brands" on public.brands;
drop policy if exists "staff manages models" on public.models;
drop policy if exists "staff update listings" on public.listings;
drop policy if exists "staff manages media" on public.listing_media;
drop policy if exists "notes staff only" on public.staff_notes;

create policy "staff manages categories" on public.categories for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages brands" on public.brands for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages models" on public.models for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff update listings" on public.listings for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manages media" on public.listing_media for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "notes staff only" on public.staff_notes for all to authenticated using (public.is_staff()) with check (public.is_staff() and author_id = auth.uid());
