-- service_role sigue siendo exclusivamente servidor/operaciones privilegiadas.
-- RLS se omite por diseño para este rol, pero la Data API también exige grants SQL.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
