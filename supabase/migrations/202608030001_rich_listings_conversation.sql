-- Fase 6.6: rich listings y conversación. Todo es opcional para preservar legacy.

alter table public.listing_media
  add column category text not null default 'other',
  add column caption text;
alter table public.listing_media add constraint listing_media_category_check check (category in ('exterior','interior','engine','details','flaws','other'));
alter table public.listing_media add constraint listing_media_caption_length check (caption is null or length(caption) <= 240);
alter table public.listing_media add constraint listing_media_id_listing_unique unique (id, listing_id);

create table public.listing_ownership_details (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  owned_since_month smallint check (owned_since_month between 1 and 12),
  owned_since_year smallint check (owned_since_year between 1886 and extract(year from current_date)::int),
  known_owner_count text not null default 'unknown' check (known_owner_count in ('1','2','3','4+','unknown')),
  ownership_notes text check (ownership_notes is null or length(ownership_notes) <= 3000),
  originality_status text not null default 'unknown' check (originality_status in ('original','mostly_original','modified','heavily_modified','unknown')),
  vin text unique,
  updated_at timestamptz not null default now()
);

create table public.listing_documentation (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  document_type text check (document_type in ('original_invoice','refactura','dealer_invoice','insurance_invoice','import_pedimento','foreign_title','antique_vehicle','other')),
  taxes_current text not null default 'unknown' check (taxes_current in ('yes','no','unknown','not_applicable')),
  registration_card text not null default 'unknown' check (registration_card in ('yes','no','unknown','not_applicable')),
  emissions_status text not null default 'unknown' check (emissions_status in ('yes','no','unknown','not_applicable')),
  insurance_current text not null default 'unknown' check (insurance_current in ('yes','no','unknown','not_applicable')),
  keys_count smallint check (keys_count between 0 and 10),
  owners_manual text not null default 'unknown' check (owners_manual in ('yes','no','unknown','not_applicable')),
  service_history_level text not null default 'unknown' check (service_history_level in ('complete','partial','none','unknown')),
  updated_at timestamptz not null default now()
);

create table public.listing_equipment (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120), category text check (category is null or length(category) <= 60), sort_order integer not null default 0
);
create table public.listing_modifications (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  category text not null check (category in ('engine','suspension','wheels','brakes','exhaust','body','interior','electronics','drivetrain','other')),
  name text not null check (length(trim(name)) between 1 and 120), description text check (description is null or length(description) <= 1000), sort_order integer not null default 0
);
create table public.listing_flaws (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  category text not null check (category in ('exterior','interior','mechanical','electrical','cosmetic','other')),
  title text not null check (length(trim(title)) between 1 and 160), description text not null check (length(trim(description)) between 1 and 1500),
  photo_id uuid, sort_order integer not null default 0,
  foreign key (photo_id, listing_id) references public.listing_media(id, listing_id) on delete set null
);
create table public.listing_service_records (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  service_date date check (service_date is null or service_date <= current_date), mileage_km integer check (mileage_km is null or mileage_km >= 0),
  description text not null check (length(trim(description)) between 1 and 1500), document_available boolean not null default false, sort_order integer not null default 0
);
create table public.listing_included_items (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120), description text check (description is null or length(description) <= 1000), sort_order integer not null default 0
);
create table public.listing_videos (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  type text not null check (type in ('walkaround','cold_start','engine_running','driving','exhaust','interior','other')),
  storage_path text, external_url text, duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  sort_order integer not null default 0, status text not null default 'ready' check (status in ('processing','ready','rejected')),
  created_at timestamptz not null default now(), check ((storage_path is null) <> (external_url is null)),
  check (external_url is null or external_url ~* '^https://(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/')
);

