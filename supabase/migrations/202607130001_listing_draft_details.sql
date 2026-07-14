-- Campos del propietario para la captura y recuperación de borradores.
alter table public.listings
  add column variant text,
  add column mileage_km integer,
  add column state_region text,
  add column exterior_color text,
  add column interior_color text,
  add column body_style text,
  add column drivetrain text,
  add column fuel_type text,
  add column engine text,
  add column ownership_history text,
  add column maintenance_history text,
  add column modifications text,
  add column known_issues text,
  add column sale_reason text;

alter table public.listings
  add constraint listings_title_length check (length(title) between 1 and 200),
  add constraint listings_variant_length check (variant is null or length(variant) <= 100),
  add constraint listings_mileage_nonnegative check (mileage_km is null or mileage_km >= 0),
  add constraint listings_city_length check (city is null or length(city) <= 100),
  add constraint listings_state_region_length check (state_region is null or length(state_region) <= 100),
  add constraint listings_exterior_color_length check (exterior_color is null or length(exterior_color) <= 60),
  add constraint listings_interior_color_length check (interior_color is null or length(interior_color) <= 60),
  add constraint listings_body_style_length check (body_style is null or length(body_style) <= 80),
  add constraint listings_transmission_length check (transmission is null or length(transmission) <= 80),
  add constraint listings_drivetrain_length check (drivetrain is null or length(drivetrain) <= 80),
  add constraint listings_fuel_type_length check (fuel_type is null or length(fuel_type) <= 80),
  add constraint listings_engine_length check (engine is null or length(engine) <= 120),
  add constraint listings_owner_description_length check (owner_description is null or length(owner_description) <= 5000),
  add constraint listings_ownership_history_length check (ownership_history is null or length(ownership_history) <= 5000),
  add constraint listings_maintenance_history_length check (maintenance_history is null or length(maintenance_history) <= 5000),
  add constraint listings_modifications_length check (modifications is null or length(modifications) <= 5000),
  add constraint listings_known_issues_length check (known_issues is null or length(known_issues) <= 5000),
  add constraint listings_sale_reason_length check (sale_reason is null or length(sale_reason) <= 2000);

-- Una FK compuesta impide guardar un modelo que no pertenezca a la marca.
alter table public.models add constraint models_id_brand_unique unique (id, brand_id);
alter table public.listings drop constraint listings_model_id_fkey;
alter table public.listings add constraint listings_model_belongs_to_brand
  foreign key (model_id, brand_id) references public.models(id, brand_id);

create function public.validate_listing_taxonomy() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories where id = new.category_id and active
  ) then raise exception 'Category must be active'; end if;
  if new.brand_id is not null and not exists (
    select 1 from public.brands where id = new.brand_id and active
  ) then raise exception 'Brand must be active'; end if;
  if new.model_id is not null and not exists (
    select 1 from public.models where id = new.model_id and brand_id = new.brand_id and active
  ) then raise exception 'Model must be active and belong to brand'; end if;
  return new;
end;
$$;
revoke all on function public.validate_listing_taxonomy() from public, anon, authenticated;
create trigger validate_listing_taxonomy_fields
before insert or update of category_id, brand_id, model_id on public.listings
for each row execute function public.validate_listing_taxonomy();

-- El título es siempre derivado; ni el formulario ni Data API lo controlan.
create function public.set_provisional_listing_title() returns trigger
language plpgsql set search_path = '' as $$
declare generated_title text;
begin
  select concat_ws(' ', new.year::text, b.name, m.name, nullif(trim(new.variant), ''))
    into generated_title
    from (select 1) seed
    left join public.brands b on b.id = new.brand_id
    left join public.models m on m.id = new.model_id;
  new.title := coalesce(nullif(trim(generated_title), ''), 'Borrador sin identificar');
  return new;
end;
$$;
revoke all on function public.set_provisional_listing_title() from public, anon, authenticated;
create trigger set_listing_provisional_title
before insert or update of year, brand_id, model_id, variant, title on public.listings
for each row execute function public.set_provisional_listing_title();

-- Amplía la defensa existente: slug y clasificación editorial tampoco pertenecen
-- al formulario del propietario.
create or replace function public.guard_listing_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.owner_id is distinct from new.owner_id then raise exception 'Owner cannot be changed'; end if;
  if old.status is distinct from new.status and current_setting('app.status_transition', true) <> 'allowed' then
    raise exception 'Use transition_listing to change status';
  end if;
  if not public.is_staff() and (
    old.slug is distinct from new.slug or
    old.listing_type is distinct from new.listing_type or
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
