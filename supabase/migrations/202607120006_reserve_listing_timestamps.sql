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