create table public.listing_comments (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict, parent_id uuid,
  body text not null check (length(trim(body)) between 1 and 2000), status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (id, listing_id), foreign key (parent_id, listing_id) references public.listing_comments(id, listing_id) on delete restrict
);
create table public.listing_comment_votes (
  comment_id uuid not null references public.listing_comments(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (comment_id, user_id)
);
create table public.listing_comment_reports (
  id uuid primary key default gen_random_uuid(), comment_id uuid not null references public.listing_comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade, reason text not null check (reason in ('spam','harassment','false_information','personal_information','inappropriate','other')),
  details text check (details is null or length(details) <= 1000), status text not null default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.profiles(id), unique (comment_id, reporter_id, reason)
);
create table public.listing_comment_moderation_events (
  id bigint generated always as identity primary key, comment_id uuid not null references public.listing_comments(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict, action text not null check (action in ('hidden','restored','report_reviewed','report_dismissed','report_actioned')),
  report_id uuid references public.listing_comment_reports(id) on delete set null, notes text check (notes is null or length(notes) <= 1000), created_at timestamptz not null default now()
);

create index listing_equipment_order_idx on public.listing_equipment(listing_id, sort_order);
create index listing_modifications_order_idx on public.listing_modifications(listing_id, sort_order);
create index listing_flaws_order_idx on public.listing_flaws(listing_id, sort_order);
create index listing_service_order_idx on public.listing_service_records(listing_id, service_date desc, sort_order);
create index listing_included_order_idx on public.listing_included_items(listing_id, sort_order);
create index listing_videos_order_idx on public.listing_videos(listing_id, sort_order);
create index listing_comments_listing_idx on public.listing_comments(listing_id, created_at);
create index listing_comment_reports_queue_idx on public.listing_comment_reports(status, created_at);

create function public.rich_listing_is_editable(target_listing_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.listings where id=target_listing_id and owner_id=auth.uid() and status in ('draft','changes_requested') and deletion_started_at is null)
$$;
revoke all on function public.rich_listing_is_editable(uuid) from public, anon, authenticated;
grant execute on function public.rich_listing_is_editable(uuid) to authenticated;

create function public.normalize_listing_vin() returns trigger language plpgsql set search_path='' as $$
begin
  if new.vin is not null then
    new.vin := upper(regexp_replace(new.vin, '[^A-Za-z0-9]', '', 'g'));
    if new.vin !~ '^[A-HJ-NPR-Z0-9]{17}$' then raise exception 'VIN must contain 17 valid characters'; end if;
  end if;
  if new.owned_since_year is not null and new.owned_since_year = extract(year from current_date)::int and new.owned_since_month is not null and new.owned_since_month > extract(month from current_date)::int then raise exception 'Ownership date cannot be in the future'; end if;
  new.updated_at := now(); return new;
end $$;
create trigger normalize_listing_vin before insert or update on public.listing_ownership_details for each row execute function public.normalize_listing_vin();

create function public.enforce_video_limit() returns trigger language plpgsql set search_path='' as $$
begin if (select count(*) from public.listing_videos where listing_id=new.listing_id) >= 3 then raise exception 'Maximum 3 videos per listing'; end if; return new; end $$;
create trigger enforce_listing_video_limit before insert on public.listing_videos for each row execute function public.enforce_video_limit();

alter table public.listing_ownership_details enable row level security; alter table public.listing_documentation enable row level security;
alter table public.listing_equipment enable row level security; alter table public.listing_modifications enable row level security; alter table public.listing_flaws enable row level security;
alter table public.listing_service_records enable row level security; alter table public.listing_included_items enable row level security; alter table public.listing_videos enable row level security;
alter table public.listing_comments enable row level security; alter table public.listing_comment_votes enable row level security; alter table public.listing_comment_reports enable row level security; alter table public.listing_comment_moderation_events enable row level security;

create policy "ownership private owner staff" on public.listing_ownership_details for select using (public.is_staff() or exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()));
create policy "documentation private owner staff" on public.listing_documentation for select using (public.is_staff() or exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=auth.uid()));
create policy "owner manages ownership editable" on public.listing_ownership_details for all using (public.rich_listing_is_editable(listing_id) or public.is_staff()) with check (public.rich_listing_is_editable(listing_id) or public.is_staff());
create policy "owner manages documentation editable" on public.listing_documentation for all using (public.rich_listing_is_editable(listing_id) or public.is_staff()) with check (public.rich_listing_is_editable(listing_id) or public.is_staff());

create function public.rich_public_visible(target_listing_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.listings where id=target_listing_id and (status='published' or owner_id=auth.uid() or public.is_staff()))
$$;
revoke all on function public.rich_public_visible(uuid) from public, anon, authenticated;
grant execute on function public.rich_public_visible(uuid) to anon, authenticated;

do $$ declare t text; begin foreach t in array array['listing_equipment','listing_modifications','listing_flaws','listing_service_records','listing_included_items','listing_videos'] loop
 execute format('create policy "rich visible %1$s" on public.%1$I for select using (public.rich_public_visible(listing_id))',t);
 execute format('create policy "rich editable %1$s" on public.%1$I for all using (public.rich_listing_is_editable(listing_id) or public.is_staff()) with check (public.rich_listing_is_editable(listing_id) or public.is_staff())',t);
 end loop; end $$;

create policy "published comments public" on public.listing_comments for select using (status='published' and exists(select 1 from public.listings l where l.id=listing_id and l.status='published') or public.is_staff());
create policy "votes public counts" on public.listing_comment_votes for select using (exists(select 1 from public.listing_comments c join public.listings l on l.id=c.listing_id where c.id=comment_id and c.status='published' and l.status='published') or public.is_staff());
create policy "reports own or staff" on public.listing_comment_reports for select using (reporter_id=auth.uid() or public.is_staff());
create policy "moderation staff read" on public.listing_comment_moderation_events for select using (public.is_staff());

