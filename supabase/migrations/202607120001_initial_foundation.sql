create type public.app_role as enum ('user', 'staff', 'admin');
create type public.listing_status as enum ('draft','submitted','in_review','changes_requested','approved','published','rejected','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (id bigint generated always as identity primary key, name text not null unique, slug text not null unique, active boolean not null default true);
create table public.brands (id bigint generated always as identity primary key, name text not null unique, slug text not null unique, active boolean not null default true);
create table public.models (id bigint generated always as identity primary key, brand_id bigint not null references public.brands(id) on delete cascade, name text not null, slug text not null, active boolean not null default true, unique (brand_id, slug));

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  slug text unique,
  title text not null,
  category_id bigint references public.categories(id),
  brand_id bigint references public.brands(id),
  model_id bigint references public.models(id),
  year smallint check (year between 1886 and 2100),
  price_mxn numeric(12,2) check (price_mxn >= 0),
  transmission text,
  city text,
  listing_type text,
  owner_description text,
  editorial_description text,
  status public.listing_status not null default 'draft',
  is_featured boolean not null default false,
  featured_order integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_requires_published check (not is_featured or status = 'published')
);

create table public.listing_media (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique, media_type text not null check (media_type in ('image','video')),
  sort_order integer not null default 0, is_cover boolean not null default false, created_at timestamptz not null default now()
);
create unique index one_cover_per_listing on public.listing_media(listing_id) where is_cover;

create table public.listing_status_history (
  id bigint generated always as identity primary key, listing_id uuid not null references public.listings(id) on delete cascade,
  from_status public.listing_status not null, to_status public.listing_status not null,
  actor_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.staff_notes (
  id bigint generated always as identity primary key, listing_id uuid not null references public.listings(id) on delete cascade,
  author_id uuid not null references public.profiles(id), body text not null check (length(trim(body)) > 0), created_at timestamptz not null default now()
);

create function public.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_role() in ('staff','admin'), false)
$$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data ->> 'display_name'); return new; end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.transition_listing(target_id uuid, target_status public.listing_status) returns void
language plpgsql security definer set search_path = '' as $$
declare current_listing public.listings; actor_role public.app_role; allowed boolean := false;
begin
  select * into current_listing from public.listings where id = target_id for update;
  if current_listing.id is null or auth.uid() is null then raise exception 'Not authorized'; end if;
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
  update public.listings set status = target_status, published_at = case when target_status = 'published' then now() else published_at end, is_featured = case when target_status = 'published' then is_featured else false end, updated_at = now() where id = target_id;
  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id) values(target_id, current_listing.status, target_status, auth.uid());
end;
$$;

create function public.guard_listing_status() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status is distinct from new.status and current_setting('app.status_transition', true) <> 'allowed' then
    raise exception 'Use transition_listing to change status';
  end if;
  if old.owner_id is distinct from new.owner_id then raise exception 'Owner cannot be changed'; end if;
  return new;
end;
$$;
create trigger guard_listing_sensitive_fields before update on public.listings for each row execute function public.guard_listing_status();

create function public.set_user_role(target_user uuid, target_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_role() <> 'admin' then raise exception 'Admin role required'; end if;
  update public.profiles set role = target_role, updated_at = now() where id = target_user;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security; alter table public.brands enable row level security; alter table public.models enable row level security;
alter table public.listings enable row level security; alter table public.listing_media enable row level security;
alter table public.listing_status_history enable row level security; alter table public.staff_notes enable row level security;

create policy "profiles read own or staff" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles update own safe fields" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_role());
create policy "taxonomy public read" on public.categories for select using (active or public.is_staff());
create policy "brands public read" on public.brands for select using (active or public.is_staff());
create policy "models public read" on public.models for select using (active or public.is_staff());
create policy "staff manages categories" on public.categories for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages brands" on public.brands for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manages models" on public.models for all using (public.is_staff()) with check (public.is_staff());
create policy "published listings public" on public.listings for select using (status = 'published' or owner_id = auth.uid() or public.is_staff());
create policy "owners create drafts" on public.listings for insert with check (owner_id = auth.uid() and status = 'draft' and not is_featured and editorial_description is null);
create policy "owners update editable listings" on public.listings for update using (owner_id = auth.uid() and status in ('draft','changes_requested')) with check (owner_id = auth.uid() and status in ('draft','changes_requested') and not is_featured and editorial_description is null);
create policy "staff update listings" on public.listings for update using (public.is_staff()) with check (public.is_staff());
create policy "media follows listing visibility" on public.listing_media for select using (exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'published' or l.owner_id = auth.uid() or public.is_staff())));
create policy "owners manage editable media" on public.listing_media for all using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid() and l.status in ('draft','changes_requested'))) with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid() and l.status in ('draft','changes_requested')));
create policy "staff manages media" on public.listing_media for all using (public.is_staff()) with check (public.is_staff());
create policy "history visible to owner or staff" on public.listing_status_history for select using (public.is_staff() or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));
create policy "notes staff only" on public.staff_notes for all using (public.is_staff()) with check (public.is_staff() and author_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
('listing-media','listing-media',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy "published media read" on storage.objects for select using (bucket_id = 'listing-media' and exists (select 1 from public.listing_media m join public.listings l on l.id=m.listing_id where m.storage_path=name and (l.status='published' or l.owner_id=auth.uid() or public.is_staff())));
create policy "owners upload own listing media" on storage.objects for insert with check (bucket_id='listing-media' and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested')));
create policy "owners edit own listing media" on storage.objects for update using (bucket_id='listing-media' and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested')));
create policy "owners delete own listing media" on storage.objects for delete using (bucket_id='listing-media' and exists (select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and l.owner_id=auth.uid() and l.status in ('draft','changes_requested')));

grant execute on function public.transition_listing(uuid, public.listing_status) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
