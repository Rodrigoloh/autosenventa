-- Controles post-publicacion estrechos y auditables.

alter type public.listing_status add value if not exists 'paused' after 'published';

create table public.listing_post_publication_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  action text not null check (action in ('paused', 'resumed', 'returned_to_review')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  constraint listing_post_publication_event_reason check (
    (action in ('paused', 'returned_to_review') and length(trim(reason)) between 20 and 2000)
    or (action = 'resumed' and reason is null)
  )
);

create index listing_post_publication_events_listing_created_idx
  on public.listing_post_publication_events(listing_id, created_at desc, id desc);

alter table public.listing_post_publication_events enable row level security;
create policy "post publication events visible to staff"
on public.listing_post_publication_events for select to authenticated
using (public.is_staff());

revoke all on table public.listing_post_publication_events from public, anon, authenticated, service_role;
grant select on table public.listing_post_publication_events to authenticated, service_role;

create function public.get_owner_post_publication_events()
returns table(listing_id uuid, action text, reason text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select event.listing_id, event.action, event.reason, event.created_at
  from public.listing_post_publication_events event
  join public.listings listing on listing.id = event.listing_id
  where auth.uid() is not null
    and listing.owner_id = auth.uid()
  order by event.created_at desc, event.id desc
$$;

revoke all on function public.get_owner_post_publication_events() from public, anon;
grant execute on function public.get_owner_post_publication_events() to authenticated, service_role;

create function public.pause_listing_publication(target_listing_id uuid, target_reason text)
returns table(success boolean, conflict_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  normalized_reason text := nullif(trim(target_reason), '');
  event_time timestamptz := now();
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff role required'; end if;
  if length(coalesce(normalized_reason, '')) < 20 or length(normalized_reason) > 2000 then
    return query select false, 'reason_invalid'::text; return;
  end if;

  select * into current_listing from public.listings
  where id = target_listing_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'published' then
    return query select false, 'status_conflict'::text; return;
  end if;

  perform set_config('app.status_transition', 'allowed', true);
  update public.listings set status = 'paused', is_featured = false
  where id = target_listing_id;
  perform set_config('app.status_transition', '', true);

  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id, created_at)
  values(target_listing_id, 'published', 'paused', auth.uid(), event_time);
  insert into public.listing_post_publication_events(listing_id, action, actor_id, reason, created_at)
  values(target_listing_id, 'paused', auth.uid(), normalized_reason, event_time);
  return query select true, null::text;
end;
$$;

create function public.resume_listing_publication(target_listing_id uuid)
returns table(success boolean, conflict_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  event_time timestamptz := now();
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff role required'; end if;
  select * into current_listing from public.listings
  where id = target_listing_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'paused' then
    return query select false, 'status_conflict'::text; return;
  end if;

  perform set_config('app.status_transition', 'allowed', true);
  update public.listings set status = 'published' where id = target_listing_id;
  perform set_config('app.status_transition', '', true);

  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id, created_at)
  values(target_listing_id, 'paused', 'published', auth.uid(), event_time);
  insert into public.listing_post_publication_events(listing_id, action, actor_id, reason, created_at)
  values(target_listing_id, 'resumed', auth.uid(), null, event_time);
  return query select true, null::text;
end;
$$;

create function public.return_listing_to_review(target_listing_id uuid, target_reason text)
returns table(success boolean, conflict_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.listings;
  previous_submission public.listing_submissions;
  event_time timestamptz := now();
  normalized_reason text := nullif(trim(target_reason), '');
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff role required'; end if;
  if length(coalesce(normalized_reason, '')) < 20 or length(normalized_reason) > 2000 then
    return query select false, 'reason_invalid'::text; return;
  end if;

  select * into current_listing from public.listings
  where id = target_listing_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'published' then
    return query select false, 'status_conflict'::text; return;
  end if;

  select * into previous_submission
  from public.listing_submissions
  where listing_id = target_listing_id
  order by created_at desc, id desc
  limit 1 for share;
  if previous_submission.id is null then raise exception 'Submission not available'; end if;

  insert into public.listing_submissions(
    listing_id, submitted_by, attest_owner_authorized,
    attest_information_truthful, attest_modifications_and_issues_disclosed,
    attest_legal_documentation, attestation_version, created_at
  ) values (
    target_listing_id, current_listing.owner_id,
    previous_submission.attest_owner_authorized,
    previous_submission.attest_information_truthful,
    previous_submission.attest_modifications_and_issues_disclosed,
    previous_submission.attest_legal_documentation,
    previous_submission.attestation_version, event_time
  );

  perform set_config('app.status_transition', 'allowed', true);
  perform set_config('app.review_claim', 'allowed', true);
  update public.listings
  set status = 'in_review', reviewer_id = auth.uid(), review_started_at = event_time,
      is_featured = false
  where id = target_listing_id;
  perform set_config('app.review_claim', '', true);
  perform set_config('app.status_transition', '', true);

  insert into public.listing_status_history(listing_id, from_status, to_status, actor_id, created_at)
  values(target_listing_id, 'published', 'in_review', auth.uid(), event_time);
  insert into public.listing_post_publication_events(listing_id, action, actor_id, reason, created_at)
  values(target_listing_id, 'returned_to_review', auth.uid(), normalized_reason, event_time);
  return query select true, null::text;
end;
$$;

revoke all on function public.pause_listing_publication(uuid, text),
  public.resume_listing_publication(uuid),
  public.return_listing_to_review(uuid, text)
from public, anon;
grant execute on function public.pause_listing_publication(uuid, text),
  public.resume_listing_publication(uuid),
  public.return_listing_to_review(uuid, text)
to authenticated, service_role;

-- Una nueva aprobacion despues de regresar a revision conserva la primera fecha
-- de publicacion. La nueva ronda usa la submission clonada por la RPC anterior.
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
  if auth.uid() is null or not public.is_staff() then raise exception 'Staff role required'; end if;
  if target_decision not in ('approved', 'changes_requested', 'rejected') then raise exception 'Invalid review decision'; end if;
  if target_decision in ('changes_requested', 'rejected') and length(coalesce(normalized_message, '')) < 20 then
    return query select false, 'message_too_short'::text; return;
  end if;

  select * into current_listing from public.listings
  where id = target_listing_id for update;
  if current_listing.id is null then raise exception 'Listing not available'; end if;
  if current_listing.status <> 'in_review' then return query select false, 'already_decided'::text; return; end if;
  if current_listing.reviewer_id <> auth.uid() and public.current_role() <> 'admin' then
    return query select false, 'not_assigned'::text; return;
  end if;

  select id into current_submission from public.listing_submissions
  where listing_id = target_listing_id order by created_at desc, id desc limit 1 for update;
  if current_submission is null then raise exception 'Submission not available'; end if;
  begin
    insert into public.listing_review_decisions(submission_id, listing_id, reviewer_id, decision, message, created_at)
    values(current_submission, target_listing_id, auth.uid(), target_decision,
      case when target_decision = 'approved' then null else normalized_message end, decided_time);
  exception when unique_violation then
    return query select false, 'already_decided'::text; return;
  end;

  final_status := case when target_decision = 'approved' then 'published'::public.listing_status
    else target_decision::public.listing_status end;
  perform set_config('app.status_transition', 'allowed', true);
  perform set_config('app.review_claim', 'allowed', true);
  update public.listings
  set status = final_status,
      published_at = case when final_status = 'published' then coalesce(published_at, decided_time) else published_at end,
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