create function public.create_listing_comment(target_listing_id uuid, target_body text, target_parent_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.listings where id=target_listing_id and status='published') then raise exception 'Listing not published'; end if;
 if target_parent_id is not null and not exists(select 1 from public.listing_comments where id=target_parent_id and listing_id=target_listing_id and status='published') then raise exception 'Invalid parent comment'; end if;
 insert into public.listing_comments(listing_id,author_id,parent_id,body) values(target_listing_id,auth.uid(),target_parent_id,trim(target_body)) returning id into new_id; return new_id;
end $$;
create function public.edit_listing_comment(target_comment_id uuid, target_body text) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.listing_comments set body=trim(target_body),updated_at=now() where id=target_comment_id and author_id=auth.uid() and status='published' and deleted_at is null; return found; end $$;
create function public.delete_listing_comment(target_comment_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.listing_comments set body='[Comentario eliminado]',status='removed',deleted_at=now(),updated_at=now() where id=target_comment_id and author_id=auth.uid() and status='published'; return found; end $$;
create function public.toggle_listing_comment_vote(target_comment_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.listing_comments c join public.listings l on l.id=c.listing_id where c.id=target_comment_id and c.status='published' and l.status='published') then raise exception 'Comment not votable'; end if;
 if exists(select 1 from public.listing_comment_votes where comment_id=target_comment_id and user_id=auth.uid()) then delete from public.listing_comment_votes where comment_id=target_comment_id and user_id=auth.uid(); return false;
 else insert into public.listing_comment_votes(comment_id,user_id) values(target_comment_id,auth.uid()); return true; end if;
end $$;
create function public.report_listing_comment(target_comment_id uuid,target_reason text,target_details text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if target_reason not in ('spam','harassment','false_information','personal_information','inappropriate','other') then raise exception 'Invalid report reason'; end if;
 if not exists(select 1 from public.listing_comments where id=target_comment_id and status='published') then raise exception 'Comment not reportable'; end if;
 insert into public.listing_comment_reports(comment_id,reporter_id,reason,details) values(target_comment_id,auth.uid(),target_reason,nullif(trim(target_details),'')) returning id into new_id; return new_id;
exception when unique_violation then raise exception 'Duplicate report'; end $$;
create function public.moderate_listing_comment(target_comment_id uuid,target_action text,target_report_id uuid default null,target_notes text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'Staff role required'; end if;
 if target_action='hidden' then update public.listing_comments set status='hidden',updated_at=now() where id=target_comment_id;
 elsif target_action='restored' then update public.listing_comments set status='published',updated_at=now() where id=target_comment_id and deleted_at is null;
 elsif target_action in ('report_reviewed','report_dismissed','report_actioned') and target_report_id is not null then update public.listing_comment_reports set status=case target_action when 'report_reviewed' then 'reviewed' when 'report_dismissed' then 'dismissed' else 'actioned' end,reviewed_at=now(),reviewed_by=auth.uid() where id=target_report_id and comment_id=target_comment_id;
 else raise exception 'Invalid moderation action'; end if;
 if not found then return false; end if;
 insert into public.listing_comment_moderation_events(comment_id,actor_id,action,report_id,notes) values(target_comment_id,auth.uid(),target_action,target_report_id,nullif(trim(target_notes),'')); return true;
end $$;

create function public.get_public_listing_rich(target_listing_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'ownership',case when o.listing_id is null then null else jsonb_build_object('ownedSinceMonth',o.owned_since_month,'ownedSinceYear',o.owned_since_year,'knownOwnerCount',o.known_owner_count,'ownershipNotes',o.ownership_notes,'originalityStatus',o.originality_status,'vinMasked',case when o.vin is null then null else repeat('*',11)||right(o.vin,6) end) end,
  'documentation',case when d.listing_id is null then null else to_jsonb(d)-'listing_id'-'updated_at' end,
  'equipment',coalesce((select jsonb_agg(to_jsonb(x)-'listing_id' order by x.sort_order) from public.listing_equipment x where x.listing_id=l.id),'[]'::jsonb),
  'modifications',coalesce((select jsonb_agg(to_jsonb(x)-'listing_id' order by x.sort_order) from public.listing_modifications x where x.listing_id=l.id),'[]'::jsonb),
  'flaws',coalesce((select jsonb_agg(to_jsonb(x)-'listing_id' order by x.sort_order) from public.listing_flaws x where x.listing_id=l.id),'[]'::jsonb),
  'serviceRecords',coalesce((select jsonb_agg(to_jsonb(x)-'listing_id' order by x.service_date desc nulls last,x.sort_order) from public.listing_service_records x where x.listing_id=l.id),'[]'::jsonb),
  'includedItems',coalesce((select jsonb_agg(to_jsonb(x)-'listing_id' order by x.sort_order) from public.listing_included_items x where x.listing_id=l.id),'[]'::jsonb),
  'videos',coalesce((select jsonb_agg(to_jsonb(x)-'listing_id'-'storage_path' order by x.sort_order) from public.listing_videos x where x.listing_id=l.id and x.status='ready'),'[]'::jsonb)
 ) from public.listings l left join public.listing_ownership_details o on o.listing_id=l.id left join public.listing_documentation d on d.listing_id=l.id where l.id=target_listing_id and l.status='published'
$$;

create function public.get_public_listing_comments(target_listing_id uuid)
returns table(id uuid,parent_id uuid,author_id uuid,body text,status text,created_at timestamptz,updated_at timestamptz,author_username text,is_seller boolean,vote_count bigint,viewer_voted boolean)
language sql stable security definer set search_path='' as $$
 select c.id,c.parent_id,c.author_id,
   case when c.status='removed' then '[Comentario eliminado]' else c.body end,c.status,c.created_at,c.updated_at,p.username,
   c.author_id=l.owner_id,
   (select count(*) from public.listing_comment_votes v where v.comment_id=c.id),
   exists(select 1 from public.listing_comment_votes v where v.comment_id=c.id and v.user_id=auth.uid())
 from public.listing_comments c join public.listings l on l.id=c.listing_id left join public.profiles p on p.id=c.author_id
 where c.listing_id=target_listing_id and l.status='published' and (c.status='published' or (c.status='removed' and exists(select 1 from public.listing_comments r where r.parent_id=c.id and r.status='published')))
 order by c.created_at
$$;

revoke all on public.listing_ownership_details,public.listing_documentation,public.listing_equipment,public.listing_modifications,public.listing_flaws,public.listing_service_records,public.listing_included_items,public.listing_videos,public.listing_comments,public.listing_comment_votes,public.listing_comment_reports,public.listing_comment_moderation_events from anon,authenticated;
grant select,insert,update,delete on public.listing_ownership_details,public.listing_documentation,public.listing_equipment,public.listing_modifications,public.listing_flaws,public.listing_service_records,public.listing_included_items,public.listing_videos to authenticated;
grant select on public.listing_equipment,public.listing_modifications,public.listing_flaws,public.listing_service_records,public.listing_included_items,public.listing_videos,public.listing_comments,public.listing_comment_votes to anon,authenticated;
grant select on public.listing_comment_reports,public.listing_comment_moderation_events to authenticated;
revoke all on function public.create_listing_comment(uuid,text,uuid),public.edit_listing_comment(uuid,text),public.delete_listing_comment(uuid),public.toggle_listing_comment_vote(uuid),public.report_listing_comment(uuid,text,text),public.moderate_listing_comment(uuid,text,uuid,text),public.get_public_listing_rich(uuid),public.get_public_listing_comments(uuid) from public;
grant execute on function public.create_listing_comment(uuid,text,uuid),public.edit_listing_comment(uuid,text),public.delete_listing_comment(uuid),public.toggle_listing_comment_vote(uuid),public.report_listing_comment(uuid,text,text) to authenticated;
grant execute on function public.moderate_listing_comment(uuid,text,uuid,text) to authenticated;
grant execute on function public.get_public_listing_rich(uuid) to anon,authenticated;
grant execute on function public.get_public_listing_comments(uuid) to anon,authenticated;
grant all on public.listing_ownership_details,public.listing_documentation,public.listing_equipment,public.listing_modifications,public.listing_flaws,public.listing_service_records,public.listing_included_items,public.listing_videos,public.listing_comments,public.listing_comment_votes,public.listing_comment_reports,public.listing_comment_moderation_events to service_role;
grant usage,select on sequence public.listing_comment_moderation_events_id_seq to service_role;
grant execute on function public.create_listing_comment(uuid,text,uuid),public.edit_listing_comment(uuid,text),public.delete_listing_comment(uuid),public.toggle_listing_comment_vote(uuid),public.report_listing_comment(uuid,text,text),public.moderate_listing_comment(uuid,text,uuid,text),public.get_public_listing_rich(uuid),public.get_public_listing_comments(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('listing-documents','listing-documents',false,20971520,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy "listing documents owner read" on storage.objects for select using (bucket_id='listing-documents' and exists(select 1 from public.listings l where l.id::text=(storage.foldername(name))[1] and (l.owner_id=auth.uid() or public.is_staff())));
create policy "listing documents owner upload" on storage.objects for insert with check (bucket_id='listing-documents' and public.rich_listing_is_editable(((storage.foldername(name))[1])::uuid));
