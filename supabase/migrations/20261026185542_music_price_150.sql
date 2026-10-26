-- User-confirmed price for the four optional music tracks.
-- A new catalog version forces clients that saw 120 credits to reconfirm.
do $$
declare
  v_updated integer;
begin
  if (select count(*) from public.cosmetic_items where slot = 'music') <> 4
    or (select count(*) from public.cosmetic_items
        where slot = 'music' and price = 120 and catalog_version = 1 and is_active) <> 4
  then raise exception 'Music price migration preflight failed'; end if;

  update public.cosmetic_items
    set price = 150, catalog_version = 2
    where slot = 'music' and price = 120 and catalog_version = 1;
  get diagnostics v_updated = row_count;
  if v_updated <> 4 then raise exception 'Music price migration updated % rows', v_updated; end if;
end;
$$;
