-- Regulariza una sola vez los approved legados verificables. La funcion queda
-- disponible exclusivamente para el propietario de la base para poder probar
-- la idempotencia sin reintroducir un RPC operativo.

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
  if old.status is distinct from new.status
    and coalesce(current_setting('app.status_transition', true), '') <> 'allowed' then
    raise exception 'Use a narrow listing transition function';
  end if;
  if old.submitted_at is distinct from new.submitted_at
    and coalesce(current_setting('app.listing_submission', true), '') <> 'allowed' then
    raise exception 'Submission metadata cannot be changed directly';
  end if;
  if (old.reviewer_id is distinct from new.reviewer_id
      or old.review_started_at is distinct from new.review_started_at)
    and coalesce(current_setting('app.review_claim', true), '') <> 'allowed' then
    raise exception 'Review assignment cannot be changed directly';
  end if;
  if not public.is_staff() and (
    old.slug is distinct from new.slug or
    old.listing_type is distinct from new.listing_type or
    old.editorial_description is distinct from new.editorial_description or
    old.is_featured is distinct from new.is_featured or
    old.featured_order is distinct from new.featured_order or
    (
      old.published_at is distinct from new.published_at
      and not (
        old.status = 'approved'
        and new.status = 'published'
        and new.published_at is not null
        and coalesce(current_setting('app.legacy_publication', true), '') = 'allowed'
      )
    )
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

create function public.regularize_legacy_approved_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  legacy_listing record;
  regularized_count integer := 0;
begin
  for legacy_listing in
    select
      listing.id,
      approved_decision.reviewer_id,
      approved_decision.created_at as decided_at
    from public.listings listing
    join lateral (
      select decision.reviewer_id, decision.created_at
      from public.listing_review_decisions decision
      where decision.listing_id = listing.id
        and decision.decision = 'approved'
      order by decision.created_at desc, decision.id desc
      limit 1
    ) approved_decision on true
    where listing.status = 'approved'
      and listing.published_at is null
    order by listing.id
    for update of listing
  loop
    perform set_config('app.status_transition', 'allowed', true);
    perform set_config('app.legacy_publication', 'allowed', true);
    update public.listings
    set status = 'published',
        published_at = legacy_listing.decided_at
    where id = legacy_listing.id
      and status = 'approved'
      and published_at is null;
    perform set_config('app.legacy_publication', '', true);
    perform set_config('app.status_transition', '', true);

    if found then
      insert into public.listing_status_history(
        listing_id, from_status, to_status, actor_id, created_at
      )
      select
        legacy_listing.id, 'approved', 'published',
        legacy_listing.reviewer_id, legacy_listing.decided_at
      where not exists (
        select 1
        from public.listing_status_history history
        where history.listing_id = legacy_listing.id
          and history.from_status = 'approved'
          and history.to_status = 'published'
      );
      regularized_count := regularized_count + 1;
    end if;
  end loop;

  return regularized_count;
end;
$$;

revoke all on function public.regularize_legacy_approved_listings()
from public, anon, authenticated, service_role;

select public.regularize_legacy_approved_listings();

drop function if exists public.publish_legacy_approved_listing(uuid);
