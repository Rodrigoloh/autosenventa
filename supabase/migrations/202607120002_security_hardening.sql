-- Hardening separado para preservar la migración baseline potencialmente aplicada.

revoke all on function public.current_role() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.transition_listing(uuid, public.listing_status) from public, anon;
revoke all on function public.guard_listing_status() from public, anon, authenticated;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.transition_listing(uuid, public.listing_status) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

create or replace function public.guard_profile_role() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.id is distinct from new.id then raise exception 'Profile id cannot be changed'; end if;
  if old.role is distinct from new.role and current_setting('app.role_change', true) <> 'allowed' then
    raise exception 'Use set_user_role to change roles';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_profile_role() from public, anon, authenticated;
create trigger guard_profile_sensitive_fields before update on public.profiles
for each row execute function public.guard_profile_role();

create or replace function public.set_user_role(target_user uuid, target_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_role() <> 'admin' then raise exception 'Admin role required'; end if;
  perform set_config('app.role_change', 'allowed', true);
  update public.profiles set role = target_role, updated_at = now() where id = target_user;
  if not found then raise exception 'Profile not found'; end if;
  perform set_config('app.role_change', '', true);
end;
$$;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

create or replace function public.guard_listing_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.owner_id is distinct from new.owner_id then raise exception 'Owner cannot be changed'; end if;
  if old.status is distinct from new.status and current_setting('app.status_transition', true) <> 'allowed' then
    raise exception 'Use transition_listing to change status';
  end if;
  if not public.is_staff() and (
    old.editorial_description is distinct from new.editorial_description or
    old.is_featured is distinct from new.is_featured or
    old.featured_order is distinct from new.featured_order or
    old.published_at is distinct from new.published_at
  ) then raise exception 'Reserved editorial fields cannot be changed'; end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_listing_status() from public, anon, authenticated;

create or replace function public.transition_listing(target_id uuid, target_status public.listing_status) returns void
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; actor_role public.app_role; allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  select * into current_listing from public.listings where id = target_id for update;
  if current_listing.id is null then raise exception 'Listing not found'; end if;
  actor_role := public.current_role();
  allowed := case
    when auth.uid() = current_listing.owner_id and current_listing.status in ('draft','changes_requested') and target_status = 'submitted' then true
    when actor_role in ('staff','admin') and current_listing.status = 'submitted' and target_status = 'in_review' then true
    when actor_role in ('staff','admin') and current_listing.status = 'in_review' and target_status in ('changes_requested','approved','rejected') then true
    when actor_role in ('staff','admin') and current_listing.status = 'approved' and target_status = 'published' then true
    when actor_role in ('staff','admin') and target_status = 'archived' and current_listing.status <> 'archived' then true
    when actor_role in ('staff','admin') and current_listing.status = 'published' and target_status = 'approved' then true
    else false end;
  if not allowed then raise exception 'Invalid status transition'; end if;
  perform set_config('app.status_transition', 'allowed', true);
  update public.listings set
    status = target_status,
    published_at = case when target_status = 'published' then now() else published_at end,
    is_featured = case when target_status = 'published' then is_featured else false end,
    updated_at = now()
  where id = target_id;
  perform set_config('app.status_transition', '', true);
  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id)
  values(target_id, current_listing.status, target_status, auth.uid());
end;
$$;
revoke all on function public.transition_listing(uuid, public.listing_status) from public, anon;
grant execute on function public.transition_listing(uuid, public.listing_status) to authenticated;

-- Grants mínimos para Data API; RLS sigue siendo la autorización efectiva.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.categories, public.brands, public.models, public.listings, public.listing_media to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update on public.listings to authenticated;
grant insert, update, delete on public.listing_media to authenticated;
grant select on public.listing_status_history to authenticated;
grant select, insert, update, delete on public.staff_notes to authenticated;
grant insert, update, delete on public.categories, public.brands, public.models to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- El objeto debe usar: <listing_uuid>/<random_uuid>.<ext>; nunca el nombre original.
drop policy if exists "owners upload own listing media" on storage.objects;
drop policy if exists "owners edit own listing media" on storage.objects;
drop policy if exists "owners delete own listing media" on storage.objects;
create policy "owners upload own listing media" on storage.objects for insert to authenticated with check (
  bucket_id='listing-media'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'
  and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested'))
);
create policy "owners edit own listing media" on storage.objects for update to authenticated using (
  bucket_id='listing-media' and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested'))
) with check (
  bucket_id='listing-media'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$'
  and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested'))
);
create policy "owners delete own listing media" on storage.objects for delete to authenticated using (
  bucket_id='listing-media' and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested'))
);
