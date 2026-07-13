insert into public.categories (name, slug) values
  ('Clásicos', 'clasicos'), ('Deportivos', 'deportivos'), ('Todoterreno', 'todoterreno')
on conflict (slug) do update set name = excluded.name, active = true;

insert into public.brands (name, slug) values
  ('Ford', 'ford'), ('Mazda', 'mazda'), ('Porsche', 'porsche'), ('Toyota', 'toyota')
on conflict (slug) do update set name = excluded.name, active = true;

insert into public.models (brand_id, name, slug)
select b.id, v.name, v.slug from (values
  ('ford', 'Mustang', 'mustang'), ('mazda', 'MX-5', 'mx-5'),
  ('porsche', '911', '911'), ('toyota', 'Land Cruiser', 'land-cruiser')
) as v(brand_slug, name, slug) join public.brands b on b.slug = v.brand_slug
on conflict (brand_id, slug) do update set name = excluded.name, active = true;
