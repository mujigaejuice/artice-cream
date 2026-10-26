-- Four optional background tracks. Keep the new catalog rows inactive until
-- the web bundle can render, preview, and equip them.
begin;

alter table public.cosmetic_items drop constraint cosmetic_items_slot_check;
alter table public.cosmetic_items add constraint cosmetic_items_slot_check
  check (slot in ('palette','cone','topping','background','music'));
alter table public.user_cosmetics drop constraint user_cosmetics_slot_check;
alter table public.user_cosmetics add constraint user_cosmetics_slot_check
  check (slot in ('palette','cone','topping','background','music'));

insert into public.cosmetic_items(id,slot,name_ko,price,asset_key,sort_order) values
  ('one-scoop-of-joy','music','One Scoop of Joy',120,'one-scoop-of-joy',10),
  ('tiptoe-into-sunlight','music','Tiptoe Into Sunlight',120,'tiptoe-into-sunlight',20),
  ('two-scoops-of-july','music','Two Scoops of July',120,'two-scoops-of-july',30),
  ('waffle-cone-waltz','music','Waffle Cone Waltz',120,'waffle-cone-waltz',40);

create or replace function public.equip_cosmetic(p_user_id uuid, p_slot text, p_item_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_item_slot text;
begin
  if p_slot is null or p_slot not in ('palette','cone','topping','background','music') then
    return jsonb_build_object('error','invalid_body');
  end if;
  perform id from public.profiles where id = p_user_id for update;
  if not found then return jsonb_build_object('error','unauthenticated'); end if;
  if p_item_id is null then
    delete from public.user_cosmetics where user_id = p_user_id and slot = p_slot;
  else
    select i.slot into v_item_slot from public.user_unlocks u
      join public.cosmetic_items i on i.id = u.item_id
      where u.user_id = p_user_id and u.item_id = p_item_id;
    if not found then return jsonb_build_object('error','item_not_owned'); end if;
    if v_item_slot <> p_slot then return jsonb_build_object('error','wrong_slot'); end if;
    insert into public.user_cosmetics(user_id,slot,item_id)
      values(p_user_id,p_slot,p_item_id)
      on conflict (user_id,slot) do update set item_id = excluded.item_id,
        updated_at = clock_timestamp();
  end if;
  return jsonb_build_object('status','equipped',
    'equipped',public.get_cosmetic_state(p_user_id)->'equipped');
end;
$$;

notify pgrst, 'reload schema';
commit;
